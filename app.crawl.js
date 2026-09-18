'use strict';
/* ============================================================
   Repodest — Docs Crawler (Lizard-style)
   Recursively crawls a documentation site from the browser:
   fetches pages, strips boilerplate (nav/sidebar/footer/toc),
   and produces one clean text bundle you can feed to an LLM
   or append to the Repodest digest. Concurrency-bounded, same-origin
   by default, optional subpath restriction.
   Loaded after app.map.js. Shares the global scope.
   ============================================================ */

/* ---------- i18n ---------- */
Object.assign(I18N.en,{
  tabCrawl:'🦎 Crawl',
  crawlHint:'A browser-side documentation crawler. Give it a docs URL — it fetches pages <b>recursively</b>, strips navbars, sidebars, footers and TOCs, and gives you one clean text bundle for offline reading or your LLM / RAG pipeline. Same-origin only by default.',
  crawlBtn:'🦎 Crawl docs',crawlStop:'⏹ Stop',crawlAddDigest:'+ Add to digest',
  crawlUrlPh:'https://docs.example.com …',
  crawlMaxPages:'Max pages',crawlRestrict:'Restrict to the starting subpath',
  crawlCopy:'📋 Copy text',crawlDownload:'⬇️ Download .txt',
  crawlNoUrl:'Enter a documentation URL first.',
  crawlBadUrl:'That URL doesn’t look right — it needs a host, e.g. https://docs.example.com',
  crawlDone:'Crawl finished — {p} pages, {w} words.',
  crawlStopped:'Crawl stopped — {p} pages, {w} words.',
  crawlNoPages:'No usable pages found. The site may block browser fetches — try a different docs domain.',
  crawlRunning:'Crawling…',crawlQueued:'queued',crawlFailed:'failed',
  crawlStatsPages:'pages',crawlStatsWords:'words',crawlStatsTokens:'est. tokens',
  crawlPrefill:'Suggested start points from this repo',
  crawlProxyNote:'Direct fetch failed for some pages — retried through a public CORS proxy.'
});
Object.assign(I18N.fa,{
  tabCrawl:'🦎 خزش',
  crawlHint:'یک خزنده‌ی مستندات در مرورگر شما. یک آدرس داکیومنت بدهید — صفحات را <b>بازگشتی</b> واکشی می‌کند، منوها، سایدبارها، فوترها و فهرست‌ها را حذف می‌کند و یک متن تمیز برای مطالعه آفلاین یا تغذیه LLM / RAG تحویل می‌دهد. به‌طور پیش‌فرض فقط هم‌دامنه.',
  crawlBtn:'🦎 خزش مستندات',crawlStop:'⏹ توقف',crawlAddDigest:'+ افزودن به دایجست',
  crawlUrlPh:'https://docs.example.com …',
  crawlMaxPages:'حداکثر صفحات',crawlRestrict:'محدود کردن به زیرمسیر شروع',
  crawlCopy:'📋 کپی متن',crawlDownload:'⬇️ دانلود .txt',
  crawlNoUrl:'اول یک آدرس مستندات وارد کنید.',
  crawlBadUrl:'این آدرس درست به نظر نمی‌رسد — باید host داشته باشد، مثلاً https://docs.example.com',
  crawlDone:'خزش تمام شد — {p} صفحه، {w} کلمه.',
  crawlStopped:'خزش متوقف شد — {p} صفحه، {w} کلمه.',
  crawlNoPages:'صفحه‌ی مفیدی پیدا نشد. ممکن است سایت واکشی مرورگر را مسدود کند — یک دامنه‌ی دیگر را امتحان کنید.',
  crawlRunning:'در حال خزش…',crawlQueued:'در صف',crawlFailed:'ناموفق',
  crawlStatsPages:'صفحه',crawlStatsWords:'کلمه',crawlStatsTokens:'تقریباً توکن',
  crawlPrefill:'نقاط شروع پیشنهادی از این رپو',
  crawlProxyNote:'واکشی مستقیم برای بعضی صفحات ناموفق بود — از طریق یک CORS proxy عمومی دوباره تلاش شد.'
});

/* ---------- State ---------- */
const CRAWL={
  queue:[],visited:new Set(),pages:[],
  running:false,abort:null,
  root:null,           /* {origin,path} parsed from the seed URL */
  restrict:false,maxPages:10,
  proxyUsed:false
};
const CRAWL_NOISE_SELECTORS=[
  'script','style','noscript','iframe','svg','canvas','form','button','input','select',
  'nav','header','footer','aside',
  '[role="navigation"]','[role="banner"]','[role="contentinfo"]','[role="search"]','[role="complementary"]',
  '.sidebar','#sidebar','.side-nav','.navbar','.nav-bar','.topbar','.toc','#toc','.table-of-contents',
  '.breadcrumbs','.pagination','.pager','.menu','.search','.searchbox','.feedback','.edit-this-page',
  '.theme-toggle','.code-tabs','.tabs','.announcement','.banner','.ads','.advertising','.cookies',
  '.prev-next','.page-nav','.footer-links','.social','.share','.comments','#comments'
];
const CRAWL_MAIN_SELECTORS=[
  'main article','main','article','[role="main"]','#content .content','.content','.markdown-body',
  '.prose','.documentation','.doc-content','.page-content','#docs','div[role="main"]'
];
const CRAWL_SKIP_EXT=/\.(pdf|zip|tar|gz|png|jpg|jpeg|gif|webp|svg|mp3|mp4|mov|wav|woff2?|ttf|otf|exe|dmg|iso|epub)$/i;

/* ---------- Helpers ---------- */
function crawlT(k){return t(k)}
function crawlLog(...a){ /* keep noise out of the console unless debugging */ }

function crawlNormalize(u){
  try{u=new URL(u)}catch(e){return null}
  if(u.protocol!=='http:'&&u.protocol!=='https:')return null;
  u.hash='';
  let p=u.pathname;
  if(p.length>1&&p.endsWith('/'))p=p.slice(0,-1);
  u.pathname=p;
  return u
}
/* Same site: identical origin, or www <-> bare domain. */
function crawlSameSite(a,b){
  if(!a||!b)return false;
  if(a.origin===b.origin)return true;
  const strip=h=>h.replace(/^www\./,'');
  return strip(a.hostname)===strip(b.hostname)&&a.protocol===b.protocol
}
function crawlFetchUrl(u,signal){
  return fetch(u,{signal,redirect:'follow',headers:{'Accept':'text/html,application/xhtml+xml'}})
}

/* ---------- Fetch with a CORS-proxy fallback ----------
   Docs sites rarely send permissive CORS headers, so a plain browser
   fetch throws. We try directly first, then fall back to a public
   read-only proxy. */
const CRAWL_PROXIES=[
  u=>'https://api.allorigins.win/raw?url='+encodeURIComponent(u),
  u=>'https://corsproxy.io/?url='+encodeURIComponent(u)
];
async function crawlGet(url,signal){
  try{
    const r=await crawlFetchUrl(url,signal);
    if(r.ok){const t=await r.text();if(t)return{t,direct:true}}
  }catch(e){/* CORS or network — fall through to proxy */}
  for(const mk of CRAWL_PROXIES){
    try{
      const r=await fetch(mk(url),{signal,redirect:'follow'});
      if(r.ok){const t=await r.text();if(t)return{t,direct:false}}
    }catch(e){}
  }
  return null
}

/* ---------- HTML → clean text (the "noise filter") ---------- */
function crawlHtmlToPage(html,url){
  let doc;
  try{doc=new DOMParser().parseFromString(html,'text/html')}catch(e){return null}
  const titleEl=doc.querySelector('title');
  let title=titleEl?titleEl.textContent.trim():'';
  if(!title){const h1=doc.querySelector('h1');if(h1)title=h1.textContent.trim()}
  title=title.replace(/\s+/g,' ').slice(0,180);
  const tmp=doc.body||doc.documentElement;
  CRAWL_NOISE_SELECTORS.forEach(sel=>{
    try{tmp.querySelectorAll(sel).forEach(el=>el.remove())}catch(e){}
  });
  let main=null;
  for(const sel of CRAWL_MAIN_SELECTORS){
    main=tmp.querySelector(sel);
    if(main&&main.textContent.trim().length>200)break;
    main=null;
  }
  main=main||tmp;
  /* anchor links that only duplicate the heading text */
  try{main.querySelectorAll('a').forEach(a=>{const h=a.querySelector('h1,h2,h3,h4');if(h)a.replaceWith(h)})}
  catch(e){}
  let text=main.innerText||main.textContent||'';
  text=text.replace(/\n{3,}/g,'\n\n').replace(/[ \t]{2,}/g,' ').trim();
  if(text.length<100)return null;
  return{title:title||url,text,url}
}
function crawlPageToBlock(p){
  return '════════════════════════════════════════\n'
    +'TITLE: '+p.title+'\n'
    +'URL: '+p.url+'\n'
    +'════════════════════════════════════════\n'
    +p.text
}
function crawlLinks(doc,baseUrl,root,restrict){
  const out=[];
  const anchors=doc.querySelectorAll('a[href]');
  anchors.forEach(a=>{
    const href=a.getAttribute('href');
    if(!href||href.startsWith('#')||href.startsWith('mailto:')||href.startsWith('tel:')||href.startsWith('javascript:'))return;
    let nu;
    try{nu=crawlNormalize(new URL(href,baseUrl.href))}
    catch(e){return}
    if(!nu)return;
    if(CRAWL_SKIP_EXT.test(nu.pathname))return;
    if(!crawlSameSite(nu,root))return;
    if(restrict&&root.pathname&&!(nu.pathname===root.pathname||nu.pathname.startsWith(root.pathname+'/')))return;
    out.push(nu.href);
  });
  return out
}

/* ---------- The crawl (BFS + bounded concurrency) ---------- */
function startCrawl(){
  if(CRAWL.running)return;
  const inp=$('#crawlUrl');
  const raw=(inp?inp.value:'').trim();
  if(!raw){toast(crawlT('crawlNoUrl'),'err');inp&&inp.focus();return}
  const seed=crawlNormalize(raw);
  if(!seed||!seed.hostname){toast(crawlT('crawlBadUrl'),'err');return}
  const maxEl=$('#crawlMaxPages');
  CRAWL.maxPages=Math.min(50,Math.max(1,parseInt(maxEl?maxEl.value:'10',10)||10));
  CRAWL.restrict=!!($('#crawlRestrict')||{}).checked;
  CRAWL.root={origin:seed.origin,hostname:seed.hostname,pathname:seed.pathname.replace(/\/[^\/]*$/,'')};
  CRAWL.queue=[seed.href];CRAWL.visited=new Set([seed.href]);CRAWL.pages=[];
  CRAWL.proxyUsed=false;
  CRAWL.abort=new AbortController();
  CRAWL.running=true;
  crawlSetRunningUI(true);
  crawlRenderProgress();
  crawlWorkers();
}
function stopCrawl(){
  if(!CRAWL.running)return;
  CRAWL.running=false;
  try{CRAWL.abort.abort()}catch(e){}
  crawlSetRunningUI(false);
  crawlRenderOutput(crawlT('crawlStopped'));
}
function crawlWorkers(){
  const N=4; /* concurrent in-flight requests */
  let active=0;
  function next(){
    if(!CRAWL.running)return;
    if(CRAWL.pages.length>=CRAWL.maxPages){finishCrawl();return}
    if(!CRAWL.queue.length){
      if(active===0)finishCrawl();
      return;
    }
    while(active<N&&CRAWL.queue.length&&CRAWL.pages.length<CRAWL.maxPages&&CRAWL.running){
      const url=CRAWL.queue.shift();
      active++;
      crawlFetchPage(url).then(()=>{active--;crawlRenderProgress();next()})
        .catch(()=>{active--;crawlRenderProgress();next()});
    }
  }
  next();
}
async function crawlFetchPage(url){
  const status=CRAWL.pageStatus||(CRAWL.pageStatus={});
  status[url]='loading';
  const r=await crawlGet(url,CRAWL.abort.signal);
  if(!r){status[url]='fail';return}
  if(!r.direct)CRAWL.proxyUsed=true;
  const page=crawlHtmlToPage(r.t,url);
  status[url]=page?'done':'fail';
  if(!page)return;
  CRAWL.pages.push(page);
  /* harvest links for the next depth */
  if(CRAWL.pages.length<CRAWL.maxPages&&CRAWL.running){
    let doc;
    try{doc=new DOMParser().parseFromString(r.t,'text/html')}catch(e){doc=null}
    if(doc){
      for(const href of crawlLinks(doc,new URL(url),CRAWL.root,CRAWL.restrict)){
        if(!CRAWL.visited.has(href)){CRAWL.visited.add(href);CRAWL.queue.push(href)}
      }
    }
  }
}
function finishCrawl(){
  if(!CRAWL.running)return;
  CRAWL.running=false;
  crawlSetRunningUI(false);
  crawlRenderOutput(CRAWL.pages.length?crawlT('crawlDone'):crawlT('crawlNoPages'));
}

/* ---------- UI ---------- */
function crawlSetRunningUI(on){
  const btn=$('#crawlBtn');if(btn){btn.style.display=on?'none':''}
  const stop=$('#crawlStopBtn');if(stop)stop.style.display=on?'':'none'}
function crawlRenderProgress(){
  const list=$('#crawlPageList');
  if(!list)return;
  const status=CRAWL.pageStatus||{};
  const items=Array.from(CRAWL.visited).slice(-40);
  list.innerHTML=items.map(u=>{
    const st=status[u]||'queued';
    const cls=st==='done'?'done':st==='fail'?'fail':'';
    const icon=st==='done'?'✓':st==='fail'?'✕':'…';
    return '<div class="cp-row '+cls+'"><span class="cp-ic">'+icon+'</span><span>'+esc(u)+'</span></div>';
  }).join('');
  const bar=$('#crawlBar');
  if(bar){
    const pct=Math.min(100,Math.round(CRAWL.pages.length/CRAWL.maxPages*100));
    bar.style.width=pct+'%';
    bar.textContent=CRAWL.pages.length+'/'+CRAWL.maxPages;
  }
  crawlRenderStats();
}
function crawlRenderStats(){
  const el=$('#crawlStats');
  if(!el)return;
  const words=CRAWL.pages.reduce((a,p)=>a+(p.text.split(/\s+/).length||0),0);
  const chars=CRAWL.pages.reduce((a,p)=>a+p.text.length,0);
  el.innerHTML='<span><b>'+CRAWL.pages.length+'</b> '+crawlT('crawlStatsPages')+'</span>'
    +'<span><b>'+fmt(words)+'</b> '+crawlT('crawlStatsWords')+'</span>'
    +'<span><b>~'+fmt(Math.round(chars/4))+'</b> '+crawlT('crawlStatsTokens')+'</span>';
}
function crawlRenderOutput(msg){
  crawlRenderProgress();
  const out=$('#crawlOut');
  if(out){
    out.value=CRAWL.pages.map(crawlPageToBlock).join('\n\n');
    if(!CRAWL.pages.length&&msg)out.value=msg;
  }
  const acts=$('#crawlActions');
  if(acts)acts.style.display=CRAWL.pages.length?'':'none';
  if(CRAWL.pages.length&&msg)toast(msg.replace('{p}',CRAWL.pages.length).replace('{w}',fmt(crawlWordCount())),'ok');
  if(CRAWL.proxyUsed){
    const note=$('#crawlProxyNote');
    if(note)note.style.display='';
  }
}
function crawlWordCount(){return CRAWL.pages.reduce((a,p)=>a+(p.text.split(/\s+/).length||0),0)}
function crawlCopy(){
  const out=$('#crawlOut');
  if(!out||!out.value)return;
  (navigator.clipboard?navigator.clipboard.writeText(out.value):Promise.reject())
    .then(()=>toast(crawlT('crawlCopy'),'ok'))
    .catch(()=>{out.removeAttribute('readonly');out.select();document.execCommand('copy');out.setAttribute('readonly','');toast(crawlT('crawlCopy'),'ok')});
}
function crawlDownload(){
  const out=$('#crawlOut');
  if(!out||!out.value)return;
  const a=document.createElement('a');
  const host=(CRAWL.root&&CRAWL.root.hostname)||'docs';
  a.download=host.replace(/^www\./,'')+'-docs.txt';
  a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(out.value);
  a.click();
  toast(crawlT('crawlDownload'),'ok');
}
/* Feed the crawled bundle into the LLM digest as an extra section,
   so a repo + its docs travel in one prompt. */
function crawlAddToDigest(){
  const out=$('#crawlOut');
  if(!out||!out.value){toast(crawlT('crawlNoPages'),'err');return}
  S.docsBundle=out.value;
  toast(t('crawlAddDigest')+' — '+CRAWL.pages.length+' '+crawlT('crawlStatsPages'),'ok');
  switchTab('digest');
  const hint=$('#crawlDigestHint');
  if(hint)hint.style.display='';
}

/* ---------- Suggest start points from the loaded repo ---------- */
function crawlPrefill(){
  const el=$('#crawlPrefill');
  if(!el)return;
  const m=S.repo;
  if(!m){el.style.display='none';return}
  const cands=new Set();
  if(m.homepage&&/^https?:\/\//.test(m.homepage))cands.add(m.homepage.replace(/\/$/,''));
  const full=(m.full_name||'').toLowerCase();
  const name=(m.name||'').toLowerCase();
  const owner=((m.owner&&m.owner.login)||'').toLowerCase();
  if(full)cands.add('https://'+owner+'.github.io/'+name);
  cands.add('https://docs.'+name+'.com');
  cands.add('https://'+name+'.readthedocs.io');
  cands.add('https://'+name+'.docs.rs');
  const arr=[...cands].slice(0,4);
  if(!arr.length){el.style.display='none';return}
  el.style.display='';
  el.innerHTML='<span style="color:var(--text3);font-size:11px;letter-spacing:.4px">'+crawlT('crawlPrefill')+':</span>'
    +arr.map(u=>'<button class="ex" onclick="crawlPick(\''+esc(u)+'\')">'+esc(u)+'</button>').join('');
}
function crawlPick(u){
  const inp=$('#crawlUrl');
  if(inp)inp.value=u;
}

/* ============================================================
   Hooks
   ============================================================ */
(function crawlInit(){
  const _origSwitch=window.switchTab;
  if(typeof _origSwitch==='function'){
    window.switchTab=function(name){
      _origSwitch(name);
      if(name==='crawl'&&!CRAWL.running)crawlPrefill();
    };
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const inp=$('#crawlUrl');
    if(inp)inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();startCrawl()}});
  });
})();
