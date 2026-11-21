import {fileURLToPath} from 'node:url';
import path from 'node:path';

export function androidVersion(tag){
  const match=/^(?:flixer-)?v?(\d+)\.(\d+)\.(\d+)$/.exec(String(tag||''));
  if(!match)throw Error('Use a release tag such as flixer-v1.6.36 or v1.6.36');
  const [major,minor,patch]=match.slice(1).map(Number);
  const code=major*10000+minor*100+patch;
  if(!Number.isSafeInteger(code)||code<1||code>2100000000||minor>99||patch>99)throw Error('Version cannot be represented as an Android version code');
  return {name:`${major}.${minor}.${patch}`,code};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const version=androidVersion(process.argv[2]);
  console.log(`APP_VERSION_NAME=${version.name}\nAPP_VERSION_CODE=${version.code}`);
}
