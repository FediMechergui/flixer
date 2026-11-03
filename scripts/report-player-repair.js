// Publish only bounded playback evidence. Never copy player URLs or raw bodies.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {classifyPlayback,nativePlaybackDiagnostics,isPreviewPlayback} from './playback-outcome.js';

const finite=value=>Number.isFinite(value)&&value>=0;
const label=value=>String(value||'').replace(/https?:\/\/[^\s"<>]+/gi,'[source URL]').replace(/\b(?:token|signature|authorization|cookie|key)\s*[=:]\s*\S+/gi,'[redacted]').replace(/[A-Za-z0-9_-]{80,}/g,'[token]').slice(0,240);
const host=value=>typeof value==='string'&&/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(value)?value:null;
const date=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(value)?value:undefined;
const sha256=value=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value)?value.toLowerCase():undefined;

export function playbackEvidence(result){
  const p=result?.proof;
  if(isPreviewPlayback(result||{}))return null;
  if(result?.playbackConfirmed!==true||!p||![p.start,p.end,p.duration].every(finite)||p.end-p.start<1||p.end<3||p.duration<120||p.end>p.duration+1)return null;
  let transport,attribution;
  if(p.invocation&&['media3','webview'].includes(p.transport)){
    transport=p.transport;attribution='invocation-tagged-clock';
  }else if(result.nativeResults?.length===1&&['openMedia','openPlayer'].includes(result.nativeResults[0].surface)){
    transport=result.nativeResults[0].surface==='openMedia'?'media3':'webview';
    attribution='single-recorded-player-invocation';
  }else if(!result.nativeResults?.length&&p.transport==='webview'){
    transport='webview';attribution='observed-document-video-clock';
  }else return null;
  return {start:p.start,end:p.end,duration:p.duration,transport,attribution,...(p.transport!==transport?{transportLabelCorrected:true}:{})};
}

function publicAttempt(result){
  const proof=playbackEvidence(result),status=isPreviewPlayback(result||{})?'preview_only':proof?'playback_confirmed':result?.playbackConfirmed?'unverified_clock_attribution':classifyPlayback({...result,playbackConfirmed:false});
  const sourceDiagnostics=nativePlaybackDiagnostics(result||{});
  const appSha256=sha256(result?.appSha256);
  return {status,testedAt:date(result?.at),appVersion:label(result?.appVersion),...(appSha256?{appSha256}:{}),...(proof?{proof}:{}),...(sourceDiagnostics.length?{sourceDiagnostics}:{}),errorCodes:[...new Set((result?.nativeResults||[]).flatMap(row=>[row.error,row.result?.error]).filter(value=>typeof value==='string'&&/^ERROR_CODE_[A-Z0-9_]+$/.test(value)))]};
}

export function summarizePlayerRepair(groups,{titleById=new Map()}={}){
  const reports=groups.map(({name,matrix,device})=>{
    const current=new Map((device.cases||[]).map(row=>[row.case,row]));
    const routes=(matrix.cases||[]).map(row=>{
      const result=current.get(row.case),previous=(device.previousAttempts||[]).filter(old=>old.case===row.case);
      return {case:row.case,provider:label(row.provider),serverProvider:label(row.serverProvider||row.provider),title:label(titleById.get(row.titleId)||row.title),kind:row.kind==='film'?'film':'series',server:label(row.name),host:host(result?.testedHost||row.host),type:label(row.type),...(result?publicAttempt(result):{status:'pending'}),...(finite(result?.ms)?{ms:result.ms}:{}),httpStatuses:[...new Set((result?.network||[]).filter(n=>['Document','Media'].includes(n.type)).map(n=>n.status).filter(n=>Number.isInteger(n)&&n>=100&&n<600))],...(previous.length?{previousAttempts:previous.map(publicAttempt)}:{})};
    });
    const outcomes={};for(const row of routes)outcomes[row.status]=(outcomes[row.status]||0)+1;
    return {name:label(name),startedAt:date(device.startedAt),finishedAt:date(device.finishedAt),complete:matrix.complete===true&&routes.every(r=>!['pending','infrastructure_error'].includes(r.status)),total:routes.length,tested:routes.filter(r=>r.status!=='pending').length,confirmed:routes.filter(r=>r.status==='playback_confirmed').length,outcomes,routes};
  });
  return {generatedAt:new Date().toISOString(),scope:'Short native playback samples of the selected routes, not every catalogue title or episode. Retries do not increase route coverage.',transportAttribution:'Legacy native progress was labelled media3 even for openPlayer. Public proof uses a single recorded openPlayer/openMedia call to correct the transport label; private observations remain unchanged. New observations use invocation-tagged clocks. Ambiguous untagged clocks are not confirmations.',total:reports.reduce((sum,r)=>sum+r.total,0),tested:reports.reduce((sum,r)=>sum+r.tested,0),confirmed:reports.reduce((sum,r)=>sum+r.confirmed,0),complete:reports.every(r=>r.complete),reports};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const directory=path.resolve(process.argv[2]||'artifacts/player-repair-2026-11-03'),out=path.resolve(process.argv[3]||'docs/player-repair-2026-11-03.json');
  const groups=['dessin','providers'].map(name=>({name,matrix:JSON.parse(fs.readFileSync(path.join(directory,name,'resolved.private.json'),'utf8')),device:JSON.parse(fs.readFileSync(path.join(directory,name,'device.private.json'),'utf8'))}));
  // The Windows audit launcher lost some non-ASCII display labels. Restore only
  // labels bound to exactly the same source ID by the captured delivery audit.
  const labelsFile=path.resolve('artifacts/provider-delivery-2026-11-03/report.json');
  const titleById=new Map(fs.existsSync(labelsFile)?JSON.parse(fs.readFileSync(labelsFile,'utf8')).results.flatMap(p=>p.samples.map(s=>[s.id,s.title])):[]);
  const report=summarizePlayerRepair(groups,{titleById});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({total:report.total,tested:report.tested,confirmed:report.confirmed,complete:report.complete}));
}
