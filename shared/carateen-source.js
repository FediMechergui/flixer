// Public guest metadata contracts, shared with clients that cannot use the backend.
// Provider numeric IDs are never TMDB identities. Source fetch timestamps are not releases.
import {artworkUrl} from './artwork.js';
import {matchesSearch} from './search.js';

export const CARATEEN_ORIGIN='https://carateen.tv';
export const CARATEEN_PROVIDERS={carateen:{name:'Carateen',origin:CARATEEN_ORIGIN,kind:null,collections:['arabic','cartoons','anime','anime-sub','anime-dub']}};
const positive=value=>/^\d{1,12}$/.test(String(value))&&Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):null;
const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
const flag=value=>value===true||value===1||value==='1';
const unique=rows=>[...new Map(rows.map(row=>[row.id,row])).values()];
export function parseCarateenId(value){
  const m=/^sp:carateen:([mse]):(tg|sp)-([1-9]\d{0,11})(?::([1-9]\d{0,11}))?$/.exec(String(value));
  return m&&((m[1]==='e')===!!m[4])?{provider:'carateen',type:m[1],section:m[2],showId:Number(m[3]),slug:m[2]+'-'+m[3],...(m[4]?{episodeId:Number(m[4])}:{})}:null;
}
export function carateenUrl(value){const p=parseCarateenId(value);return p?`${CARATEEN_ORIGIN}/watch/${p.section==='sp'?'sp/':''}${p.showId}${p.type==='e'?'/'+p.episodeId:''}`:null;}
export function carateenIdFromUrl(value,kind){
  try{const u=new URL(value,CARATEEN_ORIGIN);if(u.origin!==CARATEEN_ORIGIN||u.username||u.password||u.port||u.search||u.hash)return null;
    const m=/^\/watch\/(sp\/)?([1-9]\d{0,11})(?:\/([1-9]\d{0,11}))?\/?$/.exec(u.pathname);if(!m||!m[3]&&!['film','series'].includes(kind))return null;
    return `sp:carateen:${m[3]?'e':kind==='film'?'m':'s'}:${m[1]?'sp':'tg'}-${m[2]}${m[3]?':'+m[3]:''}`;
  }catch{return null;}
}
function poster(value,section='sp',thumbnail=false){
  if(!value||typeof value!=='string')return null;
  if(section==='tg'&&!/^https?:|^\//.test(value)){if(!/^[a-zA-Z0-9_.-]+$/.test(value))return null;value='/assets/img/'+(thumbnail?'thumbnails':'posters')+'/'+value;}
  return artworkUrl(value,CARATEEN_ORIGIN);
}
function languages(label){
  label=clean(label);const dub=/مدبلج|دبلجة عربية|بالدبلجة العربية/.test(label),sub=/مترجم/.test(label),ja=/باللغة اليابانية/.test(label);
  return {...(dub?{audioLanguages:['ar']} :ja?{audioLanguages:['ja']}:{}),...(sub?{subtitleLanguages:['ar']}:{}),...((dub||sub)?{audioModes:[...(dub?['dub']:[]),...(sub?['sub']:[])]}:{})};
}
export function parseCarateenTitle(record,section){
  if(!['tg','sp'].includes(section)||!record||!positive(record.id))return null;
  if(section==='tg'&&(record.enabled===false||record.enabled===0||record.enabled==='0'))return null;
  const title=clean(section==='tg'?record.title:record.name);if(!title)return null;
  const category=clean(section==='tg'?record.category:record.planet_name);
  if(section==='tg'&&!/فيلم|مسلسل|برنامج/.test(category)||section==='sp'&&![0,1,false,true,'0','1'].includes(record.is_movie))return null;
  const kind=(section==='tg'?/فيلم/.test(category):flag(record.is_movie))?'film':'series',id=`sp:carateen:${kind==='film'?'m':'s'}:${section}-${positive(record.id)}`;
  const portrait=poster(section==='tg'?record.poster_cover||record.poster_cover_alt:record.cover_full_path,section);
  const explicitAnime=section==='sp'&&category==='شارع الأنمي';
  const collections=['arabic',...(explicitAnime?['anime']:['cartoons'])],audio=languages(category);
  if(explicitAnime)for(const mode of audio.audioModes||[])collections.push('anime-'+mode);
  const synopsis=clean(section==='tg'?record.description:record.pref);
  // Keywords include character names and genres, so they are search evidence only.
  const sourceSearchText=clean([title,category,section==='sp'?record.tags:'',section==='tg'?record.description_technical:''].join(' ')).slice(0,4000);
  return {id,title,kind,year:section==='tg'&&/^(?:18|19|20)\d{2}$/.test(String(record.release_year))?Number(record.release_year):null,altTitles:[],synopsis,portrait,poster:portrait?{custom:portrait}:null,
    sourceUrl:carateenUrl(id),channelId:'carateen',collections,tags:explicitAnime?['animation','anime']:['animation'],providerMetadata:true,documentary:false,access:'public',sourceSearchText,
    episodes:[],episodeCount:positive(section==='tg'?record.episodes_count_real||record.episodes_count:record.ep_count)||0,...audio,
    offerings:[{provider:'carateen',id,sourceUrl:carateenUrl(id),availability:'unverified',...audio}]};
}
export function parseCarateenCatalogue(records,section){
  if(!Array.isArray(records)||records.length>25000)throw Error('Carateen catalogue format changed');
  const items=unique(records.map(row=>parseCarateenTitle(row,section)).filter(Boolean));
  const malformed=records.some(row=>!(section==='tg'&&(row?.enabled===false||row?.enabled===0||row?.enabled==='0'))&&!parseCarateenTitle(row,section));
  return {items,...(malformed?{partial:true,providerErrors:[{provider:'carateen',error:'Malformed source catalogue records; cached data retained'}]}:{})};
}
function episodeNumber(title){const latin=clean(title).replace(/[٠-٩]/g,n=>'٠١٢٣٤٥٦٧٨٩'.indexOf(n));const m=/^(\d{1,5})\s*[.،:–-]/.exec(latin)||/^(?:الحلقة|Episode)\s+(\d{1,5})(?:\D|$)/i.exec(latin);return m?positive(m[1]):null;}
export function parseCarateenGuide(id,records){
  const p=parseCarateenId(id);if(!p||p.type==='e'||!Array.isArray(records)||records.length>20000)throw Error('Carateen episode guide format changed');
  const episodes=[];let malformed=false;
  for(const row of records){
    const internalId=positive(row?.id),episodeId=p.section==='sp'?positive(row?.slug):internalId,parent=positive(p.section==='sp'?row?.tv_series_id:row?.show_id);
    if(!internalId||!episodeId||parent!==p.showId){malformed=true;continue;}
    const eid=`sp:carateen:e:${p.slug}:${episodeId}`,title=clean(p.section==='sp'?row.pref:row.title),season=positive(row.season),number=p.type==='m'?null:p.section==='sp'?positive(row.number):episodeNumber(title),audio=languages(title);
    const duration=positive(row.duration),ep={id:eid,title:title||'Episode',season,number,sourceUrl:carateenUrl(eid),sourceEpisodeId:internalId,access:'public',...(duration?{durationSec:duration}:{}),...audio,
      offerings:[{provider:'carateen',id:eid,sourceUrl:carateenUrl(eid),...audio}]};
    const image=poster(p.section==='sp'?row.cover_full_path||row.cover:row.thumbnail,p.section,p.section==='tg');if(image)ep.thumbs={custom:image};
    // season 0 is explicitly the source's unclassified bucket; order_id is ordering only.
    episodes.push({ep,order:Number.isFinite(Number(row.order_id))?Number(row.order_id):episodes.length});
  }
  if(p.section==='tg')episodes.sort((a,b)=>a.order-b.order);
  return {episodes:unique(episodes.map(row=>row.ep)),episodesComplete:!malformed,...(malformed?{providerErrors:[{provider:'carateen',error:'Episode identity mismatch; cached guide retained'}]}:{})};
}
export function parseCarateenRecent(records,titles){
  if(!Array.isArray(records)||records.length>1000)throw Error('Carateen recent episodes format changed');
  const byId=new Map(titles.map(row=>[row.id,row])),groups=new Map();let malformed=false;
  for(const row of records){
    const showId=positive(row?.tv_series_id),titleId=`sp:carateen:s:sp-${showId}`,title=byId.get(titleId);if(!title){if(!byId.has(`sp:carateen:m:sp-${showId}`))malformed=true;continue;}
    const parsed=parseCarateenGuide(titleId,[row]);if(!parsed.episodes.length){malformed=true;continue;}
    const episode=parsed.episodes[0],item=groups.get(titleId)||{...title,episodes:[],episodesComplete:false,episodeUpdateFeed:true,latestEpisode:episode.id,recentEpisode:{id:episode.id,title:episode.title,season:episode.season,number:episode.number}};
    item.episodes.push(episode);groups.set(titleId,item);
  }
  return {items:[...groups.values()],...(malformed?{partial:true,providerErrors:[{provider:'carateen',error:'Unmatched recent episode records; cached updates retained'}]}:{})};
}
export function carateenMatchesSearch(row,query){return matchesSearch([row.title,...(row.altTitles||[]),row.sourceSearchText||''].join(' '),query);}
export function carateenMediaUrl(value){
  try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='pegasus.5387692.xyz'&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/api\/(?:hls\/[1-9]\d{0,11}|sp\/hls\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/playlist\.m3u8$/.test(u.pathname)?u.href:null;}catch{return null;}
}
