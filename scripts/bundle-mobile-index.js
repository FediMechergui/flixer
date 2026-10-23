import fs from 'node:fs';import path from 'node:path';

// Keep each local WebView response small; a single large JSON response holds
// the response bytes, decoded string and parsed catalogue in memory together.
export function writeMobileIndex(source,destination,{maxBytes=1000000}={}){
 const {shows,...metadata}=JSON.parse(fs.readFileSync(source,'utf8'));
 if(metadata.product!=='flixer'||!Array.isArray(shows)||!shows.length)throw Error('Invalid mobile catalogue');
 fs.mkdirSync(destination,{recursive:true});const indexParts=[];let rows=[],bytes=0;
 const flush=()=>{if(!rows.length)return;const name='index-'+String(indexParts.length).padStart(4,'0')+'.json';if(indexParts.length>=512)throw Error('Mobile index exceeds part limit');fs.writeFileSync(path.join(destination,name),'{"product":"flixer","generatedAt":'+JSON.stringify(metadata.generatedAt||null)+',"shows":['+rows.join(',')+']}');indexParts.push(name);rows=[];bytes=0;};
 for(const row of shows){const compact=Object.fromEntries(Object.entries(row).filter(([,v])=>v!==null&&v!==undefined&&v!==''&&!(Array.isArray(v)&&!v.length))),text=JSON.stringify(compact),size=Buffer.byteLength(text)+1;if(size>maxBytes)throw Error('Mobile index record exceeds part limit');if(bytes+size>maxBytes)flush();rows.push(text);bytes+=size;}
 flush();fs.writeFileSync(path.join(destination,'index.json'),JSON.stringify({...metadata,count:shows.length,indexParts}));return {count:shows.length,parts:indexParts.length};
}
