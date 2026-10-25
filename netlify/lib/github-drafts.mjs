/**
 * Minimal GitHub client for submitting content drafts as pull requests.
 *
 * Safety rails: writes only to `drafts/event-*` branches, only to an event's
 * markdown file or its photo folder, and never to the base branch. Publishing
 * still requires a person to merge the pull request on GitHub.
 */

const API = 'https://api.github.com';
const BRANCH_RE = /^drafts\/event-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ALLOWED_PATH_RE =
  /^(src\/content\/events\/[a-z0-9]+(?:-[a-z0-9]+)*\.md|public\/images\/projects\/events\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\.jpg)$/;

export class GitHubError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export function githubConfig(env = process.env) {
  const token = env.GITHUB_DRAFTS_TOKEN;
  if (!token) return null;
  return {
    token,
    repo: env.GITHUB_DRAFTS_REPO || 'BelmontCommunityEC/website',
    base: env.GITHUB_DRAFTS_BASE || 'main',
  };
}

export function isDraftBranch(branch) {
  return typeof branch === 'string' && BRANCH_RE.test(branch) && branch.length <= 120;
}

export function isAllowedPath(path) {
  return typeof path === 'string' && ALLOWED_PATH_RE.test(path);
}

export function draftBranchName(slug, now = new Date()) {
  return `drafts/event-${slug}-${now.getTime().toString(36)}`;
}

const encodePath = (path) => path.split('/').map(encodeURIComponent).join('/');

export function createGitHubClient({ token, repo, base }, fetchImpl = fetch) {
  const request = async (method, path, body) => {
    const response = await fetchImpl(`${API}/repos/${repo}${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'bcec-website-drafts',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 404 && method === 'GET') return null;
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      throw new GitHubError(`GitHub ${method} ${path} failed (${response.status}): ${data?.message ?? 'unknown error'}`, response.status);
    }
    return data;
  };

  const guardBranch = (branch) => {
    if (!isDraftBranch(branch) || branch === base) throw new GitHubError('Refusing to write outside a draft branch', 400);
  };

  return {
    base,

    async fileExistsOnBase(path) {
      const data = await request('GET', `/contents/${encodePath(path)}?ref=${encodeURIComponent(base)}`);
      return data !== null;
    },

    async createBranch(branch) {
      guardBranch(branch);
      const ref = await request('GET', `/git/ref/heads/${encodeURIComponent(base)}`);
      if (!ref?.object?.sha) throw new GitHubError(`Base branch "${base}" not found`, 404);
      await request('POST', '/git/refs', { ref: `refs/heads/${branch}`, sha: ref.object.sha });
    },

    async putFile(branch, path, base64Content, message) {
      guardBranch(branch);
      if (!isAllowedPath(path)) throw new GitHubError(`Refusing to write to ${path}`, 400);
      const existing = await request('GET', `/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`);
      await request('PUT', `/contents/${encodePath(path)}`, {
        message,
        content: base64Content,
        branch,
        ...(existing?.sha ? { sha: existing.sha } : {}),
      });
    },

    async openPullRequest(branch, title, body) {
      guardBranch(branch);
      const [owner] = repo.split('/');
      const existing = await request('GET', `/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`);
      if (Array.isArray(existing) && existing[0]) return existing[0];
      return request('POST', '/pulls', { title, head: branch, base, body });
    },
  };
}
