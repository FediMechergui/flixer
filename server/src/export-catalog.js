import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

function replaceGenerated(source,destination){
  for(let attempt=0;;attempt++){
    try{fs.renameSync(source,destination);return;}catch(error){
      if(process.platform!=='win32'||!['EPERM','EBUSY'].includes(error.code))throw error;
      if(attempt<10){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);continue;}
      // OneDrive sometimes permits writes while retaining a rename lock. This
      // fallback is local to Windows exports; hosted Linux builds stay atomic.
      fs.copyFileSync(source,destination);fs.unlinkSync(source);return;
    }
  }
}

export function leanCatalog(catalog, product) {
  const payload = { ...catalog, product, stats: catalog.stats || {
    shows: catalog.shows.length,
    films: catalog.shows.filter(s => s.kind === 'film').length,
    series: catalog.shows.filter(s => s.kind === 'series').length,
    episodes: catalog.shows.reduce((sum, s) => sum + (s.episodeCount || 0), 0),
    channels: catalog.channels?.length || 0,
  } };
  const pick = (record, keys) => Object.fromEntries(keys.filter(key => record[key] !== undefined).map(key => [key, record[key]]));
  return { ...payload, shows: payload.shows.map(show => ({
    ...pick(show, ['id','wpId','slug','kind','title','altTitles','year','lang','contentLang','originalLanguage','countries','audioMode','audioModes','collections','tags','primaryTag','episodeCount','seasons','totalDurationSec','totalViews','latestAt','latestEpisode','firstAt','publishedAt','portrait','synopsisGenerated','tvm','tmdbId','imdbId','documentary','offerings','firstSeenAt','providerUpdatedAt','providerMetadata','sourceUrl']),
    versions: (show.versions || []).map(v => ({...pick(v,['id','title','year','sourceUrl','offerings','kind','documentary','providerMetadata','tags','lang','tmdbId','imdbId']),uncertainMatch:true})),
    channelId: show.channelId || show.channel?.id,
    posterId: show.posterVideoId || show.posterId,
    poster: show.poster?.custom ? { custom: show.poster.custom } : undefined,
    blurb: show.synopsis?.slice(0, 280) || show.blurb || '',
    episodes: (show.episodes || []).map(episode => ({
      ...pick(episode, ['id','title','season','number','absoluteNumber','audioModes','durationSec','views','publishedAt','offerings','sourceUrl']),
      thumbs: /^(mf|fm|hd|sp):/.test(episode.id) && episode.thumbs?.custom ? { custom: episode.thumbs.custom } : undefined,
    })),
  })) };
}

// Prepare a complete export beside its destination, then swap it in with rollback.
export function writeCatalog(outDir, catalog, product) {
  if (!catalog.shows?.length) throw new Error(`Refusing to export an empty ${product} catalogue`);
  outDir = path.resolve(outDir);
  const stage = `${outDir}.stage-${randomUUID()}`;
  const backup = `${outDir}.backup-${randomUUID()}`;
  const payload = { ...catalog, product };
  const lean = leanCatalog(catalog, product);
  let moved = false, committed=false;
  try {
    fs.mkdirSync(path.join(stage, 'shows'), { recursive: true });
    const titleDir=process.platform==='win32'?path.join(outDir,'shows'):path.join(stage,'shows');
    fs.mkdirSync(titleDir,{recursive:true});
    const writeTitle=show=>{
      const file=path.join(titleDir,`${encodeURIComponent(show.id)}.json`),data=JSON.stringify(show);
      if(process.platform==='win32'){
        if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')===data)return;
        fs.writeFileSync(file+'.pending',data);replaceGenerated(file+'.pending',file);
      }else fs.writeFileSync(file,data);
    };
    if(product==='flixer')for(const name of ['universes.json','services.json']){
      const existing=path.join(outDir,name);
      const fallback=new URL(`../../client-terrarium/data/${name}`,import.meta.url);
      const source=fs.existsSync(existing)?existing:fallback;
      if(fs.existsSync(source))fs.copyFileSync(source,path.join(stage,name));
    }
    for (const lang of ['', '.ar', '.en']) {
      const section = product === 'dahsha' && lang ? { ...lean, lang: lang.slice(1), shows: lean.shows.filter(s => s.lang === lang.slice(1)) } : lean;
      fs.writeFileSync(path.join(stage, `catalog${lang}.json`), JSON.stringify(section));
    }
    if(product==='flixer') {
      const index={...lean,lite:true,shows:lean.shows.map(({episodes,seasons,versions,offerings,blurb,...show})=>({...show,aliasIds:(offerings||[]).map(o=>o.id).filter(id=>id!==show.id),firstEpisodeId:episodes?.[0]?.id}))};
      fs.writeFileSync(path.join(stage,'index.json'),JSON.stringify(index));
      const updated=show=>[show.latestEpisode?show.providerUpdatedAt:null,show.latestAt,show.publishedAt].filter(Boolean).sort().pop() || '';
      const recent=[...index.shows].sort((a,b)=>updated(b).localeCompare(updated(a)));
      const summaries=new Map(lean.shows.map(s=>[s.id,s.blurb]));
      fs.writeFileSync(path.join(stage,'bootstrap.json'),JSON.stringify({...index,shows:recent.slice(0,600).map(s=>({...s,blurb:summaries.get(s.id)||''}))}));
    }
    for (const show of payload.shows) {
      writeTitle(show);
      for (const version of show.versions || [])writeTitle(version);
    }
    if (product === 'dahsha') fs.writeFileSync(path.join(stage, 'stream-ids.json'), JSON.stringify([...new Set(payload.shows.flatMap(show => (show.episodes || []).filter(e => /^(mf|fm|hd):/.test(e.id)).map(e => e.id)))]));
    fs.writeFileSync(path.join(stage, 'status.json'), JSON.stringify({ product, static: true, generatedAt: payload.generatedAt, refreshing: false, stats: payload.stats }));
    if(process.platform==='win32'){
      // OneDrive can lock or recreate a directory between two renames. Copy
      // generated title files first, then replace each catalogue file atomically.
      // Existing titles stay available if a copy is interrupted.
      fs.mkdirSync(outDir,{recursive:true});
      for(const name of fs.readdirSync(stage).filter(name=>name!=='shows')){
        const pending=path.join(outDir,`.${name}.pending`);
        fs.copyFileSync(path.join(stage,name),pending);
        replaceGenerated(pending,path.join(outDir,name));
      }
    }else{
      if (fs.existsSync(outDir)) { fs.renameSync(outDir, backup); moved = true; }
      fs.renameSync(stage, outDir);
    }
    committed=true;
  } catch (error) {
    if (moved && !fs.existsSync(outDir)) fs.renameSync(backup, outDir);
    throw error;
  } finally {
    if(committed)fs.rmSync(stage, { recursive: true, force: true });
    if(committed && fs.existsSync(outDir)) fs.rmSync(backup, { recursive: true, force: true });
  }
}
