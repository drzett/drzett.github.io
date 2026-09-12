const PATCH_VERSION='1.5.2';
const PATCH_CACHE='pro-runner-shell-1.4.0';
const PATCH_ASSETS=['./index.html','./update-ui-core.js','./springboard-v14.js','./v142-ui.js','./icon-designer.js','./v150-home.js','./v151-online.js','./v150-touch.js','./v152-icon-fix.js','./external-frame.html'];

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
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of clients)client.postMessage({type:'PRO_RUNNER_SW_READY',version:PATCH_VERSION});
  })());
});

async function patchedAppDocument(request){
  const cache=await caches.open(PATCH_CACHE);
  let response=null;
  try{
    const network=await fetch(request,{cache:'no-store'});
    if(network?.ok){response=network;cache.put(request,network.clone()).catch(()=>{});}
  }catch{}
  if(!response)response=await cache.match(request,{ignoreSearch:true})||await cache.match('./index.html');
  if(!response)return new Response('Pro Runner shell is unavailable.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  let html=await response.text();
  html=html.replace("img-src 'self' data: blob:;","img-src 'self' data: blob: https:;");
  html=html.replace(/<meta name="app-version" content="[^"]*">/,`<meta name="app-version" content="${PATCH_VERSION}">`);
  html=html.replace(/<meta name="app-build" content="[^"]*">/,'<meta name="app-build" content="2026-09-12.4">');
  const headers=new Headers(response.headers);headers.delete('Content-Length');headers.set('Cache-Control','no-store');headers.set('Content-Type','text/html; charset=utf-8');
  return new Response(html,{status:200,headers});
}

self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);const scope=new URL(self.registration.scope);const indexPath=`${scope.pathname}index.html`;
  if(url.origin===scope.origin&&(event.request.mode==='navigate'||event.request.destination==='document')&&(url.pathname===scope.pathname||url.pathname===indexPath)){
    event.stopImmediatePropagation();event.respondWith(patchedAppDocument(event.request));
  }
});

importScripts('./sw-core-v140.js');
