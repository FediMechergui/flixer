import fs from 'node:fs';import path from 'node:path';
const output=path.resolve('artifacts/netlify-public');fs.mkdirSync(path.join(output,'data'),{recursive:true});
for(const name of ['services.json','universes.json']){const current=path.resolve('client/public/data-flixer',name),fallback=path.resolve('client-terrarium/data',name);fs.copyFileSync(fs.existsSync(current)?current:fallback,path.join(output,'data',name));}
fs.writeFileSync(path.join(output,'index.html'),'<!doctype html><meta charset="utf-8"><title>Flixer API</title><p>Flixer mobile backend. <a href="/api/health">Service status</a></p>');
console.log('[netlify] Backend assets ready; catalogue collection and video transfers stay outside the functions.');
