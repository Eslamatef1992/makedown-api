const repo = require('./play.repository');
const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');
const { pool } = require('../../config/db');
const env = require('../../config/env');

// ---------------------------------------------------------------------------
// Server-side turn timers: when a tile's answer window opens we schedule a
// timeout that auto-resolves the turn (no answer) if nobody submits in time,
// exactly like a real host enforcing the on-screen countdown.
// ---------------------------------------------------------------------------

const timers = new Map(); // sessionId -> Timeout

function clearSessionTimer(sessionId) {
  const handle = timers.get(sessionId);
  if (handle) {
    clearTimeout(handle);
    timers.delete(sessionId);
  }
}

function scheduleExpiry(sessionId, io, ms) {
  clearSessionTimer(sessionId);
  const handle = setTimeout(async () => {
    timers.delete(sessionId);
    try {
      const result = await repo.expireTurn(sessionId);
      if (result) await broadcastTurnResult(io, sessionId, null, result);
    } catch (err) {
      // Nothing to resolve (already answered by the time the timer fired) — ignore.
    }
  }, Math.max(0, ms));
  timers.set(sessionId, handle);
}

async function broadcastTurnResult(io, sessionId, participantId, result) {
  const detail = await repo.findSessionDetail(sessionId);
  io.to(`game:${sessionId}`).emit('game:answer_result', {
    sessionId: Number(sessionId),
    participantId,
    questionId: result.question.id,
    isCorrect: result.isCorrect,
    correctOptionIndex: result.correctOptionIndex,
  });
  io.to(`game:${sessionId}`).emit('game:state', detail);
  if (detail.status === 'finished') {
    io.to(`game:${sessionId}`).emit('game:ended', { sessionId: Number(sessionId), participants: detail.participants, teams: detail.teams });
  } else if (detail.currentTurnParticipantId) {
    io.to(`game:${sessionId}`).emit('game:turn_changed', { sessionId: Number(sessionId), currentTurnParticipantId: detail.currentTurnParticipantId });
  }
}

const ERROR_STATUS = {
  SESSION_NOT_FOUND: 404,
  SESSION_NOT_JOINABLE: 409,
  SESSION_FULL: 409,
  SESSION_NOT_ACTIVE: 409,
  ALREADY_STARTED: 409,
  NO_PLAYERS: 400,
  NO_CATEGORIES: 400,
  NOT_HOST: 403,
  NOT_YOUR_TURN: 403,
  TILE_ALREADY_IN_PROGRESS: 409,
  QUESTION_NOT_ON_BOARD: 400,
  TILE_ALREADY_USED: 409,
  QUESTION_NOT_ACTIVE: 409,
  AWAITING_SCAN: 409,
  TIME_EXPIRED: 409,
  INVALID_SCAN_TOKEN: 400,
  NO_ACTIVE_QUESTION: 409,
  LIFELINE_ALREADY_USED: 409,
  TARGET_NOT_IN_SESSION: 400,
  CANNOT_TARGET_SELF: 400,
  REQUEST_NOT_FOUND: 404,
  NOT_YOUR_REQUEST: 403,
  REQUEST_CLOSED: 409,
  INVITE_NOT_FOUND: 404,
  INVITE_CLOSED: 409,
  PARTICIPANT_NOT_FOUND: 404,
};

function mapError(err) {
  const status = ERROR_STATUS[err.message];
  if (status) return new ApiError(status, err.message.replace(/_/g, ' ').toLowerCase());
  throw err;
}

async function requireParticipant(sessionId, userId) {
  const participant = await repo.findParticipant(sessionId, userId);
  if (!participant) throw ApiError.forbidden('You are not part of this game');
  return participant;
}

// ---------------------------------------------------------------------------
// Categories / quizzes (board picker)
// ---------------------------------------------------------------------------

const listPlayableQuizzes = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT q.id, q.title_en, q.title_ar, q.cover_image_url, q.difficulty, q.category_id,
            gc.name_en AS category_name_en, gc.name_ar AS category_name_ar,
            (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS question_count
     FROM quizzes q
     LEFT JOIN game_categories gc ON gc.id = q.category_id
     WHERE q.is_active = 1
     ${req.query.category_id ? 'AND q.category_id = ?' : ''}
     ORDER BY q.title_en ASC`,
    req.query.category_id ? [req.query.category_id] : []
  );
  ok(res, rows.filter((r) => r.question_count > 0));
});

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

const createSession = asyncHandler(async (req, res) => {
  const { mode, quizIds, title, isPublic, maxPlayers, schoolId } = req.body;
  if (!['solo', 'team', 'random'].includes(mode)) throw ApiError.badRequest('mode must be solo, team, or random');
  if (!Array.isArray(quizIds) || !quizIds.length) throw ApiError.badRequest('Select at least one category');

  const session = await repo.createSession({
    hostUserId: req.user.id,
    mode,
    quizIds: quizIds.map(Number),
    title,
    isPublic: Boolean(isPublic) || mode === 'random',
    maxPlayers,
    schoolId,
  });

  try {
    const QRCode = require('qrcode');
    const joinUrl = `${env.frontendUrl}/play/join/${session.join_code}`;
    const qrDataUrl = await QRCode.toDataURL(joinUrl, { margin: 1, width: 320 });
    await pool.query('UPDATE game_sessions SET qr_code_url = ? WHERE id = ?', [qrDataUrl, session.id]);
    session.qr_code_url = qrDataUrl;
  } catch {
    // QR generation is a nice-to-have; the join code alone still works.
  }

  created(res, session, 'Game created');
});

const joinByCode = asyncHandler(async (req, res) => {
  const code = String(req.body.joinCode || '').trim().toUpperCase();
  if (!code) throw ApiError.badRequest('joinCode is required');
  const session = await repo.findSessionByJoinCode(code);
  if (!session) throw ApiError.notFound('No game found with that code');

  try {
    await repo.joinSession(session.id, req.user.id);
  } catch (err) {
    throw mapError(err);
  }

  const detail = await repo.findSessionDetail(session.id);
  const io = req.app.get('io');
  io.to(`game:${session.id}`).emit('game:state', detail);
  ok(res, detail, 'Joined');
});

const getSession = asyncHandler(async (req, res) => {
  const detail = await repo.findSessionDetail(req.params.id);
  if (!detail) throw ApiError.notFound('Game not found');
  ok(res, detail);
});

const startSession = asyncHandler(async (req, res) => {
  let detail;
  try {
    detail = await repo.startSession(req.params.id, req.user.id);
  } catch (err) {
    throw mapError(err);
  }
  const io = req.app.get('io');
  io.to(`game:${req.params.id}`).emit('game:started', detail);
  ok(res, detail, 'Game started');
});

const leaveSession = asyncHandler(async (req, res) => {
  await repo.leaveSession(req.params.id, req.user.id);
  const detail = await repo.findSessionDetail(req.params.id);
  const io = req.app.get('io');
  io.to(`game:${req.params.id}`).emit('game:state', detail);
  io.to(`game:${req.params.id}`).emit('game:player_left', { sessionId: Number(req.params.id), userId: req.user.id });
  ok(res, detail, 'Left game');
});

const listPublicSessions = asyncHandler(async (req, res) => {
  ok(res, await repo.listPublicSessions({ mode: req.query.mode, page: req.query.page, pageSize: req.query.pageSize }));
});

const matchRandom = asyncHandler(async (req, res) => {
  let result;
  try {
    result = await repo.matchRandom(req.params.id, req.user.id);
  } catch (err) {
    throw mapError(err);
  }
  const detail = await repo.findSessionDetail(result.matchedSessionId);
  const io = req.app.get('io');
  io.to(`game:${result.matchedSessionId}`).emit('game:state', detail);
  ok(res, { ...result, session: detail });
});

// ---------------------------------------------------------------------------
// Live play: pick tile / scan / answer
// ---------------------------------------------------------------------------

const pickTile = asyncHandler(async (req, res) => {
  await requireParticipant(req.params.id, req.user.id);
  let result;
  try {
    result = await repo.pickTile(req.params.id, req.user.id, Number(req.body.questionId));
  } catch (err) {
    throw mapError(err);
  }
  const io = req.app.get('io');
  io.to(`game:${req.params.id}`).emit('game:tile_picked', {
    sessionId: Number(req.params.id),
    question: result.question,
    awaitingScan: result.awaitingScan,
    timeLimitSeconds: result.timeLimitSeconds,
  });
  if (!result.awaitingScan) scheduleExpiry(req.params.id, io, result.timeLimitSeconds * 1000);
  ok(res, result);
});

const scanQuestion = asyncHandler(async (req, res) => {
  await requireParticipant(req.params.id, req.user.id);
  let result;
  try {
    result = await repo.scanQuestion(req.params.id, req.user.id, req.body.token);
  } catch (err) {
    throw mapError(err);
  }
  const io = req.app.get('io');
  io.to(`game:${req.params.id}`).emit('game:question_revealed', {
    sessionId: Number(req.params.id),
    question: result.question,
    timeLimitSeconds: result.timeLimitSeconds,
  });
  scheduleExpiry(req.params.id, io, result.timeLimitSeconds * 1000);
  ok(res, result);
});

const submitAnswer = asyncHandler(async (req, res) => {
  await requireParticipant(req.params.id, req.user.id);
  clearSessionTimer(req.params.id);
  let result;
  try {
    result = await repo.submitAnswer(req.params.id, req.user.id, Number(req.body.questionId), req.body.selectedOptionIndex, req.body.timeTakenMs);
  } catch (err) {
    throw mapError(err);
  }
  const io = req.app.get('io');
  const participant = await repo.findParticipant(req.params.id, req.user.id);
  await broadcastTurnResult(io, req.params.id, participant.id, result);
  ok(res, { isCorrect: result.isCorrect, correctOptionIndex: result.correctOptionIndex });
});

// ---------------------------------------------------------------------------
// Lifelines
// ---------------------------------------------------------------------------

const fiftyFifty = asyncHandler(async (req, res) => {
  await requireParticipant(req.params.id, req.user.id);
  let result;
  try {
    result = await repo.useFiftyFifty(req.params.id, req.user.id, Number(req.body.questionId));
  } catch (err) {
    throw mapError(err);
  }
  ok(res, result);
});

const skip = asyncHandler(async (req, res) => {
  await requireParticipant(req.params.id, req.user.id);
  clearSessionTimer(req.params.id);
  let result;
  try {
    result = await repo.useSkip(req.params.id, req.user.id, Number(req.body.questionId));
  } catch (err) {
    throw mapError(err);
  }
  const io = req.app.get('io');
  const participant = await repo.findParticipant(req.params.id, req.user.id);
  await broadcastTurnResult(io, req.params.id, participant.id, result);
  ok(res, { skipped: true });
});

const phoneAFriend = asyncHandler(async (req, res) => {
  await requireParticipant(req.params.id, req.user.id);
  let result;
  try {
    result = await repo.requestPhoneAFriend(req.params.id, req.user.id, Number(req.body.questionId), Number(req.body.targetParticipantId));
  } catch (err) {
    throw mapError(err);
  }
  const io = req.app.get('io');
  io.to(`user:${result.targetUserId}`).emit('game:lifeline_request', {
    requestId: result.requestId,
    sessionId: Number(req.params.id),
    question: result.question,
  });
  ok(res, { requestId: result.requestId }, 'Friend notified');
});

const respondPhoneAFriend = asyncHandler(async (req, res) => {
  let result;
  try {
    result = await repo.respondPhoneAFriend(req.params.requestId, req.user.id, req.body.suggestedOptionIndex);
  } catch (err) {
    throw mapError(err);
  }
  const io = req.app.get('io');
  io.to(`user:${result.requesterUserId}`).emit('game:lifeline_response', {
    requestId: Number(req.params.requestId),
    sessionId: result.sessionId,
    suggestedOptionIndex: result.suggestedOptionIndex,
  });
  ok(res, { sent: true });
});

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

const searchInvitees = asyncHandler(async (req, res) => {
  ok(res, await repo.searchInviteCandidates(req.params.id, req.user.id, req.query.q));
});

const invite = asyncHandler(async (req, res) => {
  const invited = await repo.createInvite(req.params.id, req.user.id, Number(req.body.userId));
  const detail = await repo.findSessionDetail(req.params.id);
  const io = req.app.get('io');
  io.to(`user:${req.body.userId}`).emit('game:invite', {
    inviteId: invited.id,
    sessionId: Number(req.params.id),
    fromUserId: req.user.id,
    session: detail,
  });
  created(res, invited, 'Invitation sent');
});

const respondInvite = asyncHandler(async (req, res) => {
  let invite_;
  try {
    invite_ = await repo.respondInvite(req.params.inviteId, req.user.id, Boolean(req.body.accept));
  } catch (err) {
    throw mapError(err);
  }
  if (req.body.accept) {
    const detail = await repo.findSessionDetail(invite_.session_id);
    const io = req.app.get('io');
    io.to(`game:${invite_.session_id}`).emit('game:state', detail);
    return ok(res, detail, 'Joined');
  }
  ok(res, invite_, 'Declined');
});

// ---------------------------------------------------------------------------
// Host controls
// ---------------------------------------------------------------------------

const adjustScore = asyncHandler(async (req, res) => {
  let participant;
  try {
    participant = await repo.adjustScore(req.params.id, req.user.id, Number(req.body.participantId), Number(req.body.delta), req.body.reason);
  } catch (err) {
    throw mapError(err);
  }
  const io = req.app.get('io');
  io.to(`game:${req.params.id}`).emit('game:score_adjusted', { sessionId: Number(req.params.id), participant });
  ok(res, participant);
});

module.exports = {
  listPlayableQuizzes,
  createSession,
  joinByCode,
  getSession,
  startSession,
  leaveSession,
  listPublicSessions,
  matchRandom,
  pickTile,
  scanQuestion,
  submitAnswer,
  fiftyFifty,
  skip,
  phoneAFriend,
  respondPhoneAFriend,
  searchInvitees,
  invite,
  respondInvite,
  adjustScore,
};
