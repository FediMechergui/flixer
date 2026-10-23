import fs from 'node:fs';import path from 'node:path';
import {createHash} from 'node:crypto';import {createGzip,gzipSync} from 'node:zlib';import {pipeline} from 'node:stream/promises';
import {writeTitlePacks} from './title-packs.js';import {leanCatalog} from './export-catalog.js';import {writeJsonFile} from './json-files.js';
import {validateRuntimeManifest} from './runtime-source.js';

export async function buildRuntimePublication(catalog,outDir){
 if(catalog.product!=='flixer'||!catalog.shows?.length||!Number.isFinite(Date.parse(catalog.generatedAt)))throw Error('A complete Flixer catalogue is required');
 outDir=path.resolve(outDir);fs.mkdirSync(outDir,{recursive:true});const files={};
 async function retain(key,file){const hash=createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);const sha256=hash.digest('hex'),name='data-'+sha256+'.json.gz',destination=path.join(outDir,name);if(file!==destination)fs.copyFileSync(file,destination);files[key]={name,sha256,bytes:fs.statSync(destination).size}}
 async function small(key,value){const data=gzipSync(JSON.stringify(value),{level:6}),file=path.join(outDir,key+'.tmp.gz');fs.writeFileSync(file,data);await retain(key,file);fs.unlinkSync(file)}
 const lean=leanCatalog(catalog,'flixer');
 const runtime={...lean,packedTitles:true,shows:lean.shows.map(({episodes,...show})=>({...show,firstEpisodeId:episodes?.[0]?.id}))};
 const raw=path.join(outDir,'runtime.tmp.json'),gz=path.join(outDir,'runtime.tmp.gz');writeJsonFile(raw,runtime);await pipeline(fs.createReadStream(raw),createGzip({level:6}),fs.createWriteStream(gz));await retain('runtime',gz);fs.unlinkSync(raw);fs.unlinkSync(gz);
 const indexParts=[],groups=new Map(),recent=[];
 for(const {episodes,seasons,versions,offerings,blurb,...show}of lean.shows){
  const row={...show,aliasIds:(offerings||[]).map(o=>o.id).filter(id=>id!==show.id),firstEpisodeId:episodes?.[0]?.id},group=createHash('sha256').update(row.id).digest()[0]&127;
  if(!groups.has(group))groups.set(group,[]);groups.get(group).push(row);recent.push({...row,blurb:blurb||''});
 }
 // Hash membership and sorted rows keep a new release from shifting every part.
 for(const [group,members]of [...groups].sort((a,b)=>a[0]-b[0])){
  let rows=[],bytes=0,section=0;
  const flush=async()=>{if(!rows.length)return;if(section>=4)throw Error('Catalogue index group exceeds part limit');const key='index-'+String(group*4+section++).padStart(4,'0');await small(key,{product:'flixer',shows:rows});indexParts.push(key);rows=[];bytes=0};
  for(const row of members.sort((a,b)=>a.id.localeCompare(b.id))){const size=Buffer.byteLength(JSON.stringify(row));if(size>1500000)throw Error('Catalogue index record exceeds part limit');if(bytes+size>1500000)await flush();rows.push(row);bytes+=size+1;}await flush();
 }
 recent.sort((a,b)=>String(b.providerUpdatedAt||b.latestAt||b.publishedAt||'').localeCompare(String(a.providerUpdatedAt||a.latestAt||a.publishedAt||'')));
 await small('bootstrap',{product:'flixer',lite:true,generatedAt:catalog.generatedAt,stats:lean.stats,tags:lean.tags,shows:recent.slice(0,600)});
 const packs=fs.mkdtempSync(path.join(outDir,'packs-'));
 try{writeTitlePacks(catalog.shows,packs,{bucketBits:6});for(const name of fs.readdirSync(packs).filter(name=>/^[a-f0-9]{2}\.json\.gz$/.test(name)))await retain('title-'+name.slice(0,2),path.join(packs,name));for(const name of fs.readdirSync(path.join(packs,'owners')))await retain('owner-'+name.slice(0,2),path.join(packs,'owners',name))}finally{if(!path.resolve(packs).startsWith(outDir+path.sep))throw Error('Invalid runtime staging path');fs.rmSync(packs,{recursive:true,force:true})}
 const manifest=validateRuntimeManifest({format:1,product:'flixer',bucketBits:6,generatedAt:catalog.generatedAt,count:catalog.shows.length,stats:lean.stats,indexParts,files});
 fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify(manifest));return manifest;
}
