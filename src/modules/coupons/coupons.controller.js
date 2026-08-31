const repo = require('./coupons.repository');
const { validateCoupon } = require('./coupons.service');
const { makeCrudController } = require('../../utils/crudController');
const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');

function transformInput(body, { isUpdate } = {}) {
  const data = {};
  if (body.code !== undefined) data.code = String(body.code).trim().toUpperCase();
  if (body.type !== undefined) {
    if (!['percentage', 'fixed'].includes(body.type)) throw ApiError.badRequest('type must be percentage or fixed');
    data.type = body.type;
  }
  if (body.value !== undefined) data.value = body.value;
  if (body.minSubtotal !== undefined) data.min_subtotal = body.minSubtotal === '' ? null : body.minSubtotal;
  if (body.maxUses !== undefined) data.max_uses = body.maxUses === '' ? null : body.maxUses;
  if (body.expiresAt !== undefined) data.expires_at = body.expiresAt || null;
  if (body.isActive !== undefined) data.is_active = body.isActive ? 1 : 0;
  if (!isUpdate) {
    if (!data.code) throw ApiError.badRequest('code is required');
    if (!data.type) data.type = 'percentage';
    if (data.value === undefined) throw ApiError.badRequest('value is required');
  }
  return data;
}

const crud = makeCrudController(repo, { transformInput, notFoundMessage: 'Coupon not found' });

// Public — the website's cart/checkout "Apply" button. Previews the
// discount without spending a use (used_count only increments once an
// order is actually placed with this code, in orders.controller#checkout).
const validate = asyncHandler(async (req, res) => {
  const code = req.params.code || req.body.code;
  const subtotal = Number(req.query.subtotal ?? req.body.subtotal ?? 0);
  const result = await validateCoupon(code, subtotal);
  if (!result) throw ApiError.badRequest('Enter a coupon code');
  ok(res, {
    code: result.coupon.code,
    type: result.coupon.type,
    value: Number(result.coupon.value),
    discountTotal: result.discountTotal,
  });
});

module.exports = { ...crud, validate };
