const { verifyAccessToken } = require('../utils/tokens');

// Like requireAuth, but never blocks the request — used by endpoints (like
// checkout) that behave differently for a logged-in user vs a guest, without
// forcing a login. A missing/invalid/expired token just means req.user stays
// unset; only a well-formed, valid token attaches req.user.
module.exports = function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) {
    try {
      const payload = verifyAccessToken(token);
      req.user = { id: payload.sub, email: payload.email };
    } catch {
      // ignore — proceed as guest
    }
  }
  next();
};
