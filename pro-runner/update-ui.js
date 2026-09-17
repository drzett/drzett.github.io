const releaseVersion='2.0.0';
const releaseBuild='2026-09-18.2';
const versionMeta=document.querySelector('meta[name="app-version"]');
const buildMeta=document.querySelector('meta[name="app-build"]');
if(versionMeta)versionMeta.content=releaseVersion;
if(buildMeta)buildMeta.content=releaseBuild;
const installed=document.getElementById('installedVersionValue');
if(installed)installed.textContent=releaseVersion;
(async()=>{
  await import('./update-ui-core.js');
})().catch(error=>console.error('Pro Runner update interface failed.',error));
