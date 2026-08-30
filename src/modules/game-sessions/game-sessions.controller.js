const repo = require('./game-sessions.repository');
const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');

const list = asyncHandler(async (req, res) => {
  const { page, pageSize, mode, status, school_id } = req.query;
  const result = await repo.list({ page, pageSize, filters: { mode, status, school_id } });
  ok(res, result);
});

const getOne = asyncHandler(async (req, res) => {
  const session = await repo.findById(req.params.id);
  if (!session) throw ApiError.notFound('Game session not found');
  const participants = await repo.listParticipants(req.params.id);
  ok(res, { ...session, participants });
});

module.exports = { list, getOne };
