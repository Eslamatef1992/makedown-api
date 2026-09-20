const { pool } = require('../../config/db');
const { makeCrudRepository } = require('../../utils/crudFactory');

const base = makeCrudRepository({ table: 'quizzes', searchableColumns: ['title_en', 'title_ar', 'description_en', 'description_ar'] });

// makeCrudRepository's generic list() can't express "school_id IS NULL"
// (it skips null/undefined filter values entirely), which is what the
// global Make Down Games catalog needs — this is the same query shape,
// just with an explicit IS NULL / = ? branch for school_id.
async function listScoped({ page = 1, pageSize = 20, search = '', schoolId } = {}) {
  const where = [];
  const params = [];
  if (schoolId === null) {
    where.push('school_id IS NULL');
  } else if (schoolId !== undefined) {
    where.push('school_id = ?');
    params.push(schoolId);
  }
  if (search) {
    where.push('(title_en LIKE ? OR title_ar LIKE ? OR description_en LIKE ? OR description_ar LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Number(pageSize) || 20, 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
  const [rows] = await pool.query(`SELECT * FROM quizzes ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM quizzes ${whereSql}`, params);
  return { rows, total: countRows[0].total, page: Number(page) || 1, pageSize: limit };
}

async function listQuestions(quizId) {
  const [rows] = await pool.query('SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order ASC, id ASC', [quizId]);
  return rows;
}

async function findQuestionById(id) {
  const [rows] = await pool.query('SELECT * FROM quiz_questions WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function createQuestion(quizId, data) {
  const [result] = await pool.query('INSERT INTO quiz_questions SET ?', [{ ...data, quiz_id: quizId }]);
  return findQuestionById(result.insertId);
}

async function updateQuestion(id, data) {
  await pool.query('UPDATE quiz_questions SET ? WHERE id = ?', [data, id]);
  return findQuestionById(id);
}

async function deleteQuestion(id) {
  await pool.query('DELETE FROM quiz_questions WHERE id = ?', [id]);
}

async function withCategory(quiz) {
  if (!quiz) return quiz;
  const [rows] = await pool.query('SELECT name_en, name_ar FROM game_categories WHERE id = ?', [quiz.category_id]);
  return { ...quiz, category_name_en: rows[0]?.name_en || null, category_name_ar: rows[0]?.name_ar || null };
}

module.exports = { ...base, listScoped, listQuestions, findQuestionById, createQuestion, updateQuestion, deleteQuestion, withCategory };
