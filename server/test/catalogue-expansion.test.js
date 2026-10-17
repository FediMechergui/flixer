import test from 'node:test';
import assert from 'node:assert/strict';
import {leanCatalog} from '../src/export-catalog.js';
import {matchesCollection} from '../../shared/collections.js';
import {OFFICIAL_CHANNELS,officialEpisode,officialIdFromUrl,officialUrl,mapOfficialVideo} from '../src/youtube-originals.js';
import {parseOnePaceId,parseOnePaceArcs,parseOnePaceFiles} from '../src/onepace.js';
test('regional filters distinguish drama, anime and French Canadian origin',()=>{
 assert.equal(matchesCollection({kind:'series',countries:['JP'],tags:['animation']},'jdrama'),false);
 assert.equal(matchesCollection({kind:'series',countries:['JP']},'jdrama'),true);
 assert.equal(matchesCollection({kind:'series',countries:['TW']},'cdrama'),true);
 assert.equal(matchesCollection({kind:'series',countries:['FR'],originalLanguage:'fr'},'french-canadian'),false);
 assert.equal(matchesCollection({kind:'series',countries:['CA'],originalLanguage:'fr'},'french-canadian'),true);
});
test('official shows retain verified episodes and reject promotional or restricted videos',()=>{
 const channel=OFFICIAL_CHANNELS.find(c=>c.key==='glitch'),v={id:'abcdefghijk',title:'THE AMAZING DIGITAL CIRCUS - Ep 2',durationSec:1200};
 const row=officialEpisode(channel,v);assert.equal(row.episodes[0].number,2);assert.equal(officialIdFromUrl(officialUrl(row.id)),row.id);
 assert.equal(officialIdFromUrl(officialUrl(row.id).replace('www.youtube.com','evil.example')),null);
 for(const extra of [{restricted:true},{durationSec:30},{title:v.title+' Trailer'}])assert.equal(officialEpisode(channel,{...v,...extra}),null);
 const anime=OFFICIAL_CHANNELS.find(c=>c.key==='museasia');assert.equal(officialEpisode(anime,{...v,title:'Anime - Episode 07-10'}),null);
 const noob=officialEpisode(OFFICIAL_CHANNELS.find(c=>c.key==='olydri'),{...v,title:'NOOB : S09 EP02'});assert.equal(noob.episodes[0].season,9);
 const modern=mapOfficialVideo({content_id:v.id,metadata:{title:{text:v.title}},content_image:{overlays:[{badges:[{text:'20:00'}]}]}});assert.equal(modern.durationSec,1200);
});
test('One Pace imports actual MP4 episodes and validates file-list identities',()=>{
 const html='<main><ol><li id="romance-dawn"><h2>Romance Dawn</h2><p>Arc synopsis</p><ul><li>English Subtitles<ul><li><a href="https://pixeldrain.net/l/ABCDEFGH">720p</a></li><li><a href="https://evil.example/l/ABCDEFGH">1080p</a></li></ul></li></ul></li></ol></main>';
 const arc=parseOnePaceArcs(html)[0];assert.equal(arc.links.length,1);const variant=arc.links[0];
 const file={id:'12345678',name:'[One Pace] Romance Dawn 02 [720p].mp4',mime_type:'video/mp4'};
 const rows=parseOnePaceFiles(arc,variant,{success:true,id:'ABCDEFGH',files:[file,{...file,id:'87654321',mime_type:'video/x-matroska'},{...file,availability:'deleted'},{...file,embed_domains:['onepace.net']},{...file,allow_video_player:false}]});
 assert.equal(rows.length,1);assert.equal(rows[0].number,2);assert.deepEqual(rows[0].subtitleLanguages,['en']);assert.equal(parseOnePaceId(rows[0].id).fileId,file.id);
 assert.throws(()=>parseOnePaceFiles(arc,variant,{success:true,id:'mismatch',files:[file]}));assert.equal(parseOnePaceId('sp:onepace:e:../../bad:ABCDEFGH:12345678'),null);
});

test('uncertain official editions remain discoverable without combining their episodes',()=>{const row={id:'existing',title:'Example',kind:'series',episodes:[],versions:[{id:'official',collections:['youtube-shows'],episodes:[{id:'abcdefghijk'}]}]};assert.equal(matchesCollection(row,'youtube-shows'),true);const lean=leanCatalog({shows:[row]},'flixer').shows[0];assert.ok(lean.collections.includes('youtube-shows'));assert.equal(lean.episodes.length,0);});
