import {SNAPSHOT_FILES,validateSnapshotEntries,validateSnapshotDirectory} from './snapshot-validation.js';
// Saves / restores the server's cached data (playlists, details, seen, catalog) as a GitHub Release
// asset, so CI refreshes are incremental instead of re-scanning ~30k videos from scratch.
//   node scripts/snapshot.js save      -> uploads server/data snapshot to release "data-snapshot"
//   node scripts/snapshot.js restore   -> validates a complete snapshot before replacing server/data
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'server', 'data');
const TAG = 'data-snapshot';
const FILES = SNAPSHOT_FILES;
const ARCHIVE = 'data-snapshot.tar.gz';
const archive = path.join(root, ARCHIVE);
// No shell: paths with spaces (OneDrive folders) must reach tar/gh untouched. Windows resolves
// gh/tar through PATHEXT without a shell as long as we name the executable.
const exe = (cmd) => (process.platform === 'win32' ? `${cmd}.exe` : cmd);
const repo = process.env.SNAPSHOT_REPO || 'FediMechergui/flixer';
const sh = (cmd, args, opts = {}) => spawnSync(exe(cmd), cmd === 'gh' ? [...args,'--repo',repo] : args, { stdio: 'inherit', ...opts });
const mode = process.argv[2];

if (mode === 'save') {
  const present = FILES.filter((f) => fs.existsSync(path.join(dataDir, f)));
  if (!present.length) { console.error('nothing to snapshot'); process.exit(1); }
  // Run tar inside the data dir with relative names so no path needs quoting.
  if (sh('tar', ['-czf', path.relative(dataDir, archive), ...present], { cwd: dataDir }).status !== 0) process.exit(1);
  const exists = spawnSync(exe('gh'), ['release', 'view', TAG,'--repo',repo], { stdio: 'ignore' }).status === 0;
  if (!exists && sh('gh', ['release', 'create', TAG, '--title', 'Data snapshot (auto)', '--notes', 'Cached Flixer catalogue metadata used by this repository. Updated automatically.', '--latest=false']).status !== 0) process.exit(1);
  // Upload completely before replacing the published cache. --clobber deletes
  // the old asset before a potentially slow upload, breaking concurrent builds.
  const pendingName=`data-snapshot.pending-${Date.now()}.tar.gz`,pending=path.join(root,pendingName);
  fs.copyFileSync(archive,pending);
  if(sh('gh',['release','upload',TAG,pendingName],{cwd:root}).status!==0)process.exit(1);
  const listed=spawnSync(exe('gh'),['api',`repos/${repo}/releases/tags/${TAG}`],{encoding:'utf8'});
  if(listed.status!==0)throw new Error('Could not verify uploaded snapshot');
  const assets=JSON.parse(listed.stdout).assets,newAsset=assets.find(a=>a.name===pendingName),old=assets.find(a=>a.name===ARCHIVE),backup=assets.find(a=>a.name==='data-snapshot.previous.tar.gz');
  if(!newAsset||newAsset.state!=='uploaded'||newAsset.size!==fs.statSync(pending).size)throw new Error('Snapshot upload incomplete');
  const assetApi=(id,args)=>spawnSync(exe('gh'),['api',`repos/${repo}/releases/assets/${id}`,...args],{stdio:'ignore'}).status===0;
  if(backup&&!assetApi(backup.id,['--method','DELETE']))throw new Error('Could not retire previous snapshot backup');
  if(old&&!assetApi(old.id,['--method','PATCH','-f','name=data-snapshot.previous.tar.gz']))throw new Error('Could not preserve previous snapshot');
  if(!assetApi(newAsset.id,['--method','PATCH','-f',`name=${ARCHIVE}`])){
    if(old)assetApi(old.id,['--method','PATCH','-f',`name=${ARCHIVE}`]);
    throw new Error('Could not publish uploaded snapshot');
  }
  fs.rmSync(pending,{force:true});
  fs.rmSync(archive, { force: true });
  console.log(`snapshot saved (${present.join(', ')})`);
} else if (mode === 'restore') {
  fs.mkdirSync(dataDir, { recursive: true });
  let downloaded=false;
  for(let attempt=1;attempt<=3;attempt++){
    const r=sh('gh',['release','download',TAG,'--pattern',ARCHIVE,'--dir','.','--clobber'],{cwd:root,timeout:90000});
    if(r.status===0&&fs.existsSync(archive)){downloaded=true;break;}
    console.warn(`[snapshot] download attempt ${attempt}/3 failed; existing data retained`);
    if(attempt<3)await new Promise(resolve=>setTimeout(resolve,1000*attempt));
  }
  if(!downloaded)throw new Error('Snapshot restore failed; refusing to refresh or publish an incomplete replacement');
  const stage=path.join(root,'server',`snapshot-restore-${process.pid}`);
  if(!path.resolve(stage).startsWith(path.join(root,'server')+path.sep))throw new Error('Invalid snapshot staging path');
  fs.mkdirSync(stage,{recursive:true});
  try{
    const listing=spawnSync(exe('tar'),['-tzf',archive],{encoding:'utf8'});
    if(listing.status!==0)throw new Error('Snapshot archive validation failed');validateSnapshotEntries(listing.stdout);
    if(sh('tar',['-xzf',archive,'-C',stage,'--no-same-owner','--no-same-permissions']).status!==0)throw new Error('Snapshot extraction failed; existing data retained');
    validateSnapshotDirectory(stage);
    fs.mkdirSync(dataDir,{recursive:true});
    for(const name of [...FILES.filter(n=>n!=='flixer-catalog.json'),'flixer-catalog.json']){const destination=path.join(dataDir,name),pending=destination+'.restore-pending';fs.copyFileSync(path.join(stage,name),pending);fs.renameSync(pending,destination);}
    fs.rmSync(archive,{force:true});console.log('snapshot restored and validated');
  }finally{fs.rmSync(stage,{recursive:true,force:true});}
} else {
  console.error('usage: node scripts/snapshot.js save|restore');
  process.exit(1);
}
