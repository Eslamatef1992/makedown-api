const Joi = require('joi');

const address = Joi.object({
  governorate: Joi.string().min(1).max(100).required(),
  area: Joi.string().min(1).max(100).required(),
  block: Joi.string().min(1).max(30).required(),
  street: Joi.string().min(1).max(100).required(),
  buildingNumber: Joi.string().min(1).max(30).required(),
  moreDetails: Joi.string().allow('').max(500),
});

const item = Joi.object({
  productId: Joi.number().integer().positive().required(),
  variantId: Joi.number().integer().positive().allow(null),
  quantity: Joi.number().integer().min(1).max(999).default(1),
  // Client just says "I want a gift box" — the price is always looked up
  // server-side from the product (see orders.controller.js#checkout),
  // never trusted from here.
  giftBox: Joi.boolean(),
});

const checkout = Joi.object({
  items: Joi.array().items(item).min(1).required(),
  shippingAddress: address.required(),
  // apple_pay/google_pay accepted the same way knet/credit_card are: looked
  // up by name in MyFatoorah's live InitiatePayment response (see
  // orders.controller.js#checkout and myfatoorah.service.js#findMethodId).
  // Whether they actually show up there depends on the merchant account's
  // MyFatoorah configuration, not on anything this API controls — a method
  // not currently enabled on the account returns a clear 400, never a
  // silent failure.
  paymentMethod: Joi.string().valid('knet', 'credit_card', 'apple_pay', 'google_pay', 'cash').required(),
  discountCode: Joi.string().allow('', null),
  // Required only when the request has no Authorization header — enforced
  // in the controller, since Joi can't see the auth header.
  guestName: Joi.string().min(1).max(150),
  guestEmail: Joi.string().email(),
  guestPhone: Joi.string().min(6).max(30),
  // Opt-in to a deep-link MyFatoorah callback (see payments.controller.js)
  // instead of the default website redirect. Defaults to 'web' so nothing
  // changes for the existing website checkout.
  platform: Joi.string().valid('web', 'mobile').default('web'),
});

module.exports = { checkout };
