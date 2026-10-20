import {mergeShow} from './merge-library.js';
import {load} from 'cheerio';
import {safeRemoteFetch} from './stream-security.js';
import {artworkUrl} from '../../shared/artwork.js';

export const FRENCH_STREAM_ORIGIN='https://fs27.lol';
export const FRENCH_PROVIDERS={frenchstream:{name:'French Stream',origin:FRENCH_STREAM_ORIGIN,kind:null,collections:['french','french-originals','french-cartoons','french-entertainment']}};
const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
export function parseFrenchId(id){
  const m=/^sp:frenchstream:([ms]):([1-9]\d{0,10})$/.exec(String(id));
  if(m)return {provider:'frenchstream',type:m[1],slug:m[2]};
  const e=/^sp:frenchstream:e:([1-9]\d{0,10}):(\d{1,3}):([1-9]\d{0,4})$/.exec(String(id));
  return e?{provider:'frenchstream',type:'e',slug:e[1],season:Number(e[2]),number:Number(e[3])}:null;
}
export const frenchUrl=id=>{const p=parseFrenchId(id);return p?`${FRENCH_STREAM_ORIGIN}/index.php?newsid=${p.slug}`:null;};
const cache=new Map();
async function request(path,{fresh=false,body}={}){
  const url=new URL(path,FRENCH_STREAM_ORIGIN);if(url.origin!==FRENCH_STREAM_ORIGIN)throw Error('Invalid French source');
  const key=`${url.href}:${body||''}`;const old=cache.get(key);if(!fresh&&old&&Date.now()-old.at<120000)return old.promise;
  const promise=(async()=>{const r=await safeRemoteFetch(url.href,{timeoutMs:7000,...(body?{method:'POST',body}:{}),headers:{'User-Agent':'Mozilla/5.0',Accept:'text/html,application/json',...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{})}});if(!r.ok){await r.body?.cancel();throw Error(`French source HTTP ${r.status}`);}if(new URL(r.url).origin!==FRENCH_STREAM_ORIGIN){await r.body?.cancel();throw Error('French source origin changed');}const text=await r.text();if(/<title[^>]*>\s*(?:Just a moment|Access denied)/i.test(text))throw Error('French source verification required');return text;})();
  cache.set(key,{at:Date.now(),promise});if(cache.size>200)cache.delete(cache.keys().next().value);try{return await promise;}catch(e){cache.delete(key);throw e;}
}
function row(id,title,poster){const p=parseFrenchId(id);return {id,kind:p.type==='m'?'film':'series',title,altTitles:[],year:null,poster:poster?{custom:poster}:null,portrait:poster,collections:['french'],tags:[],documentary:false,providerMetadata:true,channelId:'frenchstream',sourceUrl:frenchUrl(id),offerings:[{provider:'frenchstream',id,kind:p.type==='m'?'film':'series',sourceUrl:frenchUrl(id)}],episodes:[],episodeCount:0};}
export function parseFrenchList(html,{kind='film',page=1,search=false}={}){
  const $=load(html),items=[];
  $('.short').each((_,node)=>{const card=$(node),link=card.find('a.short-poster').attr('href');let url;try{url=new URL(link,FRENCH_STREAM_ORIGIN);}catch{return;}const numeric=url.searchParams.get('newsid');if(url.origin!==FRENCH_STREAM_ORIGIN||!/[1-9]\d*/.test(numeric||''))return;const title=clean(card.find('.short-title').text());if(!title)return;const type=search?(/\bSaison\s*\d+/i.test(title)?'s':'m'):kind==='series'?'s':'m';const item=row(`sp:frenchstream:${type}:${numeric}`,title,artworkUrl(card.find('img').attr('src'),FRENCH_STREAM_ORIGIN));if(!parseFrenchId(item.id))return;item.synopsis=clean(card.find('[id^="desc-"]').text());items.push(item);});
  if(!items.length&&!/aucun|pas de résultat|recherche.*trop courte/i.test($('body').text()))throw Error('French source listing format changed');
  const pages=$('a[href*="cstart="],.navigation a[href],.pagination a[href]').toArray().map(a=>Number(/\/page\/(\d+)/.exec($(a).attr('href'))?.[1])||Number(new URL($(a).attr('href'),FRENCH_STREAM_ORIGIN).searchParams.get('search_start'))||Number(new URL($(a).attr('href'),FRENCH_STREAM_ORIGIN).searchParams.get('cstart'))||1);
  const totalPages=Math.max(page,...pages);return {items,page,totalPages,hasNext:page<totalPages};
}
const languageCodes={'français':'fr','anglais':'en','arabe':'ar','japonais':'ja','espagnol':'es','coréen':'ko','chinois':'zh','turc':'tr'};
const genres={'animation':'animation','comédie':'comedy','drame':'drama','documentaire':'documentary','spectacle':'theatre','télé-réalité':'reality','téléréalité':'reality','émission':'talk','talk-show':'talk','musique':'music'};
export function parseFrenchDetails(id,html,data){
  const p=parseFrenchId(id);if(!p)throw Error('Invalid French title');const $=load(html),element=$(p.type==='m'?'#film-data':'#serie-data');if(element.attr('data-newsid')!==p.slug)throw Error('French title identity mismatch');
  const fullTitle=clean(element.attr('data-title')||$('#s-title').text()),season=Number(/\bSaison\s*(\d+)/i.exec(fullTitle)?.[1])||null;
  const item=row(id,fullTitle.replace(/\s*[-–:]?\s*Saison\s*\d+.*$/i,'').trim(),artworkUrl(element.attr('data-affiche'),FRENCH_STREAM_ORIGIN));
  const field=label=>{const node=$('.flist li,#s-list li').filter((_,el)=>clean($(el).children('span').first().text()).toLowerCase().startsWith(label)).first().clone();node.children('span').first().remove();return clean(node.text());};
  const original=field('titre original').replace(/\s*[-–:]?\s*Saison\s*\d+.*$/i,'').trim();if(original&&original!==item.title)item.altTitles.push(original);
  item.year=Number(/\b(?:19|20)\d{2}\b/.exec((field('date de sortie')||$('.facts .release').text()))?.[0])||null;
  item.originalLanguage=languageCodes[field("langue d'origine").toLowerCase()]||null;
  const plot=$($('#s-desc').length?'#s-desc':'.fdesc').first().clone();plot.find('.desc-text').remove();item.synopsis=clean(plot.text());
  item.tags=(field('genre')||$('.facts .genres').text()).split(/[,\/]/).map(g=>genres[g.trim().toLowerCase()]||g.trim().toLowerCase()).filter(Boolean);item.documentary=item.tags.includes('documentary');
  const tag=clean($('.sd-tagz').text())||data?.meta?.tagz||'',match=new RegExp(`^${p.type==='m'?'f':'s'}-([1-9]\\d*)$`).exec(tag);if(match)item.tmdbId=Number(match[1]);
  if(item.originalLanguage==='fr')item.collections.push('french-originals');if(item.tags.includes('animation'))item.collections.push('french-cartoons');if(item.tags.some(g=>['reality','talk','theatre','music'].includes(g)))item.collections.push('french-entertainment');
  item.access=element.attr('data-ispremium')==='true'||$('#serie-config').attr('data-is-premium')==='true'?'account-required':'public';
  if(p.type==='m')item.episodes=[{id,title:item.title,season:1,number:1,sourceUrl:item.sourceUrl,offerings:item.offerings}];
  else {
    const numbers=[...new Set(['vf','vostfr','vo'].flatMap(mode=>Object.keys(data?.[mode]||{}).filter(n=>/^[1-9]\d*$/.test(n)&&parseFrenchServers(`sp:frenchstream:e:${p.slug}:${season||0}:${n}`,data).length).map(Number)))].sort((a,b)=>a-b);
    item.episodes=numbers.map(number=>{const ep=`sp:frenchstream:e:${p.slug}:${season||0}:${number}`,audioLanguages=data.vf?.[number]?['fr']:[],subtitleLanguages=data.vostfr?.[number]?['fr']:[];return {id:ep,title:clean(data.info?.[number]?.title)||`Episode ${number}`,synopsis:clean(data.info?.[number]?.synopsis),season,number,sourceUrl:item.sourceUrl,audioLanguages,subtitleLanguages,offerings:[{provider:'frenchstream',id:ep,season,number,audioLanguages,subtitleLanguages}]};});
  }
  item.episodeCount=item.episodes.length;item.seasons=season?[season]:[];item.episodesComplete=true;return item;
}
export function parseFrenchSearch(html,{page=1}={}){
  const $=load(html),items=[];
  $('.search-item').each((_,node)=>{const card=$(node),path=/location\.href\s*=\s*['"](\/[^'"]+)['"]/.exec(card.attr('onclick')||'')?.[1],numeric=/^\/([1-9]\d*)-[a-z0-9-]+\.html$/.exec(path||'')?.[1];if(!numeric)return;const full=clean(card.find('.search-title').text()),year=Number(/\((\d{4})\)$/.exec(full)?.[1])||null,title=full.replace(/\s*\(\d{4}\)$/, ''),type=/\bSaison\s*\d+/i.test(title)?'s':'m';const item=row(`sp:frenchstream:${type}:${numeric}`,title,artworkUrl(card.find('img').attr('src'),FRENCH_STREAM_ORIGIN));item.year=year;items.push(item);});
  if(!items.length&&!/aucun|pas de r[\u00e9e]sultat|trop courte/i.test($.text()))throw Error('French search format changed');
  const hasNext=$('#load-more').length>0;return {items,page,hasNext,totalPages:page+(hasNext?1:0)};
}
export async function fetchFrenchPage({kind='film',page=1,search,collection}={}){
  if(search){const result=parseFrenchSearch(await request('/engine/ajax/search.php',{body:new URLSearchParams({query:search,page:String(page)}).toString()}),{page});let cursor=0;
    await Promise.all(Array.from({length:Math.min(4,result.items.length)},async()=>{while(cursor<result.items.length){const index=cursor++,row=result.items[index],p=parseFrenchId(row.id);try{const $=load(await request(frenchUrl(row.id))),type=$('#serie-data').attr('data-newsid')===p.slug?'s':$('#film-data').attr('data-newsid')===p.slug?'m':null;if(!type)throw Error('French search identity mismatch');result.items[index]=await getFrenchDetails(`sp:frenchstream:${type}:${p.slug}`,{allSeasons:false});}catch{ /* keep the source search card when details are temporarily unavailable */ }}}));return result;
  }
  const params=collection==='french-originals'?{do:'xfsearch',xfname:'lang',xf:'Fran\u00e7ais',cstart:String(page)}:{do:'cat',category:kind==='series'?'s-tv':'films',cstart:String(page)};
  const result=parseFrenchList(await request(`/index.php?${new URLSearchParams(params)}`),{kind,page,search:collection==='french-originals'});
  result.items=result.items.filter(item=>item.kind===kind);return result;
}
export function parseFrenchSeasons(data,currentId){
  if(!Array.isArray(data))throw Error('French seasons format changed');
  return [...new Set(data.filter(row=>Number.isSafeInteger(row.id)&&row.id>0&&/\bSaison\s*[1-9]\d*/i.test(row.title||'')).map(row=>`sp:frenchstream:s:${row.id}`).filter(id=>id!==currentId&&parseFrenchId(id)))];
}
export async function getFrenchDetails(id,{allSeasons=true,...options}={}){
  const p=parseFrenchId(id);if(!p||p.type==='e')throw Error('Invalid French title');
  const [html,data]=await Promise.all([request(frenchUrl(id),options),request(p.type==='m'?`/engine/ajax/film_api.php?id=${p.slug}`:`/ep-data.php?id=${p.slug}&format=js`,options).then(JSON.parse)]);
  let item=parseFrenchDetails(id,html,data);
  if(p.type==='s'&&item.tmdbId&&allSeasons){
    try{const ids=parseFrenchSeasons(JSON.parse(await request(`/engine/ajax/get_seasons.php?serie_tag=s-${item.tmdbId}&news_id=${p.slug}`,options)),id);let cursor=0;const details=[];
      await Promise.all(Array.from({length:Math.min(4,ids.length)},async()=>{while(cursor<ids.length){const next=ids[cursor++];try{const detail=await getFrenchDetails(next,{...options,allSeasons:false});if(detail.tmdbId!==item.tmdbId||detail.kind!==item.kind)throw Error('French season identity mismatch');details.push(detail);}catch{item.episodesComplete=false;}}}));
      for(const detail of details)item=mergeShow(item,detail);
    }catch{item.episodesComplete=false;}
  }
  return item;
}
const playerHosts=new Set(['fsvid.lol','vidzy.cc','vidzy.org','kokoflix.lol','trakx.lol','uqload.vc','voe.sx','doodstream.com']);
export function parseFrenchServers(id,data){
  const p=parseFrenchId(id);if(!p||p.type==='s')return [];const servers=[],seen=new Set();
  const add=(host,mode,value)=>{if(host.toLowerCase()==='premium')return;try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||!playerHosts.has(u.hostname)||seen.has(`${mode}:${u.href}`))return;seen.add(`${mode}:${u.href}`);const vf=['vf','vff','vfq'].includes(mode);servers.push({id:`frenchstream:${host}:${mode}`,provider:'frenchstream',type:'embed',name:`French Stream · ${vf?'VF':mode==='vostfr'?'VOSTFR':mode.toUpperCase()} · ${host}`,embedUrl:u.href,sandbox:null,...(vf?{audioLanguage:'fr',audioLanguages:['fr']}:{ }),...(mode==='vostfr'?{subtitleLanguages:['fr']}:{})});}catch{}};
  if(p.type==='m')for(const [host,versions] of Object.entries(data.players||{}))for(const [mode,url] of Object.entries(versions||{}))add(host,mode,url);
  else for(const mode of ['vf','vostfr','vo'])for(const [host,url] of Object.entries(data[mode]?.[p.number]||{}))add(host,mode,url);
  return servers.sort((a,b)=>Number(!a.id.startsWith('frenchstream:vidzy:'))-Number(!b.id.startsWith('frenchstream:vidzy:')));
}
export async function resolveFrenchServers(id,options={}){const p=parseFrenchId(id);if(!p||p.type==='s')return [];const parent=`sp:frenchstream:${p.type==='m'?'m':'s'}:${p.slug}`;const html=await request(frenchUrl(parent),options);const $=load(html),element=$(p.type==='m'?'#film-data':'#serie-data');if(element.attr('data-newsid')!==p.slug)throw Error('French title identity mismatch');if(p.type==='e'&&Number(/\bSaison\s*(\d+)/i.exec(element.attr('data-title')||$('#s-title').text())?.[1]||0)!==p.season)throw Error('French episode season mismatch');if(element.attr('data-ispremium')==='true'||$('#serie-config').attr('data-is-premium')==='true')throw Error('French source requires an account');const data=JSON.parse(await request(p.type==='m'?`/engine/ajax/film_api.php?id=${p.slug}`:`/ep-data.php?id=${p.slug}&format=js`,options));return parseFrenchServers(id,data);}
