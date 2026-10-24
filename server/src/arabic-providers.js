import {CIMAFU_PROVIDERS,parseCimafuId,cimafuUrl,cimafuId,cimafuIdFromUrl,getCimafuDetails,fetchCimafuPage,resolveCimafuServers} from './cimafu.js';
import { load } from 'cheerio';
import { safeRemoteFetch } from './stream-security.js';
import JSON5 from 'json5';
import fs from 'node:fs';
import {runtimeProviderSnapshot} from './runtime-source.js';
import {hosted} from './hosting.js';

export const ARABIC_PROVIDERS={
  ...CIMAFU_PROVIDERS,
  streamtunisie:{name:'StreamTunisie',origin:'https://streamtunisie.net',kind:null,collections:['arabic','tunisian']},
  kirmalk:{name:'Kirmalk',origin:'https://kirmalk.com',kind:null,collections:['arabic','egyptian','plays']},
  ahwaktv:{name:'AhwakTV',origin:'https://yam.ahwaktv.net',kind:null,collections:['arabic','egyptian']},
  egydead:{name:'EgyDead',origin:'https://tv10.egydead.live',kind:null,collections:['arabic','egyptian']},
  tuniflix:{name:'Tuniflix',origin:'https://tuniflix.site',kind:null,collections:['arabic','tunisian','turkish']},
  cinetimes:{name:'Cinetimes',origin:'https://cinetimes.org',kind:'film',collections:['tunisian']},
  cimatn:{name:'CimaTN',origin:'https://www.cimatn.com',kind:null,collections:['arabic','tunisian']},
};
const clean=x=>String(x||'').replace(/\s+/g,' ').trim();
const dedupe=rows=>[...new Map(rows.map(r=>[r.id,r])).values()];
const fixed=(value,origin)=>{try{const u=new URL(value,origin);return u.origin===origin&&!u.username&&!u.password?u:null;}catch{return null;}};
export function parseArabicId(id){
  const cimafu=parseCimafuId(id);if(cimafu)return cimafu;
  const m=/^sp:(streamtunisie|kirmalk|ahwaktv|egydead|tuniflix|cinetimes|cimatn):([sme]):([A-Za-z0-9_-]{1,300})(?::([1-9]\d{0,3}))?$/.exec(String(id));
  if(!m)return null;
  const [,provider,type,token]=m;
  if(m[4]&&(provider!=='cimatn'||type!=='e')||provider==='cimatn'&&type==='e'&&!m[4])return null;
  if(['kirmalk','ahwaktv','tuniflix','cinetimes'].includes(provider)){
    if(provider==='ahwaktv'&&type==='s'&&token.startsWith('q_')){
      const query=Buffer.from(token.slice(2),'base64url').toString('utf8');return token.length<=200&&query&&query.length<=120&&Buffer.from(query).toString('base64url')===token.slice(2)?{provider,type,slug:token,query}:null;
    }
    if(!/^[a-zA-Z0-9_-]{1,100}$/.test(token))return null;
    if(provider==='cinetimes'&&type!=='m')return null;
    return {provider,type,slug:token};
  }
  let pathname;try{pathname=Buffer.from(token,'base64url').toString('utf8');if(Buffer.from(pathname).toString('base64url')!==token)return null;}catch{return null;}
  if(provider==='cimatn')return /^\/\d{4}\/\d{2}\/[a-z0-9-]+\.html$/i.test(pathname)?{provider,type,slug:token,pathname,number:m[4]?Number(m[4]):null}:null;
  if(!/^\/(?:[a-z-]+\/)?[^/?#\\]+\/$/i.test(pathname) || /\.\.|%2f|%5c|%2e|\u0000/i.test(pathname))return null;
  if(provider==='streamtunisie' && type==='s'&&!pathname.startsWith('/series/'))return null;
  if(provider==='streamtunisie' && type==='m'&&!pathname.startsWith('/movies/'))return null;
  if(provider==='streamtunisie' && type==='e'&&pathname.slice(1,-1).includes('/'))return null;
  return {provider,type,slug:token,pathname};
}
export function arabicUrl(id){
  if(parseCimafuId(id))return cimafuUrl(id);
  const p=parseArabicId(id);if(!p)return null;const origin=ARABIC_PROVIDERS[p.provider].origin;
  if(p.provider==='tuniflix')return `${origin}/${p.type==='s'?'serie':p.type==='m'?'movie':'episode'}/${p.slug}`;
  if(p.provider==='cinetimes')return `${origin}/t/${p.slug}`;
  if(p.provider==='ahwaktv'&&p.type==='s'&&/^v_[1-9]\d*$/.test(p.slug))return `${origin}/view-serie.php?id=${p.slug.slice(2)}`;
  if(p.query)return `${origin}/search.php?keywords=${encodeURIComponent(p.query)}&btn=Search`;
  return p.pathname?origin+p.pathname:`${origin}/${p.type==='s'?'category.php?cat=':'watch.php?vid='}${p.slug}`;
}
export function arabicId(provider,type,value){
  if(provider==='cimafu')return cimafuId(type,value);
  const cfg=ARABIC_PROVIDERS[provider],u=cfg&&fixed(value,cfg.origin);if(!u)return null;
  let token;
  if(provider==='tuniflix'||provider==='cinetimes'){
    const prefix=provider==='cinetimes'?'/t/':`/${type==='s'?'serie':type==='m'?'movie':'episode'}/`;
    if(!u.pathname.startsWith(prefix)||u.search||u.hash)return null;token=u.pathname.slice(prefix.length).replace(/\/$/,'');
  }else if(provider==='ahwaktv'&&type==='s'&&u.pathname==='/view-serie.php'){
    const number=u.searchParams.get('id');if(!/^[1-9]\d*$/.test(number||''))return null;token='v_'+number;
  }else if(['kirmalk','ahwaktv'].includes(provider)){
    if(u.pathname!==(type==='s'?'/category.php':'/watch.php'))return null;
    token=u.searchParams.get(type==='s'?'cat':'vid');
  }else{if(u.search||u.hash)return null;try{token=Buffer.from(decodeURIComponent(u.pathname)).toString('base64url');}catch{return null;}if(token.length>200)return null;}
  const id=`sp:${provider}:${type}:${token}`;return parseArabicId(id)?id:null;
}
export function arabicIdFromUrl(value){
  const cimafu=cimafuIdFromUrl(value);if(cimafu)return cimafu;
  for(const [provider,cfg] of Object.entries(ARABIC_PROVIDERS)){
    const u=fixed(value,cfg.origin);if(!u)continue;
    const type=u.pathname==='/view-serie.php'||u.pathname==='/category.php'||u.pathname.startsWith('/series/')||u.pathname.startsWith('/serie/')||u.pathname.startsWith('/season/')?'s':u.pathname.startsWith('/episode/')?'e':'m';
    return arabicId(provider,type,u.href);
  }return null;
}
const cache=new Map();
let savedStamp='',savedRows=new Map(),savedEpisodes=new Map();
export async function arabicSnapshot(id){
  if(hosted())return runtimeProviderSnapshot(id);
  const deployment=new URL('../deployment-arabic.json',import.meta.url),local=new URL('../data/providers-flixer.json',import.meta.url);
  const file=!process.env.VERCEL&&fs.existsSync(local)?local:fs.existsSync(deployment)?deployment:local;if(!fs.existsSync(file))return null;
  const stamp=`${file}:${fs.statSync(file).mtimeMs}`;
  if(stamp!==savedStamp){const data=JSON.parse(fs.readFileSync(file,'utf8'));savedRows=new Map((Array.isArray(data)?data:data.items||[]).filter(r=>parseArabicId(r.id)).map(r=>[r.id,r]));savedEpisodes=new Map();for(const row of savedRows.values())for(const episode of row.episodes||[])savedEpisodes.set(episode.id,row);savedStamp=stamp;}
  return savedRows.get(id)||savedEpisodes.get(id)||null;
}
export async function arabicPage(url,{view=false,fresh=false}={}){
  const key=`${view}:${url}`,old=cache.get(key);if(!fresh&&old&&Date.now()-old.at<120000)return old.promise;
  const promise=(async()=>{
    const r=await safeRemoteFetch(url,{timeoutMs:6500,method:view?'POST':'GET',body:view?'View=1':undefined,headers:{'User-Agent':'Flixer/1.6 (public catalogue metadata)',Accept:'text/html',...(view?{'Content-Type':'application/x-www-form-urlencoded'}:{})}});
    if(!r.ok){await r.body?.cancel();throw new Error(`Arabic source HTTP ${r.status}`);}
    if(new URL(r.url).origin!==new URL(url).origin){await r.body?.cancel();throw new Error('Arabic source origin changed');}
    const html=await r.text();if(!html.trim()||/<title[^>]*>\s*(?:Just a moment|Access denied|Quick check)/i.test(html))throw new Error('Arabic source verification required');return html;
  })();cache.set(key,{at:Date.now(),promise});if(cache.size>500)cache.delete(cache.keys().next().value);
  try{return await promise;}catch(e){cache.delete(key);throw e;}
}
function row(id,title,poster,{collection='',country=null}={}){
  const p=parseArabicId(id),kind=p.type==='m'?'film':'series';
  const year=Number(/\b((?:19|20)\d{2})\b/.exec(title)?.[1])||null;
  const theatre=/مسرحي[ةه]|مسرحيات/.test(title)||collection==='plays';
  const english=/\bFilm\s+(.+)$/i.exec(title)?.[1];
  if(english)title=title.replace(/\s*\bFilm\s+.+$/i,'');
  title=clean(title).replace(/^(?:مشاهدة\s+)?(?:فيلم|مسلسل|مسرحية)\s+/,'').replace(/\s+(?:كامل\s+)?HD\s*$/i,'').replace(/\s*\(?\b(?:19|20)\d{2}\b\)?\s*$/,'').replace(/[\s–-]+$/,'').trim();
  const arabic=p.provider!=='kirmalk'||collection==='egyptian'||collection==='plays'||country==='EG';
  const collections=[...(arabic?['arabic']:[]),...(collection?[collection]:[]),...(theatre?['plays']:[])];
  return {id,title,kind,year,altTitles:english?[english]:[],sourceUrl:arabicUrl(id),poster:poster?{custom:poster}:null,portrait:poster||null,tags:[theatre?'theatre':'drama'],collections:[...new Set(collections)],countries:country?[country]:[],originalLanguage:arabic?'ar':null,documentary:false,providerMetadata:true,channelId:p.provider,offerings:[{provider:p.provider,id,kind,sourceUrl:arabicUrl(id)}],episodes:[],episodeCount:0};
}
function paging($,url,items){
  const page=parseInt(new URL(url).searchParams.get('page')||/\/page\/(\d+)/.exec(url)?.[1]||1,10);
  const pages=$('a[href]').toArray().map(a=>{const u=fixed($(a).attr('href'),new URL(url).origin);return u?parseInt(u.searchParams.get('page')||/\/page\/(\d+)/.exec(u.pathname)?.[1]||1,10):1;});
  const totalPages=Math.max(page,...pages.filter(Number.isFinite));return {items:dedupe(items),page,totalPages,hasNext:page<totalPages};
}
export function parseArabicList(provider,html,url,{kind='film',collection=''}={}){
  const $=load(html),cfg=ARABIC_PROVIDERS[provider],items=[];
  if(provider==='tuniflix'){
    $('.MovieList.Rows.AX .TPost.B').each((_,card)=>{
      const a=$(card).find('a[href]').first(),u=fixed(a.attr('href'),cfg.origin),type=u?.pathname.startsWith('/serie/')?'s':u?.pathname.startsWith('/movie/')?'m':null;if(!type)return;
      const title=clean($(card).find('.Title').first().text()||a.find('h2,h3').text());const id=arabicId(provider,type,u.href);if(!id||!title)return;
      const img=$(card).find('img').first(),item=row(id,title,new URL(img.attr('data-src')||img.attr('src'),cfg.origin).href,{collection,country:collection==='tunisian'?'TN':collection==='turkish'?'TR':null});
      item.year=Number($(card).find('.Year').first().text())||item.year;items.push(item);
    });
  }else if(provider==='cinetimes'){
    $('a[href^="/t/"]').each((_,a)=>{const title=clean($(a).find('h2,h3').text()||$(a).attr('title'));const id=arabicId(provider,'m',$(a).attr('href'));if(id&&title)items.push(row(id,title,$(a).find('img').attr('src'),{collection:'tunisian',country:'TN'}));});
  }else if(provider==='streamtunisie'){
    $('a.series-card').each((_,a)=>{
      const u=fixed($(a).attr('href'),cfg.origin),type=u?.pathname.startsWith('/series/')?'s':u?.pathname.startsWith('/movies/')?'m':null;if(!type)return;
      const title=clean($(a).find('h3').text());
      // This source labels some TV landing pages as movies. Keep them out of films.
      if(type==='m'&&/Season|مسلسل|مشاهدة كاملة الآن/i.test(title))return;
      const id=arabicId(provider,type,u.href);if(!id||!title)return;
      items.push(row(id,title,$(a).find('img').attr('src'),{collection:collection||'tunisian',country:collection==='arabic'?null:'TN'}));
    });
  }else if(['kirmalk','ahwaktv'].includes(provider)){
    $('.video-card,.pm-ul-browse-videos li,.pm-ul-browse-videos .thumbnail,.pm-ul-search-videos li').each((_,card)=>{
      const a=$(card).find('a[href*="watch.php?vid="][title]').first(),title=clean(a.attr('title'));if(!title)return;
      const episodic=/الحلقة|حلقه/.test(title),type=episodic?'e':'m',id=arabicId(provider,type,a.attr('href'));if(!id)return;
      const image=$(card).find('img').first();const item=row(id,title,image.attr('data-echo')||image.attr('data-src')||image.attr('src'),{collection,country:collection==='egyptian'?'EG':null});
      if(episodic)item.sourceEpisode=true;
      items.push(item);
    });
  }else{
    $('.movieItem,.postBlock,.BlockItem').each((_,card)=>{
      const a=$(card).find('a[href]').first(),u=fixed(a.attr('href'),cfg.origin),title=clean(a.attr('title')||$(card).find('h3,h2,h1').text());if(!u||!title)return;
      const type=/^\/(?:serie|season)\//.test(u.pathname)?'s':/الحلقة/.test(title)?'e':'m',id=arabicId(provider,type,u.href);if(!id||type==='e')return;
      const img=$(card).find('img').first();items.push(row(id,title,img.attr('data-src')||img.attr('src'),{collection}));
    });
  }
  if(!items.length&&!/لا توجد|لم يتم العثور|no (?:results|videos)/i.test($.text()))throw new Error(`${cfg.name} listing format changed or empty`);
  return paging($,url,items);
}
export function parseArabicDetails(id,html){
  const p=parseArabicId(id),cfg=ARABIC_PROVIDERS[p.provider],$=load(html);
  const title=p.query||clean($('meta[property="og:title"]').attr('content')||$('h1.entry-title,h1.modern-video-title,h1.tv-ep-title,h1').first().text()||$('title').text());
  if(!title)throw new Error('Arabic title unavailable');
  const rawPoster=$('meta[property="og:image"]').attr('content')||$('article .wp-post-image,.TPost.A.D .Objf img.TPostBg,.TpRwCont .Objf img.TPostBg,.single-thumbnail img,#post-body img,.entry-content img').first().attr('src');
  let poster=null;if(rawPoster)try{const u=new URL(rawPoster,cfg.origin);if(u.protocol==='https:'&&!u.username&&!u.password)poster=u.href;}catch{}
  let collection=['streamtunisie','cinetimes'].includes(p.provider)?'tunisian':'';
  if(p.provider==='streamtunisie'&&$('article a[href*="/series-category/arabic/"]').length)collection='arabic';
  if(p.provider==='tuniflix'){
    const links=$('.Description .Tags a[href*="/tg/"]').toArray().map(a=>$(a).attr('href'));
    collection=links.some(u=>/\/tg\/tunisian-(movies|series)/.test(u))?'tunisian':links.some(u=>/\/tg\/turkish-(movies|series)/.test(u))?'turkish':'';
  }
  const categories=$('.category-name,.video-info,.single-info').text();
  if(/مسلسلات مصرية|مصر/.test(categories))collection='egyptian';
  const item=row(id,title,poster,{collection,country:collection==='tunisian'?'TN':collection==='egyptian'?'EG':null});
  if(p.provider==='tuniflix'){
    const year=clean($('.Date').first().text());if(/^(?:19|20)\d{2}$/.test(year))item.year=Number(year);
    const aliases=$('.Description > p:not([class])').toArray().slice(1).map(el=>clean($(el).text())).filter(value=>value.length>1&&value.length<80&&!/https?:|مشاهدة|تحميل/.test(value));
    item.altTitles=[...new Set([...item.altTitles,...aliases])];
  }
  if(p.provider==='cimatn'){
    const year=$('.TaxContent li').filter((_,el)=>/سنة|تاريخ.*اصدار/.test($(el).find('span').text())).find('a').first().text().trim();if(/^(?:19|20)\d{2}$/.test(year))item.year=Number(year);
    const latin=/[A-Za-z][A-Za-z0-9 &'’.,:!-]*$/.exec(item.title)?.[0]?.trim();if(latin){const native=item.title.slice(0,item.title.lastIndexOf(latin)).trim();item.altTitles=[...new Set([...(item.altTitles||[]),latin,native].filter(value=>value&&value!==item.title))];}
  }
  const plotSelectors={tuniflix:'.Description > p:not([class])',cimatn:'.StoryArea p',kirmalk:'.description-content,.description-text',egydead:'.singleStory',ahwaktv:'.pm-video-description > div:not([class])',streamtunisie:'article .entry-content p',cinetimes:'[itemprop="description"]'};
  const sourcePlot=clean($(plotSelectors[p.provider]).first().text());
  const metaPlot=clean($('meta[name="description"]').attr('content')||$('meta[property="og:description"]').attr('content'));
  item.synopsis=sourcePlot.length>25?sourcePlot:metaPlot.length>25&&!/^(?:Watch online|شاهد أحدث|مشاهدة وتحميل أحدث|موقع)/i.test(metaPlot)?metaPlot:'';
  item.metadataVersion=p.provider==='tuniflix'?4:3;
  if(p.type==='s'&&p.provider==='tuniflix'){
    item.sourceSeasons=$('a[href*="/season/"]').toArray().map(a=>({url:fixed($(a).attr('href'),cfg.origin)?.href,number:Number(/(\d+)/.exec($(a).text())?.[1])||null})).filter(s=>s.url);item.episodesComplete=false;
  }else if(p.type==='s'){
    const season=Number(/الموسم\s*(\d+)/.exec(title)?.[1])||null;
    const links=p.provider==='streamtunisie'?$('article .entry-content a[href]'):p.provider==='egydead'?$('.EpsList a[href*="/episode/"]').length?$('.EpsList a[href*="/episode/"]'):$('a[href*="/episode/"]'):$('.category-videos .video-card a[href*="watch.php?vid="][title],.pm-ul-browse-videos a[href*="watch.php?vid="][title],.pm-ul-search-videos a[href*="watch.php?vid="][title]');
    links.each((_,a)=>{
      const label=clean($(a).attr('title')||$(a).text()),u=fixed($(a).attr('href'),cfg.origin);if(!u||!label)return;
      if(p.provider==='streamtunisie'&&!/episode|حلقة/i.test(label+' '+u.pathname))return;
      if(p.query&&clean(label).replace(/^(?:مشاهدة\s+)?مسلسل\s+/,'').split(/الحلقة|حلقه/)[0].trim()!==p.query)return;
      if(p.provider==='egydead'){
        const stem=decodeURIComponent(p.pathname).split('/').filter(Boolean).at(-1).replace(/-(?:19|20)\d{2}$/,'');
        if(!$(a).closest('.EpsList').length&&!decodeURIComponent(u.pathname).startsWith(`/episode/${stem}-`))return;
      }
      const epId=arabicId(p.provider,'e',u.href);if(!epId)return;
      const slot=/-s(\d+)e(\d+)\/$/i.exec(u.pathname);
      const number=Number(/(?:الحلقة|حلقه|episode)\s*0*(\d+)/i.exec(label)?.[1]||slot?.[2]||/episode[-_]?0*(\d+)|-(\d+)-episode|[-_]e0*(\d+)\//i.exec(u.pathname)?.slice(1).find(Boolean))||null;
      item.episodes.push({id:epId,title:label,season:p.provider==='streamtunisie'?null:slot?Number(slot[1]):Number(/^Season([1-9]\d*)$/.exec($(a).closest('.tabcontent').attr('id')||'')?.[1])||season,number,sourceUrl:u.href,offerings:[{provider:p.provider,id:epId}]});
    });
    const pages=paging($,arabicUrl(id),[]);item.totalPages=pages.totalPages;item.episodesComplete=pages.totalPages===1;
  }else if(p.type==='e'){
    // Use the actual title-specific category link, excluding sidebar recommendations.
    const parents=$('.category-name a[href*="category.php?cat="]').toArray().map(a=>({label:clean($(a).text()),url:$(a).attr('href')})).filter(a=>/الموسم\s*\d+/.test(a.label));
    const parent=parents.at(-1);if(parent)item.parent={id:arabicId(p.provider,'s',parent.url),title:parent.label,sourceUrl:parent.url};
  }else item.episodes=[{id,title:item.title,sourceUrl:arabicUrl(id),season:null,number:null,offerings:item.offerings}];
  if(p.provider==='cinetimes'){item.originalLanguage=null;item.year=Number(/\((\d{4})\)/.exec($('title').text())?.[1])||null;}
  item.episodes=dedupe(item.episodes);item.episodeCount=item.episodes.length;return item;
}
const detailRequests=new Map();
export async function getArabicDetails(id,{fresh=false}={}){
  const saved=await arabicSnapshot(id);
  if(!fresh&&saved?.id===id&&saved.episodesComplete!==false&&(!parseArabicId(id).query||saved.poster?.custom)&&saved.metadataVersion>=(parseArabicId(id).provider==='tuniflix'?4:3)&&Date.now()-Date.parse(saved.detailsFetchedAt||0)<6*3600000)return saved;
  if(detailRequests.has(id))return detailRequests.get(id);
  const request=getLiveArabicDetails(id).catch(error=>{if(!fresh&&saved?.id===id)return {...saved,providerErrors:[{provider:parseArabicId(id).provider,error:error.message,cached:true}]};throw error;}).finally(()=>detailRequests.delete(id));
  detailRequests.set(id,request);return request;
}
export async function collectArabicPages(entries,fetchEntry,concurrency=4){
  const results=[];
  for(let offset=0;offset<entries.length;offset+=concurrency)results.push(...await Promise.allSettled(entries.slice(offset,offset+concurrency).map(fetchEntry)));
  return results;
}
async function getLiveArabicDetails(id){
  if(parseCimafuId(id))return getCimafuDetails(id);
  if(parseArabicId(id)?.provider==='cimatn')return getCimaDetails(id);
  const url=arabicUrl(id),item=parseArabicDetails(id,await arabicPage(url));
  if(item.sourceSeasons){
    const results=await collectArabicPages([...new Map(item.sourceSeasons.map(s=>[s.url,s])).values()],async season=>{
      const $=load(await arabicPage(season.url)),episodes=[];
      $('td.MvTbTtl a[href*="/episode/"]').each((_,a)=>{const url=fixed($(a).attr('href'),ARABIC_PROVIDERS.tuniflix.origin)?.href,id=arabicId('tuniflix','e',url);if(!id)return;const match=/(\d+)x(\d+)$/.exec(parseArabicId(id).slug);episodes.push({id,title:clean($(a).text()),season:match?Number(match[1]):season.number,number:match?Number(match[2]):null,sourceUrl:url,offerings:[{provider:'tuniflix',id}]});});return episodes;
    });item.episodes=dedupe(results.flatMap(r=>r.status==='fulfilled'?r.value:[]));item.episodeCount=item.episodes.length;item.episodesComplete=results.every(r=>r.status==='fulfilled');
  }else if(item.totalPages>1){
    const pages=await collectArabicPages(Array.from({length:item.totalPages-1},(_,i)=>i+2),number=>{const next=new URL(url);next.searchParams.set('page',number);return arabicPage(next.href).then(html=>parseArabicDetails(id,html));});
    item.episodes=dedupe([...item.episodes,...pages.flatMap(r=>r.status==='fulfilled'?r.value.episodes:[])]);item.episodeCount=item.episodes.length;item.episodesComplete=pages.every(r=>r.status==='fulfilled');
  }
  item.episodes.sort((a,b)=>(a.season??0)-(b.season??0)||(a.number??Infinity)-(b.number??Infinity));
  if(!item.poster?.custom&&item.episodes[0]&&item.episodes[0].id!==id){
    const episode=item.episodes[0],detail=parseArabicDetails(episode.id,await arabicPage(arabicUrl(episode.id)));
    if(detail.poster?.custom){item.poster=detail.poster;item.portrait=detail.portrait;}
  }
  return item;
}
const scopes={kirmalk:{film:'movie14',series:'serieseg4',plays:'msr7'},ahwaktv:{film:'aflam-arabya1',series:'moslslat-msriya'}};
export async function fetchArabicPage({provider,kind='film',collection='',page=1,search,latest=false}={}){
  if(provider==='cimafu')return fetchCimafuPage({kind,collection,page,search,latest});
  if(provider==='egydead'&&collection==='plays')return {items:[],page,totalPages:1,hasNext:false,unsupported:true};
  if(provider==='cimatn')return fetchCimaPage({kind,page,search});
  if(provider==='tuniflix'&&!collection&&!search)collection='tunisian';
  if(!collection&&!search&&['kirmalk','ahwaktv'].includes(provider)&&kind==='series')collection='egyptian';
  const cfg=ARABIC_PROVIDERS[provider];let url;
  if(provider==='tuniflix')url=search?`${cfg.origin}/?s=${encodeURIComponent(search)}`:`${cfg.origin}/tg/${collection==='turkish'?'turkish':collection==='arabic'?'arabic':'tunisian'}-${kind==='film'?'movies':'series'}${page>1?`/page/${page}`:''}`;
  else if(provider==='cinetimes')url=`${cfg.origin}/films-series/meilleurs-films-made-in-tunisie-gratuits`;
  else if(provider==='streamtunisie')url=search?`${cfg.origin}/?s=${encodeURIComponent(search)}`:`${cfg.origin}/${kind==='film'?'movie-category/tunisian_films':'series-category/'+(collection==='arabic'?'arabic':'tunisian')}/${page>1?`page/${page}/`:''}`;
  else if(scopes[provider])url=search?`${cfg.origin}/search.php?keywords=${encodeURIComponent(search)}&btn=Search`:`${cfg.origin}/category.php?cat=${collection==='plays'?scopes[provider].plays:scopes[provider][kind]}&page=${page}&order=DESC`;
  else url=search?`${cfg.origin}/?s=${encodeURIComponent(search)}`:`${cfg.origin}/${collection==='plays'?'show':kind==='series'?'series-category/arabic-series':'category/'+encodeURIComponent('افلام-عربي')}/${page>1?`?page=${page}/`:''}`;
  const result=parseArabicList(provider,await arabicPage(url),url,{kind,collection});
  result.sourceFingerprint='source:'+result.items.map(r=>r.id).sort().join('|');
  // Episode listings are not individual TV shows. Resolve their source parent.
  const episodeRows=result.items.filter(r=>r.sourceEpisode);
  if(provider==='ahwaktv'&&episodeRows.length){
    result.items=dedupe([...result.items.filter(r=>!r.sourceEpisode),...episodeRows.map(r=>{
      const query=clean(r.title).split(/الحلقة|حلقه/)[0].trim(),id=`sp:ahwaktv:s:q_${Buffer.from(query).toString('base64url')}`;
      return parseArabicId(id)?row(id,query,r.portrait,{collection,country:collection==='egyptian'?'EG':null}):null;
    }).filter(Boolean)]);
  }
  if(episodeRows.length&&provider!=='ahwaktv'){
    const parents=[];
    for(let start=0;start<episodeRows.length;start+=4){
      const resolved=await Promise.allSettled(episodeRows.slice(start,start+4).map(r=>getArabicDetails(r.id)));
      for(const r of resolved)if(r.status==='fulfilled'&&r.value.parent?.id){const parent=row(r.value.parent.id,r.value.parent.title,r.value.portrait,{collection,country:collection==='egyptian'?'EG':null});parents.push(parent);}
    }
    result.items=dedupe([...result.items.filter(r=>!r.sourceEpisode),...parents]);
  }
  result.items=result.items.filter(r=>search||!kind||r.kind===kind);return result;
}
const embedHosts=new Set(['uqload.vc','cima.easyvidplayer.com','www.youtube.com','www.youtube-nocookie.com','youtube.com','player.vimeo.com','www.dailymotion.com','geo.dailymotion.com','hgcloud.to','audinifer.com','morencius.com','mixdrop.top','playmogo.com','s1.hdup400.com','watch.easyvidplayer.com','watch.strp2p.site','vkvideo.ru','ok.ru','www.ok.ru','player.mediadelivery.net','app.videas.fr','www.vidspeed.org','uqload.net','movearnpre.com','dingtezuni.com','q7v3k8m2p1.top']);
export function parseArabicServers(id,html){
  const p=parseArabicId(id),$=load(html),urls=[];
  if(p.provider==='streamtunisie'){
    $('.tv-player-card iframe[src],article .entry-content iframe[src]').each((_,el)=>urls.push($(el).attr('src')));
    for(const m of html.matchAll(/switchHlsTvServer\([^,\n]*,\s*["']([^"']+)["']/g))urls.push(load('<p>'+m[1]+'</p>')('p').text());
  }
  if(['kirmalk','ahwaktv'].includes(p.provider)){
    $('script[type="application/ld+json"]').each((_,el)=>{try{const data=JSON.parse($(el).text());for(const x of Array.isArray(data)?data:data['@graph']||[data])if(x['@type']==='VideoObject'&&x.embedUrl)urls.push(x.embedUrl);}catch{}});
    $('link[itemprop="embedUrl"]').each((_,el)=>urls.push($(el).attr('href')));
  }
  if(p.provider==='ahwaktv')$('[data-embed-url]').each((_,el)=>urls.push($(el).attr('data-embed-url')));
  if(['tuniflix','cimatn'].includes(p.provider))$('iframe[src]').each((_,el)=>urls.push($(el).attr('src')));
  if(p.provider==='cinetimes')$('video source[src],iframe[src*="youtube.com/embed/"]').each((_,el)=>urls.push($(el).attr('src')));
  if(p.provider==='egydead')$('.watchAreaMaster [data-link],.watchServers [data-link],.serversList [data-link]').each((_,el)=>urls.push($(el).attr('data-link')));
  const direct=urls.filter(value=>safeTunisianFile(value)||(p.provider==='cinetimes'?pSafeCommons(value):p.provider==='streamtunisie'&&safeSourceHls(value))).map((url,i)=>({id:`${p.provider}:direct:${i}`,provider:p.provider,name:`${ARABIC_PROVIDERS[p.provider].name} - direct video`,type:p.provider==='cinetimes'||safeTunisianFile(url)?'file':'hls',streamUrl:url}));
  return [...direct,...[...new Set(urls)].flatMap((value,i)=>{try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||!embedHosts.has(u.hostname))return [];
    const videoId=['www.youtube.com','www.youtube-nocookie.com','youtube.com'].includes(u.hostname)?/^\/embed\/([\w-]{11})/.exec(u.pathname)?.[1]:null;
    return [{id:`${p.provider}:${i}`,provider:p.provider,name:`${ARABIC_PROVIDERS[p.provider].name} - ${videoId?'YouTube':u.hostname}`,type:videoId?'youtube':'embed',...(videoId?{videoId}:{embedUrl:u.href,sandbox:null})}];
  }catch{return [];}})];
}
export function ahwakPlaybackLink(html){const $=load(html),href=$('#video-wrapper #play-video[href],#video-wrapper a.controls-play-pause-big[href]').first().attr('href'),url=fixed(href,ARABIC_PROVIDERS.ahwaktv.origin);return url&&url.pathname==='/see.php'&&/^[A-Za-z0-9_-]{1,100}$/.test(url.searchParams.get('vid')||'')?url.href:null;}
// Cinetimes now links some archive films to their Commons file page instead of
// embedding <video>. Resolve that exact published file through public metadata.
export async function cinetimesCommonsServers(html,{fetchJson=async url=>{
  const r=await safeRemoteFetch(url,{timeoutMs:6500,headers:{'User-Agent':'Flixer/1.6 (public archive metadata)',Accept:'application/json'}});
  if(!r.ok){await r.body?.cancel();throw new Error(`Commons metadata HTTP ${r.status}`);}return r.json();
}}={}){
  const $=load(html),titles=new Set();
  $('.watch-videos a[href]').each((_,el)=>{try{const u=new URL($(el).attr('href'));if(u.origin==='https://commons.wikimedia.org'&&!u.username&&!u.password&&u.pathname.startsWith('/wiki/File:'))titles.add(decodeURIComponent(u.pathname.slice(6)).replace(/_/g,' ').normalize('NFC'));}catch{}});
  const servers=[];
  for(const title of [...titles].slice(0,3)){
    const url=new URL('https://commons.wikimedia.org/w/api.php');url.search=new URLSearchParams({action:'query',format:'json',prop:'imageinfo',iiprop:'url',titles:title});
    const data=await fetchJson(url.href);
    for(const page of Object.values(data?.query?.pages||{}))if(page.ns===6&&String(page.title).replace(/_/g,' ').normalize('NFC')===title){
      const streamUrl=page.imageinfo?.[0]?.url;
      if(pSafeCommons(streamUrl))servers.push({id:`cinetimes:commons:${servers.length}`,provider:'cinetimes',name:'Cinetimes - Wikimedia archive',type:'file',streamUrl});
    }
  }
  return servers;
}
export function egydeadWatchLink(id,html){
 const p=parseArabicId(id);if(p?.provider!=='egydead'||p.type==='s')return null;const base=new URL(arabicUrl(id)),expected=base.pathname.replace(/\/$/,'')+'/watch/',$=load(html);
 for(const el of $('.watchNow a[href]').toArray())try{const u=new URL($(el).attr('href'),base);if(u.origin===base.origin&&u.pathname===expected&&!u.search&&!u.hash&&!u.username&&!u.password&&u.port==='')return u.href;}catch{}
 return null;
}
export async function resolveArabicServers(id,{fresh=false,transport,fetchPage=arabicPage}={}){
  if(parseCimafuId(id))return resolveCimafuServers(id,{fresh,transport});
  const saved=await arabicSnapshot(id),episode=saved?.episodes?.find(e=>e.id===id),stored=episode?.cachedPlayers;
  if(!fresh&&stored?.length&&parseArabicId(id)?.provider!=='cimatn'){
    const validated=approvedPlayers(id,stored.map(s=>({url:s.embedUrl||(s.type==='youtube'?`https://www.youtube.com/embed/${s.videoId}`:'')})));
    const files=stored.filter(s=>s.type==='file'&&(pSafeCommons(s.streamUrl)||safeTunisianFile(s.streamUrl))||parseArabicId(id)?.provider==='streamtunisie'&&s.type==='hls'&&safeSourceHls(s.streamUrl));
    if(validated.length||files.length)return [...validated,...files];
  }
  if(parseArabicId(id)?.provider==='cimatn'){
    const data=await cimaWatchData(await arabicPage(arabicUrl(id),{fresh})),p=parseArabicId(id);
    const entries=p.type==='e'?data?.episodes?.[p.number]:data?.servers;
    const players=approvedPlayers(id,entries||[]);
    if(data?.sourceUrl&&/^https:\/\/cimatnwatchingg\.blogspot\.com\/p\/[a-z0-9-]+\.html$/.test(data.sourceUrl))players.push({id:'cimatn:original-page',provider:'cimatn',name:'CimaTN - original player page',type:'browser',embedUrl:data.sourceUrl,sandbox:null});
    return players;
  }
  const p=parseArabicId(id);if(!p||p.type==='s')return [];let html=await fetchPage(arabicUrl(id),{fresh});
  if(p.provider==='egydead'){
    const watch=egydeadWatchLink(id,html);
    if(watch)html=await fetchPage(watch,{fresh});
    else if(!parseArabicServers(id,html).length)html=await fetchPage(arabicUrl(id),{view:true,fresh});
  }
  if(p.provider==='streamtunisie'&&p.type==='m'){
    const $=load(html),link=$('article a[href*="/watch-movie-"]').first().attr('href'),u=fixed(link,ARABIC_PROVIDERS[p.provider].origin);if(u&&/^\/watch-movie-[^/?]+\/$/.test(u.pathname))html=await arabicPage(u.href,{fresh});
  }
  if(p.provider==='ahwaktv'){let url=`${ARABIC_PROVIDERS.ahwaktv.origin}/see.php?vid=${p.slug}`;html=await arabicPage(url,{fresh});for(let step=0;step<2;step++){const next=ahwakPlaybackLink(html);if(!next||next===url)break;url=next;html=await arabicPage(url,{fresh});}}
  if(p.provider==='tuniflix'){
    const $=load(html),choices=$('iframe[src]').toArray().map(a=>fixed($(a).attr('src'),ARABIC_PROVIDERS.tuniflix.origin)).filter(u=>u&&u.pathname==='/'&&/^\d+$/.test(u.searchParams.get('trembed')||'')&&/^\d+$/.test(u.searchParams.get('trid')||'')&&/^[12]$/.test(u.searchParams.get('trtype')||''));
    const firstId=choices[0]?.searchParams.get('trid');
    $('.OptionBx[data-key][data-id]').each((_,el)=>{const key=$(el).attr('data-key'),post=$(el).attr('data-id');if(post===firstId&&/^\d+$/.test(key||''))choices.push(new URL(`/?trembed=${key}&trid=${post}&trtype=${p.type==='m'?1:2}`,ARABIC_PROVIDERS.tuniflix.origin));});
    const wrappers=await collectArabicPages([...new Map(choices.map(u=>[u.href,u])).values()],u=>arabicPage(u.href,{fresh}));return wrappers.flatMap(r=>r.status==='fulfilled'?parseArabicServers(id,r.value):[]);
  }
  const servers=parseArabicServers(id,html);
  if(p.provider==='cinetimes'&&!servers.length)return cinetimesCommonsServers(html);
  return servers;
}

// Parse only an object/array literal, never execute source JavaScript. JSON5
// accepts the public source's unquoted keys and single-quoted strings.
export function dataLiteral(html,name){
  const match=new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*([\\[{])`).exec(html);if(!match)return null;
  const start=match.index+match[0].length-1;let depth=0,quote=null,escape=false;
  for(let i=start;i<html.length&&i-start<1000000;i++){
    const c=html[i];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote=null;continue;}
    if(c==='"'||c==="'"){quote=c;continue;}
    if(c==='{'||c==='[')depth++;else if(c==='}'||c===']')depth--;
    if(depth===0){try{return JSON5.parse(html.slice(start,i+1).replace(/^(\s*)(\d+)\s*:/gm,'$1"$2":'));}catch{return null;}}
  }return null;
}
function approvedPlayers(id,entries){
  const html=entries.filter(x=>typeof x?.url==='string').map(x=>`<iframe src="${x.url.replace(/[&"<>]/g,c=>({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]))}"></iframe>`).join('');
  return parseArabicServers(id,html);
}
export function safeTunisianFile(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='video.wixstatic.com'&&!u.username&&!u.password&&!u.port&&/^\/video\/[a-f0-9_]+\/(?:[0-9]+p\/)?mp4\/file\.mp4$/.test(u.pathname);}catch{return false;}}
function pSafeCommons(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='upload.wikimedia.org'&&!u.username&&!u.password&&!u.port&&/\.(?:webm|mp4)$/.test(u.pathname);}catch{return false;}}
function safeSourceHls(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.hostname!=='s2.savefiles.com'||u.username||u.password||u.port||!u.pathname.endsWith('.m3u8'))return false;const start=Number(u.searchParams.get('s')),duration=Number(u.searchParams.get('e'));return !start||!duration||(start+duration)*1000>Date.now();}catch{return false;}}
async function cimaWatchData(html){
  const slug=/const\s+watchPageSlug\s*=\s*["']([a-z0-9-]+)["']/.exec(html)?.[1]||/pageUrl\.includes\(["']([a-z0-9-]+)["']\)/.exec(html)?.[1];if(!slug)return null;
  const base='https://cimatnwatchingg.blogspot.com/feeds/pages/default?alt=json&max-results=150';
  const feed=JSON.parse(await arabicPage(base));
  const total=Number(feed.feed?.openSearch$totalResults?.$t||0);
  const more=await collectArabicPages(Array.from({length:Math.max(0,Math.ceil(total/150)-1)},(_,i)=>151+i*150),start=>arabicPage(`${base}&start-index=${start}`).then(JSON.parse));
  if(more.some(r=>r.status==='rejected'))throw new Error('CimaTN watch feed incomplete');
  const entries=[...(feed.feed?.entry||[]),...more.flatMap(r=>r.value.feed?.entry||[])];
  const entry=entries.find(e=>e.link?.some(l=>l.rel==='alternate'&&new URL(l.href).pathname===`/p/${slug}.html`));if(!entry)return null;
  const body=entry.content?.$t||'',series=dataLiteral(body,'seriesData');
  return series?{...series,sourceUrl:entry.link.find(l=>l.rel==='alternate').href}:{servers:dataLiteral(body,'servers')||[],sourceUrl:entry.link.find(l=>l.rel==='alternate').href};
}
async function getCimaDetails(id){
  const p=parseArabicId(id),html=await arabicPage(arabicUrl(id)),item=parseArabicDetails(id,html),data=await cimaWatchData(html);
  item.collections=['tunisian','arabic'];item.countries=['TN'];item.originalLanguage=null;
  if(p.type==='s'){
    item.episodes=cimaEpisodeEntries(data).map(([number,servers])=>{
      const episodeId=`sp:cimatn:e:${p.slug}:${number}`;return {id:episodeId,title:`الحلقة ${number}`,number:Number(number),season:null,sourceUrl:arabicUrl(id),offerings:[{provider:'cimatn',id:episodeId}]};
    });
  }
  item.episodeCount=item.episodes.length;return item;
}
export function cimaEpisodeEntries(data){
  const available=data?.availableEpisodes==null?null:Number(data.availableEpisodes);
  return Object.entries(data?.episodes||{}).filter(([key,servers])=>/^[1-9]\d*$/.test(key)&&(available===null||Number(key)<=available)&&Array.isArray(servers)&&servers.length);
}
async function fetchCimaPage({kind,page,search}){
  const label=kind==='series'?'مسلسلات تونسية':'أفلام تونسية',origin=ARABIC_PROVIDERS.cimatn.origin;
  // This small catalogue has many posts whose own watch pages are missing.
  // Filter a complete feed batch before paginating, so page one is usable.
  const url=`${origin}/feeds/posts/default${search?'':'/-/'+encodeURIComponent(label)}?alt=json&max-results=150&start-index=${(page-1)*150+1}${search?'&q='+encodeURIComponent(search):''}`;
  const data=JSON.parse(await arabicPage(url)),feed=data.feed;if(!feed)throw new Error('CimaTN feed unavailable');
  const items=[];
  for(const entry of feed.entry||[]){
    const source=entry.link?.find(l=>l.rel==='alternate')?.href,id=arabicId('cimatn',kind==='series'?'s':'m',source);if(!id)continue;
    const body=entry.content?.$t||'',watch=await cimaWatchData(body);
    const playable=kind==='series'?Object.keys(watch?.episodes||{}).length>0:!!watch?.servers?.length;
    const item=row(id,entry.title.$t,entry.media$thumbnail?.url?.replace('/s72-c/','/s640/'),{collection:'tunisian',country:'TN'});
    item.access=playable?'public':'catalogue-only';item.synopsis=parseArabicDetails(id,body).synopsis||'';
    item.publishedAt=entry.published?.$t;item.providerUpdatedAt=entry.updated?.$t;item.originalLanguage=null;
    // Blog publication date is not the film's release year.
    const match=/year[^>]*>\s*((?:19|20)\d{2})/i.exec(body),tagYear=entry.category?.find(c=>/^(?:19|20)\d{2}$/.test(c.term))?.term;item.year=tagYear?Number(tagYear):match?Number(match[1]):item.year;
    items.push(item);
  }
  const totalPages=Math.max(1,Math.ceil(Number(feed.openSearch$totalResults?.$t||feed.entry?.length||0)/150));return {items,page,totalPages,hasNext:page<totalPages,unavailablePosts:(feed.entry||[]).length-items.length};
}
