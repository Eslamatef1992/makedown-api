const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const repo = require('./site-settings.repository');

const HOME_VIDEO_KEY = 'home_video_url';
const DELIVERY_FEE_KEY = 'order_delivery_fee';
const CONTACT_INFO_KEYS = {
  companyEmail: 'contact_company_email',
  supportEmail: 'contact_support_email',
  phone: 'contact_phone',
};
// Cash on delivery toggles — one per checkout flow, since a package is a
// digital good (instant activation) and a product is a physical delivery,
// so a store might reasonably want them independent. Products default ON
// (matches the behavior before this toggle existed); packages default OFF
// (packages don't offer cash unless a super admin explicitly turns it on).
const COD_PRODUCTS_KEY = 'cod_enabled_products';
const COD_PACKAGES_KEY = 'cod_enabled_packages';

const adminGetHomeVideo = asyncHandler(async (req, res) => {
  const url = await repo.getValue(HOME_VIDEO_KEY);
  ok(res, { url });
});

const adminSetHomeVideo = asyncHandler(async (req, res) => {
  const url = await repo.setValue(HOME_VIDEO_KEY, req.body.url || null);
  ok(res, { url }, 'Saved');
});

const publicGetHomeVideo = asyncHandler(async (req, res) => {
  const url = await repo.getValue(HOME_VIDEO_KEY);
  ok(res, { url });
});

// Flat delivery fee shown (and actually charged) on the cart/checkout order
// summary — a real, admin-set amount, not the hardcoded 0.00 it used to be.
const adminGetDeliveryFee = asyncHandler(async (req, res) => {
  const fee = await repo.getValue(DELIVERY_FEE_KEY);
  ok(res, { fee: fee !== null ? Number(fee) : 0 });
});

const adminSetDeliveryFee = asyncHandler(async (req, res) => {
  const fee = Number(req.body.fee) || 0;
  await repo.setValue(DELIVERY_FEE_KEY, String(fee));
  ok(res, { fee }, 'Saved');
});

const publicGetDeliveryFee = asyncHandler(async (req, res) => {
  const fee = await repo.getValue(DELIVERY_FEE_KEY);
  ok(res, { fee: fee !== null ? Number(fee) : 0 });
});

async function readContactInfo() {
  const entries = await Promise.all(
    Object.entries(CONTACT_INFO_KEYS).map(async ([field, key]) => [field, await repo.getValue(key)])
  );
  return Object.fromEntries(entries);
}

const adminGetContactInfo = asyncHandler(async (req, res) => {
  ok(res, await readContactInfo());
});

const adminSetContactInfo = asyncHandler(async (req, res) => {
  await Promise.all(
    Object.entries(CONTACT_INFO_KEYS).map(([field, key]) => {
      if (req.body[field] === undefined) return null;
      return repo.setValue(key, req.body[field] || null);
    })
  );
  ok(res, await readContactInfo(), 'Saved');
});

const publicGetContactInfo = asyncHandler(async (req, res) => {
  ok(res, await readContactInfo());
});

async function readCod() {
  const [products, packages] = await Promise.all([repo.getValue(COD_PRODUCTS_KEY), repo.getValue(COD_PACKAGES_KEY)]);
  return {
    products: products === null ? true : products === '1',
    packages: packages === null ? false : packages === '1',
  };
}

const adminGetCod = asyncHandler(async (req, res) => {
  ok(res, await readCod());
});

const adminSetCod = asyncHandler(async (req, res) => {
  const writes = [];
  if (req.body.products !== undefined) writes.push(repo.setValue(COD_PRODUCTS_KEY, req.body.products ? '1' : '0'));
  if (req.body.packages !== undefined) writes.push(repo.setValue(COD_PACKAGES_KEY, req.body.packages ? '1' : '0'));
  await Promise.all(writes);
  ok(res, await readCod(), 'Saved');
});

const publicGetCod = asyncHandler(async (req, res) => {
  ok(res, await readCod());
});

module.exports = {
  adminGetHomeVideo,
  adminSetHomeVideo,
  publicGetHomeVideo,
  adminGetDeliveryFee,
  adminSetDeliveryFee,
  publicGetDeliveryFee,
  adminGetContactInfo,
  adminSetContactInfo,
  publicGetContactInfo,
  adminGetCod,
  adminSetCod,
  publicGetCod,
  COD_PRODUCTS_KEY,
  COD_PACKAGES_KEY,
};
