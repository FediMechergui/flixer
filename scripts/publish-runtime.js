import fs from 'node:fs';import path from 'node:path';import {execFileSync,execFile} from 'node:child_process';import {promisify} from 'node:util';
import {readJson} from '../server/src/store.js';import {buildRuntimePublication} from '../server/src/runtime-publication.js';
import {validateRuntimeManifest} from '../server/src/runtime-source.js';
import {planRuntimeCleanup} from '../server/src/runtime-retention.js';
const repo='FediMechergui/flixer',tag='catalogue-runtime',dir=path.resolve('artifacts/runtime-publication'),gh=process.platform==='win32'?'gh.exe':'gh',run=promisify(execFile);
const call=args=>execFileSync(gh,args,{encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024});
const json=args=>JSON.parse(call(args));
const catalog=readJson('flixer-catalog.json',null),manifest=await buildRuntimePublication(catalog,dir);console.log('[runtime] built',manifest.count,'titles and',manifest.indexParts.length,'index parts');
let release;try{release=json(['api',`repos/${repo}/releases/tags/${tag}`])}catch(error){if(!String(error.stderr).includes('404'))throw error;call(['release','create',tag,'--repo',repo,'--title','Live catalogue data','--notes','Versioned catalogue data read by the deployed backend. Updates do not deploy application code.','--latest=false']);release=json(['api',`repos/${repo}/releases/tags/${tag}`])}
const list=()=>json(['api','--paginate','--slurp',`repos/${repo}/releases/${release.id}/assets?per_page=100`]).flat();let assets=list();const known=new Map(assets.map(a=>[a.name,a]));
const old=known.get('manifest.json');let previous=null;if(old)previous=validateRuntimeManifest(json(['api','-H','Accept: application/octet-stream',`repos/${repo}/releases/assets/${old.id}`]));
const oldBackup=known.get('manifest.previous.json'),backupManifest=oldBackup?validateRuntimeManifest(json(['api','-H','Accept: application/octet-stream',`repos/${repo}/releases/assets/${oldBackup.id}`])):null;
if(previous&&manifest.count<previous.count*0.95)throw Error('Refusing an unexpectedly truncated catalogue publication');
const missing=[...new Map(Object.values(manifest.files).map(f=>[f.name,f])).values()].filter(file=>{const asset=known.get(file.name);if(asset&&asset.size!==file.bytes)throw Error('Existing runtime asset size mismatch');return !asset});
let nextMutation=Date.now();const mutate=async args=>{const delay=Math.max(0,nextMutation-Date.now());nextMutation=Math.max(nextMutation,Date.now())+1000;if(delay)await new Promise(resolve=>setTimeout(resolve,delay));return run(gh,args,{windowsHide:true,maxBuffer:1024*1024,timeout:120000});};
const cleanup=planRuntimeCleanup({assets,manifests:[previous,backupManifest,manifest],incoming:Object.values(manifest.files)});
console.log('[runtime] capacity:',assets.length,'existing,',missing.length,'new,',cleanup.remove.length,'unreferenced assets to retire');
let retired=0;for(const asset of cleanup.remove){await mutate(['api',`repos/${repo}/releases/assets/${asset.id}`,'--method','DELETE']);if(++retired%20===0)console.log('[runtime] retired',retired,'of',cleanup.remove.length);}
let cursor=0;await Promise.all(Array.from({length:Math.min(6,missing.length)},async()=>{while(cursor<missing.length){const file=missing[cursor++];await mutate(['release','upload',tag,path.join(dir,file.name),'--repo',repo]);if(cursor%20===0)console.log('[runtime] uploaded',cursor,'of',missing.length)}}));
const pendingName='manifest.pending-'+Date.now()+'.json',pending=path.join(dir,pendingName);fs.copyFileSync(path.join(dir,'manifest.json'),pending);call(['release','upload',tag,pending,'--repo',repo]);
assets=list();const uploaded=assets.find(a=>a.name===pendingName);if(!uploaded||uploaded.state!=='uploaded'||uploaded.size!==fs.statSync(pending).size)throw Error('Runtime manifest upload incomplete');
const api=(id,args)=>call(['api',`repos/${repo}/releases/assets/${id}`,...args]);const backup=assets.find(a=>a.name==='manifest.previous.json');if(backup)api(backup.id,['--method','DELETE']);if(old)api(old.id,['--method','PATCH','-f','name=manifest.previous.json']);
try{api(uploaded.id,['--method','PATCH','-f','name=manifest.json'])}catch(error){if(old)api(old.id,['--method','PATCH','-f','name=manifest.json']);throw error}
const retained=new Set([...Object.values(manifest.files),...Object.values(previous?.files||{})].map(f=>f.name));
for(const asset of assets)if(/^data-[a-f0-9]{64}\.json\.gz$/.test(asset.name)&&!retained.has(asset.name)&&Date.now()-Date.parse(asset.created_at)>6*3600e3)try{await mutate(['api',`repos/${repo}/releases/assets/${asset.id}`,'--method','DELETE'])}catch{console.warn('[runtime] Old asset cleanup deferred')}
console.log('[runtime] published',manifest.generatedAt,missing.length,'changed assets; no Vercel deployment requested');
