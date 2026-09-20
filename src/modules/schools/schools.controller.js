const bcrypt = require('bcryptjs');
const repo = require('./schools.repository');
const { makeCrudController } = require('../../utils/crudController');
const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');
const { mapBilingualField, requireBilingual } = require('../../utils/bilingual');

async function transformInput(body, { existing, isUpdate } = {}) {
  const data = {};
  mapBilingualField(body, data, 'name', 'name');
  ['logoUrl', 'address', 'contactEmail', 'contactPhone'].forEach((k) => {
    if (body[k] !== undefined) data[{ logoUrl: 'logo_url', contactEmail: 'contact_email', contactPhone: 'contact_phone' }[k] || k] = body[k];
  });
  if (body.isActive !== undefined) data.is_active = body.isActive ? 1 : 0;
  // New schools default to active — findByEmail() (used for the school
  // login) requires is_active = 1, and an admin who forgets to tick the
  // checkbox would otherwise create a school that can never log in and
  // never shows up publicly.
  else if (!isUpdate) data.is_active = 1;

  // A school now logs in with its contact email (no more separate school
  // "code") — required, and must be unique so login resolves to exactly
  // one school.
  const email = data.contact_email !== undefined ? data.contact_email : existing?.contact_email;
  if (!email) throw ApiError.badRequest('Contact email is required');
  if (data.contact_email !== undefined) {
    const dup = await repo.findAnyByEmail(data.contact_email, existing?.id);
    if (dup) throw ApiError.badRequest('Another school already uses this contact email');
  }

  // Password is how the school logs in to create/manage its own games (see
  // admin-auth.service.js) — required when creating (there's no "current"
  // password yet to fall back on), optional on edit (leave blank to keep
  // it), hashed the same way admin passwords are.
  if (body.password) {
    if (String(body.password).length < 6) throw ApiError.badRequest('Password must be at least 6 characters');
    data.password_hash = await bcrypt.hash(body.password, 10);
  } else if (!isUpdate) {
    throw ApiError.badRequest('Password is required to create a school');
  }
  requireBilingual(data, ['name'], isUpdate);
  return data;
}

const crud = makeCrudController(repo, { transformInput, notFoundMessage: 'School not found' });

// Public — the website's "Schools" browsing grid.
const publicList = asyncHandler(async (req, res) => {
  const schools = await repo.listActive();
  ok(res, schools.map((s) => ({ id: s.id, nameEn: s.name_en, nameAr: s.name_ar, logoUrl: s.logo_url })));
});

// Public — the website's "<School> Games" page: the real, open games this
// school has scheduled (each backed by a live game_session — see
// game-sessions.repository.js#listPublicForSchool). Deliberately doesn't
// include the join code; a student types the code their teacher gave them
// into the "Game Code" modal, which goes through the normal authenticated
// /play/sessions/join flow like any other game.
const gamesRepo = require('../game-sessions/game-sessions.repository');
const publicGames = asyncHandler(async (req, res) => {
  const school = await repo.findById(req.params.id);
  if (!school || !school.is_active) throw ApiError.notFound('School not found');
  const games = await gamesRepo.listPublicForSchool(req.params.id);
  ok(res, games);
});

module.exports = { ...crud, publicList, publicGames };
