import catalogue from '../../api/catalogue.js';import discover from '../../api/discover.js';import home from '../../api/home.js';import genres from '../../api/genres.js';import movies from '../../api/movies.js';import series from '../../api/series.js';import savedTitle from '../../api/saved-title.js';import search from '../../api/search.js';import stream from '../../api/stream.js';import title from '../../api/title.js';

const routes={catalogue,discover,home,genres,movies,series,'saved-title':savedTitle,search,stream,title};
export function createNetlifyHandler(handlers=routes){return async request=>{
 const url=new URL(request.url),headers=new Headers({'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, HEAD, OPTIONS','Access-Control-Allow-Headers':'*','X-Content-Type-Options':'nosniff'});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(!['GET','HEAD'].includes(request.method))return Response.json({error:'Method not allowed'},{status:405,headers});
 const query=Object.create(null);for(const [key,value]of url.searchParams){if(query[key]===undefined)query[key]=value;else query[key]=Array.isArray(query[key])?[...query[key],value]:[query[key],value];}
 let name=url.pathname.replace(/^\/api\//,'');
 if(url.pathname.startsWith('/data/shows/')){name='saved-title';query.id=url.pathname.slice('/data/shows/'.length).replace(/\.json$/,'');}
 if(name==='health')return Response.json({ok:true,service:'flixer-api',product:'flixer',hosting:'netlify',catalogue:'independent-publication',mediaTransport:'direct'},{headers});
 if(name==='stream'&&query.proxy==='1')return Response.json({error:'Video is delivered directly to the app. Resolve this source with transport=direct.'},{status:410,headers});
 const handler=Object.hasOwn(handlers,name)?handlers[name]:null;if(!handler)return Response.json({error:'Unknown API endpoint'},{status:404,headers});
 if(name==='stream')query.transport='direct';
 let status=200,body=null,ended=false;
 const res={setHeader:(key,value)=>headers.set(key,String(value)),getHeader:key=>headers.get(key),status(code){status=code;return this},json(value){headers.set('Content-Type','application/json; charset=utf-8');body=JSON.stringify(value);ended=true;return this},send(value){body=value;ended=true;return this},end(value){body=value??null;ended=true;return this}};
 // The origin comes from the platform request, not a caller-supplied forwarded host.
 const req={method:request.method,url:url.pathname+url.search,query,headers:{...Object.fromEntries(request.headers),host:url.host,'x-forwarded-host':url.host,'x-forwarded-proto':url.protocol.slice(0,-1)}};
 try{await handler(req,res);if(!ended)throw Error('Endpoint did not complete');}catch(error){status=502;body=JSON.stringify({error:'Backend request failed'});headers.set('Content-Type','application/json');headers.set('Cache-Control','no-store');console.warn('[api]',name,error.message);}
 const cache=headers.get('Cache-Control');if(status>=200&&status<300&&cache&&!/no-store|private/.test(cache)){headers.set('Netlify-CDN-Cache-Control',cache+', durable');headers.set('Netlify-Vary','query');}
 if(status>=400)headers.set('Cache-Control','no-store');
 return new Response(request.method==='HEAD'?null:body,{status,headers});
};}
export const handleNetlifyRequest=createNetlifyHandler();
