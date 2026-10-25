/**
 * Shared rules for drafting a new event from the admin area.
 *
 * Used in the browser (form validation and preview) and in the
 * content-drafts Netlify Function (re-validation and the file that is
 * committed), so both always agree. Registry imports keep the `.ts` extension
 * so this module also runs under Node's type stripping in tests.
 */
import { CATEGORIES } from '../content/category-options.ts';
import { METRICS } from '../content/metrics.ts';
import { ORGANISATIONS, ROLES } from '../content/organisations.ts';

export const MAX_GALLERY_PHOTOS = 12;
export const MAX_PHOTO_BYTES = 4_000_000;
export const DRAFT_BRANCH_PREFIX = 'drafts/event-';

export const CATEGORY_OPTIONS: readonly string[] = CATEGORIES;
export const METRIC_OPTIONS = Object.entries(METRICS).map(([key, label]) => ({ key, label }));
export const ORGANISATION_OPTIONS = Object.entries(ORGANISATIONS).map(([id, org]) => ({
  id,
  name: org.name,
  defaultRole: org.defaultRole as string,
}));
export const ROLE_OPTIONS: readonly string[] = ROLES;

export interface EventStatInput {
  label: string;
  value: string;
  metric?: string;
}

export interface EventPartnerInput {
  org: string;
  role?: string;
}

export interface EventDraftInput {
  title: string;
  slug: string;
  categories: string[];
  date: string;
  startTime: string;
  endTime?: string;
  location: string;
  summary: string;
  registerUrl?: string;
  project?: string;
  impact?: string;
  raised?: string;
  stats?: EventStatInput[];
  outcomes?: string[];
  partners?: EventPartnerInput[];
  cover?: { alt: string; credit?: string } | null;
  gallery?: { alt: string }[];
  body?: string;
  /** Where the numbers came from. Shown to reviewers only, never published. */
  sourceNote?: string;
}

export interface EventDraft {
  title: string;
  slug: string;
  categories: string[];
  start: string;
  end?: string;
  location: string;
  summary: string;
  registerUrl?: string;
  project?: string;
  impact?: string;
  raised?: number;
  stats: { label: string; value: string; metric?: string }[];
  outcomes: string[];
  partners: { org: string; role?: string }[];
  cover: { alt: string; credit?: string } | null;
  gallery: { alt: string }[];
  body: string;
  sourceNote: string;
}

export type DraftErrors = Record<string, string>;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
// Markdown link/image destinations: inline `](url` and reference definitions `[id]: url`.
const INLINE_LINK_RE = /\]\(\s*<?([^)\s>]*)/g;
const REFERENCE_LINK_RE = /^\s{0,3}\[[^\]]+\]:\s*<?(\S*?)>?(?:\s|$)/gm;
const SAFE_LINK_RE = /^(https?:\/\/|mailto:|\/|#)/i;

/** Only allow web, email, site-relative and in-page links, so `javascript:` or `data:` links can't be published. */
export function hasUnsafeLinks(markdown: string) {
  const destinations = [
    ...[...markdown.matchAll(INLINE_LINK_RE)].map((match) => match[1]),
    ...[...markdown.matchAll(REFERENCE_LINK_RE)].map((match) => match[1]),
  ];
  return destinations.some((destination) => !SAFE_LINK_RE.test(destination));
}

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

export function slugify(title: string, date?: string) {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  if (!date || !DATE_RE.test(date)) return base;
  const [year, month] = date.split('-');
  const suffix = `${MONTHS[Number(month) - 1] ?? ''}-${year}`;
  return base ? `${base}-${suffix}` : suffix;
}

export function photoFileName(slug: string, photo: 'cover' | number) {
  return `${slug}-${photo === 'cover' ? 'cover' : photo}.jpg`;
}

export function photoSitePath(slug: string, photo: 'cover' | number) {
  return `/images/projects/events/${slug}/${photoFileName(slug, photo)}`;
}

export function photoRepoPath(slug: string, photo: 'cover' | number) {
  return `public${photoSitePath(slug, photo)}`;
}

export function eventRepoPath(slug: string) {
  return `src/content/events/${slug}.md`;
}

export function isValidSlug(slug: string) {
  return SLUG_RE.test(slug) && slug.length <= 80;
}

function isHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseMoney(value: string) {
  const cleaned = value.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100) / 100;
}

/** Validates and normalises a draft. Returns errors keyed by field name. */
export function validateEventDraft(input: Partial<EventDraftInput>): { draft: EventDraft | null; errors: DraftErrors } {
  const errors: DraftErrors = {};
  const title = text(input.title, 120);
  const slug = text(input.slug, 80).toLowerCase();
  const date = text(input.date, 10);
  const startTime = text(input.startTime, 5);
  const endTime = text(input.endTime, 5);
  const location = text(input.location, 160);
  const summary = text(input.summary, 400);
  const registerUrl = text(input.registerUrl, 500);
  const project = text(input.project, 80);
  const impact = text(input.impact, 160);
  const raisedText = text(input.raised, 20);
  const sourceNote = text(input.sourceNote, 1000);

  if (!title) errors.title = 'Add the event name.';
  if (!isValidSlug(slug)) errors.slug = 'Use lowercase letters, numbers and single hyphens only.';

  const categories = Array.isArray(input.categories)
    ? [...new Set(input.categories.filter((category) => CATEGORY_OPTIONS.includes(category)))]
    : [];
  if (!categories.length) errors.categories = 'Choose at least one category.';

  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) errors.date = 'Choose the event date.';
  if (!TIME_RE.test(startTime)) errors.startTime = 'Choose a start time.';
  if (endTime && !TIME_RE.test(endTime)) errors.endTime = 'Choose a valid end time, or leave it blank.';
  if (endTime && TIME_RE.test(startTime) && endTime <= startTime) errors.endTime = 'The end time must be after the start time.';
  if (!location) errors.location = 'Add where to meet.';
  if (!summary) errors.summary = 'Add a one or two sentence summary.';
  if (registerUrl && !isHttpsUrl(registerUrl)) errors.registerUrl = 'Paste the full registration link, starting with https://';
  if (project && !SLUG_RE.test(project)) errors.project = 'Choose a project from the list.';

  let raised: number | undefined;
  if (raisedText) {
    const parsed = parseMoney(raisedText);
    if (parsed === null) errors.raised = 'Enter an amount like 1243.80, or leave it blank.';
    else raised = parsed;
  }

  const stats = (Array.isArray(input.stats) ? input.stats : [])
    .map((stat) => ({
      label: text(stat?.label, 80),
      value: text(stat?.value, 30),
      metric: text(stat?.metric, 30) || undefined,
    }))
    .filter((stat) => stat.label || stat.value);
  stats.forEach((stat, index) => {
    if (!stat.label || !stat.value) errors[`stats.${index}`] = 'Each number needs both a label and a value.';
    if (stat.metric && !METRIC_OPTIONS.some((option) => option.key === stat.metric)) {
      errors[`stats.${index}`] = 'Choose a home-page total from the list.';
    }
  });

  const outcomes = (Array.isArray(input.outcomes) ? input.outcomes : [])
    .map((outcome) => text(outcome, 240))
    .filter(Boolean)
    .slice(0, 12);

  const partners = (Array.isArray(input.partners) ? input.partners : [])
    .map((partner) => ({ org: text(partner?.org, 80), role: text(partner?.role, 20) || undefined }))
    .filter((partner) => partner.org);
  partners.forEach((partner, index) => {
    if (!ORGANISATION_OPTIONS.some((option) => option.id === partner.org)) errors[`partners.${index}`] = 'Choose a partner from the list.';
    if (partner.role && !ROLE_OPTIONS.includes(partner.role)) errors[`partners.${index}`] = 'Choose a role from the list.';
  });

  const cover = input.cover ? { alt: text(input.cover.alt, 200), credit: text(input.cover.credit, 120) || undefined } : null;
  if (cover && !cover.alt) errors.coverAlt = 'Describe the cover photo for people using screen readers.';

  const gallery = (Array.isArray(input.gallery) ? input.gallery : []).map((photo) => ({ alt: text(photo?.alt, 200) }));
  if (gallery.length > MAX_GALLERY_PHOTOS) errors.gallery = `Add up to ${MAX_GALLERY_PHOTOS} extra photos.`;
  gallery.forEach((photo, index) => {
    if (!photo.alt) errors[`gallery.${index}`] = 'Describe this photo for people using screen readers.';
  });

  // Raw HTML in markdown would be published as-is, so it is neutralised.
  const body = typeof input.body === 'string' ? input.body.replace(/\r\n?/g, '\n').replace(/</g, '&lt;').trim().slice(0, 6000) : '';
  if (hasUnsafeLinks(body)) errors.body = 'Links must be full web addresses starting with https:// (or email addresses starting with mailto:).';

  if (Object.keys(errors).length) return { draft: null, errors };

  return {
    errors,
    draft: {
      title,
      slug,
      categories,
      start: `${date}T${startTime}:00+08:00`,
      end: endTime ? `${date}T${endTime}:00+08:00` : undefined,
      location,
      summary,
      registerUrl: registerUrl || undefined,
      project: project || undefined,
      impact: impact || undefined,
      raised,
      stats,
      outcomes,
      partners,
      cover,
      gallery: gallery.slice(0, MAX_GALLERY_PHOTOS),
      body,
      sourceNote,
    },
  };
}

// JSON strings are valid YAML double-quoted scalars, so this quotes safely.
const yaml = (value: string) => JSON.stringify(value);

/** Builds the event markdown file in the same shape as src/content/events/_TEMPLATE.md. */
export function buildEventMarkdown(draft: EventDraft) {
  const lines = ['---', `title: ${yaml(draft.title)}`, 'categoryChecklist:'];
  for (const category of CATEGORY_OPTIONS) {
    lines.push(`  - '[${draft.categories.includes(category) ? 'x' : ' '}] ${category}'`);
  }
  lines.push(`start: ${draft.start}`);
  if (draft.end) lines.push(`end: ${draft.end}`);
  lines.push(`location: ${yaml(draft.location)}`, `summary: ${yaml(draft.summary)}`);
  if (draft.registerUrl) lines.push(`registerUrl: ${yaml(draft.registerUrl)}`);
  if (draft.project) lines.push(`project: ${draft.project}`);
  if (draft.cover) {
    lines.push(`image: ${photoSitePath(draft.slug, 'cover')}`, `imageAlt: ${yaml(draft.cover.alt)}`);
    if (draft.cover.credit) lines.push(`imageCredit: ${yaml(draft.cover.credit)}`);
  }
  if (draft.impact) lines.push(`impact: ${yaml(draft.impact)}`);
  if (draft.raised !== undefined) lines.push(`raised: ${draft.raised}`);
  if (draft.stats.length) {
    lines.push('stats:');
    for (const stat of draft.stats) {
      lines.push(`  - label: ${yaml(stat.label)}`, `    value: ${yaml(stat.value)}`);
      if (stat.metric) lines.push(`    metric: ${stat.metric}`);
    }
  }
  if (draft.outcomes.length) {
    lines.push('outcomes:', ...draft.outcomes.map((outcome) => `  - ${yaml(outcome)}`));
  }
  if (draft.partners.length) {
    lines.push('partners:');
    for (const partner of draft.partners) {
      lines.push(`  - org: ${partner.org}`);
      if (partner.role) lines.push(`    role: ${partner.role}`);
    }
  }
  if (draft.gallery.length) {
    lines.push('gallery:');
    draft.gallery.forEach((photo, index) => {
      lines.push(`  - src: ${photoSitePath(draft.slug, index + 1)}`, `    alt: ${yaml(photo.alt)}`);
    });
  }
  lines.push('draft: false', '---', '');
  if (draft.body) lines.push(draft.body, '');
  return lines.join('\n');
}
