---
# ── EVENT TEMPLATE ──────────────────────────────────────────────
# HOW TO ADD AN EVENT:
#   1. Make a copy of this file in the same folder (src/content/events/).
#   2. Rename it, e.g. "winter-cleanup.md" (lowercase, dashes, no spaces).
#   3. Fill in the fields below and change draft to false.
#   4. Save, commit and deploy. Past events drop off the list automatically.
#   5. If it does not appear locally, run:
#      npx astro dev stop && rm -rf .astro node_modules/.astro && npx astro sync && npm run dev
# ────────────────────────────────────────────────────────────────
title: Event name here
categoryChecklist:             # mark [x] for each category that applies
  - '[ ] Habitat Restoration'
  - '[ ] Wildlife Protection'
  - '[ ] Litter Prevention'
  - '[ ] Waste Reduction'
  - '[ ] Urban Forest Restoration'
  - '[ ] Environmental Education'
  - '[ ] Community Volunteering'
  - '[ ] Environmental Advocacy'
  - '[ ] Community Partnerships'
start: 2026-01-01T09:00:00+08:00   # date + start time (WA is +08:00)
end: 2026-01-01T11:00:00+08:00     # optional end time — delete this line if not needed
location: Where to meet
summary: One or two sentences describing the event and what to bring.
registerUrl: https://forms.gle/YOUR_EVENT_FORM  # optional — delete if no form. Clicks show in site metrics as event-register:<this file name>
# ── AFTER THE EVENT: EXTEND WITH IMPACT (all optional — delete if not needed) ──
# project: less-mess   # parent project filename (no .md) — ONLY if it belongs to one
# image: /images/projects/events/your_event_folder/your-photo.jpg   # hero photo (also the Past events tile photo)
# imageAlt: Describe the photo for screen readers
# impact: 4,000 native plants planted   # one-line impact shown on the Past events tile
# raised: 1243.82      # money raised — shows on the home "raised by our community" line
# stats:               # roll-up numbers (same metric keys as projects)
#   - label: Residents reached
#     value: '670'
#     metric: people
#   - label: Volunteers involved
#     value: '11'
#     metric: volunteers
# METRIC KEY MAP (use the key in `metric:`; label text is your choice):
#   people      -> Residents reached / Participants / Entrants
#   volunteers  -> Volunteers involved
#   trees       -> Trees planted
#   plants      -> Native plants planted
#   litter      -> Bags of litter collected
#   grant       -> Grant funding (for project/event-level grants only)
#   events      -> AUTO on home page (from project `eventsHeld` + standalone past events)
#   schools     -> AUTO on home page (unique school partners, role: school)
# outcomes:            # shown as a green checklist on the event page
#   - What the event achieved
# partners:            # host / supporter for this event — reference org by `id`
#   - org: bunnings-belmont     # name/url/logo come from src/content/organisations.ts
#   # Add `role:` only to override the org's default role (funder | partner |
#   # patron | supporter | school). Known ids:
#   #   city-of-belmont · keep-australia-beautiful-wa · zaneta-mascarenhas-mp
#   #   cassie-rowe-mla · carnabys-crusaders · optus-stadium · ruth-faulkner-library
#   #   millennium-kids · bunnings-belmont · belmont-city-college · kewdale-primary-school
#   #   carlisle-primary-school · notre-dame-catholic-primary-school
#   #   st-augustines-primary-rivervale
# gallery:             # extra photos on the event page
#   - src: /images/projects/events/your_event_folder/your-photo.jpg
#     alt: Describe the photo
draft: true   # set to false to publish
---
