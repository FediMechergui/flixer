import {load} from 'cheerio';
import {artworkUrl} from '../../shared/artwork.js';
import {frenchSourceRequest} from './french-source-request.js';

export const FREMBED_ORIGIN='https://frembed.uno';
export const FREMBED_PROVIDERS={frembed:{name:'Frembed',origin:FREMBED_ORIGIN,kind:null,collections:['french','french-cartoons']}};
const request=frenchSourceRequest(FREMBED_ORIGIN);
const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
export function parseFrembedId(id){
  const m=/^sp:frembed:([mse]):([1-9]\d{0,9})(?::(\d{1,3}):([1-9]\d{0,4}))?$/.exec(String(id));
  return m&&((m[1]==='e')===!!m[3])?{provider:'frembed',type:m[1],slug:m[2],...(m[3]?{season:Number(m[3]),number:Number(m[4])}:{})}:null;
}
export function frembedUrl(id){const p=parseFrembedId(id);return p?`${FREMBED_ORIGIN}/embed/${p.type==='m'?'movie':'serie'}/${p.slug}${p.type==='e'?`?sa=${p.season}&epi=${p.number}`:''}`:null;}
export function frembedIdFromUrl(value){try{const u=new URL(value);if(u.origin!==FREMBED_ORIGIN||u.username||u.password)return null;const m=/^\/(movies|tv-show)\/[^/]+\/([1-9]\d{0,9})$/.exec(u.pathname);return m?`sp:frembed:${m[1]==='movies'?'m':'s'}:${m[2]}`:null;}catch{return null;}}
function row(id,title){const p=parseFrembedId(id);return {id,title,kind:p.type==='m'?'film':'series',tmdbId:Number(p.slug),year:null,altTitles:[],tags:[],collections:['french'],documentary:false,providerMetadata:true,channelId:'frembed',sourceUrl:frembedUrl(id),offerings:[{provider:'frembed',id,sourceUrl:frembedUrl(id)}],episodes:[],episodeCount:0};}
function languages(version){const v=String(version).toUpperCase();return {...(/^(?:VF(?:_VOSTFR)?|VFF|VFQ|FRENCH)$/.test(v)?{audioLanguages:['fr']}:{ }),...(v.includes('VOSTFR')?{subtitleLanguages:['fr']}:{})};}
export function parseFrembedList(html,{kind='series',page=1,search=false}={}){
  const $=load(html),rows=new Map();
  $('a[href]:has(img)').each((_,element)=>{const a=$(element),id=frembedIdFromUrl(new URL(a.attr('href'),FREMBED_ORIGIN).href);if(!id)return;const title=clean(a.find('h3').text()||a.find('img').attr('alt'));if(!title)return;
    const item=row(id,title);if(!search&&item.kind!==kind)return;
    item.sourceUrl=new URL(a.attr('href'),FREMBED_ORIGIN).href;item.offerings[0].sourceUrl=item.sourceUrl;
    item.portrait=artworkUrl(a.find('img').attr('src'));item.poster=item.portrait?{custom:item.portrait}:null;
    item.year=Number(/\b(?:19|20)\d{2}\b/.exec(a.find('h3').next().text())?.[0])||null;
    const latest=/\bS(\d{1,3})\s*[·.]\s*E([1-9]\d{0,4})\b/.exec(a.find('span').map((_,s)=>$(s).text()).get().join(' '));if(item.kind==='series'&&latest)item.latestEpisode=`sp:frembed:e:${item.tmdbId}:${Number(latest[1])}:${Number(latest[2])}`;
    if(!search){item.tags=['animation'];item.collections.push('french-cartoons');}
    if(!rows.has(id)||a.find('h3').length)rows.set(id,item);
  });
  if(!rows.size&&!/aucun|pas de r[ée]sultat/i.test($('main').text()))throw Error('Frembed listing format changed');
  const pages=$('a[href*="page="]').toArray().map(a=>{try{const u=new URL($(a).attr('href'),FREMBED_ORIGIN);return u.origin===FREMBED_ORIGIN?Number(u.searchParams.get('page'))||1:1;}catch{return 1;}});
  const totalPages=Math.max(page,...pages);return {items:[...rows.values()],page,totalPages,hasNext:page<totalPages};
}
export async function fetchFrembedPage({kind='series',page=1,search,latest=false}={}){
  const params=new URLSearchParams(search?{query:search,page:String(page)}:{genre:'animation',page:String(page),orderBy:latest?'updated_at':'date_creation',orderDirection:'desc'});
  return parseFrembedList(await request(`/${search?'search':kind==='film'?'movies':'tv-show'}?${params}`),{kind,page,search:!!search});
}
export function parseFrembedDetails(id,data){
  const p=parseFrembedId(id);if(!p||p.type==='e')throw Error('Invalid Frembed title');
  if(data?.status!==200||!Array.isArray(data.result?.items))throw Error('Frembed API format changed');
  const records=data.result.items;
  if(!records.length)return null;
  const item=row(id,clean(records[0].title));if(!item.title)throw Error('Frembed missing title');
  const seen=new Set();
  for(const source of records){
    if(String(source.tmdb)!==p.slug)throw Error('Frembed title identity mismatch');
    const season=p.type==='m'?1:source.sa,number=p.type==='m'?1:source.epi;
    if(!Number.isInteger(season)||season<0||season>999||!Number.isInteger(number)||number<1||number>99999)throw Error('Invalid Frembed episode coordinates');
    const eid=p.type==='m'?id:`sp:frembed:e:${p.slug}:${season}:${number}`;
    // A successful API response alone is insufficient: bind its player to this exact work/episode.
    if(source.link!==frembedUrl(eid))throw Error('Frembed player identity mismatch');
    const lang=languages(source.version);
    if(!seen.has(eid)){seen.add(eid);item.episodes.push({id:eid,title:p.type==='m'?item.title:`Episode ${number}`,season,number,sourceUrl:source.link,...lang,offerings:[{provider:'frembed',id:eid,season,number,...lang}]});}
    // TV API years can describe a newly added season, not the series premiere.
    if(p.type==='m')item.year ||= Number(source.year)||null;
    item.imdbId ||= /^tt\d+$/.test(source.imdb||'')?source.imdb:undefined;
    item.portrait ||= artworkUrl(source.poster);item.audioLanguages=[...new Set([...(item.audioLanguages||[]),...(lang.audioLanguages||[])])];item.subtitleLanguages=[...new Set([...(item.subtitleLanguages||[]),...(lang.subtitleLanguages||[])])];
  }
  item.poster=item.portrait?{custom:item.portrait}:null;item.episodes.sort((a,b)=>a.season-b.season||a.number-b.number);item.episodeCount=item.episodes.length;item.seasons=[...new Set(item.episodes.map(e=>e.season))];item.episodesComplete=true;item.access='public';return item;
}
export async function getFrembedDetails(id,options={}){const p=parseFrembedId(id);if(!p||p.type==='e')throw Error('Invalid Frembed title');const result=parseFrembedDetails(id,JSON.parse(await request(`/api/public/v1/${p.type==='m'?'movies':'tv'}/${p.slug}`,options)));if(!result)throw Error('Title unavailable on Frembed');return result;}
export async function resolveFrembedServers(id,options={}){
  const p=parseFrembedId(id);if(!p||p.type==='s')return [];
  const data=JSON.parse(await request(`/api/public/v1/${p.type==='m'?'movies':'tv'}/${p.slug}${p.type==='e'?`?sa=${p.season}&epi=${p.number}`:''}`,options));
  const detail=parseFrembedDetails(`sp:frembed:${p.type==='m'?'m':'s'}:${p.slug}`,data),episode=detail?.episodes.find(e=>e.id===id);if(!episode)return [];
  return [{id:`frembed:${id}`,provider:'frembed',name:`Frembed${episode.audioLanguages?.includes('fr')?' · VF':''}${episode.subtitleLanguages?.includes('fr')?' · VOSTFR':''}`,type:'embed',embedUrl:episode.sourceUrl,sourceOrigin:FREMBED_ORIGIN,sandbox:null,audioLanguages:episode.audioLanguages,subtitleLanguages:episode.subtitleLanguages}];
}
