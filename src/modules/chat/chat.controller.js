const repo = require('./chat.repository');
const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');

const listThreads = asyncHandler(async (req, res) => {
  ok(res, await repo.listThreads({ page: req.query.page, pageSize: req.query.pageSize }));
});

const getMessages = asyncHandler(async (req, res) => {
  const thread = await repo.findThreadById(req.params.id);
  if (!thread) throw ApiError.notFound('Thread not found');
  ok(res, await repo.listMessages(req.params.id));
});

module.exports = { listThreads, getMessages };
