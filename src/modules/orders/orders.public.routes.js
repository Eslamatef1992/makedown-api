const router = require('express').Router();
const controller = require('./orders.controller');
const optionalAuth = require('../../middlewares/optionalAuth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { checkout } = require('../../validators/checkout.validator');

/**
 * @swagger
 * tags:
 *   - name: Orders
 *     description: >
 *       Product checkout/order placement. Full process:
 *
 *       1. (Optional) `GET /site-settings/delivery-fee` — the flat delivery
 *          fee, so the checkout screen can show the real number instead of a
 *          placeholder before the customer taps Pay. It is a single
 *          admin-set flat amount today — not based on governorate, area, or
 *          subtotal.
 *       2. (Optional) `GET /coupons/validate/{code}?subtotal=X` — preview a
 *          discount code's amount on an "Apply" button. This does not spend
 *          a use; nothing is committed yet.
 *       3. `POST /orders` — places the order. Every price is recomputed
 *          server-side from the database (product/variant/offer prices,
 *          the coupon, the delivery fee) — nothing the client sends for
 *          price is trusted. `cash` orders are placed immediately. `knet`,
 *          `credit_card`, `apple_pay`, and `google_pay` instead return a
 *          `redirectUrl` to a MyFatoorah hosted payment page — the order
 *          exists already (`status: pending`, `payment_status: unpaid`)
 *          but isn't considered placed-and-paid yet.
 *       4. For the 4 online methods: open `redirectUrl` (a webview on
 *          mobile). MyFatoorah redirects back to
 *          `GET /payments/myfatoorah/callback` when the customer finishes —
 *          that endpoint independently re-confirms the payment with
 *          MyFatoorah's own GetPaymentStatus API (never trusts its own
 *          query string), updates `payment_status`/`status`, sends the
 *          confirmation email, and only then redirects the browser/webview
 *          onward. By the time that redirect fires, the order's status in
 *          the database is already final — there is no server-side race
 *          window to poll around.
 *       5. The redirect target is normally a website page
 *          (`{FRONTEND_URL}/order-placed` or `/order-failed`). A mobile
 *          checkout that can't show a website page in its webview should
 *          send `platform: "mobile"` in the `POST /orders` body instead —
 *          the callback then redirects to the app's own deep link
 *          (`{MOBILE_APP_SCHEME}://order-placed?...` /
 *          `{MOBILE_APP_SCHEME}://order-failed?...`) rather than a website
 *          URL. Either way the redirect carries `status`, `orderId`, and
 *          (on success) `orderNumber` as query params.
 *       6. Whichever redirect happens (website or deep link), or if the app
 *          is just polling instead of relying on the redirect/deep link at
 *          all: `GET /orders/track/{orderNumber}` returns the current
 *          order with items. A couple of short-interval retries are a
 *          reasonable safety margin for webview navigation-event timing,
 *          but not because the server itself is still catching up.
 * components:
 *   schemas:
 *     ShippingAddress:
 *       type: object
 *       required: [governorate, area, block, street, buildingNumber]
 *       description: >
 *         Not the same shape as the `Address` schema used by `/me/addresses`
 *         (that's a separate saved-address-book feature, with its own
 *         fullName/phone/floor/apartment fields) — this is checkout's own,
 *         simpler inline shape. The recipient's name/phone for the order
 *         come from the top-level guestName/guestPhone (guest checkout) or
 *         the logged-in user's own account, not from inside this object.
 *       properties:
 *         governorate: { type: string, example: "Al Asimah" }
 *         area: { type: string, example: "Salmiya" }
 *         block: { type: string, example: "3" }
 *         street: { type: string, example: "Street 12" }
 *         buildingNumber: { type: string, example: "44" }
 *         moreDetails:
 *           type: string
 *           nullable: true
 *           maxLength: 500
 *           example: "Floor 2, Apartment 7 — blue gate, use the side entrance"
 *           description: >
 *             Free-text delivery notes — floor/apartment/landmarks/anything
 *             else that doesn't fit the structured fields above. Already
 *             supported and stored today (inside shipping_address_json);
 *             this doc previously just didn't list it. Map your checkout
 *             UI's "More Details" field straight to this.
 *     OrderItemResult:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 881 }
 *         order_id: { type: integer, example: 233 }
 *         product_id: { type: integer, example: 57 }
 *         variant_id: { type: integer, nullable: true, example: 14 }
 *         product_name_snapshot: { type: string, example: "Classic Tee" }
 *         quantity: { type: integer, example: 2 }
 *         unit_price: { type: string, example: "6.500", description: "DECIMAL column — comes back as a string, parse before doing math" }
 *         line_total: { type: string, example: "13.000" }
 *         thumbnail_url: { type: string, nullable: true, example: "https://back.makedown.online/uploads/classic-tee.jpg" }
 *         attributes_json:
 *           nullable: true
 *           description: >
 *             Freeform per-variant attributes — e.g. {"color":"#FF0000","size":"Large"}.
 *             There is no guaranteed/standardized key set (no fixed
 *             color/width/height fields) — render this as a dynamic
 *             key/value list, not a fixed layout. See
 *             claude/mobile-product-api-gaps.md section 6 for the full
 *             writeup and the richer structured shape proposed for later.
 *           example: { "color": "#FF0000", "size": "Large" }
 *     OrderResult:
 *       type: object
 *       description: The full shape of `POST /orders`'s `data`, and of `GET /orders/track/{orderNumber}`'s `data`.
 *       properties:
 *         id: { type: integer, example: 233 }
 *         order_number: { type: string, example: "MDLXJ3K9F2A1B" }
 *         user_id: { type: integer, nullable: true, example: 501 }
 *         guest_name: { type: string, nullable: true, example: "Sara Al-Fahad" }
 *         guest_email: { type: string, nullable: true, example: "sara@example.com" }
 *         guest_phone: { type: string, nullable: true, example: "+96555512345" }
 *         status: { type: string, enum: [pending, paid, processing, shipped, delivered, cancelled, refunded], example: processing, description: "cash orders jump straight to 'processing'; online methods stay 'pending' until the MyFatoorah callback confirms payment" }
 *         payment_status: { type: string, enum: [unpaid, paid, failed, refunded], example: unpaid }
 *         payment_method: { type: string, enum: [knet, credit_card, apple_pay, google_pay, cash], example: cash }
 *         subtotal: { type: string, example: "13.000" }
 *         discount_total: { type: string, example: "0.000" }
 *         shipping_total: { type: string, example: "2.000" }
 *         grand_total: { type: string, example: "15.000" }
 *         currency: { type: string, example: "KWD" }
 *         coupon_id: { type: integer, nullable: true }
 *         coupon_code: { type: string, nullable: true, example: "WELCOME10" }
 *         shipping_address_json: { allOf: [{ $ref: '#/components/schemas/ShippingAddress' }], description: "Stored exactly as sent at checkout" }
 *         created_at: { type: string, format: date-time }
 *         items: { type: array, items: { $ref: '#/components/schemas/OrderItemResult' } }
 *         redirectUrl:
 *           type: string
 *           nullable: true
 *           example: null
 *           description: "null for cash (nothing to redirect to — already placed). For knet/credit_card/apple_pay/google_pay, the MyFatoorah hosted payment page URL to open."
 *         reused:
 *           type: boolean
 *           example: false
 *           description: >
 *             true only when this checkout call reused an existing
 *             still-pending online order from an earlier attempt on the
 *             same cart/address/coupon, instead of creating a new one (see
 *             claude/duplicate-pending-orders-findings.md) — the response
 *             status is 200 in that case rather than 201. Always false for
 *             cash and for a freshly created order; purely informational,
 *             nothing in the app needs to branch on it.
 */

/**
 * @swagger
 * /orders:
 *   post:
 *     tags: [Orders]
 *     summary: Place an order (checkout) — works for a logged-in user or a guest
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items, shippingAddress, paymentMethod]
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [productId]
 *                   properties:
 *                     productId: { type: integer }
 *                     variantId: { type: integer, nullable: true, description: "Required when the product actually has variants — see POST /cart/items for the same rule" }
 *                     quantity: { type: integer, default: 1 }
 *                     giftBox: { type: boolean, description: "Price is always looked up server-side, never trusted from the client" }
 *               shippingAddress: { $ref: '#/components/schemas/ShippingAddress' }
 *               paymentMethod:
 *                 type: string
 *                 enum: [knet, credit_card, apple_pay, google_pay, cash]
 *                 description: >
 *                   apple_pay/google_pay are accepted by this API and looked
 *                   up in MyFatoorah's live payment-methods list the same way
 *                   knet/credit_card are — but whether they're actually
 *                   enabled on this MyFatoorah merchant account is a
 *                   dashboard/contract question. If not enabled, you'll get
 *                   a clear 400 ("Apple Pay payment is not available right
 *                   now"), not a crash or a silent fallback — test in
 *                   MyFatoorah test mode to confirm before shipping the UI
 *                   buttons.
 *               discountCode: { type: string, description: "Re-validated server-side with the exact same rules GET /coupons/validate/{code} previews — see Coupons tag" }
 *               guestName: { type: string, description: "Required for guest checkout. Send 'First Last' as one string — there is no separate guestFirstName/guestLastName field; the orders table stores a single guest_name column." }
 *               guestEmail: { type: string, description: Required for guest checkout }
 *               guestPhone: { type: string }
 *               platform:
 *                 type: string
 *                 enum: [web, mobile]
 *                 default: web
 *                 description: >
 *                   Send "mobile" to get a deep-link MyFatoorah callback
 *                   redirect (MOBILE_APP_SCHEME://order-placed / order-failed)
 *                   instead of a website URL your webview can't usefully
 *                   show. Requires the server to have MOBILE_APP_SCHEME
 *                   configured — see Payments tag — or this is a 400, not a
 *                   silent fallback to the website URL.
 *           examples:
 *             guestCash:
 *               summary: Guest checkout, cash on delivery
 *               value: { items: [{ productId: 57, variantId: 14, quantity: 2 }], shippingAddress: { governorate: "Al Asimah", area: "Salmiya", block: "3", street: "Street 12", buildingNumber: "44", moreDetails: "Floor 2, Apartment 7" }, paymentMethod: cash, guestName: "Sara Al-Fahad", guestEmail: "sara@example.com", guestPhone: "+96555512345" }
 *             mobileKnet:
 *               summary: Mobile app, logged-in user, KNET (deep-link callback)
 *               value: { items: [{ productId: 57, variantId: 14, quantity: 2 }], shippingAddress: { governorate: "Al Asimah", area: "Salmiya", block: "3", street: "Street 12", buildingNumber: "44" }, paymentMethod: knet, platform: mobile }
 *             withCoupon:
 *               summary: With a discount code applied
 *               value: { items: [{ productId: 57, quantity: 1 }], shippingAddress: { governorate: "Hawalli", area: "Salmiya", block: "1", street: "Street 5", buildingNumber: "9" }, paymentMethod: credit_card, discountCode: WELCOME10 }
 *     responses:
 *       201:
 *         description: Order placed (cash) or created pending payment (knet/credit_card/apple_pay/google_pay)
 *         content:
 *           application/json:
 *             schema: { allOf: [{ $ref: '#/components/schemas/ApiSuccess' }, { type: object, properties: { data: { $ref: '#/components/schemas/OrderResult' } } }] }
 *             examples:
 *               cash:
 *                 summary: Cash — placed immediately, nothing to redirect to
 *                 value: { success: true, message: "Order placed", data: { id: 233, order_number: "MDLXJ3K9F2A1B", status: "processing", payment_status: "unpaid", payment_method: "cash", subtotal: "13.000", discount_total: "0.000", shipping_total: "2.000", grand_total: "15.000", currency: "KWD", guest_name: "Sara Al-Fahad", guest_email: "sara@example.com", guest_phone: "+96555512345", items: [{ id: 881, product_id: 57, variant_id: 14, product_name_snapshot: "Classic Tee", quantity: 2, unit_price: "6.500", line_total: "13.000" }], redirectUrl: null, reused: false } }
 *               online:
 *                 summary: KNET/credit_card/apple_pay/google_pay — redirect to pay
 *                 value: { success: true, message: "Redirecting to payment", data: { id: 234, order_number: "MDLXJ400A2C3", status: "pending", payment_status: "unpaid", payment_method: "knet", subtotal: "13.000", discount_total: "0.000", shipping_total: "2.000", grand_total: "15.000", currency: "KWD", items: [{ id: 882, product_id: 57, variant_id: 14, product_name_snapshot: "Classic Tee", quantity: 2, unit_price: "6.500", line_total: "13.000" }], redirectUrl: "https://demo.myfatoorah.com/KWT/ie/...", reused: false } }
 *       400:
 *         description: Validation error, a product/variant is no longer available, a payment method isn't enabled on the MyFatoorah account, or a coupon issue
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *             examples:
 *               couponExpired:
 *                 summary: Coupon-specific — distinguishable from a generic validation error via details.code
 *                 value: { success: false, message: "This coupon has expired.", details: { code: "COUPON_EXPIRED" } }
 *               variantRequired:
 *                 value: { success: false, message: "\"Classic Tee\" requires selecting an option (variantId) — it is not sold as a plain product" }
 *               methodNotEnabled:
 *                 value: { success: false, message: "Apple Pay payment is not available right now" }
 */
router.post('/', optionalAuth, validate(checkout), controller.checkout);

/**
 * @swagger
 * /orders/track/{orderNumber}:
 *   get:
 *     tags: [Orders]
 *     summary: Look up an order by its order number (public — the order-confirmation page, including after a MyFatoorah redirect/deep-link)
 *     parameters: [{ in: path, name: orderNumber, required: true, schema: { type: string }, example: "MDLXJ3K9F2A1B" }]
 *     responses:
 *       200:
 *         description: Order with items — same shape as POST /orders's response data (redirectUrl is always null here, there's nothing left to redirect to)
 *         content:
 *           application/json:
 *             schema: { allOf: [{ $ref: '#/components/schemas/ApiSuccess' }, { type: object, properties: { data: { $ref: '#/components/schemas/OrderResult' } } }] }
 *       404: { description: Not found }
 */
router.get('/track/:orderNumber', controller.trackByOrderNumber);

/**
 * @swagger
 * /orders/track/{orderNumber}/cancel:
 *   post:
 *     tags: [Orders]
 *     summary: >
 *       Cancel a still-pending order (public — same unguessable
 *       order_number access model as GET /orders/track/{orderNumber}, no
 *       login required). Call this when the customer explicitly backs out
 *       of the payment page/webview instead of retrying — it's the fast
 *       path; an abandoned order that's never explicitly cancelled is
 *       still cleaned up automatically after PENDING_ORDER_EXPIRY_MINUTES
 *       (default 30) by a background sweep. Retrying checkout with the
 *       same items/address/coupon instead of cancelling also works fine
 *       on its own — POST /orders reuses the existing pending order in
 *       that case rather than creating a new one. See
 *       claude/duplicate-pending-orders-findings.md.
 *     parameters: [{ in: path, name: orderNumber, required: true, schema: { type: string }, example: "MDLXJ3K9F2A1B" }]
 *     responses:
 *       200:
 *         description: Cancelled
 *         content:
 *           application/json:
 *             schema: { allOf: [{ $ref: '#/components/schemas/ApiSuccess' }, { type: object, properties: { data: { $ref: '#/components/schemas/OrderResult' } } }] }
 *       404: { description: Not found }
 *       409:
 *         description: Order isn't pending anymore (already paid/processing/shipped/delivered/refunded, or already cancelled)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *             example: { success: false, message: "Order cannot be cancelled in its current state", details: { code: "ORDER_NOT_CANCELLABLE" } }
 */
router.post('/track/:orderNumber/cancel', controller.cancelByOrderNumber);

module.exports = router;
