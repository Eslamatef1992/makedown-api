const nodemailer = require('nodemailer');
const env = require('./env');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.secure,
      auth: env.mail.user ? { user: env.mail.user, pass: env.mail.password } : undefined,
    });
  }
  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  if (!env.mail.host) {
    // No SMTP configured (e.g. local dev) — log instead of throwing so the
    // request flow (register/forgot-password) still completes.
    console.log(`[mailer] SMTP not configured. Would send to ${to}: ${subject}`);
    console.log(text || html);
    return;
  }
  await getTransporter().sendMail({ from: env.mail.from, to, subject, html, text });
}

function otpEmailTemplate({ name, code, purpose }) {
  const purposeCopy = {
    register: 'Verify your email to finish creating your Make Down account.',
    login: 'Use this code to sign in to Make Down.',
    reset_password: 'Use this code to reset your Make Down password.',
    change_email: 'Use this code to confirm your new email address.',
  };
  const subject = 'Your Make Down verification code';
  const text = `Hi ${name || ''},\n\n${purposeCopy[purpose] || ''}\n\nYour code: ${code}\n\nThis code expires shortly. If you didn't request this, you can ignore this email.\n\n— Make Down`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="color:#DE317C;">Make Down</h2>
      <p>Hi ${name || ''},</p>
      <p>${purposeCopy[purpose] || ''}</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#DE317C;">${code}</p>
      <p style="color:#666;font-size:13px;">This code expires shortly. If you didn't request this, you can ignore this email.</p>
    </div>`;
  return { subject, text, html };
}

// Order confirmation — sent once, either right after checkout (cash) or
// once MyFatoorah confirms the payment actually went through (knet/credit
// card) — see orders.controller.js and payments.controller.js. Bilingual in
// a single email (English then Arabic) so a Kuwait-based customer gets both
// without us guessing which language they prefer.
function orderConfirmationEmailTemplate({ order, items, address }) {
  const fmt = (n) => Number(n || 0).toFixed(3);
  const paymentStatusEn = order.payment_status === 'paid' ? 'Paid' : 'Pending';
  const paymentStatusAr = order.payment_status === 'paid' ? 'مدفوع' : 'قيد الانتظار';
  const methodLabels = {
    knet: ['KNET', 'كي نت'],
    credit_card: ['Credit Card', 'بطاقة ائتمان'],
    cash: ['Cash On Delivery', 'الدفع عند الاستلام'],
  };
  const [methodEn, methodAr] = methodLabels[order.payment_method] || [order.payment_method || '-', order.payment_method || '-'];
  const addressLine = address
    ? [address.governorate, address.area, address.block && `Block ${address.block}`, address.street]
        .filter(Boolean)
        .join(', ')
    : '';

  const itemsRowsEn = (items || [])
    .map(
      (it) =>
        `<tr><td style="padding:6px 0;">${it.product_name_snapshot}</td><td style="padding:6px 0;text-align:center;">${it.quantity}</td><td style="padding:6px 0;text-align:right;">${fmt(it.line_total)} ${order.currency}</td></tr>`
    )
    .join('');

  const subject = `Make Down — Order Confirmation #${order.order_number} | تأكيد الطلب`;

  const text = [
    `Hi,`,
    `Your order #${order.order_number} has been placed.`,
    `Payment status: ${paymentStatusEn}`,
    `Payment method: ${methodEn}`,
    address ? `Delivery address: ${addressLine}` : '',
    `Subtotal: ${fmt(order.subtotal)} ${order.currency}`,
    `Discount: ${fmt(order.discount_total)} ${order.currency}`,
    `Delivery fees: ${fmt(order.shipping_total)} ${order.currency}`,
    `Total: ${fmt(order.grand_total)} ${order.currency}`,
    ``,
    `— Make Down`,
    ``,
    `مرحبًا،`,
    `تم استلام طلبك رقم #${order.order_number}.`,
    `حالة الدفع: ${paymentStatusAr}`,
    `طريقة الدفع: ${methodAr}`,
    `الإجمالي: ${fmt(order.grand_total)} ${order.currency}`,
    `—ميك داون`,
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#3a2a24;">
      <h2 style="color:#DE317C;">Make Down</h2>
      <h3 style="margin-bottom:4px;">Order Confirmation — #${order.order_number}</h3>
      <p style="color:#666;font-size:13px;">Your order has been placed and is being prepared.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;">
        <tr><td style="padding:4px 0;color:#666;">Payment Status</td><td style="padding:4px 0;text-align:right;font-weight:bold;color:${order.payment_status === 'paid' ? '#16A34A' : '#DE317C'};">${paymentStatusEn}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Payment Method</td><td style="padding:4px 0;text-align:right;">${methodEn}</td></tr>
        ${address ? `<tr><td style="padding:4px 0;color:#666;">Address</td><td style="padding:4px 0;text-align:right;">${addressLine}</td></tr>` : ''}
      </table>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:16px;border-top:1px solid #eee;padding-top:8px;">
        <thead><tr style="color:#999;text-align:left;"><th style="text-align:left;">Item</th><th>Qty</th><th style="text-align:right;">Total</th></tr></thead>
        <tbody>${itemsRowsEn}</tbody>
      </table>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;border-top:1px solid #eee;padding-top:8px;">
        <tr><td>Subtotal</td><td style="text-align:right;">${fmt(order.subtotal)} ${order.currency}</td></tr>
        <tr><td>Discount</td><td style="text-align:right;">${fmt(order.discount_total)} ${order.currency}</td></tr>
        <tr><td>Delivery Fees</td><td style="text-align:right;">${fmt(order.shipping_total)} ${order.currency}</td></tr>
        <tr><td style="font-weight:bold;">Total</td><td style="text-align:right;font-weight:bold;">${fmt(order.grand_total)} ${order.currency}</td></tr>
      </table>

      <hr style="margin:24px 0;border:none;border-top:1px solid #eee;" />

      <div dir="rtl" style="text-align:right;">
        <h3 style="margin-bottom:4px;">تأكيد الطلب — #${order.order_number}</h3>
        <p style="color:#666;font-size:13px;">تم استلام طلبك وجارٍ تجهيزه.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;">
          <tr><td style="padding:4px 0;color:#666;">حالة الدفع</td><td style="padding:4px 0;text-align:left;font-weight:bold;color:${order.payment_status === 'paid' ? '#16A34A' : '#DE317C'};">${paymentStatusAr}</td></tr>
          <tr><td style="padding:4px 0;color:#666;">طريقة الدفع</td><td style="padding:4px 0;text-align:left;">${methodAr}</td></tr>
        </table>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;border-top:1px solid #eee;padding-top:8px;">
          <tr><td>الإجمالي الفرعي</td><td style="text-align:left;">${fmt(order.subtotal)} ${order.currency}</td></tr>
          <tr><td>الخصم</td><td style="text-align:left;">${fmt(order.discount_total)} ${order.currency}</td></tr>
          <tr><td>رسوم التوصيل</td><td style="text-align:left;">${fmt(order.shipping_total)} ${order.currency}</td></tr>
          <tr><td style="font-weight:bold;">الإجمالي</td><td style="text-align:left;font-weight:bold;">${fmt(order.grand_total)} ${order.currency}</td></tr>
        </table>
      </div>

      <p style="color:#999;font-size:12px;margin-top:24px;">— Make Down / ميك داون</p>
    </div>`;

  return { subject, text, html };
}

module.exports = { sendMail, otpEmailTemplate, orderConfirmationEmailTemplate };
