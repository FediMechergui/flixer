import test from 'node:test';import assert from 'node:assert/strict';
import {resolveArabicServers} from '../src/arabic-providers.js';
const id='sp:tuniflix:m:the-needle';
const readSnapshot=async()=>({id,episodes:[{id,cachedPlayers:[{type:'embed',embedUrl:'https://watch.easyvidplayer.com/e/previous'}]}]});
test('ordinary Tuniflix playback revalidates dated snapshot players without requiring manual refresh',async()=>{
 let calls=0;const rows=await resolveArabicServers(id,{readSnapshot,fetchPage:async url=>{calls++;return url.includes('/movie/')?'<iframe src="https://tuniflix.site/?trembed=0&amp;trid=1&amp;trtype=1"></iframe>':'<iframe src="https://uqload.vc/embed-current.html"></iframe>';}});
 assert.equal(calls,2);assert.equal(rows.length,1);assert.equal(new URL(rows[0].embedUrl).host,'uqload.vc');
});
test('Tuniflix retains identified cached links on transient failure, but not authoritative removal',async()=>{
 const rows=await resolveArabicServers(id,{readSnapshot,fetchPage:async()=>{throw Error('Arabic source HTTP 503');}});
 assert.equal(rows[0].cached,true);assert.equal(new URL(rows[0].embedUrl).host,'watch.easyvidplayer.com');
 const wrapperFailure=await resolveArabicServers(id,{readSnapshot,fetchPage:async url=>{if(url.includes('/movie/'))return '<iframe src="https://tuniflix.site/?trembed=0&amp;trid=1&amp;trtype=1"></iframe>';throw Error('Arabic source HTTP 503');}});
 assert.equal(wrapperFailure[0].cached,true);
 await assert.rejects(resolveArabicServers(id,{readSnapshot,fetchPage:async()=>{throw Error('Arabic source HTTP 404');}}),/404/);
 await assert.rejects(resolveArabicServers(id,{readSnapshot,fresh:true,fetchPage:async()=>{throw Error('Arabic source HTTP 503');}}),/503/);
});
