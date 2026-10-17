import {pathToFileURL} from 'node:url';
export async function deploySnapshot(hook,{fetchImpl=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms)),log=console.log}={}){
 if(!hook?.trim())throw Error('Missing Vercel deployment hook');
 for(let attempt=1;attempt<=3;attempt++){
  try{
   const response=await fetchImpl(hook.trim(),{method:'POST',signal:AbortSignal.timeout(30000+15000*(attempt-1))});
   await response.body?.cancel();
   if(response.ok){log('Flixer deployment requested with the refreshed snapshot.');return;}
   const error=new Error(`Deployment hook HTTP ${response.status}`);error.retryable=response.status===429||response.status>=500;throw error;
  }catch(error){
   if(error.retryable===false||attempt===3)throw Error(`Snapshot is saved, but deployment could not be requested after ${attempt} attempt(s): ${error.name==='TimeoutError'?'request timed out':error.retryable!==undefined?error.message:'network request failed'}`);
   log(`Deployment request failed; retrying (${attempt}/3). The saved snapshot is retained.`);await sleep(3000*attempt);
  }
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)deploySnapshot(process.env.VERCEL_DEPLOY_HOOK).catch(error=>{console.error(error.message);process.exitCode=1;});
