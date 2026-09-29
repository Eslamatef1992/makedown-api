const router = require('express').Router();
const controller = require('./packages.controller');
const requireAuth = require('../../middlewares/auth.middleware');

/**
 * @swagger
 * components:
 *   schemas:
 *     Package:
 *       type: object
 *       description: A catalog package (Standard/Premium/VIP), as returned by GET /packages.
 *       properties:
 *         id: { type: integer, example: 1 }
 *         name_en: { type: string, example: Standard }
 *         name_ar: { type: string }
 *         description_en: { type: string, nullable: true }
 *         description_ar: { type: string, nullable: true }
 *         price: { type: number, example: 2 }
 *         currency: { type: string, example: KWD }
 *         credits: { type: integer, example: 1, description: "Paid games included" }
 *         free_credits: { type: integer, example: 0, description: "Bonus games included on top of credits" }
 *         is_active: { type: integer, enum: [0, 1] }
 *         sort_order: { type: integer }
 *         tier: { type: integer, example: 1, description: "1=Standard, 2=Premium, 3=VIP — set per-package in the admin panel" }
 *         tierName: { type: string, enum: [standard, premium, vip], example: standard, description: "String form of tier, purely for convenience" }
 *         isRenewable: { type: boolean, example: true, description: "Always true today — any tier can always be renewed, only upgrading is tier-gated" }
 *         upgradableTo: { type: array, items: { type: integer }, example: [2, 3], description: "Package ids in a strictly higher tier. Empty means this is the top tier — only offer Renew, not Upgrade." }
 *     UserPackage:
 *       type: object
 *       description: A purchased package instance, as returned by GET /me/packages and inside the purchase response.
 *       properties:
 *         id: { type: integer, example: 501, description: "user_packages row id — NOT the catalog package id" }
 *         user_id: { type: integer }
 *         package_id: { type: integer, example: 2 }
 *         order_id: { type: integer, nullable: true }
 *         credits_remaining: { type: integer, example: 5 }
 *         purchased_at: { type: string, format: date-time }
 *         expires_at: { type: string, format: date-time, nullable: true, description: "Always null — packages have no date expiry, only credit-count expiry (see 'status')" }
 *         status:
 *           type: string
 *           enum: [active, expired, used]
 *           description: >
 *             active = usable, has credits left, and is the one and only
 *             active package for this user. expired = superseded by a
 *             later purchase (Renew or Upgrade) — its leftover credits, if
 *             any, were forfeited, not carried over. used = ran out of
 *             credits naturally (credits_remaining hit 0) without being
 *             replaced. No active row at all = unsubscribed, can Buy any
 *             package.
 *         package_name_en: { type: string }
 *         package_name_ar: { type: string }
 *         package_credits: { type: integer, description: "The catalog package's credits field, for reference — not this instance's remaining count" }
 *         package_free_credits: { type: integer }
 *         package_tier: { type: integer }
 * /packages:
 *   get:
 *     tags: [Packages]
 *     summary: List active packages (public)
 *     description: >
 *       Always returns the full catalog (Standard/Premium/VIP), each with
 *       `tier`/`tierName`, `isRenewable`, and `upgradableTo` so the
 *       frontend never has to compute upgrade eligibility itself.
 *     responses:
 *       200:
 *         description: The 3 packages
 *         content:
 *           application/json:
 *             schema: { allOf: [{ $ref: '#/components/schemas/ApiSuccess' }, { type: object, properties: { data: { type: array, items: { $ref: '#/components/schemas/Package' } } } }] }
 *             example:
 *               success: true
 *               message: OK
 *               data:
 *                 - { id: 1, name_en: Standard, price: 2, currency: KWD, credits: 1, free_credits: 0, tier: 1, tierName: standard, isRenewable: true, upgradableTo: [2, 3] }
 *                 - { id: 2, name_en: Premium, price: 5, currency: KWD, credits: 5, free_credits: 0, tier: 2, tierName: premium, isRenewable: true, upgradableTo: [3] }
 *                 - { id: 3, name_en: VIP, price: 10, currency: KWD, credits: 10, free_credits: 2, tier: 3, tierName: vip, isRenewable: true, upgradableTo: [] }
 * /packages/{id}/purchase:
 *   post:
 *     tags: [Packages]
 *     summary: Buy, Renew, or Upgrade — same endpoint for all three (requires login)
 *     description: >
 *       There is no separate "action" field and no separate Renew/Upgrade
 *       endpoint — all three scenarios are this same call, and the
 *       difference is purely which package {id} is in the URL:
 *         - **Buy** (no active package yet): call with any catalog id.
 *         - **Renew**: call with the id of the package you already have
 *           active.
 *         - **Upgrade**: call with a *different*, higher-tier id — see
 *           `upgradableTo` on GET /packages for which ones qualify.
 *
 *       Whichever of the three it is, the same rule applies server-side:
 *       once payment is confirmed, any other package this user still had
 *       active is immediately set to `expired` and this purchase becomes
 *       the only active package. Leftover credits on the old package are
 *       forfeited, not merged or carried over — this is a deliberate
 *       simplification, not a bug.
 *
 *       For `cash`, that swap (and the credit grant) happens synchronously
 *       in this response. For `knet`/`credit_card`, nothing is granted yet
 *       — this only creates the order and returns a hosted payment page;
 *       poll GET /packages/purchases/{orderId}/status after the payment
 *       flow completes to find out if/when it went through.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer }, description: "The package to buy/renew/upgrade to" }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [paymentMethod]
 *             properties:
 *               paymentMethod: { type: string, enum: [knet, credit_card, cash] }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
 *             examples:
 *               buyStandardCash:
 *                 summary: "Scenario A — first-time Buy, no active package, cash"
 *                 value: { success: true, message: "Package order placed — pay in cash to confirm", data: { order: { id: 900, status: processing, payment_status: unpaid, grand_total: 2 }, userPackage: { id: 501, package_id: 1, credits_remaining: 1, status: active }, redirectUrl: null } }
 *               renewStandardCash:
 *                 summary: "Scenario B — Renew Standard (already had Standard active with 1 credit left), cash"
 *                 value: { success: true, message: "Package order placed — pay in cash to confirm", data: { order: { id: 901, status: processing, payment_status: unpaid, grand_total: 2 }, userPackage: { id: 502, package_id: 1, credits_remaining: 1, status: active }, redirectUrl: null }, note: "user_package #501 (the old Standard) is now status: expired with whatever credits_remaining it had — not merged into #502" }
 *               upgradeToPremiumKnet:
 *                 summary: "Scenario C — Upgrade Standard -> Premium, knet"
 *                 value: { success: true, message: "Redirecting to payment", data: { order: { id: 902, status: pending, payment_status: unpaid, grand_total: 5 }, redirectUrl: "https://sa.myfatoorah.com/..." }, note: "No userPackage yet — credits aren't granted until payment is confirmed. Poll GET /packages/purchases/902/status; the old Standard package only gets expired once this succeeds." }
 *               upgradeToVipKnet:
 *                 summary: "Scenario D — Upgrade Premium -> VIP, knet"
 *                 value: { success: true, message: "Redirecting to payment", data: { order: { id: 903, status: pending, payment_status: unpaid, grand_total: 10 }, redirectUrl: "https://sa.myfatoorah.com/..." } }
 *               renewVipCash:
 *                 summary: "Scenario E — VIP Renew (already top tier, upgradableTo was empty), cash"
 *                 value: { success: true, message: "Package order placed — pay in cash to confirm", data: { order: { id: 904, status: processing, payment_status: unpaid, grand_total: 10 }, userPackage: { id: 505, package_id: 3, credits_remaining: 12, status: active }, redirectUrl: null } }
 *       400: { description: "Invalid paymentMethod, or cash isn't enabled for packages right now" }
 * /packages/purchases/{orderId}/status:
 *   get:
 *     tags: [Packages]
 *     summary: Poll whether a knet/credit_card package purchase went through
 *     description: >
 *       Only needed for knet/credit_card — cash purchases already return
 *       the granted package synchronously from POST /packages/{id}/purchase.
 *       Open the paymentUrl from that response in a webview, then poll this
 *       once it closes or redirects, until status is no longer "pending".
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: orderId, required: true, schema: { type: integer } }]
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
 *             examples:
 *               pending: { value: { success: true, message: OK, data: { orderId: 902, status: pending, paymentStatus: unpaid, package: null } } }
 *               success: { value: { success: true, message: OK, data: { orderId: 902, status: success, paymentStatus: paid, package: { id: 506, package_id: 2, credits_remaining: 5, status: active } } } }
 *               failed: { value: { success: true, message: OK, data: { orderId: 902, status: failed, paymentStatus: failed, package: null } } }
 *       404: { description: "Order doesn't exist, or belongs to a different user" }
 */
router.get('/', controller.publicList);
router.post('/:id/purchase', requireAuth, controller.purchase);
router.get('/purchases/:orderId/status', requireAuth, controller.purchaseStatus);

module.exports = router;
