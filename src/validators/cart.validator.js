const Joi = require('joi');

const addItem = Joi.object({
  productId: Joi.number().integer().positive().required(),
  variantId: Joi.number().integer().positive().allow(null),
  quantity: Joi.number().integer().min(1).max(999).default(1),
});

const updateItem = Joi.object({
  quantity: Joi.number().integer().min(1).max(999).required(),
});

const merge = Joi.object({
  guestToken: Joi.string().guid().required(),
});

module.exports = { addItem, updateItem, merge };
