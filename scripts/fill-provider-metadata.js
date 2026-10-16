import {getSpecialistDetails,parseSpecialistId} from '../server/src/specialist-providers.js';
import {getFmoviesDetails,searchFmovies} from '../server/src/fmovies.js';
import {readJson,writeJson} from '../server/src/store.js';
import {mergeShow,mergeLibrary} from '../server/src/merge-library.js';
import {artworkUrl} from '../shared/artwork.js';
const args=process.argv.slice(2),index=args.indexOf('--limit'),limit=Number(index<0?180:args[index+1]);
const providerIndex=args.indexOf('--provider'),provider=providerIndex<0?null:args[providerIndex+1];
if(provider&&!/^(hdtoday|fmovies|[a-z]+)$/.test(provider))throw new Error('Invalid provider');
if(!Number.isInteger(limit)||limit<1||limit>2000)throw new Error('Invalid metadata limit');
const cache=readJson('providers-flixer.json',{}),items=new Map((cache.items||[]).map(row=>[row.id,row]));
const arabic=/^sp:(?:cimatn|tuniflix|streamtunisie|kirmalk|ahwaktv|egydead|cinetimes):/;
const rows=[...items.values()].filter(row=>(!provider||row.id.startsWith(provider==='hdtoday'?'hd:':provider==='fmovies'?'fm:':`sp:${provider}:`))&&(parseSpecialistId(row.id)||/^(fm|hd):/.test(row.id))&&(!row.synopsis?.trim()||/^hd:/.test(row.id)&&!row.tmdbId||!artworkUrl(row.portrait)&&!artworkUrl(row.poster?.custom))&&Date.now()-Date.parse(row.metadataCheckedAt||0)>24*3600000)
  .sort((a,b)=>Number(arabic.test(b.id))-Number(arabic.test(a.id))).slice(0,limit);
let enriched=0,failed=0;
for(let offset=0;offset<rows.length;offset+=4){
  const results=await Promise.allSettled(rows.slice(offset,offset+4).map(async row=>{
    let fresh=row;
    try{fresh=parseSpecialistId(row.id)?await getSpecialistDetails(row.id):/^fm:/.test(row.id)?await getFmoviesDetails(row,{allSeasons:false}):row;}catch{}
    let result=mergeShow(row,fresh);
    if((!result.synopsis?.trim()||/^hd:/.test(row.id)&&!result.tmdbId||!artworkUrl(result.portrait)&&!artworkUrl(result.poster?.custom))&&/^(fm|hd):/.test(row.id)){
      try{const candidates=await searchFmovies(row.title);for(const candidate of candidates.filter(c=>c.kind===row.kind)){
        const verified=mergeLibrary({shows:[result],tags:[],channels:[]},[candidate],{product:'flixer'});
        if(verified.report.aliases[candidate.id]===row.id){result=verified.catalog.shows[0];break;}
      }}catch{}
    }
    return {...result,metadataVersion:fresh.metadataVersion||row.metadataVersion,metadataCheckedAt:new Date().toISOString()};
  }));
  results.forEach((result,index)=>{if(result.status==='fulfilled'){items.set(result.value.id,result.value);enriched++;}else{failed++;const row=rows[offset+index];items.set(row.id,{...row,metadataCheckedAt:new Date().toISOString()});}});
  if(offset%20===0){cache.items=[...items.values()];writeJson('providers-flixer.json',cache);console.log(`Source metadata: ${enriched} checked, ${failed} unavailable`);}
}
cache.items=[...items.values()];writeJson('providers-flixer.json',cache);console.log(`Source metadata completed: ${enriched} checked, ${failed} unavailable`);
