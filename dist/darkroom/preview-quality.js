/* Refine at screen resolution; export alone renders the retained source at output size. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./quality-core.js'):root.RayQuality);if(typeof module==='object'&&module.exports)module.exports=api;else{root.RayPreview=api;api.init();}})(typeof globalThis!=='undefined'?globalThis:this,Quality=>{
 'use strict';
 function copy(source,target,width,height,cover=false,make=()=>document.createElement('canvas')){return Quality.resample(source,target,width,height,make,cover);}
 function screenSize(W,H,{width,height,dpr=1,light=false}={}){
  const density=Math.max(1,Math.min(3,Number(dpr)||1)),edge=2400,pixels=3e6;
  const k=Math.min(1,Math.min((Number(width)||W)/W,(Number(height)||H)/H)*density,edge/Math.max(W,H),Math.sqrt(pixels/(W*H)));
  return{width:Math.max(1,Math.round(W*k)),height:Math.max(1,Math.round(H*k))};
 }
 function present({canvas,target,renderWidth,renderHeight,screen,make}){
  const W=canvas.width,H=canvas.height,size=screenSize(W,H,screen),bw=(W-renderWidth)/2,bb=H-renderHeight-bw;
  copy(canvas,target,size.width,size.height,false,make);const k=size.width/W;
  return{renderWidth,renderHeight,width:size.width,height:size.height,geometry:{W:renderWidth*k,H:renderHeight*k,bw:bw*k,bb:bb*k}};
 }
 function finalPreview({source,target,render,make,longEdge=null,maxPixels=Quality.MAX_PIXELS,screen}){
  const plan=Quality.plan(source.width,source.height,longEdge,maxPixels);let input=null,full=null;
  try{
   input=Quality.resize(source,plan,make);full=make();render(full,input);
   return present({canvas:full,target,renderWidth:plan.width,renderHeight:plan.height,screen,make});
  }finally{if(full)full.width=full.height=0;if(input&&input!==source)input.width=input.height=0;}
 }
 function refinementPlan(W,H,{screen={},longEdge=null}={}){
  const displayed=screenSize(W,H,screen),edge=Math.max(960,Math.round(Math.max(displayed.width,displayed.height)*1.25));
  return Quality.plan(W,H,Math.min(Number(longEdge)>0?Number(longEdge):Infinity,edge),1.6e6);
 }
 function thumbnailSource(source,make,{light=false}={}){
  const edge=light?560:800,k=Math.min(1,edge/Math.max(source.width,source.height));return copy(source,make(),source.width*k,source.height*k,false,make);
 }
 function thumbnail({source,target,render,make,dpr=1,width=62,height=53}){
  const full=make();try{render(full,source);const density=Math.max(2,Math.min(3,Number(dpr)||1));copy(full,target,width*density,height*density,true,make);return target;}
  finally{full.width=full.height=0;}
 }
 function scrollGesture(target){return !!target?.closest?.('.panel .scroll')&&!target.closest('input[type="range"],input[type="color"],textarea,select,.editor-tools-resize');}
 const api={copy,screenSize,present,refinementPlan,finalPreview,thumbnailSource,thumbnail,scrollGesture};
 api.init=()=>{
  const make=()=>document.createElement('canvas'),previousDraw=draw,pointers=new Set(),now=()=>window.performance?.now?.()??Date.now();let timer=0,idle=0,version=0,paused=0,lastInput=-Infinity,prepared=null;
  function releaseInput(){if(prepared&&prepared.canvas!==prepared.source)prepared.canvas.width=prepared.canvas.height=0;prepared=null;}
  function previewPass(paint){const reference=Quality.plan(source.width,source.height,exportLong);return window.RayPreviewTexture?.withReference?RayPreviewTexture.withReference(reference,paint):paint();}
  api.paint=(target,input)=>previewPass(()=>window.RayLayers?.preview?RayLayers.preview(()=>render(target,input)):render(target,input));
  // Refinement is visual only: no announcement, overlay, source replacement or AI restart.
  function cancel(){version++;clearTimeout(timer);if(idle&&window.cancelIdleCallback)cancelIdleCallback(idle);timer=idle=0;}
  function screen(){const box=window.RayWorkspace?.photoBox?.()||view.getBoundingClientRect();return{width:box.width,height:box.height,dpr:window.devicePixelRatio||1,light:document.body.dataset.lightPreview==='true'};}
  function ready(result){LASTG=result.geometry;view.dataset.previewQuality=result.renderWidth===source?.width&&result.renderHeight===source?.height?'full':'screen';view.dataset.renderWidth=String(result.renderWidth);view.dataset.renderHeight=String(result.renderHeight);window.RayWorkspace?.fitPhoto?.();syncOval();syncLeakHandle();syncNangHandle();syncBody();}
  api.showExport=(canvas,W,H)=>{cancel();ready(present({canvas,target:view,renderWidth:W,renderHeight:H,screen:screen(),make}));};
  function schedule(){
   const expected=version,photo=source;if(!photo)return;view.dataset.previewQuality='quick';if(paused||pointers.size)return;
   const light=document.body.dataset.lightPreview==='true';
   timer=setTimeout(()=>{
    timer=0;
    const run=()=>{
     idle=0;if(expected!==version||photo!==source||paused||pointers.size||document.hidden||!view.getBoundingClientRect().width||busy.classList.contains('on')||BEAUTY.busy||BODY_AI.busy||window.RayCompose?.busy||window.RayRemove?.busy)return;
     try{
      const display=screen(),plan=refinementPlan(photo.width,photo.height,{screen:display,longEdge:exportLong});
      if(!prepared||prepared.source!==photo||prepared.canvas.width!==plan.width||prepared.canvas.height!==plan.height){releaseInput();prepared={source:photo,canvas:Quality.resize(photo,plan,make)};}
      ready(finalPreview({source:prepared.canvas,target:view,render:api.paint,make,screen:display}));
     }catch{view.dataset.previewQuality='quick';}
    };
    if(window.requestIdleCallback)idle=requestIdleCallback(run,{timeout:800});else run();
   },light?700:350);
  }
  api.isQuiet=()=>!paused&&!pointers.size&&!timer&&!idle&&now()-lastInput>300&&!document.hidden&&!busy.classList.contains('on')&&!BEAUTY.busy&&!BODY_AI.busy&&!window.RayCompose?.busy&&!window.RayRemove?.busy;
  api.layoutChanged=()=>{cancel();if(source){const display=screen(),plan=refinementPlan(source.width,source.height,{screen:display,longEdge:exportLong}),size=screenSize(plan.width,plan.height,display);if(view.dataset.previewQuality!=='quick'&&view.width>=size.width&&view.height>=size.height){window.RayWorkspace?.fitPhoto?.();return;}schedule();}};
  api.pause=({refineOnResume=true}={})=>{paused++;cancel();releaseInput();let released=false;return()=>{if(released)return;released=true;paused--;if(!paused&&source&&refineOnResume)schedule();};};
  // Pause before draft saving/model loading as well as during inference. Resume after AI releases its resources.
  for(const id of ['beautyScan','bodyAiScan']){const button=document.getElementById(id),handler=button.onclick;button.onclick=async function(...args){const resume=api.pause();try{return await handler.apply(this,args);}finally{resume();}};}
  draw=function(){cancel();if(prepared&&prepared.source!==source)releaseInput();if(source)previewPass(previousDraw);else previousDraw();schedule();};
  document.addEventListener('pointerdown',e=>{if(scrollGesture(e.target))return;lastInput=now();pointers.add(e.pointerId);cancel();},{capture:true,passive:true});
  document.addEventListener('input',()=>{lastInput=now();},{capture:true,passive:true});
  for(const event of ['pointerup','pointercancel'])document.addEventListener(event,e=>{pointers.delete(e.pointerId);if(source&&!pointers.size&&view.dataset.previewQuality==='quick'&&!timer&&!idle)schedule();},{capture:true,passive:true});
  window.addEventListener('blur',()=>{pointers.clear();cancel();});
  window.addEventListener('focus',()=>{pointers.clear();if(source&&view.dataset.previewQuality==='quick')schedule();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();else if(source)queue();});
  document.getElementById('sizeSeg').addEventListener('click',()=>{if(source)queue();});
  window.addEventListener('pagehide',()=>{cancel();releaseInput();});
 };
 return api;
});
