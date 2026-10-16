import {safeRemoteFetch} from './stream-security.js';
import {artworkUrl} from '../../shared/artwork.js';
import {searchFmovies} from './fmovies.js';
export const DESSIN_ORIGIN='https://dessinanime.cc';
export const DESSIN_PROVIDERS={dessinanime:{name:'DessinAnime',origin:DESSIN_ORIGIN,kind:null,collections:['french','french-cartoons']}};
export function parseDessinId(id){const m=/^sp:dessinanime:([ms]):([a-z0-9][a-z0-9-]{0,250})$/.exec(String(id));return m?{provider:'dessinanime',type:m[1],slug:m[2]}:null;}
export const dessinUrl=id=>{const p=parseDessinId(id);return p?`${DESSIN_ORIGIN}/${p.type==='m'?'movie':'tv'}/${p.slug}`:null;};
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
export async function getDessinDetails(id){
  const p=parseDessinId(id);if(!p)throw Error('Invalid DessinAnime ID');
  // Search is an anonymous public endpoint. Do not substitute a challenge page
  // for an episode guide or invent French players from the catalogue slug.
  const query=p.slug.replace(/^\d+-/,'').replaceAll('-',' '),data=JSON.parse(await request(`/api/search?${new URLSearchParams({q:query})}`));
  let row=parseDessinCatalogue(data).find(item=>item.id===id);if(!row)throw Error('DessinAnime title not found in public search');
  const candidates=await searchFmovies(row.title);
  const match=candidates.find(candidate=>verifiedDessinAlias(row,candidate));
  if(match){row={...row,tmdbId:match.tmdbId,altTitles:[...new Set([match.title,...(match.altTitles||[])])].filter(title=>title!==row.title),synopsis:match.synopsis,tags:match.tags,originalLanguage:match.originalLanguage||match.lang};if(match.tags.includes('animation'))row.collections.push('french-cartoons');}
  return row;
}
export async function resolveDessinServers(id){if(!parseDessinId(id))return [];throw Error('DessinAnime playback is unverified: episode pages require browser verification; catalogue and aliases are available');}
