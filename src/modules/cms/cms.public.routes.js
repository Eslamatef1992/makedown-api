const router = require('express').Router();
const controller = require('./cms.controller');
const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');
const repo = require('./cms.repository');

/**
 * @swagger
 * /cms/pages/{slug}:
 *   get:
 *     tags: [CMS]
 *     summary: Get a CMS page's content (public — About us, Privacy policy, Terms, Return policy, How it works)
 *     parameters: [{ in: path, name: slug, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Page content }
 *       404: { description: Not found }
 * /faqs:
 *   get:
 *     tags: [CMS]
 *     summary: List active FAQs (public)
 *     responses: { 200: { description: List } }
 * /social-links:
 *   get:
 *     tags: [CMS]
 *     summary: List active social links (public)
 *     responses: { 200: { description: List } }
 */
// Mounted at app root — these three paths are intentionally not nested
// under a single prefix so they match the public URLs above.
router.get('/cms/pages/:slug', asyncHandler(async (req, res) => {
  const page = await repo.findPageBySlug(req.params.slug);
  if (!page) throw ApiError.notFound('Page not found');
  ok(res, page);
}));
router.get('/faqs', controller.publicListFaqs);
router.get('/social-links', controller.publicListSocialLinks);

module.exports = router;
