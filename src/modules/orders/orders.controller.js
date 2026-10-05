const repo = require('./orders.repository');
const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');
const productsRepo = require('../products/products.repository');
const usersRepo = require('../users/users.repository');
const couponsRepo = require('../coupons/coupons.repository');
const { validateCoupon } = require('../coupons/coupons.service');
const siteSettingsRepo = require('../site-settings/site-settings.repository');
const { sendMail, orderConfirmationEmailTemplate } = require('../../config/mailer');
const myfatoorah = require('../../services/myfatoorah.service');
const env = require('../../config/env');
const { cancelOwnedOrder, cancelPendingOrder: cancelPendingOrderRelease } = require('./orders.service');

const DELIVERY_FEE_KEY = 'order_delivery_fee'; // must match site-settings.controller.js
const COD_PRODUCTS_KEY = 'cod_enabled_products'; // must match site-settings.controller.js

const list = asyncHandler(async (req, res) => {
  const { page, pageSize, status, payment_status, guest } = req.query;
  const result = await repo.list({ page, pageSize, filters: { status, payment_status, guest } });
  ok(res, result);
});

const getOne = asyncHandler(async (req, res) => {
  const order = await repo.findById(req.params.id);
  if (!order) throw ApiError.notFound('Order not found');
  const items = await repo.listItems(req.params.id);
  ok(res, { ...order, items });
});

const updateStatus = asyncHandler(async (req, res) => {
  const existing = await repo.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Order not found');
  const data = {};
  if (req.body.status !== undefined) data.status = req.body.status;
  if (req.body.paymentStatus !== undefined) data.payment_status = req.body.paymentStatus;
  const order = await repo.updateStatus(req.params.id, data);
  ok(res, order, 'Updated');
});

// Public — the order-confirmation page. See orders.repository.js#findByOrderNumber
// for why the order number alone is an acceptable lookup key here.
const trackByOrderNumber = asyncHandler(async (req, res) => {
  const order = await repo.findByOrderNumber(req.params.orderNumber);
  if (!order) throw ApiError.notFound('Order not found');
  const items = await repo.listItems(order.id);
  ok(res, { ...order, items });
});

async function sendConfirmationEmail(order) {
  const to = order.user_email || order.guest_email;
  if (!to) return;
  try {
    const items = await repo.listItems(order.id);
    const address = order.shipping_address_json
      ? typeof order.shipping_address_json === 'string'
        ? JSON.parse(order.shipping_address_json)
        : order.shipping_address_json
      : null;
    const { subject, text, html } = orderConfirmationEmailTemplate({ order, items, address });
    await sendMail({ to, subject, text, html });
  } catch {
    // A failed email must never fail the order itself — it's already been
    // placed/paid for by this point. Nothing left to roll back.
  }
}

// --- Duplicate-pending-orders fix helpers (claude/duplicate-pending-orders-findings.md) ---
// Used by checkout() to decide whether a candidate pending order is "the
// same checkout attempt, retried" (safe to reuse) or something that
// actually changed (cart/address/coupon), in which case the stale pending
// order gets cancelled instead and a fresh one is created as before.
function itemsMatch(existingRows, freshItems) {
  if (existingRows.length !== freshItems.length) return false;
  const key = (r) => `${r.product_id}:${r.variant_id || 0}:${r.quantity}`;
  const a = existingRows.map(key).sort();
  const b = freshItems.map(key).sort();
  return a.every((v, i) => v === b[i]);
}

function addressesMatch(a, b) {
  const fields = ['governorate', 'area', 'block', 'street', 'buildingNumber', 'moreDetails'];
  return fields.every((f) => (a?.[f] ?? null) === (b?.[f] ?? null));
}

// Public — the website's checkout flow submits here. Always recomputes
// prices from the database; never trusts a price the client sends. For
// knet/credit_card this only creates the order — it isn't "placed" for
// real until MyFatoorah confirms payment in payments.controller.js, same
// honest split the packages purchase flow already uses. Cash orders are
// placed immediately and confirmed by email right away, since there's no
// gateway step to wait for.
const checkout = asyncHandler(async (req, res) => {
  const { items, shippingAddress, paymentMethod, discountCode, guestName, guestEmail, guestPhone, platform } = req.body;

  if (!req.user && (!guestEmail || !guestName)) {
    throw ApiError.badRequest('Guest checkout requires guestName and guestEmail');
  }

  if (!['knet', 'credit_card', 'apple_pay', 'google_pay', 'cash'].includes(paymentMethod)) {
    throw ApiError.badRequest('paymentMethod must be one of: knet, credit_card, apple_pay, google_pay, cash');
  }
  // A mobile deep-link callback needs MOBILE_APP_SCHEME configured (see
  // env.js) — fail the checkout up front rather than silently falling back
  // to a website URL a webview can't navigate to, which would strand the
  // customer on MyFatoorah's page with no way back into the app.
  if (platform === 'mobile' && !env.mobileAppScheme) {
    throw ApiError.badRequest('Mobile deep-link payment callback is not configured yet (missing MOBILE_APP_SCHEME)');
  }
  if (paymentMethod === 'cash') {
    const codSetting = await siteSettingsRepo.getValue(COD_PRODUCTS_KEY);
    const codEnabled = codSetting === null ? true : codSetting === '1'; // unset = on, preserves pre-toggle behavior
    if (!codEnabled) throw ApiError.badRequest('Cash on delivery is not available right now');
  }

  let subtotal = 0;
  const lineItems = [];
  for (const raw of items) {
    const product = await productsRepo.findById(raw.productId);
    if (!product || !product.is_active) {
      throw ApiError.badRequest(`Product ${raw.productId} is no longer available`);
    }
    // Same "offer price wins when it's actually a discount" rule the
    // product detail page uses to decide what to show — checkout must
    // charge the same number the customer saw, never the un-discounted
    // base_price.
    const offerPrice = Number(product.offer_price);
    let unitPrice =
      product.offer_price != null && offerPrice > 0 && offerPrice < Number(product.base_price)
        ? offerPrice
        : Number(product.base_price);
    if (raw.variantId) {
      const variant = await productsRepo.findVariantById(raw.variantId);
      if (!variant || variant.product_id !== product.id || !variant.is_active) {
        throw ApiError.badRequest(`Selected option for "${product.name_en}" is no longer available`);
      }
      if (Number(variant.stock_quantity) <= 0) {
        throw ApiError.badRequest(`"${product.name_en}" is out of stock`);
      }
      unitPrice = Number(variant.price);
    } else if (product.stock_quantity != null && Number(product.stock_quantity) <= 0) {
      // stock_quantity is only enforced when an admin actually set a
      // number — NULL means "not tracked", same as before this field
      // existed, so nothing changes for products nobody has set it on.
      throw ApiError.badRequest(`"${product.name_en}" is out of stock`);
    }
    // Gift box is a per-unit add-on — never trust a client-sent price for
    // it, only whether the product actually offers one and what its price
    // is server-side right now.
    const wantsGiftBox = Boolean(raw.giftBox) && Boolean(product.has_gift_box) && product.gift_box_price != null;
    if (wantsGiftBox) {
      unitPrice = Math.round((unitPrice + Number(product.gift_box_price)) * 1000) / 1000;
    }
    const quantity = raw.quantity || 1;
    const lineTotal = Math.round(unitPrice * quantity * 1000) / 1000;
    subtotal += lineTotal;
    lineItems.push({
      product_id: product.id,
      variant_id: raw.variantId || null,
      product_name_snapshot: wantsGiftBox ? `${product.name_en} + Gift Box` : product.name_en,
      quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
    });
  }
  subtotal = Math.round(subtotal * 1000) / 1000;

  // Real coupon, looked up and re-validated server-side — never trusts a
  // discount percentage the client computed itself.
  let discountTotal = 0;
  let coupon = null;
  if (discountCode) {
    const result = await validateCoupon(discountCode, subtotal);
    coupon = result.coupon;
    discountTotal = result.discountTotal;
  }

  const deliveryFeeSetting = await siteSettingsRepo.getValue(DELIVERY_FEE_KEY);
  const shippingTotal = deliveryFeeSetting !== null ? Number(deliveryFeeSetting) : 0;
  const grandTotal = Math.round((subtotal - discountTotal + shippingTotal) * 1000) / 1000;

  const orderData = {
    order_number: repo.generateOrderNumber(),
    user_id: req.user ? req.user.id : null,
    guest_name: req.user ? null : guestName,
    guest_email: req.user ? null : guestEmail,
    guest_phone: req.user ? null : guestPhone || null,
    status: 'pending',
    payment_status: 'unpaid',
    payment_method: paymentMethod,
    subtotal,
    discount_total: discountTotal,
    shipping_total: shippingTotal,
    grand_total: grandTotal,
    currency: 'KWD',
    coupon_id: coupon ? coupon.id : null,
    coupon_code: coupon ? coupon.code : null,
    shipping_address_json: JSON.stringify(shippingAddress),
  };

  // Duplicate-pending-orders fix: a checkout retry (same items, same
  // address, same discount code) reuses the caller's own still-pending
  // online order instead of inserting a new row — this is what was piling
  // up as repeated pending/unpaid orders on every retry after an
  // incomplete/failed payment. Only ever considered for online payment
  // methods; cash orders complete immediately so there's nothing to reuse.
  let reused = false;
  let order;
  if (paymentMethod !== 'cash') {
    const candidate = await repo.findReusablePending(
      {
        userId: req.user ? req.user.id : null,
        guestEmail: req.user ? null : guestEmail,
        guestPhone: req.user ? null : guestPhone,
      },
      env.pendingOrderExpiryMinutes
    );
    if (candidate) {
      const candidateItems = await repo.listItems(candidate.id);
      const candidateAddress = candidate.shipping_address_json
        ? typeof candidate.shipping_address_json === 'string'
          ? JSON.parse(candidate.shipping_address_json)
          : candidate.shipping_address_json
        : null;
      const sameItems = itemsMatch(candidateItems, lineItems);
      const sameAddress = addressesMatch(candidateAddress, shippingAddress);
      const sameCoupon = (candidate.coupon_code || null) === (coupon ? coupon.code : null);
      if (sameItems && sameAddress && sameCoupon) {
        // Same attempt, retried — refresh its snapshot (prices may have
        // moved since the first attempt, same as a brand-new order would
        // recompute) and get a fresh MyFatoorah payment URL. No second
        // coupon increment: this order already reserved its use the first
        // time it was created.
        await repo.deleteItems(candidate.id);
        await repo.createItems(candidate.id, lineItems);
        await repo.updateStatus(candidate.id, {
          subtotal,
          discount_total: discountTotal,
          shipping_total: shippingTotal,
          grand_total: grandTotal,
          payment_method: paymentMethod,
        });
        order = await repo.findById(candidate.id);
        reused = true;
      } else {
        // Cart/address/coupon actually changed — the old pending order is
        // stale, not "the same checkout". Cancel it (releasing its coupon
        // use) and fall through to create a fresh order as normal.
        await cancelPendingOrderRelease(candidate);
      }
    }
  }

  if (!order) {
    order = await repo.create(orderData);
    await repo.createItems(order.id, lineItems);
    if (coupon) await couponsRepo.incrementUsage(coupon.id);
  }

  if (paymentMethod === 'cash') {
    const finalOrder = await repo.updateStatus(order.id, { status: 'processing' });
    const finalItems = await repo.listItems(order.id);
    await sendConfirmationEmail(finalOrder);
    return created(res, { ...finalOrder, items: finalItems, redirectUrl: null, reused: false }, 'Order placed');
  }

  // knet / credit_card / apple_pay / google_pay — same MyFatoorah
  // hosted-page flow packages.controller.js#purchase uses; the
  // myFatoorahCallback confirms payment and sends the email once it's real.
  const methods = await myfatoorah.initiatePayment(grandTotal, 'KWD');
  const paymentMethodId = myfatoorah.findMethodId(methods, myfatoorah.PAYMENT_METHOD_MATCHERS[paymentMethod]);
  if (!paymentMethodId) {
    const label = { knet: 'KNET', credit_card: 'Credit card', apple_pay: 'Apple Pay', google_pay: 'Google Pay' }[paymentMethod];
    throw ApiError.badRequest(`${label} payment is not available right now`);
  }

  const customer = req.user ? await usersRepo.findById(req.user.id) : null;
  // `platform=mobile` is what payments.controller.js#myFatoorahCallback
  // checks to redirect to the app's deep link instead of the website —
  // validated above, so this is never sent without MOBILE_APP_SCHEME set.
  const callbackUrl = `${env.apiBaseUrl}/api/v1/payments/myfatoorah/callback?orderId=${order.id}${platform === 'mobile' ? '&platform=mobile' : ''}`;
  const { paymentUrl } = await myfatoorah.executePayment({
    paymentMethodId,
    invoiceValue: grandTotal,
    customerName: customer?.full_name || guestName || 'Guest',
    customerEmail: customer?.email || guestEmail,
    customerMobile: customer?.phone || guestPhone || undefined,
    callbackUrl,
    errorUrl: callbackUrl,
  });

  const finalItems = await repo.listItems(order.id);
  const respond = reused ? ok : created;
  respond(res, { ...order, items: finalItems, redirectUrl: paymentUrl, reused }, reused ? 'Resuming existing payment' : 'Redirecting to payment');
});

// User- or guest-initiated cancel of a still-pending order, keyed by the
// same unguessable order_number used for the public tracking lookup (see
// findByOrderNumber's comment) — no login required, same access model as
// GET /orders/track/{orderNumber}. Only legal while status is still
// 'pending' (not paid/processing/shipped/delivered/refunded/cancelled).
const cancelByOrderNumber = asyncHandler(async (req, res) => {
  const order = await repo.findByOrderNumber(req.params.orderNumber);
  if (!order) throw ApiError.notFound('Order not found');
  const updated = await cancelOwnedOrder(order);
  ok(res, updated, 'Order cancelled');
});

module.exports = { list, getOne, updateStatus, checkout, trackByOrderNumber, cancelByOrderNumber };
