// Parser dependency is injected so the exact same decoder runs in Node and Android.
export function createPublicHgConfig(parseLiteral){
// Public HG player configuration, not an authentication or DRM resolver.
// Decode Packer's string table without executing any downloaded JavaScript.
function unpackPublicPlayerScripts(html){
 if(typeof html!=='string'||html.length>1000000)return [];
 const literal=String.raw`(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")`;
 const pattern=new RegExp(String.raw`\}\s*\(\s*(${literal})\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(${literal})\.split\(\s*['"]\|['"]\s*\)`,'g');
 const alphabet='0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',results=[];
 const encode=(n,base)=>{let value='';do{value=alphabet[n%base]+value;n=Math.floor(n/base);}while(n);return value;};
 for(const match of html.matchAll(pattern)){
  if(results.length>=4)break;
  const base=Number(match[2]),count=Number(match[3]);if(base<2||base>62||count>4096)continue;
  try{const payload=parseLiteral(match[1]),words=parseLiteral(match[4]).split('|');if(count>words.length)continue;
   const table=new Map(Array.from({length:count},(_,i)=>[encode(i,base),words[i]]));
   results.push(payload.replace(/\b\w+\b/g,token=>table.get(token)||token));
  }catch{}
 }
 return results;
}
function publicManifestUrl(value){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash
  &&/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(u.hostname)&&!/(?:^|\.)(?:local|localhost)$/i.test(u.hostname)&&/\.(?:m3u8|txt)$/i.test(u.pathname)?u.href:null;}catch{return null;}
}
function parseHgPublicLinks(html){
 const result=[],seen=new Set();
 for(const script of [html,...unpackPublicPlayerScripts(html)]){
  const object=/\b(?:var|let|const)\s+links\s*=\s*(\{[^{}]{1,16384}\})\s*;/.exec(script)?.[1];if(!object)continue;
  let links;try{links=parseLiteral(object);}catch{continue;}
  // hls2 is the published alternative verified in Android when hls3 failed.
  for(const key of ['hls2','hls3','hls4']){const url=publicManifestUrl(links?.[key]);if(url&&!seen.has(url)){seen.add(url);result.push({key,url});}}
 }
 return result;
}

return {unpackPublicPlayerScripts,parseHgPublicLinks};
}
