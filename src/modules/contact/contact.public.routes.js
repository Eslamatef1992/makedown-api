const router = require('express').Router();
const Joi = require('joi');
const controller = require('./contact.controller');
const validate = require('../../middlewares/validate.middleware');

const schema = Joi.object({
  name: Joi.string().min(2).max(150).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().max(30).allow('', null),
  subject: Joi.string().max(200).allow('', null),
  message: Joi.string().min(5).required(),
});

/**
 * @swagger
 * /contact-us:
 *   post:
 *     tags: [Get In Touch]
 *     summary: Submit the contact form (public)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, message]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               phone: { type: string }
 *               subject: { type: string }
 *               message: { type: string }
 *     responses: { 201: { description: Message sent } }
 */
router.post('/', validate(schema), controller.submit);

module.exports = router;
