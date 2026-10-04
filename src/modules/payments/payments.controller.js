const asyncHandler = require('../../utils/asyncHandler');
const env = require('../../config/env');
const ordersRepo = require('../orders/orders.repository');
const packagesRepo = require('../packages/packages.repository');
const myfatoorah = require('../../services/myfatoorah.service');
const { sendMail, orderConfirmationEmailTemplate } = require('../../config/mailer');

async function sendOrderConfirmationEmail(order) {
  const to = order.user_email || order.guest_email;
  if (!to) return;
  try {
    const items = await ordersRepo.listItems(order.id);
    const address = order.shipping_address_json
      ? typeof order.shipping_address_json === 'string'
        ? JSON.parse(order.shipping_address_json)
        : order.shipping_address_json
      : null;
    const { subject, text, html } = orderConfirmationEmailTemplate({ order, items, address });
    await sendMail({ to, subject, text, html });
  } catch {
    // A failed email must never fail the payment confirmation itself.
  }
}

// MyFatoorah redirects the customer's browser here after they finish (or
// abandon/fail) a hosted payment page — for both CallBackUrl and ErrorUrl,
// since we pass the same URL for both. The querystring is never trusted on
// its own: GetPaymentStatus is the real source of truth for whether money
// actually moved. A package purchase lands back on the profile's payment
// result screen; a product order (no packageId) lands on the ecommerce
// order-confirmation screen instead, matching how each was checked out.
const myFatoorahCallback = asyncHandler(async (req, res) => {
  const { orderId, packageId, paymentId, Id, platform } = req.query;
  const key = paymentId || Id; // MyFatoorah's redirect param name has varied across API versions

  // Mobile checkout opted in (orders.controller.js#checkout set
  // ?platform=mobile on the callback URL, only once MOBILE_APP_SCHEME was
  // confirmed configured) — send the browser/webview to the app's deep
  // link instead of a website page it can't meaningfully show. Package
  // purchases don't have a mobile checkout flow yet, so this only applies
  // to orders (packageId unset).
  const useDeepLink = platform === 'mobile' && !packageId && env.mobileAppScheme;
  const scheme = `${env.mobileAppScheme}://`;

  const resultBase = packageId
    ? `${env.frontendUrl}/profile/payment-result`
    : useDeepLink
      ? `${scheme}order-placed`
      : `${env.frontendUrl}/order-placed`;
  const failBase = packageId
    ? `${env.frontendUrl}/profile/payment-result`
    : useDeepLink
      ? `${scheme}order-failed`
      : `${env.frontendUrl}/order-failed`;
  const fail = (reason) => res.redirect(`${failBase}?status=failed&reason=${encodeURIComponent(reason)}`);
  const succeed = (order) =>
    res.redirect(`${resultBase}?status=success&orderId=${orderId}${order ? `&orderNumber=${order.order_number}` : ''}`);

  if (!orderId || !key) return fail('missing_reference');

  const order = await ordersRepo.findById(orderId);
  if (!order) return fail('order_not_found');

  // Already processed (customer hit back/refresh on the result page) — don't
  // double-grant credits, re-send the email, or re-charge anything, just
  // repeat the outcome.
  if (order.payment_status === 'paid') return succeed(order);

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

  const paidOrder = await ordersRepo.updateStatus(order.id, {
    payment_status: 'paid',
    status: 'paid',
    payment_reference: String(key),
  });

  if (packageId) {
    const alreadyGranted = await packagesRepo.findUserPackageByOrderId(order.id);
    if (!alreadyGranted) {
      const pkg = await packagesRepo.findById(packageId);
      if (pkg) {
        // grantPackage — expires any other active package for this user
        // first (see packages.repository.js), same rule the cash purchase
        // branch in packages.controller.js follows.
        await packagesRepo.grantPackage({
          userId: order.user_id,
          packageId: pkg.id,
          orderId: order.id,
          credits: Number(pkg.credits || 0) + Number(pkg.free_credits || 0),
        });
      }
    }
  } else {
    await sendOrderConfirmationEmail(paidOrder);
  }

  succeed(paidOrder);
});

module.exports = { myFatoorahCallback };
