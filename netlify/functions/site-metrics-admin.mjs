import { getStore } from '@netlify/blobs';
import { getUser } from '@netlify/identity';
import { ADMIN_ROLE, METRICS_STORE, REPORT_RANGES, buildReport } from '../lib/site-metrics.mjs';

/**
 * Admin-only site metrics report.
 *
 * GET /api/admin/site-metrics?days=7|30|90|365
 *
 * Requires a Netlify Identity user with the `admin` role. This check is the
 * real protection for the data; the dashboard page redirect is only a
 * convenience.
 */

export const config = {
  path: '/api/admin/site-metrics',
  method: 'GET',
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const user = await getUser();
  if (!user) return json({ error: 'Please sign in.' }, 401);
  if (!user.roles?.includes(ADMIN_ROLE)) {
    return json({ error: 'Your account does not have access to site metrics.' }, 403);
  }

  const days = Number(new URL(req.url).searchParams.get('days') ?? 30);
  if (!REPORT_RANGES.includes(days)) return json({ error: 'Unsupported date range.' }, 400);

  try {
    const report = await buildReport(getStore({ name: METRICS_STORE, consistency: 'strong' }), { days });
    return json(report);
  } catch (error) {
    console.error('site-metrics-admin: unable to build report', error instanceof Error ? error.message : error);
    return json({ error: 'Unable to load metrics right now.' }, 500);
  }
};
