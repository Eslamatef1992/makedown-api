const repo = require('./quizzes.repository');
const { makeCrudController } = require('../../utils/crudController');
const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');

function transformQuiz(body, { req }) {
  const data = {};
  if (body.categoryId !== undefined) data.category_id = body.categoryId || null;
  if (body.title !== undefined) data.title = body.title;
  if (body.description !== undefined) data.description = body.description;
  if (body.coverImageUrl !== undefined) data.cover_image_url = body.coverImageUrl;
  if (body.difficulty !== undefined) data.difficulty = body.difficulty;
  if (body.isActive !== undefined) data.is_active = body.isActive ? 1 : 0;
  if (req.admin) data.created_by_admin_id = data.created_by_admin_id || req.admin.id;
  return data;
}

const crud = makeCrudController(repo, { transformInput: transformQuiz, notFoundMessage: 'Quiz not found' });

const getOneWithQuestions = asyncHandler(async (req, res) => {
  const quiz = await repo.findById(req.params.id);
  if (!quiz) throw ApiError.notFound('Quiz not found');
  const questions = await repo.listQuestions(req.params.id);
  ok(res, { ...quiz, questions });
});

const addQuestion = asyncHandler(async (req, res) => {
  const quiz = await repo.findById(req.params.id);
  if (!quiz) throw ApiError.notFound('Quiz not found');
  const b = req.body;
  const question = await repo.createQuestion(req.params.id, {
    question_text: b.questionText,
    question_image_url: b.questionImageUrl || null,
    options_json: JSON.stringify(b.options),
    correct_option_index: b.correctOptionIndex,
    points: b.points ?? 100,
    time_limit_seconds: b.timeLimitSeconds ?? 20,
    sort_order: b.sortOrder ?? 0,
  });
  created(res, question);
});

const updateQuestion = asyncHandler(async (req, res) => {
  const existing = await repo.findQuestionById(req.params.questionId);
  if (!existing) throw ApiError.notFound('Question not found');
  const b = req.body;
  const data = {};
  if (b.questionText !== undefined) data.question_text = b.questionText;
  if (b.questionImageUrl !== undefined) data.question_image_url = b.questionImageUrl;
  if (b.options !== undefined) data.options_json = JSON.stringify(b.options);
  if (b.correctOptionIndex !== undefined) data.correct_option_index = b.correctOptionIndex;
  if (b.points !== undefined) data.points = b.points;
  if (b.timeLimitSeconds !== undefined) data.time_limit_seconds = b.timeLimitSeconds;
  if (b.sortOrder !== undefined) data.sort_order = b.sortOrder;
  const question = await repo.updateQuestion(req.params.questionId, data);
  ok(res, question, 'Updated');
});

const deleteQuestion = asyncHandler(async (req, res) => {
  const existing = await repo.findQuestionById(req.params.questionId);
  if (!existing) throw ApiError.notFound('Question not found');
  await repo.deleteQuestion(req.params.questionId);
  ok(res, null, 'Deleted');
});

module.exports = { ...crud, getOneWithQuestions, addQuestion, updateQuestion, deleteQuestion };
