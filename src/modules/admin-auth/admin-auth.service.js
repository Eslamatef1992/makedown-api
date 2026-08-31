const bcrypt = require('bcryptjs');
const repo = require('./admin-auth.repository');
const schoolsRepo = require('../schools/schools.repository');
const ApiError = require('../../utils/ApiError');
const { signAdminAccessToken, signSchoolAccessToken } = require('../../utils/tokens');

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

function publicSchool(school) {
  return {
    id: school.id,
    nameEn: school.name_en,
    nameAr: school.name_ar,
    code: school.code,
    logoUrl: school.logo_url,
  };
}

// One shared login screen for both super admins and schools — the frontend
// sends whatever the person typed as `identifier` (an admin's email, or a
// school's login code) and this figures out which one it is:
//   1. If that identifier matches an admin's email, it must be an admin
//      login — a wrong password there fails outright rather than falling
//      through to a school lookup (avoids leaking whether a code exists).
//   2. Otherwise, try it as a school code.
// Either branch returns { role, accessToken } so the admin frontend can
// route to the right shell and the API middlewares can tell tokens apart.
async function login({ identifier, password }) {
  const admin = await repo.findByEmail(identifier);
  if (admin) {
    const passwordOk = await bcrypt.compare(password, admin.password_hash);
    if (!passwordOk) throw ApiError.unauthorized('Invalid email/code or password');
    if (!admin.is_active) throw ApiError.forbidden('This admin account has been disabled');

    await repo.updateLastLogin(admin.id);
    const permissions = await repo.getPermissionKeys(admin.role_id);
    const accessToken = signAdminAccessToken(admin);
    return { role: 'admin', admin: publicAdmin(admin, permissions), accessToken };
  }

  const school = await schoolsRepo.findByCode(identifier);
  if (school && school.password_hash) {
    const passwordOk = await bcrypt.compare(password, school.password_hash);
    if (passwordOk) {
      const accessToken = signSchoolAccessToken(school);
      return { role: 'school', school: publicSchool(school), accessToken };
    }
  }

  throw ApiError.unauthorized('Invalid email/code or password');
}

async function me(adminId) {
  const admin = await repo.findById(adminId);
  if (!admin) throw ApiError.notFound('Admin not found');
  const permissions = await repo.getPermissionKeys(admin.role_id);
  return publicAdmin(admin, permissions);
}

async function meSchool(schoolId) {
  const school = await schoolsRepo.findById(schoolId);
  if (!school) throw ApiError.notFound('School not found');
  return publicSchool(school);
}

module.exports = { login, me, meSchool };
