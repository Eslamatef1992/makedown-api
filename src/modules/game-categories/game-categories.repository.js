const { pool } = require('../../config/db');
const { makeCrudRepository } = require('../../utils/crudFactory');

const base = makeCrudRepository({
  table: 'game_categories',
  searchableColumns: ['name_en', 'name_ar', 'slug'],
  defaultOrderBy: 'sort_order ASC, name_en ASC',
});

/**
 * Same list contract as the generic list() (page/pageSize/search ->
 * {rows, total, page, pageSize}), but each row also carries quiz_count:
 * how many games in the global catalog (school_id IS NULL — a school's
 * own private quizzes don't count toward whether the public category
 * has games) are tagged to it. Lets the admin table show a "Has Games"
 * column without a separate request per row.
 */
async function listWithGameCounts({ page = 1, pageSize = 20, search = '' } = {}) {
  const where = [];
  const params = [];
  if (search) {
    where.push('(gc.name_en LIKE ? OR gc.name_ar LIKE ? OR gc.slug LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Number(pageSize) || 20, 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

  const [rows] = await pool.query(
    `SELECT gc.*, COUNT(q.id) AS quiz_count
     FROM game_categories gc
     LEFT JOIN quizzes q ON q.category_id = gc.id AND q.school_id IS NULL
     ${whereSql}
     GROUP BY gc.id
     ORDER BY gc.sort_order ASC, gc.name_en ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM game_categories gc ${whereSql}`, params);

  return { rows, total: countRows[0].total, page: Number(page) || 1, pageSize: limit };
}

module.exports = { ...base, listWithGameCounts };
