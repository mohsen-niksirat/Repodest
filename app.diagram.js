'use strict';
/* ============================================================
   Repodest — Architecture Diagram (GitDiagram-style)
   Interactive Mermaid.js architecture diagram with clickable
   GitHub nodes, pan/zoom, live code editor, SVG/PNG export,
   and optional AI Enhance (copy prompt or BYOK).
   Loaded after app.pr.js, before app.boot.js.
   ============================================================ */
let _mermaidPromise=null;
let _diagState={
  repoKey:'',
  dir:'TD',
  code:'',
  scale:1,
  tx:0,
  ty:0,
  dragging:false,
  sx:0,
  sy:0,
  bound:false,
  renderCount:0
};

function ensureMermaid(){
  if(window.mermaid)return Promise.resolve(window.mermaid);
  if(_mermaidPromise)return _mermaidPromise;
  _mermaidPromise=new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
    s.async=true;
    s.onload=()=>{
      if(window.mermaid){
        window.mermaid.initialize({
          startOnLoad:false,
          securityLevel:'loose',
          theme:document.body.classList.contains('light')?'default':'dark',
          flowchart:{useMaxWidth:false,htmlLabels:true,curve:'basis'}
        });
        resolve(window.mermaid);
      }else reject(new Error('Mermaid failed to initialize'));
    };
    s.onerror=()=>reject(new Error('Could not load Mermaid.js (check internet connection)'));
    document.head.appendChild(s);
  });
  return _mermaidPromise;
}

function diagramBindPanZoom(){
  if(_diagState.bound)return;
  const vp=$('#diagramViewport');
  if(!vp)return;
  _diagState.bound=true;
  vp.addEventListener('wheel',e=>{
    e.preventDefault();
    const factor=e.deltaY<0?1.12:0.89;
    _diagState.scale=Math.max(0.25,Math.min(4,_diagState.scale*factor));
    diagramApplyTransform();
  },{passive:false});
  vp.addEventListener('mousedown',e=>{
    if(e.target.closest('a'))return;
    _diagState.dragging=true;
    _diagState.sx=e.clientX-_diagState.tx;
    _diagState.sy=e.clientY-_diagState.ty;
    vp.style.cursor='grabbing';
  });
  window.addEventListener('mousemove',e=>{
    if(!_diagState.dragging)return;
    _diagState.tx=e.clientX-_diagState.sx;
    _diagState.ty=e.clientY-_diagState.sy;
    diagramApplyTransform();
  });
  window.addEventListener('mouseup',()=>{
    if(!_diagState.dragging)return;
    _diagState.dragging=false;
    const v=$('#diagramViewport');
    if(v)v.style.cursor='grab';
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

function diagramToggleCode(){
  const wrap=$('#diagramCodeWrap');
  if(!wrap)return;
  const hidden=wrap.style.display==='none'||!wrap.style.display;
  wrap.style.display=hidden?'block':'none';
}

async function diagramRenderSVG(code){
  const stage=$('#diagramStage');
  const status=$('#diagramStatus');
  if(!stage)return;
  _diagState.code=code;
  const ta=$('#diagramCode');
  if(ta&&ta.value!==code)ta.value=code;
  if(status)status.textContent='Rendering diagram…';
  try{
    const mmd=await ensureMermaid();
    mmd.initialize({
      startOnLoad:false,
      securityLevel:'loose',
      theme:document.body.classList.contains('light')?'default':'dark',
      flowchart:{useMaxWidth:false,htmlLabels:true,curve:'basis'}
    });
    const id='repodest-mmd-'+(++_diagState.renderCount);
    const out=await mmd.render(id,code);
    stage.innerHTML=out.svg;
    if(typeof out.bindFunctions==='function')out.bindFunctions(stage);
    diagramResetZoom();
    if(status)status.textContent='Click any node to open on GitHub · Scroll to zoom · Drag to pan';
  }catch(e){
    stage.innerHTML='<div style="padding:24px;color:var(--red);font-family:var(--mono);font-size:12px;white-space:pre-wrap">Diagram render error:\n'+esc(e&&e.message||String(e))+'</div>';
    if(status)status.textContent='Syntax error — open Mermaid Code to fix or regenerate.';
  }
}

function renderDiagramTab(force){
  diagramBindPanZoom();
  const m=S.repo;
  if(!m)return;
  const key=(m.full_name||'')+'@'+(m.default_branch||'main')+'@'+_diagState.dir;
  if(!force&&_diagState.repoKey===key&&_diagState.code)return;
  _diagState.repoKey=key;
  const paths=Array.from(FILEMAP.keys());
  const built=RepodestCore.buildArchDiagram(paths,m,{direction:_diagState.dir});
  const statsEl=$('#diagramStats');
  if(statsEl){
    statsEl.textContent=built.stats.layers+' layers · '+built.stats.nodes+' nodes · '+built.stats.edges+' flows · '+built.stats.totalFiles+' files analyzed';
  }
  diagramRenderSVG(built.mermaid);
}

function diagramRenderCode(){
  const ta=$('#diagramCode');
  if(!ta)return;
  const code=RepodestCore.extractMermaidBlock(ta.value);
  if(!code){toast('Paste or write Mermaid code first','err');return}
  diagramRenderSVG(code);
  toast('Diagram updated','ok');
}

function diagramCopyCode(){
  const code=_diagState.code||($('#diagramCode')&&$('#diagramCode').value)||'';
  if(!code){toast('No diagram code yet','err');return}
  navigator.clipboard.writeText(code).then(()=>toast('Mermaid code copied','ok')).catch(()=>toast('Copy failed','err'));
}

function diagramCopyPrompt(){
  const m=S.repo;
  if(!m){toast('Load a repository first','err');return}
  const custom=($('#diagramCustomInput')&&$('#diagramCustomInput').value||'').trim();
  const prompt=RepodestCore.buildDiagramPrompt(Array.from(FILEMAP.keys()),m,custom);
  navigator.clipboard.writeText(prompt).then(()=>toast('AI Diagram prompt copied — paste into ChatGPT/Claude/Gemini!','ok')).catch(()=>toast('Copy failed','err'));
}

function diagramDownloadSVG(){
  const svg=$('#diagramStage svg');
  if(!svg){toast('Render a diagram first','err');return}
  const clone=svg.cloneNode(true);
  clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
  const blob=new Blob([clone.outerHTML],{type:'image/svg+xml;charset=utf-8'});
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
    const rect=svg.getBoundingClientRect();
    const w=Math.max(800,Math.round(rect.width*2));
    const h=Math.max(500,Math.round(rect.height*2));
    const clone=svg.cloneNode(true);
    clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
    clone.setAttribute('width',w);
    clone.setAttribute('height',h);
    const dataUrl='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(clone.outerHTML);
    const img=new Image();
    img.onload=()=>{
      const c=document.createElement('canvas');
      c.width=w;c.height=h;
      const ctx=c.getContext('2d');
      ctx.fillStyle=document.body.classList.contains('light')?'#ffffff':'#0b0d17';
      ctx.fillRect(0,0,w,h);
      ctx.drawImage(img,0,0,w,h);
      const a=document.createElement('a');
      a.href=c.toDataURL('image/png');
      a.download=((S.repo&&S.repo.full_name)||'repo').replace('/','-')+'-architecture.png';
      a.click();
      toast('PNG downloaded','ok');
    };
    img.onerror=()=>toast('PNG export failed — try SVG','err');
    img.src=dataUrl;
  }catch(e){toast('PNG export failed','err')}
}
