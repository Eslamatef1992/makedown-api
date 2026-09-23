const repo = require('./play.repository');
const packagesRepo = require('../packages/packages.repository');
const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');
const { pool } = require('../../config/db');
const env = require('../../config/env');

// ---------------------------------------------------------------------------
// Server-side turn timers: when a tile's answer window opens we schedule a
// timeout that auto-resolves the turn (no answer) if nobody submits in time,
// exactly like a real host enforcing the on-screen countdown.
// ---------------------------------------------------------------------------

const timers = new Map(); // sessionId -> Timeout

function clearSessionTimer(sessionId) {
  const handle = timers.get(sessionId);
  if (handle) {
    clearTimeout(handle);
    timers.delete(sessionId);
  }
}

// ---------------------------------------------------------------------------
// Per-session lock: scan/reveal/answer/qr-answer/skip all read the session's
// current turn state and then write a decision based on it (e.g. resolveTurn
// checking "has anyone already answered this question?" before deciding
// whether to hand the tile to the other team or settle it). Two of these
// requests landing back-to-back for the same session — a fast double-tap on
// the host's shared device, a flaky connection causing the client to retry,
// two people acting at once — could each read the state before the other's
// write lands, and the second one would then see the first team's just-
// inserted answer and treat itself as the *other* team's turn, settling the
// tile immediately instead of handing it off. Serializing every turn action
// for a given session removes that race entirely: the second request simply
// runs after the first has fully committed, so it always sees accurate state.
const sessionLocks = new Map(); // sessionId -> tail of the pending chain

function withSessionLock(sessionId, fn) {
  const key = String(sessionId);
  const prior = sessionLocks.get(key) || Promise.resolve();
  const run = prior.then(fn, fn);
  sessionLocks.set(key, run.catch(() => {}));
  return run;
}

function scheduleExpiry(sessionId, io, ms) {
  clearSessionTimer(sessionId);
  const handle = setTimeout(async () => {
    timers.delete(sessionId);
    try {
      const result = await withSessionLock(sessionId, () => repo.expireTurn(sessionId));
      if (result) {
        await broadcastTurnResult(io, sessionId, result.participantId, result);
        // Team mode: nobody answered in time, so the same question just got
        // handed to the other team — arm a fresh timer for their turn at it,
        // same as a real submit would.
        if (result.roundComplete === false && !result.awaitingScan) {
          scheduleExpiry(sessionId, io, result.timeLimitSeconds * 1000);
        }
      }
    } catch (err) {
      // Nothing to resolve (already answered by the time the timer fired) — ignore.
    }
  }, Math.max(0, ms));
  timers.set(sessionId, handle);
}

async function broadcastTurnResult(io, sessionId, participantId, result) {
  const detail = await repo.findSessionDetail(sessionId);
  io.to(`game:${sessionId}`).emit('game:answer_result', {
    sessionId: Number(sessionId),
    participantId,
    questionId: result.question.id,
    isCorrect: result.isCorrect,
    correctOptionIndex: result.correctOptionIndex,
    // Team mode only: false while the same question is still being handed
    // to the other team, true once the tile is actually settled — see
    // play.repository.js's resolveTurn.
    roundComplete: result.roundComplete !== false,
    winnerParticipantId: result.winnerParticipantId || null,
    winnerName: result.winnerName || null,
    points: result.points || 0,
  });

  if (result.roundComplete === false) {
    // Same tile, other team's turn — the tile isn't settled yet, so don't
    // touch game:state's currentQuestion/turn flow beyond announcing whose
    // turn it now is and (for a QR question) how to reveal it again.
    let scanUrl = null;
    let scanQrDataUrl = null;
    if (result.awaitingScan && result.scanToken) {
      scanUrl = `${env.frontendUrl}/play/scan/${sessionId}/${result.scanToken}`;
      try {
        const QRCode = require('qrcode');
        scanQrDataUrl = await QRCode.toDataURL(scanUrl, { margin: 1, width: 320 });
      } catch {
        // QR image generation failing still leaves the raw scanUrl usable.
      }
    }
    io.to(`game:${sessionId}`).emit('game:next_team_turn', {
      sessionId: Number(sessionId),
      question: repo.sanitizeQuestion(result.question),
      awaitingScan: Boolean(result.awaitingScan),
      timeLimitSeconds: result.timeLimitSeconds,
      scanUrl,
      scanQrDataUrl,
    });
    io.to(`game:${sessionId}`).emit('game:state', detail);
    if (detail.currentTurnParticipantId) {
      io.to(`game:${sessionId}`).emit('game:turn_changed', { sessionId: Number(sessionId), currentTurnParticipantId: detail.currentTurnParticipantId });
    }
    return;
  }

  io.to(`game:${sessionId}`).emit('game:state', detail);
  if (detail.status === 'finished') {
    io.to(`game:${sessionId}`).emit('game:ended', { sessionId: Number(sessionId), participants: detail.participants, teams: detail.teams });
  } else if (detail.currentTurnParticipantId) {
    io.to(`game:${sessionId}`).emit('game:turn_changed', { sessionId: Number(sessionId), currentTurnParticipantId: detail.currentTurnParticipantId });
  }
}

const ERROR_STATUS = {
  SESSION_NOT_FOUND: 404,
  SESSION_NOT_JOINABLE: 409,
  SESSION_FULL: 409,
  SESSION_NOT_ACTIVE: 409,
  ALREADY_STARTED: 409,
  NO_PLAYERS: 400,
  NO_CATEGORIES: 400,
  NOT_HOST: 403,
  NOT_YOUR_TURN: 403,
  TILE_ALREADY_IN_PROGRESS: 409,
  QUESTION_NOT_ON_BOARD: 400,
  TILE_ALREADY_USED: 409,
  QUESTION_NOT_ACTIVE: 409,
  AWAITING_SCAN: 409,
  TIME_EXPIRED: 409,
  INVALID_SCAN_TOKEN: 400,
  NO_ACTIVE_QUESTION: 409,
  LIFELINE_ALREADY_USED: 409,
  TARGET_NOT_IN_SESSION: 400,
  CANNOT_TARGET_SELF: 400,
  REQUEST_NOT_FOUND: 404,
  NOT_YOUR_REQUEST: 403,
  REQUEST_CLOSED: 409,
  INVITE_NOT_FOUND: 404,
  INVITE_CLOSED: 409,
  PARTICIPANT_NOT_FOUND: 404,
};

function mapError(err) {
  const status = ERROR_STATUS[err.message];
  if (status) return new ApiError(status, err.message.replace(/_/g, ' ').toLowerCase());
  throw err;
}

// Every user gets exactly one free game; after that, starting or joining a
// game requires an active package with credits left.
async function requireGameCredit(userId) {
  try {
    await packagesRepo.consumeGameCredit(userId);
  } catch (err) {
    if (err.message === 'NO_GAME_CREDITS') {
      throw new ApiError(402, "You've used your free game. Subscribe to a package to keep playing.");
    }
    throw err;
  }
}

async function requireParticipant(sessionId, userId) {
  const participant = await repo.findParticipant(sessionId, userId);
  if (!participant) throw ApiError.forbidden('You are not part of this game');
  return participant;
}

// ---------------------------------------------------------------------------
// Categories / quizzes (board picker)
// ---------------------------------------------------------------------------

const listPlayableQuizzes = asyncHandler(async (req, res) => {
  // `mode` ('solo' | 'team') comes from the website's Solo/Team picker —
  // only offer games the admin marked as supporting that mode (or 'both').
  const mode = ['solo', 'team'].includes(req.query.mode) ? req.query.mode : null;
  const params = [];
  // A school's own private games (school_id set, created from the school
  // admin panel's "My Games"/Create Game flow) are only ever playable
  // through that school's Education page + join code — they must never
  // show up in the general public Play category picker. Without this, an
  // uncategorized school quiz fell into the picker's "Other" bucket
  // alongside the real global catalog.
  let where = 'q.is_active = 1 AND q.school_id IS NULL';
  if (req.query.category_id) {
    where += ' AND q.category_id = ?';
    params.push(req.query.category_id);
  }
  if (mode) {
    where += " AND (q.supported_modes = 'both' OR q.supported_modes = ?)";
    params.push(mode);
  }
  const [rows] = await pool.query(
    `SELECT q.id, q.title_en, q.title_ar, q.description_en, q.description_ar, q.cover_image_url,
            q.difficulty, q.category_id, q.supported_modes,
            gc.name_en AS category_name_en, gc.name_ar AS category_name_ar,
            (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS question_count
     FROM quizzes q
     LEFT JOIN game_categories gc ON gc.id = q.category_id
     WHERE ${where}
     ORDER BY q.title_en ASC`,
    params
  );
  ok(res, rows.filter((r) => r.question_count > 0));
});

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

const createSession = asyncHandler(async (req, res) => {
  const {
    mode, quizIds, title, isPublic, maxPlayers, schoolId,
    team1Name, team2Name, team1Capacity, team2Capacity, team1Players, team2Players,
  } = req.body;
  if (!['solo', 'team', 'random'].includes(mode)) throw ApiError.badRequest('mode must be solo, team, or random');
  if (!Array.isArray(quizIds) || !quizIds.length) throw ApiError.badRequest('Select at least one category');
  if (mode === 'team' && (!String(team1Name || '').trim() || !String(team2Name || '').trim())) {
    throw ApiError.badRequest('team1Name and team2Name are required for a team game');
  }

  await requireGameCredit(req.user.id);

  const session = await repo.createSession({
    hostUserId: req.user.id,
    mode,
    quizIds: quizIds.map(Number),
    title,
    isPublic: Boolean(isPublic) || mode === 'random',
    maxPlayers,
    schoolId,
    team1Name,
    team2Name,
    team1Capacity: team1Capacity ? Number(team1Capacity) : null,
    team2Capacity: team2Capacity ? Number(team2Capacity) : null,
    team1Players: Array.isArray(team1Players) ? team1Players : [],
    team2Players: Array.isArray(team2Players) ? team2Players : [],
  });

  try {
    const QRCode = require('qrcode');
    const joinUrl = `${env.frontendUrl}/play/join/${session.join_code}`;
    const qrDataUrl = await QRCode.toDataURL(joinUrl, { margin: 1, width: 320 });
    await pool.query('UPDATE game_sessions SET qr_code_url = ? WHERE id = ?', [qrDataUrl, session.id]);
    session.qr_code_url = qrDataUrl;
  } catch {
    // QR generation is a nice-to-have; the join code alone still works.
  }

  created(res, session, 'Game created');
});

const joinByCode = asyncHandler(async (req, res) => {
  const code = String(req.body.joinCode || '').trim().toUpperCase();
  if (!code) throw ApiError.badRequest('joinCode is required');
  const session = await repo.findSessionByJoinCode(code);
  if (!session) throw ApiError.notFound('No game found with that code');

  // Scheduled (school/education) games open 10 minutes before their start
  // time, matching the note shown on the website's school games page.
  if (session.scheduled_date && session.scheduled_time) {
    try {
      const datePart = session.scheduled_date instanceof Date
        ? session.scheduled_date.toISOString().slice(0, 10)
        : String(session.scheduled_date).slice(0, 10);
      const timePart = String(session.scheduled_time).slice(0, 8);
      const scheduledAt = new Date(`${datePart}T${timePart}`);
      if (!Number.isNaN(scheduledAt.getTime())) {
        const opensAt = new Date(scheduledAt.getTime() - 10 * 60 * 1000);
        if (Date.now() < opensAt.getTime()) {
          throw ApiError.badRequest(`This game opens 10 minutes before its start time (${timePart.slice(0, 5)}).`);
        }
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      // Don't let a scheduling-format hiccup block an otherwise valid join.
    }
  }

  // Rejoining a game you're already part of (reconnect, double-tap) must
  // never spend a second free game or credit — only a genuinely new join does.
  // A school-hosted game (session.school_id set) never charges a player's
  // personal free game/package credit either — the school is hosting the
  // event, a student shouldn't burn their own credit just to attend it.
  const alreadyIn = await repo.findParticipant(session.id, req.user.id);
  if (!alreadyIn && !session.school_id) await requireGameCredit(req.user.id);

  try {
    await repo.joinSession(session.id, req.user.id);
  } catch (err) {
    throw mapError(err);
  }

  const detail = await repo.findSessionDetail(session.id);
  const io = req.app.get('io');
  io.to(`game:${session.id}`).emit('game:state', detail);
  ok(res, detail, 'Joined');
});

const getSession = asyncHandler(async (req, res) => {
  const detail = await repo.findSessionDetail(req.params.id);
  if (!detail) throw ApiError.notFound('Game not found');
  ok(res, detail);
});

const startSession = asyncHandler(async (req, res) => {
  let detail;
  try {
    detail = await repo.startSession(req.params.id, req.user.id);
  } catch (err) {
    throw mapError(err);
  }
  const io = req.app.get('io');
  io.to(`game:${req.params.id}`).emit('game:started', detail);
  ok(res, detail, 'Game started');
});

const leaveSession = asyncHandler(async (req, res) => {
  await repo.leaveSession(req.params.id, req.user.id);
  const detail = await repo.findSessionDetail(req.params.id);
  const io = req.app.get('io');
  io.to(`game:${req.params.id}`).emit('game:state', detail);
  io.to(`game:${req.params.id}`).emit('game:player_left', { sessionId: Number(req.params.id), userId: req.user.id });
  ok(res, detail, 'Left game');
});

const listPublicSessions = asyncHandler(async (req, res) => {
  ok(res, await repo.listPublicSessions({ mode: req.query.mode, page: req.query.page, pageSize: req.query.pageSize }));
});

const matchRandom = asyncHandler(async (req, res) => {
  let result;
  try {
    result = await repo.matchRandom(req.params.id, req.user.id);
  } catch (err) {
    throw mapError(err);
  }
  const detail = await repo.findSessionDetail(result.matchedSessionId);
  const io = req.app.get('io');
  io.to(`game:${result.matchedSessionId}`).emit('game:state', detail);
  ok(res, { ...result, session: detail });
});

// ---------------------------------------------------------------------------
// Live play: pick tile / scan / answer
// ---------------------------------------------------------------------------

const pickTile = asyncHandler(async (req, res) => {
  await requireParticipant(req.params.id, req.user.id);
  let result;
  try {
    result = await repo.pickTile(req.params.id, req.user.id, Number(req.body.questionId));
  } catch (err) {
    throw mapError(err);
  }
  const io = req.app.get('io');
  let scanQrDataUrl = null;
  let scanUrl = null;
  // Only a real QR-gated question needs an actual scannable code — an audio
  // question is also "awaitingScan" (see GATED_QUESTION_TYPES) but reveals
  // itself via revealQuestion (the host tapping Next), not a second-device
  // scan, so there's nothing to generate a code for.
  if (result.awaitingScan && result.scanToken && result.question.question_type === 'qr') {
    scanUrl = `${env.frontendUrl}/play/scan/${req.params.id}/${result.scanToken}`;
    try {
      const QRCode = require('qrcode');
      scanQrDataUrl = await QRCode.toDataURL(scanUrl, { margin: 1, width: 320 });
    } catch {
      // QR image generation failing still leaves the raw scanUrl usable.
    }
  }
  io.to(`game:${req.params.id}`).emit('game:tile_picked', {
    sessionId: Number(req.params.id),
    question: result.question,
    awaitingScan: result.awaitingScan,
    timeLimitSeconds: result.timeLimitSeconds,
    scanUrl,
    scanQrDataUrl,
  });
  if (!result.awaitingScan) scheduleExpiry(req.params.id, io, result.timeLimitSeconds * 1000);
  ok(res, { ...result, scanUrl, scanQrDataUrl });
});

const scanQuestion = asyncHandler(async (req, res) => {
  await requireParticipant(req.params.id, req.user.id);
  let result;
  try {
    result = await withSessionLock(req.params.id, () => repo.scanQuestion(req.params.id, req.user.id, req.body.token));
  } catch (err) {
    throw mapError(err);
  }
  const io = req.app.get('io');
  io.to(`game:${req.params.id}`).emit('game:question_revealed', {
    sessionId: Number(req.params.id),
    question: result.question,
    timeLimitSeconds: result.timeLimitSeconds,
  });
  scheduleExpiry(req.params.id, io, result.timeLimitSeconds * 1000);
  ok(res, result);
});

// Audio questions: the host taps this once the clip has finished playing —
// same effect as scanQuestion (reveals the question/options and starts the
// timer) but authorized as a normal turn action instead of a scanned token,
// since there's no second device involved (see repo.revealQuestion).
const revealQuestion = asyncHandler(async (req, res) => {
  await requireParticipant(req.params.id, req.user.id);
  let result;
  try {
    result = await withSessionLock(req.params.id, () => repo.revealQuestion(req.params.id, req.user.id));
  } catch (err) {
    throw mapError(err);
  }
  const io = req.app.get('io');
  io.to(`game:${req.params.id}`).emit('game:question_revealed', {
    sessionId: Number(req.params.id),
    question: result.question,
    timeLimitSeconds: result.timeLimitSeconds,
  });
  scheduleExpiry(req.params.id, io, result.timeLimitSeconds * 1000);
  ok(res, result);
});

const submitAnswer = asyncHandler(async (req, res) => {
  await requireParticipant(req.params.id, req.user.id);
  clearSessionTimer(req.params.id);
  let result;
  try {
    result = await withSessionLock(req.params.id, () => repo.submitAnswer(
      req.params.id, req.user.id, Number(req.body.questionId), req.body.selectedOptionIndex, req.body.timeTakenMs
    ));
  } catch (err) {
    throw mapError(err);
  }
  const io = req.app.get('io');
  // result.participantId is whoever's turn it actually was (a teammate or
  // the other team, not necessarily the logged-in host who tapped Next on
  // their behalf) — broadcast that, not the caller's own participant row.
  await broadcastTurnResult(io, req.params.id, result.participantId, result);
  // Team mode: the same question just got handed to the other team — arm
  // their answer window, same as picking a fresh tile would.
  if (result.roundComplete === false && !result.awaitingScan) {
    scheduleExpiry(req.params.id, io, result.timeLimitSeconds * 1000);
  }
  ok(res, { isCorrect: result.isCorrect, correctOptionIndex: result.correctOptionIndex });
});

// QR-gated questions have no options to submit an index against — once the
// host taps Next on the live game's "Who Is Answer?" step, this directly
// settles the tile in favor of whichever participant (team) they picked, or
// nobody if "No One Answer" was chosen. Host-only (see resolveQrAnswer).
const qrAnswer = asyncHandler(async (req, res) => {
  await requireParticipant(req.params.id, req.user.id);
  clearSessionTimer(req.params.id);
  let result;
  try {
    result = await withSessionLock(req.params.id, () => repo.resolveQrAnswer(
      req.params.id,
      req.user.id,
      Number(req.body.questionId),
      req.body.winnerParticipantId ? Number(req.body.winnerParticipantId) : null
    ));
  } catch (err) {
    throw mapError(err);
  }
  const io = req.app.get('io');
  await broadcastTurnResult(io, req.params.id, result.participantId, result);
  ok(res, { winnerParticipantId: result.winnerParticipantId, points: result.points });
});

// ---------------------------------------------------------------------------
// Lifelines
// ---------------------------------------------------------------------------

const fiftyFifty = asyncHandler(async (req, res) => {
  await requireParticipant(req.params.id, req.user.id);
  let result;
  try {
    result = await repo.useFiftyFifty(req.params.id, req.user.id, Number(req.body.questionId));
  } catch (err) {
    throw mapError(err);
  }
  ok(res, result);
});

const skip = asyncHandler(async (req, res) => {
  await requireParticipant(req.params.id, req.user.id);
  clearSessionTimer(req.params.id);
  let result;
  try {
    result = await withSessionLock(req.params.id, () => repo.useSkip(req.params.id, req.user.id, Number(req.body.questionId)));
  } catch (err) {
    throw mapError(err);
  }
  const io = req.app.get('io');
  await broadcastTurnResult(io, req.params.id, result.participantId, result);
  if (result.roundComplete === false && !result.awaitingScan) {
    scheduleExpiry(req.params.id, io, result.timeLimitSeconds * 1000);
  }
  ok(res, { skipped: true });
});

const phoneAFriend = asyncHandler(async (req, res) => {
  await requireParticipant(req.params.id, req.user.id);
  let result;
  try {
    result = await repo.requestPhoneAFriend(req.params.id, req.user.id, Number(req.body.questionId), Number(req.body.targetParticipantId));
  } catch (err) {
    throw mapError(err);
  }
  const io = req.app.get('io');
  io.to(`user:${result.targetUserId}`).emit('game:lifeline_request', {
    requestId: result.requestId,
    sessionId: Number(req.params.id),
    question: result.question,
  });
  ok(res, { requestId: result.requestId }, 'Friend notified');
});

const respondPhoneAFriend = asyncHandler(async (req, res) => {
  let result;
  try {
    result = await repo.respondPhoneAFriend(req.params.requestId, req.user.id, req.body.suggestedOptionIndex);
  } catch (err) {
    throw mapError(err);
  }
  const io = req.app.get('io');
  io.to(`user:${result.requesterUserId}`).emit('game:lifeline_response', {
    requestId: Number(req.params.requestId),
    sessionId: result.sessionId,
    suggestedOptionIndex: result.suggestedOptionIndex,
  });
  ok(res, { sent: true });
});

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

const searchInvitees = asyncHandler(async (req, res) => {
  ok(res, await repo.searchInviteCandidates(req.params.id, req.user.id, req.query.q));
});

const invite = asyncHandler(async (req, res) => {
  const invited = await repo.createInvite(req.params.id, req.user.id, Number(req.body.userId));
  const detail = await repo.findSessionDetail(req.params.id);
  const io = req.app.get('io');
  io.to(`user:${req.body.userId}`).emit('game:invite', {
    inviteId: invited.id,
    sessionId: Number(req.params.id),
    fromUserId: req.user.id,
    session: detail,
  });
  created(res, invited, 'Invitation sent');
});

const respondInvite = asyncHandler(async (req, res) => {
  let invite_;
  try {
    invite_ = await repo.respondInvite(req.params.inviteId, req.user.id, Boolean(req.body.accept));
  } catch (err) {
    throw mapError(err);
  }
  if (req.body.accept) {
    const detail = await repo.findSessionDetail(invite_.session_id);
    const io = req.app.get('io');
    io.to(`game:${invite_.session_id}`).emit('game:state', detail);
    return ok(res, detail, 'Joined');
  }
  ok(res, invite_, 'Declined');
});

// ---------------------------------------------------------------------------
// Host controls
// ---------------------------------------------------------------------------

const adjustScore = asyncHandler(async (req, res) => {
  let participant;
  try {
    participant = await repo.adjustScore(req.params.id, req.user.id, Number(req.body.participantId), Number(req.body.delta), req.body.reason);
  } catch (err) {
    throw mapError(err);
  }
  const io = req.app.get('io');
  io.to(`game:${req.params.id}`).emit('game:score_adjusted', { sessionId: Number(req.params.id), participant });
  ok(res, participant);
});

module.exports = {
  listPlayableQuizzes,
  createSession,
  joinByCode,
  getSession,
  startSession,
  leaveSession,
  listPublicSessions,
  matchRandom,
  pickTile,
  scanQuestion,
  revealQuestion,
  submitAnswer,
  qrAnswer,
  fiftyFifty,
  skip,
  phoneAFriend,
  respondPhoneAFriend,
  searchInvitees,
  invite,
  respondInvite,
  adjustScore,
};
