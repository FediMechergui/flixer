import test from 'node:test';
import assert from 'node:assert/strict';
import {dessinStreamServers,resolveDessinServers} from '../src/dessinanime.js';

test('DessinAnime preserves its exact source iframe and source context for device fallback',async()=>{
 const id='sp:dessinanime:e:456-les-simpson:1:1';
 const players=[{id:1106663,name:'Panda',url:'https://abysscdn.com/?v=KZlHvuRGx',direct:true,language:'VF'},{id:2210419,name:'Lecteur',url:'https://morencius.com/embed/ps00ei12kl2p',direct:false,language:'VOSTFR'},{id:999,name:'Invalid',url:'https://abysscdn.com.evil.example/?v=x',direct:true}];
 const row={id:'sp:dessinanime:s:456-les-simpson',episodes:[{id,cachedPlayers:players}]};
 const servers=await resolveDessinServers(id,{readSnapshot:async()=>row,readPage:async()=>{throw Error('A mapped episode must not require a protected HTML page');}});
 assert.equal(servers.length,2);assert.equal(servers[0].sourceEmbedUrl,players[0].url);assert.equal(servers[0].playerId,1106663);assert.equal(servers[0].embedUrl,undefined);
 assert.equal(servers[0].sourceOrigin,'https://dessinanime.cc');assert.equal(servers[0].headers.Referer,'https://dessinanime.cc/');assert.ok(servers[0].headers['User-Agent']);assert.deepEqual(servers[0].audioLanguages,['fr']);
 assert.equal(servers[1].type,'embed');assert.equal(servers[1].embedUrl,players[1].url);assert.deepEqual(servers[1].subtitleLanguages,['fr']);assert.equal(servers[1].audioLanguages,undefined);
 assert.equal(row.episodes[0].cachedPlayers.length,3);
});

test('DessinAnime retains the actual MP4 fallback supplied alongside an HLS source',()=>{
 const player={id:2271469,name:'Panda',language:'VF'},base='https://relay.dessinanime.cc/api/stream-relay/hydrax';
 const servers=dessinStreamServers(player,{type:'hls',url:base+'?manifest=1',fallback:{type:'mp4',url:base+'?quality=4',qualities:[{label:'720p',url:base+'?quality=4'},{label:'480p',url:base+'?quality=3'}]}});
 assert.deepEqual(servers.map(s=>s.type),['hls','mp4','mp4']);assert.equal(new Set(servers.map(s=>s.streamUrl)).size,3);assert.ok(servers.every(s=>s.headers.Referer==='https://dessinanime.cc/'));
 const invalid=dessinStreamServers(player,{type:'hls',url:base+'?manifest=1',fallback:{type:'mp4',url:'https://relay.dessinanime.cc.evil.example/private',qualities:'not an array'}});assert.equal(invalid.length,1);
 assert.deepEqual(dessinStreamServers(player,null),[]);
 const formats=dessinStreamServers(player,{type:'hls',url:base,fallback:{type:'mp4',url:base}});assert.deepEqual(formats.map(s=>s.type),['hls','mp4']);
 const bounded=dessinStreamServers(player,{type:'mp4',url:base,qualities:Array.from({length:100},(_,i)=>({label:String(i),url:base+'?quality='+i}))});assert.equal(bounded.length,9);
});
