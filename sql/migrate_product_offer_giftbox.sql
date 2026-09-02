-- Product-level (not per-variant) offer price, stock quantity, and an
-- optional gift box add-on, requested for the admin's "Add Product" form.
--
-- stock_quantity is nullable and defaults to NULL on purpose: NULL means
-- "not tracked" (always purchasable, same as every product's behavior
-- today), so every existing product stays exactly as available as it is
-- right now until an admin explicitly sets a real quantity for it. Only a
-- non-NULL quantity of 0 or less puts a product out of stock.
--
-- offer_price is the discounted price to show/charge instead of
-- base_price when set and lower than it (mirrors how a variant's
-- compare_at_price/price pair already works, just at the product level).
ALTER TABLE products
  ADD COLUMN offer_price    DECIMAL(10,3) NULL AFTER base_price,
  ADD COLUMN stock_quantity INT NULL AFTER offer_price,
  ADD COLUMN has_gift_box   TINYINT(1) NOT NULL DEFAULT 0 AFTER stock_quantity,
  ADD COLUMN gift_box_price DECIMAL(10,3) NULL AFTER has_gift_box;
