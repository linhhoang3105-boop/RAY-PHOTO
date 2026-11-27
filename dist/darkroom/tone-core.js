/* Basic photographic corrections and a feathered local light mask. Film recipes are unchanged. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./brush-core.js'):root.RayBrush);if(typeof module==='object'&&module.exports)module.exports=api;else{root.RayTone=api;api.init();}})(typeof globalThis!=='undefined'?globalThis:this,(Brush)=>{
 'use strict';
 const defaults={focusAngle:0,nangAspect:1,nangAngle:0,leakAspect:1,lightGuide:false,toneExposure:0,toneBrightness:0,toneHighlights:0,toneShadows:0,toneWhites:0,toneBlacks:0,toneLocalEnabled:true,toneLocalEV:0,toneLocalBrightness:0,toneLocalWarmth:0,toneLocalFeather:.55,toneLocalMode:'in',toneLocalShow:true,toneLocalShape:'ellipse',toneLocalAngle:0,toneLocalCurve:.7,toneLocalThickness:.035,toneLocalOpacity:1,toneLocalFill:'solid',toneLocalColor:'#ffd18c',toneLocalColorAmount:0,...(Brush?.defaults||{})};
 const keys=['toneExposure','toneBrightness','toneHighlights','toneShadows','toneWhites','toneBlacks','toneLocalEV','toneLocalBrightness','toneLocalWarmth','toneLocalColorAmount'];
 const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
 const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
 const localEnabled=p=>p.toneLocalEnabled!==false&&Number(p.toneLocalOpacity??1)>.00001;
 const active=p=>keys.some((k,i)=>(i<6||localEnabled(p))&&Math.abs(Number(p[k])||0)>.00001)||!!Brush?.active(p);
 function normalizeColor(value){let hex=String(value||'').trim();if(!/^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex))return null;hex=hex.replace('#','');if(hex.length===3)hex=[...hex].map(c=>c+c).join('');return'#'+hex.toLowerCase();}
 function exposureLUT(ev){const gain=2**clamp(Number(ev)||0,-2,2),out=new Float32Array(256);for(let i=0;i<256;i++){const s=i/255,linear=(s<=.04045?s/12.92:((s+.055)/1.055)**2.4)*gain;out[i]=clamp(linear<=.0031308?linear*12.92:1.055*linear**(1/2.4)-.055)*255;}return out;}
 function toneLUT(p,local=false){
  const out=new Float32Array(256),b=clamp(Number(p[local?'toneLocalBrightness':'toneBrightness'])||0,-1,1),sh=local?0:clamp(Number(p.toneShadows)||0,-1,1),hi=local?0:clamp(Number(p.toneHighlights)||0,-1,1),wh=local?0:clamp(Number(p.toneWhites)||0,-1,1),bl=local?0:clamp(Number(p.toneBlacks)||0,-1,1);
  for(let i=0;i<256;i++){
   const l=i/255,shadow=(1-smooth(.12,.60,l))*smooth(0,.035,l),highlight=smooth(.40,.85,l);
   let n=l+b*.24*4*l*(1-l);
   n+=sh*(sh>0?.45*(1-l):.6*l)*shadow;
   n+=hi*(hi>0?.6*(1-l):.35*l)*highlight;
   n+=wh*.18*smooth(.55,1,l)+bl*.16*(1-smooth(0,.40,l));out[i]=clamp(n)*255;
  }return out;
 }
 function segmentDistance(x,y,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,t=clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1));return Math.hypot(x-ax-t*dx,y-ay-t*dy);}
 function curveSquared(x,y,radius,bend,u){u=clamp(u,-1,1);return(radius*u-x)**2+(bend*(1-u*u)-y)**2;}
 // Exact nearest point on y = bend * (1 - u²), x = radius * u, -1 <= u <= 1.
 function curveDistance(x,y,radius,bend){
  if(Math.abs(bend)<1e-8)return Math.hypot(x-clamp(x,-radius,radius),y);
  const a=2*bend*bend,p=(radius*radius-2*bend*bend+2*bend*y)/a,q=-radius*x/a,half=q/2,third=p/3,disc=half*half+third*third*third;
  let best=Math.min((x+radius)**2+y*y,(x-radius)**2+y*y);
  if(disc>=0){const root=Math.sqrt(disc);best=Math.min(best,curveSquared(x,y,radius,bend,Math.cbrt(-half+root)+Math.cbrt(-half-root)));}
  else{const r=2*Math.sqrt(-third),phase=Math.acos(clamp(-half/Math.sqrt(-third*third*third),-1,1))/3;for(let k=0;k<3;k++)best=Math.min(best,curveSquared(x,y,radius,bend,r*Math.cos(phase+k*2*Math.PI/3)));}
  return Math.sqrt(best);
 }
 function regionMask(W,H,f,feather=.55,mode='in',shape='ellipse',angle=0,options={}){
  const rx=Math.max(1,Math.abs(f.rx)*W),ry=Math.max(1,Math.abs(f.ry)*H),cx=f.cx*W,cy=f.cy*H,rad=(Number(angle)||0)*Math.PI/180,cs=Math.cos(rad),sn=Math.sin(rad),soft=clamp(feather),inner=1-soft*.95;
  const thickness=clamp(Number(options.thickness??.035),.000001,4)*Math.min(W,H),radius=thickness/2,bend=clamp(Number(options.curve??.7),-1,1)*ry;
  const edge=d=>soft<=.00001?(d<1?1:0):1-smooth(inner*inner,1,d*d);
  return (x,y)=>{
   const dx=x+.5-cx,dy=y+.5-cy,lx=dx*cs+dy*sn,ly=-dx*sn+dy*cs,u=lx/rx,v=ly/ry;let inside;
   if(shape==='line'||shape==='curve'){
    const sigma=radius*(.3+.7*soft),reach=soft>0?sigma*4:radius;
    if(Math.abs(lx)>rx+reach||ly<Math.min(0,shape==='curve'?bend:0)-reach||ly>Math.max(0,shape==='curve'?bend:0)+reach)inside=0;
    else{const distance=shape==='curve'?curveDistance(lx,ly,rx,bend):Math.hypot(lx-clamp(lx,-rx,rx),ly);
     // Smooth light across the shaft and fade its ends; no flat painted band.
     if(soft>0){const d=distance/sigma,tail=1-smooth(1-soft*.4,1,Math.abs(u));inside=Math.exp(-.5*d*d)*(1-smooth(3,4,d))*tail;}
     else inside=edge(distance/radius);
    }
   }else if(shape==='beam'){
    const spread=(u+1)/2;
    if(u<=-1||u>=1||Math.abs(v)>=spread)inside=0;
    else{const side=edge(Math.abs(v)/spread),head=soft>0?smooth(-1,-1+soft*.6,u):1,tail=soft>0?1-smooth(1-soft*.8,1,u):1;inside=side*head*tail;}
   }else if(shape==='rect')inside=edge(Math.max(Math.abs(u),Math.abs(v)));
   else{const d=u*u+v*v;inside=soft<=.00001?(d<1?1:0):1-smooth(inner*inner,1,d);}
   if(options.fill==='outline'&&shape!=='line'&&shape!=='curve'&&inside>0){
    const distance=shape==='rect'?Math.min(rx-Math.abs(lx),ry-Math.abs(ly)):shape==='beam'?Math.min(segmentDistance(lx,ly,-rx,0,rx,-ry),segmentDistance(lx,ly,rx,-ry,rx,ry),segmentDistance(lx,ly,rx,ry,-rx,0)):(1-Math.hypot(u,v))*Math.min(rx,ry);
    inside=edge(Math.abs(distance-radius)/radius);
   }
   return mode==='out'?1-inside:inside;
  };
 }
 function regionWeight(x,y,W,H,f,feather=.55,mode='in',shape='ellipse',angle=0,options={}){return regionMask(W,H,f,feather,mode,shape,angle,options)(x,y);}
 function resizeRegion(f,W,H,dx,dy,angle=0,signX=1,signY=1){const a=(Number(angle)||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),unit=Math.min(W,H);return{rx:clamp(f.rx*W+(dx*c+dy*s)*signX,unit*.02,unit*1.2)/W,ry:clamp(f.ry*H+(-dx*s+dy*c)*signY,unit*.02,unit*.7)/H};}
 function autoAdjust(data){const histogram=new Uint32Array(256);let count=0;for(let i=0;i<data.length;i+=4){if(data[i+3]<128)continue;histogram[Math.round(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2])]++;count++;}if(!count)return{toneExposure:0,toneShadows:0,toneHighlights:0};const percentile=q=>{let n=0;for(let i=0;i<256;i++){n+=histogram[i];if(n>=count*q)return i/255;}return 1;},mid=percentile(.5),low=percentile(.1),high=percentile(.95);return{toneExposure:clamp(Math.log2(.43/Math.max(.025,mid))*.55,-.65,.65),toneShadows:clamp((.16-low)*1.3,0,.22),toneHighlights:-clamp((high-.88)*1.8,0,.22)};}
 function applyPixels(d,W,H,p,f){
  if(!active(p))return d;
  const global=keys.slice(0,6).some(k=>Math.abs(Number(p[k])||0)>.00001),local=localEnabled(p)&&keys.slice(6).some(k=>Math.abs(Number(p[k])||0)>.00001);
  const exposure=global?exposureLUT(p.toneExposure):null,tone=keys.slice(1,6).some(k=>Math.abs(Number(p[k])||0)>.00001)?toneLUT(p):null,localExposure=local?exposureLUT(p.toneLocalEV):null,localTone=Math.abs(Number(p.toneLocalBrightness)||0)>.00001?toneLUT(p,true):null;
  const mapped=(lut,l)=>{const lo=clamp(Math.floor(l),0,255),hi=Math.min(255,lo+1);return lut[lo]+(lut[hi]-lut[lo])*(l-lo);};
  const brush=Brush?.active(p)?Brush.raster(p.brushStrokes,W,H):null,brushExposure=brush?exposureLUT(p.brushEV):null;
  const weight=local?(p.toneLocalMode==='all'?()=>1:regionMask(W,H,f,p.toneLocalFeather??.55,p.toneLocalMode,p.toneLocalShape,p.toneLocalAngle,{thickness:p.toneLocalThickness,curve:p.toneLocalCurve,fill:p.toneLocalFill})):null,warm=clamp(Number(p.toneLocalWarmth)||0,-1,1),opacity=clamp(Number(p.toneLocalOpacity??1));
  const color=normalizeColor(p.toneLocalColor),amount=color?clamp(Number(p.toneLocalColorAmount)||0):0,channels=amount?[1,3,5].map(offset=>exposureLUT((Number(p.toneLocalEV)||0)+(parseInt(color.slice(offset,offset+2),16)/255-.5)*2*amount)):[localExposure,localExposure,localExposure];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const i=(y*W+x)*4;if(!d[i+3])continue;let r=d[i],g=d[i+1],b=d[i+2];
   if(global){r=exposure[r];g=exposure[g];b=exposure[b];if(tone){const l=.2126*r+.7152*g+.0722*b,n=mapped(tone,l);if(l>.00001){const gain=n/l;r=clamp(r*gain,0,255);g=clamp(g*gain,0,255);b=clamp(b*gain,0,255);}else r=g=b=n;}}
   if(local){const a=weight(x,y)*opacity;if(a>0){let rr=channels[0][clamp(Math.round(r),0,255)],gg=channels[1][clamp(Math.round(g),0,255)],bb=channels[2][clamp(Math.round(b),0,255)];if(localTone){const l=.2126*rr+.7152*gg+.0722*bb,n=mapped(localTone,l);if(l>.00001){const gain=n/l;rr=clamp(rr*gain,0,255);gg=clamp(gg*gain,0,255);bb=clamp(bb*gain,0,255);}else rr=gg=bb=n;}if(warm){rr=clamp(rr*(1+warm*.18),0,255);gg=clamp(gg*(1+warm*.025),0,255);bb=clamp(bb*(1-warm*.22),0,255);}r+=(rr-r)*a;g+=(gg-g)*a;b+=(bb-b)*a;}}
   if(brush){const a=brush.sample(x,y);if(a>0){r+=(brushExposure[clamp(Math.round(r),0,255)]-r)*a;g+=(brushExposure[clamp(Math.round(g),0,255)]-g)*a;b+=(brushExposure[clamp(Math.round(b),0,255)]-b)*a;}}
   d[i]=r;d[i+1]=g;d[i+2]=b;
  }return d;
 }
 const api={defaults,keys,active,normalizeColor,curveDistance,exposureLUT,regionWeight,regionMask,resizeRegion,autoAdjust,applyPixels};
 api.init=()=>{
  Object.assign(P,defaults);const warp=bodyWarp;
  bodyWarp=function(c,W,H){
   warp(c,W,H);if(!active(P))return;
   const image=c.getImageData(0,0,W,H);applyPixels(image.data,W,H,P,F);c.putImageData(image,0,0);
  };
 };
 return api;
});
