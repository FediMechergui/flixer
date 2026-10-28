import {OFFICIAL_PROVIDERS,parseOfficialId,officialUrl,officialIdFromUrl,fetchOfficialPage,getOfficialDetails} from './youtube-originals.js';
import {ALOULA_PROVIDERS,parseAloulaId,aloulaUrl,aloulaIdFromUrl,fetchAloulaPage,getAloulaDetails,resolveAloulaServers} from './aloula.js';
import {ONEPACE_PROVIDERS,parseOnePaceId,onePaceUrl,fetchOnePacePage,getOnePaceDetails,resolveOnePaceServers} from './onepace.js';
import { load } from 'cheerio';
import {artworkUrl} from '../../shared/artwork.js';
import { safeRemoteFetch } from './stream-security.js';
import { ARABIC_PROVIDERS,parseArabicId,arabicUrl,arabicIdFromUrl,getArabicDetails,fetchArabicPage,resolveArabicServers } from './arabic-providers.js';
import {FRENCH_PROVIDERS,parseFrenchId,frenchUrl,fetchFrenchPage,getFrenchDetails,resolveFrenchServers} from './french-providers.js';
import {matchesSearch} from '../../shared/search.js';
import {DESSIN_PROVIDERS,parseDessinId,dessinUrl,fetchDessinPage,getDessinDetails,resolveDessinServers} from './dessinanime.js';
import {WCO_PROVIDERS,parseWcoId,wcoUrl,wcoIdFromUrl,getWcoDetails,fetchWcoPage,resolveWcoServers} from './wco.js';

// Public catalogue/player pages only. IDs reconstruct a fixed origin and a strict
// path; caller URLs never authorize a fetch or a player destination.
export const SPECIALISTS = {
  ...ALOULA_PROVIDERS,
  ...ARABIC_PROVIDERS,
  ...FRENCH_PROVIDERS,
  ...DESSIN_PROVIDERS,
  ...ONEPACE_PROVIDERS,
  ...OFFICIAL_PROVIDERS,
  ...WCO_PROVIDERS,
  animegg:{name:'AnimeGG',origin:'https://www.animegg.org',kind:'series',collections:['anime','anime-sub','anime-dub']},
  megacartoons:{name:'MegaCartoons',origin:'https://www.megacartoons.net',kind:'series',collections:['cartoons','classic-cartoons']},
  toontales:{name:'ToonTales',origin:'https://www.toontales.net',kind:'film',collections:['cartoons','classic-cartoons']},
  myasiantv:{name:'MyAsianTV',origin:'https://myasiantv.com.bz',kind:null,collections:['kdrama','jdrama','cdrama']},
  multimovies:{name:'MultiMovies',origin:'https://m1.multimovies.courses',aliases:['https://multimovies.garden'],kind:null,collections:['indian','kdrama','anime']},
  yoturkish:{name:'YoTurkish',origin:'https://www1.yoturkish.com',kind:'series',collections:['turkish']},
};
const slugPattern='[a-z0-9][a-z0-9_-]{0,259}';
export function parseSpecialistId(id){
  const aloula=parseAloulaId(id);if(aloula)return aloula;
  const wco=parseWcoId(id);if(wco)return wco;
  const official=parseOfficialId(id);if(official)return official;
  const pace=parseOnePaceId(id);if(pace)return pace;
  const dessin=parseDessinId(id);if(dessin)return dessin;
  const french=parseFrenchId(id);if(french)return french;
  const arabic=parseArabicId(id);if(arabic)return arabic;
  const m=new RegExp(String.raw`^sp:(animegg|megacartoons|toontales|myasiantv|multimovies|yoturkish):([sme]):(${slugPattern})(?::(\d{1,3}):([1-9]\d{0,4}))?$`).exec(String(id));
  if(!m || m[3].length>260)return null;
  if(m[1]==='toontales' && m[2]!=='m' || !['toontales','multimovies'].includes(m[1]) && m[2]==='m')return null;
  if(m[4] && (m[1]!=='multimovies'||m[2]!=='e') || m[1]==='multimovies' && m[2]==='e' && !m[4])return null;
  return {provider:m[1],type:m[2],slug:m[3],...(m[4]?{season:Number(m[4]),number:Number(m[5])}:{})};
}
export function specialistUrl(id){
  const aloula=aloulaUrl(id);if(aloula)return aloula;
  const wco=wcoUrl(id);if(wco)return wco;
  const official=officialUrl(id);if(official)return official;
  const pace=onePaceUrl(id);if(pace)return pace;
  const dessin=dessinUrl(id);if(dessin)return dessin;
  const french=frenchUrl(id);if(french)return french;
  const arabic=arabicUrl(id);if(arabic)return arabic;
  const p=parseSpecialistId(id);if(!p)return null;
  if(p.provider==='multimovies')return `${SPECIALISTS.multimovies.origin}/${p.type==='m'?'movie':'series'}/${p.slug}${p.type==='e'?`/season/${p.season}/episode/${p.number}`:''}`;
  const prefix=p.type==='s'?({animegg:'/series/',megacartoons:'/video-serie/',myasiantv:'/series/',yoturkish:'/'}[p.provider]):p.provider==='toontales'?'/short/':'/';
  if(!prefix || p.provider==='toontales' && p.type!=='m' || p.type==='m' && p.provider!=='toontales')return null;
  return `${SPECIALISTS[p.provider].origin}${prefix}${p.slug}${p.provider==='animegg'?'':'/'}`;
}
export function specialistIdFromUrl(value){
  const aloula=aloulaIdFromUrl(value);if(aloula)return aloula;
  const wco=wcoIdFromUrl(value);if(wco)return wco;
  const official=officialIdFromUrl(value);if(official)return official;
  const arabic=arabicIdFromUrl(value);if(arabic)return arabic;
  try{const u=new URL(value);for(const [provider,cfg] of Object.entries(SPECIALISTS)){
    if(ARABIC_PROVIDERS[provider]||provider==='frenchstream'||provider==='wco')continue;
    if(provider==='youtubeoriginals'){continue;}
    if(provider==='onepace'){if(u.origin===cfg.origin&&u.pathname==='/en/watch'&&!u.search&&!u.username&&!u.password){const id='sp:onepace:s:'+u.hash.slice(1);if(parseOnePaceId(id))return id;}continue;}
    if(provider==='dessinanime'){if(u.origin===cfg.origin&&!u.search&&!u.hash&&!u.username&&!u.password){const m=/^\/(movie|tv)\/([^/]+)\/?$/.exec(u.pathname);const id=m&&`sp:dessinanime:${m[1]==='movie'?'m':'s'}:${decodeURIComponent(m[2])}`;if(parseDessinId(id))return id;}continue;}
    if(u.origin!==cfg.origin&&!cfg.aliases?.includes(u.origin) || u.search || u.hash || u.username || u.password)continue;
    if(provider==='multimovies'){const m=new RegExp(`^/(movie|series)/(${slugPattern})$`).exec(u.pathname);if(m)return `sp:${provider}:${m[1]==='movie'?'m':'s'}:${m[2]}`;continue;}
    const pattern=provider==='animegg'?'/series/':provider==='megacartoons'?'/video-serie/':provider==='toontales'?'/short/':provider==='yoturkish'?'/':'/series/';
    const m=new RegExp(`^${pattern}(${slugPattern})/?$`).exec(u.pathname);
    if(m)return `sp:${provider}:${provider==='toontales'?'m':'s'}:${m[1]}`;
  }}catch{}return null;
}
const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
const unique=rows=>{const map=new Map();for(const row of rows){const old=map.get(row.id);map.set(row.id,old?{...old,...row,poster:row.poster||old.poster,portrait:row.portrait||old.portrait,thumbs:row.thumbs||old.thumbs,audioModes:[...new Set([...(old.audioModes||[]),...(row.audioModes||[])])]}:row);}return [...map.values()];};
function localUrl(value,origin){try{const u=new URL(value,origin);return u.origin===origin && !u.username && !u.password ? u : null;}catch{return null;}}
function image(value,origin){return artworkUrl(value,origin);}
const cache=new Map();
async function page(url,{ttl=120000,method='GET'}={}){
  const key=`${method}:${url}`,entry=cache.get(key);if(entry && Date.now()-entry.at<ttl)return entry.promise;
  const promise=(async()=>{
    const r=await safeRemoteFetch(url,{method,timeoutMs:6500,headers:{'User-Agent':'Mozilla/5.0',Accept:'text/html,application/json'}});
    if(!r.ok){await r.body?.cancel();throw new Error(`Specialist upstream HTTP ${r.status}`);}
    if(new URL(r.url).origin!==new URL(url).origin){await r.body?.cancel();throw new Error('Specialist origin changed');}
    const html=await r.text();
    if(!html.trim() || /<title[^>]*>\s*(?:Just a moment|Access denied)/i.test(html))throw new Error('Specialist catalogue unavailable');
    return html;
  })();
  cache.set(key,{at:Date.now(),promise});if(cache.size>250)cache.delete(cache.keys().next().value);
  try{return await promise;}catch(e){cache.delete(key);throw e;}
}
function row(provider,type,slug,title,poster){
  const id=`sp:${provider}:${type}:${slug}`,sourceUrl=specialistUrl(id);
  const originalTitle=clean(title),year=Number(/\s*\((\d{4})\)$/.exec(originalTitle)?.[1])||null;
  const collections=provider==='animegg'?['anime']:['myasiantv','multimovies','yoturkish'].includes(provider)?[]:['cartoons'];
  const tags=provider==='animegg'?['animation','anime']:['myasiantv','yoturkish'].includes(provider)?['drama']:provider==='multimovies'?[]:['animation','cartoons'];
  return {id,title:year?originalTitle.replace(/\s*\(\d{4}\)$/,''):originalTitle,kind:type==='m'?'film':'series',sourceUrl,year,tags,collections,documentary:false,
    poster:poster?{custom:poster}:null,portrait:poster||null,channelId:provider,providerMetadata:true,episodes:[],episodeCount:0,
    offerings:[{provider,id,kind:type==='m'?'film':'series',sourceUrl}],altTitles:year?[originalTitle]:[]};
}
function pagination($,url,count){
  const parsed=new URL(url),current=Number(/\/page\/(\d+)/.exec(parsed.pathname)?.[1]||parsed.searchParams.get('page')||1);
  const pages=$('a[href]').toArray().map(a=>{const u=localUrl($(a).attr('href'),parsed.origin);return u?Number(/\/page\/(\d+)/.exec(u.pathname)?.[1]||u.searchParams.get('page')||0):0;});
  const maxPages=Number(/"maxPages"\s*:\s*"?(\d+)/.exec($.html())?.[1])||0;
  const totalPages=Math.max(current,maxPages,...pages);
  return {page:current,totalPages,hasNext:current<totalPages,count};
}
export function parseSpecialistList(provider,html,url){
  const cfg=SPECIALISTS[provider];if(!cfg)throw new Error('Unknown specialist');
  const $=load(html),rows=[];
  if(provider==='multimovies')return parseMultiMoviesList(html,url);
  if(provider==='yoturkish'){
    $('.item a.poster[href]').each((_,a)=>{
      const u=localUrl($(a).attr('href'),cfg.origin),m=u && new RegExp(`^/(${slugPattern})/$`).exec(u.pathname);if(!m)return;
      const title=clean($(a).attr('title'));if(!title)return;
      const ep=/^(.+)-episode-(\d+)$/.exec(m[1]);
      const item=row(provider,'s',ep?ep[1]:m[1],title.replace(/\s*[–—-]\s*Episode\s+\d+$/i,''),image($(a).find('img').attr('src'),cfg.origin));
      item.countries=['TR'];item.collections=['turkish'];
      if(ep){item.episodes=[episode(provider,m[1],`Episode ${ep[2]}`,{number:Number(ep[2]),audioModes:['sub']})];item.episodeCount=1;item.latestEpisode=m[1];}
      rows.push(item);
    });
    if(!rows.length && !/nothing found|no results/i.test($('body').text()))throw new Error('YoTurkish listing format changed');
    return {items:unique(rows),...pagination($,url,rows.length)};
  }
  const pattern=provider==='animegg'?new RegExp(`^/series/(${slugPattern})/?$`):provider==='megacartoons'?new RegExp(`^/video-serie/(${slugPattern})/?$`):provider==='toontales'?new RegExp(`^/short/(${slugPattern})/?$`):new RegExp(`^/series/(${slugPattern})/?$`);
  const anchors=provider==='animegg'?$('.rightpop > a[href],.series_alpha > li > a[href]'):provider==='myasiantv'?$('.items a[href]'):$('a[href]');
  anchors.each((_,a)=>{
    const u=localUrl($(a).attr('href'),cfg.origin),m=u && pattern.exec(u.pathname);if(!m)return;
    const img=provider==='animegg'?$(a).closest('li').find('img').first():$(a).find('img').first();
    const title=clean($(a).attr('title') || img.attr('alt') || $(a).text());
    if(!title)return;
    const item=row(provider,provider==='toontales'?'m':'s',m[1],title,image(img.attr('data-src')||img.attr('src'),cfg.origin));
    // MyAsianTV uses /series/ containers for films as well; only its explicit
    // movie directory or a Full Movie entry establishes film classification.
    if(provider==='myasiantv' && new URL(url).pathname.startsWith('/movies-list/')){item.kind='film';item.kindVerified=true;item.offerings[0].kind='film';}
    rows.push(item);
  });
  if(!rows.length && !/no (?:results|posts|anime|series)|nothing found/i.test($('body').text()))throw new Error(`${cfg.name} listing format changed`);
  const result={items:unique(rows),...pagination($,url,rows.length)};
  if(provider==='animegg'){
    const total=Number(/of\s+([\d,]+)\s+Shows/i.exec($('.pagination').text())?.[1]?.replaceAll(',',''));
    const current=Math.floor(Number(new URL(url).searchParams.get('start')||0)/25)+1;
    if(Number.isFinite(total))Object.assign(result,{page:current,totalPages:Math.ceil(total/25),hasNext:current*25<total});
  }
  return result;
}
function jsonNodes($){
  return $('script[type="application/ld+json"]').toArray().flatMap(s=>{try{const n=JSON.parse($(s).html());return n['@graph']||[n];}catch{return [];}});
}
function episode(provider,slug,title,{number=null,season=null,audioModes=[],thumb=null}={}){
  const id=`sp:${provider}:e:${slug}`;
  return {id,title:clean(title),number,season,absoluteNumber:season===null?number:null,sourceUrl:specialistUrl(id),audioModes,thumbs:thumb?{custom:thumb}:null,offerings:[{provider,id,audioModes}]};
}
export function parseSpecialistDetails(id,html){
  const p=parseSpecialistId(id),url=specialistUrl(id);if(!p||!url||p.type==='e')throw new Error('Invalid specialist title');
  const cfg=SPECIALISTS[p.provider],$=load(html),nodes=jsonNodes($);
  if(p.provider==='multimovies')return parseMultiMoviesDetails(id,html);
  const meta=nodes.find(n=>n.url===url || n['@id']===url)||{};
  const title=clean($('.media-body h1').first().text() || $('h1').last().text() || meta.name?.replace(/ - MegaCartoons$/,''));
  if(!title)throw new Error(`${cfg.name} title metadata missing`);
  const titleClean=p.provider==='myasiantv'?title.replace(/\s*-\s*Myasiantv$/i,'').replace(/\s*\(\d{4}\)$/,''):title;
  const poster=image(meta.thumbnailUrl || $('meta[property="og:image"]').attr('content') || $('.media > a img').attr('src'),cfg.origin);
  const result=row(p.provider,p.type,p.slug,titleClean,poster);
  result.synopsis=clean($('.info > p,.entry-content > p,.description').first().text() || meta.description || $('meta[name="description"]').attr('content'));
  result.year=Number(/(?:Release year|Released|Year)\s*:\s*(\d{4})/i.exec($('body').text())?.[1] || /\((\d{4})\)/.exec(title)?.[1])||null;
  if(p.provider==='animegg'){
    $('a.anm_det_pop[href]').each((_,a)=>{
      const u=localUrl($(a).attr('href'),cfg.origin);if(!u)return;
      const slug=u.pathname.slice(1),m=/-episode-(\d+)/.exec(slug);
      if(!m || !new RegExp(`^${slugPattern}$`).test(slug))return;
      const links=$(a).parent().find('a[href]').toArray().map(a=>$(a).attr('href'));
      const audioModes=['sub','dub'].filter(mode=>links.some(href=>href===`${u.pathname}#${mode==='sub'?'subbed':'dubbed'}`));
      const printed=/(\d+(?:\.\d+)?)\s*$/.exec(clean($(a).find('strong').text()||$(a).text()));
      result.episodes.push(episode(p.provider,slug,clean($(a).parent().find('.anititle').text()) || `Episode ${m[1]}`,{number:Number(printed?.[1]||m[1]),audioModes}));
    });
    result.audioModes=[...new Set(result.episodes.flatMap(e=>e.audioModes))];
    result.tags=[...new Set([...result.tags,...$('.tagscat a').toArray().map(a=>clean($(a).text()).toLowerCase())])];
  }else if(p.provider==='megacartoons'){
    // These pages expose episode titles, not reliable season/episode coordinates.
    $('.video-listing-content .video-item .item-head h3 a[href]').each((_,a)=>{
      const u=localUrl($(a).attr('href'),cfg.origin),m=u && new RegExp(`^/(${slugPattern})/$`).exec(u.pathname);if(!m)return;
      const title=clean($(a).attr('title') || $(a).text());if(!title)return;
      result.episodes.push(episode(p.provider,m[1],title,{thumb:image($(a).closest('.video-item').find('img').attr('src'),cfg.origin)}));
    });
  }else if(p.provider==='myasiantv'){
    const info=clean($('strong').parent().text());
    const country=/Country:\s*(Korean|Chinese|Japanese|Taiwanese|Thai|Indian)/i.exec(info)?.[1]?.toLowerCase();
    if(country)result.countries=[{korean:'KR',chinese:'CN',japanese:'JP',taiwanese:'TW',thai:'TH',indian:'IN'}[country]];
    if(country==='korean')result.collections=['kdrama'];
    if(country==='japanese')result.collections=['jdrama'];
    if(['chinese','taiwanese'].includes(country))result.collections=['cdrama'];
    $('.list-episode a[href]').each((_,a)=>{
      const u=localUrl($(a).attr('href'),cfg.origin),m=u && new RegExp(`^/(${slugPattern})/$`).exec(u.pathname);if(!m)return;
      const label=clean($(a).text()),n=/\bEp\s*(\d+(?:\.\d+)?)/i.exec(label);
      if(/\bFull\b.*\bMovie\b/i.test(label)){
        const ep=episode(p.provider,m[1],label,{number:1,season:1,audioModes:/\bSUB\b/i.test($(a).closest('li').text())?['sub']:[]});
        result.kind='film';result.kindVerified=true;result.offerings[0].kind='film';result.episodes.push({...ep,id:result.id});return;
      }
      if(!n)return;
      const audioModes=/\bSUB\b/i.test($(a).closest('li').text())?['sub']:[];
      result.episodes.push(episode(p.provider,m[1],label,{number:Number(n[1]),audioModes}));
    });
    result.audioModes=[...new Set(result.episodes.flatMap(e=>e.audioModes))];
  }else if(p.provider==='yoturkish'){
    const info=clean($('.info').text());
    result.year=Number(/Years?:\s*(\d{4})/i.exec(info)?.[1])||null;
    if(/Country:\s*Turkey/i.test(info)){result.countries=['TR'];result.collections=['turkish'];}
    result.audioModes=['sub'];
    $('#episodes a.episod[href]').each((_,a)=>{
      const u=localUrl($(a).attr('href'),cfg.origin),m=u && new RegExp(`^/(${p.slug}-episode-(\\d+))/$`).exec(u.pathname);if(!m)return;
      // Turkish sources often continue absolute numbers across season labels.
      result.episodes.push(episode(p.provider,m[1],`Episode ${m[2]}`,{number:Number(m[2]),audioModes:['sub']}));
    });
  }else if(p.provider==='toontales'){
    result.episodes=[{id,title:result.title,number:1,season:1,sourceUrl:url,offerings:result.offerings}];
  }
  result.episodes=unique(result.episodes).sort((a,b)=>(a.number??Infinity)-(b.number??Infinity));
  result.episodeCount=result.episodes.length;
  result.episodesComplete=true;
  return {...result,...pagination($,url,result.episodeCount)};
}
export async function getSpecialistDetails(id,{fresh=false}={}){
  if(parseAloulaId(id))return getAloulaDetails(id,{fresh});
  if(parseWcoId(id))return getWcoDetails(id,{fresh});
  if(parseOfficialId(id))return getOfficialDetails(id);
  if(parseOnePaceId(id))return getOnePaceDetails(id);
  if(parseDessinId(id))return getDessinDetails(id,{fresh});
  if(parseFrenchId(id))return getFrenchDetails(id,{fresh});
  if(parseArabicId(id))return getArabicDetails(id,{fresh});
  const url=specialistUrl(id);if(!url)throw new Error('Invalid specialist ID');
  let result=parseSpecialistDetails(id,await page(url));
  if(parseSpecialistId(id).provider==='multimovies' && result.kind==='series'){
    const seasons=result.sourceSeasons.filter(season=>season!==result.currentSeason);
    const pages=await Promise.allSettled(seasons.slice(0,15).map(season=>page(`${url}?season=${season}`).then(html=>parseSpecialistDetails(id,html))));
    result.episodes=unique([...result.episodes,...pages.flatMap(r=>r.status==='fulfilled'?r.value.episodes:[])]).sort((a,b)=>a.season-b.season||a.number-b.number);
    result.episodeCount=result.episodes.length;result.episodesComplete=seasons.length<=15 && pages.every(r=>r.status==='fulfilled');
  }
  if(result.totalPages>1 && parseSpecialistId(id).provider==='megacartoons'){
    const pages=await Promise.allSettled(Array.from({length:Math.min(result.totalPages,10)-1},(_,i)=>page(`${url}page/${i+2}/`).then(html=>parseSpecialistDetails(id,html))));
    result.episodes=unique([...result.episodes,...pages.flatMap(r=>r.status==='fulfilled'?r.value.episodes:[])]);
    result.episodeCount=result.episodes.length;result.episodesComplete=result.totalPages<=10 && pages.every(r=>r.status==='fulfilled');
  }
  return result;
}
export function specialistJobs({kind,collection='',latest=false}={}){
  return Object.entries(SPECIALISTS).filter(([,cfg])=>(!kind||!cfg.kind||cfg.kind===kind)&&(!collection||cfg.collections.includes(collection)))
    .flatMap(([provider,cfg])=>(!cfg.kind&&!kind?['film','series']:[kind||cfg.kind]).map(kind=>({provider,kind,page:1,latest,collection})));
}
export async function fetchSpecialistPage({provider,page:pageNum=1,cursor,search,latest=false,kind='series',collection=''}={}){
  if(provider==='aloula')return fetchAloulaPage({page:pageNum,search,latest,kind,collection});
  if(provider==='wco')return fetchWcoPage({page:pageNum,search,latest,kind,collection});
  if(provider==='youtubeoriginals')return fetchOfficialPage({page:pageNum,search,latest,kind,collection});
  if(provider==='onepace')return fetchOnePacePage({page:pageNum,search,latest,kind});
  if(provider==='dessinanime')return fetchDessinPage({page:pageNum,cursor,search,kind,collection});
  if(provider==='frenchstream')return fetchFrenchPage({page:pageNum,search,kind,collection});
  if(ARABIC_PROVIDERS[provider])return fetchArabicPage({provider,page:pageNum,search,kind,collection});
  const cfg=SPECIALISTS[provider];if(!cfg)throw new Error('Invalid specialist provider');
  const n=Math.min(500,Math.max(1,Math.floor(Number(pageNum)||1)));
  if(provider==='multimovies'){
    if(search){
      const payload=JSON.parse(await page(`${cfg.origin}/api/search?${new URLSearchParams({q:search,limit:'30'})}`));
      if(!Array.isArray(payload.results))throw new Error('MultiMovies search format changed');
      return {items:payload.results.flatMap(item=>{const id=specialistIdFromUrl(new URL(item.url||'/',cfg.origin).href),p=parseSpecialistId(id);if(!p)return [];const result=row(provider,p.type,p.slug,item.title,image(item.poster,cfg.origin));result.year=Number(item.year)||null;return [result];}),page:1,totalPages:1};
    }
    const genrePaths=({indian:['bollywood-movies','south-indian','punjabi'],kdrama:['k-drama'],anime:[kind==='film'?'anime-movies':'anime-series']})[collection];
    if(genrePaths){
      const responses=await Promise.allSettled(genrePaths.map(async genre=>{
        const url=`${cfg.origin}/genre/${genre}?page=${n}`;
        const html=await page(url),$=load(html);
        if(!clean($('h1').text()).toLowerCase().replace(/[^a-z0-9]/g,'').includes(genre.replaceAll('-','')))throw new Error('MultiMovies collection filter not confirmed');
        const result=parseMultiMoviesList(html,url);
        result.items=result.items.filter(item=>item.kind===kind).map(item=>({...item,collections:[collection],tags:collection==='anime'?['anime','animation']:item.tags}));
        return result;
      }));
      const successful=responses.filter(r=>r.status==='fulfilled').map(r=>r.value);
      if(!successful.length)throw new Error('MultiMovies collection unavailable');
      return {items:unique(successful.flatMap(r=>r.items)),page:n,totalPages:Math.max(...successful.map(r=>r.totalPages)),partial:successful.length<responses.length};
    }
    const url=new URL(latest&&kind==='series'?'/episodes':kind==='film'?'/movies':'/series',cfg.origin);
    url.searchParams.set('page',String(n));
    return parseMultiMoviesList(await page(url.href),url.href);
  }
  if(provider==='toontales'){
    // The home grid is random; its page URLs repeat titles. The public sitemap
    // is the stable catalogue cursor, including images and real modification dates.
    const index=load(await page(`${cfg.origin}/sitemap_index.xml`),{xmlMode:true});
    const maps=index('sitemap > loc').toArray().map(a=>index(a).text()).filter(url=>new RegExp(`^https://www\\.toontales\\.net/video-sitemap\\d*\\.xml$`).test(url));
    if(!maps.length)throw new Error('ToonTales sitemap missing');
    const documents=await Promise.all(maps.slice(0,20).map(url=>page(url)));
    const items=unique(documents.flatMap(xml=>{
      const $=load(xml,{xmlMode:true});return $('url').toArray().flatMap(a=>{
        const u=localUrl($(a).children('loc').text(),cfg.origin),m=u && new RegExp(`^/short/(${slugPattern})/$`).exec(u.pathname);if(!m)return [];
        const poster=image($(a).find('image\\:loc').text(),cfg.origin);
        const label=poster?decodeURIComponent(new URL(poster).pathname.split('/').pop()).replace(/\.\w+$/,'').replaceAll('-',' '):m[1].replaceAll('-',' ');
        const item=row(provider,'m',m[1],label,poster);
        const modified=new Date($(a).children('lastmod').text());if(Number.isFinite(+modified)&&+modified<=Date.now())item.latestAt=modified.toISOString();
        return [item];
      });
    })).filter(item=>!search || clean(item.title).toLowerCase().includes(clean(search).toLowerCase()));
    items.sort((a,b)=>String(b.latestAt||'').localeCompare(String(a.latestAt||''))||a.id.localeCompare(b.id));
    return {items:items.slice((n-1)*24,n*24),page:n,totalPages:Math.ceil(items.length/24),hasNext:n*24<items.length};
  }
  if(provider==='animegg' && latest && !search){
    const payload=JSON.parse(await page(`${cfg.origin}/index/recentReleases`,{method:'POST'}));
    if(payload.status!=='ok' || !Array.isArray(payload.recentReleases))throw new Error('AnimeGG updates format changed');
    const items=payload.recentReleases.flatMap(video=>{
      const show=video.Show,ep=video.Episode;if(!show?.uri || !ep?.uri || !new RegExp(`^${slugPattern}$`).test(show.uri) || !new RegExp(`^${slugPattern}$`).test(ep.uri))return [];
      const item=row(provider,'s',show.uri,show.title,image(show.thumbnailUrl,cfg.origin));
      const audioModes=video.version==='subbed'?['sub']:video.version==='dubbed'?['dub']:[];
      item.episodes=[episode(provider,ep.uri,`Episode ${ep.numberLabel||ep.number}`,{number:Number(ep.number)||null,audioModes})];
      item.audioModes=audioModes;item.episodeCount=1;item.latestEpisode=ep.uri;
      const date=new Date(video.releaseDate);if(Number.isFinite(+date) && +date<=Date.now()){item.latestAt=date.toISOString();item.providerUpdatedAt=item.latestAt;}
      return [item];
    });
    // The feed can contain both versions of the same show; preserve both versions.
    const merged=new Map();for(const item of items){const prev=merged.get(item.id);if(prev){prev.audioModes=[...new Set([...prev.audioModes,...item.audioModes])];prev.episodes.push(...item.episodes);}else merged.set(item.id,item);}
    return {items:[...merged.values()],page:1,totalPages:1,hasNext:false};
  }
  if(provider==='animegg' && search){
    const records=JSON.parse(await page(`${cfg.origin}/search/auto/?${new URLSearchParams({q:search})}`));
    if(!Array.isArray(records))throw new Error('AnimeGG search format changed');
    return {items:records.flatMap(r=>{const u=localUrl(r.url,cfg.origin),m=u && new RegExp(`^/series/(${slugPattern})/?$`).exec(u.pathname);return m && r.name?[row(provider,'s',m[1],r.name,image(r.thumbnailUrl,cfg.origin))]:[];}),page:1,totalPages:1};
  }
  const path=provider==='animegg'?'/popular-series':provider==='yoturkish'?(latest?'/episodes/':'/series/'):provider==='myasiantv'?(kind==='film'?'/movies-list/':'/drama/'):'/';
  const url=new URL(path,cfg.origin);
  if(search)url.searchParams.set('s',search);
  if(provider==='animegg'){url.searchParams.set('sortBy','createdAt');url.searchParams.set('sortDirection','DESC');url.searchParams.set('limit','25');url.searchParams.set('start',String((n-1)*25));}
  else if(n>1 && provider!=='megacartoons')url.pathname=`${path==='/'?'/':path}page/${n}/`;
  const result=parseSpecialistList(provider,await page(url.href),url.href);
  // MegaCartoons' series menu and AnimeGG's directory are complete single-page
  // indexes; episode pagination belongs to a title, never to the series menu.
  if(provider==='megacartoons')return {...result,items:search?result.items:result.items.slice((n-1)*24,n*24),page:n,totalPages:Math.ceil(result.items.length/24),hasNext:n*24<result.items.length};
  return result;
}
export async function searchSpecialists(q,{provider:only,timeoutMs=9000}={}){
  const providers=only?(SPECIALISTS[only]?[only]:[]):Object.keys(SPECIALISTS);
  const results=await Promise.allSettled(providers.map(async provider=>{
    let timer;try{return await Promise.race([fetchSpecialistPage({provider,search:q}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Specialist search timeout')),timeoutMs);})]);}finally{clearTimeout(timer);}
  }));
  return results.flatMap(r=>r.status==='fulfilled'?r.value.items:[]).filter(r=>{
    return matchesSearch([r.title,...(r.altTitles||[])].join(' '),q);
  });
}
export function parseSpecialistServers(id,html){
  const p=parseSpecialistId(id);if(!p)throw new Error('Invalid specialist episode');
  const cfg=SPECIALISTS[p.provider],$=load(html),servers=[];
  if(p.provider==='multimovies')return parseMultiMoviesServers(id,html);
  if(p.provider==='animegg'){
    $('#videos a[data-id][data-version]').each((_,a)=>{
      const media=$(a).attr('data-id'),version=$(a).attr('data-version');
      if(!/^\d+$/.test(media) || !['subbed','dubbed'].includes(version))return;
      servers.push({id:`animegg:${media}`,provider:p.provider,name:`AnimeGG - ${version==='subbed'?'Subbed':'Dubbed'}`,audioMode:version==='subbed'?'sub':'dub',type:'embed',embedUrl:`${cfg.origin}/embed/${media}`,sandbox:null});
    });
  }else if(p.provider==='megacartoons' || p.provider==='toontales'){
    for(const script of $('script:not([src])').toArray()){
      const body=$(script).html();if(!/jwplayer\(/.test(body||''))continue;
      for(const m of body.matchAll(/\bfile\s*:\s*["'](https:\/\/[^"']+\.mp4(?:\?[^"']*)?)["']/g)){
        const u=new URL(m[1]);const expected=p.provider==='megacartoons'?'ww.megacartoons.net':'ww.toontales.net';
        if(u.hostname!==expected || u.port || u.username || u.password)continue;
        servers.push({id:`${p.provider}:mp4`,provider:p.provider,name:cfg.name,type:'mp4',streamUrl:u.href});
      }
    }
  }else if(p.provider==='yoturkish'){
    // Public site's player-markup codec: base64, reverse bytes, subtract five,
    // XOR with the public eight-byte client constant. Decode data, never scripts.
    const key=[86,110,51,72,106,87,56,102];
    const hosts=new Set(['rufiiguta.com','engifuosi.com','kitraskimisi.com','tukipasti.com']);
    for(const match of html.matchAll(/data-s([1-5])="([A-Za-z0-9+/|=]{10,4000})"/g)){
      const bytes=[...Buffer.from(match[2].replaceAll('|',''),'base64')].reverse();
      const decoded=bytes.map((v,i)=>String.fromCharCode(((v-5+256)%256)^key[i%key.length])).join('');
      const fragment=load(decoded),src=fragment('iframe').attr('src');
      try{const u=new URL(src);if(u.protocol!=='https:'||u.port||u.username||u.password||!hosts.has(u.hostname))continue;
        servers.push({id:`yoturkish:${match[1]}`,provider:p.provider,name:`YoTurkish - Server ${match[1]} (English sub)`,type:'embed',embedUrl:u.href,sandbox:null});
      }catch{}
    }
  }else if(p.provider==='myasiantv'){
    const raw=$('iframe#b[title="video"]').attr('data-src') || $('iframe#b[title="video"]').attr('src');
    if(raw){const u=new URL(raw,cfg.origin);if(u.origin==='https://zumivids.com' && /^\/embed\/[a-z0-9-]+\.html$/.test(u.pathname))servers.push({id:'myasiantv:zumivids',provider:p.provider,name:'MyAsianTV - English sub',type:'embed',embedUrl:u.href,sandbox:null});}
  }
  return [...new Map(servers.map(s=>[s.embedUrl||s.streamUrl,s])).values()];
}
export async function resolveSpecialistServers(id,options={}){
  if(parseAloulaId(id))return resolveAloulaServers(id,options);
  if(parseWcoId(id))return resolveWcoServers(id,options);
  if(parseOnePaceId(id))return resolveOnePaceServers(id);
  if(parseDessinId(id))return resolveDessinServers(id);
  if(parseFrenchId(id))return resolveFrenchServers(id,options);
  if(parseArabicId(id))return resolveArabicServers(id,options);
  const p=parseSpecialistId(id);if(!p || p.type==='s')return [];
  return parseSpecialistServers(id,await page(specialistUrl(id),{ttl:options.fresh?0:30000}));
}

function inlineJson(html,name){
  // JSON.parse only: never execute source scripts or accept JavaScript expressions.
  const match=new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*(\\{[^\\n]+\\});`).exec(html);
  try{return match?JSON.parse(match[1]):null;}catch{return null;}
}
export function parseMultiMoviesList(html,url){
  const cfg=SPECIALISTS.multimovies,$=load(html),items=[];
  $('[data-save-title]').each((_,button)=>{
    let data;try{data=JSON.parse($(button).attr('data-save-title'));}catch{return;}
    const id=specialistIdFromUrl(new URL(data.url||'/',cfg.origin).href),p=parseSpecialistId(id);if(!p || p.provider!=='multimovies'||!data.title)return;
    const item=row(p.provider,p.type,p.slug,data.title,image(data.poster,cfg.origin));
    item.year=Number(data.year)||null;
    items.push(item);
  });
  // Recently added episodes contain explicit S/E routes, not a complete season guide.
  $('a.episode-preview[href]').each((_,a)=>{
    const u=localUrl($(a).attr('href'),cfg.origin),m=u && new RegExp(`^/series/(${slugPattern})/season/(\\d+)/episode/([1-9]\\d*)$`).exec(u.pathname);if(!m)return;
    const title=clean($(a).find('h3').text());if(!title)return;
    const item=row('multimovies','s',m[1],title,null),id=`sp:multimovies:e:${m[1]}:${m[2]}:${m[3]}`;
    item.episodes=[{id,title:clean($(a).find('p').text())||`Episode ${m[3]}`,season:Number(m[2]),number:Number(m[3]),sourceUrl:u.href,offerings:[{provider:'multimovies',id}]}];
    item.episodeCount=1;item.latestEpisode=id;items.push(item);
  });
  const grouped=new Map();for(const item of items){const old=grouped.get(item.id);if(old){old.episodes=unique([...old.episodes,...item.episodes]);old.episodeCount=old.episodes.length;old.latestEpisode ||= item.latestEpisode;}else grouped.set(item.id,item);}
  if(!grouped.size && !/no (?:results|movies|series|episodes)|nothing found/i.test($('body').text()))throw new Error('MultiMovies listing format changed');
  const pageNumber=Number(new URL(url).searchParams.get('page'))||1;
  const match=/Page\s+(\d+)\s+of\s+(\d+)/i.exec($('body').text());
  return {items:[...grouped.values()],page:pageNumber,totalPages:Number(match?.[2])||pageNumber};
}
export function parseMultiMoviesDetails(id,html){
  const p=parseSpecialistId(id),$=load(html),data=inlineJson(html,'watchItem'),config=inlineJson(html,'watchConfig');
  if(p?.provider!=='multimovies' || !data || specialistIdFromUrl(new URL(data.url||'/',SPECIALISTS.multimovies.origin).href)!==id)throw new Error('MultiMovies title identity mismatch');
  const item=row(p.provider,p.type,p.slug,data.title,image(data.poster,SPECIALISTS.multimovies.origin));
  item.year=Number(data.year)||Number(/\b((?:19|20)\d{2})\b/.exec($('.cinejoy-meta-pill,.cinejoy-meta,.cinejoy-title-meta,.detail-meta').text())?.[1])||null;
  item.synopsis=clean($('#cinejoyOverview').text());
  item.tags=[...new Set($('#watchDetails a[href^="/genre/"]').toArray().map(a=>$(a).attr('href').split('/').pop()))];
  if(item.tags.some(t=>['bollywood-movies','south-indian'].includes(t)))item.collections=['indian'];
  const language=clean($('#watchDetails').find('dt').filter((_,a)=>/Language/i.test($(a).text())).next().text());
  // Language labelled on a multi-dub source is not proof of original country.
  if(language && language!=='Not specified')item.audioLanguage=language;
  item.sourceSeasons=$('.cinejoy-season-select option[value]').toArray().map(a=>Number($(a).attr('value'))).filter(Number.isInteger);
  item.currentSeason=Number(config?.season)||1;
  if(p.type==='m')item.episodes=[{id,title:item.title,season:1,number:1,sourceUrl:item.sourceUrl,offerings:item.offerings}];
  else $('.cinejoy-ep-name[href]').each((_,a)=>{
    const u=localUrl($(a).attr('href'),SPECIALISTS.multimovies.origin),m=u && new RegExp(`^/series/${p.slug}/season/(\\d+)/episode/([1-9]\\d*)$`).exec(u.pathname);if(!m)return;
    const epId=`sp:multimovies:e:${p.slug}:${m[1]}:${m[2]}`;
    item.episodes.push({id:epId,title:clean($(a).attr('title')||$(a).text()),season:Number(m[1]),number:Number(m[2]),sourceUrl:u.href,offerings:[{provider:p.provider,id:epId}]});
  });
  if(p.type==='s'){
    // The source's explicit watched-episode IDs include entries beyond the first
    // screen of cards. Use this actual list, never generate 1..episodeCount.
    let numbers=[];try{numbers=JSON.parse(/const\s+seasonEpisodeNumbers\s*=\s*(\[[^\n]*\]);/.exec(html)?.[1]||'[]');}catch{}
    for(const number of numbers.filter(n=>Number.isInteger(n)&&n>0&&n<100000)){
      const epId=`sp:multimovies:e:${p.slug}:${item.currentSeason}:${number}`;
      if(!item.episodes.some(e=>e.id===epId))item.episodes.push({id:epId,title:`Episode ${number}`,season:item.currentSeason,number,sourceUrl:specialistUrl(epId),offerings:[{provider:p.provider,id:epId}]});
    }
  }
  item.episodes=unique(item.episodes);item.episodeCount=item.episodes.length;
  return item;
}
export function parseMultiMoviesServers(id,html){
  const p=parseSpecialistId(id),data=inlineJson(html,'watchItem'),config=inlineJson(html,'watchConfig');
  if(p?.provider!=='multimovies' || !data || !config)return [];
  const titleId=`sp:multimovies:${p.type==='m'?'m':'s'}:${p.slug}`;
  if(specialistIdFromUrl(new URL(data.url||'/',SPECIALISTS.multimovies.origin).href)!==titleId || p.type==='e' && (config.season!==p.season || config.episode!==p.number))return [];
  const hosts=new Set(['rozgarlelo.modiplay.xyz','streams.iqsmartgames.com','embed.vidrift.net','vidout.pages.dev','embed.filmu.in','vidbolt.xyz']);
  return (config.initialServers||[]).flatMap(server=>{
    try{const u=new URL(server.url);if(u.protocol!=='https:'||u.port||u.username||u.password||!hosts.has(u.hostname)||!['iframe','embed'].includes(server.type))return [];
      return [{id:`multimovies:${server.id}`,provider:p.provider,name:`MultiMovies - ${clean(server.name)}`,type:'embed',embedUrl:u.href,sandbox:null}];
    }catch{return [];}
  });
}
