const router = require('express').Router();
const controller = require('./quizzes.controller');
const requireAdminAuth = require('../../middlewares/adminAuth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Games
 *     description: Games (quiz content) — admin sidebar "games" + "education → games"
 * /admin/quizzes:
 *   get:
 *     tags: [Games]
 *     summary: List quizzes
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: List of quizzes } }
 *   post:
 *     tags: [Games]
 *     summary: Create a quiz
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Created } }
 * /admin/quizzes/{id}:
 *   get:
 *     tags: [Games]
 *     summary: Get a quiz with its questions
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: "Quiz with questions array" } }
 *   patch:
 *     tags: [Games]
 *     summary: Update a quiz
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Updated } }
 *   delete:
 *     tags: [Games]
 *     summary: Delete a quiz (cascades its questions)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Deleted } }
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
 *     responses: { 201: { description: Created } }
 * /admin/quizzes/{id}/questions/{questionId}:
 *   patch:
 *     tags: [Games]
 *     summary: Update a question
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *       - { in: path, name: questionId, required: true, schema: { type: integer } }
 *     responses: { 200: { description: Updated } }
 *   delete:
 *     tags: [Games]
 *     summary: Delete a question
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *       - { in: path, name: questionId, required: true, schema: { type: integer } }
 *     responses: { 200: { description: Deleted } }
 */
router.use(requireAdminAuth);
router.get('/', controller.list);
router.post('/', controller.createOne);
router.get('/:id', controller.getOneWithQuestions);
router.patch('/:id', controller.updateOne);
router.delete('/:id', controller.deleteOne);
router.post('/:id/questions', controller.addQuestion);
router.patch('/:id/questions/:questionId', controller.updateQuestion);
router.delete('/:id/questions/:questionId', controller.deleteQuestion);

module.exports = router;
