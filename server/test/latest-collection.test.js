import test from 'node:test';
import assert from 'node:assert/strict';
import {hydrateProviderPage} from '../src/provider-sync.js';
const page=()=>({items:Array.from({length:30},(_,i)=>({id:'sp:myasiantv:s:show-'+i,kind:'series',title:'Show '+i,episodes:[]})),page:1,totalPages:20});
test('latest collection enriches a bounded leading set without dropping the rest of a listing',async()=>{
 const source=page(),calls=[];
 const result=await hydrateProviderPage(source,{limit:3,resolveDetails:async id=>{calls.push(id);return {id,kind:'series',title:'Source title',episodes:[{id:id+':episode',season:1,number:1}]};}});
 assert.equal(calls.length,3);assert.equal(result.items.length,30);assert.equal(result.totalPages,20);
 assert.equal(result.items[0].episodes.length,1);assert.equal(result.items[3].title,'Show 3');
});
test('missing or mismatched enrichment never replaces a discovered title',async()=>{
 const source=page(),before=structuredClone(source);
 const result=await hydrateProviderPage(source,{limit:2,resolveDetails:async id=>{if(id.endsWith('0'))throw Error('Source unavailable');return {id:'wrong',kind:'series',title:'Wrong show'};}});
 assert.deepEqual(result,before);
});
