const router = require('express').Router();
const controller = require('./schools.controller');

/**
 * @swagger
 * components:
 *   schemas:
 *     SchoolListItem:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 4 }
 *         nameEn: { type: string, example: "Al Manar International School" }
 *         nameAr: { type: string, example: "مدرسة المنار العالمية" }
 *         logoUrl: { type: string, nullable: true, example: "https://back.makedown.online/uploads/school-4.png" }
 *     SchoolOpenGame:
 *       type: object
 *       description: >
 *         A school's currently open/live game (game_sessions row). This is the
 *         browse view only — it never includes the join code. The student
 *         enters the code their teacher gave them separately, through
 *         POST /play/sessions/join.
 *       properties:
 *         id: { type: integer, example: 91 }
 *         title: { type: string, nullable: true, example: "Grade 6 Science Trivia" }
 *         titleAr: { type: string, nullable: true, example: "مسابقة العلوم للصف السادس" }
 *         mode: { type: string, enum: [solo, team, random], example: team }
 *         audience: { type: string, nullable: true, enum: [girls, boys, mixed], example: mixed }
 *         status: { type: string, enum: [waiting, active], example: waiting }
 *         scheduledDate: { type: string, format: date, nullable: true, example: "2026-10-01" }
 *         scheduledTime: { type: string, nullable: true, example: "10:30:00" }
 *         teams:
 *           type: array
 *           items:
 *             type: object
 *             properties: { name: { type: string, example: "Team A" }, capacity: { type: integer, nullable: true, example: 5 } }
 *         categories:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               titleEn: { type: string, example: "Science" }
 *               titleAr: { type: string, example: "العلوم" }
 *               coverImageUrl: { type: string, nullable: true, example: "https://back.makedown.online/uploads/science.png" }
 */

/**
 * @swagger
 * tags:
 *   - name: Schools
 *     description: >
 *       Public, unauthenticated endpoints for browsing schools and their open
 *       games. Actually joining a game (with the code a teacher hands out) is
 *       a separate, authenticated call — see POST /play/sessions/join.
 * /schools:
 *   get:
 *     tags: [Schools]
 *     summary: List active schools (public — the education "Schools" browsing page)
 *     responses:
 *       200:
 *         description: List of active schools
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties: { data: { type: array, items: { $ref: '#/components/schemas/SchoolListItem' } } }
 *             example:
 *               success: true
 *               message: OK
 *               data:
 *                 - { id: 4, nameEn: "Al Manar International School", nameAr: "مدرسة المنار العالمية", logoUrl: "https://back.makedown.online/uploads/school-4.png" }
 *                 - { id: 7, nameEn: "Gulf British Academy", nameAr: "أكاديمية الخليج البريطانية", logoUrl: null }
 * /schools/{id}/games:
 *   get:
 *     tags: [Schools]
 *     summary: List a school's currently open games (public — the "<School> Games" page)
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer }, example: 4 }
 *     responses:
 *       200:
 *         description: Open (waiting or active) games hosted by this school
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties: { data: { type: array, items: { $ref: '#/components/schemas/SchoolOpenGame' } } }
 *             example:
 *               success: true
 *               message: OK
 *               data:
 *                 - id: 91
 *                   title: "Grade 6 Science Trivia"
 *                   titleAr: "مسابقة العلوم للصف السادس"
 *                   mode: team
 *                   audience: mixed
 *                   status: waiting
 *                   scheduledDate: "2026-10-01"
 *                   scheduledTime: "10:30:00"
 *                   teams: [{ name: "Team A", capacity: 5 }, { name: "Team B", capacity: 5 }]
 *                   categories: [{ titleEn: "Science", titleAr: "العلوم", coverImageUrl: "https://back.makedown.online/uploads/science.png" }]
 *       404:
 *         description: School not found or inactive
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *             example: { success: false, message: "School not found" }
 */
router.get('/', controller.publicList);

router.get('/:id/games', controller.publicGames);

module.exports = router;
