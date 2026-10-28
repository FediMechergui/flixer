// Provider metadata edits and crawl/check timestamps are not content updates.
export function contentFreshness(show,now=Date.now()){
 const valid=value=>{const stamp=Date.parse(value||'');return Number.isFinite(stamp)&&stamp<=now+86400000?new Date(stamp).toISOString():'';};
 const episode=valid(show.contentUpdatedAt)||valid(show.latestAt),published=valid(show.publishedAt),added=valid(show.firstSeenAt);
 const content=[episode,published].filter(Boolean).sort().at(-1)||'';
 return {at:content||added,kind:episode&&episode>=published&&show.kind==='series'?'episodes':published?'release':added?'added':'unknown'};
}
