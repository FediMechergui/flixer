// Android's ordinary anonymous guest requests. Catalogue parsing and metadata
// decoding are the same pure modules used by the backend. No account material,
// proxy, remote script execution, or video transfer through Flixer's backend.
import {decodeCarateenResponse} from './carateen-format.js';
import {CARATEEN_ORIGIN,CARATEEN_PROVIDERS,parseCarateenId,parseCarateenCatalogue,parseCarateenGuide,parseCarateenRecent,carateenMatchesSearch,carateenMediaUrl} from './carateen-source.js';

const MAX_BODY=8*1024*1024,CATALOGUE_TTL=600000,GUIDE_TTL=120000,OPERATION_BUDGET=25000;
const unique=rows=>[...new Map(rows.map(row=>[row.id,row])).values()];
const cancelled=()=>Object.assign(Error('Carateen request cancelled'),{name:'AbortError'});
export function carateenNativeRequestUrl(path,method='GET',body){
  const u=new URL(path,CARATEEN_ORIGIN),digits=value=>/^[1-9]\d{0,11}$/.test(String(value));
  if(u.origin!==CARATEEN_ORIGIN||u.username||u.password||u.port||u.hash||!['GET','POST'].includes(method))throw Error('Invalid Carateen API destination');
  if(method==='POST'){
    if(u.pathname!=='/api/sp/episode/link'||u.search||!body||!digits(body.episodeId)||body.userId!==null||Object.keys(body).length!==2)throw Error('Invalid Carateen guest player request');
  }else if(body!==undefined)throw Error('Invalid Carateen GET body');
  else if(['/api/tvshows','/api/sp/tvshows','/api/sp/recentEpisodes'].includes(u.pathname)){
    if(u.search)throw Error('Invalid Carateen catalogue request');
  }else if(['/api/episodes','/api/sp/episodes'].includes(u.pathname)){
    if([...u.searchParams].length!==1||!digits(u.searchParams.get('id')))throw Error('Invalid Carateen guide request');
  }else if(u.pathname==='/api/episode'){
    if([...u.searchParams].length!==2||!digits(u.searchParams.get('episodeId'))||!digits(u.searchParams.get('showId')))throw Error('Invalid Carateen player request');
  }else throw Error('Invalid Carateen API route');
  return u;
}

export function createNativeCarateenSource({http,agent=()=> 'Mozilla/5.0',now=Date.now}={}){
  const cache=new Map(),savedDetails=new Map(),sections=new Map();let deniedUntil=0,catalogueCache=null,cataloguePending=null,recentSaved=null;
  function check(signal,deadline){if(signal?.aborted)throw cancelled();if(deadline<=now())throw Error('Carateen request time budget reached');}
  function bounded(promise,deadline,signal){
    check(signal,deadline);let timer,onAbort;
    const wait=new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(Error('Carateen request time budget reached')),Math.max(1,deadline-now()));onAbort=()=>reject(cancelled());signal?.addEventListener('abort',onAbort,{once:true});Promise.resolve(promise).then(resolve,reject);});
    return wait.finally(()=>{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);});
  }
  function prune(){let bytes=[...cache.values()].reduce((sum,entry)=>sum+(entry.bytes||0),0);for(const [key,entry]of cache){if(cache.size<=48&&bytes<=20*1024*1024)break;if(entry.promise)continue;cache.delete(key);bytes-=entry.bytes||0;}}
  function saveDetails(id,item){const bytes=JSON.stringify(item).length*2;if(bytes>4*1024*1024)return; savedDetails.delete(id);savedDetails.set(id,{at:now(),item,bytes});let total=[...savedDetails.values()].reduce((sum,row)=>sum+row.bytes,0);while(savedDetails.size>16||total>8*1024*1024){const key=savedDetails.keys().next().value;total-=savedDetails.get(key).bytes;savedDetails.delete(key);}}
  async function read(path,{fresh=false,method='GET',body,deadline=now()+OPERATION_BUDGET,signal}={}){
    check(signal,deadline);const transport=http?.();if(!transport?.request)throw Error('Native Carateen requests unavailable');
    const u=carateenNativeRequestUrl(path,method,body),player=u.pathname==='/api/episode'||method==='POST',key=u.href+'|'+(body?JSON.stringify(body):''),old=cache.get(key),ttl=['/api/tvshows','/api/sp/tvshows'].includes(u.pathname)?CATALOGUE_TTL:GUIDE_TTL;
    if(old?.promise)return bounded(old.promise,deadline,signal);
    if(!player&&!fresh&&old?.value!==undefined&&now()-old.at<ttl)return old.value;
    if(now()<deniedUntil)throw Error('Carateen source HTTP 403; cached data retained, retry later');
    if(old?.error&&now()<old.errorUntil)throw old.error;
    // Native connect and read limits cover different phases; readTimeout is
    // inactivity, not the complete encrypted body plus WebView bridge transfer.
    // A subscriber still has its aggregate deadline. A shared response arriving
    // shortly after that subscriber leaves can populate the bounded cache.
    const remaining=Math.max(1,deadline-now()),connectTimeout=Math.min(8000,remaining),readTimeout=Math.min(15000,remaining),entry=old||{},requestDeadline=now()+Math.min(OPERATION_BUDGET,connectTimeout+readTimeout+2000);
    const promise=(async()=>{
      const userAgent=String(agent()||'Mozilla/5.0').slice(0,1024).replace(/[\r\n]/g,''),headers={Accept:'application/json','User-Agent':userAgent,Referer:CARATEEN_ORIGIN+'/',Origin:CARATEEN_ORIGIN,'X-Carateen-Client':'web-frontend-v1',...(body?{'Content-Type':'application/json'}:{})};
      const response=await bounded(transport.request({url:u.href,method,headers,...(body?{data:body}:{}),responseType:'text',disableRedirects:true,connectTimeout,readTimeout}),requestDeadline);
      if(response.status===403&&!player||response.status===429)deniedUntil=now()+300000;
      if(response.status!==200)throw Error('Carateen source HTTP '+response.status);
      if(response.url&&response.url!==u.href)throw Error('Carateen source destination changed');
      let input=response.data,size;
      if(typeof input==='string'){size=input.length;if(size>MAX_BODY)throw Error('Carateen source response too large or invalid');try{input=JSON.parse(input);}catch{throw Error('Carateen response is not public JSON');}}
      else if(input&&typeof input==='object'){
        // Capacitor already parses application/json, even for responseType text.
        // Avoid serializing/parsing the multi-megabyte envelope a second time.
        size=typeof input.iv==='string'&&typeof input.encryptedData==='string'&&Object.keys(input).length===2?input.iv.length+input.encryptedData.length+30:JSON.stringify(input).length;
      }else throw Error('Carateen source response too large or invalid');
      if(size>MAX_BODY)throw Error('Carateen source response too large or invalid');
      const value=await bounded(decodeCarateenResponse(input),requestDeadline);
      if(value.requireAuth||value.requiresAuth||value.success===false||value.error)throw Error('Carateen source access or sign-in required');
      entry.value=value;entry.bytes=size*2;entry.at=now();delete entry.error;return value;
    })();entry.promise=promise;cache.set(key,entry);prune();
    // Subscriber cancellation stops that caller only: a concurrently shared
    // catalogue request may still finish and populate the bounded cache.
    promise.then(()=>{entry.promise=null;if(player)cache.delete(key);prune();},error=>{entry.promise=null;entry.error=error;entry.errorUntil=now()+15000;prune();});
    return bounded(promise,deadline,signal);
  }
  async function catalogue({fresh=false,deadline=now()+OPERATION_BUDGET,signal}={}){
    check(signal,deadline);
    if(cataloguePending)return bounded(cataloguePending,deadline,signal);
    if(!fresh&&catalogueCache&&now()-catalogueCache.at<(catalogueCache.value.partial?15000:CATALOGUE_TTL))return catalogueCache.value;
    const promise=(async()=>{
      const results=await Promise.allSettled(['tg','sp'].map(async section=>{
        const parsed=parseCarateenCatalogue(await read(section==='tg'?'/api/tvshows':'/api/sp/tvshows',{fresh,deadline}),section);
        if(!parsed.items.length)throw Error('Empty Carateen catalogue section; cached data retained');
        if(parsed.partial){const old=sections.get(section)||[];parsed.items=unique([...old,...parsed.items]);}sections.set(section,parsed.items);return parsed;
      }));
      const errors=results.flatMap(result=>result.status==='rejected'?[{provider:'carateen',error:result.reason.message}]:result.value.providerErrors||[]);
      const items=['tg','sp'].flatMap(section=>sections.get(section)||[]);if(!items.length&&errors.length)throw Error(errors.map(row=>row.error).join('; '));
      const value={items,...(errors.length?{partial:true,providerErrors:errors}:{})};catalogueCache={at:now(),value};return value;
    })();cataloguePending=promise;promise.then(()=>{cataloguePending=null;},()=>{cataloguePending=null;});return bounded(promise,deadline,signal);
  }
  async function page({kind='series',page=1,collection='',latest=false,search='',fresh=false,signal}={}){
    if(!Number.isInteger(page)||page<1||page>2500||!['film','series'].includes(kind)||collection&&!CARATEEN_PROVIDERS.carateen.collections.includes(collection))throw Error('Invalid Carateen catalogue page');
    if(typeof search!=='string'||search.length>200)throw Error('Invalid Carateen search query');
    const deadline=now()+OPERATION_BUDGET;check(signal,deadline);const titles=await catalogue({fresh,deadline,signal});let result=titles;
    if(latest&&!search&&kind==='series'){
      try{const recent=parseCarateenRecent(await read('/api/sp/recentEpisodes',{fresh,deadline,signal}),titles.items);recentSaved=recent;result={...recent,...((titles.partial||recent.partial)?{partial:true,providerErrors:[...(titles.providerErrors||[]),...(recent.providerErrors||[])]}:{})};}
      catch(error){if(signal?.aborted)throw cancelled();if(!recentSaved)throw error;result={...recentSaved,partial:true,providerErrors:[{provider:'carateen',error:error.message}]};}
    }
    check(signal,deadline);const items=result.items.filter(row=>(search||row.kind===kind)&&(!collection||row.collections.includes(collection))&&(!search||carateenMatchesSearch(row,search)));
    return {...result,items:items.slice((page-1)*24,page*24),page,totalPages:Math.max(1,Math.ceil(items.length/24)),hasNext:page*24<items.length};
  }
  async function search(query,{aliases=[],signal}={}){
    const queries=[...new Set([query,...(Array.isArray(aliases)?aliases:[])].filter(value=>typeof value==='string').map(value=>value.trim().slice(0,200)).filter(Boolean))].slice(0,3);if(!queries.length)return [];
    const deadline=now()+OPERATION_BUDGET,result=await catalogue({deadline,signal});check(signal,deadline);
    return result.items.filter(row=>queries.some(term=>carateenMatchesSearch(row,term)));
  }
  async function details(id,{fresh=false,signal}={}){
    const p=parseCarateenId(id);if(!p||p.type==='e')throw Error('Invalid Carateen title');const deadline=now()+OPERATION_BUDGET;check(signal,deadline);
    const saved=savedDetails.get(id);if(!fresh&&saved&&now()-saved.at<GUIDE_TTL)return saved.item;
    try{
      const item=saved?.item||(await catalogue({deadline,signal})).items.find(row=>row.id===id);if(!item)throw Error('Carateen title not found in public catalogue');
      const guide=parseCarateenGuide(id,await read(`${p.section==='sp'?'/api/sp/episodes':'/api/episodes'}?id=${p.showId}`,{fresh,deadline,signal}));check(signal,deadline);
      if(!guide.episodes.length)throw Error('Carateen source has no episode entries');
      const incoming=guide.episodes.map(episode=>({...episode,...Object.fromEntries(['audioLanguages','subtitleLanguages','audioModes'].filter(key=>!episode[key]&&item[key]).map(key=>[key,item[key]]))}));
      const old=p.type==='m'?(saved?.item.filmVersions||[]).filter(ep=>parseCarateenId(ep.id)?.slug===p.slug):saved?.item.episodes||[],episodes=guide.episodesComplete?incoming:unique([...old,...incoming]);
      const {episodeUpdateFeed,...metadata}=item;
      const result={...metadata,episodes:p.type==='m'?[]:episodes,episodeCount:p.type==='m'?1:episodes.length,episodesComplete:guide.episodesComplete,...(guide.providerErrors?{providerErrors:guide.providerErrors}:{}),...(p.type==='m'?{filmVersions:episodes}:{seasons:[...new Set(episodes.map(ep=>ep.season).filter(Number.isInteger))]})};
      saveDetails(id,result);return result;
    }catch(error){if(signal?.aborted)throw cancelled();if(saved)return {...saved.item,episodesComplete:false,providerErrors:[{provider:'carateen',error:error.message}]};throw error;}
  }
  async function servers(id,{fresh=false,signal}={}){
    const p=parseCarateenId(id);if(!p||p.type==='s')return [];const deadline=now()+OPERATION_BUDGET;check(signal,deadline);
    if(p.type==='m'&&savedDetails.get(id)?.item.kind!=='film'&&!(await catalogue({deadline,signal})).items.some(row=>row.id===id&&row.kind==='film'))throw Error('Carateen film identity not found in public catalogue');
    const titleId=p.type==='m'?id:`sp:carateen:s:${p.slug}`,guide=parseCarateenGuide(titleId,await read(`${p.section==='sp'?'/api/sp/episodes':'/api/episodes'}?id=${p.showId}`,{fresh,deadline,signal}));
    const selected=p.type==='m'?guide.episodes:guide.episodes.filter(ep=>ep.id===id);if(!selected.length)throw Error('Carateen episode not found in its source guide');if(selected.length>12)throw Error('Carateen film edition count is unsupported');
    const results=[];let cursor=0;
    await Promise.all(Array.from({length:Math.min(3,selected.length)},async()=>{while(cursor<selected.length){const index=cursor++,episode=selected[index];try{
      check(signal,deadline);const data=p.section==='sp'?await read('/api/sp/episode/link',{fresh:true,method:'POST',body:{episodeId:episode.sourceEpisodeId,userId:null},deadline,signal}):await read(`/api/episode?episodeId=${episode.sourceEpisodeId}&showId=${p.showId}`,{fresh:true,deadline,signal});
      if(p.section==='sp'&&data.id!=null&&String(data.id)!==String(parseCarateenId(episode.id).episodeId))throw Error('Carateen player episode identity mismatch');
      const streamUrl=carateenMediaUrl(p.section==='sp'?data.link:data.streamUrl);if(!streamUrl)throw Error('Carateen source returned no supported direct player');
      results[index]={value:{id:'carateen:'+p.slug+':'+episode.sourceEpisodeId,provider:'carateen',name:'Carateen'+(p.type==='m'&&selected.length>1?' · '+episode.title:''),type:'hls',streamUrl,rawStreamUrl:streamUrl,headers:{Referer:CARATEEN_ORIGIN+'/',Origin:CARATEEN_ORIGIN},deviceResolved:true,resolution:'carateen-public-guest',...Object.fromEntries(['audioLanguages','subtitleLanguages','audioModes'].filter(key=>episode[key]).map(key=>[key,episode[key]]))}};
    }catch(error){results[index]={error};if(signal?.aborted)break;}}}));
    check(signal,deadline);const rows=results.flatMap(result=>result?.value?[result.value]:[]);if(!rows.length)throw Error(results.map(result=>result?.error?.message).filter(Boolean).join('; ')||'Carateen direct player unavailable');return rows;
  }
  return {enabled:()=>Boolean(http?.()?.request),supports:id=>Boolean(parseCarateenId(id)),page,search,details,servers,clearCache:()=>{for(const [key,row]of cache)if(!row.promise)cache.delete(key);savedDetails.clear();sections.clear();catalogueCache=null;recentSaved=null;}};
}
