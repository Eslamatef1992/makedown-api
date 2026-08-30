const env = require('../config/env');
const ApiError = require('../utils/ApiError');

// Thin wrapper around MyFatoorah's v2 REST API (hosted payment page flow).
// Docs: https://myfatoorah.readme.io/docs/initiate-session-api
//
// Flow used by the packages purchase endpoint:
//  1. initiatePayment(amount)     -> list of available PaymentMethodId's (KNET, Visa/Master, ...)
//  2. executePayment(...)         -> InvoiceURL to redirect the browser to
//  3. (MyFatoorah redirects back to our callback with paymentId)
//  4. getPaymentStatus(paymentId) -> confirms InvoiceStatus === 'Paid' before we mark anything paid
//
// No API key configured yet? Every call throws a clear 503 rather than silently
// pretending to succeed — there is no such thing as a fake "real" payment.
function assertConfigured() {
  if (!env.myfatoorah.apiKey) {
    throw new ApiError(503, 'Online payments are not configured yet (missing MYFATOORAH_API_KEY).');
  }
}

async function callMyFatoorah(path, body) {
  const res = await fetch(`${env.myfatoorah.baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.myfatoorah.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.IsSuccess === false) {
    const message = json?.Message || json?.ValidationErrors?.[0]?.Error || `MyFatoorah request to ${path} failed`;
    throw new ApiError(502, message);
  }
  return json.Data;
}

// Returns the list of payment methods available for this amount, each with
// the PaymentMethodId MyFatoorah expects back in executePayment().
async function initiatePayment(amount, currencyIso = 'KWD') {
  assertConfigured();
  const data = await callMyFatoorah('/v2/InitiatePayment', {
    InvoiceAmount: amount,
    CurrencyIso: currencyIso,
  });
  return data?.PaymentMethods || [];
}

// Kicks off a payment for one specific method and returns the hosted page
// URL to redirect the customer's browser to.
async function executePayment({ paymentMethodId, invoiceValue, customerName, customerEmail, customerMobile, callbackUrl, errorUrl }) {
  assertConfigured();
  const data = await callMyFatoorah('/v2/ExecutePayment', {
    PaymentMethodId: paymentMethodId,
    InvoiceValue: invoiceValue,
    CustomerName: customerName,
    CustomerEmail: customerEmail || undefined,
    CustomerMobile: customerMobile || undefined,
    CallBackUrl: callbackUrl,
    ErrorUrl: errorUrl,
    DisplayCurrencyIso: 'KWD',
  });
  return { paymentUrl: data?.PaymentURL, invoiceId: data?.InvoiceId };
}

// Server-side confirmation of a payment's real status — never trust the
// query string MyFatoorah redirects the browser back with on its own.
async function getPaymentStatus(key, keyType = 'PaymentId') {
  assertConfigured();
  const data = await callMyFatoorah('/v2/GetPaymentStatus', { Key: key, KeyType: keyType });
  return {
    invoiceId: data?.InvoiceId,
    invoiceStatus: data?.InvoiceStatus, // 'Paid' | 'Pending' | 'Expired' | ...
    invoiceReference: data?.InvoiceReference,
    paidAmount: data?.InvoiceTransactions?.[0]?.PaidCurrencyValue,
    raw: data,
  };
}

// Helper to find the KNET / card payment methods among initiatePayment()'s
// list without hardcoding IDs that differ per merchant account.
function findMethodId(methods, matcher) {
  const found = methods.find((m) => matcher.test(m.PaymentMethodEn || ''));
  return found?.PaymentMethodId || null;
}

module.exports = { initiatePayment, executePayment, getPaymentStatus, findMethodId };
