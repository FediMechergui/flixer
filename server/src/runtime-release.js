const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const responseStatus=result=>Number([...String(result?.stdout||'').matchAll(/^HTTP\/\S+\s+(\d{3})\b/gm)].at(-1)?.[1])||0;

// GitHub can return an empty error body. gh then reports a JSON parse error
// instead of the HTTP status, so include headers even when no body is needed.
// Deletion is idempotent: a timed-out successful request can return 404 on retry.
export async function deleteRuntimeAsset({repo,id,mutate,sleep=pause}) {
  if(!/^[\w.-]+\/[\w.-]+$/.test(repo)||!Number.isSafeInteger(id)||id<=0)throw Error('Invalid release asset');
  const args=['api',`repos/${repo}/releases/assets/${id}`,'--method','DELETE','--include','--silent'];
  for(let attempt=0;attempt<3;attempt++){
    try {const result=await mutate(args);const status=responseStatus(result);if(status!==204&&status!==404)throw Object.assign(Error('Unexpected deletion response'),result);return;}
    catch(error){
      const status=responseStatus(error);
      if(status===404)return;
      const diagnostic=[error.message,error.code,String(error.stderr||'')].join(' ');
      const transient=[408,500,502,503,504].includes(status)||!status&&(/unexpected end of JSON input|timed?\s*out|ETIMEDOUT|ECONNRESET|socket hang up/i.test(diagnostic)||error.killed===true&&error.signal==='SIGTERM');
      if(!transient||attempt===2)throw new Error(`Runtime asset ${id} cleanup failed${status?` (HTTP ${status})`:''}; keeping the published catalogue`,{cause:error});
      await sleep(1000*4**attempt);
    }
  }
}
