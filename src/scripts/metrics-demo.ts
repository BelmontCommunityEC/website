import type { MetricsReport } from './metrics-dashboard';

/** Sample report for previewing the dashboard layout in `astro dev` (`?demo`). Never used in production builds. */
export function demoReport(days: number): MetricsReport {
  const today = new Date();
  const daily = Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (days - 1 - index)));
    const wave = 1 + Math.sin(index / 3) * 0.4;
    const pageViews = Math.round(40 * wave + (index % 7 === 5 ? 35 : 0));
    const uniqueVisitors = Math.round(pageViews * 0.55);
    const builderStarts = Math.round(uniqueVisitors * 0.12);
    return {
      date: date.toISOString().slice(0, 10),
      pageViews,
      uniqueVisitors,
      builderStarts,
      emailOpens: Math.round(builderStarts * 0.5),
      emailCopies: Math.round(builderStarts * 0.2),
      linkClicks: Math.round(pageViews * 0.08),
    };
  });
  const sum = (key: keyof (typeof daily)[number]) => daily.reduce((total, row) => total + Number(row[key]), 0);
  const pageViews = sum('pageViews');
  const uniqueVisitorDays = sum('uniqueVisitors');
  return {
    generatedAt: new Date().toISOString(),
    timeZone: 'Australia/Perth',
    from: daily[0].date,
    to: daily.at(-1)!.date,
    days,
    totals: {
      pageViews,
      uniqueVisitorDays,
      averageDailyUniqueVisitors: Math.round((uniqueVisitorDays / days) * 10) / 10,
      builderStarts: sum('builderStarts'),
      emailOpens: sum('emailOpens'),
      emailCopies: sum('emailCopies'),
      linkClicks: sum('linkClicks'),
    },
    daily,
    pages: [
      { path: '/', views: Math.round(pageViews * 0.35), uniqueVisitorDays: Math.round(uniqueVisitorDays * 0.4) },
      { path: '/advocacy/protect-a-tree', views: Math.round(pageViews * 0.22), uniqueVisitorDays: Math.round(uniqueVisitorDays * 0.2) },
      { path: '/events', views: Math.round(pageViews * 0.14), uniqueVisitorDays: Math.round(uniqueVisitorDays * 0.12) },
      { path: '/events/garvey-park-green-up-jun-2026', views: Math.round(pageViews * 0.08), uniqueVisitorDays: Math.round(uniqueVisitorDays * 0.07) },
      { path: '/get-involved', views: Math.round(pageViews * 0.07), uniqueVisitorDays: Math.round(uniqueVisitorDays * 0.06) },
    ],
    referrers: [
      { source: 'direct', count: Math.round(uniqueVisitorDays * 0.45) },
      { source: 'facebook.com', count: Math.round(uniqueVisitorDays * 0.3) },
      { source: 'google.com', count: Math.round(uniqueVisitorDays * 0.15) },
      { source: 'instagram.com', count: Math.round(uniqueVisitorDays * 0.05) },
    ],
    campaigns: [{ campaign: 'newsletter', count: 18 }],
    links: [
      { link: 'membership-form', count: 12 },
      { link: 'facebook', count: 9 },
      { link: '/submissions/bcec-submission-draft-local-planning-policy-21-2026-05-13.pdf', count: 6 },
      { link: 'belmont.wa.gov.au/docs/ecm/local-planning-policy-no-21-tree-development-exemption-and-assessment-policy.pdf', count: 4 },
    ],
  };
}
