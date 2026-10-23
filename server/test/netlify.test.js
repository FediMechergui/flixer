import test from 'node:test';import assert from 'node:assert/strict';import {createNetlifyHandler} from '../src/netlify-handler.js';import {unifiedSearch} from '../src/library-service.js';

test('Netlify preserves repeated query parameters, trusted origins and query-specific cache policy',async()=>{
 let seen;const handler=createNetlifyHandler({title:async(req,res)=>{seen=req;res.setHeader('Cache-Control','public, s-maxage=120, stale-while-revalidate=120');res.json({sources:req.query.source})}});
 const response=await handler(new Request('https://flixer.example/api/title?id=one&source=a&source=b',{headers:{'x-forwarded-host':'attacker.invalid','x-forwarded-proto':'http'}}));
 assert.equal(response.status,200);assert.deepEqual((await response.json()).sources,['a','b']);assert.equal(seen.headers['x-forwarded-host'],'flixer.example');assert.equal(seen.headers['x-forwarded-proto'],'https');assert.equal(response.headers.get('Netlify-Vary'),'query');assert.match(response.headers.get('Netlify-CDN-Cache-Control'),/durable/);
});

test('Netlify handles preflight, HEAD, legacy saved-title paths and rejects media relays',async()=>{
 let id,transport;const handler=createNetlifyHandler({'saved-title':async(req,res)=>{id=req.query.id;res.json({id})},stream:async(req,res)=>{transport=req.query.transport;res.setHeader('Cache-Control','no-store');res.json({servers:[]})}});
 assert.equal((await handler(new Request('https://flixer.example/api/title',{method:'OPTIONS'}))).status,204);
 assert.equal((await handler(new Request('https://flixer.example/api/title',{method:'POST'}))).status,405);
 assert.equal((await handler(new Request('https://flixer.example/api/toString'))).status,404);
 const head=await handler(new Request('https://flixer.example/data/shows/mf%253As%253Aexample.json',{method:'HEAD'}));assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(id,'mf%253As%253Aexample');
 const media=await handler(new Request('https://flixer.example/api/stream?id=mf:m:example'));assert.equal(transport,'direct');assert.equal(media.headers.get('Netlify-CDN-Cache-Control'),null);
 assert.equal((await handler(new Request('https://flixer.example/api/stream?proxy=1&url=https://example.invalid'))).status,410);
});

test('provider searches retain supplied language aliases without loading the full saved library',async()=>{
 const queries=[],result=await unifiedSearch('Bab al Hara',{product:'flixer',provider:'fmovies',catalog:{product:'flixer',shows:[]},aliases:['باب الحارة','Bab al Hara'],fetchers:{fmovies:async q=>{queries.push(q);return [{id:'fm:s:123',kind:'series',title:'باب الحارة',year:2006,episodes:[]}]}}});
 assert.deepEqual(queries,['Bab al Hara','باب الحارة']);assert.ok(result.some(row=>row.title==='باب الحارة'));
});
