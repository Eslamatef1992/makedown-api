const crypto = require('crypto');

function generateOtp(length = 6) {
  const max = 10 ** length;
  const code = crypto.randomInt(0, max);
  return String(code).padStart(length, '0');
}

module.exports = { generateOtp };
