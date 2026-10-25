import { getUser } from '@netlify/identity';
import {
  MAX_PHOTO_BYTES,
  MAX_GALLERY_PHOTOS,
  buildEventMarkdown,
  eventRepoPath,
  isValidSlug,
  photoRepoPath,
  validateEventDraft,
} from '../../src/lib/event-draft.ts';
import { GitHubError, createGitHubClient, draftBranchName, githubConfig, isDraftBranch } from '../lib/github-drafts.mjs';
import { ADMIN_ROLE, isSameOriginRequest } from '../lib/site-metrics.mjs';

/**
 * Admin-only content drafting. Each endpoint requires a Netlify Identity user
 * with the `admin` role and a same-origin request carrying `X-BCEC-Admin`.
 *
 * POST /api/admin/drafts/start   { slug }                    -> { branch }
 * POST /api/admin/drafts/photo?branch=&slug=&photo=  (JPEG)   -> { path }
 * POST /api/admin/drafts/finish  { branch, draft }           -> { prUrl, prNumber, previewUrl }
 *
 * Nothing is published: the result is a pull request that a person reviews
 * (with Netlify's free deploy preview) and merges.
 */

export const config = {
  path: ['/api/admin/drafts/start', '/api/admin/drafts/photo', '/api/admin/drafts/finish'],
  method: 'POST',
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });

const toBase64 = (buffer) => Buffer.from(buffer).toString('base64');
const isJpeg = (bytes) => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

function branchMatchesSlug(branch, slug) {
  return isDraftBranch(branch) && isValidSlug(slug) && branch.startsWith(`drafts/event-${slug}-`);
}

function prBody(draft, previewUrl) {
  const when = draft.start.replace('T', ' at ').replace(/:00\+08:00$/, '');
  return [
    'New event drafted in the BCEC website admin area.',
    '',
    `**Event:** ${draft.title}`,
    `**When:** ${when} (Perth time)`,
    `**Web address:** /events/${draft.slug}`,
    '',
    '### Where the numbers come from',
    draft.sourceNote || '_Not provided._',
    '',
    '### Before merging',
    `- [ ] Check the preview: ${previewUrl ?? 'Netlify will add a "Deploy Preview" link below once it is built.'}`,
    '- [ ] Check dates, wording, numbers and photos',
    '- [ ] Merge to publish (uses one production deploy)',
  ].join('\n');
}

async function start(req, github) {
  const input = await req.json().catch(() => null);
  const slug = typeof input?.slug === 'string' ? input.slug : '';
  if (!isValidSlug(slug)) return json({ error: 'The web address can only use lowercase letters, numbers and hyphens.' }, 400);
  if (await github.fileExistsOnBase(eventRepoPath(slug))) {
    return json({ error: 'An event already uses this web address. Change the web address and try again.' }, 409);
  }
  const branch = draftBranchName(slug);
  await github.createBranch(branch);
  return json({ branch });
}

async function photo(req, github) {
  const params = new URL(req.url).searchParams;
  const branch = params.get('branch') ?? '';
  const slug = params.get('slug') ?? '';
  const which = params.get('photo') ?? '';
  const index = Number(which);
  const target = which === 'cover' ? 'cover' : Number.isInteger(index) && index >= 1 && index <= MAX_GALLERY_PHOTOS ? index : null;
  if (!branchMatchesSlug(branch, slug) || target === null) return json({ error: 'Invalid photo upload.' }, 400);

  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_PHOTO_BYTES) return json({ error: 'This photo is too large to upload.' }, 413);
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > MAX_PHOTO_BYTES) return json({ error: 'This photo is too large to upload.' }, 413);
  if (!isJpeg(bytes)) return json({ error: 'Photos must be prepared as JPEG by the drafting page.' }, 415);

  await github.putFile(branch, photoRepoPath(slug, target), toBase64(bytes), `Add ${target === 'cover' ? 'cover' : `photo ${target}`} for ${slug}`);
  return json({ ok: true });
}

async function finish(req, github, context) {
  const input = await req.json().catch(() => null);
  const branch = typeof input?.branch === 'string' ? input.branch : '';
  const { draft, errors } = validateEventDraft(input?.draft ?? {});
  if (!draft) return json({ error: 'Some details need fixing.', errors }, 422);
  if (!branchMatchesSlug(branch, draft.slug)) return json({ error: 'This draft no longer matches its web address. Start again.' }, 400);

  const markdown = buildEventMarkdown(draft);
  await github.putFile(branch, eventRepoPath(draft.slug), toBase64(new TextEncoder().encode(markdown)), `Add event: ${draft.title}`);

  const siteName = context?.site?.name;
  const pr = await github.openPullRequest(branch, `New event: ${draft.title}`, prBody(draft));
  const previewUrl = siteName && pr?.number ? `https://deploy-preview-${pr.number}--${siteName}.netlify.app/events/${draft.slug}/` : null;
  return json({ prUrl: pr?.html_url ?? null, prNumber: pr?.number ?? null, previewUrl });
}

export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!isSameOriginRequest(req) || req.headers.get('x-bcec-admin') !== '1') return json({ error: 'Forbidden' }, 403);

  const user = await getUser();
  if (!user) return json({ error: 'Please sign in again.' }, 401);
  if (!user.roles?.includes(ADMIN_ROLE)) return json({ error: 'Your account does not have access to drafting.' }, 403);

  const settings = githubConfig();
  if (!settings) return json({ error: 'Drafting isn’t set up yet. Ask the site administrator to add the GitHub token in Netlify.' }, 503);
  const github = createGitHubClient(settings);

  const action = new URL(req.url).pathname.split('/').pop();
  try {
    if (action === 'start') return await start(req, github);
    if (action === 'photo') return await photo(req, github);
    if (action === 'finish') return await finish(req, github, context);
    return json({ error: 'Not found' }, 404);
  } catch (error) {
    console.error('content-drafts:', error instanceof Error ? error.message : error);
    const status = error instanceof GitHubError && error.status === 400 ? 400 : 502;
    return json({ error: 'GitHub couldn’t save the draft right now. Please try again in a few minutes.' }, status);
  }
};
