import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  OTHER_KEY,
  addDays,
  assistRateLimitKey,
  buildReport,
  cleanupMetrics,
  isLikelyBot,
  isSameOriginRequest,
  localDay,
  normalizePath,
  normalizeReferrer,
  parseMetric,
  readLimitedBody,
  recordMetric,
  resetSaltCache,
  siteHostsFor,
  updateJSON,
} from './site-metrics.mjs';

class MemoryStore {
  constructor() {
    this.entries = new Map();
    this.version = 0;
  }

  nextEtag() {
    this.version += 1;
    return `"${this.version}"`;
  }

  async get(key, { type } = {}) {
    const entry = this.entries.get(key);
    if (!entry) return null;
    return type === 'json' ? JSON.parse(entry.data) : entry.data;
  }

  async getWithMetadata(key, { type } = {}) {
    const entry = this.entries.get(key);
    if (!entry) return null;
    return { data: type === 'json' ? JSON.parse(entry.data) : entry.data, etag: entry.etag, metadata: {} };
  }

  async set(key, data, { onlyIfNew, onlyIfMatch } = {}) {
    const existing = this.entries.get(key);
    if (onlyIfNew && existing) return { modified: false };
    if (onlyIfMatch && existing?.etag !== onlyIfMatch) return { modified: false };
    const etag = this.nextEtag();
    this.entries.set(key, { data: String(data), etag });
    return { modified: true, etag };
  }

  async setJSON(key, data, options) {
    return this.set(key, JSON.stringify(data), options);
  }

  async delete(key) {
    this.entries.delete(key);
  }

  list({ prefix = '', paginate } = {}) {
    const blobs = [...this.entries.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, entry]) => ({ key, etag: entry.etag }));
    if (!paginate) return Promise.resolve({ blobs, directories: [] });
    return (async function* pages() {
      for (let index = 0; index < blobs.length; index += 2) {
        yield { blobs: blobs.slice(index, index + 2), directories: [] };
      }
    })();
  }

  keys(prefix = '') {
    return [...this.entries.keys()].filter((key) => key.startsWith(prefix));
  }
}

const browserUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';
const otherUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const hosts = siteHostsFor('https://belmontcommunityec.netlify.app/api/site-metrics');
const now = new Date('2026-10-22T04:00:00Z');
const noWait = async () => {};

const record = (store, payload, options = {}) =>
  recordMetric(store, JSON.stringify(payload), {
    ip: '203.0.113.10',
    userAgent: browserUA,
    siteHosts: hosts,
    now,
    wait: noWait,
    ...options,
  });

describe('normalisation', () => {
  it('normalises paths and rejects private or malformed ones', () => {
    assert.equal(normalizePath('/Advocacy/Protect-A-Tree/?x=1#top'), '/advocacy/protect-a-tree');
    assert.equal(normalizePath('/'), '/');
    assert.equal(normalizePath('/admin/metrics'), null);
    assert.equal(normalizePath('/api/site-metrics'), null);
    assert.equal(normalizePath('//evil.example'), null);
    assert.equal(normalizePath('/<script>'), null);
    assert.equal(normalizePath('relative'), null);
  });

  it('keeps only the referring host and ignores internal navigation', () => {
    assert.equal(normalizeReferrer('', hosts), 'direct');
    assert.equal(normalizeReferrer('https://l.facebook.com/l.php?u=secret', hosts), 'facebook.com');
    assert.equal(normalizeReferrer('https://www.google.com/search?q=private+query', hosts), 'google.com');
    assert.equal(normalizeReferrer('https://belmontcommunityec.org.au/events', hosts), null);
    assert.equal(normalizeReferrer('android-app://com.google.android.gm/', hosts), 'app:com.google.android.gm');
    assert.equal(normalizeReferrer('not a url', hosts), 'unknown');
  });

  it('drops unknown event names, unsafe link ids and personal-looking values', () => {
    assert.equal(parseMetric({ type: 'event', path: '/', name: 'anything' }, hosts), null);
    assert.equal(parseMetric({ type: 'link', path: '/', link: 'mailto:someone@example.com' }, hosts), null);
    assert.equal(parseMetric({ type: 'link', path: '/', link: '__proto__' }, hosts), null);
    assert.equal(parseMetric({ type: 'link', path: '/', link: 'toString' }, hosts), null);
    assert.equal(parseMetric({ type: 'link', path: '/', link: '__defineGetter__' }, hosts), null);
    assert.equal(parseMetric({ type: 'pageview', path: '/', campaign: 'valueof' }, hosts).campaign, 'valueof');
    assert.equal(parseMetric({ type: 'pageview', path: '/', campaign: 'hasownproperty' }, hosts).campaign, 'hasownproperty');
    assert.deepEqual(parseMetric({ type: 'link', path: '/', link: 'membership-form' }, hosts), {
      type: 'link',
      path: '/',
      link: 'membership-form',
    });
    assert.equal(parseMetric('{not json', hosts), null);
  });

  it('only records campaign tags on entrances', () => {
    assert.equal(
      parseMetric({ type: 'pageview', path: '/', referrer: 'https://belmontcommunityec.org.au/', campaign: 'newsletter' }, hosts)
        .campaign,
      null,
    );
    assert.equal(parseMetric({ type: 'pageview', path: '/', campaign: 'Newsletter' }, hosts).campaign, 'newsletter');
    assert.equal(parseMetric({ type: 'pageview', path: '/', campaign: 'bad value!' }, hosts).campaign, null);
  });

  it('detects common bots without flagging normal browsers', () => {
    assert.equal(isLikelyBot('Mozilla/5.0 (compatible; Googlebot/2.1)'), true);
    assert.equal(isLikelyBot('facebookexternalhit/1.1'), true);
    assert.equal(isLikelyBot(''), true);
    assert.equal(isLikelyBot(browserUA), false);
    assert.equal(isLikelyBot('Mozilla/5.0 (Linux; Android 12; CUBOT X30) Chrome/120 Mobile Safari/537.36'), false);
  });

  it('uses the Perth calendar day', () => {
    assert.equal(localDay(new Date('2026-10-21T16:30:00Z')), '2026-10-22');
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  });
});

describe('request guards', () => {
  it('rejects cross-site requests and oversized bodies', async () => {
    const make = (headers, body = '{}') =>
      new Request('https://belmontcommunityec.org.au/api/site-metrics', { method: 'POST', headers, body });
    assert.equal(isSameOriginRequest(make({ origin: 'https://belmontcommunityec.org.au' })), true);
    assert.equal(isSameOriginRequest(make({ origin: 'https://evil.example' })), false);
    assert.equal(isSameOriginRequest(make({ 'sec-fetch-site': 'cross-site' })), false);
    assert.equal(await readLimitedBody(make({}, 'x'.repeat(3000))), null);
    assert.equal(await readLimitedBody(make({}, '{"ok":true}')), '{"ok":true}');
  });
});

describe('recording', () => {
  let store;
  beforeEach(() => {
    store = new MemoryStore();
    resetSaltCache();
  });

  it('counts page views, daily uniques per site and per page, sources and campaigns', async () => {
    await record(store, { type: 'pageview', path: '/', referrer: 'https://m.facebook.com/', campaign: 'spring' });
    await record(store, { type: 'pageview', path: '/', referrer: 'https://belmontcommunityec.org.au/events' });
    await record(store, { type: 'pageview', path: '/events', referrer: 'https://belmontcommunityec.org.au/' });
    await record(store, { type: 'pageview', path: '/' }, { ip: '198.51.100.7', userAgent: otherUA });

    const day = await store.get('daily/2026-10-22', { type: 'json' });
    assert.equal(day.pageViews, 4);
    assert.equal(day.uniqueVisitors, 2);
    assert.deepEqual(day.pages['/'], { views: 3, uniques: 2 });
    assert.deepEqual(day.pages['/events'], { views: 1, uniques: 1 });
    assert.deepEqual(day.referrers, { 'facebook.com': 1, direct: 1 });
    assert.deepEqual(day.campaigns, { spring: 1 });
  });

  it('never stores raw IP addresses or user agents', async () => {
    await record(store, { type: 'pageview', path: '/', referrer: 'https://www.google.com/search?q=private' });
    await record(store, { type: 'link', path: '/', link: 'membership-form' });
    const dump = JSON.stringify([...store.entries.entries()]);
    assert.equal(dump.includes('203.0.113.10'), false);
    assert.equal(dump.includes('iPhone'), false);
    assert.equal(dump.includes('private'), false);
  });

  it('counts link clicks and allowlisted builder events, ignoring bots', async () => {
    await record(store, { type: 'link', path: '/get-involved', link: 'membership-form' });
    await record(store, { type: 'event', path: '/advocacy/protect-a-tree', name: 'protect-a-tree:builder-start' });
    await record(store, { type: 'event', path: '/advocacy/protect-a-tree', name: 'protect-a-tree:email-open' });
    await record(store, { type: 'pageview', path: '/' }, { userAgent: 'Googlebot/2.1' });
    const day = await store.get('daily/2026-10-22', { type: 'json' });
    assert.deepEqual(day.links, { 'membership-form': 1 });
    assert.deepEqual(day.events, {
      'protect-a-tree:builder-start': 1,
      'protect-a-tree:email-open': 1,
    });
    assert.equal(day.pageViews, 0);
  });

  it('does not lose counts when concurrent updates conflict', async () => {
    // Each retry round lets at least one writer win, so 6 writers fit within the default 8 attempts.
    await Promise.all(
      Array.from({ length: 6 }, () => record(store, { type: 'event', path: '/', name: 'protect-a-tree:email-copy' })),
    );
    const day = await store.get('daily/2026-10-22', { type: 'json' });
    assert.equal(day.events['protect-a-tree:email-copy'], 6);
  });

  it('gives up rather than overwriting after repeated conflicts', async () => {
    await store.setJSON('doc', { count: 0 });
    const conflicting = Object.create(store);
    conflicting.setJSON = async () => ({ modified: false });
    const ok = await updateJSON(conflicting, 'doc', () => ({ count: 0 }), (doc) => (doc.count += 1), {
      attempts: 3,
      wait: noWait,
    });
    assert.equal(ok, false);
    assert.deepEqual(await store.get('doc', { type: 'json' }), { count: 0 });
  });

  it('caps the number of distinct keys per day', async () => {
    for (let index = 0; index < 52; index += 1) {
      await record(store, { type: 'pageview', path: '/', campaign: `c${index}` });
    }
    const day = await store.get('daily/2026-10-22', { type: 'json' });
    assert.equal(Object.keys(day.campaigns).length, 51);
    assert.equal(day.campaigns[OTHER_KEY], 2);
  });

  it('uses a different visitor id each day', async () => {
    await record(store, { type: 'pageview', path: '/' });
    await record(store, { type: 'pageview', path: '/' }, { now: new Date('2026-10-23T04:00:00Z') });
    const ids = store.keys('seen/').filter((key) => key.includes('/site/')).map((key) => key.split('/').pop());
    assert.equal(ids.length, 2);
    assert.notEqual(ids[0], ids[1]);
  });

  it('uses dated, pseudonymous assist rate-limit keys', async () => {
    const key = await assistRateLimitKey(store, {
      campaign: 'protect-a-tree',
      event: 'advocacy-protect-tree-open-email',
      ip: '203.0.113.10',
      now,
    });
    assert.match(key, /^ratelimit\/2026-10-22\/protect-a-tree\/advocacy-protect-tree-open-email\/[a-f0-9]{32}$/);
  });
});

describe('reporting and cleanup', () => {
  let store;
  beforeEach(() => {
    store = new MemoryStore();
    resetSaltCache();
  });

  it('keeps report totals numeric even if stored data contains built-in object names', async () => {
    await store.setJSON('daily/2026-10-22', {
      pageViews: 1,
      uniqueVisitors: 1,
      pages: { '/': { views: 1, uniques: 1 } },
      referrers: { toString: 2 },
      campaigns: {},
      links: { valueOf: 3 },
      events: {},
    });
    const report = await buildReport(store, { days: 1, now });
    assert.deepEqual(report.referrers, [{ source: 'toString', count: 2 }]);
    assert.deepEqual(report.links, [{ link: 'valueOf', count: 3 }]);
  });

  it('builds totals, rankings and a zero-filled daily series', async () => {
    await record(store, { type: 'pageview', path: '/', referrer: 'https://facebook.com/' });
    await record(store, { type: 'event', path: '/advocacy/protect-a-tree', name: 'protect-a-tree:builder-start' });
    await record(store, { type: 'link', path: '/', link: 'facebook' }, { now: new Date('2026-10-21T04:00:00Z') });

    const report = await buildReport(store, { days: 7, now });
    assert.equal(report.from, '2026-10-16');
    assert.equal(report.to, '2026-10-22');
    assert.equal(report.daily.length, 7);
    assert.equal(report.totals.pageViews, 1);
    assert.equal(report.totals.uniqueVisitorDays, 1);
    assert.equal(report.totals.builderStarts, 1);
    assert.equal(report.totals.linkClicks, 1);
    assert.deepEqual(report.pages, [{ path: '/', views: 1, uniqueVisitorDays: 1 }]);
    assert.deepEqual(report.referrers, [{ source: 'facebook.com', count: 1 }]);
    assert.deepEqual(report.links, [{ link: 'facebook', count: 1 }]);
  });

  it('removes old salts, markers, legacy raw-IP keys and expired daily totals', async () => {
    const assistStore = new MemoryStore();
    await record(store, { type: 'pageview', path: '/' }, { now: new Date('2026-10-21T04:00:00Z') });
    await record(store, { type: 'pageview', path: '/' });
    await store.setJSON('daily/2025-09-01', { pageViews: 1 });
    await assistStore.set('ratelimit/protect-a-tree/advocacy-protect-tree-open-email/203.0.113.10', '1');
    await assistStore.set('ratelimit/2026-10-21/protect-a-tree/x/abc', '1');
    await assistStore.set('ratelimit/2026-10-22/protect-a-tree/x/def', '1');
    await assistStore.set('campaign/protect-a-tree', '5');

    const result = await cleanupMetrics({ metricsStore: store, assistStore, now });
    assert.equal(result.complete, true);
    assert.deepEqual(store.keys('salts/'), ['salts/2026-10-22']);
    assert.equal(store.keys('seen/2026-10-21').length, 0);
    assert.ok(store.keys('seen/2026-10-22').length > 0);
    assert.deepEqual(store.keys('daily/').sort(), ['daily/2026-10-21', 'daily/2026-10-22']);
    assert.deepEqual(assistStore.keys().sort(), ['campaign/protect-a-tree', 'ratelimit/2026-10-22/protect-a-tree/x/def']);
  });
});
