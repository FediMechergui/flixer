import { configureMobile } from './configure-mobile.js';
import {writeMobileIndex} from './bundle-mobile-index.js';
// Builds the Terrarium-based Flixer client (client-terrarium/) into a static folder.
//   node scripts/build-terrarium.js [--out <dir>] [--data-base <url>] [--api-base <url>] [--mobile]
// --mobile writes into mobile/www (the Capacitor webDir) and bundles the exported data unless
// --data-base points at a host that serves /data/*.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import {createRequire} from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const mobile = args.includes('--mobile');
const src = path.join(root, 'client-terrarium');
const out = path.resolve(root, opt('--out', mobile ? 'mobile/www' : 'client-terrarium/dist'));
const dataBase = opt('--data-base', process.env.VITE_DATA_BASE || '');
const apiBase = opt('--api-base', process.env.VITE_API_BASE || dataBase || '');
if (dataBase && /dahsha\.vercel\.app/.test(dataBase)) throw new Error('Flixer must use its own data host');
const dataDir = path.join(root, 'client', 'public', 'data-flixer');

if (!path.relative(root, out) || path.relative(root, out).startsWith('..')) { console.error('[terrarium] refusing to build outside the project'); process.exit(1); }
if (!dataBase && fs.existsSync(path.join(dataDir, 'catalog.json')) && JSON.parse(fs.readFileSync(path.join(dataDir, 'catalog.json'), 'utf8')).product !== 'flixer') throw new Error('Re-export Flixer data first');
if (!dataBase && !fs.existsSync(path.join(dataDir, 'catalog.json'))) {
  console.error('[terrarium] no Flixer data (client/public/data-flixer/catalog.json). Run "npm run export:flixer" first, or pass --data-base <url>.');
  process.exit(1);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
// index.html with versioned asset URLs so browsers never keep a stale script or stylesheet.
const stamp = Date.now().toString(36);
fs.writeFileSync(path.join(out, 'index.html'), fs.readFileSync(path.join(src, 'index.html'), 'utf8').replace(/(src|href)="((?:js|css)\/[^"]+|config\.js)"/g, `$1="$2?v=${stamp}"`));
fs.copyFileSync(path.join(src, 'manifest.webmanifest'), path.join(out, 'manifest.webmanifest'));
if(fs.existsSync(path.join(src,'fonts')))fs.cpSync(path.join(src,'fonts'),path.join(out,'fonts'),{recursive:true});
fs.cpSync(path.join(src, 'css'), path.join(out, 'css'), { recursive: true });
fs.cpSync(path.join(src, 'js'), path.join(out, 'js'), { recursive: true });
// Icons: the Flixer mark in client-terrarium/ (scripts/flixer-icons.js), else the shared ones.
for (const f of ['favicon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
  const own = path.join(src, f), shared = path.join(root, 'client', 'public', f);
  const p = fs.existsSync(own) ? own : shared;
  if (fs.existsSync(p)) fs.copyFileSync(p, path.join(out, f));
}
const hls = path.join(root, 'client', 'node_modules', 'hls.js', 'dist', 'hls.min.js');
if (!fs.existsSync(hls)) { console.error('[terrarium] hls.js not found; run "npm install --prefix client"'); process.exit(1); }
fs.mkdirSync(path.join(out, 'js', 'vendor'), { recursive: true });
fs.copyFileSync(hls, path.join(out, 'js', 'vendor', 'hls.min.js'));
const require=createRequire(import.meta.url);
const {rolldown}=await import(pathToFileURL(require.resolve('rolldown',{paths:[path.join(root,'client')]})).href);
const hgBundle=await rolldown({input:path.join(root,'scripts/browser-hg-entry.js')});
await hgBundle.write({format:'iife',minify:true,file:path.join(out,'js/vendor/hg-source.min.js')});await hgBundle.close();
fs.copyFileSync(path.join(root,'server/node_modules/json5/LICENSE.md'),path.join(out,'js/vendor/json5.LICENSE.md'));
if (!dataBase) {
  // The index always ships. Per-series episode files: all of them on the web, the newest N in the
  // APK (the rest load live when a series is opened). --shows N overrides the mobile default.
  const shows = opt('--shows', mobile ? '2500' : 'all');
  fs.mkdirSync(path.join(out, 'data'), { recursive: true });
  const backendData=args.includes('--backend-data');
  for (const f of fs.readdirSync(dataDir)) { const p = path.join(dataDir, f); if (fs.statSync(p).isFile()&&(!backendData||['bootstrap.json','index.json','status.json','universes.json','services.json'].includes(f))) fs.copyFileSync(p, path.join(out, 'data', f)); }
  if(backendData)fs.copyFileSync(path.join(dataDir,'index.json'),path.join(out,'data/catalog.json'));
  const showsDir = path.join(dataDir, 'shows');
  if (shows!=='0' && fs.existsSync(showsDir)) {
    const outShows = path.join(out, 'data', 'shows');
    fs.mkdirSync(outShows, { recursive: true });
    let wanted = null;
    if (shows !== 'all') {
      const cat = JSON.parse(fs.readFileSync(path.join(dataDir, 'catalog.json'), 'utf8'));
      wanted = new Set(cat.shows.filter((s) => s.kind === 'series').sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || ''))).slice(0, Number(shows)).map((s) => `${encodeURIComponent(s.id)}.json`));
    }
    let n = 0;
    for (const f of fs.readdirSync(showsDir)) { if (!wanted || wanted.has(f)) { fs.copyFileSync(path.join(showsDir, f), path.join(outShows, f)); n += 1; } }
    console.log(`[terrarium] bundled episode files for ${n} series`);
  }
}
if(mobile && dataBase) {
  fs.mkdirSync(path.join(out,'data'),{recursive:true});
  for(const name of ['bootstrap.json','universes.json','services.json']) if(fs.existsSync(path.join(dataDir,name))) fs.copyFileSync(path.join(dataDir,name),path.join(out,'data',name));
  if(fs.existsSync(path.join(dataDir,'index.json')))console.log('[terrarium] mobile index',writeMobileIndex(path.join(dataDir,'index.json'),path.join(out,'data')));
}
fs.writeFileSync(path.join(out, 'config.js'), `window.FLIXER_CONFIG = ${JSON.stringify({ dataBase, apiBase, mobile, builtAt: new Date().toISOString() })};\n`);

const count = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(path.join(d, e.name)) : 1), 0);
console.log(`[terrarium] built ${count(out)} files into ${path.relative(root, out)}${dataBase ? ` (data from ${dataBase})` : ' (data bundled)'}`);

if (mobile) configureMobile('flixer');
