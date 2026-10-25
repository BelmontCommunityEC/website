import { getStore } from '@netlify/blobs';
import {
  METRICS_STORE,
  isSameOriginRequest,
  readLimitedBody,
  recordMetric,
  siteHostsFor,
} from '../lib/site-metrics.mjs';

/**
 * Private site metrics collector.
 *
 * POST /api/site-metrics  { type: 'pageview' | 'link' | 'event', path, ... }
 *
 * Always answers 204 for accepted or ignored payloads so the response reveals
 * nothing about what was counted. Reports are only available through the
 * admin endpoint.
 */

export const config = {
  path: '/api/site-metrics',
  method: 'POST',
};

const noContent = (status = 204) =>
  new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });

export default async (req, context) => {
  if (req.method !== 'POST') return noContent(405);
  if (!isSameOriginRequest(req)) return noContent(403);

  const body = await readLimitedBody(req);
  if (body === null) return noContent(413);

  try {
    await recordMetric(getStore({ name: METRICS_STORE, consistency: 'strong' }), body, {
      ip: context.ip,
      userAgent: req.headers.get('user-agent') ?? '',
      siteHosts: siteHostsFor(req.url),
    });
  } catch (error) {
    console.error('site-metrics: unable to record metric', error instanceof Error ? error.message : error);
  }

  return noContent();
};
