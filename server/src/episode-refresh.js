import {getFmoviesDetails} from './fmovies.js';
import {getTitleDetails} from './myflixer.js';
import {getSpecialistDetails,parseSpecialistId} from './specialist-providers.js';
import {mergeShow} from './merge-library.js';
import {hasNewEpisodeContent,newEpisodeContent,resolveEpisodeReference} from '../../shared/episode-updates.js';

const provider=row=>row.id.startsWith('mf:')?'myflixer':row.id.startsWith('fm:')?'fmovies':parseSpecialistId(row.id)?.provider;
async function resolve(row){if(row.id.startsWith('mf:'))return getTitleDetails(row.id);if(row.id.startsWith('fm:'))return getFmoviesDetails(row);return getSpecialistDetails(row.id,{fresh:true});}
export async function refreshSeriesEpisodes(rows,{limit=120,now=Date.now(),resolveDetails=resolve,intervalMs=2*3600000,skipProviders=new Set()}={}){
  const lanes=new Map(),report={checked:0,addedEpisodes:0,changedShows:0,errors:[]};
  for(const row of rows){const name=provider(row);if(row.kind!=='series'||!name||skipProviders.has(name)||row.access==='catalogue-only')continue;const checked=Date.parse(row.episodesCheckedAt||'')||0,modified=Math.max(...[row.contentUpdatedAt,row.latestAt,row.providerUpdatedAt].map(value=>Date.parse(value||'')||0));if(now-checked<intervalMs&&modified<=checked)continue;if(!lanes.has(name))lanes.set(name,[]);lanes.get(name).push(row);}
  for(const lane of lanes.values())lane.sort((a,b)=>(Date.parse(a.episodesCheckedAt||'')||0)-(Date.parse(b.episodesCheckedAt||'')||0)||String(b.providerUpdatedAt||b.latestAt||'').localeCompare(String(a.providerUpdatedAt||a.latestAt||'')));
  const jobs=[];while(jobs.length<limit&&[...lanes.values()].some(l=>l.length))for(const lane of lanes.values())if(lane.length&&jobs.length<limit)jobs.push(lane.shift());
  const updates=new Map();let cursor=0;
  await Promise.all(Array.from({length:Math.min(4,jobs.length)},async()=>{while(cursor<jobs.length){const row=jobs[cursor++],at=new Date(now).toISOString();try{
    const fresh=await resolveDetails(row);if(!fresh||fresh.id!==row.id||fresh.kind!=='series')throw Error('Episode refresh identity mismatch');
    const added=newEpisodeContent(row,fresh);
    const merged=mergeShow(row,fresh);merged.episodesCheckedAt=at;merged.detailsFetchedAt=at;
    report.addedEpisodes+=Math.max(0,merged.episodes.length-(row.episodes||[]).length);
    if(hasNewEpisodeContent(row,fresh)){
      const published=episode=>Date.parse(episode.publishedAt||'')||0;
      const latest=[...added].sort((a,b)=>published(b)-published(a)||(b.season??-1)-(a.season??-1)||(b.number??-1)-(a.number??-1))[0];
      if(latest)merged.latestEpisode=resolveEpisodeReference(merged,latest.id)?.id||latest.id;
      merged.providerUpdatedAt=at;merged.contentUpdatedAt=at;report.changedShows++;
    }
    updates.set(row.id,merged);report.checked++;
  }catch(error){updates.set(row.id,{...row,episodesCheckedAt:at});report.errors.push({id:row.id,provider:provider(row),error:error.message});}}}));
  return {items:rows.map(row=>updates.get(row.id)||row),report};
}
