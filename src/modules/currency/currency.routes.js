const router = require('express').Router();
const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const exchangeRateService = require('../../services/exchange-rate.service');

/**
 * @swagger
 * /currency/rates:
 *   get:
 *     tags: [Currency]
 *     summary: Current KWD-based exchange rates for the site's supported currencies (public)
 *     responses: { 200: { description: Rates } }
 */
router.get('/rates', asyncHandler(async (req, res) => {
  ok(res, await exchangeRateService.getRates());
}));

module.exports = router;
