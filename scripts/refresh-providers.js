import { refreshProviders, mergeCachedProviders, saveMergeReport } from '../server/src/provider-sync.js';
import { readJson, writeJson } from '../server/src/store.js';
import { writeCatalog } from '../server/src/export-catalog.js';
import { resolveProviderMatches } from '../server/src/provider-matches.js';
import { enrichServices } from '../server/src/service-metadata.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {spawnSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const option=(name,fallback)=>{const i=args.indexOf(name);return i>=0?args[i+1]:fallback;};
const requested=option('--product',process.env.APP_PRODUCT||'flixer');
if(!['both','dahsha','flixer'].includes(requested))throw new Error('Invalid product');
const phase=option('--phase',null);
if(phase&&!['collect','merge'].includes(phase))throw new Error('Invalid refresh phase');
// Collector HTTP/parser caches and the complete provider archive must be gone
// before loading the canonical catalogue. Child processes give that guarantee
// without depending on GC timing or increasing the runner's memory allowance.
if(!phase){
  for(const step of ['collect','merge']){
    const result=spawnSync(process.execPath,[...process.execArgv,fileURLToPath(import.meta.url),...args,'--phase',step],{stdio:'inherit',env:process.env,windowsHide:true});
    if(result.error)throw result.error;
    if(result.status!==0)process.exit(result.status||1);
  }
  process.exit(0);
}
for(const product of requested==='both'?['dahsha','flixer']:[requested]){
  if(phase==='collect'){await refreshProviders({product,full:args.includes('--full'),latestOnly:args.includes('--latest-only'),pageBudget:Number(option('--pages','24'))});continue;}
  const out=path.join(root,'client/public',product==='dahsha'?'data':'data-flixer');
  const file=path.join(out,'catalog.json');
  let base=readJson(product==='dahsha'?'catalog.json':'flixer-catalog.json',null);
  const savedBase=Boolean(base);
  if(!base && fs.existsSync(file))base=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!base?.shows?.length)throw new Error(`Export the existing ${product} catalogue first`);
  console.log(`[${product}] merging provider records into ${base.shows.length} saved titles`);
  // Use existing full records where possible; never overwrite details with a lean list.
  if(product==='flixer' && !savedBase){
    const dir=path.join(out,'shows');
    base.shows=base.shows.map(show=>{try{return {...show,...JSON.parse(fs.readFileSync(path.join(dir,`${encodeURIComponent(show.id)}.json`),'utf8'))};}catch{return show;}});
  }
  await resolveProviderMatches(base,product,{limit:Number(option('--matches','150')),stream:true});
  const merged=mergeCachedProviders(base,product,{stream:true,consume:true});saveMergeReport(product,merged.report);
  // The merge owns the catalogue, and source rows were consumed from disk.
  // Static export projects each title in turn rather than cloning all guides.
  base=null;
  const services=await enrichServices(merged.catalog,{limit:Number(option('--services','100'))});
  console.log(`[${product}] ${services} series received verified network/service metadata`);
  writeJson(product==='dahsha'?'catalog.json':'flixer-catalog.json',merged.catalog);
  writeCatalog(out,merged.catalog,product,{titleFiles:process.env.FLIXER_PACKED_EXPORT!=='1'||product!=='flixer'});
  console.log(`[${product}] ${merged.report.matched} provider titles matched; ${merged.report.added} added; ${merged.report.pending.length} uncertain versions grouped; complete=${merged.catalog.providerSync.completed}`);
}
