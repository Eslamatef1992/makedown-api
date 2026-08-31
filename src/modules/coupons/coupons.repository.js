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

module.exports = { ...base, findByCode, incrementUsage };
