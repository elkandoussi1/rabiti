const C="rabiti-v3", F=["./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png","./icon-maskable-512.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(C).then(c=>c.addAll(F)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>/^rabiti-v/.test(k)&&k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{const q=e.request,u=new URL(q.url);if(q.method!=="GET"||u.origin!==self.location.origin)return;
if(q.mode==="navigate"){e.respondWith(fetch(q).then(r=>{if(r.ok){const copy=r.clone();e.waitUntil(caches.open(C).then(c=>c.put(q,copy)))}return r}).catch(async()=>await caches.match(q)||await caches.match("./index.html")));return}
if(!F.some(f=>new URL(f,self.registration.scope).href===u.href))return;
e.respondWith(fetch(q).then(r=>{if(r.ok){const copy=r.clone();e.waitUntil(caches.open(C).then(c=>c.put(q,copy)))}return r}).catch(()=>caches.match(q)))});
