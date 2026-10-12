const C="rabiti-v2",F=["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{const q=e.request;if(q.method!=="GET")return;const u=new URL(q.url);
if(u.origin===location.origin){e.respondWith(fetch(q).then(r=>{const c=r.clone();caches.open(C).then(x=>x.put(q,c));return r}).catch(()=>caches.match(q).then(m=>m||caches.match("./index.html"))))}
else if(/fonts\.(googleapis|gstatic)\.com/.test(u.host)){e.respondWith(caches.open(C).then(c=>c.match(q).then(m=>m||fetch(q).then(r=>{c.put(q,r.clone());return r}).catch(()=>m))))}});
