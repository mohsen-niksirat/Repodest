'use strict';
/* ============================================================
   Repodest — Boot
   Theme init, URL bootstrap, service worker registration.
   MUST be the last script: boot() reads consts from app.ux.js,
   so defining it last avoids TDZ issues.
   ============================================================ */
/* ============================================================
   Boot
   ============================================================ */
(function boot(){
  refreshRate();
  renderHistory();
  try{applyUrlAutomation()}catch(e){}
  const q=new URLSearchParams(location.search);
  if(q.get('repo')){
    const m=q.get('repo').match(/^([^\/]+)\/([^\/]+)$/);
    if(m){
      const platform=q.get('platform')||detectPlatform(q.get('repo'))||'github';
      if(platform==='ghe'&&!gheBase()){setGheBase(location.origin)} /* GHE deep link from inside the instance */
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
