'use strict';
/* ============================================================
   Repodest — Architecture Diagram (GitDiagram-grade)
   Structured graph model → validated Mermaid compiler →
   sanitized SVG with GitHub-only link allowlist, non-trapping
   pan/zoom (Ctrl+wheel, pointer drag, keyboard), viewBox
   SVG/PNG/JSON export, real import-edge tracing, and
   plain-language Architecture Explanation (EN/FA).
   Loaded after app.pr.js, before app.boot.js.
   ============================================================ */
const MERMAID_CDN_URL='https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js';
const MERMAID_SRI='sha384-rbtjAdnIQE/aQJGEgXrVUlMibdfTSa4PQju4HDhN3sR2PmaKFzhEafuePsl9H/9I';
let _mermaidPromise=null;
let _diagState={
  repoKey:'',
  theme:'',
  dir:'TD',
  code:'',
  graph:null,
  importEdges:[],
  scale:1,
  tx:0,
  ty:0,
  dragging:false,
  moved:false,
  sx:0,
  sy:0,
  bound:false,
  renderCount:0,
  renderToken:0
};

function ensureMermaid(){
  if(window.mermaid)return Promise.resolve(window.mermaid);
  if(_mermaidPromise)return _mermaidPromise;
  _mermaidPromise=new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src=MERMAID_CDN_URL;
    s.integrity=MERMAID_SRI;
    s.crossOrigin='anonymous';
    s.async=true;
    s.onload=()=>{
      if(window.mermaid)resolve(window.mermaid);
      else reject(new Error('Mermaid failed to initialize'));
    };
    s.onerror=()=>reject(new Error('Could not load Mermaid.js (offline or blocked)'));
    document.head.appendChild(s);
  });
  return _mermaidPromise;
}

/* A1: Local SVG sanitizer + strict GitHub-only link allowlist for current repo */
function sanitizeMermaidSvg(svgText,fullName){
  const parser=new DOMParser();
  const doc=parser.parseFromString(svgText,'image/svg+xml');
  const svg=doc.querySelector('svg');
  if(!svg||doc.querySelector('parsererror'))throw new Error('Invalid SVG output');
  svg.querySelectorAll('script,foreignObject,iframe,object,embed').forEach(el=>el.remove());
  const allowedPrefix='https://github.com/'+String(fullName||'').toLowerCase()+'/';
  const all=svg.querySelectorAll('*');
  all.forEach(el=>{
    Array.from(el.attributes).forEach(attr=>{
      const n=attr.name.toLowerCase();
      const v=String(attr.value||'').trim();
      if(n.startsWith('on'))el.removeAttribute(attr.name);
      else if((n==='href'||n==='xlink:href')&&/^\s*(javascript|vbscript|data):/i.test(v))el.removeAttribute(attr.name);
    });
    if(el.tagName.toLowerCase()==='a'){
      const href=el.getAttribute('href')||el.getAttribute('xlink:href')||'';
      const lower=href.toLowerCase();
      const ok=lower.startsWith(allowedPrefix)&&(/\/(blob|tree)\//.test(lower)||lower===allowedPrefix.slice(0,-1));
      if(!ok){
        el.removeAttribute('href');
        el.removeAttribute('xlink:href');
      }else{
        el.setAttribute('target','_blank');
        el.setAttribute('rel','noopener noreferrer');
      }
    }
  });
  return new XMLSerializer().serializeToString(svg);
}

/* A7: Non-trapping pan/zoom (Ctrl/Cmd+wheel, pointer drag with 6px threshold, dblclick reset, keyboard) */
function diagramBindPanZoom(){
  if(_diagState.bound)return;
  const vp=$('#diagramViewport');
  if(!vp)return;
  _diagState.bound=true;
  vp.setAttribute('tabindex','0');
  vp.setAttribute('role','application');
  vp.setAttribute('aria-label','Interactive repository architecture diagram');

  vp.addEventListener('wheel',e=>{
    if(!(e.ctrlKey||e.metaKey))return; /* Never trap normal page scroll */
    e.preventDefault();
    const factor=e.deltaY<0?1.12:0.89;
    _diagState.scale=Math.max(0.25,Math.min(4,_diagState.scale*factor));
    diagramApplyTransform();
  },{passive:false});

  vp.addEventListener('pointerdown',e=>{
    if(e.button!==0||e.target.closest('a'))return;
    _diagState.dragging=true;
    _diagState.moved=false;
    _diagState.sx=e.clientX-_diagState.tx;
    _diagState.sy=e.clientY-_diagState.ty;
    vp.setPointerCapture(e.pointerId);
    vp.style.cursor='grabbing';
  });
  vp.addEventListener('pointermove',e=>{
    if(!_diagState.dragging)return;
    const nx=e.clientX-_diagState.sx;
    const ny=e.clientY-_diagState.sy;
    if(!_diagState.moved&&Math.hypot(nx-_diagState.tx,ny-_diagState.ty)<6)return;
    _diagState.moved=true;
    _diagState.tx=nx;_diagState.ty=ny;
    diagramApplyTransform();
  });
  const endDrag=()=>{
    if(!_diagState.dragging)return;
    _diagState.dragging=false;
    vp.style.cursor='grab';
  };
  vp.addEventListener('pointerup',endDrag);
  vp.addEventListener('pointercancel',endDrag);
  vp.addEventListener('dblclick',()=>diagramResetZoom());

  vp.addEventListener('keydown',e=>{
    if(e.key==='+'||e.key==='='){e.preventDefault();diagramZoom(0.2)}
    else if(e.key==='-'||e.key==='_'){e.preventDefault();diagramZoom(-0.2)}
    else if(e.key==='0'){e.preventDefault();diagramResetZoom()}
    else if(e.key==='ArrowLeft'){e.preventDefault();_diagState.tx+=40;diagramApplyTransform()}
    else if(e.key==='ArrowRight'){e.preventDefault();_diagState.tx-=40;diagramApplyTransform()}
    else if(e.key==='ArrowUp'){e.preventDefault();_diagState.ty+=40;diagramApplyTransform()}
    else if(e.key==='ArrowDown'){e.preventDefault();_diagState.ty-=40;diagramApplyTransform()}
  });
}

function diagramApplyTransform(){
  const stage=$('#diagramStage');
  if(!stage)return;
  stage.style.transform='translate('+_diagState.tx+'px,'+_diagState.ty+'px) scale('+_diagState.scale.toFixed(3)+')';
  const zl=$('#diagramZoomLabel');
  if(zl)zl.textContent=Math.round(_diagState.scale*100)+'%';
}

function diagramZoom(delta){
  _diagState.scale=Math.max(0.25,Math.min(4,_diagState.scale+delta));
  diagramApplyTransform();
}

function diagramResetZoom(){
  _diagState.scale=1;_diagState.tx=0;_diagState.ty=0;
  diagramApplyTransform();
}

function diagramToggleDir(){
  _diagState.dir=_diagState.dir==='TD'?'LR':'TD';
  const btn=$('#diagramDirBtn');
  if(btn)btn.textContent=_diagState.dir==='TD'?'Layout: TD ↓':'Layout: LR →';
  renderDiagramTab(true);
}

/* A12: Class/aria-expanded driven toggle */
function diagramToggleCode(){
  const wrap=$('#diagramCodeWrap');
  const btn=$('#diagramCodeToggleBtn');
  if(!wrap)return;
  const open=wrap.classList.toggle('open');
  wrap.style.display=open?'block':'none';
  if(btn)btn.setAttribute('aria-expanded',open?'true':'false');
}

function diagramRenderExplanation(graph){
  const el=$('#diagramExplain');
  if(!el||!graph)return;
  const lang=(typeof currentLang!=='undefined'&&currentLang==='fa')?'fa':'en';
  const md=RepodestCore.buildArchExplanation(graph,lang);
  el.textContent=md;
}

async function diagramRenderSVG(code){
  const stage=$('#diagramStage');
  const status=$('#diagramStatus');
  if(!stage)return;
  const token=++_diagState.renderToken;
  _diagState.code=code;
  const ta=$('#diagramCode');
  if(ta&&ta.value!==code)ta.value=code;
  const isLight=document.body.classList.contains('light');
  _diagState.theme=isLight?'light':'dark';
  if(status)status.textContent='Rendering architecture diagram…';
  try{
    const mmd=await ensureMermaid();
    if(token!==_diagState.renderToken)return; /* A6: stale render guard */
    mmd.initialize({
      startOnLoad:false,
      securityLevel:'antiscript',
      theme:isLight?'default':'dark',
      flowchart:{useMaxWidth:false,htmlLabels:false,curve:'basis'}
    });
    const id='repodest-mmd-'+(++_diagState.renderCount);
    const out=await mmd.render(id,code);
    if(token!==_diagState.renderToken)return;
    const cleanSvg=sanitizeMermaidSvg(out.svg,(S.repo&&S.repo.full_name)||'');
    stage.innerHTML=cleanSvg;
    diagramResetZoom();
    const ev=_diagState.graph&&_diagState.graph.stats&&_diagState.graph.stats.edges>0
      ?'Evidence-based graph ('+_diagState.graph.stats.edges+' verified edges)'
      :'Heuristic structural map (based on file paths)';
    if(status)status.textContent=ev+' · Click any node to open on GitHub · Ctrl+Scroll to zoom · Drag to pan';
  }catch(e){
    if(token!==_diagState.renderToken)return;
    stage.innerHTML='<div class="diagram-err">Could not render this Mermaid diagram. Open the Mermaid editor to inspect or click Regenerate.</div>';
    if(status)status.textContent='Diagram syntax error — try Regenerate or check the editor.';
  }
}

function renderDiagramTab(force){
  diagramBindPanZoom();
  const m=S.repo;
  if(!m)return;
  const isLight=document.body.classList.contains('light')?'light':'dark';
  const key=(m.full_name||'')+'@'+(m.default_branch||'main')+'@'+_diagState.dir+'@'+isLight+'@'+_diagState.importEdges.length;
  const truncated=!!(S.tree&&S.tree.truncated);
  if(!force&&!truncated&&_diagState.repoKey===key&&_diagState.code)return;
  if(_diagState.repoKey&&!_diagState.repoKey.startsWith((m.full_name||'')+'@')){
    _diagState.importEdges=[];
  }
  _diagState.repoKey=key;
  const paths=Array.from(FILEMAP.keys());
  const built=RepodestCore.buildArchDiagram(paths,m,{
    direction:_diagState.dir,
    importEdges:_diagState.importEdges,
    truncated
  });
  _diagState.graph=built.graph;
  const statsEl=$('#diagramStats');
  if(statsEl){
    statsEl.textContent=built.stats.layers+' layers · '+built.stats.nodes+' nodes · '+built.stats.edges+' verified edges · '+built.stats.shownFiles+'/'+built.stats.totalFiles+' files'+(truncated?' · (tree truncated — partial)':'');
  }
  diagramRenderExplanation(built.graph);
  diagramRenderSVG(built.mermaid);
}

/* B2 / Item 5: Principled import tracer (JS/TS + Python + Go, entry points + largest files, cap 25) */
async function diagramTraceImports(){
  const m=S.repo;
  if(!m)return;
  const btn=$('#diagramTraceBtn');
  if(btn){btn.disabled=true;btn.textContent='Tracing…'}
  try{
    const branch=m.default_branch||'main';
    const allPaths=Array.from(FILEMAP.keys());
    const sourcePaths=allPaths.filter(p=>/\.(js|ts|jsx|tsx|mjs|cjs|py|go)$/i.test(p)&&!RepodestCore.isLock({path:p}));
    const entryRx=/(^|\/)(index|main|app|server|cli|core)\.[a-z0-9]+$/i;
    const sorted=sourcePaths.slice().sort((a,b)=>{
      const ae=entryRx.test(a)?1:0,be=entryRx.test(b)?1:0;
      if(ae!==be)return be-ae;
      const sa=(FILEMAP.get(a)&&FILEMAP.get(a).size)||0;
      const sb=(FILEMAP.get(b)&&FILEMAP.get(b).size)||0;
      return sb-sa;
    });
    const candidates=sorted.slice(0,25);
    const edges=[];
    const pathSet=new Set(allPaths);
    let traced=0;
    for(const p of candidates){
      traced++;
      if(btn)btn.textContent='Tracing '+traced+'/'+candidates.length+'…';
      try{
        const r=await fetch(rawUrl(m.full_name,branch,p));
        if(!r.ok)continue;
        const txt=await r.text();
        const ext=extOf(p);
        const dir=p.includes('/')?p.slice(0,p.lastIndexOf('/')):'';
        const specs=(typeof mapParseImports==='function')?mapParseImports(txt,ext):[];
        /* Also parse Python relative/package imports & Go imports */
        if(ext==='py'){
          const pyRx=/^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm;
          let pm;
          while((pm=pyRx.exec(txt))!==null){
            const mod=(pm[1]||pm[2]||'').trim();
            if(mod)specs.push(mod);
          }
        }else if(ext==='go'){
          const goRx=/"([^"]+)"/g;
          let gm;
          while((gm=goRx.exec(txt))!==null){if(gm[1]&&gm[1].includes('/'))specs.push(gm[1])}
        }
        for(const spec of specs){
          let hit=null;
          if(spec.startsWith('.')){
            const rel=spec.replace(/^\.+/,mDots=>mDots.length>1?'../'.repeat(mDots.length-1):'');
            const base=(dir?dir+'/':'')+rel.replace(/\./g,'/');
            const norm=base.split('/').reduce((acc,seg)=>{if(seg==='..')acc.pop();else if(seg&&seg!=='.')acc.push(seg);return acc},[]).join('/');
            hit=[norm,norm+'.js',norm+'.ts',norm+'.tsx',norm+'.jsx',norm+'.py',norm+'/index.js',norm+'/index.ts',norm+'/__init__.py'].find(c=>pathSet.has(c));
          }else if(ext==='py'){
            const modPath=spec.replace(/\./g,'/');
            hit=[modPath+'.py',modPath+'/__init__.py','src/'+modPath+'.py'].find(c=>pathSet.has(c));
          }else if(ext==='go'){
            const tail=spec.split('/').slice(-2).join('/');
            hit=allPaths.find(ap=>ap.endsWith('.go')&&(ap.includes('/'+tail+'/')||ap.startsWith(tail+'/')));
          }
          if(hit&&hit!==p)edges.push({from:p,to:hit,label:'imports'});
        }
      }catch(e){}
    }
    _diagState.importEdges=edges;
    renderDiagramTab(true);
    const status=$('#diagramStatus');
    if(status)status.textContent='Traced '+candidates.length+' of '+sourcePaths.length+' source files · '+edges.length+' verified import edges · Click any node to open on GitHub';
    toast('Traced '+candidates.length+'/'+sourcePaths.length+' files ('+edges.length+' import edges)','ok');
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Trace imports'}
  }
}

function diagramRenderCode(){
  const ta=$('#diagramCode');
  if(!ta)return;
  const raw=ta.value.trim();
  /* B5: Accept pasted Graph JSON OR Mermaid */
  if(raw.startsWith('{')){
    try{
      const parsed=JSON.parse(raw);
      if(parsed&&parsed.nodes&&parsed.groups){
        const v=RepodestCore.validateArchGraph(parsed,Array.from(FILEMAP.keys()));
        _diagState.graph=v.graph;
        const mmd=RepodestCore.graphToMermaid(v.graph,{direction:_diagState.dir});
        diagramRenderExplanation(v.graph);
        diagramRenderSVG(mmd);
        toast('Graph JSON validated & rendered','ok');
        return;
      }
    }catch(e){}
  }
  const code=RepodestCore.extractMermaidBlock(raw);
  if(!code){toast('Paste valid Mermaid flowchart code or Graph JSON','err');return}
  diagramRenderSVG(code);
  toast('Diagram updated','ok');
}

function diagramCopyCode(){
  const code=_diagState.code||($('#diagramCode')&&$('#diagramCode').value)||'';
  if(!code){toast('No diagram code yet','err');return}
  navigator.clipboard.writeText(code).then(()=>toast('Mermaid code copied','ok')).catch(()=>toast('Copy failed','err'));
}

function diagramCopyExplanation(){
  const el=$('#diagramExplain');
  if(!el||!el.textContent){toast('No explanation yet','err');return}
  navigator.clipboard.writeText(el.textContent).then(()=>toast('Explanation copied (Markdown)','ok')).catch(()=>toast('Copy failed','err'));
}

function diagramCopyPrompt(){
  const m=S.repo;
  if(!m){toast('Load a repository first','err');return}
  const custom=($('#diagramCustomInput')&&$('#diagramCustomInput').value||'').trim();
  const prompt=RepodestCore.buildDiagramPrompt(Array.from(FILEMAP.keys()),m,custom);
  navigator.clipboard.writeText(prompt).then(()=>toast('AI Diagram prompt copied — paste into ChatGPT/Claude/Gemini','ok')).catch(()=>toast('Copy failed','err'));
}

function diagramDownloadJSON(){
  if(!_diagState.graph){toast('Render a diagram first','err');return}
  const blob=new Blob([JSON.stringify(_diagState.graph,null,2)],{type:'application/json;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=((S.repo&&S.repo.full_name)||'repo').replace('/','-')+'-architecture.json';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  toast('Graph JSON downloaded','ok');
}

/* A8: Export standalone SVG from viewBox with theme-aware background rect */
function buildStandaloneDiagramSvg(svg){
  const clone=svg.cloneNode(true);
  clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
  const vb=(svg.getAttribute('viewBox')||'').trim().split(/[\s,]+/).map(Number);
  const w=(vb.length===4&&vb[2]>0)?vb[2]:Math.max(800,svg.getBBox().width+40);
  const h=(vb.length===4&&vb[3]>0)?vb[3]:Math.max(500,svg.getBBox().height+40);
  const vx=(vb.length===4)?vb[0]:0;
  const vy=(vb.length===4)?vb[1]:0;
  clone.setAttribute('viewBox',vx+' '+vy+' '+w+' '+h);
  clone.setAttribute('width',Math.round(w));
  clone.setAttribute('height',Math.round(h));
  const bg=document.createElementNS('http://www.w3.org/2000/svg','rect');
  bg.setAttribute('x',vx);bg.setAttribute('y',vy);
  bg.setAttribute('width',w);bg.setAttribute('height',h);
  bg.setAttribute('fill',getComputedStyle(document.documentElement).getPropertyValue('--bg2').trim()||'#0E141D');
  clone.insertBefore(bg,clone.firstChild);
  return{svgString:new XMLSerializer().serializeToString(clone),w,h};
}

function diagramDownloadSVG(){
  const svg=$('#diagramStage svg');
  if(!svg){toast('Render a diagram first','err');return}
  const built=buildStandaloneDiagramSvg(svg);
  const blob=new Blob([built.svgString],{type:'image/svg+xml;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=((S.repo&&S.repo.full_name)||'repo').replace('/','-')+'-architecture.svg';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  toast('SVG downloaded','ok');
}

function diagramDownloadPNG(){
  const svg=$('#diagramStage svg');
  if(!svg){toast('Render a diagram first','err');return}
  try{
    const built=buildStandaloneDiagramSvg(svg);
    const scale=2;
    const cw=Math.round(built.w*scale);
    const ch=Math.round(built.h*scale);
    const dataUrl='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(built.svgString);
    const img=new Image();
    img.onload=()=>{
      const c=document.createElement('canvas');
      c.width=cw;c.height=ch;
      const ctx=c.getContext('2d');
      ctx.drawImage(img,0,0,cw,ch);
      const a=document.createElement('a');
      a.href=c.toDataURL('image/png');
      a.download=((S.repo&&S.repo.full_name)||'repo').replace('/','-')+'-architecture.png';
      a.click();
      toast('PNG downloaded ('+cw+'×'+ch+')','ok');
    };
    img.onerror=()=>toast('PNG export failed — try SVG','err');
    img.src=dataUrl;
  }catch(e){toast('PNG export failed','err')}
}
