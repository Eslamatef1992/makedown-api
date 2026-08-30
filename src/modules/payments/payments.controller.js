const asyncHandler = require('../../utils/asyncHandler');
const env = require('../../config/env');
const ordersRepo = require('../orders/orders.repository');
const packagesRepo = require('../packages/packages.repository');
const myfatoorah = require('../../services/myfatoorah.service');

// MyFatoorah redirects the customer's browser here after they finish (or
// abandon/fail) a hosted payment page — for both CallBackUrl and ErrorUrl,
// since we pass the same URL for both. The querystring is never trusted on
// its own: GetPaymentStatus is the real source of truth for whether money
// actually moved.
const myFatoorahCallback = asyncHandler(async (req, res) => {
  const { orderId, packageId, paymentId, Id } = req.query;
  const key = paymentId || Id; // MyFatoorah's redirect param name has varied across API versions

  const fail = (reason) => res.redirect(`${env.frontendUrl}/profile/payment-result?status=failed&reason=${encodeURIComponent(reason)}`);
  const succeed = () => res.redirect(`${env.frontendUrl}/profile/payment-result?status=success&orderId=${orderId}`);

  if (!orderId || !key) return fail('missing_reference');

  const order = await ordersRepo.findById(orderId);
  if (!order) return fail('order_not_found');

  // Already processed (customer hit back/refresh on the result page) — don't
  // double-grant credits or re-charge anything, just repeat the outcome.
  if (order.payment_status === 'paid') return succeed();

  let status;
  try {
    status = await myfatoorah.getPaymentStatus(key);
  } catch {
    return fail('status_check_failed');
  }

  if (status.invoiceStatus !== 'Paid') {
    await ordersRepo.updateStatus(order.id, { payment_status: 'failed', status: 'cancelled' });
    return fail('not_paid');
  }

  await ordersRepo.updateStatus(order.id, { payment_status: 'paid', status: 'paid', payment_reference: String(key) });

  if (packageId) {
    const alreadyGranted = await packagesRepo.findUserPackageByOrderId(order.id);
    if (!alreadyGranted) {
      const pkg = await packagesRepo.findById(packageId);
      if (pkg) {
        await packagesRepo.createUserPackage({
          userId: order.user_id,
          packageId: pkg.id,
          orderId: order.id,
          credits: pkg.credits,
          validityDays: pkg.validity_days,
        });
      }
    }
  }

  succeed();
});

module.exports = { myFatoorahCallback };
