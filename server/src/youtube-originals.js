import {readPackedTitle} from './title-packs.js';
import {runtimeProviderSnapshot} from './runtime-source.js';
﻿import {Innertube} from 'youtubei.js';
import {createHash} from 'node:crypto';
import {parseDuration} from './text.js';
import {matchesSearch} from '../../shared/search.js';
import {matchesCollection} from '../../shared/collections.js';
import {mergeShow} from './merge-library.js';
export const OFFICIAL_CHANNELS=[
 {key:'watania',id:'UCdvWVsmQBROkgcGzVep73oA',name:'Watania Replay',format:'arabic',min:600,language:'ar',countries:['TN'],collections:['arabic','tunisian'],archiveQuery:'الحلقة',tags:['drama']},
 {key:'glitch',id:'UCn_FAXem2-e3HQvmK-mOH4g',name:'GLITCH',format:'glitch',min:600,language:'en',tags:['animation','comedy']},
 {key:'olydri',id:'UCdHXMcWxwZr2qQpdCCOcSkw',name:'Noob & Olydri',format:'noob',min:90,language:'fr',countries:['FR'],tags:['comedy','fantasy']},
 {key:'museasia',id:'UCGbshtvS9t-8CW11W7TooQg',name:'Muse Asia',format:'anime',min:600,tags:['animation','anime'],regional:true},
 {key:'anione',id:'UC0wNSTMWIL3qaorLx0jie6A',name:'Ani-One Asia',format:'anime',min:600,tags:['animation','anime'],regional:true},
 {key:'gundam',id:'UCejtUitnpnf8Be-v5NuDSLw',name:'GUNDAM CHANNEL INTL',format:'anime',min:600,tags:['animation','anime'],regional:true},
 {key:'youku',id:'UCI70JGG0hJS306Q-hGWfB7Q',name:'YOUKU English',format:'youku',min:1200,tags:['drama'],regional:true},
];
export const OFFICIAL_PROVIDERS={youtubeoriginals:{name:'Official YouTube shows',origin:'https://www.youtube.com',kind:null,collections:['youtube-shows','arabic','tunisian','anime','french','french-series','cdrama']}};
export function parseOfficialId(id){const m=/^sp:youtubeoriginals:([sm]):([a-z]+)-([a-f0-9]{16})$/.exec(String(id));const channel=m&&OFFICIAL_CHANNELS.find(c=>c.key===m[2]);return channel?{provider:'youtubeoriginals',type:m[1],slug:m[2]+'-'+m[3],channel,hash:m[3]}:null;}
export function officialIdFromUrl(value){try{const u=new URL(value),channel=OFFICIAL_CHANNELS.find(c=>u.pathname==='/channel/'+c.id+'/videos'),m=/^#flixer-(?:(m)-)?([a-f0-9]{16})$/.exec(u.hash);if(u.origin==='https://www.youtube.com'&&!u.search&&!u.username&&!u.password&&channel&&m)return 'sp:youtubeoriginals:'+(m[1]||'s')+':'+channel.key+'-'+m[2];}catch{}return null;}
export const officialUrl=id=>{const p=parseOfficialId(id);return p?`https://www.youtube.com/channel/${p.channel.id}/videos#flixer-${p.type==='m'?'m-':''}${p.hash}`:null;};
let client;const pages=new Map();
async function loadPage(channel,number,query=''){if(!client){client=Innertube.create({lang:'en',location:'US',retrieve_player:false});client.catch(()=>{client=undefined;});}const now=Date.now(),key=channel.id+':'+query;let saved=pages.get(key);if(!saved||now-saved.at>300000){saved={at:now,list:[]};pages.set(key,saved);}for(let i=0;i<number;i++){if(!saved.list[i])saved.list[i]=i===0?(await(await client).getChannel(channel.id))[query?'search':'getVideos'](query):saved.list[i-1].then(previous=>previous.has_continuation?previous.getContinuation():null);let result;try{result=await saved.list[i];}catch(error){pages.delete(key);throw error;}if(!result)return null;}return saved.list[number-1];}
async function pageFor(channel,number,query=''){let timer;try{return await Promise.race([loadPage(channel,number,query),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Official channel request timed out')),15000);})]);}finally{clearTimeout(timer);}}
export function arabicEpisodeNumber(value){
 const normalized=String(value||'').normalize('NFKC').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[\u064b-\u065f]/g,'').trim();
 const numeric=/^(\d{1,4})(?:\s|$)/.exec(normalized);if(numeric)return Number(numeric[1]);
 const values={اولي:1,اول:1,واحده:1,حاديه:1,حادي:1,ثاني:2,ثانيه:2,ثالث:3,ثالثه:3,رابع:4,رابعه:4,خامس:5,خامسه:5,سادس:6,سادسه:6,سابع:7,سابعه:7,ثامن:8,ثامنه:8,تاسع:9,تاسعه:9,عاشر:10,عاشره:10,عشر:10,عشره:10,عشرون:20,عشرين:20,ثلاثون:30,ثلاثين:30,اربعون:40,اربعين:40,خمسون:50,خمسين:50,ستون:60,ستين:60,سبعون:70,سبعين:70,ثمانون:80,ثمانين:80,تسعون:90,تسعين:90,مائه:100};
 let n=0;for(const word of normalized.replace(/و(?=ال)/g,' ').split(/\s+/).slice(0,4)){const key=word.replace(/^ال/,'');if(!values[key])break;n+=values[key];}return n||null;
}
export function mapOfficialVideo(node){const badges=node.content_image?.overlays?.flatMap(x=>x.badges||[])||[],duration=node.duration?.text||badges.find(b=>/^(?:\d+:)?\d+:\d+$/.test(b.text||''))?.text||'';return {id:node.content_id||node.id,title:node.metadata?.title?.text||node.title?.text||'',durationSec:parseDuration(duration),thumb:node.content_image?.image?.[0]?.url||node.thumbnails?.[0]?.url,restricted:!!node.is_upcoming||!!node.is_private||/Members only|Members-first|Upcoming/i.test(JSON.stringify(node.metadata||{}))||badges.some(b=>/member|upcoming|premium/i.test(b.text||''))};}
export function officialEpisode(channel,video){const title=String(video.title||'').trim();if(!/^[\w-]{11}$/.test(video.id)||video.restricted||video.durationSec<channel.min||/\b(?:trailer|teaser|preview|highlight|clip|compilation)\b|\b(?:opening|ending) theme\b/i.test(title))return null;let show,season=1,number,kind='series',altTitles=[];
 if(channel.format==='glitch'){const m=/^(THE AMAZING DIGITAL CIRCUS|MURDER DRONES|KNIGHTS OF GUINEVERE)\s*[:-]\s*(?:EP(?:ISODE)?\.?\s*(\d+)|PILOT)/i.exec(title);if(m){show=m[1].toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());number=Number(m[2]||1);}}
 else if(channel.format==='noob'){const m=/^NOOB\s*[:\-–]?\s*S(?:AISON)?\s*(\d+)\s*(?:[-: ]\s*)?(?:EP?|EPISODE)\s*0*(\d+)/i.exec(title);if(m){show='Noob';season=Number(m[1]);number=Number(m[2]);}}
 else if(channel.format==='anime'){const m=/^(?:\[[^\]]+\]\s*)?(.+?)\s*[-|]\s*(?:Episode|Ep\.?)\s*0*(\d+)(?!\d|[-–])/i.exec(title);if(m){show=m[1].trim();number=Number(m[2]);}}
 else if(channel.format==='youku'){const m=/[【\[]([^【】\[\]]{2,120})[】\]]\s*(?:EP|Episode)\s*0*(\d+)(?!\d|[-–])/i.exec(title);if(m){show=m[1].trim();number=Number(m[2]);}}
 else if(channel.format==='arabic'){
  if(/برومو|ملخص|كواليس|مقتطف|إعلان|اعلان|لقطات|تجميع/.test(title))return null;
  if(video.durationSec>=2400&&/(?:^|[|:–—-])\s*فيلم(?:\s|$)|^.+?\s+Film\s*[|]/i.test(title)&&!/الحلق[ةه]/.test(title)){
   const names=title.split('|').map(part=>part.trim().replace(/^فيلم\s*(?:كامل)?\s*[-–—:]?\s*/,'').replace(/\s+Film$/i,'').trim()).filter(Boolean);
   show=names.find(name=>/[\u0600-\u06ff]/.test(name))||names[0];altTitles=names.filter(name=>name!==show);kind='film';number=1;
  }else{
  const m=/^(.+?)\s*الحلق[ةه]\s+(.+)$/.exec(title);if(m){
   let prefix=m[1].replace(/^(?:مسلسل|سيتكوم|سلسلة|برنامج)\s+/,'').trim();const seasonMatch=/(?:الموسم|الجزء)\s+([^|:–—-]+)/.exec(prefix);
   season=seasonMatch?arabicEpisodeNumber(seasonMatch[1]):null;number=arabicEpisodeNumber(m[2]);
   if(seasonMatch)prefix=prefix.replace(seasonMatch[0],'');show=prefix.replace(/[\s|:–—-]+$/,'').trim();
   if(show==='شوفلي حل')altTitles=['Choufli Hal','Choufli 7al'];
  }
  }
 }
 if(!show||!number||season<0)return null;const hash=createHash('sha256').update(show.normalize('NFKC').toLowerCase()).digest('hex').slice(0,16),id=`sp:youtubeoriginals:${kind==='film'?'m':'s'}:${channel.key}-${hash}`,sub=/english sub|eng\s*sub|engsub/i.test(title),dub=/english dub|eng\s*dub/i.test(title),collections=['youtube-shows',...(channel.collections||[]),...(channel.language==='fr'?['french','french-series']:[]),...(channel.tags.includes('anime')?['anime']:[])];const offering={provider:'youtube',id:video.id,channelId:channel.id,sourceProvider:'youtubeoriginals',name:'YouTube - '+channel.name+(channel.regional?' (region availability varies)':'')};const episode={id:video.id,title,season,number,durationSec:video.durationSec,sourceUrl:'https://www.youtube.com/watch?v='+video.id,thumbs:{custom:video.thumb||`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`},audioModes:dub?['dub']:sub?['sub']:[],audioLanguages:dub?['en']:[],subtitleLanguages:sub?['en']:[],offerings:[offering]};return {id,title:show,altTitles,kind,year:channel.format==='noob'?2008:null,sourceUrl:officialUrl(id),channelId:'youtubeoriginals',originalLanguage:channel.language||null,countries:channel.countries||[],tags:channel.tags,collections,poster:{custom:episode.thumbs.custom},portrait:episode.thumbs.custom,providerMetadata:true,documentary:false,access:'public',episodes:[episode],episodeCount:1,audioModes:episode.audioModes,offerings:[{provider:'youtubeoriginals',id,sourceUrl:officialUrl(id)}]};}
const discovered=new Map();
export async function fetchOfficialPage({page=1,latest=false,kind='series',search,collection='',channelKey}={}){
 const channels=OFFICIAL_CHANNELS.filter(channel=>(!channelKey||channel.key===channelKey)&&(kind!=='film'||channel.format==='arabic')&&matchesCollection({kind:'series',collections:['youtube-shows',...(channel.collections||[])],originalLanguage:channel.language,countries:channel.countries,tags:channel.tags},collection));
 if(!channels.length)return {items:[],page,totalPages:1,hasNext:false};
 const rows=new Map(),results=await Promise.allSettled(channels.map(async channel=>{
  const sourceQuery=search||(!latest?(kind==='film'?'فيلم':channel.archiveQuery):'')||'',p=await pageFor(channel,latest?1:page,sourceQuery);if(!p)return false;
  const nodes=p.videos?.length?p.videos:p.page?.contents_memo?.get('LockupView')||[];
  for(const node of nodes){const row=officialEpisode(channel,mapOfficialVideo(node));if(!row||row.kind!==kind)continue;const old=rows.get(row.id);rows.set(row.id,old?mergeShow(old,row):row);const cached=discovered.get(row.id);discovered.set(row.id,cached?mergeShow(cached,row):row);}
  return p.has_continuation;
 }));
 while(discovered.size>2000)discovered.delete(discovered.keys().next().value);
 const items=[...rows.values()].filter(r=>(!search||matchesSearch([r.title,...(r.altTitles||[])].join(' '),search))&&matchesCollection(r,collection));
 const more=!latest&&results.some(r=>r.status==='fulfilled'&&r.value);
 if(results.every(r=>r.status==='rejected'))throw Error('Official YouTube channels temporarily unavailable: '+results[0].reason.message);
 return {items,page,partial:results.some(r=>r.status==='rejected'),hasNext:more,totalPages:page+(more?1:0),providerErrors:results.flatMap((r,i)=>r.status==='rejected'?[{provider:'youtubeoriginals',channel:channels[i].key,error:r.reason.message}]:[])};
}
export async function getOfficialDetails(id){if(!parseOfficialId(id))throw Error('Invalid official show ID');const {readLibrary}=await import('./library-service.js'),catalog=readLibrary(),saved=discovered.get(id)||(await runtimeProviderSnapshot(id))||readPackedTitle(id)||catalog.shows.flatMap(s=>[s,...(s.versions||[])]).find(s=>s.id===id||s.offerings?.some(o=>o.id===id));const existing=saved?{...saved,id,sourceUrl:officialUrl(id),channelId:'youtubeoriginals',offerings:[{provider:'youtubeoriginals',id,sourceUrl:officialUrl(id)}],episodes:(saved.episodes||[]).flatMap(e=>{const o=e.offerings?.find(o=>o.sourceProvider==='youtubeoriginals'&&o.channelId===parseOfficialId(id).channel.id);return o?[{...e,id:o.id,offerings:[o]}]:[]})}:null;try{const fresh=(await fetchOfficialPage({latest:true,channelKey:parseOfficialId(id).channel.key,kind:parseOfficialId(id).type==='m'?'film':'series',search:existing?.title})).items.find(r=>r.id===id);if(fresh)return existing?mergeShow(existing,fresh):fresh;}catch(e){if(!existing)throw e;}if(existing)return {...existing,access:existing.episodes.length?'public':'catalogue-only'};throw Error('Official show not found in the checked channel pages');}
