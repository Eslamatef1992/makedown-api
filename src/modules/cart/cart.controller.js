const { validate: isUuid } = require('uuid');
const repo = require('./cart.repository');
const productsRepo = require('../products/products.repository');
const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');

// Same guest-or-logged-in resolution `orders.public.routes.js` uses via
// optionalAuth — a logged-in user's cart is keyed off req.user, a guest's
// off the X-Guest-Token header they were handed on a previous call here.
async function resolveCart(req) {
  let guestToken = req.headers['x-guest-token'] || null;
  // guest_token is a CHAR(36) UUID column. Seen in production: a client
  // sending its JWT access token in this header instead of the guest UUID
  // it was issued — that's ~150-300 chars and previously blew up as an
  // unhandled ER_DATA_TOO_LONG (a raw 500) on every request from that
  // client. Anything that isn't actually a UUID is treated the same as no
  // token at all, so the request self-heals into a fresh guest cart
  // instead of crashing — the client still needs its own fix so it stops
  // discarding cart continuity, but this endpoint no longer 500s over it.
  if (guestToken && !isUuid(guestToken)) {
    guestToken = null;
  }
  return repo.getOrCreateCart({ userId: req.user ? req.user.id : null, guestToken });
}

// Same "never trust the client, recompute from the database" rule
// orders.controller.js#checkout uses for price and stock — including gift
// box: the client only says whether it wants one, the price addition
// always comes from the product's own gift_box_price, same as checkout's
// wantsGiftBox. giftBox is folded straight into unitPrice (so lineTotal
// already reflects it with no app-side math needed), exactly like
// checkout folds it into order_items.unit_price.
async function resolveLine(productId, variantId, quantity, giftBox) {
  const product = await productsRepo.findById(productId);
  if (!product || !product.is_active) {
    throw ApiError.badRequest(`Product ${productId} is no longer available`);
  }

  let variant = null;
  const offerPrice = Number(product.offer_price);
  let unitPrice =
    product.offer_price != null && offerPrice > 0 && offerPrice < Number(product.base_price)
      ? offerPrice
      : Number(product.base_price);

  if (variantId) {
    variant = await productsRepo.findVariantById(variantId);
    if (!variant || variant.product_id !== product.id || !variant.is_active) {
      throw ApiError.badRequest(`Selected option for "${product.name_en}" is no longer available`);
    }
    if (Number(variant.stock_quantity) <= 0) {
      throw ApiError.badRequest(`"${product.name_en}" is out of stock`);
    }
    unitPrice = Number(variant.price);
  } else {
    // No variantId given — that's only valid for a plain product. A
    // product that actually has variants (any rows at all, not just active
    // ones — see productsRepo.listVariants) must have one picked
    // explicitly, since its real price/stock live on the variant, not the
    // product row above. Silently falling back to the base product's price
    // here would be wrong for any such product.
    const variants = await productsRepo.listVariants(product.id);
    if (variants.length > 0) {
      throw ApiError.badRequest(`"${product.name_en}" requires selecting an option (variantId) — it is not sold as a plain product`);
    }
    if (product.stock_quantity != null && Number(product.stock_quantity) <= 0) {
      throw ApiError.badRequest(`"${product.name_en}" is out of stock`);
    }
  }

  const hasGiftBox = Boolean(giftBox) && Boolean(product.has_gift_box) && product.gift_box_price != null;
  if (hasGiftBox) {
    unitPrice = Math.round((unitPrice + Number(product.gift_box_price)) * 1000) / 1000;
  }

  return { product, variant, unitPrice, quantity, hasGiftBox };
}

function shapeCart(cart, items, guestToken) {
  let subtotal = 0;
  const shapedItems = items.map((row) => {
    const lineTotal = Math.round(Number(row.unit_price) * row.quantity * 1000) / 1000;
    subtotal += lineTotal;
    const available =
      Boolean(row.product_is_active) &&
      (row.variant_id
        ? Boolean(row.variant_is_active) && Number(row.variant_stock_quantity) > 0
        : row.product_stock_quantity == null || Number(row.product_stock_quantity) > 0);
    return {
      id: row.id,
      productId: row.product_id,
      variantId: row.variant_id,
      quantity: row.quantity,
      hasGiftBox: Boolean(row.has_gift_box), // unitPrice/lineTotal already include the gift-box add-on when true
      unitPrice: Number(row.unit_price),
      lineTotal,
      available, // false when the product/variant went inactive or out of stock after this was added
      product: {
        nameEn: row.product_name_en,
        nameAr: row.product_name_ar,
        slug: row.product_slug,
        thumbnailUrl: row.product_thumbnail_url,
      },
      variant: row.variant_id
        ? { sku: row.variant_sku, attributes: row.variant_attributes_json }
        : null,
    };
  });

  return {
    id: cart.id,
    currency: cart.currency,
    guestToken: guestToken !== undefined ? guestToken : cart.guest_token,
    items: shapedItems,
    itemCount: shapedItems.reduce((sum, i) => sum + i.quantity, 0),
    subtotal: Math.round(subtotal * 1000) / 1000,
  };
}

// GET /cart — resolves (or silently creates) the current cart for whoever
// is asking. A brand-new guest gets a freshly generated guestToken back in
// the response; the app must store it and send it back as X-Guest-Token on
// every later cart call.
const getCart = asyncHandler(async (req, res) => {
  const { cart, createdNewGuestToken } = await resolveCart(req);
  const items = await repo.listItems(cart.id);
  ok(res, shapeCart(cart, items, createdNewGuestToken !== null ? createdNewGuestToken : cart.guest_token));
});

// POST /cart/items — add (or increment) a line. Body: { productId, variantId?, quantity?, giftBox? }
const addItem = asyncHandler(async (req, res) => {
  const { productId, variantId, quantity, giftBox } = req.body;
  const { cart, createdNewGuestToken } = await resolveCart(req);
  const { unitPrice, hasGiftBox } = await resolveLine(productId, variantId, quantity, giftBox);
  await repo.addItem(cart.id, { productId, variantId: variantId || null, quantity, unitPrice, hasGiftBox });
  const items = await repo.listItems(cart.id);
  created(res, shapeCart(cart, items, createdNewGuestToken !== null ? createdNewGuestToken : cart.guest_token), 'Added to cart');
});

// PATCH /cart/items/:itemId — set an exact quantity. Body: { quantity }
// giftBox isn't editable here — only quantity. The existing item's own
// has_gift_box carries over as-is (re-priced against the product's
// current gift_box_price, same as a plain price refresh); to change the
// gift-box selection, remove the line and add it again.
const updateItem = asyncHandler(async (req, res) => {
  const { cart } = await resolveCart(req);
  const item = await repo.findItemById(req.params.itemId);
  if (!item || item.cart_id !== cart.id) throw ApiError.notFound('Cart item not found');

  const { unitPrice } = await resolveLine(item.product_id, item.variant_id, req.body.quantity, item.has_gift_box);
  await repo.updateItemQuantity(item.id, req.body.quantity, unitPrice);
  const items = await repo.listItems(cart.id);
  ok(res, shapeCart(cart, items), 'Updated');
});

// DELETE /cart/items/:itemId
const removeItem = asyncHandler(async (req, res) => {
  const { cart } = await resolveCart(req);
  const item = await repo.findItemById(req.params.itemId);
  if (!item || item.cart_id !== cart.id) throw ApiError.notFound('Cart item not found');

  await repo.removeItem(item.id);
  const items = await repo.listItems(cart.id);
  ok(res, shapeCart(cart, items), 'Removed');
});

// DELETE /cart — empty the whole cart
const clearCart = asyncHandler(async (req, res) => {
  const { cart } = await resolveCart(req);
  await repo.clearCart(cart.id);
  ok(res, shapeCart(cart, []), 'Cart cleared');
});

// POST /cart/merge — requireAuth. Body: { guestToken }. Call this right
// after login/register with whatever guestToken the app was holding, so
// items added before signing in aren't lost. A missing/unknown guestToken
// is not an error — there may simply be nothing to merge — it just
// returns the user's own (possibly already-existing) cart untouched.
const mergeCart = asyncHandler(async (req, res) => {
  const guestCart = await repo.findCartByGuestToken(req.body.guestToken);
  let cart;
  if (guestCart && guestCart.user_id === null) {
    cart = await repo.mergeGuestCartIntoUser(guestCart, req.user.id);
  } else {
    const resolved = await repo.getOrCreateCart({ userId: req.user.id });
    cart = resolved.cart;
  }
  const items = await repo.listItems(cart.id);
  ok(res, shapeCart(cart, items), 'Cart merged');
});

module.exports = { getCart, addItem, updateItem, removeItem, clearCart, mergeCart };
