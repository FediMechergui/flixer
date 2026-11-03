import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {arabicId,parseArabicServers,resolveArabicServers,createYoutubeTitleReader} from '../src/arabic-providers.js';

const id='sp:streamtunisie:m:L21vdmllcy_ZgdmK2YTZhS3Ys9iq2KfYsdiq2KfYqC1maWxtLXN0YXJ0dXAv';
const fixture=fs.readFileSync(new URL('./fixtures/streamtunisie-startup-player.html',import.meta.url),'utf8');
const trailerTitle='STARTUP ستار تاب | OFFICIAL TRAILER';
const options={readSnapshot:async()=>null,fetchPage:async()=>fixture};
const previewError=error=>error.code==='SOURCE_PREVIEW_ONLY'&&error.message==='Source advertises a trailer only';

test('the actual Startup source video is removed when its public title identifies an official trailer',async()=>{
  assert.equal(parseArabicServers(id,fixture)[0].videoId,'aBxBjNbKETU');
  let calls=0;
  await assert.rejects(resolveArabicServers(id,{...options,fresh:true,readYoutubeTitle:async videoId=>{calls++;assert.equal(videoId,'aBxBjNbKETU');return trailerTitle;}}),previewError);
  assert.equal(calls,1,'duplicate iframe and switch button share one metadata lookup');
});

test('film previews do not hide a real full player and movie server buttons are included',async()=>{
  const html=fixture+'<button onclick="switchMovieServer(this, \'https://uqload.vc/embed-fullfilm.html\')">Full film</button>';
  const servers=await resolveArabicServers(id,{...options,fetchPage:async()=>html,readYoutubeTitle:async()=>trailerTitle});
  assert.equal(servers.length,1);assert.equal(servers[0].embedUrl,'https://uqload.vc/embed-fullfilm.html');
});

test('explicit English, French and Arabic preview labels are excluded before metadata requests',async()=>{
  for(const label of ['Official trailer','Bande-annonce officielle','الإعلان الرسمي للفيلم']){
    const html=fixture.replace('id="movie-frame-box"',`id="movie-frame-box" title="${label}"`);
    assert.deepEqual(parseArabicServers(id,html),[]);
    await assert.rejects(resolveArabicServers(id,{...options,fetchPage:async()=>html,readYoutubeTitle:async()=>assert.fail('explicit source labels need no network request')}),previewError);
  }
});

test('full film titles, Trailer Park names and unavailable metadata retain the source video',async()=>{
  for(const title of ['STARTUP — Film complet','Trailer Park Boys: The Movie','فيلم ستارتاب كامل',null]){
    const servers=await resolveArabicServers(id,{...options,readYoutubeTitle:async()=>title});
    assert.equal(servers.length,1);assert.equal(servers[0].videoId,'aBxBjNbKETU');
  }
  const servers=await resolveArabicServers(id,{...options,readYoutubeTitle:async()=>{throw new Error('metadata unavailable');}});
  assert.equal(servers.length,1);
});

test('episode YouTube streams do not incur film-preview metadata requests',async()=>{
  const episode=arabicId('streamtunisie','e','https://streamtunisie.net/official-show-episode-01/');
  const servers=await resolveArabicServers(episode,{...options,readYoutubeTitle:async()=>assert.fail('series are outside the film-only check')});
  assert.equal(servers[0].videoId,'aBxBjNbKETU');
});

test('cached trailers cannot be resurrected when a source request fails',async()=>{
  const readSnapshot=async()=>({episodes:[{id,cachedPlayers:[{type:'youtube',videoId:'aBxBjNbKETU'}]}]});
  await assert.rejects(resolveArabicServers(id,{readSnapshot,fetchPage:async()=>{throw new Error('source timeout');},readYoutubeTitle:async()=>trailerTitle}),previewError);
  await assert.rejects(resolveArabicServers(id,{readSnapshot,fetchPage:async()=>fixture,readYoutubeTitle:async()=>trailerTitle}),previewError);
});

test('YouTube oEmbed titles are bounded, cached and coalesced without credentials',async()=>{
  let calls=0,time=1000;
  const read=createYoutubeTitleReader({now:()=>time,fetchRemote:async(url,options)=>{
    calls++;const u=new URL(url);assert.equal(u.origin,'https://www.youtube.com');assert.equal(u.pathname,'/oembed');
    assert.equal(u.searchParams.get('url'),'https://www.youtube.com/watch?v=aBxBjNbKETU');
    assert.equal(options.manualRedirect,true);assert.ok(options.timeoutMs<=2000);assert.equal(options.headers.Authorization,undefined);
    return new Response(JSON.stringify({type:'video',provider_name:'YouTube',title:trailerTitle}));
  }});
  assert.deepEqual(await Promise.all([read('aBxBjNbKETU'),read('aBxBjNbKETU')]),[trailerTitle,trailerTitle]);
  assert.equal(await read('aBxBjNbKETU'),trailerTitle);assert.equal(calls,1);
  time+=86400001;assert.equal(await read('aBxBjNbKETU'),trailerTitle);assert.equal(calls,2);
  assert.equal(await read('invalid'),null);assert.equal(calls,2);
  const unavailable=createYoutubeTitleReader({timeoutMs:10,fetchRemote:async()=>new Promise(()=>{})});
  assert.equal(await unavailable('aBxBjNbKETU'),null);
});

test('unavailable oEmbed results receive a short cache rather than repeated requests',async()=>{
  let time=0,calls=0;
  const read=createYoutubeTitleReader({now:()=>time,fetchRemote:async()=>{calls++;return new Response('',{status:503});}});
  assert.equal(await read('aBxBjNbKETU'),null);assert.equal(await read('aBxBjNbKETU'),null);assert.equal(calls,1);
  time+=120001;assert.equal(await read('aBxBjNbKETU'),null);assert.equal(calls,2);
});
