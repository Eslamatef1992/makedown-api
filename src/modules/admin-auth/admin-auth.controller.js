const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const service = require('./admin-auth.service');

const login = asyncHandler(async (req, res) => {
  const result = await service.login(req.body);
  ok(res, result, 'Logged in');
});

const me = asyncHandler(async (req, res) => {
  const result = await service.me(req.admin.id);
  ok(res, result);
});

module.exports = { login, me };
