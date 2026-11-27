/* Per-layer adjustment coverage. Original color/optical formulas run unchanged. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./tone-core.js'):root.RayTone,typeof module==='object'&&module.exports?require('./region-paint-core.js'):root.RayRegionPaint);if(typeof module==='object'&&module.exports)module.exports=api;else{root.RayAdjustScope=api;api.init();}})(typeof globalThis!=='undefined'?globalThis:this,(Tone,Paint)=>{
 'use strict';
 const controls={adjustRegion:'all',adjustRegionShape:'ellipse',adjustRegionX:.5,adjustRegionY:.5,adjustRegionRX:.32,adjustRegionRY:.32,adjustRegionAngle:0,adjustRegionFeather:.4,adjustRegionThickness:.06,adjustRegionCurve:.7};
 const defaults={...controls,adjustRegionShow:false,adjustRegionPlaced:false,adjustRegionStack:[],adjustRegionTargets:[],adjustRegionStrokes:[],adjustRegionDrawing:false,adjustRegionPaintMode:'paint',adjustRegionBrushSize:.12};
 const effects=['rayThuNhat','temp','tint','split','contrast','sat','lift','halation','grain','vignette','leak','dust','ca','flash','glow','nang','filmExp','sharp','kinh','bgBlur','motion','spark','paper','gloss','soft','ptex','film','printClear',...Tone.keys];
 const regional=p=>p?.adjustRegion==='in'||p?.adjustRegion==='out';
 const scoped=p=>regional(p)||(p.adjustRegionStack||[]).some(regional);
 const settings=p=>({...Object.fromEntries(Object.entries(controls).map(([key,value])=>[key,p[key]??value])),...(p.adjustRegionShape==='freehand'?{adjustRegionStrokes:p.adjustRegionStrokes||[]}:{} )});
 const geometry=p=>({cx:Number(p.adjustRegionX??.5),cy:Number(p.adjustRegionY??.5),rx:Number(p.adjustRegionRX??.32),ry:Number(p.adjustRegionRY??.32)});
 function neutral(p){const out={...p,adjustRegion:'all',adjustRegionStack:[],brushStrokes:[]};for(const key of effects)out[key]=0;return out;}
 function restore(p,saved){for(const key of Object.keys(p))if(!Object.hasOwn(saved,key))delete p[key];Object.assign(p,saved);}
 function weight(p,W,H){
  const masks=[p,...(p.adjustRegionStack||[])].filter(regional).map(s=>{
   if(s.adjustRegionShape==='freehand'){
    if(!Paint?.hasPaint(s.adjustRegionStrokes))return()=>0;
    const mask=Paint.raster(s.adjustRegionStrokes,W,H,{cap:Paint.interactive?512:1536,feather:s.adjustRegionFeather??.4});
    return(x,y)=>{const value=mask.at((x+.5)/W,(y+.5)/H);return s.adjustRegion==='out'?1-value:value;};
   }
   return Tone.regionMask(W,H,geometry(s),s.adjustRegionFeather??.4,s.adjustRegion,s.adjustRegionShape||'ellipse',s.adjustRegionAngle||0,{thickness:s.adjustRegionThickness??.06,curve:s.adjustRegionCurve??.7,...(s.toneLocalMode==='all'&&Tone.keys.slice(6).some(k=>Math.abs(Number(s[k])||0)>.00001)?{fill:s.toneLocalFill}:{} )});
  });
  if(masks.length===1)return masks[0];
  return(x,y)=>masks.reduce((value,mask)=>value*mask(x,y),1);
 }
 function blendPixels(before,after,W,H,at,yOffset=0){
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const i=(y*W+x)*4,w=at(x,y+yOffset);if(w>=1)continue;if(w<=0){after.set(before.subarray(i,i+4),i);continue;}
   const a=before[i+3]*(1-w),b=after[i+3]*w,total=a+b;
   for(let c=0;c<3;c++)after[i+c]=total?(before[i+c]*a+after[i+c]*b)/total:before[i+c];after[i+3]=total;
  }return after;
 }
 function blendCanvas(target,base,src,p){
  const W=src.width,H=src.height,bw=Math.max(0,Math.round((target.width-W)/2)),at=weight(p,W,H),a=base.getContext('2d',{willReadFrequently:true}),b=target.getContext('2d',{willReadFrequently:true});
  // Bound temporary pixel buffers even for a full-resolution export.
  for(let y=0;y<H;y+=64){const rows=Math.min(64,H-y),before=a.getImageData(bw,bw+y,W,rows),after=b.getImageData(bw,bw+y,W,rows);blendPixels(before.data,after.data,W,rows,at,y);b.putImageData(after,bw,bw+y);}
  return target;
 }
 function renderScoped(target,src,p,render,make,cache){
  if(!scoped(p)||target.classList?.contains('roll-thumb'))return render(target,src);
  const saved={...p};let base=cache?.get?.(src),owned=false;
  try{
   if(!base){base=make();owned=true;try{Object.assign(p,neutral(saved));render(base,src);}finally{restore(p,saved);}if(cache?.put?.(src,base))owned=false;}
   render(target,src);return blendCanvas(target,base,src,saved);
  }finally{restore(p,saved);if(owned&&base)base.width=base.height=0;}
 }
 const api={controls,defaults,effects,regional,scoped,settings,geometry,neutral,weight,blendPixels,blendCanvas,renderScoped};
 api.init=()=>{
  Object.assign(P,defaults);const previous=render;let cached=null;
  function invalidate(){if(cached)cached.canvas.width=cached.canvas.height=0;cached=null;}
  api.invalidate=invalidate;
  render=function(target,src){
   if(!scoped(P))return previous(target,src);
   const canCache=(target===view||!!window.RayPreviewTexture?.referenceKey)&&src.width*src.height<=2e6&&!document.body.classList.contains('ray-video-mode');
   const key=canCache?JSON.stringify({frame:P.frame,stamp:P.stamp,date:P.dateText,stampScale:P.stampScale,seed:P.seed,body:BODY.parts,profiles:window.RayBodyPeople?.capture(),bodyPeek:BODY.peek,beautyPeek:BEAUTY.peek,beauty:BEAUTY.values,people:BEAUTY.people.map(p=>({id:p.id,values:p.values})),ready:BEAUTY.ready,brows:window.RayBrows?.capture(),reference:window.RayPreviewTexture?.referenceKey}):null;
   const cache=canCache?{get(input){return cached?.src===input&&cached.W===input.width&&cached.H===input.height&&cached.key===key&&cached.maps===BEAUTY.maps&&cached.faces===BEAUTY.faces?cached.canvas:null;},put(input,canvas){invalidate();cached={src:input,W:input.width,H:input.height,key,maps:BEAUTY.maps,faces:BEAUTY.faces,canvas};return true;}}:null;
   if(!canCache)invalidate();return renderScoped(target,src,P,previous,()=>document.createElement('canvas'),cache);
  };
 };
 return api;
});
