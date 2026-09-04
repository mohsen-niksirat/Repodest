'use strict';
/* ============================================================
   Repodest — Feature cards
   Share card, clone panel, similar repos, security scan,
   endpoint detector, README preview, shortcuts, i18n core,
   complexity, bus factor, releases, battle, dependency graph.
   Loaded after app.js (spine). Shares the global scope.
   ============================================================ */
/* ============================================================
   Feature 9: Share Card Templates
   ============================================================ */
let selectedShareTpl='minimal';
function shareCard(){
  const m=S.repo;if(!m)return;
  $('#shareTplModalBg').classList.remove('hidden');
}
function selectShareTpl(el){
  $$('.share-tpl').forEach(t=>t.classList.remove('selected'));
  el.classList.add('selected');
  selectedShareTpl=el.dataset.tpl;
}
function closeShareTplModal(){$('#shareTplModalBg').classList.add('hidden')}
function confirmShareTpl(){
  closeShareTplModal();
  ensureHtml2canvas().then(()=>{
    try{
      const m=S.repo;if(!m)return;
      const hc=healthCheck();
      const langs=Object.entries(S.langs).sort((a,b)=>b[1]-a[1]).slice(0,4);
      const total=Object.values(S.langs).reduce((a,b)=>a+b,0)||1;
      let statsHTML='';
      let footHTML='';
      if(selectedShareTpl==='minimal'){
        statsHTML=
          '<div class="sc-st"><b>'+hc.score+'</b><span>Health</span></div>'+
          '<div class="sc-st"><b>★ '+fmt(m.stargazers_count)+'</b><span>Stars</span></div>';
        footHTML='<span class="sc-badge">🧪 Repodest</span>';
      }else if(selectedShareTpl==='detailed'){
        statsHTML=
          '<div class="sc-st"><b>'+hc.score+'</b><span>Health</span></div>'+
          '<div class="sc-st"><b>★ '+fmt(m.stargazers_count)+'</b><span>Stars</span></div>'+
          '<div class="sc-st"><b>⑂ '+fmt(m.forks_count)+'</b><span>Forks</span></div>'+
          '<div class="sc-st"><b>'+fmt(FILEMAP.size)+'</b><span>Files</span></div>';
        footHTML='<span style="display:flex;gap:10px;align-items:center">'+langs.map(e=>'<span style="display:flex;gap:6px;align-items:center"><span style="width:11px;height:11px;border-radius:3px;display:inline-block;background:'+langColor(e[0])+'"></span>'+esc(e[0])+' '+(e[1]/total*100).toFixed(0)+'%</span>').join('')+'</span><span class="sc-badge">🧪 Repodest</span>';
      }else{
        const p=personaFor();
        const trophyCount=getAch().filter(a=>a.on).length;
        statsHTML=
          '<div class="sc-st"><b>'+hc.score+'</b><span>Health</span></div>'+
          '<div class="sc-st"><b>★ '+fmt(m.stargazers_count)+'</b><span>Stars</span></div>'+
          '<div class="sc-st"><b>'+p.i+'</b><span>'+esc(p.n)+'</span></div>'+
          '<div class="sc-st"><b>🏆 '+trophyCount+'</b><span>Trophies</span></div>';
        footHTML='<span class="sc-badge">🧪 Repodest</span>';
      }
      $('#shareCard').innerHTML=
        '<div class="sc-top"><img src="'+esc(m.owner&&m.owner.avatar_url)+'" crossorigin="anonymous"><div><h2>'+esc(m.name||'')+'</h2><div class="sc-u">'+esc(m.full_name||'')+'</div><div class="sc-desc">'+esc(m.description||'')+'</div></div></div>'+
        '<div class="sc-stats">'+statsHTML+'</div>'+
        '<div class="sc-foot">'+footHTML+'</div>';
      html2canvas($('#shareCard'),{scale:2,useCORS:true,backgroundColor:'#12121f'}).then(canvas=>{
        const a=document.createElement('a');
        a.href=canvas.toDataURL('image/png');
        a.download=(m.full_name||'repo').replace('/','-')+'-repodest.png';
        a.click();
        toast('Card downloaded ('+selectedShareTpl+')','ok');
      }).catch(()=>toast('Could not render the card','err'));
    }catch(e){toast('Could not render the card','err')}
  }).catch(()=>toast('Could not load card renderer','err'));
}

/* ============================================================
   Feature 10: Quick Clone Panel
   ============================================================ */
function openCloneModal(){
  const m=S.repo;if(!m)return;
  const url=m.html_url||('https://github.com/'+m.full_name);
  const opts=[
    {label:'Standard',cmd:'git clone '+url},
    {label:'Shallow',cmd:'git clone --depth 1 '+url},
    {label:'Recursive',cmd:'git clone --recursive '+url}
  ];
  $('#cloneOptions').innerHTML=opts.map(o=>
    '<div class="clone-row">'+
      '<span class="clone-label">'+esc(o.label)+'</span>'+
      '<code>'+esc(o.cmd)+'</code>'+
      '<button class="btn ghost sm" onclick="copyCloneCmd(this,\''+esc(o.cmd)+'\')">📋</button>'+
    '</div>'
  ).join('');
  generateQR(url);
  $('#cloneModalBg').classList.remove('hidden');
}
function closeCloneModal(){$('#cloneModalBg').classList.add('hidden')}
function copyCloneCmd(btn,cmd){
  navigator.clipboard.writeText(cmd).then(()=>{
    btn.textContent='✓';
    setTimeout(()=>btn.textContent='📋',1500);
    toast('Copied to clipboard','ok');
  }).catch(()=>toast('Copy failed','err'));
}
function generateQR(url){
  const wrap=$('#qrWrap');
  const size=180;
  const canvas=document.createElement('canvas');
  canvas.width=size;canvas.height=size;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,size,size);
  /* Simple QR-like visual: encode URL as a grid of modules */
  const modules=21;
  const cellSize=Math.floor(size/modules);
  const offset=Math.floor((size-cellSize*modules)/2);
  /* Generate a deterministic pattern from the URL */
  const hash=simpleHash(url);
  ctx.fillStyle='#000';
  /* Draw finder patterns (3 corners) */
  drawFinderPattern(ctx,offset,offset,cellSize);
  drawFinderPattern(ctx,offset+cellSize*(modules-7),offset,cellSize);
  drawFinderPattern(ctx,offset,offset+cellSize*(modules-7),cellSize);
  /* Draw data modules from hash */
  for(let i=0;i<modules;i++){
    for(let j=0;j<modules;j++){
      if(isFinderArea(i,j,modules))continue;
      const idx=(i*modules+j)%hash.length;
      if(hash.charCodeAt(idx)%3!==0){
        ctx.fillStyle='#000';
        ctx.fillRect(offset+j*cellSize,offset+i*cellSize,cellSize-1,cellSize-1);
      }
    }
  }
  wrap.innerHTML='';
  wrap.appendChild(canvas);
  const label=document.createElement('div');
  label.style.cssText='text-align:center;font-size:11px;color:#666;margin-top:8px;font-family:var(--mono)';
  label.textContent=url;
  wrap.appendChild(label);
}
function simpleHash(s){
  let h='';
  for(let i=0;i<s.length;i++){
    h+=((s.charCodeAt(i)*31+i*17)%256).toString(16).padStart(2,'0');
  }
  return h+h+h; /* repeat to fill grid */
}
function drawFinderPattern(ctx,x,y,cs){
  ctx.fillStyle='#000';
  ctx.fillRect(x,y,cs*7,cs*7);
  ctx.fillStyle='#fff';
  ctx.fillRect(x+cs,y+cs,cs*5,cs*5);
  ctx.fillStyle='#000';
  ctx.fillRect(x+cs*2,y+cs*2,cs*3,cs*3);
}
function isFinderArea(i,j,ms){
  if(i<8&&j<8)return true;
  if(i<8&&j>=ms-8)return true;
  if(i>=ms-8&&j<8)return true;
  return false;
}

/* ============================================================
   Feature 11: Similar Repos Finder
   ============================================================ */
async function renderSimilarRepos(){
  const el=$('#similarContent');
  const card=$('#similarCard');
  if(!el||!card)return;
  const m=S.repo;
  if(!m||(S.platform!=='github'&&S.platform!=='ghe')){card.style.display='none';return}
  card.style.display='';
  const topics=(m.topics||[]).slice(0,3);
  const lang=m.language||'';
  if(!topics.length&&!lang){
    el.innerHTML='<span style="color:var(--text3);font-size:12.5px">No topics or language to find similar repos.</span>';
    return;
  }
  el.innerHTML='<span style="color:var(--text3);font-size:12.5px">Searching…</span>';
  try{
    let queryParts=[];
    if(topics.length)queryParts.push('topic:'+topics[0]);
    if(lang)queryParts.push('language:'+lang);
    const q=encodeURIComponent(queryParts.join('+')+' in:name,description');
    const data=await api('/search/repositories?q='+q+'&per_page=7&sort=stars');
    const repos=(data.items||[]).filter(r=>r.full_name!==m.full_name).slice(0,6);
    if(!repos.length){
      el.innerHTML='<span style="color:var(--text3);font-size:12.5px">No similar repos found.</span>';
      return;
    }
    el.innerHTML='<div class="similar-grid">'+repos.map(r=>
      '<div class="similar-card" onclick="loadRepo(\''+esc((r.owner&&r.owner.login)||'')+'\',\''+esc(r.name||'')+'\',\'github\')">'+
        '<h4>'+esc(r.name||'')+'<b>★ '+fmt(r.stargazers_count)+'</b></h4>'+
        '<div class="sim-desc">'+esc(r.description||'No description')+'</div>'+
        '<div class="sim-meta">'+esc(r.full_name||'')+(r.language?' · '+esc(r.language):'')+'</div>'+
      '</div>'
    ).join('')+'</div>';
  }catch(e){
    el.innerHTML='<span style="color:var(--text3);font-size:12.5px">Could not fetch similar repos.</span>';
  }
}

/* ============================================================
   Feature 12: Security Quick Scan
   ============================================================ */
function renderSecurityScan(){
  const el=$('#securityContent');
  const card=$('#securityCard');
  if(!el||!card)return;
  card.style.display='';
  const paths=[];FILEMAP.forEach((v,k)=>paths.push(k));
  const checks=[
    {name:'.env file',found:paths.some(p=>/(^|\/)\.env(\.|$)/i.test(p)),type:'danger'},
    {name:'credentials file',found:paths.some(p=>/credentials/i.test(p)),type:'danger'},
    {name:'*.pem files',found:paths.some(p=>/\.pem$/i.test(p)),type:'danger'},
    {name:'*.key files',found:paths.some(p=>/\.key$/i.test(p)),type:'danger'},
    {name:'id_rsa / id_ed25519',found:paths.some(p=>/(^|\/)id_(rsa|ed25519|dsa)($|\.)/i.test(p)),type:'danger'},
    {name:'.npmrc with tokens',found:paths.some(p=>/(^|\/)\.npmrc$/i.test(p)),type:'warn'},
    {name:'AWS credentials',found:paths.some(p=>/(^|\/)\.aws\/credentials$/i.test(p)),type:'danger'},
    {name:'SECURITY.md',found:paths.some(p=>/(^|\/)security\.md$/i.test(p)),type:'safe'},
    {name:'.github/dependabot.yml',found:paths.some(p=>p==='.github/dependabot.yml'||p==='.github/dependabot.yaml'),type:'safe'},
    {name:'.gitignore present',found:paths.some(p=>/(^|\/)\.gitignore$/i.test(p)),type:'safe'},
    {name:'No hardcoded secrets (basic)',found:!paths.some(p=>/secret|password|api[_-]?key/i.test(p)),type:'safe'}
  ];
  const safeCount=checks.filter(c=>c.type==='safe'&&c.found).length;
  const dangerCount=checks.filter(c=>c.type==='danger'&&c.found).length;
  const totalSafe=checks.filter(c=>c.type==='safe').length;
  const score=Math.round(((safeCount+1)/(totalSafe+1))*100);
  const scoreColor=score>=80?'var(--green)':score>=50?'var(--yellow)':'var(--red)';
  el.innerHTML=
    '<div class="security-score">'+
      '<div class="sec-ring" style="border:3px solid '+scoreColor+';color:'+scoreColor+'">'+score+'</div>'+
      '<div><div style="font-weight:700;font-size:15px">Security Score</div>'+
      '<div class="sec-label">'+dangerCount+' potential issue'+(dangerCount!==1?'s':'')+' found · '+safeCount+'/'+totalSafe+' best practices</div></div>'+
    '</div>'+
    '<div class="security-checklist">'+checks.map(c=>{
      const cls=c.found?(c.type==='safe'?'safe':c.type==='warn'?'warn':'danger'):(c.type==='safe'?'warn':'safe');
      const icon=c.found?(c.type==='safe'?'✓':'!'):(c.type==='safe'?'✕':'✓');
      return '<div class="sec-item '+cls+'"><span class="sec-icon">'+icon+'</span><span>'+esc(c.name)+' · '+(c.found?'found':'not found')+'</span></div>';
    }).join('')+'</div>';
}

/* ============================================================
   Feature 13: API Endpoint Detector
   ============================================================ */
function renderEndpoints(){
  const el=$('#endpointsContent');
  const badge=$('#epBadge');
  const card=$('#endpointsCard');
  if(!el||!card)return;
  card.style.display='';
  const endpoints=[];
  const scanned=new Set();
  /* Scan text files for route patterns */
  const routePatterns=[
    {re:/\bapp\s*\.\s*(get|post|put|delete|patch|all)\s*\(\s*['"`]([^'"`]+)/gi,framework:'Express'},
    {re:/\brouter\s*\.\s*(get|post|put|delete|patch|all)\s*\(\s*['"`]([^'"`]+)/gi,framework:'Express'},
    {re:/@(app|router)\s*\.\s*(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)/gi,framework:'Flask/FastAPI'},
    {re:/@(app|router)\s*\.\s*route\s*\(\s*['"`]([^'"`]+)/gi,framework:'Flask'}
  ];
  /* Check for Next.js API routes by file path */
  FILEMAP.forEach((f,p)=>{
    if(/^(pages|app)\/api\//.test(p)||/^src\/(pages|app)\/api\//.test(p)){
      const cleanPath=p.replace(/^src\//,'').replace(/^(pages|app)\/api/,'/api').replace(/\/index\.(js|ts|jsx|tsx)$/,'').replace(/\.(js|ts|jsx|tsx)$/,'');
      endpoints.push({method:'*',path:cleanPath||'/api',file:p,framework:'Next.js'});
    }
  });
  /* Scan first 50 text files for route patterns */
  let count=0;
  FILEMAP.forEach((f,p)=>{
    if(count>=50)return;
    const ext=extOf(p);
    if(!['js','ts','jsx','tsx','py','rb','go','java','php'].includes(ext))return;
    if(scanned.has(p))return;
    scanned.add(p);
    count++;
    /* We can't read file contents here, but we can check file paths for API patterns */
    if(/routes?\//i.test(p)||/api\//i.test(p)||/controller/i.test(p)){
      endpoints.push({method:'?',path:'(detected via path)',file:p,framework:'Unknown'});
    }
  });
  badge.textContent=endpoints.length;
  if(!endpoints.length){
    el.innerHTML='<span style="color:var(--text3);font-size:12.5px">No API endpoints detected from file paths. Generate a digest and scan the code for route patterns.</span>';
    return;
  }
  el.innerHTML='<div class="endpoint-list">'+endpoints.slice(0,30).map(ep=>{
    const methodClass=(ep.method||'get').toLowerCase();
    return '<div class="endpoint-row">'+
      '<span class="ep-method '+esc(methodClass)+'">'+esc(ep.method)+'</span>'+
      '<span class="ep-path">'+esc(ep.path)+'</span>'+
      '<span class="ep-file">'+esc(ep.file)+'</span>'+
    '</div>';
  }).join('')+'</div>';
}

/* ============================================================
   Feature 14: README Preview (Rendered Markdown)
   ============================================================ */
function parseMarkdown(md){
  if(!md)return'';
  let html=md;
  /* Code blocks (fenced) */
  html=html.replace(/```(\w*)\n([\s\S]*?)```/g,(m,lang,code)=>'<pre><code>'+esc(code)+'</code></pre>');
  /* Inline code */
  html=html.replace(/`([^`]+)`/g,(m,code)=>'<code>'+esc(code)+'</code>');
  /* Headings */
  html=html.replace(/^######\s+(.+)$/gm,'<h6>$1</h6>');
  html=html.replace(/^#####\s+(.+)$/gm,'<h5>$1</h5>');
  html=html.replace(/^####\s+(.+)$/gm,'<h4>$1</h4>');
  html=html.replace(/^###\s+(.+)$/gm,'<h3>$1</h3>');
  html=html.replace(/^##\s+(.+)$/gm,'<h2>$1</h2>');
  html=html.replace(/^#\s+(.+)$/gm,'<h1>$1</h1>');
  /* Bold and italic */
  html=html.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
  html=html.replace(/\*([^*]+)\*/g,'<em>$1</em>');
  /* Links */
  html=html.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
  /* Images */
  html=html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,'<img src="$2" alt="$1">');
  /* Blockquotes */
  html=html.replace(/^>\s+(.+)$/gm,'<blockquote>$1</blockquote>');
  /* Horizontal rules */
  html=html.replace(/^---+$/gm,'<hr>');
  /* Unordered lists */
  html=html.replace(/^[\-*]\s+(.+)$/gm,'<li>$1</li>');
  html=html.replace(/(<li>[^<]*<\/li>\n?)+/g,(m)=>'<ul>'+m+'</ul>');
  /* Paragraphs (lines that aren't already wrapped) */
  html=html.replace(/^(?!<[a-z/])(.+)$/gm,'<p>$1</p>');
  /* Clean up empty paragraphs */
  html=html.replace(/<p>\s*<\/p>/g,'');
  return html;
}
async function renderReadmePreview(){
  const el=$('#readmePreview');
  const card=$('#readmeCard');
  if(!el||!card)return;
  const m=S.repo;if(!m){card.style.display='none';return}
  card.style.display='';
  const readmePath=Array.from(FILEMAP.keys()).find(p=>/(^|\/)readme\.md$/i.test(p));
  if(!readmePath){
    el.innerHTML='<span style="color:var(--text3);font-size:12.5px">No README.md found in this repository.</span>';
    return;
  }
  el.innerHTML='<span style="color:var(--text3);font-size:12.5px">Loading README…</span>';
  try{
    const branch=(m.default_branch)||'main';
    const raw=rawUrl(m.full_name,branch,readmePath);
    const resp=await fetch(raw);
    if(!resp.ok)throw new Error('Failed to fetch');
    const md=await resp.text();
    el.innerHTML='<div class="readme-preview">'+parseMarkdown(md.slice(0,30000))+'</div>';
  }catch(e){
    el.innerHTML='<span style="color:var(--text3);font-size:12.5px">Could not load README content.</span>';
  }
}

/* ============================================================
   Feature 15: Keyboard Shortcuts
   ============================================================ */
function openShortcutsModal(){$('#shortcutsModalBg').classList.remove('hidden')}
function closeShortcutsModal(){$('#shortcutsModalBg').classList.add('hidden')}

/* ============================================================
   Feature 16: Multi-language UI (i18n)
   ============================================================ */
const I18N={
  en:{
    tabOverview:'🩺 Overview',tabLanguages:'📊 Languages',tabFiles:'🗂️ Files',
    tabDigest:'🤖 Digest',tabActivity:'📈 Activity',tabFun:'🏆 Fun',tabDeps:'🔗 Deps',tabDeep:'🔬 Deep',
    btnHome:'← Home',btnCard:'📸 Card',btnReport:'📄 Report',btnLink:'🔗 Link',
    btnCompare:'⚖️ Compare',btnBattle:'⚔️ Battle',btnClone:'📋 Clone',
    btnToken:'🔑 Token',btnShortcuts:'❓ Shortcuts',
    searchPlaceholder:'owner/repo, a GitHub URL, or a username…',
    jumpPlaceholder:'scope another repo…',
    toastHistoryCleared:'History cleared',
    toastCardDownloaded:'Card downloaded',
    toastCopied:'Copied to clipboard',
    toastDigestReady:'Digest ready',
    toastExported:'JSON exported',
    toastCsvExported:'CSV exported',
    toastLinkCopied:'Deep link copied',
    heroTitle:'Know a GitHub repo',
    heroSub:'in seconds, not hours.',
    heroDesc:'Paste any repository or profile. Repodest gives you a health score, language breakdown, file explorer, commit insights and fun trophies — then packs the whole thing into an <b>LLM-ready digest</b> you can feed to ChatGPT, Claude or Gemini.',
    scopeBtn:'Scope it',
    recentRepos:'🕘 Recent repos',
    clearHistory:'Clear history',
    healthScore:'Health score',
    healthChecks:'Health checks',
    repoFacts:'Repo facts',
    trophiesPreview:'Trophies preview',
    licenseAnalysis:'📜 License analysis',
    readmePreview:'📖 README Preview',
    securityScan:'🔒 Security Quick Scan',
    similarRepos:'🔍 Similar Repos',
    apiEndpoints:'🔌 API Endpoints',
    langBreakdown:'Language breakdown (bytes)',
    detectedStack:'Detected stack',
    typeDistribution:'Type distribution',
    heaviestFiles:'Heaviest files',
    fileTree:'File tree',
    whatGoesIn:'What goes into the prompt',
    generatedPrompt:'Generated prompt',
    commitActivity:'Commit activity — last 52 weeks',
    starHistory:'⭐ Star history',
    topContributors:'Top contributors',
    recentCommits:'Recent commits',
    roastMode:'🔥 Roast mode',
    trophies:'Trophies',
    recentReposTitle:'🕘 Recent repos',
    step1:'Paste',step2:'Explore',step3:'Feed your AI',
    step1Desc:'Any repo URL, owner/repo, or username.',
    step2Desc:'Health score, languages, files, activity — all in one dashboard.',
    step3Desc:'Pick files, hit generate, copy the digest into any LLM chat.',
    feat1:'Health Score',feat2:'LLM Digest',feat3:'File Explorer',
    feat4:'Deep Stats',feat5:'Fun Mode',feat6:'Shareable',
    footer:'Built by',
    excellentShape:'Excellent shape 🟢',
    decentShape:'Decent shape 🟡',
    needsLove:'Needs love 🟠',
    needsCare:'Needs serious care 🔴'
  },
  fa:{
    tabOverview:'🩺 نمای کلی',tabLanguages:'📊 زبان‌ها',tabFiles:'🗂️ فایل‌ها',
    tabDigest:'🤖 دایجست',tabActivity:'📈 فعالیت',tabFun:'🏆 سرگرمی',tabDeps:'🔗 وابستگی‌ها',tabDeep:'🔬 تحلیل عمیق',
    btnHome:'← خانه',btnCard:'📸 کارت',btnReport:'📄 گزارش',btnLink:'🔗 لینک',
    btnCompare:'⚖️ مقایسه',btnBattle:'⚔️ نبرد',btnClone:'📋 کلون',
    btnToken:'🔑 توکن',btnShortcuts:'❓ میانبرها',
    searchPlaceholder:'مالک/رپو، آدرس گیت‌هاب، یا نام کاربری…',
    jumpPlaceholder:'رپوی دیگری را بررسی کنید…',
    toastHistoryCleared:'تاریخچه پاک شد',
    toastCardDownloaded:'کارت دانلود شد',
    toastCopied:'در کلیپ‌بورد کپی شد',
    toastDigestReady:'دایجست آماده است',
    toastExported:'JSON صادر شد',
    toastCsvExported:'CSV صادر شد',
    toastLinkCopied:'لینک کپی شد',
    heroTitle:'یک رپوی گیت‌هاب را',
    heroSub:'در چند ثانیه بشناسید.',
    heroDesc:'هر مخزن یا پروفایلی را وارد کنید. رپودست امتیاز سلامت، تفکیک زبان‌ها، مرورگر فایل، بینش‌های کامیت و جوایز سرگرم‌کننده را به شما می‌دهد — و سپس همه چیز را در یک <b>خلاصه آماده LLM</b> بسته‌بندی می‌کند.',
    scopeBtn:'بررسی کن',
    recentRepos:'🕘 رپوهای اخیر',
    clearHistory:'پاک کردن تاریخچه',
    healthScore:'امتیاز سلامت',
    healthChecks:'بررسی‌های سلامت',
    repoFacts:'اطلاعات رپو',
    trophiesPreview:'پیش‌نمایش جوایز',
    licenseAnalysis:'📜 تحلیل مجوز',
    readmePreview:'📖 پیش‌نمایش README',
    securityScan:'🔒 اسکن امنیتی سریع',
    similarRepos:'🔍 رپوهای مشابه',
    apiEndpoints:'🔌 نقاط پایانی API',
    langBreakdown:'تفکیک زبان‌ها (بایت)',
    detectedStack:'استک شناسایی شده',
    typeDistribution:'توزیع نوع فایل',
    heaviestFiles:'سنگین‌ترین فایل‌ها',
    fileTree:'درخت فایل',
    whatGoesIn:'چه چیزی در پرامپت قرار می‌گیرد',
    generatedPrompt:'پرامپت تولید شده',
    commitActivity:'فعالیت کامیت — ۵۲ هفته اخیر',
    starHistory:'⭐ تاریخچه ستاره‌ها',
    topContributors:'مشارکت‌کنندگان برتر',
    recentCommits:'کامیت‌های اخیر',
    roastMode:'🔥 حالت مسخره کردن',
    trophies:'جوایز',
    recentReposTitle:'🕘 رپوهای اخیر',
    step1:'جایگذاری',step2:'کاوش',step3:'تغذیه AI شما',
    step1Desc:'هر آدرس رپو، مالک/رپو، یا نام کاربری.',
    step2Desc:'امتیاز سلامت، زبان‌ها، فایل‌ها، فعالیت — همه در یک داشبورد.',
    step3Desc:'فایل‌ها را انتخاب کنید، تولید را بزنید، خلاصه را در هر LLM کپی کنید.',
    feat1:'امتیاز سلامت',feat2:'خلاصه LLM',feat3:'مرورگر فایل',
    feat4:'آمار عمیق',feat5:'حالت سرگرمی',feat6:'قابل اشتراک',
    footer:'ساخته شده توسط',
    excellentShape:'وضعیت عالی 🟢',
    decentShape:'وضعیت خوب 🟡',
    needsLove:'نیاز به توجه 🟠',
    needsCare:'نیاز به مراقبت جدی 🔴'
  },
  es:{
    tabOverview:'🩺 Resumen',tabLanguages:'📊 Idiomas',tabFiles:'🗂️ Archivos',
    tabDigest:'🤖 Resumen LLM',tabActivity:'📈 Actividad',tabFun:'🏆 Divertido',tabDeps:'🔗 Deps',tabDeep:'🔬 Profundo',
    btnHome:'← Inicio',btnCard:'📸 Tarjeta',btnReport:'📄 Informe',btnLink:'🔗 Enlace',
    btnCompare:'⚖️ Comparar',btnBattle:'⚔️ Batalla',btnClone:'📋 Clonar',
    btnToken:'🔑 Token',btnShortcuts:'❓ Atajos',
    searchPlaceholder:'propietario/repo, una URL de GitHub, o un usuario…',
    jumpPlaceholder:'explorar otro repo…',
    toastHistoryCleared:'Historial borrado',
    toastCardDownloaded:'Tarjeta descargada',
    toastCopied:'Copiado al portapapeles',
    toastDigestReady:'Resumen listo',
    toastExported:'JSON exportado',
    toastCsvExported:'CSV exportado',
    toastLinkCopied:'Enlace copiado',
    heroTitle:'Conoce un repo de GitHub',
    heroSub:'en segundos, no en horas.',
    heroDesc:'Pega cualquier repositorio o perfil. Repodest te da una puntuación de salud, desglose de idiomas, explorador de archivos, insights de commits y trofeos divertidos — y luego empaqueta todo en un <b>resumen listo para LLM</b> que puedes alimentar a ChatGPT, Claude o Gemini.',
    scopeBtn:'Analizar',
    recentRepos:'🕘 Repos recientes',
    clearHistory:'Borrar historial',
    healthScore:'Puntuación de salud',
    healthChecks:'Verificaciones de salud',
    repoFacts:'Datos del repo',
    trophiesPreview:'Vista previa de trofeos',
    licenseAnalysis:'📜 Análisis de licencia',
    readmePreview:'📖 Vista previa del README',
    securityScan:'🔒 Escaneo rápido de seguridad',
    similarRepos:'🔍 Repos similares',
    apiEndpoints:'🔌 Puntos finales API',
    langBreakdown:'Desglose de idiomas (bytes)',
    detectedStack:'Stack detectado',
    typeDistribution:'Distribución de tipos',
    heaviestFiles:'Archivos más pesados',
    fileTree:'Árbol de archivos',
    whatGoesIn:'Qué entra en el prompt',
    generatedPrompt:'Prompt generado',
    commitActivity:'Actividad de commits — últimas 52 semanas',
    starHistory:'⭐ Historial de estrellas',
    topContributors:'Principales contribuidores',
    recentCommits:'Commits recientes',
    roastMode:'🔥 Modo roast',
    trophies:'Trofeos',
    recentReposTitle:'🕘 Repos recientes',
    step1:'Pega',step2:'Explora',step3:'Alimenta tu IA',
    step1Desc:'Cualquier URL de repo, propietario/repo, o usuario.',
    step2Desc:'Puntuación de salud, idiomas, archivos, actividad — todo en un panel.',
    step3Desc:'Elige archivos, genera, copia el resumen en cualquier LLM.',
    feat1:'Puntuación de Salud',feat2:'Resumen LLM',feat3:'Explorador de Archivos',
    feat4:'Estadísticas Profundas',feat5:'Modo Divertido',feat6:'Compartible',
    footer:'Creado por',
    excellentShape:'Excelente estado 🟢',
    decentShape:'Estado decente 🟡',
    needsLove:'Necesita cariño 🟠',
    needsCare:'Necesita atención seria 🔴'
  },
  zh:{
    tabOverview:'🩺 概览',tabLanguages:'📊 语言',tabFiles:'🗂️ 文件',
    tabDigest:'🤖 摘要',tabActivity:'📈 活动',tabFun:'🏆 趣味',tabDeps:'🔗 依赖',tabDeep:'🔬 深度分析',
    btnHome:'← 首页',btnCard:'📸 卡片',btnReport:'📄 报告',btnLink:'🔗 链接',
    btnCompare:'⚖️ 对比',btnBattle:'⚔️ 对战',btnClone:'📋 克隆',
    btnToken:'🔑 令牌',btnShortcuts:'❓ 快捷键',
    searchPlaceholder:'所有者/仓库、GitHub 链接或用户名…',
    jumpPlaceholder:'分析另一个仓库…',
    toastHistoryCleared:'历史已清除',
    toastCardDownloaded:'卡片已下载',
    toastCopied:'已复制到剪贴板',
    toastDigestReady:'摘要已就绪',
    toastExported:'JSON 已导出',
    toastCsvExported:'CSV 已导出',
    toastLinkCopied:'链接已复制',
    heroTitle:'几秒钟了解',
    heroSub:'一个 GitHub 仓库。',
    heroDesc:'粘贴任何仓库或个人资料。Repodest 为你提供健康评分、语言分析、文件浏览器、提交洞察和趣味奖杯——然后将所有内容打包成<b>可供 LLM 使用的摘要</b>，直接喂给 ChatGPT、Claude 或 Gemini。',
    scopeBtn:'开始分析',
    recentRepos:'🕘 最近仓库',
    clearHistory:'清除历史',
    healthScore:'健康评分',
    healthChecks:'健康检查',
    repoFacts:'仓库信息',
    trophiesPreview:'奖杯预览',
    licenseAnalysis:'📜 许可证分析',
    readmePreview:'📖 README 预览',
    securityScan:'🔒 安全快速扫描',
    similarRepos:'🔍 相似仓库',
    apiEndpoints:'🔌 API 端点',
    langBreakdown:'语言分析（字节）',
    detectedStack:'检测到的技术栈',
    typeDistribution:'文件类型分布',
    heaviestFiles:'最大的文件',
    fileTree:'文件树',
    whatGoesIn:'提示词包含什么',
    generatedPrompt:'生成的提示词',
    commitActivity:'提交活动 — 最近 52 周',
    starHistory:'⭐ 星标历史',
    topContributors:'主要贡献者',
    recentCommits:'最近提交',
    roastMode:'🔥 吐槽模式',
    trophies:'奖杯',
    recentReposTitle:'🕘 最近仓库',
    step1:'粘贴',step2:'探索',step3:'喂给你的 AI',
    step1Desc:'任何仓库链接、所有者/仓库或用户名。',
    step2Desc:'健康评分、语言、文件、活动——尽在一个仪表板。',
    step3Desc:'选择文件，生成摘要，复制到任何 LLM 对话中。',
    feat1:'健康评分',feat2:'LLM 摘要',feat3:'文件浏览器',
    feat4:'深度统计',feat5:'趣味模式',feat6:'可分享',
    footer:'由',
    excellentShape:'状态极佳 🟢',
    decentShape:'状态良好 🟡',
    needsLove:'需要关注 🟠',
    needsCare:'需要认真维护 🔴'
  },
  fr:{
    tabOverview:'🩺 Vue d\'ensemble',tabLanguages:'📊 Langages',tabFiles:'🗂️ Fichiers',
    tabDigest:'🤖 Résumé LLM',tabActivity:'📈 Activité',tabFun:'🏆 Fun',tabDeps:'🔗 Déps',tabDeep:'🔬 Approfondi',
    btnHome:'← Accueil',btnCard:'📸 Carte',btnReport:'📄 Rapport',btnLink:'🔗 Lien',
    btnCompare:'⚖️ Comparer',btnBattle:'⚔️ Battle',btnClone:'📋 Cloner',
    btnToken:'🔑 Token',btnShortcuts:'❓ Raccourcis',
    searchPlaceholder:'propriétaire/repo, une URL GitHub, ou un utilisateur…',
    jumpPlaceholder:'analyser un autre repo…',
    toastHistoryCleared:'Historique effacé',
    toastCardDownloaded:'Carte téléchargée',
    toastCopied:'Copié dans le presse-papiers',
    toastDigestReady:'Résumé prêt',
    toastExported:'JSON exporté',
    toastCsvExported:'CSV exporté',
    toastLinkCopied:'Lien copié',
    heroTitle:'Découvrez un dépôt GitHub',
    heroSub:'en quelques secondes.',
    heroDesc:'Collez n\'importe quel dépôt ou profil. Repodest vous donne un score de santé, la répartition des langages, un explorateur de fichiers, des insights de commits et des trophées amusants — puis emballe le tout dans un <b>résumé prêt pour LLM</b> à fournir à ChatGPT, Claude ou Gemini.',
    scopeBtn:'Analyser',
    recentRepos:'🕘 Repos récents',
    clearHistory:'Effacer l\'historique',
    healthScore:'Score de santé',
    healthChecks:'Vérifications de santé',
    repoFacts:'Infos du dépôt',
    trophiesPreview:'Aperçu des trophées',
    licenseAnalysis:'📜 Analyse de licence',
    readmePreview:'📖 Aperçu du README',
    securityScan:'🔒 Scan de sécurité rapide',
    similarRepos:'🔍 Dépôts similaires',
    apiEndpoints:'🔌 Points d\'API',
    langBreakdown:'Répartition des langages (octets)',
    detectedStack:'Stack détectée',
    typeDistribution:'Distribution des types',
    heaviestFiles:'Fichiers les plus lourds',
    fileTree:'Arborescence',
    whatGoesIn:'Ce qui entre dans le prompt',
    generatedPrompt:'Prompt généré',
    commitActivity:'Activité des commits — 52 dernières semaines',
    starHistory:'⭐ Historique des étoiles',
    topContributors:'Principaux contributeurs',
    recentCommits:'Commits récents',
    roastMode:'🔥 Mode roast',
    trophies:'Trophées',
    recentReposTitle:'🕘 Repos récents',
    step1:'Collez',step2:'Explorez',step3:'Nourrissez votre IA',
    step1Desc:'N\'importe quelle URL de dépôt, propriétaire/repo, ou utilisateur.',
    step2Desc:'Score de santé, langages, fichiers, activité — tout sur un tableau de bord.',
    step3Desc:'Choisissez des fichiers, générez, copiez le résumé dans n\'importe quel LLM.',
    feat1:'Score de Santé',feat2:'Résumé LLM',feat3:'Explorateur de Fichiers',
    feat4:'Stats Approfondies',feat5:'Mode Fun',feat6:'Partageable',
    footer:'Créé par',
    excellentShape:'Excellente forme 🟢',
    decentShape:'Forme correcte 🟡',
    needsLove:'A besoin d\'amour 🟠',
    needsCare:'A besoin de soins sérieux 🔴'
  }
};
let currentLang=LS.get('repodest_lang','en');
function t(key){return(I18N[currentLang]&&I18N[currentLang][key])||(I18N.en[key]||key)}
const LANG_ORDER=['en','fa','es','zh','fr','ar','de'];
const RTL_LANGS=new Set(['fa','ar']);
function cycleLang(){
  const idx=LANG_ORDER.indexOf(currentLang);
  currentLang=LANG_ORDER[(idx+1)%LANG_ORDER.length];
  LS.set('repodest_lang',currentLang);
  applyLang();
  toast(({en:'English',fa:'فارسی',es:'Español',zh:'中文',fr:'Français',ar:'العربية',de:'Deutsch'})[currentLang],'ok');
}
function applyLang(){
  const isFa=RTL_LANGS.has(currentLang);
  document.body.classList.toggle('rtl',isFa);
  document.documentElement.lang=currentLang;
  const langBtn=$('#langBtn');
  if(langBtn)langBtn.querySelector('span').textContent=({en:'EN',fa:'FA',es:'ES',zh:'ZH',fr:'FR',ar:'AR',de:'DE'})[currentLang]||'EN';
  /* Translate every static element carrying data-i18n */
  $$('[data-i18n]').forEach(el=>{const v=t(el.dataset.i18n);if(v)el.textContent=v});
  $$('[data-i18n-html]').forEach(el=>{const v=t(el.dataset.i18nHtml);if(v)el.innerHTML=v});
  $$('[data-i18n-ph]').forEach(el=>{const v=t(el.dataset.i18nPh);if(v)el.placeholder=v});
  /* Update tab names */
  const tabMap={
    'overview':t('tabOverview'),'languages':t('tabLanguages'),'files':t('tabFiles'),
    'digest':t('tabDigest'),'activity':t('tabActivity'),'fun':t('tabFun'),'deps':t('tabDeps'),
    'deep':t('tabDeep')
  };
  $$('#tabs .tab').forEach(b=>{const k=b.dataset.tab;if(tabMap[k])b.textContent=tabMap[k]});
  /* Update search placeholders */
  const inp=$('#inp');if(inp)inp.placeholder=t('searchPlaceholder');
  const jump=$('#jump');if(jump)jump.placeholder=t('jumpPlaceholder');
  /* Update hero */
  const heroH1=$('.hero h1');
  if(heroH1)heroH1.innerHTML=t('heroTitle')+'<br><span class="g">'+t('heroSub')+'</span>';
  const heroSub=$('.hero p.sub');
  if(heroSub)heroSub.innerHTML=t('heroDesc');
  const scopeBtn=$('.searchbox .btn');
  if(scopeBtn)scopeBtn.textContent=t('scopeBtn');
  /* Update minititles if dash is visible */
  if($('#dash')&&$('#dash').style.display!=='none'){
    renderDash();
  }
}

/* ============================================================
   Hook features into renderDash
   ============================================================ */
const _origRenderDash=renderDash;
renderDash=function(){
  _origRenderDash();
  try{renderSimilarRepos()}catch(e){}
  try{renderSecurityScan()}catch(e){}
  try{renderEndpoints()}catch(e){}
  try{renderReadmePreview()}catch(e){}
};
