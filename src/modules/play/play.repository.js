const { pool } = require('../../config/db');
const { parseJsonColumn } = require('../../utils/jsonColumn');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const JOIN_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const DEFAULT_TIME_LIMIT = 20;

function randomJoinCode() {
  let code = '';
  for (let i = 0; i < 6; i += 1) code += JOIN_CODE_CHARS[Math.floor(Math.random() * JOIN_CODE_CHARS.length)];
  return code;
}

async function uniqueJoinCode() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = randomJoinCode();
    const [rows] = await pool.query('SELECT id FROM game_sessions WHERE join_code = ? LIMIT 1', [code]);
    if (!rows.length) return code;
  }
  throw new Error('Could not generate a unique join code, please retry');
}

function randomToken() {
  return require('crypto').randomBytes(16).toString('hex');
}

// ---------------------------------------------------------------------------
// Board tile selection — each game (quiz) shows exactly 6 point tiles: 2 at
// 200, 2 at 400, 2 at 600. A quiz's question bank can hold more than 6, in
// which case each session gets a different random 6 — but the pick has to
// stay the *same* for the lifetime of one session, since the client polls
// getBoard() repeatedly (refresh/socket events) and re-shuffling on every
// call would make tiles jump around mid-game. So the selection is a pure,
// deterministic function of (sessionId, quizId, points) rather than a fresh
// Math.random() draw — same inputs always produce the same 2 questions.
// ---------------------------------------------------------------------------
const BOARD_POINT_TIERS = [200, 400, 600];
const TILES_PER_QUIZ_TIER = 2;

function seedFrom(...parts) {
  const str = parts.join(':');
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededShuffle(items, seed) {
  let state = seed || 1;
  const next = () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// The session's chosen categories (quizzes) and its Solo/Team question
// filter — shared by getBoard, questionBelongsToSession and
// boardFullyPlayed so all three agree on exactly the same tile selection.
async function getSessionQuizIdsAndMode(sessionId) {
  const [sessionRows] = await pool.query('SELECT mode FROM game_sessions WHERE id = ? LIMIT 1', [sessionId]);
  const sessionMode = sessionRows[0]?.mode === 'team' ? 'team' : 'solo';
  const [quizRows] = await pool.query(
    `SELECT gsc.quiz_id FROM game_session_categories gsc WHERE gsc.session_id = ? ORDER BY gsc.sort_order ASC`,
    [sessionId]
  );
  return { sessionMode, quizIds: quizRows.map((r) => r.quiz_id) };
}

// Returns the quiz_questions rows that make up this session's board — up to
// TILES_PER_QUIZ_TIER questions per point tier per quiz (fewer if a quiz's
// bank doesn't have enough at some tier), deterministically picked per
// (sessionId, quizId, points) so the set never shifts once a game starts.
async function getSessionBoardQuestions(sessionId, sessionMode, quizIds) {
  if (!quizIds.length) return [];
  const [questions] = await pool.query(
    `SELECT * FROM quiz_questions WHERE quiz_id IN (?) AND mode IN ('both', ?) ORDER BY quiz_id ASC, points ASC, sort_order ASC`,
    [quizIds, sessionMode]
  );
  const byQuiz = new Map();
  for (const q of questions) {
    if (!byQuiz.has(q.quiz_id)) byQuiz.set(q.quiz_id, []);
    byQuiz.get(q.quiz_id).push(q);
  }
  const selected = [];
  for (const quizId of quizIds) {
    const quizQuestions = byQuiz.get(quizId) || [];
    for (const points of BOARD_POINT_TIERS) {
      const tierQuestions = quizQuestions.filter((q) => q.points === points);
      const seed = seedFrom(sessionId, quizId, points);
      selected.push(...seededShuffle(tierQuestions, seed).slice(0, TILES_PER_QUIZ_TIER));
    }
  }
  return selected;
}

// Strips the answer key from a question row unless explicitly allowed
// (only once it has been answered / the turn has resolved).
function sanitizeQuestion(question, { revealAnswer = false } = {}) {
  if (!question) return null;
  const { correct_option_index, ...rest } = question;
  return revealAnswer ? question : rest;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Turn order is always a flat list of participant ids. For team mode we
// interleave so possession alternates between teams (A, B, A, B, ...) while
// still reading as "it's <name>'s turn" per participant, matching the design.
function buildTurnOrder(participants, mode) {
  if (mode === 'team') {
    const byTeam = new Map();
    for (const p of participants) {
      const key = p.team_id || 0;
      if (!byTeam.has(key)) byTeam.set(key, []);
      byTeam.get(key).push(p.id);
    }
    const lanes = [...byTeam.values()];
    const order = [];
    let i = 0;
    let added = true;
    while (added) {
      added = false;
      for (const lane of lanes) {
        if (lane[i] !== undefined) {
          order.push(lane[i]);
          added = true;
        }
      }
      i += 1;
    }
    return order;
  }
  return shuffle(participants.map((p) => p.id));
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

async function findSessionRaw(id) {
  const [rows] = await pool.query('SELECT * FROM game_sessions WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function findSessionByJoinCode(joinCode) {
  const [rows] = await pool.query('SELECT * FROM game_sessions WHERE join_code = ? LIMIT 1', [joinCode.toUpperCase()]);
  return rows[0] || null;
}

async function getParticipants(sessionId) {
  const [rows] = await pool.query(
    `SELECT gp.*, u.full_name, u.avatar_url, gt.name AS team_name
     FROM game_participants gp
     LEFT JOIN users u ON u.id = gp.user_id
     LEFT JOIN game_teams gt ON gt.id = gp.team_id
     WHERE gp.session_id = ?
     ORDER BY gp.joined_at ASC`,
    [sessionId]
  );
  // Guest participants (no linked account) only have gp.guest_name — the
  // LEFT JOIN above keeps them in the list instead of silently dropping
  // them, so fall their display name back to it here.
  return rows.map((row) => ({ ...row, full_name: row.full_name || row.guest_name || 'Player' }));
}

async function getTeams(sessionId) {
  const [rows] = await pool.query('SELECT * FROM game_teams WHERE session_id = ? ORDER BY id ASC', [sessionId]);
  return rows;
}

async function findParticipant(sessionId, userId) {
  const [rows] = await pool.query(
    'SELECT * FROM game_participants WHERE session_id = ? AND user_id = ? AND left_at IS NULL LIMIT 1',
    [sessionId, userId]
  );
  return rows[0] || null;
}

async function findParticipantById(participantId) {
  const [rows] = await pool.query(
    `SELECT gp.*, u.full_name, u.avatar_url, gt.name AS team_name FROM game_participants gp
     LEFT JOIN users u ON u.id = gp.user_id
     LEFT JOIN game_teams gt ON gt.id = gp.team_id
     WHERE gp.id = ? LIMIT 1`,
    [participantId]
  );
  if (!rows[0]) return null;
  // Same guest fallback as getParticipants() — without it, lifeline/score/
  // phone-a-friend actions that resolve a guest participant by id would
  // find the row but report a blank name.
  return { ...rows[0], full_name: rows[0].full_name || rows[0].guest_name || 'Player' };
}

// The board: every quiz (category column) chosen for this session, with its
// questions as point tiles. `used` reflects whether that tile already has a
// game_answers row (already played, can't be picked again).
async function getBoard(sessionId) {
  const [quizzes] = await pool.query(
    `SELECT q.id, q.title_en, q.title_ar, q.category_id, q.cover_image_url,
            gc.name_en AS category_name_en, gc.name_ar AS category_name_ar,
            gsc.sort_order
     FROM game_session_categories gsc
     JOIN quizzes q ON q.id = gsc.quiz_id
     LEFT JOIN game_categories gc ON gc.id = q.category_id
     WHERE gsc.session_id = ?
     ORDER BY gsc.sort_order ASC`,
    [sessionId]
  );
  if (!quizzes.length) return [];

  // A question authored as Solo-only or Team-only only shows up on a board
  // for a matching session; 'both' (the default) always shows. A 'random'
  // session is treated like solo for this filter.
  const { sessionMode, quizIds } = await getSessionQuizIdsAndMode(sessionId);
  const boardQuestions = await getSessionBoardQuestions(sessionId, sessionMode, quizIds);
  const [usedRows] = await pool.query(
    `SELECT DISTINCT question_id FROM game_answers WHERE session_id = ?`,
    [sessionId]
  );
  const usedIds = new Set(usedRows.map((r) => r.question_id));

  return quizzes.map((quiz) => ({
    ...quiz,
    questions: boardQuestions
      .filter((q) => q.quiz_id === quiz.id)
      .map((q) => ({ ...sanitizeQuestion(q), used: usedIds.has(q.id) })),
  }));
}

async function findQuestionRaw(id) {
  const [rows] = await pool.query('SELECT * FROM quiz_questions WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function questionBelongsToSession(sessionId, questionId) {
  const { sessionMode, quizIds } = await getSessionQuizIdsAndMode(sessionId);
  const boardQuestions = await getSessionBoardQuestions(sessionId, sessionMode, quizIds);
  return boardQuestions.some((q) => q.id === Number(questionId));
}

async function isQuestionUsed(sessionId, questionId) {
  const [rows] = await pool.query(
    'SELECT 1 FROM game_answers WHERE session_id = ? AND question_id = ? LIMIT 1',
    [sessionId, questionId]
  );
  return rows.length > 0;
}

async function boardFullyPlayed(sessionId) {
  const { sessionMode, quizIds } = await getSessionQuizIdsAndMode(sessionId);
  const boardQuestions = await getSessionBoardQuestions(sessionId, sessionMode, quizIds);
  const total = boardQuestions.length;
  const [[{ used }]] = await pool.query(
    'SELECT COUNT(DISTINCT question_id) AS used FROM game_answers WHERE session_id = ?',
    [sessionId]
  );
  return total > 0 && used >= total;
}

// Full detail payload used by the lobby, the live game screen, and reconnects.
async function findSessionDetail(sessionId) {
  const session = await findSessionRaw(sessionId);
  if (!session) return null;

  const [participants, teams, board] = await Promise.all([
    getParticipants(sessionId),
    session.mode === 'team' ? getTeams(sessionId) : Promise.resolve([]),
    getBoard(sessionId),
  ]);

  const turnOrder = parseJsonColumn(session.turn_order_json, []);
  const currentTurnParticipantId = turnOrder[session.current_turn_index] || null;

  let currentQuestion = null;
  if (session.current_question_id) {
    const q = await findQuestionRaw(session.current_question_id);
    currentQuestion = sanitizeQuestion(q);
  }

  return {
    ...session,
    turn_order_json: undefined,
    current_scan_token: undefined, // never leak the QR scan secret through session state
    turnOrder,
    currentTurnParticipantId,
    currentQuestion,
    awaitingScan: Boolean(session.current_scan_token && !session.current_scan_scanned_at),
    participants,
    teams,
    board,
  };
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

async function createSession({
  hostUserId, mode, quizIds = [], title, isPublic = false, maxPlayers, schoolId,
  // Team mode: custom team names, an optional headcount hint per team
  // (game_teams.capacity — not enforced, just informational), and up to a
  // few pre-named guest teammates per team (no account needed — they play
  // under game_participants.guest_name, same as any QR-join guest).
  team1Name, team2Name, team1Capacity, team2Capacity, team1Players = [], team2Players = [],
}) {
  const joinCode = await uniqueJoinCode();
  const [result] = await pool.query(
    `INSERT INTO game_sessions (quiz_id, title, host_user_id, school_id, mode, is_public, max_players, join_code, status)
     VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, 'waiting')`,
    [title || null, hostUserId, schoolId || null, mode, isPublic ? 1 : 0, maxPlayers || null, joinCode]
  );
  const sessionId = result.insertId;

  if (quizIds.length) {
    const values = quizIds.map((quizId, idx) => [sessionId, quizId, idx]);
    await pool.query('INSERT INTO game_session_categories (session_id, quiz_id, sort_order) VALUES ?', [values]);
  }

  let hostTeamId = null;
  let team1Id = null;
  let team2Id = null;
  if (mode === 'team') {
    await pool.query('INSERT INTO game_teams (session_id, name, capacity) VALUES (?, ?, ?), (?, ?, ?)', [
      sessionId, team1Name || 'Team A', team1Capacity || null,
      sessionId, team2Name || 'Team B', team2Capacity || null,
    ]);
    const teams = await getTeams(sessionId);
    team1Id = teams[0].id;
    team2Id = teams[1].id;
    hostTeamId = team1Id;
  }

  await pool.query('INSERT INTO game_participants (session_id, user_id, team_id) VALUES (?, ?, ?)', [
    sessionId, hostUserId, hostTeamId,
  ]);

  if (mode === 'team') {
    const team1GuestNames = team1Players.filter((name) => String(name || '').trim()).map((name) => String(name).trim());
    const team2GuestNames = team2Players.filter((name) => String(name || '').trim()).map((name) => String(name).trim());
    // Team 1 always has the host, but naming teammates is optional — team 2
    // has no host of its own, so if nobody named a player for it, it would
    // otherwise end up with zero game_participants rows and could never
    // take a turn, be scored, or show a +/- control at all (the turn
    // engine and score adjustment both act on a real participant row, not
    // the team row directly). Give it one implicit placeholder player so
    // it's always actionable even when left fully anonymous.
    if (!team2GuestNames.length) team2GuestNames.push('Player 1');

    const guestRows = [
      ...team1GuestNames.map((name) => [sessionId, name, team1Id]),
      ...team2GuestNames.map((name) => [sessionId, name, team2Id]),
    ];
    if (guestRows.length) {
      await pool.query('INSERT INTO game_participants (session_id, guest_name, team_id) VALUES ?', [guestRows]);
    }
  }

  return findSessionDetail(sessionId);
}

async function joinSession(sessionId, userId) {
  const session = await findSessionRaw(sessionId);
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (session.status !== 'waiting') throw new Error('SESSION_NOT_JOINABLE');

  const existing = await findParticipant(sessionId, userId);
  if (existing) return session;

  if (session.max_players) {
    const [[{ count }]] = await pool.query(
      'SELECT COUNT(*) AS count FROM game_participants WHERE session_id = ? AND left_at IS NULL',
      [sessionId]
    );
    if (count >= session.max_players) throw new Error('SESSION_FULL');
  }

  let teamId = null;
  if (session.mode === 'team') {
    const teams = await getTeams(sessionId);
    const counts = await Promise.all(
      teams.map(async (t) => {
        const [[{ c }]] = await pool.query(
          'SELECT COUNT(*) AS c FROM game_participants WHERE team_id = ? AND left_at IS NULL',
          [t.id]
        );
        return { id: t.id, c };
      })
    );
    counts.sort((a, b) => a.c - b.c);
    teamId = counts[0].id;
  }

  await pool.query('INSERT INTO game_participants (session_id, user_id, team_id) VALUES (?, ?, ?)', [
    sessionId, userId, teamId,
  ]);
  return session;
}

async function startSession(sessionId, hostUserId) {
  const session = await findSessionRaw(sessionId);
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (session.host_user_id !== hostUserId) throw new Error('NOT_HOST');
  if (session.status !== 'waiting') throw new Error('ALREADY_STARTED');

  const participants = await getParticipants(sessionId);
  if (!participants.length) throw new Error('NO_PLAYERS');
  const board = await getBoard(sessionId);
  if (!board.length) throw new Error('NO_CATEGORIES');

  const turnOrder = buildTurnOrder(participants, session.mode);
  await pool.query(
    `UPDATE game_sessions
     SET status = 'active', started_at = NOW(), turn_order_json = ?, current_turn_index = 0
     WHERE id = ?`,
    [JSON.stringify(turnOrder), sessionId]
  );
  return findSessionDetail(sessionId);
}

async function leaveSession(sessionId, userId) {
  const participant = await findParticipant(sessionId, userId);
  if (!participant) return null;
  await pool.query('UPDATE game_participants SET left_at = NOW() WHERE id = ?', [participant.id]);

  const session = await findSessionRaw(sessionId);
  if (session && session.status === 'active') {
    const turnOrder = parseJsonColumn(session.turn_order_json, []);
    if (turnOrder[session.current_turn_index] === participant.id) {
      await advanceTurn(sessionId);
    }
  }
  return participant;
}

// ---------------------------------------------------------------------------
// Turn engine
// ---------------------------------------------------------------------------

async function advanceTurn(sessionId) {
  const session = await findSessionRaw(sessionId);
  const turnOrder = parseJsonColumn(session.turn_order_json, []);
  if (!turnOrder.length) return;

  const [activeRows] = await pool.query(
    'SELECT id FROM game_participants WHERE session_id = ? AND left_at IS NULL',
    [sessionId]
  );
  const activeIds = new Set(activeRows.map((r) => r.id));

  let nextIndex = session.current_turn_index;
  for (let step = 1; step <= turnOrder.length; step += 1) {
    const candidate = (session.current_turn_index + step) % turnOrder.length;
    if (activeIds.has(turnOrder[candidate])) {
      nextIndex = candidate;
      break;
    }
  }

  const finished = await boardFullyPlayed(sessionId);
  if (finished) {
    await pool.query(
      `UPDATE game_sessions SET status = 'finished', ended_at = NOW(), current_question_id = NULL,
       turn_started_at = NULL, turn_ends_at = NULL, current_scan_token = NULL, current_scan_scanned_at = NULL
       WHERE id = ?`,
      [sessionId]
    );
    return;
  }

  await pool.query(
    `UPDATE game_sessions
     SET current_turn_index = ?, current_question_id = NULL, turn_started_at = NULL, turn_ends_at = NULL,
         current_scan_token = NULL, current_scan_scanned_at = NULL
     WHERE id = ?`,
    [nextIndex, sessionId]
  );
}

// Every website game is played pass-the-device style (see CategorySelectPage
// / LiveGamePage on the frontend): only the host ever logs in, and runs the
// single shared screen on behalf of every named teammate, who has no
// account of their own. So a turn action is allowed either when the caller
// genuinely owns it (their own account happens to be the current-turn
// participant) or when the caller is this session's host acting on behalf
// of whoever's turn it currently is — otherwise a guest's (or a second
// team's) turn could never be taken at all. Returns the id of the
// participant the action should actually be recorded/scored against, which
// is always the real current-turn participant, never the host's own id.
function resolveActingParticipant(session, participant, userId) {
  const turnOrder = parseJsonColumn(session.turn_order_json, []);
  const activeParticipantId = turnOrder[session.current_turn_index];
  if (!activeParticipantId) throw new Error('NOT_YOUR_TURN');
  if (participant && participant.id === activeParticipantId) return activeParticipantId;
  if (session.host_user_id === userId) return activeParticipantId;
  throw new Error('NOT_YOUR_TURN');
}

async function pickTile(sessionId, userId, questionId) {
  const session = await findSessionRaw(sessionId);
  if (!session || session.status !== 'active') throw new Error('SESSION_NOT_ACTIVE');
  const participant = await findParticipant(sessionId, userId);
  resolveActingParticipant(session, participant, userId);
  if (session.current_question_id) throw new Error('TILE_ALREADY_IN_PROGRESS');

  const belongs = await questionBelongsToSession(sessionId, questionId);
  if (!belongs) throw new Error('QUESTION_NOT_ON_BOARD');
  if (await isQuestionUsed(sessionId, questionId)) throw new Error('TILE_ALREADY_USED');

  const question = await findQuestionRaw(questionId);
  const timeLimit = question.time_limit_seconds || DEFAULT_TIME_LIMIT;

  if (question.question_type === 'qr') {
    const token = randomToken();
    await pool.query(
      `UPDATE game_sessions SET current_question_id = ?, current_scan_token = ?, current_scan_scanned_at = NULL,
       turn_started_at = NULL, turn_ends_at = NULL WHERE id = ?`,
      [questionId, token, sessionId]
    );
    return { question: sanitizeQuestion(question), awaitingScan: true, scanToken: token };
  }

  await pool.query(
    `UPDATE game_sessions SET current_question_id = ?, turn_started_at = NOW(),
     turn_ends_at = DATE_ADD(NOW(), INTERVAL ? SECOND), current_scan_token = NULL, current_scan_scanned_at = NULL
     WHERE id = ?`,
    [questionId, timeLimit, sessionId]
  );
  return { question: sanitizeQuestion(question), awaitingScan: false, timeLimitSeconds: timeLimit };
}

// Scanning is authorized by knowing the token shown on the live game's QR
// code, not by being the current-turn participant — a second device (e.g.
// the player's phone) is expected to do the actual scanning.
async function scanQuestion(sessionId, userId, token) {
  const session = await findSessionRaw(sessionId);
  if (!session || !session.current_question_id) throw new Error('NO_ACTIVE_QUESTION');
  if (!token || session.current_scan_token !== token) throw new Error('INVALID_SCAN_TOKEN');

  const question = await findQuestionRaw(session.current_question_id);
  const timeLimit = question.time_limit_seconds || DEFAULT_TIME_LIMIT;
  await pool.query(
    `UPDATE game_sessions SET current_scan_scanned_at = NOW(), turn_started_at = NOW(),
     turn_ends_at = DATE_ADD(NOW(), INTERVAL ? SECOND) WHERE id = ?`,
    [timeLimit, sessionId]
  );
  return { question: sanitizeQuestion(question), timeLimitSeconds: timeLimit };
}

// Like advanceTurn, but keeps the same tile/question active and just hands
// the turn to the next participant instead of closing the tile out. Used in
// team mode after the first team answers a tile — the same question is
// re-served to the other team rather than the tile ending there.
async function advanceSubTurn(sessionId, question) {
  const session = await findSessionRaw(sessionId);
  const turnOrder = parseJsonColumn(session.turn_order_json, []);
  const timeLimit = question.time_limit_seconds || DEFAULT_TIME_LIMIT;
  if (!turnOrder.length) return { awaitingScan: false, timeLimitSeconds: timeLimit };

  const [activeRows] = await pool.query(
    'SELECT id FROM game_participants WHERE session_id = ? AND left_at IS NULL',
    [sessionId]
  );
  const activeIds = new Set(activeRows.map((r) => r.id));

  let nextIndex = session.current_turn_index;
  for (let step = 1; step <= turnOrder.length; step += 1) {
    const candidate = (session.current_turn_index + step) % turnOrder.length;
    if (activeIds.has(turnOrder[candidate])) {
      nextIndex = candidate;
      break;
    }
  }

  if (question.question_type === 'qr') {
    const token = randomToken();
    await pool.query(
      `UPDATE game_sessions SET current_turn_index = ?, current_scan_token = ?, current_scan_scanned_at = NULL,
       turn_started_at = NULL, turn_ends_at = NULL WHERE id = ?`,
      [nextIndex, token, sessionId]
    );
    return { awaitingScan: true, scanToken: token };
  }

  await pool.query(
    `UPDATE game_sessions SET current_turn_index = ?, turn_started_at = NOW(),
     turn_ends_at = DATE_ADD(NOW(), INTERVAL ? SECOND), current_scan_token = NULL, current_scan_scanned_at = NULL
     WHERE id = ?`,
    [nextIndex, timeLimit, sessionId]
  );
  return { awaitingScan: false, timeLimitSeconds: timeLimit };
}

// Resolves the current tile: writes the answer (or a null/skip/timeout),
// scores it, and advances the turn. Used by the real answer submission, the
// skip lifeline, and the server-side timeout.
//
// Team mode plays every tile out with BOTH teams: whichever team answers a
// tile's question first, right or wrong, the same question is immediately
// re-served to the other team (see advanceSubTurn) instead of the tile
// ending there. Only once both teams have had a turn at it is the tile
// settled — whichever team answered correctly first wins it outright (if
// the first team was right, a correct second answer doesn't change the
// outcome); if neither team got it right, nobody scores ("Everyone Lost").
async function resolveTurn(sessionId, { participantId, selectedOptionIndex = null, timeTakenMs = null }) {
  const session = await findSessionRaw(sessionId);
  if (!session || !session.current_question_id) return null;
  const question = await findQuestionRaw(session.current_question_id);

  const isCorrect = selectedOptionIndex !== null && Number(selectedOptionIndex) === question.correct_option_index;

  let priorAnswer = null;
  if (session.mode === 'team') {
    const [priorRows] = await pool.query(
      `SELECT ga.* FROM game_answers ga WHERE ga.session_id = ? AND ga.question_id = ? ORDER BY ga.id ASC LIMIT 1`,
      [sessionId, question.id]
    );
    priorAnswer = priorRows[0] || null;
  }

  await pool.query(
    `INSERT INTO game_answers (session_id, participant_id, question_id, selected_option_index, is_correct, time_taken_ms)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, participantId, question.id, selectedOptionIndex, isCorrect ? 1 : 0, timeTakenMs]
  );

  const participant = await findParticipantById(participantId);

  async function awardPoints(pid, pRow) {
    await pool.query('UPDATE game_participants SET score = score + ? WHERE id = ?', [question.points, pid]);
    if (pRow?.team_id) {
      await pool.query('UPDATE game_teams SET score = score + ? WHERE id = ?', [question.points, pRow.team_id]);
    }
  }

  if (session.mode === 'team') {
    if (!priorAnswer) {
      // First team to see this question — score it if correct, then hand
      // the very same question to the other team instead of closing it out.
      if (isCorrect) await awardPoints(participantId, participant);
      const advanceInfo = await advanceSubTurn(sessionId, question);
      return {
        question, isCorrect, correctOptionIndex: question.correct_option_index, participantId,
        roundComplete: false, ...advanceInfo,
      };
    }

    // Second (final) team — the tile is settled either way now.
    let winnerParticipantId = null;
    if (priorAnswer.is_correct) {
      winnerParticipantId = priorAnswer.participant_id;
    } else if (isCorrect) {
      winnerParticipantId = participantId;
      await awardPoints(participantId, participant);
    }

    await advanceTurn(sessionId);

    let winnerName = null;
    if (winnerParticipantId) {
      const winner = winnerParticipantId === participantId ? participant : await findParticipantById(winnerParticipantId);
      winnerName = winner?.team_name || winner?.full_name || null;
    }

    return {
      question, isCorrect, correctOptionIndex: question.correct_option_index, participantId,
      roundComplete: true, winnerParticipantId, winnerName, points: winnerParticipantId ? question.points : 0,
    };
  }

  // Solo / random: unchanged single-answer-then-advance behavior.
  if (isCorrect) await awardPoints(participantId, participant);
  await advanceTurn(sessionId);
  return {
    question, isCorrect, correctOptionIndex: question.correct_option_index, participantId, roundComplete: true,
  };
}

async function submitAnswer(sessionId, userId, questionId, selectedOptionIndex, timeTakenMs) {
  const session = await findSessionRaw(sessionId);
  if (!session || session.status !== 'active') throw new Error('SESSION_NOT_ACTIVE');
  if (!session.current_question_id || session.current_question_id !== Number(questionId)) {
    throw new Error('QUESTION_NOT_ACTIVE');
  }
  if (session.current_scan_token && !session.current_scan_scanned_at) throw new Error('AWAITING_SCAN');
  if (session.turn_ends_at && new Date(session.turn_ends_at).getTime() < Date.now()) throw new Error('TIME_EXPIRED');

  const participant = await findParticipant(sessionId, userId);
  const activeParticipantId = resolveActingParticipant(session, participant, userId);

  return resolveTurn(sessionId, { participantId: activeParticipantId, selectedOptionIndex, timeTakenMs });
}

// Called by the server-side turn timer when nobody answered in time.
async function expireTurn(sessionId) {
  const session = await findSessionRaw(sessionId);
  if (!session || session.status !== 'active' || !session.current_question_id) return null;
  const turnOrder = parseJsonColumn(session.turn_order_json, []);
  const participantId = turnOrder[session.current_turn_index];
  if (!participantId) return null;
  return resolveTurn(sessionId, { participantId, selectedOptionIndex: null });
}

// ---------------------------------------------------------------------------
// Lifelines
// ---------------------------------------------------------------------------

async function hasUsedLifeline(sessionId, participantId, lifelineType) {
  const [rows] = await pool.query(
    'SELECT 1 FROM game_lifeline_usage WHERE session_id = ? AND participant_id = ? AND lifeline_type = ? LIMIT 1',
    [sessionId, participantId, lifelineType]
  );
  return rows.length > 0;
}

async function markLifelineUsed(sessionId, participantId, lifelineType, questionId) {
  await pool.query(
    'INSERT INTO game_lifeline_usage (session_id, participant_id, lifeline_type, question_id) VALUES (?, ?, ?, ?)',
    [sessionId, participantId, lifelineType, questionId]
  );
}

async function useFiftyFifty(sessionId, userId, questionId) {
  const session = await findSessionRaw(sessionId);
  if (!session || session.current_question_id !== Number(questionId)) throw new Error('QUESTION_NOT_ACTIVE');
  const participant = await findParticipant(sessionId, userId);
  const activeParticipantId = resolveActingParticipant(session, participant, userId);
  if (await hasUsedLifeline(sessionId, activeParticipantId, 'fifty_fifty')) throw new Error('LIFELINE_ALREADY_USED');

  const question = await findQuestionRaw(questionId);
  const options = parseJsonColumn(question.options_json_en, []);
  const wrongIndices = options.map((_, i) => i).filter((i) => i !== question.correct_option_index);
  const hide = shuffle(wrongIndices).slice(0, Math.max(0, options.length - 2));

  await markLifelineUsed(sessionId, activeParticipantId, 'fifty_fifty', questionId);
  return { hideOptionIndexes: hide };
}

async function useSkip(sessionId, userId, questionId) {
  const session = await findSessionRaw(sessionId);
  if (!session || session.current_question_id !== Number(questionId)) throw new Error('QUESTION_NOT_ACTIVE');
  const participant = await findParticipant(sessionId, userId);
  const activeParticipantId = resolveActingParticipant(session, participant, userId);
  if (await hasUsedLifeline(sessionId, activeParticipantId, 'skip')) throw new Error('LIFELINE_ALREADY_USED');

  await markLifelineUsed(sessionId, activeParticipantId, 'skip', questionId);
  return resolveTurn(sessionId, { participantId: activeParticipantId, selectedOptionIndex: null });
}

async function requestPhoneAFriend(sessionId, userId, questionId, targetParticipantId) {
  const session = await findSessionRaw(sessionId);
  if (!session || session.current_question_id !== Number(questionId)) throw new Error('QUESTION_NOT_ACTIVE');
  const participant = await findParticipant(sessionId, userId);
  const activeParticipantId = resolveActingParticipant(session, participant, userId);
  if (await hasUsedLifeline(sessionId, activeParticipantId, 'phone_a_friend')) throw new Error('LIFELINE_ALREADY_USED');

  const target = await findParticipantById(targetParticipantId);
  if (!target || target.session_id !== Number(sessionId)) throw new Error('TARGET_NOT_IN_SESSION');
  if (target.id === activeParticipantId) throw new Error('CANNOT_TARGET_SELF');

  await markLifelineUsed(sessionId, activeParticipantId, 'phone_a_friend', questionId);
  const [result] = await pool.query(
    `INSERT INTO game_lifeline_requests (session_id, requester_participant_id, target_participant_id, question_id)
     VALUES (?, ?, ?, ?)`,
    [sessionId, activeParticipantId, targetParticipantId, questionId]
  );
  const question = await findQuestionRaw(questionId);
  return { requestId: result.insertId, targetUserId: target.user_id, question: sanitizeQuestion(question) };
}

async function respondPhoneAFriend(requestId, userId, suggestedOptionIndex) {
  const [rows] = await pool.query('SELECT * FROM game_lifeline_requests WHERE id = ? LIMIT 1', [requestId]);
  const request = rows[0];
  if (!request) throw new Error('REQUEST_NOT_FOUND');
  const target = await findParticipantById(request.target_participant_id);
  if (!target || target.user_id !== userId) throw new Error('NOT_YOUR_REQUEST');
  if (request.status !== 'pending') throw new Error('REQUEST_CLOSED');

  await pool.query(
    'UPDATE game_lifeline_requests SET status = ?, suggested_option_index = ?, responded_at = NOW() WHERE id = ?',
    ['answered', suggestedOptionIndex, requestId]
  );
  const requester = await findParticipantById(request.requester_participant_id);
  return { requesterUserId: requester.user_id, sessionId: request.session_id, suggestedOptionIndex };
}

// ---------------------------------------------------------------------------
// Invites, public matchmaking, score adjustments
// ---------------------------------------------------------------------------

async function searchInviteCandidates(sessionId, viewerUserId, q) {
  const term = `%${q || ''}%`;
  const [rows] = await pool.query(
    `SELECT u.id, u.full_name, u.avatar_url
     FROM users u
     WHERE u.is_active = 1 AND u.id != ? AND u.full_name LIKE ?
       AND u.id NOT IN (SELECT user_id FROM game_participants WHERE session_id = ? AND left_at IS NULL)
     ORDER BY u.full_name ASC
     LIMIT 20`,
    [viewerUserId, term, sessionId]
  );
  return rows;
}

async function createInvite(sessionId, inviterUserId, inviteeUserId) {
  await pool.query(
    `INSERT INTO game_invites (session_id, inviter_user_id, invitee_user_id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE status = 'pending', created_at = NOW(), responded_at = NULL`,
    [sessionId, inviterUserId, inviteeUserId]
  );
  const [rows] = await pool.query(
    'SELECT * FROM game_invites WHERE session_id = ? AND invitee_user_id = ? LIMIT 1',
    [sessionId, inviteeUserId]
  );
  return rows[0];
}

async function findInvite(id) {
  const [rows] = await pool.query('SELECT * FROM game_invites WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function respondInvite(inviteId, userId, accept) {
  const invite = await findInvite(inviteId);
  if (!invite || invite.invitee_user_id !== userId) throw new Error('INVITE_NOT_FOUND');
  if (invite.status !== 'pending') throw new Error('INVITE_CLOSED');

  await pool.query('UPDATE game_invites SET status = ?, responded_at = NOW() WHERE id = ?', [
    accept ? 'accepted' : 'declined', inviteId,
  ]);
  if (accept) await joinSession(invite.session_id, userId);
  return invite;
}

async function listPublicSessions({ mode, page = 1, pageSize = 20 } = {}) {
  const where = ["gs.status = 'waiting'", 'gs.is_public = 1'];
  const params = [];
  if (mode) { where.push('gs.mode = ?'); params.push(mode); }
  const limit = Math.min(Number(pageSize) || 20, 50);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

  const [rows] = await pool.query(
    `SELECT gs.*, u.full_name AS host_name,
            (SELECT COUNT(*) FROM game_participants gp WHERE gp.session_id = gs.id AND gp.left_at IS NULL) AS participant_count
     FROM game_sessions gs
     LEFT JOIN users u ON u.id = gs.host_user_id
     WHERE ${where.join(' AND ')}
     ORDER BY gs.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows;
}

async function matchRandom(sessionId, userId) {
  const session = await findSessionRaw(sessionId);
  if (!session) throw new Error('SESSION_NOT_FOUND');

  const [candidates] = await pool.query(
    `SELECT gs.* FROM game_sessions gs
     WHERE gs.status = 'waiting' AND gs.is_public = 1 AND gs.mode = ? AND gs.id != ? AND gs.host_user_id != ?
     ORDER BY gs.created_at ASC LIMIT 1`,
    [session.mode, sessionId, userId]
  );

  if (candidates.length) {
    await joinSession(candidates[0].id, userId);
    return { matchedSessionId: candidates[0].id, createdNew: false };
  }

  await pool.query('UPDATE game_sessions SET is_public = 1 WHERE id = ?', [sessionId]);
  return { matchedSessionId: sessionId, createdNew: true };
}

async function adjustScore(sessionId, hostUserId, participantId, delta, reason) {
  const session = await findSessionRaw(sessionId);
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (session.host_user_id !== hostUserId) throw new Error('NOT_HOST');

  const participant = await findParticipantById(participantId);
  if (!participant || participant.session_id !== Number(sessionId)) throw new Error('PARTICIPANT_NOT_FOUND');

  await pool.query('UPDATE game_participants SET score = GREATEST(0, score + ?) WHERE id = ?', [delta, participantId]);
  if (participant.team_id) {
    await pool.query('UPDATE game_teams SET score = GREATEST(0, score + ?) WHERE id = ?', [delta, participant.team_id]);
  }
  await pool.query(
    'INSERT INTO game_score_adjustments (session_id, participant_id, delta, adjusted_by_user_id) VALUES (?, ?, ?, ?)',
    [sessionId, participantId, delta, hostUserId]
  );
  return findParticipantById(participantId);
}

module.exports = {
  sanitizeQuestion,
  findSessionRaw,
  findSessionByJoinCode,
  findSessionDetail,
  getParticipants,
  getTeams,
  getBoard,
  findParticipant,
  findParticipantById,
  createSession,
  joinSession,
  startSession,
  leaveSession,
  pickTile,
  scanQuestion,
  submitAnswer,
  expireTurn,
  useFiftyFifty,
  useSkip,
  requestPhoneAFriend,
  respondPhoneAFriend,
  searchInviteCandidates,
  createInvite,
  findInvite,
  respondInvite,
  listPublicSessions,
  matchRandom,
  adjustScore,
};
