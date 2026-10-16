# Updating the BCEC website — projects, events & grants

A plain-English guide for committee members. No coding experience needed — you
are just editing text files. Take your time, save, and preview before publishing.

Everything on the site is driven by simple text files. When you edit one and save,
the website rebuilds itself. The golden rules:

- **Never invent numbers.** Only use figures you can back up (reports, receipts,
  Facebook posts). Credibility is the whole point of this site.
- **Keep the punctuation.** In these files, spacing and the `-` dashes matter.
  Copy an existing entry and change the words rather than starting from scratch.
- **Preview before you publish** (see [Step 5](#step-5--preview-your-changes)).

---

## Where things live


| What                         | Folder / file                                                           |
| ------------------------------ | ------------------------------------------------------------------------- |
| Completed & ongoing projects | `src/content/projects/` (one file per project)                          |
| Events (upcoming & past)     | `src/content/events/` (one file per event)                              |
| Photos                       | `public/images/projects/` (organised by project/event subfolders) |
| Grants not tied to a project | `src/content/grants/` (one file per grant)                              |
| Advocacy campaigns           | `src/content/advocacyCampaigns/` (one file per campaign)                |
| Advocacy submissions         | `src/content/advocacySubmissions/` (one file per submission)            |
| Blank starter templates      | `_TEMPLATE.md` in each of the folders above                             |

---

## Step 1 — Decide what you are adding

- **A project** (something BCEC has run or is running, e.g. Less Mess, Go Nuts) →
  go to [Adding or updating a project](#adding-or-updating-a-project).
- **An upcoming event** (a single dated activity people can register for) →
  go to [Adding an upcoming event](#adding-an-upcoming-event).
- **A grant with no project attached** (e.g. an operational/capacity grant) →
  go to [Adding a non-project grant](#adding-a-non-project-grant).

---

## Adding or updating a project

Projects appear on the **Projects** page, get their own page (e.g.
`/projects/less-mess`), and their numbers roll up into the **home-page impact
strip** ("Trees planted", "Events held", grants total, etc.).

### Step 2 — Create the file

1. Open the `src/content/projects/` folder.
2. Make a **copy** of `_TEMPLATE.md` (or copy an existing project like
   `less-mess.md` — often easier).
3. Rename the copy using **lowercase letters and dashes, no spaces**, e.g.
   `park-cleanup-2026.md`. **The filename becomes the web address:**
   `park-cleanup-2026.md` → `/projects/park-cleanup-2026`.

### Step 3 — Fill in the details (the part above the `---`)

This top section is called the "frontmatter". Fill in these fields:


| Field        | Required?         | What to put                                                                                                                                                                                     |
| -------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`      | Yes               | The project name, e.g.`Less Mess`.                                                                                                                                                              |
| `summary`    | Yes               | One sentence shown on cards and lists.                                                                                                                                                          |
| `categories` | Yes               | One or more labels from `src/content/category-options.ts` (`PROJECT_CATEGORIES`), e.g. `Litter Prevention`, `Community Education`.                                                          |
| `status`     | Yes               | `past`, `ongoing`, `recurring`, or `upcoming` (shows as a badge).                                                                                                                               |
| `location`   | Optional          | e.g.`City of Belmont`.                                                                                                                                                                          |
| `date`       | Yes               | When it ran/started, format`YYYY-MM-DD`, e.g. `2025-05-01`.                                                                                                                                     |
| `eventsHeld` | Optional          | A single number: total events/activities this project ran (clean-ups, tours, workshops, exhibitions, plantings). Feeds the home "Events held" total.**Only count events you can substantiate.** |
| `image`      | Optional          | Cover photo path, e.g.`/images/projects/your_project_folder/your-photo.jpg` (add the photo to that folder first).                                                                                                   |
| `imageAlt`   | If you set`image` | Describe the photo for screen readers.                                                                                                                                                          |
| `stats`      | Optional          | Highlight numbers — see below.                                                                                                                                                                 |
| `outcomes`   | Optional          | Bullet list of what the project achieved (shown as green ticks).                                                                                                                                |
| `partners`   | Optional          | Funders, partners, supporters, schools — see below.                                                                                                                                            |
| `gallery`    | Optional          | Extra photos — see below.                                                                                                                                                                      |
| `draft`      | Yes               | `true` = hidden, `false` = live. Leave `true` until you're ready.                                                                                                                               |

**Stats** (the highlight numbers). Each stat has a `label` and a `value`. Add an
optional `metric` key to make the number count toward the home-page totals:

```yaml
stats:
  - label: Trees planted
    value: '60+'
    metric: trees          # rolls into the home "Trees planted" total
  - label: Community clean-ups
    value: '8'             # NO metric = shows on this page only, not the home total
  - label: Grant funding
    value: '$6,650'
    metric: grant          # rolls into the home grants headline ($ total)
```

Recognised `metric` keys that roll up to the home page: `trees`, `plants`
(Native plants planted), `people` (Residents reached), `volunteers` (Volunteers
involved), `litter` (Bags of litter collected), `grant` (grants headline).
**Do not** add `metric: events` or `metric: schools` — those two totals are
worked out automatically (see the note below). Put a number in quotes if it has a
`+`, `$` or comma, e.g. `'100+'`, `'$6,650'`.

> **How "Events held" and "Schools involved" are counted (automatic):**
>
> - **Events held** = the sum of every project's `eventsHeld` number, plus one
>   for each past **standalone** event (an event with no parent project, like a
>   Bunnings sausage sizzle). So set `eventsHeld` on each project; don't add an
>   events stat.
> - **Schools involved** = the number of unique schools listed in `partners`
>   with `role: school` across all projects (a school helping on two projects is
>   only counted once). So list schools as partners and the count takes care of
>   itself.

**Partners** (external endorsement — funders, councils, schools):

```yaml
partners:
  - name: Keep Australia Beautiful WA
    url: https://www.wa.gov.au/organisation/keep-australia-beautiful-wa
    role: funder            # role: funder | partner | supporter | school
  - name: Carlisle Primary School
    role: school            # url is optional — leave it out if there isn't one
```

The `role` controls which group they appear under on the home page:
`funder` → "Funders & grants", `partner` → "Delivery partners",
`supporter` → "Supporters", `school` → "Participating schools & groups".

**Gallery** (extra photos). Add the image files under
`public/images/projects/<project_or_event_folder>/` first, then list them:

```yaml
gallery:
  - src: /images/projects/less_mess/Cleanup_Less_Mess.jpg
    alt: Volunteers filling bags at a community clean-up
```

### Step 4 — Write the story (below the `---`)

Under the line of three dashes, write the project story in plain text. Use
`## Heading` for section headings, `-` for bullet points, `**bold**` for bold,
and `[link text](https://...)` for links. Finish with the verified headline
numbers to reinforce credibility.

### To UPDATE an existing project

Open its file in `src/content/projects/`, change the numbers or text, and save.
For example, to correct the events count, change the `eventsHeld` number. To add
a new stat, copy an existing `- label:` block and edit it.

---

## Adding an event

An event is a single dated activity. Every event gets its own page (e.g.
`/events/garvey-park-green-up`) that **grows over its lifecycle**:

- **Before the day** — keep it simple to capture interest: a title, date/time,
  location, a one-line `summary`, and a `registerUrl`. That's all you need.
- **After the day** — come back and **extend it to capture the impact**: add a
  hero `image`, a one-line `impact` statement, `stats`, `outcomes`, `raised` and
  a photo `gallery`. The page fills out automatically and the numbers roll up to
  the home page. You don't create a new file — you just edit the same one.

> Once an event's date has passed it moves to the **Past events** section on the
> Events page, shown as a photo tile with its one-line `impact`. Until you add
> the write-up, its page shows a friendly "we're still collating the impact"
> note and the tile reads "Write-up coming soon" — so nothing ever looks broken.

There are two kinds of event and the same file covers both:

- **Upcoming events** (future date) show on the **Events** page so people can
  register, and drop off the upcoming list automatically once the date passes.
- **Past events** (like the Bunnings sausage sizzle or the Garvey Park Green-up)
  record what we did; their numbers roll up into the home-page totals.

**Does this event belong to a project?** If it's one of many activities inside a
wider project (e.g. a single clean-up that's part of *Less Mess*), set the
`project` field to that project's filename (without `.md`). It then "belongs" to
the project and is **not** counted separately, to avoid double-counting — the
project's own `eventsHeld` and stats already cover it. If it stands on its own
(no parent), leave `project` out.

1. Open `src/content/events/`.
2. Copy `_TEMPLATE.md` (or an existing event) and rename it, e.g.
   `river-cleanup-2026.md`.
3. Fill in the frontmatter. A simple **upcoming** event:

```yaml
title: Community River Clean-up
categories:
  - Community Outreach
start: 2026-08-15T09:00:00+08:00   # date & time (WA is +08:00)
end: 2026-08-15T11:00:00+08:00     # optional finish time
location: Garvey Park, Ascot
summary: Join us for a morning clean-up along the Swan River foreshore.
registerUrl: https://forms.gle/your-google-form   # optional registration link
draft: false                        # false = live, true = hidden
```

A **past standalone** event that should roll up into the home totals (this is how
the Bunnings sausage sizzle is recorded). This is also what an upcoming event
above looks like once you come back and **extend it with the impact** — the extra
fields (`image`, `stats`, `outcomes`, `raised`, `gallery`) are all optional:

```yaml
title: Bunnings Community Sausage Sizzle
categories:
  - Community Fundraising
  - Community Outreach
start: 2026-01-31T08:00:00+08:00
location: Bunnings Belmont
summary: A community fundraising sausage sizzle run by BCEC volunteers.
image: /images/projects/events/your_event_folder/your-photo.jpg       # optional hero photo for the event page
imageAlt: Describe the photo for screen readers
impact: $1,243.82 raised by 11 volunteers   # one-line summary for the Past events tile
raised: 1243.82                     # money we raised — its OWN "raised by our
                                    # community" line, never counted as a grant
stats:
  - label: Residents reached
    value: '670'
    metric: people                  # rolls into the home totals (same keys as projects)
  - label: Volunteers involved
    value: '11'
    metric: volunteers
outcomes:                           # optional — shown as a green checklist
  - Sold around 670 sausages to the local community
partners:
  - name: Bunnings Belmont
    role: supporter                 # the host — credited in the supporters list
gallery:                            # optional extra photos
  - src: /images/projects/events/your_event_folder/sizzle.jpg
    alt: BCEC volunteers at the barbecue
# project: less-mess                # <- add this ONLY if it belongs to a project
draft: false
```

4. Save. Set `draft: false` when you're ready for it to show.

> **Category list location:** update allowed category labels in
> `src/content/category-options.ts` (`PROJECT_CATEGORIES` and
> `EVENT_CATEGORIES`). Templates point to this file so everyone uses the same
> set of labels.

> **Money we raise ourselves** (a sizzle, a stall, a raffle) goes in the event's
> `raised` field and shows on the home page as **"raised by our community"** —
> deliberately kept separate from grant funding so funders and grants stay
> distinct and credible. Never put fundraising into a grant file.
>
> **Tip:** If a project runs lots of small activities you don't want to list one
> by one, just bump the project's `eventsHeld` count instead of adding an event
> file for each.

---

## Adding a non-project grant

Some grants fund the organisation itself (insurance, software, running costs)
rather than a public project — for example the **Swan Volunteer Grant ($2,500)**.
We still count the money and credit the funder, but we don't create a thin
project page. These grants live in their own markdown folder,
`src/content/grants/` — **one file per grant**, just like projects and events.

---

## Adding an advocacy submission

Use this when BCEC has lodged a formal letter or consultation response and you
want it listed on the Advocacy page and included in the **Submissions lodged**
counter.

1. Open `src/content/advocacySubmissions/`.
2. Copy `_TEMPLATE.md` and rename it with lowercase words and dashes.
3. Fill in all fields in the frontmatter:
  - `title`, `type`, `date`, `recipient`, `summary`
  - `documents` list with one or more `label` + `href` pairs
  - `draft: false` when ready to publish
4. Save and preview.

Notes:

- The file body under the second `---` can stay short.
- The advocacy page list and counters update automatically from these files.

---

## Advocacy metrics (ADVOCACY ASSISTS)

The **ADVOCACY ASSISTS** and campaign assist totals are stored in:

- `src/data/advocacy-metrics.ts`

This file is refreshed by automation from the advocacy assist counter endpoint
(`/api/advocacy-assist`). Do not
hand-edit these numbers unless troubleshooting.

Operational commands:

- `npm run sync:advocacy-metrics` (refresh snapshot)
- `npm run check:advocacy-metrics` (verify snapshot is current)

### Step — Create the grant file

1. Open `src/content/grants/`.
2. Make a copy of `_TEMPLATE.md` (or copy `swan-volunteer-grant.md`).
3. Rename it using lowercase-and-dashes, e.g. `community-grant-2026.md`.
4. Fill in the frontmatter:

```yaml
funder: Zaneta Mascarenhas MP, Member for Swan   # who awarded it
amount: 2500                                     # dollars only, no $ or commas
url: https://www.zanetamascarenhas.com.au/grants/  # optional link
role: funder                                     # funder | partner | supporter | school
source: "Swan Volunteer Grant — Treasurer's Report 27/08/2025."  # your record of the figure
draft: false                                     # false = counted, true = hidden
```

That's it — saving does **both** jobs automatically:

- the `amount` is added to the home-page **"secured in grants & funding"** headline, and
- the `funder` is credited under **"Funders & grants"** in the supporters list.

> **Only enter a figure you can back up** (report, receipt, letter). For
> government volunteer grants the `funder` is usually the **elected member's
> name**. To remove a grant from the totals without deleting it, set
> `draft: true`.

---

## Step 5 — Preview your changes

Before publishing, view the site on your own computer:

1. Open the Terminal in the project folder.
2. Run: `npm run dev`
3. Open the address it prints (usually `http://localhost:4321`) in your browser.
4. Click around — check the project page, the home-page numbers and the
   Funders & grants list all look right.

> **If a number doesn't update** after editing a project's frontmatter or the
> grant fields, the preview may be caching old data. Stop and fully refresh it:
>
> ```sh
> npx astro dev stop
> rm -rf .astro node_modules/.astro
> npx astro sync
> npm run dev
> ```

---

## Step 6 — Publish

When you're happy with the preview:

1. Set `draft: false` on anything you want to go live.
2. Save all files.
3. Commit and deploy (or hand the files to whoever manages the deployment).

---

## Quick checklist

- [ ]  Filename is lowercase-with-dashes and reads well as a web address.
- [ ]  Every number can be backed up by a report, receipt or post.
- [ ]  `date` is `YYYY-MM-DD`; event times include `+08:00` for WA.
- [ ]  Photos were added under `public/images/projects/...` before being referenced.
- [ ]  Schools listed as `role: school` partners; events counted in `eventsHeld`.
- [ ]  Standalone event: real `raised` amount and stats; a project event has its `project:` set.
- [ ]  Non-project grant: added a file in `src/content/grants/` with a real `amount` and `source`.
- [ ]  Previewed locally, then set `draft: false` and deployed.
