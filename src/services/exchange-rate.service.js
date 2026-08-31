const siteSettingsRepo = require('../modules/site-settings/site-settings.repository');

// Every price in the DB is stored in KWD (see schema.sql — every currency
// column defaults to 'KWD'), so KWD is always the conversion base.
const BASE_CURRENCY = 'KWD';

// Only the currencies the website's country switcher actually offers
// (see website SiteHeader.jsx's COUNTRIES list) — no point caching/shipping
// the ~160 other currencies the free API returns.
const SUPPORTED_CURRENCIES = ['KWD', 'USD', 'SAR', 'AED', 'QAR', 'BHD', 'OMR'];

const FX_API_URL = 'https://open.er-api.com/v6/latest/KWD';
const FX_CACHE_KEY = 'fx_rates_cache';
const FX_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — plenty fresh for retail prices, keeps us well under any free-tier rate limit

// In-process cache so concurrent requests within the same TTL window don't
// all hit the DB — cleared on restart, which is fine since getRates() falls
// straight through to the DB cache (and then the live API) either way.
let memoryCache = null;

function pickSupported(rawRates) {
  const picked = {};
  for (const code of SUPPORTED_CURRENCIES) {
    if (typeof rawRates[code] === 'number') picked[code] = rawRates[code];
  }
  picked[BASE_CURRENCY] = 1; // base-to-base is always 1, whether or not the API echoes it back
  return picked;
}

async function fetchFreshRates() {
  const res = await fetch(FX_API_URL);
  if (!res.ok) throw new Error(`Exchange rate API returned HTTP ${res.status}`);
  const data = await res.json();
  if (data.result !== 'success' || !data.rates) throw new Error('Exchange rate API returned an unexpected payload');
  return {
    base: BASE_CURRENCY,
    rates: pickSupported(data.rates),
    fetchedAt: new Date().toISOString(),
    stale: false,
  };
}

function isFresh(entry) {
  return entry && entry.fetchedAt && Date.now() - new Date(entry.fetchedAt).getTime() < FX_TTL_MS;
}

// Never lets a bad/unreachable upstream API break price display: falls back
// to the last known-good cached rates (even if stale) and, failing that, to
// 1:1 (no conversion) rather than throwing — a slightly stale or flat rate
// is far better than a broken shop page.
async function getRates() {
  if (isFresh(memoryCache)) return memoryCache;

  let dbCache = null;
  try {
    const stored = await siteSettingsRepo.getValue(FX_CACHE_KEY);
    if (stored) dbCache = JSON.parse(stored);
  } catch (err) {
    dbCache = null;
  }

  if (isFresh(dbCache)) {
    memoryCache = dbCache;
    return dbCache;
  }

  try {
    const fresh = await fetchFreshRates();
    memoryCache = fresh;
    siteSettingsRepo.setValue(FX_CACHE_KEY, JSON.stringify(fresh)).catch((err) => {
      console.error('[exchange-rate] failed to persist rate cache:', err.message);
    });
    return fresh;
  } catch (err) {
    console.error('[exchange-rate] live fetch failed, falling back to cache:', err.message);
    if (dbCache) {
      memoryCache = { ...dbCache, stale: true };
      return memoryCache;
    }
    // Absolute last resort: no rates known at all yet (e.g. first ever
    // request and the API is unreachable) — 1:1 keeps every price at its
    // KWD face value instead of the page breaking.
    const flat = {
      base: BASE_CURRENCY,
      rates: SUPPORTED_CURRENCIES.reduce((acc, c) => ({ ...acc, [c]: 1 }), {}),
      fetchedAt: new Date().toISOString(),
      stale: true,
    };
    memoryCache = flat;
    return flat;
  }
}

module.exports = { getRates, BASE_CURRENCY, SUPPORTED_CURRENCIES };
