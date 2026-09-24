const router = require('express').Router();
const controller = require('./me.controller');
const requireAuth = require('../../middlewares/auth.middleware');

/**
 * @swagger
 * components:
 *   schemas:
 *     ProfileUser:
 *       type: object
 *       description: >
 *         Returned by every /me profile endpoint (update profile, upload
 *         avatar). Field names are camelCase here — note this is a different,
 *         fuller shape than the /auth/* User schema (adds firstName/lastName/bio).
 *       properties:
 *         id: { type: integer, example: 501 }
 *         uuid: { type: string, example: "b6f2c8b0-9e2e-4f0a-8b8e-2b1a3e9c4a11" }
 *         fullName: { type: string, example: "Sara Al-Fahad" }
 *         firstName: { type: string, nullable: true, example: "Sara" }
 *         lastName: { type: string, nullable: true, example: "Al-Fahad" }
 *         email: { type: string, example: "sara@example.com" }
 *         phone: { type: string, nullable: true, example: "+96555512345" }
 *         avatarUrl: { type: string, nullable: true, example: "https://back.makedown.online/uploads/avatar-3f2c1a.jpg" }
 *         bio: { type: string, nullable: true, example: "Trivia night regular." }
 *         emailVerified: { type: boolean, example: true }
 *         createdAt: { type: string, format: date-time, example: "2026-01-14T09:12:00.000Z" }
 *     Address:
 *       type: object
 *       description: >
 *         Note: unlike ProfileUser, address fields come straight from the
 *         database and are snake_case in the response — full_name, is_default,
 *         created_at, etc. — NOT camelCase.
 *       properties:
 *         id: { type: integer, example: 12 }
 *         user_id: { type: integer, example: 501 }
 *         label: { type: string, nullable: true, example: "Home" }
 *         full_name: { type: string, example: "Sara Al-Fahad" }
 *         phone: { type: string, example: "+96555512345" }
 *         country: { type: string, example: "Kuwait" }
 *         city: { type: string, nullable: true, example: "Kuwait City" }
 *         area: { type: string, nullable: true, example: "Salmiya" }
 *         block: { type: string, nullable: true, example: "3" }
 *         street: { type: string, nullable: true, example: "Street 12" }
 *         building: { type: string, nullable: true, example: "44" }
 *         floor: { type: string, nullable: true, example: "2" }
 *         apartment: { type: string, nullable: true, example: "7" }
 *         is_default: { type: integer, enum: [0, 1], example: 1, description: "MySQL TINYINT — 0 or 1, not a real boolean" }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 *     OrderSummary:
 *       type: object
 *       description: A row from `orders` — also raw snake_case, same as Address.
 *       properties:
 *         id: { type: integer, example: 233 }
 *         order_number: { type: string, example: "MD-20261001-0233" }
 *         status: { type: string, enum: [pending, paid, processing, shipped, delivered, cancelled, refunded], example: processing }
 *         payment_status: { type: string, enum: [unpaid, paid, failed, refunded], example: paid }
 *         payment_method: { type: string, nullable: true, example: "knet" }
 *         subtotal: { type: string, example: "12.500", description: "DECIMAL columns come back as strings — parse before doing math" }
 *         discount_total: { type: string, example: "0.000" }
 *         shipping_total: { type: string, example: "1.500" }
 *         grand_total: { type: string, example: "14.000" }
 *         currency: { type: string, example: "KWD" }
 *         coupon_code: { type: string, nullable: true, example: "WELCOME10" }
 *         notes: { type: string, nullable: true }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 *     OrderDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/OrderSummary'
 *         - type: object
 *           properties:
 *             items:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: integer, example: 501 }
 *                   product_id: { type: integer, nullable: true, example: 9 }
 *                   variant_id: { type: integer, nullable: true, example: 22 }
 *                   product_name_snapshot: { type: string, example: "Trivia Royale Starter Pack" }
 *                   quantity: { type: integer, example: 2 }
 *                   unit_price: { type: string, example: "6.250" }
 *                   line_total: { type: string, example: "12.500" }
 *                   thumbnail_url: { type: string, nullable: true, example: "https://back.makedown.online/uploads/product-9.jpg" }
 *                   attributes_json: { type: object, nullable: true, example: { color: "Red", size: "M" } }
 *     MyPackage:
 *       type: object
 *       description: A row from `user_packages` joined with its package info — snake_case.
 *       properties:
 *         id: { type: integer, example: 88 }
 *         package_id: { type: integer, example: 3 }
 *         order_id: { type: integer, nullable: true, example: 233 }
 *         credits_remaining: { type: integer, example: 4 }
 *         purchased_at: { type: string, format: date-time }
 *         expires_at: { type: string, format: date-time, nullable: true }
 *         status: { type: string, enum: [active, expired, used], example: active }
 *         package_name_en: { type: string, example: "5-Game Pack" }
 *         package_name_ar: { type: string, example: "باقة 5 ألعاب" }
 *         package_credits: { type: integer, example: 5 }
 *         package_free_credits: { type: integer, example: 0 }
 *     GameHistoryEntry:
 *       type: object
 *       description: One played session, camelCase (unlike addresses/orders/packages above).
 *       properties:
 *         sessionId: { type: integer, example: 91 }
 *         mode: { type: string, enum: [solo, team, random], example: team }
 *         status: { type: string, example: finished }
 *         startedAt: { type: string, format: date-time }
 *         endedAt: { type: string, format: date-time, nullable: true }
 *         participants:
 *           type: array
 *           description: Empty for team-mode sessions — see `teams` instead.
 *           items:
 *             type: object
 *             properties: { id: { type: integer }, userId: { type: integer, nullable: true }, name: { type: string }, avatarUrl: { type: string, nullable: true }, score: { type: integer }, isWinner: { type: boolean } }
 *         teams:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id: { type: integer }
 *               name: { type: string, example: "Team A" }
 *               color: { type: string, nullable: true }
 *               score: { type: integer }
 *               isWinner: { type: boolean }
 *               members: { type: array, items: { type: object, properties: { id: { type: integer }, userId: { type: integer, nullable: true }, name: { type: string }, avatarUrl: { type: string, nullable: true } } } }
 *         quizzes:
 *           type: array
 *           items: { type: object, properties: { id: { type: integer }, titleEn: { type: string }, titleAr: { type: string }, coverImageUrl: { type: string, nullable: true } } }
 *         lifelinesUsed: { type: array, items: { type: string, enum: [fifty_fifty, skip, phone_a_friend] } }
 *     PaginatedList:
 *       type: object
 *       properties:
 *         rows: { type: array, items: {} }
 *         total: { type: integer, example: 42 }
 *         page: { type: integer, example: 1 }
 *         pageSize: { type: integer, example: 20 }
 * tags:
 *   - name: Me
 *     description: The logged-in customer's own profile, addresses, orders, packages and game history
 * /me:
 *   patch:
 *     tags: [Me]
 *     summary: Update my profile info
 *     description: Every field is optional — send only what changed. Omitted fields are left untouched.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName: { type: string, example: "Sara" }
 *               lastName: { type: string, example: "Al-Fahad" }
 *               phone: { type: string, example: "+96555512345" }
 *               avatarUrl: { type: string, example: "https://back.makedown.online/uploads/avatar-3f2c1a.jpg", description: "Only if you already have a hosted URL — to upload a new image file, use POST /me/avatar instead." }
 *               bio: { type: string, example: "Trivia night regular." }
 *     responses:
 *       200:
 *         description: Profile updated — returns the full updated profile
 *         content:
 *           application/json:
 *             schema:
 *               allOf: [{ $ref: '#/components/schemas/ApiSuccess' }, { type: object, properties: { data: { $ref: '#/components/schemas/ProfileUser' } } }]
 *             example:
 *               success: true
 *               message: "Profile updated"
 *               data: { id: 501, uuid: "b6f2c8b0-9e2e-4f0a-8b8e-2b1a3e9c4a11", fullName: "Sara Al-Fahad", firstName: "Sara", lastName: "Al-Fahad", email: "sara@example.com", phone: "+96555512345", avatarUrl: null, bio: "Trivia night regular.", emailVerified: true, createdAt: "2026-01-14T09:12:00.000Z" }
 *       401:
 *         description: Missing or invalid access token
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' }, example: { success: false, message: "Unauthorized" } } }
 * /me/avatar:
 *   post:
 *     tags: [Me]
 *     summary: Upload a new profile picture
 *     description: >
 *       multipart/form-data with a single file field named "file" (PNG, JPG,
 *       WEBP or GIF, max 5MB). Saves the file, sets it as the account's
 *       avatarUrl, and returns the full updated profile — same shape as
 *       PATCH /me.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties: { file: { type: string, format: binary } }
 *     responses:
 *       200:
 *         description: Avatar updated — returns the full updated profile
 *         content:
 *           application/json:
 *             schema:
 *               allOf: [{ $ref: '#/components/schemas/ApiSuccess' }, { type: object, properties: { data: { $ref: '#/components/schemas/ProfileUser' } } }]
 *             example:
 *               success: true
 *               message: "Avatar updated"
 *               data: { id: 501, uuid: "b6f2c8b0-9e2e-4f0a-8b8e-2b1a3e9c4a11", fullName: "Sara Al-Fahad", firstName: "Sara", lastName: "Al-Fahad", email: "sara@example.com", phone: "+96555512345", avatarUrl: "https://back.makedown.online/uploads/avatar-3f2c1a.jpg", bio: null, emailVerified: true, createdAt: "2026-01-14T09:12:00.000Z" }
 *       400:
 *         description: No file, wrong type, or file too large
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *             examples:
 *               noFile: { value: { success: false, message: "No file uploaded" } }
 *               tooLarge: { value: { success: false, message: "Image is too large. Max size is 5MB." } }
 *               badType: { value: { success: false, message: "Unsupported image type. Use PNG, JPG, WEBP or GIF." } }
 *       401:
 *         description: Missing or invalid access token
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' }, example: { success: false, message: "Unauthorized" } } }
 * /me/change-password:
 *   post:
 *     tags: [Me]
 *     summary: Change my password
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string, format: password }
 *               newPassword: { type: string, format: password, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password changed
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ApiSuccess' }, example: { success: true, message: "Password changed", data: { changed: true } } } }
 *       400:
 *         description: Missing fields, newPassword too short, or currentPassword wrong
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *             examples:
 *               wrongCurrent: { value: { success: false, message: "Current password is incorrect" } }
 *               tooShort: { value: { success: false, message: "newPassword must be at least 8 characters" } }
 * /me/addresses:
 *   get:
 *     tags: [Me]
 *     summary: List my saved addresses
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: My addresses, default first
 *         content:
 *           application/json:
 *             schema: { allOf: [{ $ref: '#/components/schemas/ApiSuccess' }, { type: object, properties: { data: { type: array, items: { $ref: '#/components/schemas/Address' } } } }] }
 *   post:
 *     tags: [Me]
 *     summary: Add a saved address
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, phone]
 *             properties:
 *               label: { type: string, example: "Home" }
 *               fullName: { type: string, example: "Sara Al-Fahad" }
 *               phone: { type: string, example: "+96555512345" }
 *               country: { type: string, default: "Kuwait" }
 *               city: { type: string, example: "Kuwait City" }
 *               area: { type: string, example: "Salmiya" }
 *               block: { type: string, example: "3" }
 *               street: { type: string, example: "Street 12" }
 *               building: { type: string, example: "44" }
 *               floor: { type: string, example: "2" }
 *               apartment: { type: string, example: "7" }
 *               isDefault: { type: boolean, default: false, description: "Request field is camelCase even though the response comes back as is_default" }
 *     responses:
 *       201:
 *         description: Address created
 *         content: { application/json: { schema: { allOf: [{ $ref: '#/components/schemas/ApiSuccess' }, { type: object, properties: { data: { $ref: '#/components/schemas/Address' } } }] } } }
 *       400:
 *         description: fullName or phone missing
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' }, example: { success: false, message: "fullName and phone are required" } } }
 * /me/addresses/{id}:
 *   patch:
 *     tags: [Me]
 *     summary: Update a saved address
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Same fields as POST /me/addresses — every field optional, only sent ones change.
 *     responses:
 *       200:
 *         description: Address updated
 *         content: { application/json: { schema: { allOf: [{ $ref: '#/components/schemas/ApiSuccess' }, { type: object, properties: { data: { $ref: '#/components/schemas/Address' } } }] } } }
 *       404:
 *         description: Address doesn't exist or belongs to another account
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' }, example: { success: false, message: "Address not found" } } }
 *   delete:
 *     tags: [Me]
 *     summary: Delete a saved address
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200:
 *         description: Address deleted
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ApiSuccess' }, example: { success: true, message: "Deleted", data: null } } }
 *       404:
 *         description: Address doesn't exist or belongs to another account
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' }, example: { success: false, message: "Address not found" } } }
 * /me/orders:
 *   get:
 *     tags: [Me]
 *     summary: List my product orders (paginated)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: pageSize, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       200:
 *         description: Paginated list of my orders
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       allOf:
 *                         - $ref: '#/components/schemas/PaginatedList'
 *                         - type: object
 *                           properties: { rows: { type: array, items: { $ref: '#/components/schemas/OrderSummary' } } }
 * /me/orders/{id}:
 *   get:
 *     tags: [Me]
 *     summary: Get one of my orders with its line items
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200:
 *         description: Order detail
 *         content: { application/json: { schema: { allOf: [{ $ref: '#/components/schemas/ApiSuccess' }, { type: object, properties: { data: { $ref: '#/components/schemas/OrderDetail' } } }] } } }
 *       404:
 *         description: Not your order, or it doesn't exist
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' }, example: { success: false, message: "Order not found" } } }
 * /me/packages:
 *   get:
 *     tags: [Me]
 *     summary: List packages I've purchased (current + history)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: My purchased packages, most recent first
 *         content: { application/json: { schema: { allOf: [{ $ref: '#/components/schemas/ApiSuccess' }, { type: object, properties: { data: { type: array, items: { $ref: '#/components/schemas/MyPackage' } } } }] } } }
 * /me/game-history:
 *   get:
 *     tags: [Me]
 *     summary: List games I've played (paginated)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: pageSize, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       200:
 *         description: Paginated game history
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       allOf:
 *                         - $ref: '#/components/schemas/PaginatedList'
 *                         - type: object
 *                           properties: { rows: { type: array, items: { $ref: '#/components/schemas/GameHistoryEntry' } } }
 */
router.use(requireAuth);
router.patch('/', controller.updateProfile);
router.post('/avatar', controller.uploadAvatar);
router.post('/change-password', controller.changePassword);
router.get('/addresses', controller.listAddresses);
router.post('/addresses', controller.createAddress);
router.patch('/addresses/:id', controller.updateAddress);
router.delete('/addresses/:id', controller.deleteAddress);
router.get('/orders', controller.listMyOrders);
router.get('/orders/:id', controller.getMyOrder);
router.get('/packages', controller.listMyPackages);
router.get('/game-history', controller.listGameHistory);

module.exports = router;
