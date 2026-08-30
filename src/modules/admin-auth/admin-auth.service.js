const bcrypt = require('bcryptjs');
const repo = require('./admin-auth.repository');
const ApiError = require('../../utils/ApiError');
const { signAdminAccessToken } = require('../../utils/tokens');

function publicAdmin(admin, permissions = []) {
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    avatarUrl: admin.avatar_url,
    roleId: admin.role_id,
    permissions,
  };
}

async function login({ email, password }) {
  const admin = await repo.findByEmail(email);
  if (!admin) throw ApiError.unauthorized('Invalid email or password');

  const passwordOk = await bcrypt.compare(password, admin.password_hash);
  if (!passwordOk) throw ApiError.unauthorized('Invalid email or password');

  if (!admin.is_active) throw ApiError.forbidden('This admin account has been disabled');

  await repo.updateLastLogin(admin.id);
  const permissions = await repo.getPermissionKeys(admin.role_id);
  const accessToken = signAdminAccessToken(admin);

  return { admin: publicAdmin(admin, permissions), accessToken };
}

async function me(adminId) {
  const admin = await repo.findById(adminId);
  if (!admin) throw ApiError.notFound('Admin not found');
  const permissions = await repo.getPermissionKeys(admin.role_id);
  return publicAdmin(admin, permissions);
}

module.exports = { login, me };
