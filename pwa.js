(() => {
 const panel=document.getElementById('install-panel'),button=document.getElementById('btn-instalar'),help=document.getElementById('install-help');
 let promptEvent=null;
 const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 function refresh(){panel.hidden=standalone();}
 function showHelp(text){help.textContent=text;help.hidden=false;}
 window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();promptEvent=event;refresh();button.textContent='Instalar WS app';
 });
 window.addEventListener('appinstalled',()=>{promptEvent=null;panel.hidden=true;});
 matchMedia('(display-mode: standalone)').addEventListener('change',refresh);
 button.addEventListener('click',async()=>{
  if(promptEvent){
   const pending=promptEvent;promptEvent=null;
   try{await pending.prompt();const result=await pending.userChoice;if(result.outcome==='accepted')panel.hidden=true;}
   catch{showHelp('Usa el menú de tu navegador y elige “Instalar aplicación” o “Añadir a pantalla de inicio”.');}
  }else if(/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)){
   showHelp('En iPhone o iPad: abre esta página en Safari, toca Compartir y luego “Añadir a pantalla de inicio”. Activa “Abrir como app” si aparece.');
  }else{
   showHelp('Abre esta página en Chrome o Edge. En el menú ⋮ o ⋯ elige “Instalar WS app” o “Añadir a pantalla de inicio”. Si acabas de abrirla, espera unos segundos y vuelve a intentar.');
  }
 });
 refresh();
 if('serviceWorker' in navigator){
  window.addEventListener('load',async()=>{
   try{
    const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
    const available=()=>window.dispatchEvent(new Event('ws-update-ready'));
    if(registration.waiting)available();
    registration.addEventListener('updatefound',()=>{
     const installing=registration.installing;
     installing?.addEventListener('statechange',()=>{if(installing.state==='installed'&&navigator.serviceWorker.controller)available();});
    });
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)registration.update().catch(()=>{});});
   }catch{showHelp('No se pudo preparar la instalación. Comprueba tu conexión y vuelve a abrir la página.');}
  });
 }
})();
