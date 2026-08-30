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
});

const checkout = Joi.object({
  items: Joi.array().items(item).min(1).required(),
  shippingAddress: address.required(),
  paymentMethod: Joi.string().valid('knet', 'credit_card', 'cash').required(),
  discountCode: Joi.string().allow('', null),
  // Required only when the request has no Authorization header — enforced
  // in the controller, since Joi can't see the auth header.
  guestName: Joi.string().min(1).max(150),
  guestEmail: Joi.string().email(),
  guestPhone: Joi.string().min(6).max(30),
});

module.exports = { checkout };
