import {fetchArabicPage,getArabicDetails,resolveArabicServers} from '../server/src/arabic-providers.js';
import {readJson,writeJson} from '../server/src/store.js';
import {mergeShow} from '../server/src/merge-library.js';
const cache=readJson('providers-flixer.json',{items:[],queue:[],completed:false}),items=new Map(cache.items.map(row=>[row.id,row]));
const jobs=[
  ['tuniflix','film','tunisian',3],['tuniflix','series','tunisian',1],
  ['cimatn','film','tunisian',1],['cimatn','series','tunisian',1],
  ['streamtunisie','series','tunisian',2],['streamtunisie','film','tunisian',1],
  ['kirmalk','film','plays',2],['kirmalk','series','egyptian',3],
  ['ahwaktv','film','arabic',5],['ahwaktv','series','egyptian',3],
  ['egydead','film','arabic',1],['egydead','series','arabic',6],
  ['cinetimes','film','tunisian',1],
];
const imported=new Set(),errors=[];
for(const [provider,kind,collection,limit] of jobs){
  let count=0;
  for(let page=1;page<=limit;page++){
    try{const result=await fetchArabicPage({provider,kind,collection,page});
      for(const row of result.items){const old=items.get(row.id);items.set(row.id,{...(old?mergeShow(old,row):row),firstSeenAt:old?.firstSeenAt||new Date().toISOString(),providerUpdatedAt:row.providerUpdatedAt||old?.providerUpdatedAt||new Date().toISOString()});imported.add(row.id);count++;}
      if(!result.hasNext)break;
    }catch(e){errors.push({provider,error:e.message});console.log(`${provider}: ${e.message}`);break;}
    await new Promise(resolve=>setTimeout(resolve,300));
  }
  cache.items=[...items.values()];writeJson('providers-flixer.json',cache);
  console.log(`${provider} ${kind}/${collection}: ${count} source entries`);
}
const detailIds=[...imported].sort((a,b)=>Number(b.includes(':s:'))-Number(a.includes(':s:')));
let hydrated=0,players=0;
for(const id of detailIds.slice(0,180)){
  try{const detail=await getArabicDetails(id),old=items.get(id),item=old?mergeShow(old,detail):detail;
    item.detailsFetchedAt=new Date().toISOString();
    // Preserve all explicit choices for short series; sample player metadata for
    // longer series. Remaining episodes resolve their own source page on demand.
    const candidates=item.episodes.length<=20?item.episodes:item.episodes.slice(0,2);
    for(let offset=0;offset<candidates.length;offset+=4){
      const results=await Promise.allSettled(candidates.slice(offset,offset+4).map(e=>resolveArabicServers(e.id)));
      results.forEach((result,index)=>{if(result.status==='fulfilled'&&result.value.length){candidates[offset+index].cachedPlayers=result.value;players+=result.value.length;}});
    }
    items.set(id,item);hydrated++;
  }catch(e){errors.push({id,error:e.message});}
  if(hydrated%10===0){cache.items=[...items.values()];writeJson('providers-flixer.json',cache);console.log(`Arabic details: ${hydrated}; ${players} player choices cached`);}
}
cache.items=[...items.values()];writeJson('providers-flixer.json',cache);
console.log(JSON.stringify({imported:imported.size,hydrated,players,errors}));
