import test from 'node:test';
import assert from 'node:assert/strict';
import JSON5 from '../node_modules/json5/lib/index.js';
import {createPublicLuluConfig} from '../../shared/public-lulu-config.js';
const {sourceUrl,parseLuluPublicLinks,isLuluManifest}=createPublicLuluConfig(JSON5.parse);
const media='https://sample.tnmr.org/hls2/03/04632/ca89bh8wwo66_h/master.m3u8?t=published';
const setup=value=>`jwplayer("vplayer").setup({sources:[{file:${JSON.stringify(value)}}],image:"poster.jpg"});`;

test('Lulu reads the observed packed JW Player configuration without executing it',()=>{
 const packed=`eval(function(p,a,c,k,e,d){throw Error('must never execute')}('0("1").2({3:[{4:"5"}]});',6,6,'jwplayer|vplayer|setup|sources|file|${media}'.split('|')));`;
 assert.deepEqual(parseLuluPublicLinks(packed),[{key:'hls0',url:media}]);
 assert.deepEqual(parseLuluPublicLinks(setup(media)+setup(media)),[{key:'hls0',url:media}]);
 assert.deepEqual(parseLuluPublicLinks(`jwplayer('x').setup({sources:[{file:(()=>{throw Error('never')})()}]});`),[]);
});

test('Lulu ignores arbitrary scripts, external CDNs and authentication challenge documents',()=>{
 for(const value of ['https://tnmr.org.evil.test/hls2/x.m3u8','https://user@sample.tnmr.org/hls2/x.m3u8','https://sample.tnmr.org:444/hls2/x.m3u8','http://sample.tnmr.org/hls2/x.m3u8','https://127.0.0.1/hls2/x.m3u8','https://sample.tnmr.org/private/x.m3u8','https://sample.tnmr.org/hls2/x.mp4','https://sample.tnmr.org/hls2/x.m3u8#fragment'])assert.deepEqual(parseLuluPublicLinks(setup(value)),[],value);
 assert.deepEqual(parseLuluPublicLinks(`const sources=[{file:${JSON.stringify(media)}}];`),[]);
 assert.deepEqual(parseLuluPublicLinks('<title>Just a moment...</title>'+setup(media)),[]);
 assert.deepEqual(parseLuluPublicLinks('<title>Premium sign in</title>'+setup(media)),[]);
 assert.deepEqual(parseLuluPublicLinks(' '.repeat(262145)+setup(media)),[]);
});

test('Lulu admits only the observed source identity shapes',()=>{
 assert.equal(sourceUrl('https://lulustream.com/e/ca89bh8wwo66')?.hostname,'lulustream.com');
 assert.equal(sourceUrl('https://luluvdo.com/e/ca89bh8wwo66')?.hostname,'luluvdo.com');
 for(const value of ['https://luluvdo.com/admin','https://luluvdo.com/e/ca89bh8wwo66?next=elsewhere','https://luluvdo.com/e/ca89bh8wwo66#x','https://user@luluvdo.com/e/ca89bh8wwo66','https://luluvdo.com:8443/e/ca89bh8wwo66','https://luluvdo.com.evil.test/e/ca89bh8wwo66','http://luluvdo.com/e/ca89bh8wwo66'])assert.equal(sourceUrl(value),null,value);
});

test('Lulu manifest verification rejects HTML and foreign media destinations',()=>{
 assert.equal(isLuluManifest('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000\n720p.m3u8\n',media),true);
 assert.equal(isLuluManifest('#EXTM3U\n#EXTINF:10,\nsegment.ts\n',media),true);
 assert.equal(isLuluManifest('#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,URI="audio.m3u8"\n',media),true);
 for(const text of ['<html>Access denied</html>','#EXTM3U\n#EXT-X-ENDLIST\n','#EXTM3U\n#EXTINF:10,\nhttps://foreign.test/file.ts\n','#EXTM3U\n#EXTINF:10,\nhttp://sample.tnmr.org/file.ts\n','#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,URI="https://127.0.0.1/audio.m3u8"\n'])assert.equal(isLuluManifest(text,media),false,text);
});
