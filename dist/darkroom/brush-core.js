/* Freehand masks: normalized vector strokes, a bounded raster cache, and no photo uploads. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RayBrush=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const defaults={brushEV:.6,brushSize:.12,brushSoftness:.65,brushMode:'paint',brushShowMask:false,brushStrokes:[]};
 const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v)),valid=pt=>Array.isArray(pt)&&Number.isFinite(pt[0])&&Number.isFinite(pt[1]);
 const active=p=>Math.abs(Number(p.brushEV)||0)>.00001&&Array.isArray(p.brushStrokes)&&p.brushStrokes.some(s=>s&&s.mode!=='erase'&&s.points?.some(valid));
 let cached=null;
 function raster(strokes,W,H,options={}){
  const cap=options.cap||768,minSize=options.minSize??.015,base=options.base||0,scale=cap/Math.max(W,H),GW=Math.max(2,Math.round(W*scale)),GH=Math.max(2,Math.round(H*scale));
  if(cached?.strokes===strokes&&cached.W===W&&cached.H===H&&cached.cap===cap&&cached.minSize===minSize&&cached.base===base)return cached.mask;
  const data=new Float32Array(GW*GH).fill(base),strokeMask=new Float32Array(data.length),unit=Math.min(W,H),sx=GW/W,sy=GH/H;
  for(const stroke of Array.isArray(strokes)?strokes:[]){
   if(!stroke||typeof stroke!=='object')continue;
   const points=Array.isArray(stroke.points)?stroke.points.filter(valid):[];if(!points.length)continue;
   strokeMask.fill(0);const radius=Math.max(.5,clamp(Number(stroke.size)||.12,minSize,.5)*unit/2),soft=clamp(Number(stroke.softness)||0),inner=radius*(1-soft*.98),span=Math.max(.0001,radius-inner);
   for(let n=0;n<Math.max(1,points.length-1);n++){
    const a=points[n],b=points[Math.min(n+1,points.length-1)],ax=a[0]*W,ay=a[1]*H,bx=b[0]*W,by=b[1]*H,dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy;
    const x0=Math.max(0,Math.floor((Math.min(ax,bx)-radius)*sx)),x1=Math.min(GW-1,Math.ceil((Math.max(ax,bx)+radius)*sx)),y0=Math.max(0,Math.floor((Math.min(ay,by)-radius)*sy)),y1=Math.min(GH-1,Math.ceil((Math.max(ay,by)+radius)*sy));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
     const px=(x+.5)/sx,py=(y+.5)/sy,t=len?clamp(((px-ax)*dx+(py-ay)*dy)/len):0,d=Math.hypot(px-ax-t*dx,py-ay-t*dy);if(d>=radius)continue;
     const f=soft<=.00001||d<=inner?1:1-((v)=>v*v*(3-2*v))(clamp((d-inner)/span)),k=y*GW+x;if(f>strokeMask[k])strokeMask[k]=f;
    }
   }
   for(let i=0;i<data.length;i++)data[i]=stroke.mode==='erase'?data[i]*(1-strokeMask[i]):Math.max(data[i],strokeMask[i]);
  }
  const mask={width:GW,height:GH,data,sample(x,y){const u=clamp((x+.5)*GW/W-.5,0,GW-1),v=clamp((y+.5)*GH/H-.5,0,GH-1),x0=Math.floor(u),y0=Math.floor(v),x1=Math.min(GW-1,x0+1),y1=Math.min(GH-1,y0+1),fx=u-x0,fy=v-y0;return(data[y0*GW+x0]*(1-fx)+data[y0*GW+x1]*fx)*(1-fy)+(data[y1*GW+x0]*(1-fx)+data[y1*GW+x1]*fx)*fy;}};
  cached={strokes,W,H,mask,cap,minSize,base};return mask;
 }
 return{defaults,active,raster};
});
