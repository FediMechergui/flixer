import fs from 'node:fs';import {pathToFileURL} from 'node:url';import path from 'node:path';import {createHash} from 'node:crypto';
import {readJson,writeJson} from '../server/src/store.js';import {validateDessinMetadata,mergeDessinMetadata} from '../server/src/dessin-collection.js';

export function importDessinMetadata(report,{cache,persist=true,hashKey='dessinMetadataHash'}={}){
 if(report?.format!==1||!Array.isArray(report.items))throw Error('Invalid DessinAnime metadata report');
 for(const row of report.items)validateDessinMetadata(row);
 if(!report.items.length)return {items:0,unchanged:true};
 cache??=readJson('providers-flixer.json',{items:[]});
 const hash=createHash('sha256').update(JSON.stringify(report.items)).digest('hex');if(cache[hashKey]===hash)return {items:report.items.length,unchanged:true};
 const items=new Map(cache.items.map(row=>[row.id,row]));for(const row of report.items)items.set(row.id,mergeDessinMetadata(items.get(row.id),row));
 cache.items=[...items.values()];cache[hashKey]=hash;cache.lastRefreshAt=new Date().toISOString();if(persist)writeJson('providers-flixer.json',cache);
 return {items:report.items.length,episodes:report.items.reduce((n,r)=>n+r.episodes.length,0)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const file=process.argv[2];if(!file)throw Error('Pass the reviewed metadata JSON file');
 if(!fs.existsSync(file))throw Error('DessinAnime metadata file not found');
 console.log('[dessin-import]',JSON.stringify(importDessinMetadata(JSON.parse(fs.readFileSync(file,'utf8')),{hashKey:process.argv.includes('--browser')?'dessinBrowserHash':'dessinReviewedHash'})));
}
