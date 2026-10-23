// Incrementar junto con los cambios publicados en version.json.
const WS_VERSION = '2026.10.23.7';
(() => {
 const banner=document.getElementById('update-banner');
 let newVersion=null, checking=false, lastCheck=0;
 async function checkVersion() {
  if(checking || document.hidden || Date.now()-lastCheck<15000) return;
  checking=true; lastCheck=Date.now();
  try {
   const response=await fetch('/version.json?t='+Date.now(),{cache:'no-store'});
   if(!response.ok) return;
   const data=await response.json();
   if(typeof data.version==='string' && data.version!==WS_VERSION) {newVersion=data.version;banner.hidden=false;}
  } catch {} finally {checking=false;}
 }
 document.getElementById('btn-posponer').addEventListener('click',()=>{banner.hidden=true;});
 document.getElementById('btn-actualizar').addEventListener('click',async()=>{
  if(!newVersion) return;
  const url=new URL(location.href);url.searchParams.set('v',newVersion);
  sessionStorage.setItem('ws-active-tab',document.querySelector('.tab-btn.active')?.dataset.target || 'seccion-clima');
  if('serviceWorker' in navigator){
   const registration=await navigator.serviceWorker.getRegistration();
   if(registration?.waiting){
    let navigated=false;
    const reload=()=>{if(!navigated){navigated=true;location.replace(url.href);}};
    navigator.serviceWorker.addEventListener('controllerchange',reload,{once:true});
    registration.waiting.postMessage({type:'SKIP_WAITING'});
    setTimeout(reload,5000);return;
   }
  }
  location.replace(url.href);
 });
 window.addEventListener('load',()=>{
  const active=sessionStorage.getItem('ws-active-tab');
  if(active) {document.querySelector('.tab-btn[data-target="'+active+'"]')?.click();sessionStorage.removeItem('ws-active-tab');}
  checkVersion();
 });
 window.addEventListener('ws-update-ready',()=>{newVersion=WS_VERSION;banner.hidden=false;});
 window.addEventListener('pageshow',checkVersion);
 document.addEventListener('visibilitychange',checkVersion);
 setInterval(checkVersion,60000);
})();
