const router = require('express').Router();
const rateLimit = require('express-rate-limit');

const controller = require('./auth.controller');
const requireAuth = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const schemas = require('../../validators/auth.validator');

// Tighter limiter for OTP-related endpoints to slow down brute force / spam.
const otpLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

/**
 * @swagger
 * components:
 *   schemas:
 *     RegisterInput:
 *       type: object
 *       required: [fullName, email, password]
 *       properties:
 *         fullName: { type: string, example: "Sara Al-Fahad" }
 *         email: { type: string, format: email, example: "sara@example.com" }
 *         phone: { type: string, example: "+96555512345" }
 *         password: { type: string, format: password, minLength: 8 }
 *     LoginInput:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email: { type: string, format: email }
 *         password: { type: string, format: password }
 *         rememberMe: { type: boolean, default: false }
 *     VerifyOtpInput:
 *       type: object
 *       required: [email, code]
 *       properties:
 *         email: { type: string, format: email }
 *         code: { type: string, example: "482913" }
 *         purpose: { type: string, enum: [register, login, reset_password, change_email], default: register }
 *     User:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         uuid: { type: string }
 *         fullName: { type: string }
 *         email: { type: string }
 *         phone: { type: string, nullable: true }
 *         avatarUrl: { type: string, nullable: true }
 *         emailVerified: { type: boolean }
 *         createdAt: { type: string, format: date-time }
 *     AuthSession:
 *       type: object
 *       properties:
 *         user: { $ref: '#/components/schemas/User' }
 *         accessToken: { type: string }
 *         refreshToken: { type: string }
 *     ApiSuccess:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string }
 *         data: { type: object }
 *     ApiError:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: false }
 *         message: { type: string }
 *         details: { type: array, items: { type: string } }
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Create a new account and send an email OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RegisterInput' }
 *     responses:
 *       201: { description: Account created, content: { application/json: { schema: { $ref: '#/components/schemas/ApiSuccess' } } } }
 *       409: { description: Email already registered, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.post('/register', validate(schemas.register), controller.register);

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Verify an OTP code (email verification, password reset confirmation, etc.)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/VerifyOtpInput' }
 *     responses:
 *       200:
 *         description: Verified. For purpose=register, returns an authenticated session.
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ApiSuccess' } } }
 *       400: { description: Invalid or expired code, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.post('/verify-otp', otpLimiter, validate(schemas.verifyOtp), controller.verifyOtp);

/**
 * @swagger
 * /auth/resend-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Resend an OTP code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *               purpose: { type: string, enum: [register, login, reset_password, change_email], default: register }
 *     responses:
 *       200: { description: Sent if the account exists, content: { application/json: { schema: { $ref: '#/components/schemas/ApiSuccess' } } } }
 */
router.post('/resend-otp', otpLimiter, validate(schemas.resendOtp), controller.resendOtp);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LoginInput' }
 *     responses:
 *       200:
 *         description: Authenticated session
 *         content: { application/json: { schema: { allOf: [ { $ref: '#/components/schemas/ApiSuccess' }, { type: object, properties: { data: { $ref: '#/components/schemas/AuthSession' } } } ] } } }
 *       401: { description: Invalid credentials, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Email not verified, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.post('/login', validate(schemas.login), controller.login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Exchange a refresh token for a new access/refresh token pair
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties: { refreshToken: { type: string } }
 *     responses:
 *       200: { description: New session issued }
 *       401: { description: Invalid or revoked refresh token }
 */
router.post('/refresh', validate(schemas.refresh), controller.refresh);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke a refresh token
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { refreshToken: { type: string } }
 *     responses:
 *       200: { description: Logged out }
 */
router.post('/logout', controller.logout);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password reset OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties: { email: { type: string, format: email } }
 *     responses:
 *       200: { description: Sent if the account exists }
 */
router.post('/forgot-password', otpLimiter, validate(schemas.forgotPassword), controller.forgotPassword);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password using a valid OTP code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code, newPassword]
 *             properties:
 *               email: { type: string, format: email }
 *               code: { type: string }
 *               newPassword: { type: string, format: password, minLength: 8 }
 *     responses:
 *       200: { description: Password reset }
 *       400: { description: Invalid or expired code }
 */
router.post('/reset-password', validate(schemas.resetPassword), controller.resetPassword);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the current authenticated user's profile
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Current user
 *         content: { application/json: { schema: { allOf: [ { $ref: '#/components/schemas/ApiSuccess' }, { type: object, properties: { data: { $ref: '#/components/schemas/User' } } } ] } } }
 *       401: { description: Missing or invalid token }
 */
router.get('/me', requireAuth, controller.me);

module.exports = router;
