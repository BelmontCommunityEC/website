# BCEC website

A fast, mobile-first, SEO-friendly website for our community non-profit, built with
[Astro](https://astro.build/) and [Tailwind CSS](https://tailwindcss.com/).

## Purpose

The site exists to serve two goals, in priority order:

1. **Primary — credibility & endorsement.** The site is proof that BCEC is a legitimate,
   well-run associated group. It needs to read as professional and trustworthy to third
   parties who assess us: tender/grant panels, councils and partners, and programs like the
   Canva for Nonprofits licence. Design decisions should favour legitimacy signals —
   clear identity, real projects with outcomes and named partners, consistent polish,
   accurate information, contact details and governance (e.g. our rules/objectives).
2. **Secondary — participation & membership.** Turn interested visitors into volunteers and
   members, and inform the community about projects and events.

When the two goals compete, favour credibility.
<!-- 
 ## Quick start

 ```bash
 npm install       # first time only
 npm run dev       # start local preview at http://localhost:4321
 npm run build     # build the production site into dist/
 npm run preview   # preview the production build locally
 ```
-->
## Everyday maintenance (no coding needed)

### Edit site-wide details

Open [`src/config.ts`](src/config.ts) to change:

- Organisation name & tagline
- Google Form links (membership + event registration)
- Social media links (Instagram, Facebook, email)
- Navigation menu
- Partner logos

### Add an upcoming event

1. Copy `src/content/events/_TEMPLATE.md`.
2. Rename it (e.g. `winter-cleanup.md`).
3. Fill in the details and set `draft: false`.
4. Commit and deploy.

Past events move to the "Past events" list automatically based on their date.

### Add a project

1. Copy `src/content/projects/_TEMPLATE.md`.
2. Rename it — the filename becomes the page address (`/projects/your-name`).
3. Fill in the details, write the story, set `draft: false`.
4. (Optional) Add a photo under `public/images/projects/<project_folder>/` and reference it in `image:`.
5. Commit and deploy.

### Add an advocacy submission

1. Copy `src/content/advocacySubmissions/_TEMPLATE.md`.
2. Rename it (e.g. `transport-plan-2026-08-16.md`).
3. Fill in all frontmatter fields and set `draft: false`.
4. Commit and deploy.

The Advocacy page and home-page advocacy counters update automatically from this collection.

### Add an advocacy campaign

1. Copy `src/content/advocacyCampaigns/_TEMPLATE.md`.
2. Rename it using the campaign slug (e.g. `protect-a-tree.md`).
3. Set campaign metadata and advocacy assist event keys.
4. Commit and deploy.

This collection is the scalable source of truth for future advocacy campaign metrics.
<!--
// ### If a new event or project does not appear
//
// Sometimes Astro's local content cache gets stale after schema/content updates.
//
// 1. Stop the dev server:
//  ```bash
//  npx astro dev stop
//  ```
// 2. Clear Astro caches:
//  ```bash
//  rm -rf .astro node_modules/.astro
//  ```
// 3. Re-sync content collections/types:
//  ```bash
//  npx astro sync
//  ```
// 4. Start dev again:
//  ```bash
//  npm run dev
//  ```
//
// Use this sequence if new content files are missing from pages, or if you see unexpected content-related 500 errors in local development.
-->
### Add / change partner logos

1. Put logo files in `public/logos/`.
2. Reference them via the `logo` field on the matching organisation in [`src/content/organisations.ts`](src/content/organisations.ts) (e.g. `logo: '/logos/city-of-belmont.svg'`).

## Branding / style guide

Colours and fonts live in [`src/styles/global.css`](src/styles/global.css) under `@theme`.
Update those values to match the style guide and the whole site changes.

## Mobile QA (required for UI changes)

This project is mobile-first. For any styling or layout update:

1. Start from small screens first (about 320px+) and use unprefixed classes as mobile defaults.
2. Use `sm:` and above only to enhance larger screens.
3. Avoid desktop-first patterns where large defaults are later reduced for mobile.
4. Prefer wrapping/fluid layouts over fixed widths that can cause overflow.
5. Keep primary actions (buttons/links) readable and comfortably tappable on mobile.

Before merging, verify:

1. No horizontal overflow on narrow viewports.
2. Navigation, CTA buttons, stats cards and partner chips remain readable/tappable on mobile.
3. Tablet and desktop still render correctly after mobile-first adjustments.

## SEO and real domain

- Set the real domain in `astro.config.mjs` (`site:`) and `src/config.ts` (`url:`) — this
  drives canonical URLs, social share tags and the sitemap.
- A `sitemap-index.xml` is generated automatically on build.
- Update the `Sitemap:` line in `public/robots.txt` to your real domain.
- For nicer link previews, add a 1200x630 image under `public/site_assets/`
  (for example `public/site_assets/social-card.png`) and set it as the default
  `image` in `src/components/SEO.astro`.

## Deployment

The site builds to plain static files in `dist/`, so it works on any host. Free
option that connect straight to Git repo and support custom domains:

- **Netlify**: Draft deployment pipeline is set. Once website is finalised and domain is purchased, set build command `npm run build`
  and publish directory `dist`, then add the purchased domain in the Netify dashboard.

For traditional/cPanel hosting: run `npm run build` and upload the contents of `dist/`.

## Advocacy analytics sync

Advocacy assist counts are recorded server-side by a Netlify Function backed by
Netlify Blobs (`netlify/functions/advocacy-assist.mjs`, served at
`/api/advocacy-assist`). The committed snapshot in `src/data/advocacy-metrics.ts`
is refreshed from that endpoint by automation (not edited by hand).

- Local/manual sync: `npm run sync:advocacy-metrics`
- Snapshot check mode: `npm run check:advocacy-metrics`
- GitHub workflow: `.github/workflows/advocacy-metrics-sync.yml` (daily + manual dispatch)

Configuration for the sync script and workflow:

- `SITE_URL` (deployed site origin, e.g. `https://your-site.netlify.app`)
- Optional: `ADVOCACY_ASSIST_ENDPOINT` (full endpoint URL override)

The pages show live totals via a progressive-enhancement fetch to
`/api/advocacy-assist`, falling back to the committed snapshot when the endpoint
is unavailable (e.g. local `astro dev` without functions).
