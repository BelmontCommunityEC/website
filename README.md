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

## Advocacy assists

Advocacy assist counts are recorded server-side by a Netlify Function backed by
Netlify Blobs (`netlify/functions/advocacy-assist.mjs`, served at
`/api/advocacy-assist`). Netlify Blobs is the only source of truth; there is no
committed snapshot.

The Advocacy page, Protect a tree page and home page impact strip fetch the live
totals on load. The numbers stay blank until they load, or if the endpoint is
unavailable (e.g. local `astro dev` without functions). Committee members can
also see the all-time totals on the private metrics dashboard.

## Private site metrics

The site records aggregate usage for a committee-only dashboard at
`/admin/metrics/`. There are no cookies or third-party analytics scripts.

What is recorded (daily totals, Perth time, kept ~13 months):

- Page views and daily unique visitors, overall and per page
- Traffic sources (referring hostname only, e.g. `facebook.com`) and `utm_source` tags
- Key link clicks (membership form, socials, PDFs, external links)
- Protect a tree builder starts, email-app opens and full-email copies

How it works:

- `src/scripts/site-metrics.ts` (loaded by `BaseLayout.astro`) sends small
  beacons to `/api/site-metrics`. It skips `/admin`, localhost, Netlify deploy
  previews, and browsers sending Global Privacy Control or Do Not Track.
- `netlify/functions/site-metrics.mjs` validates the beacon and updates
  `daily/YYYY-MM-DD` in the `site-metrics` Netlify Blobs store. Daily uniques
  use an HMAC of IP + user agent with a random salt that exists only for that
  day; raw IP addresses are never stored.
- `netlify/functions/site-metrics-cleanup.mjs` runs hourly and deletes previous
  days' salts and visitor markers, assist rate-limit keys, and totals older than
  ~13 months.
- `netlify/functions/site-metrics-admin.mjs` serves reports only to Netlify
  Identity users with the `admin` role.
- Shared logic and tests: `netlify/lib/site-metrics.mjs`, run `npm test`.

To label a specific link in the dashboard, add `data-track-link="your-label"`.
To exclude a link, add `data-no-track`. Forms in `src/config.ts` are named
`<key>-form` automatically, and event Register buttons are named
`event-register:<event-slug>`.

Committee-facing explanations of every metric, campaign tags and the link
builder are in [METRICS-GUIDE.md](./METRICS-GUIDE.md) (and on the dashboard).

### Dashboard access setup (one-off, in the Netlify UI)

1. **Project configuration → Identity**: enable Identity.
2. Set **Registration preferences** to **Invite only** before inviting anyone.
3. Optional: enable **Google** under External providers.
4. **Identity** tab → **Invite users**: invite each committee member by email.
   Invitation links open `/admin/login/`, where they set a password.
5. After they accept, open each user, add the role `admin`, and save.
6. Committee members sign in at `/admin/login/`.

To remove access, delete the user or remove the `admin` role in the Identity tab.

To preview the dashboard layout locally with sample data, run `npm run dev` and
open `/admin/metrics/?demo`. Demo mode is removed from production builds.

All `/admin/*` pages except `/admin/login/` are restricted to the `admin` role by
the redirect rules in `netlify.toml`; each admin function also checks the role.

## Content drafting (admin)

Committee admins can draft new events at `/admin/drafts/event/` without editing
files. Submitting creates a pull request; Netlify builds a free Deploy Preview;
a reviewer merges to publish. Committee instructions:
[DRAFTING-GUIDE.md](./DRAFTING-GUIDE.md).

How it works:

- `src/lib/event-draft.ts`: shared validation and markdown output (uses the
  category, metric and organisation registries). Used by the page and the function.
- `src/scripts/photo-prep.ts`: resizes photos in the browser to 2560px on the long
  edge, high-quality JPEG (q0.9, lowered only to stay under the 4 MB upload
  limit), correct orientation, no GPS metadata. Rejects photos under 800px.
- `netlify/functions/content-drafts.mjs`: `start` (creates a `drafts/event-*`
  branch), `photo` (one JPEG per request) and `finish` (commits the event file and
  opens a pull request). Requires the `admin` role, same-origin requests and an
  `X-BCEC-Admin` header.
- `netlify/lib/github-drafts.mjs`: GitHub API client that only writes to
  `drafts/event-*` branches, and only to `src/content/events/<slug>.md` or
  `public/images/projects/events/<slug>/*.jpg`.
- Tests: `npm test` (needs Node 22.6+ for TypeScript type stripping).

To preview the form locally, run `npm run dev` and open `/admin/drafts/event/?demo`
(nothing is sent in demo mode).

### Drafting setup (one-off)

1. **GitHub account for the token (recommended):** create a separate GitHub
   account (e.g. `bcec-website-drafts`) and give it **Write** access to this
   repository only. A token from this account can't bypass the branch rule in
   step 3. Using an admin's own account also works, but then the code's
   draft-branch guard is the only protection if the token leaks.
2. **Fine-grained token:** signed in as that account, go to GitHub **Settings →
   Developer settings → Personal access tokens → Fine-grained tokens → Generate
   new token**:
   - Resource owner: `BelmontCommunityEC`; repository access: only `website`.
   - Permissions: **Contents: Read and write**, **Pull requests: Read and write**.
   - Set an expiry (up to a year) and diary a reminder to renew it.
   - If the organisation requires approval for fine-grained tokens, an owner
     approves it under the organisation's **Settings → Personal access tokens**.
3. **Protect `main`:** repository **Settings → Rules → Rulesets → New branch
   ruleset**: target the default branch, enable **Require a pull request before
   merging** and **Block force pushes**, and add repository admins to the bypass
   list if they still push directly.
4. **Netlify environment variable:** **Project configuration → Environment
   variables → Add a variable**: key `GITHUB_DRAFTS_TOKEN`, value = the token,
   scope **Functions**. Optional overrides: `GITHUB_DRAFTS_REPO` (default
   `BelmontCommunityEC/website`) and `GITHUB_DRAFTS_BASE` (default `main`).
   Redeploy afterwards so the functions pick it up.
5. **Deploy Previews:** confirm **Project configuration → Build & deploy →
   Branches and deploy contexts → Deploy Previews** is set to build pull
   requests (the default). Previews use 0 credits; merging is a normal 15-credit
   production deploy.

Until the token is set, the form works but sending shows "Drafting isn't set up
yet".
