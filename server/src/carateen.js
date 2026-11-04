import {safeRemoteFetch} from './stream-security.js';
import {runtimeProviderSnapshot} from './runtime-source.js';
import {decodeCarateenResponse} from '../../shared/carateen-format.js';
import {CARATEEN_ORIGIN,parseCarateenId,parseCarateenCatalogue,parseCarateenGuide,parseCarateenRecent,carateenMatchesSearch,carateenMediaUrl} from '../../shared/carateen-source.js';
export {CARATEEN_ORIGIN,CARATEEN_PROVIDERS,parseCarateenId,carateenUrl,carateenIdFromUrl} from '../../shared/carateen-source.js';

const cache=new Map();let deniedUntil=0;
function endpoint(path,method,body){
  const u=new URL(path,CARATEEN_ORIGIN);if(u.origin!==CARATEEN_ORIGIN||u.username||u.password||u.port||u.hash)throw Error('Invalid Carateen API destination');
  const digits=value=>/^[1-9]\d{0,11}$/.test(String(value));
  if(method==='POST'){
    if(u.pathname!=='/api/sp/episode/link'||u.search||!body||!digits(body.episodeId)||body.userId!==null||Object.keys(body).length!==2)throw Error('Invalid Carateen guest player request');
  }else if(['/api/tvshows','/api/sp/tvshows','/api/sp/recentEpisodes'].includes(u.pathname)){
    if(u.search)throw Error('Invalid Carateen catalogue request');
  }else if(['/api/episodes','/api/sp/episodes'].includes(u.pathname)){
    if([...u.searchParams].length!==1||!digits(u.searchParams.get('id')))throw Error('Invalid Carateen guide request');
  }else if(u.pathname==='/api/episode'){
    if([...u.searchParams].length!==2||!digits(u.searchParams.get('episodeId'))||!digits(u.searchParams.get('showId')))throw Error('Invalid Carateen player request');
  }else throw Error('Invalid Carateen API route');
  return u;
}
export async function readCarateenJson(path,{fresh=false,method='GET',body,timeoutMs=10000}={}){
  if(!['GET','POST'].includes(method))throw Error('Invalid Carateen request method');
  const url=endpoint(path,method,body),player=url.pathname==='/api/episode'||method==='POST',key=url.href;
  const ttl=url.pathname.endsWith('recentEpisodes')?120000:600000,old=cache.get(key),now=Date.now();
  if(!player&&old&&(!fresh&&now-old.at<ttl||old.pending))return old.promise;
  if(now<deniedUntil)throw Error('Carateen HTTP 403; source access required, cached data retained');
  const entry={at:now,pending:true};
  entry.promise=(async()=>{
    const response=await safeRemoteFetch(url.href,{method,body:body?JSON.stringify(body):undefined,redirects:0,timeoutMs:Math.min(12000,Math.max(1,timeoutMs)),headers:{Accept:'application/json','User-Agent':'Mozilla/5.0',Referer:CARATEEN_ORIGIN+'/',Origin:CARATEEN_ORIGIN,'X-Carateen-Client':'web-frontend-v1',...(body?{'Content-Type':'application/json'}:{})}});
    if(!response.ok){await response.body?.cancel();if(response.status===403&&!player||response.status===429)deniedUntil=Date.now()+300000;throw Error(`Carateen HTTP ${response.status}; cached data retained`);}
    const reader=response.body.getReader(),parts=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>17*1024*1024)throw Error('Carateen response too large');parts.push(value);}}finally{await reader.cancel();}
    let json;try{json=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw Error('Carateen response is not public JSON');}
    const data=await decodeCarateenResponse(json);if(data.requireAuth||data.requiresAuth||data.success===false||data.error)throw Error('Carateen source access or sign-in required');return data;
  })();
  if(!player){cache.set(key,entry);if(cache.size>120)cache.delete(cache.keys().next().value);}
  try{return await entry.promise;}catch(error){if(cache.get(key)===entry)cache.delete(key);throw error;}finally{entry.pending=false;}
}
export async function getCarateenCatalogue({fresh=false,read=readCarateenJson}={}){
  const responses=await Promise.allSettled(['tg','sp'].map(async section=>parseCarateenCatalogue(await read(section==='tg'?'/api/tvshows':'/api/sp/tvshows',{fresh}),section)));
  const items=responses.flatMap(result=>result.status==='fulfilled'?result.value.items:[]),providerErrors=responses.flatMap(result=>result.status==='rejected'?[{provider:'carateen',error:result.reason.message}]:result.value.providerErrors||[]);
  if(!items.length&&providerErrors.length)throw Error(providerErrors.map(row=>row.error).join('; '));
  return {items,...(providerErrors.length?{partial:true,providerErrors}:{})};
}
export async function fetchCarateenPage({page=1,kind,collection='',search='',latest=false,fresh=false,read=readCarateenJson}={}){
  if(!Number.isInteger(page)||page<1||page>2500)throw Error('Invalid Carateen page');
  const catalogue=await getCarateenCatalogue({fresh,read});let result=catalogue;
  if(latest&&!search&&kind!=='film'){
    const recent=parseCarateenRecent(await read('/api/sp/recentEpisodes',{fresh}),catalogue.items);
    result={...recent,...((catalogue.partial||recent.partial)?{partial:true,providerErrors:[...(catalogue.providerErrors||[]),...(recent.providerErrors||[])]}:{})};
  }
  let items=result.items.filter(row=>(search||!kind||row.kind===kind)&&(!collection||row.collections.includes(collection))&&(!search||carateenMatchesSearch(row,search)));
  // Catalogue order is stable. Sorting by upstream updated_at would resurface every
  // title each time their API is read because that field is touched by the source.
  const totalPages=Math.max(1,Math.ceil(items.length/24));return {...result,items:items.slice((page-1)*24,page*24),page,totalPages,hasNext:page<totalPages};
}
export async function getCarateenDetails(id,{fresh=false,read=readCarateenJson,readSnapshot=runtimeProviderSnapshot}={}){
  const p=parseCarateenId(id);if(!p||p.type==='e')throw Error('Invalid Carateen title');
  const snapshot=await Promise.resolve(readSnapshot(id)).catch(()=>null);
  // A persisted recent-feed marker is evidence about that feed observation,
  // never evidence that a later full guide response is itself a new update.
  const saved=snapshot?(({episodeUpdateFeed,...row})=>row)(snapshot):null;
  try{
    let item=saved?.id===id?saved:null;
    if(!item)item=(await getCarateenCatalogue({fresh,read})).items.find(row=>row.id===id);
    if(!item)throw Error('Carateen title not found in public catalogue');
    const guide=parseCarateenGuide(id,await read(`${p.section==='sp'?'/api/sp/episodes':'/api/episodes'}?id=${p.showId}`,{fresh}));
    if(!guide.episodes.length)throw Error('Carateen source has no episode entries');
    const inherited=guide.episodes.map(episode=>({...episode,...Object.fromEntries(['audioLanguages','subtitleLanguages','audioModes'].filter(key=>!episode[key]&&item[key]).map(key=>[key,item[key]]))}));
    const retained=p.type==='m'?(saved?.filmVersions||[]).filter(edition=>{const owner=parseCarateenId(edition.id);return owner?.type==='e'&&owner.slug===p.slug;}):saved?.episodes||[];
    const episodes=guide.episodesComplete?inherited:[...new Map([...retained,...inherited].map(ep=>[ep.id,ep])).values()];
    if(p.type==='m')return {...item,episodes:[],episodeCount:1,filmVersions:episodes,episodesComplete:guide.episodesComplete,...(guide.providerErrors?{providerErrors:guide.providerErrors}:{})};
    return {...item,...guide,episodes,episodeCount:episodes.length,seasons:[...new Set(episodes.map(ep=>ep.season).filter(Number.isInteger))]};
  }catch(error){if(saved?.id===id&&(saved.episodes?.length||saved.filmVersions?.length))return {...saved,episodesComplete:false,providerErrors:[{provider:'carateen',error:error.message}]};throw error;}
}
export async function resolveCarateenServers(id,{read=readCarateenJson,readSnapshot=runtimeProviderSnapshot}={}){
  const p=parseCarateenId(id);if(!p||p.type==='s')return [];
  const titleId=p.type==='m'?id:`sp:carateen:s:${p.slug}`;
  if(p.type==='m'){
    const saved=await Promise.resolve(readSnapshot(id)).catch(()=>null);
    const title=saved?.id===id&&saved.kind==='film'?saved:(await getCarateenCatalogue({read})).items.find(row=>row.id===id&&row.kind==='film');
    if(!title)throw Error('Carateen film identity not found in public catalogue');
  }
  // Validate episode membership and translate the published SP slug to the
  // source's internal episode ID before asking its anonymous guest endpoint.
  const guide=parseCarateenGuide(titleId,await read(`${p.section==='sp'?'/api/sp/episodes':'/api/episodes'}?id=${p.showId}`));
  const selected=p.type==='m'?guide.episodes:guide.episodes.filter(ep=>ep.id===id);
  if(!selected.length)throw Error('Carateen episode not found in its source guide');
  if(selected.length>12)throw Error('Carateen film edition count is unsupported');
  const results=await Promise.allSettled(selected.map(async episode=>{
    const data=p.section==='sp'?await read('/api/sp/episode/link',{fresh:true,method:'POST',body:{episodeId:episode.sourceEpisodeId,userId:null}}):await read(`/api/episode?episodeId=${episode.sourceEpisodeId}&showId=${p.showId}`,{fresh:true});
    if(data?.requireAuth||data?.requiresAuth||data?.success===false||data?.error)throw Error('Carateen source access or sign-in required');
    if(p.section==='sp'&&data.id!=null&&String(data.id)!==String(parseCarateenId(episode.id).episodeId))throw Error('Carateen player episode identity mismatch');
    const streamUrl=carateenMediaUrl(p.section==='sp'?data?.link:data?.streamUrl);if(!streamUrl)throw Error('Carateen source returned no supported direct player');
    return {id:'carateen:'+p.slug+':'+episode.sourceEpisodeId,provider:'carateen',name:'Carateen'+(p.type==='m'&&selected.length>1?' · '+episode.title:''),type:'hls',streamUrl,headers:{Referer:CARATEEN_ORIGIN+'/',Origin:CARATEEN_ORIGIN},...(episode.audioLanguages?{audioLanguages:episode.audioLanguages}:{}),...(episode.subtitleLanguages?{subtitleLanguages:episode.subtitleLanguages}:{}),...(episode.audioModes?{audioModes:episode.audioModes}:{})};
  }));
  const servers=results.flatMap(result=>result.status==='fulfilled'?[result.value]:[]);if(!servers.length)throw Error(results.map(result=>result.reason?.message).filter(Boolean).join('; ')||'Carateen direct player unavailable');return servers;
}
