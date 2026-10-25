import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CATEGORY_OPTIONS,
  buildEventMarkdown,
  photoSitePath,
  slugify,
  validateEventDraft,
} from '../../src/lib/event-draft.ts';
import { createGitHubClient, draftBranchName, isAllowedPath, isDraftBranch } from './github-drafts.mjs';

const baseInput = {
  title: 'Winter Clean-up: Ascot "Foreshore"',
  slug: 'winter-clean-up-jul-2026',
  categories: ['Litter Prevention', 'Community Volunteering'],
  date: '2026-07-18',
  startTime: '08:30',
  endTime: '11:00',
  location: 'Garvey Park, Ascot',
  summary: 'Join us to clean up the foreshore. Bring a hat & water.',
  registerUrl: 'https://forms.gle/abc123',
};

describe('event drafts', () => {
  it('builds tidy web addresses from the title and date', () => {
    assert.equal(slugify('Garvey Park Green-up!', '2026-06-28'), 'garvey-park-green-up-jun-2026');
    assert.equal(slugify('Café & Crafts', '2026-12-01'), 'cafe-and-crafts-dec-2026');
    assert.equal(slugify('   ', '2026-01-05'), 'jan-2026');
  });

  it('reports friendly errors for missing or invalid fields', () => {
    const { draft, errors } = validateEventDraft({
      ...baseInput,
      title: '',
      slug: 'Bad Slug',
      categories: ['Not a category'],
      endTime: '08:00',
      registerUrl: 'http://insecure.example',
      raised: 'lots',
      stats: [{ label: 'Volunteers', value: '' }],
      partners: [{ org: 'unknown-org' }],
      cover: { alt: '' },
      gallery: [{ alt: '' }],
    });
    assert.equal(draft, null);
    assert.deepEqual(Object.keys(errors).sort(), [
      'categories',
      'coverAlt',
      'endTime',
      'gallery.0',
      'partners.0',
      'raised',
      'registerUrl',
      'slug',
      'stats.0',
      'title',
    ]);
  });

  it('writes markdown that matches the event template shape', () => {
    const { draft, errors } = validateEventDraft({
      ...baseInput,
      project: 'less-mess',
      impact: '40 bags collected',
      raised: '$1,243.8',
      stats: [{ label: 'Bags of litter collected', value: '40', metric: 'litter' }],
      outcomes: ['Cleaned 2km of foreshore'],
      partners: [{ org: 'city-of-belmont', role: 'partner' }],
      cover: { alt: 'Volunteers with full bags', credit: 'Photo: BCEC' },
      gallery: [{ alt: 'A volunteer picking up litter' }],
      body: 'More details.\n\n<script>alert(1)</script>',
    });
    assert.deepEqual(errors, {});
    const markdown = buildEventMarkdown(draft);
    assert.match(markdown, /^---\ntitle: "Winter Clean-up: Ascot \\"Foreshore\\""\n/);
    assert.equal(markdown.match(/^ {2}- '\[[x ]\] /gm).length, CATEGORY_OPTIONS.length);
    assert.match(markdown, /  - '\[x\] Litter Prevention'/);
    assert.match(markdown, /\nstart: 2026-07-18T08:30:00\+08:00\nend: 2026-07-18T11:00:00\+08:00\n/);
    assert.match(markdown, /\nraised: 1243.8\n/);
    assert.match(markdown, /\nimage: \/images\/projects\/events\/winter-clean-up-jul-2026\/winter-clean-up-jul-2026-cover\.jpg\n/);
    assert.match(markdown, /\n {2}- src: \/images\/projects\/events\/winter-clean-up-jul-2026\/winter-clean-up-jul-2026-1\.jpg\n/);
    assert.match(markdown, /\n {4}metric: litter\n/);
    assert.match(markdown, /\ndraft: false\n---\n\nMore details\.\n\n&lt;script>alert\(1\)&lt;\/script>\n$/);
    assert.equal(markdown.includes('sourceNote'), false);
  });

  it('keeps photo paths inside the event folder', () => {
    assert.equal(photoSitePath('my-event', 3), '/images/projects/events/my-event/my-event-3.jpg');
  });

  it('rejects unsafe links in the description but allows normal ones', () => {
    const check = (body) => validateEventDraft({ ...baseInput, body }).errors.body;
    assert.equal(check('[Register](https://forms.gle/x) and [us](mailto:a@b.org) and [page](/events) [top](#top)'), undefined);
    assert.ok(check("[now](javascript:alert(1))"));
    assert.ok(check('[x]( JavaScript:alert(1))'));
    assert.ok(check('[r]: javascript:alert(1)\n\n[click][r]'));
    assert.ok(check('![img](data:image/svg+xml;base64,AAAA)'));
    assert.ok(check('[x](javascript&#58;alert(1))'));
  });
});

describe('GitHub draft client', () => {
  const settings = { token: 'test-token', repo: 'BelmontCommunityEC/website', base: 'main' };

  function fakeGitHub(existingPaths = new Set()) {
    const calls = [];
    const fetchImpl = async (url, init = {}) => {
      const { pathname, search } = new URL(url);
      const method = init.method ?? 'GET';
      calls.push({ method, path: pathname + search, body: init.body ? JSON.parse(init.body) : undefined, auth: init.headers?.Authorization });
      const respond = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status });
      if (method === 'GET' && pathname.endsWith('/git/ref/heads/main')) return respond(200, { object: { sha: 'abc' } });
      if (method === 'GET' && pathname.includes('/contents/')) {
        const path = decodeURIComponent(pathname.split('/contents/')[1]);
        return existingPaths.has(path) ? respond(200, { sha: 'old' }) : respond(404, { message: 'Not Found' });
      }
      if (method === 'GET' && pathname.endsWith('/pulls')) return respond(200, []);
      if (method === 'POST' && pathname.endsWith('/pulls')) return respond(201, { number: 7, html_url: 'https://github.com/x/pull/7' });
      return respond(201, {});
    };
    return { calls, client: createGitHubClient(settings, fetchImpl) };
  }

  it('creates a draft branch, writes allowed files and opens a pull request', async () => {
    const { calls, client } = fakeGitHub();
    const branch = draftBranchName('winter-clean-up-jul-2026', new Date('2026-07-01T00:00:00Z'));
    assert.equal(isDraftBranch(branch), true);
    await client.createBranch(branch);
    await client.putFile(branch, 'src/content/events/winter-clean-up-jul-2026.md', 'LS0t', 'Add event');
    const pr = await client.openPullRequest(branch, 'New event', 'body');
    assert.equal(pr.number, 7);
    assert.deepEqual(calls.find((call) => call.path.endsWith('/git/refs')).body, { ref: `refs/heads/${branch}`, sha: 'abc' });
    const put = calls.find((call) => call.method === 'PUT');
    assert.equal(put.body.branch, branch);
    assert.equal(calls.every((call) => call.auth === 'Bearer test-token'), true);
    assert.deepEqual(calls.find((call) => call.method === 'POST' && call.path.endsWith('/pulls')).body.base, 'main');
  });

  it('refuses to write to the base branch or outside event content', async () => {
    const { calls, client } = fakeGitHub();
    await assert.rejects(client.putFile('main', 'src/content/events/x.md', 'LS0t', 'nope'));
    await assert.rejects(client.createBranch('feature/other'));
    await assert.rejects(client.putFile('drafts/event-x-1', 'src/pages/index.astro', 'LS0t', 'nope'));
    await assert.rejects(client.putFile('drafts/event-x-1', 'public/images/projects/events/x/../../../../netlify.toml', 'LS0t', 'nope'));
    assert.equal(calls.length, 0);
    assert.equal(isAllowedPath('public/images/projects/events/x/x-cover.jpg'), true);
  });

  it('detects an existing event on the base branch', async () => {
    const { client } = fakeGitHub(new Set(['src/content/events/taken.md']));
    assert.equal(await client.fileExistsOnBase('src/content/events/taken.md'), true);
    assert.equal(await client.fileExistsOnBase('src/content/events/free.md'), false);
  });
});
