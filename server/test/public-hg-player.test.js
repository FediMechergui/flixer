import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHgPublicLinks,unpackPublicPlayerScripts,resolveHgPublicServers} from '../src/public-hg-player.js';

test('public HG configuration is decoded as strings without executing source JavaScript',()=>{
 const packed=`eval(function(p,a,c,k,e,d){throw Error('must never execute')}('0 1={2:"3"};',4,4,'var|links|hls2|https://cdn.example/master.m3u8'.split('|'),0,{}));`;
 assert.deepEqual(unpackPublicPlayerScripts(packed),['var links={hls2:"https://cdn.example/master.m3u8"};']);
 assert.deepEqual(parseHgPublicLinks(packed),[{key:'hls2',url:'https://cdn.example/master.m3u8'}]);
 assert.deepEqual(unpackPublicPlayerScripts(packed.replace(',4,4,',',99,4,')),[]);
 assert.deepEqual(unpackPublicPlayerScripts('x'.repeat(1000001)),[]);
});
test('public links reject local destinations, credentials, executable URLs and unrelated keys',()=>{
 for(const url of ['http://cdn.example/master.m3u8','https://127.0.0.1/master.m3u8','https://[::1]/master.m3u8','https://media.local/master.m3u8','https://media.localhost/master.m3u8','https://a:b@cdn.example/master.m3u8','https://cdn.example:444/master.m3u8','javascript:alert(1)','https://cdn.example/ads.js'])assert.deepEqual(parseHgPublicLinks(`var links={hls2:${JSON.stringify(url)}};`),[],url);
 assert.deepEqual(parseHgPublicLinks('var links={advertisement:"https://cdn.example/master.m3u8"};'),[]);
});
test('HG resolution offers the verified alternate manifest and preserves language evidence',async()=>{
 const requests=[],source={id:'cimafu:6',provider:'cimafu',name:'Cima4u - HG',type:'embed',embedUrl:'https://cybervynx.com/e/abcdefghijkl',subtitleLanguages:['ar']};
 const fetchPage=async(url,options)=>{requests.push(url);assert.equal(options.timeoutMs,2500);
  if(url==='https://hglamioz.com/e/abcdefghijkl')return new Response('var links={hls2:"https://cdn.example/master.m3u8?token=published",hls3:"https://cdn.example/broken.txt"};');
  if(url.includes('master.m3u8'))return new Response('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000\n720p.m3u8\n');
  return new Response('<html>Access denied</html>');
 };
 const rows=await resolveHgPublicServers(source,{fetchPage});assert.equal(rows.length,1);assert.equal(rows[0].type,'hls');assert.equal(rows[0].id,'cimafu:6:hls2');assert.equal(rows[0].sourceEmbedUrl,source.embedUrl);assert.deepEqual(rows[0].subtitleLanguages,['ar']);assert.equal(rows[0].embedUrl,undefined);assert.equal(requests.length,3);
});
test('HG resolution does not fetch untrusted embed origins and fails without removing other choices',async()=>{
 let calls=0;const fetchPage=async()=>{calls++;throw Error('upstream timeout');};
 for(const url of ['https://evil.example/e/abcdefghijkl','https://cybervynx.com.evil.example/e/abcdefghijkl','https://cybervynx.com/admin','https://cybervynx.com/e/../private','https://user@cybervynx.com/e/abcdefghijkl'])assert.deepEqual(await resolveHgPublicServers({embedUrl:url},{fetchPage}),[]);
 assert.equal(calls,0);assert.deepEqual(await resolveHgPublicServers({embedUrl:'https://cybervynx.com/e/abcdefghijkl'},{fetchPage}),[]);assert.equal(calls,1);
});
