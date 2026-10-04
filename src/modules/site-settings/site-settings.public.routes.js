const router = require('express').Router();
const controller = require('./site-settings.controller');

/**
 * @swagger
 * /site-settings/home-video:
 *   get:
 *     tags: [Site Settings]
 *     summary: Get the Home page video YouTube URL (public)
 *     responses: { 200: { description: Current URL } }
 */
router.get('/home-video', controller.publicGetHomeVideo);

/**
 * @swagger
 * /site-settings/delivery-fee:
 *   get:
 *     tags: [Site Settings]
 *     summary: Get the flat delivery fee to show on the checkout screen before placing an order (public)
 *     description: >
 *       A single admin-set flat amount, charged as-is on every order's
 *       shipping_total regardless of governorate/area/subtotal — there is
 *       no per-area calculation today. Call this before showing the
 *       checkout order summary instead of hardcoding 0.00; it's the exact
 *       same number POST /orders will actually charge.
 *     responses:
 *       200:
 *         description: Current fee
 *         content:
 *           application/json:
 *             schema: { allOf: [{ $ref: '#/components/schemas/ApiSuccess' }, { type: object, properties: { data: { type: object, properties: { fee: { type: number, example: 2 } } } } }] }
 */
router.get('/delivery-fee', controller.publicGetDeliveryFee);

/**
 * @swagger
 * /site-settings/contact-info:
 *   get:
 *     tags: [Site Settings]
 *     summary: Get the site's published contact details (public)
 *     responses:
 *       200:
 *         description: Current contact info
 *         content:
 *           application/json:
 *             schema: { allOf: [{ $ref: '#/components/schemas/ApiSuccess' }, { type: object, properties: { data: { type: object, properties: { companyEmail: { type: string, nullable: true, example: "info@makedown.online" }, supportEmail: { type: string, nullable: true, example: "support@makedown.online" }, phone: { type: string, nullable: true, example: "+96522223333" } } } } }] }
 */
router.get('/contact-info', controller.publicGetContactInfo);

/**
 * @swagger
 * /site-settings/cash-on-delivery:
 *   get:
 *     tags: [Site Settings]
 *     summary: Whether cash is currently a valid paymentMethod for orders and/or packages (public)
 *     description: >
 *       Check this to decide whether to show a Cash option at all —
 *       POST /orders and POST /packages/{id}/purchase both reject
 *       paymentMethod "cash" with a 400 when the relevant flag here is
 *       false. products defaults true (cash has always worked for orders),
 *       packages defaults false (off unless a super admin explicitly
 *       enables it).
 *     responses:
 *       200:
 *         description: Current toggle state
 *         content:
 *           application/json:
 *             schema: { allOf: [{ $ref: '#/components/schemas/ApiSuccess' }, { type: object, properties: { data: { type: object, properties: { products: { type: boolean, example: true }, packages: { type: boolean, example: false } } } } }] }
 */
router.get('/cash-on-delivery', controller.publicGetCod);

module.exports = router;
