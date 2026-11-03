import {createPublicHgConfig} from './public-hg-config.js';

// Read the ordinary JW Player sources array without evaluating downloaded code.
// This is restricted to the two observed source hosts and their published CDN.
export function createPublicLuluConfig(parseLiteral){
 const {unpackPublicPlayerScripts}=createPublicHgConfig(parseLiteral);
 function sourceUrl(value){
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&['lulustream.com','luluvdo.com'].includes(u.hostname)&&/^\/e\/[a-z0-9]{12}$/.test(u.pathname)?u:null;}catch{return null;}
 }
 function cdnUrl(value,base){
  try{const u=new URL(value,base);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&(u.hostname==='tnmr.org'||u.hostname.endsWith('.tnmr.org'))?u:null;}catch{return null;}
 }
 function parseLuluPublicLinks(html){
  if(typeof html!=='string'||html.length>262144||/<title[^>]*>\s*(?:Just a moment|Attention Required|Access denied|Sign in|Log in|Premium)/i.test(html))return [];
  const links=[],seen=new Set();
  for(const script of [html,...unpackPublicPlayerScripts(html)]){
   const pattern=/\bjwplayer\s*\(\s*['"][\w-]{1,80}['"]\s*\)\s*\.setup\s*\(\s*\{\s*sources\s*:\s*(\[[\s\S]{1,16384}?\])\s*[,}]/g;
   for(const match of script.matchAll(pattern)){
    let sources;try{sources=parseLiteral(match[1]);}catch{continue;}
    if(!Array.isArray(sources))continue;
    for(const row of sources.slice(0,4)){
     const url=typeof row?.file==='string'&&row.file.length<=4096?cdnUrl(row.file):null;
     if(!url||!url.pathname.startsWith('/hls2/')||!url.pathname.endsWith('.m3u8')||seen.has(url.href))continue;
     seen.add(url.href);links.push({key:'hls'+links.length,url:url.href});if(links.length>=4)return links;
    }
   }
  }
  return links;
 }
 function isLuluManifest(text,url){
  if(typeof text!=='string'||text.length>262144||!/^\uFEFF?#EXTM3U(?:\r?\n|$)/.test(text)||!/#EXT(?:INF|\-X\-(?:STREAM-INF|MEDIA))\b/.test(text))return false;
  const references=[...text.split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!line.startsWith('#')&&!line.startsWith('\uFEFF#')),...[...text.matchAll(/\bURI="([^"]+)"/g)].map(match=>match[1])];
  return references.length>0&&references.every(value=>Boolean(cdnUrl(value,url)));
 }
 return {sourceUrl,parseLuluPublicLinks,isLuluManifest};
}
