const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const repo = require('./me.repository');
const authRepo = require('../auth/auth.repository');
const packagesRepo = require('../packages/packages.repository');
const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');
const env = require('../../config/env');

function publicUser(user) {
  return {
    id: user.id,
    uuid: user.uuid,
    fullName: user.full_name,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatar_url,
    bio: user.bio,
    emailVerified: Boolean(user.email_verified_at),
    createdAt: user.created_at,
  };
}

// ---- profile ----

const updateProfile = asyncHandler(async (req, res) => {
  const b = req.body;
  const data = {};
  if (b.firstName !== undefined) data.first_name = b.firstName;
  if (b.lastName !== undefined) data.last_name = b.lastName;
  if (b.firstName !== undefined || b.lastName !== undefined) {
    const existing = await authRepo.findUserById(req.user.id);
    const firstName = b.firstName !== undefined ? b.firstName : existing?.first_name;
    const lastName = b.lastName !== undefined ? b.lastName : existing?.last_name;
    data.full_name = [firstName, lastName].filter(Boolean).join(' ').trim() || existing?.full_name;
  }
  if (b.phone !== undefined) data.phone = b.phone;
  if (b.avatarUrl !== undefined) data.avatar_url = b.avatarUrl;
  if (b.bio !== undefined) data.bio = b.bio;

  const user = await repo.updateProfile(req.user.id, data);
  ok(res, publicUser(user), 'Profile updated');
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw ApiError.badRequest('currentPassword and newPassword are required');
  }
  if (String(newPassword).length < 8) {
    throw ApiError.badRequest('newPassword must be at least 8 characters');
  }
  const user = await authRepo.findUserById(req.user.id);
  if (!user) throw ApiError.notFound('Account not found');
  const currentOk = await bcrypt.compare(currentPassword, user.password_hash);
  if (!currentOk) throw ApiError.badRequest('Current password is incorrect');

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await authRepo.updatePassword(user.id, passwordHash);
  ok(res, { changed: true }, 'Password changed');
});

// ---- avatar upload ----

const AVATAR_UPLOAD_DIR = path.join(__dirname, '../../../uploads');
fs.mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });

const AVATAR_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const avatarUploadMiddleware = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, AVATAR_UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, `avatar-${uuidv4()}${path.extname(file.originalname || '').toLowerCase()}`),
  }),
  limits: { fileSize: AVATAR_MAX_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!AVATAR_MIME_TYPES.has(file.mimetype)) return cb(new Error('UNSUPPORTED_TYPE'));
    cb(null, true);
  },
}).single('file');

// Not wrapped in asyncHandler — multer's callback API needs its error
// handled directly so we can turn it into a proper ApiError instead of a raw 500.
function uploadAvatar(req, res, next) {
  avatarUploadMiddleware(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return next(ApiError.badRequest('Image is too large. Max size is 5MB.'));
      if (err.message === 'UNSUPPORTED_TYPE') return next(ApiError.badRequest('Unsupported image type. Use PNG, JPG, WEBP or GIF.'));
      return next(ApiError.badRequest('Upload failed'));
    }
    if (!req.file) return next(ApiError.badRequest('No file uploaded'));
    try {
      const url = `${env.apiBaseUrl}/uploads/${req.file.filename}`;
      const user = await repo.updateProfile(req.user.id, { avatar_url: url });
      ok(res, publicUser(user), 'Avatar updated');
    } catch (e) {
      next(e);
    }
  });
}

// ---- addresses ----

const listAddresses = asyncHandler(async (req, res) => {
  ok(res, await repo.listAddresses(req.user.id));
});

const createAddress = asyncHandler(async (req, res) => {
  const b = req.body;
  if (!b.fullName || !b.phone) throw ApiError.badRequest('fullName and phone are required');
  const data = {
    label: b.label || null,
    full_name: b.fullName,
    phone: b.phone,
    country: b.country || 'Kuwait',
    city: b.city || null,
    area: b.area || null,
    block: b.block || null,
    street: b.street || null,
    building: b.building || null,
    floor: b.floor || null,
    apartment: b.apartment || null,
    is_default: b.isDefault ? 1 : 0,
  };
  if (data.is_default) await repo.clearDefaultAddress(req.user.id);
  const address = await repo.createAddress(req.user.id, data);
  created(res, address);
});

async function ownAddressOr404(userId, addressId) {
  const address = await repo.findAddressById(addressId);
  if (!address || address.user_id !== userId) throw ApiError.notFound('Address not found');
  return address;
}

const updateAddress = asyncHandler(async (req, res) => {
  await ownAddressOr404(req.user.id, req.params.id);
  const b = req.body;
  const data = {};
  if (b.label !== undefined) data.label = b.label;
  if (b.fullName !== undefined) data.full_name = b.fullName;
  if (b.phone !== undefined) data.phone = b.phone;
  if (b.country !== undefined) data.country = b.country;
  if (b.city !== undefined) data.city = b.city;
  if (b.area !== undefined) data.area = b.area;
  if (b.block !== undefined) data.block = b.block;
  if (b.street !== undefined) data.street = b.street;
  if (b.building !== undefined) data.building = b.building;
  if (b.floor !== undefined) data.floor = b.floor;
  if (b.apartment !== undefined) data.apartment = b.apartment;
  if (b.isDefault) {
    await repo.clearDefaultAddress(req.user.id);
    data.is_default = 1;
  }
  const address = await repo.updateAddress(req.params.id, data);
  ok(res, address, 'Updated');
});

const deleteAddress = asyncHandler(async (req, res) => {
  await ownAddressOr404(req.user.id, req.params.id);
  await repo.deleteAddress(req.params.id);
  ok(res, null, 'Deleted');
});

// ---- my orders ----

const listMyOrders = asyncHandler(async (req, res) => {
  const { page, pageSize } = req.query;
  ok(res, await repo.listMyOrders(req.user.id, { page, pageSize }));
});

const getMyOrder = asyncHandler(async (req, res) => {
  const order = await repo.findMyOrder(req.user.id, req.params.id);
  if (!order) throw ApiError.notFound('Order not found');
  const items = await repo.listOrderItems(order.id);
  ok(res, { ...order, items });
});

// ---- my packages ----

const listMyPackages = asyncHandler(async (req, res) => {
  ok(res, await packagesRepo.listUserPackages(req.user.id));
});

// ---- game history ----

const listGameHistory = asyncHandler(async (req, res) => {
  const { page, pageSize } = req.query;
  ok(res, await repo.listGameHistory(req.user.id, { page, pageSize }));
});

module.exports = {
  updateProfile,
  uploadAvatar,
  changePassword,
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  listMyOrders,
  getMyOrder,
  listMyPackages,
  listGameHistory,
};
