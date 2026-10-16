// Import a normally loaded source page exported as HTML. No verification cookies,
// challenge tokens or executable source scripts are imported.
import fs from 'node:fs';
import {parseDessinId,parseDessinPage} from '../server/src/dessinanime.js';
import {readJson,writeJson} from '../server/src/store.js';
const [id,file]=process.argv.slice(2);
if(!parseDessinId(id)||!file)throw Error('Usage: node scripts/import-dessinanime-page.js SOURCE_ID SOURCE_HTML');
const cache=readJson('providers-flixer.json',{items:[]}),p=parseDessinId(id),parent=`sp:dessinanime:${p.type==='m'?'m':'s'}:${p.slug}`,index=cache.items.findIndex(row=>row.id===parent);
const parsed=parseDessinPage(id,fs.readFileSync(file,'utf8'),index>=0?cache.items[index]:undefined);
if(index<0)cache.items.push(parsed);else cache.items[index]=parsed;
writeJson('providers-flixer.json',cache);
console.log(JSON.stringify({id:parsed.id,mappedEpisodes:parsed.episodes.length,sourceGuideEpisodes:parsed.sourceGuide?.length||0}));
