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
async function createSchoolGame({ mode, quizIds = [], title, schoolId, maxPlayers, isPublic = false }) {
  const joinCode = await uniqueJoinCode();
  const [result] = await pool.query(
    `INSERT INTO game_sessions (quiz_id, title, host_user_id, school_id, mode, is_public, max_players, join_code, status)
     VALUES (NULL, ?, NULL, ?, ?, ?, ?, ?, 'waiting')`,
    [title || null, schoolId || null, mode, isPublic ? 1 : 0, maxPlayers || null, joinCode]
  );
  const sessionId = result.insertId;

  if (quizIds.length) {
    const values = quizIds.map((quizId, idx) => [sessionId, quizId, idx]);
    await pool.query('INSERT INTO game_session_categories (session_id, quiz_id, sort_order) VALUES ?', [values]);
  }

  if (mode === 'team') {
    await pool.query('INSERT INTO game_teams (session_id, name) VALUES (?, ?), (?, ?)', [
      sessionId, 'Team A', sessionId, 'Team B',
    ]);
  }

  return findById(sessionId);
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

module.exports = { list, findById, listParticipants, createSchoolGame, getBoard: playRepo.getBoard };
