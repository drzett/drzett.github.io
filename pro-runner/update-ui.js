const releaseVersion='1.5.2';
const releaseBuild='2026-09-12.4';
const versionMeta=document.querySelector('meta[name="app-version"]');
const buildMeta=document.querySelector('meta[name="app-build"]');
if(versionMeta)versionMeta.content=releaseVersion;
if(buildMeta)buildMeta.content=releaseBuild;
const installed=document.getElementById('installedVersionValue');
if(installed)installed.textContent=releaseVersion;
(async()=>{
  await import('./update-ui-core.js');
  await import('./springboard-v14.js');
  await import('./v142-ui.js');
  await import('./icon-designer.js');
  await import('./v150-home.js');
  await import('./v151-online.js');
  await import('./v150-touch.js');
  await import('./v152-icon-fix.js');
})().catch(error=>console.error('Pro Runner 1.5.2 bootstrap failed.',error));
