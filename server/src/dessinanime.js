import fs from 'node:fs';
import {runtimeProviderSnapshot} from './runtime-source.js';
import {hosted} from './hosting.js';
import {load} from 'cheerio';
import {safeRemoteFetch} from './stream-security.js';
import {artworkUrl} from '../../shared/artwork.js';
import {fetchFrenchPage,getFrenchDetails} from './french-providers.js';
import {mergeShow} from './merge-library.js';
import {searchFmovies,getFmoviesDetails} from './fmovies.js';
export const DESSIN_ORIGIN='https://dessinanime.cc';
export const DESSIN_PROVIDERS={dessinanime:{name:'DessinAnime',origin:DESSIN_ORIGIN,kind:null,collections:['french','french-cartoons']}};
export function parseDessinId(id){const m=/^sp:dessinanime:([mse]):([\p{L}\p{N}][\p{L}\p{N}\p{M}\u30fb\u3001-]{0,250})(?::(\d{1,3}):([1-9]\d{0,4}))?$/u.exec(String(id));return m&&((m[1]==='e')===!!m[3])?{provider:'dessinanime',type:m[1],slug:m[2],...(m[3]?{season:Number(m[3]),number:Number(m[4])}:{})}:null;}
export const dessinUrl=id=>{const p=parseDessinId(id);return p?`${DESSIN_ORIGIN}/${p.type==='m'?'movie':'tv'}/${encodeURIComponent(p.slug)}${p.type==='e'?`/${p.season}/${p.number}`:''}`:null;};
async function request(path){const url=new URL(path,DESSIN_ORIGIN);if(url.origin!==DESSIN_ORIGIN)throw Error('Invalid DessinAnime source');const r=await safeRemoteFetch(url.href,{timeoutMs:7000,headers:{'User-Agent':'Mozilla/5.0',Accept:'application/json,text/html'}});if(!r.ok){await r.body?.cancel();throw Error(`DessinAnime HTTP ${r.status}; cached catalogue retained`);}if(new URL(r.url).origin!==DESSIN_ORIGIN){await r.body?.cancel();throw Error('DessinAnime source origin changed');}return r.text();}
export function parseDessinCatalogue(data){if(!Array.isArray(data))throw Error('DessinAnime catalogue format changed');return data.flatMap(item=>{
  const type=item.mediaType==='TV'?'s':item.mediaType==='MOVIE'?'m':null,id=`sp:dessinanime:${type}:${item.slug}`;if(!type||!parseDessinId(id)||typeof item.title!=='string'||!Number.isInteger(item.id))return [];
  const poster=artworkUrl(item.posterPath,DESSIN_ORIGIN);return [{id,title:item.title.trim(),kind:type==='s'?'series':'film',year:Number(item.releaseYear)||null,altTitles:[],poster:poster?{custom:poster}:null,portrait:poster,sourceUrl:dessinUrl(id),channelId:'dessinanime',collections:['french'],tags:[],access:'catalogue-only',providerMetadata:true,documentary:false,sourceRecordId:item.id,episodes:[],episodeCount:0,offerings:[{provider:'dessinanime',id,sourceUrl:dessinUrl(id),availability:'catalogue-only'}]}];
});}
export async function fetchDessinPage({page=1,cursor,kind='series',search,collection}={}){
  if(page>1&&!cursor)throw Error('DessinAnime requires the saved catalogue cursor');
  const params=new URLSearchParams(search?{q:search}:cursor?{cursor:String(cursor)}:{});
  if(!search&&collection==='french-cartoons'&&['film','series'].includes(kind)){params.set('mediaType',kind==='film'?'MOVIE':'TV');params.set('genreId',kind==='film'?'3':'21');}
  const data=JSON.parse(await request(`${search?'/api/search':'/api/catalogue'}?${params}`));
  const items=parseDessinCatalogue(data).filter(item=>search||!kind||item.kind===kind);
  if(!search&&collection==='french-cartoons')for(const item of items){item.tags=['animation'];item.collections.push('french-cartoons');}
  return {items,page,totalPages:data.length===36?page+1:page,hasNext:!search&&data.length===36,nextCursor:!search&&data.length===36?data.at(-1).id:null};
}
export function verifiedDessinAlias(row,candidate){const p=parseDessinId(row.id),hint=p&&Number(p.slug.split('-')[0]);return !!(p&&candidate.tmdbId===hint&&candidate.kind===row.kind&&row.year&&Number(candidate.year)===Number(row.year));}
export async function getDessinDetails(id,{fresh=false}={}){
  const p=parseDessinId(id);if(!p||p.type==='e')throw Error('Invalid DessinAnime ID');
  const saved=await dessinSnapshot(id);
  if(saved?.episodes?.length&&!fresh)return saved;
  try{return parseDessinPage(id,await request(dessinUrl(id)),saved);}catch(error){if(saved?.episodes?.length)return {...saved,providerErrors:[{provider:'dessinanime',error:error.message}]};}
  // Search is an anonymous public endpoint. Do not substitute a challenge page
  // for an episode guide or invent French players from the catalogue slug.
  const query=p.slug.replace(/^\d+-/,'').replaceAll('-',' '),data=JSON.parse(await request(`/api/search?${new URLSearchParams({q:query})}`));
  let row=parseDessinCatalogue(data).find(item=>item.id===id);if(!row)throw Error('DessinAnime title not found in public search');
  const candidates=await searchFmovies(row.title).catch(()=>[]);
  const match=candidates.find(candidate=>verifiedDessinAlias(row,candidate));
  if(match){row={...row,tmdbId:match.tmdbId,altTitles:[...new Set([match.title,...(match.altTitles||[])])].filter(title=>title!==row.title),synopsis:match.synopsis,tags:match.tags,originalLanguage:match.originalLanguage||match.lang};if(match.tags.includes('animation'))row.collections.push('french-cartoons');}
  try{const french=await fetchFrenchPage({search:row.title}),candidate=french.items.find(candidate=>verifiedDessinAlias(row,candidate)&&candidate.access==='public'&&candidate.episodes?.length);if(candidate){const detail=await getFrenchDetails(candidate.id);return mergeDessinPlayback(row,detail);}}catch{}
  if(match)try{return mergeDessinPlayback(row,await getFmoviesDetails(match));}catch{}
  return row;
}
export function mergeDessinPlayback(row,candidate){if(!verifiedDessinAlias(row,candidate)||candidate.access==='account-required'||!candidate.episodes?.length)return row;return {...mergeShow(row,candidate),access:'public'};}

// Parse the source's Next.js JSON records as data; never evaluate page scripts.
export function dessinRecords(html){
 const $=load(html);let payload='';
 $('script:not([src])').each((_,node)=>{const text=$(node).html()?.trim()||'';if(!text.startsWith('self.__next_f.push('))return;try{const value=JSON.parse(text.slice(19,-1));if(value[0]===1&&typeof value[1]==='string')payload+=value[1];}catch{}});
 const objects=[];const walk=value=>{if(!value||typeof value!=='object')return;if(!Array.isArray(value))objects.push(value);for(const child of Object.values(value))walk(child);};
 for(const line of payload.split('\n'))try{walk(JSON.parse(line.slice(line.indexOf(':')+1)));}catch{}
 return objects;
}
const embedHosts=new Set(['abysscdn.com','morencius.com']);
export function dessinPlayers(players){return (Array.isArray(players)?players:[]).filter(player=>{try{const u=new URL(player.url);return Number.isSafeInteger(player.id)&&player.id>0&&u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&embedHosts.has(u.hostname);}catch{return false;}}).map(player=>({id:player.id,name:String(player.name||'Player').slice(0,80),url:player.url,direct:player.direct===true,language:player.language==='VF'?'VF':player.language==='VOSTFR'?'VOSTFR':'MULTI'}));}
export function parseDessinPage(id,html,existing){
 const p=parseDessinId(id);if(!p)throw Error('Invalid DessinAnime ID');
 const objects=dessinRecords(html),kind=p.type==='m'?'film':'series';
 const media=objects.find(value=>value.slug===p.slug&&value.mediaType===(kind==='film'?'MOVIE':'TV')&&Number.isSafeInteger(value.tmdbId)&&value.title);
 if(!media)throw Error('DessinAnime page identity mismatch');
 const canonical=`sp:dessinanime:${kind==='film'?'m':'s'}:${p.slug}`;
 if(existing&&(existing.id!==canonical||existing.kind!==kind))throw Error('DessinAnime cached identity mismatch');
 let row={...existing,id:canonical,title:media.title,kind,tmdbId:media.tmdbId,year:media.releaseYear||existing?.year||null,sourceUrl:dessinUrl(canonical),channelId:'dessinanime',collections:[...new Set([...(existing?.collections||[]),'french'])],tags:existing?.tags||[],providerMetadata:true,documentary:false,altTitles:[...new Set([...(existing?.altTitles||[]),media.ogTitle].filter(x=>x&&x!==media.title))],synopsis:media.customOverview||media.overview||existing?.synopsis||'',portrait:artworkUrl(media.customPosterPath||media.posterPath)||existing?.portrait,poster:existing?.poster,offerings:[{provider:'dessinanime',id:canonical,sourceUrl:dessinUrl(canonical)}]};
 const episodes=[];const guide=objects.find(value=>value.slug===p.slug&&Array.isArray(value.seasons));
 for(const season of guide?.seasons||[])if(Number.isInteger(season.seasonNumber)&&season.seasonNumber>=0&&season.mediaTmdbId===media.tmdbId)for(const episode of season.episodes||[]){
  if(!Number.isInteger(episode.episodeNumber)||episode.episodeNumber<1)continue;
  const eid=`sp:dessinanime:e:${p.slug}:${season.seasonNumber}:${episode.episodeNumber}`;
  episodes.push({id:eid,title:episode.title||`Episode ${episode.episodeNumber}`,season:season.seasonNumber,number:episode.episodeNumber,durationSec:episode.runtime?episode.runtime*60:null,poster:episode.stillPath?{custom:artworkUrl(episode.stillPath)}:null,sourceUrl:dessinUrl(eid),offerings:[{provider:'dessinanime',id:eid}]});
 }
 const playback=objects.find(value=>Array.isArray(value.players)&&value.players.some(x=>x.url)&&(p.type!=='e'||value.playbackKey===`${p.season}-${p.number}`));const players=dessinPlayers(playback?.players);
 if(kind==='film'&&players.length)episodes.push({id:canonical,title:row.title,season:1,number:1,sourceUrl:row.sourceUrl,offerings:row.offerings,cachedPlayers:players});
 if(p.type==='e'){
  const context=objects.find(value=>value.context?.media?.slug===p.slug&&value.context?.season?.seasonNumber===p.season&&value.context?.episode?.episodeNumber===p.number)?.context;
  if(!context)throw Error('DessinAnime episode identity mismatch');
  const episode=episodes.find(e=>e.season===p.season&&e.number===p.number);if(!episode)throw Error('DessinAnime episode absent from source guide');episode.cachedPlayers=players;episode.audioLanguages=players.some(player=>player.language==='VF')?['fr']:[];episode.subtitleLanguages=players.some(player=>player.language==='VOSTFR')?['fr']:[];
  episode.synopsis=load(html)('meta[name="description"]').attr('content')||'';
 }
 if(media.category==='CARTOON'||media.category==='ANIME'){row.tags=[...new Set([...row.tags,'animation'])];row.collections.push('french-cartoons');}
 const mapped=episodes.filter(episode=>episode.cachedPlayers?.length);
 row={...row,access:mapped.length?'public':'catalogue-only',sourceGuide:episodes.map(({cachedPlayers,...episode})=>episode),episodes:mapped,episodeCount:mapped.length,episodesComplete:!!guide&&mapped.length===episodes.length,detailsFetchedAt:new Date().toISOString()};
 return existing?{...mergeShow(existing,row),sourceGuide:row.sourceGuide}:row;
}
let snapshotStamp='',snapshotRows=new Map();
export async function dessinSnapshot(id){
 if(hosted())return runtimeProviderSnapshot(id);
 const p=parseDessinId(id);if(!p)return null;
 const deployment=new URL('../deployment-dessinanime.json',import.meta.url),local=new URL('../data/providers-flixer.json',import.meta.url),file=fs.existsSync(deployment)?deployment:local;
 if(!fs.existsSync(file))return null;const stamp=`${file}:${fs.statSync(file).mtimeMs}`;
 if(stamp!==snapshotStamp){const data=JSON.parse(fs.readFileSync(file,'utf8'));snapshotRows=new Map((Array.isArray(data)?data:data.items||[]).filter(row=>parseDessinId(row.id)).map(row=>[row.id,row]));snapshotStamp=stamp;}
 return snapshotRows.get(`sp:dessinanime:${p.type==='m'?'m':'s'}:${p.slug}`)||null;
}
export function dessinStreamServers(player,data){
 const servers=[],seen=new Set();for(const quality of [{url:data.url,label:'Auto'},...(data.qualities||[])]){
  try{const u=new URL(quality.url);if(u.origin!=='https://relay.dessinanime.cc'||!u.pathname.startsWith('/api/stream-relay/')||u.username||u.password||seen.has(u.href)||!['mp4','hls'].includes(data.type))continue;seen.add(u.href);
   servers.push({id:`dessinanime:${player.id}:${servers.length}`,provider:'dessinanime',name:`DessinAnime - ${player.language} - ${player.name} - ${quality.label}`,type:data.type,streamUrl:u.href,...(player.language==='VF'?{audioLanguages:['fr']}:{ }),...(player.language==='VOSTFR'?{subtitleLanguages:['fr']}:{})});
  }catch{}
 }return servers;
}
export async function resolveDessinServers(id){
 const p=parseDessinId(id);if(!p||p.type==='s')return [];
 let row=await dessinSnapshot(id),episode=row?.episodes?.find(e=>e.id===id);
 if(!episode?.cachedPlayers?.length){row=parseDessinPage(id,await request(dessinUrl(id)),row);episode=row.episodes.find(e=>e.id===id);}
 const players=dessinPlayers(episode?.cachedPlayers);if(!players.length)throw Error('No verified DessinAnime players for this episode');
 return players.map(player=>player.direct?{id:`dessinanime:${player.id}`,provider:'dessinanime',name:`DessinAnime - ${player.language} - ${player.name}`,type:'dessinanime',playerId:player.id,language:player.language,...(player.language==='VF'?{audioLanguages:['fr']}:{})}:{id:`dessinanime:${player.id}`,provider:'dessinanime',name:`DessinAnime - ${player.language} - ${player.name}`,type:'embed',embedUrl:player.url,sandbox:null});
}
