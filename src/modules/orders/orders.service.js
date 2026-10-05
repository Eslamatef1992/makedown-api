const repo = require('./orders.repository');
const couponsRepo = require('../coupons/coupons.repository');
const ApiError = require('../../utils/ApiError');

// Cancels a pending order and releases any coupon use it had reserved.
// Coupon used_count is incremented at order-creation time, before payment is
// confirmed (see orders.controller.js#checkout) - so every pending order
// that's cancelled or expires without ever actually being paid for must
// give its slot back here, or a limited-use code silently exhausts itself
// on attempts that never paid. Caller must already know the order is
// 'pending' (findReusablePending/findStalePending both filter on that).
async function cancelPendingOrder(order) {
  if (order.coupon_id) await couponsRepo.decrementUsage(order.coupon_id);
  return repo.markCancelled(order.id);
}

// Used by the two user-facing cancel endpoints (PATCH /me/orders/:id and
// POST /orders/track/:orderNumber/cancel), where the order's current status
// isn't already known to be 'pending' - only a pending order can be
// cancelled this way (not one that's paid/processing/shipped/delivered/
// refunded, or already cancelled).
async function cancelOwnedOrder(order) {
  if (order.status !== 'pending') {
    throw ApiError.conflict('Order cannot be cancelled in its current state', { code: 'ORDER_NOT_CANCELLABLE' });
  }
  return cancelPendingOrder(order);
}

module.exports = { cancelPendingOrder, cancelOwnedOrder };
