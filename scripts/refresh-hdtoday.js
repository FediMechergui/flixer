// Run where HDToday permits ordinary catalogue requests; no browser challenges,
// proxies or access-control workarounds. Hosted refresh imports this metadata.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { fetchHdtodayPage } from '../server/src/hdtoday.js';
import { mergeShow } from '../server/src/merge-library.js';
import { validateHdtodayFeed } from '../server/src/hdtoday-feed.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=path.join(root,'server/data/hdtoday-feed.json');
const seeds=[{kind:'film',page:1},{kind:'series',page:1}];
const args=process.argv.slice(2),i=args.indexOf('--pages');
const budget=Number(i<0?12:args[i+1]);
if(!Number.isInteger(budget)||budget<1||budget>500)throw new Error('Invalid page budget');
let previous;try{previous=JSON.parse(fs.readFileSync(file,'utf8'));}catch{}
const valid=validateHdtodayFeed(previous,{maxAgeMs:Infinity});
const items=new Map((valid?.items||[]).map(row=>[row.id,row]));
const queue=valid?.queue?.length?valid.queue.filter(j=>['film','series'].includes(j.kind)&&Number.isSafeInteger(j.page)&&j.page>0):seeds.map(j=>({...j}));
const put=rows=>{for(const row of rows){const old=items.get(row.id),at=new Date().toISOString();items.set(row.id,{...(old?mergeShow(old,row):row),firstSeenAt:old?.firstSeenAt||at,providerUpdatedAt:row.providerUpdatedAt||old?.providerUpdatedAt||at});}};
// Every run sees current releases, independently of historical pagination.
for(const job of [...seeds,{kind:'series',page:1,latest:true}])put((await fetchHdtodayPage(job)).items);
for(let scanned=0;queue.length&&scanned<budget;scanned++){
  const job=queue.shift(),result=await fetchHdtodayPage(job);put(result.items);
  if(result.hasNext)queue.push({...job,page:job.page+1});
  await new Promise(resolve=>setTimeout(resolve,500));
}
const feed={version:1,provider:'hdtoday',updatedAt:new Date().toISOString(),items:[...items.values()],queue,complete:queue.length===0};
if(!validateHdtodayFeed(feed))throw new Error('Invalid HDToday snapshot; previous file retained');
fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(feed));
console.log(`HDToday snapshot: ${feed.items.length} titles, ${queue.length} historical cursors remaining`);
if(args.includes('--publish')){
  const exe=process.platform==='win32'?'gh.exe':'gh',repo='FediMechergui/flixer',tag='provider-hdtoday';
  const gh=(parts,stdio='inherit')=>spawnSync(exe,[...parts,'--repo',repo],{cwd:root,stdio});
  if(gh(['release','view',tag],'ignore').status!==0 && gh(['release','create',tag,'--title','HDToday catalogue feed','--notes','Incremental public catalogue metadata. No media files or credentials.','--latest=false']).status!==0)process.exit(1);
  if(gh(['release','upload',tag,file,'--clobber']).status!==0)process.exit(1);
  console.log('HDToday feed published. The hosted catalogue refresh will import it.');
}
