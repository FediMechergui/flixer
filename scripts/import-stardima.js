// Run sequentially after restoring the snapshot, before the ordinary refresh.
import fs from 'node:fs';
import path from 'node:path';
import {providerCache} from '../server/src/provider-sync.js';
import {writeJson} from '../server/src/store.js';
import {importStardima} from '../server/src/stardima-import.js';

const args=process.argv.slice(2),option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const pages=Number(option('--pages','24')),seconds=Number(option('--max-seconds','720')),dry=args.includes('--dry-run');
if(!Number.isInteger(pages)||pages<1||pages>600||!Number.isInteger(seconds)||seconds<1||seconds>1800)throw Error('Invalid StarDima import budget');
const cache=dry?{items:[],queue:[],completed:false}:providerCache('flixer');
const report=await importStardima(cache,{pages,maxMs:seconds*1000,checkpoint:async value=>{if(!dry)writeJson('providers-flixer.json',value);},log:value=>console.log('[stardima]',JSON.stringify(value))});
const output=path.resolve(option('--out','artifacts/stardima-import.json'));fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({...report,dry},null,2)+'\n');
console.log('[stardima]',JSON.stringify({dry,requests:report.requests,complete:report.complete,newRecords:report.newRecords,sourceRecords:report.sourceRecords,errors:report.errors.length,elapsedMs:report.elapsedMs}));
