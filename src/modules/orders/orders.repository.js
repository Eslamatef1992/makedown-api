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

// Order-confirmation-page-friendly lookup — order_number is unguessable
// enough (timestamp + random suffix, see generateOrderNumber) to double as
// a lightweight access token for the post-checkout/post-payment-redirect
// confirmation page, without requiring the guest to be logged in.
async function findByOrderNumber(orderNumber) {
  const [rows] = await pool.query(
    `SELECT o.*, u.full_name AS user_name, u.email AS user_email
     FROM orders o LEFT JOIN users u ON u.id = o.user_id
     WHERE o.order_number = ? LIMIT 1`,
    [orderNumber]
  );
  return rows[0] || null;
}

// Joined to the product/variant so the order-confirmation UI can show the
// same image + color/width/height the customer picked, not just the frozen
// name/price snapshot.
async function listItems(orderId) {
  const [rows] = await pool.query(
    `SELECT oi.*, p.thumbnail_url, pv.attributes_json
     FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     LEFT JOIN product_variants pv ON pv.id = oi.variant_id
     WHERE oi.order_id = ?`,
    [orderId]
  );
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

module.exports = { list, findById, findByOrderNumber, listItems, updateStatus, create, createItems, generateOrderNumber };
