import { parseHdtodayId, HDTODAY_BASE } from './hdtoday.js';

// A snapshot produced by an environment with ordinary upstream access. Never
// accept arbitrary fetch destinations or treat an old snapshot as a fresh scan.
export function validateHdtodayFeed(feed,{now=Date.now(),maxAgeMs=36*3600000}={}) {
  const at=Date.parse(feed?.updatedAt);
  if(feed?.version!==1 || feed.provider!=='hdtoday' || !Number.isFinite(at) || at>now+300000 || now-at>maxAgeMs || !Array.isArray(feed.items) || !feed.items.length || feed.items.length>100000)return null;
  const ids=new Set();
  for(const item of feed.items){
    const p=parseHdtodayId(item?.id);
    if(!p || p.season!==null || item.kind!==p.kind || typeof item.title!=='string' || !item.title.trim() || item.sourceUrl!==`${HDTODAY_BASE}/watch/${p.slug}` || ids.has(item.id))return null;
    if(!Array.isArray(item.offerings) || !Array.isArray(item.episodes) || item.episodes.some(e=>!e||typeof e!=='object'||!Array.isArray(e.offerings)))return null;
    ids.add(item.id);
    for(const offer of [ ...(item.offerings||[]),...(item.episodes||[]).flatMap(e=>e.offerings||[]) ]){
      const q=parseHdtodayId(offer?.id);
      if(offer.provider!=='hdtoday' || !q || q.slug!==p.slug)return null;
      if(offer.sourceUrl){try{const u=new URL(offer.sourceUrl);if(u.origin!==HDTODAY_BASE || u.pathname!==`/watch/${p.slug}` || u.username || u.password)return null;}catch{return null;}}
    }
    for(const episode of item.episodes){
      const q=parseHdtodayId(episode.id);if(!q || q.slug!==p.slug || q.season!==null && (q.season!==episode.season || q.number!==episode.number))return null;
      if(episode.sourceUrl){try{const u=new URL(episode.sourceUrl);if(u.origin!==HDTODAY_BASE || u.pathname!==`/watch/${p.slug}` || u.username || u.password)return null;}catch{return null;}}
    }
  }
  return feed;
}
