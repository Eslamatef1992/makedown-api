const { pool } = require('../../config/db');
const { makeCrudRepository } = require('../../utils/crudFactory');

const base = makeCrudRepository({ table: 'roles', searchableColumns: ['name'], defaultOrderBy: 'name ASC' });

async function listPermissions() {
  const [rows] = await pool.query('SELECT * FROM permissions ORDER BY module, key_name');
  return rows;
}

async function getPermissionIdsForRole(roleId) {
  const [rows] = await pool.query('SELECT permission_id FROM role_permissions WHERE role_id = ?', [roleId]);
  return rows.map((r) => r.permission_id);
}

async function setPermissionsForRole(roleId, permissionIds) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);
    if (permissionIds.length) {
      const values = permissionIds.map((pid) => [roleId, pid]);
      await conn.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ?', [values]);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { ...base, listPermissions, getPermissionIdsForRole, setPermissionsForRole };
