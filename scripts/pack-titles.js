import fs from 'node:fs';
import {leanCatalog} from '../server/src/export-catalog.js';
﻿import {readJson} from '../server/src/store.js';
import {mergeCachedProviders} from '../server/src/provider-sync.js';
import {writeTitlePacks} from '../server/src/title-packs.js';
const base=readJson('flixer-catalog.json');if(!base?.shows?.length)throw Error('Restore the catalogue before packing titles');
const {catalog}=mergeCachedProviders(base,'flixer');console.log('[titles]',writeTitlePacks(catalog.shows));

const lean=leanCatalog(catalog,'flixer');
const runtime={...lean,packedTitles:true,shows:lean.shows.map(({episodes,...row})=>({...row,firstEpisodeId:episodes?.[0]?.id}))};
fs.writeFileSync(new URL('../server/deployment-flixer.json',import.meta.url),JSON.stringify(runtime));
console.log('[titles] compact runtime',runtime.shows.length,'titles');
