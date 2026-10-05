const { pool } = require('../../config/db');
const { makeCrudRepository } = require('../../utils/crudFactory');

const base = makeCrudRepository({
  table: 'coupons',
  searchableColumns: ['code'],
  defaultOrderBy: 'created_at DESC',
});

async function findByCode(code) {
  const [rows] = await pool.query('SELECT * FROM coupons WHERE code = ? LIMIT 1', [String(code).trim().toUpperCase()]);
  return rows[0] || null;
}

async function incrementUsage(id) {
  await pool.query('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [id]);
}

// Releases a use that was reserved at order-creation time (orders.controller.js
// #checkout increments usage before payment is confirmed) when that order
// turns out to be cancelled/expired without ever actually being paid for -
// otherwise an abandoned or superseded pending order permanently burns a
// slot on a limited-use code. GREATEST(...,0) guards against ever going
// negative if this were somehow called twice for the same order.
async function decrementUsage(id) {
  await pool.query('UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE id = ?', [id]);
}

module.exports = { ...base, findByCode, incrementUsage, decrementUsage };
