/**
 * Repodest E2E smoke checks — structural integrity of the app
 * Run: node e2e.smoke.js
 * These are DOM-free structural assertions: every UI hook referenced
 * in HTML must exist in app.js and vice versa. Complements unit tests.
 */

const fs=require('fs');
const path=require('path');

let _pass=0,_fail=0;
function check(name,fn){
  try{fn();_pass++;console.log('  ✓ '+name)}
  catch(e){_fail++;console.log('  ✗ '+name+'\n    '+e.message)}
}
function assert(cond,msg){if(!cond)throw new Error(msg)}

const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const appjs=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
const corejs=fs.readFileSync(path.join(__dirname,'core.js'),'utf8');
const swjs=fs.readFileSync(path.join(__dirname,'sw.js'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'manifest.json'),'utf8'));

console.log('\nHTML ↔ app.js wiring');
check('all onclick handlers resolve to app.js functions',()=>{
  const handlers=[...html.matchAll(/onclick="([a-zA-Z_$][\w$]*)\(/g)].map(m=>m[1]);
  const missing=[...new Set(handlers)].filter(fn=>!new RegExp('function\\s+'+fn+'\\b').test(appjs));
  assert(missing.length===0,'missing in app.js: '+missing.join(', '));
});
check('all tabs have matching panels',()=>{
  const tabs=[...html.matchAll(/data-tab="([\w-]+)"/g)].map(m=>m[1]);
  tabs.forEach(t=>assert(html.includes('id="p-'+t+'"'),'no panel for tab: '+t));
});
check('all IDs used by app.js $(...) exist in HTML (spot check)',()=>{
  const usedIds=[...appjs.matchAll(/\$\('#([\w-]+)'\)/g)].map(m=>m[1]);
  const uniq=[...new Set(usedIds)];
  /* dynamically created IDs are allowed to miss; spot check the static ones */
  const dynamicOk=new Set(['custTaskInput','cmdInput','cmdList','ftsStatus','diffBaseLabel','battleModal','cloneModal','cloneContent','depsCanvas','liveRegion','pwaInstallBtn','offlineBanner','tokTable','bmCode']);
  const missing=uniq.filter(id=>!html.includes('id="'+id+'"')&&!dynamicOk.has(id));
  assert(missing.length===0,'missing HTML ids: '+missing.slice(0,8).join(', '));
});
check('core.js loads before app.js',()=>{
  const ci=html.indexOf('core.js'),ai=html.indexOf('app.js');
  assert(ci>=0&&ai>=0&&ci<ai,'script order wrong');
});
check('no duplicate top-level const across core.js',()=>{
  const names=[...corejs.matchAll(/^RepodestCore\.(\w+)=/gm)].map(m=>m[1]);
  assert(new Set(names).size===names.length,'duplicates in core.js');
});

console.log('\nSyntax & integrity');
check('app.js has no cp1252 mojibake remnants',()=>{
  const bad=[...appjs.matchAll(/[ÃÂÐ¤][\x80-\xBF]/g)].length;
  assert(bad===0,'found '+bad+' mojibake sequences');
});
check('service worker pre-caches core.js',()=>{
  assert(/'\.\/core\.js'/.test(swjs),'core.js missing from SHELL_URLS');
});
check('manifest is valid PWA manifest',()=>{
  assert(manifest.name&&manifest.start_url!==undefined,'manifest fields missing');
});

console.log('\nFeature presence');
const features=[
  ['Deep analysis tab (HTML panel)','p-deep'],
  ['Command palette','openCommandPalette'],
  ['Gist sharing','shareDigestGist'],
  ['Battle Royale','runRoyale'],
  ['Badge generator','buildStaticBadge'],
  ['Branch diff','loadBranchDiff'],
  ['Full-text search','fullTextSearch'],
  ['Repo Wrapped','renderWrapped'],
  ['Favorites','toggleFavorite'],
  ['GHE support','apiBase()'],
  ['IndexedDB cache','idbGet'],
  ['Worker FTS','ftsScanWithWorker'],
  ['Part navigation','showDigestPart'],
  ['Ask-a-question','smartSelectForQuestion'],
  ['Monorepo scope','filterScope'],
];
features.forEach(([name,needle])=>{
  check(name,()=>assert(appjs.includes(needle)||html.includes(needle),needle+' not found'));
});

console.log('\n'+'═'.repeat(50));
console.log('E2E smoke: '+_pass+' passed, '+_fail+' failed');
console.log('═'.repeat(50));
process.exit(_fail>0?1:0);
