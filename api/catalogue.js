import {runtimeSource} from '../server/src/runtime-source.js';
export default async function handler(req,res){
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET, HEAD, OPTIONS');
 if(req.method==='OPTIONS')return res.status(200).end();if(!['GET','HEAD'].includes(req.method))return res.status(405).end();
 await runtimeSource.check();const manifest=runtimeSource.manifest();if(!manifest)return res.status(503).json({error:'Catalogue update source temporarily unavailable'});
 res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=60');
 const part=req.query?.part||'manifest';
 if(part==='manifest')return res.json({product:'flixer',generatedAt:manifest.generatedAt,count:manifest.count,stats:manifest.stats,indexParts:manifest.indexParts.map(key=>({key,sha256:manifest.files[key].sha256})),bootstrap:manifest.files.bootstrap.sha256});
 if(!/^(?:bootstrap|services|universes|index-\d{4})$/.test(part)||!manifest.files[part])return res.status(400).json({error:'Invalid catalogue part'});
 if(req.query.hash&&!/^[a-f0-9]{64}$/.test(req.query.hash))return res.status(400).json({error:'Invalid catalogue hash'});
 try{const data=await runtimeSource.part(part,req.query.hash);return res.json(data)}catch{return res.status(503).json({error:'Catalogue part unavailable; retry shortly'})}
}
