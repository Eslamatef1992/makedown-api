const { pool } = require('../../config/db');
const { v4: uuidv4 } = require('uuid');

// ---- cart resolution ----

async function findCartByUserId(userId) {
  const [rows] = await pool.query('SELECT * FROM carts WHERE user_id = ? LIMIT 1', [userId]);
  return rows[0] || null;
}

async function findCartByGuestToken(token) {
  const [rows] = await pool.query('SELECT * FROM carts WHERE guest_token = ? LIMIT 1', [token]);
  return rows[0] || null;
}

async function findCartById(id) {
  const [rows] = await pool.query('SELECT * FROM carts WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function createCart({ userId = null, guestToken = null }) {
  const [result] = await pool.query('INSERT INTO carts SET ?', [{ user_id: userId, guest_token: guestToken }]);
  return findCartById(result.insertId);
}

// The single entry point every cart endpoint resolves through. A logged-in
// user always gets (or gets given) their own user_id-keyed cart — the
// guestToken header is ignored once logged in, merging is a separate,
// explicit step (see mergeGuestCartIntoUser) so a stale/reused guest token
// header can never silently attach someone else's guest cart to an account.
// A guest gets their existing cart by token, or a brand new one — if a
// token was sent but doesn't match any cart (cleared, or just made up), a
// fresh cart is created reusing that same token rather than silently
// swapping it under the client. `createdNewGuestToken` tells the caller
// whether to hand a (new) token back to the client to store.
async function getOrCreateCart({ userId, guestToken }) {
  if (userId) {
    const existing = await findCartByUserId(userId);
    if (existing) return { cart: existing, createdNewGuestToken: null };
    const cart = await createCart({ userId });
    return { cart, createdNewGuestToken: null };
  }

  if (guestToken) {
    const existing = await findCartByGuestToken(guestToken);
    if (existing) return { cart: existing, createdNewGuestToken: null };
    const cart = await createCart({ guestToken });
    return { cart, createdNewGuestToken: guestToken };
  }

  const newToken = uuidv4();
  const cart = await createCart({ guestToken: newToken });
  return { cart, createdNewGuestToken: newToken };
}

// ---- items ----

async function listItems(cartId) {
  const [rows] = await pool.query(
    `SELECT ci.*,
            p.name_en AS product_name_en, p.name_ar AS product_name_ar, p.slug AS product_slug,
            p.thumbnail_url AS product_thumbnail_url, p.is_active AS product_is_active,
            p.stock_quantity AS product_stock_quantity,
            pv.attributes_json AS variant_attributes_json, pv.sku AS variant_sku,
            pv.is_active AS variant_is_active, pv.stock_quantity AS variant_stock_quantity
     FROM cart_items ci
     LEFT JOIN products p ON p.id = ci.product_id
     LEFT JOIN product_variants pv ON pv.id = ci.variant_id
     WHERE ci.cart_id = ?
     ORDER BY ci.id ASC`,
    [cartId]
  );
  return rows;
}

async function findItemById(id) {
  const [rows] = await pool.query('SELECT * FROM cart_items WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

// giftBox is part of what makes a line distinct, same as variantId — a
// gift-boxed unit and a plain unit of the same product/variant are two
// different purchase intents (and two different prices), so they must
// stay two separate rows rather than being merged into one quantity.
async function findItem(cartId, productId, variantId, giftBox) {
  const hasGiftBox = giftBox ? 1 : 0;
  const [rows] = await pool.query(
    variantId
      ? 'SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ? AND variant_id = ? AND has_gift_box = ? LIMIT 1'
      : 'SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ? AND variant_id IS NULL AND has_gift_box = ? LIMIT 1',
    variantId ? [cartId, productId, variantId, hasGiftBox] : [cartId, productId, hasGiftBox]
  );
  return rows[0] || null;
}

// Adding the same product+variant+giftBox selection again increments
// quantity and refreshes the price snapshot to the current price (which
// already includes the gift-box add-on when hasGiftBox is set — see
// cart.controller.js#resolveLine), rather than creating a second row for
// the same line.
async function addItem(cartId, { productId, variantId, quantity, unitPrice, hasGiftBox }) {
  const existing = await findItem(cartId, productId, variantId, hasGiftBox);
  if (existing) {
    await pool.query('UPDATE cart_items SET quantity = quantity + ?, unit_price = ? WHERE id = ?', [
      quantity,
      unitPrice,
      existing.id,
    ]);
    await pool.query('UPDATE carts SET updated_at = NOW() WHERE id = ?', [cartId]);
    return findItemById(existing.id);
  }
  const [result] = await pool.query('INSERT INTO cart_items SET ?', [
    {
      cart_id: cartId,
      product_id: productId,
      variant_id: variantId || null,
      quantity,
      has_gift_box: hasGiftBox ? 1 : 0,
      unit_price: unitPrice,
    },
  ]);
  await pool.query('UPDATE carts SET updated_at = NOW() WHERE id = ?', [cartId]);
  return findItemById(result.insertId);
}

async function updateItemQuantity(id, quantity, unitPrice) {
  await pool.query('UPDATE cart_items SET quantity = ?, unit_price = ? WHERE id = ?', [quantity, unitPrice, id]);
  return findItemById(id);
}

async function removeItem(id) {
  await pool.query('DELETE FROM cart_items WHERE id = ?', [id]);
}

async function clearCart(cartId) {
  await pool.query('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);
}

// Folds a guest cart's items into the user's cart (creating the user's cart
// first if this is their first ever cart activity), combining quantities on
// any product+variant both carts already share, then deletes the now-empty
// guest cart and its token. Called explicitly by the client right after
// login/register — never automatically, so a stale guest token can't merge
// into the wrong account behind the user's back.
async function mergeGuestCartIntoUser(guestCart, userId) {
  const { cart: userCart } = await getOrCreateCart({ userId });
  if (userCart.id === guestCart.id) return userCart; // already the same cart somehow — nothing to merge

  const guestItems = await listItems(guestCart.id);
  for (const item of guestItems) {
    // eslint-disable-next-line no-await-in-loop
    await addItem(userCart.id, {
      productId: item.product_id,
      variantId: item.variant_id,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      hasGiftBox: Boolean(item.has_gift_box),
    });
  }
  await clearCart(guestCart.id);
  await pool.query('DELETE FROM carts WHERE id = ?', [guestCart.id]);
  return findCartById(userCart.id);
}

module.exports = {
  findCartByUserId,
  findCartByGuestToken,
  findCartById,
  createCart,
  getOrCreateCart,
  listItems,
  findItemById,
  findItem,
  addItem,
  updateItemQuantity,
  removeItem,
  clearCart,
  mergeGuestCartIntoUser,
};
