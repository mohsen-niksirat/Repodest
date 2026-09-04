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

/* ---------- IndexedDB cache layer (removes the 5MB localStorage cap) ----------
   Writes go to IDB always; localStorage only for small payloads so
   synchronous paths and the service worker era behavior still work.
   Reads prefer IDB, then fall back to localStorage. */
let _idbPromise=null;
function idb(){
  if(_idbPromise)return _idbPromise;
  _idbPromise=new Promise(resolve=>{
    try{
      if(!('indexedDB' in window)){resolve(null);return}
      const req=indexedDB.open('repodest_cache',1);
      req.onupgradeneeded=()=>{req.result.createObjectStore('kv')};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>resolve(null);
    }catch(e){resolve(null)}
  });
  return _idbPromise;
}
async function idbGet(key){
  const db=await idb();
  if(!db)return null;
  return new Promise(resolve=>{
    try{
      const tx=db.transaction('kv','readonly');
      const req=tx.objectStore('kv').get(key);
      req.onsuccess=()=>resolve(req.result==null?null:req.result);
      req.onerror=()=>resolve(null);
    }catch(e){resolve(null)}
  });
}
async function idbSet(key,val){
  const db=await idb();
  if(!db)return;
  return new Promise(resolve=>{
    try{
      const tx=db.transaction('kv','readwrite');
      tx.objectStore('kv').put(val,key);
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>resolve();
    }catch(e){resolve()}
  });
}
async function cacheGet2(k,ttl){
  try{
    const hit=await idbGet('c_'+k);
    if(hit&&(Date.now()-hit.t)<ttl)return hit.v;
  }catch(e){}
  return cacheGet(k,ttl);
}
async function cacheSet2(k,v){
  idbSet('c_'+k,{t:Date.now(),v}).catch(()=>{});
  try{const s=JSON.stringify(v);if(s.length<1200000)LS.set('repodest_c_'+k,{t:Date.now(),v})}catch(e){}
}

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
  scopePrefix='';
  resetFts();
  const sel=$('#scopeSelect');
  if(sel)sel.value='';
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
    const cached=await cacheGet2('repo:'+cacheKey,6*3600*1000);
    if(cached){applyRepo(key,cached,true);return}

    if(platform==='gitlab'||platform==='bitbucket'){
      setLoad('Fetching from '+platform+'…');
      const data=await fetchRepoData(owner,repo,platform);
      if(!data)throw new Error('Failed to fetch');
      cacheSet2('repo:'+cacheKey,data);
      applyRepo(key,data,false);
      return;
    }

    /* GitHub flow (public github.com or GitHub Enterprise via apiBase())
       Metadata first (needed for the default branch), then everything
       else in parallel — cuts first-load latency to roughly the slowest
       single call instead of the sum of all calls. */
    setLoad('Repository metadata…');
    const meta=await api('/repos/'+key);
    setLoad('Languages, tree, contributors & commits…');
    const branchGuess=meta.default_branch||'main';
    const [langs,tree,contribs,commits]=await Promise.all([
      api('/repos/'+key+'/languages').catch(()=>({})),
      api('/repos/'+key+'/git/trees/'+branchGuess+'?recursive=1').catch(()=>null),
      api('/repos/'+key+'/contributors?per_page=12').catch(()=>[]),
      api('/repos/'+key+'/commits?per_page=100').catch(()=>[])
    ]);
    const data={meta:stripRepo(meta,platform),langs,tree,contribs:Array.isArray(contribs)?contribs:[],commits:Array.isArray(commits)?commits.slice(0,100):[]};
    cacheSet2('repo:'+cacheKey,data);
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
    try{renderSinceLastVisit(data.meta)}catch(e){}
    try{maybeRunAutoDigest()}catch(e){}
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
/* Per-node render cap — huge folders render a slice + "show all" to keep the DOM light */
const NODE_RENDER_CAP=250;
function renderNode(container,node){
  if(!node||!container)return;
  try{
    const dirs=Array.from(node.dirs.values()).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    const files=node.files.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    const capped=files.length>NODE_RENDER_CAP;
    const visibleFiles=capped?files.slice(0,NODE_RENDER_CAP):files;
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
    for(const f of visibleFiles){
      const row=document.createElement('div');
      row.className='trow';
      const icon=isLock(f)?'🔒':isText(f)?'📄':'🧊';
      /* File type color coding */
      const ext=extOf(f.path||'');
      const ficoClass='fico'+(ext?' '+ext:'');
      row.innerHTML='<span class="caret" style="visibility:hidden">·</span><input type="checkbox" class="fcb" data-path="'+esc(f.path||'')+'"'+(S.sel.has(f.path)?' checked':'')+'><span class="'+ficoClass+'">'+icon+'</span><span class="fname" title="'+esc(f.path||'')+'">'+esc((f.name||(f.path||'').split('/').pop())||'')+'</span><span class="fsize">'+fmtSize(f.size||0)+'</span>';
      container.appendChild(row);
    }
    if(capped){
      const more=document.createElement('div');
      more.className='trow';
      more.style.opacity='.75';
      more.innerHTML='<span class="caret" style="visibility:hidden">·</span><span></span><span class="fico">⋯</span><span class="fname" style="color:var(--accent2);cursor:pointer">Show all '+(files.length-NODE_RENDER_CAP)+' more files in this folder</span><span class="fsize"></span>';
      more.addEventListener('click',()=>{
        more.remove();
        for(const f of files.slice(NODE_RENDER_CAP)){
          const row=document.createElement('div');
          row.className='trow';
          const icon=isLock(f)?'🔒':isText(f)?'📄':'🧊';
          const ext=extOf(f.path||'');
          const ficoClass='fico'+(ext?' '+ext:'');
          row.innerHTML='<span class="caret" style="visibility:hidden">·</span><input type="checkbox" class="fcb" data-path="'+esc(f.path||'')+'"'+(S.sel.has(f.path)?' checked':'')+'><span class="'+ficoClass+'">'+icon+'</span><span class="fname" title="'+esc(f.path||'')+'">'+esc((f.name||(f.path||'').split('/').pop())||'')+'</span><span class="fsize">'+fmtSize(f.size||0)+'</span>';
          container.appendChild(row);
        }
      });
      container.appendChild(more);
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
  /* Pass 1: fetch everything into per-file sections */
  const sections=[];
  let readmeSection=null;
  if($('#optReadme').checked){
    const readme=FILEMAP.size?Array.from(FILEMAP.keys()).find(p=>/(^|\/)readme\.md$/i.test(p)):null;
    if(readme){
      try{
        btn.textContent='⏳ README…';
        const t=await(await fetch(rawUrl((m&&m.full_name),branch,readme))).text();
        readmeSection={path:readme,ext:'md',content:t.slice(0,20000)};
      }catch(e){}
    }
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
      sections.push({path:p,ext,content:t});
    }catch(e){skipped++}
  }
  /* Pass 2: pack sections into context-sized parts */
  S.digestParts=packDigestParts(m,branch,paths,readmeSection,sections,skipped,binSkipped,sigShrunk);
  S.digestPartIdx=0;
  showDigestPart(0);
  updateSelMeta();
  $('#copyBtn').disabled=false;$('#dlBtn').disabled=false;$('#gistBtn').disabled=false;$('#tokBtn').disabled=false;
  btn.disabled=false;btn.textContent='🤖 Generate digest';
  toast(S.digestParts.length>1?('Digest split into '+S.digestParts.length+' parts (context limit)'):('Digest ready ('+digestFormat.toUpperCase()+')'),'ok');
  setupLLMButtons();
  switchTab('digest');
}

/* Build context-fit parts: each part repeats the full header so it
   stands alone in an LLM chat. Used when the digest exceeds the
   selected model's context window. */
function digestTokenBudget(){
  const model=($('#modelSelect')||{}).value||'gpt5';
  return Math.floor((MODEL_CTX[model]||128000)*0.9*(MODEL_CHARS_PER_TOK[model]||4));
}
function packDigestParts(m,branch,paths,readmeSection,sections,skipped,binSkipped,sigShrunk){
  const budget=digestTokenBudget();
  const groups=[];
  let cur=[],curBytes=0;
  const estBytes=sec=>sec.content.length+sec.path.length+40;
  if(readmeSection){cur.push(readmeSection);curBytes+=estBytes(readmeSection)}
  for(const sec of sections){
    if(cur.length&&curBytes+estBytes(sec)>budget*0.6){groups.push(cur);cur=[];curBytes=0}
    cur.push(sec);curBytes+=estBytes(sec);
  }
  if(cur.length)groups.push(cur);
  if(!groups.length)groups.push([]);
  const out=[];
  groups.forEach((group,gi)=>{
    const parts=[];
    parts.push(buildDigestHeader(m,branch,group.length+' of '+paths.length+' files (part '+(gi+1)+'/'+groups.length+')'));
    if($('#optTree').checked){
      if(digestFormat==='xml')parts.push('  <file_tree>\n'+asciiTree(group.map(s=>s.path)).split('&').join('&amp;').split('<').join('&lt;')+'\n  </file_tree>');
      else if(digestFormat==='json')parts.push('    "file_tree": '+JSON.stringify(asciiTree(group.map(s=>s.path)))+',');
      else parts.push('\n# File Tree\n\n```text\n'+asciiTree(group.map(s=>s.path))+'\n```');
    }
    group.forEach(sec=>parts.push(wrapFileSection(sec.path,sec.ext,sec.content)));
    if(gi===groups.length-1&&skipped)parts.push(digestFormat==='xml'?'  <!-- '+skipped+' files skipped: '+binSkipped+' binary, '+(skipped-binSkipped)+' too large -->':'\n('+skipped+' files skipped: '+binSkipped+' binary, '+(skipped-binSkipped)+' too large or unfetchable'+(sigShrunk?', '+sigShrunk+' shrunk to signatures':'')+')');
    finalizeDigestFooter(parts);
    out.push(parts.join('\n'));
  });
  return out;
}
function showDigestPart(idx){
  S.digestPartIdx=idx;
  const parts=S.digestParts||[];
  S.digestText=parts[idx]||'';
  $('#digestOut').value=S.digestText;
  const nav=$('#partNav');
  if(!nav)return;
  if(parts.length>1){
    nav.style.display='';
    const prev=(idx-1)<0?0:idx-1,next=(idx+1)>(parts.length-1)?parts.length-1:idx+1;
    nav.innerHTML='<button class="btn ghost sm" onclick="showDigestPart('+prev+')" '+(idx===0?'disabled':'')+'>◀</button>'+
      '<span style="font-size:12px;color:var(--text2);align-self:center">Part <b>'+(idx+1)+'/'+parts.length+'</b> <span style="color:var(--text3)">— context limit; paste parts sequentially in one chat</span></span>'+
      '<button class="btn ghost sm" onclick="showDigestPart('+next+')" '+(idx===parts.length-1?'disabled':'')+'>▶</button>';
  }else{
    nav.style.display='none';nav.innerHTML='';
  }
}
function copyDigest(){
  const t=$('#digestOut').value||S.digestText;
  if(!t)return;
  (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>toast('Digest copied to clipboard','ok')).catch(()=>{
    const ta=$('#digestOut');ta.removeAttribute('readonly');ta.select();document.execCommand('copy');ta.setAttribute('readonly','');toast('Digest copied','ok');
  });
}

/* ---------- Per-file token breakdown table ---------- */
let tokTableVisible=false;
function toggleTokTable(){
  tokTableVisible=!tokTableVisible;
  $('#tokBtn').style.opacity=tokTableVisible?'':'0.6';
  renderTokTable();
}
function renderTokTable(){
  const host=$('#tokTable');
  if(!host)return;
  if(!tokTableVisible){host.style.display='none';return}
  const model=($('#modelSelect')||{}).value||'gpt5';
  const cpt=MODEL_CHARS_PER_TOK[model]||4;
  const rows=[];
  S.sel.forEach(p=>{
    const f=FILEMAP.get(p);
    if(!f)return;
    const bytes=f.size||0;
    rows.push({path:p,bytes,toks:Math.round(bytes/cpt)});
  });
  rows.sort((a,b)=>b.toks-a.toks);
  if(!rows.length){host.style.display='';host.innerHTML='<p style="color:var(--text3);font-size:12px">No files selected.</p>';return}
  const ctx=MODEL_CTX[model]||128000;
  const shown=rows.slice(0,50);
  host.style.display='';
  host.innerHTML=
    '<div style="font-size:11px;color:var(--text3);margin:8px 0 6px">'+rows.length+' files · estimates for '+esc($('#modelSelect')?$('#modelSelect').selectedOptions[0].textContent:model)+' · context '+fmt(ctx)+' tok</div>'+
    shown.map(r=>{
      const pct=Math.min(100,Math.round(r.toks/ctx*100));
      const short=r.path.length>46?'…'+r.path.slice(-45):r.path;
      return '<div class="langrow"><span class="ln" style="width:46%" title="'+esc(r.path)+'">'+esc(short)+'</span><span class="lb"><i style="width:'+Math.max(2,pct)+'%;background:'+(r.toks>ctx*0.25?'#ef4444':r.toks>ctx*0.1?'#f59e0b':'#22d3ee')+'"></i></span><span class="lp">'+fmt(r.toks)+' tk</span></div>';
    }).join('')+
    (rows.length>50?'<div style="font-size:11px;color:var(--text3);margin-top:6px">…and '+(rows.length-50)+' more (sorted by size)</div>':'');
}

/* ---------- Custom user-defined preset ---------- */
const CUSTOM_TASK_KEY='repodest_custom_task';
function editCustomTask(){
  const saved=LS.get(CUSTOM_TASK_KEY,'');
  const bg=document.createElement('div');
  bg.className='modal-bg';
  bg.style.cssText='position:fixed;inset:0;background:rgba(5,5,12,.7);backdrop-filter:blur(6px);z-index:120;display:grid;place-items:center;padding:20px';
  bg.innerHTML='<div class="modal" style="background:var(--card-solid);border:1px solid var(--line2);border-radius:20px;padding:26px;width:min(560px,94vw);box-shadow:var(--shadow)">'+
    '<h3>✏️ Custom preset instructions</h3>'+
    '<p style="font-size:12.5px;color:var(--text2)">These instructions are prepended to every digest generated with the Custom preset.</p>'+
    '<textarea id="custTaskInput" rows="6" spellcheck="false" style="width:100%;margin-top:10px;padding:10px;border-radius:10px;background:var(--bg2);border:1px solid var(--line);color:var(--text);font-family:var(--mono);font-size:12px;resize:vertical" placeholder="e.g. You are a Scala expert. Review everything for functional programming style…">'+esc(saved)+'</textarea>'+
    '<div class="mrow" style="margin-top:12px">'+
      '<button class="btn ghost sm" onclick="this.closest(\'.modal-bg\').remove()">Cancel</button>'+
      '<button class="btn sm" onclick="saveCustomTask(this)">Save</button>'+
    '</div></div>';
  bg.addEventListener('click',e=>{if(e.target===bg)bg.remove()});
  document.body.appendChild(bg);
  setTimeout(()=>$('#custTaskInput').focus(),50);
}
function saveCustomTask(btnEl){
  const ta=$('#custTaskInput');
  if(!ta)return;
  LS.set(CUSTOM_TASK_KEY,ta.value.trim());
  (btnEl.closest('.modal-bg')).remove();
  toast('Custom preset saved','ok');
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
    renderWrapped();
  }catch(e){console.warn('renderFun error:',e)}
}

/* ============================================================
   Repo Wrapped — a fun 12-month story from activity data
   ============================================================ */
function renderWrapped(){
  const el=$('#wrappedCard');
  if(!el)return;
  const m=S.repo;
  if(!m){el.innerHTML='';return}
  const weeks=Array.isArray(S.activity)?S.activity:[];
  const last52=weeks.slice(-52);
  const commits=last52.reduce((a,w)=>a+(w.total||0),0);
  const activeWeeks=last52.filter(w=>(w.total||0)>0).length;
  const busiest=last52.reduce((best,w)=>{
    if(!best||(w.total||0)>(best.total||0))return w;
    return best;
  },null);
  const busiestLabel=(()=>{ 
    if(!busiest||!busiest.total)return null;
    const d=new Date(busiest.week*86400000+86400000);
    return {n:busiest.total,date:d.toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'})};
  })();
  const season=(()=>{
    if(!last52.length)return null;
    const half1=last52.slice(0,26).reduce((a,w)=>a+(w.total||0),0);
    const half2=last52.slice(26).reduce((a,w)=>a+(w.total||0),0);
    if(half1+half2<10)return null;
    return half2>half1*1.25?'📈 Accelerating — the last 6 months are busier than the first.'
      :half1>half2*1.25?'🌅 Cooling down — earlier months were busier.'
      :'⚖️ Steady rhythm all year long.';
  })();
  const topContrib=(S.contribs&&S.contribs.filter(c=>c.type!=='Bot').slice().sort((a,b)=>(b.contributions||0)-(a.contributions||0))[0])||null;
  const daysOld=(()=>{try{return Math.round((Date.now()-new Date(m.created_at))/(365.25*864e5)*10)/10}catch(e){return null}})();
  const score=(()=>{try{return healthCheck().score}catch(e){return 0}})();
  const starGrade=m.stargazers_count>=10000?' galactic 🌌':m.stargazers_count>=1000?' famous ✨':m.stargazers_count>=100?' loved 💛':' cozy 🌱';
  const cards=[];
  const add=(icon,title,body)=>cards.push('<div class="wrapped-tile"><div class="wt-i">'+icon+'</div><div class="wt-b"><b>'+esc(title)+'</b><span>'+body+'</span></div></div>');
  if(commits>0){
    add('🧾',fmt(commits)+' commits','across '+activeWeeks+' active weeks — '+(activeWeeks>=45?'almost never offline!':activeWeeks>=30?'a reliable heartbeat.':'quality over quantity.'));
  }else{
    add('😴','A quiet year','no commits in the last 52 weeks — the repo is resting.');
  }
  if(busiestLabel)add('⚡','Peak week: '+fmt(busiestLabel.n)+' commits','week of '+busiestLabel.date);
  if(topContrib)add('👑',esc(topContrib.login||'Anonymous'),'led the charge with '+fmt(topContrib.contributions)+' lifetime commits');
  if(season)add('🗓️','Rhythm',season);
  if(daysOld!=null)add('🎂',daysOld+' years old','born '+(daysOld>=1?Math.round(daysOld)+' years':'<1 year')+' ago, still '+(score>=60?'kicking':'waiting for love'));
  add('⭐',fmt(m.stargazers_count)+' stars','a'+starGrade+' repository'+(m.forks_count?' with '+fmt(m.forks_count)+' forks':''));
  el.innerHTML='<div class="wrapped-grid">'+cards.join('')+'</div>';
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
  if(v)validatePat(v);
}
/* Validate a PAT against /user: shows the account it belongs to, or
   a clear warning. (Note: GitHub's OAuth Device Flow endpoints do not
   allow CORS, so a fully browser-side "Sign in with GitHub" is not
   possible without a proxy — token entry remains the zero-backend path.) */
async function validatePat(token){
  try{
    const r=await fetch(apiBase()+'/user',{headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token}});
    if(r.ok){
      const u=await r.json();
      toast('✓ Token valid — signed in as @'+(u.login||'user'),'ok');
      const chip=$('#rateChip');
      if(chip)chip.title='Signed in as @'+(u.login||'user');
    }else if(r.status===401){
      toast('⚠️ Token was rejected by GitHub (invalid or expired)','err');
    }
  }catch(e){/* network issue — silent */}
}
$('#modalBg').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal()});
$('#explainModalBg').addEventListener('click',e=>{if(e.target===e.currentTarget)closeExplainModal()});
$('#battleModalBg').addEventListener('click',e=>{if(e.target===e.currentTarget)closeBattleModal()});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeModal();closeExplainModal();closeBattleModal();closeShareTplModal();closeCloneModal();closeShortcutsModal();closeCommandPalette()};
  if(e.key==='Enter'&&document.activeElement===$('#inp'))submitInput();
});
