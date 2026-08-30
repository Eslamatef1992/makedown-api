const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, type: 'access' },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiresIn }
  );
}

function signRefreshToken(user, rememberMe = false) {
  const expiresIn = rememberMe ? env.jwt.refreshExpiresInRemember : env.jwt.refreshExpiresIn;
  return jwt.sign(
    { sub: user.id, type: 'refresh' },
    env.jwt.refreshSecret,
    { expiresIn }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
};

function signAdminAccessToken(admin) {
  return jwt.sign(
    { sub: admin.id, email: admin.email, roleId: admin.role_id, type: 'admin_access' },
    env.jwt.adminSecret,
    { expiresIn: env.jwt.adminExpiresIn }
  );
}

function verifyAdminAccessToken(token) {
  return jwt.verify(token, env.jwt.adminSecret);
}

module.exports.signAdminAccessToken = signAdminAccessToken;
module.exports.verifyAdminAccessToken = verifyAdminAccessToken;
