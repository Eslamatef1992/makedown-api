const router = require('express').Router();
const controller = require('./quizzes.controller');
// A school token gets its own private games (see quizzes.controller.js —
// every handler below scopes to req.school.id when present), same pattern
// as game-sessions.routes.js. Plain requireAdminAuth stays elsewhere for
// routes that must never accept a school token.
const requireAdminOrSchoolAuth = require('../../middlewares/adminOrSchoolAuth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Games
 *     description: >
 *       Quiz content — shared by two audiences on one set of endpoints, scoped
 *       by which token type calls them (see requireAdminOrSchoolAuth):
 *       an admin token sees/manages the global catalog (school_id IS NULL,
 *       admin sidebar "Games"); a school token sees/manages only that
 *       school's own private quizzes (school_id = the token's school,
 *       admin panel "My Quizzes") and can never read or write another
 *       school's quiz — a mismatched id 404s rather than 403ing, so a
 *       school can't even tell the id exists. A school-created quiz always
 *       has category_id = null (categories are an admin/global concept);
 *       any categoryId sent by a school token is ignored.
 * /admin/quizzes:
 *   get:
 *     tags: [Games]
 *     summary: List quizzes (global catalog for an admin token, own quizzes for a school token)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: List of quizzes } }
 *   post:
 *     tags: [Games]
 *     summary: Create a quiz (global for an admin token, private to the caller for a school token)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [titleEn, titleAr]
 *             properties:
 *               titleEn: { type: string }
 *               titleAr: { type: string }
 *               descriptionEn: { type: string }
 *               descriptionAr: { type: string }
 *               categoryId: { type: integer, nullable: true, description: "Admin token only — ignored (forced null) for a school token" }
 *               difficulty: { type: string, enum: [easy, medium, hard] }
 *               coverImageUrl: { type: string }
 *               howToPlayEn: { type: string }
 *               howToPlayAr: { type: string }
 *               supportedModes: { type: array, items: { type: string, enum: [solo, team] } }
 *     responses: { 201: { description: Created } }
 * /admin/quizzes/{id}:
 *   get:
 *     tags: [Games]
 *     summary: Get a quiz with its questions
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "Quiz with questions array" }
 *       404: { description: Not found, or owned by a different school than the caller's token }
 *   patch:
 *     tags: [Games]
 *     summary: Update a quiz
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found, or owned by a different school than the caller's token }
 *   delete:
 *     tags: [Games]
 *     summary: Delete a quiz (cascades its questions)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Deleted }
 *       404: { description: Not found, or owned by a different school than the caller's token }
 * /admin/quizzes/{id}/questions:
 *   post:
 *     tags: [Games]
 *     summary: Add a question to a quiz
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [questionText, options, correctOptionIndex]
 *             properties:
 *               questionText: { type: string }
 *               questionImageUrl: { type: string }
 *               options: { type: array, items: { type: string }, example: ["Paris", "Rome", "Cairo", "Kuwait City"] }
 *               correctOptionIndex: { type: integer, example: 0 }
 *               points: { type: integer, default: 100 }
 *               timeLimitSeconds: { type: integer, default: 20 }
 *     responses:
 *       201: { description: Created }
 *       404: { description: Parent quiz not found, or owned by a different school than the caller's token }
 * /admin/quizzes/{id}/questions/{questionId}:
 *   patch:
 *     tags: [Games]
 *     summary: Update a question
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *       - { in: path, name: questionId, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found, or the parent quiz belongs to a different school than the caller's token }
 *   delete:
 *     tags: [Games]
 *     summary: Delete a question
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *       - { in: path, name: questionId, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Deleted }
 *       404: { description: Not found, or the parent quiz belongs to a different school than the caller's token }
 */
router.use(requireAdminOrSchoolAuth);
router.get('/', controller.list);
router.post('/', controller.createOne);
router.get('/:id', controller.getOneWithQuestions);
router.patch('/:id', controller.updateOne);
router.delete('/:id', controller.deleteOne);
router.post('/:id/questions', controller.addQuestion);
router.patch('/:id/questions/:questionId', controller.updateQuestion);
router.delete('/:id/questions/:questionId', controller.deleteQuestion);

module.exports = router;
