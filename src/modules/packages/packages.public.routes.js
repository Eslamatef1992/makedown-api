const router = require('express').Router();
const controller = require('./packages.controller');
const requireAuth = require('../../middlewares/auth.middleware');

/**
 * @swagger
 * components:
 *   schemas:
 *     Package:
 *       type: object
 *       description: >
 *         A catalog package, as returned by GET /packages. `tier` is a
 *         plain integer (1, 2, 3, ...) set per-package in the admin panel —
 *         nothing in the API hardcodes "tier 1 = Standard" etc, that
 *         naming is just a convention; `tierName` below is a convenience
 *         label for the 3 names currently in use, not a fixed 3-tier
 *         limit. **As of this writing, the real catalog has exactly 2
 *         active packages ("One game pass", "3 games pass"), both at
 *         tier 1** — there is no tier-2/tier-3 ("VIP") package yet, so
 *         `upgradableTo` is empty for both today. Adding a package at a
 *         higher tier (via the admin panel) automatically makes it appear
 *         in `upgradableTo` for every lower-tier package — no app or API
 *         change needed when that happens, which is why the example below
 *         is the literal current response, not an illustrative 3-tier one.
 *       properties:
 *         id: { type: integer, example: 2 }
 *         name_en: { type: string, example: "One game pass" }
 *         name_ar: { type: string }
 *         description_en: { type: string, nullable: true }
 *         description_ar: { type: string, nullable: true }
 *         price: { type: number, example: 2 }
 *         currency: { type: string, example: KWD }
 *         credits: { type: integer, example: 1, description: "Paid games included" }
 *         free_credits: { type: integer, example: 0, description: "Bonus games included on top of credits" }
 *         is_active: { type: integer, enum: [0, 1] }
 *         sort_order: { type: integer }
 *         tier: { type: integer, example: 1, description: "Plain integer, admin-set per package — see the schema description for the current real values (no tier 2/3 package exists yet)" }
 *         tierName: { type: string, enum: [standard, premium, vip], nullable: true, example: standard, description: "Convenience label for tier 1/2/3 (null for anything else) — purely cosmetic, never read by the server for any logic" }
 *         isRenewable: { type: boolean, example: true, description: "Always true today — any package can always be renewed regardless of tier; only upgradableTo (display only, see below) is tier-gated" }
 *         upgradableTo:
 *           type: array
 *           items: { type: integer }
 *           example: []
 *           description: >
 *             Package ids in a strictly higher tier than this one — a
 *             **display hint only**, telling the frontend which button
 *             label to show ("Upgrade" vs "Renew") for a given package
 *             relative to whatever the user currently has active. It is
 *             NOT a purchase restriction: POST /packages/{id}/purchase
 *             does not check this array at all. Confirmed product
 *             decision (Oct 2026) — buying ANY active package is always
 *             allowed, for any {id}, regardless of the caller's current
 *             package or whether that id appears in its upgradableTo.
 *             Buying something not in upgradableTo (a lower tier, or any
 *             other package) behaves exactly like a normal Buy: it swaps
 *             in as the new active package and the old one's remaining
 *             credits are forfeited — same rule, no special case. The app
 *             should keep showing "Buy" (not hide/disable it) for any
 *             package not in upgradableTo; use upgradableTo purely to
 *             decide whether that button says "Buy" or "Upgrade".
 *             Empty today for every package in the real catalog, since
 *             both active packages are tier 1 — this isn't a bug, see the
 *             Package schema description above.
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
 *       Returns every active catalog package, each with `tier`/`tierName`,
 *       `isRenewable`, and `upgradableTo` so the frontend never has to
 *       compute upgrade eligibility itself. The example below is the
 *       literal current response — 2 packages, both tier 1, so
 *       `upgradableTo` is `[]` for both (there is no higher-tier package
 *       in the catalog yet). This is expected to grow to 3+ tiers later;
 *       when a higher-tier package is added, it starts appearing in
 *       `upgradableTo` for the lower ones automatically, with no change
 *       needed here or in the app.
 *     responses:
 *       200:
 *         description: "The current catalog (today: 2 active packages, both tier 1)"
 *         content:
 *           application/json:
 *             schema: { allOf: [{ $ref: '#/components/schemas/ApiSuccess' }, { type: object, properties: { data: { type: array, items: { $ref: '#/components/schemas/Package' } } } }] }
 *             example:
 *               success: true
 *               message: OK
 *               data:
 *                 - { id: 2, name_en: "One game pass", price: 2, currency: KWD, credits: 1, free_credits: 0, tier: 1, tierName: standard, isRenewable: true, upgradableTo: [] }
 *                 - { id: 3, name_en: "3 games pass", price: 5, currency: KWD, credits: 3, free_credits: 0, tier: 1, tierName: standard, isRenewable: true, upgradableTo: [] }
 * /packages/{id}/purchase:
 *   post:
 *     tags: [Packages]
 *     summary: Buy, Renew, or Upgrade — same endpoint for all three (requires login), and NOT restricted to upgradableTo
 *     description: >
 *       There is no separate "action" field and no separate Renew/Upgrade
 *       endpoint — Buy/Renew/Upgrade are all this same call, and which
 *       one it "is" is purely which package {id} is in the URL:
 *         - **Buy** (no active package yet): call with any catalog id.
 *         - **Renew**: call with the id of the package already active.
 *         - **Upgrade**: call with a different, higher-tier id (one that
 *           appears in the current package's `upgradableTo`).
 *
 *       **Confirmed product decision (Oct 2026): this endpoint does NOT
 *       check `upgradableTo` and never rejects a purchase based on it.**
 *       Calling it with an id that is neither the active package nor in
 *       its `upgradableTo` — a lower tier, a same-tier package, anything
 *       — is explicitly allowed and behaves exactly like a normal Buy:
 *       see Scenario C below, which buys a same-tier package while a
 *       different one is active, with no special-casing at all. `
 *       upgradableTo` exists purely so the frontend can label a button
 *       "Upgrade" instead of "Buy" for the packages it applies to — it is
 *       not, and is not intended to become, a purchase restriction. The
 *       app should keep offering every active package as purchasable at
 *       all times, regardless of what the user currently has.
 *
 *       Whichever of Buy/Renew/Upgrade it is, the same rule applies
 *       server-side once payment is confirmed: any other package this
 *       user still had active is immediately set to `expired`, and this
 *       purchase becomes the only active package. Leftover credits on the
 *       old package are forfeited, not merged or carried over — a
 *       deliberate simplification, not a bug, and it applies identically
 *       whether the new package is a genuine upgrade, a downgrade, or an
 *       unrelated same-tier package.
 *
 *       For `cash`, that swap (and the credit grant) happens synchronously
 *       in this response. For `knet`/`credit_card`, nothing is granted yet
 *       — this only creates the order and returns a hosted payment page;
 *       poll GET /packages/purchases/{orderId}/status after the payment
 *       flow completes to find out if/when it went through.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer }, description: "The package to buy/renew/upgrade to — any catalog id, unrestricted (see description)" }]
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
 *               buyOneGamePassCash:
 *                 summary: 'Scenario A — first-time Buy, no active package, cash (id 2 = One game pass)'
 *                 value: { success: true, message: "Package order placed — pay in cash to confirm", data: { order: { id: 900, status: processing, payment_status: unpaid, grand_total: 2 }, userPackage: { id: 501, package_id: 2, credits_remaining: 1, status: active }, redirectUrl: null } }
 *               renewOneGamePassCash:
 *                 summary: "Scenario B — Renew (already had id 2 active with 0 credits left), cash"
 *                 value: { success: true, message: "Package order placed — pay in cash to confirm", data: { order: { id: 901, status: processing, payment_status: unpaid, grand_total: 2 }, userPackage: { id: 502, package_id: 2, credits_remaining: 1, status: active }, redirectUrl: null }, note: "user_package #501 (the previous purchase of id 2) is now status: expired/used — not merged into #502" }
 *               buyDifferentPackageNotInUpgradableToCash:
 *                 summary: 'Scenario C — already has id 2 active; buys id 3 (3 games pass), which is NOT in id 2 upgradableTo (both are tier 1) — still just a normal Buy, cash'
 *                 value: { success: true, message: "Package order placed — pay in cash to confirm", data: { order: { id: 902, status: processing, payment_status: unpaid, grand_total: 5 }, userPackage: { id: 503, package_id: 3, credits_remaining: 3, status: active }, redirectUrl: null }, note: "Allowed even though 3 is absent from id 2's upgradableTo ([]) — upgradableTo is a display hint only, never a purchase restriction. id 2's old user_package row is now expired, its leftover credits forfeited." }
 *               buyKnetPending:
 *                 summary: "Scenario D — any Buy/Renew/Upgrade via knet or credit_card — same for all three, nothing granted yet"
 *                 value: { success: true, message: "Redirecting to payment", data: { order: { id: 903, status: pending, payment_status: unpaid, grand_total: 5 }, redirectUrl: "https://sa.myfatoorah.com/..." }, note: "No userPackage yet — credits aren't granted, and the previous active package isn't expired, until payment is confirmed. Poll GET /packages/purchases/903/status." }
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
