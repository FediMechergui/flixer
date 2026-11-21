import fs from 'node:fs';
import path from 'node:path';

// Only disposable output locations may be recursively replaced by a build.
export function validateBuildOutput(root, output) {
  const base=path.resolve(root),out=path.resolve(base,output),relative=path.relative(base,out).replaceAll('\\','/');
  if(!/^(?:(?:artifacts|out|dist)(?:\/[^.][^/]*)*|(?:client|client-terrarium)\/dist(?:-[\w-]+)?|mobile\/www)$/.test(relative))
    throw Error('Unsafe build output: use a generated dist directory, mobile/www, or a directory under artifacts/, out/ or dist/');
  let current=base;
  for(const part of relative.split('/')){
    current=path.join(current,part);
    if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw Error('Unsafe build output: symbolic links are not allowed');
  }
  return out;
}
