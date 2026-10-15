import {getSpecialistDetails,parseSpecialistId} from '../server/src/specialist-providers.js';
import {getFmoviesDetails} from '../server/src/fmovies.js';
import {readJson,writeJson} from '../server/src/store.js';
import {mergeShow} from '../server/src/merge-library.js';
const args=process.argv.slice(2),index=args.indexOf('--limit'),limit=Number(index<0?180:args[index+1]);
if(!Number.isInteger(limit)||limit<1||limit>2000)throw new Error('Invalid metadata limit');
const cache=readJson('providers-flixer.json',{}),items=new Map((cache.items||[]).map(row=>[row.id,row]));
const arabic=/^sp:(?:cimatn|tuniflix|streamtunisie|kirmalk|ahwaktv|egydead|cinetimes):/;
const rows=[...items.values()].filter(row=>(parseSpecialistId(row.id)||/^fm:/.test(row.id))&&(!row.synopsis?.trim()||!row.portrait&&!row.poster?.custom)&&Date.now()-Date.parse(row.metadataCheckedAt||0)>24*3600000)
  .sort((a,b)=>Number(arabic.test(b.id))-Number(arabic.test(a.id))).slice(0,limit);
let enriched=0,failed=0;
for(let offset=0;offset<rows.length;offset+=4){
  const results=await Promise.allSettled(rows.slice(offset,offset+4).map(async row=>{
    const fresh=parseSpecialistId(row.id)?await getSpecialistDetails(row.id):await getFmoviesDetails(row,{allSeasons:false});
    return {...mergeShow(row,fresh),metadataVersion:fresh.metadataVersion||row.metadataVersion,metadataCheckedAt:new Date().toISOString()};
  }));
  results.forEach((result,index)=>{if(result.status==='fulfilled'){items.set(result.value.id,result.value);enriched++;}else{failed++;const row=rows[offset+index];items.set(row.id,{...row,metadataCheckedAt:new Date().toISOString()});}});
  if(offset%20===0){cache.items=[...items.values()];writeJson('providers-flixer.json',cache);console.log(`Source metadata: ${enriched} checked, ${failed} unavailable`);}
}
cache.items=[...items.values()];writeJson('providers-flixer.json',cache);console.log(`Source metadata completed: ${enriched} checked, ${failed} unavailable`);
