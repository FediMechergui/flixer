// Provider metadata edits and crawl/check timestamps are not content updates.
export function contentFreshness(show,now=Date.now()){
 // Legacy source ISO dates omit a timezone. Preserve their published UTC
 // meaning instead of shifting the feed with the phone/server local timezone.
 const valid=value=>{const text=typeof value==='string'?value.trim():'',iso=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/.test(text)?text+'Z':text,stamp=Date.parse(iso);return Number.isFinite(stamp)&&stamp<=now+86400000?new Date(stamp).toISOString():'';};
 const episode=[valid(show.contentUpdatedAt),valid(show.latestAt)].sort().at(-1),published=valid(show.publishedAt),added=valid(show.firstSeenAt);
 const content=[episode,published].filter(Boolean).sort().at(-1)||'';
 return {at:content||added,kind:episode&&episode>=published&&show.kind==='series'?'episodes':published?'release':added?'added':'unknown'};
}

// Legacy contentUpdatedAt values include catalogue/guide import times. They
// cannot establish a release. Recent cards require a source feed, an actual
// publication date, or an advance observed after a complete guide baseline.
export function validContentDate(value, now=Date.now()) {
  const text=typeof value==='string'?value.trim():'';
  if(!/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(text))return '';
  const iso=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/.test(text)?text+'Z':text;
  const time=Date.parse(iso);
  return Number.isFinite(time)&&time<=now+86400000?new Date(time).toISOString():'';
}
export function validatedRecentUpdate(show, now=Date.now()) {
  const update=show?.recentUpdate;
  if(!update||!['episodes','release'].includes(update.kind)||!['feed','episode-date','guide-advance'].includes(update.source))return null;
  if(update.kind==='episodes'&&(show.kind!=='series'||typeof update.episodeId!=='string'||!update.episodeId||update.episodeId.length>1000))return null;
  if(update.kind==='release'&&update.source!=='feed')return null;
  const at=validContentDate(update.at,now),observedAt=validContentDate(update.observedAt,now);
  if(update.at&&!at||update.observedAt&&!observedAt||!at&&!observedAt&&update.source!=='feed')return null;
  return {kind:update.kind,source:update.source,at,...(observedAt?{observedAt}:{}),...(update.kind==='episodes'?{episodeId:update.episodeId}:{})};
}
export function recentFreshness(show, now=Date.now()) {
  const update=validatedRecentUpdate(show,now);
  const date=validContentDate;
  // A compact guide summary without a publication date is not evidence.
  const episodeDate=date(show.recentEpisode?.publishedAt,now);
  const published=date(show.publishedAt,now);
  const candidates=[...(published?[{at:published,kind:'release'}]:[]),...(show.kind==='series'&&episodeDate?[{at:episodeDate,kind:'episodes'}]:[]),...(update?[{at:update.at||update.observedAt||'',kind:update.kind}]:[])];
  return candidates.sort((a,b)=>b.at.localeCompare(a.at))[0]||{at:'',kind:'unknown'};
}
