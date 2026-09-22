const repo = require('./game-sessions.repository');
const quizzesRepo = require('../quizzes/quizzes.repository');
const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');

const list = asyncHandler(async (req, res) => {
  const { page, pageSize, mode, status, school_id, has_school: hasSchool } = req.query;
  // A school only ever sees its own games — its token pins the filter
  // regardless of what (if anything) it asked for.
  const scopedSchoolId = req.school ? req.school.id : school_id;
  const result = await repo.list({ page, pageSize, filters: { mode, status, school_id: scopedSchoolId, hasSchool } });
  ok(res, result);
});

const getOne = asyncHandler(async (req, res) => {
  const session = await repo.findById(req.params.id);
  if (!session) throw ApiError.notFound('Game session not found');
  if (req.school && Number(session.school_id) !== Number(req.school.id)) throw ApiError.notFound('Game session not found');
  // quizIds/teams are only needed to pre-fill the "edit" (pencil) form —
  // cheap enough to always include alongside the read-only view's
  // participants/board rather than a second round trip.
  const [participants, board, quizIds, teams] = await Promise.all([
    repo.listParticipants(req.params.id),
    repo.getBoard(req.params.id),
    repo.getQuizIds(req.params.id),
    repo.getTeams(req.params.id),
  ]);
  ok(res, { ...session, participants, board, quizIds, teams });
});

// Super admin OR a logged-in school "create game": pick solo/team mode,
// specialize categories (quizzes), optionally tie it to a school (a school
// token forces its own id — it can't create games for anyone else),
// schedule it and target an audience, name its teams — returns a join
// code + QR that gets handed out; students join it from the website Play
// flow, same as any other game session.
const create = asyncHandler(async (req, res) => {
  const {
    mode, quizIds, title, titleAr, maxPlayers, isPublic,
    audience, scheduledDate, scheduledTime,
    team1Name, team1Capacity, team2Name, team2Capacity,
  } = req.body;
  const schoolId = req.school ? req.school.id : req.body.schoolId;
  if (!['solo', 'team', 'random'].includes(mode)) throw ApiError.badRequest('mode must be solo, team, or random');
  // A school's own "Create Game" flow never offers solo any more — the
  // admin panel UI doesn't show the picker at all for a school, this is
  // just the server-side backstop for it (same reasoning as the
  // owned-quiz check below).
  if (req.school && mode !== 'team') throw ApiError.badRequest('Schools can only create team games');
  if (!Array.isArray(quizIds) || !quizIds.length) throw ApiError.badRequest('Select at least one category');
  if (audience !== undefined && audience !== null && !['girls', 'boys', 'mixed'].includes(audience)) {
    throw ApiError.badRequest('audience must be girls, boys, or mixed');
  }
  // A school's game name is bilingual and required, like every other
  // user-facing name in the app — a non-school (super admin) session keeps
  // the optional single-language title it always had.
  if (req.school && (!title || !title.trim() || !titleAr || !titleAr.trim())) {
    throw ApiError.badRequest('Enter the game name in both English and Arabic');
  }

  // A school can only bundle its own private games onto its board — never
  // the global catalog or another school's games, even via a crafted
  // request (the admin UI only ever offers a school's own list to begin
  // with, this is the server-side backstop).
  if (req.school) {
    const ids = quizIds.map(Number);
    const owned = await Promise.all(ids.map((qid) => quizzesRepo.findById(qid)));
    const notOwned = owned.some((q) => !q || Number(q.school_id) !== Number(req.school.id));
    if (notOwned) throw ApiError.badRequest('One or more selected games are not yours');
  }

  const session = await repo.createSchoolGame({
    mode,
    quizIds: quizIds.map(Number),
    title,
    titleAr,
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

// Edits the same fields the create flow collects — the "pencil" action next
// to the read-only "eye" view on Games history. A school can only edit its
// own sessions (same ownership check as getOne); the bilingual-name
// requirement and the owned-quiz backstop mirror create() exactly.
const updateOne = asyncHandler(async (req, res) => {
  const existing = await repo.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Game session not found');
  if (req.school && Number(existing.school_id) !== Number(req.school.id)) throw ApiError.notFound('Game session not found');

  const {
    title, titleAr, audience, scheduledDate, scheduledTime, maxPlayers,
    quizIds, team1Name, team1Capacity, team2Name, team2Capacity,
  } = req.body;

  if (audience !== undefined && audience !== null && audience !== '' && !['girls', 'boys', 'mixed'].includes(audience)) {
    throw ApiError.badRequest('audience must be girls, boys, or mixed');
  }
  if (req.school && (!title || !title.trim() || !titleAr || !titleAr.trim())) {
    throw ApiError.badRequest('Enter the game name in both English and Arabic');
  }
  if (quizIds !== undefined) {
    if (!Array.isArray(quizIds) || !quizIds.length) throw ApiError.badRequest('Select at least one category');
    if (req.school) {
      const ids = quizIds.map(Number);
      const owned = await Promise.all(ids.map((qid) => quizzesRepo.findById(qid)));
      const notOwned = owned.some((q) => !q || Number(q.school_id) !== Number(req.school.id));
      if (notOwned) throw ApiError.badRequest('One or more selected games are not yours');
    }
  }
  if (existing.mode === 'team' && (!team1Name || !team1Name.trim() || !team2Name || !team2Name.trim())) {
    throw ApiError.badRequest('Name both teams');
  }

  const session = await repo.updateSchoolGame(req.params.id, {
    title,
    titleAr,
    audience,
    scheduledDate,
    scheduledTime,
    maxPlayers,
    quizIds: quizIds !== undefined ? quizIds.map(Number) : undefined,
    team1Name,
    team1Capacity,
    team2Name,
    team2Capacity,
  });
  ok(res, session, 'Game updated');
});

module.exports = { list, getOne, create, updateOne };
