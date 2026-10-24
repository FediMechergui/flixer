import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readPackedTitle,readPackedEpisodeTitle} from './title-packs.js';
import {hosted} from './hosting.js';

export const RUNTIME_ROOT='https://github.com/FediMechergui/flixer/releases/download/catalogue-runtime/';
export const runtimeAssets=value=>[...Object.values(value.files||{}),...Object.values(value.providerFiles||{})];
const digest=body=>createHash('sha256').update(body).digest('hex');
const bucket=(id,bits=8)=>(parseInt(digest(id).slice(0,2),16)&(255<<(8-bits))).toString(16).padStart(2,'0');
export function validateRuntimeManifest(value){
 if(value?.format!==1||value.product!=='flixer'||!Number.isSafeInteger(value.count)||value.count<1||!Number.isFinite(Date.parse(value.generatedAt))||!Array.isArray(value.indexParts)||!value.indexParts.length||value.indexParts.length>512||!value.files||Object.keys(value.files).length>2048)throw Error('Invalid runtime manifest');
 for(const [key,file]of Object.entries(value.files))if(!/^(?:runtime|bootstrap|services|universes|index-\d{4}|title-[a-f0-9]{2}|owner-[a-f0-9]{2})$/.test(key)||!/^[a-f0-9]{64}$/.test(file?.sha256)||file.name!=='data-'+file.sha256+'.json.gz'||!Number.isSafeInteger(file.bytes)||file.bytes<1||file.bytes>64*1024*1024)throw Error('Invalid runtime asset');
 if(!value.files.runtime||!value.files.bootstrap||value.indexParts.some(key=>!/^index-\d{4}$/.test(key)||!value.files[key]))throw Error('Incomplete runtime manifest');
 if(value.bucketBits!==undefined&&(!Number.isInteger(value.bucketBits)||value.bucketBits<4||value.bucketBits>8))throw Error('Invalid runtime bucket size');
 if(value.providerFiles){if(Object.keys(value.providerFiles).length>512||!Number.isInteger(value.providerBucketBits)||value.providerBucketBits<4||value.providerBucketBits>8)throw Error('Invalid provider bucket size');for(const [key,file]of Object.entries(value.providerFiles))if(!/^(?:source|source-owner)-[a-f0-9]{2}$/.test(key)||!/^[a-f0-9]{64}$/.test(file?.sha256)||file.name!=='data-'+file.sha256+'.json.gz'||!Number.isSafeInteger(file.bytes)||file.bytes<1||file.bytes>64*1024*1024)throw Error('Invalid provider asset');}
 return value;
}
async function boundedBody(response,limit){
 if(!response.ok){await response.body?.cancel();throw Error('Catalogue source HTTP '+response.status)}
 const parts=[];let size=0;for await(const part of response.body){size+=part.length;if(size>limit)throw Error('Catalogue asset too large');parts.push(part)}return Buffer.concat(parts);
}
export function createRuntimeSource({fetchImpl=fetch,now=Date.now,pollMs=120000,root=RUNTIME_ROOT,log=console.warn}={}){
 let manifest=null,available=null,catalog=null,pending=null,checking=null,checked=-Infinity,retryAt=0;
 const cache=new Map(),loading=new Map();
 const waiters=[];let downloads=0,cachedBytes=0;
 const release=()=>{if(waiters.length)waiters.shift()();else downloads--};
 const drop=key=>{const entry=cache.get(key);if(entry){cachedBytes-=entry.bytes;cache.delete(key)}};
 async function jsonAsset(sha,maxBytes=2*1024*1024){
  if(!/^[a-f0-9]{64}$/.test(sha))throw Error('Invalid catalogue hash');
  const unwrap=entry=>{if(entry.bytes>maxBytes)throw Error('Catalogue asset too large');return entry.data};
  if(cache.has(sha)){const entry=cache.get(sha);cache.delete(sha);cache.set(sha,entry);return unwrap(entry)}
  if(loading.has(sha))return unwrap(await loading.get(sha));
  const request=(async()=>{if(downloads<4)downloads++;else await new Promise(resolve=>waiters.push(resolve));try{const body=await boundedBody(await fetchImpl(root+'data-'+sha+'.json.gz',{signal:AbortSignal.timeout(15000)}),Math.min(maxBytes,64*1024*1024));if(digest(body)!==sha)throw Error('Catalogue asset integrity check failed');const raw=gunzipSync(body,{maxOutputLength:maxBytes}),entry={data:JSON.parse(raw.toString('utf8')),bytes:raw.length};cache.set(sha,entry);cachedBytes+=entry.bytes;while(cache.size>12||cachedBytes>64*1024*1024)drop(cache.keys().next().value);return entry}finally{release()}})().finally(()=>loading.delete(sha));
  loading.set(sha,request);return unwrap(await request);
 }
 async function check(){
  if(checking)return checking;if(now()-checked<pollMs)return available;
  checked=now();checking=(async()=>{try{
   const body=await boundedBody(await fetchImpl(root+'manifest.json?v='+Math.floor(now()/pollMs),{signal:AbortSignal.timeout(5000),cache:'no-store'}),512*1024);
   const next=validateRuntimeManifest(JSON.parse(body.toString('utf8')));
   if(!available||Date.parse(next.generatedAt)>Date.parse(available.generatedAt))available=next;
  }catch(error){log('[runtime] Manifest unavailable; retaining last complete version: '+error.message)}return available})().finally(()=>checking=null);return checking;
 }
 async function refresh(){
  const next=await check();if(!next||manifest?.generatedAt===next.generatedAt||now()<retryAt)return catalog;if(pending)return pending;
  pending=(async()=>{try{const fresh=await jsonAsset(next.files.runtime.sha256,256*1024*1024);if(fresh.product!=='flixer'||fresh.generatedAt!==next.generatedAt||!Array.isArray(fresh.shows)||!fresh.shows.length||fresh.shows.length!==next.count)throw Error('Incomplete runtime catalogue');catalog=fresh;manifest=next;drop(next.files.runtime.sha256)}catch(error){retryAt=now()+30000;log('[runtime] Update unavailable; retaining last complete catalogue: '+error.message)}return catalog})().finally(()=>pending=null);return pending;
 }
 async function titleAt(id,target,followAlias=true){if(typeof id!=='string'||!id||id.length>350)return null;const file=target?.files['title-'+bucket(id,target.bucketBits||8)];if(file){const rows=await jsonAsset(file.sha256,48*1024*1024);if(Object.hasOwn(rows,id))return rows[id];}if(!followAlias)return null;const ownerFile=target?.files['owner-'+bucket(id,target.bucketBits||8)];if(!ownerFile)return null;const owners=await jsonAsset(ownerFile.sha256,16*1024*1024),owner=Object.hasOwn(owners,id)?owners[id]?.id:null;return owner&&owner!==id?titleAt(owner,target,false):null}
 const title=id=>titleAt(id,manifest);
 return {refresh,check,current:()=>catalog,manifest:()=>available,readHash:jsonAsset,async providerSnapshot(id){if(typeof id!=='string'||!id||id.length>350)return null;const target=available,bits=target?.providerBucketBits||4,files=target?.providerFiles;if(!files)return null;let owner=id;if(/^sp:[^:]+:e:/.test(id)){const file=files['source-owner-'+bucket(id,bits)];if(!file)return null;const rows=await jsonAsset(file.sha256,32*1024*1024);if(!Object.hasOwn(rows,id))return null;owner=rows[id].id;}const file=files['source-'+bucket(owner,bits)];if(!file)return null;const rows=await jsonAsset(file.sha256,96*1024*1024);return Object.hasOwn(rows,owner)?rows[owner]:null},async part(key,sha){const file=available?.files[key];if(!file)throw Error('Unknown catalogue part');return jsonAsset(sha||file.sha256)},title,publishedTitle:id=>titleAt(id,available),async episode(id){const file=manifest?.files['owner-'+bucket(id,manifest.bucketBits||8)];if(!file)return null;const rows=await jsonAsset(file.sha256,16*1024*1024);return Object.hasOwn(rows,id)?title(rows[id].id):null}};
}
export const runtimeSource=createRuntimeSource();
export const ensureRuntime=()=>hosted()&&process.env.APP_PRODUCT!=='dahsha'?runtimeSource.refresh():Promise.resolve(null);
export const ensureTitleRuntime=()=>hosted()&&process.env.APP_PRODUCT!=='dahsha'?runtimeSource.check():Promise.resolve(null);
export const runtimeHome=async()=>runtimeSource.manifest()?runtimeSource.part('bootstrap'):null;
export const runtimeProviderSnapshot=async id=>hosted()?runtimeSource.providerSnapshot(id):null;
export const runtimeLibrary=()=>runtimeSource.current();
export const runtimeTitle=id=>runtimeSource.current()?runtimeSource.title(id):Promise.resolve(readPackedTitle(id));
export const runtimeEpisode=id=>runtimeSource.current()?runtimeSource.episode(id):Promise.resolve(readPackedEpisodeTitle(id));
export const runtimeSavedTitle=id=>runtimeSource.manifest()?runtimeSource.publishedTitle(id):Promise.resolve(readPackedTitle(id));
