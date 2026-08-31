const repo = require('./game-sessions.repository');
const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');

const list = asyncHandler(async (req, res) => {
  const { page, pageSize, mode, status, school_id } = req.query;
  const result = await repo.list({ page, pageSize, filters: { mode, status, school_id } });
  ok(res, result);
});

const getOne = asyncHandler(async (req, res) => {
  const session = await repo.findById(req.params.id);
  if (!session) throw ApiError.notFound('Game session not found');
  const [participants, board] = await Promise.all([
    repo.listParticipants(req.params.id),
    repo.getBoard(req.params.id),
  ]);
  ok(res, { ...session, participants, board });
});

// School/staff "create game": pick solo/team mode, specialize categories
// (quizzes), optionally tie it to a school — returns a join code + QR the
// school hands out; students join it from the website Play flow.
const create = asyncHandler(async (req, res) => {
  const { mode, quizIds, title, schoolId, maxPlayers, isPublic } = req.body;
  if (!['solo', 'team', 'random'].includes(mode)) throw ApiError.badRequest('mode must be solo, team, or random');
  if (!Array.isArray(quizIds) || !quizIds.length) throw ApiError.badRequest('Select at least one category');

  const session = await repo.createSchoolGame({
    mode,
    quizIds: quizIds.map(Number),
    title,
    schoolId,
    maxPlayers,
    isPublic,
  });

  try {
    const QRCode = require('qrcode');
    const env = require('../../config/env');
    const { pool } = require('../../config/db');
    const joinUrl = `${env.frontendUrl}/play/join/${session.join_code}`;
    const qrDataUrl = await QRCode.toDataURL(joinUrl, { margin: 1, width: 320 });
    await pool.query('UPDATE game_sessions SET qr_code_url = ? WHERE id = ?', [qrDataUrl, session.id]);
    session.qr_code_url = qrDataUrl;
  } catch {
    // QR generation is a nice-to-have; the join code alone still works.
  }

  created(res, session, 'Game created');
});

module.exports = { list, getOne, create };
