const DB='pro-runner-v1';
const PROJECTS='projects';

function openDB(){return new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('Unable to open local storage.'))})}
async function getProject(id){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(PROJECTS,'readonly');const request=tx.objectStore(PROJECTS).get(id);request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error||new Error('Unable to read project.'));tx.oncomplete=()=>db.close();tx.onabort=()=>db.close()})}
async function putProject(project){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(PROJECTS,'readwrite');tx.objectStore(PROJECTS).put(project);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error||new Error('Unable to save project.'))};tx.onabort=()=>{db.close();reject(tx.error||new Error('Unable to save project.'))}})}

let activeProjectId=null;
function rememberProject(event){const node=event.target.closest?.('.project-card[data-id],#homeScreen .home-app[data-id]');if(node?.dataset.id)activeProjectId=node.dataset.id}
document.addEventListener('pointerdown',rememberProject,true);
document.addEventListener('click',rememberProject,true);

function toast(message,duration=1800){const host=document.getElementById('toastHost');if(!host)return;const item=document.createElement('div');item.className='toast';item.textContent=message;host.append(item);setTimeout(()=>item.remove(),duration)}

/* 1.5.3 can race its broad dialog observer against an immediate dock change.
   In the full-dock case that race may write the old `true` state back into the
   switch before the IndexedDB write is visible. Unpinning never needs a
   capacity check, so handle that one direction atomically here before the
   older listener sees the event. */
document.addEventListener('change',event=>{
  const toggle=event.target;
  if(toggle?.id!=='projectDockToggle'||toggle.checked||!activeProjectId)return;
  event.stopImmediatePropagation();
  const projectId=activeProjectId;
  void (async()=>{
    try{
      const project=await getProject(projectId);
      if(!project)return;
      project.dock=false;
      project.updatedAt=Date.now();
      await putProject(project);
      toggle.checked=false;
      /* v153 listens for `close` to refresh its canonical project map. Dispatch
         that notification without closing the settings sheet, so the Home UI
         moves the item out of the dock immediately and the user can continue
         editing normally. */
      document.getElementById('projectDialog')?.dispatchEvent(new Event('close'));
      toast('Removed from dock.');
    }catch(error){
      toggle.checked=true;
      toast(error?.message||'Unable to update the dock.');
    }
  })();
},true);
