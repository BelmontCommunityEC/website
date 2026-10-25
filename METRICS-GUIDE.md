# Site metrics guide (for committee admins)

A plain-English reference for the private **Site metrics** dashboard. The same
explanations are on the dashboard itself under each "How this is measured" link.

- Sign in: `https://belmontcommunityec.org.au/admin/login/`
- Dashboard: `https://belmontcommunityec.org.au/admin/metrics/`

(If the site isn't on the custom domain yet, use the `netlify.app` address
instead.)

---

## What's on the dashboard

| Section | What it tells you |
|---|---|
| **Page views** | Every time a page loads, including refreshes and repeat visits. |
| **Avg daily unique visitors** | Roughly how many different devices visit each day. |
| **Protect a tree email builder** | All-time assists (the public tally), plus drafts started, opened in an email app, and copied in the selected period. |
| **Top pages** | Which pages are viewed most. |
| **Traffic sources** | Which website or app visits started from. |
| **Key link clicks** | Clicks on important links: forms, socials, documents, other websites. |
| **Campaign tags** | Visits that arrived through a tagged link (see below). |
| **Download for reports** | Spreadsheet (CSV) files of each table for the selected dates. |
| **Make a trackable link** | Builds tagged links for posts, newsletters and QR codes. |

Choose **7 days**, **30 days**, **90 days** or **12 months** at the top. Reload
the page to see the latest numbers.

---

## Traffic sources

**How it's measured:** when someone arrives from another website, their browser
tells us which site sent them. We keep only the site's name (for example
`facebook.com`), never the full address or search words. Moving between pages on
our own site isn't counted, so each visit is counted once, where it started.

**"Direct or unknown"** means the browser didn't say. That includes:

- people who typed the address or used a bookmark
- many apps that hide where visitors came from: the **Facebook and Instagram
  apps, Messenger, WhatsApp, email apps and QR codes**

So a big "Direct or unknown" number usually means we need to tag more links.

---

## Campaign tags and the link builder

A campaign tag is a label added to the end of a link, like this:

```
https://belmontcommunityec.org.au/events/?utm_source=newsletter
```

When someone visits through that link, `newsletter` is counted under
**Campaign tags**, even if the app hides where they came from. This is the most
reliable way to compare Facebook posts, newsletters and flyers.

### How to make a tagged link

1. Open the dashboard and scroll to **Make a trackable link**.
2. Choose the **page** you want to share.
3. Type **where you'll share it** (or pick a suggestion).
4. Select **Copy link** and paste it into your post, email or QR code generator.

### Tag names to use

Reuse these exactly so results group together:

| Where you're sharing | Tag |
|---|---|
| Facebook post or page | `facebook` |
| Instagram bio or post | `instagram` |
| BCEC newsletter | `newsletter` |
| A one-off email | `email` |
| A printed flyer's QR code | `flyer-` plus where or what, e.g. `flyer-garvey-park` |
| A poster's QR code | `poster-` plus where, e.g. `poster-library` |
| A partner sharing our link | `partner-` plus who, e.g. `partner-city` |

Rules: lowercase letters, numbers and hyphens, up to 40 characters. The link
builder tidies spaces and capitals for you. **Never put people's names or
personal details in a tag.**

---

## Key link clicks

Each click on an important link is counted. Links are named like this:

| Shown as | What it is |
|---|---|
| `membership-form` | The membership Google Form. Every form in the site settings is shown as its name plus `-form`. |
| `event-register:<event>` | An event's **Register** button, e.g. `event-register:garvey-park-green-up-jun-2026` |
| `facebook`, `instagram` | BCEC's social pages |
| `email-bcec` | BCEC's email address |
| `tel:0894777222` | A phone number (this one is the City of Belmont) |
| `/submissions/....pdf` | One of our documents |
| `belmont.wa.gov.au/...` | Any other website: its name and page |

Not counted here:

- links between our own pages (they show up in **Top pages**)
- the Protect a tree "Open draft in your email app" button (it's in the
  **Protect a tree email builder** section instead)

A click shows interest. It doesn't confirm a form was submitted or a document
was read.

---

## Reading the numbers well

- **Compare like with like.** This month against last month is more useful than
  single days.
- **Unique visitors are per day.** They can't be added up into weekly or monthly
  unique visitors: someone who visits on three days counts three times.
- **Shared Wi-Fi** can make several people look like one, and switching from
  Wi-Fi to mobile data can make one person look like two.
- **Not everyone is counted.** Visitors with ad blockers, JavaScript turned off,
  or "Do Not Track" / Global Privacy Control enabled aren't counted. Known bots
  are excluded.
- **Days follow Perth time.** Today's figures keep growing until midnight.
- **Advocacy assists:** the all-time numbers are the official public tally. The
  builder's opens and copies are counted separately and only start from when
  tracking began, so they won't match exactly.

---

## Privacy

- No cookies or advertising trackers are used.
- IP addresses aren't stored. A temporary code is used to estimate daily unique
  visitors, and it's deleted after each day.
- Nothing typed into the Protect a tree email builder is collected.
- Daily totals are kept for about 13 months.
- The public explanation is at `/privacy`.

---

## Managing who has access

Done in the Netlify dashboard, under **Identity → Users**:

- **Add someone:** **Invite users**, then once they've accepted, open their
  account, select **Edit settings**, add the role `admin` and save.
- **Remove someone:** delete their account, or remove the `admin` role.
- **Password reset:** open their account and select **Send reset password email**,
  or they can use "Forgot your password?" on the sign-in page.

Role changes take effect the next time the person signs in.
