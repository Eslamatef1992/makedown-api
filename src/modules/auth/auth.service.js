const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const repo = require('./auth.repository');
const ApiError = require('../../utils/ApiError');
const { generateOtp } = require('../../utils/otp');
const { sendMail, otpEmailTemplate } = require('../../config/mailer');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} = require('../../utils/tokens');
const env = require('../../config/env');

function publicUser(user) {
  return {
    id: user.id,
    uuid: user.uuid,
    fullName: user.full_name,
    firstName: user.first_name,
    lastName: user.last_name,
    birthDate: user.birth_date,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatar_url,
    emailVerified: Boolean(user.email_verified_at),
    createdAt: user.created_at,
  };
}

async function issueOtp({ userId, email, purpose, name }) {
  const code = generateOtp(env.otp.length);
  const expiresAt = new Date(Date.now() + env.otp.expiresMinutes * 60 * 1000);
  await repo.createOtp({ userId, email, code, purpose, expiresAt });
  const { subject, text, html } = otpEmailTemplate({ name, code, purpose });
  await sendMail({ to: email, subject, text, html });
}

async function register({ firstName, lastName, email, phone, birthDate, password }) {
  const existing = await repo.findUserByEmail(email);
  if (existing) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const fullName = `${firstName} ${lastName}`.trim();
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await repo.createUser({
    uuid: uuidv4(),
    fullName,
    firstName,
    lastName,
    birthDate,
    email,
    phone,
    passwordHash,
  });

  await issueOtp({ userId: user.id, email, purpose: 'register', name: fullName });

  return { user: publicUser(user) };
}

async function verifyOtp({ email, code, purpose }) {
  const otp = await repo.findValidOtp({ email, code, purpose });
  if (!otp) {
    throw ApiError.badRequest('Invalid or expired code');
  }
  await repo.consumeOtp(otp.id);

  if (purpose === 'register') {
    const user = await repo.findUserByEmail(email);
    if (!user) throw ApiError.notFound('Account not found');
    await repo.markEmailVerified(user.id);
    return issueSession(user, false);
  }

  // For reset_password the caller still needs to submit the new password
  // via resetPassword(); verifyOtp here just confirms the code is valid.
  return { verified: true };
}

async function resendOtp({ email, purpose }) {
  const user = await repo.findUserByEmail(email);
  if (!user) {
    // Don't leak whether the email exists.
    return { sent: true };
  }
  await issueOtp({ userId: user.id, email, purpose, name: user.full_name });
  return { sent: true };
}

async function issueSession(user, rememberMe) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user, rememberMe);
  const decoded = verifyRefreshToken(refreshToken);

  await repo.storeRefreshToken({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(decoded.exp * 1000),
  });

  await repo.updateLastLogin(user.id);

  return { user: publicUser(user), accessToken, refreshToken };
}

async function login({ email, password, rememberMe }) {
  const user = await repo.findUserByEmail(email);
  if (!user) throw ApiError.unauthorized('Invalid email or password');

  const passwordOk = await bcrypt.compare(password, user.password_hash);
  if (!passwordOk) throw ApiError.unauthorized('Invalid email or password');

  if (!user.email_verified_at) {
    await issueOtp({ userId: user.id, email, purpose: 'register', name: user.full_name });
    throw ApiError.forbidden('Email not verified. A new verification code has been sent.');
  }

  if (!user.is_active) {
    throw ApiError.forbidden('This account has been disabled');
  }

  return issueSession(user, rememberMe);
}

async function refresh({ refreshToken }) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await repo.findRefreshToken(tokenHash);
  if (!stored) throw ApiError.unauthorized('Refresh token has been revoked');

  const user = await repo.findUserById(payload.sub);
  if (!user) throw ApiError.unauthorized('Account not found');

  await repo.revokeRefreshToken(tokenHash);
  return issueSession(user, false);
}

async function logout({ refreshToken }) {
  if (refreshToken) {
    await repo.revokeRefreshToken(hashToken(refreshToken));
  }
  return { loggedOut: true };
}

async function forgotPassword({ email }) {
  const user = await repo.findUserByEmail(email);
  if (user) {
    await issueOtp({ userId: user.id, email, purpose: 'reset_password', name: user.full_name });
  }
  // Always respond success so we don't leak account existence.
  return { sent: true };
}

async function resetPassword({ email, code, newPassword }) {
  const otp = await repo.findValidOtp({ email, code, purpose: 'reset_password' });
  if (!otp) throw ApiError.badRequest('Invalid or expired code');

  const user = await repo.findUserByEmail(email);
  if (!user) throw ApiError.notFound('Account not found');

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await repo.updatePassword(user.id, passwordHash);
  await repo.consumeOtp(otp.id);
  await repo.revokeAllRefreshTokensForUser(user.id);

  return { reset: true };
}

async function me(userId) {
  const user = await repo.findUserById(userId);
  if (!user) throw ApiError.notFound('Account not found');
  return publicUser(user);
}

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
