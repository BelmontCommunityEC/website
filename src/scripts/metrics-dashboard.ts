/** Rendering helpers for the private metrics dashboard. All values are written with textContent. */

export interface DailyRow {
  date: string;
  pageViews: number;
  uniqueVisitors: number;
  builderStarts: number;
  emailOpens: number;
  emailCopies: number;
  linkClicks: number;
}

export interface MetricsReport {
  generatedAt: string;
  timeZone: string;
  from: string;
  to: string;
  days: number;
  totals: {
    pageViews: number;
    uniqueVisitorDays: number;
    averageDailyUniqueVisitors: number;
    builderStarts: number;
    emailOpens: number;
    emailCopies: number;
    linkClicks: number;
  };
  daily: DailyRow[];
  pages: { path: string; views: number; uniqueVisitorDays: number }[];
  referrers: { source: string; count: number }[];
  campaigns: { campaign: string; count: number }[];
  links: { link: string; count: number }[];
  /** All-time public assist totals (not limited to the selected date range). */
  assists?: { total: number; campaigns: Record<string, number> };
}

const numberFormat = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 1 });
const percentFormat = new Intl.NumberFormat('en-AU', { style: 'percent', maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const shortDateFormat = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export const formatNumber = (value: number) => numberFormat.format(value);
export const formatDate = (day: string) => dateFormat.format(new Date(`${day}T00:00:00Z`));
const formatShortDate = (day: string) => shortDateFormat.format(new Date(`${day}T00:00:00Z`));

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

const sourceLabel = (source: string) => {
  if (source === 'direct') return 'Direct or unknown';
  if (source === 'unknown') return 'Unrecognised source';
  return source;
};

export function renderStats(container: HTMLElement, report: MetricsReport) {
  const { totals } = report;
  const cards: [string, number, string][] = [
    ['Page views', totals.pageViews, 'Every page load, including repeats'],
    ['Avg daily unique visitors', totals.averageDailyUniqueVisitors, 'Distinct devices per day, averaged'],
    ['Builder starts', totals.builderStarts, 'Protect a tree email drafts begun'],
    ['Email app opens', totals.emailOpens, 'Draft opened in an email app'],
    ['Full email copies', totals.emailCopies, 'Whole draft copied to clipboard'],
    ['Key link clicks', totals.linkClicks, 'Forms, socials, PDFs and external links'],
  ];
  container.replaceChildren(
    ...cards.map(([label, value, hint]) => {
      const card = el('div', 'rounded-xl border border-brand-light bg-white p-4');
      card.append(
        el('dt', 'text-sm font-semibold leading-snug text-brand-dark', label),
        el('dd', 'mt-2 font-heading text-2xl font-bold tabular-nums text-ink sm:text-3xl', formatNumber(value)),
        el('dd', 'mt-1 text-xs leading-snug text-muted', hint),
      );
      return card;
    }),
  );
}

export function renderChart(container: HTMLElement, rows: DailyRow[]) {
  const max = Math.max(1, ...rows.map((row) => row.pageViews));
  const bars = el('div', 'flex h-40 items-end gap-px');
  bars.setAttribute('aria-hidden', 'true');
  for (const row of rows) {
    const bar = el('div', 'min-w-0 flex-1 rounded-t-sm bg-brand/80');
    bar.style.height = `${Math.max(row.pageViews ? 2 : 0, (row.pageViews / max) * 100)}%`;
    bar.title = `${formatDate(row.date)}: ${formatNumber(row.pageViews)} page views, ${formatNumber(row.uniqueVisitors)} unique visitors`;
    bars.append(bar);
  }
  const axis = el('div', 'mt-2 flex justify-between gap-2 text-xs text-muted');
  axis.append(el('span', '', formatShortDate(rows[0].date)), el('span', '', formatShortDate(rows.at(-1)!.date)));
  const caption = el('p', 'mt-1 text-xs text-muted', `Daily page views. Tallest bar: ${formatNumber(max)}.`);
  container.replaceChildren(bars, axis, caption);
}

export function renderDailyTable(container: HTMLElement, rows: DailyRow[]) {
  renderTable(
    container,
    ['Date', 'Page views', 'Unique visitors', 'Builder starts', 'Email opens', 'Email copies', 'Link clicks'],
    [...rows].reverse().map((row) => [
      formatDate(row.date),
      row.pageViews,
      row.uniqueVisitors,
      row.builderStarts,
      row.emailOpens,
      row.emailCopies,
      row.linkClicks,
    ]),
  );
}

export function renderAssists(container: HTMLElement, report: MetricsReport) {
  const assists = report.assists;
  if (!assists) {
    container.replaceChildren();
    return;
  }
  const items: [string, number][] = [
    ['All-time Protect a tree assists', assists.campaigns['protect-a-tree'] ?? 0],
    ['All-time advocacy assists', assists.total],
  ];
  container.replaceChildren(
    ...items.map(([label, value]) => {
      const card = el('div', 'rounded-lg border border-brand-light bg-white p-3');
      card.append(
        el('dt', 'text-xs font-semibold uppercase tracking-wide text-muted', label),
        el('dd', 'mt-1 font-heading text-2xl font-bold tabular-nums text-brand-dark', formatNumber(value)),
      );
      return card;
    }),
  );
}

export function renderFunnel(container: HTMLElement, report: MetricsReport) {
  const { builderStarts, emailOpens, emailCopies } = report.totals;
  const share = (value: number) => (builderStarts ? percentFormat.format(value / builderStarts) : '—');
  const steps: [string, number, string][] = [
    ['Started a draft', builderStarts, ''],
    ['Opened in email app', emailOpens, `${share(emailOpens)} of starts`],
    ['Copied the full email', emailCopies, `${share(emailCopies)} of starts`],
  ];
  container.replaceChildren(
    ...steps.map(([label, value, note]) => {
      const item = el('li', 'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-brand-light py-3 last:border-b-0');
      const text = el('span', 'text-sm font-semibold text-ink', label);
      const figures = el('span', 'text-sm text-muted');
      figures.append(el('strong', 'mr-1 font-heading text-lg tabular-nums text-brand-dark', formatNumber(value)));
      if (note) figures.append(document.createTextNode(` ${note}`));
      item.append(text, figures);
      return item;
    }),
  );
}

export function renderTable(container: HTMLElement, headings: string[], rows: (string | number)[][], emptyText = 'Nothing recorded yet.') {
  if (!rows.length) {
    container.replaceChildren(el('p', 'text-sm text-muted', emptyText));
    return;
  }
  const wrapper = el('div', 'overflow-x-auto');
  const table = el('table', 'w-full min-w-full text-left text-sm');
  const head = el('thead', 'text-xs uppercase tracking-wide text-muted');
  const headRow = el('tr');
  headings.forEach((heading, index) => {
    const th = el('th', `py-2 font-semibold ${index ? 'pl-3 text-right' : 'pr-3'}`, heading);
    th.scope = 'col';
    headRow.append(th);
  });
  head.append(headRow);
  const body = el('tbody');
  for (const row of rows) {
    const tr = el('tr', 'border-t border-gray-100');
    row.forEach((value, index) => {
      const text = typeof value === 'number' ? formatNumber(value) : value;
      tr.append(
        el('td', index ? 'py-2 pl-3 text-right tabular-nums whitespace-nowrap' : 'py-2 pr-3 wrap-anywhere text-ink', text),
      );
    });
    body.append(tr);
  }
  table.append(head, body);
  wrapper.append(table);
  container.replaceChildren(wrapper);
}

export function renderRankings(report: MetricsReport, targets: {
  pages: HTMLElement;
  referrers: HTMLElement;
  campaigns: HTMLElement;
  links: HTMLElement;
}) {
  renderTable(
    targets.pages,
    ['Page', 'Views', 'Unique visitors*'],
    report.pages.slice(0, 25).map((page) => [page.path, page.views, page.uniqueVisitorDays]),
  );
  renderTable(
    targets.referrers,
    ['Source', 'Visits'],
    report.referrers.slice(0, 20).map((row) => [sourceLabel(row.source), row.count]),
  );
  renderTable(
    targets.campaigns,
    ['utm_source tag', 'Visits'],
    report.campaigns.slice(0, 20).map((row) => [row.campaign, row.count]),
    'No tagged links used yet.',
  );
  renderTable(
    targets.links,
    ['Link', 'Clicks'],
    report.links.slice(0, 25).map((row) => [row.link, row.count]),
  );
}

const csvCell = (value: string | number) => {
  let text = String(value);
  // Stop spreadsheet apps treating public input as formulas.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

export const toCsv = (headings: string[], rows: (string | number)[][]) =>
  [headings, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = el('a');
  link.href = url;
  link.download = filename;
  link.setAttribute('data-no-track', '');
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function dailyCsv(report: MetricsReport) {
  return toCsv(
    ['Date', 'Page views', 'Unique visitors', 'Builder starts', 'Email app opens', 'Full email copies', 'Key link clicks'],
    report.daily.map((row) => [
      row.date,
      row.pageViews,
      row.uniqueVisitors,
      row.builderStarts,
      row.emailOpens,
      row.emailCopies,
      row.linkClicks,
    ]),
  );
}

export function pagesCsv(report: MetricsReport) {
  return toCsv(
    ['Page', 'Views', 'Unique visitors (sum of daily)'],
    report.pages.map((page) => [page.path, page.views, page.uniqueVisitorDays]),
  );
}

export function sourcesCsv(report: MetricsReport) {
  return toCsv(['Source', 'Visits'], report.referrers.map((row) => [sourceLabel(row.source), row.count]));
}

export function linksCsv(report: MetricsReport) {
  return toCsv(['Link', 'Clicks'], report.links.map((row) => [row.link, row.count]));
}

export function campaignsCsv(report: MetricsReport) {
  return toCsv(['utm_source tag', 'Visits'], report.campaigns.map((row) => [row.campaign, row.count]));
}

/** Matches the server's accepted tag format: lowercase letters, numbers, dots, underscores and hyphens. */
export function normalizeTag(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s/]+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 40)
    .replace(/[-.]+$/, '');
}

export function buildTrackedLink(origin: string, path: string, tag: string) {
  const url = new URL(path, origin);
  url.searchParams.set('utm_source', tag);
  return url.toString();
}
