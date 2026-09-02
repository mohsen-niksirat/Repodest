/**
 * Repodest Unit Tests — core analysis functions
 * Run: node tests.test.js
 */

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

/* ============================================================
   Extract pure functions from app.js (DOM-free subset)
   ============================================================ */
function esc(s){return String(s==null?'':s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]))}
function fmt(n){n=Number(n)||0;if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'k';return String(n)}
function fmtSize(b){b=Number(b)||0;if(b>=1048576)return(b/1048576).toFixed(1)+' MB';if(b>=1024)return(b/1024).toFixed(1)+' KB';return b+' B'}
function timeAgo(iso){if(!iso)return'unknown';const d=(Date.now()-new Date(iso))/864e5;if(d<1)return'today';if(d<2)return'yesterday';if(d<30)return Math.floor(d)+'d ago';if(d<365)return Math.floor(d/30)+'mo ago';return Math.floor(d/365)+'y ago'}
const LANG_COLORS={'JavaScript':'#f1e05a','TypeScript':'#3178c6','Python':'#3572A5','HTML':'#e34c26','CSS':'#563d7c'};
const PALETTE=['#a855f7','#22d3ee','#f1e05a','#3178c6','#3572A5'];
function langColor(l){return LANG_COLORS[l]||PALETTE[((l||'').length*7)%PALETTE.length]}
function extOf(p){const b=(p||'').split('/').pop();const i=b.lastIndexOf('.');return i>0?b.slice(i+1).toLowerCase():b.toLowerCase()}
const TEXT_EXT=new Set(['js','ts','jsx','tsx','py','html','css','md','json','yml','yaml','toml','xml','sh','go','rs','rb','java']);
const BINARY_EXT=new Set(['png','jpg','jpeg','gif','webp','zip','tar','gz','pdf','exe','dll']);
function isText(f){const e=extOf(f.path||'');if(TEXT_EXT.has(e))return true;if(!(f.path||'').includes('/'))return /^(dockerfile|makefile|license|readme|changelog|contributing|code_of_conduct|notice|vagrantfile|procfile|gemfile|rakefile|justfile)/i.test(f.path||'');return false}
function isLock(f){return /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|poetry\.lock|Cargo\.lock|composer\.lock|Gemfile\.lock|go\.sum|npm-shrinkwrap\.json|flake\.lock)$/i.test(f.path||'')}

function parseRepoInput(v){
  if(!v)return null;
  v=v.trim().replace(/\.git+$/,'');
  let m=v.match(/github\.com[\/:]([^\s\/]+)\/([^\s\/#?]+)/i);
  if(m)return{owner:m[1],repo:m[2],platform:'github'};
  m=v.match(/gitlab\.com\/([^\s\/]+)\/([^\s\/#?]+)/i);
  if(m)return{owner:m[1],repo:m[2],platform:'gitlab'};
  m=v.match(/bitbucket\.org\/([^\s\/]+)\/([^\s\/#?]+)/i);
  if(m)return{owner:m[1],repo:m[2],platform:'bitbucket'};
  m=v.match(/^([\w.-]+)\/([\w.-]+)$/);
  if(m)return{owner:m[1],repo:m[2],platform:'github'};
  return null;
}

function detectPlatform(input){
  input=input||'';input=input.trim();
  if(/gitlab\.com/i.test(input))return 'gitlab';
  if(/bitbucket\.org/i.test(input))return 'bitbucket';
  return 'github';
}

/* asciiTree */
function asciiTree(paths){
  const root={};
  for(const p of paths){let n=root;for(const part of (p||'').split('/')){n[part]=n[part]||{};n=n[part]}}
  const lines=[];
  (function walk(node,prefix){
    const keys=Object.keys(node).sort((a,b)=>{
      const aD=!!Object.keys(node[a]).length,bD=!!Object.keys(node[b]).length;
      if(aD!==bD)return aD?-1:1;
      return (a||'').localeCompare(b||'');
    });
    keys.forEach((k,i)=>{
      const last=i===keys.length-1;
      lines.push(prefix+(last?'└── ':'├── ')+k+(Object.keys(node[k]).length?'/':''));
      walk(node[k],prefix+(last?'    ':'│   '));
    });
  })(root,'');
  return lines.join('\n');
}

/* SPDX License Map */
const SPDX_MAP={
  'MIT':{name:'MIT License',perms:['Commercial use','Modification','Distribution','Private use'],conds:['Include copyright','Include license'],lims:['Liability','Warranty']},
  'GPL-3.0':{name:'GNU GPL v3',perms:['Commercial use','Modification','Distribution','Patent use','Private use'],conds:['Include copyright','State changes','Disclose source','Same license','Include install instructions'],lims:['Liability','Warranty']},
  'Apache-2.0':{name:'Apache License 2.0',perms:['Commercial use','Modification','Distribution','Patent use','Private use'],conds:['Include copyright','State changes','Include notice'],lims:['Liability','Trademark use','Warranty']},
};

/* Health check (standalone version for testing) */
function healthCheck(paths,m){
  const now=Date.now();
  const items=[
    {n:'Description',ok:!!(m&&m.description),w:5},
    {n:'Topics',ok:m&&(m.topics||[]).length>0,w:10},
    {n:'License',ok:!!(m&&m.license),w:15},
    {n:'README',ok:paths.some(p=>/(^|\/)readme/i.test(p)),w:15},
    {n:'.gitignore',ok:paths.some(p=>/(^|\/)\.gitignore$/i.test(p)),w:5},
    {n:'CI workflows',ok:paths.some(p=>p.startsWith('.github/workflows/')),w:15},
    {n:'Tests',ok:paths.some(p=>/(^|\/)(tests?|spec|__tests__)(\/|$)/i.test(p)||/\.(test|spec)\.[a-z]+$/i.test(p)),w:15},
    {n:'Docs folder',ok:paths.some(p=>/(^|\/)docs?\//i.test(p)),w:5},
    {n:'Contributing guide',ok:paths.some(p=>/contribut/i.test(p)),w:5},
    {n:'Active (≤6 mo)',ok:m&&(now-new Date(m.pushed_at))<180*864e5,w:10}
  ];
  const score=items.reduce((a,c)=>a+(c.ok?c.w:0),0);
  return{items,score};
}

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

describe('healthCheck() — repository health scoring', () => {
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
});

/* ============================================================
   Summary
   ============================================================ */
console.log('\n' + '═'.repeat(50));
console.log(`Results: ${_pass} passed, ${_fail} failed, ${_total} total`);
console.log('═'.repeat(50));
process.exit(_fail > 0 ? 1 : 0);
