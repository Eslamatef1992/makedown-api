const { pool } = require('../../config/db');

// ---- profile ----

async function updateProfile(userId, data) {
  if (Object.keys(data).length) {
    await pool.query('UPDATE users SET ? WHERE id = ?', [data, userId]);
  }
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
  return rows[0] || null;
}

// ---- addresses ----

async function listAddresses(userId) {
  const [rows] = await pool.query(
    'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
    [userId]
  );
  return rows;
}

async function findAddressById(id) {
  const [rows] = await pool.query('SELECT * FROM addresses WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function createAddress(userId, data) {
  const [result] = await pool.query('INSERT INTO addresses SET ?', [{ ...data, user_id: userId }]);
  return findAddressById(result.insertId);
}

async function updateAddress(id, data) {
  if (Object.keys(data).length) {
    await pool.query('UPDATE addresses SET ? WHERE id = ?', [data, id]);
  }
  return findAddressById(id);
}

async function deleteAddress(id) {
  await pool.query('DELETE FROM addresses WHERE id = ?', [id]);
}

async function clearDefaultAddress(userId) {
  await pool.query('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
}

// ---- my orders (product purchases) ----

async function listMyOrders(userId, { page = 1, pageSize = 20 } = {}) {
  const limit = Math.min(Number(pageSize) || 20, 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
  const [rows] = await pool.query(
    `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );
  const [countRows] = await pool.query('SELECT COUNT(*) as total FROM orders WHERE user_id = ?', [userId]);
  return { rows, total: countRows[0].total, page: Number(page) || 1, pageSize: limit };
}

async function findMyOrder(userId, orderId) {
  const [rows] = await pool.query('SELECT * FROM orders WHERE id = ? AND user_id = ? LIMIT 1', [orderId, userId]);
  return rows[0] || null;
}

async function listOrderItems(orderId) {
  const [rows] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
  return rows;
}

// ---- game history ----

async function listGameHistory(userId, { page = 1, pageSize = 20 } = {}) {
  const limit = Math.min(Number(pageSize) || 20, 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
  const [rows] = await pool.query(
    `SELECT gp.id AS participant_id, gp.score, gp.joined_at,
            gs.id AS session_id, gs.mode, gs.status, gs.started_at, gs.ended_at,
            q.title_en AS quiz_title_en, q.title_ar AS quiz_title_ar, q.cover_image_url
     FROM game_participants gp
     JOIN game_sessions gs ON gs.id = gp.session_id
     JOIN quizzes q ON q.id = gs.quiz_id
     WHERE gp.user_id = ?
     ORDER BY gp.joined_at DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );
  const [countRows] = await pool.query('SELECT COUNT(*) as total FROM game_participants WHERE user_id = ?', [userId]);
  return { rows, total: countRows[0].total, page: Number(page) || 1, pageSize: limit };
}

module.exports = {
  updateProfile,
  listAddresses,
  findAddressById,
  createAddress,
  updateAddress,
  deleteAddress,
  clearDefaultAddress,
  listMyOrders,
  findMyOrder,
  listOrderItems,
  listGameHistory,
};
