// Read-only source coverage audit. A discovered link is never playback proof.
import fs from 'node:fs';
import path from 'node:path';
import {fetchArabicPage,resolveArabicServers} from '../server/src/arabic-providers.js';

const args=process.argv.slice(2),option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const providers=option('--providers','tuniflix,cimatn').split(','),concurrency=Number(option('--concurrency','3'));
if(providers.some(p=>!['tuniflix','cimatn'].includes(p))||!Number.isInteger(concurrency)||concurrency<1||concurrency>4)throw Error('Use Tuniflix/CimaTN and concurrency 1–4');
const output=path.resolve(option('--out','artifacts/tunisian-films-audit.json'));
fs.mkdirSync(path.dirname(output),{recursive:true});
const report={startedAt:new Date().toISOString(),scope:'All advertised Tunisian film listing pages from the selected sources. Source entries may duplicate the same film.',playback:'unverified; stream descriptors only',providers:[],films:[]};
const save=()=>{fs.writeFileSync(output+'.tmp',JSON.stringify(report,null,2));fs.renameSync(output+'.tmp',output);};
const records=new Map();
for(const provider of providers){
  const state={provider,pages:0,sourceEntries:0,traversalComplete:false,listingErrors:[]},seen=new Set();report.providers.push(state);
  for(let page=1;;page++){
    try{
      const result=await fetchArabicPage({provider,kind:'film',collection:'tunisian',page});
      const fingerprint=result.items.map(r=>r.id).sort().join('|');
      if(seen.has(fingerprint))throw Error('Repeated listing page; traversal incomplete');
      seen.add(fingerprint);state.pages++;state.sourceEntries+=result.items.length;
      for(const row of result.items)records.set(row.id,{...row,auditProvider:provider});
      state.listingErrors.push(...(result.providerErrors||[]));save();
      if(!result.hasNext){state.traversalComplete=true;break;}
    }catch(error){state.error=error.message;state.failedPage=page;save();break;}
  }
  console.log(JSON.stringify({provider,pages:state.pages,entries:state.sourceEntries,complete:state.traversalComplete,error:state.error}));
}
const rows=[...records.values()];let cursor=0;
await Promise.all(Array.from({length:concurrency},async()=>{
  while(cursor<rows.length){
    const row=rows[cursor++],result={id:row.id,title:row.title,provider:row.auditProvider,playbackVerified:false},start=Date.now();
    try{
      // Do not let old cached descriptors conceal today's missing source pages.
      const servers=await resolveArabicServers(row.id,{readSnapshot:async()=>null});
      result.routes=servers.map(s=>({provider:s.provider,type:s.type,host:s.type==='youtube'?'www.youtube.com':new URL(s.embedUrl||s.streamUrl).hostname}));
      result.status=servers.length?'routes_found':'no_routes';
    }catch(error){result.status='lookup_failed';result.error=error.message;}
    result.lookupMs=Date.now()-start;report.films.push(result);save();
    if(report.films.length%25===0)console.log(JSON.stringify({checked:report.films.length,total:rows.length}));
  }
}));
for(const state of report.providers){const films=report.films.filter(r=>r.provider===state.provider);state.withRoutes=films.filter(r=>r.status==='routes_found').length;state.withoutRoutes=films.length-state.withRoutes;}
report.finishedAt=new Date().toISOString();save();console.log(JSON.stringify({sourceEntries:rows.length,withRoutes:report.films.filter(r=>r.status==='routes_found').length,output}));
