const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const repo = require('./site-settings.repository');

const HOME_VIDEO_KEY = 'home_video_url';

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

module.exports = { adminGetHomeVideo, adminSetHomeVideo, publicGetHomeVideo };
