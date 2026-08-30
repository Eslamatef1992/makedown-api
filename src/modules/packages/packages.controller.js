const repo = require('./packages.repository');
const ordersRepo = require('../orders/orders.repository');
const usersRepo = require('../users/users.repository');
const myfatoorah = require('../../services/myfatoorah.service');
const env = require('../../config/env');
const { makeCrudController } = require('../../utils/crudController');
const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');
const { mapBilingualField, requireBilingual } = require('../../utils/bilingual');

function transformInput(body, { isUpdate } = {}) {
  const data = {};
  mapBilingualField(body, data, 'name', 'name');
  mapBilingualField(body, data, 'description', 'description');
  if (body.price !== undefined) data.price = body.price;
  if (body.currency !== undefined) data.currency = body.currency;
  if (body.credits !== undefined) data.credits = body.credits;
  if (body.validityDays !== undefined) data.validity_days = body.validityDays;
  if (body.sortOrder !== undefined) data.sort_order = body.sortOrder;
  if (body.isActive !== undefined) data.is_active = body.isActive ? 1 : 0;
  requireBilingual(data, ['name'], isUpdate);
  return data;
}

const crud = makeCrudController(repo, { transformInput, notFoundMessage: 'Package not found' });

const publicList = asyncHandler(async (req, res) => {
  ok(res, await repo.listActive());
});

// Buy a package — cash is recorded the same honest way product checkout
// works (order placed, credits granted, nothing pretends a payment gateway
// ran). KNET / Credit Card redirect to a real MyFatoorah hosted payment
// page; credits are only granted once payments/myfatoorah/callback confirms
// the payment actually went through.
const purchase = asyncHandler(async (req, res) => {
  const pkg = await repo.findById(req.params.id);
  if (!pkg || !pkg.is_active) throw ApiError.notFound('Package not found');

  const { paymentMethod } = req.body;
  if (!['knet', 'credit_card', 'cash'].includes(paymentMethod)) {
    throw ApiError.badRequest('paymentMethod must be one of: knet, credit_card, cash');
  }

  const order = await ordersRepo.create({
    order_number: ordersRepo.generateOrderNumber(),
    user_id: req.user.id,
    status: 'pending',
    payment_status: 'unpaid',
    payment_method: paymentMethod,
    subtotal: pkg.price,
    discount_total: 0,
    shipping_total: 0,
    grand_total: pkg.price,
    currency: pkg.currency,
    notes: `Package purchase: ${pkg.name_en}`,
  });
  await ordersRepo.createItems(order.id, [
    {
      product_id: null,
      variant_id: null,
      product_name_snapshot: pkg.name_en,
      quantity: 1,
      unit_price: pkg.price,
      line_total: pkg.price,
    },
  ]);

  if (paymentMethod === 'cash') {
    await ordersRepo.updateStatus(order.id, { status: 'processing', payment_status: 'unpaid' });
    const userPackage = await repo.createUserPackage({
      userId: req.user.id,
      packageId: pkg.id,
      orderId: order.id,
      credits: pkg.credits,
      validityDays: pkg.validity_days,
    });
    return created(res, { order, userPackage, redirectUrl: null }, 'Package order placed — pay in cash to confirm');
  }

  const methods = await myfatoorah.initiatePayment(pkg.price, pkg.currency);
  const matcher = paymentMethod === 'knet' ? /knet/i : /visa|master|card/i;
  const paymentMethodId = myfatoorah.findMethodId(methods, matcher);
  if (!paymentMethodId) {
    throw ApiError.badRequest(`${paymentMethod === 'knet' ? 'KNET' : 'Credit card'} payment is not available right now`);
  }

  const customer = await usersRepo.findById(req.user.id);
  const callbackUrl = `${env.apiBaseUrl}/api/v1/payments/myfatoorah/callback?orderId=${order.id}&packageId=${pkg.id}`;
  const { paymentUrl } = await myfatoorah.executePayment({
    paymentMethodId,
    invoiceValue: pkg.price,
    customerName: customer?.full_name || req.user.email,
    customerEmail: req.user.email,
    customerMobile: customer?.phone || undefined,
    callbackUrl,
    errorUrl: callbackUrl,
  });

  created(res, { order, redirectUrl: paymentUrl }, 'Redirecting to payment');
});

module.exports = { ...crud, publicList, purchase };
