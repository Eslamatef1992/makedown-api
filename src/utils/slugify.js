function slugify(input) {
  const base = String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9؀-ۿ\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'item';
}

/**
 * Returns `base`, or `base-2`, `base-3`, ... — whichever is the first slug
 * not already used in the table `repo` points at. Used so admin-created
 * rows always get a slug even when the create form doesn't ask for one.
 */
async function ensureUniqueSlug(repo, base) {
  let candidate = base;
  let suffix = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await repo.findBy('slug', candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

module.exports = { slugify, ensureUniqueSlug };
