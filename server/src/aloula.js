import {safeRemoteFetch} from './stream-security.js';
import {matchesSearch} from '../../shared/search.js';
import {runtimeProviderSnapshot} from './runtime-source.js';
export const ALOULA_PROVIDERS={aloula:{name:'Aloula',origin:'https://aloula.sba.sa',kind:'series',collections:['arabic']}};
const API='https://aloula.faulio.com',SITE=ALOULA_PROVIDERS.aloula.origin,cache=new Map();
export function parseAloulaId(value){const m=/^sp:aloula:([se]):([1-9]\d{0,8})$/.exec(value||'');return m?{provider:'aloula',type:m[1],number:m[2],slug:m[2]}:null;}
export const aloulaUrl=id=>{const p=parseAloulaId(id);return p?SITE+'/ar/'+(p.type==='s'?'title':'episode')+'/'+p.number:null;};
export function aloulaIdFromUrl(value){try{const u=new URL(value),m=/^\/(?:ar\/|en\/)?(title|episode)\/([1-9]\d{0,8})\/?$/.exec(u.pathname);return u.origin===SITE&&!u.search&&!u.hash&&!u.username&&!u.password&&m?'sp:aloula:'+(m[1]==='title'?'s':'e')+':'+m[2]:null;}catch{return null;}}
const guest=row=>{const access=row?.item_access||row?.access;return !row?.geo_blocked&&(access==='guest'||access?.available===true&&access.access?.guest===true);};
const text=value=>String(value||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const date=value=>Number.isFinite(Number(value))&&Number(value)>0&&Number(value)<1e11?new Date(Number(value)*1000).toISOString():null;
function image(value){try{const u=new URL(value,API);return u.protocol==='https:'&&u.hostname==='aloula.faulio.com'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
export function parseAloulaProgram(p){
 if(!p||!/^\d+$/.test(String(p.id))||!guest(p)||Number(p.count_episodes)<1||p.total?.video!==undefined&&Number(p.total.video)<1)return null;
 const id='sp:aloula:s:'+p.id;if(!parseAloulaId(id))return null;
 const title=text(p.title);if(!title)return null;
 const poster=image(p.allimages?.portrait?.big||p.covers?.portrait?.big||p.allimages?.landscape?.big||p.logo),publishedAt=date(p.release_date);
 const alias=text(p.url).replace(/-\d+$/,'').replace(/-/g,' ');
 return {id,title,altTitles:alias&&alias!==title?[alias]:[],kind:'series',sourceUrl:aloulaUrl(id),channelId:'aloula',collections:['arabic'],originalLanguage:null,audioLanguages:['ar'],countries:[],tags:p.type==='program'?['talk']:['drama'],documentary:false,providerMetadata:true,access:'public',publishedAt,year:null,poster:poster?{custom:poster,backdrop:image(p.allimages?.landscape?.big||p.covers?.landscape?.big)}:null,portrait:poster,synopsis:text(p.description),episodes:[],episodeCount:Number(p.count_episodes)||0,latestEpisode:/^[1-9]\d*$/.test(String(p.lastvideos?.regular))?'sp:aloula:e:'+p.lastvideos.regular:null,offerings:[{provider:'aloula',id,sourceUrl:aloulaUrl(id)}]};
}
export function parseAloulaEpisode(v,parentId){
 if(!v||v.type!=='regular'||v.media_type&&v.media_type!=='video'||String(v.program_id)!==String(parentId)||!guest(v))return null;
 const id='sp:aloula:e:'+v.id;if(!parseAloulaId(id))return null;
 const number=Number(v.episode),season=Number(v.season_number);if(!Number.isSafeInteger(number)||number<1)return null;
 return {id,title:text(v.title)||'Episode '+number,season:Number.isSafeInteger(season)&&season>0?season:null,number,sourceUrl:aloulaUrl(id),publishedAt:date(v.published),synopsis:text(v.description),thumbs:{custom:image(v.allimages?.landscape?.big||v.image)},offerings:[{provider:'aloula',id,sourceUrl:aloulaUrl(id)}]};
}
async function json(path,{fresh=false}={}){
 const old=cache.get(path);if(!fresh&&old&&Date.now()-old.at<120000)return old.promise;
 const promise=(async()=>{const r=await safeRemoteFetch(API+path,{timeoutMs:6500,headers:{Accept:'application/json','Accept-Language':'ar'}});if(!r.ok){await r.body?.cancel();throw Error('Aloula HTTP '+r.status);}if(new URL(r.url).origin!==API){await r.body?.cancel();throw Error('Aloula origin changed');}return r.json();})();cache.set(path,{at:Date.now(),promise});if(cache.size>300)cache.delete(cache.keys().next().value);try{return await promise;}catch(e){cache.delete(path);throw e;}
}
export async function fetchAloulaPage({page=1,kind='series',search,collection='',fresh=false,latest=false}={}){
 if(kind!=='series'||collection&&!['arabic'].includes(collection))return {items:[],page,totalPages:1,hasNext:false};
 const params=new URLSearchParams({type:'programs',page:String(page),ipp:'30',sort_by:'published',sort_dir:'desc'});if(search)params.set('like',search);
 const data=await json('/api/v1/search?'+params,{fresh});if(!Array.isArray(data.list))throw Error('Aloula catalogue format changed');
 const items=data.list.map(row=>parseAloulaProgram(row.item?{...row.item,item_access:row.item_access||row.item.item_access}:row)).filter(row=>row&&(!search||matchesSearch([row.title,...row.altTitles].join(' '),search)));
 let latestError;
 if(latest&&!search)try{
  const episodes=await json('/api/v1.1/video?'+new URLSearchParams({page:'1',direction:'desc',type:'regular'}),{fresh});
  for(const block of episodes.blocks||[])for(const v of block.projects||[]){
   const ep=parseAloulaEpisode(v,v.program_id);if(!ep)continue;let row=items.find(row=>row.id==='sp:aloula:s:'+v.program_id);
   if(!row){row=parseAloulaProgram({id:v.program_id,title:v.program_title,access:v.access,count_episodes:1,allimages:v.owner_allimages,description:''});if(!row)continue;items.push(row);}
   row.episodes=[...(row.episodes||[]),ep];if(ep.publishedAt&&(!row.latestAt||ep.publishedAt>row.latestAt)){row.latestAt=ep.publishedAt;row.contentUpdatedAt=ep.publishedAt;row.latestEpisode=ep.id;}
  }
 }catch(error){latestError=error.message;}
 return {items,page,totalPages:Number(data.last_page)||page,hasNext:page<Number(data.last_page),...(latestError?{partial:true,providerErrors:[{provider:'aloula',error:latestError}]}:{}),sourceFingerprint:data.list.map(row=>row.item_id||row.id).join('|')};
}
export async function getAloulaDetails(id,{fresh=false,fetchJson=json}={}){
 const p=parseAloulaId(id);if(!p||p.type!=='s')throw Error('Invalid Aloula series');
 if(!fresh&&fetchJson===json){const saved=await runtimeProviderSnapshot(id);if(saved?.episodes?.length&&(!saved.latestEpisode||saved.episodes.some(e=>e.id===saved.latestEpisode)))return saved;}
 const blocks=await fetchJson('/api/v1/pageblocks/ott_program_details/'+p.number,{fresh}),program=blocks?.flatMap(b=>b.programsobjects||[]).find(p2=>String(p2.id)===p.number),row=parseAloulaProgram(program);if(!row)throw Error('Aloula title unavailable to guests');
 const seasons=program.seasons?.length?program.seasons:[program],episodes=new Map();let complete=true;
 for(const season of seasons){
  if(!/^\d+$/.test(String(season.id)))continue;
  for(let page=1;page<=200;page++){
   const params=new URLSearchParams({page:String(page),direction:'asc',season:String(season.id),type:'regular'});
   const data=await fetchJson('/api/v1.1/video?'+params,{fresh});if(!Array.isArray(data.blocks))throw Error('Aloula episode format changed');
   for(const block of data.blocks)for(const v of block.projects||[]){const ep=parseAloulaEpisode(v,p.number);if(ep)episodes.set(ep.id,ep);}
   const last=Math.max(1,...data.blocks.map(b=>Number(b.paging?.last_page)||1));if(page>=last)break;if(page===200)complete=false;
  }
 }
 row.episodes=[...episodes.values()].sort((a,b)=>(a.season??Infinity)-(b.season??Infinity)||a.number-b.number);row.episodeCount=row.episodes.length;row.episodesComplete=complete;
 row.latestAt=row.episodes.map(e=>e.publishedAt).filter(Boolean).sort().at(-1)||row.publishedAt;row.latestEpisode=row.episodes.at(-1)?.id;return row;
}
export function parseAloulaPlayer(data,id){
 const p=parseAloulaId(id),hls=data?.settings?.protocols?.hls;if(p?.type!=='e'||typeof hls!=='string'||data.settings.drm||data.settings.sources?.some?.(s=>s.drm))return [];
 try{const u=new URL(hls);if(u.protocol!=='https:'||u.hostname!=='clvod.itworkscdn.net'||u.username||u.password||u.port||!u.pathname.endsWith('.m3u8'))return [];return [{id:'aloula:'+p.number,provider:'aloula',name:'Aloula - HLS',type:'hls',streamUrl:u.href,headers:{Referer:SITE+'/'}}];}catch{return [];}
}
export async function resolveAloulaServers(id,{fresh=false}={}){const p=parseAloulaId(id);if(p?.type!=='e')return [];const data=await json('/api/v1/video/'+p.number,{fresh});if(!data.blocks?.some(v=>String(v.id)===p.number&&guest(v)))return [];return parseAloulaPlayer(await json('/api/v1/video/'+p.number+'/player',{fresh}),id);}
