/* Keep the existing CPU/worker detector and model assets; request its person mask too. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.RayBodyPose=api;api.init();}})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 async function engine(assets,onStatus,dependencies={}){
  const limit=(promise,ms)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Tải AI quá lâu')),ms);Promise.resolve(promise).then(v=>{clearTimeout(timer);resolve(v);},e=>{clearTimeout(timer);reject(e);});});
  const read=dependencies.fetch||fetch,importModule=dependencies.importModule||(path=>import(path));let api,files;
  for(const root of assets.roots){try{api=await limit(importModule(root+'/vision_bundle.mjs'),20000);files=await limit(api.FilesetResolver.forVisionTasks(root+'/wasm'),10000);break;}catch{api=null;}}
  if(!api)throw new Error('Không tải được thư viện AI');const buffers={};let tail=Promise.resolve();
  async function task(kind){let bytes=buffers[kind];
   if(!bytes){onStatus('Đang tải AI '+(kind==='pose'?'cơ thể và viền người':'khuôn mặt')+'…');const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),45000);
    try{const response=await read(assets[kind],{signal:ctrl.signal,credentials:'omit'});if(!response.ok)throw new Error('Không tải được mô hình '+kind);bytes=buffers[kind]=new Uint8Array(await response.arrayBuffer());}finally{clearTimeout(timer);}
   }
   const options={baseOptions:{modelAssetBuffer:bytes,delegate:'CPU'},runningMode:'IMAGE'};
   if(kind==='pose')Object.assign(options,{numPoses:6,minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5,outputSegmentationMasks:true});
   else Object.assign(options,{numFaces:6,minFaceDetectionConfidence:.55,minFacePresenceConfidence:.55,outputFaceBlendshapes:false,outputFacialTransformationMatrixes:false});
   return(kind==='pose'?api.PoseLandmarker:api.FaceLandmarker).createFromOptions(files,options);
  }
  const landmarks=lists=>lists.map(points=>points.map(point=>({...point})));
  async function detect(image,report){if(report)onStatus=report;const result={poses:[],faces:[],masks:[],errors:[],errorDetails:{}};
   // Keep only model bytes between scans. Close the pose graph before opening
   // the face graph, including failed inference, to release its WASM/GL memory.
   for(const kind of ['pose','face']){let model,found;try{model=await task(kind);onStatus('Đang nhận diện '+(kind==='pose'?'tay, chân và viền người':'khuôn mặt')+'…');await new Promise(r=>setTimeout(r,0));found=model.detect(image);
     if(kind==='pose'){result.poses=landmarks(found.landmarks||[]);result.masks=(found.segmentationMasks||[]).map(mask=>{const values=mask.getAsFloat32Array(),foreground=new Uint8Array(values.length);for(let i=0;i<values.length;i++)foreground[i]=Math.round(Math.max(0,Math.min(1,values[i]))*255);return{width:mask.width,height:mask.height,foreground};});}
     else result.faces=landmarks(found.faceLandmarks||[]);
    }catch(error){result.errors.push(kind);result.errorDetails[kind]=String(error?.message||error).slice(0,500);}finally{try{found?.close?.();}catch{}try{model?.close?.();}catch{}}}
   if(result.errors.length===2)throw new Error(Object.values(result.errorDetails).join(' · '));return result;
  }
  return{detect(image,report){const run=tail.then(()=>detect(image,report));tail=run.then(()=>{},()=>{});return run;}};
 }
 const api={engine};
 api.init=()=>{
  const core=window.RayBodyCore,cache=window.RayBodyRecognition,$=id=>document.getElementById(id);if(!core||!$('bodyBox'))return;
  let recognition={image:source,phase:'idle',message:'',fromDraft:false};
  const file=()=>window.BuongToiApp?.sourceFile?.()||null;
  function graphics(){try{const canvas=document.createElement('canvas');return!!(canvas.getContext('webgl2')||canvas.getContext('webgl'));}catch{return false;}}
  function updateOptions(){const picker=$('bodyAiPerson');picker.replaceChildren();BODY_AI.people.forEach((person,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent='Người '+(i+1)+' · '+(person.x<.38?'bên trái':person.x>.62?'bên phải':'ở giữa');picker.append(option);});picker.value=String(BODY_AI.selected);if(typeof bodyAiUI==='function')bodyAiUI();}
  // Extend the old list, preserving every old part and every saved identifier.
  for(const [id,name,x]of [['foreL','Cẳng tay trái',.24],['foreR','Cẳng tay phải',.76]])if(!BODY_DEF.some(d=>d[0]===id))BODY_DEF.push([id,name,x,.56,.035,.10,0]);
  for(const d of BODY_DEF)if(core.LIMBS[d[0]])d[1]=core.LIMBS[d[0]];
  function ensureParts(){for(const d of BODY_DEF){let p=bodyPart(d[0]);if(!p){p={id:d[0],name:d[1],cx:d[2],cy:d[3],rx:d[4],ry:d[5],rot:d[6],size:0,wid:0,len:0,push:0,dir:0,soft:.5,place:'default'};BODY.parts.push(p);}if(core.LIMBS[p.id])p.name=core.LIMBS[p.id];
    if(!bodyChipEls[p.id]){const button=document.createElement('button');button.type='button';button.className='body-chip';button.textContent=p.name;button.onclick=()=>{bodyEnd();BODY.sel=p.id;BODY.hide=false;bodyUI();syncBody();};$('bodyParts').append(button);bodyChipEls[p.id]=button;}
    else bodyChipEls[p.id].textContent=p.name;
   }}
  ensureParts();const previousUI=bodyUI;bodyUI=function(...args){ensureParts();return previousUI.apply(this,args);};
  const previousRegions=bodyAiRegions;bodyAiRegions=function(pose,face,W,H){const regions=previousRegions(pose,face,W,H),limbs=core.limbRegions(pose,W,H);for(const id of Object.keys(core.LIMBS))delete regions[id];Object.assign(regions,limbs);Object.defineProperty(regions,'rayPose',{value:pose});return regions;};
  const previousPeople=bodyAiPeople;bodyAiPeople=function(result,W,H){const people=previousPeople(result,W,H).map(person=>{const index=(result.poses||[]).indexOf(person.regions.rayPose);return{...person,rayHasPose:index>=0,rayMask:index>=0?result.masks?.[index]||null:null,raySource:source};});
   if(recognition.image===source&&recognition.phase==='scanning'){
    recognition.found=people.length;
    if(!people.some(p=>p.rayHasPose)&&recognition.previous?.people.some(p=>p.rayHasPose)){recognition.found=0;recognition.message||='Lần quét mới chưa tìm được tư thế cơ thể.';return[];}
   }return people;
  };
  bodyAiEngine=engine;
  // The legacy scan catches detector errors. Preserve their cause for the body pane.
  if(typeof bodyAiDetect==='function'){const detect=bodyAiDetect;bodyAiDetect=async function(input,id){const image=source;try{const result=await detect(input,id);if(image===source&&id===BODY_AI.job&&result.errors?.includes('pose'))recognition.message=cache?.failure(result.errorDetails?.pose||'Không tải được AI cơ thể',graphics())||'Chưa tải được AI cơ thể.';return result;}catch(error){if(image===source&&id===BODY_AI.job)recognition.message=cache?.failure(error,graphics())||String(error.message||error);throw error;}};}
  if(typeof bodyAiMessage==='function'){const message=bodyAiMessage;bodyAiMessage=function(value){if(recognition.image===source&&recognition.phase==='scanning'){
    if(recognition.message&&/Chưa chạy được AI/.test(value))value=recognition.message;
    const status=$('ray62OverallStatus');if(status&&$('bodyBox').dataset.bodyMode==='body')status.textContent=value;
   }return message(value);};}
  const scan=$('bodyAiScan').onclick;
  if(scan)$('bodyAiScan').onclick=async function(event){if(!source||BODY_AI.busy)return;const image=source,previous={people:BODY_AI.people.filter(p=>p.raySource===source),selected:BODY_AI.selected,fromDraft:recognition.fromDraft};recognition={image,phase:'scanning',message:'',fromDraft:false,found:0,previous};window.RayRatioLive?.cancel();
   try{return await scan.call(this,event);}finally{if(source===image){
     if(!recognition.found&&previous.people.length){const warning=(recognition.message||'Lần quét mới chưa có kết quả rõ hơn.')+' Đang giữ viền và người đã nhận diện trước đó.';BODY_AI.people=previous.people;BODY_AI.selected=Math.min(previous.selected,previous.people.length-1);recognition={image,phase:'ready',message:'',warning,fromDraft:previous.fromDraft};updateOptions();bodyAiMessage(warning);}
     else{delete recognition.previous;recognition.phase=BODY_AI.people.length?'ready':recognition.message?'failed':'empty';
     if(!BODY_AI.people.length&&!recognition.message)recognition.message='Chưa tìm thấy cơ thể rõ trong ảnh. Thử ảnh đủ tay, chân hoặc chuyển sang Từng vùng. Các chỉnh sửa đã giữ vẫn còn.';
     else if(!recognition.message&&BODY_AI.people.length&&!BODY_AI.people.some(p=>p.rayHasPose))recognition.message='AI mới tìm thấy khuôn mặt, chưa có tư thế cơ thể. Thử ảnh rõ toàn thân hoặc dùng Từng vùng để đặt tay, chân.';
     if(recognition.message&&typeof bodyAiMessage==='function')bodyAiMessage(recognition.message);
     }
     if(typeof bodyAiUI==='function')bodyAiUI();window.RayOverall62?.refresh();window.RaySession?.contextChanged();
    }}
  };
  if(typeof bodyAiReset==='function'){const reset=bodyAiReset;bodyAiReset=function(...args){recognition={image:source,phase:'idle',message:'',fromDraft:false};return reset.apply(this,args);};}
  api.failure=()=>recognition.image===source?recognition.message:'';
  api.warning=()=>recognition.image===source?recognition.warning||'':'';
  api.fromDraft=()=>recognition.image===source&&recognition.fromDraft;
  api.hasRecognition=()=>{const p=BODY_AI.people[BODY_AI.selected];return!!p&&p.raySource===source&&p.rayHasPose;};
  api.capture=()=>!source||!cache?null:cache.pack({people:BODY_AI.people.filter(p=>p.raySource===source),selected:BODY_AI.selected,W:source.width,H:source.height,file:file(),ui:{mode:$('ray62Mode')?.value,scope:$('ray62Scope')?.value,strength:Number($('ray62Strength')?.value),outline:$('rayBodyOutline')?.checked,bodyMode:$('bodyBox').dataset.bodyMode}},BODY_DEF.map(d=>d[0]));
  api.restore=saved=>{
   if(!source||!cache)return false;const restored=cache.unpack(saved,{W:source.width,H:source.height,file:file()},BODY_DEF.map(d=>d[0]));if(!restored)return false;
   BODY_AI.people=restored.people.map(p=>({...p,raySource:source}));BODY_AI.selected=restored.selected;recognition={image:source,phase:restored.people.length?'ready':'idle',message:'',fromDraft:restored.people.length>0};updateOptions();
   const ui=restored.ui;for(const [id,value]of [['ray62Mode',ui.mode],['ray62Scope',ui.scope]]){const control=$(id);if(control&&[...control.options].some(o=>o.value===value))control.value=value;}
   if(Number.isFinite(ui.strength)&&ui.strength>=0&&ui.strength<=100)$('ray62Strength').value=String(ui.strength);
   if(typeof ui.outline==='boolean')$('rayBodyOutline').checked=ui.outline;
   if(['manual','body','face'].includes(ui.bodyMode))window.RayBodyWorkspace?.selectMode?.(ui.bodyMode);
   window.RayGeometry54?.scheduleOverlay();window.RayOverall62?.refresh();return true;
  };
  api.mask=()=>{const person=BODY_AI.people[BODY_AI.selected];return person?.raySource===source?person.rayMask:null;};
  api.ensureParts=ensureParts;
 };
 return api;
});
