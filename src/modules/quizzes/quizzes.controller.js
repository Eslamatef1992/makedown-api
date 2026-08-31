const repo = require('./quizzes.repository');
const { pool } = require('../../config/db');
const { makeCrudController } = require('../../utils/crudController');
const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');
const { mapBilingualField, requireBilingual } = require('../../utils/bilingual');
const { parseJsonColumn } = require('../../utils/jsonColumn');

// A category board only has room for so many game tiles — keep it in sync
// with whatever the category-select screen is designed to lay out.
const MAX_GAMES_PER_CATEGORY = 6;

const QUESTION_POINT_VALUES = [200, 400, 600];
const QUESTION_MODES = ['solo', 'team', 'both'];

async function assertCategoryHasRoom(categoryId, { excludeQuizId } = {}) {
  if (!categoryId) return;
  const [rows] = excludeQuizId
    ? await pool.query('SELECT COUNT(*) AS count FROM quizzes WHERE category_id = ? AND id != ?', [categoryId, excludeQuizId])
    : await pool.query('SELECT COUNT(*) AS count FROM quizzes WHERE category_id = ?', [categoryId]);
  if (rows[0].count >= MAX_GAMES_PER_CATEGORY) {
    throw ApiError.badRequest(`This category already has the maximum of ${MAX_GAMES_PER_CATEGORY} games.`);
  }
}

async function transformQuiz(body, { req, existing, isUpdate } = {}) {
  const data = {};
  if (body.categoryId !== undefined) data.category_id = body.categoryId || null;
  mapBilingualField(body, data, 'title', 'title');
  mapBilingualField(body, data, 'description', 'description');
  if (body.coverImageUrl !== undefined) data.cover_image_url = body.coverImageUrl;
  if (body.difficulty !== undefined) data.difficulty = body.difficulty;
  if (body.supportedModes !== undefined && ['solo', 'team', 'both'].includes(body.supportedModes)) {
    data.supported_modes = body.supportedModes;
  }
  if (body.isActive !== undefined) data.is_active = body.isActive ? 1 : 0;
  if (req.admin) data.created_by_admin_id = data.created_by_admin_id || req.admin.id;
  requireBilingual(data, ['title'], isUpdate);

  // Only re-check the cap when the quiz is landing in this category for the
  // first time (create), or is being MOVED into a different category on
  // update — leaving it in place should never trip the limit.
  if (data.category_id && (!isUpdate || data.category_id !== existing?.category_id)) {
    await assertCategoryHasRoom(data.category_id, isUpdate ? { excludeQuizId: existing.id } : {});
  }
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
  const questionType = ['text', 'image', 'qr', 'audio'].includes(b.questionType) ? b.questionType : 'text';
  const mode = QUESTION_MODES.includes(b.mode) ? b.mode : 'both';
  const points = QUESTION_POINT_VALUES.includes(Number(b.points)) ? Number(b.points) : 200;
  const question = await repo.createQuestion(req.params.id, {
    question_text_en: b.questionTextEn,
    question_text_ar: b.questionTextAr,
    question_image_url: b.questionImageUrl || null,
    question_type: questionType,
    mode,
    media_url: b.mediaUrl || null,
    options_json_en: JSON.stringify(b.optionsEn),
    options_json_ar: JSON.stringify(b.optionsAr),
    correct_option_index: b.correctOptionIndex,
    points,
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
  if (b.questionType !== undefined && ['text', 'image', 'qr', 'audio'].includes(b.questionType)) data.question_type = b.questionType;
  if (b.mode !== undefined && QUESTION_MODES.includes(b.mode)) data.mode = b.mode;
  if (b.mediaUrl !== undefined) data.media_url = b.mediaUrl;
  if (b.optionsEn !== undefined || b.optionsAr !== undefined) {
    const optionsEn = b.optionsEn !== undefined ? b.optionsEn : parseJsonColumn(existing.options_json_en, []);
    const optionsAr = b.optionsAr !== undefined ? b.optionsAr : parseJsonColumn(existing.options_json_ar, []);
    requireParallelOptions(optionsEn, optionsAr);
    data.options_json_en = JSON.stringify(optionsEn);
    data.options_json_ar = JSON.stringify(optionsAr);
  }
  if (b.correctOptionIndex !== undefined) data.correct_option_index = b.correctOptionIndex;
  if (b.points !== undefined && QUESTION_POINT_VALUES.includes(Number(b.points))) data.points = Number(b.points);
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
