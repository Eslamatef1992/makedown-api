const repo = require('./game-sessions.repository');
const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');

const list = asyncHandler(async (req, res) => {
  const { page, pageSize, mode, status, school_id } = req.query;
  // A school only ever sees its own games — its token pins the filter
  // regardless of what (if anything) it asked for.
  const scopedSchoolId = req.school ? req.school.id : school_id;
  const result = await repo.list({ page, pageSize, filters: { mode, status, school_id: scopedSchoolId } });
  ok(res, result);
});

const getOne = asyncHandler(async (req, res) => {
  const session = await repo.findById(req.params.id);
  if (!session) throw ApiError.notFound('Game session not found');
  if (req.school && Number(session.school_id) !== Number(req.school.id)) throw ApiError.notFound('Game session not found');
  const [participants, board] = await Promise.all([
    repo.listParticipants(req.params.id),
    repo.getBoard(req.params.id),
  ]);
  ok(res, { ...session, participants, board });
});

// Super admin OR a logged-in school "create game": pick solo/team mode,
// specialize categories (quizzes), optionally tie it to a school (a school
// token forces its own id — it can't create games for anyone else),
// schedule it and target an audience, name its teams — returns a join
// code + QR that gets handed out; students join it from the website Play
// flow, same as any other game session.
const create = asyncHandler(async (req, res) => {
  const {
    mode, quizIds, title, maxPlayers, isPublic,
    audience, scheduledDate, scheduledTime,
    team1Name, team1Capacity, team2Name, team2Capacity,
  } = req.body;
  const schoolId = req.school ? req.school.id : req.body.schoolId;
  if (!['solo', 'team', 'random'].includes(mode)) throw ApiError.badRequest('mode must be solo, team, or random');
  if (!Array.isArray(quizIds) || !quizIds.length) throw ApiError.badRequest('Select at least one category');
  if (audience !== undefined && audience !== null && !['girls', 'boys', 'mixed'].includes(audience)) {
    throw ApiError.badRequest('audience must be girls, boys, or mixed');
  }

  const session = await repo.createSchoolGame({
    mode,
    quizIds: quizIds.map(Number),
    title,
    schoolId,
    maxPlayers,
    isPublic,
    audience,
    scheduledDate,
    scheduledTime,
    team1Name,
    team1Capacity,
    team2Name,
    team2Capacity,
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
