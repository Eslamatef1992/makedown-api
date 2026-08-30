const Joi = require('joi');
const env = require('../config/env');

const register = Joi.object({
  firstName: Joi.string().min(1).max(100).required(),
  lastName: Joi.string().min(1).max(100).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().min(6).max(30).required(),
  birthDate: Joi.date().iso().max('now').required(),
  password: Joi.string().min(8).max(100).required(),
  acceptTerms: Joi.boolean().valid(true).required(),
});

const verifyOtp = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().length(env.otp.length).required(),
  purpose: Joi.string().valid('register', 'login', 'reset_password', 'change_email').default('register'),
});

const resendOtp = Joi.object({
  email: Joi.string().email().required(),
  purpose: Joi.string().valid('register', 'login', 'reset_password', 'change_email').default('register'),
});

const login = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  rememberMe: Joi.boolean().default(false),
});

const refresh = Joi.object({
  refreshToken: Joi.string().required(),
});

const forgotPassword = Joi.object({
  email: Joi.string().email().required(),
});

const resetPassword = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().length(env.otp.length).required(),
  newPassword: Joi.string().min(8).max(100).required(),
});

module.exports = { register, verifyOtp, resendOtp, login, refresh, forgotPassword, resetPassword };
