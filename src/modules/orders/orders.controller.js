const repo = require('./orders.repository');
const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');
const productsRepo = require('../products/products.repository');

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

// Public — the website's checkout flow submits here. Always recomputes
// prices from the database; never trusts a price the client sends.
const checkout = asyncHandler(async (req, res) => {
  const { items, shippingAddress, paymentMethod, discountCode, guestName, guestEmail, guestPhone } = req.body;

  if (!req.user && (!guestEmail || !guestName)) {
    throw ApiError.badRequest('Guest checkout requires guestName and guestEmail');
  }

  let subtotal = 0;
  const lineItems = [];
  for (const raw of items) {
    const product = await productsRepo.findById(raw.productId);
    if (!product || !product.is_active) {
      throw ApiError.badRequest(`Product ${raw.productId} is no longer available`);
    }
    let unitPrice = Number(product.base_price);
    if (raw.variantId) {
      const variant = await productsRepo.findVariantById(raw.variantId);
      if (!variant || variant.product_id !== product.id || !variant.is_active) {
        throw ApiError.badRequest(`Selected option for "${product.name_en}" is no longer available`);
      }
      unitPrice = Number(variant.price);
    }
    const quantity = raw.quantity || 1;
    const lineTotal = Math.round(unitPrice * quantity * 1000) / 1000;
    subtotal += lineTotal;
    lineItems.push({
      product_id: product.id,
      variant_id: raw.variantId || null,
      product_name_snapshot: product.name_en,
      quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
    });
  }
  subtotal = Math.round(subtotal * 1000) / 1000;

  // No discount-code catalogue or payment gateway is wired up yet — the
  // order is recorded as placed and pending, ready for an admin (or a real
  // gateway webhook, once one exists) to mark it paid.
  const shippingTotal = 0;
  const discountTotal = 0;
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
    shipping_address_json: JSON.stringify(shippingAddress),
    notes: discountCode ? `Discount code entered: ${discountCode}` : null,
  };

  const order = await repo.create(orderData);
  const createdItems = await repo.createItems(order.id, lineItems);
  ok(res, { ...order, items: createdItems }, 'Order placed', 201);
});

module.exports = { list, getOne, updateStatus, checkout };
