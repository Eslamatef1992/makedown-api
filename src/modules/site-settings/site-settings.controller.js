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
};
