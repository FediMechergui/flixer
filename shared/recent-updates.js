import {recentFreshness} from './freshness.js';
import {compactRecentEpisode} from './episode-updates.js';

const provider = row => row.offerings?.[0]?.provider || /^sp:([^:]+):/.exec(String(row.id))?.[1] || ({mf:'myflixer',fm:'fmovies',hd:'hdtoday'}[String(row.id).split(':')[0]]) || row.channelId || 'other';

// Keep real chronology. Within the same observed update batch, rotate source
// lanes instead of letting provider insertion order monopolize the home page.
export function rankRecentTitles(rows, {limit = Infinity, now = Date.now()} = {}) {
  const unique = new Map();
  for (const row of rows || []) if (row?.id && !unique.has(row.id)) unique.set(row.id, row);
  const candidates = [...unique.values()].map(row => {const freshness=recentFreshness({...row,recentEpisode:compactRecentEpisode(row)},now);return {row,at:freshness.at,content:freshness.kind!=='unknown'};});
  // An empty verified feed stays empty. Catalogue imports and metadata checks
  // belong in Newly Added even when there are no known recent releases yet.
  const ranked = candidates.filter(entry=>entry.content).sort((a,b) => b.at.localeCompare(a.at) || String(a.row.id).localeCompare(String(b.row.id)));
  const result = [];
  for (let start=0; start<ranked.length && result.length<limit;) {
    let end=start+1;while(end<ranked.length && ranked[end].at===ranked[start].at)end++;
    const lanes = new Map();
    for(let i=start;i<end;i++){const row=ranked[i].row,key=provider(row);if(!lanes.has(key))lanes.set(key,[]);lanes.get(key).push(row);}
    const queues=[...lanes].sort(([a],[b])=>a.localeCompare(b)).map(([,lane])=>lane);
    for(let round=0;queues.some(lane=>round<lane.length)&&result.length<limit;round++)for(const lane of queues)if(round<lane.length&&result.length<limit)result.push(lane[round]);
    start=end;
  }
  return result;
}
