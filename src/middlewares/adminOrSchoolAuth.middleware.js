const ApiError = require('../utils/ApiError');
const { verifyAdminAccessToken } = require('../utils/tokens');

// Accepts either an admin token or a school token (see tokens.js /
// admin-auth.service.js) and attaches req.admin or req.school accordingly.
// Used by routes a school self-serves (its own game sessions) alongside
// the super admin — routes that must stay admin-only keep using
// adminAuth.middleware.js directly.
module.exports = function requireAdminOrSchoolAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized('Missing or invalid Authorization header'));
  }

  try {
    const payload = verifyAdminAccessToken(token);
    if (payload.type === 'admin_access') {
      req.admin = { id: payload.sub, email: payload.email, roleId: payload.roleId };
    } else if (payload.type === 'school_access') {
      req.school = { id: payload.sub, code: payload.code };
    } else {
      throw new Error('wrong token type');
    }
    next();
  } catch (err) {
    next(ApiError.unauthorized('Invalid or expired token'));
  }
};
