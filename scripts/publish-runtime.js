import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {execFileSync,execFile} from 'node:child_process';import {promisify} from 'node:util';
import {readJson,DATA_DIR} from '../server/src/store.js';import {buildRuntimePublication} from '../server/src/runtime-publication.js';
import {validateRuntimeManifest,runtimeAssets} from '../server/src/runtime-source.js';
import {readJsonItems} from '../server/src/json-files.js';
import {planRuntimeCleanup} from '../server/src/runtime-retention.js';
import {deleteRuntimeAsset,uploadRuntimeAsset,verifyRuntimeAsset,verifyRuntimeRelease} from '../server/src/runtime-release.js';
const repo='FediMechergui/flixer',tag='catalogue-runtime',dir=path.resolve('artifacts/runtime-publication'),gh=process.platform==='win32'?'gh.exe':'gh',run=promisify(execFile);
const call=args=>execFileSync(gh,args,{encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024});
const json=args=>JSON.parse(call(args));
const catalog=readJson('flixer-catalog.json',null),providerFile=path.join(DATA_DIR,'providers-flixer.json'),providerRows=fs.existsSync(providerFile)?readJsonItems(providerFile,row=>/^sp:(?:carateen|stardima|aloula|dessinanime|cimafu|cimatn|tuniflix|streamtunisie|kirmalk|ahwaktv|egydead|cinetimes|youtubeoriginals):/.test(row.id)):[],manifest=await buildRuntimePublication(catalog,dir,{providerRows});console.log('[runtime] built',manifest.count,'titles and',manifest.indexParts.length,'index parts; source guides:',providerRows.length);
let release;try{release=json(['api',`repos/${repo}/releases/tags/${tag}`])}catch(error){if(!String(error.stderr).includes('404'))throw error;call(['release','create',tag,'--repo',repo,'--title','Live catalogue data','--notes','Versioned catalogue data read by the deployed backend. Updates do not deploy application code.','--latest=false']);release=json(['api',`repos/${repo}/releases/tags/${tag}`])}
const list=()=>json(['api','--paginate','--slurp',`repos/${repo}/releases/${release.id}/assets?per_page=100`]).flat();let assets=list();const known=new Map(assets.map(a=>[a.name,a]));
const old=known.get('manifest.json');let previous=null;if(old)previous=validateRuntimeManifest(json(['api','-H','Accept: application/octet-stream',`repos/${repo}/releases/assets/${old.id}`]));
const oldBackup=known.get('manifest.previous.json'),backupManifest=oldBackup?validateRuntimeManifest(json(['api','-H','Accept: application/octet-stream',`repos/${repo}/releases/assets/${oldBackup.id}`])):null;
if(previous&&manifest.count<previous.count*0.95)throw Error('Refusing an unexpectedly truncated catalogue publication');
const incoming=[...new Map(runtimeAssets(manifest).map(f=>[f.name,f])).values()];
const publishedNames=new Set([previous,backupManifest].filter(Boolean).flatMap(runtimeAssets).map(file=>file.name));
const missing=incoming.filter(file=>{const asset=known.get(file.name);if(asset?.state==='starter'&&asset.size===0&&!publishedNames.has(file.name))return true;if(asset)verifyRuntimeAsset(asset,file);return !asset});
let nextMutation=Date.now();const mutate=async args=>{const delay=Math.max(0,nextMutation-Date.now());nextMutation=Math.max(nextMutation,Date.now())+1000;if(delay)await new Promise(resolve=>setTimeout(resolve,delay));return run(gh,args,{windowsHide:true,maxBuffer:1024*1024,timeout:120000});};
const cleanup=planRuntimeCleanup({assets,manifests:[previous,backupManifest,manifest],incoming:runtimeAssets(manifest)});
console.log('[runtime] capacity:',assets.length,'existing,',missing.length,'new,',cleanup.remove.length,'unreferenced assets to retire');
const remove=id=>deleteRuntimeAsset({repo,id,mutate});
const inspect=()=>{const current=verifyRuntimeRelease(json(['api',`repos/${repo}/releases/tags/${tag}`]),{id:release.id,tag});return {...current,assets:list()};};
const removeIncomplete=asset=>{if(publishedNames.has(asset.name))throw Error('Refusing to remove a published catalogue asset');return remove(asset.id);};
const upload=file=>uploadRuntimeAsset({repo,tag,releaseId:release.id,file:{...file,path:path.join(dir,file.name)},mutate,inspect,removeIncomplete});
let retired=0;for(const asset of cleanup.remove){await remove(asset.id);if(++retired%20===0)console.log('[runtime] retired',retired,'of',cleanup.remove.length);}
let cursor=0,completed=0,uploadError;await Promise.all(Array.from({length:Math.min(6,missing.length)},async()=>{while(!uploadError&&cursor<missing.length){const file=missing[cursor++];try{await upload(file)}catch(error){uploadError ||=error;return}if(++completed%20===0)console.log('[runtime] uploaded',completed,'of',missing.length)}}));if(uploadError)throw uploadError;
const pendingName='manifest.pending-'+Date.now()+'.json',pending=path.join(dir,pendingName);fs.copyFileSync(path.join(dir,'manifest.json'),pending);
const pendingFile={name:pendingName,bytes:fs.statSync(pending).size,sha256:createHash('sha256').update(fs.readFileSync(pending)).digest('hex')};await upload(pendingFile);
assets=verifyRuntimeRelease(inspect(),{id:release.id,tag}).assets;
const finished=new Map(assets.map(asset=>[asset.name,asset]));for(const file of incoming)verifyRuntimeAsset(finished.get(file.name),file);
const uploaded=verifyRuntimeAsset(finished.get(pendingName),pendingFile);
const api=(id,args)=>call(['api',`repos/${repo}/releases/assets/${id}`,...args]);const backup=assets.find(a=>a.name==='manifest.previous.json');if(backup)await remove(backup.id);if(old)api(old.id,['--method','PATCH','-f','name=manifest.previous.json']);
try{api(uploaded.id,['--method','PATCH','-f','name=manifest.json'])}catch(error){if(old)api(old.id,['--method','PATCH','-f','name=manifest.json']);throw error}
const retained=new Set([...runtimeAssets(manifest),...runtimeAssets(previous||{})].map(f=>f.name));
for(const asset of assets)if(/^data-[a-f0-9]{64}\.json\.gz$/.test(asset.name)&&!retained.has(asset.name)&&Date.now()-Date.parse(asset.created_at)>6*3600e3)try{await remove(asset.id)}catch{console.warn('[runtime] Old asset cleanup deferred')}
console.log('[runtime] published',manifest.generatedAt,missing.length,'changed assets; no Vercel deployment requested');
