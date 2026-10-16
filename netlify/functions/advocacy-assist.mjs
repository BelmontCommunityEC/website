import { getStore } from '@netlify/blobs';

/**
 * Server-verified advocacy assist counter (Option B).
 *
 * POST /api/advocacy-assist  { campaign, event }  -> records one assist
 * GET  /api/advocacy-assist                       -> returns current totals
 *
 * Counts are stored in Netlify Blobs. Increments are best-effort (not atomic),
 * which is acceptable at community-scale volume. A per-IP, per-event rate limit
 * reduces accidental double-counting and basic abuse.
 */

export const config = {
  path: '/api/advocacy-assist',
};

// Allowlist of campaigns and the event keys that may increment their totals.
// Mirrors src/content/advocacyCampaigns/*.md `eventKeys`.
const CAMPAIGN_EVENTS = {
  'protect-a-tree': new Set([
    'advocacy-protect-tree-open-email',
    'advocacy-protect-tree-copy-full-email',
  ]),
};

// One count per IP, per event, per window.
const RATE_LIMIT_MS = 60_000;

const STORE_NAME = 'advocacy-metrics';
const TOTAL_KEY = 'total';
const campaignKey = (campaign) => `campaign/${campaign}`;
const rateKey = (campaign, event, ip) => `ratelimit/${campaign}/${event}/${ip}`;

function json(body, statusCode = 200) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

async function readNumber(store, key) {
  const value = await store.get(key);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function readTotals(store) {
  const total = await readNumber(store, TOTAL_KEY);
  const campaigns = {};
  for (const campaign of Object.keys(CAMPAIGN_EVENTS)) {
    campaigns[campaign] = await readNumber(store, campaignKey(campaign));
  }
  return { total, campaigns };
}

export default async (req, context) => {
  const store = getStore(STORE_NAME);

  if (req.method === 'GET') {
    return json(await readTotals(store));
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const campaign = typeof payload?.campaign === 'string' ? payload.campaign : '';
  const event = typeof payload?.event === 'string' ? payload.event : '';
  const events = CAMPAIGN_EVENTS[campaign];

  if (!events || !events.has(event)) {
    return json({ error: 'Unknown campaign or event' }, 400);
  }

  const ip = context.ip ?? 'unknown';
  const now = Date.now();

  // Best-effort rate limit.
  const lastSeen = await readNumber(store, rateKey(campaign, event, ip));
  if (now - lastSeen < RATE_LIMIT_MS) {
    return json({ throttled: true, ...(await readTotals(store)) });
  }
  await store.set(rateKey(campaign, event, ip), String(now));

  // Increment counters (non-atomic; acceptable at this scale).
  const total = (await readNumber(store, TOTAL_KEY)) + 1;
  const campaignTotal = (await readNumber(store, campaignKey(campaign))) + 1;
  await store.set(TOTAL_KEY, String(total));
  await store.set(campaignKey(campaign), String(campaignTotal));

  return json({ ok: true, total, campaign, campaignTotal });
};
