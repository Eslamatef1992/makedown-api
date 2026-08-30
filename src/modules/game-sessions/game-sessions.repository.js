const { pool } = require('../../config/db');

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
    `SELECT gs.*, q.title AS quiz_title, s.name AS school_name,
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
    `SELECT gs.*, q.title AS quiz_title, s.name AS school_name
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

module.exports = { list, findById, listParticipants };
