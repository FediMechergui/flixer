// Provider metadata edits and crawl/check timestamps are not content updates.
export function contentFreshness(show,now=Date.now()){
 // Legacy source ISO dates omit a timezone. Preserve their published UTC
 // meaning instead of shifting the feed with the phone/server local timezone.
 const valid=value=>{const text=typeof value==='string'?value.trim():'',iso=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/.test(text)?text+'Z':text,stamp=Date.parse(iso);return Number.isFinite(stamp)&&stamp<=now+86400000?new Date(stamp).toISOString():'';};
 const episode=[valid(show.contentUpdatedAt),valid(show.latestAt)].sort().at(-1),published=valid(show.publishedAt),added=valid(show.firstSeenAt);
 const content=[episode,published].filter(Boolean).sort().at(-1)||'';
 return {at:content||added,kind:episode&&episode>=published&&show.kind==='series'?'episodes':published?'release':added?'added':'unknown'};
}
