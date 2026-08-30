const { pool } = require('../config/db');

/**
 * Minimal repository factory for simple lookup/reference tables.
 * Not meant for tables with complex joins/nested writes — those get a
 * bespoke repository (see modules/quizzes, modules/products, etc.).
 */
function makeCrudRepository({ table, primaryKey = 'id', searchableColumns = [], defaultOrderBy = null }) {
  const orderBy = defaultOrderBy || `${primaryKey} DESC`;

  async function list({ page = 1, pageSize = 20, search = '', filters = {} } = {}) {
    const where = [];
    const params = [];

    if (search && searchableColumns.length) {
      where.push('(' + searchableColumns.map((c) => `${c} LIKE ?`).join(' OR ') + ')');
      searchableColumns.forEach(() => params.push(`%${search}%`));
    }
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        where.push(`${key} = ?`);
        params.push(value);
      }
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limit = Math.min(Number(pageSize) || 20, 100);
    const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

    const [rows] = await pool.query(
      `SELECT * FROM ${table} ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM ${table} ${whereSql}`, params);

    return { rows, total: countRows[0].total, page: Number(page) || 1, pageSize: limit };
  }

  async function findAll() {
    const [rows] = await pool.query(`SELECT * FROM ${table} ORDER BY ${orderBy}`);
    return rows;
  }

  async function findById(id) {
    const [rows] = await pool.query(`SELECT * FROM ${table} WHERE ${primaryKey} = ? LIMIT 1`, [id]);
    return rows[0] || null;
  }

  async function findBy(column, value) {
    const [rows] = await pool.query(`SELECT * FROM ${table} WHERE ${column} = ? LIMIT 1`, [value]);
    return rows[0] || null;
  }

  async function create(data) {
    const [result] = await pool.query(`INSERT INTO ${table} SET ?`, [data]);
    return findById(result.insertId);
  }

  async function update(id, data) {
    if (Object.keys(data).length) {
      await pool.query(`UPDATE ${table} SET ? WHERE ${primaryKey} = ?`, [data, id]);
    }
    return findById(id);
  }

  async function remove(id) {
    await pool.query(`DELETE FROM ${table} WHERE ${primaryKey} = ?`, [id]);
    return true;
  }

  return { list, findAll, findById, findBy, create, update, remove };
}

module.exports = { makeCrudRepository };
