import fs from 'node:fs';import path from 'node:path';
import {readJsonItems} from '../server/src/json-files.js';import {DATA_DIR} from '../server/src/store.js';
import {parseDessinId,dessinUrl,fetchDessinPage} from '../server/src/dessinanime.js';import {collectDessinMetadata,mergeDessinMetadata} from '../server/src/dessin-collection.js';
import {launchDessinBrowser,connectDessinBrowser} from './dessin-browser.js';import {importDessinMetadata} from './import-dessinanime-metadata.js';
import {validateDessinArtifact} from './dessin-artifacts.js';
const args=process.argv.slice(2),option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback,port=Number(option('--port','9237')),pageBudget=Number(option('--pages','48')),limit=Number(option('--titles','4'));
if(!Number.isSafeInteger(limit)||limit<1||limit>100||!Number.isSafeInteger(pageBudget)||pageBudget<1||pageBudget>500)throw Error('Invalid DessinAnime collection limits');
const out=path.resolve(option('--out','artifacts/dessin-browser-metadata.json'));fs.mkdirSync(path.dirname(out),{recursive:true});
const seed=option('--seed',''),source=path.join(DATA_DIR,'providers-flixer.json'),deployment=new URL('../server/deployment-dessinanime.json',import.meta.url);
if(seed&&fs.statSync(seed).size>32*1024*1024)throw Error('DessinAnime seed exceeds size limit');
const rows=seed?validateDessinArtifact(JSON.parse(fs.readFileSync(seed,'utf8')),'seed').items:fs.existsSync(source)?readJsonItems(source,r=>!!parseDessinId(r.id)):JSON.parse(fs.readFileSync(deployment,'utf8'));
if(!rows.length)throw Error('No DessinAnime titles available for collection');
const byId=new Map(rows.map(r=>[r.id,r]));if(fs.existsSync(out)){const previous=JSON.parse(fs.readFileSync(out,'utf8'));for(const row of previous.items||[])byId.set(row.id,mergeDessinMetadata(byId.get(row.id),row));}
const requested=option('--ids','').split(',').filter(Boolean);let titles;
if(requested.length){titles=[];for(const id of requested){const p=parseDessinId(id);if(!p||p.type==='e')throw Error('Invalid DessinAnime source title');let row=byId.get(id);if(!row){const page=await fetchDessinPage({search:p.slug.replace(/^\d+-/,'').replaceAll('-',' ')});row=page.items.find(r=>r.id===id);}if(!row)throw Error('Unknown DessinAnime source title: '+id);titles.push(row);}}
else{
 const sorted=[...byId.values()].sort((a,b)=>String(a.dessinBrowserCheckedAt||'').localeCompare(String(b.dessinBrowserCheckedAt||''))||a.id.localeCompare(b.id));
 const unfinished=sorted.find(r=>r.kind==='series'&&r.sourceGuide?.some(e=>!r.episodes?.some(mapped=>mapped.id===e.id&&mapped.cachedPlayers?.length)&&!(r.dessinPlayerChecks?.[e.id]?.hasPlayers===false&&Date.now()-Date.parse(r.dessinPlayerChecks[e.id].at)<86400000)));
 const kinds=['series','film'].map(kind=>sorted.filter(r=>r.kind===kind&&r!==unfinished));titles=unfinished?[unfinished]:[];while(titles.length<limit&&kinds.some(k=>k.length))for(const group of kinds){if(group.length&&titles.length<limit)titles.push(group.shift());}
}
let browser,child;
const checkpoint=new Map();if(fs.existsSync(out))for(const row of JSON.parse(fs.readFileSync(out,'utf8')).items||[])checkpoint.set(row.id,row);
const save=report=>{for(const row of report.items)checkpoint.set(row.id,row);fs.writeFileSync(out+'.tmp',JSON.stringify({...report,items:[...checkpoint.values()]},null,2));fs.renameSync(out+'.tmp',out);};
try{
 if(args.includes('--launch'))child=launchDessinBrowser({port,profile:path.resolve('artifacts/dessin-browser-profile')});
 browser=await connectDessinBrowser(port);
 if(child&&!await browser.warmup(dessinUrl(titles[0].id))){save({format:1,items:[],pages:0,verificationRequired:true,errors:[{error:'DessinAnime browser verification required'}],finishedAt:new Date().toISOString()});console.log('[dessin-browser] Browser verification required; existing metadata retained');}
 else{
  const report=await collectDessinMetadata({titles,readPage:url=>browser.readPage(url),pageBudget,latestFirst:args.includes('--latest'),onRecord:report=>{for(const row of report.items)row.dessinBrowserCheckedAt=new Date().toISOString();save(report);}});
  console.log('[dessin-browser]',JSON.stringify({pages:report.pages,titles:report.items.length,episodes:report.items.reduce((n,r)=>n+r.episodes.length,0),verificationRequired:report.verificationRequired,errors:report.errors}));
  if(args.includes('--write-cache')&&report.items.length)console.log('[dessin-import]',JSON.stringify(importDessinMetadata(report,{hashKey:'dessinBrowserHash'})));
 }
}catch(error){let completed={format:1,items:[],pages:0,errors:[]};try{if(fs.existsSync(out))completed=JSON.parse(fs.readFileSync(out,'utf8'));}catch{}save({...completed,unavailable:true,errors:[...(completed.errors||[]),{error:error.message}],finishedAt:new Date().toISOString()});console.error('[dessin-browser]',error.message);process.exitCode=1;
}finally{if(child){await browser?.stop();child.kill();}else browser?.disconnect();}
