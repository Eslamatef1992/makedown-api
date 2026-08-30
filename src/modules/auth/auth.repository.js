const { pool } = require('../../config/db');

async function findUserByEmail(email) {
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  return rows[0] || null;
}

async function findUserById(id) {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function createUser({ uuid, fullName, email, phone, passwordHash }) {
  const [result] = await pool.query(
    `INSERT INTO users (uuid, full_name, email, phone, password_hash)
     VALUES (?, ?, ?, ?, ?)`,
    [uuid, fullName, email, phone || null, passwordHash]
  );
  return findUserById(result.insertId);
}

async function markEmailVerified(userId) {
  await pool.query('UPDATE users SET email_verified_at = NOW() WHERE id = ?', [userId]);
}

async function updatePassword(userId, passwordHash) {
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
}

async function updateLastLogin(userId) {
  await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [userId]);
}

// ---- OTP ----

async function createOtp({ userId, email, code, purpose, expiresAt }) {
  await pool.query(
    `INSERT INTO otp_codes (user_id, email, code, purpose, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [userId || null, email, code, purpose, expiresAt]
  );
}

async function findValidOtp({ email, code, purpose }) {
  const [rows] = await pool.query(
    `SELECT * FROM otp_codes
     WHERE email = ? AND code = ? AND purpose = ? AND consumed_at IS NULL AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [email, code, purpose]
  );
  return rows[0] || null;
}

async function findLatestOtp({ email, purpose }) {
  const [rows] = await pool.query(
    `SELECT * FROM otp_codes
     WHERE email = ? AND purpose = ? AND consumed_at IS NULL AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [email, purpose]
  );
  return rows[0] || null;
}

async function consumeOtp(otpId) {
  await pool.query('UPDATE otp_codes SET consumed_at = NOW() WHERE id = ?', [otpId]);
}

async function incrementOtpAttempts(otpId) {
  await pool.query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?', [otpId]);
}

// ---- Refresh tokens ----

async function storeRefreshToken({ userId, tokenHash, userAgent, ipAddress, expiresAt }) {
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip_address, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, tokenHash, userAgent || null, ipAddress || null, expiresAt]
  );
}

async function findRefreshToken(tokenHash) {
  const [rows] = await pool.query(
    `SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1`,
    [tokenHash]
  );
  return rows[0] || null;
}

async function revokeRefreshToken(tokenHash) {
  await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ?', [tokenHash]);
}

async function revokeAllRefreshTokensForUser(userId) {
  await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [userId]);
}

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  markEmailVerified,
  updatePassword,
  updateLastLogin,
  createOtp,
  findValidOtp,
  findLatestOtp,
  consumeOtp,
  incrementOtpAttempts,
  storeRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokensForUser,
};
