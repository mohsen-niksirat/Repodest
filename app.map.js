'use strict';
/* ============================================================
   Repodest — Repo Map
   An Archify-inspired interactive system map: the file tree is
   compiled into a force-directed graph you can pan, zoom, search,
   focus (with upstream/downstream reach), route-probe and lens.
   Zero extra network requests for the base map; real import edges
   are traced on demand. Finite motion, prefers-reduced-motion aware.
   Loaded after app.ux.js. Shares the global scope.
   ============================================================ */

/* ---------- i18n (merged into the shared dictionary) ---------- */
Object.assign(I18N.en,{
  tabMap:'🗺️ Map',
  mapHint:'Click a node to focus it · <b>R</b> route · <b>L</b> lens · <b>/</b> search · <b>M</b> minimap · <b>F</b> present · <b>S</b> style · <b>E</b> export · <b>+ − 0</b> zoom',
  mapTrace:'🧬 Trace imports',mapFit:'⤢ Fit',mapExport:'⬇️ PNG',
  mapNoFiles:'No files to map — load a repository first.',
  mapTracing:'Tracing imports…',mapTraced:'Import tracing done — {n} dependency edges added.',
  mapUpstream:'Upstream (depends on)',mapDownstream:'Downstream (depended on by)',
  mapReach:'reachable',mapFiles:'files',mapBytes:'size',
  mapRoutePick:'Route probe — click a source node, then a target.',
  mapRouteNone:'No route between these nodes.',
  mapSearchPh:'Search nodes… (Esc to close)'
});
Object.assign(I18N.fa,{
  tabMap:'🗺️ نقشه',
  mapHint:'برای تمرکز روی یک گره کلیک کنید · <b>R</b> مسیر · <b>L</b> لنز · <b>/</b> جستجو · <b>M</b> نقشه کوچک · <b>F</b> ارائه · <b>S</b> سبک · <b>E</b> خروجی · <b>+ − 0</b> زوم',
  mapTrace:'🧬 ردیابی import',mapFit:'⤢ جا دادن',mapExport:'⬇️ PNG',
  mapNoFiles:'فایلی برای نقشه‌کشی وجود ندارد — اول یک مخزن بارگذاری کنید.',
  mapTracing:'در حال ردیابی import…',mapTraced:'ردیابی import انجام شد — {n} یال وابستگی اضافه شد.',
  mapUpstream:'بالادست (وابسته به)',mapDownstream:'پایین‌دست (وابسته‌یِ)',
  mapReach:'قابل دسترسی',mapFiles:'فایل',mapBytes:'اندازه',
  mapRoutePick:'یافتن مسیر — یک گره مبدأ و سپس یک گره مقصد انتخاب کنید.',
  mapRouteNone:'مسیری بین این گره‌ها وجود ندارد.',
  mapSearchPh:'جستجوی گره‌ها… (Esc برای بستن)'
});

/* ---------- State ---------- */
const MAP={
  nodes:[],edges:[],byId:new Map(),
  view:{x:0,y:0,k:1},
  focusId:null,reach:null,           /* reach: 'upstream'|'downstream' */
  hl:null,hlEdges:null,              /* computed highlight sets */
  routeFrom:null,routePath:null,
  lensA:null,lensB:null,
  preset:LS.get('repodest_map_preset','neon'),
  present:false,minimap:LS.get('repodest_map_minimap','1')!=='0',
  raf:null,calm:0,drag:null,pan:null,
  traced:false,tracing:false,
  W:0,H:0,dpr:1
};
const MAP_NOISE=/(^|\/)(node_modules|\.git|dist|build|vendor|\.next|__pycache__|\.cache|coverage|\.turbo|tmp|temp|out|\.output|target|\.gradle|\.idea|\.vscode|pods|venv|\.pytest_cache|bower_components)(\/|$)/i;
const MAP_PRESETS=['neon','blueprint','signal-flow','classic','minimal'];
const MAP_KIND_COLOR={
  root:'#a855f7',folder:'#22d3ee',entry:'#22c55e',manifest:'#eab308',
  readme:'#38bdf8',config:'#f97316',test:'#ec4899',file:'#8b9bd4'
};
const MAP_KIND_LABEL={root:'repo',folder:'folder',entry:'entry',manifest:'manifest',readme:'readme',config:'config',test:'test',file:'file'};
const ENTRY_FILES=['index.js','index.ts','index.jsx','index.tsx','main.js','main.ts','main.jsx','main.tsx','app.js','app.ts','app.jsx','app.tsx','server.js','server.ts','main.py','app.py','manage.py','wsgi.py','asgi.py','__main__.py','main.go','lib.rs','main.rs','program.cs','index.html','gulpfile.js','Gruntfile.js'];
const CONFIG_PAT=/^(dockerfile|docker-compose|compose|\.?eslintrc|\.?prettierrc|tsconfig|jsconfig|webpack\.config|vite\.config|next\.config|nuxt\.config|tailwind\.config|postcss\.config|rollup\.config|babel\.config|\.babelrc|jest\.config|vitest\.config|playwright\.config|Makefile|CMakeLists|justfile|procfile|\.env\.example)/i;

/* ---------- Helpers ---------- */
function mapT(k){return t(k)}
function mapBaseName(p){const b=(p||'').split('/').pop();return b||p}
function mapParentDir(p){const i=(p||'').lastIndexOf('/');return i<0?'':p.slice(0,i)}
function mapAddNode(o){
  if(MAP.byId.has(o.id))return MAP.byId.get(o.id);
  const n=Object.assign({x:0,y:0,vx:0,vy:0,r:7,label:o.id},o);
  MAP.nodes.push(n);MAP.byId.set(n.id,n);return n
}
function mapAddEdge(s,t,kind){
  if(!s||!t||s===t)return;
  for(const e of MAP.edges){if(e.s===s&&e.t===t)return}
  MAP.edges.push({s,t,kind:kind||'tree'})
}

/* ============================================================
   Graph construction — from the parsed tree only (no network)
   ============================================================ */
function buildRepoMap(){
  MAP.nodes=[];MAP.edges=[];MAP.byId=new Map();
  MAP.focusId=null;MAP.reach=null;MAP.hl=null;MAP.hlEdges=null;
  MAP.routeFrom=null;MAP.routePath=null;MAP.lensA=MAP.lensB=null;
  MAP.traced=false;MAP.tracing=false;
  const m=S.repo;
  const totalBytes=(()=>{let b=0;FILEMAP.forEach(f=>b+=f.size||0);return b||1})();

  if(!FILEMAP.size||!NODEMAP.size){
    const el=$('#mapInfo');if(el)el.innerHTML='<span style="color:var(--text3);font-size:12.5px">'+esc(mapT('mapNoFiles'))+'</span>';
    return
  }

  /* root */
  mapAddNode({id:'__root__',label:(m&&m.name)||'repo',kind:'root',path:'',bytes:totalBytes,r:20,fixed:true});

  /* folders — prefer the ones carrying the most bytes */
  const folders=[];
  NODEMAP.forEach((node,path)=>{
    if(!path||MAP_NOISE.test(path))return;
    let bytes=0;node.files.forEach(f=>bytes+=f.size||0);
    if(node.files.length<1&&node.dirs.size<1)return;
    folders.push({path,bytes,n:node.files.length});
  });
  folders.sort((a,b)=>b.bytes-a.bytes);
  for(const f of folders.slice(0,90)){
    mapAddNode({id:f.path,label:mapBaseName(f.path),kind:'folder',path:f.path,bytes:f.bytes,r:6+Math.min(12,Math.sqrt(f.bytes/1024))});
  }

  /* notable files */
  const selected=[];const seenFile=new Set();
  const pick=(p,kind,r)=>{if(!p||seenFile.has(p)||MAP_NOISE.test(p))return;seenFile.add(p);selected.push({p,kind,r})};
  MANIFESTS.forEach(mf=>{
    const hit=Array.from(FILEMAP.keys()).find(x=>x===mf.f||x.endsWith('/'+mf.f));
    if(hit)pick(hit,'manifest',10);
  });
  Array.from(FILEMAP.keys()).forEach(p=>{
    const base=(p||'').split('/').pop();
    if(/^readme/i.test(base))pick(p,'readme',11);
    else if(ENTRY_FILES.includes(base))pick(p,'entry',10);
    else if(CONFIG_PAT.test(base))pick(p,'config',9);
    else if(/\.(test|spec)\.[a-z]+$/i.test(p))pick(p,'test',8);
    else if(/^\.github\/workflows\//.test(p))pick(p,'config',9);
  });
  for(const s of selected.slice(0,40))mapAddNode({id:s.p,label:mapBaseName(s.p),kind:s.kind,path:s.p,bytes:(FILEMAP.get(s.p)||{}).size||0,r:s.r,ext:extOf(s.p)});

  /* edges — containment */
  MAP.nodes.forEach(n=>{
    if(n.kind==='root')return;
    const parent=mapParentDir(n.path);
    let anchor=MAP.byId.get(parent);
    if(!anchor){ /* climb up until a known folder or root */
      let p=parent;
      while(p&&!MAP.byId.has(p)){const i=p.lastIndexOf('/');p=i<0?'':p.slice(0,i)}
      anchor=MAP.byId.get(p)||MAP.byId.get('__root__');
    }
    if(anchor)mapAddEdge(n.id,anchor.id,'tree');
  });
  /* edges — heuristic coupling */
  const kindNodes=k=>MAP.nodes.filter(n=>n.kind===k);
  const entries=kindNodes('entry');
  kindNodes('manifest').forEach(mf=>{
    const e=entries.find(e=>mapParentDir(e.path)===mapParentDir(mf.path))||entries[0];
    if(e)mapAddEdge(mf.id,e.id,'couple');
  });
  kindNodes('config').forEach(cf=>{
    const e=entries.find(e=>mapParentDir(e.path)===mapParentDir(cf.path))||entries[0];
    if(e)mapAddEdge(cf.id,e.id,'couple');
  });
  kindNodes('test').forEach(tf=>{
    const src=tf.path.replace(/\.(test|spec)\./i,'.');
    const target=MAP.byId.get(src)||MAP.byId.get(src.replace(/\.(js|ts|jsx|tsx)$/i,m=>({'.js':'.ts','.ts':'.js'}[m]||m)));
    if(target)mapAddEdge(tf.id,target.id,'couple');
  });
  const rd=kindNodes('readme')[0];
  if(rd)mapAddEdge(rd.id,'__root__','couple');

  /* deterministic radial initial layout (avoids a chaotic start) */
  const byKind={};MAP.nodes.forEach(n=>{(byKind[n.kind]=byKind[n.kind]||[]).push(n)});
  const ring={root:0,folder:1,manifest:2,config:2,entry:3,readme:2,test:3,file:4};
  Object.entries(byKind).forEach(([kind,arr])=>{
    const rr=110*(ring[kind]||3);
    arr.forEach((n,i)=>{
      const a=(i/Math.max(1,arr.length))*Math.PI*2+kind.length;
      n.x=Math.cos(a)*rr*(0.8+((i*7)%10)/25);n.y=Math.sin(a)*rr*(0.8+((i*3)%10)/25);
    });
  });

  renderMapLegend();
  mapFit(true);
  mapApplyHash();
  mapWake();
}

function renderMapLegend(){
  const el=$('#mapLegend');
  if(!el)return;
  const kinds=[...new Set(MAP.nodes.map(n=>n.kind))];
  el.innerHTML=kinds.map(k=>'<span><span class="dot" style="background:'+MAP_KIND_COLOR[k]+'"></span>'+MAP_KIND_LABEL[k]+'</span>').join('')+
    (MAP.traced?'<span><span class="dot" style="background:#f472b6"></span>import</span>':'');
}

/* ============================================================
   Optional: trace real imports from fetched source files
   ============================================================ */
const MAP_IMPORT_EXT=new Set(['js','mjs','cjs','ts','jsx','tsx','py']);
async function traceMapImports(){
  if(MAP.tracing||!MAP.nodes.length)return;
  const btn=$('#mapTraceBtn');
  MAP.tracing=true;
  if(btn){btn.disabled=true;btn.textContent=mapT('mapTracing')}
  const branch=(S.repo&&S.repo.default_branch)||'main';
  const full=S.repo&&S.repo.full_name;
  /* only files that are already nodes, plus a bounded sample of others */
  const nodeFiles=MAP.nodes.filter(n=>n.kind!=='root'&&n.kind!=='folder').map(n=>n.path);
  const candidates=nodeFiles.filter(p=>MAP_IMPORT_EXT.has(extOf(p)));
  let added=0,scanned=0;
  const MAX=60;
  for(const p of candidates.slice(0,MAX)){
    const f=FILEMAP.get(p);
    if(!f||(f.size||0)>60000)continue;
    try{
      const resp=await fetch(rawUrl(full,branch,p));
      if(!resp.ok)continue;
      const code=await resp.text();
      scanned++;
      const specs=mapParseImports(code,extOf(p));
      for(const spec of specs){
        const target=mapResolveImport(p,spec);
        if(target&&MAP.byId.has(target)&&MAP.byId.get(target).kind!=='root'){
          mapAddEdge(p,target,'import');added++;
        }
      }
    }catch(e){/* skip this file */}
  }
  MAP.traced=true;MAP.tracing=false;
  if(btn){btn.disabled=false;btn.innerHTML='🧬 <span>'+esc(mapT('mapTrace').replace('🧬 ',''))+'</span>'}
  renderMapLegend();
  mapWake();
  toast(mapT('mapTraced').replace('{n}',added)+' ('+scanned+' files scanned)','ok');
}
function mapParseImports(code,ext){
  const out=new Set();
  if(ext==='py'){
    const re=/^\s*(?:from\s+([.\w]+)\s+import|import\s+([.\w]+))/gm;let m;
    while((m=re.exec(code))){const s=m[1]||m[2];if(s&&s.startsWith('.'))out.add(s)}
  }else{
    const re=/(?:import\s+[^'";]*from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\)|export\s+(?:[\w*{}\s,]+from\s*)?['"]([^'"]+)['"])/g;
    let m;
    while((m=re.exec(code))){const s=m[1]||m[2]||m[3]||m[4];if(s&&/^\.{1,2}\//.test(s))out.add(s)}
  }
  return [...out];
}
function mapResolveImport(fromPath,spec){
  const dir=mapParentDir(fromPath);
  const parts=dir?dir.split('/').slice():[];
  for(const seg of spec.split('/')){
    if(seg==='.')continue;
    if(seg==='..'){parts.pop();continue}
    parts.push(seg);
  }
  let base=parts.join('/');
  const cands=[base,base+'.js',base+'.mjs',base+'.cjs',base+'.ts',base+'.tsx',base+'.jsx',base+'.py',base+'/index.js',base+'/index.ts',base+'/index.tsx',base+'/__init__.py'];
  for(const c of cands){if(FILEMAP.has(c))return c}
  return null;
}

/* ============================================================
   Highlight computation: focus + reach, route, lens
   ============================================================ */
function mapNeighbors(id,dir){
  /* dir 'out' = follow s→t (dependencies), 'in' = reverse (dependents) */
  const out=new Set(),outE=new Set();
  const stack=[id];const seen=new Set([id]);
  while(stack.length){
    const cur=stack.pop();
    MAP.edges.forEach((e,i)=>{
      const next=dir==='out'?(e.s===cur?e.t:null):(e.t===cur?e.s:null);
      if(next!==null&&!seen.has(next)){seen.add(next);out.add(next);outE.add(i);stack.push(next)}
    });
  }
  return{nodes:out,edges:outE};
}
function mapComputeHighlight(){
  MAP.hl=null;MAP.hlEdges=null;
  if(MAP.focusId){
    const dir=MAP.reach==='downstream'?'in':'out';
    const res=mapNeighbors(MAP.focusId,dir);
    MAP.hl=new Set([MAP.focusId,...res.nodes]);
    MAP.hlEdges=res.edges;
  }else if(MAP.lensA&&MAP.lensB){
    MAP.hl=new Set(MAP.nodes.filter(n=>n.kind===MAP.lensA||n.kind===MAP.lensB).map(n=>n.id));
    MAP.hlEdges=new Set(MAP.edges.map((e,i)=>i).filter(i=>{
      const a=MAP.byId.get(MAP.edges[i].s),b=MAP.byId.get(MAP.edges[i].t);
      return a&&b&&((a.kind===MAP.lensA&&b.kind===MAP.lensB)||(a.kind===MAP.lensB&&b.kind===MAP.lensA));
    }));
  }
}
function mapBFSPath(a,b){
  if(!MAP.byId.has(a)||!MAP.byId.has(b))return null;
  const prev={};const q=[a];const seen=new Set([a]);
  while(q.length){
    const cur=q.shift();
    if(cur===b)break;
    for(const e of MAP.edges){
      let next=null;
      if(e.s===cur)next=e.t;else if(e.t===cur)next=e.s;
      if(next!==null&&!seen.has(next)){seen.add(next);prev[next]=cur;q.push(next)}
    }
  }
  if(!(b in prev)&&a!==b)return null;
  const path=[b];let cur=b;
  while(cur!==a){cur=prev[cur];path.unshift(cur)}
  return path;
}

/* ---------- Focus / reach / route / lens actions ---------- */
function mapFocus(id,reach){
  MAP.focusId=id;MAP.reach=reach||null;
  MAP.routeFrom=null;MAP.routePath=null;
  mapComputeHighlight();mapRenderInfo();mapWriteHash();mapWake();
}
function mapClearFocus(){
  MAP.focusId=null;MAP.reach=null;MAP.routeFrom=null;MAP.routePath=null;
  MAP.lensA=MAP.lensB=null;
  mapComputeHighlight();mapRenderInfo();mapWriteHash();
}
function mapToggleLens(){
  const kinds=['folder','entry','manifest','config','test','readme','file'];
  if(!MAP.lensA){MAP.lensA='entry';MAP.lensB='config'}
  else{
    const i=kinds.indexOf(MAP.lensA);
    if(i>=kinds.length-2){MAP.lensA=MAP.lensB=null}
    else{MAP.lensA=kinds[i+1];MAP.lensB=kinds[(i+2)%kinds.length]}
  }
  MAP.focusId=null;
  mapComputeHighlight();mapRenderInfo();mapWriteHash();mapWake();
  if(MAP.lensA)toast('Lens: '+MAP_KIND_LABEL[MAP.lensA]+' ↔ '+MAP_KIND_LABEL[MAP.lensB],'ok');
}
function mapRoutePick(id){
  if(!MAP.routeFrom){MAP.routeFrom=id;MAP.routePath=null;mapRenderInfo();return}
  if(MAP.routeFrom===id){MAP.routeFrom=null;MAP.routePath=null;mapRenderInfo();return}
  const path=mapBFSPath(MAP.routeFrom,id);
  MAP.routePath=path;MAP.routeFrom=path?null:id;
  if(!path)toast(mapT('mapRouteNone'),'err');
  mapComputeHighlight();mapRenderInfo();mapWriteHash();mapWake();
}

/* ---------- Info panel ---------- */
function mapRenderInfo(){
  const el=$('#mapInfo');
  if(!el)return;
  if(MAP.routeFrom&&!MAP.routePath){
    el.innerHTML='<div class="mi-mode">🧭 '+esc(mapT('mapRoutePick'))+'</div>'+
      '<div class="mi-actions"><button class="btn ghost sm" onclick="mapClearFocus()">✕ Cancel</button></div>';
    el.classList.add('show');return;
  }
  if(MAP.routePath&&MAP.routePath.length>1){
    el.innerHTML='<div class="mi-mode">🧭 Route · '+MAP.routePath.length+' hops</div>'+
      '<div class="mi-path">'+MAP.routePath.map(p=>'<span>'+esc(mapBaseName(p))+'</span>').join('<i>→</i>')+'</div>'+
      '<div class="mi-actions"><button class="btn ghost sm" onclick="mapClearFocus()">✕ Clear</button></div>';
    el.classList.add('show');return;
  }
  const n=MAP.focusId?MAP.byId.get(MAP.focusId):null;
  if(!n){
    el.classList.remove('show');el.innerHTML='';return;
  }
  const f=FILEMAP.get(n.id)||{size:n.bytes||0};
  const upstream=MAP.reach==='downstream'?0:mapNeighbors(n.id,'out').nodes.size;
  const downstream=MAP.reach==='upstream'?0:mapNeighbors(n.id,'in').nodes.size;
  el.innerHTML=
    '<div class="mi-head"><span class="mi-dot" style="background:'+(MAP_KIND_COLOR[n.kind]||'#888')+'"></span>'+
      '<b>'+esc(n.label)+'</b><span class="mi-kind">'+MAP_KIND_LABEL[n.kind]+'</span></div>'+
    '<div class="mi-path" style="font-size:10.5px">'+esc(n.path||'/')+'</div>'+
    '<div class="mi-stats"><span>'+fmtSize(f.size||0)+'</span><span>'+upstream+' '+mapT('mapReach')+' ↑</span><span>'+downstream+' '+mapT('mapReach')+' ↓</span></div>'+
    '<div class="mi-actions">'+
      '<button class="btn ghost sm" onclick="mapFocus(MAP.focusId,\'upstream\')">↑ '+esc(mapT('mapUpstream'))+'</button>'+
      '<button class="btn ghost sm" onclick="mapFocus(MAP.focusId,\'downstream\')">↓ '+esc(mapT('mapDownstream'))+'</button>'+
      '<button class="btn ghost sm" onclick="mapToggleSel()">✓ Select file</button>'+
      '<button class="btn ghost sm" onclick="mapClearFocus()">✕</button>'+
    '</div>';
  el.classList.add('show');
}
function mapToggleSel(){
  const n=MAP.focusId?MAP.byId.get(MAP.focusId):null;
  if(!n)return;
  if(n.kind==='folder'){
    const prefix=n.path?n.path+'/':'';
    let count=0;
    FILEMAP.forEach((f,p)=>{if(!prefix||p.startsWith(prefix)){S.sel.add(p);count++}});
    updateSelMeta();toast(count+' files selected','ok');
  }else if(FILEMAP.has(n.id)){
    S.sel.has(n.id)?S.sel.delete(n.id):S.sel.add(n.id);
    updateSelMeta();toast(S.sel.has(n.id)?'Added to digest selection':'Removed from selection','ok');
  }
}

/* ============================================================
   Rendering & simulation
   ============================================================ */
function mapFit(silent){
  if(!MAP.nodes.length)return;
  let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
  MAP.nodes.forEach(n=>{minX=Math.min(minX,n.x);minY=Math.min(minY,n.y);maxX=Math.max(maxX,n.x);maxY=Math.max(maxY,n.y)});
  const bw=Math.max(80,maxX-minX),bh=Math.max(80,maxY-minY);
  const wrap=$('#mapWrap');
  const W=wrap?wrap.clientWidth:900,H=wrap?wrap.clientHeight:520;
  const k=Math.min(2.2,Math.max(0.25,Math.min((W-90)/bw,(H-90)/bh)));
  MAP.view.k=k;
  MAP.view.x=-(minX+maxX)/2*k;
  MAP.view.y=-(minY+maxY)/2*k;
  if(!silent)mapWake();
}
function mapZoomAt(sx,sy,f){
  const k2=Math.min(4,Math.max(0.2,MAP.view.k*f));
  const wrap=$('#mapWrap');
  const W=wrap?wrap.clientWidth:900,H=wrap?wrap.clientHeight:520;
  const wx=(sx-W/2-MAP.view.x)/MAP.view.k,wy=(sy-H/2-MAP.view.y)/MAP.view.k;
  MAP.view.k=k2;
  MAP.view.x=sx-W/2-wx*k2;MAP.view.y=sy-H/2-wy*k2;
}
function mapWake(){
  MAP.calm=0;
  if(!MAP.raf)MAP.raf=requestAnimationFrame(mapTick);
}

function mapPresetStyle(){
  const light=document.body.classList.contains('light');
  const p=MAP.preset;
  if(p==='blueprint'){
    return{bg:light?'#dfe9f5':'#0b1626',grid:light?'rgba(20,60,110,.12)':'rgba(90,160,255,.10)',
      edge:light?'rgba(30,70,130,.35)':'rgba(110,160,255,.28)',edgeHi:'#38bdf8',
      node:light?'#0f2a4a':'#dbeafe',glow:'rgba(56,189,248,.5)',vignette:false,
      edgeDash:null,nodeShape:'rect'};
  }
  if(p==='signal-flow'){
    return{bg:light?'#f0fdf4':'#071210',grid:light?'rgba(34,197,94,.08)':'rgba(34,197,94,.06)',
      edge:light?'rgba(22,163,74,.30)':'rgba(74,222,128,.25)',edgeHi:'#4ade80',
      node:light?'#14532d':'#bbf7d0',glow:'rgba(74,222,128,.55)',vignette:true,
      edgeDash:[6,4],nodeShape:'circle'};
  }
  if(p==='classic'){
    return{bg:light?'#ffffff':'#1a1a2e',grid:light?'rgba(0,0,0,.04)':'rgba(255,255,255,.03)',
      edge:light?'rgba(0,0,0,.18)':'rgba(255,255,255,.15)',edgeHi:'#f59e0b',
      node:light?'#1e293b':'#e2e8f0',glow:'rgba(245,158,11,.45)',vignette:false,
      edgeDash:null,nodeShape:'circle'};
  }
  if(p==='minimal'){
    return{bg:light?'#f4f4f7':'#101018',grid:'rgba(120,120,150,.06)',edge:light?'rgba(60,60,90,.25)':'rgba(140,140,180,.22)',edgeHi:'#a855f7',
      node:light?'#1c1c28':'#cbd5e1',glow:'rgba(168,85,247,.35)',vignette:false,
      edgeDash:null,nodeShape:'circle'};
  }
  return{bg:light?'#0d0d18':'#0a0a14',grid:'rgba(124,58,237,.07)',edge:light?'rgba(80,80,140,.25)':'rgba(120,110,200,.30)',edgeHi:'#22d3ee',
    node:'#e2e8f0',glow:'rgba(34,211,238,.55)',vignette:true,
    edgeDash:null,nodeShape:'mixed'};
}

function mapDrawScene(ctx,W,H,dpr,time){
  const st=mapPresetStyle();
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle=st.bg;ctx.fillRect(0,0,W,H);
  /* dot grid */
  ctx.fillStyle=st.grid;
  const step=34*MAP.view.k;
  if(step>8){
    const ox=(MAP.view.x+W/2)%step,oy=(MAP.view.y+H/2)%step;
    for(let x=ox;x<W;x+=step){for(let y=oy;y<H;y+=step){ctx.fillRect(x,y,1.4,1.4)}}
  }
  if(st.vignette){
    const g=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.2,W/2,H/2,Math.max(W,H)*0.75);
    g.addColorStop(0,'rgba(124,58,237,.05)');g.addColorStop(1,'rgba(0,0,0,.35)');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  }
  const toSX=wx=>wx*MAP.view.k+W/2+MAP.view.x;
  const toSY=wy=>wy*MAP.view.k+H/2+MAP.view.y;
  const hasHl=!!(MAP.hl||MAP.routePath);
  const inHl=id=>!hasHl||(MAP.hl&&MAP.hl.has(id))||(MAP.routePath&&MAP.routePath.includes(id));
  const edgeInHl=i=>!hasHl||(MAP.hlEdges&&MAP.hlEdges.has(i))||(MAP.routePath&&MAP.routePath.some((p,j)=>{const q=MAP.routePath[j+1];return q&&((MAP.edges[i].s===p&&MAP.edges[i].t===q)||(MAP.edges[i].t===p&&MAP.edges[i].s===q))}));
  /* edges — curved for a more organic, "wired" look */
  MAP.edges.forEach((e,i)=>{
    const a=MAP.byId.get(e.s),b=MAP.byId.get(e.t);
    if(!a||!b)return;
    const ax=toSX(a.x),ay=toSY(a.y),bx=toSX(b.x),by=toSY(b.y);
    const on=edgeInHl(i);
    ctx.beginPath();
    ctx.moveTo(ax,ay);
    if(st.nodeShape==='rect'&&e.kind!=='import'){
      ctx.lineTo(bx,by);
    }else{
      const mx=(ax+bx)/2,my=(ay+by)/2;
      const bend=Math.min(26,Math.hypot(bx-ax,by-ay)*0.12);
      ctx.quadraticCurveTo(mx-bend*0.5,my+bend,bx,by);
    }
    if(on&&hasHl){
      ctx.strokeStyle=st.edgeHi;ctx.lineWidth=1.6+(e.kind==='import'?0.8:0);
      ctx.shadowColor=st.edgeHi;ctx.shadowBlur=6;
    }else{
      ctx.strokeStyle=st.edge;ctx.lineWidth=e.kind==='import'?1.2:0.9;
      ctx.shadowBlur=0;
      if(hasHl)ctx.globalAlpha=0.14;
    }
    if(e.kind==='import'&&!hasHl&&st.edgeDash)ctx.setLineDash(st.edgeDash);
    else if(e.kind==='import'&&!hasHl)ctx.setLineDash([4,4]);
    ctx.stroke();
    ctx.setLineDash([]);ctx.globalAlpha=1;ctx.shadowBlur=0;
  });
  /* route overlay — animated dashes along the path */
  if(MAP.routePath&&MAP.routePath.length>1){
    ctx.beginPath();
    for(let j=0;j<MAP.routePath.length-1;j++){
      const a=MAP.byId.get(MAP.routePath[j]),b=MAP.byId.get(MAP.routePath[j+1]);
      if(!a||!b)continue;
      const ax=toSX(a.x),ay=toSY(a.y),bx=toSX(b.x),by=toSY(b.y);
      if(j===0)ctx.moveTo(ax,ay);
      if(MAP.preset==='signal-flow'){
        const mx=(ax+bx)/2,my=(ay+by)/2;
        const bend=Math.min(30,Math.hypot(bx-ax,by-ay)*0.15);
        ctx.quadraticCurveTo(mx-bend*0.5,my+bend,bx,by);
      }else{
        ctx.lineTo(bx,by);
      }
    }
    ctx.strokeStyle=st.edgeHi;ctx.lineWidth=2.4;ctx.lineCap='round';
    ctx.setLineDash([8,7]);ctx.lineDashOffset=-(time||0)/45;
    ctx.shadowColor=st.edgeHi;ctx.shadowBlur=10;
    ctx.stroke();
    ctx.setLineDash([]);ctx.lineDashOffset=0;ctx.shadowBlur=0;
  }
  /* nodes */
  const showLabels=MAP.nodes.length<60||MAP.view.k>1.1;
  MAP.nodes.forEach(n=>{
    const sx=toSX(n.x),sy=toSY(n.y);
    const r=n.r*Math.sqrt(MAP.view.k);
    const on=!hasHl||inHl(n.id);
    const focused=n.id===MAP.focusId;
    ctx.globalAlpha=on?1:0.18;
    const color=n.kind==='folder'?MAP_KIND_COLOR.folder:(FILEMAP.has(n.id)?langColor(extOf(n.path)||n.kind):MAP_KIND_COLOR[n.kind]);
    if(focused||(MAP.hl&&MAP.hl.has(n.id))){
      ctx.shadowColor=st.glow;ctx.shadowBlur=focused?22:12;
    }
    ctx.beginPath();
    if(st.nodeShape==='rect'&&n.kind!=='root'){
      ctx.rect(sx-Math.max(3,r),sy-Math.max(3,r)*0.8,Math.max(3,r)*2,Math.max(3,r)*1.6);
    }else{
      mapNodePath(ctx,n.kind,sx,sy,Math.max(3,r));
    }
    ctx.fillStyle=color;ctx.fill();
    ctx.shadowBlur=0;
    ctx.lineWidth=focused?2.2:1;
    ctx.strokeStyle=focused?st.edgeHi:'rgba(255,255,255,.22)';
    ctx.stroke();
    if(showLabels||focused||(MAP.hl&&MAP.hl.has(n.id))){
      ctx.globalAlpha=on?0.95:0.25;
      ctx.fillStyle=st.node;
      ctx.font=(focused?'600 ':'')+(r>11?'11.5px':'10px')+' Inter,sans-serif';
      ctx.textAlign='center';
      const lbl=n.label.length>18?n.label.slice(0,16)+'…':n.label;
      ctx.fillText(lbl,sx,sy+Math.max(3,r)+13);
      ctx.globalAlpha=1;
    }
    ctx.globalAlpha=1;
  });
  ctx.textAlign='left';
}
function mapNodePath(ctx,kind,x,y,r){
  switch(kind){
    case 'root':{
      ctx.arc(x,y,r,0,Math.PI*2);return;
    }
    case 'folder':{
      if(ctx.roundRect){ctx.beginPath();ctx.roundRect(x-r,y-r*0.78,r*2,r*1.56,5);return}
      ctx.rect(x-r,y-r*0.78,r*2,r*1.56);return;
    }
    case 'entry':{ /* diamond */
      ctx.moveTo(x,y-r);ctx.lineTo(x+r*1.1,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r*1.1,y);ctx.closePath();return;
    }
    case 'manifest':{ /* hexagon */
      for(let i=0;i<6;i++){const a=Math.PI/3*i+Math.PI/6;const px=x+r*Math.cos(a),py=y+r*Math.sin(a);i?ctx.lineTo(px,py):ctx.moveTo(px,py)}
      ctx.closePath();return;
    }
    case 'config':{
      ctx.rect(x-r,y-r,r*2,r*2);return;
    }
    case 'test':{ /* triangle */
      ctx.moveTo(x,y-r*1.15);ctx.lineTo(x+r,y+r*0.8);ctx.lineTo(x-r,y+r*0.8);ctx.closePath();return;
    }
    default:ctx.arc(x,y,r,0,Math.PI*2);
  }
}

/* ---------- Physics (finite motion) ---------- */
function mapPhysics(){
  const N=MAP.nodes;
  for(let i=0;i<N.length;i++){
    for(let j=i+1;j<N.length;j++){
      const a=N[i],b=N[j];
      let dx=a.x-b.x,dy=a.y-b.y;
      let dist=Math.sqrt(dx*dx+dy*dy)||1;
      const force=Math.min(2.5,2600/(dist*dist));
      const fx=dx/dist*force,fy=dy/dist*force;
      if(!a.fixed){a.vx+=fx;a.vy+=fy}
      if(!b.fixed){b.vx-=fx;b.vy-=fy}
    }
  }
  MAP.edges.forEach(e=>{
    const a=MAP.byId.get(e.s),b=MAP.byId.get(e.t);
    if(!a||!b)return;
    let dx=a.x-b.x,dy=a.y-b.y;
    let dist=Math.sqrt(dx*dx+dy*dy)||1;
    const ideal=e.kind==='tree'?95:e.kind==='import'?70:130;
    const force=(dist-ideal)*(e.kind==='import'?0.006:0.004);
    const fx=dx/dist*force,fy=dy/dist*force;
    if(!b.fixed){b.vx+=fx;b.vy+=fy}
    if(!a.fixed){a.vx-=fx;a.vy-=fy}
  });
  let energy=0;
  for(const n of N){
    if(n.fixed)continue;
    n.vx-=n.x*0.0012;n.vy-=n.y*0.0012;
    n.vx*=0.9;n.vy*=0.9;
    if(n.drag){n.x=n.dragX;n.y=n.dragY;continue}
    n.x+=n.vx;n.y+=n.vy;
    energy+=Math.abs(n.vx)+Math.abs(n.vy);
  }
  return energy;
}
function mapTick(time){
  const wrap=$('#mapWrap');
  const canvas=$('#mapCanvas');
  if(!wrap||!canvas){MAP.raf=null;return}
  const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!reduced){
    const energy=mapPhysics();
    if(energy<0.4){MAP.calm++;if(MAP.calm>40){MAP.raf=null;mapDraw();return}}
    else MAP.calm=0;
  }
  mapDraw(time);
  MAP.raf=requestAnimationFrame(mapTick);
}
function mapDraw(time){
  const canvas=$('#mapCanvas');
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  mapDrawScene(ctx,MAP.W,MAP.H,MAP.dpr,time||performance.now());
  mapDrawMinimap();
}

/* ---------- Minimap ---------- */
function mapDrawMinimap(){
  const mc=$('#mapMinimap');
  if(!mc||!MAP.minimap||!MAP.nodes.length){if(mc)mc.style.display='none';return}
  mc.style.display='';
  const ctx=mc.getContext('2d');
  const W=mc.width,H=mc.height;
  let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
  MAP.nodes.forEach(n=>{minX=Math.min(minX,n.x);minY=Math.min(minY,n.y);maxX=Math.max(maxX,n.x);maxY=Math.max(maxY,n.y)});
  const pad=14;
  const s=Math.min((W-pad*2)/Math.max(40,maxX-minX),(H-pad*2)/Math.max(40,maxY-minY));
  const ox=(W-(maxX-minX)*s)/2-minX*s,oy=(H-(maxY-minY)*s)/2-minY*s;
  ctx.clearRect(0,0,W,H);
  const st=mapPresetStyle();
  ctx.fillStyle=st.bg;ctx.globalAlpha=0.7;ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;
  MAP.nodes.forEach(n=>{
    ctx.beginPath();ctx.arc(ox+n.x*s,oy+n.y*s,2,0,Math.PI*2);
    ctx.fillStyle=MAP_KIND_COLOR[n.kind]||'#888';ctx.fill();
  });
  /* viewport rect */
  const wrap=$('#mapWrap');
  const vw=wrap.clientWidth,vh=wrap.clientHeight;
  const vx=(-MAP.view.x+vw/2)/MAP.view.k,vy=(-MAP.view.y+vh/2)/MAP.view.k;
  ctx.strokeStyle=st.edgeHi;ctx.lineWidth=1;
  ctx.strokeRect(ox+vx*s-vw/2*s,oy+vy*s-vh/2*s,vw*s,vh*s);
}

/* ============================================================
   Canvas setup, pan/zoom/click/drag
   ============================================================ */
let mapResizeCtl=null;
function startMapAnimation(){
  const canvas=$('#mapCanvas');
  const wrap=$('#mapWrap');
  if(!canvas||!wrap)return;
  const ctx=canvas.getContext('2d');
  MAP.dpr=Math.min(window.devicePixelRatio||1,2);
  function resize(){
    MAP.W=wrap.clientWidth;MAP.H=wrap.clientHeight;
    canvas.width=Math.round(MAP.W*MAP.dpr);canvas.height=Math.round(MAP.H*MAP.dpr);
    canvas.style.width=MAP.W+'px';canvas.style.height=MAP.H+'px';
    if(!MAP.raf)mapDraw();
  }
  resize();
  if(mapResizeCtl)mapResizeCtl.abort();
  mapResizeCtl=new AbortController();
  window.addEventListener('resize',resize,{signal:mapResizeCtl.signal});

  const tooltip=$('#mapTooltip');
  const toWX=sx=>(sx-MAP.W/2-MAP.view.x)/MAP.view.k;
  const toWY=sy=>(sy-MAP.H/2-MAP.view.y)/MAP.view.k;
  const toSX=wx=>wx*MAP.view.k+MAP.W/2+MAP.view.x;
  const toSY=wy=>wy*MAP.view.k+MAP.H/2+MAP.view.y;
  let hoverId=null,downX=0,downY=0,moved=false;

  const sig=mapResizeCtl.signal;
  canvas.addEventListener('mousedown',e=>{
    const r=canvas.getBoundingClientRect();
    const sx=e.clientX-r.left,sy=e.clientY-r.top;
    downX=sx;downY=sy;moved=false;
    const hit=mapHit(sx,sy,toWX,toWY);
    if(hit){MAP.drag={id:hit.id};hit.drag=true;hit.dragX=toWX(sx);hit.dragY=toWY(sy)}
    else MAP.pan={sx,sy,vx:MAP.view.x,vy:MAP.view.y};
    mapWake();
  },{signal:sig});
  canvas.addEventListener('mousemove',e=>{
    const r=canvas.getBoundingClientRect();
    const sx=e.clientX-r.left,sy=e.clientY-r.top;
    if(MAP.drag){
      moved=true;
      const n=MAP.byId.get(MAP.drag.id);
      if(n){n.dragX=toWX(sx);n.dragY=toWY(sy);mapWake()}
      return;
    }
    if(MAP.pan){
      moved=true;
      MAP.view.x=MAP.pan.vx+(sx-MAP.pan.sx);
      MAP.view.y=MAP.pan.vy+(sy-MAP.pan.sy);
      mapDraw();return;
    }
    const hit=mapHit(sx,sy,toWX,toWY);
    if(hit&&(!tooltip||hoverId!==hit.id)){
      hoverId=hit.id;
      if(tooltip){
        tooltip.innerHTML='<b>'+esc(hit.label)+'</b><span>'+esc(hit.path||'/')+'</span>';
        tooltip.style.left=(sx+14)+'px';tooltip.style.top=(sy-10)+'px';
        tooltip.classList.add('show');
      }
      canvas.style.cursor='pointer';
    }else if(!hit){
      hoverId=null;
      if(tooltip)tooltip.classList.remove('show');
      canvas.style.cursor='';
    }
  },{signal:sig});
  window.addEventListener('mouseup',()=>{
    if(MAP.drag){
      const n=MAP.byId.get(MAP.drag.id);
      if(n){n.drag=false;const dx=n.dragX-n.x,dy=n.dragY-n.y;n.x=n.dragX;n.y=n.dragY;n.vx=dx;n.vy=dy;delete n.dragX;delete n.dragY}
      if(!moved&&MAP.drag.id)mapClickNode(MAP.drag.id);
      MAP.drag=null;mapWake();
    }
    if(MAP.pan){MAP.pan=null}
    moved=false;
  },{signal:sig});
  canvas.addEventListener('mouseleave',()=>{if(tooltip)tooltip.classList.remove('show');hoverId=null},{signal:sig});
  canvas.addEventListener('wheel',e=>{
    e.preventDefault();
    const r=canvas.getBoundingClientRect();
    mapZoomAt(e.clientX-r.left,e.clientY-r.top,e.deltaY<0?1.12:0.9);
    mapDraw();
  },{passive:false,signal:sig});
  /* minimap click → jump */
  const mc=$('#mapMinimap');
  if(mc)mc.addEventListener('click',e=>{
    if(!MAP.nodes.length)return;
    const r=mc.getBoundingClientRect();
    const mx=(e.clientX-r.left)/r.width*mc.width,my=(e.clientY-r.top)/r.height*mc.height;
    let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
    MAP.nodes.forEach(n=>{minX=Math.min(minX,n.x);minY=Math.min(minY,n.y);maxX=Math.max(maxX,n.x);maxY=Math.max(maxY,n.y)});
    const pad=14;
    const s=Math.min((mc.width-pad*2)/Math.max(40,maxX-minX),(mc.height-pad*2)/Math.max(40,maxY-minY));
    const ox=(mc.width-(maxX-minX)*s)/2-minX*s,oy=(mc.height-(maxY-minY)*s)/2-minY*s;
    const wx=(mx-ox)/s,wy=(my-oy)/s;
    MAP.view.x=-wx*MAP.view.k;MAP.view.y=-wy*MAP.view.k;
    mapDraw();
  },{signal:sig});
  mapFit(true);
  mapWake();
}
function mapHit(sx,sy,toWX,toWY){
  const wx=toWX(sx),wy=toWY(sy);
  let best=null,bd=1e9;
  for(const n of MAP.nodes){
    const d=Math.hypot(n.x-wx,n.y-wy);
    const rr=(n.r*Math.sqrt(MAP.view.k))+6/MAP.view.k;
    if(d<rr&&d<bd){best=n;bd=d}
  }
  return best;
}
function mapClickNode(id){
  const n=MAP.byId.get(id);
  if(!n)return;
  if(MAP.routeFrom&&MAP.routeFrom!==id){mapRoutePick(id);return}
  mapFocus(id,MAP.focusId?MAP.reach:null);
}

/* ============================================================
   Search overlay
   ============================================================ */
function mapOpenSearch(){
  const box=$('#mapSearch');
  const inp=$('#mapSearchInput');
  if(!box||!inp)return;
  box.classList.add('show');
  inp.value='';
  mapRenderSearchResults('');
  inp.focus();
}
function mapCloseSearch(){
  const box=$('#mapSearch');
  if(box)box.classList.remove('show');
  const inp=$('#mapSearchInput');
  if(inp&&document.activeElement===inp)inp.blur();
}
function mapRenderSearchResults(q){
  const el=$('#mapSearchResults');
  if(!el)return;
  q=(q||'').trim().toLowerCase();
  if(!q){el.innerHTML='';return}
  const res=MAP.nodes.filter(n=>(n.label||'').toLowerCase().includes(q)||(n.path||'').toLowerCase().includes(q)).slice(0,10);
  if(!res.length){el.innerHTML='<div class="msr-empty">No matches</div>';return}
  el.innerHTML=res.map((n,i)=>'<div class="msr" data-id="'+esc(n.id)+'"><span class="mi-dot" style="background:'+(MAP_KIND_COLOR[n.kind]||'#888')+'"></span><span>'+esc(n.label)+'</span><small>'+esc(n.path||'/')+'</small></div>').join('');
  el.querySelectorAll('.msr').forEach(row=>{
    row.addEventListener('click',()=>{mapFocus(row.dataset.id);mapCloseSearch()});
  });
}

/* ============================================================
   Presets, minimap, presentation, export
   ============================================================ */
function cycleMapPreset(){
  const i=MAP_PRESETS.indexOf(MAP.preset);
  MAP.preset=MAP_PRESETS[(i+1)%MAP_PRESETS.length];
  LS.set('repodest_map_preset',MAP.preset);
  const name=$('#mapPresetName');
  if(name)name.textContent=MAP.preset[0].toUpperCase()+MAP.preset.slice(1);
  mapDraw();
  toast('Style: '+MAP.preset,'ok');
}
function toggleMapMinimap(){
  MAP.minimap=!MAP.minimap;
  LS.set('repodest_map_minimap',MAP.minimap?'1':'0');
  const btn=$('#mapMinimapBtn');
  if(btn)btn.style.opacity=MAP.minimap?'1':'.5';
  mapDraw();
}
function toggleMapPresent(){
  MAP.present=!MAP.present;
  const wrap=$('#mapWrap');
  if(wrap)wrap.classList.toggle('present',MAP.present);
  if(MAP.present)setTimeout(()=>{mapFit(true);mapDraw()},60);
  else setTimeout(()=>{mapFit(true);mapDraw()},60);
}
function exportMapPNG(){
  const canvas=$('#mapCanvas');
  if(!canvas||!MAP.nodes.length){toast('Nothing to export yet','err');return}
  const off=document.createElement('canvas');
  const scale=2;
  off.width=MAP.W*scale;off.height=MAP.H*scale;
  const ctx=off.getContext('2d');
  mapDrawScene(ctx,MAP.W,MAP.H,scale,performance.now());
  const a=document.createElement('a');
  const m=S.repo;
  a.download=((m&&m.full_name)||'repo').replace('/','-')+'-repodest-map.png';
  a.href=off.toDataURL('image/png');
  a.click();
  toast('Map PNG exported','ok');
}

/* ============================================================
   Deep links — #map&focus=path&reach=downstream&route=a~b&lens=x~y&view=neon
   ============================================================ */
function mapWriteHash(){
  if(!MAP.nodes.length)return;
  const parts=['map'];
  if(MAP.focusId)parts.push('focus='+encodeURIComponent(MAP.focusId));
  if(MAP.focusId&&MAP.reach)parts.push('reach='+MAP.reach);
  if(MAP.routePath&&MAP.routePath.length>1)parts.push('route='+encodeURIComponent(MAP.routePath.join('~')));
  if(MAP.lensA&&MAP.lensB)parts.push('lens='+MAP.lensA+'~'+MAP.lensB);
  if(MAP.preset!=='neon')parts.push('view='+MAP.preset);
  const h='#'+parts.join('&');
  if(location.hash!==h)history.replaceState(null,'',h);
}
function mapApplyHash(){
  const h=location.hash;
  if(!h||!h.startsWith('#map'))return;
  const params={};
  h.slice(1).split('&').slice(1).forEach(p=>{
    const i=p.indexOf('=');if(i>0)params[decodeURIComponent(p.slice(0,i))]=decodeURIComponent(p.slice(i+1));
  });
  if(params.view&&MAP_PRESETS.includes(params.view)){MAP.preset=params.view;const name=$('#mapPresetName');if(name)name.textContent=MAP.preset[0].toUpperCase()+MAP.preset.slice(1)}
  if(params.lens&&params.lens.includes('~')){const[a,b]=params.lens.split('~');MAP.lensA=a;MAP.lensB=b}
  if(params.focus&&MAP.byId.has(params.focus)){
    MAP.focusId=params.focus;
    MAP.reach=(params.reach==='downstream'||params.reach==='upstream')?params.reach:null;
  }
  if(params.route&&params.route.includes('~')){
    const path=params.route.split('~').filter(p=>MAP.byId.has(p));
    if(path.length>1)MAP.routePath=path;
  }
  mapComputeHighlight();mapRenderInfo();
}

/* ============================================================
   Keyboard shortcuts (capture phase so the global '/' handler
   doesn't also fire while the map is active)
   ============================================================ */
function mapIsActive(){
  const p=$('#p-map');
  return !!p&&p.classList.contains('active');
}
document.addEventListener('keydown',e=>{
  if(!mapIsActive())return;
  const tag=document.activeElement&&document.activeElement.tagName;
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'){
    if(e.key==='Escape'&&document.activeElement.id==='mapSearchInput'){mapCloseSearch();e.stopPropagation()}
    return;
  }
  const k=e.key;
  if(k==='/'){e.preventDefault();e.stopPropagation();mapOpenSearch();return}
  if(k==='Escape'){
    e.preventDefault();e.stopPropagation();
    if(MAP.routeFrom||MAP.routePath||MAP.focusId||MAP.lensA)mapClearFocus();
    if(MAP.present)toggleMapPresent();
    mapDraw();return;
  }
  if(k==='r'||k==='R'){e.preventDefault();MAP.routeFrom=MAP.routeFrom?null:(MAP.focusId||'');
    if(!MAP.routeFrom&&!MAP.focusId)toast(mapT('mapRoutePick'),'ok');
    mapRenderInfo();return}
  if(k==='l'||k==='L'){e.preventDefault();mapToggleLens();return}
  if(k==='m'||k==='M'){e.preventDefault();toggleMapMinimap();return}
  if(k==='f'||k==='F'){e.preventDefault();toggleMapPresent();return}
  if(k==='s'||k==='S'){e.preventDefault();cycleMapPreset();return}
  if(k==='e'||k==='E'){e.preventDefault();exportMapPNG();return}
  if(k==='+'||k==='='){e.preventDefault();mapZoomAt(MAP.W/2,MAP.H/2,1.25);mapDraw();return}
  if(k==='-'||k==='_'){e.preventDefault();mapZoomAt(MAP.W/2,MAP.H/2,0.8);mapDraw();return}
  if(k==='0'){e.preventDefault();mapFit();return}
},true);
/* live-update highlights when the hash changes (shareable links) */
window.addEventListener('hashchange',()=>{if(mapIsActive()&&MAP.nodes.length){mapApplyHash();mapDraw()}});

/* ============================================================
   Hooks: switchTab + renderDash + search input wiring
   ============================================================ */
(function mapInit(){
  const _origSwitch=window.switchTab;
  if(typeof _origSwitch==='function'){
    window.switchTab=function(name){
      _origSwitch(name);
      if(name==='map'){
        if(!MAP.nodes.length)buildRepoMap();
        startMapAnimation();
        const btn=$('#mapMinimapBtn');if(btn)btn.style.opacity=MAP.minimap?'1':'.5';
        const name2=$('#mapPresetName');if(name2)name2.textContent=MAP.preset[0].toUpperCase()+MAP.preset.slice(1);
      }else if(MAP.raf){cancelAnimationFrame(MAP.raf);MAP.raf=null}
    };
  }
  /* search box wiring */
  document.addEventListener('DOMContentLoaded',()=>{
    const inp=$('#mapSearchInput');
    if(inp)inp.addEventListener('input',()=>mapRenderSearchResults(inp.value));
    const box=$('#mapSearch');
    if(box)box.addEventListener('keydown',e=>{
      if(e.key==='Enter'){
        e.preventDefault();
        const first=box.querySelector('.msr');
        if(first){mapFocus(first.dataset.id);mapCloseSearch()}
      }
    });
  });
  /* ?tab=map deep link */
  const q=new URLSearchParams(location.search);
  if(q.get('tab')==='map'){
    const _origApply=window.applyRepo;
    if(typeof _origApply==='function'){
      window.applyRepo=function(){
        const r=_origApply.apply(this,arguments);
        try{setTimeout(()=>switchTab('map'),80)}catch(e){}
        return r;
      };
    }
  }
})();
