const repo = require('./users.repository');
const { makeCrudController } = require('../../utils/crudController');

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

// No create/delete exposed for users from the admin panel — accounts are
// self-service (register/verify) on the website.
module.exports = { list: crud.list, getOne: crud.getOne, updateOne: crud.updateOne };
