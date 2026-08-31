const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const service = require('./admin-auth.service');

const login = asyncHandler(async (req, res) => {
  const result = await service.login(req.body);
  ok(res, result, 'Logged in');
});

const me = asyncHandler(async (req, res) => {
  if (req.school) {
    const school = await service.meSchool(req.school.id);
    return ok(res, { role: 'school', school });
  }
  const admin = await service.me(req.admin.id);
  ok(res, { role: 'admin', admin });
});

module.exports = { login, me };
