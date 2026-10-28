import test from 'node:test';import assert from 'node:assert/strict';
import {parseAloulaId,aloulaIdFromUrl,aloulaUrl,parseAloulaProgram,parseAloulaPlayer,getAloulaDetails} from '../src/aloula.js';
const program={id:'10',title:'برنامج',access:'guest',count_episodes:3,lastvideos:{regular:23},seasons:[{id:11}],description:'Source synopsis'};
test('Aloula identities, public access, metadata and media origins remain constrained',()=>{
 assert.equal(aloulaIdFromUrl(aloulaUrl('sp:aloula:s:10')),'sp:aloula:s:10');assert.equal(parseAloulaId('sp:aloula:e:../../secret'),null);assert.equal(aloulaIdFromUrl('https://evil.example/ar/title/10'),null);
 assert.equal(parseAloulaProgram(program).episodeCount,3);assert.equal(parseAloulaProgram({...program,access:'member'}),null);
 const data={settings:{protocols:{hls:'https://clvod.itworkscdn.net/file/playlist.m3u8'}}};assert.equal(parseAloulaPlayer(data,'sp:aloula:e:23').length,1);
 assert.equal(parseAloulaPlayer({...data,settings:{...data.settings,drm:true}},'sp:aloula:e:23').length,0);assert.equal(parseAloulaPlayer({settings:{protocols:{hls:'https://evil.example/playlist.m3u8'}}},'sp:aloula:e:23').length,0);
});
test('Aloula guide traverses sparse source pages, preserves numbering and rejects trailers, paid and foreign episodes',async()=>{
 const requests=[],row=await getAloulaDetails('sp:aloula:s:10',{fetchJson:async path=>{requests.push(path);if(path.includes('ott_program_details'))return [{programsobjects:[program]}];const page=new URLSearchParams(path.split('?')[1]).get('page'),n=page==='1'?1:3;return {blocks:[{paging:{last_page:2},projects:[{id:20+n,program_id:10,type:'regular',media_type:'video',episode:n,season_number:2,access:'guest'},{id:90,program_id:999,type:'regular',episode:8,access:'guest'},{id:91,program_id:10,type:'trailer',episode:8,access:'guest'},{id:92,program_id:10,type:'regular',episode:8,access:'member'}]}]};}});
 assert.deepEqual(row.episodes.map(e=>e.number),[1,3]);assert.equal(row.episodes[1].season,2);assert.equal(requests.length,3);assert.equal(row.episodesComplete,true);
});
