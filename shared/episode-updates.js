// Source IDs and explicit episode coordinates are evidence; titles and crawl
// timestamps are not. These helpers also work on a partial provider guide.
const stamp = value => Number.isFinite(Date.parse(value || '')) ? Date.parse(value) : 0;
const ids = episode => [episode.id, ...(episode.offerings || []).map(row => row.id)].filter(Boolean);
const coordinate = episode => Number.isInteger(episode?.season) && episode.season >= 0 && Number.isInteger(episode?.number) && episode.number >= 0 ? [episode.season, episode.number] : null;
const compare = (a, b) => a[0] - b[0] || a[1] - b[1];

export function resolveEpisodeReference(show, reference = show.latestEpisode) {
  if (!reference) return null;
  const exact = (show.episodes || []).find(episode => ids(episode).includes(reference));
  if (exact) return exact;
  // HDToday and Frembed publish these explicit season/episode references.
  const match = /^(\d+):(\d+)$/.exec(String(reference)) || /^sp:frembed:e:\d+:(\d+):(\d+)$/.exec(String(reference));
  if (!match) return null;
  const matches = (show.episodes || []).filter(episode => episode.season === Number(match[1]) && episode.number === Number(match[2]));
  return matches.length === 1 ? matches[0] : null;
}

function referenceCoordinates(show) {
  const episode = resolveEpisodeReference(show) || (!show.episodes?.length && show.recentEpisode?.id===show.latestEpisode ? show.recentEpisode : null);
  if (episode) return coordinate(episode);
  const match = /^(\d+):(\d+)$/.exec(String(show.latestEpisode || '')) || /^sp:frembed:e:\d+:(\d+):(\d+)$/.exec(String(show.latestEpisode || ''));
  return match ? [Number(match[1]), Number(match[2])] : null;
}

export function newEpisodeContent(previous, incoming) {
  if (!previous || previous.kind !== 'series' || incoming.kind !== 'series') return [];
  const old = previous.episodes?.length ? previous.episodes : previous.recentEpisode && previous.recentEpisode.id===previous.latestEpisode ? [previous.recentEpisode] : [], knownIds = new Set([...old.flatMap(ids),previous.latestEpisode].filter(Boolean));
  const knownCoordinates = new Set(old.map(coordinate).filter(Boolean).map(value => value.join(':')));
  const previousPointer = referenceCoordinates(previous);
  const frontier = [...old.map(coordinate).filter(Boolean), ...(previousPointer ? [previousPointer] : [])].sort(compare).at(-1);
  const dated = old.map(episode => stamp(episode.publishedAt)).filter(Boolean);
  const latestPublished = dated.length ? Math.max(...dated) : 0;
  const sameSource = previous.id===incoming.id;
  const unknownNumbers = sameSource ? old.filter(episode => episode.season == null && Number.isInteger(episode.number)).map(episode => episode.number) : [];
  const unknownFrontier = unknownNumbers.length ? Math.max(...unknownNumbers) : null;
  return (incoming.episodes || []).filter(episode => {
    if (ids(episode).some(id => knownIds.has(id))) return false;
    const slot = coordinate(episode);
    if (slot && knownCoordinates.has(slot.join(':'))) return false;
    // A first full guide is discovery, not a new release. A previous latest
    // pointer can still prove that a subsequently published episode advanced.
    const firstFeedEpisode = incoming.episodeUpdateFeed===true && !previous.latestEpisode && ids(episode).includes(incoming.latestEpisode);
    if (!old.length && !previousPointer && !firstFeedEpisode) return false;
    if (slot && frontier && compare(slot, frontier) <= 0) return false;
    if (!slot && !sameSource && !(stamp(episode.publishedAt)>latestPublished && latestPublished)) return false;
    if (episode.season == null && Number.isInteger(episode.number) && unknownFrontier != null && episode.number <= unknownFrontier) return false;
    if (stamp(episode.publishedAt) && latestPublished && stamp(episode.publishedAt) <= latestPublished) return false;
    if (!slot && !Number.isInteger(episode.number) && !stamp(episode.publishedAt) && !ids(episode).includes(incoming.latestEpisode)) return false;
    return true;
  });
}

export function hasNewEpisodeContent(previous, incoming) {
  if (newEpisodeContent(previous, incoming).length) return true;
  if (!previous || previous.kind !== 'series' || incoming.kind !== 'series') return false;
  const before = referenceCoordinates(previous), after = referenceCoordinates(incoming);
  return !!before && !!after && compare(after, before) > 0;
}

export function selectLatestEpisode(existing, incoming, episodes) {
  if (!incoming.latestEpisode) return existing.latestEpisode;
  if (!existing.latestEpisode) return resolveEpisodeReference({episodes},incoming.latestEpisode)?.id || incoming.latestEpisode;
  const old = resolveEpisodeReference(existing), next = resolveEpisodeReference(incoming);
  const before = referenceCoordinates(existing), after = referenceCoordinates(incoming);
  const comparableUnknown = existing.id===incoming.id && old?.season==null && next?.season==null && Number.isInteger(old?.number) && Number.isInteger(next?.number);
  const newer = before && after ? compare(after, before) > 0 : comparableUnknown ? next.number>old.number : hasNewEpisodeContent(existing, incoming);
  const existingAt = Math.max(stamp(existing.contentUpdatedAt), stamp(existing.latestAt), stamp(old?.publishedAt));
  const incomingAt = Math.max(stamp(incoming.contentUpdatedAt), stamp(incoming.latestAt), stamp(next?.publishedAt));
  const sameSlot = before && after && compare(after, before) === 0;
  const useIncoming = !existing.latestEpisode || newer || (!before && !after && !comparableUnknown && incomingAt > existingAt) || (sameSlot && !old && next);
  const reference = useIncoming && incoming.latestEpisode ? incoming.latestEpisode : existing.latestEpisode || incoming.latestEpisode;
  return resolveEpisodeReference({episodes}, reference)?.id || reference;
}

export function compactRecentEpisode(show) {
  if (show.kind !== 'series') return null;
  const reference=show.recentUpdate?.kind==='episodes'?show.recentUpdate.episodeId:show.latestEpisode;
  const episode = resolveEpisodeReference(show,reference) || (!show.episodes?.length && show.recentEpisode?.id===reference ? show.recentEpisode : null);
  if (!episode) return null;
  const providerFromId = id => /^sp:([^:]+):/.exec(String(id))?.[1] || ({mf:'myflixer',fm:'fmovies',hd:'hdtoday'}[String(id).split(':')[0]]) || (/^[\w-]{11}$/.test(String(id)) ? 'youtube' : null);
  const providers = [...new Set([providerFromId(episode.id), ...(episode.providers || []), ...(episode.offerings || []).map(row => row.provider || providerFromId(row.id))].filter(Boolean))].sort();
  return {id:episode.id,title:String(episode.title || '').slice(0,240),season:Number.isInteger(episode.season) ? episode.season : null,number:Number.isInteger(episode.number) ? episode.number : null,...(episode.publishedAt ? {publishedAt:episode.publishedAt} : {}),providers};
}
