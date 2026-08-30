const { pool } = require('../../config/db');

async function listThreads({ page = 1, pageSize = 20 } = {}) {
  const limit = Math.min(Number(pageSize) || 20, 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
  const [rows] = await pool.query(
    `SELECT t.id, t.is_group, t.created_at,
            GROUP_CONCAT(u.full_name SEPARATOR ', ') AS participant_names,
            (SELECT message FROM chat_messages m WHERE m.thread_id = t.id ORDER BY m.sent_at DESC LIMIT 1) AS last_message,
            (SELECT sent_at FROM chat_messages m WHERE m.thread_id = t.id ORDER BY m.sent_at DESC LIMIT 1) AS last_message_at
     FROM chat_threads t
     LEFT JOIN chat_participants cp ON cp.thread_id = t.id
     LEFT JOIN users u ON u.id = cp.user_id
     GROUP BY t.id
     ORDER BY last_message_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  const [countRows] = await pool.query('SELECT COUNT(*) as total FROM chat_threads');
  return { rows, total: countRows[0].total, page: Number(page) || 1, pageSize: limit };
}

async function findThreadById(id) {
  const [rows] = await pool.query('SELECT * FROM chat_threads WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function listMessages(threadId) {
  const [rows] = await pool.query(
    `SELECT m.*, u.full_name AS sender_name
     FROM chat_messages m LEFT JOIN users u ON u.id = m.sender_id
     WHERE m.thread_id = ? ORDER BY m.sent_at ASC`,
    [threadId]
  );
  return rows;
}

module.exports = { listThreads, findThreadById, listMessages };
