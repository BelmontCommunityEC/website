import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import type { RefinementCtx } from 'zod';
import { CATEGORIES } from './content/category-options';
import {
  ROLES,
  ORGANISATION_IDS,
  isOrganisationId,
} from './content/organisations';
import { METRIC_KEYS, isMetricKey } from './content/metrics';

const CATEGORY_CHECKBOX_RE = /^\[(x|X| )\]\s+(.+)$/;

// A partner/funder/supporter is referenced by its organisation `id` (see
// src/content/organisations.ts). `role` is an optional per-appearance override
// of the organisation's defaultRole.
const partnerRef = z.object({
  org: z.string(),
  role: z.enum(ROLES).optional(),
});

// Shared stat shape — `metric` (optional) rolls the number into the home-page
// impact strip. Validated against the metrics registry below.
const statEntry = z.object({
  label: z.string(),
  value: z.string(),
  metric: z.string().optional(),
});

// Reject any partner that references an organisation id not in the registry,
// with a message that points the editor to the fix.
function validatePartnerOrgs(
  value: { partners?: { org: string }[] },
  ctx: RefinementCtx,
) {
  value.partners?.forEach((partner, index) => {
    if (!isOrganisationId(partner.org)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['partners', index, 'org'],
        message: `Unknown organisation id "${partner.org}". Use one of: ${ORGANISATION_IDS.join(
          ', ',
        )} — or add it to src/content/organisations.ts.`,
      });
    }
  });
}

// Reject any stat whose `metric` key isn't in the metrics registry, so a typo
// fails the build instead of silently dropping out of the roll-up.
function validateStatMetrics(
  value: { stats?: { metric?: string }[] },
  ctx: RefinementCtx,
) {
  value.stats?.forEach((stat, index) => {
    if (stat.metric && !isMetricKey(stat.metric)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stats', index, 'metric'],
        message: `Unknown metric "${stat.metric}". Use one of: ${METRIC_KEYS.join(
          ', ',
        )} — or add it to src/content/metrics.ts.`,
      });
    }
  });
}

function checkedCategoriesFromChecklist(categoryChecklist?: string[]) {
  if (!categoryChecklist || categoryChecklist.length === 0) return [];
  return categoryChecklist
    .map((item) => {
      const match = CATEGORY_CHECKBOX_RE.exec(item);
      if (!match) return null;
      return match[1].toLowerCase() === 'x' ? match[2].trim() : null;
    })
    .filter((value): value is string => Boolean(value));
}

function validateCategorySelection(
  value: { categories?: string[]; categoryChecklist?: string[]; draft?: boolean },
  ctx: RefinementCtx,
) {
  if (value.draft) return;

  const checklistSelected = checkedCategoriesFromChecklist(value.categoryChecklist);
  const selected = value.categories && value.categories.length > 0
    ? value.categories
    : checklistSelected;

  if (selected.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['categories'],
      message:
        'Choose at least one category via `categories` or mark one `[x]` in `categoryChecklist`.',
    });
  }

  checklistSelected.forEach((category, index) => {
    if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['categoryChecklist', index],
        message: `Unknown category: "${category}". Use values from src/content/category-options.ts.`,
      });
    }
  });

  value.categoryChecklist?.forEach((item, index) => {
    if (!CATEGORY_CHECKBOX_RE.test(item)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['categoryChecklist', index],
        message: 'Checklist items must look like "[x] Category" or "[ ] Category".',
      });
    }
  });

  value.categories?.forEach((category, index) => {
    if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['categories', index],
        message: `Unknown category: "${category}". Use values from src/content/category-options.ts.`,
      });
    }
  });
}

/**
 * PROJECTS collection.
 * To add a new project: copy any file in `src/content/projects/`,
 * rename it (the filename becomes the page URL), and edit the frontmatter
 * fields below plus the body text. That's the whole "template".
 */
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    // Choose categories either as an array or via `categoryChecklist`
    // task-list strings like "[x] Litter Prevention".
    categories: z.array(z.string()).optional(),
    categoryChecklist: z.array(z.string()).optional(),
    // Track-record signal shown as a badge. "past" is a one-off that has
    // finished; "ongoing" runs continuously; "recurring" happens regularly;
    // "upcoming" hasn't started yet.
    status: z
      .enum(['past', 'ongoing', 'recurring', 'upcoming'])
      .default('past'),
    // Cover image path, e.g. "/images/projects/your_project_folder/river.jpg" (optional).
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    // Photo credit shown under the hero image, e.g. "Photo: Jane Doe".
    imageCredit: z.string().optional(),
    location: z.string().optional(),
    // Date the project ran / started (YYYY-MM-DD).
    date: z.coerce.date(),
    // Set to true to hide a project without deleting it.
    draft: z.boolean().default(false),
    // Optional headline stats — the strongest proof-of-delivery signal, e.g.
    // [{ label: "Trees planted", value: "320" }]. Add an optional `metric` key
    // (e.g. "trees") to roll the number up into the home-page impact strip;
    // stats without a `metric` stay on the project page only. Valid metric
    // keys live in src/content/metrics.ts.
    stats: z.array(statEntry).optional(),
    // What the project achieved — shown as a branded checklist, e.g.
    // ["Diverted 40kg of litter from the river", "Engaged 12 local families"]
    outcomes: z.array(z.string()).optional(),
    // Total number of events/activities this project ran — clean-ups, tours,
    // workshops, exhibitions, plantings, etc. Feeds the home-page "Events held"
    // total. Only count events you can substantiate.
    eventsHeld: z.number().optional(),
    // Partners & supporters (external endorsement). Each entry references an
    // organisation by `id` (see src/content/organisations.ts); the name, url
    // and logo come from there. `role` optionally overrides the org's
    // defaultRole for this project.
    partners: z.array(partnerRef).optional(),
    // Optional extra evidence photos.
    gallery: z
      .array(z.object({ src: z.string(), alt: z.string() }))
      .optional(),
  }).superRefine((value, ctx) => {
    validateCategorySelection(value, ctx);
    validatePartnerOrgs(value, ctx);
    validateStatMetrics(value, ctx);
  }),
});

/**
 * GRANTS collection — funding that isn't tied to a single project
 * (operational/capacity grants, e.g. insurance, software, running costs).
 * Each file is one grant "row". The `amount` rolls up into the home-page
 * grants headline, and the `funder` is credited in the supporters roll-up.
 * To add one: copy a file in `src/content/grants/`, rename it, fill in the
 * frontmatter, and set draft to false.
 */
const grants = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/grants' }),
  schema: z
    .object({
      // Who awarded the grant — referenced by organisation `id` (see
      // src/content/organisations.ts). The name and link come from there.
      org: z.string(),
      // Dollar amount, as a plain number (no $ or commas), e.g. 2500.
      amount: z.number(),
      // Optional per-grant role override (defaults to the org's defaultRole).
      role: z.enum(ROLES).optional(),
      // Where the figure comes from (report, receipt) — for our own records.
      source: z.string().optional(),
      // Set to true to exclude a grant without deleting it.
      draft: z.boolean().default(false),
    })
    .superRefine((value, ctx) => {
      if (!isOrganisationId(value.org)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['org'],
          message: `Unknown organisation id "${value.org}". Use one of: ${ORGANISATION_IDS.join(
            ', ',
          )} — or add it to src/content/organisations.ts.`,
        });
      }
    }),
});

/**
 * EVENTS collection — powers the upcoming events calendar.
 * To add an event: copy an existing file in `src/content/events/`,
 * rename it, and fill in the frontmatter. Past events drop off the
 * upcoming list automatically based on their date.
 *
 * An event can either stand alone (e.g. a Bunnings sausage sizzle) or roll
 * up into a parent project via the optional `project` field (e.g. a single
 * clean-up that is part of the wider "Less Mess" project). To avoid
 * double-counting, ONLY standalone (parentless) PAST events add to the
 * home-page totals; events with a parent project are assumed to be already
 * counted inside that project's stats and `eventsHeld`.
 */
const events = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/events' }),
  schema: z.object({
    title: z.string(),
    // Choose categories either as an array or via `categoryChecklist`
    // task-list strings like "[x] Litter Prevention".
    categories: z.array(z.string()).optional(),
    categoryChecklist: z.array(z.string()).optional(),
    // Start date & time, e.g. "2026-08-15T09:00:00+10:00"
    start: z.coerce.date(),
    // Optional end time.
    end: z.coerce.date().optional(),
    location: z.string(),
    summary: z.string(),
    // Google Form registration link for this event.
    registerUrl: z.string().url().optional(),
    // Optional parent project SLUG (the project markdown filename without
    // ".md", e.g. "less-mess"). Leave blank for a standalone event. Events
    // with a parent roll up into that project and do NOT add to home totals.
    project: z.string().optional(),
    // Money raised at this event (community fundraising), as a plain number,
    // e.g. 1243.82. Rolls up into the "raised by our community" home line —
    // kept separate from grant funding.
    raised: z.number().optional(),
    // Cover image for the event's own page, e.g.
    // "/images/projects/events/your_event_folder/planting.jpg".
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    // Photo credit shown under the hero image, e.g. "Photo: Jane Doe".
    imageCredit: z.string().optional(),
    // A short one-line impact statement shown on the "Past events" tile, e.g.
    // "4,000 native plants planted in a single morning". Keep it punchy.
    impact: z.string().optional(),
    // Impact stats for a PAST standalone event — same shape as a project.
    // Add a `metric` (e.g. "people", "volunteers", "litter") to roll the
    // number into the home-page impact strip. Valid keys: src/content/metrics.ts.
    stats: z.array(statEntry).optional(),
    // What the event achieved — shown as a branded checklist on its page.
    outcomes: z.array(z.string()).optional(),
    // Partners & supporters for this event (e.g. the host venue), referenced by
    // organisation `id` (see src/content/organisations.ts).
    partners: z.array(partnerRef).optional(),
    // Optional extra evidence photos for the event page.
    gallery: z
      .array(z.object({ src: z.string(), alt: z.string() }))
      .optional(),
    draft: z.boolean().default(false),
  }).superRefine((value, ctx) => {
    validateCategorySelection(value, ctx);
    validatePartnerOrgs(value, ctx);
    validateStatMetrics(value, ctx);
  }),
});

/**
 * ADVOCACY CAMPAIGNS collection — campaign-level metadata used to scale
 * advocacy tooling and aggregate per-campaign metrics (e.g. Protect a tree).
 */
const advocacyCampaigns = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/advocacyCampaigns' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    // Route to the campaign page, e.g. "/advocacy/protect-a-tree".
    path: z.string(),
    // Optional short display label for campaign-level metric in ribbon contexts.
    metricLabel: z.string().optional(),
    // Event keys that contribute to this campaign total via the advocacy
    // assist counter (Netlify Function + Blobs).
    eventKeys: z.array(z.string()).default([]),
    // Include this campaign in home advocacy roll-up totals.
    includeInHomeRollup: z.boolean().default(true),
    draft: z.boolean().default(false),
  }),
});

/**
 * ADVOCACY SUBMISSIONS collection — source of truth for published submission
 * cards and the auto-updating "SUBMISSIONS LODGED" count.
 */
const advocacySubmissions = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/advocacySubmissions' }),
  schema: z.object({
    title: z.string(),
    type: z.string(),
    date: z.coerce.date(),
    recipient: z.string(),
    summary: z.string(),
    // Optional campaign slug (e.g. "protect-a-tree") for future grouping.
    campaign: z.string().optional(),
    documents: z.array(
      z.object({
        label: z.string(),
        href: z.string(),
      }),
    ),
    draft: z.boolean().default(false),
  }),
});

export const collections = {
  projects,
  events,
  grants,
  advocacyCampaigns,
  advocacySubmissions,
};
