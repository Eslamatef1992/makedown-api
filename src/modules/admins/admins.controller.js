const bcrypt = require('bcryptjs');
const repo = require('./admins.repository');
const { makeCrudController } = require('../../utils/crudController');
const ApiError = require('../../utils/ApiError');

function serialize(admin) {
  const { password_hash, ...rest } = admin;
  return rest;
}

async function transformInput(body, { isUpdate, req }) {
  const data = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.email !== undefined) data.email = body.email;
  if (body.roleId !== undefined) data.role_id = body.roleId || null;
  if (body.isActive !== undefined) data.is_active = body.isActive ? 1 : 0;
  if (body.avatarUrl !== undefined) data.avatar_url = body.avatarUrl;

  if (body.password) {
    data.password_hash = await bcrypt.hash(body.password, 10);
  } else if (!isUpdate) {
    throw ApiError.badRequest('Password is required to create an admin');
  }

  // Prevent an admin from deactivating their own account by mistake.
  if (isUpdate && req.admin && String(req.admin.id) === String(req.params.id) && data.is_active === 0) {
    throw ApiError.badRequest('You cannot deactivate your own account');
  }

  return data;
}

module.exports = makeCrudController(repo, { transformInput, serialize, notFoundMessage: 'Admin not found' });
