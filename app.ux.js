'use strict';
/* ============================================================
   Repodest — UX layer
   3D particles, deep analysis, digest upgrades, command palette,
   help chips, favorites, branch diff, full-text search, worker,
   i18n, language menu, accessibility, quick wins.
   Loaded after app.features.js.
   ============================================================ */
/* ============================================================
   Particles animation — enhanced with connecting lines
   ============================================================ */
/* ============================================================
   Deep 3D particle world — depth layers, glow, mouse links,
   parallax. Enhanced port of the profile.html mesh background.
   ============================================================ */
(function particles(){
  const c=$('#particles');
  if(!c)return;
  const ctx=c.getContext('2d');
  let W=0,H=0,dots=[],mouse={x:-1e4,y:-1e4},mx=0,my=0;
  const PALETTE=[
    [168,85,247],  /* purple  */
    [34,211,238],  /* cyan    */
    [236,72,153],  /* pink    */
    [139,92,246],  /* violet  */
    [124,58,237]   /* deep violet */
  ];
  const LINK_DIST=150;
  const reduced=matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  function resize(){
    W=c.width=innerWidth;
    H=c.height=innerHeight;
  }
  function makeDot(){
    /* z in [0,1]: 0 = far (small, dim, slow), 1 = near (big, bright, fast) */
    const z=Math.random();
    const glow=z>0.86;
    return{
      x:Math.random()*W,
      y:Math.random()*H,
      z,
      r:z*2.6+.4,
      vx:(Math.random()-.5)*(.18+z*.4),
      vy:(Math.random()-.5)*(.18+z*.4),
      col:PALETTE[Math.floor(Math.random()*PALETTE.length)],
      o:z*.5+.12,
      ph:Math.random()*Math.PI*2,
      ps:Math.random()*.012+.004,
      glow
    };
  }
  function init(){
    const count=Math.min(180,Math.max(85,Math.round(W*H/9500)));
    dots=Array.from({length:count},makeDot);
  }
  function lightFactor(){
    return document.body.classList.contains('light')?0.55:1;
  }
  function rgba(col,a){
    return 'rgba('+col[0]+','+col[1]+','+col[2]+','+Math.max(0,a*lightFactor()).toFixed(3)+')';
  }
  function tick(){
    requestAnimationFrame(tick);
    if(document.hidden)return;
    ctx.clearRect(0,0,W,H);
    /* parallax easing */
    mx+=(mouse.x===-1e4?0:(mouse.x/W-0.5)*2-mx)*0.04;
    my+=(mouse.y===-1e4?0:(mouse.y/H-0.5)*2-my)*0.04;
    /* connection lines */
    for(let i=0;i<dots.length;i++){
      const a=dots[i];
      for(let j=i+1;j<dots.length;j++){
        const b=dots[j];
        const dx=a.x-b.x,dy=a.y-b.y;
        const d2=dx*dx+dy*dy;
        if(d2<LINK_DIST*LINK_DIST){
          const d=Math.sqrt(d2);
          const depth=(a.z+b.z)/2;
          const alpha=(1-d/LINK_DIST)*(0.06+depth*0.14);
          ctx.beginPath();
          ctx.moveTo(a.x-mx*depth*22,a.y-my*depth*22);
          ctx.lineTo(b.x-mx*depth*22,b.y-my*depth*22);
          ctx.strokeStyle=rgba(a.col,alpha);
          ctx.lineWidth=0.4+depth*0.7;
          ctx.stroke();
        }
      }
    }
    /* particles */
    for(const d of dots){
      d.x+=d.vx;d.y+=d.vy;d.ph+=d.ps;
      if(d.x<-40)d.x=W+40;if(d.x>W+40)d.x=-40;
      if(d.y<-40)d.y=H+40;if(d.y>H+40)d.y=-40;
      /* depth parallax: near dots shift more against the mouse */
      const px=d.x-mx*d.z*30;
      const py=d.y-my*d.z*30;
      const tw=d.o+Math.sin(d.ph)*0.1;
      if(d.glow){
        /* soft halo for the closest layer */
        const g=ctx.createRadialGradient(px,py,0,px,py,d.r*6);
        g.addColorStop(0,rgba(d.col,tw*0.25));
        g.addColorStop(1,rgba(d.col,0));
        ctx.beginPath();
        ctx.fillStyle=g;
        ctx.arc(px,py,d.r*6,0,Math.PI*2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(px,py,d.r,0,Math.PI*2);
      ctx.fillStyle=rgba(d.col,tw);
      ctx.fill();
      /* interactive link to the cursor */
      const mdx=px-mouse.x,mdy=py-mouse.y;
      const md=Math.sqrt(mdx*mdx+mdy*mdy);
      if(md<200){
        ctx.beginPath();
        ctx.moveTo(px,py);
        ctx.lineTo(mouse.x,mouse.y);
        ctx.strokeStyle=rgba(d.col,(0.12+d.z*0.18)*(1-md/200));
        ctx.lineWidth=0.5+d.z*0.6;
        ctx.stroke();
      }
    }
  }
  addEventListener('resize',()=>{resize();init()});
  addEventListener('mousemove',e=>{mouse.x=e.clientX;mouse.y=e.clientY});
  addEventListener('mouseleave',()=>{mouse.x=-1e4;mouse.y=-1e4});
  resize();init();
  if(reduced){
    /* draw a single static frame, no animation */
    document.body.classList.add('reduced-motion');
  }
  tick();
  /* Parallax for the floating 3D shapes + floor grid.
     Uses margins (not transform) so CSS spin animations stay intact. */
  const shapes=()=>document.querySelectorAll('.geo-shape');
  const floor=()=>document.querySelector('.floor-grid');
  let sx=0,sy=0;
  (function parallax(){
    requestAnimationFrame(parallax);
    if(document.hidden)return;
    sx+=(mx-sx)*0.06;sy+=(my-sy)*0.06;
    shapes().forEach(el=>{
      const speed=parseFloat(el.dataset.depth||'1')*14;
      el.style.marginLeft=(sx*speed)+'px';
      el.style.marginTop=(sy*speed)+'px';
    });
    const f=floor();
    if(f)f.style.backgroundPositionX=(sx*10)+'px';
  })();
})();

/* ============================================================
   Feature: Code Complexity Score
   ============================================================ */
function calcComplexity(){
  const results=[];
  const patterns=[/function\s/g,/=>\s*[{(]/g,/class\s/g,/def\s/g,/if\s*\(/g,/for\s*\(/g,/while\s*\(/g,/switch\s*\(/g,/try\s*\{/g,/catch\s*\(/g,/async\s/g,/await\s/g];
  FILEMAP.forEach((f,p)=>{
    if(!isText(f)||isLock(f))return;
    const ext=extOf(p);
    if(!['js','ts','jsx','tsx','py','java','kt','go','rs','rb','php','c','cpp','cs','swift','dart','lua','r','jl','ex','exs','hs','ml','clj','groovy','scala','vue','svelte'].includes(ext))return;
    let score=0;
    /* Estimate complexity from file size and type */
    const size=f.size||0;
    score=Math.min(100,Math.round(size/200));
    results.push({path:p,score:score,size:size});
  });
  results.sort((a,b)=>b.score-a.score);
  return results.slice(0,5);
}
function renderComplexity(){
  const el=$('#complexityContent');
  if(!el)return;
  const top=calcComplexity();
  const totalFiles=FILEMAP.size;
  const avgScore=top.length?Math.round(top.reduce((a,c)=>a+c.score,0)/top.length):0;
  const level=avgScore>60?'Very High':avgScore>40?'High':avgScore>20?'Medium':'Low';
  const color=avgScore>60?'var(--red)':avgScore>40?'var(--orange)':avgScore>20?'var(--yellow)':'var(--green)';
  el.innerHTML=
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">'+
      '<span class="complexity-score-label" style="color:'+color+'">'+level+'</span>'+
      '<span style="color:var(--text3);font-size:11px">'+totalFiles+' files analyzed</span>'+
    '</div>'+
    '<div class="complexity-meter"><i style="width:'+avgScore+'%;background:'+color+'"></i></div>'+
    '<div class="complexity-top-files">'+
      top.map(f=>'<div class="cfrow"><span class="cfpath" title="'+esc(f.path)+'">'+esc(f.path.split('/').pop())+'</span><span class="cfscore">'+f.score+'</span></div>').join('')+
    '</div>';
}

/* ============================================================
   Feature: AI Repo Summary
   ============================================================ */
/* generateSummary duplicate removed — keeping version with aiSummaryBox */

/* ============================================================
   Feature: Explain This Repo
   ============================================================ */
function explainRepo(){
  const m=S.repo;if(!m)return;
  const langs=Object.keys(S.langs).sort((a,b)=>S.langs[b]-S.langs[a]);
  const mainLang=m.language||langs[0]||'unknown';
  const desc=m.description||'No description provided.';
  const stars=m.stargazers_count;
  const files=FILEMAP.size;
  let explanation='';
  explanation+='<p><b>What is this?</b> '+esc(desc)+'</p>';
  explanation+='<p><b>Language:</b> Primarily '+esc(mainLang)+(langs.length>1?', also uses '+langs.slice(1,4).map(esc).join(', '):'')+'.</p>';
  explanation+='<p><b>Size:</b> '+fmt(files)+' files. '+(files>1000?'This is a large project.':files>100?'Medium-sized project.':'Small project.')+'</p>';
  explanation+='<p><b>Popularity:</b> '+fmt(stars)+' stars. '+(stars>10000?'Very popular!':stars>1000?'Well-known.':stars>100?'Gaining traction.':'New or niche.')+'</p>';
  const readme=FILEMAP.size?Array.from(FILEMAP.keys()).find(p=>/(^|\/)readme\.md$/i.test(p)):null;
  if(readme)explanation+='<p><b>Has README:</b> Yes — check the Overview tab for details.</p>';
  showModal('💡 Explain: '+esc(m.name),explanation);
}

/* ============================================================
   Feature: Smart File Recommendations
   ============================================================ */
function getSmartRecommendations(){
  const corePatterns=[/^index\.[jt]sx?$/i,/^main\.[a-z]+$/i,/^app\.[jt]sx?$/i,/^server\.[jt]s$/i,/^src\//i,/^lib\//i];
  const configPatterns=[/^package\.json$/i,/^tsconfig/i,/^\.env\.example$/i,/^vite\.config/i,/^webpack\.config/i,/^next\.config/i,/^nuxt\.config/i,/^tailwind\.config/i,/^babel\.config/i,/^jest\.config/i,/^\.eslintrc/i,/^\.prettierrc/i,/^pyproject\.toml$/i,/^setup\.cfg$/i,/^Cargo\.toml$/i,/^go\.mod$/i];
  const docPatterns=[/(^|\/)readme\.md$/i,/(^|\/)changelog/i,/(^|\/)contributing/i,/(^|\/)license/i,/(^|\/)security\.md$/i];
  const core=[],config=[],docs=[];
  FILEMAP.forEach((f,p)=>{
    if(!isText(f)||isLock(f))return;
    const name=p.split('/').pop();
    if(corePatterns.some(rx=>rx.test(p)||rx.test(name)))core.push(p);
    if(configPatterns.some(rx=>rx.test(p)||rx.test(name)))config.push(p);
    if(docPatterns.some(rx=>rx.test(p)))docs.push(p);
  });
  return{core:core.slice(0,10),config:config.slice(0,10),docs:docs.slice(0,5)};
}
function selectSmartCategory(cat){
  const recs=getSmartRecommendations();
  const list=recs[cat]||[];
  list.forEach(p=>S.sel.add(p));
  $$('#tree .fcb').forEach(cb=>cb.checked=S.sel.has(cb.dataset.path));
  updateSelMeta();
  toast(list.length+' '+cat+' files selected','ok');
}
function selectRecCategory(cat){selectSmartCategory(cat)}

/* ---------- Ask-a-question smart file selection ----------
   Scores candidate files by keyword overlap with paths and
   (lazily fetched) contents; picks the top matches. */
const STOPWORDS=new Set(['how','does','do','the','a','an','is','are','what','where','when','which','why','who','in','on','of','to','for','with','and','or','not','it','this','that','can','i','my','me','work','works','working','code','file','files','repo','repository','project','use','uses','using','get','set']);
function questionKeywords(q){
  return String(q||'').toLowerCase().split(/[^a-z0-9_\-\.]+/).filter(w=>w.length>2&&!STOPWORDS.has(w)).slice(0,8);
}
function candidateFilesForSearch(){
  const paths=[];FILEMAP.forEach((f,p)=>{if(isText(f)&&!isLock(f)&&(f.size||0)<120*1024)paths.push(p)});
  return paths;
}
async function smartSelectForQuestion(){
  const q=($('#askInput')&&$('#askInput').value)||'';
  const kws=questionKeywords(q);
  const status=$('#askStatus');
  if(!kws.length){toast('Type a question with a few keywords','err');return}
  const candidates=candidateFilesForSearch();
  if(!candidates.length){toast('Load a repository first','err');return}
  /* Pass 1: path/name scoring (free) */
  const scores={};
  for(const p of candidates){
    const lower=p.toLowerCase();
    let s=0;
    kws.forEach(k=>{
      if(lower.includes(k))s+=3;
      const name=lower.split('/').pop();
      if(name.includes(k))s+=2;
    });
    scores[p]=s;
  }
  status.textContent='Scanning '+candidates.length+' candidate files…';
  /* Pass 2: content scoring for mid-ranked files (bounded fetches) */
  const byPath=Array.from(candidates).sort((a,b)=>scores[b]-scores[a]);
  const toFetch=byPath.slice(0,80);
  const m=S.repo,branch=(m&&m.default_branch)||'main';
  let fetched=0;
  for(const p of toFetch){
    try{
      const r=await fetch(rawUrl((m&&m.full_name),branch,p));
      if(!r.ok)continue;
      const txt=(await r.text()).toLowerCase();
      fetched++;
      let hits=0;
      kws.forEach(k=>{
        const c=txt.split(k).length-1;
        hits+=Math.min(c,10);
      });
      if(hits>0)scores[p]=(scores[p]||0)+hits;
    }catch(e){/* skip */}
  }
  const ranked=Object.entries(scores).filter(([p,s])=>s>0).sort((a,b)=>b[1]-a[1]);
  if(!ranked.length){
    status.textContent='No files matched "'+q+'" — try different keywords.';
    toast('No matching files found','err');
    return;
  }
  const top=ranked.slice(0,12).map(x=>x[0]);
  top.forEach(p=>S.sel.add(p));
  $$('#tree .fcb').forEach(cb=>cb.checked=S.sel.has(cb.dataset.path));
  updateSelMeta();
  status.textContent='Selected '+top.length+' files for: '+q;
  toast(top.length+' relevant files selected — generate the digest','ok');
  switchTab('digest');
}

/* ============================================================
   Feature: Security Quick Scan
   ============================================================ */
function securityScan(){
  const paths=[];FILEMAP.forEach((v,k)=>paths.push(k));
  const checks=[
    {n:'.env file',ok:!paths.some(p=>/(^|\/)\.env$/i.test(p)),critical:true},
    {n:'No credentials files',ok:!paths.some(p=>/(credentials|secret|apikey|api_key)/i.test(p)),critical:true},
    {n:'No private keys',ok:!paths.some(p=>/\.(pem|key|p12|pfx|jks)$/i.test(p)),critical:true},
    {n:'No SSH keys',ok:!paths.some(p=>/(id_rsa|id_ed25519|id_dsa)$/i.test(p)),critical:true},
    {n:'SECURITY.md exists',ok:paths.some(p=>/(^|\/)security\.md$/i.test(p)),critical:false},
    {n:'.gitignore present',ok:paths.some(p=>/(^|\/)\.gitignore$/i.test(p)),critical:false},
    {n:'No hardcoded passwords',ok:!paths.some(p=>/(password|passwd|pwd)\s*[=:]\s*['"][^'"]+['"]/i.test(p)),critical:false},
    {n:'Dependabot config',ok:paths.some(p=>p.includes('.github/dependabot')),critical:false}
  ];
  const score=Math.round(checks.filter(c=>c.ok).length/checks.length*100);
  return{checks,score};
}
function renderSecurity(){
  const el=$('#securityContent');if(!el)return;
  const{checks,score}=securityScan();
  const color=score>=80?'var(--green)':score>=60?'var(--yellow)':score>=40?'var(--orange)':'var(--red)';
  el.innerHTML=
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">'+
      '<span style="font-size:28px;font-weight:900;color:'+color+'">'+score+'%</span>'+
      '<span style="color:var(--text3);font-size:12px">Security score</span>'+
    '</div>'+
    checks.map(c=>'<div class="chk '+(c.ok?'ok':'bad')+'"><span class="ic">'+(c.ok?'✓':'✕')+'</span><span><b>'+esc(c.n)+'</b>'+(c.critical&&!c.ok?' <span style="color:var(--red);font-size:10px">CRITICAL</span>':'')+'</span></div>').join('');
}

/* ============================================================
   Feature: API Endpoint Detector
   ============================================================ */
function detectEndpoints(){
  const endpoints=[];
  const routePatterns=[
    {rx:/\bapp\.(get|post|put|delete|patch|all)\s*\(\s*['"`]([^'"`]+)/g,framework:'Express'},
    {rx:/\brouter\.(get|post|put|delete|patch|all)\s*\(\s*['"`]([^'"`]+)/g,framework:'Express Router'},
    {rx:/@app\.(get|post|put|delete|patch|route)\s*\(\s*['"`]([^'"`]+)/g,framework:'Flask/FastAPI'},
    {rx:/@blueprint\.(get|post|put|delete|patch|route)\s*\(\s*['"`]([^'"`]+)/g,framework:'Flask Blueprint'}
  ];
  let scanned=0;
  FILEMAP.forEach((f,p)=>{
    if(scanned>=50)return;
    if(!isText(f)||isLock(f))return;
    const ext=extOf(p);
    if(!['js','ts','jsx','tsx','py','mjs','cjs'].includes(ext))return;
    scanned++;
    /* We can't read file content here, so detect from path */
    if(p.includes('pages/api/')||p.includes('app/api/')){
      endpoints.push({method:'ANY',path:'/'+p.replace(/.*(?:pages|app)\/api\//,'api/').replace(/\.(js|ts|tsx|jsx)$/,''),framework:'Next.js',file:p});
    }
  });
  return endpoints;
}
/* renderEndpoints duplicate removed — keeping the correct version at line 2750 */

/* ============================================================
   Feature: Similar Repos
   ============================================================ */
async function findSimilarRepos(){
  const el=$('#similarContent');if(!el)return;
  const m=S.repo;if(!m)return;
  const topics=(m.topics||[]).slice(0,3);
  const lang=m.language||'';
  if(!topics.length&&!lang){el.innerHTML='<p style="color:var(--text3);font-size:13px">No topics or language to find similar repos.</p>';return}
  el.innerHTML='<p style="color:var(--text3);font-size:13px">Searching…</p>';
  try{
    const q=topics.length?'topic:'+topics[0]:'language:'+lang;
    const data=await api('/search/repositories?q='+encodeURIComponent(q)+'&per_page=6&sort=stars');
    const list=(data.items||[]).filter(r=>r.full_name!==m.full_name).slice(0,5);
    if(!list.length){el.innerHTML='<p style="color:var(--text3);font-size:13px">No similar repos found.</p>';return}
    el.innerHTML=list.map(r=>
      '<div class="ucard" style="margin-bottom:8px" onclick="loadRepo(\''+esc(r.owner.login)+'\',\''+esc(r.name)+'\')">'+
        '<h4>'+esc(r.name)+'<b>★ '+fmt(r.stargazers_count)+'</b></h4>'+
        '<div class="d">'+esc(r.description||'No description')+'</div>'+
        '<div class="meta"><span>'+(r.language?'<span class="ld" style="background:'+langColor(r.language)+'"></span>'+esc(r.language):'—')+'</span></div>'+
      '</div>'
    ).join('');
  }catch(e){el.innerHTML='<p style="color:var(--text3);font-size:13px">Could not fetch similar repos.</p>'}
}

/* ============================================================
   Feature: Release Timeline
   ============================================================ */
async function loadReleases(){
  const el=$('#releaseTimeline');if(!el)return;
  if(S.platform!=='github'&&S.platform!=='ghe'){el.innerHTML='<p style="color:var(--text3);font-size:13px">Releases only available on GitHub.</p>';return}
  el.innerHTML='<p style="color:var(--text3);font-size:13px">Loading releases…</p>';
  try{
    const releases=await api('/repos/'+S.repo.full_name+'/releases?per_page=10');
    if(!Array.isArray(releases)||!releases.length){el.innerHTML='<p style="color:var(--text3);font-size:13px">No releases found.</p>';return}
    el.innerHTML=releases.map(r=>
      '<div style="padding:12px 0;border-bottom:1px dashed var(--line)">'+
        '<div style="display:flex;align-items:center;gap:10px">'+
          '<span style="background:var(--grad);color:#fff;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700">'+esc(r.tag_name||'v?')+'</span>'+
          '<span style="color:var(--text);font-weight:600;font-size:13px">'+esc(r.name||r.tag_name)+'</span>'+
          '<span style="color:var(--text3);font-size:11px;margin-left:auto">'+esc(timeAgo(r.published_at||r.created_at))+'</span>'+
        '</div>'+
        (r.body?'<p style="color:var(--text2);font-size:12px;margin-top:6px;line-height:1.5;max-height:60px;overflow:hidden">'+esc(r.body.slice(0,200))+(r.body.length>200?'…':'')+'</p>':'')+
      '</div>'
    ).join('');
  }catch(e){el.innerHTML='<p style="color:var(--text3);font-size:13px">Could not load releases.</p>'}
}

/* ============================================================
   Feature: Repo Battle Mode
   ============================================================ */
function toggleBattle(){
  const modal=$('#battleModal');
  if(!modal)return;
  modal.classList.toggle('hidden');
}
async function loadBattle(){
  const input=$('#battleInput');
  if(!input)return;
  const v=input.value.trim();
  const p=parseRepoInput(v);
  if(!p){toast('Enter owner/repo','err');return}
  const result=$('#battleResult');
  if(!result)return;
  result.innerHTML='<p style="color:var(--text3)">Loading…</p>';
  try{
    const meta=await api('/repos/'+p.owner+'/'+p.repo);
    const m1=S.repo,m2=meta;
    const hc1=healthCheck();
    /* Simple health check for m2 */
    const m2Score=Math.min(100,
      (m2.description?10:0)+
      ((m2.topics||[]).length?10:0)+
      (m2.license?15:0)+
      (m2.stargazers_count>100?10:m2.stargazers_count>10?5:0)+
      (m2.forks_count>10?10:0)+
      (m2.open_issues_count<100?10:0)+
      ((Date.now()-new Date(m2.pushed_at))<180*864e5?15:0)+
      20
    );
    const metrics=[
      {l:'Stars',v1:m1.stargazers_count,v2:m2.stargazers_count},
      {l:'Forks',v1:m1.forks_count,v2:m2.forks_count},
      {l:'Health',v1:hc1.score,v2:m2Score},
      {l:'Files',v1:FILEMAP.size,v2:'?'},
      {l:'Open Issues',v1:m1.open_issues_count,v2:m2.open_issues_count,lower:true}
    ];
    result.innerHTML=
      '<div class="battle-grid">'+
        '<div class="battle-side"><h4>'+esc(m1.name)+'</h4>'+
          metrics.map(m=>'<div class="battle-row"><span class="bl">'+esc(m.l)+'</span><span class="bv '+(m.lower?(m.v1<=m.v2?'win':'lose'):(m.v1>=m.v2?'win':'lose'))+'">'+fmt(m.v1)+'</span></div>').join('')+
        '</div>'+
        '<div class="battle-side"><h4>'+esc(m2.name)+'</h4>'+
          metrics.map(m=>'<div class="battle-row"><span class="bl">'+esc(m.l)+'</span><span class="bv '+(m.lower?(m.v2<=m.v1?'win':'lose'):(m.v2>=m.v1?'win':'lose'))+'">'+fmt(m.v2)+'</span></div>').join('')+
        '</div>'+
      '</div>'+
      '<div class="battle-summary">'+esc(m1.name)+' vs '+esc(m2.name)+' — compared by Repodest 🧪</div>';
  }catch(e){result.innerHTML='<p style="color:var(--red)">Could not load '+esc(v)+'</p>'}
}

/* ============================================================
   Feature: Quick Clone Panel
   ============================================================ */
function showCloneModal(){
  const m=S.repo;if(!m)return;
  const url=m.html_url;
  const modal=$('#cloneModal');
  if(!modal)return;
  const content=$('#cloneContent');
  if(content)content.innerHTML=
    '<div style="display:flex;flex-direction:column;gap:10px">'+
      ['git clone '+url,'git clone --depth 1 '+url,'git clone --recursive '+url].map(cmd=>
        '<div style="display:flex;align-items:center;gap:8px;padding:10px;background:var(--bg2);border-radius:var(--rs);border:1px solid var(--line)">'+
          '<code style="flex:1;font-size:12px;color:var(--text2);word-break:break-all">'+esc(cmd)+'</code>'+
          '<button class="btn sm ghost" onclick="copyText(this,\''+esc(cmd)+'\')">📋</button>'+
        '</div>'
      ).join('')+
      '<div style="text-align:center;margin-top:10px">'+
        '<a class="btn sm" href="'+esc(url)+'" target="_blank" rel="noopener">Open on GitHub ↗</a>'+
      '</div>'+
    '</div>';
  modal.classList.remove('hidden');
}
function copyText(btn,text){
  (navigator.clipboard?navigator.clipboard.writeText(text):Promise.reject()).then(()=>{
    btn.textContent='✅';
    setTimeout(()=>btn.textContent='📋',1500);
  }).catch(()=>toast('Copy failed','err'));
}

/* ============================================================
   Feature: Share Card Templates
   ============================================================ */
let shareTemplate='detailed';
function showShareTemplateModal(){
  showModal('📸 Share Card Template',
    '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">'+
      [['minimal','Minimal'],['detailed','Detailed'],['fun','Fun']].map(([k,l])=>
        '<button class="btn '+(shareTemplate===k?'':'ghost')+' sm" onclick="shareTemplate=\''+k+'\';closeModal();shareCard()">'+esc(l)+'</button>'
      ).join('')+
    '</div>'
  );
}

/* ============================================================
   Feature: Keyboard Shortcuts
   ============================================================ */
function showShortcuts(){
  const shortcuts=[
    ['Ctrl+K /','Focus search'],['1-6','Switch tabs'],['Esc','Close modal'],['?','Show shortcuts'],['Ctrl+Enter','Submit']
  ];
  showModal('⌨️ Keyboard Shortcuts',
    shortcuts.map(([k,d])=>'<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed var(--line)"><span style="font-family:var(--mono);color:var(--accent2);font-size:12px">'+esc(k)+'</span><span style="color:var(--text2);font-size:13px">'+esc(d)+'</span></div>').join('')
  );
}
document.addEventListener('keydown',e=>{
  const tag=document.activeElement.tagName;
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
  if(e.key==='?'||e.key==='/'){e.preventDefault();showShortcuts();return}
  if(e.key>='1'&&e.key<='8'){
    const tabs=$$('#tabs .tab');
    const idx=parseInt(e.key)-1;
    if(tabs[idx]){e.preventDefault();switchTab(tabs[idx].dataset.tab)}
  }
});
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();openCommandPalette()}
});

/* Feature: i18n — second block removed (was duplicate of earlier I18N/currentLang/t/toggleLang) */

/* ============================================================
   Feature: Dependency Graph (simple canvas)
   ============================================================ */
function renderDepsGraph(){
  const canvas=$('#depsCanvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const W=canvas.width=canvas.offsetWidth||500;
  const H=canvas.height=300;
  ctx.clearRect(0,0,W,H);
  /* Collect deps from manifests */
  const deps=[];
  const depCols=$$('.depcol .dep b');
  depCols.forEach(el=>{if(el.textContent.trim())deps.push(el.textContent.trim())});
  if(!deps.length){ctx.fillStyle='#64748b';ctx.font='13px Inter';ctx.textAlign='center';ctx.fillText('No dependencies detected',W/2,H/2);return}
  /* Simple force layout */
  const nodes=deps.slice(0,30).map((d,i)=>({
    name:d,
    x:W/2+Math.cos(i*2*Math.PI/Math.min(deps.length,30))*100+Math.random()*40,
    y:H/2+Math.sin(i*2*Math.PI/Math.min(deps.length,30))*80+Math.random()*40,
    vx:0,vy:0,r:6
  }));
  /* Center node */
  const center={name:S.repo.name,x:W/2,y:H/2,r:12};
  /* Simple physics */
  for(let iter=0;iter<50;iter++){
    for(const n of nodes){
      /* Attract to center */
      const dx=center.x-n.x,dy=center.y-n.y;
      const dist=Math.sqrt(dx*dx+dy*dy)||1;
      n.vx+=dx/dist*0.5;n.vy+=dy/dist*0.5;
      /* Repel from other nodes */
      for(const m of nodes){
        if(m===n)continue;
        const ddx=n.x-m.x,ddy=n.y-m.y;
        const dd=Math.sqrt(ddx*ddx+ddy*ddy)||1;
        if(dd<40){n.vx+=ddx/dd*2;n.vy+=ddy/dd*2}
      }
      n.vx*=0.8;n.vy*=0.8;
      n.x+=n.vx;n.y+=n.vy;
      n.x=Math.max(20,Math.min(W-20,n.x));
      n.y=Math.max(20,Math.min(H-20,n.y));
    }
  }
  /* Draw edges */
  for(const n of nodes){
    ctx.beginPath();ctx.moveTo(center.x,center.y);ctx.lineTo(n.x,n.y);
    ctx.strokeStyle='rgba(168,85,247,.2)';ctx.lineWidth=1;ctx.stroke();
  }
  /* Draw center */
  ctx.beginPath();ctx.arc(center.x,center.y,center.r,0,7);
  ctx.fillStyle='rgba(124,58,237,.6)';ctx.fill();
  ctx.fillStyle='#fff';ctx.font='bold 10px Inter';ctx.textAlign='center';ctx.fillText(center.name,center.x,center.y+4);
  /* Draw nodes */
  for(const n of nodes){
    ctx.beginPath();ctx.arc(n.x,n.y,n.r,0,7);
    ctx.fillStyle='rgba(34,211,238,.5)';ctx.fill();
    ctx.fillStyle='#94a3b8';ctx.font='9px JetBrains Mono';ctx.textAlign='center';ctx.fillText(n.name.slice(0,12),n.x,n.y+n.r+10);
  }
}

/* ============================================================
   Feature 1: Dependency Graph Visualization
   ============================================================ */
let depGraphNodes=[], depGraphEdges=[], depGraphAnimId=null;
const ECOSYSTEM_COLORS={
  'npm':'#f1e05a','pip':'#3572A5','pyproject':'#3572A5','Cargo':'#dea584',
  'Go modules':'#00ADD8','Composer':'#4F5D95','Bundler':'#701516','Maven':'#b07219'
};

function buildDepGraph(){
  try{
    const paths=[];FILEMAP.forEach((v,k)=>paths.push(k));
    const branch=(S.repo&&S.repo.default_branch)||'main';
    const nodes=[],edges=[];
    const seen=new Set();
    nodes.push({id:'__repo__',label:S.repo?S.repo.name||'repo':'repo',x:0,y:0,vx:0,vy:0,r:18,color:'#a855f7',ecosystem:'repo',fixed:true});
    seen.add('__repo__');
    for(const mf of MANIFESTS){
      const hit=paths.find(p=>p===mf.f||p.endsWith('/'+mf.f));
      if(!hit)continue;
      const ecoColor=ECOSYSTEM_COLORS[mf.label]||'#888';
      const depList=(S._parsedDeps&&S._parsedDeps[mf.label])||[];
      for(const dep of depList.slice(0,30)){
        const id=mf.label+':'+dep;
        if(seen.has(id))continue;
        seen.add(id);
        nodes.push({id,label:dep,x:Math.random()*200-100,y:Math.random()*200-100,vx:0,vy:0,r:8,color:ecoColor,ecosystem:mf.label});
        edges.push({source:'__repo__',target:id});
      }
    }
    depGraphNodes=nodes;
    depGraphEdges=edges;
    renderDepGraphLegend();
    startDepGraphAnimation();
  }catch(e){console.warn('buildDepGraph error:',e)}
}

function renderDepGraphLegend(){
  const el=$('#depGraphLegend');
  if(!el)return;
  const ecosystems=new Set(depGraphNodes.map(n=>n.ecosystem));
  el.innerHTML=Array.from(ecosystems).map(e=>{
    const c=e==='repo'?'#a855f7':(ECOSYSTEM_COLORS[e]||'#888');
    return '<span><span class="dot" style="background:'+c+'"></span>'+esc(e)+'</span>';
  }).join('');
}

function startDepGraphAnimation(){
  const canvas=$('#depGraphCanvas');
  if(!canvas)return;
  const wrap=$('#depGraphWrap');
  const ctx=canvas.getContext('2d');
  const tooltip=$('#depGraphTooltip');
  let W,H;
  function resize(){W=canvas.width=wrap.clientWidth;H=canvas.height=wrap.clientHeight}
  resize();
  window.addEventListener('resize',resize);
  let mouseX=-1,mouseY=-1;
  canvas.addEventListener('mousemove',e=>{
    const rect=canvas.getBoundingClientRect();
    mouseX=e.clientX-rect.left;mouseY=e.clientY-rect.top;
    const cx=W/2,cy=H/2;
    let found=null;
    for(const n of depGraphNodes){
      const dx=(cx+n.x)-mouseX,dy=(cy+n.y)-mouseY;
      if(Math.sqrt(dx*dx+dy*dy)<n.r+4){found=n;break}
    }
    if(found){
      tooltip.textContent=found.label+(found.ecosystem!=='repo'?' ('+found.ecosystem+')':'');
      tooltip.style.left=(mouseX+12)+'px';tooltip.style.top=(mouseY-8)+'px';
      tooltip.classList.add('show');
    }else{tooltip.classList.remove('show')}
  });
  canvas.addEventListener('mouseleave',()=>tooltip.classList.remove('show'));
  if(depGraphAnimId)cancelAnimationFrame(depGraphAnimId);
  function tick(){
    ctx.clearRect(0,0,W,H);
    const cx=W/2,cy=H/2;
    for(let i=0;i<depGraphNodes.length;i++){
      for(let j=i+1;j<depGraphNodes.length;j++){
        const a=depGraphNodes[i],b=depGraphNodes[j];
        let dx=a.x-b.x,dy=a.y-b.y;
        let dist=Math.sqrt(dx*dx+dy*dy)||1;
        const force=800/(dist*dist);
        const fx=dx/dist*force,fy=dy/dist*force;
        if(!a.fixed){a.vx+=fx;a.vy+=fy}
        if(!b.fixed){b.vx-=fx;b.vy-=fy}
      }
    }
    for(const e of depGraphEdges){
      const a=depGraphNodes.find(n=>n.id===e.source);
      const b=depGraphNodes.find(n=>n.id===e.target);
      if(!a||!b)continue;
      let dx=a.x-b.x,dy=a.y-b.y;
      let dist=Math.sqrt(dx*dx+dy*dy)||1;
      const ideal=100;
      const force=(dist-ideal)*0.005;
      const fx=dx/dist*force,fy=dy/dist*force;
      if(!b.fixed){b.vx+=fx;b.vy+=fy}
      if(!a.fixed){a.vx-=fx;a.vy-=fy}
    }
    for(const n of depGraphNodes){
      if(n.fixed)continue;
      n.vx-=n.x*0.001;n.vy-=n.y*0.001;
      n.vx*=0.92;n.vy*=0.92;
      n.x+=n.vx;n.y+=n.vy;
      const bound=Math.min(W,H)/2-30;
      const dist=Math.sqrt(n.x*n.x+n.y*n.y);
      if(dist>bound){n.x=n.x/dist*bound;n.y=n.y/dist*bound}
    }
    ctx.strokeStyle='rgba(100,100,160,.3)';ctx.lineWidth=1;
    for(const e of depGraphEdges){
      const a=depGraphNodes.find(n=>n.id===e.source);
      const b=depGraphNodes.find(n=>n.id===e.target);
      if(!a||!b)continue;
      ctx.beginPath();ctx.moveTo(cx+a.x,cy+a.y);ctx.lineTo(cx+b.x,cy+b.y);ctx.stroke();
    }
    for(const n of depGraphNodes){
      ctx.beginPath();ctx.arc(cx+n.x,cy+n.y,n.r,0,Math.PI*2);
      ctx.fillStyle=n.color;ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.15)';ctx.lineWidth=1;ctx.stroke();
      if(n.r>=12||depGraphNodes.length<25){
        ctx.fillStyle='#e2e8f0';ctx.font=(n.r>=14?'bold 11px':'10px')+' Inter,sans-serif';ctx.textAlign='center';
        ctx.fillText(n.label.length>16?n.label.slice(0,14)+'…':n.label,cx+n.x,cy+n.y+n.r+14);
      }
    }
    depGraphAnimId=requestAnimationFrame(tick);
  }
  tick();
}

/* ============================================================
   Feature 2: Code Complexity Score
   ============================================================ */
function computeComplexity(){
  try{
    const fileScores=[];
    let totalScore=0,funcCount=0,classCount=0;
    FILEMAP.forEach((f,p)=>{
      if(!isText(f)||isLock(f))return;
      const ext=extOf(p);
      if(BINARY_EXT.has(ext))return;
      const size=f.size||0;
      let score=0;
      if(ext==='js'||ext==='ts'||ext==='jsx'||ext==='tsx')score+=3;
      if(ext==='py')score+=2;
      if(ext==='java'||ext==='cpp'||ext==='c')score+=3;
      score+=Math.floor(size/2000);
      if(/(test|spec|__tests__)/i.test(p))score+=1;
      if(/(index|main|app|server|router|controller|service)/i.test(p))score+=2;
      fileScores.push({path:p,score:score});
      totalScore+=score;
    });
    FILEMAP.forEach((f,p)=>{
      if(/controller|service|handler|util|helper/i.test(p))funcCount+=3;
      if(/class|model|entity|dto/i.test(p))classCount+=2;
      if(/\.test\.|\.spec\./i.test(p))funcCount+=1;
    });
    funcCount=Math.max(funcCount,Math.floor(FILEMAP.size*0.3));
    classCount=Math.max(classCount,Math.floor(FILEMAP.size*0.05));
    fileScores.sort((a,b)=>b.score-a.score);
    const level=totalScore<30?'Low':totalScore<80?'Medium':totalScore<200?'High':'Very High';
    const levelColor=totalScore<30?'var(--green)':totalScore<80?'var(--yellow)':totalScore<200?'var(--orange)':'var(--red)';
    const meterPct=Math.min(totalScore/250*100,100);
    const el=$('#complexityContent');
    if(!el)return;
    el.innerHTML=
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">'+
        '<span class="complexity-score-label" style="color:'+levelColor+'">'+level+'</span>'+
        '<span style="color:var(--text3);font-size:12px">('+totalScore+' pts)</span>'+
      '</div>'+
      '<div class="complexity-meter"><i style="width:'+meterPct+'%;background:linear-gradient(90deg,var(--green),'+levelColor+')"></i></div>'+
      '<div style="display:flex;gap:16px;font-size:12px;color:var(--text2);margin-bottom:8px">'+
        '<span>~<b>'+fmt(funcCount)+'</b> functions</span>'+
        '<span>~<b>'+fmt(classCount)+'</b> classes</span>'+
        '<span><b>'+fmt(FILEMAP.size)+'</b> files</span>'+
      '</div>'+
      '<div class="minititle" style="margin-top:8px">Top 5 most complex files</div>'+
      '<div class="complexity-top-files">'+
        fileScores.slice(0,5).map(f=>
          '<div class="cfrow"><span class="cfpath" title="'+esc(f.path)+'">'+esc(f.path.split('/').pop())+'</span><span class="cfscore">'+f.score+' pts</span></div>'
        ).join('')+
      '</div>';
  }catch(e){console.warn('computeComplexity error:',e)}
}

/* ============================================================
   Feature 3: Contributor Network (Bus Factor)
   ============================================================ */
function renderBusFactor(){
  try{
    const el=$('#busFactorContent');
    if(!el)return;
    const contribs=S.contribs.filter(c=>c.type!=='Bot');
    if(!contribs.length){el.innerHTML='<p style="color:var(--text3);font-size:13px">No contributor data.</p>';return}
    const total=contribs.reduce((a,c)=>a+(c.contributions||0),0)||1;
    const sorted=contribs.slice().sort((a,b)=>(b.contributions||0)-(a.contributions||0));
    const topPct=(sorted[0].contributions||0)/total*100;
    let busFactor;
    if(topPct>50)busFactor=1;
    else busFactor=sorted.filter(c=>(c.contributions||0)/total*100>10).length;
    const bfClass=busFactor<=1?'bad':busFactor<=2?'warn':'good';
    const bfLabel=busFactor<=1?'🚨 Risky':busFactor<=2?'⚠️ Moderate':'✅ Healthy';
    const top5=sorted.slice(0,5);
    const othersPct=100-top5.reduce((a,c)=>a+(c.contributions||0)/total*100,0);
    const barColors=['#a855f7','#22d3ee','#f1e05a','#22c55e','#ec4899','#64748b'];
    el.innerHTML=
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">'+
        '<span class="bus-factor-badge '+bfClass+'">'+bfLabel+'</span>'+
        '<span style="color:var(--text2);font-size:12.5px">Bus Factor: <b>'+busFactor+'</b></span>'+
      '</div>'+
      '<div style="font-size:12px;color:var(--text3);margin-bottom:6px">'+
        (topPct>50?'Top contributor has '+topPct.toFixed(1)+'% of commits — single point of failure.':'Top contributor has '+topPct.toFixed(1)+'% — contributions are reasonably distributed.')+
      '</div>'+
      '<div class="dominance-bar">'+
        top5.map((c,i)=>'<i style="width:'+((c.contributions||0)/total*100).toFixed(1)+'%;background:'+barColors[i]+'"></i>').join('')+
        (othersPct>0?'<i style="width:'+othersPct.toFixed(1)+'%;background:'+barColors[5]+'"></i>':'')+
      '</div>'+
      '<div class="dominance-legend">'+
        top5.map((c,i)=>'<span><span class="dl-dot" style="background:'+barColors[i]+'"></span>'+esc(c.login||c.name||'?')+' '+((c.contributions||0)/total*100).toFixed(1)+'%</span>').join('')+
        (othersPct>0?'<span><span class="dl-dot" style="background:'+barColors[5]+'"></span>Others '+othersPct.toFixed(1)+'%</span>':'')+
      '</div>';
  }catch(e){console.warn('renderBusFactor error:',e)}
}

/* ============================================================
   Feature 4: Release Timeline
   ============================================================ */
async function renderReleaseTimeline(){
  try{
    const el=$('#releaseTimeline');
    if(!el)return;
    if(S.platform!=='github'&&S.platform!=='ghe'){el.innerHTML='<p style="color:var(--text3);font-size:13px">Releases only available for GitHub repos.</p>';return}
    const m=S.repo;if(!m||!m.full_name)return;
    el.innerHTML='<p style="color:var(--text3);font-size:12px">Loading releases…</p>';
    try{
      const releases=await api('/repos/'+m.full_name+'/releases?per_page=10');
      if(!Array.isArray(releases)||!releases.length){el.innerHTML='<p style="color:var(--text3);font-size:13px">No releases found.</p>';return}
      el.innerHTML='<div class="release-timeline">'+releases.map(r=>{
        const body=(r.body||'').slice(0,200).replace(/</g,'&lt;');
        return '<div class="release-item">'+
          '<div class="rver">'+esc(r.tag_name||r.name||'untagged')+'</div>'+
          '<div class="rdate">'+esc(r.published_at?new Date(r.published_at).toLocaleDateString():'unknown date')+'</div>'+
          (body?'<div class="rbody">'+esc(body)+(r.body&&r.body.length>200?'…':'')+'</div>':'')+
        '</div>';
      }).join('')+'</div>';
    }catch(e){
      el.innerHTML='<p style="color:var(--text3);font-size:13px">Could not fetch releases.</p>';
    }
  }catch(e){console.warn('renderReleaseTimeline error:',e)}
}

/* ============================================================
   Feature 5: AI Repo Summary
   ============================================================ */
function generateSummary(){
  try{
    const m=S.repo;if(!m)return;
    const hc=healthCheck();
    const langs=Object.keys(S.langs).join(', ')||m.language||'unknown';
    const topics=(m.topics||[]).length?m.topics.join(', '):'no specific topics';
    const desc=m.description||'a repository';
    const summary='This is a <b>'+esc(m.language||langs.split(',')[0]||'multi-language')+'</b> project that '+esc(desc.toLowerCase().endsWith('.')?desc:desc+'.')+' It has <b>'+fmt(m.stargazers_count)+'</b> stars, <b>'+fmt(FILEMAP.size)+'</b> files, and <b>'+fmt(m.forks_count)+'</b> forks. Health score: <b>'+hc.score+'/100</b>. Topics: '+esc(topics)+'.';
    const box=$('#aiSummaryBox');
    if(!box)return;
    box.innerHTML='<div class="ai-summary-box">'+summary+'</div>';
  }catch(e){console.warn('generateSummary error:',e)}
}

/* ============================================================
   Feature 6: Smart File Recommendations
   ============================================================ */
const REC_CATEGORIES={
  core:{label:'Core files',match:p=>{
    const name=p.split('/').pop();
    return /^(index|main|app|server|entry|boot|init|setup)\.[a-z]+$/i.test(name);
  }},
  config:{label:'Config files',match:p=>{
    const name=p.split('/').pop();
    return /^(package\.json|tsconfig.*\.json|\.env\.example|vite\.config.*|webpack\.config.*|rollup\.config.*|babel\.config.*|jest\.config.*|\.eslintrc.*|\.prettierrc.*|tslint\.json|pyproject\.toml|setup\.cfg|setup\.py|Cargo\.toml|go\.mod|Makefile|Dockerfile|docker-compose.*|\.github\/workflows\/.*\.ya?ml)$/i.test(name);
  }},
  docs:{label:'Docs',match:p=>{
    const name=p.split('/').pop();
    return /^(readme.*|changelog.*|contributing.*|license.*|code_of_conduct.*|authors.*|security.*|\.github\/issue_template.*|\.github\/pull_request_template.*)$/i.test(name);
  }}
};

function countRecCategory(cat){
  let n=0;
  FILEMAP.forEach((f,p)=>{if(REC_CATEGORIES[cat].match(p))n++});
  return n;
}

function updateRecCounts(){
  for(const cat of Object.keys(REC_CATEGORIES)){
    const cap=cat.charAt(0).toUpperCase()+cat.slice(1);
    const el=$('#rec'+cap+'Cnt');
    if(el)el.textContent='('+countRecCategory(cat)+')';
  }
}

/* Duplicate functions removed — originals at their earlier locations */

/* ============================================================
   Store parsed deps globally for dependency graph
   ============================================================ */
const _origRenderDeps=renderDeps;
renderDeps=async function(stacks){
  await _origRenderDeps(stacks);
  S._parsedDeps=S._parsedDeps||{};
  const branch=(S.repo&&S.repo.default_branch)||'main';
  for(const st of stacks){
    const raw=rawUrl((S.repo&&S.repo.full_name),branch,st.file);
    try{
      const txt=await(await fetch(raw)).text();
      let deps=[];
      if(st.label==='npm'||st.label==='Composer'){
        const j=JSON.parse(txt);
        deps=Object.keys(Object.assign({},j.dependencies||{},j.devDependencies||{}));
      }else if(st.label==='pip'){
        deps=txt.split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')&&!l.startsWith('-')).map(l=>l.split(/[=<>~!\[;\s]/)[0]).filter(Boolean);
      }else if(st.label==='pyproject'||st.label==='Cargo'){
        const sec=txt.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
        const block=sec?sec[1]:txt;
        deps=Array.from(block.matchAll(/["']?([A-Za-z0-9_.\-]+)["']?\s*[=><~]/g)).map(x=>x[1]);
      }else if(st.label==='Go modules'){
        deps=Array.from(txt.matchAll(/^\s{1,2}([A-Za-z0-9._\/\-]+)\s+v/gm)).map(x=>x[1]);
      }else if(st.label==='Bundler'){
        deps=Array.from(txt.matchAll(/gem\s+["']([^"']+)["']/g)).map(x=>x[1]);
      }else if(st.label==='Maven'){
        deps=Array.from(txt.matchAll(/<artifactId>([^<]+)<\/artifactId>/g)).map(x=>x[1]);
      }
      S._parsedDeps[st.label]=Array.from(new Set(deps)).filter(Boolean);
    }catch(e){S._parsedDeps[st.label]=[];}
  }
};

/* ============================================================
   Fix: openBattle() was overwritten by duplicates above — restore correct implementation
   ============================================================ */
function openBattle(){
  $('#battleInput').value='';
  $('#battleResult').innerHTML='';
  $('#battleModalBg').classList.remove('hidden');
  setTimeout(()=>$('#battleInput').focus(),60);
}

/* Fix: closeExplainModal was overwritten — restore correct implementation */
function closeExplainModal(){$('#explainModalBg').classList.add('hidden')}

/* Fix: closeBattleModal was never defined */
function closeBattleModal(){$('#battleModalBg').classList.add('hidden')}

/* Fix: runBattle was overwritten to call loadBattle() which doesn't exist — restore */
async function runBattle(){
  const v=$('#battleInput').value.trim();
  if(!v){toast('Enter a repo to battle','err');return}
  const p=parseRepoInput(v);
  if(!p){toast('Could not parse that','err');return}
  const result=$('#battleResult');
  result.innerHTML='<div class="loading"><div class="spinner"></div><p>Loading challenger…</p></div>';
  try{
    let otherMeta,otherLangs,otherContribs,otherTree;
    if(p.platform==='github'){
      otherMeta=await api('/repos/'+p.owner+'/'+p.repo);
      otherMeta=stripRepo(otherMeta);
      otherLangs=await api('/repos/'+p.owner+'/'+p.repo+'/languages').catch(()=>({}));
      otherContribs=await api('/repos/'+p.owner+'/'+p.repo+'/contributors?per_page=1').catch(()=>[]);
      const tree=await api('/repos/'+p.owner+'/'+p.repo+'/git/trees/'+(otherMeta.default_branch||'main')+'?recursive=1').catch(()=>null);
      otherTree=tree?(tree.tree||[]).filter(x=>x.type==='blob').length:0;
    }else{
      const data=await fetchRepoData(p.owner,p.repo,p.platform);
      if(!data)throw new Error('Failed');
      otherMeta=data.meta;otherLangs=data.langs||{};otherContribs=data.contribs||[];
      otherTree=data.tree?(data.tree.tree||[]).length:0;
    }
    const a=S.repo,b=otherMeta;
    const ahc=healthCheck();
    const bScore=(b.stargazers_count||0)>1000?70:(b.stargazers_count||0)>100?55:(b.stargazers_count||0)>10?40:25;
    const metrics=[
      {label:'Stars',aVal:a.stargazers_count||0,bVal:b.stargazers_count||0,fmt:v=>fmt(v)},
      {label:'Forks',aVal:a.forks_count||0,bVal:b.forks_count||0,fmt:v=>fmt(v)},
      {label:'Health Score',aVal:ahc.score,bVal:bScore,fmt:v=>v+'/100'},
      {label:'Files',aVal:FILEMAP.size,bVal:otherTree,fmt:v=>fmt(v)},
      {label:'Languages',aVal:Object.keys(S.langs).length,bVal:Object.keys(otherLangs).length,fmt:v=>v+''},
      {label:'Contributors',aVal:S.contribs.length,bVal:otherContribs.length,fmt:v=>fmt(v)}
    ];
    let aWins=0,bWins=0;
    const rows=metrics.map(m=>{
      const winner=m.aVal>m.bVal?'a':m.bVal>m.aVal?'b':'tie';
      if(winner==='a')aWins++;else if(winner==='b')bWins++;
      return '<div class="battle-row">'+
        '<span class="bl">'+esc(m.label)+'</span>'+
        '<span class="bv '+(winner==='a'?'win':winner==='b'?'lose':'')+'">'+m.fmt(m.aVal)+'</span>'+
        '<span style="color:var(--text3)">vs</span>'+
        '<span class="bv '+(winner==='b'?'win':winner==='a'?'lose':'')+'">'+m.fmt(m.bVal)+'</span>'+
      '</div>';
    }).join('');
    const winnerLabel=aWins>bWins?esc(a.full_name):bWins>aWins?esc(b.full_name):'Tie';
    const shareText='⚔️ Repo Battle: '+a.full_name+' vs '+b.full_name+' → '+winnerLabel+' wins! ('+aWins+'-'+bWins+')';
    result.innerHTML=
      '<div class="battle-grid">'+
        '<div class="battle-side"><h4>'+esc(a.full_name||'')+'</h4>'+rows+'</div>'+
        '<div class="battle-side"><h4>'+esc(b.full_name||'')+'</h4>'+rows.replace(/class="bv (win|lose)"/g,(match)=>match.replace('lose',''))+'</div>'+
      '</div>'+
      '<div style="text-align:center;margin:12px 0;font-size:16px;font-weight:700">'+
        (aWins>bWins?'🏆 '+esc(a.full_name)+' wins!':bWins>aWins?'🏆 '+esc(b.full_name)+' wins!':'🤝 Tie!')+
        ' <span style="color:var(--text3);font-size:13px">('+aWins+'-'+bWins+')</span>'+
      '</div>'+
      '<div class="battle-summary">'+esc(shareText)+'</div>';
  }catch(e){
    result.innerHTML='<div class="errbox" style="padding:30px"><div class="e">💥</div><p>'+esc(e.message||'Failed to load challenger')+'</p></div>';
  }
}


/* ---------- Battle Royale: single-elimination tournament (up to 8 repos) ---------- */
function fetchRepoMetrics(p){
  if(p.platform!=='github')return Promise.reject(new Error('Royale supports GitHub repos only'));
  return api('/repos/'+p.owner+'/'+p.repo).then(meta=>{
    const m=stripRepo(meta);
    return api('/repos/'+p.owner+'/'+p.repo+'/languages').then(langs=>({meta:m,langs:langs||{}}));
  });
}
function scoreOf(m,langs){
  const stars=m.stargazers_count||0,forks=m.forks_count||0;
  const freshness=m.pushed_at?Math.max(0,1-(Date.now()-new Date(m.pushed_at))/(365*864e5)):0;
  const diversity=Object.keys(langs).length;
  return stars*2+forks*3+freshness*400+diversity*50;
}
async function runRoyale(){
  const res=$('#royaleResult');
  const raw=($('#royaleInput').value||'').split('\n').map(s=>s.trim()).filter(Boolean);
  if(!raw.length){toast('Enter at least 2 repos, one per line','err');return}
  const parsed=raw.map(parseRepoInput).filter(Boolean).slice(0,7);
  if(parsed.length<2){toast('Need at least 2 valid repos','err');return}
  res.innerHTML='<div class="loading"><div class="spinner"></div><p>Fetching '+(parsed.length+1)+' contestants…</p></div>';
  try{
    const me={meta:S.repo,langs:S.langs||{}};
    const list=[me];
    for(const p of parsed){
      const d=await fetchRepoMetrics(p);
      d.meta.full_name=d.meta.full_name||(p.owner+'/'+p.repo);
      list.push(d);
    }
    let bracket=list.map(d=>({name:d.meta.full_name||d.meta.name,score:scoreOf(d.meta,d.langs)}));
    let round=1,log='';
    while(bracket.length>1){
      const next=[];
      log+='<div style="margin:8px 0;font-size:12px;color:var(--accent2);font-weight:700">Round '+round+'</div>';
      for(let i=0;i<bracket.length;i+=2){
        const a=bracket[i],b=bracket[i+1]||null;
        if(!b){next.push(a);continue}
        const win=a.score>=b.score?a:b;
        log+='<div class="kv"><span>'+esc(a.name)+' vs '+esc(b.name)+'</span><b>→ '+esc(win.name)+'</b></div>';
        next.push(win);
      }
      bracket=next;round++;
    }
    const champion=bracket[0];
    res.innerHTML=
      '<div style="text-align:center;font-size:17px;font-weight:800;margin:10px 0">🏆 Champion: '+esc(champion.name)+'</div>'+
      '<div style="max-height:220px;overflow:auto">'+log+'</div>';
  }catch(e){
    res.innerHTML='<p style="color:var(--red);font-size:12px">'+esc(e.message||'Tournament failed')+'</p>';
  }
}


/* Override showModal to use existing modal system */
function showModal(title,content){
  const bg=document.createElement('div');
  bg.className='modal-bg';
  bg.style.cssText='position:fixed;inset:0;background:rgba(5,5,12,.7);backdrop-filter:blur(6px);z-index:100;display:grid;place-items:center;padding:20px';
  bg.innerHTML='<div class="modal" style="background:var(--card-solid);border:1px solid var(--line2);border-radius:20px;padding:26px;width:min(560px,94vw);box-shadow:var(--shadow)"><h3>'+title+'</h3><div style="margin-top:12px">'+content+'</div><div class="mrow" style="margin-top:14px"><button class="btn ghost sm" onclick="this.closest(\'.modal-bg\').remove()">Close</button></div></div>';
  bg.addEventListener('click',e=>{if(e.target===bg)bg.remove()});
  document.body.appendChild(bg);
}

/* ============================================================
   Accessibility Improvements
   ============================================================ */
/* Add ARIA roles and labels to key interactive elements */
document.addEventListener('DOMContentLoaded',()=>{
  /* Tab list ARIA */
  const tabList=$('#tabs');
  if(tabList){tabList.setAttribute('role','tablist');tabList.setAttribute('aria-label','Dashboard tabs')}
  $$('#tabs .tab').forEach(tab=>{
    tab.setAttribute('role','tab');
    tab.setAttribute('aria-selected',tab.classList.contains('active')?'true':'false');
    const panelId='p-'+tab.dataset.tab;
    tab.setAttribute('aria-controls',panelId);
  });

  /* Panel ARIA */
  $$('#dash .panel').forEach(panel=>{
    panel.setAttribute('role','tabpanel');
    panel.setAttribute('aria-labelledby','tab-'+panel.id.replace('p-',''));
  });

  /* Search input ARIA */
  const searchInp=$('#inp');
  if(searchInp){searchInp.setAttribute('aria-label','Search for a GitHub repository');searchInp.setAttribute('role','searchbox')}

  /* Toolbar button labels */
  $$('.toolbar .btn').forEach(btn=>{
    if(!btn.getAttribute('aria-label')&&!btn.textContent.trim()){
      btn.setAttribute('aria-label',btn.title||'Action');
    }
  });

  /* Modal focus trap */
  document.addEventListener('keydown',e=>{
    if(e.key!=='Tab')return;
    const openModal=document.querySelector('.modal-bg:not(.hidden)');
    if(!openModal)return;
    const focusable=openModal.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
    if(!focusable.length)return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  });

  /* Live region for toasts (screen readers) */
  const liveRegion=document.createElement('div');
  liveRegion.setAttribute('aria-live','polite');
  liveRegion.setAttribute('aria-atomic','true');
  liveRegion.className='sr-only';
  liveRegion.id='liveRegion';
  document.body.appendChild(liveRegion);

  /* Enhance toast to announce to screen readers */
  const origToast=window.toast;
  if(typeof origToast==='function'){
    window.toast=function(msg,cls){
      origToast(msg,cls);
      const lr=$('#liveRegion');
      if(lr)lr.textContent=msg;
    };
  }
});

/* Update ARIA states when tabs switch */
const _origSwitchTab=window.switchTab;
if(typeof _origSwitchTab==='function'){
  window.switchTab=function(name){
    _origSwitchTab(name);
    $$('#tabs .tab').forEach(tab=>{
      tab.setAttribute('aria-selected',tab.dataset.tab===name?'true':'false');
    });
    const panel=$('#p-'+name);
    if(panel){panel.setAttribute('tabindex','0');panel.focus()}
  };
}

/* ============================================================
   Enhanced File Tree Features
   ============================================================ */

/* Copy tree as plain text (Gitingest-style) */
function copyTreeAsText(){
  const paths=Array.from(FILEMAP.keys()).sort();
  if(!paths.length){toast('No files to copy','err');return}
  const tree=asciiTree(paths);
  (navigator.clipboard?navigator.clipboard.writeText(tree):Promise.reject()).then(()=>{
    toast('Tree copied to clipboard ('+paths.length+' files)','ok');
  }).catch(()=>toast('Copy failed','err'));
}

/* Filter state */
let filterHidden=true, filterBinary=true, searchText='';

function toggleFilterHidden(){
  filterHidden=!filterHidden;
  const btn=$('#filterHiddenBtn');
  if(btn)btn.style.opacity=filterHidden?'0.5':'1';
  renderFiles();
  toast(filterHidden?'Hidden files hidden':'Hidden files shown','ok');
}

function toggleFilterBinary(){
  filterBinary=!filterBinary;
  const btn=$('#filterBinaryBtn');
  if(btn)btn.style.opacity=filterBinary?'0.5':'1';
  renderFiles();
  toast(filterBinary?'Binary files hidden':'Binary files shown','ok');
}

function filterTree(val){
  searchText=(val||'').toLowerCase();
  renderFiles();
}

/* ---------- Monorepo subfolder scope ---------- */
let scopePrefix='';
function populateScopeSelect(){
  const sel=$('#scopeSelect');
  if(!sel)return;
  const topDirs=new Set();
  FILEMAP.forEach((f,p)=>{
    const parts=(p||'').split('/');
    if(parts.length>1)topDirs.add(parts[0]+'/');
  });
  const current=scopePrefix;
  sel.innerHTML='<option value="">📂 Whole repo</option>'+
    Array.from(topDirs).sort().map(d=>'<option value="'+esc(d)+'">'+esc(d)+'</option>').join('');
  if(current&&topDirs.has(current))sel.value=current;
  sel.style.display=topDirs.size>=2?'':'none';
}
function filterScope(val){
  scopePrefix=(val||'').replace(/\/?$/,'/');
  if(scopePrefix==='/')scopePrefix='';
  renderFiles();
  if(scopePrefix)toast('Scoped to '+scopePrefix+' — new selections limited to it','ok');
  updateSelMeta();
}

/* Override renderFiles to support filtering + monorepo scope */
const _origRenderFiles=renderFiles;
renderFiles=function(){
  _origRenderFiles();
  populateScopeSelect();
  if(filterHidden||filterBinary||searchText||scopePrefix){
    $$('#tree .trow').forEach(row=>{
      const path=row.dataset.path||row.querySelector('.fname')?.textContent||'';
      const isHidden=path.split('/').some(p=>p.startsWith('.')&&p!=='.');
      const isBinary=path.split('.').pop()&&BINARY_EXT.has(path.split('.').pop().toLowerCase());
      const matchesSearch=!searchText||path.toLowerCase().includes(searchText);
      const inScope=!scopePrefix||path.startsWith(scopePrefix);
      let show=true;
      if(filterHidden&&isHidden)show=false;
      if(filterBinary&&isBinary)show=false;
      if(!matchesSearch)show=false;
      if(!inScope)show=false;
      row.style.display=show?'':'none';
    });
    /* Update info text */
    const visible=$$('#tree .trow:not([style*="display: none"])').length;
    const info=$('#treeInfo');
    if(info)info.textContent=visible+' visible · '+FILEMAP.size+' total'+(scopePrefix?' · scoped: '+scopePrefix:'');
  }
}

/* ============================================================
   Deep Analysis tab — PR analytics, fix rate, churn, OSV scan
   ============================================================ */
S.deep={pr:null,fix:null,churn:null,osv:null,loaded:false};

function renderDeepPanel(){
  if(S.deep.loaded)return;
  S.deep.loaded=true;
  if(S.platform!=='github'&&S.platform!=='ghe'){
    const note='<p style="color:var(--text3);font-size:13px">Deep Analysis currently requires a GitHub or GitHub Enterprise repository.</p>';
    $('#prAnalyticsContent').innerHTML=note;$('#fixRateContent').innerHTML=note;
    $('#churnContent').innerHTML=note;return;
  }
  runDeepScan();
}

function fmtHours(h){
  if(h==null)return'—';
  if(h<1)return Math.round(h*60)+' min';
  if(h<48)return h.toFixed(1)+' h';
  if(h<24*60)return Math.round(h/24)+' days';
  return Math.round(h/24/30)+' months';
}
function pctBar(label,val,total,color){
  const pct=total?Math.round(val/total*100):0;
  return '<div class="langrow"><span class="ln" style="width:120px">'+esc(label)+'</span><span class="lb"><i style="width:'+pct+'%;background:'+color+'"></i></span><span class="lp">'+pct+'%</span></div>';
}

async function runDeepScan(){
  const m=S.repo;if(!m||!m.full_name)return;
  loadPRAnalytics();
  loadFixRate();
  loadChurn();
}

/* ---------- PR Analytics ---------- */
async function loadPRAnalytics(){
  const el=$('#prAnalyticsContent');if(!el)return;
  if(S.deep.pr){renderPRAnalytics(S.deep.pr);return}
  el.innerHTML='<p style="color:var(--text3);font-size:12px">⏳ Loading PRs…</p>';
  try{
    const prs=await api('/repos/'+S.repo.full_name+'/pulls?state=all&per_page=100&sort=created&direction=desc');
    if(!Array.isArray(prs))throw new Error('Bad PR response');
    const open=prs.filter(p=>p.state==='open');
    const merged=prs.filter(p=>p.merged_at);
    const closedNo=prs.filter(p=>p.state==='closed'&&!p.merged_at);
    const hours=merged.map(p=>(new Date(p.merged_at)-new Date(p.created_at))/36e5).filter(h=>h>=0);
    const avgH=hours.length?hours.reduce((a,b)=>a+b,0)/hours.length:null;
    const sortedH=hours.slice().sort((a,b)=>a-b);
    const medianH=sortedH.length?sortedH[Math.floor(sortedH.length/2)]:null;
    const stale=open.filter(p=>(Date.now()-new Date(p.created_at))>30*864e5);
    const authors={};prs.forEach(p=>{const l=p.user&&p.user.login;if(l)authors[l]=(authors[l]||0)+1});
    const topAuthors=Object.entries(authors).sort((a,b)=>b[1]-a[1]).slice(0,5);
    S.deep.pr={scanned:prs.length,open:open.length,merged:merged.length,closedNo:closedNo.length,avgH,medianH,stale:stale.length,stalePct:open.length?Math.round(stale.length/open.length*100):0,oldestStaleDays:stale.length?Math.max(...stale.map(p=>(Date.now()-new Date(p.created_at))/864e5)):0,topAuthors};
    renderPRAnalytics(S.deep.pr);
  }catch(e){
    el.innerHTML='<p style="color:var(--red);font-size:12px">Failed to load PRs: '+esc(e.message||'error')+'</p>';
  }
}
function renderPRAnalytics(d){
  const el=$('#prAnalyticsContent');if(!el)return;
  const total=d.scanned||1;
  el.innerHTML=
    '<div class="langrow"><span class="ln" style="width:120px">Scanned</span><span class="lb"><i style="width:100%;background:#334155"></i></span><span class="lp">'+d.scanned+' PRs</span></div>'+
    pctBar('Merged',d.merged,total,'#22c55e')+
    pctBar('Open',d.open,total,'#22d3ee')+
    pctBar('Closed w/o merge',d.closedNo,total,'#ef4444')+
    '<div class="kv"><span>Avg time to merge</span><b>'+fmtHours(d.avgH)+'</b></div>'+
    '<div class="kv"><span>Median time to merge</span><b>'+fmtHours(d.medianH)+'</b></div>'+
    '<div class="kv"><span>Stale open PRs (&gt;30d)</span><b style="color:'+(d.stale>5?'var(--red)':d.stale>0?'var(--yellow)':'var(--green)')+'">'+d.stale+(d.open?' ('+d.stalePct+'% of open)':'')+'</b></div>'+
    (d.topAuthors.length?'<div style="margin-top:10px;font-size:11px;color:var(--text3)">Top PR authors</div>'+d.topAuthors.map(a=>'<div class="kv"><span>'+esc(a[0])+'</span><b>'+a[1]+' PRs</b></div>').join(''):'');
}

/* ---------- Fix rate ---------- */
async function loadFixRate(){
  const el=$('#fixRateContent');if(!el)return;
  if(S.deep.fix){renderFixRate(S.deep.fix);return}
  el.innerHTML='<p style="color:var(--text3);font-size:12px">⏳ Analyzing commits…</p>';
  try{
    const commits=await api('/repos/'+S.repo.full_name+'/commits?per_page=100');
    if(!Array.isArray(commits))throw new Error('Bad commits response');
    const FIX_RE=/^(fix|fixes|fixed|bugfix|hotfix|patch|revert)\b/i;
    const CHORE_RE=/^(chore|refactor|test|docs?|style|ci|build)\b/i;
    const FEAT_RE=/^(feat|feature|add|create)\b/i;
    const CONV_RE=/^(feat|fix|bugfix|hotfix|patch|chore|refactor|test|docs|doc|style|ci|build|perf|revert)(\([a-z0-9_\-\.\/]+\))?!?:\s/i;
    let fixes=0,feats=0,chores=0,other=0,conventional=0;
    commits.forEach(c=>{
      const msg=((c.commit&&c.commit.message)||'').trim();
      const firstLine=msg.split('\n')[0];
      if(CONV_RE.test(firstLine))conventional++;
      if(FIX_RE.test(msg))fixes++;
      else if(FEAT_RE.test(msg))feats++;
      else if(CHORE_RE.test(msg))chores++;
      else other++;
    });
    const convScore=Math.round(conventional/Math.max(commits.length,1)*100);
    S.deep.fix={total:commits.length,fixes,feats,chores,other,conventional,convScore};
    renderFixRate(S.deep.fix);
  }catch(e){
    el.innerHTML='<p style="color:var(--red);font-size:12px">Failed to load commits: '+esc(e.message||'error')+'</p>';
  }
}
function renderFixRate(d){
  const el=$('#fixRateContent');if(!el)return;
  const total=d.total||1;
  const verdict=d.fixes/total>0.4?'🔴 High bug pressure':d.fixes/total>0.2?'🟡 Moderate bug pressure':'🟢 Low bug pressure';
  const convLabel=d.convScore>=70?'✅ Disciplined':d.convScore>=40?'🟡 Partially structured':'⚠️ Unstructured';
  el.innerHTML=
    pctBar('Fixes / reverts',d.fixes,total,'#ef4444')+
    pctBar('Features',d.feats,total,'#a855f7')+
    pctBar('Chores / docs',d.chores,total,'#64748b')+
    pctBar('Other',d.other,total,'#334155')+
    '<div class="kv" style="margin-top:8px"><span>Verdict</span><b>'+verdict+'</b></div>'+
    '<div class="kv"><span>Conventional Commits score</span><b>'+d.convScore+'/100 '+convLabel+'</b></div>'+
    '<div class="langrow"><span class="ln" style="width:120px">'+d.conventional+'/'+d.total+' follow type(scope): subject format</span><span class="lb"><i style="width:'+d.convScore+'%;background:'+(d.convScore>=70?'#22c55e':d.convScore>=40?'#eab308':'#ef4444')+'"></i></span><span class="lp">'+d.convScore+'%</span></div>'+
    '<p style="color:var(--text3);font-size:11px;margin-top:6px">Share of the last '+d.total+' commits starting with fix/hotfix/patch/revert. High fix share may indicate instability; low with steady features suggests a healthy codebase.</p>';
}

/* ---------- Code churn hotspots ---------- */
async function loadChurn(){
  const el=$('#churnContent');if(!el)return;
  if(S.deep.churn){renderChurn(S.deep.churn);return}
  el.innerHTML='<p style="color:var(--text3);font-size:12px">⏳ Computing churn…</p>';
  try{
    const commits=await api('/repos/'+S.repo.full_name+'/commits?per_page=60');
    if(!Array.isArray(commits))throw new Error('Bad commits response');
    const counts={};let examined=0;
    const list=commits.slice(0,40);
    for(const c of list){
      try{
        const detail=await api('/repos/'+S.repo.full_name+'/commits/'+c.sha);
        examined++;
        ((detail.files)||[]).forEach(f=>{
          const path=f.filename||'';
          if(!path)return;
          const entry=counts[path]||(counts[path]={n:0,add:0,del:0});
          entry.n++;entry.add+=f.additions||0;entry.del+=f.deletions||0;
        });
      }catch(err){/* skip this commit */}
    }
    const hot=Object.entries(counts).map(([p,v])=>({path:p,changes:v.n,touches:v.add+v.del})).sort((a,b)=>b.changes-a.changes||b.touches-a.touches).slice(0,10);
    S.deep.churn={examined,commits:list.length,hot};
    renderChurn(S.deep.churn);
  }catch(e){
    el.innerHTML='<p style="color:var(--red);font-size:12px">Failed to compute churn: '+esc(e.message||'error')+'</p>';
  }
}
function renderChurn(d){
  const el=$('#churnContent');if(!el)return;
  if(!d.hot.length){el.innerHTML='<p style="color:var(--text3);font-size:12px">No file changes found in recent commits.</p>';return}
  const max=d.hot[0].changes||1;
  el.innerHTML=
    '<p style="color:var(--text3);font-size:11px;margin-bottom:8px">Based on '+d.examined+'/'+d.commits+' recent commits (each file listing costs one API call — a token raises the depth).</p>'+
    d.hot.map(h=>{
      const pct=Math.round(h.changes/max*100);
      const short=h.path.length>44?'…'+h.path.slice(-43):h.path;
      return '<div class="langrow"><span class="ln" style="width:44%" title="'+esc(h.path)+'">'+esc(short)+'</span><span class="lb"><i style="width:'+pct+'%;background:'+(h.changes>=max*0.8?'#ef4444':h.changes>=max*0.5?'#f59e0b':'#22d3ee')+'"></i></span><span class="lp">'+h.changes+'×</span></div>';
    }).join('');
}

/* ---------- OSV vulnerability scan ---------- */
const OSV_ECO={'npm':'npm','PyPI':'PyPI','crates.io':'crates.io','Go':'Go'};
function parseDepsFromManifest(label,txt){
  let deps=[];
  try{
    if(label==='npm'||label==='Composer'){
      const j=JSON.parse(txt);
      deps=Object.keys(Object.assign({},j.dependencies||{},j.devDependencies||{}));
    }else if(label==='pip'){
      deps=txt.split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')&&!l.startsWith('-')).map(l=>l.split(/[=<>~!\[;\s]/)[0]).filter(Boolean);
    }else if(label==='pyproject'||label==='Cargo'){
      const sec=txt.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
      const block=sec?sec[1]:txt;
      deps=Array.from(block.matchAll(/["']?([A-Za-z0-9_.\-]+)["']?\s*[=><~]/g)).map(x=>x[1]);
    }else if(label==='Go modules'){
      deps=Array.from(txt.matchAll(/^\s{1,2}([A-Za-z0-9._\/\-]+)\s+v/gm)).map(x=>x[1]);
    }
  }catch(e){}
  return Array.from(new Set(deps)).filter(Boolean);
}
async function runOsvScan(){
  const el=$('#osvContent'),badge=$('#osvBadge');
  if(S.deep.osv){renderOsv(S.deep.osv);return}
  if(!FILEMAP.size){toast('Load a repository first','err');return}
  const btn=$('#osvScanBtn');if(btn){btn.disabled=true;btn.textContent='⏳ Scanning…'}
  if(badge)badge.textContent='…';
  try{
    const paths=[];FILEMAP.forEach((v,k)=>paths.push(k));
    const branch=(S.repo&&S.repo.default_branch)||'main';
    const plans=[{f:'package.json',label:'npm',eco:'npm'},{f:'requirements.txt',label:'pip',eco:'PyPI'},{f:'pyproject.toml',label:'pyproject',eco:'PyPI'},{f:'Cargo.toml',label:'Cargo',eco:'crates.io'},{f:'go.mod',label:'Go modules',eco:'Go'}];
    const ecoDeps={};
    for(const pl of plans){
      const hit=paths.find(p=>p===pl.f||p.endsWith('/'+pl.f));
      if(!hit)continue;
      try{
        const r=await fetch(rawUrl((S.repo&&S.repo.full_name),branch,hit));
        if(!r.ok)continue;
        const deps=parseDepsFromManifest(pl.label,await r.text()).slice(0,100);
        if(deps.length)ecoDeps[pl.eco]=(ecoDeps[pl.eco]||[]).concat(deps);
      }catch(e){}
    }
    const entries=[];
    Object.keys(ecoDeps).forEach(eco=>{ecoDeps[eco].forEach(name=>entries.push({name,eco}))});
    if(!entries.length){
      el.innerHTML='<p style="color:var(--text3);font-size:12px">No supported manifest files (package.json, requirements.txt, pyproject.toml, Cargo.toml, go.mod) found in the tree.</p>';
      if(badge)badge.textContent='0';
      if(btn){btn.disabled=false;btn.textContent='🛡️ Scan dependencies'}
      return;
    }
    const results=entries.map(()=>[]);
    const CHUNK=100;
    for(let i=0;i<entries.length;i+=CHUNK){
      const chunk=entries.slice(i,i+CHUNK);
      const resp=await fetch('https://api.osv.dev/v1/querybatch',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({queries:chunk.map(e=>({package:{name:e.name,ecosystem:e.eco}}))})
      });
      if(!resp.ok)throw new Error('OSV API '+resp.status);
      const data=await resp.json();
      ((data&&data.results)||[]).forEach((r,j)=>{
        const idx=i+j;
        if(r&&Array.isArray(r.vulns))results[idx]=r.vulns.map(v=>v.id||'');
      });
    }
    let vulnerable=0,vulnList=[];
    entries.forEach((e,i)=>{
      if(results[i].length){vulnerable++;vulnList.push({name:e.name,eco:e.eco,count:results[i].length,sample:results[i].slice(0,3)})}
    });
    S.deep.osv={total:entries.length,vulnerable,vulnList:vulnList.slice(0,12),ecos:Object.keys(ecoDeps)};
    renderOsv(S.deep.osv);
  }catch(e){
    el.innerHTML='<p style="color:var(--red);font-size:12px">Scan failed: '+esc(e.message||'error')+'</p>';
    if(badge)badge.textContent='!';
  }finally{
    if(btn){btn.disabled=false;btn.textContent='🛡️ Scan dependencies'}
  }
}
function renderOsv(d){
  const el=$('#osvContent'),badge=$('#osvBadge');
  if(badge)badge.textContent=d.vulnerable+'/'+d.total;
  const color=d.vulnerable===0?'var(--green)':d.vulnerable<4?'var(--yellow)':'var(--red)';
  el.innerHTML=
    '<div class="kv"><span>Dependencies scanned</span><b>'+d.total+' (via OSV.dev)</b></div>'+
    '<div class="kv"><span>Packages with known advisories</span><b style="color:'+color+'">'+d.vulnerable+'</b></div>'+
    (d.vulnList.length?'<div style="margin-top:10px;font-size:11px;color:var(--text3)">Flagged packages</div>'+
      d.vulnList.map(v=>'<div class="kv"><span>'+esc(v.name)+' <span style="color:var(--text3)">('+esc(v.eco)+')</span></span><b style="color:var(--red)">'+v.count+' advisory'+(v.count>1?'ies':'')+'</b></div>').join(''):'')+
    '<p style="color:var(--text3);font-size:11px;margin-top:8px">Advisory counts include all severities. Verify details on <a href="https://osv.dev/list" target="_blank" rel="noopener">osv.dev</a> before acting — version pinning info is not sent in this batch scan.</p>';
  if(d.vulnerable)toast(d.vulnerable+' packages have known advisories','err');
}

/* ============================================================
   Digest upgrades — presets, output formats, model context,
   signatures-only mode
   ============================================================ */
const DIGEST_PRESETS={
  general:{label:'General',task:'You are given the source of a software repository. Use this context to answer questions about the codebase accurately and concisely.'},
  review:{label:'Code review',task:'You are a senior code reviewer. Analyze the repository below: flag bugs, security issues, performance problems, and style violations. Suggest concrete improvements with file references. Structure the review by severity (critical / major / minor).'},
  learn:{label:'Learn codebase',task:'You are a senior engineer mentoring a new team member. Explain the repository below: architecture, main modules and how they interact, entry points, data flow, and key design patterns. Suggest a reading order for the files.'},
  migrate:{label:'Migration',task:'You are a migration expert. Analyze the repository below and produce a migration plan: inventory of frameworks and versions, dependency risks, suggested target stack, step-by-step migration phases, and a risk assessment.'},
  docs:{label:'Docs writing',task:'You are a technical writer. Using the repository below, draft up-to-date documentation: a README outline, API reference from exported functions/routes, and a getting-started guide. Match the tone to the existing docs.'}
};
/* Custom preset task is resolved dynamically from localStorage */
function digestTask(){
  if(digestPreset==='custom')return LS.get(CUSTOM_TASK_KEY,'')||'You are given the source of a software repository. Use this context to answer questions about the codebase accurately and concisely.';
  return (DIGEST_PRESETS[digestPreset]||DIGEST_PRESETS.general).task;
}
function digestTaskLabel(){
  if(digestPreset==='custom')return'Custom';
  return (DIGEST_PRESETS[digestPreset]||DIGEST_PRESETS.general).label;
}
const DIGEST_FORMATS=['md','xml','json'];
let digestPreset=LS.get('repodest_preset','general');
let digestFormat=LS.get('repodest_format','md');
let sigOnly=LS.get('repodest_sigonly',false);
const MODEL_CTX={gpt5:128000,claude:200000,gemini:1000000,llama:8000};
const MODEL_CHARS_PER_TOK={gpt5:4,claude:3.6,gemini:3.8,llama:4.2};

function selectDigestPreset(p){
  if(p!=='custom'&&!DIGEST_PRESETS[p])return;
  digestPreset=p;LS.set('repodest_preset',p);
  $$('.rec-btn[data-preset]').forEach(b=>b.classList.toggle('preset-sel',b.dataset.preset===p));
  toast('Preset: '+digestTaskLabel(),'ok');
  if(p==='custom')editCustomTask();
}
function selectDigestFormat(f){
  if(!DIGEST_FORMATS.includes(f))return;
  digestFormat=f;LS.set('repodest_format',f);
  $$('.rec-btn[data-format]').forEach(b=>b.classList.toggle('preset-sel',b.dataset.format===f));
  toast('Output format: '+f.toUpperCase(),'ok');
}
function toggleSigOnly(){
  sigOnly=!sigOnly;LS.set('repodest_sigonly',sigOnly);
  const b=$('#sigBtn');if(b)b.classList.toggle('preset-sel',sigOnly);
  toast(sigOnly?'Signatures-only mode ON':'Signatures-only mode OFF','ok');
}
function initDigestControls(){
  $$('.rec-btn[data-preset]').forEach(b=>b.classList.toggle('preset-sel',b.dataset.preset===digestPreset));
  $$('.rec-btn[data-format]').forEach(b=>b.classList.toggle('preset-sel',b.dataset.format===digestFormat));
  const sb=$('#sigBtn');if(sb)sb.classList.toggle('preset-sel',sigOnly);
}

/* ============================================================
   Contextual help chips — a "?" next to key UI sections that
   reveals an explanation popover on click.
   ============================================================ */
const HELP_TEXTS={
  health:'Health Score rates the repository on 10 weighted criteria — license, README, tests, CI, docs, freshness and more. 80+ means excellent project hygiene.',
  files:'Browse the repository tree and tick the checkboxes of the files you want in your LLM prompt. Use the toolbar to select all text files at once, filter by name, or scope to a subfolder.',
  digest:'The LLM Digest packs your selected files into one prompt you can paste into ChatGPT, Claude or Gemini. Pick a preset to get task-specific instructions, then hit Generate. Everything stays in your browser.',
  token:'Token estimates are per-model approximations. Switch models to see how the digest fits their context window — if it overflows, the digest is automatically split into parts.',
  deep:'Deep Analysis goes beyond the health score: PR analytics, fix-vs-feature commit ratio, code churn hotspots and a dependency vulnerability scan via OSV.dev. Click each card to run it.',
  battle:'Battle compares two repos metric by metric and highlights the winner. Battle Royale runs a single-elimination tournament for up to 8 repos.',
  tokenModal:'Without a token you get 60 GitHub API calls per hour. A free personal access token raises that to 5,000/hour and is stored only in your browser.',
  langs:'Byte-accurate language breakdown computed from the GitHub languages API. The doughnut chart shows the top 10 languages.',
  treeTools:'Expand/collapse folders, select all text files, copy the tree as text, filter by name, or scope a monorepo to a single subfolder.',
  badge:'Generate a health-score badge for your project README: a static SVG with the baked score, or a dynamic shields.io badge.',
  wrapped:'A fun 12-month story of this repository: commit rhythm, peak week, top contributor and star grade.'
};
function helpChip(topic){
  return '<button class="help-chip" data-help="'+topic+'" title="What is this?" aria-label="Help: '+topic+'">?</button>';
}
function toggleHelpPopover(btn){
  const existing=document.querySelector('.help-popover');
  if(existing){
    const same=existing._chip===btn;
    existing.remove();
    if(same)return;
  }
  const pop=document.createElement('div');
  pop.className='help-popover';
  pop.textContent=HELP_TEXTS[btn.dataset.help]||'No help available.';
  pop._chip=btn;
  document.body.appendChild(pop);
  const r=btn.getBoundingClientRect();
  const pw=Math.min(320,innerWidth-24);
  pop.style.width=pw+'px';
  let left=Math.min(Math.max(8,r.left+r.width/2-pw/2),innerWidth-pw-8);
  let top=r.bottom+8;
  pop.style.left=left+'px';
  pop.style.top=top+'px';
  const pr=pop.getBoundingClientRect();
  if(pr.bottom>innerHeight-8)top=Math.max(8,r.top-pr.height-8);
  pop.style.top=top+'px';
}
document.addEventListener('click',e=>{
  const chip=e.target.closest('.help-chip');
  if(chip){e.preventDefault();e.stopPropagation();toggleHelpPopover(chip);return}
  const pop=document.querySelector('.help-popover');
  if(pop&&!pop.contains(e.target))pop.remove();
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){const pop=document.querySelector('.help-popover');if(pop)pop.remove()}
});
document.addEventListener('DOMContentLoaded',()=>{
  $$('.help-slot').forEach(slot=>{
    const topic=slot.dataset.help;
    if(!topic||!HELP_TEXTS[topic])return;
    slot.innerHTML='<button class="help-chip" data-help="'+topic+'" aria-label="What is this?">?</button>';
  });
});

/* Strip bodies from source code, keeping signatures, types & comments */
function extractSignatures(src,ext){
  const keepExt=['js','ts','jsx','tsx','mjs','cjs','py','java','cs','go','rs','rb','php','c','h','cpp','hpp','kt','swift','dart','lua','scala'];
  if(!keepExt.includes(ext))return src;
  const lines=src.split('\n');
  const out=[];let skipDepth=0,blockComment=false;
  const isPy=ext==='py';
  for(let i=0;i<lines.length;i++){
    const line=lines[i],trimmed=line.trim();
    if(blockComment){
      out.push(line);
      if(trimmed.includes('*/'))blockComment=false;
      continue;
    }
    if(trimmed.startsWith('/*')){
      out.push(line);
      if(!trimmed.includes('*/'))blockComment=true;
      continue;
    }
    if(trimmed.startsWith('#')||trimmed.startsWith('//')){out.push(line);continue}
    if(isPy){
      if(/(async\s+)?def\s|@/.test(line)){
        out.push(line);
        const indent=line.match(/^\s*/)[0];
        let j=i+1;
        while(j<lines.length&&!lines[j].trim())j++;
        if(j<lines.length&&(lines[j].startsWith(indent+'  ')||lines[j].startsWith(indent+'\t')||(indent===''&&/^\s/.test(lines[j])))){
          i=j-1;out.push(indent+'    …');
        }
        continue;
      }
      out.push(line);continue;
    }
    if(skipDepth>0){
      for(const ch of line){
        if(ch==='{')skipDepth++;
        else if(ch==='}')skipDepth--;
      }
      if(skipDepth<=0){skipDepth=0;out.push((line.match(/^\s*/)||[''])[0]+'}')}
      continue;
    }
    const open=(line.match(/\{/g)||[]).length,close=(line.match(/\}/g)||[]).length;
    const isDecl=/\b(class|function|fn|func|interface|struct|impl|enum|extension)\b/.test(line)||/^\s*(export\s+)?(default\s+)?(async\s+)?[A-Za-z_$][\w$]*\s*\([^;{}]*\)\s*\{?\s*$/.test(line);
    if(isDecl){
      out.push(line);
      if(open>close){skipDepth=open-close;out.push((line.match(/^\s*/)||[''])[0]+'  …')}
      continue;
    }
    if(/^(import|export\s+default|package|using|namespace|mod|use|from|@)/.test(trimmed)||trimmed===''){
      out.push(line);continue;
    }
    if(/^\s*(public|private|protected|static|final|abstract|override|async|const|let|var|type)/.test(line)&&/[(;=]/.test(line)&&trimmed.length<200){out.push(line);continue}
  }
  const dedup=[];
  for(const l of out){
    if(dedup.length>1&&dedup[dedup.length-1]==='  …'&&l==='  …')continue;
    dedup.push(l);
  }
  return dedup.join('\n').replace(/\n{3,}/g,'\n\n');
}

function buildDigestHeader(m,branch,partLabel){
  if(digestFormat==='xml'){
    return ['# Repository Context','<repository name="'+esc(m&&m.full_name)+'" platform="'+esc(S.platform||'github')+'" branch="'+esc(branch)+'">',
      '  <meta>','    <description>'+esc(m&&m.description)+'</description>','    <language>'+esc(m&&m.language)+'</language>',
      '    <stars>'+fmt(m&&m.stargazers_count)+'</stars>','    <forks>'+fmt(m&&m.forks_count)+'</forks>',
      '    <license>'+(m&&m.license?esc(m.license.spdx_id):'none')+'</license>','    <generated>'+new Date().toISOString().slice(0,10)+'</generated>',
      '  </meta>','  <task>'+esc(digestTask())+'</task>',
      partLabel?'  <part>'+esc(partLabel)+'</part>':''].filter(Boolean).join('\n');
  }
  if(digestFormat==='json'){
    return ['{','  "repository": "'+(m&&m.full_name)+'",','  "platform": "'+(S.platform||'github')+'",','  "branch": "'+branch+'",',
      '  "meta": '+JSON.stringify({description:m&&m.description,primary_language:m&&m.language,stars:m&&m.stargazers_count,forks:m&&m.forks_count,license:m&&m.license?m.license.spdx_id:null,generated:new Date().toISOString().slice(0,10),part:partLabel||null})+',',
      '  "task": '+JSON.stringify(digestTask())+','].join('\n');
  }
  return ['# Repository Context: '+(m&&m.full_name),
    'Source: '+(m&&m.html_url),'Platform: '+(S.platform||'github'),'Branch: '+branch,
    'Description: '+(m&&m.description||'N/A'),'Primary language: '+(m&&m.language||'N/A'),
    'Stars: '+fmt(m&&m.stargazers_count)+' · Forks: '+fmt(m&&m.forks_count)+' · License: '+(m&&m.license?m.license.spdx_id:'none'),
    'Generated by Repodest on '+new Date().toISOString().slice(0,10),
    partLabel?'Part: '+partLabel:'',
    '','## Task',''+digestTask()].filter(l=>l!=='').join('\n');
}

function wrapFileSection(p,ext,content){
  if(digestFormat==='xml')return '  <file path="'+esc(p)+'">\n<![CDATA[\n'+content+'\n]]>\n  </file>';
  if(digestFormat==='json')return '    '+JSON.stringify({path:p,content})+',';
  return '\n# File: '+p+'\n\n````'+ext+'\n'+content+'\n````';
}

function finalizeDigestFooter(parts){
  if(digestFormat==='xml')parts.push('</repository>');
  else if(digestFormat==='json'){
    let s=parts.join('\n');
    if(s.endsWith(','))s=s.slice(0,-1);
    parts.length=0;
    parts.push(s,'\n}');
    return;
  }
  parts.push('\n---\nEnd of repository digest. Use this context to answer questions about the codebase.');
}

document.addEventListener('DOMContentLoaded',()=>{initDigestControls();updateSelMeta()});
(function(){const old=toggleHelpPopover;toggleHelpPopover=function(btn){const el=document.createElement('div');el.className='help-popover';el.textContent=window.__helpTopic?window.__helpTopic(btn.dataset.help):HELP_TEXTS[btn.dataset.help]||'No help available.';const ex=document.querySelector('.help-popover');if(ex){const same=ex._chip===btn;ex.remove();if(same)return}el._chip=btn;document.body.appendChild(el);const r=btn.getBoundingClientRect();const pw=Math.min(320,innerWidth-24);el.style.width=pw+'px';let left=Math.min(Math.max(8,r.left+r.width/2-pw/2),innerWidth-pw-8);let top=r.bottom+8;el.style.left=left+'px';el.style.top=top+'px';const pr=el.getBoundingClientRect();if(pr.bottom>innerHeight-8)top=Math.max(8,r.top-pr.height-8);el.style.top=top+'px'}})();

/* ============================================================
   UX upgrades — Command Palette, Chart PNG export,
   PWA install prompt, offline banner
   ============================================================ */

/* ---------- Command Palette (Ctrl+K) ---------- */
function cmdActions(){
  const actions=[
    {icon:'🩺',label:'Go to Overview',kw:'tab overview home',run:()=>switchTab('overview')},
    {icon:'📊',label:'Go to Languages',kw:'tab languages chart',run:()=>switchTab('languages')},
    {icon:'🗂️',label:'Go to Files',kw:'tab files tree',run:()=>switchTab('files')},
    {icon:'🤖',label:'Go to Digest',kw:'tab digest prompt llm',run:()=>switchTab('digest')},
    {icon:'📈',label:'Go to Activity',kw:'tab activity commits',run:()=>switchTab('activity')},
    {icon:'🏆',label:'Go to Fun',kw:'tab fun trophies roast',run:()=>switchTab('fun')},
    {icon:'🔗',label:'Go to Deps',kw:'tab deps dependencies',run:()=>switchTab('deps')},
    {icon:'🔬',label:'Go to Deep Analysis',kw:'tab deep pr osv churn',run:()=>switchTab('deep')},
    {icon:'🌙',label:'Toggle theme',kw:'dark light theme',run:()=>toggleTheme()},
    {icon:'🌐',label:'Switch language',kw:'language i18n fa en es zh fr ar de',run:()=>toggleLangMenu()},
    {icon:'🔑',label:'Set GitHub token',kw:'token pat api',run:()=>openModal()},
    {icon:'⚔️',label:'Repo Battle',kw:'battle compare versus',run:()=>openBattle()},
    {icon:'📸',label:'Share card',kw:'share card png image',run:()=>shareCard()},
    {icon:'📄',label:'Print report',kw:'print report pdf',run:()=>printReport()},
    {icon:'🔗',label:'Copy deep link',kw:'link copy url share',run:()=>copyLink()},
    {icon:'📦',label:'Export JSON',kw:'export json data',run:()=>exportJSON()},
    {icon:'📊',label:'Export CSV',kw:'export csv data',run:()=>exportCSV()},
    {icon:'🧊',label:'Export language chart (PNG)',kw:'export chart png image',run:()=>exportChartPNG('langChart','languages')},
    {icon:'📈',label:'Export activity chart (PNG)',kw:'export chart png image',run:()=>exportChartPNG('actChart','activity')},
    {icon:'🏠',label:'Go home',kw:'home landing reset',run:()=>goHome()},
    {icon:'❓',label:'Keyboard shortcuts',kw:'shortcuts help keys',run:()=>showShortcuts()},
    {icon:'🔖',label:'Bookmarklet (open any GitHub repo here)',kw:'bookmarklet bookmark drag github',run:()=>showBookmarklet()}
  ];
  const hist=LS.get('repodest_history',[]);
  (Array.isArray(hist)?hist:[]).slice(0,6).forEach(h=>{
    if(h&&h.full_name)actions.push({icon:'🕘',label:'Open '+h.full_name,kw:'recent history '+h.full_name,run:()=>loadRepoFromHistory(h.full_name,h.platform||'github')});
  });
  getFavorites().slice(0,8).forEach(f=>{
    actions.push({icon:'⭐',label:'Open '+f.full_name+' (favorite)',kw:'favorite starred '+f.full_name,run:()=>openFavorite(f.full_name,f.platform||'github')});
  });
  return actions;
}
let cmdPaletteBg=null,cmdPaletteInput=null,cmdPaletteList=null,cmdSelIdx=0,cmdFiltered=[];
function ensureCmdPalette(){
  if(cmdPaletteBg)return;
  cmdPaletteBg=document.createElement('div');
  cmdPaletteBg.className='modal-bg hidden';
  cmdPaletteBg.style.cssText='align-items:flex-start;padding-top:12vh';
  cmdPaletteBg.innerHTML='<div class="modal" style="width:min(520px,94vw);padding:0;overflow:hidden">'+
    '<input id="cmdInput" type="text" placeholder="Type a command…" spellcheck="false" style="width:100%;padding:14px 16px;border:none;outline:none;background:transparent;color:var(--text);font-size:15px;border-bottom:1px solid var(--line)">'+
    '<div id="cmdList" style="max-height:46vh;overflow:auto"></div>'+
    '</div>';
  document.body.appendChild(cmdPaletteBg);
  cmdPaletteInput=cmdPaletteBg.querySelector('#cmdInput');
  cmdPaletteList=cmdPaletteBg.querySelector('#cmdList');
  cmdPaletteBg.addEventListener('click',e=>{if(e.target===cmdPaletteBg)closeCommandPalette()});
  cmdPaletteInput.addEventListener('input',()=>renderCmdList());
  cmdPaletteInput.addEventListener('keydown',e=>{
    if(e.key==='Escape'){closeCommandPalette();return}
    if(e.key==='ArrowDown'){e.preventDefault();cmdSelIdx=Math.min(cmdSelIdx+1,cmdFiltered.length-1);renderCmdList(false);return}
    if(e.key==='ArrowUp'){e.preventDefault();cmdSelIdx=Math.max(cmdSelIdx-1,0);renderCmdList(false);return}
    if(e.key==='Enter'){e.preventDefault();const a=cmdFiltered[cmdSelIdx];if(a){closeCommandPalette();a.run()}}
  });
}
function openCommandPalette(){
  if(!cmdActions().length)return;
  ensureCmdPalette();
  cmdPaletteBg.classList.remove('hidden');
  cmdPaletteInput.value='';
  cmdSelIdx=0;
  renderCmdList();
  setTimeout(()=>cmdPaletteInput.focus(),30);
}
function closeCommandPalette(){
  if(cmdPaletteBg)cmdPaletteBg.classList.add('hidden');
}
function renderCmdList(resetScroll=true){
  const q=(cmdPaletteInput.value||'').toLowerCase().trim();
  const all=cmdActions();
  cmdFiltered=q?all.filter(a=>(a.label+' '+a.kw).toLowerCase().includes(q)):all;
  if(cmdSelIdx>=cmdFiltered.length)cmdSelIdx=Math.max(0,cmdFiltered.length-1);
  cmdPaletteList.innerHTML=cmdFiltered.length?cmdFiltered.map((a,i)=>
    '<div class="cmd-item'+(i===cmdSelIdx?' sel':'')+'" data-i="'+i+'" style="display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;font-size:13.5px;color:var(--text2);'+(i===cmdSelIdx?'background:var(--card2);color:var(--text)':'')+'">'+
    '<span style="font-size:16px">'+a.icon+'</span><span>'+esc(a.label)+'</span></div>'
  ).join(''):'<div style="padding:16px;color:var(--text3);font-size:13px">No matching commands</div>';
  if(resetScroll)cmdPaletteList.scrollTop=0;
  $$('#cmdList .cmd-item').forEach(el=>{
    el.addEventListener('click',()=>{
      const a=cmdFiltered[Number(el.dataset.i)];
      closeCommandPalette();
      if(a)a.run();
    });
    el.addEventListener('mousemove',()=>{
      const i=Number(el.dataset.i);
      if(i!==cmdSelIdx){cmdSelIdx=i;renderCmdList(false)}
    });
  });
}

/* ---------- Chart PNG export ---------- */
function exportChartPNG(canvasId,label){
  const src=$(canvasId?'#'+canvasId:null)||document.getElementById(canvasId);
  if(!src){toast('Chart not found — open its tab first','err');return}
  const out=document.createElement('canvas');
  out.width=src.width||src.offsetWidth||600;
  out.height=src.height||src.offsetHeight||300;
  const ctx=out.getContext('2d');
  const isLight=document.body.classList.contains('light');
  ctx.fillStyle=isLight?'#ffffff':'#12121f';
  ctx.fillRect(0,0,out.width,out.height);
  try{ctx.drawImage(src,0,0)}catch(e){toast('Export failed','err');return}
  const a=document.createElement('a');
  a.href=out.toDataURL('image/png');
  a.download=((S.repo&&S.repo.full_name)||'repo').replace('/','-')+'-'+label+'.png';
  a.click();
  toast('Chart exported as PNG','ok');
}

/* ---------- PWA install prompt + offline banner ---------- */
let deferredInstall=null;
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  deferredInstall=e;
  showInstallChip();
});
function showInstallChip(){
  if($('#pwaInstallBtn'))return;
  const header=$('.hwrap');
  if(!header)return;
  const btn=document.createElement('button');
  btn.className='chip-lite';
  btn.id='pwaInstallBtn';
  btn.title='Install Repodest as an app';
  btn.innerHTML='⬇️ <span>Install</span>';
  btn.onclick=async()=>{
    if(!deferredInstall)return;
    deferredInstall.prompt();
    const choice=await deferredInstall.userChoice;
    if(choice&&choice.outcome==='accepted')toast('Repodest installed 🎉','ok');
    deferredInstall=null;btn.remove();
  };
  header.insertBefore(btn,header.querySelector('.theme-toggle'));
}
window.addEventListener('appinstalled',()=>{
  deferredInstall=null;
  const b=$('#pwaInstallBtn');if(b)b.remove();
  toast('Repodest installed 🎉','ok');
});
function updateOfflineBanner(){
  let banner=$('#offlineBanner');
  if(!navigator.onLine){
    if(!banner){
      banner=document.createElement('div');
      banner.id='offlineBanner';
      banner.style.cssText='position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:200;background:#7c2d12;border:1px solid #ea580c;color:#fed7aa;padding:8px 16px;border-radius:99px;font-size:12.5px;font-weight:600;box-shadow:0 6px 24px rgba(0,0,0,.4)';
      banner.textContent='⚠️ Offline — cached pages still work, API calls need connection';
      document.body.appendChild(banner);
    }
  }else if(banner)banner.remove();
}
addEventListener('online',()=>{updateOfflineBanner();toast('Back online','ok')});
addEventListener('offline',updateOfflineBanner);
updateOfflineBanner();

/* ============================================================
   Favorites — starred repos with quick access
   ============================================================ */
const FAV_KEY='repodest_favorites';
function getFavorites(){
  const f=LS.get(FAV_KEY,[]);
  return Array.isArray(f)?f:[];
}
function isFavorite(fullName){
  return getFavorites().some(f=>f.full_name===fullName);
}
function toggleFavorite(){
  const m=S.repo;
  if(!m||!m.full_name){toast('Load a repository first','err');return}
  let favs=getFavorites();
  if(isFavorite(m.full_name)){
    favs=favs.filter(f=>f.full_name!==m.full_name);
    toast('Removed from favorites');
  }else{
    favs.unshift({full_name:m.full_name,name:m.name||m.full_name,avatar:(m.owner&&m.owner.avatar_url)||'',platform:m._platform||S.platform||'github',ts:Date.now()});
    favs=favs.slice(0,12);
    toast('Added to favorites ⭐','ok');
  }
  LS.set(FAV_KEY,favs);
  updateFavBtn();
  renderFavorites();
}
function clearFavorites(){
  LS.set(FAV_KEY,[]);
  renderFavorites();
  toast('Favorites cleared');
}
function updateFavBtn(){
  const m=S.repo;
  const on=m&&m.full_name&&isFavorite(m.full_name);
  const btn=$('#favBtn'),label=$('#favLabel');
  if(btn)btn.style.opacity=on?'1':'';
  if(btn)btn.style.borderColor=on?'var(--accent)':'';
  if(label)label.textContent=on?'Faved':'Fav';
}

/* ---------- Collapsible "more tools" (mobile-first toolbar) ---------- */
function toggleMoreTools(){
  const panel=$('#moreTools'),btn=$('#moreBtn');
  if(!panel||!btn)return;
  const open=panel.classList.toggle('open');
  btn.setAttribute('aria-expanded',open?'true':'false');
  btn.textContent=open?'✕':'⋯';
}
function renderFavorites(){
  const section=$('#favSection'),grid=$('#favGrid');
  if(!section||!grid)return;
  const favs=getFavorites();
  if(!favs.length){section.style.display='none';return}
  section.style.display='';
  grid.innerHTML=favs.map(f=>
    '<div class="hcard" onclick="openFavorite(\''+esc(f.full_name)+'\',\''+esc(f.platform||'github')+'\')">'+
      '<img src="'+esc(f.avatar)+'" alt="" loading="lazy" onerror="this.style.display=\'none\'">'+
      '<div class="hc-name">'+esc(f.name||f.full_name)+'</div>'+
      '<div class="hc-score">⭐</div>'+
    '</div>'
  ).join('');
}
async function openFavorite(fullName,platform){
  if(platform==='gitlab'||platform==='bitbucket'){loadRepo(fullName.split('/')[0],fullName.split('/').slice(1).join('/'),platform);return}
  if(platform==='ghe'){
    const parts=fullName.split('/');
    loadRepo(parts[0],parts.slice(1).join('/'),'ghe');
    return;
  }
  const parts=fullName.split('/');
  loadRepo(parts[0],parts.slice(1).join('/'),'github');
}

/* Keep fav button in sync whenever a repo renders */
document.addEventListener('DOMContentLoaded',()=>{
  renderFavorites();
  const _origRenderDashFav=renderDash;
  renderDash=function(){_origRenderDashFav();try{updateFavBtn()}catch(e){}};
});

/* ============================================================
   Branch Diff — compare current ref with another branch/tag
   ============================================================ */
function toggleDiffPanel(){
  const panel=$('#diffPanel');
  if(!panel)return;
  const showNow=panel.classList.contains('hidden');
  panel.classList.toggle('hidden',!showNow);
  if(!showNow)return;
  const sel=$('#diffTarget');
  if(!sel)return;
  const current=S.currentBranch||(S.repo&&S.repo.default_branch)||'main';
  const options=[];
  S.branches.forEach(b=>{if(b.name&&b.name!==current)options.push(b.name)});
  S.tags.forEach(t=>{if(t.name)options.push(t.name)});
  sel.innerHTML='<option value="">— choose —</option>'+options.map(o=>'<option value="'+esc(o)+'">'+esc(o)+'</option>').join('');
  $('#diffBaseLabel').textContent=current;
  $('#diffContent').innerHTML='';
}
async function loadBranchDiff(){
  const m=S.repo;
  const target=($('#diffTarget')||{}).value||'';
  const host=$('#diffContent');
  if(!m||!m.full_name||!target){toast('Pick a branch or tag to compare','err');return}
  if(S.platform!=='github'&&S.platform!=='ghe'){toast('Diff works on GitHub repos','err');return}
  const base=S.currentBranch||(m.default_branch||'main');
  host.innerHTML='<p style="color:var(--text3);font-size:12px">⏳ Comparing…</p>';
  try{
    const cmp=await api('/repos/'+m.full_name+'/compare/'+encodeURIComponent(base)+'...'+encodeURIComponent(target));
    const files=cmp.files||[];
    const totalCommits=cmp.total_commits||0;
    const additions=files.reduce((a,f)=>a+(f.additions||0),0);
    const deletions=files.reduce((a,f)=>a+(f.deletions||0),0);
    const newFiles=files.filter(f=>f.status==='added').length;
    const removedFiles=files.filter(f=>f.status==='removed').length;
    const modified=files.filter(f=>f.status==='modified').length;
    const renamed=files.filter(f=>f.status==='renamed').length;
    const byDir={};
    files.forEach(f=>{
      const parts=(f.filename||'').split('/');
      const dir=parts.length>1?parts[0]:'/';
      byDir[dir]=(byDir[dir]||0)+1;
    });
    const topDirs=Object.entries(byDir).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const statusColor=s=>s==='added'?'#22c55e':s==='removed'?'#ef4444':s==='renamed'?'#eab308':'#22d3ee';
    const ahead=cmp.ahead_by!=null?cmp.ahead_by+' ahead':'';
    const behind=cmp.behind_by!=null?cmp.behind_by+' behind':'';
    host.innerHTML=
      '<div class="statrow" style="flex-wrap:wrap;gap:10px;margin-bottom:10px">'+
        '<div class="st"><b>'+totalCommits+'</b><span>commits</span></div>'+
        '<div class="st"><b style="color:#4ade80">+'+fmt(additions)+'</b><span>additions</span></div>'+
        '<div class="st"><b style="color:#f87171">−'+fmt(deletions)+'</b><span>deletions</span></div>'+
        '<div class="st"><b>'+files.length+'</b><span>files</span></div>'+
        (ahead||behind?'<div class="st"><b>'+esc([ahead,behind].filter(Boolean).join(' · '))+'</b><span>position</span></div>':'')+
      '</div>'+
      '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--text2);margin-bottom:10px">'+
        '<span style="color:#4ade80">■ '+newFiles+' added</span>'+
        '<span style="color:#f87171">■ '+removedFiles+' removed</span>'+
        '<span style="color:#22d3ee">■ '+modified+' modified</span>'+
        (renamed?'<span style="color:#eab308">■ '+renamed+' renamed</span>':'')+
      '</div>'+
      (topDirs.length?'<div style="font-size:11px;color:var(--text3);margin-bottom:6px">Most affected areas</div><div class="topicrow" style="margin-bottom:10px">'+topDirs.map(d=>'<span class="topic">'+esc(d[0])+' ×'+d[1]+'</span>').join('')+'</div>':'')+
      '<div style="max-height:260px;overflow:auto">'+
        files.slice(0,60).map(f=>{
          const short=f.filename.length>44?'…'+f.filename.slice(-43):f.filename;
          return '<div class="langrow"><span class="ln" style="width:46%" title="'+esc(f.filename)+'">'+esc(short)+'</span><span class="lb"><i style="width:'+Math.min(100,Math.max(3,Math.round((f.additions||0)/Math.max(1,f.additions||1)*100)))+'%;background:'+statusColor(f.status)+'"></i></span><span class="lp">+'+(f.additions||0)+' −'+(f.deletions||0)+'</span></div>';
        }).join('')+
        (files.length>60?'<div style="font-size:11px;color:var(--text3);margin-top:6px">…and '+(files.length-60)+' more files</div>':'')+
      '</div>';
  }catch(e){
    host.innerHTML='<p style="color:var(--red);font-size:12px">Diff failed: '+esc(e.message||'error')+' (branches may be unrelated)</p>';
  }
}

/* ============================================================
   Full-text search inside file contents (bounded fetch + cache)
   ============================================================ */
const FTS_CACHE={byRepo:null,results:null,query:''};
async function fullTextSearch(){
  const q=($('#ftsInput')&&$('#ftsInput').value||'').trim();
  const host=$('#ftsResults');
  if(!q){toast('Type something to search for','err');return}
  const needle=q.toLowerCase();
  if(FTS_CACHE.byRepo===S.repo.full_name&&FTS_CACHE.results&&FTS_CACHE.query===needle){
    renderFtsResults();
    return;
  }
  const paths=candidateFilesForSearch();
  if(!paths.length){toast('Load a repository first','err');return}
  host.style.display='';
  host.innerHTML='<p style="color:var(--text3);font-size:12px" id="ftsStatus">⏳ Scanning 0/'+paths.length+' files…</p>';
  const m=S.repo,branch=(m&&m.default_branch)||'main';
  const results=[];
  /* Fast path: Web Worker with inline fallback */
  let done=false;
  try{
    const workerBase=rawUrl((m&&m.full_name),branch,'').replace(/[^\/]+$/,'');
    const wk=await ftsScanWithWorker(paths,rawUrl((m&&m.full_name),branch,'').replace(/\/$/,''),needle);
    if(wk){
      results.push(...wk);
      done=true;
    }
  }catch(e){/* fall through to inline */}
  if(!done){
    let scanned=0;
    const CONCURRENCY=8;
    let idx=0;
    async function worker(){
      while(idx<paths.length){
        const p=paths[idx++];
        try{
          const r=await fetch(rawUrl((m&&m.full_name),branch,p));
          if(!r.ok)continue;
          const txt=await r.text();
          scanned++;
          const lower=txt.toLowerCase();
          const first=lower.indexOf(needle);
          if(first>=0){
            const lineNo=txt.slice(0,first).split('\n').length;
            const line=(txt.split('\n')[lineNo-1]||'').trim().slice(0,140);
            results.push({path:p,count:lower.split(needle).length-1,line:lineNo,snippet:line});
          }
          const st=$('#ftsStatus');
          if(st&&(scanned%12===0))st.textContent='⏳ Scanning '+scanned+'/'+paths.length+' files… '+results.length+' matches';
        }catch(e){/* skip */}
      }
    }
    const workers=[];
    for(let i=0;i<CONCURRENCY;i++)workers.push(worker());
    await Promise.all(workers);
  }
  results.sort((a,b)=>b.count-a.count);
  FTS_CACHE.byRepo=S.repo.full_name;
  FTS_CACHE.results=results;
  FTS_CACHE.query=needle;
  renderFtsResults();
}
function renderFtsResults(){
  const host=$('#ftsResults');
  if(!host)return;
  const results=FTS_CACHE.results||[];
  if(!results.length){
    host.innerHTML='<p style="color:var(--text3);font-size:12px">No matches in the '+candidateFilesForSearch().length+' scanned text files (&lt;120KB).</p>';
    return;
  }
  host.innerHTML=
    '<div style="font-size:11px;color:var(--text3);margin-bottom:8px">'+results.length+' matching files — click a result to select it for the digest</div>'+
    results.slice(0,25).map(r=>{
      const short=r.path.length>44?'…'+r.path.slice(-43):r.path;
      return '<div class="fts-row" data-path="'+esc(r.path)+'" onclick="ftsSelect(this.dataset.path)" style="cursor:pointer;border:1px solid var(--line);border-radius:10px;padding:8px 12px;margin-bottom:6px">'+
        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center">'+
          '<b style="font-family:var(--mono);font-size:12px">'+esc(short)+'</b>'+
          '<span class="ep-badge">'+r.count+'×</span>'+
        '</div>'+
        '<div style="font-family:var(--mono);font-size:11px;color:var(--text3);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">L'+r.line+': '+esc(r.snippet)+'</div>'+
      '</div>';
    }).join('')+
    (results.length>25?'<div style="font-size:11px;color:var(--text3)">…and '+(results.length-25)+' more</div>':'');
}
function ftsSelect(path){
  if(!path)return;
  if(S.sel.has(path)){S.sel.delete(path)}else{S.sel.add(path)}
  $$('#tree .fcb').forEach(cb=>cb.checked=S.sel.has(cb.dataset.path));
  updateSelMeta();
  toast((S.sel.has(path)?'Added to digest selection':'Removed from selection')+': '+path.split('/').pop(),'ok');
}
function resetFts(){
  FTS_CACHE.byRepo=null;FTS_CACHE.results=null;FTS_CACHE.query='';
  const host=$('#ftsResults');
  if(host){host.style.display='none';host.innerHTML=''}
  const inp=$('#ftsInput');
  if(inp)inp.value='';
}

/* ============================================================
   Web Worker pool — off-main-thread content scanning.
   Zero build step: worker code lives in a Blob.
   Used by: full-text search (FTS) — the heaviest per-file work.
   ============================================================ */
const FTS_WORKER_SRC=`
self.onmessage=async e=>{
  const {paths,base,needle}=e.data;
  const results=[];
  const CONCURRENCY=8;
  let idx=0;
  async function fetchOne(p){
    const r=await fetch(base+p);
    if(!r.ok)return;
    const txt=await r.text();
    const lower=txt.toLowerCase();
    const first=lower.indexOf(needle);
    if(first>=0){
      const lineNo=txt.slice(0,first).split('\\n').length;
      const line=(txt.split('\\n')[lineNo-1]||'').trim().slice(0,140);
      results.push({path:p,count:lower.split(needle).length-1,line:lineNo,snippet:line});
    }
  }
  async function worker(){
    while(idx<paths.length){
      const p=paths[idx++];
      try{await fetchOne(p)}catch(err){/* skip */}
    }
  }
  const pool=[];
  for(let i=0;i<CONCURRENCY;i++)pool.push(worker());
  await Promise.all(pool);
  self.postMessage({results});
};
`;
let _ftsWorkerUrl=null;
function ftsWorkerUrl(){
  if(!_ftsWorkerUrl)_ftsWorkerUrl=URL.createObjectURL(new Blob([FTS_WORKER_SRC],{type:'text/javascript'}));
  return _ftsWorkerUrl;
}
/* Returns results array via worker; falls back to inline scanning on failure */
async function ftsScanWithWorker(paths,rawBaseNoSlash,needle,onProgress){
  return new Promise(async resolve=>{
    let worker=null;
    try{
      worker=new Worker(ftsWorkerUrl());
      const timeout=setTimeout(()=>{try{worker.terminate()}catch(e){};resolve(null)},60000);
      worker.onmessage=e=>{
        clearTimeout(timeout);
        try{worker.terminate()}catch(err){}
        resolve((e.data&&e.data.results)||null);
      };
      worker.onerror=()=>{
        clearTimeout(timeout);
        try{worker.terminate()}catch(err){}
        resolve(null);
      };
      worker.postMessage({paths,base:rawBaseNoSlash+'/',needle});
    }catch(e){
      if(worker)try{worker.terminate()}catch(err){}
      resolve(null);
    }
  });
}

/* ============================================================
   i18n expansion — keys for the static chrome (data-i18n),
   Arabic + German languages, and localized help texts.
   Missing keys gracefully fall back to English via t().
   ============================================================ */
(function(){
  const X={
    en:{
      feat1Desc:'License, README, tests, CI, docs, freshness — 10 weighted checks distilled into one honest number.',
      feat2Desc:'The Gitingest trick, client-side. Select files, get a clean prompt with a token estimate.',
      feat3Desc:'Full tree visualizer with sizes, type distribution and the heaviest files in the repo.',
      feat4Desc:'Language bytes, dependency scan across 8 ecosystems, commit activity and top contributors.',
      feat5Desc:'Every repo gets a personality, a roast, and trophies — Wrapped-style, shareable as a card.',
      feat6Desc:'Deep links, PNG cards and a printable A4 report. Everything stays in your browser.',
      favorites:'⭐ Favorites',clearFavs:'Clear favorites',
      btnExportJson:'⬇️ JSON',btnExportCsv:'⬇️ CSV',btnDiff:'🔀 Diff',btnFav:'Fav',
      battleBtn:'⚔️ Battle!',royaleBtn:'🏆 Start tournament',close:'Close',
      copyBtn:'📋 Copy',dlBtn:'⬇️ Download .md',gistBtn:'🌐 Gist share',tokBtn:'🧮 Token breakdown',
      genBtn:'🤖 Generate digest',allTextBtn:'✓ All text files',
      expandAll:'📂 Expand all',collapseAll:'📁 Collapse all',selectText:'✓ Select text',
      clearSel:'✕ Clear',copyTree:'📋 Copy tree',hiddenBtn:'👁 Hidden',binaryBtn:'🧊 Binary',ftsBtn:'🔎 Search',
      branchLabel:'Branch:',tagLabel:'Tag:',
      help_health:'Health Score rates the repository on 10 weighted criteria — license, README, tests, CI, docs, freshness and more. 80+ means excellent project hygiene.',
      help_files:'Browse the repository tree and tick the checkboxes of the files you want in your LLM prompt. Use the toolbar to select all text files at once, filter by name, or scope to a subfolder.',
      help_digest:'The LLM Digest packs your selected files into one prompt you can paste into ChatGPT, Claude or Gemini. Pick a preset to get task-specific instructions, then hit Generate. Everything stays in your browser.',
      help_token:'Token estimates are per-model approximations. Switch models to see how the digest fits their context window — if it overflows, the digest is automatically split into parts.',
      help_deep:'Deep Analysis goes beyond the health score: PR analytics, fix-vs-feature commit ratio, code churn hotspots and a dependency vulnerability scan via OSV.dev.',
      help_deps:'An interactive force-directed graph of dependencies parsed from manifest files (package.json, requirements.txt, Cargo.toml, go.mod…).',
      help_tokenModal:'Without a token you get 60 GitHub API calls per hour. A free personal access token raises that to 5,000/hour and is stored only in your browser.',
      help_langs:'Byte-accurate language breakdown computed from the platform languages API. The doughnut chart shows the top 10 languages.',
      help_badge:'Generate a health-score badge for your project README: a static SVG with the baked score, or a dynamic shields.io badge.',
      help_wrapped:'A fun 12-month story of this repository: commit rhythm, peak week, top contributor and star grade.'
    },
    fa:{
      feat1Desc:'مجوز، README، تست‌ها، CI، مستندات و تازگی — ۱۰ بررسی وزن‌دار در یک عدد صادقانه.',
      feat2Desc:'ترفند Gitingest در مرورگر شما. فایل‌ها را انتخاب کنید و یک پرامپت تمیز با تخمین توکن بگیرید.',
      feat3Desc:'نمایش کامل درخت فایل با اندازه‌ها، توزیع نوع و سنگین‌ترین فایل‌های رپو.',
      feat4Desc:'بایت زبان‌ها، اسکن وابستگی در ۸ اکوسیستم، فعالیت کامیت‌ها و مشارکت‌کنندگان برتر.',
      feat5Desc:'هر رپو شخصیت، یک roast و جوایز می‌گیرد — به سبک Wrapped و قابل اشتراک.',
      feat6Desc:'لینک عمیق، کارت PNG و گزارش A4 قابل چاپ. همه‌چیز در مرورگر شما می‌ماند.',
      favorites:'⭐ علاقه‌مندی‌ها',clearFavs:'پاک کردن علاقه‌مندی‌ها',
      btnExportJson:'⬇️ JSON',btnExportCsv:'⬇️ CSV',btnDiff:'🔀 مقایسه',btnFav:'علاقه',
      battleBtn:'⚔️ نبرد!',royaleBtn:'🏆 شروع تورنمنت',close:'بستن',
      copyBtn:'📋 کپی',dlBtn:'⬇️ دانلود .md',gistBtn:'🌐 اشتراک Gist',tokBtn:'🧮 تفکیک توکن',
      genBtn:'🤖 تولید خلاصه',allTextBtn:'✓ همه فایل‌های متنی',
      expandAll:'📂 باز کردن همه',collapseAll:'📁 بستن همه',selectText:'✓ انتخاب متن‌ها',
      clearSel:'✕ پاک کردن',copyTree:'📋 کپی درخت',hiddenBtn:'👁 مخفی',binaryBtn:'🧊 باینری',ftsBtn:'🔎 جستجو',
      branchLabel:'شاخه:',tagLabel:'تگ:',
      help_health:'امتیاز سلامت رپو را روی ۱۰ معیار وزن‌دار می‌سنجد — مجوز، README، تست، CI، مستندات و تازگی. بالای ۸۰ یعنی بهداشت پروژه عالی.',
      help_files:'درخت رپو را بگردید و تیک فایل‌هایی که می‌خواهید در پرامپت LLM باشند را بزنید. با نوار ابزار می‌توانید همه فایل‌های متنی را یکجا انتخاب یا بر اساس نام فیلتر کنید.',
      help_digest:'دایجست LLM فایل‌های انتخابی شما را در یک پرامپت برای ChatGPT، Claude یا Gemini بسته‌بندی می‌کند. یک preset انتخاب کنید و Generate را بزنید. همه‌چیز در مرورگر شما می‌ماند.',
      help_token:'تخمین توکن برای هر مدل جداگانه است. مدل را عوض کنید تا ببینید دایجست در context window جا می‌شود یا نه — در صورت سرریز، دایجست خودکار به چند بخش تقسیم می‌شود.',
      help_deep:'تحلیل عمیق فراتر از امتیاز سلامت است: تحلیل PRها، نسبت کامیت‌های fix، نقاط داغ churn و اسکن آسیب‌پذیری وابستگی‌ها با OSV.dev.',
      help_deps:'نمودار تعاملی وابستگی‌ها که از فایل‌های manifest (package.json، requirements.txt، Cargo.toml، go.mod و…) استخراج می‌شود.',
      help_tokenModal:'بدون توکن ۶۰ درخواست GitHub در ساعت دارید. توکن رایگان personal access این را به ۵۰۰۰ در ساعت می‌رساند و فقط در مرورگر شما ذخیره می‌شود.',
      help_langs:'تفکیک دقیق بایتی زبان‌ها از API زبان‌های پلتفرم. نمودار دونات ۱۰ زبان اصلی را نشان می‌دهد.',
      help_badge:'برچسب امتیاز سلامت برای README پروژه بسازید: SVG استاتیک با نمره ثبت‌شده یا برچسب دینامیک shields.io.',
      help_wrapped:'داستان سرگرم‌کننده ۱۲ ماه این رپو: ریتم کامیت‌ها، هفته اوج، مشارکت‌کننده برتر و رتبه ستاره‌ها.'
    },
    es:{
      feat1Desc:'Licencia, README, tests, CI, docs, frescura — 10 verificaciones ponderadas en un número honesto.',
      feat2Desc:'El truco de Gitingest, en tu navegador. Selecciona archivos y obtén un prompt limpio con estimación de tokens.',
      feat3Desc:'Visualizador completo del árbol con tamaños, distribución de tipos y los archivos más pesados.',
      feat4Desc:'Bytes por idioma, escaneo de dependencias en 8 ecosistemas, actividad de commits y contribuidores.',
      feat5Desc:'Cada repo recibe personalidad, roast y trofeos — estilo Wrapped, compartible como tarjeta.',
      feat6Desc:'Enlaces profundos, tarjetas PNG y un informe A4 imprimible. Todo queda en tu navegador.',
      favorites:'⭐ Favoritos',clearFavs:'Borrar favoritos',
      btnExportJson:'⬇️ JSON',btnExportCsv:'⬇️ CSV',btnDiff:'🔀 Diff',btnFav:'Fav',
      battleBtn:'⚔️ ¡Batalla!',royaleBtn:'🏆 Iniciar torneo',close:'Cerrar',
      copyBtn:'📋 Copiar',dlBtn:'⬇️ Descargar .md',gistBtn:'🌐 Compartir Gist',tokBtn:'🧮 Desglose de tokens',
      genBtn:'🤖 Generar resumen',allTextBtn:'✓ Todos los archivos de texto',
      expandAll:'📂 Expandir todo',collapseAll:'📁 Colapsar todo',selectText:'✓ Seleccionar texto',
      clearSel:'✕ Limpiar',copyTree:'📋 Copiar árbol',hiddenBtn:'👁 Ocultos',binaryBtn:'🧊 Binarios',ftsBtn:'🔎 Buscar',
      branchLabel:'Rama:',tagLabel:'Tag:',
      help_health:'La Puntuación de Salud evalúa el repo en 10 criterios ponderados — licencia, README, tests, CI, docs, frescura y más. 80+ significa higiene excelente.',
      help_files:'Explora el árbol del repositorio y marca las casillas de los archivos para tu prompt LLM. Usa la barra de herramientas para seleccionar todos los archivos de texto o filtrar por nombre.',
      help_digest:'El Resumen LLM empaqueta tus archivos seleccionados en un prompt para ChatGPT, Claude o Gemini. Elige un preset y pulsa Generar. Todo queda en tu navegador.',
      help_token:'Las estimaciones de tokens son aproximaciones por modelo. Cambia de modelo para ver si el resumen cabe en su ventana de contexto — si se desborda, se divide en partes.',
      help_deep:'El Análisis Profundo va más allá del score: analítica de PRs, ratio de commits de fix, hotspots de churn y escaneo de vulnerabilidades vía OSV.dev.',
      help_deps:'Grafo interactivo de dependencias extraídas de los archivos manifest (package.json, requirements.txt, Cargo.toml, go.mod…).',
      help_tokenModal:'Sin token tienes 60 llamadas GitHub por hora. Un token personal gratuito lo sube a 5.000/hora y solo se guarda en tu navegador.',
      help_langs:'Desglose de idiomas preciso por bytes desde la API de la plataforma. El gráfico de dona muestra los 10 idiomas principales.',
      help_badge:'Genera una insignia de puntuación para el README: SVG estático con el score o insignia dinámica de shields.io.',
      help_wrapped:'La historia divertida de 12 meses de este repo: ritmo de commits, semana pico, contribuidor top y grado de estrellas.'
    },
    zh:{
      feat1Desc:'许可证、README、测试、CI、文档、活跃度——10 项加权检查浓缩为一个诚实的数字。',
      feat2Desc:'浏览器里的 Gitingest 技巧。选择文件，获得带 token 估算的干净提示词。',
      feat3Desc:'完整文件树可视化，含大小、类型分布和仓库中最大的文件。',
      feat4Desc:'语言字节数、8 大生态依赖扫描、提交活动和主要贡献者。',
      feat5Desc:'每个仓库都有个性、吐槽和奖杯——Wrapped 风格，可生成分享卡片。',
      feat6Desc:'深链接、PNG 卡片和可打印的 A4 报告。一切都在你的浏览器中。',
      favorites:'⭐ 收藏',clearFavs:'清除收藏',
      btnExportJson:'⬇️ JSON',btnExportCsv:'⬇️ CSV',btnDiff:'🔀 对比',btnFav:'收藏',
      battleBtn:'⚔️ 对战！',royaleBtn:'🏆 开始锦标赛',close:'关闭',
      copyBtn:'📋 复制',dlBtn:'⬇️ 下载 .md',gistBtn:'🌐 Gist 分享',tokBtn:'🧮 Token 明细',
      genBtn:'🤖 生成摘要',allTextBtn:'✓ 所有文本文件',
      expandAll:'📂 全部展开',collapseAll:'📁 全部折叠',selectText:'✓ 选择文本',
      clearSel:'✕ 清除',copyTree:'📋 复制树',hiddenBtn:'👁 隐藏文件',binaryBtn:'🧊 二进制',ftsBtn:'🔎 搜索',
      branchLabel:'分支：',tagLabel:'标签：',
      help_health:'健康评分按 10 项加权标准评估仓库——许可证、README、测试、CI、文档、活跃度等。80+ 表示项目卫生极佳。',
      help_files:'浏览仓库文件树，勾选要放入 LLM 提示词的文件。使用工具栏一键选择所有文本文件、按名称过滤或限定子文件夹。',
      help_digest:'LLM 摘要将选中的文件打包成可粘贴到 ChatGPT、Claude 或 Gemini 的提示词。选择预设获得任务指令，然后点击生成。一切都在浏览器中。',
      help_token:'Token 估算因模型而异。切换模型查看摘要是否适合其上下文窗口——超出时会自动分割成多个部分。',
      help_deep:'深度分析超越健康评分：PR 分析、修复型提交比率、代码 churn 热点和基于 OSV.dev 的依赖漏洞扫描。',
      help_deps:'从 manifest 文件（package.json、requirements.txt、Cargo.toml、go.mod 等）解析的交互式依赖关系图。',
      help_tokenModal:'没有令牌每小时有 60 次 GitHub API 调用。免费个人访问令牌可提升到 5,000 次/小时，且仅存储在你的浏览器中。',
      help_langs:'基于平台语言 API 的字节精确语言分析。环形图显示前 10 种语言。',
      help_badge:'为项目 README 生成健康评分徽章：含固定分数的静态 SVG 或动态 shields.io 徽章。',
      help_wrapped:'这个仓库 12 个月的趣味故事：提交节奏、高峰周、主要贡献者和星级评价。'
    },
    fr:{
      feat1Desc:'Licence, README, tests, CI, docs, fraîcheur — 10 vérifications pondérées en un nombre honnête.',
      feat2Desc:'L\'astuce Gitingest, côté navigateur. Sélectionnez des fichiers, obtenez un prompt propre avec estimation de tokens.',
      feat3Desc:'Visualisation complète de l\'arborescence avec tailles, distribution des types et fichiers les plus lourds.',
      feat4Desc:'Octets par langage, scan des dépendances sur 8 écosystèmes, activité des commits et contributeurs.',
      feat5Desc:'Chaque dépôt reçoit une personnalité, un roast et des trophées — style Wrapped, partageable en carte.',
      feat6Desc:'Liens profonds, cartes PNG et rapport A4 imprimable. Tout reste dans votre navigateur.',
      favorites:'⭐ Favoris',clearFavs:'Effacer les favoris',
      btnExportJson:'⬇️ JSON',btnExportCsv:'⬇️ CSV',btnDiff:'🔀 Diff',btnFav:'Fav',
      battleBtn:'⚔️ Battle !',royaleBtn:'🏆 Lancer le tournoi',close:'Fermer',
      copyBtn:'📋 Copier',dlBtn:'⬇️ Télécharger .md',gistBtn:'🌐 Partager en Gist',tokBtn:'🧮 Détail des tokens',
      genBtn:'🤖 Générer le résumé',allTextBtn:'✓ Tous les fichiers texte',
      expandAll:'📂 Tout déplier',collapseAll:'📁 Tout replier',selectText:'✓ Sélectionner le texte',
      clearSel:'✕ Effacer',copyTree:'📋 Copier l\'arbre',hiddenBtn:'👁 Cachés',binaryBtn:'🧊 Binaires',ftsBtn:'🔎 Rechercher',
      branchLabel:'Branche :',tagLabel:'Tag :',
      help_health:'Le Score de Santé évalue le dépôt sur 10 critères pondérés — licence, README, tests, CI, docs, fraîcheur… 80+ signifie une hygiène excellente.',
      help_files:'Parcourez l\'arborescence et cochez les fichiers à inclure dans votre prompt LLM. Utilisez la barre d\'outils pour tout sélectionner, filtrer par nom ou limiter à un sous-dossier.',
      help_digest:'Le Résumé LLM emballe vos fichiers sélectionnés en un prompt pour ChatGPT, Claude ou Gemini. Choisissez un preset puis Générez. Tout reste dans votre navigateur.',
      help_token:'Les estimations de tokens varient selon le modèle. Changez de modèle pour voir si le résumé tient dans sa fenêtre de contexte — sinon il est découpé en parties.',
      help_deep:'L\'Analyse Approfondie va plus loin que le score : analytics des PRs, ratio de commits de fix, hotspots de churn et scan de vulnérabilités via OSV.dev.',
      help_deps:'Graphe interactif des dépendances extraites des fichiers manifest (package.json, requirements.txt, Cargo.toml, go.mod…).',
      help_tokenModal:'Sans token, 60 appels GitHub par heure. Un token personnel gratuit porte cela à 5 000/heure, stocké uniquement dans votre navigateur.',
      help_langs:'Répartition des langages précise en octets via l\'API de la plateforme. Le donut montre les 10 principaux langages.',
      help_badge:'Générez un badge de score pour le README : SVG statique avec le score, ou badge dynamique shields.io.',
      help_wrapped:'L\'histoire amusante des 12 derniers mois de ce dépôt : rythme des commits, semaine record, contributeur n°1 et grade d\'étoiles.'
    },
    ar:{
      tabOverview:'🩺 نظرة عامة',tabLanguages:'📊 اللغات',tabFiles:'🗂️ الملفات',
      tabDigest:'🤖 الملخص',tabActivity:'📈 النشاط',tabFun:'🏆 الترفيه',tabDeps:'🔗 التبعيات',tabDeep:'🔬 تحليل عميق',
      btnHome:'← الرئيسية',btnCard:'📸 بطاقة',btnReport:'📄 تقرير',btnLink:'🔗 رابط',
      btnCompare:'⚖️ مقارنة',btnBattle:'⚔️ معركة',btnClone:'📋 استنساخ',
      btnToken:'🔑 رمز',btnShortcuts:'❓ اختصارات',
      searchPlaceholder:'المالك/المستودع، رابط GitHub، أو اسم مستخدم…',
      jumpPlaceholder:'تحليل مستودع آخر…',
      heroTitle:'تعرّف على مستودع GitHub',
      heroSub:'في ثوانٍ، لا ساعات.',
      heroDesc:'الصق أي مستودع أو ملف شخصي. يمنحك Repodest درجة صحة وتفصيل لغات ومستعرض ملفات ورؤى الالتزامات وجوائز ممتعة — ثم يغلّف كل ذلك في <b>ملخص جاهز لـ LLM</b> يمكنك تغذيته بـ ChatGPT أو Claude أو Gemini.',
      scopeBtn:'حلّل',
      recentRepos:'🕘 المستودعات الأخيرة',recentReposTitle:'🕘 المستودعات الأخيرة',
      clearHistory:'مسح السجل',
      step1:'الصق',step2:'استكشف',step3:'أطعم ذكاءك الاصطناعي',
      step1Desc:'أي رابط مستودع، مالك/مستودع، أو اسم مستخدم.',
      step2Desc:'درجة الصحة، اللغات، الملفات، النشاط — كل شيء في لوحة واحدة.',
      step3Desc:'اختر الملفات، أنشئ الملخص، وانسخه في أي محادثة LLM.',
      feat1:'درجة الصحة',feat2:'ملخص LLM',feat3:'مستعرض الملفات',
      feat4:'إحصاءات عميقة',feat5:'الوضع الترفيهي',feat6:'قابل للمشاركة',
      feat1Desc:'الترخيص، README، الاختبارات، CI، الوثائق، الحداثة — 10 فحوصات موزونة في رقم صادق واحد.',
      feat2Desc:'حيلة Gitingest داخل متصفحك. اختر الملفات واحصل على موجه نظيف مع تقدير الرموز.',
      feat3Desc:'عارض شجرة كامل بالأحجام وتوزيع الأنواع وأثقل ملفات المستودع.',
      feat4Desc:'بايتات اللغات، مسح التبعيات عبر 8 أنظمة، نشاط الالتزامات وكبار المساهمين.',
      feat5Desc:'كل مستودع يحصل على شخصية وسخرية وجوائز — بأسلوب Wrapped وقابل للمشاركة.',
      feat6Desc:'روابط عميقة وبطاقات PNG وتقرير A4 قابل للطباعة. كل شيء يبقى في متصفحك.',
      footer:'من إعداد',
      favorites:'⭐ المفضلة',clearFavs:'مسح المفضلة',
      btnExportJson:'⬇️ JSON',btnExportCsv:'⬇️ CSV',btnDiff:'🔀 فرق',btnFav:'مفضل',
      battleBtn:'⚔️ معركة!',royaleBtn:'🏆 ابدأ البطولة',close:'إغلاق',
      copyBtn:'📋 نسخ',dlBtn:'⬇️ تنزيل .md',gistBtn:'🌐 مشاركة Gist',tokBtn:'🧮 تفصيل الرموز',
      genBtn:'🤖 إنشاء الملخص',allTextBtn:'✓ كل الملفات النصية',
      expandAll:'📂 فتح الكل',collapseAll:'📁 طي الكل',selectText:'✓ اختيار النصوص',
      clearSel:'✕ مسح',copyTree:'📋 نسخ الشجرة',hiddenBtn:'👁 مخفي',binaryBtn:'🧊 ثنائي',ftsBtn:'🔎 بحث',
      branchLabel:'الفرع:',tagLabel:'الوسم:',
      excellentShape:'حالة ممتازة 🟢',decentShape:'حالة جيدة 🟡',
      needsLove:'يحتاج اهتماماً 🟠',needsCare:'يحتاج عناية جدية 🔴'
    },
    de:{
      tabOverview:'🩺 Überblick',tabLanguages:'📊 Sprachen',tabFiles:'🗂️ Dateien',
      tabDigest:'🤖 Zusammenfassung',tabActivity:'📈 Aktivität',tabFun:'🏆 Spaß',tabDeps:'🔗 Deps',tabDeep:'🔬 Tiefanalyse',
      btnHome:'← Start',btnCard:'📸 Karte',btnReport:'📄 Bericht',btnLink:'🔗 Link',
      btnCompare:'⚖️ Vergleichen',btnBattle:'⚔️ Battle',btnClone:'📋 Klonen',
      btnToken:'🔑 Token',btnShortcuts:'❓ Shortcuts',
      searchPlaceholder:'besitzer/repo, eine GitHub-URL, oder ein Benutzername…',
      jumpPlaceholder:'weiteres Repo analysieren…',
      heroTitle:'Kenne ein GitHub-Repo',
      heroSub:'in Sekunden, nicht Stunden.',
      heroDesc:'Füge ein beliebiges Repository oder Profil ein. Repodest liefert dir einen Gesundheitsscore, Sprachverteilung, Datei-Explorer, Commit-Insights und Spaß-Trophäen — und packt alles in einen <b>LLM-fähigen Digest</b> für ChatGPT, Claude oder Gemini.',
      scopeBtn:'Analysieren',
      recentRepos:'🕘 Letzte Repos',recentReposTitle:'🕘 Letzte Repos',
      clearHistory:'Verlauf löschen',
      step1:'Einfügen',step2:'Erkunden',step3:'Füttere deine KI',
      step1Desc:'Jede Repo-URL, besitzer/repo oder Benutzername.',
      step2Desc:'Gesundheitscore, Sprachen, Dateien, Aktivität — alles in einem Dashboard.',
      step3Desc:'Dateien wählen, generieren, den Digest in einen LLM-Chat kopieren.',
      feat1:'Gesundheitscore',feat2:'LLM-Digest',feat3:'Datei-Explorer',
      feat4:'Tiefen-Statistiken',feat5:'Spaß-Modus',feat6:'Teilbar',
      feat1Desc:'Lizenz, README, Tests, CI, Docs, Aktualität — 10 gewichtete Prüfungen in einer ehrlichen Zahl.',
      feat2Desc:'Der Gitingest-Trick, clientseitig. Dateien wählen, sauberen Prompt mit Token-Schätzung erhalten.',
      feat3Desc:'Vollständiger Baum-Viewer mit Größen, Typverteilung und den schwersten Dateien des Repos.',
      feat4Desc:'Sprach-Bytes, Abhängigkeits-Scan über 8 Ökosysteme, Commit-Aktivität und Top-Contributors.',
      feat5Desc:'Jedes Repo bekommt Persönlichkeit, Roast und Trophäen — im Wrapped-Stil, teilbar als Karte.',
      feat6Desc:'Deep-Links, PNG-Karten und ein druckbarer A4-Bericht. Alles bleibt im Browser.',
      footer:'Erstellt von',
      favorites:'⭐ Favoriten',clearFavs:'Favoriten löschen',
      btnExportJson:'⬇️ JSON',btnExportCsv:'⬇️ CSV',btnDiff:'🔀 Diff',btnFav:'Fav',
      battleBtn:'⚔️ Battle!',royaleBtn:'🏆 Turnier starten',close:'Schließen',
      copyBtn:'📋 Kopieren',dlBtn:'⬇️ .md herunterladen',gistBtn:'🌐 Gist teilen',tokBtn:'🧮 Token-Aufschlüsselung',
      genBtn:'🤖 Digest erstellen',allTextBtn:'✓ Alle Textdateien',
      expandAll:'📂 Alle aufklappen',collapseAll:'📁 Alle zuklappen',selectText:'✓ Text wählen',
      clearSel:'✕ Leeren',copyTree:'📋 Baum kopieren',hiddenBtn:'👁 Versteckt',binaryBtn:'🧊 Binär',ftsBtn:'🔎 Suchen',
      branchLabel:'Branch:',tagLabel:'Tag:',
      excellentShape:'Ausgezeichnete Form 🟢',decentShape:'Gute Form 🟡',
      needsLove:'Braucht Liebe 🟠',needsCare:'Braucht dringend Pflege 🔴'
    }
  };
  Object.keys(X).forEach(lang=>{
    if(!I18N[lang])I18N[lang]={};
    Object.assign(I18N[lang],X[lang]);
  });
  /* Help texts route through t() with English fallback */
  window.__helpTopic=function(topic){
    const v=t('help_'+topic);
    return v&&v!=='help_'+topic?v:(HELP_TEXTS[topic]||'No help available.');
  };
})();

/* Localized status label for the digest model gauge */

/* ============================================================
   Language picker menu — click the 🌐 chip to open a dropdown
   of all supported languages instead of blind cycling.
   ============================================================ */
const LANG_NAMES={
  en:{flag:'🇬🇧',name:'English'},
  fa:{flag:'🇮🇷',name:'فارسی'},
  es:{flag:'🇪🇸',name:'Español'},
  zh:{flag:'🇨🇳',name:'中文'},
  fr:{flag:'🇫🇷',name:'Français'},
  ar:{flag:'🇸🇦',name:'العربية'},
  de:{flag:'🇩🇪',name:'Deutsch'}
};
let langMenuEl=null;
function toggleLangMenu(ev){
  if(ev)ev.stopPropagation();
  if(langMenuEl){closeLangMenu();return}
  langMenuEl=document.createElement('div');
  langMenuEl.className='lang-menu';
  langMenuEl.setAttribute('role','menu');
  langMenuEl.innerHTML=LANG_ORDER.map(code=>{
    const info=LANG_NAMES[code]||{flag:'🌐',name:code};
    const active=currentLang===code;
    return '<button class="lang-item'+(active?' active':'')+'" role="menuitemradio" aria-checked="'+active+'" data-lang="'+code+'">'+
      '<span class="li-flag">'+info.flag+'</span>'+
      '<span class="li-name">'+esc(info.name)+'</span>'+
      (active?'<span class="li-check">✓</span>':'')+
    '</button>';
  }).join('');
  document.body.appendChild(langMenuEl);
  const btn=$('#langBtn');
  if(btn){
    const r=btn.getBoundingClientRect();
    const mw=170;
    let left=Math.min(Math.max(8,r.right-mw),innerWidth-mw-8);
    let top=r.bottom+8;
    langMenuEl.style.left=left+'px';
    langMenuEl.style.top=top+'px';
  }
  langMenuEl.addEventListener('click',e=>{
    const item=e.target.closest('.lang-item');
    if(!item)return;
    const code=item.dataset.lang;
    if(code&&code!==currentLang){
      currentLang=code;
      LS.set('repodest_lang',code);
      applyLang();
      toast((LANG_NAMES[code]||{}).name||code,'ok');
    }
    closeLangMenu();
  });
  setTimeout(()=>{
    document.addEventListener('click',closeLangMenuOnOutside);
    document.addEventListener('keydown',closeLangMenuOnEsc);
  },0);
}
function closeLangMenuOnOutside(e){
  if(langMenuEl&&!langMenuEl.contains(e.target)&&!e.target.closest('#langBtn'))closeLangMenu();
}
function closeLangMenuOnEsc(e){
  if(e.key==='Escape')closeLangMenu();
}
function closeLangMenu(){
  if(!langMenuEl)return;
  langMenuEl.remove();
  langMenuEl=null;
  document.removeEventListener('click',closeLangMenuOnOutside);
  document.removeEventListener('keydown',closeLangMenuOnEsc);
}

/* ============================================================
   "Since your last visit" — stores a lightweight snapshot per
   repo in localStorage and diffs it on the next visit.
   ============================================================ */
const LASTVISIT_KEY='repodest_lastvisit';
function loadLastVisitSnapshots(){
  return LS.get(LASTVISIT_KEY,{});
}
function buildVisitSnapshot(m){
  return{
    ts:Date.now(),
    stars:m.stargazers_count||0,
    forks:m.forks_count||0,
    open_issues:m.open_issues_count||0,
    pushed_at:m.pushed_at||''
  };
}
function saveVisitSnapshot(m){
  if(!m||!m.full_name)return;
  const all=loadLastVisitSnapshots();
  all[m._platform+':'+m.full_name]=buildVisitSnapshot(m);
  /* keep newest 40 */
  const entries=Object.entries(all).sort((a,b)=>(b[1].ts||0)-(a[1].ts||0)).slice(0,40);
  LS.set(LASTVISIT_KEY,Object.fromEntries(entries));
}
function renderSinceLastVisit(m){
  const host=$('#sinceLastVisit');
  if(!host)return;
  if(!m||!m.full_name){host.style.display='none';return}
  const all=loadLastVisitSnapshots();
  const prev=all[m._platform+':'+m.full_name];
  saveVisitSnapshot(m);
  if(!prev||!prev.ts||(Date.now()-prev.ts)<3600*1000){host.style.display='none';return}
  const diffs=[];
  const dStars=(m.stargazers_count||0)-(prev.stars||0);
  const dForks=(m.forks_count||0)-(prev.forks||0);
  const dIssues=(m.open_issues_count||0)-(prev.open_issues||0);
  if(dStars)diffs.push((dStars>0?'+':'')+fmt(dStars)+' ★');
  if(dForks)diffs.push((dForks>0?'+':'')+fmt(dForks)+' ⑂');
  if(dIssues)diffs.push((dIssues>0?'+':'')+fmt(dIssues)+' issues');
  const pushedChanged=prev.pushed_at&&m.pushed_at&&prev.pushed_at!==m.pushed_at;
  const when=timeAgo(new Date(prev.ts).toISOString());
  if(!diffs.length&&!pushedChanged){host.style.display='none';return}
  const parts=[];
  if(diffs.length)parts.push('<b>'+diffs.join(' · ')+'</b> since your visit '+when);
  if(pushedChanged)parts.push('🔔 new push since '+when);
  host.style.display='';
  host.innerHTML='<span class="slv-chip">'+parts.join(' — ')+'</span>';
}

/* ============================================================
   URL automation — deep links for power users:
     ?repo=owner/repo&preset=review&format=json&digest=auto
   digest=auto selects all text files and generates on load
   (respecting API limits; requires a fresh or cached load).
   ============================================================ */
function applyUrlAutomation(){
  const q=new URLSearchParams(location.search);
  const preset=q.get('preset');
  if(preset&&preset==='custom'){digestPreset='custom';LS.set('repodest_preset',preset)}
  else if(preset&&DIGEST_PRESETS[preset]){digestPreset=preset;LS.set('repodest_preset',preset)}
  const format=q.get('format');
  if(format&&DIGEST_FORMATS.includes(format)){digestFormat=format;LS.set('repodest_format',format)}
  if(q.get('skeleton')==='1'){sigOnly=true;LS.set('repodest_sigonly',true)}
  initDigestControls();
  if(q.get('digest')==='auto'){
    S.autoDigestPending=true;
  }
}
async function maybeRunAutoDigest(){
  if(!S.autoDigestPending)return;
  S.autoDigestPending=false;
  const m=S.repo;
  if(!m||S.platform==='gitlab'||S.platform==='bitbucket'){toast('Auto-digest works on GitHub repos','err');return}
  if(!S.sel.size)selectTextAll();
  if(!S.sel.size){toast('No text files to digest','err');return}
  toast('Auto-generating digest from URL params…','ok');
  generateDigest();
}

/* Bookmarklet — drag to bookmarks bar; click on any GitHub repo page */
function showBookmarklet(){
  const code="location.href='https://mohsen-niksirat.github.io/Repodest/?repo='+encodeURIComponent(location.pathname.replace(/^\\/([^\\/]+)\\/([^\\/]+).*$/,'$1/$2'))";
  showModal('🔖 Repodest Bookmarklet',
    '<p style="font-size:13px;color:var(--text2)">Drag this link to your bookmarks bar. While browsing any GitHub repo, click it to open the repo here instantly.</p>'+
    '<p style="margin:12px 0"><a class="btn sm" style="display:inline-block;text-decoration:none" href="javascript:void 0" onclick="return false" ondragstart="event.dataTransfer.setData(\'text/plain\',this.href);return true" data-bm="1">🧪 Analyze with Repodest</a></p>'+
    '<p style="font-size:11.5px;color:var(--text3);margin-top:8px">Or copy this URL scheme into a new bookmark:</p>'+
    '<textarea readonly rows="3" style="width:100%;margin-top:6px;padding:10px;border-radius:10px;background:var(--bg2);border:1px solid var(--line);color:var(--text);font-family:var(--mono);font-size:11px" id="bmCode">javascript:(function(){var m=location.pathname.match(/^\\/([^\\/]+)\\/([^\\/]+)/);if(m)open("https://mohsen-niksirat.github.io/Repodest/?repo="+encodeURIComponent(m[1]+"/"+m[2]))})();</textarea>'+
    '<div class="mrow" style="margin-top:10px"><button class="btn sm" onclick="copyBmCode()">📋 Copy</button></div>');
}
function copyBmCode(){
  const ta=$('#bmCode');
  if(!ta)return;
  (navigator.clipboard?navigator.clipboard.writeText(ta.value):Promise.reject()).then(()=>toast('Bookmarklet copied','ok')).catch(()=>{ta.select();document.execCommand('copy');toast('Bookmarklet copied','ok')});
}
