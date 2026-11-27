/* Match the fine source-pixel grain at reduced preview sizes. Export and recipes are untouched. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.RayPreviewTexture=api;api.init();}})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function random(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)|0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
 function scaleFor(input,reference){return Math.min(1,Math.sqrt(input.width*input.height/(reference.width*reference.height)));}
 function grain(target,input,p,scale){
  const bw=Math.max(0,Math.round((target.width-input.width)/2)),c=target.getContext('2d'),image=c.getImageData(bw,bw,input.width,input.height),d=image.data,rnd=random(p.seed),amount=(8+p.grain*54)*scale;
  for(let i=0;i<d.length;i+=4){
   if(!d[i+3])continue;
   const l=(d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722)/255,t=clamp((l-.12)/.73,0,1),w=1-t*t*(3-2*t);
   // Averaged fine grain has lower variance; never blur the photograph to remove coarse noise.
   const n=(rnd()*2-1)*amount*(.12+w*.88);
   d[i]=clamp(d[i]+n,0,255);d[i+1]=clamp(d[i+1]+n*.94,0,255);d[i+2]=clamp(d[i+2]+n*.94,0,255);
  }
  c.putImageData(image,bw,bw);
 }
 function scaledRender(target,input,p,reference,renderer){
  const scale=reference?scaleFor(input,reference):1,value=p.grain;
  if(scale>=.999999||!(value>.001))return renderer(target,input);
  // The original renderer still supplies every color/optical effect. Suppress only its enlarged
  // one-pixel noise for this synchronous preview pass, then restore the exact saved parameter.
  let result;try{p.grain=0;result=renderer(target,input);}finally{p.grain=value;}
  grain(target,input,p,scale);return result;
 }
 const api={scaleFor,grain,render:scaledRender};
 api.init=()=>{let reference=null;const previous=render;
  api.withReference=(size,paint)=>{const saved=reference;reference=size;try{return paint();}finally{reference=saved;}};
  Object.defineProperty(api,'referenceKey',{get:()=>reference?reference.width+'x'+reference.height:''});
  render=function(target,input){return scaledRender(target,input,P,reference,previous);};
 };
 return api;
});
