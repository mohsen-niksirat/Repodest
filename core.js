'use strict';
/* ============================================================
   Repodest core — shared pure functions & data tables
   Loaded by: app.js (browser, exposes globals) and
              tests.test.js (Node, via module.exports)
   No DOM, no fetch — safe to run anywhere.
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

/* ---------- UMD export ---------- */
if(typeof module!=='undefined'&&module.exports)module.exports=RepodestCore;
if(typeof globalThis!=='undefined'){
  Object.keys(RepodestCore).forEach(k=>{globalThis[k]=RepodestCore[k]});
}
