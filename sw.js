const CACHE='ws-install-2026.10.23.7';
const OFFLINE='/offline.html';
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([OFFLINE,'/icons/icon-192.png','/icons/icon-512.png'])));
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  for(const key of await caches.keys()) if(key.startsWith('ws-install-')&&key!==CACHE) await caches.delete(key);
  await self.clients.claim();
 })());
});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
 // Los registros y las actualizaciones siempre van a la red.
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).catch(()=>caches.match(OFFLINE)));
 }
});
