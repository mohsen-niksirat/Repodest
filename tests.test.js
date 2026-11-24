/**
 * Repodest Unit Tests — core analysis functions
 * Run: node tests.test.js
 * Tests run against core.js (single source of truth shared with app.js)
 */

const core=require('./core.js');

/* ============================================================
   Minimal test runner
   ============================================================ */
let _pass=0,_fail=0,_total=0;
function describe(name,fn){console.log('\n'+name);fn()}
function it(name,fn){
  _total++;
  try{fn();_pass++;console.log('  ✓ '+name)}
  catch(e){_fail++;console.log('  ✗ '+name+'\n    '+e.message)}
}
function expect(val){return{toEqual(e){if(val!==e)throw new Error('Expected '+JSON.stringify(e)+' but got '+JSON.stringify(val))},toBeCloseTo(e,d=2){if(Math.abs(val-e)>Math.pow(10,-d))throw new Error('Expected ~'+e+' but got '+val)},toBeTruthy(){if(!val)throw new Error('Expected truthy, got '+JSON.stringify(val))},toBeFalsy(){if(val)throw new Error("Expected falsy, got "+JSON.stringify(val))},toContain(s){if(!String(val).includes(s))throw new Error('Expected '+JSON.stringify(val)+' to contain '+JSON.stringify(s))},toHaveLength(n){if(val.length!==n)throw new Error('Expected length '+n+' but got '+val.length)}}}

/* Bind the pure functions under test */
const esc=core.esc,fmt=core.fmt,fmtSize=core.fmtSize,timeAgo=core.timeAgo;
const langColor=core.langColor,extOf=core.extOf,isText=core.isText,isLock=core.isLock;
const parseRepoInput=core.parseRepoInput,detectPlatform=core.detectPlatform;
const asciiTree=core.asciiTree,SPDX_MAP=core.SPDX_MAP,healthCheck=core.healthCheckPaths;
const stripCommentsAndWhitespace=core.stripCommentsAndWhitespace;
const filterPathsByGoal=core.filterPathsByGoal;
const parsePRInput=core.parsePRInput,analyzePR=core.analyzePR,buildPRDigest=core.buildPRDigest;

/* ============================================================
   Tests
   ============================================================ */

describe('esc() — HTML escaping', () => {
  it('escapes ampersands', () => expect(esc('a&b')).toEqual('a&amp;b'));
  it('escapes angle brackets', () => expect(esc('<div>')).toEqual('&lt;div&gt;'));
  it('escapes quotes', () => expect(esc('a"b')).toEqual('a&quot;b'));
  it('escapes single quotes', () => expect(esc("a'b")).toEqual('a&#39;b'));
  it('handles null/undefined', () => expect(esc(null)).toEqual(''));
  it('handles empty string', () => expect(esc('')).toEqual(''));
  it('leaves clean strings unchanged', () => expect(esc('hello world')).toEqual('hello world'));
});

describe('fmt() — number formatting', () => {
  it('formats thousands with k', () => expect(fmt(1500)).toEqual('1.5k'));
  it('formats millions with M', () => expect(fmt(2500000)).toEqual('2.5M'));
  it('returns small numbers as-is', () => expect(fmt(42)).toEqual('42'));
  it('handles zero', () => expect(fmt(0)).toEqual('0'));
  it('handles NaN', () => expect(fmt(NaN)).toEqual('0'));
  it('formats exact thousand', () => expect(fmt(1000)).toEqual('1.0k'));
  it('formats exact million', () => expect(fmt(1000000)).toEqual('1.0M'));
});

describe('fmtSize() — byte formatting', () => {
  it('formats bytes', () => expect(fmtSize(512)).toEqual('512 B'));
  it('formats kilobytes', () => expect(fmtSize(2048)).toEqual('2.0 KB'));
  it('formats megabytes', () => expect(fmtSize(5242880)).toEqual('5.0 MB'));
  it('handles zero', () => expect(fmtSize(0)).toEqual('0 B'));
  it('formats 1 KB exactly', () => expect(fmtSize(1024)).toEqual('1.0 KB'));
  it('formats 1 MB exactly', () => expect(fmtSize(1048576)).toEqual('1.0 MB'));
});

describe('timeAgo() — relative time', () => {
  it('returns "today" for recent timestamps', () => {
    const recent=new Date(Date.now()-3600*1000).toISOString();
    expect(timeAgo(recent)).toEqual('today');
  });
  it('returns "yesterday" for ~1 day ago', () => {
    const d=new Date(Date.now()-1.5*864e5).toISOString();
    expect(timeAgo(d)).toEqual('yesterday');
  });
  it('returns days for < 30 days', () => {
    const d=new Date(Date.now()-10*864e5).toISOString();
    expect(timeAgo(d)).toEqual('10d ago');
  });
  it('returns months for < 12 months', () => {
    const d=new Date(Date.now()-90*864e5).toISOString();
    expect(timeAgo(d)).toEqual('3mo ago');
  });
  it('returns years for > 12 months', () => {
    const d=new Date(Date.now()-400*864e5).toISOString();
    expect(timeAgo(d)).toEqual('1y ago');
  });
  it('returns "unknown" for null', () => expect(timeAgo(null)).toEqual('unknown'));
});

describe('langColor() — language color lookup', () => {
  it('returns known color for JavaScript', () => expect(langColor('JavaScript')).toEqual('#f1e05a'));
  it('returns known color for Python', () => expect(langColor('Python')).toEqual('#3572A5'));
  it('returns palette color for unknown language', () => expect(langColor('Zig')).toBeTruthy());
  it('handles empty string', () => expect(langColor('')).toBeTruthy());
});

describe('extOf() — file extension extraction', () => {
  it('extracts .js extension', () => expect(extOf('src/index.js')).toEqual('js'));
  it('extracts .tsx extension', () => expect(extOf('components/App.tsx')).toEqual('tsx'));
  it('handles files without extension', () => expect(extOf('Makefile')).toEqual('makefile'));
  it('handles nested paths', () => expect(extOf('a/b/c/d.py')).toEqual('py'));
  it('handles empty string', () => expect(extOf('')).toEqual(''));
});

describe('isText() — text file detection', () => {
  it('detects .js as text', () => expect(isText({path:'index.js'})).toBeTruthy());
  it('detects .ts as text', () => expect(isText({path:'app.ts'})).toBeTruthy());
  it('detects .py as text', () => expect(isText({path:'main.py'})).toBeTruthy());
  it('detects .md as text', () => expect(isText({path:'README.md'})).toBeTruthy());
  it('detects Dockerfile as text', () => expect(isText({path:'Dockerfile'})).toBeTruthy());
  it('detects LICENSE as text', () => expect(isText({path:'LICENSE'})).toBeTruthy());
  it('does not detect unknown extension as text', () => expect(isText({path:'file.xyz'})).toBeFalsy());
});

describe('isLock() — lockfile detection', () => {
  it('detects package-lock.json', () => expect(isLock({path:'package-lock.json'})).toBeTruthy());
  it('detects yarn.lock', () => expect(isLock({path:'yarn.lock'})).toBeTruthy());
  it('detects pnpm-lock.yaml', () => expect(isLock({path:'pnpm-lock.yaml'})).toBeTruthy());
  it('detects nested lockfiles', () => expect(isLock({path:'packages/foo/poetry.lock'})).toBeTruthy());
  it('does not detect regular files', () => expect(isLock({path:'index.js'})).toBeFalsy());
});

describe('parseRepoInput() — input parsing', () => {
  it('parses owner/repo format', () => {
    const r=parseRepoInput('facebook/react');
    expect(r.owner).toEqual('facebook');
    expect(r.repo).toEqual('react');
    expect(r.platform).toEqual('github');
  });
  it('parses full GitHub URL', () => {
    const r=parseRepoInput('https://github.com/microsoft/vscode');
    expect(r.owner).toEqual('microsoft');
    expect(r.repo).toEqual('vscode');
    expect(r.platform).toEqual('github');
  });
  it('parses GitHub URL with .git suffix', () => {
    const r=parseRepoInput('https://github.com/vuejs/vue.git');
    expect(r.owner).toEqual('vuejs');
    expect(r.repo).toEqual('vue');
  });
  it('parses GitLab URL', () => {
    const r=parseRepoInput('https://gitlab.com/gitlab-org/gitlab');
    expect(r.platform).toEqual('gitlab');
    expect(r.owner).toEqual('gitlab-org');
  });
  it('parses Bitbucket URL', () => {
    const r=parseRepoInput('https://bitbucket.org/team/repo');
    expect(r.platform).toEqual('bitbucket');
  });
  it('returns null for invalid input', () => expect(parseRepoInput('not-a-repo')).toBeFalsy());
  it('returns null for empty input', () => expect(parseRepoInput('')).toBeFalsy());
  it('returns null for null input', () => expect(parseRepoInput(null)).toBeFalsy());
});

describe('detectPlatform() — platform detection', () => {
  it('detects GitHub by default', () => expect(detectPlatform('facebook/react')).toEqual('github'));
  it('detects GitLab', () => expect(detectPlatform('https://gitlab.com/foo/bar')).toEqual('gitlab'));
  it('detects Bitbucket', () => expect(detectPlatform('https://bitbucket.org/foo/bar')).toEqual('bitbucket'));
  it('defaults to github for empty input', () => expect(detectPlatform('')).toEqual('github'));
});

describe('healthCheckPaths() — repository health scoring', () => {
  it('gives high score for well-maintained repo', () => {
    const paths=['README.md','.gitignore','.github/workflows/ci.yml','tests/app.test.js','docs/api.md','CONTRIBUTING.md'];
    const m={description:'A great repo',topics:['web','js'],license:{spdx_id:'MIT'},pushed_at:new Date().toISOString()};
    const hc=healthCheck(paths,m);
    expect(hc.score).toEqual(100);
  });
  it('gives low score for bare repo', () => {
    const paths=['main.js'];
    const m={description:'',topics:[],license:null,pushed_at:'2020-01-01T00:00:00Z'};
    const hc=healthCheck(paths,m);
    if(hc.score>=50)throw new Error('Expected low score for bare repo, got '+hc.score);
  });
  it('weights license heavily (15 points)', () => {
    const paths=['README.md'];
    const m1={description:'test',topics:[],license:{spdx_id:'MIT'},pushed_at:new Date().toISOString()};
    const m2={description:'test',topics:[],license:null,pushed_at:new Date().toISOString()};
    const hc1=healthCheck(paths,m1);
    const hc2=healthCheck(paths,m2);
    expect(hc1.score - hc2.score).toEqual(15);
  });
  it('detects tests in paths', () => {
    const paths=['src/app.js','tests/unit.test.js'];
    const hc=healthCheck(paths,{description:'x',topics:[],license:null,pushed_at:new Date().toISOString()});
    const testCheck=hc.items.find(i=>i.n==='Tests');
    expect(testCheck.ok).toBeTruthy();
  });
  it('detects CI workflows', () => {
    const paths=['.github/workflows/deploy.yml'];
    const hc=healthCheck(paths,{description:'x',topics:[],license:null,pushed_at:new Date().toISOString()});
    const ciCheck=hc.items.find(i=>i.n==='CI workflows');
    expect(ciCheck.ok).toBeTruthy();
  });
  it('returns 10 check items', () => {
    const hc=healthCheck([],{description:'',topics:[],license:null,pushed_at:'2020-01-01T00:00:00Z'});
    expect(hc.items.length).toEqual(10);
  });
});

describe('asciiTree() — file tree rendering', () => {
  it('renders a simple tree', () => {
    const tree=asciiTree(['src/index.js','src/app.js','README.md']);
    expect(tree).toContain('README.md');
    expect(tree).toContain('src/');
    expect(tree).toContain('index.js');
  });
  it('renders nested directories', () => {
    const tree=asciiTree(['a/b/c.txt']);
    expect(tree).toContain('a/');
    expect(tree).toContain('b/');
    expect(tree).toContain('c.txt');
  });
  it('handles empty input', () => expect(asciiTree([])).toEqual(''));
});

describe('SPDX License Map', () => {
  it('has MIT license info', () => {
    expect(SPDX_MAP['MIT'].name).toEqual('MIT License');
    if(SPDX_MAP["MIT"].perms.length<=0)throw new Error("Expected perms length > 0");
  });
  it('has GPL-3.0 license info', () => {
    expect(SPDX_MAP['GPL-3.0'].name).toContain('GPL');
  });
  it('has Apache-2.0 license info', () => {
    if(SPDX_MAP["Apache-2.0"].conds.length<=0)throw new Error("Expected conds length > 0");
  });
  it('covers 20+ licenses', () => {
    if(Object.keys(SPDX_MAP).length<20)throw new Error('Expected 20+ SPDX entries, got '+Object.keys(SPDX_MAP).length);
  });
});

describe('stripCommentsAndWhitespace() — token shrinker', () => {
  it('strips JS single-line and multi-line comments without breaking strings', () => {
    const input = '// this is a comment\nconst url = "https://example.com//test"; /* block comment */\nconsole.log(url);';
    const res = stripCommentsAndWhitespace(input, 'js');
    expect(res).toContain('const url = "https://example.com//test";');
    expect(res).toContain('console.log(url);');
    if(res.includes('this is a comment')) throw new Error('Expected single line comment to be stripped');
    if(res.includes('block comment')) throw new Error('Expected block comment to be stripped');
  });

  it('strips Python hash comments while preserving strings', () => {
    const input = '# Python comment\ndef test():\n    msg = "# not a comment"\n    return msg';
    const res = stripCommentsAndWhitespace(input, 'py');
    expect(res).toContain('msg = "# not a comment"');
    if(res.includes('# Python comment')) throw new Error('Expected Python comment to be stripped');
  });

  it('strips HTML and CSS comments', () => {
    const html = '<!-- html comment --><div>hello</div>';
    expect(stripCommentsAndWhitespace(html, 'html')).toEqual('<div>hello</div>');
    const css = '/* css comment */body { color: red; }';
    expect(stripCommentsAndWhitespace(css, 'css')).toEqual('body { color: red; }');
  });

  it('collapses excessive blank lines and trims whitespace', () => {
    const input = 'a = 1;   \n\n\n\n\nb = 2;  ';
    const res = stripCommentsAndWhitespace(input, 'js');
    expect(res).toEqual('a = 1;\n\nb = 2;');
  });

  it('handles empty or non-string input safely', () => {
    expect(stripCommentsAndWhitespace(null, 'js')).toEqual('');
    expect(stripCommentsAndWhitespace('', 'py')).toEqual('');
  });
});

describe('filterPathsByGoal() — smart goal presets', () => {
  const samplePaths = [
    'src/index.js',
    'src/app.js',
    'src/auth/login.js',
    'tests/app.test.js',
    'package.json',
    'package-lock.json',
    'README.md',
    '.github/workflows/ci.yml',
    'src/types.ts',
    'node_modules/foo/index.js'
  ];

  it('selects entry points and test files for bug hunter goal', () => {
    const res = filterPathsByGoal(samplePaths, 'bug');
    expect(res).toContain('tests/app.test.js');
    expect(res).toContain('src/index.js');
    if(res.includes('package-lock.json')) throw new Error('Lockfile should not be selected');
    if(res.includes('node_modules/foo/index.js')) throw new Error('node_modules should be excluded');
  });

  it('selects types, interfaces and manifests for architecture goal', () => {
    const res = filterPathsByGoal(samplePaths, 'arch');
    expect(res).toContain('src/types.ts');
    expect(res).toContain('package.json');
  });

  it('selects auth, security and workflows for security goal', () => {
    const res = filterPathsByGoal(samplePaths, 'security');
    expect(res).toContain('src/auth/login.js');
    expect(res).toContain('.github/workflows/ci.yml');
    expect(res).toContain('package.json');
  });

  it('handles empty or invalid paths safely', () => {
    expect(filterPathsByGoal([], 'bug')).toHaveLength(0);
    expect(filterPathsByGoal(null, 'arch')).toHaveLength(0);
  });
});

/* ============================================================
   PR X-Ray tests
   ============================================================ */

describe('parsePRInput() — PR URL / ref parsing', () => {
  it('parses a full GitHub PR URL', () => {
    const r = parsePRInput('https://github.com/facebook/react/pull/12345');
    expect(r.owner).toEqual('facebook');
    expect(r.repo).toEqual('react');
    expect(r.number).toEqual(12345);
  });
  it('parses a PR URL without https and with /pulls/', () => {
    const r = parsePRInput('github.com/owner/repo/pulls/7');
    expect(r.owner).toEqual('owner');
    expect(r.number).toEqual(7);
  });
  it('parses owner/repo#123 refs', () => {
    const r = parsePRInput('owner/repo#42');
    expect(r.owner).toEqual('owner');
    expect(r.repo).toEqual('repo');
    expect(r.number).toEqual(42);
  });
  it('parses a bare PR number (current repo)', () => {
    const r = parsePRInput('42');
    expect(r.number).toEqual(42);
    if(r.owner) throw new Error('bare number should not carry an owner');
  });
  it('returns null for repo URLs, junk and empty input', () => {
    expect(parsePRInput('https://github.com/owner/repo')).toBeFalsy();
    expect(parsePRInput('hello world')).toBeFalsy();
    expect(parsePRInput('')).toBeFalsy();
    expect(parsePRInput(null)).toBeFalsy();
  });
});

describe('analyzePR() — PR change analysis', () => {
  const pr = { title: 'feat: add OAuth login', labels: [], user: { login: 'alice' } };
  const files = [
    { filename: 'src/auth/login.js', additions: 100, deletions: 10, status: 'modified' },
    { filename: 'src/auth/oauth.js', additions: 50, deletions: 0, status: 'added' },
    { filename: 'tests/auth.test.js', additions: 30, deletions: 0, status: 'added' },
    { filename: 'README.md', additions: 5, deletions: 2, status: 'modified' },
    { filename: 'package.json', additions: 3, deletions: 0, status: 'modified' },
  ];

  it('sums additions and deletions across files', () => {
    const an = analyzePR(pr, files);
    expect(an.totals.add).toEqual(188);
    expect(an.totals.del).toEqual(12);
    expect(an.totalLines).toEqual(200);
  });

  it('groups files by type (source / test / docs / config)', () => {
    const an = analyzePR(pr, files);
    expect(an.byType.source.files).toEqual(2);
    expect(an.byType.test.files).toEqual(1);
    expect(an.byType.docs.files).toEqual(1);
    expect(an.byType.config.files).toEqual(1);
  });

  it('flags auth and dependency-manifest risk areas', () => {
    const an = analyzePR(pr, files);
    const labels = an.risks.map(r => r.label);
    expect(labels.join('|')).toContain('Authentication');
    expect(labels.join('|')).toContain('Dependency manifest');
    if(an.riskScore <= 0) throw new Error('riskScore should be positive, got ' + an.riskScore);
  });

  it('detects the change type from the PR title', () => {
    const an = analyzePR(pr, files);
    expect(an.changeType).toEqual('feature');
  });

  it('classifies change size', () => {
    const an = analyzePR(pr, files);
    expect(an.sizeClass).toEqual('small'); /* 200 lines */
    expect(analyzePR(pr, [{filename:'a.js',additions:10,deletions:5}]).sizeClass).toEqual('tiny');
    expect(analyzePR(pr, [{filename:'a.js',additions:4000,deletions:10}]).sizeClass).toEqual('XL');
  });

  it('computes test share of changed lines', () => {
    const an = analyzePR(pr, files);
    expect(an.testShare).toEqual(15); /* 30 of 200 */
  });

  it('classifies docs-only PRs as docs', () => {
    const an = analyzePR({ title: 'update stuff' }, [
      { filename: 'docs/guide.md', additions: 20, deletions: 5 },
      { filename: 'README.md', additions: 10, deletions: 0 },
    ]);
    expect(an.changeType).toEqual('docs');
    expect(an.risks).toHaveLength(0);
    expect(an.verdict).toEqual('low');
  });

  it('handles empty and missing file lists safely', () => {
    const an = analyzePR(pr, []);
    expect(an.totals.add).toEqual(0);
    expect(an.risks).toHaveLength(0);
    expect(an.sizeClass).toEqual('tiny');
    const an2 = analyzePR(pr, null);
    expect(an2.totals.add).toEqual(0);
  });

  it('marks 100+ file lists as truncated', () => {
    const many = Array.from({length: 105}, (_, i) => ({ filename: 'src/f'+i+'.js', additions: 1, deletions: 0 }));
    const an = analyzePR(pr, many);
    if(!an.truncated) throw new Error('should be marked truncated');
  });

  it('caps the risk score at 10', () => {
    const risky = [
      { filename: 'src/auth/session.js', additions: 1, deletions: 0 },
      { filename: 'src/crypto/secret.pem', additions: 1, deletions: 0 },
      { filename: 'migrations/001.sql', additions: 1, deletions: 0 },
      { filename: 'package.json', additions: 1, deletions: 0 },
      { filename: '.github/workflows/deploy.yml', additions: 1, deletions: 0 },
      { filename: 'Dockerfile', additions: 1, deletions: 0 },
      { filename: 'LICENSE', additions: 1, deletions: 0 },
    ];
    const an = analyzePR(pr, risky);
    if(an.riskScore > 10) throw new Error('risk score must cap at 10, got ' + an.riskScore);
    expect(an.verdict).toEqual('high');
  });
});

describe('buildPRDigest() — LLM review prompt', () => {
  const pr = {
    number: 42, title: 'feat: add OAuth login', body: 'Adds OAuth via Google.',
    state: 'open', html_url: 'https://github.com/owner/repo/pull/42',
    user: { login: 'alice' }, head: { ref: 'feat-oauth' }, base: { ref: 'main', repo: { full_name: 'owner/repo' } },
    created_at: '2026-10-01T00:00:00Z', labels: [],
  };
  const files = [
    { filename: 'src/auth/login.js', additions: 100, deletions: 10, status: 'modified', patch: '@@ -1,3 +1,5 @@\n+import oauth from \'./oauth\';' },
    { filename: 'tests/auth.test.js', additions: 30, deletions: 0, status: 'added', patch: '@@ -0,0 +1,2 @@\n+test(\'oauth\')' },
  ];

  it('includes PR metadata, stats and review task', () => {
    const an = analyzePR(pr, files);
    const d = buildPRDigest(pr, files, an);
    expect(d).toContain('Pull Request Review Digest');
    expect(d).toContain('#42');
    expect(d).toContain('feat: add OAuth login');
    expect(d).toContain('owner/repo');
    expect(d).toContain('Adds OAuth via Google.');
    expect(d).toContain('senior code reviewer');
    expect(d).toContain('merge verdict');
  });

  it('embeds diff patches in fenced diff blocks', () => {
    const an = analyzePR(pr, files);
    const d = buildPRDigest(pr, files, an);
    expect(d).toContain('```diff');
    expect(d).toContain('src/auth/login.js');
  });

  it('truncates very long patches and PR bodies', () => {
    const longFiles = [{ filename: 'big.js', additions: 1, deletions: 0, patch: 'x'.repeat(9000) }];
    const longPr = Object.assign({}, pr, { body: 'y'.repeat(5000) });
    const d = buildPRDigest(longPr, longFiles, analyzePR(longPr, longFiles));
    expect(d).toContain('truncated');
    if(d.length > 20000) throw new Error('digest should stay compact, got ' + d.length);
  });

  it('omits patches when includePatches is false', () => {
    const an = analyzePR(pr, files);
    const d = buildPRDigest(pr, files, an, { includePatches: false });
    if(d.includes('```diff')) throw new Error('patches should be omitted');
  });

  it('handles a PR with no body and no files', () => {
    const d = buildPRDigest({ number: 1, title: 't', user: {} }, [], analyzePR({}, []));
    expect(d).toContain('Pull Request Review Digest');
  });
});

describe('buildArchDiagram() & Diagram helpers — GitDiagram engine', () => {
  const sampleRepo = { full_name: 'acme/webapp', default_branch: 'main', description: 'Sample fullstack app' };
  const samplePaths = [
    'src/components/Header.tsx',
    'src/pages/Home.tsx',
    'src/api/users.ts',
    'src/core/engine.ts',
    'prisma/schema.prisma',
    'package.json',
    'tests/engine.test.ts',
    'node_modules/pkg/index.js',
    'package-lock.json'
  ];

  it('builds a valid Mermaid flowchart with subgraphs and click links', () => {
    const res = core.buildArchDiagram(samplePaths, sampleRepo, { direction: 'TD' });
    expect(res.mermaid).toContain('flowchart TD');
    expect(res.mermaid).toContain('subgraph SG_ui');
    expect(res.mermaid).toContain('subgraph SG_api');
    expect(res.mermaid).toContain('subgraph SG_core');
    expect(res.mermaid).toContain('subgraph SG_data');
    expect(res.mermaid).toContain('click N');
    expect(res.mermaid).toContain('https://github.com/acme/webapp/blob/main/');
    if (res.mermaid.includes('node_modules')) throw new Error('Should ignore node_modules');
    if (res.mermaid.includes('package-lock.json')) throw new Error('Should ignore lockfiles');
  });

  it('supports LR direction and empty path arrays safely', () => {
    const lr = core.buildArchDiagram(samplePaths, sampleRepo, { direction: 'LR' });
    expect(lr.mermaid).toContain('flowchart LR');
    const empty = core.buildArchDiagram([], sampleRepo);
    expect(empty.mermaid).toContain('acme/webapp');
  });

  it('builds an AI diagram prompt with custom instructions', () => {
    const p = core.buildDiagramPrompt(samplePaths, sampleRepo, 'Highlight auth');
    expect(p).toContain('acme/webapp');
    expect(p).toContain('Highlight auth');
    expect(p).toContain('```mermaid');
  });

  it('extracts Mermaid block from markdown fenced output and rejects prose', () => {
    const raw = 'Here is your diagram:\n```mermaid\nflowchart TD\n  A --> B\n```\nHope this helps!';
    expect(core.extractMermaidBlock(raw)).toEqual('flowchart TD\n  A --> B');
    expect(core.extractMermaidBlock('flowchart LR\n  X --> Y')).toEqual('flowchart LR\n  X --> Y');
    expect(core.extractMermaidBlock('Just some random prose with no diagram')).toEqual('');
    expect(core.extractMermaidBlock('')).toEqual('');
  });

  it('A1/A2: sanitizes hostile paths and encodes URLs segment-by-segment including slash branches', () => {
    const hostile = [
      'src/my file#2.ts',
      'src/a+b/c%d.md',
      'src/فایل-فارسی.js',
      'src/evil"quote\nline{break};`tick`.js',
      'src/' + 'x'.repeat(260) + '.ts'
    ];
    const res = core.buildArchDiagram(hostile, { full_name: 'acme/app', default_branch: 'feat/login' });
    expect(res.mermaid).toContain('https://github.com/acme/app/blob/feat/login/src/my%20file%232.ts');
    expect(res.mermaid).toContain('https://github.com/acme/app/blob/feat/login/src/a%2Bb/c%25d.md');
    expect(res.mermaid).toContain(encodeURIComponent('فایل-فارسی.js'));
    if (res.mermaid.includes('evil"quote')) throw new Error('Raw quote leaked into Mermaid label');
    if (res.mermaid.includes('{break}')) throw new Error('Braces leaked into Mermaid label');
  });

  it('A3/B2: does NOT fabricate HTTP/RPC edges when no evidence exists', () => {
    const res = core.buildArchDiagram(['src/components/App.tsx', 'data/users.sql'], sampleRepo);
    if (res.mermaid.includes('HTTP / RPC') || res.mermaid.includes('reads / writes')) {
      throw new Error('Fabricated template edge should not be emitted without evidence');
    }
    expect(res.stats.edges).toEqual(0);
    const withEvidence = core.buildArchDiagram(['src/components/App.tsx', 'data/users.sql'], sampleRepo, {
      importEdges: [{ from: 'src/components/App.tsx', to: 'data/users.sql', label: 'imports' }]
    });
    expect(withEvidence.stats.edges).toEqual(1);
    expect(withEvidence.mermaid).toContain('-->|"imports"|');
  });

  it('A5/B4: disambiguates duplicate basenames, shows +N more overflow, and validates paths', () => {
    const dups = ['src/index.js', 'lib/index.js'];
    const res = core.buildArchDiagram(dups, sampleRepo);
    expect(res.mermaid).toContain('src/index.js');
    expect(res.mermaid).toContain('lib/index.js');

    const many = Array.from({ length: 10 }, (_, i) => 'src/mod' + i + '/file.js');
    const capped = core.buildArchDiagram(many, sampleRepo, { maxPerLayer: 3 });
    expect(capped.mermaid).toContain('+7 more files');

    const g = core.buildArchGraph(['src/a.js'], sampleRepo);
    g.nodes.N_FAKE = { id: 'N_FAKE', label: 'fake.js', path: 'src/does-not-exist.js', isDir: false, layer: 'core', count: 1, shape: 'rect', url: '', isOverflow: false };
    g.groups[0].nodes.push('N_FAKE');
    const v = core.validateArchGraph(g, ['src/a.js']);
    expect(v.droppedNodes).toEqual(1);
    if (v.graph.nodes.N_FAKE) throw new Error('Fake node should have been dropped by validation');
  });

  it('A12: token shrinker preserves template literals, regex literals, and __STR_0__ safely', () => {
    const tpl = 'const s = `hello\n${name}`;\n// comment';
    expect(core.stripCommentsAndWhitespace(tpl, 'js')).toContain('${name}');
    const rx = 'const re = /https?:\\/\\//g;';
    expect(core.stripCommentsAndWhitespace(rx, 'js')).toContain('/https?:\\/\\//g');
    const col = 'const x = "__STR_0__";';
    expect(core.stripCommentsAndWhitespace(col, 'js')).toContain('__STR_0__');
    expect(core.parseRepoInput('https://github.com/a/b.git').repo).toEqual('b');
  });
});

/* ============================================================
   Summary
   ============================================================ */
console.log('\n' + '═'.repeat(50));
console.log(`Results: ${_pass} passed, ${_fail} failed, ${_total} total`);
console.log('═'.repeat(50));
process.exit(_fail > 0 ? 1 : 0);
