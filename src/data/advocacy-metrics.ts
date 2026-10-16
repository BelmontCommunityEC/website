export type AdvocacyMetricsSnapshot = {
  asOfDate: string;
  advocacyAssistsTotal: number;
  campaignAssists: Record<string, number>;
};

// Generated values are seeded safely here and will be updated by sync tooling.
export const advocacyMetrics: AdvocacyMetricsSnapshot = {
  asOfDate: '1970-01-01',
  advocacyAssistsTotal: 0,
  campaignAssists: {
    'protect-a-tree': 0,
  },
};
