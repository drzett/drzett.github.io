const PATCH_VERSION='1.5.1';
const PATCH_CACHE='pro-runner-shell-1.4.0';
const PATCH_ASSETS=['./update-ui-core.js','./springboard-v14.js','./v142-ui.js','./icon-designer.js','./v150-home.js','./v151-online.js','./v150-touch.js','./external-frame.html'];
const EXTERNAL_ICON_CACHE='pro-runner-external-icons-v1';

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

async function externalIconResponse(request){
  const requestURL=new URL(request.url);
  const raw=requestURL.searchParams.get('url');
  let remote;
  try{remote=new URL(raw);if(!['https:','http:'].includes(remote.protocol))throw new Error('unsupported');}
  catch{return new Response('',{status:400});}
  const cache=await caches.open(EXTERNAL_ICON_CACHE);
  const cached=await cache.match(request);
  if(cached)return cached;
  try{
    const response=await fetch(remote.href,{mode:'no-cors',credentials:'omit',referrerPolicy:'no-referrer',cache:'force-cache'});
    if(response){await cache.put(request,response.clone()).catch(()=>{});return response;}
  }catch{}
  return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"></svg>',{status:404,headers:{'Content-Type':'image/svg+xml','Cache-Control':'no-store'}});
}

self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  const scopePath=new URL(self.registration.scope).pathname;
  if(url.origin===self.location.origin&&url.pathname===`${scopePath}__external_icon__`){
    event.stopImmediatePropagation();
    event.respondWith(externalIconResponse(event.request));
  }
});

importScripts('./sw-core-v140.js');
