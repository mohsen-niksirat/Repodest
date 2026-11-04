'use strict';
/* ============================================================
   Repodest core, shared pure functions & data tables
   Loaded by: app.js (browser, exposes globals) and
              tests.test.js (Node, via module.exports)
   No DOM, no fetch, safe to run anywhere.
   ============================================================ */
const RepodestCore={};

/* ---------- Formatting helpers ---------- */
RepodestCore.esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};
RepodestCore.fmt=function(n){n=Number(n)||0;if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'k';return String(n)};
RepodestCore.fmtSize=function(b){b=Number(b)||0;if(b>=1048576)return(b/1048576).toFixed(1)+' MB';if(b>=1024)return(b/1024).toFixed(1)+' KB';return b+' B'};
RepodestCore.timeAgo=function(iso){if(!iso)return'unknown';const d=(Date.now()-new Date(iso))/864e5;if(d<1)return'today';if(d<2)return'yesterday';if(d<30)return Math.floor(d)+'d ago';if(d<365)return Math.floor(d/30)+'mo ago';return Math.floor(d/365)+'y ago'};

/* ---------- File classification ---------- */
RepodestCore.TEXT_EXT=new Set(['js','ts','jsx','tsx','mjs','cjs','py','pyw','html','htm','css','scss','sass','less','md','mdx','txt','rst','json','json5','yml','yaml','toml','xml','svg','sh','bash','zsh','bat','cmd','ps1','psm1','c','h','cpp','cc','cxx','hpp','hh','cs','java','kt','kts','go','rs','rb','php','swift','m','mm','sql','vue','svelte','astro','lua','r','rmd','jl','dart','gradle','kts','properties','ini','cfg','conf','env','coffee','elm','ex','exs','erl','hrl','hs','ml','fs','fsx','clj','cljs','groovy','pl','pm','t','v','vhd','sv','tf','tfvars','proto','graphql','gql','prisma','cmake','mk','nix','diff','patch','log','csv','tsv','editorconfig','gitignore','gitattributes','dockerignore','npmrc','nvmrc','babelrc','eslintrc','prettierrc']);
RepodestCore.BINARY_EXT=new Set(['png','jpg','jpeg','gif','webp','bmp','ico','icns','tiff','woff','woff2','ttf','otf','eot','mp3','mp4','avi','mov','mkv','webm','wav','flac','ogg','zip','tar','gz','tgz','bz2','xz','rar','7z','pdf','doc','docx','xls','xlsx','ppt','pptx','exe','dll','so','dylib','bin','dat','class','jar','war','ear','pyc','pyo','o','obj','lib','a','iso','img','dmg','deb','rpm','apk','msi','wasm','node','pdb','db','sqlite','sqlite3','parquet','pickle','pkl','h5','hdf5','npz','npy','pt','pth','onnx','safetensors']);
RepodestCore.extOf=function(p){const b=(p||'').split('/').pop();const i=b.lastIndexOf('.');return i>0?b.slice(i+1).toLowerCase():b.toLowerCase()};
RepodestCore.isText=function(f){const e=RepodestCore.extOf(f.path||'');if(RepodestCore.TEXT_EXT.has(e))return true;if(!(f.path||'').includes('/'))return /^(dockerfile|makefile|license|readme|changelog|contributing|code_of_conduct|notice|vagrantfile|procfile|gemfile|rakefile|justfile)/i.test(f.path||'');return false};
RepodestCore.isLock=function(f){return /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|poetry\.lock|Cargo\.lock|composer\.lock|Gemfile\.lock|go\.sum|npm-shrinkwrap\.json|flake\.lock)$/i.test(f.path||'')};

/* ---------- Colors ---------- */
RepodestCore.LANG_COLORS={'JavaScript':'#f1e05a','TypeScript':'#3178c6','Python':'#3572A5','HTML':'#e34c26','CSS':'#563d7c','SCSS':'#c6538c','Java':'#b07219','Kotlin':'#A97BFF','C':'#555555','C++':'#f34b7d','C#':'#178600','Go':'#00ADD8','Rust':'#dea584','Ruby':'#701516','PHP':'#4F5D95','Swift':'#F05138','Shell':'#89e051','PowerShell':'#012456','Dart':'#00B4AB','Vue':'#41b883','Svelte':'#ff3e00','Lua':'#000080','R':'#198CE7','Scala':'#c22d40','Perl':'#0298c3','Haskell':'#5e5086','Elixir':'#6e4a7e','Clojure':'#db5855','Objective-C':'#438eff','Assembly':'#6E4C13','Jupyter Notebook':'#DA5B0B','Dockerfile':'#384d54','Makefile':'#427819','Nix':'#7e7eff','Zig':'#ec915c','TeX':'#3D6117','Batchfile':'#C1F12E','CMake':'#DA3434','Groovy':'#4298b8','GDScript':'#355570','Solidity':'#AA6746','Vim Script':'#199f4b','Smarty':'#f0c674','Pug':'#a86454','Twig':'#c1d026','Handlebars':'#f7931e','HCL':'#844FBA','MDX':'#fcb32c'};
RepodestCore.PALETTE=['#a855f7','#22d3ee','#f1e05a','#3178c6','#3572A5','#e34c26','#563d7c','#b07219','#00ADD8','#dea584','#4F5D95','#F05138','#89e051','#ec4899','#22c55e','#eab308','#ef4444'];
RepodestCore.langColor=function(l){return RepodestCore.LANG_COLORS[l]||RepodestCore.PALETTE[((l||'').length*7)%RepodestCore.PALETTE.length]};

/* ---------- Input parsing (multi-platform) ---------- */
RepodestCore.detectPlatform=function(input){
  input=input||'';
  input=input.trim();
  if(/gitlab\.com/i.test(input))return 'gitlab';
  if(/bitbucket\.org/i.test(input))return 'bitbucket';
  return 'github';
};
RepodestCore.parseRepoInput=function(v){
  if(!v)return null;
  v=v.trim().replace(/\.git+$/,'');
  let m=v.match(/github\.com[\/:]([^\/\s]+)\/([^\/#?\s]+)/i);
  if(m)return{owner:m[1],repo:m[2],platform:'github'};
  m=v.match(/gitlab\.com\/([^\/\s]+)\/([^\/#?\s]+)/i);
  if(m)return{owner:m[1],repo:m[2],platform:'gitlab'};
  m=v.match(/bitbucket\.org\/([^\/\s]+)\/([^\/#?\s]+)/i);
  if(m)return{owner:m[1],repo:m[2],platform:'bitbucket'};
  m=v.match(/^([\w.-]+)\/([\w.-]+)$/);
  if(m)return{owner:m[1],repo:m[2],platform:'github'};
  return null;
};

/* ---------- ASCII file tree ---------- */
RepodestCore.asciiTree=function(paths){
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
};

/* ---------- Health check (pure) ---------- */
RepodestCore.healthCheckPaths=function(paths,m){
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
};

/* ---------- SPDX license database ---------- */
RepodestCore.SPDX_MAP={
  'MIT':{name:'MIT License',perms:['Commercial use','Modification','Distribution','Private use'],conds:['Include copyright','Include license'],lims:['Liability','Warranty']},
  'Apache-2.0':{name:'Apache License 2.0',perms:['Commercial use','Modification','Distribution','Patent use','Private use'],conds:['Include copyright','State changes','Include notice'],lims:['Liability','Trademark use','Warranty']},
  'GPL-2.0':{name:'GNU GPL v2',perms:['Commercial use','Modification','Distribution','Private use'],conds:['Include copyright','State changes','Disclose source','Same license'],lims:['Liability','Warranty']},
  'GPL-2.0-only':{name:'GNU GPL v2 only',perms:['Commercial use','Modification','Distribution','Private use'],conds:['Include copyright','State changes','Disclose source','Same license'],lims:['Liability','Warranty']},
  'GPL-3.0':{name:'GNU GPL v3',perms:['Commercial use','Modification','Distribution','Patent use','Private use'],conds:['Include copyright','State changes','Disclose source','Same license','Include install instructions'],lims:['Liability','Warranty']},
  'GPL-3.0-only':{name:'GNU GPL v3 only',perms:['Commercial use','Modification','Distribution','Patent use','Private use'],conds:['Include copyright','State changes','Disclose source','Same license','Include install instructions'],lims:['Liability','Warranty']},
  'LGPL-2.1':{name:'GNU LGPL v2.1',perms:['Commercial use','Modification','Distribution','Private use'],conds:['Include copyright','Disclose source','Same license (library)'],lims:['Liability','Warranty']},
  'LGPL-3.0':{name:'GNU LGPL v3',perms:['Commercial use','Modification','Distribution','Patent use','Private use'],conds:['Include copyright','Disclose source','Same license (library)','Include install instructions'],lims:['Liability','Warranty']},
  'BSD-2-Clause':{name:'BSD 2-Clause',perms:['Commercial use','Modification','Distribution','Private use'],conds:['Include copyright','Include license'],lims:['Liability','Warranty']},
  'BSD-3-Clause':{name:'BSD 3-Clause',perms:['Commercial use','Modification','Distribution','Private use'],conds:['Include copyright','Include license','No endorsement'],lims:['Liability','Warranty']},
  'MPL-2.0':{name:'Mozilla Public License 2.0',perms:['Commercial use','Modification','Distribution','Patent use','Private use'],conds:['Include copyright','Disclose source','Same license (file)'],lims:['Liability','Warranty','Trademark use']},
  'ISC':{name:'ISC License',perms:['Commercial use','Modification','Distribution','Private use'],conds:['Include copyright','Include license'],lims:['Liability','Warranty']},
  'Unlicense':{name:'The Unlicense',perms:['Commercial use','Modification','Distribution','Private use'],conds:[],lims:['Liability','Warranty']},
  'CC0-1.0':{name:'CC0 1.0 Universal',perms:['Commercial use','Modification','Distribution','Private use'],conds:[],lims:['Liability','Warranty','Patent use']},
  'AGPL-3.0':{name:'GNU AGPL v3',perms:['Commercial use','Modification','Distribution','Patent use','Private use'],conds:['Include copyright','State changes','Disclose source','Same license','Network use is distribution','Include install instructions'],lims:['Liability','Warranty']},
  'AGPL-3.0-only':{name:'GNU AGPL v3 only',perms:['Commercial use','Modification','Distribution','Patent use','Private use'],conds:['Include copyright','State changes','Disclose source','Same license','Network use is distribution','Include install instructions'],lims:['Liability','Warranty']},
  'EPL-2.0':{name:'Eclipse Public License 2.0',perms:['Commercial use','Modification','Distribution','Private use'],conds:['Include copyright','Disclose source','Same license'],lims:['Liability','Warranty']},
  '0BSD':{name:'BSD Zero Clause',perms:['Commercial use','Modification','Distribution','Private use'],conds:[],lims:['Liability','Warranty']},
  'WTFPL':{name:'Do What The F*ck You Want To',perms:['Commercial use','Modification','Distribution','Private use'],conds:[],lims:[]},
  'Zlib':{name:'zlib License',perms:['Commercial use','Modification','Distribution','Private use'],conds:['Include copyright','State changes'],lims:['Liability','Warranty']},
  'BSL-1.0':{name:'Boost Software License 1.0',perms:['Commercial use','Modification','Distribution','Private use'],conds:['Include copyright','Include license'],lims:['Liability','Warranty']},
};

/* ---------- Token Shrinker: strip comments & excess whitespace ---------- */
RepodestCore.stripCommentsAndWhitespace=function(src,ext){
  if(!src||typeof src!=='string')return '';
  ext=(ext||'').toLowerCase();
  let code=src;

  /* C-style languages: js, ts, jsx, tsx, c, cpp, cs, java, go, rs, swift, php, kt, etc. */
  if(/^(js|ts|jsx|tsx|mjs|cjs|c|h|cpp|cc|cxx|hpp|hh|cs|java|go|rs|swift|kt|kts|dart|scala|php)$/.test(ext)){
    /* Replace strings and regex literals with placeholders or preserve them safely */
    const strings=[];
    code=code.replace(/(["'`])(?:\\.|(?!\1)[^\\\r\n])*\1/g,m=>{
      strings.push(m);
      return '__STR_'+(strings.length-1)+'__';
    });
    /* Strip single line comments // ... */
    code=code.replace(/\/\/.*$/gm,'');
    /* Strip multi-line comments /* ... * / */
    code=code.replace(/\/\*[\s\S]*?\*\//g,'');
    /* Restore strings */
    code=code.replace(/__STR_(\d+)__/g,(_,i)=>strings[i]!==undefined?strings[i]:'');
  } else if(/^(py|pyw|rb|sh|bash|zsh|yaml|yml|r)$/.test(ext)){
    /* Python, Ruby, Shell, YAML: # comments */
    const strings=[];
    /* Handle triple-quotes in Python */
    if(ext.startsWith('py')){
      code=code.replace(/("""[\s\S]*?"""|'''[\s\S]*?''')/g,m=>{
        strings.push(m);
        return '__STR_'+(strings.length-1)+'__';
      });
    }
    code=code.replace(/(["'])(?:\\.|(?!\1)[^\\\r\n])*\1/g,m=>{
      strings.push(m);
      return '__STR_'+(strings.length-1)+'__';
    });
    code=code.replace(/#.*$/gm,'');
    code=code.replace(/__STR_(\d+)__/g,(_,i)=>strings[i]!==undefined?strings[i]:'');
  } else if(/^(html|htm|xml|svg|vue|svelte)$/.test(ext)){
    /* HTML comments <!-- ... --> */
    code=code.replace(/<!--[\s\S]*?-->/g,'');
  } else if(/^(css|scss|less)$/.test(ext)){
    /* CSS comments /* ... * / */
    code=code.replace(/\/\*[\s\S]*?\*\//g,'');
  } else if(/^(sql)$/.test(ext)){
    /* SQL comments -- and /* ... * / */
    code=code.replace(/--.*$/gm,'');
    code=code.replace(/\/\*[\s\S]*?\*\//g,'');
  }

  /* Clean up whitespace: trim trailing spaces and collapse 3+ consecutive blank lines into 1 */
  return code
    .split('\n')
    .map(line=>line.replace(/[ \t]+$/,''))
    .join('\n')
    .replace(/\n{3,}/g,'\n\n')
    .trim();
};

/* ---------- Smart Goal-Oriented File Presets ---------- */
RepodestCore.filterPathsByGoal=function(paths,goal){
  if(!Array.isArray(paths)||!paths.length)return[];
  goal=(goal||'').toLowerCase();
  const isExcluded=p=>/(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|dist|build|coverage|\.git|node_modules|vendor)\//i.test(p);
  const valid=paths.filter(p=>!isExcluded(p));

  if(goal==='bug'||goal==='bughunter'){
    /* Source files + tests + configs */
    const testRx=/(^|\/)(tests?|specs?|__tests__)(\/|$)|(\.|\b)(test|spec)\.[a-z]+$/i;
    const entryRx=/(^|\/)(index|main|app|server|cli|router|routes|api)\.[a-z]+$/i;
    const isTest=valid.filter(p=>testRx.test(p));
    const isEntry=valid.filter(p=>entryRx.test(p));
    const otherCode=valid.filter(p=>/^(src|lib|app|pkg|internal)\//i.test(p));
    return Array.from(new Set([...isTest,...isEntry,...otherCode])).slice(0,18);
  }

  if(goal==='arch'||goal==='architecture'){
    /* Types, interfaces, entry points, manifests */
    const archRx=/(^|\/)(types?|interfaces?|models?|schema|schemas?|routes?|api|index|main|app)\.[a-z]+$/i;
    const manifestRx=/(^|\/)(package\.json|pyproject\.toml|Cargo\.toml|go\.mod|pom\.xml|composer\.json)$/i;
    return valid.filter(p=>archRx.test(p)||manifestRx.test(p)||p.endsWith('.d.ts')).slice(0,15);
  }

  if(goal==='security'||goal==='audit'){
    /* Auth, middleware, crypto, env, manifests, workflows */
    const secRx=/(auth|login|jwt|token|crypt|secret|key|session|guard|perm|middleware|protect|security|\.env|\.github\/workflows)/i;
    const manifestRx=/(^|\/)(package\.json|requirements\.txt|pyproject\.toml|Cargo\.toml|go\.mod)$/i;
    return valid.filter(p=>secRx.test(p)||manifestRx.test(p)).slice(0,15);
  }

  if(goal==='docs'||goal==='document'){
    /* Readme, docs folder, contributing, changelog, comments */
    const docRx=/(^|\/)(readme|contributing|changelog|license|security|architecture|api)\.md$/i;
    const docFolder=/(^|\/)docs?\//i;
    return valid.filter(p=>docRx.test(p)||docFolder.test(p)).slice(0,12);
  }

  return valid.slice(0,10);
};

/* ---------- Pull Request analysis (pure) ---------- */
RepodestCore.parsePRInput=function(v){
  if(!v)return null;
  v=String(v).trim();
  let m=v.match(/github\.com\/([^\/\s]+)\/([^\/\s]+)\/(?:pull|pulls)\/(\d+)/i);
  if(m)return{owner:m[1],repo:m[2].replace(/\.git+$/,''),number:parseInt(m[3],10),platform:'github'};
  m=v.match(/^([\w.-]+)\/([\w.-]+)\s*#(\d+)$/);
  if(m)return{owner:m[1],repo:m[2],number:parseInt(m[3],10),platform:'github'};
  m=v.match(/^(\d{1,7})$/);
  if(m)return{number:parseInt(m[1],10),platform:'github'};
  return null;
};

RepodestCore.PR_RISK=[
  {re:/(^|\/)(auth|login|logout|session|passport|jwt|oauth|sso|identity)([\/._-]|$)/i,label:'Authentication / session handling',w:3},
  {re:/(crypto|cipher|secret|password|passwd|private[-_]?key|\.pem$|token)/i,label:'Cryptography or secrets',w:3},
  {re:/(^|\/)migrations?\//i,label:'Database schema / migration',w:3},
  {re:/\.(env|pem|key|p12|pfx|crt)$/i,label:'Sensitive file type',w:3},
  {re:/(^|\/)(package\.json|requirements\.txt|pyproject\.toml|Cargo\.toml|go\.mod|pom\.xml|composer\.json|Gemfile|yarn\.lock|package-lock\.json|pnpm-lock\.yaml|poetry\.lock|Cargo\.lock|go\.sum)$/i,label:'Dependency manifest / lockfile',w:2},
  {re:/(^|\/)\.github\/(workflows|actions)\//i,label:'CI/CD pipeline',w:2},
  {re:/(^|\/|_)(dockerfile|docker-compose|dockerignore)/i,label:'Container / deployment config',w:2},
  {re:/(^|\/)(nginx|haproxy|traefik|kubernetes|helm|terraform|k8s)([\/._-]|$)/i,label:'Infrastructure config',w:2},
  {re:/(security|csp|xss|sanitize|escape|shell|exec|spawn|eval)/i,label:'Security-sensitive code',w:2},
  {re:/(^|\/)(licen[cs]e|copying)(\.|$)/i,label:'License change',w:2}
];

RepodestCore.analyzePR=function(pr,files){
  files=Array.isArray(files)?files:[];
  const totals=files.reduce((a,f)=>{a.add+=f.additions||0;a.del+=f.deletions||0;a.changes+=(f.changes||(f.additions||0)+(f.deletions||0));return a},{add:0,del:0,changes:0});
  const byType={};
  files.forEach(f=>{
    const p=f.filename||'';
    let t='source';
    if(/(^|\/)(tests?|__tests__|specs?)(\/|$)|\.(test|spec)\.[a-z]+$/i.test(p))t='test';
    else if(/(^|\/)(docs?)(\/|$)|\.(md|mdx|rst)$|^readme\./i.test(p))t='docs';
    else if(/(^|\/)(package\.json|requirements\.txt|pyproject\.toml|Cargo\.toml|go\.mod|pom\.xml|composer\.json|Gemfile)|\.(config|rc)\.[a-z]+$|(^|\/)(tsconfig|babel|webpack|vite|rollup|jest|vitest|eslint|prettier|biome)/i.test(p))t='config';
    else if(RepodestCore.BINARY_EXT.has(RepodestCore.extOf(p)))t='asset';
    else if(!RepodestCore.TEXT_EXT.has(RepodestCore.extOf(p))&&RepodestCore.extOf(p))t='other';
    const g=byType[t]=byType[t]||{files:0,add:0,del:0,list:[]};
    g.files++;g.add+=f.additions||0;g.del+=f.deletions||0;g.list.push(p);
  });
  /* risks: one entry per risk type, with the matching files */
  const riskMap={};
  files.forEach(f=>{
    const p=f.filename||'';
    RepodestCore.PR_RISK.forEach(r=>{
      if(r.re.test(p)){
        const e=riskMap[r.label]=riskMap[r.label]||{label:r.label,w:r.w,files:[]};
        e.files.push(p);
      }
    });
  });
  const risks=Object.values(riskMap).sort((a,b)=>b.w-a.w||b.files.length-a.files.length);
  const riskScore=Math.min(10,risks.reduce((a,r)=>a+r.w,0));
  /* change type from title / labels / file mix */
  const title=(pr&&pr.title)||'';
  const labels=((pr&&pr.labels)||[]).map(l=>(l&&l.name)||l);
  const labelTxt=labels.join(' ').toLowerCase();
  let changeType='other';
  if(/^(fix|fixes|fixup|bugfix|hotfix|patch|revert)\b/i.test(title)||/\bbug\b|\bfix\b/.test(labelTxt))changeType='fix';
  else if(/^(feat|feature|add|implement|support|introduce)\b/i.test(title)||/\benhancement\b|\bfeature\b/.test(labelTxt))changeType='feature';
  else if(/^(docs?|readme)\b/i.test(title)||/\bdocumentation\b/.test(labelTxt))changeType='docs';
  else if(/^(refactor|chore|clean|reorg|simplify|rename)\b/i.test(title))changeType='refactor';
  else if(byType.docs&&byType.docs.files===files.length)changeType='docs';
  else if(byType.test&&byType.test.files===files.length)changeType='test';
  /* size class by total changed lines */
  const totalLines=totals.add+totals.del;
  const sizeClass=totalLines<50?'tiny':totalLines<300?'small':totalLines<1000?'medium':totalLines<3000?'large':'XL';
  /* test coverage of the change: share of test lines among changed lines */
  const testLines=byType.test?(byType.test.add+byType.test.del):0;
  const testShare=totalLines?Math.round(testLines/totalLines*100):0;
  return{totals,byType,risks,riskScore,changeType,sizeClass,totalLines,testShare,
    verdict:riskScore>=7?'high':riskScore>=4?'medium':'low',
    truncated:files.length>=100};
};

RepodestCore.buildPRDigest=function(pr,files,an,opts){
  opts=opts||{};
  const m=pr||{};
  const lines=[];
  lines.push('# Pull Request Review Digest');
  lines.push('');
  lines.push('- **Repository**: '+(m.base&&m.base.repo&&m.base.repo.full_name||''));
  lines.push('- **PR #'+(m.number||'?')+'**: '+(m.title||''));
  lines.push('- **Author**: '+(m.user&&m.user.login||'unknown'));
  lines.push('- **State**: '+(m.merged_at?'merged':m.state||'open'));
  lines.push('- **Branch**: '+(m.head&&m.head.ref||'?')+' → '+(m.base&&m.base.ref||'?'));
  lines.push('- **Created**: '+(m.created_at||''));
  lines.push('- **Link**: '+(m.html_url||''));
  lines.push('');
  lines.push('## Change summary');
  lines.push('');
  lines.push('- Files changed: **'+(files?files.length:0)+'**');
  lines.push('- Additions: **+'+(an&&an.totals?an.totals.add:0)+'** / Deletions: **−'+(an&&an.totals?an.totals.del:0)+'**');
  lines.push('- Change type: **'+(an&&an.changeType||'other')+'** · Size: **'+(an&&an.sizeClass||'?')+'** ('+(an&&an.totalLines||0)+' lines)');
  lines.push('- Risk level: **'+(an&&an.verdict||'low')+' ('+(an&&an.riskScore||0)+'/10)**');
  if(an&&an.risks&&an.risks.length){
    lines.push('- Touched risk areas: '+an.risks.map(r=>r.label+' ('+r.files.length+' file'+(r.files.length>1?'s':'')+')').join('; '));
  }else{
    lines.push('- No high-risk areas touched');
  }
  if(an&&an.truncated)lines.push('- Note: the file list is truncated at 100 files, request the rest via pagination before deep review');
  if(m.body){
    lines.push('');
    lines.push('## PR description');
    lines.push('');
    lines.push(String(m.body).slice(0,2000));
  }
  lines.push('');
  lines.push('## Changed files');
  lines.push('');
  (files||[]).forEach(f=>{
    lines.push('### '+(f.filename||'')+(f.status&&f.status!=='modified'?' ('+f.status+')':''));
    lines.push('+'+(f.additions||0)+' / −'+(f.deletions||0));
    if(opts.includePatches!==false&&f.patch){
      const patch=String(f.patch);
      lines.push('```diff');
      lines.push(patch.length>4000?patch.slice(0,4000)+'\n… (truncated, view the full diff on GitHub)':patch);
      lines.push('```');
    }
    lines.push('');
  });
  lines.push('## Your task');
  lines.push('');
  lines.push('You are a senior code reviewer. Using the diffs above, produce:');
  lines.push('1. A plain-language summary of what this PR does and why');
  lines.push('2. The risky spots a reviewer should check first (auth, data loss, concurrency, security)');
  lines.push('3. Missing tests or edge cases');
  lines.push('4. A merge verdict: approve / request changes / needs discussion, with reasons');
  return lines.join('\n');
};

/* ---------- UMD export ---------- */
if(typeof module!=='undefined'&&module.exports)module.exports=RepodestCore;
if(typeof globalThis!=='undefined'){
  Object.keys(RepodestCore).forEach(k=>{globalThis[k]=RepodestCore[k]});
}
