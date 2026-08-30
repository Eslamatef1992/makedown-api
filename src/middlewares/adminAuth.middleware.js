const ApiError = require('../utils/ApiError');
const { verifyAdminAccessToken } = require('../utils/tokens');

module.exports = function requireAdminAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized('Missing or invalid Authorization header'));
  }

  try {
    const payload = verifyAdminAccessToken(token);
    if (payload.type !== 'admin_access') throw new Error('wrong token type');
    req.admin = { id: payload.sub, email: payload.email, roleId: payload.roleId };
    next();
  } catch (err) {
    next(ApiError.unauthorized('Invalid or expired admin token'));
  }
};
