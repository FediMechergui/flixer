import {fetchFmoviesPage} from '../server/src/fmovies.js';
import {readJson,writeJson} from '../server/src/store.js';
import {mergeShow} from '../server/src/merge-library.js';
const cache=readJson('providers-flixer.json',{items:[],queue:[],completed:false}),items=new Map(cache.items.map(row=>[row.id,row]));
const scopes=[['KR','series',42],['IN','film',40],['IN','series',15],['TR','series',10],['TR','film',10],['JP','series',20],['EG','film',10],['EG','series',10],['TN','film',5],['TN','series',5]];
for(const [country,kind,budget] of scopes){
  let count=0,knownTotal=Infinity;
  for(let page=1;page<=budget;page+=4){
    const results=await Promise.allSettled(Array.from({length:Math.min(4,budget-page+1)},(_,i)=>fetchFmoviesPage({country,kind,page:page+i,...(country==='JP'?{genre:'animation'}:{})})));
    let last=0;
    for(const [index,result] of results.entries()){
      if(result.status!=='fulfilled'){
        console.log(`${country}/${kind} page ${page+index}: ${result.reason.message}`);
        const retry={provider:'fmovies',country,kind,page:page+index,...(country==='JP'?{genre:'animation'}:{})};
        if(!(cache.queue||=[]).some(j=>j.provider===retry.provider&&j.country===country&&j.kind===kind&&j.page===retry.page&&j.genre===retry.genre))cache.queue.push(retry);
        cache.completed=false;continue;
      }
      last=Math.max(last,result.value.totalPages);
      if(result.value.items.length)knownTotal=Math.min(knownTotal,result.value.totalPages);
      for(const row of result.value.items){const old=items.get(row.id);items.set(row.id,{...(old?mergeShow(old,row):row),firstSeenAt:old?.firstSeenAt||new Date().toISOString()});count++;}
    }
    if(page+3>=knownTotal)break;
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  cache.items=[...items.values()];writeJson('providers-flixer.json',cache);console.log(`${country}/${kind}: ${count} entries classified`);
}
