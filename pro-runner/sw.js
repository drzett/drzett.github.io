const PATCH_VERSION='1.6.2';
const PATCH_BUILD='2026-09-12.9';
const PATCH_CACHE=`pro-runner-patch-${PATCH_VERSION}`;
const PATCH_ASSETS=['./index.html','./main.js','./update-ui.js','./update-ui-core.js','./external-frame.html','./zip.js','./core/storage.js','./core/projects.js','./core/home-state.js','./ui/home.js','./ui/icons.js'];
const PATCH_PATHS=new Set(PATCH_ASSETS.filter(x=>x!=='./index.html').map(x=>new URL(x,self.registration.scope).pathname));

self.addEventListener('message',event=>{
  if(event.data?.type==='GET_VERSION'&&event.ports?.[0]){
    event.stopImmediatePropagation();
    event.ports[0].postMessage({version:PATCH_VERSION});
  }
});

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(PATCH_CACHE).then(cache=>cache.addAll(PATCH_ASSETS)));
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('pro-runner-patch-')&&key!==PATCH_CACHE).map(key=>caches.delete(key)));
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of clients)client.postMessage({type:'PRO_RUNNER_SW_READY',version:PATCH_VERSION});
  })());
});

async function patchedAppDocument(request){
  const cache=await caches.open(PATCH_CACHE);
  let response=null;
  try{
    const network=await fetch(request,{cache:'no-store'});
    if(network?.ok){response=network;cache.put(new Request(new URL('./index.html',self.registration.scope)),network.clone()).catch(()=>{});}
  }catch{}
  if(!response)response=await cache.match('./index.html')||await cache.match(request,{ignoreSearch:true});
  if(!response)return new Response('Pro Runner shell is unavailable.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  let html=await response.text();
  html=html.replace("img-src 'self' data: blob:;","img-src 'self' data: blob: https:;");
  html=html.replace("connect-src 'self';","connect-src 'self' https:;");
  html=html.replace(/<meta name="app-version" content="[^"]*">/,`<meta name="app-version" content="${PATCH_VERSION}">`);
  html=html.replace(/<meta name="app-build" content="[^"]*">/,`<meta name="app-build" content="${PATCH_BUILD}">`);
  const headers=new Headers(response.headers);headers.delete('Content-Length');headers.set('Cache-Control','no-store');headers.set('Content-Type','text/html; charset=utf-8');
  return new Response(html,{status:200,headers});
}

async function patchAssetResponse(request){
  const cache=await caches.open(PATCH_CACHE);
  const cached=await cache.match(request,{ignoreSearch:true});
  if(cached)return cached;
  try{const response=await fetch(request,{cache:'no-store'});if(response?.ok)cache.put(request,response.clone()).catch(()=>{});return response}catch{return new Response('Pro Runner update asset unavailable.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})}
}

self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url),scope=new URL(self.registration.scope),indexPath=`${scope.pathname}index.html`;
  if(url.origin!==scope.origin)return;
  if((event.request.mode==='navigate'||event.request.destination==='document')&&(url.pathname===scope.pathname||url.pathname===indexPath)){
    event.stopImmediatePropagation();event.respondWith(patchedAppDocument(event.request));return;
  }
  if(PATCH_PATHS.has(url.pathname)){
    event.stopImmediatePropagation();event.respondWith(patchAssetResponse(event.request));
  }
});

importScripts('./sw-core-v140.js');
