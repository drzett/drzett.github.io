const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const DB_NAME = 'pro-runner-v1';
const ASSET_STORE = 'assets';
const PROJECT_STORE = 'projects';
const SOURCE = 'icon-designer-v15';

const BACKGROUNDS = [
  { id:'jet', name:'Jet Black', kind:'solid', a:'#040405', b:'#040405', edge:'#2b2c30' },
  { id:'obsidian', name:'Obsidian', kind:'glass', a:'#2a2c31', b:'#070809', edge:'#44474e' },
  { id:'black-glass', name:'Black Glass', kind:'glass', a:'#3a3d43', b:'#07080a', edge:'#53575f' },
  { id:'graphite', name:'Graphite', kind:'glass', a:'#5a606a', b:'#17191d', edge:'#747b86' },
  { id:'carbon', name:'Carbon Fiber', kind:'carbon', a:'#22252a', b:'#090a0c', edge:'#3b3f45' },
  { id:'forged', name:'Forged Carbon', kind:'forged', a:'#2a2d32', b:'#08090b', edge:'#454950' },
  { id:'brushed', name:'Brushed Metal', kind:'brushed', a:'#40454d', b:'#141619', edge:'#656b74' },
  { id:'slate', name:'Slate', kind:'glass', a:'#4b5662', b:'#141a20', edge:'#697987' },
  { id:'midnight', name:'Midnight', kind:'glass', a:'#263754', b:'#080d18', edge:'#40567d' },
  { id:'cobalt', name:'Cobalt', kind:'glass', a:'#3174e7', b:'#10244f', edge:'#6198f0' },
  { id:'forest', name:'Forest', kind:'glass', a:'#397353', b:'#10261b', edge:'#5b9975' },
  { id:'burgundy', name:'Burgundy', kind:'glass', a:'#73364b', b:'#250d17', edge:'#a05a72' },
  { id:'ember', name:'Ember', kind:'glass', a:'#9d5338', b:'#35160d', edge:'#cb7d5d' },
  { id:'violet', name:'Violet', kind:'glass', a:'#6b529d', b:'#211431', edge:'#947cc3' },
  { id:'warm', name:'Warm Light', kind:'glass', a:'#f0ede6', b:'#aaa69f', edge:'#ffffff', light:true },
  { id:'ice', name:'Ice', kind:'glass', a:'#dfe9f1', b:'#90a6b6', edge:'#ffffff', light:true },
];

const DEFAULT_LAYER = () => ({ text:'', scale:80, x:0, y:0, rotation:0 });
const DEFAULT_CONFIG = () => ({ background:'obsidian', layers:[DEFAULT_LAYER(), DEFAULT_LAYER()] });

const style = document.createElement('style');
style.textContent = `
.icon-designer-card{width:min(720px,calc(100vw - 18px));max-height:min(92dvh,800px);overflow:hidden;display:flex;flex-direction:column;padding:0!important}
.icon-designer-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:16px 18px 12px;border-bottom:1px solid var(--line)}
.icon-designer-head h2{margin:3px 0 0;font-size:21px}.icon-designer-body{min-height:0;overflow:auto;padding:14px 16px 12px;-webkit-overflow-scrolling:touch}
.icon-designer-top{display:grid;grid-template-columns:112px minmax(0,1fr);gap:14px;align-items:start}.icon-designer-preview{width:112px;aspect-ratio:1;border-radius:26%;overflow:hidden;box-shadow:0 14px 34px rgba(0,0,0,.34)}.icon-designer-preview img{width:100%;height:100%;display:block}
.designer-section-title{margin:0 0 7px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
.designer-background-strip{display:flex;gap:7px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:0 1px 5px;overscroll-behavior-x:contain}.designer-background-strip::-webkit-scrollbar{display:none}
.designer-bg{flex:0 0 calc((100% - 21px)/4);min-width:56px;scroll-snap-align:start;border:2px solid transparent;border-radius:12px;padding:0;background:transparent;color:var(--muted);text-align:center}.designer-bg.active{border-color:#fff}.designer-bg img{display:block;width:100%;aspect-ratio:1;border-radius:9px}.designer-bg small{display:block;margin:3px 1px 0;font-size:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.designer-layers{display:grid;gap:9px;margin-top:12px}.designer-layer{border:1px solid rgba(255,255,255,.075);border-radius:14px;padding:10px 11px;background:rgba(255,255,255,.025)}.designer-layer-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px}.designer-layer-head strong{font-size:11px}.designer-layer-head span{font-size:9px;color:var(--faint)}
.designer-text{width:100%;border:1px solid var(--line);background:rgba(255,255,255,.045);color:var(--text);border-radius:10px;padding:8px 9px;outline:none;font-size:16px}.designer-text::placeholder{color:var(--faint)}
.designer-size{display:grid;grid-template-columns:42px minmax(0,1fr) 38px;gap:6px;align-items:center;margin-top:7px}.designer-size label,.designer-axis label{font-size:8px;color:var(--muted)}.designer-size output,.designer-axis output{font-size:8px;color:var(--faint);text-align:right;font-variant-numeric:tabular-nums}.designer-size input,.designer-axis input{width:100%;margin:0;min-width:0}
.designer-axis-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:5px}.designer-axis{display:grid;grid-template-columns:18px minmax(0,1fr);grid-template-rows:auto auto;column-gap:4px;align-items:center}.designer-axis label{grid-column:1}.designer-axis output{grid-column:2}.designer-axis input{grid-column:1 / -1;margin-top:1px}
.icon-designer-foot{display:flex;align-items:center;gap:8px;padding:10px 13px max(10px,env(safe-area-inset-bottom));border-top:1px solid rgba(255,255,255,.07);background:rgba(15,16,19,.96)}.icon-designer-foot .primary-button{margin-left:auto}
@media(max-width:620px){.icon-designer-card{max-height:94dvh}.icon-designer-body{padding:12px}.icon-designer-top{grid-template-columns:96px minmax(0,1fr);gap:10px}.icon-designer-preview{width:96px}.designer-bg{flex-basis:calc((100% - 21px)/4)}.designer-layer{padding:9px 10px}.designer-layers{gap:8px;margin-top:10px}}
`;
document.head.append(style);

function openDB(){return new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('Unable to open local storage.'));});}
async function dbGet(store,key){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly');const req=tx.objectStore(store).get(key);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close();});}
async function dbGetAll(store){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly');const req=tx.objectStore(store).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close();});}
async function dbPut(store,value){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}

function escapeXml(value){return String(value).replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));}
function backgroundById(id){return BACKGROUNDS.find((item)=>item.id===id)||BACKGROUNDS[1];}
function backgroundMarkup(background){
  const edge=background.edge||'#444';
  if(background.kind==='solid')return `<rect width="128" height="128" rx="30" fill="${background.a}"/><rect x="1" y="1" width="126" height="126" rx="29" fill="none" stroke="${edge}" stroke-opacity=".72"/>`;
  if(background.kind==='carbon')return `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${background.a}"/><stop offset="1" stop-color="${background.b}"/></linearGradient><pattern id="p" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 0h4v4H0zM4 4h4v4H4z" fill="#fff" opacity=".045"/><path d="M4 0h4v4H4zM0 4h4v4H0z" fill="#000" opacity=".18"/></pattern><radialGradient id="r" cx=".18" cy=".05" r=".9"><stop stop-color="#fff" stop-opacity=".12"/><stop offset=".74" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="128" height="128" rx="30" fill="url(#bg)"/><rect width="128" height="128" rx="30" fill="url(#p)"/><rect width="128" height="128" rx="30" fill="url(#r)"/><rect x="1" y="1" width="126" height="126" rx="29" fill="none" stroke="${edge}" stroke-opacity=".55"/>`;
  if(background.kind==='forged')return `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${background.a}"/><stop offset="1" stop-color="${background.b}"/></linearGradient><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".11" numOctaves="2" seed="7"/><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 .12 0"/></filter></defs><rect width="128" height="128" rx="30" fill="url(#bg)"/><rect width="128" height="128" rx="30" filter="url(#n)" opacity=".55"/><rect x="1" y="1" width="126" height="126" rx="29" fill="none" stroke="${edge}" stroke-opacity=".58"/>`;
  if(background.kind==='brushed')return `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${background.a}"/><stop offset="1" stop-color="${background.b}"/></linearGradient><pattern id="b" width="1" height="4" patternUnits="userSpaceOnUse"><path d="M0 .5h1" stroke="#fff" stroke-opacity=".035"/><path d="M0 2.5h1" stroke="#000" stroke-opacity=".08"/></pattern></defs><rect width="128" height="128" rx="30" fill="url(#bg)"/><rect width="128" height="128" rx="30" fill="url(#b)"/><rect x="1" y="1" width="126" height="126" rx="29" fill="none" stroke="${edge}" stroke-opacity=".6"/>`;
  return `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${background.a}"/><stop offset="1" stop-color="${background.b}"/></linearGradient><radialGradient id="edge" cx=".22" cy=".05" r=".95"><stop stop-color="#fff" stop-opacity=".12"/><stop offset=".56" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".14"/></radialGradient></defs><rect width="128" height="128" rx="30" fill="url(#bg)"/><rect width="128" height="128" rx="30" fill="url(#edge)"/><rect x="1" y="1" width="126" height="126" rx="29" fill="none" stroke="${edge}" stroke-opacity=".55"/>`;
}
function normalizeLayer(layer={}){return {text:String(layer.text??layer.content??''),scale:Number.isFinite(Number(layer.scale))?Number(layer.scale):80,x:Number.isFinite(Number(layer.x))?Number(layer.x):0,y:Number.isFinite(Number(layer.y))?Number(layer.y):0,rotation:Number.isFinite(Number(layer.rotation))?Number(layer.rotation):0};}
function normalizeConfig(config){
  if(config?.layers?.length)return {background:config.background||'obsidian',layers:[normalizeLayer(config.layers[0]),normalizeLayer(config.layers[1]||{})]};
  if(config)return {background:config.background||'obsidian',layers:[normalizeLayer({text:config.content||'',scale:config.scale??80,x:config.x||0,y:config.y||0,rotation:0}),DEFAULT_LAYER()]};
  return DEFAULT_CONFIG();
}
function renderSVG(config){
  const bg=backgroundById(config.background);let body=backgroundMarkup(bg);
  for(const layer of config.layers){
    const text=String(layer.text||'');if(!text)continue;
    const size=Math.max(10,Math.min(118,Number(layer.scale)||80))*.78;
    const x=64+(Number(layer.x)||0)*.48;const y=67+(Number(layer.y)||0)*.48;const rotation=Number(layer.rotation)||0;
    body+=`<g transform="translate(${x} ${y}) rotate(${rotation})"><text x="0" y="0" text-anchor="middle" dominant-baseline="central" font-family="-apple-system,BlinkMacSystemFont,'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',Arial,sans-serif" font-size="${size}" font-weight="700" fill="#fff">${escapeXml(text)}</text></g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${body}</svg>`;
}
const dataURL=(svg)=>`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
let target=null;let config=DEFAULT_CONFIG();let activeProjectId=null;let wired=false;const designedURLs=new Map();

function dialog(){
  let node=$('#iconDesignerDialog');if(node)return node;
  node=document.createElement('dialog');node.id='iconDesignerDialog';node.className='modal';
  node.innerHTML=`<div class="modal-card icon-designer-card"><div class="icon-designer-head"><div><span class="eyebrow">ICON DESIGNER</span><h2 id="iconDesignerTitle">Design app icon</h2></div><button id="iconDesignerClose" class="close-button" type="button">×</button></div><div class="icon-designer-body"><div class="icon-designer-top"><div id="iconDesignerPreview" class="icon-designer-preview"></div><div><div class="designer-section-title">Background</div><div id="iconDesignerBackgrounds" class="designer-background-strip"></div></div></div><div id="iconDesignerLayers" class="designer-layers"></div></div><div class="icon-designer-foot"><button id="iconDesignerImage" class="subtle-button" type="button">Choose image…</button><button id="iconDesignerCancel" class="text-button" type="button">Cancel</button><button id="iconDesignerSave" class="primary-button" type="button">Use icon</button></div></div>`;
  document.body.append(node);
  $('#iconDesignerClose',node).onclick=()=>node.close();$('#iconDesignerCancel',node).onclick=()=>node.close();$('#iconDesignerSave',node).onclick=saveCurrent;
  $('#iconDesignerImage',node).onclick=()=>{node.close();if(target?.chooseImage)target.chooseImage();else $('#iconPicker')?.click();};
  return node;
}
function backgroundThumb(background){return dataURL(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${backgroundMarkup(background)}</svg>`);}
function renderBackgrounds(){const root=$('#iconDesignerBackgrounds',dialog());root.replaceChildren();for(const bg of BACKGROUNDS){const button=document.createElement('button');button.type='button';button.className=`designer-bg${config.background===bg.id?' active':''}`;button.innerHTML=`<img alt="" src="${backgroundThumb(bg)}"><small>${bg.name}</small>`;button.onclick=()=>{config.background=bg.id;renderBackgrounds();renderPreview();};root.append(button);}}
function rangeField(label,key,min,max,step,layer,index){const wrap=document.createElement('div');wrap.className='designer-axis';const l=document.createElement('label');l.textContent=label;const out=document.createElement('output');out.textContent=String(layer[key]);const input=document.createElement('input');input.type='range';input.min=String(min);input.max=String(max);input.step=String(step);input.value=String(layer[key]);input.addEventListener('input',()=>{layer[key]=Number(input.value);out.textContent=String(layer[key]);renderPreview();});wrap.append(l,out,input);return wrap;}
function renderLayers(){
  const root=$('#iconDesignerLayers',dialog());root.replaceChildren();config.layers.forEach((layer,index)=>{const card=document.createElement('section');card.className='designer-layer';card.innerHTML=`<div class="designer-layer-head"><strong>Layer ${index+1}</strong><span>${index===0?'Primary':'Optional'}</span></div>`;const input=document.createElement('input');input.className='designer-text';input.type='text';input.value=layer.text;input.autocapitalize='off';input.autocomplete='off';input.spellcheck=false;input.placeholder=index===0?'Text or emoji':'Optional second text or emoji';input.addEventListener('input',()=>{layer.text=input.value;renderPreview();});card.append(input);
    const size=document.createElement('div');size.className='designer-size';const sizeLabel=document.createElement('label');sizeLabel.textContent='Size';const sizeInput=document.createElement('input');sizeInput.type='range';sizeInput.min='20';sizeInput.max='120';sizeInput.step='1';sizeInput.value=String(layer.scale);const sizeOut=document.createElement('output');sizeOut.textContent=`${layer.scale}%`;sizeInput.addEventListener('input',()=>{layer.scale=Number(sizeInput.value);sizeOut.textContent=`${layer.scale}%`;renderPreview();});size.append(sizeLabel,sizeInput,sizeOut);card.append(size);
    const axes=document.createElement('div');axes.className='designer-axis-row';axes.append(rangeField('X','x',-60,60,1,layer,index),rangeField('Y','y',-60,60,1,layer,index),rangeField('↻','rotation',-45,45,1,layer,index));card.append(axes);root.append(card);});
}
function renderPreview(){const root=$('#iconDesignerPreview',dialog());root.replaceChildren();const img=document.createElement('img');img.alt='Icon preview';img.src=dataURL(renderSVG(config));img.draggable=false;root.append(img);}

async function resolveProjectTarget(){
  if(activeProjectId){const project=(await dbGetAll(PROJECT_STORE)).find((p)=>p.id===activeProjectId);if(project)return {id:project.id,assetKey:`icon:${project.id}`,title:project.name,project};}
  const name=$('#projectNameInput')?.value?.trim();if(!name)return null;const projects=await dbGetAll(PROJECT_STORE);const project=projects.find((p)=>p.name===name);if(!project)return null;activeProjectId=project.id;return {id:project.id,assetKey:`icon:${project.id}`,title:project.name,project};
}
async function openDesigner(nextTarget=null){
  target=nextTarget||await resolveProjectTarget();if(!target)return;
  const record=await dbGet(ASSET_STORE,target.assetKey).catch(()=>null);config=normalizeConfig(record?.config);
  const node=dialog();$('#iconDesignerTitle',node).textContent=target.title?`Design ${target.title}`:'Design app icon';renderBackgrounds();renderLayers();renderPreview();node.showModal();
}
function setIconNode(node,url,stamp=''){if(!node||stamp&&node.dataset.iconDesignerStamp===stamp)return;node.replaceChildren();const img=document.createElement('img');img.alt='';img.src=url;img.draggable=false;img.style.cssText='width:100%;height:100%;object-fit:cover;display:block';node.append(img);if(stamp)node.dataset.iconDesignerStamp=stamp;}
async function saveCurrent(){
  if(!target)return;const svg=renderSVG(config);const bytes=new TextEncoder().encode(svg).buffer;const stamp=Date.now();await dbPut(ASSET_STORE,{key:target.assetKey,bytes,type:'image/svg+xml',source:SOURCE,updatedAt:stamp,config:structuredClone(config)});const url=dataURL(svg);
  if(target.id==='__runner__'){for(const node of $$('[data-runner-app="1"] .home-app-icon,#runnerIconPreview'))setIconNode(node,url,String(stamp));}
  else {for(const node of $$(`.home-app[data-id="${CSS.escape(target.id)}"] .home-app-icon,.project-card[data-id="${CSS.escape(target.id)}"] .app-icon`))setIconNode(node,url,String(stamp));if(activeProjectId===target.id)setIconNode($('#projectIconPreview'),url,String(stamp));}
  dialog().close();target.onSaved?.({svg,config:structuredClone(config)});window.dispatchEvent(new CustomEvent('pro-runner-icon-updated',{detail:{id:target.id}}));
}
async function refreshDesignedIcons(){
  const records=await dbGetAll(ASSET_STORE).catch(()=>[]);for(const record of records){if(record.source!==SOURCE||!record.bytes||!String(record.key).startsWith('icon:'))continue;const id=String(record.key).slice(5);const stamp=String(record.updatedAt||0);let url=designedURLs.get(`${id}:${stamp}`);if(!url){url=URL.createObjectURL(new Blob([record.bytes],{type:record.type||'image/svg+xml'}));designedURLs.set(`${id}:${stamp}`,url)}if(id==='__runner__'){for(const node of $$('[data-runner-app="1"] .home-app-icon'))setIconNode(node,url,stamp);}else{for(const node of $$(`.home-app[data-id="${CSS.escape(id)}"] .home-app-icon,.project-card[data-id="${CSS.escape(id)}"] .app-icon`))setIconNode(node,url,stamp);}}
}
function rememberProject(event){const node=event.target.closest?.('.home-app[data-id],.project-card[data-id]');if(node?.dataset.id)activeProjectId=node.dataset.id;}
function wire(){
  if(!wired){wired=true;document.addEventListener('pointerdown',rememberProject,true);document.addEventListener('click',rememberProject,true);}
  const button=$('#chooseIconButton');if(button&&button.dataset.designerV15!=='1'){button.dataset.designerV15='1';button.addEventListener('click',async(event)=>{event.preventDefault();event.stopImmediatePropagation();const t=await resolveProjectTarget();if(t)openDesigner(t);},true);}
}
let queued=false;function decorate(){wire();refreshDesignedIcons();}
const observer=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate();});});observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});decorate();
window.ProRunnerIconDesigner={open:openDesigner,refresh:refreshDesignedIcons};
