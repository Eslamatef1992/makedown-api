const { pool } = require('../../config/db');
const { makeCrudRepository } = require('../../utils/crudFactory');

const base = makeCrudRepository({
  table: 'variant_types',
  searchableColumns: ['name_en', 'name_ar', 'slug'],
  defaultOrderBy: 'name_en ASC',
});

async function listValues(variantTypeId) {
  const [rows] = await pool.query(
    'SELECT * FROM variant_type_values WHERE variant_type_id = ? ORDER BY sort_order ASC, id ASC',
    [variantTypeId]
  );
  return rows;
}

async function listAllWithValues() {
  const { rows } = await base.list({ pageSize: 1000 });
  const withValues = await Promise.all(
    rows.map(async (t) => ({ ...t, values: await listValues(t.id) }))
  );
  return withValues;
}

async function findValueById(id) {
  const [rows] = await pool.query('SELECT * FROM variant_type_values WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function createValue(variantTypeId, data) {
  const [result] = await pool.query('INSERT INTO variant_type_values SET ?', [
    { ...data, variant_type_id: variantTypeId },
  ]);
  return findValueById(result.insertId);
}

async function updateValue(id, data) {
  await pool.query('UPDATE variant_type_values SET ? WHERE id = ?', [data, id]);
  return findValueById(id);
}

async function deleteValue(id) {
  await pool.query('DELETE FROM variant_type_values WHERE id = ?', [id]);
}

async function findValuesByIds(ids) {
  if (!ids || !ids.length) return [];
  const [rows] = await pool.query('SELECT * FROM variant_type_values WHERE id IN (?)', [ids]);
  return rows;
}

module.exports = {
  ...base,
  listValues,
  listAllWithValues,
  findValueById,
  createValue,
  updateValue,
  deleteValue,
  findValuesByIds,
};
