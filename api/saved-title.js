import {readPackedTitle,decodeTitlePath} from '../server/src/title-packs.js';
export default function handler(req,res){
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET, HEAD, OPTIONS');
 if(req.method==='OPTIONS')return res.status(200).end();if(!['GET','HEAD'].includes(req.method))return res.status(405).end();
 const id=decodeTitlePath(req.query?.id);if(!id)return res.status(400).json({error:'Invalid title ID'});
 const title=readPackedTitle(id);if(!title)return res.status(404).json({error:'Title not found'});
 res.setHeader('Cache-Control','public, max-age=60, s-maxage=120, stale-while-revalidate=120');return res.status(200).json(title);
}
