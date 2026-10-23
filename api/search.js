import {ensureRuntime} from '../server/src/runtime-source.js';
import { PRODUCT } from '../server/src/product.js';
import { unifiedSearch,SEARCH_PROVIDERS } from '../server/src/library-service.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await ensureRuntime();
    if(req.query.providers==='1')return res.status(200).json({providers:PRODUCT==='flixer'?SEARCH_PROVIDERS:['fmovies','hdtoday']});
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    if (!q.trim()) return res.status(200).json({ items: [] });
    if(req.query.provider&&!SEARCH_PROVIDERS.includes(req.query.provider))return res.status(400).json({error:'Invalid search provider'});
    const items = await unifiedSearch(q,{provider:req.query.provider});
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ items });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
