const repo = require('./cms.repository');
const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');

// ---- pages ----
const listPages = asyncHandler(async (req, res) => ok(res, await repo.listPages()));

const getPage = asyncHandler(async (req, res) => {
  const page = await repo.findPageBySlug(req.params.slug);
  if (!page) throw ApiError.notFound('Page not found');
  ok(res, page);
});

const updatePage = asyncHandler(async (req, res) => {
  const existing = await repo.findPageBySlug(req.params.slug);
  if (!existing) throw ApiError.notFound('Page not found');
  const data = {};
  if (req.body.title !== undefined) data.title = req.body.title;
  if (req.body.contentHtml !== undefined) data.content_html = req.body.contentHtml;
  if (req.admin) data.updated_by_admin_id = req.admin.id;
  const page = await repo.updatePage(req.params.slug, data);
  ok(res, page, 'Updated');
});

// ---- faqs ----
const listFaqs = asyncHandler(async (req, res) => ok(res, await repo.listFaqs()));

const createFaq = asyncHandler(async (req, res) => {
  const item = await repo.createFaq({
    question: req.body.question,
    answer: req.body.answer,
    sort_order: req.body.sortOrder ?? 0,
    is_active: req.body.isActive === false ? 0 : 1,
  });
  created(res, item);
});

const updateFaq = asyncHandler(async (req, res) => {
  const existing = await repo.findFaqById(req.params.id);
  if (!existing) throw ApiError.notFound('FAQ not found');
  const data = {};
  if (req.body.question !== undefined) data.question = req.body.question;
  if (req.body.answer !== undefined) data.answer = req.body.answer;
  if (req.body.sortOrder !== undefined) data.sort_order = req.body.sortOrder;
  if (req.body.isActive !== undefined) data.is_active = req.body.isActive ? 1 : 0;
  const item = await repo.updateFaq(req.params.id, data);
  ok(res, item, 'Updated');
});

const deleteFaq = asyncHandler(async (req, res) => {
  const existing = await repo.findFaqById(req.params.id);
  if (!existing) throw ApiError.notFound('FAQ not found');
  await repo.deleteFaq(req.params.id);
  ok(res, null, 'Deleted');
});

// ---- social links ----
const listSocialLinks = asyncHandler(async (req, res) => ok(res, await repo.listSocialLinks()));

const createSocialLink = asyncHandler(async (req, res) => {
  const item = await repo.createSocialLink({
    platform: req.body.platform,
    url: req.body.url,
    sort_order: req.body.sortOrder ?? 0,
    is_active: req.body.isActive === false ? 0 : 1,
  });
  created(res, item);
});

const updateSocialLink = asyncHandler(async (req, res) => {
  const existing = await repo.findSocialLinkById(req.params.id);
  if (!existing) throw ApiError.notFound('Social link not found');
  const data = {};
  if (req.body.platform !== undefined) data.platform = req.body.platform;
  if (req.body.url !== undefined) data.url = req.body.url;
  if (req.body.sortOrder !== undefined) data.sort_order = req.body.sortOrder;
  if (req.body.isActive !== undefined) data.is_active = req.body.isActive ? 1 : 0;
  const item = await repo.updateSocialLink(req.params.id, data);
  ok(res, item, 'Updated');
});

const deleteSocialLink = asyncHandler(async (req, res) => {
  const existing = await repo.findSocialLinkById(req.params.id);
  if (!existing) throw ApiError.notFound('Social link not found');
  await repo.deleteSocialLink(req.params.id);
  ok(res, null, 'Deleted');
});

// ---- public: active-only variants ----
const publicListFaqs = asyncHandler(async (req, res) => {
  const all = await repo.listFaqs();
  ok(res, all.filter((f) => f.is_active));
});
const publicListSocialLinks = asyncHandler(async (req, res) => {
  const all = await repo.listSocialLinks();
  ok(res, all.filter((s) => s.is_active));
});

module.exports = {
  listPages, getPage, updatePage,
  listFaqs, createFaq, updateFaq, deleteFaq,
  listSocialLinks, createSocialLink, updateSocialLink, deleteSocialLink,
  publicListFaqs, publicListSocialLinks,
};
