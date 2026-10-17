import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('native failure reporting and accepted player messages cover the same trusted origins',()=>{
 const player=fs.readFileSync(new URL('../../client-terrarium/js/player.js',import.meta.url),'utf8'),activity=fs.readFileSync(new URL('../../mobile/android/app/src/main/java/app/flixer/stream/MainActivity.java',import.meta.url),'utf8');
 const list=/const trusted=\[([^\]]+)\]/.exec(player)?.[1];assert.ok(list);
 const origins=[...list.matchAll(/["'](https:\/\/[^"']+)["']/g)].map(m=>m[1]);assert.ok(origins.includes('https://engifuosi.com'));assert.ok(origins.includes('https://vidsrc.mov'));for(const origin of origins)assert.ok(activity.includes('"'+origin+'"'),origin+' must have native health reporting');
 assert.ok(player.includes('event.source!==frame.contentWindow'));assert.ok(player.includes('data-close-player'));
});
