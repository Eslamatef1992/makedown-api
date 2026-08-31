const { pool } = require('../../config/db');
const playRepo = require('../play/play.repository');

const JOIN_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

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

// School/staff "create game" flow: a school specializes a set of categories
// (quizzes) into a board and gets a join code + QR to hand out to students —
// there is no admin "participant" row since admins aren't website users;
// students join the resulting session from the website Play flow with their
// own accounts, same as any player-created game.
async function createSchoolGame({
  mode, quizIds = [], title, schoolId, maxPlayers, isPublic = false,
  audience, scheduledDate, scheduledTime,
  team1Name, team1Capacity, team2Name, team2Capacity,
}) {
  const joinCode = await uniqueJoinCode();
  const [result] = await pool.query(
    `INSERT INTO game_sessions
       (quiz_id, title, host_user_id, school_id, mode, audience, is_public, max_players, scheduled_date, scheduled_time, join_code, status)
     VALUES (NULL, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting')`,
    [
      title || null, schoolId || null, mode, audience || null, isPublic ? 1 : 0, maxPlayers || null,
      scheduledDate || null, scheduledTime || null, joinCode,
    ]
  );
  const sessionId = result.insertId;

  if (quizIds.length) {
    const values = quizIds.map((quizId, idx) => [sessionId, quizId, idx]);
    await pool.query('INSERT INTO game_session_categories (session_id, quiz_id, sort_order) VALUES ?', [values]);
  }

  if (mode === 'team') {
    await pool.query('INSERT INTO game_teams (session_id, name, capacity) VALUES (?, ?, ?), (?, ?, ?)', [
      sessionId, team1Name || 'Team A', team1Capacity || null,
      sessionId, team2Name || 'Team B', team2Capacity || null,
    ]);
  }

  return findById(sessionId);
}

// Public — the website's "<School> Games" page. No join code in the
// payload on purpose (see schools.controller.js#publicGames).
async function listPublicForSchool(schoolId) {
  const [rows] = await pool.query(
    `SELECT id, title, mode, audience, status, scheduled_date, scheduled_time
     FROM game_sessions
     WHERE school_id = ? AND status IN ('waiting', 'active')
     ORDER BY scheduled_date ASC, scheduled_time ASC, created_at DESC`,
    [schoolId]
  );
  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);
  const [teamRows] = await pool.query(
    'SELECT session_id, name, capacity FROM game_teams WHERE session_id IN (?) ORDER BY id ASC',
    [ids]
  );
  const [catRows] = await pool.query(
    `SELECT gsc.session_id, q.title_en, q.title_ar
     FROM game_session_categories gsc JOIN quizzes q ON q.id = gsc.quiz_id
     WHERE gsc.session_id IN (?) ORDER BY gsc.sort_order ASC`,
    [ids]
  );

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    mode: r.mode,
    audience: r.audience,
    status: r.status,
    scheduledDate: r.scheduled_date,
    scheduledTime: r.scheduled_time,
    teams: teamRows.filter((t) => t.session_id === r.id).map((t) => ({ name: t.name, capacity: t.capacity })),
    categories: catRows.filter((c) => c.session_id === r.id).map((c) => ({ titleEn: c.title_en, titleAr: c.title_ar })),
  }));
}


async function list({ page = 1, pageSize = 20, filters = {} } = {}) {
  const where = [];
  const params = [];
  if (filters.mode) { where.push('gs.mode = ?'); params.push(filters.mode); }
  if (filters.status) { where.push('gs.status = ?'); params.push(filters.status); }
  if (filters.school_id) { where.push('gs.school_id = ?'); params.push(filters.school_id); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Number(pageSize) || 20, 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

  const [rows] = await pool.query(
    `SELECT gs.*, q.title_en AS quiz_title, s.name_en AS school_name,
            (SELECT COUNT(*) FROM game_participants gp WHERE gp.session_id = gs.id) AS participant_count
     FROM game_sessions gs
     LEFT JOIN quizzes q ON q.id = gs.quiz_id
     LEFT JOIN schools s ON s.id = gs.school_id
     ${whereSql}
     ORDER BY gs.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM game_sessions gs ${whereSql}`, params);
  return { rows, total: countRows[0].total, page: Number(page) || 1, pageSize: limit };
}

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT gs.*, q.title_en AS quiz_title, s.name_en AS school_name
     FROM game_sessions gs
     LEFT JOIN quizzes q ON q.id = gs.quiz_id
     LEFT JOIN schools s ON s.id = gs.school_id
     WHERE gs.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function listParticipants(sessionId) {
  const [rows] = await pool.query(
    `SELECT gp.*, u.full_name, u.email, gt.name AS team_name
     FROM game_participants gp
     LEFT JOIN users u ON u.id = gp.user_id
     LEFT JOIN game_teams gt ON gt.id = gp.team_id
     WHERE gp.session_id = ?
     ORDER BY gp.score DESC`,
    [sessionId]
  );
  return rows;
}

module.exports = { list, findById, listParticipants, createSchoolGame, listPublicForSchool, getBoard: playRepo.getBoard };
