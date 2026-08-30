const repo = require('./quizzes.repository');
const { makeCrudController } = require('../../utils/crudController');
const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');
const { mapBilingualField, requireBilingual } = require('../../utils/bilingual');

function transformQuiz(body, { req, isUpdate } = {}) {
  const data = {};
  if (body.categoryId !== undefined) data.category_id = body.categoryId || null;
  mapBilingualField(body, data, 'title', 'title');
  mapBilingualField(body, data, 'description', 'description');
  if (body.coverImageUrl !== undefined) data.cover_image_url = body.coverImageUrl;
  if (body.difficulty !== undefined) data.difficulty = body.difficulty;
  if (body.isActive !== undefined) data.is_active = body.isActive ? 1 : 0;
  if (req.admin) data.created_by_admin_id = data.created_by_admin_id || req.admin.id;
  requireBilingual(data, ['title'], isUpdate);
  return data;
}

const crud = makeCrudController(repo, { transformInput: transformQuiz, notFoundMessage: 'Quiz not found' });

const getOneWithQuestions = asyncHandler(async (req, res) => {
  const quiz = await repo.findById(req.params.id);
  if (!quiz) throw ApiError.notFound('Quiz not found');
  const questions = await repo.listQuestions(req.params.id);
  ok(res, { ...quiz, questions });
});

function requireParallelOptions(optionsEn, optionsAr) {
  if (!Array.isArray(optionsEn) || !Array.isArray(optionsAr)) {
    throw ApiError.badRequest('Both English and Arabic options are required');
  }
  if (optionsEn.length < 2 || optionsAr.length < 2) {
    throw ApiError.badRequest('At least two options are required in both languages');
  }
  if (optionsEn.length !== optionsAr.length) {
    throw ApiError.badRequest('English and Arabic options must have the same number of entries');
  }
  if (optionsEn.some((o) => !String(o || '').trim()) || optionsAr.some((o) => !String(o || '').trim())) {
    throw ApiError.badRequest('Options cannot be empty in either language');
  }
}

const addQuestion = asyncHandler(async (req, res) => {
  const quiz = await repo.findById(req.params.id);
  if (!quiz) throw ApiError.notFound('Quiz not found');
  const b = req.body;
  if (!b.questionTextEn || !b.questionTextAr) {
    throw ApiError.badRequest('Both English and Arabic question text are required');
  }
  requireParallelOptions(b.optionsEn, b.optionsAr);
  const question = await repo.createQuestion(req.params.id, {
    question_text_en: b.questionTextEn,
    question_text_ar: b.questionTextAr,
    question_image_url: b.questionImageUrl || null,
    options_json_en: JSON.stringify(b.optionsEn),
    options_json_ar: JSON.stringify(b.optionsAr),
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
  if (b.questionTextEn !== undefined) data.question_text_en = b.questionTextEn;
  if (b.questionTextAr !== undefined) data.question_text_ar = b.questionTextAr;
  if (b.questionImageUrl !== undefined) data.question_image_url = b.questionImageUrl;
  if (b.optionsEn !== undefined || b.optionsAr !== undefined) {
    const optionsEn = b.optionsEn !== undefined ? b.optionsEn : JSON.parse(existing.options_json_en);
    const optionsAr = b.optionsAr !== undefined ? b.optionsAr : JSON.parse(existing.options_json_ar || '[]');
    requireParallelOptions(optionsEn, optionsAr);
    data.options_json_en = JSON.stringify(optionsEn);
    data.options_json_ar = JSON.stringify(optionsAr);
  }
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
