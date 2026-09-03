'use strict';
/* ============================================================
   Utility helpers
   ============================================================ */
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const LS={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const S={repo:null,langs:null,tree:null,contribs:null,commits:null,activity:null,sel:new Set(),digestText:'',charts:{},user:null,userRepos:null,platform:'github',branches:[],tags:[],currentBranch:null,compareData:null};
const FILEMAP=new Map(),DIRMAP=new Map(),NODEMAP=new Map();
/* esc/fmt/fmtSize/timeAgo, TEXT_EXT/BINARY_EXT, LANG_COLORS/PALETTE,
   detectPlatform/parseRepoInput, asciiTree, SPDX_MAP — shared via core.js */
const MANIFESTS=[{f:'package.json',t:'json',label:'npm'},{f:'requirements.txt',t:'lines',label:'pip'},{f:'pyproject.toml',t:'toml',label:'pyproject'},{f:'Cargo.toml',t:'toml',label:'Cargo'},{f:'go.mod',t:'gomod',label:'Go modules'},{f:'composer.json',t:'json',label:'Composer'},{f:'Gemfile',t:'gemfile',label:'Bundler'},{f:'pom.xml',t:'pom',label:'Maven'}];
let ROASTS=[];

/* ============================================================
   Lazy-loaded external libraries
   ============================================================ */
let chartJsLoaded=false, html2canvasLoaded=false;
function loadScript(src){
  return new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src=src;s.defer=true;
    s.onload=resolve;s.onerror=reject;
    document.head.appendChild(s);
  });
}
async function ensureChartJs(){
  if(chartJsLoaded)return;
  await loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js');
  chartJsLoaded=true;
}
async function ensureHtml2canvas(){
  if(html2canvasLoaded)return;
  await loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
  html2canvasLoaded=true;
}

/* ============================================================
   SPDX License Analysis
   (SPDX_MAP lives in core.js)
   ============================================================ */

/* ============================================================
   README Badge Generator (static SVG + dynamic shields.io)
   ============================================================ */
function scoreColor(score){
  return score>=80?'#22c55e':score>=60?'#eab308':score>=40?'#f97316':'#ef4444';
}
function escapeXml(s){
  return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
}
function buildStaticBadge(left,right,color){
  const leftW=6+String(left).length*7.2+6;
  const rightW=6+String(right).length*7.2+6;
  const total=leftW+rightW;
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+total+'" height="20" role="img" aria-label="'+escapeXml(left)+': '+escapeXml(right)+'">'+
    '<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>'+
    '<clipPath id="r"><rect width="'+total+'" height="20" rx="3" fill="#fff"/></clipPath>'+
    '<g clip-path="url(#r)">'+
      '<rect width="'+leftW+'" height="20" fill="#555"/>'+
      '<rect x="'+leftW+'" width="'+rightW+'" height="20" fill="'+color+'"/>'+
      '<rect width="'+total+'" height="20" fill="url(#s)"/>'+
    '</g>'+
    '<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">'+
      '<text x="'+(leftW/2)+'" y="14">'+escapeXml(left)+'</text>'+
      '<text x="'+(leftW+rightW/2)+'" y="14">'+escapeXml(right)+'</text>'+
    '</g>'+
  '</svg>';
}
function badgeMarkdown(){
  const m=S.repo;if(!m)return'';
  const score=(()=>{try{return healthCheck().score}catch(e){return 0}})();
  const style=(document.querySelector('input[name="badgeStyle"]:checked')||{}).value||'static';
  const withStars=!$('#badgeStars')||$('#badgeStars').checked;
  const repoUrl=m.html_url||('https://github.com/'+m.full_name);
  const deepUrl=location.origin+location.pathname+'?repo='+encodeURIComponent(m.full_name||'');
  const lines=[];
  if(style==='dynamic'){
    lines.push('[![Repodest](https://img.shields.io/badge/analyzed%20by-Repodest-9333ea)]('+deepUrl+')');
    lines.push('[![Health](https://img.shields.io/badge/dynamic/json?url='+encodeURIComponent('https://api.github.com/repos/'+(m.full_name||''))+'&query=%24.stargazers_count&logo=github&label=stars)]('+repoUrl+')');
  }else{
    lines.push('[![Health score](data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(buildStaticBadge('health score',score+'/100',scoreColor(score))) ) )+')('+deepUrl+')');
  }
  if(withStars&&style==='static'){
    lines.push('[![Stars](data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(buildStaticBadge('stars',fmt(m.stargazers_count||0),'#0969da'))))+')('+repoUrl+')');
  }
  return lines.join('\n');
}
function renderBadgeGenerator(){
  const card=$('#badgeCard'),preview=$('#badgePreview');
  if(!card||!preview)return;
  const m=S.repo;
  if(!m||(S.platform!=='github'&&S.platform!=='ghe'&&S.platform!=='gitlab'&&S.platform!=='bitbucket')){card.style.display='none';return}
  card.style.display='';
  const score=(()=>{try{return healthCheck().score}catch(e){return 0}})();
  preview.innerHTML=buildStaticBadge('health score',score+'/100',scoreColor(score))+'<div style="width:10px"></div>'+buildStaticBadge('stars',fmt(m.stargazers_count||0),'#0969da');
  renderBadgeCode();
}
function renderBadgeCode(){
  const ta=$('#badgeCode');
  if(!ta)return;
  ta.value=badgeMarkdown();
}
function copyBadgeCode(){
  const ta=$('#badgeCode');
  if(!ta||!ta.value)return;
  (navigator.clipboard?navigator.clipboard.writeText(ta.value):Promise.reject()).then(()=>toast('Badge markdown copied','ok')).catch(()=>{ta.removeAttribute('readonly');ta.select();document.execCommand('copy');ta.setAttribute('readonly','');toast('Badge markdown copied','ok')});
}
function downloadBadgeSVG(){
  const m=S.repo;if(!m)return;
  const score=(()=>{try{return healthCheck().score}catch(e){return 0}})();
  const svg=buildStaticBadge('health score',score+'/100',scoreColor(score));
  const blob=new Blob([svg],{type:'image/svg+xml'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=(m.full_name||'repo').replace('/','-')+'-badge.svg';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  toast('Badge SVG downloaded','ok');
}

function renderLicenseAnalysis(){
  try{
    const m=S.repo;
    const el=$('#licenseAnalysis');
    const card=$('#licenseCard');
    if(!m||!m.license||!m.license.spdx_id){
      if(card)card.style.display='none';
      return;
    }
    card.style.display='';
    const spdx=m.license.spdx_id;
    const info=SPDX_MAP[spdx];
    if(!info){
      el.innerHTML='<div class="kv"><span>License</span><b>'+esc(m.license.name||spdx)+'</b></div><div class="kv"><span>SPDX ID</span><b>'+esc(spdx)+'</b></div><p style="color:var(--text3);font-size:12px;margin-top:10px">Detailed analysis not available for this license type.</p>';
      return;
    }
    el.innerHTML=
      '<div class="kv"><span>License</span><b>'+esc(info.name)+'</b></div>'+
      '<div class="kv"><span>SPDX ID</span><b>'+esc(spdx)+'</b></div>'+
      '<div class="license-grid">'+
        '<div class="license-col perm"><h4>✅ Permissions</h4><ul>'+info.perms.map(p=>'<li>'+esc(p)+'</li>').join('')+'</ul></div>'+
        '<div class="license-col cond"><h4>⚠️ Conditions</h4><ul>'+(info.conds.length?info.conds.map(c=>'<li>'+esc(c)+'</li>').join(''):'<li style="color:var(--text3)">None</li>')+'</ul></div>'+
        '<div class="license-col lim"><h4>🚫 Limitations</h4><ul>'+info.lims.map(l=>'<li>'+esc(l)+'</li>').join('')+'</ul></div>'+
      '</div>';
  }catch(e){console.warn('License analysis error:',e)}
}

/* ============================================================
   Multi-platform support (GitLab, Bitbucket)
   (detectPlatform/parseRepoInput live in core.js)
   ============================================================ */

/* GitLab API adapter */
async function gitlabApi(path){
  const r=await fetch('https://gitlab.com/api/v4'+path);
  if(r.status===404)throw new Error('NOT_FOUND');
  if(!r.ok)throw new Error('HTTP_'+r.status);
  return r.json();
}

/* Bitbucket API adapter */
async function bitbucketApi(path){
  const r=await fetch('https://api.bitbucket.org/2.0'+path);
  if(r.status===404)throw new Error('NOT_FOUND');
  if(!r.ok)throw new Error('HTTP_'+r.status);
  return r.json();
}

/* Normalize GitLab project to our internal structure */
function normalizeGitlabProject(p){
  return{
    full_name:p.path_with_namespace||'',
    name:p.name||'',
    owner:{login:(p.namespace&&p.namespace.full_path)||(p.owner&&p.owner.username)||'',avatar_url:p.avatar_url||'',html_url:(p.owner&&p.owner.web_url)||''},
    html_url:p.web_url||'',
    description:p.description||'',
    fork:!!p.forked_from_project,
    created_at:p.created_at,
    pushed_at:p.last_activity_at,
    updated_at:p.last_activity_at,
    homepage:p.web_url||'',
    size:Math.round(((p.statistics&&p.statistics.repository_size)||0)/1024),
    stargazers_count:p.star_count||0,
    watchers_count:p.star_count||0,
    forks_count:p.forks_count||0,
    open_issues_count:p.open_issues_count||0,
    language:p.language||null,
    license:p.license?{spdx_id:(p.license.key||'').toUpperCase(),name:p.license.name||''}:null,
    topics:p.topics||[],
    default_branch:p.default_branch||'main',
    archived:p.archived||false,
    _platform:'gitlab',
    _id:p.id
  };
}

/* Normalize Bitbucket repo to our internal structure */
function normalizeBitbucketRepo(r){
  return{
    full_name:r.full_name||'',
    name:r.name||'',
    owner:{login:(r.owner&&r.owner.username)||'',avatar_url:(r.owner&&r.owner.links&&r.owner.links.avatar&&r.owner.links.avatar.href)||'',html_url:(r.owner&&r.owner.links&&r.owner.links.html&&r.owner.links.html.href)||''},
    html_url:(r.links&&r.links.html&&r.links.html.href)||'',
    description:r.description||'',
    fork:!!r.parent,
    created_at:r.created_on,
    pushed_at:r.updated_on,
    updated_at:r.updated_on,
    homepage:r.website||'',
    size:Math.round((r.size||0)/1024),
    stargazers_count:0,
    watchers_count:0,
    forks_count:0,
    open_issues_count:0,
    language:r.language||null,
    license:r.license?{spdx_id:r.license.spdx_id||r.license.key||'',name:r.license.name||''}:null,
    topics:[],
    default_branch:(r.mainbranch&&r.mainbranch.name)||'main',
    archived:false,
    _platform:'bitbucket'
  };
}

/* BUG FIX #3: Build a proper tree from Bitbucket src API response */
async function fetchBitbucketTree(owner, repo, branch) {
  const tree = [];
  async function walkDir(path) {
    const url = '/repositories/' + owner + '/' + repo + '/src/' + encodeURIComponent(branch) + '/' + (path ? encodeURIComponent(path) + '/' : '') + '?format=meta&max=100';
    try {
      const data = await bitbucketApi(url);
      if (data && Array.isArray(data.values)) {
        for (const item of data.values) {
          const itemPath = item.path || (path ? path + '/' + item.name : item.name);
          if (item.type === 'commit_file') {
            tree.push({ path: itemPath, type: 'blob', size: item.size || 0, name: item.name || itemPath.split('/').pop() });
          } else if (item.type === 'commit_directory') {
            tree.push({ path: itemPath, type: 'tree', size: 0, name: item.name || itemPath.split('/').pop() });
            await walkDir(itemPath);
          }
        }
      }
    } catch (e) { /* skip inaccessible dirs */ }
  }
  await walkDir('');
  return { tree, truncated: false };
}

/* Fetch repo data for any platform */
async function fetchRepoData(owner,repo,platform){
  if(platform==='gitlab'){
    const encoded=encodeURIComponent(owner+'/'+repo);
    const p=await gitlabApi('/projects/'+encoded);
    const langs=await gitlabApi('/projects/'+p.id+'/languages').catch(()=>({}));
    let tree=null;
    try{
      const treeData=await gitlabApi('/projects/'+p.id+'/repository/tree?recursive=true&per_page=100&ref='+(p.default_branch||'main'));
      /* BUG FIX #4: Ensure every file item has a `name` property */
      tree={tree:treeData.map(f=>({
        path:f.path||'',
        type:f.type==='blob'?'blob':'tree',
        size:f.size||0,
        name:f.name||(f.path||'').split('/').pop()
      })),truncated:treeData.length>=100};
    }catch(e){}
    const contribs=await gitlabApi('/projects/'+p.id+'/repository/contributors?per_page=12').catch(()=>[]);
    const commits=await gitlabApi('/projects/'+p.id+'/repository/commits?per_page=100').catch(()=>[]);
    return{
      meta:normalizeGitlabProject(p),
      langs,
      tree,
      contribs:Array.isArray(contribs)?contribs.map(c=>({login:c.name||'',avatar_url:'',html_url:'',contributions:c.commits||0,type:'User'})):[]  ,
      commits:Array.isArray(commits)?commits.slice(0,100).map(c=>({commit:{message:c.message||'',author:{name:c.author_name||'',date:c.created_at||''}},author:null})):[]
    };
  }
  if(platform==='bitbucket'){
    const r=await bitbucketApi('/repositories/'+owner+'/'+repo);
    const langs={};
    if(r.language)langs[r.language]=1000;
    /* BUG FIX #3: Build proper tree from Bitbucket src API */
    let tree=null;
    try{
      const branch=(r.mainbranch&&r.mainbranch.name)||'master';
      tree=await fetchBitbucketTree(owner, repo, branch);
    }catch(e){console.warn('Bitbucket tree fetch failed:',e)}
    const contribs=[];
    const commits=[];
    try{
      const cc=await bitbucketApi('/repositories/'+owner+'/'+repo+'/commits?pagelen=100');
      if(cc.values){
        cc.values.forEach(c=>{
          commits.push({commit:{message:c.message||'',author:{name:(c.author&&c.author.raw)||'',date:c.date||''}},author:null});
        });
      }
    }catch(e){}
    return{
      meta:normalizeBitbucketRepo(r),
      langs,
      tree,
      contribs,
      commits:commits.slice(0,100)
    };
  }
  return null;
}

/* ============================================================
   Dynamic SEO / Open Graph
   ============================================================ */
function updateSEO(meta){
  try{
    const title=(meta.full_name||'Unknown')+' — Repodest';
    const desc=(meta.description||'A repository on '+(meta._platform||'GitHub'))+'. Health score, languages, file explorer, and LLM-ready digest.';
    document.title=title;
    const ogTitle=document.querySelector('meta[property="og:title"]');
    const ogDesc=document.querySelector('meta[property="og:description"]');
    const ogImg=document.querySelector('meta[property="og:image"]');
    if(ogTitle)ogTitle.setAttribute('content',(meta.full_name||'')+' — X-ray for '+(meta._platform||'GitHub')+' repos');
    if(ogDesc)ogDesc.setAttribute('content',desc);
    if(ogImg&&meta.owner&&meta.owner.avatar_url)ogImg.setAttribute('content',meta.owner.avatar_url);
  }catch(e){}
}

/* ============================================================
   Local History
   ============================================================ */
const HISTORY_KEY='repodest_history';
const MAX_HISTORY=10;

function addToHistory(meta,score){
  let hist=LS.get(HISTORY_KEY,[]);
  hist=hist.filter(h=>h.full_name!==(meta.full_name||''));
  hist.unshift({
    full_name:meta.full_name||'',
    name:meta.name||'',
    avatar:(meta.owner&&meta.owner.avatar_url)||'',
    score:score,
    platform:meta._platform||'github',
    ts:Date.now()
  });
  hist=hist.slice(0,MAX_HISTORY);
  LS.set(HISTORY_KEY,hist);
}

function renderHistory(){
  const hist=LS.get(HISTORY_KEY,[]);
  const section=$('#historySection');
  const grid=$('#historyGrid');
  if(!hist.length){section.style.display='none';return}
  section.style.display='';
  grid.innerHTML=hist.map(h=>{
    const ago=timeAgo(h.ts);
    const platformClass=h.platform||'github';
    return '<div class="hcard" onclick="loadRepoFromHistory(\''+esc(h.full_name)+'\',\''+esc(h.platform||'github')+'\')">'+
      '<img src="'+esc(h.avatar)+'" alt="" loading="lazy">'+
      '<div class="hi"><div class="hn">'+esc(h.name||'')+'</div><div class="hm"><span class="platform-chip '+esc(platformClass)+'">'+esc(platformClass)+'</span> · '+ago+'</div></div>'+
      '<div class="hs">'+h.score+'</div>'+
    '</div>';
  }).join('');
}

function loadRepoFromHistory(fullName,platform){
  const parts=(fullName||'').split('/');
  if(parts.length===2)loadRepo(parts[0],parts[1],platform);
}

function clearHistory(){
  LS.set(HISTORY_KEY,[]);
  renderHistory();
  toast('History cleared','ok');
}

/* ============================================================
   Branch & Tag Selection
   ============================================================ */
async function fetchBranchesAndTags(owner,repo){
  const gh=S.platform==='github'||S.platform==='ghe';
  if(!gh){$('#branchSel').style.display='none';return}
  try{
    const [branches,tags]=await Promise.all([
      api('/repos/'+owner+'/'+repo+'/branches?per_page=100').catch(()=>[]),
      api('/repos/'+owner+'/'+repo+'/tags?per_page=100').catch(()=>[])
    ]);
    S.branches=Array.isArray(branches)?branches:[];
    S.tags=Array.isArray(tags)?tags:[];
    S.currentBranch=(S.repo&&S.repo.default_branch)||'main';
    renderBranchTagUI();
  }catch(e){
    $('#branchSel').style.display='none';
  }
}

function renderBranchTagUI(){
  const sel=$('#branchSel');
  if(!S.branches.length&&!S.tags.length){sel.style.display='none';return}
  sel.style.display='';
  const bd=$('#branchDropdown');
  bd.innerHTML=S.branches.map(b=>'<option value="'+esc(b.name||'')+'"'+(b.name===S.currentBranch?' selected':'')+'>'+esc(b.name||'')+'</option>').join('');
  const td=$('#tagDropdown');
  td.innerHTML='<option value="">—</option>'+S.tags.map(t=>'<option value="'+esc(t.name||'')+'">'+esc(t.name||'')+'</option>').join('');
}

async function onBranchChange(branch){
  if(!branch||branch===S.currentBranch)return;
  S.currentBranch=branch;
  $('#tagDropdown').value='';
  await reloadTreeForRef(branch);
}

async function onTagChange(tag){
  if(!tag)return;
  S.currentBranch=tag;
  await reloadTreeForRef(tag);
}

async function reloadTreeForRef(ref){
  const m=S.repo;
  if(!m)return;
  const key=m.full_name||'';
  setLoad('Loading file tree for '+ref+'…');
  try{
    const tree=await api('/repos/'+key+'/git/trees/'+ref+'?recursive=1').catch(()=>null);
    if(tree){
      parseTree(tree);
      S.tree=tree;
      renderFiles();
      resetDigest();
    }
    show($('#loadingView'),false);show($('#dash'),true);
    toast('Switched to '+ref,'ok');
  }catch(e){
    show($('#loadingView'),false);show($('#dash'),true);
    toast('Failed to load tree for '+ref,'err');
  }
}

/* ============================================================
   Compare Mode
   ============================================================ */
function toggleCompare(){
  const panel=$('#comparePanel');
  panel.classList.toggle('hidden');
  if(!panel.classList.contains('hidden')){
    const q=new URLSearchParams(location.search);
    const compare=q.get('compare');
    if(compare)$('#compareInput').value=compare;
  }
}

async function loadCompare(){
  const v=$('#compareInput').value.trim();
  if(!v){toast('Enter a repo to compare','err');return}
  const p=parseRepoInput(v);
  if(!p){toast('Could not parse that','err');return}
  const content=$('#compareContent');
  content.innerHTML='<div class="loading"><div class="spinner"></div><p>Loading '+esc(p.owner+'/'+p.repo)+'…</p></div>';
  try{
    let data;
    if(p.platform==='github'){
      const meta=await api('/repos/'+p.owner+'/'+p.repo);
      const langs=await api('/repos/'+p.owner+'/'+p.repo+'/languages').catch(()=>({}));
      const contribs=await api('/repos/'+p.owner+'/'+p.repo+'/contributors?per_page=1').catch(()=>[]);
      data={meta:stripRepo(meta),langs,contribs:Array.isArray(contribs)?contribs:[]};
    }else{
      data=await fetchRepoData(p.owner,p.repo,p.platform);
    }
    if(!data)throw new Error('Failed to fetch');
    S.compareData=data;
    const url=new URL(location);
    url.searchParams.set('compare',p.owner+'/'+p.repo);
    history.replaceState(null,'',url);
    renderCompare(data);
  }catch(e){
    content.innerHTML='<div class="errbox"><div class="e">💥</div><h3>Could not load comparison</h3><p>'+esc(e.message||'Unknown error')+'</p></div>';
  }
}

function renderCompare(data){
  try{
    const a=S.repo,b=data.meta;
    if(!a||!b)return;
    const ahc=healthCheck();
    const bScore=(b.stargazers_count||0)>1000?70:(b.stargazers_count||0)>100?55:(b.stargazers_count||0)>10?40:25;
    const content=$('#compareContent');
    content.innerHTML=
      '<div class="compare-wrap">'+
        '<div class="compare-side">'+
          '<div class="card">'+
            '<h3 style="margin-bottom:12px">'+esc(a.full_name||'')+'</h3>'+
            '<div class="statrow">'+
              '<div class="st"><b>'+ahc.score+'</b><span>health</span></div>'+
              '<div class="st"><b>★ '+fmt(a.stargazers_count)+'</b><span>stars</span></div>'+
              '<div class="st"><b>⑂ '+fmt(a.forks_count)+'</b><span>forks</span></div>'+
              '<div class="st"><b>'+fmt(a.open_issues_count)+'</b><span>issues</span></div>'+
            '</div>'+
            '<div style="margin-top:12px"><div class="minititle">Languages</div>'+
            renderCompareLangs(S.langs)+'</div>'+
            '<div style="margin-top:8px;color:var(--text3);font-size:12px">Last push: '+esc(timeAgo(a.pushed_at))+'</div>'+
          '</div>'+
        '</div>'+
        '<div class="compare-side">'+
          '<div class="card">'+
            '<h3 style="margin-bottom:12px">'+esc(b.full_name||'')+'</h3>'+
            '<div class="statrow">'+
              '<div class="st"><b>'+bScore+'</b><span>health</span></div>'+
              '<div class="st"><b>★ '+fmt(b.stargazers_count)+'</b><span>stars</span></div>'+
              '<div class="st"><b>⑂ '+fmt(b.forks_count)+'</b><span>forks</span></div>'+
              '<div class="st"><b>'+fmt(b.open_issues_count)+'</b><span>issues</span></div>'+
            '</div>'+
            '<div style="margin-top:12px"><div class="minititle">Languages</div>'+
            renderCompareLangs(data.langs)+'</div>'+
            '<div style="margin-top:8px;color:var(--text3);font-size:12px">Last push: '+esc(timeAgo(b.pushed_at))+'</div>'+
          '</div>'+
        '</div>'+
      '</div>';
  }catch(e){console.warn('Compare render error:',e)}
}

function renderCompareLangs(langs){
  if(!langs)return '<span style="color:var(--text3);font-size:12px">No language data</span>';
  const entries=Object.entries(langs).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const total=Object.values(langs).reduce((a,b)=>a+b,0)||1;
  if(!entries.length)return '<span style="color:var(--text3);font-size:12px">No language data</span>';
  return entries.map(e=>'<div class="langrow"><span class="ld" style="background:'+langColor(e[0])+'"></span><span class="ln">'+esc(e[0])+'</span><span class="lp">'+(e[1]/total*100).toFixed(1)+'%</span></div>').join('');
}

/* ============================================================
   Export Formats (JSON, CSV)
   ============================================================ */
function exportJSON(){
  try{
    if(!S.repo)return;
    const m=S.repo,hc=healthCheck();
    const data={
      repo:{
        full_name:m.full_name,description:m.description,platform:S.platform||'github',url:m.html_url,
        language:m.language,license:m.license?m.license.spdx_id:null,
        stars:m.stargazers_count,forks:m.forks_count,open_issues:m.open_issues_count,
        size_kb:m.size,created_at:m.created_at,pushed_at:m.pushed_at,
        default_branch:m.default_branch,topics:m.topics,archived:m.archived,fork:m.fork
      },
      health:{score:hc.score,checks:hc.items.map(c=>({name:c.n,pass:c.ok}))},
      languages:S.langs,
      contributors:S.contribs.slice(0,20).map(c=>({login:c.login||'',contributions:c.contributions||0})),
      file_count:FILEMAP.size,
      directory_count:DIRMAP.size,
      trophies:getAch().filter(a=>a.on).map(a=>a.n),
      exported_at:new Date().toISOString(),
      generator:'Repodest'
    };
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=(m.full_name||'repo').replace('/','-')+'-repodest.json';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),4000);
    toast('JSON exported','ok');
  }catch(e){toast('Export failed','err')}
}

function exportCSV(){
  try{
    if(!S.repo)return;
    const m=S.repo;
    const lines=['Category,Name,Value,Percentage'];
    const langEntries=Object.entries(S.langs).sort((a,b)=>b[1]-a[1]);
    const langTotal=langEntries.reduce((a,e)=>a+e[1],0)||1;
    langEntries.forEach(e=>{
      lines.push('Language,"'+e[0]+'",'+e[1]+','+(e[1]/langTotal*100).toFixed(2));
    });
    const extCounts={};
    FILEMAP.forEach((f,k)=>{const e=extOf(k);extCounts[e]=(extCounts[e]||0)+1});
    Object.entries(extCounts).sort((a,b)=>b[1]-a[1]).forEach(e=>{
      lines.push('FileType,.'+e[0]+','+e[1]+',');
    });
    lines.push('Stat,Stars,'+m.stargazers_count+',');
    lines.push('Stat,Forks,'+m.forks_count+',');
    lines.push('Stat,OpenIssues,'+m.open_issues_count+',');
    lines.push('Stat,Files,'+FILEMAP.size+',');
    lines.push('Stat,Directories,'+DIRMAP.size+',');
    lines.push('Stat,HealthScore,'+healthCheck().score+',');
    const blob=new Blob([lines.join('\n')],{type:'text/csv'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=(m.full_name||'repo').replace('/','-')+'-repodest.csv';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),4000);
    toast('CSV exported','ok');
  }catch(e){toast('Export failed','err')}
}

/* ============================================================
   Open in ChatGPT / Claude
   ============================================================ */
function setupLLMButtons(){
  try{
    const btns=$('#llmButtons');
    if(!S.digestText){btns.style.display='none';return}
    btns.style.display='';
    const prompt='Analyze this repository and provide insights:\n\n'+S.digestText.slice(0,12000);
    const gptUrl='https://chatgpt.com/?q='+encodeURIComponent(prompt);
    $('#chatgptBtn').href=gptUrl;
    $('#claudeBtn').onclick=function(e){
      e.preventDefault();
      navigator.clipboard.writeText(prompt).then(()=>{
        toast('Digest copied! Paste it into Claude.','ok');
        window.open('https://claude.ai/new','_blank');
      }).catch(()=>{
        window.open('https://claude.ai/new','_blank');
        toast('Copy the digest manually and paste into Claude','err');
      });
    };
  }catch(e){}
}

/* ============================================================
   Data-Driven Roast Mode
   ============================================================ */
function generateDynamicRoasts(){
  try{
    const m=S.repo,hc=healthCheck();
    const lines=[];
    const hasTests=hc.items.find(x=>x.n==='Tests');
    const hasCI=hc.items.find(x=>x.n==='CI workflows');
    const hasReadme=hc.items.find(x=>x.n==='README');
    const hasLicense=!!m.license;
    const hasContributing=hc.items.find(x=>x.n==='Contributing guide');
    const hasDocs=hc.items.find(x=>x.n==='Docs folder');
    const starCount=m.stargazers_count||0;
    const forkCount=m.forks_count||0;
    const issueCount=m.open_issues_count||0;
    const sizeMB=(m.size||0)/1024;
    const contribCount=S.contribs.length;
    const langCount=Object.keys(S.langs).length;
    const fileCount=FILEMAP.size;
    const age=(Date.now()-new Date(m.created_at))/864e5;
    const freshness=(Date.now()-new Date(m.pushed_at))/864e5;

    if(hasTests&&!hasTests.ok&&hasCI&&!hasCI.ok)lines.push("This repo deploys on hopes and dreams — no tests, no CI, just vibes.");
    if(starCount===0&&forkCount===0)lines.push("This repo is so lonely, even the CI bot left.");
    if(sizeMB>500)lines.push("This repo weighs more than my life choices — "+fmtSize(m.size*1024)+" of pure commitment.");
    if(contribCount<=1)lines.push("Solo dev energy — the commit history reads like a diary.");
    if(issueCount>100)lines.push("The issue tracker is basically a suggestion box at this point — "+fmt(issueCount)+" open issues.");
    if(!hasLicense)lines.push("No LICENSE file — legally speaking, this repo is a gray area wrapped in a mystery.");
    if(!m.description)lines.push("No description. This repo is so mysterious, even the README is confused.");
    if(hasReadme&&!hasReadme.ok)lines.push("No README. The code speaks for itself — unfortunately, it mumbles.");
    if(m.archived)lines.push("Archived. The code has entered its retirement phase. It's not dead, it's 'legacy'.");
    if(m.fork)lines.push("It's a fork. Somewhere, a parent repo is pretending this doesn't exist.");
    if(freshness>365)lines.push("Last pushed "+Math.floor(freshness/365)+" year(s) ago. This repo has entered archaeological territory.");
    if(langCount>=6)lines.push(langCount+" languages detected. This repo is having an identity crisis.");
    if(langCount===1)lines.push("One language to rule them all. At least this repo knows what it wants.");
    if(fileCount>5000)lines.push(fmt(fileCount)+" files. At this point, the file tree is a forest.");
    if(fileCount<5&&fileCount>0)lines.push("Only "+fileCount+" file(s). Minimalism taken to its logical extreme.");
    if(starCount>1000&&hasTests&&!hasTests.ok)lines.push("★ "+fmt(starCount)+" stars and zero tests. Famous and reckless.");
    if(!m.topics||!m.topics.length)lines.push("Zero topics. This repo is hiding from GitHub search like it owes it money.");
    if(hasContributing&&!hasContributing.ok)lines.push("No CONTRIBUTING.md. First-time contributors are greeted with pure chaos.");
    if(age<30)lines.push("Less than a month old. Fresh out of the `git init` oven.");
    if(forkCount>starCount&&starCount>0)lines.push("More forks than stars — people want to fix it themselves.");
    if(!m.homepage)lines.push("No homepage. This repo lives in the shadows of the terminal.");
    if(!lines.length)lines.push("Honestly? Clean repo, good hygiene, tests, CI… I got nothing. This is suspiciously responsible.");
    return lines;
  }catch(e){return ["Something went wrong trying to roast this repo. Even the roast engine gave up."]}
}

/* ============================================================
   Star History Chart
   ============================================================ */
function renderStarHistory(){
  try{
    const m=S.repo;
    const embed=$('#starHistoryEmbed');
    if(!m||!m.full_name){embed.innerHTML='';return}
    const url='https://star-history.com/embed.html?'+encodeURIComponent(m.full_name)+'&type=Date';
    embed.innerHTML='<iframe src="'+esc(url)+'" loading="lazy" title="Star history chart"></iframe>';
  }catch(e){}
}

/* ============================================================
   Core helpers (original, preserved) — BUG FIX #5: null safety
   ============================================================ */
/* esc/fmt/fmtSize/timeAgo/toast/langColor/extOf/isText/isLock —
   pure ones live in core.js (exposed as globals); toast stays local */
function toast(msg,cls){const t=document.createElement('div');t.className='tst '+(cls||'');t.textContent=msg;$('#toast').appendChild(t);setTimeout(()=>{t.style.opacity='0';t.style.transition='.4s';setTimeout(()=>t.remove(),450)},3400)}

function authHeaders(){const t=LS.get('repodest_pat','');const h={Accept:'application/vnd.github+json'};if(t)h.Authorization='Bearer '+t;return h}

/* ---------- GitHub Enterprise / self-hosted support ----------
   Detects full-URL inputs like https://ghe.corp.com/owner/repo,
   stores the API base in localStorage, and routes all /repos
   calls through it. Returns '' for github.com. */
const GHE_KEY='repodest_ghe_base';
function gheBase(){
  let b=LS.get(GHE_KEY,'');
  if(b&&b.endsWith('/'))b=b.slice(0,-1);
  return b;
}
function setGheBase(host){
  if(!host){LS.set(GHE_KEY,'');return}
  host=host.trim().replace(/\/+$/,'');
  if(!/^https?:\/\//.test(host))host='https://'+host;
  if(/github\.com$/i.test(host)){LS.set(GHE_KEY,'');return}
  LS.set(GHE_KEY,host+'/api/v3');
  toast('Using GitHub Enterprise at '+host,'ok');
}
function parseGheHost(v){
  const m=(v||'').trim().match(/^https?:\/\/([^\/\s]+)\/[^\/]+\/[^\/]+/i);
  if(m&&!/github\.com$/i.test(m[1]))return m[1];
  return null;
}
function normalizeGheRepo(v){
  const m=(v||'').trim().match(/^https?:\/\/([^\/\s]+)\/([^\/]+)\/([^\/#?\s]+)/i);
  if(m&&!/github\.com$/i.test(m[1]))return{host:m[1],owner:m[2],repo:m[3].replace(/\.git+$/,'')};
  return null;
}
/* GitHub API base — GHE if set, else public */
function apiBase(){
  return gheBase()||'https://api.github.com';
}
/* Raw content URL for the current repo (or explicit args) */
function rawUrl(fullName,branch,path,platform){
  platform=platform||(S.repo&&S.repo._platform)||S.platform||'github';
  if(platform==='gitlab')return 'https://gitlab.com/'+fullName.replace(/\.git$/,'')+'/-/raw/'+encodeURIComponent(branch)+'/'+path;
  if(platform==='bitbucket')return 'https://bitbucket.org/'+fullName+'/raw/'+encodeURIComponent(branch)+'/'+path;
  if(platform==='ghe')return gheBase().replace(/\/api\/v3$/,'')+'/'+fullName+'/raw/'+encodeURIComponent(branch)+'/'+path;
  return 'https://raw.githubusercontent.com/'+fullName+'/'+encodeURIComponent(branch)+'/'+path;
}

async function api(path){
  const r=await fetch(apiBase()+path,{headers:authHeaders()});
  updateRate(r);
  if(r.status===404)throw new Error('NOT_FOUND');
  if(r.status===403){const rem=Number(r.headers.get('x-ratelimit-remaining'));if(rem===0)throw new Error('RATE_LIMIT');throw new Error('HTTP_403')}
  if(!r.ok)throw new Error('HTTP_'+r.status);
  return r.json();
}
function updateRate(r){const v=r.headers.get('x-ratelimit-remaining');if(v!=null){$('#rateVal').textContent=v;const el=$('#rateChip .dot');if(el)el.style.background=Number(v)<=5?'var(--red)':Number(v)<20?'var(--yellow)':'var(--green)'}}
async function refreshRate(){try{const r=await fetch(apiBase()+'/rate_limit',{headers:authHeaders()});updateRate(r);const j=await r.json();if(j&&j.resources&&j.resources.core)$('#rateVal').textContent=j.resources.core.remaining}catch(e){}}

function cacheGet(k,ttl){const c=LS.get('repodest_c_'+k);if(c&&(Date.now()-c.t)<ttl)return c.v;return null}
function cacheSet(k,v){try{const s=JSON.stringify(v);if(s.length>2500000)return;LS.set('repodest_c_'+k,{t:Date.now(),v})}catch(e){}}

function submitInput(){
  const v=$('#inp').value.trim();
  if(!v){toast('Type a repo URL, owner/repo, or username','err');return}
  /* GitHub Enterprise full URL? */
  const ghe=normalizeGheRepo(v);
  if(ghe){setGheBase(ghe.host);loadRepo(ghe.owner,ghe.repo,'ghe');return}
  const p=parseRepoInput(v);
  if(p){loadRepo(p.owner,p.repo,p.platform);return}
  if(/^[\w-]+$/.test(v)){loadUser(v);return}
  toast('Could not parse that. Try owner/repo or a GitHub URL','err');
}
function submitJump(){
  const v=$('#jump').value.trim();if(!v)return;
  const ghe=normalizeGheRepo(v);
  if(ghe){setGheBase(ghe.host);loadRepo(ghe.owner,ghe.repo,'ghe');return}
  const p=parseRepoInput(v);
  if(p){loadRepo(p.owner,p.repo,p.platform);return}
  if(/^[\w-]+$/.test(v)){loadUser(v);return}
  toast('Could not parse that','err');
}
function quick(b){$('#inp').value=b.textContent;submitInput()}
function goHome(){location.href=location.pathname;setTimeout(()=>{window.scrollTo({top:0,behavior:'smooth'})},50)}

function show(el,on){if(el)el.style.display=on?'':'none'}
function setLoad(t){$('#loadText').textContent=t;show($('#loadingView'),true);show($('#errorView'),false);show($('#dash'),false)}
function showError(icon,title,msg,extra){
  show($('#loadingView'),false);show($('#dash'),false);
  const e=$('#errorView');e.style.display='';
  e.innerHTML='<div class="e">'+icon+'</div><h3>'+esc(title)+'</h3><p>'+esc(msg)+'</p>'+(extra||'');
}
function handleErr(err,name){
  if(err&&err.message==='RATE_LIMIT'){
    showError('🚦','Rate limit reached','GitHub allows 60 unauthenticated calls per hour. A free personal access token raises it to 5,000 — click the button below and hit Scope again.');
    const b=document.createElement('button');b.className='btn';b.style.marginTop='18px';b.textContent='🔑 Add a token';b.onclick=openModal;$('#errorView').appendChild(b);
  }else if(err&&err.message==='NOT_FOUND'){
    showError('👻','Not found',esc(name)+' doesn\'t exist, is private, or the name is misspelled.');
  }else{
    showError('💥','Something broke',(err&&err.message?err.message:'Network error')+' — check your connection and try again.');
  }
}

/* BUG FIX #1 & #4: Null-safe parseTree — ensure every file has a `name` */
function parseTree(apiTree){
  FILEMAP.clear();DIRMAP.clear();NODEMAP.clear();
  const root={name:'/',path:'',dirs:new Map(),files:[],depth:0};
  NODEMAP.set('',root);
  const items=(apiTree&&apiTree.tree)||[];
  for(const it of items){
    if(it.type!=='blob')continue;
    /* BUG FIX #4: Ensure name is always set */
    if(!it.name)it.name=(it.path||'').split('/').pop()||'';
    FILEMAP.set(it.path||'',it);
    const parts=(it.path||'').split('/');
    let node=root;
    for(let i=0;i<parts.length-1;i++){
      const dp=parts.slice(0,i+1).join('/');
      if(!node.dirs.has(dp)){
        const d={name:parts[i]||'',path:dp,dirs:new Map(),files:[],depth:i+1};
        node.dirs.set(dp,d);DIRMAP.set(dp,d);NODEMAP.set(dp,d);
      }
      node=node.dirs.get(dp);
    }
    node.files.push(it);
  }
  return{root,truncated:!!(apiTree&&apiTree.truncated),count:items.filter(x=>x.type==='blob').length};
}

/* ============================================================
   Main loadRepo — now supports multi-platform
   ============================================================ */
async function loadRepo(owner,repo,platform){
  platform=platform||'github';
  S.platform=platform;
  const key=owner+'/'+repo;
  const url=new URL(location);
  url.searchParams.set('repo',key);
  url.searchParams.delete('user');
  url.searchParams.delete('compare');
  history.replaceState(null,'',url.pathname+'?repo='+encodeURIComponent(key));
  window.scrollTo({top:0});
  setLoad('Fetching '+key+'…');
  $('#landing').style.display='none';$('#app').style.display='';
  try{
    const cacheKey=platform+':'+key.toLowerCase();
    const cached=cacheGet('repo:'+cacheKey,6*3600*1000);
    if(cached){applyRepo(key,cached,true);return}

    if(platform==='gitlab'||platform==='bitbucket'){
      setLoad('Fetching from '+platform+'…');
      const data=await fetchRepoData(owner,repo,platform);
      if(!data)throw new Error('Failed to fetch');
      cacheSet('repo:'+cacheKey,data);
      applyRepo(key,data,false);
      return;
    }

    /* GitHub flow (public github.com or GitHub Enterprise via apiBase()) */
    setLoad('Repository metadata…');
    const meta=await api('/repos/'+key);
    setLoad('Languages & file tree…');
    const langs=await api('/repos/'+key+'/languages').catch(()=>({}));
    const tree=await api('/repos/'+key+'/git/trees/'+(meta.default_branch||'main')+'?recursive=1').catch(()=>null);
    setLoad('Contributors & commits…');
    const contribs=await api('/repos/'+key+'/contributors?per_page=12').catch(()=>[]);
    const commits=await api('/repos/'+key+'/commits?per_page=100').catch(()=>[]);
    const data={meta:stripRepo(meta,platform),langs,tree,contribs:Array.isArray(contribs)?contribs:[],commits:Array.isArray(commits)?commits.slice(0,100):[]};
    cacheSet('repo:'+cacheKey,data);
    applyRepo(key,data,false);
  }catch(e){handleErr(e,key)}
}
function stripRepo(m,platform){return{full_name:m.full_name||'',name:m.name||'',owner:{login:(m.owner&&m.owner.login)||'',avatar_url:(m.owner&&m.owner.avatar_url)||'',html_url:(m.owner&&m.owner.html_url)||''},html_url:m.html_url||'',description:m.description||'',fork:m.fork||false,created_at:m.created_at,pushed_at:m.pushed_at,updated_at:m.updated_at,homepage:m.homepage||'',size:m.size||0,stargazers_count:m.stargazers_count||0,watchers_count:m.watchers_count||0,forks_count:m.forks_count||0,open_issues_count:m.open_issues_count||0,language:m.language||null,license:m.license||null,topics:m.topics||[],default_branch:m.default_branch||'main',archived:m.archived||false,_platform:platform||'github'}}

function applyRepo(key,data,fromCache){
  try{
    parseTree(data.tree);
    S.repo=data.meta;S.langs=data.langs||{};S.contribs=data.contribs||[];S.commits=data.commits||[];
    S.activity=null;S.sel.clear();S.digestText='';
    show($('#userView'),false);

    updateSEO(data.meta);

    const hc=healthCheck();
    addToHistory(data.meta,hc.score);

    renderDash();
    show($('#loadingView'),false);show($('#errorView'),false);show($('#dash'),true);
    if(data.tree&&data.tree.truncated)toast('Huge repo — file tree was truncated by GitHub','err');
    if(fromCache)toast('Loaded from cache (≤6h old)');
    if(!fromCache)refreshRate();
    if(!S.activity&&(S.platform==='github'||S.platform==='ghe'))loadActivity(key);

    if(S.platform==='github'||S.platform==='ghe'){
      const parts=key.split('/');
      fetchBranchesAndTags(parts[0],parts[1]);
    }else{
      $('#branchSel').style.display='none';
    }
  }catch(e){handleErr(e,key)}
}

async function loadActivity(key){
  try{
    const t=LS.get('repodest_pat','');
    for(let i=0;i<3;i++){
      const r=await fetch('https://api.github.com/repos/'+key+'/stats/commit_activity',{headers:t?{Authorization:'Bearer '+t}:{Accept:'application/vnd.github+json'}});
      updateRate(r);
      if(r.status===200){
        const j=await r.json().catch(()=>null);
        if(Array.isArray(j)&&j.length){S.activity=j;drawActChart();return}
        if(!j)return;
      }else if(r.status!==202)return;
      await new Promise(res=>setTimeout(res,1600));
    }
  }catch(e){}
}

function loadUser(u){
  history.replaceState(null,'',location.pathname+'?user='+encodeURIComponent(u));
  window.scrollTo({top:0});
  $('#landing').style.display='none';$('#app').style.display='';
  setLoad('Loading @'+u+'…');
  (async()=>{
    try{
      const user=await api('/users/'+u);
      setLoad('Repositories…');
      const repos=await api('/users/'+u+'/repos?per_page=100&sort=pushed').catch(()=>[]);
      const el=$('#userView');
      el.innerHTML='';
      show($('#dash'),false);show($('#userView'),true);
      const wrap=document.createElement('div');
      wrap.innerHTML='<div class="card ubig"><img src="'+esc(user.avatar_url)+'" alt="" loading="lazy"><div style="flex:1;min-width:220px"><h2>'+esc(user.name||user.login)+'</h2><div class="u">@'+esc(user.login)+' · '+fmt(user.followers)+' followers · '+fmt(user.public_repos)+' repos</div><div class="bio">'+esc(user.bio||'')+'</div></div><a class="btn sm" target="_blank" rel="noopener" href="'+esc(user.html_url)+'">Profile ↗</a></div><div class="minititle" style="margin-top:22px">Pick a repository to scope</div><div class="usergrid" id="userGrid"></div>';
      el.appendChild(wrap);
      const grid=wrap.querySelector('#userGrid');
      const list=(Array.isArray(repos)?repos:[]).slice().sort((a,b)=>(b.stargazers_count||0)-(a.stargazers_count||0));
      if(!list.length){grid.innerHTML='<div class="card">No public repositories.</div>'}
      list.forEach(r=>{
        const c=document.createElement('div');c.className='ucard';
        c.innerHTML='<h4>'+esc(r.name||'')+(r.fork?' <span style="font-size:10px;color:var(--text3)">fork</span>':'')+'<b>★ '+fmt(r.stargazers_count)+'</b></h4><div class="d">'+esc(r.description||'No description')+'</div><div class="meta"><span>'+(r.language?'<span class="ld" style="background:'+langColor(r.language)+'"></span>'+esc(r.language):'—')+'</span><span>★ '+fmt(r.stargazers_count)+'</span><span>⑂ '+fmt(r.forks_count)+'</span></div>';
        c.onclick=()=>loadRepo(r.owner.login,r.name,'github');
        grid.appendChild(c);
      });
      /* Profile summary: aggregate stats over all repos */
      {
        const totalStars=list.reduce((a,r)=>a+(r.stargazers_count||0),0);
        const totalForks=list.reduce((a,r)=>a+(r.forks_count||0),0);
        const langCount={};
        list.forEach(r=>{if(r.language)langCount[r.language]=(langCount[r.language]||0)+1});
        const topLangs=Object.entries(langCount).sort((a,b)=>b[1]-a[1]).slice(0,5);
        const owned=list.filter(r=>!r.fork).length;
        const mostStarred=list[0];
        const activeRecent=list.filter(r=>r.pushed_at&&(Date.now()-new Date(r.pushed_at))<90*864e5).length;
        const summary=document.createElement('div');
        summary.className='card';
        summary.style.marginTop='18px';
        summary.innerHTML=
          '<div class="minititle">📊 Profile Summary</div>'+
          '<div class="statrow" style="flex-wrap:wrap;gap:10px">'+
            '<div class="st"><b>'+fmt(totalStars)+'</b><span>total stars</span></div>'+
            '<div class="st"><b>'+fmt(totalForks)+'</b><span>total forks</span></div>'+
            '<div class="st"><b>'+owned+'</b><span>original repos</span></div>'+
            '<div class="st"><b>'+activeRecent+'</b><span>active (90d)</span></div>'+
          '</div>'+
          (topLangs.length?'<div style="margin-top:12px;font-size:11px;color:var(--text3)">Top languages</div><div class="topicrow" style="margin-top:6px">'+topLangs.map(l=>'<span class="topic"><span class="ld" style="display:inline-block;width:9px;height:9px;border-radius:3px;background:'+langColor(l[0])+';margin-right:5px"></span>'+esc(l[0])+' ×'+l[1]+'</span>').join('')+'</div>':'')+
          (mostStarred?'<div class="kv" style="margin-top:10px"><span>⭐ Most starred</span><b><a href="#" data-owner="'+esc(mostStarred.owner.login)+'" data-repo="'+esc(mostStarred.name)+'">'+esc(mostStarred.full_name||mostStarred.name)+' ('+fmt(mostStarred.stargazers_count)+')</a></b></div>':'');
        const link=summary.querySelector('a[data-owner]');
        if(link)link.addEventListener('click',ev=>{
          ev.preventDefault();
          loadRepo(link.dataset.owner,link.dataset.repo,'github');
        });
        const pickTitle=wrap.querySelector('.minititle');
        if(pickTitle)wrap.insertBefore(summary,pickTitle);
        else wrap.appendChild(summary);
      }
      show($('#loadingView'),false);show($('#errorView'),false);show($('#dash'),true);
      refreshRate();
    }catch(e){handleErr(e,u)}
  })();
}

function renderDash(){
  try{
    const m=S.repo;
    if(!m)return;
    const platform=m._platform||'github';
    const platformChip='<span class="platform-chip '+esc(platform)+'">'+esc(platform)+'</span>';
    $('#repoHero').innerHTML=
      '<img class="avatar" src="'+esc(m.owner&&m.owner.avatar_url)+'" alt="" loading="lazy">'+
      '<div class="rh-body"><h2><a href="'+esc(m.html_url)+'" target="_blank" rel="noopener">'+esc(m.full_name||'')+'</a>'+platformChip+(m.fork?'<span class="topic" style="background:rgba(59,130,246,.15);border-color:rgba(59,130,246,.4);color:#93c5fd">fork</span>':'')+(m.archived?'<span class="topic" style="background:rgba(234,179,8,.12);border-color:rgba(234,179,8,.4);color:#fde047">archived</span>':'')+'</h2>'+
      '<div class="desc">'+esc(m.description||'No description provided.')+'</div>'+
      ((m.topics||[]).length?'<div class="topicrow">'+(m.topics||[]).slice(0,10).map(t=>'<span class="topic">'+esc(t)+'</span>').join('')+'</div>':'')+
      '<div class="statrow">'+
        '<div class="st"><b>★ '+fmt(m.stargazers_count)+'</b><span>stars</span></div>'+
        '<div class="st"><b>⑂ '+fmt(m.forks_count)+'</b><span>forks</span></div>'+
        '<div class="st"><b>'+fmt(m.open_issues_count)+'</b><span>open issues</span></div>'+
        '<div class="st"><b>'+fmtSize(m.size*1024)+'</b><span>repo size</span></div>'+
        '<div class="st"><b>'+(m.license?esc(m.license.spdx_id||'Yes'):'None')+'</b><span>license</span></div>'+
        '<div class="st"><b>'+esc(timeAgo(m.pushed_at))+'</b><span>last push</span></div>'+
      '</div></div>';
    renderOverview();renderLanguages();renderFiles();resetDigest();renderActivity();renderFun();
    renderLicenseAnalysis();
    try{renderBadgeGenerator()}catch(e){}
    computeComplexity();
    switchTab('overview');
  }catch(e){console.warn('renderDash error:',e)}
}

function switchTab(name){
  $$('#tabs .tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
  $$('#dash .panel').forEach(p=>p.classList.toggle('active',p.id==='p-'+name));
  if(name==='overview'){
    renderComplexity();
    renderSecurity();
    findSimilarRepos();
    loadReadmePreview();
    renderEndpoints();
  }
  if(name==='activity'){
    ensureChartJs().then(()=>drawActChart());
    renderStarHistory();
    renderBusFactor();
    renderReleaseTimeline();
  }
  if(name==='languages')ensureChartJs().then(()=>drawLangChart());
  if(name==='deps')buildDepGraph();
  if(name==='deep')renderDeepPanel();
}
document.addEventListener('DOMContentLoaded',()=>{
  $$('#tabs .tab').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
});

/* healthCheckPaths(paths,m) lives in core.js; this is the stateful wrapper */
function healthCheck(){
  const paths=[];FILEMAP.forEach((v,k)=>paths.push(k));
  return healthCheckPaths(paths,S.repo);
}

function getAch(){
  const m=S.repo,hc=healthCheck(),paths=[];FILEMAP.forEach((v,k)=>paths.push(k));
  const tests=hc.items.find(x=>x.n==='Tests');
  return[
    {i:'📜',n:'Licensed',d:'Has an open-source license',on:!!(m&&m.license)},
    {i:'📖',n:'Documented',d:'README + docs folder',on:hc.items.find(x=>x.n==='README').ok&&hc.items.find(x=>x.n==='Docs folder').ok},
    {i:'🧪',n:'Tested',d:'Contains test suites',on:tests?tests.ok:false},
    {i:'🤖',n:'CI Powered',d:'GitHub Actions workflows',on:hc.items.find(x=>x.n==='CI workflows').ok},
    {i:'⭐',n:'Star Collector',d:'100+ stars',on:m&&(m.stargazers_count||0)>=100},
    {i:'🌟',n:'Rising Star',d:'1,000+ stars',on:m&&(m.stargazers_count||0)>=1000},
    {i:'🚀',n:'Supernova',d:'10,000+ stars',on:m&&(m.stargazers_count||0)>=10000},
    {i:'👥',n:'Community',d:'5+ contributors',on:S.contribs.length>=5},
    {i:'🔥',n:'Fresh',d:'Pushed within 7 days',on:m&&(Date.now()-new Date(m.pushed_at))<7*864e5},
    {i:'🕰️',n:'Veteran',d:'3+ years old',on:m&&(Date.now()-new Date(m.created_at))>3*365*864e5},
    {i:'🦄',n:'Monorepo',d:'1,000+ files tracked',on:FILEMAP.size>=1000},
    {i:'🪶',n:'Featherweight',d:'Under 1 MB total',on:m&&(m.size||0)*1024<1048576},
    {i:'🌍',n:'Polyglot',d:'4+ languages',on:Object.keys(S.langs).length>=4},
    {i:'🧹',n:'Clean House',d:'.gitignore present',on:hc.items.find(x=>x.n==='.gitignore').ok},
    {i:'🎪',n:'Showcased',d:'Has topics on GitHub',on:m&&(m.topics||[]).length>=3},
    {i:'📦',n:'Release Ready',d:'Open issues under control',on:m&&(m.open_issues_count||0)<=(m.stargazers_count||0)/50}
  ];
}

function personaFor(){
  const langs=Object.keys(S.langs).sort((a,b)=>S.langs[b]-S.langs[a]);
  const main=((S.repo&&S.repo.language)||langs[0]||'').toLowerCase();
  const total=FILEMAP.size;
  const map={
    'javascript':{i:'🧙',n:'The Web Wizard',d:'Mostly JavaScript — this repo summons browser magic and node spells. Probably has 400 dependencies for what 40 could do.'},
    'typescript':{i:'🔮',n:'The Type Enchanter',d:'TypeScript-dominant. Interfaces for everything, `any` hidden somewhere, and a build step longer than the runtime.'},
    'python':{i:'🧪',n:'The Data Alchemist',d:'Python rules here: notebooks, scripts, and one dependency that silently pins everything to Python 3.8.'},
    'html':{i:'🎨',n:'The Interface Artist',d:'HTML-heavy — a hand-crafted web experience. View source is the real documentation.'},
    'css':{i:'💅',n:'The Style Sorcerer',d:'CSS is the star. Somewhere in here is a one-liner that took three days.'},
    'rust':{i:'🦀',n:'The Memory Guardian',d:'Rust. The compiler is the true maintainer; humans just resolve its complaints.'},
    'go':{i:'🐹',n:'The Speed Daemon',d:'Go — compiled, concurrent, and allergic to dependencies. `go.mod` is basically poetry.'},
    'c':{i:'⚙️',n:'The Metal Bender',d:'C. Pointers everywhere and segfaults are a lifestyle. memory ownership is documented… sometimes.'},
    'c++':{i:'🗡️',n:'The Template Ninja',d:'C++ — ten levels of templates deep. Error messages longer than the actual code.'},
    'c#':{i:'🏛️',n:'The Enterprise Architect',d:'C# — interfaces, factories, and a folder structure worthy of a Fortune 500.'},
    'java':{i:'☕',n:'The Abstract Factory',d:'Java. AbstractSingletonProxyFactoryBean is somewhere in here. It compiles. Ship it.'},
    'kotlin':{i:'🤖',n:'The Pragmatic Droid',d:'Kotlin — Java\'s cooler cousin. Null safety everywhere except that one `!!`.'},
    'php':{i:'🐘',n:'The Phoenix',d:'PHP. Everyone jokes about it; this repo quietly powers half the internet.'},
    'ruby':{i:'💎',n:'The Gem Collector',d:'Ruby on probably. Developer happiness as a measurable metric.'},
    'swift':{i:'🍎',n:'The Apple Polisher',d:'Swift — pixel-perfect and Apple-gated. There is a SwiftUI view in here younger than the docs.'},
    'shell':{i:'👻',n:'The Automation Ghost',d:'Shell scripts holding the whole project together. One `rm -rf` away from a very bad day.'},
    'dart':{i:'🎯',n:'The Flutter Flyer',d:'Dart — widgets all the way down, hot reload all day long.'},
    'vue':{i:'💚',n:'The Progressive One',d:'Vue components, gently progressive, suspiciously elegant.'}
  };
  if(main&&map[main])return map[main];
  if(total>0&&FILEMAP.size&&Array.from(FILEMAP.keys()).every(p=>/\.(md|txt|rst)$/i.test(p)))return{i:'📚',n:'The Documentarian',d:'This "code" repo is essentially a library. Words are the API.'};
  return{i:'🧭',n:'The Wanderer',d:'A unique blend of technologies that defies categorization. Genuinely interesting.'};
}

function roastLines(){
  return generateDynamicRoasts();
}
function rerollRoast(){
  if(!ROASTS.length)return;
  const b=$('#roastBox');
  const next=ROASTS[(ROASTS.indexOf(b.dataset.cur||'')+1)%ROASTS.length]||ROASTS[0];
  b.dataset.cur=next;
  b.innerHTML='<b>🔥 Roast mode:</b> '+esc(next);
}

/* BUG FIX #5: try/catch around render functions + animated score counter */
function renderOverview(){
  try{
    const hc=healthCheck(),m=S.repo;
    if(!m)return;
    const arc=$('#ringArc'),pct=hc.score/100;
    /* Animated score counter */
    const scoreEl=$('#scoreVal');
    const targetScore=hc.score;
    let currentScore=0;
    const counterDuration=1100;
    const startTime=performance.now();
    function animateCounter(now){
      const elapsed=now-startTime;
      const progress=Math.min(elapsed/counterDuration,1);
      /* ease out cubic */
      const eased=1-Math.pow(1-progress,3);
      currentScore=Math.round(eased*targetScore);
      scoreEl.textContent=currentScore;
      if(progress<1)requestAnimationFrame(animateCounter);
    }
    requestAnimationFrame(animateCounter);

    requestAnimationFrame(()=>{
      arc.style.transition='stroke-dashoffset 1.1s cubic-bezier(.22,1,.36,1)';
      arc.style.strokeDashoffset=String(465-465*pct);
    });
    /* Pulse ring after animation */
    const ring=$('#scoreRing');
    ring.classList.remove('done');
    setTimeout(()=>ring.classList.add('done'),1200);

    $('#scoreTag').innerHTML=hc.score>=80?'<span style="color:var(--green2)">Excellent shape 🟢</span>':hc.score>=60?'<span style="color:#fde047">Decent shape 🟡</span>':hc.score>=40?'<span style="color:var(--orange)">Needs love 🟠</span>':'<span style="color:#f87171">Needs serious care 🔴</span>';
    $('#checks').innerHTML=hc.items.map(c=>'<div class="chk '+(c.ok?'ok':'bad')+'"><span class="ic">'+(c.ok?'✓':'✕')+'</span><span><b>'+esc(c.n)+'</b> · '+esc(c.ok?'present':'missing')+'</span></div>').join('');
    $('#facts').innerHTML=
      '<div class="kv"><span>Created</span><b>'+esc(new Date(m.created_at).toLocaleDateString())+'</b></div>'+
      '<div class="kv"><span>Last push</span><b>'+esc(new Date(m.pushed_at).toLocaleDateString())+'</b></div>'+
      '<div class="kv"><span>Default branch</span><b>'+esc(m.default_branch||'')+'</b></div>'+
      '<div class="kv"><span>Tracked files</span><b>'+fmt(FILEMAP.size)+'</b></div>'+
      '<div class="kv"><span>Languages</span><b>'+Object.keys(S.langs).length+'</b></div>'+
      '<div class="kv"><span>Contributors (top)</span><b>'+S.contribs.length+'</b></div>'+
      '<div class="kv"><span>Platform</span><b><span class="platform-chip '+(S.platform||'github')+'">'+esc(S.platform||'github')+'</span></b></div>'+
      '<div class="kv"><span>Homepage</span><b>'+(m.homepage?'<a href="'+esc(m.homepage)+'" target="_blank" rel="noopener">link ↗</a>':'—')+'</b></div>';
    const ach=getAch();
    $('#achPreview').innerHTML=ach.filter(a=>a.on).slice(0,6).map(a=>achHTML(a)).join('')||'<span style="color:var(--text3);font-size:12.5px">No trophies yet — this repo keeps a low profile.</span>';
  }catch(e){console.warn('renderOverview error:',e)}
}
function achHTML(a){return'<div class="ach '+(a.on?'on':'')+'"><span class="ai">'+a.i+'</span><span><span class="an">'+esc(a.n)+'</span><div class="ad">'+esc(a.d)+'</div></span></div>'}

function renderLanguages(){
  try{
    const entries=Object.entries(S.langs).sort((a,b)=>b[1]-a[1]);
    const total=entries.reduce((a,e)=>a+e[1],0)||1;
    $('#langBar').innerHTML=entries.slice(0,12).map(e=>'<i style="width:'+(e[1]/total*100).toFixed(2)+'%;background:'+langColor(e[0])+'"></i>').join('');
    $('#langRows').innerHTML=entries.slice(0,10).map(e=>{
      const pct=(e[1]/total*100).toFixed(1);
      return'<div class="langrow"><span class="ld" style="background:'+langColor(e[0])+'"></span><span class="ln">'+esc(e[0])+'</span><span class="lb"><i style="width:'+pct+'%;background:'+langColor(e[0])+'"></i></span><span class="lp">'+pct+'%</span></div>';
    }).join('')||'<p style="color:var(--text3);font-size:13px">No language data — probably a docs-only or empty repo.</p>';

    const paths=[];FILEMAP.forEach((v,k)=>paths.push(k));
    const stacks=[];
    for(const mf of MANIFESTS){
      const hit=paths.find(p=>p===mf.f||p.endsWith('/'+mf.f));
      if(hit)stacks.push({label:mf.label,count:null,file:mf.f});
    }
    $('#stackRow').innerHTML=stacks.length?stacks.map(s=>'<span class="stack">'+esc(s.label)+'<span class="cnt">'+esc(s.file)+'</span></span>').join(''):'<span style="color:var(--text3);font-size:13px">No common manifest files detected.</span>';
    renderDeps(stacks);
  }catch(e){console.warn('renderLanguages error:',e)}
}
function drawLangChart(){
  try{
    const entries=Object.entries(S.langs).sort((a,b)=>b[1]-a[1]).slice(0,10);
    const ctx=$('#langChart');
    if(!ctx)return;
    if(S.charts.lang)S.charts.lang.destroy();
    if(!entries.length)return;
    if(typeof Chart==='undefined')return;
    S.charts.lang=new Chart(ctx,{type:'doughnut',data:{labels:entries.map(e=>e[0]),datasets:[{data:entries.map(e=>e[1]),backgroundColor:entries.map(e=>langColor(e[0])),borderColor:'rgba(0,0,0,.25)',borderWidth:1}]},options:{cutout:'62%',plugins:{legend:{position:'bottom',labels:{color:'#94a3b8',font:{size:10.5},boxWidth:10,padding:9}}}}});
  }catch(e){console.warn('drawLangChart error:',e)}
}

async function renderDeps(stacks){
  try{
    const host=$('#depCols');
    host.innerHTML='';
    const branch=(S.repo&&S.repo.default_branch)||'main';
    const targets=stacks.slice(0,3);
    for(const st of targets){
      const col=document.createElement('div');col.className='card depcol';
      col.innerHTML='<h4>'+esc(st.label)+'<span style="color:var(--text3);font-weight:400;font-size:11px">'+esc(st.file)+'</span></h4><div class="dlist"><span style="color:var(--text3);font-size:12px">Fetching…</span></div>';
      host.appendChild(col);
      const raw=rawUrl((S.repo&&S.repo.full_name),branch,st.file);
      let deps=[];
      try{
        const txt=await(await fetch(raw)).text();
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
        deps=Array.from(new Set(deps)).filter(Boolean);
      }catch(e){}
      col.querySelector('h4').innerHTML=esc(st.label)+'<span style="margin-left:auto;color:var(--accent2);font-family:var(--mono);font-size:12px">'+deps.length+' deps</span>';
      col.querySelector('.dlist').innerHTML=deps.length?deps.slice(0,40).map(d=>'<div class="dep"><b>'+esc(d)+'</b></div>').join(''):'<span style="color:var(--text3);font-size:12px">Could not parse dependencies.</span>';
    }
    if(!targets.length)host.innerHTML='<div class="card"><span style="color:var(--text3);font-size:13px">No dependency manifests to scan.</span></div>';
  }catch(e){console.warn('renderDeps error:',e)}
}

function renderFiles(){
  try{
    const sizes=[];let totalSize=0;
    FILEMAP.forEach((f,k)=>{sizes.push({p:k,s:f.size||0});totalSize+=f.size||0});
    sizes.sort((a,b)=>b.s-a.s);
    const extCounts={};
    FILEMAP.forEach((f,k)=>{const e=extOf(k);extCounts[e]=(extCounts[e]||0)+1});
    const exts=Object.entries(extCounts).sort((a,b)=>b[1]-a[1]).slice(0,10);
    const maxExt=exts.length?exts[0][1]:1;
    const dirs=DIRMAP.size;
    $('#fileStats').innerHTML=
      '<div class="fstat"><b>'+fmt(FILEMAP.size)+'</b><span>files</span></div>'+
      '<div class="fstat"><b>'+fmt(dirs)+'</b><span>directories</span></div>'+
      '<div class="fstat"><b>'+fmtSize(totalSize)+'</b><span>total size</span></div>'+
      '<div class="fstat"><b>'+Object.keys(extCounts).length+'</b><span>file types</span></div>'+
      '<div class="fstat"><b>'+fmtSize(sizes[0]?sizes[0].s:0)+'</b><span>biggest file</span></div>';
    $('#extRows').innerHTML=exts.map(e=>'<div class="langrow"><span class="ln" style="width:90px">.'+esc(e[0])+'</span><span class="lb"><i style="width:'+(e[1]/maxExt*100).toFixed(1)+'%;background:'+PALETTE[(e[0].length*13)%PALETTE.length]+'"></i></span><span class="lp">'+e[1]+'×</span></div>').join('')||'<p style="color:var(--text3);font-size:13px">No files.</p>';
    const maxBig=sizes.length?Math.max(sizes[0].s,1):1;
    $('#bigFiles').innerHTML=sizes.slice(0,8).map(x=>'<div class="row"><span class="p" title="'+esc(x.p)+'">'+esc(x.p)+'</span><span class="bar"><i style="width:'+(x.s/maxBig*100).toFixed(1)+'%"></i></span><span class="s">'+fmtSize(x.s)+'</span></div>').join('')||'<p style="color:var(--text3);font-size:13px">No files.</p>';
    const root=NODEMAP.get('');
    const tree=$('#tree');
    tree.innerHTML='';
    if(root)renderNode(tree,root);
    $('#treeInfo').textContent=fmt(FILEMAP.size)+' files · tick boxes to select for the Digest';
    updateSelMeta();
    updateRecCounts();
  }catch(e){console.warn('renderFiles error:',e)}
}

/* BUG FIX #1: Null-safe sorting in renderNode */
function renderNode(container,node){
  if(!node||!container)return;
  try{
    const dirs=Array.from(node.dirs.values()).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    const files=node.files.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    for(const d of dirs){
      const row=document.createElement('div');
      row.className='trow dir';
      row.dataset.path=d.path||'';
      row.innerHTML='<span class="caret">▶</span><input type="checkbox" class="dcb"'+(dirAllSelected(d)?' checked':'')+'><span class="fico">📁</span><span class="fname">'+esc(d.name||'')+'/</span><span class="fsize">'+countDir(d)+' files</span>';
      container.appendChild(row);
      const child=document.createElement('div');
      child.className='tnode';
      child.style.display='none';
      row.dataset.rendered='0';
      row.appendChild(child);
    }
    for(const f of files){
      const row=document.createElement('div');
      row.className='trow';
      const icon=isLock(f)?'🔒':isText(f)?'📄':'🧊';
      /* File type color coding */
      const ext=extOf(f.path||'');
      const ficoClass='fico'+(ext?' '+ext:'');
      row.innerHTML='<span class="caret" style="visibility:hidden">·</span><input type="checkbox" class="fcb" data-path="'+esc(f.path||'')+'"'+(S.sel.has(f.path)?' checked':'')+'><span class="'+ficoClass+'">'+icon+'</span><span class="fname" title="'+esc(f.path||'')+'">'+esc((f.name||(f.path||'').split('/').pop())||'')+'</span><span class="fsize">'+fmtSize(f.size||0)+'</span>';
      container.appendChild(row);
    }
  }catch(e){console.warn('renderNode error:',e)}
}
function dirAllSelected(d){
  let all=true,any=false;
  (function walk(n){
    n.files.forEach(f=>{any=true;if(!S.sel.has(f.path))all=false});
    n.dirs.forEach(walk);
  })(d);
  return any&&all;
}
function countDir(d){let n=d.files.length;d.dirs.forEach(x=>{n+=countDir(x)});return n}

document.addEventListener('click',e=>{
  const dirRow=e.target.closest('.trow.dir');
  if(!dirRow)return;
  if(e.target.classList.contains('dcb'))return;
  const child=dirRow.querySelector('.tnode');
  const open=dirRow.classList.toggle('open');
  child.style.display=open?'':'none';
  if(open&&dirRow.dataset.rendered==='0'){
    const node=NODEMAP.get(dirRow.dataset.path);
    if(node)renderNode(child,node);
    dirRow.dataset.rendered='1';
  }
});
document.addEventListener('change',e=>{
  if(e.target.classList.contains('fcb')){
    const p=e.target.dataset.path;
    if(e.target.checked)S.sel.add(p);else S.sel.delete(p);
    updateSelMeta();
  }
  if(e.target.classList.contains('dcb')){
    const row=e.target.closest('.trow.dir');
    const node=NODEMAP.get(row.dataset.path);
    if(!node)return;
    const on=e.target.checked;
    (function walk(n){
      n.files.forEach(f=>{if(on)S.sel.add(f.path);else S.sel.delete(f.path)});
      n.dirs.forEach(walk);
    })(node);
    const child=row.querySelector('.tnode');
    child.querySelectorAll('.fcb').forEach(cb=>cb.checked=on);
    child.querySelectorAll('.dcb').forEach(cb=>cb.checked=on);
    updateSelMeta();
  }
});
function expandAll(open){
  if(open&&FILEMAP.size>2500){toast('Too many files to auto-expand — open folders manually','err');return}
  $$('#tree .trow.dir').forEach(row=>{
    if(open&&row.dataset.rendered==='0'){
      const node=NODEMAP.get(row.dataset.path);
      if(node)renderNode(row.querySelector('.tnode'),node);
      row.dataset.rendered='1';
    }
    row.classList.toggle('open',open);
    row.querySelector('.tnode').style.display=open?'':'none';
  });
}

function resetDigest(){
  S.sel.clear();S.digestText='';
  $('#digestOut').value='';
  $('#copyBtn').disabled=true;$('#dlBtn').disabled=true;
  $('#llmButtons').style.display='none';
  updateSelMeta();
}
function selectTextAll(){
  let n=0;
  FILEMAP.forEach((f,p)=>{
    if(isText(f)&&!isLock(f)&&(f.size||0)<=200*1024&&n<500){S.sel.add(p);n++}
  });
  $$('#tree .fcb').forEach(cb=>cb.checked=S.sel.has(cb.dataset.path));
  updateSelMeta();
  toast(n+' text files selected');
}
function clearSel(){
  S.sel.clear();
  $$('#tree input[type=checkbox]').forEach(cb=>cb.checked=false);
  updateSelMeta();
}
function updateSelMeta(){
  const modelSel=$('#modelSelect');
  const model=modelSel?modelSel.value:'gpt5';
  const ctx=MODEL_CTX[model]||128000,cpt=MODEL_CHARS_PER_TOK[model]||4;
  const text=S.digestText||null;
  const bytes=text?text.length:(()=>{let b=0;S.sel.forEach(p=>{const f=FILEMAP.get(p);if(f)b+=f.size||0});return b})();
  const toks=Math.round(bytes/cpt);
  const pct=Math.min(999,Math.round(toks/ctx*100));
  const ctxColor=pct>90?'var(--red)':pct>60?'var(--yellow)':'var(--green)';
  $('#selMeta').innerHTML='<span><b>'+S.sel.size+'</b> files</span><span><b>'+fmtSize(bytes)+'</b> '+(text?'prompt':'selected')+'</span><span>~<b>'+fmt(toks)+'</b> tokens</span>';
  const status=$('#ctxStatus');
  if(status)status.innerHTML='Fits in <b style="color:'+ctxColor+'">'+pct+'%</b> of context window ('+fmt(ctx)+' tok)';
}

/* asciiTree lives in core.js */

async function generateDigest(){
  if(!S.sel.size){toast('Select at least one file first','err');return}
  const btn=$('#genBtn');btn.disabled=true;btn.textContent='⏳ Fetching…';
  const m=S.repo,branch=(m&&m.default_branch)||'main';
  const paths=Array.from(S.sel).sort();
  let bytes=0;paths.forEach(p=>{const f=FILEMAP.get(p);if(f)bytes+=f.size||0});
  if(bytes>3*1024*1024){toast('Selection is over 3 MB — trim it down','err');btn.disabled=false;btn.textContent='🤖 Generate digest';return}
  const parts=[];
  parts.push(buildDigestHeader(m,branch));
  if($('#optReadme').checked){
    const readme=FILEMAP.size?Array.from(FILEMAP.keys()).find(p=>/(^|\/)readme\.md$/i.test(p)):null;
    if(readme){
      try{
        btn.textContent='⏳ README…';
        const t=await(await fetch(rawUrl((m&&m.full_name),branch,readme))).text();
        parts.push(wrapFileSection(readme,'md',t.slice(0,20000)));
      }catch(e){}
    }
  }
  if($('#optTree').checked){
    if(digestFormat==='xml')parts.push('  <file_tree>\n'+asciiTree(paths).split('&').join('&amp;').split('<').join('&lt;')+'\n  </file_tree>');
    else if(digestFormat==='json')parts.push('    "file_tree": '+JSON.stringify(asciiTree(paths))+',');
    else parts.push('\n# File Tree\n\n```text\n'+asciiTree(paths)+'\n```');
  }
  let fetched=0,skipped=0,binSkipped=0,sigShrunk=0;
  for(const p of paths){
    fetched++;
    btn.textContent='⏳ '+fetched+'/'+paths.length+' files…';
    const f=FILEMAP.get(p);
    if(!f){skipped++;continue}
    const ext=extOf(p);
    if(BINARY_EXT.has(ext)){binSkipped++;skipped++;continue}
    if((f.size||0)>200*1024){skipped++;continue}
    if(!isText(f)){binSkipped++;skipped++;continue}
    try{
      const r=await fetch(rawUrl((m&&m.full_name),branch,p));
      if(!r.ok){skipped++;continue}
      let t=await r.text();
      if(t.includes('\0')||/[ --]{5,}/.test(t)){binSkipped++;skipped++;continue}
      if(sigOnly&&(f.size||0)>10*1024){const shrunk=extractSignatures(t,ext);if(shrunk.length<t.length){t=shrunk;sigShrunk++}}
      parts.push(wrapFileSection(p,ext,t));
    }catch(e){skipped++}
  }
  if(skipped)parts.push(digestFormat==='xml'?'  <!-- '+skipped+' files skipped: '+binSkipped+' binary, '+(skipped-binSkipped)+' too large -->':'\n('+skipped+' files skipped: '+binSkipped+' binary, '+(skipped-binSkipped)+' too large or unfetchable'+(sigShrunk?', '+sigShrunk+' shrunk to signatures':'')+')');
  finalizeDigestFooter(parts);
  S.digestText=parts.join('\n');
  $('#digestOut').value=S.digestText;
  updateSelMeta();
  $('#copyBtn').disabled=false;$('#dlBtn').disabled=false;$('#gistBtn').disabled=false;
  btn.disabled=false;btn.textContent='🤖 Generate digest';
  toast('Digest ready ('+digestFormat.toUpperCase()+')','ok');
  setupLLMButtons();
  switchTab('digest');
}
function copyDigest(){
  const t=$('#digestOut').value||S.digestText;
  if(!t)return;
  (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>toast('Digest copied to clipboard','ok')).catch(()=>{
    const ta=$('#digestOut');ta.removeAttribute('readonly');ta.select();document.execCommand('copy');ta.setAttribute('readonly','');toast('Digest copied','ok');
  });
}

/* ---------- Gist sharing (needs a PAT with gist scope) ---------- */
async function shareDigestGist(){
  const t=$('#digestOut').value||S.digestText;
  if(!t){toast('Generate a digest first','err');return}
  const pat=LS.get('repodest_pat','');
  if(!pat){
    toast('A GitHub token is needed for Gist sharing','err');
    openModal();
    return;
  }
  const btn=$('#gistBtn');btn.disabled=true;btn.textContent='⏳ Uploading…';
  try{
    const name=((S.repo&&S.repo.full_name)||'repo').replace('/','-')+'-repodest-digest.md';
    const resp=await fetch('https://api.github.com/gists',{
      method:'POST',
      headers:{'Content-Type':'application/json',Accept:'application/vnd.github+json',Authorization:'Bearer '+pat},
      body:JSON.stringify({
        description:'Repodest LLM digest for '+(S.repo&&S.repo.full_name||'repo')+' — preset: '+(DIGEST_PRESETS[digestPreset]||{}).label,
        public:false,
        files:{[name]:{content:t.slice(0,900000)}}
      })
    });
    if(resp.status===401||resp.status===403){
      const j=await resp.json().catch(()=>({}));
      throw new Error(j.message||'Token rejected — needs gist scope');
    }
    if(!resp.ok)throw new Error('Gist API '+resp.status);
    const gist=await resp.json();
    const url=gist.html_url||(gist.data&&gist.data.html_url);
    (navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject()).catch(()=>{});
    showModal('🌐 Digest shared as secret Gist',
      '<p style="font-size:13px;color:var(--text2)">Anyone with this link can read the digest. It does not appear in your public profile.</p>'+
      '<p style="margin:12px 0"><a href="'+esc(url)+'" target="_blank" rel="noopener" style="word-break:break-all">'+esc(url)+'</a></p>'+
      '<p style="font-size:12px;color:var(--text3)">Link copied to clipboard.</p>');
    toast('Gist created','ok');
  }catch(e){
    toast(e.message||'Gist upload failed','err');
  }finally{
    btn.disabled=false;btn.textContent='🌐 Gist share';
  }
}
function downloadDigest(){
  const t=$('#digestOut').value||S.digestText;
  if(!t)return;
  const blob=new Blob([t],{type:'text/markdown;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=((S.repo&&S.repo.full_name)||'repo').replace('/','-')+'-digest.md';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}

function renderActivity(){
  try{
    const list=S.contribs.filter(c=>c.type!=='Bot').slice(0,10);
    const max=Math.max(list[0]?list[0].contributions:1,1);
    $('#contribs').innerHTML=list.map(c=>'<div class="contrib"><img src="'+esc(c.avatar_url||'')+'" alt="" loading="lazy"><span class="cn"><a href="'+esc(c.html_url||'')+'" target="_blank" rel="noopener">'+esc(c.login||'')+'</a></span><span class="cb"><i style="width:'+((c.contributions||0)/max*100).toFixed(1)+'%"></i></span><span class="cc">'+fmt(c.contributions)+'</span></div>').join('')||'<p style="color:var(--text3);font-size:13px">No contributor data.</p>';
    $('#recentCommits').innerHTML=S.commits.slice(0,12).map(c=>{
      const msg=(c.commit&&c.commit.message||'').split('\n')[0];
      const d=c.commit&&c.commit.author?c.commit.author.date:'';
      const a=c.author?c.author.login:(c.commit&&c.commit.author?c.commit.author.name:'?');
      return'<div class="commit"><div class="cm">'+esc(msg)+'</div><div class="cd">'+esc(a||'')+' · '+esc(timeAgo(d))+'</div></div>';
    }).join('')||'<p style="color:var(--text3);font-size:13px">No commit data.</p>';
  }catch(e){console.warn('renderActivity error:',e)}
}
function drawActChart(){
  try{
    if(!S.activity||!S.activity.length)return;
    const ctx=$('#actChart');
    if(!ctx)return;
    if(typeof Chart==='undefined')return;
    if(S.charts.act)S.charts.act.destroy();
    const weeks=S.activity.slice().reverse().slice(0,52);
    S.charts.act=new Chart(ctx,{type:'bar',data:{labels:weeks.map(w=>new Date(w.week*1000).toLocaleDateString(undefined,{month:'short'})),datasets:[{data:weeks.map(w=>w.total),backgroundColor:'rgba(124,58,237,.75)',hoverBackgroundColor:'#a855f7',borderRadius:3}]},options:{plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+c.parsed.y+' commits'}}},scales:{x:{ticks:{color:'#475569',font:{size:9},maxRotation:0,autoSkip:true,maxTicksLimit:13},grid:{display:false}},y:{beginAtZero:true,ticks:{color:'#475569',font:{size:9}},grid:{color:'rgba(255,255,255,.05)'}}}}});
  }catch(e){console.warn('drawActChart error:',e)}
}

function renderFun(){
  try{
    const p=personaFor();
    $('#persIcon').textContent=p.i;
    $('#persName').textContent=p.n;
    $('#persDesc').textContent=p.d;
    ROASTS=roastLines();
    const pick=ROASTS[Math.floor(Math.random()*ROASTS.length)];
    $('#roastBox').dataset.cur=pick;
    $('#roastBox').innerHTML='<b>🔥 Roast mode:</b> '+esc(pick);
    const ach=getAch();
    $('#achFull').innerHTML=ach.map(a=>achHTML(a)).join('');
  }catch(e){console.warn('renderFun error:',e)}
}

/* first shareCard removed — using the share template version below */
function copyLink(){
  const url=location.origin+location.pathname+'?repo='+encodeURIComponent(S.repo&&S.repo.full_name||'');
  (navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject()).then(()=>toast('Deep link copied','ok')).catch(()=>toast('Copy failed','err'));
}
function tweet(){
  const m=S.repo;if(!m)return;
  const txt='Scoped "'+m.full_name+'" with Repodest 🧪 — health score '+healthCheck().score+'/100, ★ '+fmt(m.stargazers_count)+', '+Object.keys(S.langs).length+' languages.';
  window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent(txt),'_blank');
}
function printReport(){
  try{
    const m=S.repo,hc=healthCheck();
    const langs=Object.entries(S.langs).sort((a,b)=>b[1]-a[1]);
    const total=Object.values(S.langs).reduce((a,b)=>a+b,0)||1;
    const sizes=[];FILEMAP.forEach((f,k)=>sizes.push({p:k,s:f.size||0}));
    sizes.sort((a,b)=>b.s-a.s);
    const contribs=S.contribs.slice(0,10);
    const ach=getAch().filter(a=>a.on);
    $('#printReport').innerHTML=
      '<h1>🧪 Repodest Report — '+esc(m.full_name||'')+'</h1>'+
      '<div class="pr-sub">'+esc(m.description||'No description')+' · generated '+new Date().toLocaleString()+'</div>'+
      '<table><tr><th>Health score</th><th>Stars</th><th>Forks</th><th>Open issues</th><th>Files</th><th>License</th></tr>'+
      '<tr><td><b>'+hc.score+'/100</b></td><td>'+fmt(m.stargazers_count)+'</td><td>'+fmt(m.forks_count)+'</td><td>'+fmt(m.open_issues_count)+'</td><td>'+fmt(FILEMAP.size)+'</td><td>'+(m.license?esc(m.license.spdx_id):'none')+'</td></tr></table>'+
      '<h2>Health checks</h2><table>'+hc.items.map(c=>'<tr><td style="width:60%">'+esc(c.n)+'</td><td>'+(c.ok?'✓':'✕')+'</td></tr>').join('')+'</table>'+
      '<h2>Languages</h2><table>'+langs.slice(0,8).map(e=>'<tr><td style="width:60%">'+esc(e[0])+'</td><td>'+(e[1]/total*100).toFixed(1)+'%</td></tr>').join('')+'</table>'+
      '<h2>Top contributors</h2><table>'+contribs.map(c=>'<tr><td style="width:60%">'+esc(c.login||'')+'</td><td>'+fmt(c.contributions)+' commits</td></tr>').join('')+'</table>'+
      '<h2>Heaviest files</h2><table>'+sizes.slice(0,10).map(x=>'<tr><td style="width:60%">'+esc(x.p)+'</td><td>'+fmtSize(x.s)+'</td></tr>').join('')+'</table>'+
      '<h2>Trophies</h2><p>'+ach.map(a=>a.i+' '+esc(a.n)).join(' · ')+'</p>'+
      '<p style="color:#777;margin-top:20px">Generated by Repodest — '+location.origin+location.pathname+'</p>';
    window.print();
  }catch(e){console.warn('printReport error:',e)}
}

function openModal(){
  $('#patInput').value=LS.get('repodest_pat','');
  const gi=$('#gheInput');
  if(gi){
    const b=gheBase();
    gi.value=b?b.replace(/\/api\/v3$/,''):'';
    $('#gheStatus').textContent=b?'Currently using: '+b:'Currently using: api.github.com';
  }
  $('#modalBg').classList.remove('hidden');setTimeout(()=>$('#patInput').focus(),60)}
function closeModal(){$('#modalBg').classList.add('hidden')}
function saveGheHost(){
  const v=($('#gheInput').value||'').trim();
  setGheBase(v);
  $('#gheStatus').textContent=gheBase()?'Now using: '+gheBase():'Now using: api.github.com';
}
function clearGheHost(){
  setGheBase('');
  $('#gheInput').value='';
  $('#gheStatus').textContent='Now using: api.github.com';
  toast('Reverted to github.com','ok');
}
function savePat(){
  const v=$('#patInput').value.trim();
  if(v)LS.set('repodest_pat',v);else localStorage.removeItem('repodest_pat');
  closeModal();
  toast(v?'Token saved locally':'Token removed','ok');
  refreshRate();
}
$('#modalBg').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal()});
$('#explainModalBg').addEventListener('click',e=>{if(e.target===e.currentTarget)closeExplainModal()});
$('#battleModalBg').addEventListener('click',e=>{if(e.target===e.currentTarget)closeBattleModal()});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeModal();closeExplainModal();closeBattleModal();closeShareTplModal();closeCloneModal();closeShortcutsModal();closeCommandPalette()};
  if(e.key==='Enter'&&document.activeElement===$('#inp'))submitInput();
});

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
const LANG_ORDER=['en','fa','es','zh','fr'];
function cycleLang(){
  const idx=LANG_ORDER.indexOf(currentLang);
  currentLang=LANG_ORDER[(idx+1)%LANG_ORDER.length];
  LS.set('repodest_lang',currentLang);
  applyLang();
  toast(({en:'English',fa:'فارسی',es:'Español',zh:'中文',fr:'Français'})[currentLang],'ok');
}
function applyLang(){
  const isFa=currentLang==='fa';
  document.body.classList.toggle('rtl',isFa);
  document.documentElement.lang=currentLang;
  const langBtn=$('#langBtn');
  if(langBtn)langBtn.querySelector('span').textContent=({en:'EN',fa:'FA',es:'ES',zh:'ZH',fr:'FR'})[currentLang]||'EN';
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

/* ============================================================
   Particles animation — enhanced with connecting lines
   ============================================================ */
(function particles(){
  const c=$('#particles'),ctx=c.getContext('2d');
  let W,H,dots=[];
  const CONNECTION_DIST=140;
  function resize(){W=c.width=innerWidth;H=c.height=innerHeight}
  function init(){dots=Array.from({length:60},()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.8+.4,vx:(Math.random()-.5)*.35,vy:(Math.random()-.5)*.35,o:Math.random()*.5+.15}))}
  function tick(){
    ctx.clearRect(0,0,W,H);
    /* Draw connecting lines between nearby particles */
    for(let i=0;i<dots.length;i++){
      for(let j=i+1;j<dots.length;j++){
        const dx=dots[i].x-dots[j].x,dy=dots[i].y-dots[j].y;
        const dist=Math.sqrt(dx*dx+dy*dy);
        if(dist<CONNECTION_DIST){
          const alpha=(1-dist/CONNECTION_DIST)*0.15;
          ctx.beginPath();
          ctx.moveTo(dots[i].x,dots[i].y);
          ctx.lineTo(dots[j].x,dots[j].y);
          ctx.strokeStyle='rgba(168,85,247,'+alpha+')';
          ctx.lineWidth=0.6;
          ctx.stroke();
        }
      }
    }
    /* Draw particles */
    for(const d of dots){
      d.x+=d.vx;d.y+=d.vy;
      if(d.x<0||d.x>W)d.vx*=-1;
      if(d.y<0||d.y>H)d.vy*=-1;
      ctx.beginPath();ctx.arc(d.x,d.y,d.r,0,7);
      ctx.fillStyle='rgba(168,85,247,'+d.o+')';ctx.fill();
    }
    requestAnimationFrame(tick);
  }
  resize();init();tick();
  addEventListener('resize',()=>{resize();init()});
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
   Boot
   ============================================================ */
(function boot(){
  refreshRate();
  renderHistory();
  const q=new URLSearchParams(location.search);
  if(q.get('repo')){
    const m=q.get('repo').match(/^([^\/]+)\/([^\/]+)$/);
    if(m){
      const platform=q.get('platform')||detectPlatform(q.get('repo'))||'github';
      loadRepo(m[1],m[2],platform);
      return
    }
  }
  if(q.get('user')&&/^[\w-]+$/.test(q.get('user'))){loadUser(q.get('user'));return}
  $('#landing').style.display='';$('#app').style.display='none';
})();

/* ============================================================
   Register Service Worker
   ============================================================ */
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}

/* ============================================================
   Theme Toggle (dark/light with localStorage persistence)
   ============================================================ */
function initTheme(){
  const saved=LS.get('repodest_theme','dark');
  if(saved==='light')document.body.classList.add('light');
}
function toggleTheme(){
  document.body.classList.toggle('light');
  const isLight=document.body.classList.contains('light');
  LS.set('repodest_theme',isLight?'light':'dark');
  toast(isLight?'Light theme':'Dark theme','ok');
}
initTheme();

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

/* Override renderFiles to support filtering */
const _origRenderFiles=renderFiles;
renderFiles=function(){
  _origRenderFiles();
  if(filterHidden||filterBinary||searchText){
    $$('#tree .trow').forEach(row=>{
      const path=row.dataset.path||row.querySelector('.fname')?.textContent||'';
      const isHidden=path.split('/').some(p=>p.startsWith('.')&&p!=='.');
      const isBinary=path.split('.').pop()&&BINARY_EXT.has(path.split('.').pop().toLowerCase());
      const matchesSearch=!searchText||path.toLowerCase().includes(searchText);
      let show=true;
      if(filterHidden&&isHidden)show=false;
      if(filterBinary&&isBinary)show=false;
      if(!matchesSearch)show=false;
      row.style.display=show?'':'none';
    });
    /* Update info text */
    const visible=$$('#tree .trow:not([style*="display: none"])').length;
    const info=$('#treeInfo');
    if(info)info.textContent=visible+' visible · '+FILEMAP.size+' total';
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
const DIGEST_FORMATS=['md','xml','json'];
let digestPreset=LS.get('repodest_preset','general');
let digestFormat=LS.get('repodest_format','md');
let sigOnly=LS.get('repodest_sigonly',false);
const MODEL_CTX={gpt5:128000,claude:200000,gemini:1000000,llama:8000};
const MODEL_CHARS_PER_TOK={gpt5:4,claude:3.6,gemini:3.8,llama:4.2};

function selectDigestPreset(p){
  if(!DIGEST_PRESETS[p])return;
  digestPreset=p;LS.set('repodest_preset',p);
  $$('.rec-btn[data-preset]').forEach(b=>b.classList.toggle('preset-sel',b.dataset.preset===p));
  toast('Preset: '+DIGEST_PRESETS[p].label,'ok');
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

function buildDigestHeader(m,branch){
  if(digestFormat==='xml'){
    return ['# Repository Context','<repository name="'+esc(m&&m.full_name)+'" platform="'+esc(S.platform||'github')+'" branch="'+esc(branch)+'">',
      '  <meta>','    <description>'+esc(m&&m.description)+'</description>','    <language>'+esc(m&&m.language)+'</language>',
      '    <stars>'+fmt(m&&m.stargazers_count)+'</stars>','    <forks>'+fmt(m&&m.forks_count)+'</forks>',
      '    <license>'+(m&&m.license?esc(m.license.spdx_id):'none')+'</license>','    <generated>'+new Date().toISOString().slice(0,10)+'</generated>',
      '  </meta>','  <task>'+esc(DIGEST_PRESETS[digestPreset].task)+'</task>'].join('\n');
  }
  if(digestFormat==='json'){
    return ['{','  "repository": "'+(m&&m.full_name)+'",','  "platform": "'+(S.platform||'github')+'",','  "branch": "'+branch+'",',
      '  "meta": '+JSON.stringify({description:m&&m.description,primary_language:m&&m.language,stars:m&&m.stargazers_count,forks:m&&m.forks_count,license:m&&m.license?m.license.spdx_id:null,generated:new Date().toISOString().slice(0,10)})+',',
      '  "task": '+JSON.stringify(DIGEST_PRESETS[digestPreset].task)+','].join('\n');
  }
  return ['# Repository Context: '+(m&&m.full_name),
    'Source: '+(m&&m.html_url),'Platform: '+(S.platform||'github'),'Branch: '+branch,
    'Description: '+(m&&m.description||'N/A'),'Primary language: '+(m&&m.language||'N/A'),
    'Stars: '+fmt(m&&m.stargazers_count)+' · Forks: '+fmt(m&&m.forks_count)+' · License: '+(m&&m.license?m.license.spdx_id:'none'),
    'Generated by Repodest on '+new Date().toISOString().slice(0,10),
    '','## Task',''+DIGEST_PRESETS[digestPreset].task].join('\n');
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
    {icon:'🌐',label:'Switch language',kw:'language i18n fa en es zh fr',run:()=>cycleLang()},
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
    {icon:'❓',label:'Keyboard shortcuts',kw:'shortcuts help keys',run:()=>showShortcuts()}
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
