/* Masked recoloring preserves texture and never touches pixels outside a mask. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./darkroom/hair-core.js'):root.RayHair);if(typeof module==='object'&&module.exports)module.exports=api;else root.MakeupCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Hair){
 'use strict';
 let factory=null;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function setCanvasFactory(f){factory=f;}
 function canvas(w,h){if(factory)return factory(w,h);const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
 const LIP_OUTER=[61,185,40,39,37,0,267,269,270,409,291,375,321,405,314,17,84,181,91,146];
 const LIP_INNER=[78,191,80,81,82,13,312,311,310,415,308,324,318,402,317,14,87,178,88,95];
 const BROWS=[[70,63,105,66,107,55,65,52,53,46],[336,296,334,293,300,276,283,282,295,285]];
 function path(c,points,ids,w,h){if(!ids.every(i=>points[i]&&Number.isFinite(points[i].x)&&Number.isFinite(points[i].y)))return false;c.beginPath();ids.forEach((i,k)=>{const p=points[i];k?c.lineTo(p.x*w,p.y*h):c.moveTo(p.x*w,p.y*h);});c.closePath();return true;}
 function faceMasks(w,h,faces,selected=-1){
  const lips=canvas(w,h),brows=canvas(w,h),lc=lips.getContext('2d'),bc=brows.getContext('2d');lc.fillStyle=bc.fillStyle='#fff';
  faces.forEach((points,index)=>{if(selected>=0&&selected!==index)return;
   if(path(lc,points,LIP_OUTER,w,h))lc.fill();
   lc.save();lc.globalCompositeOperation='destination-out';if(path(lc,points,LIP_INNER,w,h))lc.fill();lc.restore();
   for(const ids of BROWS)if(path(bc,points,ids,w,h))bc.fill();
  });
  feather(lips,1);feather(brows,1);return{lips,brows};
 }
 function feather(mask,radius=1){
  const c=mask.getContext('2d'),im=c.getImageData(0,0,mask.width,mask.height),d=im.data,w=mask.width,h=mask.height,a=new Float32Array(w*h),tmp=new Float32Array(w*h),r=Math.max(1,Math.round(radius)),n=2*r+1;
  for(let i=0;i<a.length;i++)a[i]=d[i*4+3];
  for(let y=0;y<h;y++){let sum=0;for(let k=-r;k<=r;k++)sum+=a[y*w+clamp(k,0,w-1)];for(let x=0;x<w;x++){tmp[y*w+x]=sum/n;sum+=a[y*w+clamp(x+r+1,0,w-1)]-a[y*w+clamp(x-r,0,w-1)];}}
  for(let x=0;x<w;x++){let sum=0;for(let k=-r;k<=r;k++)sum+=tmp[clamp(k,0,h-1)*w+x];for(let y=0;y<h;y++){a[y*w+x]=sum/n;sum+=tmp[clamp(y+r+1,0,h-1)*w+x]-tmp[clamp(y-r,0,h-1)*w+x];}}
  for(let i=0;i<a.length;i++){d[i*4]=d[i*4+1]=d[i*4+2]=255;d[i*4+3]=a[i];}c.putImageData(im,0,0);return mask;
 }
 function hairMask(w,h,values,mw,mh,refined=false){
  if(!values||values.length!==mw*mh)throw new Error('Vùng tóc không hợp lệ.');
  const small=canvas(mw,mh),ctx=small.getContext('2d'),im=ctx.createImageData(mw,mh);
  for(let i=0;i<values.length;i++){const v=refined?clamp(values[i],0,1):Hair.confidence(values[i]);im.data[i*4]=im.data[i*4+1]=im.data[i*4+2]=255;im.data[i*4+3]=v*255;}
  ctx.putImageData(im,0,0);const out=canvas(w,h);out.getContext('2d').drawImage(small,0,0,w,h);small.width=small.height=1;return out;
 }
 function brush(mask,from,to,size,erase=false){
  const c=mask.getContext('2d'),r=Math.max(1,size*mask.width/2),x0=clamp(from.x,0,1)*mask.width,y0=clamp(from.y,0,1)*mask.height,x1=clamp(to.x,0,1)*mask.width,y1=clamp(to.y,0,1)*mask.height,steps=Math.max(1,Math.ceil(Math.hypot(x1-x0,y1-y0)/Math.max(1,r*.4)));
  c.save();c.globalCompositeOperation=erase?'destination-out':'source-over';
  for(let i=0;i<=steps;i++){const x=x0+(x1-x0)*i/steps,y=y0+(y1-y0)*i/steps,g=c.createRadialGradient(x,y,r*.62,x,y,r);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}c.restore();
 }
 function rgb(hex){const m=/^#([a-f0-9]{6})$/i.exec(hex||'');return m?[0,2,4].map(i=>parseInt(m[1].slice(i,i+2),16)):null;}
 function tint(data,w,h,mask,color,strength,kind){
  const col=rgb(color),amount=clamp((+strength||0)/100,0,1);if(!mask||!amount||!col)return;
  const resized=canvas(w,h),ctx=resized.getContext('2d');ctx.drawImage(mask,0,0,w,h);const alpha=ctx.getImageData(0,0,w,h).data,cl=.2126*col[0]+.7152*col[1]+.0722*col[2];
  if(kind==='hair'){
   const hair=new Uint8Array(w*h);for(let k=0;k<hair.length;k++)hair[k]=alpha[k*4+3];
   Hair.apply(data,w,h,{width:w,height:h,hair},[{hair:amount,hairColor:color}]);resized.width=resized.height=1;return;
  }
  for(let i=0;i<data.length;i+=4){if(!alpha[i+3]||!data[i+3])continue;const lum=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];
   let mix=amount*alpha[i+3]/255,ratio;
   if(kind==='brows'){ratio=clamp((lum*.75+cl*.25)/Math.max(cl,12),.50,1.8);mix*=.78;}
   else{ratio=clamp((lum*.72+cl*.28)/Math.max(cl,12),.48,2);mix*=.82*(1-.5*Math.max(0,(lum-185)/70));}
   for(let k=0;k<3;k++){const target=clamp(col[k]*ratio,0,255);data[i+k]+=(target-data[i+k])*mix;}
  }resized.width=resized.height=1;
 }
 function apply(data,w,h,masks,settings){for(const key of ['hair','brows','lips']){const s=settings[key]||{};tint(data,w,h,masks[key],s.color,s.strength,key);}return data;}
 function hasPixels(mask){const a=mask.getContext('2d').getImageData(0,0,mask.width,mask.height).data;for(let i=3;i<a.length;i+=4)if(a[i]>16)return true;return false;}
 return{setCanvasFactory,canvas,faceMasks,hairMask,feather,brush,tint,apply,hasPixels,LIP_OUTER,LIP_INNER,BROWS};
});
