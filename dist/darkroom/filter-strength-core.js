/* Filter strength owns only the selected recipe's native amplitudes.
 * Reference values remain at 100%; masks, retouch and earlier layers are never scaled. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RayFilterStrengthCore=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const VERSION=1,MAX_REFS=32;
 const keys=Object.freeze(['rayThuNhat','temp','tint','split','contrast','sat','lift','halation','grain','vignette','leak','dust','ca','flash','glow','nang','filmExp','sharp','kinh','bgBlur','motion','spark','paper','gloss','soft','ptex','film','printClear','toneExposure','toneBrightness','toneHighlights','toneShadows','toneWhites','toneBlacks','toneLocalEV','toneLocalBrightness','toneLocalWarmth','toneLocalColorAmount']);
 const signed=new Set(['temp','tint','split','contrast','sat','toneBrightness','toneHighlights','toneShadows','toneWhites','toneBlacks','toneLocalBrightness','toneLocalWarmth']);
 const ranges=Object.fromEntries(keys.map(key=>[key,Object.freeze(signed.has(key)?[-1,1]:key==='toneExposure'||key==='toneLocalEV'?[-2,2]:key==='rayThuNhat'?[0,1.5]:[0,1])]));Object.freeze(ranges);
 const fail=message=>new Error('Cường độ bộ lọc: '+message),clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 function plain(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const proto=Object.getPrototypeOf(value);if(proto===null||proto===Object.prototype)return true;
  // Frames and VM tests can supply another realm's ordinary JSON objects.
  if(Object.getPrototypeOf(proto)!==null)return false;
  const constructor=Object.getOwnPropertyDescriptor(proto,'constructor');
  return !!constructor&&!constructor.get&&!constructor.set&&typeof constructor.value==='function'&&constructor.value.name==='Object'&&Object.hasOwn(proto,'hasOwnProperty');
 }
 function fields(value,allowed){
  if(!plain(value))throw fail('cần dữ liệu JSON thuần.');
  for(const key of Reflect.ownKeys(value)){
   const d=Object.getOwnPropertyDescriptor(value,key);
   if(typeof key!=='string'||!allowed.includes(key)||d.get||d.set||!d.enumerable)throw fail('trường dữ liệu không được hỗ trợ.');
  }
 }
 function list(value,max){
  if(!Array.isArray(value)||value.length>max)throw fail('danh sách dữ liệu chưa hợp lệ.');
  const proto=Object.getPrototypeOf(value),constructor=proto&&Object.getOwnPropertyDescriptor(proto,'constructor');if(proto!==Array.prototype&&(!constructor||constructor.get||constructor.set||typeof constructor.value!=='function'||Object.getOwnPropertyDescriptor(constructor.value,'name')?.value!=='Array'))throw fail('danh sách cần prototype JSON thông thường.');
  for(const key of Reflect.ownKeys(value)){const d=Object.getOwnPropertyDescriptor(value,key);if(d.get||d.set||typeof key!=='string'||key!=='length'&&(!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=value.length))throw fail('danh sách cần dữ liệu thuần.');}
  for(let i=0;i<value.length;i++)if(!Object.hasOwn(value,String(i)))throw fail('danh sách không được để trống phần tử.');return value;
 }
 function number(value,min,max){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw fail('thông số ngoài phạm vi.');return value;}
 function text(value,max=160){if(typeof value!=='string'||!value.trim()||[...value].length>max||/[\u0000-\u001f\u007f]/.test(value))throw fail('tên chưa hợp lệ.');return value.trim().normalize('NFC');}
 function identifier(value){const id=text(value,128);if(!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(id))throw fail('mã lớp chưa hợp lệ.');return id;}
 function values(value,offset=false){
  fields(value,keys);const out={};for(const key of Object.keys(value)){const [min,max]=ranges[key];out[key]=number(value[key],offset?min-max:min,offset?max-min:max);}return out;
 }
 function sameKeys(a,b){const right=Object.keys(b);return Object.keys(a).length===right.length&&right.every(key=>Object.hasOwn(a,key));}
 function validate(value){
  fields(value,['version','kind','name','presetId','amount','refs']);
  if(value.version!==VERSION||!['current','layers'].includes(value.kind))throw fail('phiên bản hoặc nhóm màu chưa hợp lệ.');
  const out={version:VERSION,kind:value.kind,name:text(value.name),amount:number(value.amount,0,100),refs:[]},ids=new Set();
  if(Object.hasOwn(value,'presetId'))out.presetId=identifier(value.presetId);
  list(value.refs,MAX_REFS);for(let index=0;index<value.refs.length;index++){const ref=value.refs[index];
   fields(ref,['id','full','offset','rendered']);const id=identifier(ref.id);
   if(ids.has(id)||out.kind==='current'&&id!=='current')throw fail('mã lớp bị trùng hoặc sai nhóm.');ids.add(id);
   const full=values(ref.full),offset=values(ref.offset,true),rendered=values(ref.rendered);
   if(!sameKeys(full,offset)||!sameKeys(full,rendered))throw fail('thiếu thông số tham chiếu.');out.refs.push({id,full,offset,rendered});
  }
  return out;
 }
 function read(p,key){
  if(!p||typeof p!=='object')throw fail('thiếu thông số lớp.');
  const d=Object.getOwnPropertyDescriptor(p,key);if(!d)return 0;if(d.get||d.set)throw fail('thông số không được dùng getter.');return number(d.value,...ranges[key]);
 }
 function create(input={}){
  fields(input,['kind','name','presetId','amount','targets']);const {kind,name,presetId,targets}=input;
  list(targets,MAX_REFS);const refs=targets.map(target=>{
   fields(target,['id','p','keys']);if(!target.p||typeof target.p!=='object')throw fail('thiếu lớp tham chiếu.');
   const selected=target.keys===undefined?keys:Object.hasOwn(target,'keys')&&Array.isArray(target.keys)?target.keys:null;
   if(!selected)throw fail('danh sách thông số chưa hợp lệ.');list(selected,128);
   const full={},offset={},rendered={};for(const key of selected){if(!Object.hasOwn(ranges,key)||!Object.hasOwn(target.p,key))continue;const v=read(target.p,key);full[key]=rendered[key]=v;offset[key]=0;}
   return{id:target.id,full,offset,rendered};
  });
  return validate({version:VERSION,kind,name,...(presetId===undefined?{}:{presetId}),amount:100,refs});
 }
 function project(value,{p,layers=[]}={},amount){
  const state=validate(value),nextAmount=number(amount,0,100);if(!Array.isArray(layers))throw fail('danh sách lớp chưa hợp lệ.');
  let nextP=p,nextLayers=layers;const refs=[];
  for(const ref of state.refs){
   const index=state.kind==='layers'?layers.findIndex(layer=>layer&&layer.id===ref.id):-1,current=state.kind==='current'?p:index>=0?layers[index].p:null;
   if(!current)continue; // A deleted step remains deleted, even after another strength change.
   const full={...ref.full},offset={},rendered={},next={...current};
   for(const key of Object.keys(full)){
    const [min,max]=ranges[key],manual=ref.offset[key]+read(current,key)-ref.rendered[key];
    offset[key]=number(manual,min-max,max-min);
    rendered[key]=clamp(full[key]*nextAmount/100+manual,min,max);next[key]=rendered[key];
   }
   refs.push({id:ref.id,full,offset,rendered});
   if(state.kind==='current')nextP=next;else{if(nextLayers===layers)nextLayers=layers.slice();nextLayers[index]={...layers[index],p:next};}
  }
  return{state:{...state,amount:nextAmount,refs},p:nextP,layers:nextLayers};
 }
 return{VERSION,MAX_REFS,keys,ranges,create,validate,project};
});
