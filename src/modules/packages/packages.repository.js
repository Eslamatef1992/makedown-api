const { pool } = require('../../config/db');
const { makeCrudRepository } = require('../../utils/crudFactory');

const base = makeCrudRepository({ table: 'packages', searchableColumns: ['name_en', 'name_ar'], defaultOrderBy: 'sort_order ASC, id ASC' });

async function listActive() {
  const [rows] = await pool.query('SELECT * FROM packages WHERE is_active = 1 ORDER BY sort_order ASC, id ASC');
  return rows;
}

module.exports = { ...base, listActive };
