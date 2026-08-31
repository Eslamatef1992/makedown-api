const ApiError = require('../../utils/ApiError');
const repo = require('./coupons.repository');

// Shared by the public "Apply" preview (coupons.controller#validate) and the
// real checkout (orders.controller#checkout) — same rules both places, so a
// code that previews as valid always actually applies at checkout too.
async function validateCoupon(code, subtotal) {
  if (!code) return null;
  const coupon = await repo.findByCode(code);
  if (!coupon || !coupon.is_active) {
    throw ApiError.badRequest('This coupon code is not valid.');
  }
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    throw ApiError.badRequest('This coupon has expired.');
  }
  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
    throw ApiError.badRequest('This coupon has already been fully redeemed.');
  }
  if (coupon.min_subtotal !== null && Number(subtotal) < Number(coupon.min_subtotal)) {
    throw ApiError.badRequest(`This coupon requires a minimum order of ${Number(coupon.min_subtotal).toFixed(3)}.`);
  }
  const rawDiscount = coupon.type === 'percentage' ? (Number(subtotal) * Number(coupon.value)) / 100 : Number(coupon.value);
  const discountTotal = Math.min(Math.round(rawDiscount * 1000) / 1000, Number(subtotal));
  return { coupon, discountTotal };
}

module.exports = { validateCoupon };
