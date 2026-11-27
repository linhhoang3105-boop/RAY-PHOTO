/* Crop gestures share the same photo transform in the print and enlarged slot. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BoothGestures=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function bind(element,options){
  const points=new Map();let base=null,moved=false;
  const center=()=>{const p=[...points.values()];return{x:p.reduce((n,v)=>n+v.x,0)/p.length,y:p.reduce((n,v)=>n+v.y,0)/p.length,distance:p.length>1?Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y):0};};
  function rebase(){const snapshot=options.snapshot();base=snapshot?{...snapshot,center:center(),bounds:element.getBoundingClientRect()}:null;}
  element.addEventListener('pointerdown',e=>{
   if(e.button!==undefined&&e.button!==0)return;
   if(!points.size){if(options.start?.(e)===false)return;moved=false;}
   if(!options.snapshot())return;
   points.set(e.pointerId,{x:e.clientX,y:e.clientY});rebase();element.setPointerCapture?.(e.pointerId);e.preventDefault();
  });
  element.addEventListener('pointermove',e=>{
   if(!base||!points.has(e.pointerId))return;
   points.set(e.pointerId,{x:e.clientX,y:e.clientY});const c=center(),dx=c.x-base.center.x,dy=c.y-base.center.y;
   const ratio=points.size>1&&base.center.distance>0?c.distance/base.center.distance:1;
   if(Math.abs(dx)+Math.abs(dy)>3||Math.abs(ratio-1)>.015)moved=true;
   options.change(base,{dx,dy,ratio,bounds:base.bounds});e.preventDefault();
  });
  function end(e){if(!points.has(e.pointerId))return;points.delete(e.pointerId);if(points.size)rebase();else{base=null;options.end?.();}}
  for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,end);
  element.addEventListener('click',e=>{if(moved){e.preventDefault();e.stopImmediatePropagation?.();moved=false;}},true);
  element.addEventListener('dragstart',e=>e.preventDefault());
  element.addEventListener('wheel',e=>{if(options.wheel?.(e)===false)return;if(options.wheel)e.preventDefault();},{passive:false});
  return{cancel(){points.clear();base=null;}};
 }
 return{bind};
});
