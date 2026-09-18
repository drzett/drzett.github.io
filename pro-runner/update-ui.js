if(!globalThis.PRO_RUNNER_RELEASE?.version)throw new Error('Pro Runner release metadata is unavailable.');
(async()=>{
  await import('./update-ui-core.js');
})().catch(error=>console.error('Pro Runner update interface failed.',error));
