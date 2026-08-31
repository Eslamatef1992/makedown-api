const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const repo = require('./users.repository');
const { makeCrudController } = require('../../utils/crudController');
const asyncHandler = require('../../utils/asyncHandler');
const { created } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');

function serialize(user) {
  const { password_hash, ...rest } = user;
  return rest;
}

// Admin can only toggle status flags here — not edit identity/password.
function transformInput(body) {
  const data = {};
  if (body.isActive !== undefined) data.is_active = body.isActive ? 1 : 0;
  if (body.isSpecial !== undefined) data.is_special = body.isSpecial ? 1 : 0;
  return data;
}

const crud = makeCrudController(repo, { transformInput, serialize, notFoundMessage: 'User not found' });

// Super admin creates a "special user" directly from the admin panel — the
// account is fully set up (verified, active, special) so it can log in to
// the website immediately with the given email/password, same as any
// self-registered user.
const createSpecialUser = asyncHandler(async (req, res) => {
  const b = req.body;
  if (!b.firstName || !b.lastName || !b.email || !b.password) {
    throw ApiError.badRequest('First name, last name, email and password are required');
  }

  const existing = await repo.findBy('email', b.email);
  if (existing) {
    throw ApiError.badRequest('A user with this email already exists.');
  }

  const fullName = `${b.firstName} ${b.lastName}`.trim();
  const passwordHash = await bcrypt.hash(b.password, 10);

  try {
    const user = await repo.create({
      uuid: uuidv4(),
      full_name: fullName,
      first_name: b.firstName,
      last_name: b.lastName,
      email: b.email,
      phone: b.phone || null,
      password_hash: passwordHash,
      email_verified_at: new Date(),
      is_active: 1,
      is_special: 1,
      followers_count: b.followersCount ?? 0,
      following_count: b.followingCount ?? 0,
    });
    created(res, serialize(user));
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      throw ApiError.badRequest('A user with this email already exists.');
    }
    throw err;
  }
});

module.exports = { list: crud.list, getOne: crud.getOne, updateOne: crud.updateOne, createOne: createSpecialUser };
