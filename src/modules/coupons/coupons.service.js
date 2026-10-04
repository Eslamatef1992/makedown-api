const ApiError = require('../../utils/ApiError');
const repo = require('./coupons.repository');

// Shared by the public "Apply" preview (coupons.controller#validate) and the
// real checkout (orders.controller#checkout) — same rules both places, so a
// code that previews as valid always actually applies at checkout too.
// `details.code` is a stable machine-readable reason (COUPON_*) alongside
// the human-readable `message` — the exact same ApiError(message, details)
// shape every other 400 in this API already uses, so the app can branch on
// `error.details.code` instead of matching English message text, without
// this looking like a different error format than anywhere else.
async function validateCoupon(code, subtotal) {
  if (!code) return null;
  const coupon = await repo.findByCode(code);
  if (!coupon || !coupon.is_active) {
    throw ApiError.badRequest('This coupon code is not valid.', { code: 'COUPON_INVALID' });
  }
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    throw ApiError.badRequest('This coupon has expired.', { code: 'COUPON_EXPIRED' });
  }
  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
    throw ApiError.badRequest('This coupon has already been fully redeemed.', { code: 'COUPON_EXHAUSTED' });
  }
  if (coupon.min_subtotal !== null && Number(subtotal) < Number(coupon.min_subtotal)) {
    throw ApiError.badRequest(`This coupon requires a minimum order of ${Number(coupon.min_subtotal).toFixed(3)}.`, {
      code: 'COUPON_MIN_SUBTOTAL_NOT_MET',
      minSubtotal: Number(coupon.min_subtotal),
    });
  }
  const rawDiscount = coupon.type === 'percentage' ? (Number(subtotal) * Number(coupon.value)) / 100 : Number(coupon.value);
  const discountTotal = Math.min(Math.round(rawDiscount * 1000) / 1000, Number(subtotal));
  return { coupon, discountTotal };
}

module.exports = { validateCoupon };
