import fs from 'node:fs';import vm from 'node:vm';import {load} from 'cheerio';import test from 'node:test';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../../client-terrarium/js/arabic-source.js',import.meta.url),'utf8');
function document(html){const dom=load(html),element=n=>({getAttribute:key=>dom(n).attr(key)||null,textContent:dom(n).text()});return {querySelectorAll:selector=>dom(selector).toArray().map(element),querySelector:selector=>{const n=dom(selector).first()[0];return n?element(n):null;}};}
function fixture(respond){const requests=[],window={Capacitor:{isNativePlatform:()=>true,Plugins:{CapacitorHttp:{request:async options=>{requests.push(options);return respond(options);}}}}};vm.runInNewContext(source,{window,URL,TextDecoder,Uint8Array,atob,Date,DOMParser:class{parseFromString(html){return document(html);}}});return {api:window.FlixerArabicSource,requests};}
test('device Arabic lookup reconstructs a public source and follows only its published own watch link',async()=>{
 const id='sp:egydead:m:'+Buffer.from('/sample-2026/').toString('base64url'),f=fixture(options=>({status:200,url:options.url,data:options.url.endsWith('/watch/')?'<div class="mob-servers"><li data-link="https://hgcloud.to/e/example"></li><li data-link="https://evil.example/e/ad"></li></div>':'<div class="watchNow"><a href="/sample-2026/watch/">Play</a><a href="https://evil.example/watch/">Ad</a></div>'}));
 const rows=await f.api.resolve(id);assert.equal(rows.length,1);assert.equal(rows[0].provider,'egydead');assert.equal(f.requests.length,2);assert.ok(f.requests.every(r=>r.disableRedirects===true&&new URL(r.url).hostname==='tv10.egydead.live'));
 assert.equal(f.api.supports('sp:egydead:m:'+Buffer.from('/../admin/').toString('base64url')),false);
});
test('Tuniflix device wrappers retain every advertised host and cancelled callers do not poison the shared cache',async()=>{
 const f=fixture(options=>({status:200,url:options.url,data:new URL(options.url).pathname==='/'?'<iframe src="https://uqload.vc/embed-film.html"></iframe>':'<iframe src="/?trembed=0&trid=7&trtype=1"></iframe>'})),controller=new AbortController();controller.abort();
 assert.equal((await f.api.resolve('sp:tuniflix:m:test',{signal:controller.signal})).length,0);const rows=await f.api.resolve('sp:tuniflix:m:test');assert.equal(rows[0].provider,'tuniflix');assert.equal(new URL(rows[0].embedUrl).host,'uqload.vc');
});
test('Aloula device lookup requires guest access and accepts only the published public HLS CDN',async()=>{
 let access='guest',stream='https://clvod.itworkscdn.net/content/playlist.m3u8';const f=fixture(options=>({status:200,url:options.url,data:options.url.endsWith('/player')?{settings:{protocols:{hls:stream}}}:{blocks:[{id:'123',access}]}}));
 assert.equal((await f.api.resolve('sp:aloula:e:123',{fresh:true}))[0].type,'hls');access='member';assert.equal((await f.api.resolve('sp:aloula:e:123',{fresh:true})).length,0);access='guest';stream='https://127.0.0.1/private.m3u8';assert.equal((await f.api.resolve('sp:aloula:e:123',{fresh:true})).length,0);
});
