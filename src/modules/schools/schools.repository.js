const { pool } = require('../../config/db');
const { makeCrudRepository } = require('../../utils/crudFactory');

const base = makeCrudRepository({ table: 'schools', searchableColumns: ['name_en', 'name_ar', 'contact_email'], defaultOrderBy: 'name_en ASC' });

// A school now logs in with its contact email + password (see
// admin-auth.service.js) instead of a manually-entered code — is_active is
// still required, same as the old code lookup enforced.
async function findByEmail(email) {
  const [rows] = await pool.query('SELECT * FROM schools WHERE contact_email = ? AND is_active = 1 LIMIT 1', [email]);
  return rows[0] || null;
}

// Used to reject duplicate contact emails on create/update (no is_active
// filter — an email shouldn't be reusable even by a currently-inactive
// school, and excludeId lets an update ignore the row's own email).
async function findAnyByEmail(email, excludeId) {
  const params = [email];
  let sql = 'SELECT id FROM schools WHERE contact_email = ?';
  if (excludeId) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }
  const [rows] = await pool.query(`${sql} LIMIT 1`, params);
  return rows[0] || null;
}

async function listActive() {
  const [rows] = await pool.query('SELECT id, name_en, name_ar, logo_url FROM schools WHERE is_active = 1 ORDER BY name_en ASC');
  return rows;
}

module.exports = { ...base, findByEmail, findAnyByEmail, listActive };
