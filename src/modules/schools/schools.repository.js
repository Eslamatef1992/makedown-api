const { pool } = require('../../config/db');
const { makeCrudRepository } = require('../../utils/crudFactory');

const base = makeCrudRepository({ table: 'schools', searchableColumns: ['name', 'code'], defaultOrderBy: 'name ASC' });

async function findByCode(code) {
  const [rows] = await pool.query('SELECT * FROM schools WHERE code = ? AND is_active = 1 LIMIT 1', [code]);
  return rows[0] || null;
}

module.exports = { ...base, findByCode };
