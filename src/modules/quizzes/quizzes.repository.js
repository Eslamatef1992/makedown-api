const { pool } = require('../../config/db');
const { makeCrudRepository } = require('../../utils/crudFactory');

const base = makeCrudRepository({ table: 'quizzes', searchableColumns: ['title', 'description'] });

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
  const [rows] = await pool.query('SELECT name FROM game_categories WHERE id = ?', [quiz.category_id]);
  return { ...quiz, category_name: rows[0]?.name || null };
}

module.exports = { ...base, listQuestions, findQuestionById, createQuestion, updateQuestion, deleteQuestion, withCategory };
