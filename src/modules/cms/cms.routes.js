const router = require('express').Router();
const controller = require('./cms.controller');
const requireAdminAuth = require('../../middlewares/adminAuth.middleware');

/**
 * @swagger
 * tags:
 *   - name: CMS
 *     description: About us / privacy / terms / return policy / FAQ / social media / how it works
 * /admin/cms/pages:
 *   get:
 *     tags: [CMS]
 *     summary: List CMS pages (about-us, privacy-policy, terms-and-conditions, return-policy, how-it-works)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: List of pages } }
 * /admin/cms/pages/{slug}:
 *   patch:
 *     tags: [CMS]
 *     summary: Update a CMS page's content
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: slug, required: true, schema: { type: string } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object, properties: { title: { type: string }, contentHtml: { type: string } } }
 *     responses: { 200: { description: Updated } }
 * /admin/cms/faqs:
 *   get:
 *     tags: [CMS]
 *     summary: List FAQs
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: List } }
 *   post:
 *     tags: [CMS]
 *     summary: Create a FAQ
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Created } }
 * /admin/cms/faqs/{id}:
 *   patch:
 *     tags: [CMS]
 *     summary: Update a FAQ
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Updated } }
 *   delete:
 *     tags: [CMS]
 *     summary: Delete a FAQ
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Deleted } }
 * /admin/cms/social-links:
 *   get:
 *     tags: [CMS]
 *     summary: List social media links
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: List } }
 *   post:
 *     tags: [CMS]
 *     summary: Create a social link
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Created } }
 * /admin/cms/social-links/{id}:
 *   patch:
 *     tags: [CMS]
 *     summary: Update a social link
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Updated } }
 *   delete:
 *     tags: [CMS]
 *     summary: Delete a social link
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Deleted } }
 */
router.use(requireAdminAuth);
router.get('/pages', controller.listPages);
router.patch('/pages/:slug', controller.updatePage);
router.get('/faqs', controller.listFaqs);
router.post('/faqs', controller.createFaq);
router.patch('/faqs/:id', controller.updateFaq);
router.delete('/faqs/:id', controller.deleteFaq);
router.get('/social-links', controller.listSocialLinks);
router.post('/social-links', controller.createSocialLink);
router.patch('/social-links/:id', controller.updateSocialLink);
router.delete('/social-links/:id', controller.deleteSocialLink);

module.exports = router;
