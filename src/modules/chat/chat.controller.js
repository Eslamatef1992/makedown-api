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

// ---- customer-facing ----

const listMyThreads = asyncHandler(async (req, res) => {
  ok(res, await repo.listMyThreads(req.user.id));
});

async function requireMyThread(req) {
  const isIn = await repo.isParticipant(req.params.threadId, req.user.id);
  if (!isIn) throw ApiError.notFound('Conversation not found');
}

const getMyThreadMessages = asyncHandler(async (req, res) => {
  await requireMyThread(req);
  await repo.markThreadRead(req.params.threadId, req.user.id);
  ok(res, await repo.listMessages(req.params.threadId));
});

// Starts (or reuses) a 1:1 conversation with another user.
const startThread = asyncHandler(async (req, res) => {
  const otherUserId = Number(req.body.userId);
  if (!otherUserId || otherUserId === req.user.id) throw ApiError.badRequest('A valid userId is required');
  const threadId = await repo.findOrCreateOneToOneThread(req.user.id, otherUserId);
  ok(res, { threadId }, 'Conversation ready', 201);
});

const sendMyMessage = asyncHandler(async (req, res) => {
  await requireMyThread(req);
  const message = (req.body.message || '').trim();
  if (!message) throw ApiError.badRequest('message is required');

  const saved = await repo.createMessage({ threadId: req.params.threadId, senderId: req.user.id, message });

  // Live-deliver to the other participant if they're connected.
  const io = req.app.get('io');
  const otherId = await repo.otherParticipantId(req.params.threadId, req.user.id);
  if (io && otherId) {
    io.to(`user:${otherId}`).emit('chat:message', { threadId: Number(req.params.threadId), ...saved });
  }

  ok(res, saved, 'Sent', 201);
});

module.exports = {
  listThreads,
  getMessages,
  listMyThreads,
  getMyThreadMessages,
  startThread,
  sendMyMessage,
};
