import {load} from 'cheerio';
import {parseDessinId,parseDessinPage,dessinUrl,dessinPlayers,DESSIN_ORIGIN} from './dessinanime.js';
import {mergeShow} from './merge-library.js';

const parent=id=>{const p=parseDessinId(id);return p?`sp:dessinanime:${p.type==='m'?'m':'s'}:${p.slug}`:null;};
export function validateDessinMetadata(row){
 const p=parseDessinId(row?.id);
 if(!p||p.type==='e'||row.kind!==(p.type==='m'?'film':'series')||row.sourceUrl!==dessinUrl(row.id)||!row.title)throw Error('Invalid DessinAnime title identity');
 if(!Number.isFinite(Date.parse(row.detailsFetchedAt)))throw Error('Missing DessinAnime verification time');
 const guide=new Map((row.sourceGuide||[]).map(e=>[e.id,e]));
 for(const episode of guide.values()){const ep=parseDessinId(episode.id);if(!ep||parent(episode.id)!==row.id||episode.sourceUrl!==dessinUrl(episode.id)||row.kind==='series'&&(ep.type!=='e'||ep.season!==episode.season||ep.number!==episode.number))throw Error('Invalid DessinAnime source guide');}
 for(const episode of row.episodes||[]){const ep=parseDessinId(episode.id),slot=guide.get(episode.id);
  if(!ep||parent(episode.id)!==row.id||episode.sourceUrl!==dessinUrl(episode.id)||row.kind==='series'&&(!slot||ep.type!=='e'||ep.season!==episode.season||ep.number!==episode.number||slot.season!==episode.season||slot.number!==episode.number))throw Error('Invalid DessinAnime episode identity');
  if(!episode.cachedPlayers?.length||dessinPlayers(episode.cachedPlayers).length!==episode.cachedPlayers.length||!episode.offerings?.every(o=>o.provider==='dessinanime'&&o.id===episode.id))throw Error('Invalid DessinAnime source players');
 }
 return row;
}
export function mergeDessinMetadata(old,row){
 validateDessinMetadata(row);if(!old)return row;if(old.id!==row.id)throw Error('DessinAnime merge identity mismatch');
 const newer=!old.detailsFetchedAt||Date.parse(row.detailsFetchedAt)>=Date.parse(old.detailsFetchedAt);
 const checks={...old.dessinPlayerChecks};for(const [id,check]of Object.entries(row.dessinPlayerChecks||{}))if(!checks[id]||Date.parse(check.at)>=Date.parse(checks[id].at))checks[id]=check;
 const incoming={...row,episodes:row.episodes.filter(e=>!(checks[e.id]?.hasPlayers===false&&Date.parse(checks[e.id].at)>=Date.parse(row.detailsFetchedAt))&&(newer||!old.episodes?.some(previous=>previous.id===e.id)))};
 const retainedEpisodes=(old.episodes||[]).filter(e=>!(checks[e.id]?.hasPlayers===false&&(!old.detailsFetchedAt||Date.parse(checks[e.id].at)>=Date.parse(old.detailsFetchedAt))));
 const retained={...old,access:retainedEpisodes.length?'public':'catalogue-only',episodes:retainedEpisodes};
 const merged=mergeShow(retained,incoming);
 return {...merged,access:merged.episodes.length?'public':'catalogue-only',detailsFetchedAt:newer?row.detailsFetchedAt:old.detailsFetchedAt,episodesComplete:newer?row.episodesComplete:old.episodesComplete,sourceGuide:newer?row.sourceGuide:old.sourceGuide||row.sourceGuide,dessinPlayerChecks:checks,dessinBrowserCheckedAt:[old.dessinBrowserCheckedAt,row.dessinBrowserCheckedAt].filter(Boolean).sort().at(-1)};
}
function verifiedHtml(id,response){
 const expected=new URL(dessinUrl(id)),actual=new URL(response.url||expected.href);
 if(actual.origin!==DESSIN_ORIGIN||actual.username||actual.password||actual.pathname.replace(/\/$/,'')!==expected.pathname.replace(/\/$/,''))throw Error('DessinAnime source identity changed');
 if(response.status===403||/\<title[^>]*>\s*Just a moment/i.test(response.html||''))throw Error('DessinAnime browser verification required');
 if(response.status!==200)throw Error('DessinAnime browser HTTP '+response.status);
 if(typeof response.html!=='string'||response.html.length>8*1024*1024)throw Error('DessinAnime page is too large or empty');
 return response.html;
}
export function dessinWatchEpisode(id,html){
 const p=parseDessinId(id);if(p?.type!=='s')return null;const $=load(html);
 for(const el of $('a[href]').toArray())try{const u=new URL($(el).attr('href'),DESSIN_ORIGIN),prefix=`/tv/${encodeURIComponent(p.slug)}/`;
  if(u.origin!==DESSIN_ORIGIN||u.username||u.password||u.search||u.hash||!u.pathname.startsWith(prefix))continue;
  const match=/^(\d{1,3})\/([1-9]\d{0,4})\/?$/.exec(u.pathname.slice(prefix.length));if(match)return `sp:dessinanime:e:${p.slug}:${Number(match[1])}:${Number(match[2])}`;
 }catch{}return null;
}
// Read-only browser requests supply HTML. No cookies, account state, player-ID
// enumeration or challenge code is read or exported by this collector.
export async function collectDessinMetadata({titles,readPage,onRecord=()=>{},pageBudget=48,latestFirst=false,now=()=>new Date().toISOString()}){
 if(!Number.isSafeInteger(pageBudget)||pageBudget<1||pageBudget>500)throw Error('Invalid DessinAnime page budget');
 const report={format:1,startedAt:now(),pages:0,items:[],errors:[],verificationRequired:false},states=[];
 const failed=(id,error)=>{report.errors.push({id,error:error.message});if(/verification required/.test(error.message))report.verificationRequired=true;if(/Browser disconnected|Browser operation timed out|Source browser left DessinAnime/.test(error.message))report.unavailable=true;};
 const read=async id=>{report.pages++;return verifiedHtml(id,await readPage(dessinUrl(id)));};
 const save=async(state,parsed,checkedId)=>{
  if(checkedId)parsed={...parsed,dessinPlayerChecks:{...parsed.dessinPlayerChecks,[checkedId]:{at:now(),hasPlayers:!!parsed.episodes?.find(e=>e.id===checkedId)?.cachedPlayers?.length}}};
  state.row=mergeDessinMetadata(state.row,parsed);
  const index=report.items.findIndex(row=>row.id===state.row.id);if(index<0)report.items.push(state.row);else report.items[index]=state.row;
  await onRecord(report);
 };
 for(const row of titles){if(report.pages>=pageBudget)break;const p=parseDessinId(row.id);if(!p||p.type==='e')throw Error('Collector requires source title identities');const state={row:{...row,offerings:[{provider:'dessinanime',id:row.id,sourceUrl:dessinUrl(row.id)}],episodes:(row.episodes||[]).filter(e=>parent(e.id)===row.id&&e.cachedPlayers?.length).map(e=>({...e,offerings:[{provider:'dessinanime',id:e.id}]}))},failed:new Set()};
  try{const html=await read(row.id);let parsed;try{parsed=parseDessinPage(row.id,html,{...state.row,episodes:[]});}catch(error){const episode=dessinWatchEpisode(row.id,html);if(!episode||report.pages>=pageBudget)throw error;parsed=parseDessinPage(episode,await read(episode),{...state.row,episodes:[]});await save(state,parsed,episode);}
   if(parsed&&report.items.find(r=>r.id===row.id)!==state.row)await save(state,parsed,p.type==='m'?row.id:undefined);
   state.recent=latestFirst?[...(state.row.sourceGuide||[])].sort((a,b)=>b.season-a.season||b.number-a.number).slice(0,2).filter(e=>state.row.episodes?.some(old=>old.id===e.id)&&!(Date.parse(now())-Date.parse(state.row.dessinPlayerChecks?.[e.id]?.at)<21600000)):[];states.push(state);
  }catch(error){failed(row.id,error);if(report.verificationRequired||report.unavailable)break;}
 }
 while(report.pages<pageBudget&&!report.verificationRequired&&!report.unavailable){let progressed=false;
  for(const state of states){if(report.pages>=pageBudget)break;if(state.row.kind!=='series')continue;const known=new Set((state.row.episodes||[]).filter(e=>e.cachedPlayers?.length).map(e=>e.id));
   const guide=latestFirst?[...(state.row.sourceGuide||[])].sort((a,b)=>b.season-a.season||b.number-a.number):state.row.sourceGuide||[];
   const episode=state.recent.shift()||guide.find(e=>!known.has(e.id)&&!state.failed.has(e.id)&&!(state.row.dessinPlayerChecks?.[e.id]?.hasPlayers===false&&Date.parse(now())-Date.parse(state.row.dessinPlayerChecks[e.id].at)<86400000));if(!episode)continue;progressed=true;
   try{const parsed=parseDessinPage(episode.id,await read(episode.id),{...state.row,episodes:[]});if(!parsed.episodes?.some(e=>e.id===episode.id&&e.cachedPlayers?.length))state.failed.add(episode.id);await save(state,parsed,episode.id);}
   catch(error){state.failed.add(episode.id);failed(episode.id,error);if(report.verificationRequired||report.unavailable)break;}
  }if(!progressed)break;
 }
 report.finishedAt=now();await onRecord(report);return report;
}
