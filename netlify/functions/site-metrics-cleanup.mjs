import { getStore } from '@netlify/blobs';
import { ASSIST_STORE, METRICS_STORE, cleanupMetrics } from '../lib/site-metrics.mjs';

/**
 * Hourly retention cleanup for private metrics.
 *
 * Deletes previous days' visitor salts and first-seen markers, assist
 * rate-limit keys (including legacy raw-IP keys), and daily totals older than
 * ~13 months.
 */

export const config = {
  schedule: '@hourly',
};

export default async () => {
  const result = await cleanupMetrics({
    metricsStore: getStore({ name: METRICS_STORE, consistency: 'strong' }),
    assistStore: getStore({ name: ASSIST_STORE, consistency: 'strong' }),
  });
  console.log('site-metrics-cleanup', JSON.stringify(result));
};
