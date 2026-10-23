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
 const rows=[],parser=new JSONParser({paths:['$.items.*'],keepStack:false});parser.onValue=({value})=>{if(accept(value))rows.push(value)};
 const fd=fs.openSync(file,'r'),buffer=Buffer.alloc(1024*1024),decoder=new StringDecoder('utf8');
 try{let count;while((count=fs.readSync(fd,buffer,0,buffer.length,null))){const text=decoder.write(buffer.subarray(0,count));if(text)parser.write(text)}const tail=decoder.end();if(tail)parser.write(tail);if(!parser.isEnded)parser.end();return rows;}finally{fs.closeSync(fd)}
}

export function writeJsonFile(file,data){
 const fd=fs.openSync(file,'w');let parts=[],length=0;
 const flush=()=>{if(length){fs.writeFileSync(fd,parts.join(''));parts=[];length=0;}};
 const emit=text=>{parts.push(text);length+=text.length;if(length>=1024*1024)flush();};
 const array=value=>{emit('[');for(let i=0;i<value.length;i++){if(i)emit(',');emit(JSON.stringify(value[i])??'null');}emit(']');};
 try{
  if(Array.isArray(data))array(data);
  else if(data&&typeof data==='object'){
   emit('{');let first=true;for(const key of Object.keys(data)){const value=data[key];if(value===undefined||typeof value==='function'||typeof value==='symbol')continue;if(!first)emit(',');first=false;emit(JSON.stringify(key)+':');if(Array.isArray(value))array(value);else emit(JSON.stringify(value));}emit('}');
  }else emit(JSON.stringify(data));
  flush();
 }finally{fs.closeSync(fd);}
}
