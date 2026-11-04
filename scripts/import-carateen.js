// Optional one-time guest catalogue backfill on GitHub's existing refresh runner.
import fs from 'node:fs';
import path from 'node:path';
import {providerCache} from '../server/src/provider-sync.js';
import {writeJson} from '../server/src/store.js';
import {importCarateen} from '../server/src/carateen-import.js';

const args=process.argv.slice(2),option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const seconds=Number(option('--max-seconds','90')),dry=args.includes('--dry-run');
if(!Number.isInteger(seconds)||seconds<1||seconds>180)throw Error('Invalid Carateen import budget');
const cache=dry?{items:[],queue:[],completed:false}:providerCache('flixer');
const report=await importCarateen(cache,{maxMs:seconds*1000,checkpoint:async value=>{if(!dry)writeJson('providers-flixer.json',value);}});
const output=path.resolve(option('--out','artifacts/carateen-import.json'));fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({...report,dry},null,2)+'\n');
console.log('[carateen]',JSON.stringify({dry,snapshotReads:report.snapshotReads,complete:report.complete,newRecords:report.newRecords,sourceRecords:report.sourceRecords,errors:report.errors.length,elapsedMs:report.elapsedMs}));
