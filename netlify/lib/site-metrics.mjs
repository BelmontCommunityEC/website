import { createHash, createHmac, randomBytes } from 'node:crypto';

/**
 * Private, aggregate-only site metrics stored in Netlify Blobs.
 *
 * Store layout (`site-metrics`):
 *   daily/YYYY-MM-DD               aggregate counts kept for ~13 months
 *   salts/YYYY-MM-DD               random secret for that day's visitor IDs, deleted after the day
 *   seen/YYYY-MM-DD/...            first-seen markers for daily uniques, deleted after the day
 *
 * Raw IP addresses are never stored. A visitor ID is an HMAC of the IP and user
 * agent using a secret that only exists for the current Perth day, so IDs can't
 * be linked across days or reversed once the salt is deleted.
 */

export const METRICS_STORE = 'site-metrics';
export const ASSIST_STORE = 'advocacy-metrics';
export const TIME_ZONE = 'Australia/Perth';
export const DAILY_RETENTION_DAYS = 400;
export const REPORT_RANGES = [7, 30, 90, 365];
export const ADMIN_ROLE = 'admin';
export const MAX_BODY_BYTES = 2048;
export const OTHER_KEY = '(other)';
export const SITE_HOSTS = ['belmontcommunityec.org.au', 'www.belmontcommunityec.org.au'];

export const TRACKED_EVENTS = new Set([
  'protect-a-tree:builder-start',
  'protect-a-tree:email-open',
  'protect-a-tree:email-copy',
]);

const LIMITS = { pages: 300, referrers: 100, campaigns: 50, links: 150 };
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
// Rejects names like `toString` that would collide with Object.prototype members.
const isSafeKey = (key) => !UNSAFE_KEYS.has(key) && !(key in Object.prototype);
const BOT_PATTERN =
  /[a-z]bot\/|\bbot\b|crawl|spider|slurp|headless|lighthouse|pingdom|uptime|facebookexternalhit|embedly|curl\/|wget\/|python-requests|httpclient|axios\/|node-fetch|go-http-client/i;

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function localDay(date = new Date()) {
  return dayFormatter.format(date);
}

export function addDays(day, amount) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function isLikelyBot(userAgent) {
  return !userAgent || BOT_PATTERN.test(userAgent);
}

export function normalizePath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 200) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  let path = value.split(/[?#]/)[0].toLowerCase();
  if (!/^[a-z0-9/_\-.~%]*$/.test(path)) return null;
  path = path.replace(/\/{2,}/g, '/');
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  if (/^\/(admin|api|\.netlify)(\/|$)/.test(path)) return null;
  return path;
}

/** Returns a source label, or null for internal navigation (not an entrance). */
export function normalizeReferrer(value, siteHosts) {
  if (value === undefined || value === null || value === '') return 'direct';
  if (typeof value !== 'string' || value.length > 2048) return 'unknown';
  let url;
  try {
    url = new URL(value);
  } catch {
    return 'unknown';
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol === 'android-app:') {
    return /^[a-z0-9.\-_]{1,100}$/.test(host) ? `app:${host}` : 'unknown';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'unknown';
  if (siteHosts.has(host)) return null;
  const source = host.replace(/^(www|m|l|lm|mobile)\./, '');
  return /^[a-z0-9.-]{1,100}$/.test(source) ? source : 'unknown';
}

export function normalizeCampaign(value) {
  if (typeof value !== 'string') return null;
  const campaign = value.trim().toLowerCase();
  return /^[a-z0-9._-]{1,40}$/.test(campaign) && isSafeKey(campaign) ? campaign : null;
}

export function normalizeLinkId(value) {
  if (typeof value !== 'string') return null;
  const link = value.trim();
  return /^[A-Za-z0-9._~:/\-%+]{1,160}$/.test(link) && isSafeKey(link) ? link : null;
}

/** Validates a client payload. Anything unexpected is dropped, never stored. */
export function parseMetric(input, siteHosts) {
  let data = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  const path = normalizePath(data.path);
  if (!path) return null;

  if (data.type === 'pageview') {
    const referrer = normalizeReferrer(data.referrer, siteHosts);
    return { type: 'pageview', path, referrer, campaign: referrer ? normalizeCampaign(data.campaign) : null };
  }
  if (data.type === 'link') {
    const link = normalizeLinkId(data.link);
    return link ? { type: 'link', path, link } : null;
  }
  if (data.type === 'event') {
    return typeof data.name === 'string' && TRACKED_EVENTS.has(data.name)
      ? { type: 'event', path, name: data.name }
      : null;
  }
  return null;
}

export function siteHostsFor(requestUrl) {
  const hosts = new Set(SITE_HOSTS);
  try {
    hosts.add(new URL(requestUrl).hostname.toLowerCase());
  } catch {
    // Ignore malformed URLs; the static host list still applies.
  }
  return hosts;
}

/** Rejects cross-site submissions so other sites can't inflate the counts from visitors' browsers. */
export function isSameOriginRequest(request) {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') return false;
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return siteHostsFor(request.url).has(new URL(origin).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export async function readLimitedBody(request) {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;
  const text = await request.text();
  return new TextEncoder().encode(text).length > MAX_BODY_BYTES ? null : text;
}

export function visitorId(salt, ip, userAgent = '') {
  return createHmac('sha256', salt).update(`${ip}\n${userAgent}`).digest('hex').slice(0, 32);
}

function pathId(path) {
  return createHash('sha256').update(path).digest('hex').slice(0, 24);
}

const saltCache = new Map();

export async function getDailySalt(store, day) {
  const cached = saltCache.get(day);
  if (cached) return cached;
  const key = `salts/${day}`;
  let salt = await store.get(key);
  if (!salt) {
    const fresh = randomBytes(32).toString('base64');
    const result = await store.set(key, fresh, { onlyIfNew: true });
    salt = result.modified ? fresh : await store.get(key);
  }
  if (!salt) throw new Error('Unable to establish the daily metrics salt');
  // Keep only the current day's salt in memory so old salts disappear with the stored copy.
  saltCache.clear();
  saltCache.set(day, salt);
  return salt;
}

export function resetSaltCache() {
  saltCache.clear();
}

async function markFirstSeen(store, key) {
  const result = await store.set(key, '1', { onlyIfNew: true });
  return result.modified;
}

const defaultWait = (attempt) =>
  new Promise((resolve) => setTimeout(resolve, 15 + Math.random() * 40 * (attempt + 1)));

/** Optimistic-concurrency update so simultaneous requests can't overwrite each other's counts. */
export async function updateJSON(store, key, create, mutate, { attempts = 8, wait = defaultWait } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const existing = await store.getWithMetadata(key, { type: 'json' });
    if (existing && !existing.etag) throw new Error(`Missing ETag for ${key}`);
    const doc = existing?.data ?? create();
    mutate(doc);
    const result = existing
      ? await store.setJSON(key, doc, { onlyIfMatch: existing.etag })
      : await store.setJSON(key, doc, { onlyIfNew: true });
    if (result.modified) return true;
    await wait(attempt);
  }
  return false;
}

export function emptyDay(date) {
  return {
    version: 1,
    date,
    pageViews: 0,
    uniqueVisitors: 0,
    pages: {},
    referrers: {},
    campaigns: {},
    links: {},
    events: {},
  };
}

function cappedKey(map, key, limit) {
  if (!isSafeKey(key)) return OTHER_KEY;
  return Object.hasOwn(map, key) || Object.keys(map).length < limit ? key : OTHER_KEY;
}

function increment(map, key, limit) {
  const target = cappedKey(map, key, limit);
  map[target] = (Number(map[target]) || 0) + 1;
}

function applyMetric(doc, metric, { siteNew = false, pageNew = false } = {}) {
  if (metric.type === 'pageview') {
    doc.pageViews += 1;
    if (siteNew) doc.uniqueVisitors += 1;
    const key = cappedKey(doc.pages, metric.path, LIMITS.pages);
    const page = doc.pages[key] ?? { views: 0, uniques: 0 };
    page.views += 1;
    if (pageNew) page.uniques += 1;
    doc.pages[key] = page;
    if (metric.referrer) increment(doc.referrers, metric.referrer, LIMITS.referrers);
    if (metric.campaign) increment(doc.campaigns, metric.campaign, LIMITS.campaigns);
  } else if (metric.type === 'link') {
    increment(doc.links, metric.link, LIMITS.links);
  } else if (metric.type === 'event') {
    doc.events[metric.name] = (Number(doc.events[metric.name]) || 0) + 1;
  }
}

export async function recordMetric(store, input, { ip, userAgent = '', siteHosts, now = new Date(), wait } = {}) {
  if (isLikelyBot(userAgent)) return { recorded: false, reason: 'bot' };
  const metric = parseMetric(input, siteHosts ?? new Set(SITE_HOSTS));
  if (!metric) return { recorded: false, reason: 'invalid' };

  const day = localDay(now);
  const flags = {};
  if (metric.type === 'pageview' && ip) {
    const id = visitorId(await getDailySalt(store, day), ip, userAgent);
    flags.siteNew = await markFirstSeen(store, `seen/${day}/site/${id}`);
    flags.pageNew = await markFirstSeen(store, `seen/${day}/page/${pathId(metric.path)}/${id}`);
  }

  const recorded = await updateJSON(
    store,
    `daily/${day}`,
    () => emptyDay(day),
    (doc) => applyMetric(doc, metric, flags),
    { wait },
  );
  return { recorded, reason: recorded ? undefined : 'conflict' };
}

/** Rate-limit key for the public assist counter, using a daily pseudonymous ID instead of the raw IP. */
export async function assistRateLimitKey(metricsStore, { campaign, event, ip, now = new Date() }) {
  const day = localDay(now);
  const id = visitorId(await getDailySalt(metricsStore, day), `assist\n${ip}`);
  return `ratelimit/${day}/${campaign}/${event}/${id}`;
}

async function mapLimit(items, limit, task) {
  const results = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await task(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

function toRanked(map, labelKey, limit = 100) {
  return Object.entries(map)
    .map(([label, count]) => ({ [labelKey]: label, count }))
    .sort((a, b) => b.count - a.count || String(a[labelKey]).localeCompare(String(b[labelKey])))
    .slice(0, limit);
}

export async function buildReport(store, { days, now = new Date() }) {
  const to = localDay(now);
  const from = addDays(to, -(days - 1));
  const dates = Array.from({ length: days }, (_, index) => addDays(from, index));
  const docs = await mapLimit(dates, 10, (date) => store.get(`daily/${date}`, { type: 'json' }));

  const pages = Object.create(null);
  const referrers = Object.create(null);
  const campaigns = Object.create(null);
  const links = Object.create(null);
  const totals = {
    pageViews: 0,
    uniqueVisitorDays: 0,
    builderStarts: 0,
    emailOpens: 0,
    emailCopies: 0,
    linkClicks: 0,
  };

  const daily = dates.map((date, index) => {
    const doc = docs[index] ?? emptyDay(date);
    const events = doc.events ?? {};
    const linkClicks = Object.values(doc.links ?? {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
    const row = {
      date,
      pageViews: Number(doc.pageViews) || 0,
      uniqueVisitors: Number(doc.uniqueVisitors) || 0,
      builderStarts: Number(events['protect-a-tree:builder-start']) || 0,
      emailOpens: Number(events['protect-a-tree:email-open']) || 0,
      emailCopies: Number(events['protect-a-tree:email-copy']) || 0,
      linkClicks,
    };

    totals.pageViews += row.pageViews;
    totals.uniqueVisitorDays += row.uniqueVisitors;
    totals.builderStarts += row.builderStarts;
    totals.emailOpens += row.emailOpens;
    totals.emailCopies += row.emailCopies;
    totals.linkClicks += row.linkClicks;

    for (const [path, value] of Object.entries(doc.pages ?? {})) {
      const page = pages[path] ?? { path, views: 0, uniqueVisitorDays: 0 };
      page.views += Number(value?.views) || 0;
      page.uniqueVisitorDays += Number(value?.uniques) || 0;
      pages[path] = page;
    }
    for (const [target, source] of [
      [referrers, doc.referrers],
      [campaigns, doc.campaigns],
      [links, doc.links],
    ]) {
      for (const [key, value] of Object.entries(source ?? {})) {
        target[key] = (target[key] ?? 0) + (Number(value) || 0);
      }
    }
    return row;
  });

  return {
    generatedAt: now.toISOString(),
    timeZone: TIME_ZONE,
    from,
    to,
    days,
    totals: {
      ...totals,
      averageDailyUniqueVisitors: days ? Math.round((totals.uniqueVisitorDays / days) * 10) / 10 : 0,
    },
    daily,
    pages: Object.values(pages)
      .sort((a, b) => b.views - a.views || a.path.localeCompare(b.path))
      .slice(0, 100),
    referrers: toRanked(referrers, 'source'),
    campaigns: toRanked(campaigns, 'campaign'),
    links: toRanked(links, 'link'),
  };
}

async function deleteMatching(store, prefix, shouldDelete, { deadline, concurrency }) {
  const keys = [];
  let listed = true;
  for await (const page of store.list({ prefix, paginate: true })) {
    for (const blob of page.blobs) {
      if (shouldDelete(blob.key)) keys.push(blob.key);
    }
    if (Date.now() > deadline) {
      listed = false;
      break;
    }
  }
  let deleted = 0;
  let skipped = false;
  await mapLimit(keys, concurrency, async (key) => {
    if (Date.now() > deadline) {
      skipped = true;
      return;
    }
    await store.delete(key);
    deleted += 1;
  });
  return { deleted, complete: listed && !skipped };
}

/** Deletes expired salts, first-seen markers, rate-limit keys and old daily totals. */
export async function cleanupMetrics({
  metricsStore,
  assistStore,
  now = new Date(),
  budgetMs = 20_000,
  concurrency = 20,
}) {
  const deadline = Date.now() + budgetMs;
  const options = { deadline, concurrency };
  const today = localDay(now);
  const oldestDaily = addDays(today, -DAILY_RETENTION_DAYS);
  const dayFromKey = (key, prefix) => key.slice(prefix.length, prefix.length + 10);

  const results = {
    salts: await deleteMatching(metricsStore, 'salts/', (key) => dayFromKey(key, 'salts/') !== today, options),
    seen: await deleteMatching(metricsStore, 'seen/', (key) => dayFromKey(key, 'seen/') !== today, options),
    daily: await deleteMatching(metricsStore, 'daily/', (key) => dayFromKey(key, 'daily/') < oldestDaily, options),
    // Also removes legacy keys that contained raw IP addresses.
    rateLimits: assistStore
      ? await deleteMatching(assistStore, 'ratelimit/', (key) => !key.startsWith(`ratelimit/${today}/`), options)
      : { deleted: 0, complete: true },
  };
  if (results.salts.complete) resetSaltCacheExcept(today);
  return { today, ...results, complete: Object.values(results).every((result) => result.complete) };
}

function resetSaltCacheExcept(day) {
  for (const key of saltCache.keys()) {
    if (key !== day) saltCache.delete(key);
  }
}
