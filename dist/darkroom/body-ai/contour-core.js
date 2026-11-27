/* Independent recognition corrections and explicit, reversible photo reshaping drags. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RayContourCore=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=t=>t*t*(3-2*t);
 function validStroke(s){return !!s&&['drag','pull','paint','erase'].includes(s.mode)&&(s.effect===undefined||s.mode==='pull'&&s.effect==='reshape')&&Number.isFinite(s.size)&&s.size>=.001&&s.size<=8&&Array.isArray(s.points)&&s.points.length>0&&s.points.length<=512&&s.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(v=>Number.isFinite(v)&&v>=-32&&v<=33));}
 function restore(value){
  if(!value||value.version!==1||!Array.isArray(value.people)||value.people.length>30)return null;
  const people=[];for(const p of value.people){if(!p||typeof p.id!=='string'||!/^body-person-\d+$|^pose-\d+$/.test(p.id)||!Array.isArray(p.strokes)||p.strokes.length>160||!p.strokes.every(validStroke))return null;if(p.strokes.length)people.push({id:p.id,strokes:p.strokes.map(s=>({mode:s.mode,...(s.effect?{effect:s.effect}:{}),size:s.size,points:s.points.map(p=>p.slice())}))});}
  return people.length?{version:1,people}:null;
 }
 function state(){let people=[];return{
  capture:()=>people.length?{version:1,people}:null,
  restore(value){people=restore(value)?.people||[];},
  strokes:id=>people.find(p=>p.id===id)?.strokes||[],
  set(id,strokes){people=people.filter(p=>p.id!==id);if(strokes.length)people=[...people,{id,strokes}];},
  clear(){people=[];}
 };}
 function validMask(mask){return !!mask&&Number.isInteger(mask.width)&&Number.isInteger(mask.height)&&mask.width>0&&mask.height>0&&mask.width<=2048&&mask.height<=2048&&mask.foreground?.length===mask.width*mask.height;}
 function sample(a,w,h,x,y){if(x<-.5||y<-.5||x>w-.5||y>h-.5)return 0;x=clamp(x,0,w-1);y=clamp(y,0,h-1);const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,jx=Math.min(ix+1,w-1),jy=Math.min(iy+1,h-1);return(a[iy*w+ix]*(1-fx)+a[iy*w+jx]*fx)*(1-fy)+(a[jy*w+ix]*(1-fx)+a[jy*w+jx]*fx)*fy;}
 function applyStroke(mask,stroke,W,H){
  if(!validMask(mask)||!validStroke(stroke)||!(W>0&&H>0))return mask;
  // A reshape drag changes pixels after the AI warp. Recognition stays in its
  // original coordinate system; the visible outline is projected through the drag.
  if(stroke.effect==='reshape')return mask;
  const w=mask.width,h=mask.height,a=Uint8Array.from(mask.foreground),radius=stroke.size*Math.min(W,H)/2;
  if(stroke.mode==='pull'){
   if(stroke.points.length<2)return mask;const from=stroke.points[0],to=stroke.points.at(-1);let dx=(to[0]-from[0])*W,dy=(to[1]-from[1])*H;const k=Math.min(1,radius*.4/(Math.hypot(dx,dy)||1));dx*=k;dy*=k;
   const cx=from[0]*W+dx,cy=from[1]*H+dy;
   for(let y=Math.max(0,Math.floor((cy-radius)/H*h));y<Math.min(h,Math.ceil((cy+radius)/H*h));y++)for(let x=Math.max(0,Math.floor((cx-radius)/W*w));x<Math.min(w,Math.ceil((cx+radius)/W*w));x++){
    const px=(x+.5)/w*W,py=(y+.5)/h*H,d=Math.hypot(px-cx,py-cy)/radius;if(d>=1)continue;const f=smooth(1-d);a[y*w+x]=Math.round(sample(mask.foreground,w,h,(px-dx*f)/W*w-.5,(py-dy*f)/H*h-.5));
   }return{width:w,height:h,foreground:a};
  }
  function dab(cx,cy,dx=0,dy=0){
   const before=stroke.mode==='drag'?a.slice():null,extent=radius+Math.max(Math.abs(dx),Math.abs(dy)),left=clamp(Math.floor((cx-extent)/W*w),0,w),right=clamp(Math.ceil((cx+extent)/W*w),0,w),top=clamp(Math.floor((cy-extent)/H*h),0,h),bottom=clamp(Math.ceil((cy+extent)/H*h),0,h);
   for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
    const px=(x+.5)/w*W,py=(y+.5)/h*H,d=Math.hypot(px-cx,py-cy)/radius;if(d>=1)continue;
    const i=y*w+x;
    if(before){const f=smooth(1-d);a[i]=Math.round(sample(before,w,h,(px-dx*f)/W*w-.5,(py-dy*f)/H*h-.5));}
    else{const alpha=Math.round(255*smooth(clamp((1-d)/.28,0,1)));a[i]=stroke.mode==='erase'?Math.min(a[i],255-alpha):Math.max(a[i],alpha);}
   }
  }
  const points=stroke.points.map(([x,y])=>[x*W,y*H]);
  if(stroke.mode!=='drag')dab(...points[0]);
  for(let i=1;i<points.length;i++){
   const start=points[i-1],end=points[i],dx=end[0]-start[0],dy=end[1]-start[1],steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/Math.max(.5,radius*.22)));
   for(let j=1;j<=steps;j++)dab(start[0]+dx*j/steps,start[1]+dy*j/steps,dx/steps,dy/steps);
  }
  return{width:w,height:h,foreground:a};
 }
 function raster(mask,strokes,W,H){if(!strokes?.length)return mask;return strokes.reduce((m,s)=>applyStroke(m,s,W,H),mask);}
 function reshapeLines(value){
  const lines=[];for(const p of [...(value?.people||[])].sort((a,b)=>a.id.localeCompare(b.id)))for(const s of p.strokes||[]){
   if(!validStroke(s)||s.effect!=='reshape'||s.points.length<2)continue;
   const a=s.points[0],b=s.points.at(-1),offset=[clamp(b[0]-a[0],-32,33),clamp(b[1]-a[1],-32,33)];
   if(Math.hypot(...offset)<1e-9)continue;
   lines.push({id:'line-'+(lines.length+1),personId:p.id,points:[a.slice(),a.slice()],offsets:[offset.slice(),offset.slice()],size:Math.max(.003,s.size/2),strength:1});
  }return lines;
 }
 return{validStroke,validMask,restore,state,applyStroke,raster,reshapeLines};
});
