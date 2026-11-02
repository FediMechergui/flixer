import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readJsonItems} from '../server/src/json-files.js';
import {DATA_DIR} from '../server/src/store.js';
import {parseDessinId,dessinUrl} from '../server/src/dessinanime.js';
import {validateDessinMetadata} from '../server/src/dessin-collection.js';

const repo='FediMechergui/flixer',root=path.resolve('artifacts'),limit=32*1024*1024;
const configs={seed:{workflow:'refresh.yml',name:'dessinanime-catalogue-seed',file:'dessin-catalogue-seed.json',out:'dessin-input.json'},metadata:{workflow:'dessin-browser.yml',name:'dessinanime-browser-metadata',file:'dessin-browser-metadata.json',out:'dessin-worker-metadata.json'}};
const execute=promisify(execFile);
const gh=async args=>(await execute(process.platform==='win32'?'gh.exe':'gh',args,{windowsHide:true,timeout:60000,maxBuffer:8*1024*1024})).stdout;
const api=async endpoint=>JSON.parse(await gh(['api',endpoint]));

export function trustedDessinRun(run){return run?.head_branch==='main'&&run.head_repository?.full_name===repo&&run.status==='completed'&&['workflow_dispatch','schedule'].includes(run.event)&&['success','failure','timed_out'].includes(run.conclusion)&&Number.isSafeInteger(run.id)&&run.id>0;}
export function validateDessinArtifact(report,kind){
 if(!configs[kind]||report?.format!==1||!Array.isArray(report.items)||report.items.length>20000)throw Error('Invalid DessinAnime artifact');
 const ids=new Set();
 for(const row of report.items){const p=parseDessinId(row?.id);if(!p||p.type==='e'||row.kind!==(p.type==='m'?'film':'series')||typeof row.title!=='string'||!row.title||row.sourceUrl!==dessinUrl(row.id)||ids.has(row.id))throw Error('Invalid DessinAnime seed identity');ids.add(row.id);if(kind==='metadata')validateDessinMetadata(row);}
 return report;
}
function readArtifact(file,kind){if(fs.statSync(file).size>limit)throw Error('DessinAnime artifact exceeds size limit');return validateDessinArtifact(JSON.parse(fs.readFileSync(file,'utf8')),kind);}
function save(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const text=JSON.stringify(data);if(Buffer.byteLength(text)>limit)throw Error('DessinAnime artifact exceeds size limit');fs.writeFileSync(file+'.tmp',text);fs.renameSync(file+'.tmp',file);}

export async function downloadDessinArtifact(kind){
 const config=configs[kind];if(!config)throw Error('Unknown DessinAnime artifact kind');fs.mkdirSync(root,{recursive:true});
 const runs=(await api(`repos/${repo}/actions/workflows/${config.workflow}/runs?branch=main&status=completed&per_page=10`)).workflow_runs||[];
 for(const run of runs.filter(trustedDessinRun)){
  const artifacts=(await api(`repos/${repo}/actions/runs/${run.id}/artifacts?per_page=100`)).artifacts||[];
  const artifact=artifacts.find(a=>a.name===config.name&&!a.expired&&a.size_in_bytes>0&&a.size_in_bytes<=limit);if(!artifact)continue;
  const temp=fs.mkdtempSync(path.join(root,'dessin-fetch-'));
  try{await gh(['run','download',String(run.id),'--repo',repo,'--name',config.name,'--dir',temp]);const report=readArtifact(path.join(temp,config.file),kind);save(path.join(root,config.out),report);return {run:run.id,items:report.items.length,verificationRequired:report.verificationRequired===true};}
  finally{const resolved=path.resolve(temp);if(path.dirname(resolved)!==root||!path.basename(resolved).startsWith('dessin-fetch-'))throw Error('Unexpected artifact temporary path');fs.rmSync(resolved,{recursive:true,force:true});}
 }
 return null;
}
function summarize(){
 const file=path.join(root,'dessin-browser-metadata.json');let report;
 if(fs.existsSync(file))report=readArtifact(file,'metadata');
 const state=!report?'Collector did not produce a report':report.verificationRequired?'Source verification required; saved mappings retained':report.unavailable?'Browser unavailable; saved mappings retained':'Collection completed';
 const text=`DessinAnime browser: ${state}.\n\nPages read: ${report?.pages||0}. Titles in checkpoint: ${report?.items.length||0}. Mapped episodes/films: ${report?.items.reduce((n,r)=>n+r.episodes.length,0)||0}.\n\nStandard GitHub-hosted Windows runner. Netlify remains the application backend; this job does not deploy code or relay video.\n`;
 console.log(text);if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,text);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const mode=process.argv[2];
 if(mode==='export'){
  const items=readJsonItems(path.join(DATA_DIR,'providers-flixer.json'),r=>!!parseDessinId(r.id)&&parseDessinId(r.id).type!=='e');
  const report=validateDessinArtifact({format:1,generatedAt:new Date().toISOString(),items},'seed');save(path.join(root,'dessin-catalogue-seed.json'),report);console.log('[dessin-seed]',items.length,'source titles');
 }else if(mode==='summarize')summarize();
 else if(mode==='seed'||mode==='metadata'){
  let result;try{result=await downloadDessinArtifact(mode);}catch(error){console.warn('[dessin-artifact] Download unavailable; existing mappings retained:',error.message.split('\n')[0]);}
  if(mode==='seed'&&!result){const seed=readArtifact('server/seeds/dessinanime-reviewed.json','seed');save(path.join(root,configs.seed.out),seed);result={reviewedSeed:true,items:seed.items.length};}
  console.log('[dessin-artifact]',mode,JSON.stringify(result||{available:false}));
 }else throw Error('Use export, seed, metadata or summarize');
}
