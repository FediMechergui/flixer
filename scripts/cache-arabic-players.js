import {fetchArabicPage,getArabicDetails,resolveArabicServers} from '../server/src/arabic-providers.js';
import {readJson,writeJson} from '../server/src/store.js';
import {mergeShow} from '../server/src/merge-library.js';
// Run after other import jobs: keep a single writer for the shared provider cache.
const cache=readJson('providers-flixer.json',{}),items=new Map((cache.items||[]).map(r=>[r.id,r]));
const args=process.argv.slice(2),provider=args.includes('--provider')?args[args.indexOf('--provider')+1]:null,limit=args.includes('--limit')?Number(args[args.indexOf('--limit')+1]):240;
if(provider&&!/^(tuniflix|cimatn|cinetimes|streamtunisie|ahwaktv|kirmalk|egydead)$/.test(provider)||!Number.isInteger(limit)||limit<1||limit>1000)throw Error('Invalid player cache options');
for(let page=1;!provider&&page<=3;page++){
  const result=await fetchArabicPage({provider:'ahwaktv',kind:'series',collection:'egyptian',page});
  for(const row of result.items){const old=items.get(row.id);items.set(row.id,old?mergeShow(old,row):row);}
}
const selected=[...items.values()].filter(r=>provider?r.id.startsWith(`sp:${provider}:`):/^sp:(?:tuniflix|cimatn|cinetimes|streamtunisie):m:/.test(r.id)||/^sp:(?:ahwaktv|egydead):/.test(r.id)||r.id.startsWith('sp:kirmalk:m:')).slice(0,limit);
let hydrated=0,choices=0;const errors=[];
for(let offset=0;offset<selected.length;offset+=4){
  const results=await Promise.allSettled(selected.slice(offset,offset+4).map(async row=>{
    const detail=await getArabicDetails(row.id),item=mergeShow(row,detail);item.detailsFetchedAt=new Date().toISOString();
    const episodes=item.kind==='film'?item.episodes:item.episodes.slice(0,2);
    for(const e of episodes){const fresh=await resolveArabicServers(e.id,{fresh:true});if(fresh.length){e.cachedPlayers=fresh;e.cachedPlayersAt=new Date().toISOString();}choices+=fresh.length;}
    return item;
  }));
  results.forEach((result,index)=>{if(result.status==='fulfilled'){items.set(result.value.id,result.value);hydrated++;}else errors.push({id:selected[offset+index].id,error:result.reason.message});});
  cache.items=[...items.values()];writeJson('providers-flixer.json',cache);
  console.log(`Arabic playback metadata: ${hydrated}/${selected.length} titles, ${choices} choices`);
}
console.log(JSON.stringify({hydrated,choices,errors}));
