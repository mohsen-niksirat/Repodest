/* Browser-level verification of the PR X-Ray feature.
   Serves the app locally, mocks the GitHub API + external CDN,
   and drives the full golden path: load repo → PR tab → open-PR list →
   analyze PR #7 → risk flags → digest generation.
   Run: node tests/pr-xray.browser.js  (needs @playwright/test installed) */
const { chromium } = require('@playwright/test');
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, r) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const f = path.join(root, p);
      if (!f.startsWith(root)) { r.writeHead(403); r.end(); return }
      fs.readFile(f, (e, d) => {
        if (e) { r.writeHead(404); r.end('nf'); return }
        r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
        r.end(d);
      });
    });
    srv.listen(8099, '127.0.0.1', () => res(srv));
  });
}

const repo = {
  full_name: 'acme/widget', name: 'widget', owner: { login: 'acme', avatar_url: '', html_url: '' },
  html_url: 'https://github.com/acme/widget', description: 'test', fork: false,
  created_at: '2020-01-01T00:00:00Z', pushed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  homepage: '', size: 1000, stargazers_count: 42, watchers_count: 42, forks_count: 7,
  open_issues_count: 3, language: 'JavaScript', license: { spdx_id: 'MIT' }, topics: [],
  default_branch: 'main', archived: false,
};
const pr7 = {
  number: 7, title: 'feat: add OAuth login flow', body: 'Adds Google OAuth.',
  state: 'open', merged_at: null, draft: false,
  html_url: 'https://github.com/acme/widget/pull/7',
  user: { login: 'alice' }, created_at: '2026-10-01T00:00:00Z',
  head: { ref: 'feat-oauth', repo: { full_name: 'acme/widget' } },
  base: { ref: 'main', repo: { full_name: 'acme/widget' } },
  labels: [], requested_reviewers: [{ login: 'bob' }],
};
const prFiles = [
  { filename: 'src/auth/login.js', additions: 120, deletions: 10, status: 'modified', patch: '@@ -1,2 +1,4 @@\n+import oauth' },
  { filename: 'src/auth/oauth.js', additions: 80, deletions: 0, status: 'added', patch: '@@ -0,0 +1,2 @@\n+export default' },
  { filename: 'tests/auth.test.js', additions: 40, deletions: 0, status: 'added', patch: '@@ -0,0 +1,2 @@\n+test()' },
  { filename: 'package.json', additions: 2, deletions: 0, status: 'modified', patch: '@@ +1,2 @@\n+"oauth"' },
  { filename: 'README.md', additions: 3, deletions: 1, status: 'modified', patch: '@@ +1,2 @@\n+docs' },
];
const pulls = [
  pr7,
  { number: 8, title: 'chore: bump deps', state: 'open', user: { login: 'bob' }, created_at: '2026-10-05T00:00:00Z', labels: [] },
];
const commits = Array.from({ length: 5 }, (_, i) => ({ commit: { message: 'fix: thing ' + i, author: { name: 'a', date: new Date().toISOString() } }, author: { login: 'acme', avatar_url: '' } }));

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  ✓ ' + name) } else { fail++; console.log('  ✗ ' + name) } }

(async () => {
  const srv = await serve();
  /* sanity: the server really serves the app */
  const self = await new Promise(res => require('http').get('http://127.0.0.1:8099/', r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(d)) }));
  if (!self.includes('id="dash"')) { console.error('server did not serve index.html, got', self.length, 'bytes'); process.exit(1) }
  const browser = await chromium.launch();
  const page = await browser.newPage();

  /* block everything external, mock the GitHub API */
  await page.route('**://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await page.route('**://fonts.gstatic.com/**', r => r.fulfill({ body: '', contentType: 'font/woff2' }));
  await page.route('**://cdn.jsdelivr.net/**', r => r.fulfill({ body: '/*mock*/', contentType: 'text/javascript' }));
  await page.route('**://api.github.com/**', r => {
    const u = new URL(r.request().url());
    const p = u.pathname;
    const j = o => r.fulfill({ contentType: 'application/json', body: JSON.stringify(o) });
    if (p.endsWith('/rate_limit')) return j({ resources: { core: { remaining: 5000 } } });
    if (/\/repos\/[^/]+\/[^/]+$/.test(p)) return j(repo);
    if (p.endsWith('/pulls') || /\/pulls\?/.test(p)) return j(pulls);
    if (/\/pulls\/7\/files$/.test(p)) return j(prFiles);
    if (/\/pulls\/\d+$/.test(p)) return j(pr7);
    if (p.endsWith('/commits')) return j(commits);
    if (p.endsWith('/languages')) return j({ JavaScript: 10000, CSS: 2000 });
    if (p.endsWith('/contributors')) return j([]);
    if (p.endsWith('/git/trees/HEAD?recursive=1') || /\/git\/trees\//.test(p)) {
      return j({ tree: [
        { path: 'src/auth/login.js', type: 'blob', size: 100 },
        { path: 'package.json', type: 'blob', size: 500 },
        { path: 'README.md', type: 'blob', size: 800 },
        { path: '.github/workflows/ci.yml', type: 'blob', size: 300 },
        { path: 'LICENSE', type: 'blob', size: 1000 },
      ], truncated: false });
    }
    if (p.endsWith('/branches')) return j([{ name: 'main' }]);
    if (p.endsWith('/tags')) return j([]);
    if (p.endsWith('/releases')) return j([]);
    if (p.includes('/topics')) return j({ names: [] });
    console.log('    [unmocked API]', p);
    return j([]);
  });
  await page.route('**://raw.githubusercontent.com/**', r => r.fulfill({ body: '# readme', contentType: 'text/plain' }));
  await page.route('**://api.osv.dev/**', r => r.fulfill({ contentType: 'application/json', body: '{}' }));

  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  console.log('\nGolden path: repo load → PR tab');
  await page.goto('http://127.0.0.1:8099/?repo=acme/widget');
  await page.waitForTimeout(4000);
  console.log('  url:', page.url());
  const bodySnippet = await page.evaluate(() => document.body ? document.body.innerHTML.slice(0, 200) : 'NO BODY');
  console.log('  body:', String(bodySnippet).replace(/\n/g, ' '));
  console.log('  page errors so far:', errors.length ? errors : 'none');
  await page.waitForSelector('#repoHero', { timeout: 15000 });
  ok('dashboard loaded', await page.locator('#repoHero').innerText() !== '');
  ok('12 tabs present', (await page.locator('#tabs .tab').count()) === 12);

  await page.click('[data-tab="pr"]');
  await page.waitForSelector('#prList .pr-row', { timeout: 10000 });
  ok('open-PR list rendered', (await page.locator('#prList .pr-row').count()) === 2);
  ok('PR row shows title', (await page.locator('#prList .pr-row').first().innerText()).includes('OAuth'));

  console.log('\nAnalyze PR #7 from the list');
  await page.locator('#prList .pr-row').first().click();
  await page.waitForSelector('#prAnalysis .pr-hero', { timeout: 10000 });
  const anText = await page.locator('#prAnalysis').innerText();
  ok('hero shows PR number and title', anText.includes('#7') && anText.includes('OAuth'));
  ok('stats show additions', anText.includes('+245') || anText.includes('245'));
  ok('risk flag for auth present', anText.toLowerCase().includes('authentication'));
  ok('risk flag for manifest present', anText.toLowerCase().includes('dependency manifest'));
  ok('change type = feature', anText.includes('feature'));
  ok('test coverage share shown', anText.includes('%'));

  console.log('\nAnalyze by pasting a URL from another repo (parsePRInput path)');
  await page.fill('#prInput', 'github.com/acme/widget/pull/7');
  await page.click('button:has-text("X-Ray it")');
  await page.waitForSelector('#prAnalysis .pr-hero', { timeout: 10000 });
  ok('re-analysis via URL works', (await page.locator('#prAnalysis').innerText()).includes('#7'));

  console.log('\nLLM review digest');
  await page.click('#prGenBtn');
  await page.waitForFunction(() => document.querySelector('#prDigestOut').value.length > 100, null, { timeout: 10000 });
  const digest = await page.locator('#prDigestOut').inputValue();
  ok('digest has header', digest.includes('Pull Request Review Digest'));
  ok('digest has metadata', digest.includes('#7') && digest.includes('feat: add OAuth login flow'));
  ok('digest has diffs', digest.includes('```diff') && digest.includes('src/auth/login.js'));
  ok('digest has risk report', digest.includes('Authentication'));
  ok('digest has review task', digest.includes('senior code reviewer'));
  ok('copy button enabled', !(await page.locator('#prCopyBtn').isDisabled()));
  ok('download button enabled', !(await page.locator('#prDlBtn').isDisabled()));

  console.log('\nBad input handling');
  await page.fill('#prInput', 'not a pr at all');
  await page.click('button:has-text("X-Ray it")');
  await page.waitForTimeout(300);
  ok('junk input shows toast, analysis intact', (await page.locator('#prAnalysis').innerText()).includes('#7'));

  console.log('\nToolbar jump: PR URL routes to PR X-Ray');
  await page.fill('#jump', 'https://github.com/acme/widget/pull/7');
  await page.press('#jump', 'Enter');
  await page.waitForSelector('#p-pr.active', { timeout: 15000 });
  ok('PR tab auto-activated', true);
  await page.waitForSelector('#prAnalysis .pr-hero', { timeout: 10000 });
  ok('pending PR auto-analyzed', (await page.locator('#prAnalysis').innerText()).includes('#7'));

  ok('no page errors during run', errors.length === 0);
  if (errors.length) console.log('  page errors: ' + errors.slice(0, 3).join(' | '));

  await browser.close();
  srv.close();
  console.log('\n' + '═'.repeat(50));
  console.log(`PR X-Ray browser test: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1) });
