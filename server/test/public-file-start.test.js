import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../mobile/android/app/src/main/assets/public-file-start.js',import.meta.url),'utf8');
function page({host='uqload.vc',pathname='/embed-public.html',search='',duration=6985,text='',encrypted=false,keys=null}={}){
 const listeners=new Map();let calls=0;
 class Video{constructor(){Object.assign(this,{duration,paused:true,readyState:1,mediaKeys:keys});}getBoundingClientRect(){return {width:320,height:180,top:0,left:0,right:320,bottom:180};}setAttribute(){}play(){calls++;return Promise.resolve();}}
 const video=new Video(),context=vm.createContext({location:{hostname:host,pathname,search},document:{body:{innerText:text},querySelectorAll:()=>[video],addEventListener:(name,fn)=>listeners.set(name,fn)},HTMLVideoElement:Video,getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1'}),innerHeight:640,innerWidth:360,Promise});
 vm.runInContext(source,context);if(encrypted)listeners.get('encrypted')?.({target:video});
 listeners.get('loadedmetadata')?.({target:video});listeners.get('canplay')?.({target:video});return calls;
}
test('a paused public file-host film gets one ordinary play request',()=>{assert.equal(page(),1);assert.equal(page({host:'watch.strp2p.site',pathname:'/e/public'}),1);assert.equal(page({host:'watch.strp2p.site',pathname:'/',search:'?file=public'}),1);});
test('source initialization never starts ads, encrypted video, verification or paid access',()=>{
 for(const options of [{duration:30},{encrypted:true},{keys:{}},{text:'Verify you are human'},{text:'Premium only'},{text:'Subscription required'},{host:'other.example'},{pathname:'/login'}])assert.equal(page(options),0,JSON.stringify(options));
});
