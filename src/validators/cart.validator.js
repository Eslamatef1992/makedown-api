const Joi = require('joi');

const addItem = Joi.object({
  productId: Joi.number().integer().positive().required(),
  variantId: Joi.number().integer().positive().allow(null),
  quantity: Joi.number().integer().min(1).max(999).default(1),
  // Client just says "I want a gift box" — the price is always looked up
  // server-side from the product (see cart.controller.js#resolveLine),
  // never trusted from here. Same field name and semantics as
  // checkout.validator.js's `giftBox` on POST /orders, so the app can
  // reuse one concept end-to-end.
  giftBox: Joi.boolean().default(false),
});

const updateItem = Joi.object({
  quantity: Joi.number().integer().min(1).max(999).required(),
});

const merge = Joi.object({
  guestToken: Joi.string().guid().required(),
});

module.exports = { addItem, updateItem, merge };
