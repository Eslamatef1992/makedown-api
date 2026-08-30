const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const service = require('./auth.service');

const register = asyncHandler(async (req, res) => {
  const result = await service.register(req.body);
  created(res, result, 'Account created. Check your email for a verification code.');
});

const verifyOtp = asyncHandler(async (req, res) => {
  const result = await service.verifyOtp(req.body);
  ok(res, result, 'Verified');
});

const resendOtp = asyncHandler(async (req, res) => {
  const result = await service.resendOtp(req.body);
  ok(res, result, 'Code sent if the account exists');
});

const login = asyncHandler(async (req, res) => {
  const result = await service.login(req.body);
  ok(res, result, 'Logged in');
});

const refresh = asyncHandler(async (req, res) => {
  const result = await service.refresh(req.body);
  ok(res, result, 'Token refreshed');
});

const logout = asyncHandler(async (req, res) => {
  const result = await service.logout(req.body);
  ok(res, result, 'Logged out');
});

const forgotPassword = asyncHandler(async (req, res) => {
  const result = await service.forgotPassword(req.body);
  ok(res, result, 'If that email exists, a reset code has been sent');
});

const resetPassword = asyncHandler(async (req, res) => {
  const result = await service.resetPassword(req.body);
  ok(res, result, 'Password reset');
});

const me = asyncHandler(async (req, res) => {
  const result = await service.me(req.user.id);
  ok(res, result);
});

module.exports = {
  register,
  verifyOtp,
  resendOtp,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  me,
};
