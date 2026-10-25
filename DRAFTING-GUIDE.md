# Drafting website content (for committee admins)

The admin area has a form for drafting new **events**. You fill it in, send it
for review, and a reviewer checks a preview of the website before it goes live.
No files, code or Terminal needed.

- Draft an event: `https://belmontcommunityec.org.au/admin/drafts/event/`
- You need to be signed in with a committee admin account.

(If the site isn't on the custom domain yet, use the `netlify.app` address
instead.)

---

## 1. Draft the event

1. Open **Draft an event** from the admin menu.
2. Fill in **The basics**: name, categories, date and times (Perth time), where
   to meet, a short summary, and the registration link if there is one.
   The **web address** fills itself in from the name and date. Only change it if
   you need to.
3. Add **photos** (optional, see below).
4. After the event, open **After the event** to add the impact line, money
   raised, numbers, outcomes and partners. Only use numbers you can back up, and
   say where they came from in **Where do the numbers come from?** That note is
   for reviewers and is visible on GitHub, but it isn't shown on the website.
5. Check the **Preview**, then select **Send for review**.

Your answers are saved in your browser as you type, so you can come back later.
Photos aren't saved, so add them again if you leave the page.

## 2. Photos

- Choose the **original photos** straight from your camera or phone, not
  screenshots or photos saved from Facebook or Messenger (those are already
  shrunk and blurry).
- The form makes a sharp website copy automatically: up to **2560 pixels** on the
  long side, saved as a high-quality JPEG. That's sharper than the existing photos
  on the site and more than enough for large screens.
- Location details (GPS) are removed from the website copy.
- Photos smaller than 800 pixels are refused, and photos under 1600 pixels get a
  warning, because they'll look soft.
- The **cover photo** is shown as a wide landscape strip. Use a landscape photo,
  or the top and bottom will be cut off (the form warns you).
- Every photo needs a short **description** for people using screen readers,
  e.g. "Volunteers planting seedlings along the river".
- Only use photos BCEC has permission to share, especially of children.
- Keep the full-size originals in the committee's Google Drive folder.

## 3. Review and publish (for reviewers)

When a draft is sent, a review request is created on GitHub and Netlify builds a
**preview** of the whole website with the new event. This is free.

1. Open the review link (the drafter can share it, or find it under **Pull
   requests** on GitHub).
2. Wait a couple of minutes for Netlify to add its **Deploy Preview** link, then
   open it and check the event page and the Events list: dates, wording, numbers
   and photos.
3. To publish: select **Merge pull request**, then **Confirm merge**. The live
   site updates a few minutes later. Each publish uses one production deploy
   (15 Netlify credits).
4. Select **Delete branch** afterwards to keep things tidy.

**Small fixes:** in the review request, open **Files changed**, select the
`…` menu on the event file and **Edit file**. Make the change and commit it to the
same branch. The preview rebuilds automatically.

**Bigger changes or not going ahead:** select **Close pull request** and draft it
again.

If the preview build fails, Netlify shows a red cross on the review request.
That usually means a detail the website can't accept. Nothing on the live site
is affected. Ask the site administrator to have a look.

## What the form can't do yet

- Edit an existing event (for example, adding photos and numbers after an event
  that was published earlier). For now, use the steps in
  [UPDATING-PROJECTS.md](./UPDATING-PROJECTS.md) or ask the site administrator.
- Projects, grants and advocacy submissions. These still use the templates.
