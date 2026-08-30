const { pool } = require('../../config/db');

async function findByEmail(email) {
  const [rows] = await pool.query('SELECT * FROM admins WHERE email = ? LIMIT 1', [email]);
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM admins WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function updateLastLogin(id) {
  await pool.query('UPDATE admins SET last_login_at = NOW() WHERE id = ?', [id]);
}

async function getPermissionKeys(roleId) {
  if (!roleId) return [];
  const [rows] = await pool.query(
    `SELECT p.key_name FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.role_id = ?`,
    [roleId]
  );
  return rows.map((r) => r.key_name);
}

module.exports = { findByEmail, findById, updateLastLogin, getPermissionKeys };
