import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseDessinId,dessinUrl,parseDessinPage,dessinStreamServers,dessinPlayers} from '../src/dessinanime.js';
const id='sp:dessinanime:s:456-les-simpson',eid='sp:dessinanime:e:456-les-simpson:1:3';
const player={id:1106663,name:'Panda',url:'https://abysscdn.com/?v=abc',direct:true,language:'VF'};
const record={playbackKey:'1-3',context:{media:{id:14799,slug:'456-les-simpson',title:'Les Simpson',tmdbId:456,mediaType:'TV'},season:{seasonNumber:1},episode:{episodeNumber:3}},players:[player],guide:{slug:'456-les-simpson',seasons:[{mediaTmdbId:456,seasonNumber:1,episodes:[{id:9,episodeNumber:3,title:'Third',runtime:24}]}]}};
const html=value=>`<script>self.__next_f.push(${JSON.stringify([1,'1:'+JSON.stringify(value)+'\n'])})</script>`;
test('DessinAnime maps source JSON episode identities and sparse numbering without executing scripts',()=>{
 const parsed=parseDessinPage(eid,html(record));assert.equal(parsed.id,id);assert.equal(parsed.tmdbId,456);assert.equal(parsed.access,'public');assert.deepEqual(parsed.episodes.map(e=>[e.season,e.number]),[[1,3]]);assert.equal(parsed.episodes[0].cachedPlayers[0].id,1106663);assert.equal(parsed.episodes[0].durationSec,1440);
 assert.equal(dessinUrl(eid),'https://dessinanime.cc/tv/456-les-simpson/1/3');assert.equal(parseDessinId(id+':1:3'),null);assert.equal(parseDessinId('sp:dessinanime:e:456-les-simpson:1:../3'),null);
 assert.throws(()=>parseDessinPage(eid.replace(':1:3',':1:4'),html(record)),/identity/);assert.throws(()=>parseDessinPage(eid,html({...record,context:{...record.context,media:{...record.context.media,slug:'wrong'}}})),/identity/);
 assert.throws(()=>parseDessinPage(eid,'<script>self.__next_f.push(alert(1))</script>'),/identity/);
});
test('DessinAnime direct streams use the real anonymous API relay and explicit audio labels',()=>{
 const url='https://relay.dessinanime.cc/api/stream-relay/hydrax?m=1';const servers=dessinStreamServers(player,{type:'mp4',url,qualities:[{label:'720p',url},{label:'1080p',url:url+'&q=5'},{label:'bad',url:'https://127.0.0.1/private'}]});assert.equal(servers.length,2);assert.equal(servers[0].type,'mp4');assert.deepEqual(servers[0].audioLanguages,['fr']);assert.equal(servers[0].embedUrl,undefined);
 assert.equal(dessinStreamServers(player,{type:'mp4',url:'https://relay.dessinanime.cc.evil.org/api/stream-relay/a'}).length,0);assert.equal(dessinStreamServers(player,{type:'html',url}).length,0);assert.equal(dessinPlayers([{...player,url:'https://evil.org/embed'}]).length,0);
 assert.equal(dessinStreamServers({...player,language:'MULTI'},{type:'mp4',url})[0].audioLanguages,undefined);
 const app=fs.readFileSync(new URL('../../client-terrarium/js/app.js',import.meta.url),'utf8');assert.equal(app.includes('Play on source'),false);
});
