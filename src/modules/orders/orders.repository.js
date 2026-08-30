const { pool } = require('../../config/db');

async function list({ page = 1, pageSize = 20, filters = {} } = {}) {
  const where = [];
  const params = [];
  if (filters.status) { where.push('o.status = ?'); params.push(filters.status); }
  if (filters.payment_status) { where.push('o.payment_status = ?'); params.push(filters.payment_status); }
  if (filters.guest === '1') where.push('o.user_id IS NULL');
  if (filters.guest === '0') where.push('o.user_id IS NOT NULL');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Number(pageSize) || 20, 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

  const [rows] = await pool.query(
    `SELECT o.*, u.full_name AS user_name, u.email AS user_email
     FROM orders o
     LEFT JOIN users u ON u.id = o.user_id
     ${whereSql}
     ORDER BY o.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM orders o ${whereSql}`, params);
  return { rows, total: countRows[0].total, page: Number(page) || 1, pageSize: limit };
}

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT o.*, u.full_name AS user_name, u.email AS user_email
     FROM orders o LEFT JOIN users u ON u.id = o.user_id
     WHERE o.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function listItems(orderId) {
  const [rows] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
  return rows;
}

async function updateStatus(id, data) {
  await pool.query('UPDATE orders SET ? WHERE id = ?', [data, id]);
  return findById(id);
}

function generateOrderNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MD${stamp}${rand}`;
}

async function create(data) {
  const [result] = await pool.query('INSERT INTO orders SET ?', [data]);
  return findById(result.insertId);
}

async function createItems(orderId, items) {
  if (!items.length) return [];
  const rows = items.map((it) => [
    orderId,
    it.product_id,
    it.variant_id || null,
    it.product_name_snapshot,
    it.quantity,
    it.unit_price,
    it.line_total,
  ]);
  await pool.query(
    'INSERT INTO order_items (order_id, product_id, variant_id, product_name_snapshot, quantity, unit_price, line_total) VALUES ?',
    [rows]
  );
  return listItems(orderId);
}

module.exports = { list, findById, listItems, updateStatus, create, createItems, generateOrderNumber };
