require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    // Don't crash local dev on missing optional vars; log a warning instead.
    console.warn(`[env] Missing environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 4000}`,
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'makedown',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  },

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev_access_secret'),
    adminSecret: required('JWT_ADMIN_SECRET', 'dev_admin_secret'),
    adminExpiresIn: process.env.JWT_ADMIN_EXPIRES_IN || '12h',
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev_refresh_secret'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    refreshExpiresInRemember: process.env.JWT_REFRESH_EXPIRES_IN_REMEMBER || '90d',
  },

  otp: {
    length: Number(process.env.OTP_LENGTH) || 4,
    expiresMinutes: Number(process.env.OTP_EXPIRES_MINUTES) || 10,
  },

  mail: {
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT) || 587,
    secure: process.env.MAIL_SECURE === 'true',
    user: process.env.MAIL_USER,
    password: process.env.MAIL_PASSWORD,
    from: process.env.MAIL_FROM || 'Make Down <no-reply@makedown.online>',
  },

  // Where to send the browser back to after a hosted MyFatoorah payment page
  // (the payment callback redirects here with a ?status=success|failed).
  frontendUrl: process.env.FRONTEND_URL || 'https://www.makedown.online',

  // The Flutter app's registered custom URL scheme (its AndroidManifest.xml
  // intent-filter / iOS Info.plist CFBundleURLSchemes) — set this to match
  // whatever the app actually registers, there is no safe default that
  // works out of the box. Used only when a checkout explicitly asks for a
  // mobile deep-link callback (see orders.controller.js#checkout's
  // `platform` field) instead of the website redirect.
  mobileAppScheme: process.env.MOBILE_APP_SCHEME || null,

  // How long a knet/credit_card/apple_pay/google_pay order is allowed to sit
  // as status=pending/payment_status=unpaid before it's eligible to be
  // reused by a checkout retry (see orders.controller.js#checkout) or
  // auto-cancelled by the background sweep (src/jobs/expireStaleOrders.js).
  // Cash orders are unaffected - they never stay pending.
  pendingOrderExpiryMinutes: Number(process.env.PENDING_ORDER_EXPIRY_MINUTES) || 30,

  myfatoorah: {
    apiKey: process.env.MYFATOORAH_API_KEY,
    // apitest.myfatoorah.com for a test-mode API key, api.myfatoorah.com for live.
    baseUrl: process.env.MYFATOORAH_BASE_URL || 'https://api.myfatoorah.com',
    country: process.env.MYFATOORAH_COUNTRY || 'KWT',
  },
};
