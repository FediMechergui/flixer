import {fetchOnePacePage} from '../server/src/onepace.js';
import {fetchOfficialPage} from '../server/src/youtube-originals.js';
import {providerCache,mergeCachedProviders,saveMergeReport} from '../server/src/provider-sync.js';
import {mergeShow} from '../server/src/merge-library.js';
import {readJson,writeJson} from '../server/src/store.js';
const cache=providerCache('flixer'),items=new Map(cache.items.map(r=>[r.id,r]));
function put(rows){for(const row of rows)items.set(row.id,row.id.startsWith('sp:onepace:')?row:items.has(row.id)?mergeShow(items.get(row.id),row):row);}
for(let page=1;page<=10;page++){try{const result=await fetchOnePacePage({page});put(result.items);console.log('One Pace',page,result.items.length,result.providerErrors||[]);if(!result.hasNext)break;}catch(e){console.warn(e.message);break;}}
for(let page=1;page<=3;page++){try{const result=await fetchOfficialPage({page});put(result.items);console.log('Official YouTube',page,result.items.length,result.providerErrors);if(!result.hasNext)break;}catch(e){console.warn(e.message);break;}}
cache.items=[...items.values()];cache.lastRefreshAt=new Date().toISOString();writeJson('providers-flixer.json',cache);
const base=readJson('flixer-catalog.json');if(!base?.shows?.length)throw Error('Restore the existing catalogue first');base.shows=base.shows.map(row=>row.id.startsWith('sp:onepace:')&&items.has(row.id)?items.get(row.id):row);const merged=mergeCachedProviders(base, 'flixer');saveMergeReport('flixer',merged.report);writeJson('flixer-catalog.json',merged.catalog);console.log('Saved',merged.catalog.shows.length,'titles');
