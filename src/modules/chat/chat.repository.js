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

// ---- customer-facing ----

async function listMyThreads(userId) {
  const [rows] = await pool.query(
    `SELECT t.id, t.is_group, t.created_at,
            other.id AS other_user_id, other.full_name AS other_user_name, other.avatar_url AS other_user_avatar,
            (SELECT message FROM chat_messages m WHERE m.thread_id = t.id ORDER BY m.sent_at DESC LIMIT 1) AS last_message,
            (SELECT sent_at FROM chat_messages m WHERE m.thread_id = t.id ORDER BY m.sent_at DESC LIMIT 1) AS last_message_at,
            (SELECT COUNT(*) FROM chat_messages m WHERE m.thread_id = t.id AND m.sender_id <> ? AND m.read_at IS NULL) AS unread_count
     FROM chat_threads t
     JOIN chat_participants me ON me.thread_id = t.id AND me.user_id = ?
     LEFT JOIN chat_participants op ON op.thread_id = t.id AND op.user_id <> ?
     LEFT JOIN users other ON other.id = op.user_id
     WHERE t.is_group = 0
     GROUP BY t.id
     ORDER BY last_message_at IS NULL, last_message_at DESC`,
    [userId, userId, userId]
  );
  return rows;
}

async function isParticipant(threadId, userId) {
  const [rows] = await pool.query(
    'SELECT 1 FROM chat_participants WHERE thread_id = ? AND user_id = ? LIMIT 1',
    [threadId, userId]
  );
  return rows.length > 0;
}

// Finds an existing 1:1 thread between the two users, or creates one.
async function findOrCreateOneToOneThread(userAId, userBId) {
  const [rows] = await pool.query(
    `SELECT t.id FROM chat_threads t
     JOIN chat_participants p1 ON p1.thread_id = t.id AND p1.user_id = ?
     JOIN chat_participants p2 ON p2.thread_id = t.id AND p2.user_id = ?
     WHERE t.is_group = 0
     LIMIT 1`,
    [userAId, userBId]
  );
  if (rows[0]) return rows[0].id;

  const [result] = await pool.query('INSERT INTO chat_threads (is_group) VALUES (0)');
  const threadId = result.insertId;
  await pool.query('INSERT INTO chat_participants (thread_id, user_id) VALUES (?, ?), (?, ?)', [
    threadId,
    userAId,
    threadId,
    userBId,
  ]);
  return threadId;
}

async function createMessage({ threadId, senderId, message }) {
  const [result] = await pool.query(
    'INSERT INTO chat_messages (thread_id, sender_id, message) VALUES (?, ?, ?)',
    [threadId, senderId, message]
  );
  const [rows] = await pool.query(
    `SELECT m.*, u.full_name AS sender_name
     FROM chat_messages m LEFT JOIN users u ON u.id = m.sender_id
     WHERE m.id = ? LIMIT 1`,
    [result.insertId]
  );
  return rows[0];
}

async function markThreadRead(threadId, userId) {
  await pool.query(
    'UPDATE chat_messages SET read_at = NOW() WHERE thread_id = ? AND sender_id <> ? AND read_at IS NULL',
    [threadId, userId]
  );
}

async function otherParticipantId(threadId, userId) {
  const [rows] = await pool.query(
    'SELECT user_id FROM chat_participants WHERE thread_id = ? AND user_id <> ? LIMIT 1',
    [threadId, userId]
  );
  return rows[0]?.user_id || null;
}

module.exports = {
  listThreads,
  findThreadById,
  listMessages,
  listMyThreads,
  isParticipant,
  findOrCreateOneToOneThread,
  createMessage,
  markThreadRead,
  otherParticipantId,
};
