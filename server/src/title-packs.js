import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
// Fixed hash buckets keep request paths out of the filesystem lookup.
const defaultDir=fileURLToPath(new URL('../deployment-titles/',import.meta.url));
const shard=id=>createHash('sha256').update(id).digest('hex').slice(0,2);
export function writeTitlePacks(shows,dir=defaultDir){
 fs.mkdirSync(dir,{recursive:true});const groups=new Map(),owners=new Map();
 for(const show of shows)for(const row of [show,...(show.versions||[])]){const key=shard(row.id);if(!groups.has(key))groups.set(key,new Map());groups.get(key).set(row.id,row);
  for(const ep of row.episodes||[])for(const id of [ep.id,...(ep.offerings||[]).map(o=>o.id)]){if(typeof id!=='string')continue;const bucket=shard(id);if(!owners.has(bucket))owners.set(bucket,new Map());if(!owners.get(bucket).has(id))owners.get(bucket).set(id,{id:row.id});}
 }
 let bytes=0;for(const [key,rows]of groups){const body=gzipSync(JSON.stringify(Object.fromEntries(rows)),{level:6});fs.writeFileSync(path.join(dir,key+'.json.gz'),body);bytes+=body.length;}
 const ownerDir=path.join(dir,'owners');fs.mkdirSync(ownerDir,{recursive:true});for(const [key,rows]of owners)fs.writeFileSync(path.join(ownerDir,key+'.json.gz'),gzipSync(JSON.stringify(Object.fromEntries(rows)),{level:6}));
 return {files:groups.size,bytes};
}
export function createTitleReader(dir=defaultDir){
 const cache=new Map();return id=>{if(typeof id!=='string'||id.length>350||!id||/[\x00-\x1f]/.test(id))return null;const key=shard(id),file=path.join(dir,key+'.json.gz');if(!fs.existsSync(file))return null;
 const stamp=fs.statSync(file).mtimeMs;let entry=cache.get(key);if(!entry||entry.stamp!==stamp){entry={stamp,rows:JSON.parse(gunzipSync(fs.readFileSync(file)).toString('utf8'))};cache.set(key,entry);if(cache.size>8)cache.delete(cache.keys().next().value);}
 return Object.hasOwn(entry.rows,id)?entry.rows[id]:null;};
}
export const readPackedTitle=createTitleReader();
const readOwner=createTitleReader(path.join(defaultDir,'owners'));
export const readPackedEpisodeTitle=id=>{const owner=readOwner(id);return owner?readPackedTitle(owner.id):null;};
export function decodeTitlePath(value){if(typeof value!=='string'||value.length>1500)return null;let id=value;for(let i=0;i<3;i++){if(/^(?:mf|fm|hd|sp):/.test(id)||/^[\w-]{11}$/.test(id))return id.length<=350?id:null;try{const next=decodeURIComponent(id);if(next===id)break;id=next;}catch{return null;}}return null;}
