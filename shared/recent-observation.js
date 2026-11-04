import {newEpisodeContent,resolveEpisodeReference} from './episode-updates.js';
import {validContentDate,validatedRecentUpdate} from './freshness.js';

const episodeIds=episode=>[episode?.id,...(episode?.offerings||[]).map(row=>row.id)].filter(Boolean);
const coordinates=episode=>Number.isInteger(episode?.season)&&Number.isInteger(episode?.number)?[episode.season,episode.number]:null;
function sameEpisode(a,b,referenceA,referenceB) {
  if(referenceA===referenceB)return true;
  const first=resolveEpisodeReference(a,referenceA),second=resolveEpisodeReference(b,referenceB);
  if(first&&second&&episodeIds(first).some(id=>episodeIds(second).includes(id)))return true;
  const x=coordinates(first),y=coordinates(second);
  return !!x&&!!y&&x[0]===y[0]&&x[1]===y[1];
}
function olderEpisode(a,b,referenceA,referenceB) {
  const first=resolveEpisodeReference(a,referenceA),second=resolveEpisodeReference(b,referenceB);
  const x=coordinates(first),y=coordinates(second);
  if(x&&y)return y[0]<x[0]||y[0]===x[0]&&y[1]<x[1];
  return a.id===b.id&&first?.season==null&&second?.season==null&&Number.isInteger(first?.number)&&Number.isInteger(second?.number)&&second.number<first.number;
}
export function mergeRecentEvidence(previous,incoming,now=Date.now()) {
  if(incoming.id===previous.id&&incoming.recentUpdate===null)return null;
  const old=validatedRecentUpdate(previous,now),next=validatedRecentUpdate(incoming,now);
  if(!next)return old;
  if(!old)return next;
  if(old.kind==='episodes'&&next.kind==='episodes') {
    if(sameEpisode(previous,incoming,old.episodeId,next.episodeId))return {...next,...old,at:next.at||old.at};
    if(olderEpisode(previous,incoming,old.episodeId,next.episodeId))return old;
  }
  const oldAt=old.at||old.observedAt||'',nextAt=next.at||next.observedAt||'';
  return nextAt>oldAt?next:old;
}

// Turn an observation into a stable, reviewable event. Checking a catalogue or
// discovering a first/partial guide cannot manufacture release chronology.
export function observeRecentUpdate(previous,incoming,observedAt=new Date().toISOString()) {
  const now=Math.max(Date.now(),Date.parse(observedAt)||0),old=previous&&validatedRecentUpdate(previous,now);
  let update=validatedRecentUpdate(incoming,now);
  if(old&&update&&JSON.stringify(old)===JSON.stringify(update))update=null;
  if(!update&&incoming.episodeUpdateFeed===true&&incoming.latestEpisode) {
    const ep=resolveEpisodeReference(incoming);
    if(ep)update={kind:'episodes',source:'feed',at:validContentDate(ep.publishedAt,now),episodeId:ep.id};
  }
  if(!update&&incoming.kind==='series') {
    const dated=(incoming.episodes||[]).map(episode=>({episode,at:validContentDate(episode.publishedAt,now)})).filter(row=>row.at).sort((a,b)=>b.at.localeCompare(a.at));
    if(dated.length)update={kind:'episodes',source:'episode-date',at:dated[0].at,episodeId:dated[0].episode.id};
    else if(previous?.id===incoming.id&&previous.episodesComplete===true&&incoming.episodesComplete===true) {
      const added=newEpisodeContent(previous,incoming).sort((a,b)=>(b.season??-1)-(a.season??-1)||(b.number??-1)-(a.number??-1));
      if(added.length)update={kind:'episodes',source:'guide-advance',at:'',observedAt,episodeId:added[0].id};
    }
  }
  if(!update)return old||null;
  if(update.source==='feed'&&!update.at&&!update.observedAt)update={...update,observedAt};
  return previous?mergeRecentEvidence(previous,{...incoming,recentUpdate:update},now):update;
}
