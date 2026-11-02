import {load} from 'cheerio';
import identities from '../seeds/dessinanimenet-identities.json' with {type:'json'};
import {artworkUrl} from '../../shared/artwork.js';
import {frenchSourceRequest} from './french-source-request.js';

export const DESSIN_NET_ORIGIN='https://dessinanime.net';
export const DESSIN_NET_PROVIDERS={dessinanimenet:{name:'DessinAnime.net',origin:DESSIN_NET_ORIGIN,kind:null,collections:['french','french-cartoons']}};
const request=frenchSourceRequest(DESSIN_NET_ORIGIN),clean=value=>String(value||'').replace(/\s+/g,' ').trim();
// Public title identities already used by Cartoony. Never use a search slug as a video ID.
const titleKey=value=>clean(value).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase();
const posterKey=value=>{try{return new URL(value).pathname.split('/').pop();}catch{return null;}};
export function parseDessinNetId(id){const m=/^sp:dessinanimenet:([mse]):([A-Za-z0-9]{16,64})(?::(\d{1,3}):([1-9]\d{0,4}))?$/.exec(String(id));return m&&((m[1]==='e')===!!m[3])?{provider:'dessinanimenet',type:m[1],slug:m[2],...(m[3]?{season:Number(m[3]),number:Number(m[4])}:{})}:null;}
export function dessinNetUrl(id){const p=parseDessinNetId(id);return p?`${DESSIN_NET_ORIGIN}/${p.type==='m'?'movie':p.type==='s'?'show':'episode'}/${p.slug}${p.type==='e'?`/season-${p.season}-episode-${p.number}`:''}`:null;}
export function dessinNetIdFromUrl(value){try{const u=new URL(value,DESSIN_NET_ORIGIN);if(u.origin!==DESSIN_NET_ORIGIN||u.username||u.password||u.search||u.hash)return null;const m=/^\/(movie|show|episode)\/([A-Za-z0-9]{16,64})(?:\/season-(\d{1,3})-episode-([1-9]\d{0,4}))?\/?$/.exec(u.pathname);const id=m&&`sp:dessinanimenet:${{movie:'m',show:'s',episode:'e'}[m[1]]}:${m[2]}${m[3]?`:${Number(m[3])}:${Number(m[4])}`:''}`;return parseDessinNetId(id)?id:null;}catch{return null;}}
function row(id,title,poster){const p=parseDessinNetId(id);return {id,title,kind:p.type==='m'?'film':'series',year:null,altTitles:[],poster:poster?{custom:poster}:null,portrait:poster,sourceUrl:dessinNetUrl(id),channelId:'dessinanimenet',collections:['french','french-cartoons'],tags:['animation'],providerMetadata:true,documentary:false,offerings:[{provider:'dessinanimenet',id,sourceUrl:dessinNetUrl(id)}],episodes:[],episodeCount:0};}
function posterUrl(value){const url=artworkUrl(value,DESSIN_NET_ORIGIN);if(!url)return null;const u=new URL(url);if(['www.themoviedb.org','themoviedb.org'].includes(u.hostname)&&/^\/t\/p\//.test(u.pathname))u.hostname='image.tmdb.org';return u.href;}
function posterOf($,element){return posterUrl($(element).find('img').first().attr('src')||/url\(['"]?([^'")]+)/.exec($(element).find('[style*="background-image"]').first().attr('style')||'')?.[1]);}
export function parseDessinNetList(html,{kind='series',page=1,search=false}={}){
  const $=load(html),items=new Map();
  $('.list-movie').each((_,element)=>{const card=$(element),link=card.find('a.list-title').attr('href')||card.find('a[href]').attr('href'),title=clean(card.find('.list-title').text()),poster=posterOf($,element);let id=dessinNetIdFromUrl(link);
    if(!id&&search&&title&&poster){try{const u=new URL(link,DESSIN_NET_ORIGIN),type=u.pathname.startsWith('/movie/')?'m':u.pathname.startsWith('/show/')?'s':null;
      const matches=identities.filter(r=>u.origin===DESSIN_NET_ORIGIN&&r[0]===type&&titleKey(r[2])===titleKey(title)&&r[3]?.split('/').pop()===posterKey(poster));if(matches.length===1)id=`sp:dessinanimenet:${type}:${matches[0][1]}`;
    }catch{}}
    if(!id||!parseDessinNetId(id)||parseDessinNetId(id).type==='e'||!title)return;const item=row(id,title,poster);if(!search&&item.kind!==kind)return;item.year=Number(/\b(?:19|20)\d{2}\b/.exec(card.find('.list-year').text())?.[0])||null;items.set(id,item);});
  // An empty source search is valid; a challenge or changed catalogue is not.
  if(!$('.list-movie').length&&!/aucun|no results|no content|pas de r[ée]sultat|0 r[ée]sultat/i.test($.text()))throw Error('DessinAnime.net listing format changed');
  const pages=$('a[href*="page="]').toArray().map(e=>{try{const u=new URL($(e).attr('href'),DESSIN_NET_ORIGIN);return u.origin===DESSIN_NET_ORIGIN?Number(u.searchParams.get('page'))||1:1;}catch{return 1;}}),totalPages=Math.max(page,...pages);
  return {items:[...items.values()],page,totalPages,hasNext:page<totalPages};
}
export async function fetchDessinNetPage({kind='series',page=1,search}={}){return parseDessinNetList(await request(`${search?'/search/'+encodeURIComponent(search):'/category/animation'}?page=${page}`),{kind,page,search:!!search});}
export function parseDessinNetDetails(id,html){
  const p=parseDessinNetId(id);if(!p||p.type==='e')throw Error('Invalid DessinAnime.net title');const $=load(html),title=clean($('h1').first().text());if(!title)throw Error('DessinAnime.net title missing');
  const canonical=$('link[rel="canonical"]').attr('href')||$('meta[property="og:url"]').attr('content');if(canonical&&dessinNetIdFromUrl(canonical)!==id)throw Error('DessinAnime.net identity mismatch');
  const poster=posterUrl($('meta[property="og:image"]').attr('content'))||posterOf($,$('h1').closest('.row'));
  const item=row(id,title,poster);item.synopsis=clean($('.video-attr .text-content').first().text());
  const field=label=>$('.video-attr').toArray().find(e=>clean($(e).find('.attr').text()).startsWith(label));
  item.year=Number(/\b(?:19|20)\d{2}\b/.exec($(field('Date de sortie')).find('.text').text())?.[0])||null;
  item.altTitles=$('h1').parent().children('font').map((_,e)=>clean($(e).text())).get().filter(t=>t&&t!==title);
  const seen=new Set();
  if(p.type==='m')item.episodes=[{id,title,season:1,number:1,sourceUrl:item.sourceUrl,offerings:item.offerings}];
  else $('a[href*="/episode/"]').each((_,e)=>{const a=$(e),eid=dessinNetIdFromUrl(a.attr('href')),ep=parseDessinNetId(eid);if(!ep||ep.type!=='e'||ep.slug!==p.slug||!a.find('.name').length||seen.has(eid))return;seen.add(eid);item.episodes.push({id:eid,title:clean(a.find('.name').text())||`Episode ${ep.number}`,season:ep.season,number:ep.number,sourceUrl:dessinNetUrl(eid),offerings:[{provider:'dessinanimenet',id:eid,season:ep.season,number:ep.number}]});});
  if(p.type==='s'&&!item.episodes.length)throw Error('DessinAnime.net did not expose this title episode guide');
  item.episodes.sort((a,b)=>a.season-b.season||a.number-b.number);item.episodeCount=item.episodes.length;item.seasons=[...new Set(item.episodes.map(e=>e.season))];item.episodesComplete=true;return item;
}
export async function getDessinNetDetails(id,options={}){return parseDessinNetDetails(id,await request(dessinNetUrl(id),options));}
export function parseDessinNetPlayers(reply){
  const $=load(reply),out=[];
  $('iframe[src]').each((_,e)=>{try{const u=new URL($(e).attr('src'));if(u.protocol!=='https:'||u.port||u.username||u.password)return;
    const xs=/^lecteur\d*\.xtremestream\.(?:co|com|net)$/.test(u.hostname)&&u.pathname==='/player/index.php'&&/^[A-Za-z0-9]+$/.test(u.searchParams.get('data')||'');
    const embed=u.hostname==='emmmmbed.com'&&/^\/embed\/[A-Za-z0-9_-]+$/.test(u.pathname);
    if(!xs&&!embed)return;
    const base={provider:'dessinanimenet',sourceOrigin:DESSIN_NET_ORIGIN};
    if(xs){const stream=new URL(u);stream.pathname='/player/xs1.php';out.push({...base,id:'dessinanimenet:hls:'+u.searchParams.get('data'),name:'DessinAnime.net · Direct',type:'hls',streamUrl:stream.href,headers:{Referer:u.origin+'/'}});}
    out.push({...base,id:'dessinanimenet:embed:'+out.length,name:'DessinAnime.net · '+u.hostname,type:'embed',embedUrl:u.href,sandbox:null});
  }catch{}});return out;
}
export async function resolveDessinNetServers(id,options={}){
  const p=parseDessinNetId(id);if(!p||p.type==='s')return [];const url=dessinNetUrl(id),html=await request(url,options),$=load(html);
  const canonical=$('link[rel="canonical"]').attr('href')||$('meta[property="og:url"]').attr('content');
  if(canonical&&dessinNetIdFromUrl(canonical)!==id){const u=new URL(canonical);if(p.type!=='e'||u.origin!==DESSIN_NET_ORIGIN||u.username||u.password||u.search||u.hash||!new RegExp(`^/show/${p.slug}-[1-9]\\d*-${p.season}-season-${p.number}-episode$`).test(u.pathname))throw Error('DessinAnime.net episode identity mismatch');}
  const ids=[...new Set($('[data-embed]').map((_,e)=>$(e).attr('data-embed')).get().filter(value=>/^[1-9]\d{0,12}$/.test(value)))];
  if(!ids.length)throw Error('No source players on DessinAnime.net episode');
  const results=await Promise.allSettled(ids.slice(0,8).map(playerId=>request('/ajax/embed',{...options,referer:url,body:new URLSearchParams({id:playerId,self:playerId}).toString()}).then(parseDessinNetPlayers)));
  const servers=[...new Map(results.flatMap(r=>r.status==='fulfilled'?r.value:[]).map(s=>[s.streamUrl||s.embedUrl,s])).values()];
  if(!servers.length)throw Error('DessinAnime.net players unavailable or unsupported');return servers;
}
