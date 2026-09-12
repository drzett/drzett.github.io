const $=(s,r=document)=>r.querySelector(s);const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const DB='pro-runner-v1',PROJECTS='projects',FILES='files',ASSETS='assets';
const LAYOUT_KEY='pro-runner-home-layout-v2';
const RUNNER_SETTINGS_KEY='pro-runner-runner-app-v15';
const RETURN_HOME_KEY='pro-runner-return-home-v153';
const KEEP_AWAKE_KEY='pro-runner-keep-awake-v153';

const style=document.createElement('style');style.textContent=`
.home-dock .home-app{align-self:stretch!important;justify-content:center!important;align-items:center!important}
.home-dock .home-app-icon{margin-block:auto!important}
.home-dock [data-runner-app="1"]{justify-self:stretch!important;align-self:stretch!important}
.keep-awake-status{display:block;margin-top:4px;color:var(--muted);font-size:9px;line-height:1.35}
`;
document.head.append(style);

function openDB(){return new Promise((res,rej)=>{const q=indexedDB.open(DB,1);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})}
async function get(store,key){const db=await openDB();return new Promise((res,rej)=>{const t=db.transaction(store,'readonly'),q=t.objectStore(store).get(key);q.onsuccess=()=>res(q.result||null);q.onerror=()=>rej(q.error);t.oncomplete=()=>db.close()})}
async function getAll(store){const db=await openDB();return new Promise((res,rej)=>{const t=db.transaction(store,'readonly'),q=t.objectStore(store).getAll();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>rej(q.error);t.oncomplete=()=>db.close()})}
async function put(store,value){const db=await openDB();return new Promise((res,rej)=>{const t=db.transaction(store,'readwrite');t.objectStore(store).put(value);t.oncomplete=()=>{db.close();res()};t.onerror=()=>{db.close();rej(t.error)}})}
function toast(message,duration=2400){const host=$('#toastHost');if(!host)return;const item=document.createElement('div');item.className='toast';item.textContent=message;host.append(item);setTimeout(()=>item.remove(),duration)}

function readRunnerSettings(){try{return{dock:false,...JSON.parse(localStorage.getItem(RUNNER_SETTINGS_KEY)||'{}')}}catch{return{dock:false}}}
function writeRunnerSettings(value){localStorage.setItem(RUNNER_SETTINGS_KEY,JSON.stringify(value))}
function cleanGridPlacement(node){if(!node)return;for(const prop of ['gridColumn','gridRow','transform','zIndex'])node.style.removeProperty(prop);for(const key of ['springCol','springRow','springKey'])delete node.dataset[key];node.classList.remove('spring-dragging','spring-overflow')}
function runnerNode(){return $$('#homeScreen .home-app').find(n=>n.dataset.runnerApp==='1'||(!n.dataset.id&&$('.home-app-label',n)?.textContent?.trim()==='Pro Runner'))||null}

let projectTruth=new Map();let activeProjectId=null;let applyingDock=false;let applyQueued=false;
function projectSort(a,b){return(a.homeOrder||a.importedAt||a.createdAt||0)-(b.homeOrder||b.importedAt||b.createdAt||0)}
async function refreshProjectTruth(){const rows=(await getAll(PROJECTS)).sort(projectSort);projectTruth=new Map(rows.map(p=>[p.id,p]));const pinned=rows.filter(p=>p.dock);const runner=readRunnerSettings();if(runner.dock&&pinned.length>=4){runner.dock=false;writeRunnerSettings(runner)}if(pinned.length>4){for(const p of pinned.slice(4)){p.dock=false;await put(PROJECTS,p);projectTruth.set(p.id,p)}}queueApplyDock()}
function queueApplyDock(){if(applyQueued)return;applyQueued=true;requestAnimationFrame(()=>{applyQueued=false;applyDockTruth()})}
function moveToDock(node,dock){if(!node||node.parentElement===dock)return;cleanGridPlacement(node);dock.append(node)}
function moveToGrid(node,grid){if(!node||node.parentElement===grid)return;cleanGridPlacement(node);grid.append(node)}
function applyDockTruth(){if(applyingDock)return;const home=$('#homeScreen'),dock=$('#homeDock'),grid=$('#homeAppGrid');if(!home||!dock||!grid)return;applyingDock=true;try{
  const runnerSettings=readRunnerSettings();const all=[...projectTruth.values()].sort(projectSort);const pinned=all.filter(p=>p.dock);const projectLimit=runnerSettings.dock?3:4;const desired=new Set(pinned.slice(0,projectLimit).map(p=>p.id));
  for(const p of all){const node=home.querySelector(`.home-app[data-id="${CSS.escape(p.id)}"]`);if(!node)continue;if(desired.has(p.id))moveToDock(node,dock);else moveToGrid(node,grid)}
  const runner=runnerNode();if(runner){runner.dataset.runnerApp='1';if(runnerSettings.dock&&desired.size<4){moveToDock(runner,dock)}else{moveToGrid(runner,grid);if(runnerSettings.dock&&desired.size>=4){runnerSettings.dock=false;writeRunnerSettings(runnerSettings);const toggle=$('#runnerDockToggle');if(toggle)toggle.checked=false}}}
  for(const node of $$('#homeDock .home-app'))cleanGridPlacement(node);
  dock.style.opacity=dock.querySelector('.home-app')?'1':'.45';
}finally{applyingDock=false}}

function rememberProject(event){const node=event.target.closest?.('.project-card[data-id],.home-app[data-id]');if(node?.dataset.id)activeProjectId=node.dataset.id}
document.addEventListener('pointerdown',rememberProject,true);document.addEventListener('click',rememberProject,true);

async function syncDockToggle(){const dialog=$('#projectDialog'),toggle=$('#projectDockToggle');if(!dialog?.open||!toggle||!activeProjectId)return;const project=await get(PROJECTS,activeProjectId).catch(()=>null);if(!project)return;projectTruth.set(project.id,project);toggle.checked=Boolean(project.dock);const help=toggle.closest('.toggle-row')?.querySelector('small');if(help)help.textContent='Keep this item in the Home dock. This setting is shared everywhere and applies immediately.'}
async function onDockToggleChange(event){if(event.target?.id!=='projectDockToggle'||!activeProjectId)return;const toggle=event.target;const project=await get(PROJECTS,activeProjectId).catch(()=>null);if(!project)return;const wants=toggle.checked;const runnerDocked=readRunnerSettings().dock;const pinnedOthers=[...projectTruth.values()].filter(p=>p.id!==project.id&&p.dock).length;if(wants&&pinnedOthers+(runnerDocked?1:0)>=4){toggle.checked=false;toast('The dock can contain up to four items.');return}project.dock=wants;project.updatedAt=Date.now();await put(PROJECTS,project);projectTruth.set(project.id,project);queueApplyDock()}
document.addEventListener('change',onDockToggleChange,true);

const dialogObserver=new MutationObserver(()=>{syncDockToggle();queueApplyDock()});dialogObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open','class']});
$('#projectDialog')?.addEventListener('close',()=>{refreshProjectTruth().catch(()=>{})});
$('#saveProjectButton')?.addEventListener('click',()=>{const home=$('#homeScreen');if(home&&!home.classList.contains('hidden')){const stamp=Date.now();sessionStorage.setItem(RETURN_HOME_KEY,String(stamp));setTimeout(()=>{if(sessionStorage.getItem(RETURN_HOME_KEY)===String(stamp))sessionStorage.removeItem(RETURN_HOME_KEY)},3000)}setTimeout(()=>refreshProjectTruth().catch(()=>{}),180)},true);

function restoreHomeAfterReload(){const raw=Number(sessionStorage.getItem(RETURN_HOME_KEY)||0);if(!raw||Date.now()-raw>15000){sessionStorage.removeItem(RETURN_HOME_KEY);return}sessionStorage.removeItem(RETURN_HOME_KEY);let tries=0;const attempt=()=>{tries++;const b=$('#homeViewButton'),home=$('#homeScreen');if(b)b.click();if((!home||home.classList.contains('hidden'))&&tries<12)setTimeout(attempt,120)};setTimeout(attempt,120)}
restoreHomeAfterReload();

let press=null,suppressClickUntil=0,syntheticEditing=false;
function isEditing(){return $('#homeScreen')?.classList.contains('springboard-editing')||!$('#homeEditDone')?.classList.contains('hidden')}
function clearPress(){if(press?.timer)clearTimeout(press.timer);press=null}
async function deleteProjectFromHome(id){const p=await get(PROJECTS,id).catch(()=>null);if(!p)return;if(!confirm(`Delete the local copy of “${p.name}”?\n\nOriginal source files and websites are not changed.`))return;const db=await openDB();await new Promise((res,rej)=>{const t=db.transaction([PROJECTS,FILES,ASSETS],'readwrite');t.objectStore(PROJECTS).delete(id);t.objectStore(ASSETS).delete(`icon:${id}`);const index=t.objectStore(FILES).index('byProject');const q=index.openCursor(IDBKeyRange.only(id));q.onsuccess=()=>{const c=q.result;if(c){c.delete();c.continue()}};t.oncomplete=res;t.onerror=()=>rej(t.error)});db.close();try{const layout=JSON.parse(localStorage.getItem(LAYOUT_KEY)||'{}');if(layout?.positions){delete layout.positions[`project:${id}`];localStorage.setItem(LAYOUT_KEY,JSON.stringify(layout))}}catch{}sessionStorage.setItem(RETURN_HOME_KEY,String(Date.now()));location.reload()}
function ensureSyntheticBadges(){for(const item of $$('#homeScreen .home-app[data-id]')){if(item.querySelector('.app-delete-badge'))continue;const badge=document.createElement('button');badge.className='app-delete-badge';badge.type='button';badge.textContent='−';badge.setAttribute('aria-label','Delete');badge.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();deleteProjectFromHome(item.dataset.id)});item.append(badge)}}
function enterSyntheticEdit(){const home=$('#homeScreen'),done=$('#homeEditDone');if(!home||!done)return;syntheticEditing=true;done.classList.remove('hidden');home.classList.add('springboard-editing');ensureSyntheticBadges();queueApplyDock()}

document.addEventListener('pointerdown',event=>{const home=$('#homeScreen');const item=event.target.closest?.('#homeScreen .home-app');if(!home||!item||isEditing()||event.target.closest('.app-delete-badge')||event.button>0)return;clearPress();press={pointerId:event.pointerId,item,startX:event.clientX,startY:event.clientY,start:performance.now(),moved:false,long:false,timer:setTimeout(()=>{if(!press||press.pointerId!==event.pointerId||press.moved)return;press.long=true;suppressClickUntil=performance.now()+1400;if(item.dataset.runnerApp==='1'||!item.dataset.id)enterSyntheticEdit()},600)}} ,true);
document.addEventListener('pointermove',event=>{if(!press||press.pointerId!==event.pointerId||isEditing())return;const distance=Math.hypot(event.clientX-press.startX,event.clientY-press.startY);if(distance<=18){event.stopImmediatePropagation();return}press.moved=true;clearTimeout(press.timer)},true);
function finishPress(event,cancelled=false){if(!press||press.pointerId!==event.pointerId)return;const duration=performance.now()-press.start;const shouldSuppress=cancelled||press.long||press.moved||duration>=450;if(shouldSuppress)suppressClickUntil=performance.now()+900;clearPress()}
document.addEventListener('pointerup',event=>finishPress(event,false),true);document.addEventListener('pointercancel',event=>finishPress(event,true),true);
document.addEventListener('click',event=>{const item=event.target.closest?.('#homeScreen .home-app');if(!item)return;if(performance.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();return}if(syntheticEditing&&item.dataset.id){event.preventDefault();event.stopImmediatePropagation();const card=$(`.project-card[data-id="${CSS.escape(item.dataset.id)}"]`);const settings=card?.querySelector('.project-actions button:not(.primary-mini)');settings?.click()}},true);
$('#homeEditDone')?.addEventListener('click',()=>{syntheticEditing=false;clearPress()},true);

function normalizeRunnerAfterChange(){setTimeout(()=>{queueApplyDock();const runner=runnerNode();if(runner?.parentElement?.id==='homeDock')cleanGridPlacement(runner)},0)}
document.addEventListener('change',event=>{if(event.target?.id==='runnerDockToggle')normalizeRunnerAfterChange()},true);
const homeObserver=new MutationObserver(()=>queueApplyDock());if($('#homeScreen'))homeObserver.observe($('#homeScreen'),{subtree:true,childList:true});

let wakeLock=null;let wakeRetry=false;
function keepAwakeEnabled(){return localStorage.getItem(KEEP_AWAKE_KEY)==='1'}
function updateWakeStatus(text){const n=$('#keepAwakeStatus');if(n)n.textContent=text}
async function releaseWakeLock(){if(!wakeLock)return;try{await wakeLock.release()}catch{}wakeLock=null}
async function acquireWakeLock(){if(!keepAwakeEnabled()){await releaseWakeLock();updateWakeStatus('Off.');return}if(!('wakeLock'in navigator)){updateWakeStatus('Screen Wake Lock is unavailable in this browser.');return}if(document.visibilityState!=='visible')return;if(wakeLock&&!wakeLock.released){updateWakeStatus('Active while Pro Runner is in the foreground.');return}try{wakeLock=await navigator.wakeLock.request('screen');wakeRetry=false;updateWakeStatus('Active while Pro Runner is in the foreground.');wakeLock.addEventListener('release',()=>{wakeLock=null;if(keepAwakeEnabled()&&document.visibilityState==='visible'){wakeRetry=true;updateWakeStatus('Will reacquire on the next interaction.')}})}catch{wakeRetry=true;updateWakeStatus('Waiting for the next user interaction to activate.') }}
function installWakeUI(){if($('#keepAwakeToggle'))return;const groups=$('#settingsDialog .settings-groups');if(!groups)return;const section=document.createElement('section');section.className='settings-group';section.id='keepAwakeGroup';section.innerHTML=`<h3>Display</h3><label class="toggle-row"><span><strong>Keep screen awake</strong><small>Prevent display sleep while Pro Runner is in the foreground.</small><span id="keepAwakeStatus" class="keep-awake-status"></span></span><input id="keepAwakeToggle" type="checkbox" role="switch"></label>`;const storage=[...groups.querySelectorAll('.settings-group')].find(x=>x.querySelector('h3')?.textContent==='Storage');groups.insertBefore(section,storage||null);const toggle=$('#keepAwakeToggle');toggle.checked=keepAwakeEnabled();toggle.disabled=!('wakeLock'in navigator);toggle.addEventListener('change',async()=>{localStorage.setItem(KEEP_AWAKE_KEY,toggle.checked?'1':'0');if(toggle.checked)await acquireWakeLock();else await releaseWakeLock();updateWakeStatus(toggle.checked?(wakeLock?'Active while Pro Runner is in the foreground.':'Waiting for activation.'):'Off.')});updateWakeStatus(toggle.disabled?'Screen Wake Lock is unavailable in this browser.':toggle.checked?'Enabled.':'Off.')}
installWakeUI();document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseWakeLock();else acquireWakeLock()},{passive:true});document.addEventListener('pointerdown',()=>{if(wakeRetry||keepAwakeEnabled())acquireWakeLock()},{passive:true,capture:true});window.addEventListener('pageshow',()=>acquireWakeLock(),{passive:true});window.addEventListener('pagehide',()=>releaseWakeLock(),{passive:true});if(keepAwakeEnabled())setTimeout(()=>acquireWakeLock(),250);

await refreshProjectTruth();queueApplyDock();