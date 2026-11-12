'use strict';
/* ============================================================
   Repodest, PR X-Ray tab
   Paste a PR URL (or pick an open PR) → human-readable
   change summary, risk flags and an LLM-ready review digest.
   Pure analysis lives in core.js (analyzePR / buildPRDigest /
   parsePRInput) so it is unit-testable in Node.
   ============================================================ */
S.pr={list:null,loaded:false,pending:null,current:null};

function renderPRPanel(){
  if(!S.repo||!S.repo.full_name)return;
  if(S.platform!=='github'&&S.platform!=='ghe'){
    $('#prList').innerHTML='<p style="color:var(--text3);font-size:13px">PR X-Ray currently requires a GitHub or GitHub Enterprise repository.</p>';
    return;
  }
  if(S.pr.pending!=null){const n=S.pr.pending;S.pr.pending=null;analyzePRNumber(n);return}
  if(S.pr.loaded)return;
  S.pr.loaded=true;
  loadPRList();
}

/* ---------- Open PR list ---------- */
async function loadPRList(){
  const el=$('#prList');if(!el||!S.repo)return;
  el.innerHTML='<p style="color:var(--text3);font-size:12px">⏳ Loading open PRs…</p>';
  try{
    const prs=await api('/repos/'+S.repo.full_name+'/pulls?state=open&per_page=30&sort=updated&direction=desc');
    if(!Array.isArray(prs))throw new Error('Bad PR response');
    S.pr.list=prs;
    if(!prs.length){el.innerHTML='<p style="color:var(--text3);font-size:13px">No open pull requests, paste any PR URL or number above to analyze a merged/closed one.</p>';return}
    el.innerHTML=prs.map(p=>{
      const age=p.created_at?timeAgo(p.created_at):'';
      return '<div class="trow pr-row" role="button" tabindex="0" onclick="analyzePRNumber('+p.number+')" onkeydown="if(event.key===\'Enter\')analyzePRNumber('+p.number+')" title="Analyze PR #'+p.number+'">'+
        '<span class="pr-num">#'+p.number+'</span>'+
        '<span class="pr-title">'+esc(p.title||'(untitled)')+'</span>'+
        '<span class="pr-meta">@'+esc(p.user&&p.user.login||'?')+' · '+esc(age)+'</span>'+
      '</div>';
    }).join('')+'<p style="color:var(--text3);font-size:11px;margin-top:8px">Showing up to 30 most recently updated open PRs. Paste any PR URL/number for merged or closed ones.</p>';
  }catch(e){
    el.innerHTML='<p style="color:var(--red);font-size:12px">Failed to load PRs: '+esc(e.message||'error')+'</p>';
  }
}

/* ---------- Analyze one PR ---------- */
async function analyzePRNumber(n){
  n=parseInt(n,10);
  if(!n||n<1){toast('Invalid PR number','err');return}
  if(!S.repo||!S.repo.full_name){toast('Load a repository first','err');return}
  const box=$('#prAnalysis');if(!box)return;
  box.innerHTML='<p style="color:var(--text3);font-size:12px">⏳ Fetching PR #'+n+'…</p>';
  switchTab('pr');
  let pr=null;
  try{
    pr=await api('/repos/'+S.repo.full_name+'/pulls/'+n);
    if(!pr||!pr.number)throw new Error('NOT_FOUND');
  }catch(e){
    box.innerHTML='<p style="color:var(--red);font-size:12px">Could not load PR #'+n+': '+esc(e.message==='NOT_FOUND'?'no such PR in this repo':e.message||'error')+'</p>';
    return;
  }
  let files=[];
  let truncated=false;
  try{
    const p1=await api('/repos/'+S.repo.full_name+'/pulls/'+n+'/files?per_page=100&page=1');
    if(Array.isArray(p1)){
      files=p1;
      if(p1.length===100){
        const rest=await Promise.all([2,3].map(pg=>api('/repos/'+S.repo.full_name+'/pulls/'+n+'/files?per_page=100&page='+pg).catch(()=>[])));
        rest.forEach(r=>{if(Array.isArray(r))files=files.concat(r)});
      }
      truncated=files.length>=300||(typeof pr.changed_files==='number'&&pr.changed_files>files.length);
    }
  }catch(e){/* files endpoint failed, still show header-level analysis */}
  const an=analyzePR(pr,files);
  an.truncated=truncated;
  if(an.truncated){
    if(typeof pr.additions==='number')an.totals.add=pr.additions;
    if(typeof pr.deletions==='number')an.totals.del=pr.deletions;
    an.totals.changes=an.totals.add+an.totals.del;
  }
  S.pr.current={pr,files,an};
  renderPRAnalysis();
  $('#prDigestOut').value='';
  $('#prCopyBtn').disabled=true;$('#prDlBtn').disabled=true;
}

function prStateBadge(pr){
  if(pr.merged_at)return'<span class="pr-state merged">merged</span>';
  if(pr.state==='closed')return'<span class="pr-state closed">closed</span>';
  if(pr.draft)return'<span class="pr-state draft">draft</span>';
  return'<span class="pr-state open">open</span>';
}

function renderPRAnalysis(){
  const c=S.pr.current;if(!c)return;
  const box=$('#prAnalysis');if(!box)return;
  const{pr,files,an}=c;
  const riskColor=an.verdict==='high'?'var(--red)':an.verdict==='medium'?'var(--yellow)':'var(--green)';
  const typeIcon='';
  const sizeIcon='';
  let html=
    '<div class="pr-hero">'+
      '<div class="pr-hero-head"><span class="pr-num big">#'+pr.number+'</span><h3 style="margin:0;flex:1">'+esc(pr.title||'')+'</h3>'+prStateBadge(pr)+'</div>'+
      '<div class="pr-hero-meta">'+
        '<span><a href="'+esc(pr.html_url||'#')+'" target="_blank" rel="noopener">view on GitHub ↗</a></span>'+
        '<span><b>@'+esc(pr.user&&pr.user.login||'?')+'</b></span>'+
        '<span><code>'+esc(pr.head&&pr.head.ref||'?')+'</code> → <code>'+esc(pr.base&&pr.base.ref||'?')+'</code></span>'+
        '<span>opened '+esc(pr.created_at?timeAgo(pr.created_at):'?')+'</span>'+
        (pr.requested_reviewers&&pr.requested_reviewers.length?'<span>'+pr.requested_reviewers.length+' reviewer(s) requested</span>':'')+
      '</div>'+
      '<div class="pr-stats">'+
        '<div class="st"><b style="color:var(--green)">+'+fmt(an.totals.add)+'</b><span>additions</span></div>'+
        '<div class="st"><b style="color:var(--red)">−'+fmt(an.totals.del)+'</b><span>deletions</span></div>'+
        '<div class="st"><b>'+files.length+'</b><span>files</span></div>'+
        '<div class="st"><b>'+typeIcon+' '+esc(an.changeType)+'</b><span>change type</span></div>'+
        '<div class="st"><b>'+sizeIcon+' '+esc(an.sizeClass)+'</b><span>size ('+fmt(an.totalLines)+' lines)</span></div>'+
        '<div class="st"><b>'+an.testShare+'%</b><span>test lines</span></div>'+
        '<div class="st"><b style="color:'+riskColor+'">'+an.riskScore+'/10</b><span>risk ('+esc(an.verdict)+')</span></div>'+
      '</div>'+
    '</div>';

  if(an.risks.length){
    html+='<div class="card" style="margin:12px 0"><div class="minititle">Risk flags</div>'+
      an.risks.map(r=>'<div class="kv"><span>'+esc(r.label)+'</span><b title="'+esc(r.files.join('\n'))+'">'+r.files.length+' file'+(r.files.length>1?'s':'')+'</b></div>').join('')+
      '<p style="color:var(--text3);font-size:11px;margin-top:6px">Weighted by how sensitive the touched area is (auth, crypto, migrations…). Risk '+an.riskScore+'/10, '+esc(an.verdict)+'.</p></div>';
  }else{
    html+='<div class="card" style="margin:12px 0"><div class="minititle">Risk flags</div><p style="color:var(--text3);font-size:12px">No sensitive areas touched, low-risk change.</p></div>';
  }

  const groups=[['source','Source code'],['test','Tests'],['config','Config & manifests'],['docs','Docs'],['asset','Assets'],['other','Other']];
  const fileByPath={};files.forEach(f=>{fileByPath[f.filename]=f});
  let anyGroup=false;
  groups.forEach(([k,label])=>{
    const g=an.byType[k];
    if(!g||!g.files)return;
    anyGroup=true;
    html+='<div class="card" style="margin:12px 0"><div class="minititle">'+label+' <span class="ep-badge">'+g.files+'</span></div>'+
      '<div class="pr-files">'+
      (g.list.map(p=>{
        const f=fileByPath[p]||{};
        return '<div class="kv"><span class="pr-file-path" title="'+esc(p)+'">'+esc(p)+(f.status&&f.status!=='modified'?' <i style="color:var(--text3)">('+esc(f.status)+')</i>':'')+'</span><b><span style="color:var(--green)">+'+(f.additions||0)+'</span> <span style="color:var(--red)">−'+(f.deletions||0)+'</span></b></div>';
      }).join(''))+
      '</div></div>';
  });
  if(!anyGroup&&files.length===0){
    html+='<div class="card" style="margin:12px 0"><p style="color:var(--text3);font-size:12px">No per-file data available (the files endpoint returned nothing). Header-level analysis above still applies.</p></div>';
  }

  if(an.truncated){
    html+='<div class="card" style="margin:12px 0;border-color:var(--yellow)"><p style="color:var(--yellow);font-size:12px">This PR changes more than '+files.length+' files, the analysis covers the first '+files.length+' only.</p></div>';
  }

  if(files.length&&!an.byType.test){
    html+='<div class="card" style="margin:12px 0;border-color:rgba(234,179,8,.4)"><p style="font-size:12px;color:var(--text2)"><b>No test files in this PR.</b> Consider asking the author for coverage of the changed behavior.</p></div>';
  }else if(files.length&&an.testShare<10){
    html+='<div class="card" style="margin:12px 0"><p style="font-size:12px;color:var(--text2)">Test lines are only '+an.testShare+'% of the change, coverage looks thin.</p></div>';
  }

  if(pr.body){
    const short=String(pr.body).slice(0,600);
    html+='<div class="card" style="margin:12px 0"><div class="minititle">PR description</div><p style="font-size:12.5px;line-height:1.6;color:var(--text2);white-space:pre-wrap">'+esc(short)+(String(pr.body).length>600?'\n… (truncated)':'')+'</p></div>';
  }

  box.innerHTML=html;

  const genBtn=$('#prGenBtn');
  if(genBtn)genBtn.disabled=false;
}

/* ---------- Review digest ---------- */
function generatePRDigest(){
  const c=S.pr.current;
  if(!c||!c.pr){toast('Analyze a PR first','err');return}
  const out=buildPRDigest(c.pr,c.files,c.an,{includePatches:true});
  $('#prDigestOut').value=out;
  $('#prCopyBtn').disabled=false;$('#prDlBtn').disabled=false;
  toast('Review digest generated','ok');
}

function copyPRDigest(){
  const out=$('#prDigestOut').value;
  if(!out)return;
  navigator.clipboard.writeText(out).then(()=>toast('Copied to clipboard','ok'),()=>toast('Copy failed','err'));
}
function downloadPRDigest(){
  const c=S.pr.current;
  const out=$('#prDigestOut').value;
  if(!out||!c)return;
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([out],{type:'text/markdown'}));
  a.download='pr-'+(c.pr.number||'x')+'-review-digest.md';
  a.click();
  URL.revokeObjectURL(a.href);
}

function prSubmitInput(){
  const v=$('#prInput').value.trim();
  if(!v){toast('Paste a PR URL or number','err');return}
  if(/^(#?\d{1,7})$/.test(v)){analyzePRNumber(v.replace('#',''));return}
  const p=parsePRInput(v);
  if(p&&p.owner&&p.repo){
    S.pr.pending=p.number;S.pr.loaded=false;
    loadRepo(p.owner,p.repo,'github');
    return;
  }
  if(p&&p.number){analyzePRNumber(p.number);return}
  toast('Could not parse, try a github.com PR URL or a number','err');
}
