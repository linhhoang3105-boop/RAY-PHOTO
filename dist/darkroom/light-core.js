/* Geometry-only adapter for the original sunlight gradients and focus masks. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.RayLight=api;api.init();}})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const defaults={focusAngle:0,nangAspect:1,nangAngle:0,leakAspect:1,lightGuide:false};
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),degrees=v=>((Number(v)+180)%360+360)%360-180;
 function corner(seed){let a=(seed>>>0)+0x6D2B79F5,t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return [[0,0],[1,0],[0,1],[1,1]][Math.floor(((t^(t>>>14))>>>0)/4294967296*4)];}
 function geometry(kind,p,point,W,H){const sun=kind==='sun',size=sun?(p.nangSize??.75):(.16+(p.leakBandWidth??.3)*.85),radius=Math.max(W,H)*size,aspect=clamp(Number(p[sun?'nangAspect':'leakAspect'])||1,.25,4);return{cx:point.x*W,cy:point.y*H,rx:radius*Math.sqrt(aspect),ry:radius/Math.sqrt(aspect),angle:Number(p[sun?'nangAngle':'leakAngle'])||0,radius,aspect};}
 let focusCache=null;
 function focusRaster(W,H,f,angle){
  const size=Math.min(1,768/Math.max(W,H)),width=Math.max(2,Math.round(W*size)),height=Math.max(2,Math.round(H*size)),data=new Uint8ClampedArray(width*height*4),a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),rx=Math.max(1,f.rx*W),ry=Math.max(1,f.ry*H);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const dx=(x+.5)/width*W-f.cx*W,dy=(y+.5)/height*H-f.cy*H,r=Math.hypot((dx*c+dy*s)/rx,(-dx*s+dy*c)/ry);data[(y*width+x)*4+3]=Math.round(clamp((1.3-r)/.58,0,1)*255);}
  return{width,height,data};
 }
 function withGeometry(renderer,target,src,p,f,sun,leak,proto,makeCanvas){
  const focus=Number(p.focusAngle)||0,stretchSun=Math.abs((p.nangAspect??1)-1)>.00001,stretchLeak=p.leakShape!=='patch'&&Math.abs((p.leakAspect??1)-1)>.00001;
  if(!proto||(!focus&&!stretchSun&&!stretchLeak))return renderer(target,src);
  const W=src.width,H=src.height,radial=proto.createRadialGradient,fillRect=proto.fillRect,fill=proto.fill,near=(a,b)=>Math.abs(a-b)<1e-6,photo=c=>c.canvas.width===W&&c.canvas.height===H,gradients=new WeakMap();
  const sp=p.nangManual?sun:{x:.5,y:.04},cp=corner(p.seed),lp=p.leakManual?leak:{x:cp[0],y:cp[1]},sg=geometry('sun',p,sp,W,H),lg=geometry('leak',p,lp,W,H);
  proto.createRadialGradient=function(x0,y0,r0,x1,y1,r1){
   const result=radial.call(this,x0,y0,r0,x1,y1,r1);let g=null;if(photo(this)&&r0===0&&near(x0,x1)&&near(y0,y1)){
    if(stretchSun&&p.nang>.001&&near(x0,sg.cx)&&near(y0,sg.cy)&&(near(r1,sg.radius)||near(r1,sg.radius*1.3)))g=sg;
    else if(stretchLeak&&p.leak>.001&&near(x0,lg.cx)&&near(y0,lg.cy)&&near(r1,lg.radius))g=lg;
   }
   if(g)gradients.set(result,g);return result;
  };
  proto.fillRect=function(x,y,w,h){const g=typeof this.fillStyle==='object'?gradients.get(this.fillStyle):null;if(!g)return fillRect.call(this,x,y,w,h);this.save();try{this.translate(g.cx,g.cy);this.rotate(g.angle*Math.PI/180);this.scale(Math.sqrt(g.aspect),1/Math.sqrt(g.aspect));this.translate(-g.cx,-g.cy);const D=Math.max(W,H)*5;return fillRect.call(this,-D,-D,D*2,D*2);}finally{this.restore();}};
  proto.fill=function(...args){
   if(focus&&photo(this)&&['destination-in','destination-out'].includes(this.globalCompositeOperation)){const m=this.getTransform();if(near(m.a,Math.max(1,f.rx*W))&&near(m.d,Math.max(1,f.ry*H))&&near(m.b,0)&&near(m.c,0)&&near(m.e,f.cx*W)&&near(m.f,f.cy*H)){
    const key=JSON.stringify([W,H,f.cx,f.cy,f.rx,f.ry,focus]);if(focusCache?.key!==key){if(focusCache)focusCache.canvas.width=focusCache.canvas.height=0;const mask=focusRaster(W,H,f,focus),canvas=makeCanvas();canvas.width=mask.width;canvas.height=mask.height;const c=canvas.getContext('2d'),image=c.createImageData(mask.width,mask.height);image.data.set(mask.data);c.putImageData(image,0,0);focusCache={key,canvas};}
    this.save();try{this.setTransform(1,0,0,1,0,0);this.drawImage(focusCache.canvas,0,0,W,H);}finally{this.restore();}return;
   }}return fill.apply(this,args);
  };
  try{return renderer(target,src);}finally{proto.createRadialGradient=radial;proto.fillRect=fillRect;proto.fill=fill;}
 }
 const api={defaults,degrees,corner,geometry,focusRaster,withGeometry};
 api.init=()=>{Object.assign(P,defaults);const previous=render;render=function(target,src){return withGeometry(previous,target,src,P,F,NK,LK,CanvasRenderingContext2D.prototype,()=>document.createElement('canvas'));};};
 return api;
});
