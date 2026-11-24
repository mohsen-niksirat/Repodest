import { test, expect } from '@playwright/test';

async function clickTab(page, name){
  const tab = page.locator(`[data-tab="${name}"]`);
  await tab.waitFor({ state: 'attached', timeout: 30000 });
  await tab.scrollIntoViewIfNeeded();
  await tab.click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    /* quiet the network for deterministic tests */
    window.__e2e = true;
  });
});

test('landing page renders with hero and search', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Repodest/i);
  await expect(page.locator('.hero h1')).toBeVisible();
  await expect(page.locator('#inp')).toBeVisible();
  await expect(page.locator('.searchbox .btn')).toBeVisible();
});

test('command palette opens with Ctrl+K and lists actions', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  const input = page.locator('#cmdInput');
  await expect(input).toBeVisible();
  await expect(page.locator('#cmdList .cmd-item').first()).toBeVisible();
  await input.fill('battle');
  await expect(page.locator('#cmdList .cmd-item').first()).toContainText(/battle/i);
});

test('language menu opens and switches to Farsi', async ({ page }) => {
  await page.goto('/');
  await page.click('#langBtn');
  await expect(page.locator('.lang-menu')).toBeVisible();
  const items = page.locator('.lang-item');
  await expect(items).toHaveCount(7);
  await page.click('.lang-item[data-lang="fa"]');
  await expect(page.locator('#langBtn span')).toHaveText('FA');
  await expect(page.locator('body')).toHaveClass(/rtl/);
  /* back to english via menu */
  await page.click('#langBtn');
  await page.click('.lang-item[data-lang="en"]');
  await expect(page.locator('body')).not.toHaveClass(/rtl/);
});

test('help chips open popovers with content', async ({ page }) => {
  await page.goto('/?repo=mohsen-niksirat/Repodest');
  /* dashboard loads after API calls; the health help chip is inside it */
  const chip = page.locator('.help-chip[data-help="health"]');
  await chip.waitFor({ state: 'visible', timeout: 20000 });
  await chip.click();
  await expect(page.locator('.help-popover')).toBeVisible();
  await expect(page.locator('.help-popover')).toContainText(/health score/i);
});

test('dashboard renders for a real repo with tabs', async ({ page }) => {
  await page.goto('/?repo=mohsen-niksirat/Repodest');
  await expect(page.locator('#repoHero')).toContainText(/repodest/i, { timeout: 30000 });
  await expect(page.locator('#tabs .tab')).toHaveCount(13);
  /* switch to Files tab and check the tree rendered */
  await clickTab(page,'files');
  await expect(page.locator('#tree')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#tree .trow').first()).toBeAttached({ timeout: 15000 });
});

test('digest tab exposes presets and generate button', async ({ page }) => {
  await page.goto('/?repo=mohsen-niksirat/Repodest');
  await expect(page.locator('#repoHero')).toContainText(/repodest/i, { timeout: 30000 });
  await clickTab(page,'digest');
  await expect(page.locator('.rec-btn[data-preset]')).toHaveCount(6);
  await expect(page.locator('#genBtn')).toBeVisible();
  await page.click('.rec-btn[data-preset="review"]');
  await expect(page.locator('.rec-btn[data-preset="review"]')).toHaveClass(/preset-sel/);
});

/* Mocked GitHub API for the PR X-Ray tests — deterministic, no rate limits,
   no giant repos. Mirrors tests/pr-xray.browser.js. */
const MOCK_REPO = {
  full_name: 'acme/widget', name: 'widget', owner: { login: 'acme', avatar_url: '', html_url: '' },
  html_url: 'https://github.com/acme/widget', description: 'test repo', fork: false,
  created_at: '2020-01-01T00:00:00Z', pushed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  homepage: '', size: 1000, stargazers_count: 42, watchers_count: 42, forks_count: 7,
  open_issues_count: 3, language: 'JavaScript', license: { spdx_id: 'MIT' }, topics: [],
  default_branch: 'main', archived: false,
};
const MOCK_PR = {
  number: 7, title: 'feat: add OAuth login flow', body: 'Adds Google OAuth.',
  state: 'open', merged_at: null, draft: false,
  html_url: 'https://github.com/acme/widget/pull/7',
  user: { login: 'alice' }, created_at: '2026-10-01T00:00:00Z',
  head: { ref: 'feat-oauth', repo: { full_name: 'acme/widget' } },
  base: { ref: 'main', repo: { full_name: 'acme/widget' } },
  labels: [], requested_reviewers: [],
};
const MOCK_PR_FILES = [
  { filename: 'src/auth/login.js', additions: 120, deletions: 10, status: 'modified', patch: '@@ -1,2 +1,4 @@\n+import oauth' },
  { filename: 'tests/auth.test.js', additions: 40, deletions: 0, status: 'added', patch: '@@ -0,0 +1,2 @@\n+test()' },
  { filename: 'package.json', additions: 2, deletions: 0, status: 'modified', patch: '@@ +1,2 @@\n+"oauth"' },
];
async function mockGitHubApi(page) {
  const j = (route, o) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(o) });
  await page.route('**/api.github.com/**', route => {
    const p = new URL(route.request().url()).pathname;
    if (p.endsWith('/rate_limit')) return j(route, { resources: { core: { remaining: 5000 } } });
    if (/\/repos\/[^/]+\/[^/]+$/.test(p)) return j(route, MOCK_REPO);
    if (p.endsWith('/pulls') || /\/pulls\?/.test(p)) return j(route, [MOCK_PR]);
    if (/\/pulls\/7\/files$/.test(p)) return j(route, MOCK_PR_FILES);
    if (/\/pulls\/\d+$/.test(p)) return j(route, MOCK_PR);
    if (p.endsWith('/commits')) return j(route, []);
    if (p.endsWith('/languages')) return j(route, { JavaScript: 10000 });
    if (p.endsWith('/contributors')) return j(route, []);
    if (/\/git\/trees\//.test(p)) return j(route, { tree: [
      { path: 'src/auth/login.js', type: 'blob', size: 100 },
      { path: 'package.json', type: 'blob', size: 500 },
      { path: 'README.md', type: 'blob', size: 800 },
      { path: 'LICENSE', type: 'blob', size: 1000 },
    ], truncated: false });
    if (p.endsWith('/branches')) return j(route, [{ name: 'main' }]);
    if (p.endsWith('/tags')) return j(route, []);
    if (p.endsWith('/releases')) return j(route, []);
    if (p.includes('/topics')) return j(route, { names: [] });
    return j(route, []);
  });
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ body: '# readme', contentType: 'text/plain' }));
}

test('PR X-Ray tab analyzes a PR end to end (mocked API)', async ({ page }) => {
  await mockGitHubApi(page);
  await page.goto('/?repo=acme/widget');
  await expect(page.locator('#repoHero')).toContainText(/widget/i, { timeout: 15000 });
  await clickTab(page, 'pr');
  await expect(page.locator('#prInput')).toBeVisible();
  /* analyze PR #7 from the open-PR list */
  await page.locator('#prList .pr-row').first().click();
  const analysis = page.locator('#prAnalysis');
  await expect(analysis).toContainText('#7', { timeout: 10000 });
  await expect(analysis).toContainText(/additions/i);
  await expect(analysis).toContainText(/authentication/i);
  /* the LLM digest must generate and contain the review task */
  const genBtn = page.locator('#prGenBtn');
  await expect(genBtn).toBeEnabled({ timeout: 10000 });
  await genBtn.click();
  const out = page.locator('#prDigestOut');
  await expect(out).toHaveValue(/Pull Request Review Digest/, { timeout: 10000 });
  await expect(out).toHaveValue(/senior code reviewer/);
  await expect(page.locator('#prCopyBtn')).toBeEnabled();
});

test('PR X-Ray deep link: pasting a PR URL routes to the PR tab (mocked API)', async ({ page }) => {
  await mockGitHubApi(page);
  await page.goto('/?repo=acme/widget');
  await expect(page.locator('#repoHero')).toContainText(/widget/i, { timeout: 15000 });
  /* a PR URL in the toolbar jump loads the repo and opens the PR analysis */
  await page.fill('#jump', 'https://github.com/acme/widget/pull/7');
  await page.press('#jump', 'Enter');
  await expect(page.locator('#p-pr')).toHaveClass(/active/, { timeout: 15000 });
  await expect(page.locator('#prAnalysis')).toContainText('#7', { timeout: 10000 });
});

test('toolbar more-tools tray toggles on mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?repo=mohsen-niksirat/Repodest');
  const moreBtn = page.locator('#moreBtn');
  await moreBtn.waitFor({ state: 'visible', timeout: 20000 });
  await moreBtn.click();
  await expect(page.locator('#moreTools')).toHaveClass(/open/);
  await expect(page.locator('#moreTools .btn').first()).toBeVisible();
});
