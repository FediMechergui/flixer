import fs from 'node:fs';
import {JSONParser} from '@streamparser/json';
import {StringDecoder} from 'node:string_decoder';

// Avoid V8's single-string limit while retaining the existing catalogue shape.
export function readJsonFile(file,{threshold=64*1024*1024,chunkSize=1024*1024}={}){
 if(fs.statSync(file).size<threshold)return JSON.parse(fs.readFileSync(file,'utf8'));
 const parser=new JSONParser({paths:['$'],keepStack:true});let result,complete=false;
 parser.onValue=({value})=>{result=value;complete=true;};
 const fd=fs.openSync(file,'r'),buffer=Buffer.alloc(chunkSize),decoder=new StringDecoder('utf8');
 try{let count;while((count=fs.readSync(fd,buffer,0,buffer.length,null))){const text=decoder.write(buffer.subarray(0,count));if(text)parser.write(text);}const tail=decoder.end();if(tail)parser.write(tail);if(!parser.isEnded)parser.end();if(!complete)throw Error('Incomplete JSON document');return result;}
 finally{fs.closeSync(fd);}
}

// Serialize catalogue arrays one title at a time, with bounded output buffers.
export function readJsonItems(file,accept=()=>true){
 const rows=[];for(const row of iterateJsonItems(file))if(accept(row))rows.push(row);return rows;
}

// Keep only one input chunk plus the current record alive. Metadata is emitted
// only after the complete document has parsed, so truncated caches never commit.
export function* iterateJsonItems(file,{onMetadata=()=>{},chunkSize=256*1024}={}){
 let rows=[],metadata,complete=false;
 const parser=new JSONParser({paths:['$','$.items.*'],keepStack:false});
 parser.onValue=({value,key,parent,stack})=>{
  if(stack.length===2){rows.push(value);delete parent[key];}
  else if(stack.length===0){const {items,...rest}=value;metadata=rest;complete=true;}
 };
 const fd=fs.openSync(file,'r'),buffer=Buffer.alloc(chunkSize),decoder=new StringDecoder('utf8');
 try{
  let count;while((count=fs.readSync(fd,buffer,0,buffer.length,null))){const text=decoder.write(buffer.subarray(0,count));if(text)parser.write(text);yield* rows;rows=[];}
  const tail=decoder.end();if(tail)parser.write(tail);if(!parser.isEnded)parser.end();yield* rows;
  if(!complete)throw Error('Incomplete JSON document');onMetadata(metadata);
 }finally{fs.closeSync(fd);}
}

export function writeJsonFile(file,data,{arrays={}}={}){
 const fd=fs.openSync(file,'w');let parts=[],length=0;
 const flush=()=>{if(length){fs.writeFileSync(fd,parts.join(''));parts=[];length=0;}};
 const emit=text=>{parts.push(text);length+=text.length;if(length>=1024*1024)flush();};
 const array=value=>{emit('[');for(let i=0;i<value.length;i++){if(i)emit(',');emit(JSON.stringify(value[i])??'null');}emit(']');};
 try{
  if(Array.isArray(data))array(data);
  else if(data&&typeof data==='object'){
   emit('{');let first=true;for(const key of new Set([...Object.keys(data),...Object.keys(arrays)])){const value=data[key],streamed=Object.hasOwn(arrays,key);if(!streamed&&(value===undefined||typeof value==='function'||typeof value==='symbol'))continue;if(!first)emit(',');first=false;emit(JSON.stringify(key)+':');if(streamed){emit('[');let firstItem=true;for(const item of arrays[key]){if(!firstItem)emit(',');firstItem=false;emit(JSON.stringify(item)??'null');}emit(']');}else if(Array.isArray(value))array(value);else emit(JSON.stringify(value));}emit('}');
  }else emit(JSON.stringify(data));
  flush();
 }finally{fs.closeSync(fd);}
}
