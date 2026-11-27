/* Eyebrow shapes in a local, face-aligned coordinate system. No film/color state here. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RayBrowKit=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const STYLES=[
  {id:'original',name:'Giữ nguyên',arch:.15,thick:.24,peak:.66},
  {id:'natural',name:'Tự nhiên',arch:.24,thick:.30,peak:.65},
  {id:'straight',name:'Mày ngang',arch:.05,thick:.34,peak:.65},
  {id:'soft',name:'Cong nhẹ',arch:.34,thick:.29,peak:.64},
  {id:'arched',name:'Cánh cung',arch:.58,thick:.24,peak:.69},
  {id:'defined',name:'Sắc nét',arch:.43,thick:.34,peak:.71},
  {id:'thin',name:'Mày mảnh',arch:.37,thick:.16,peak:.66},
  {id:'fluffy',name:'Tơi sợi',arch:.22,thick:.40,peak:.63}
 ];
 const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
 const style=id=>STYLES.find(s=>s.id===id)||STYLES[0];
 function center(s,u){const t=clamp(u/s.peak,0,1),q=clamp((u-s.peak)/(1-s.peak),0,1);return u<=s.peak?s.arch*(1-(1-t)*(1-t)):s.arch*(1-q*q)-.10*q;}
 function thickness(s,u){return s.thick*Math.pow(Math.sin(Math.PI*clamp(u*.92+.04,0,1)),.35)*(1-.68*Math.pow(u,3));}
 function shapePath(ctx,s){
  ctx.beginPath();const n=44;
  for(let i=0;i<=n;i++){const u=i/n,v=center(s,u)+thickness(s,u)*.5;i?ctx.lineTo(u,v):ctx.moveTo(u,v);}
  for(let i=n;i>=0;i--){const u=i/n;ctx.lineTo(u,center(s,u)-thickness(s,u)*.5);}ctx.closePath();
 }
 const sides=[{inner:[107,55],outer:[70,46],ids:[70,63,105,66,107,55,65,52,53,46]},
  {inner:[336,285],outer:[300,276],ids:[300,293,334,296,336,285,295,282,283,276]}];
 function anchors(face,side,W,H,v={}){
  if(side.ids.some(i=>!face[i]||!Number.isFinite(face[i].x)||!Number.isFinite(face[i].y)))return null;
  const avg=ids=>({x:ids.reduce((t,i)=>t+face[i].x*W,0)/ids.length,y:ids.reduce((t,i)=>t+face[i].y*H,0)/ids.length});
  const inner=avg(side.inner),outer=avg(side.outer),dx=outer.x-inner.x,dy=outer.y-inner.y,span=Math.hypot(dx,dy);
  if(span<3)return null;let ux=dx/span,uy=dy/span,nx=uy,ny=-ux;
  if(ny>0){nx=-nx;ny=-ny;}
  const angle=(v.browRotation||0)*Math.PI/180*Math.sign(dx),cs=Math.cos(angle),sn=Math.sin(angle);
  const tx=ux*cs-uy*sn,ty=ux*sn+uy*cs;ux=tx;uy=ty;nx=uy;ny=-ux;if(ny>0){nx=-nx;ny=-ny;}
  const lift=(v.browLift||0)*span*.28,length=span*clamp(v.browLength||1,.75,1.3),height=span*.38*clamp(v.browThickness||1,.5,1.6);
  const key=side===sides[0]?'browLeft':'browRight';
  return{x:inner.x+nx*lift+(v[key+'X']||0)*W,y:inner.y+ny*lift+(v[key+'Y']||0)*H,ux,uy,nx,ny,length,height,span,side};
 }
 function transform(ctx,a,ox=0,oy=0){ctx.transform(a.ux*a.length,a.uy*a.length,a.nx*a.height,a.ny*a.height,a.x-ox,a.y-oy);}
 function drawTexture(ctx,s,color,seed=1){
  shapePath(ctx,s);ctx.save();ctx.clip();ctx.fillStyle=color;ctx.globalAlpha=.18;ctx.fillRect(-.05,-1,1.2,2);
  let z=seed|0;const rnd=()=>{z=(Math.imul(z,1664525)+1013904223)|0;return(z>>>0)/4294967296;};
  ctx.strokeStyle=color;ctx.lineCap='round';const n=s.id==='fluffy'?125:95;
  for(let i=0;i<n;i++){
   const u=.01+rnd()*.98,v=center(s,u),t=thickness(s,u),bottom=v-t*(.35+rnd()*.2),top=v+t*(.2+rnd()*.35);
   ctx.globalAlpha=(.30+.50*rnd())*Math.min(1,u*8+.15);ctx.lineWidth=.004+rnd()*.006;
   ctx.beginPath();ctx.moveTo(u,bottom);ctx.quadraticCurveTo(u+.018,top-.02,u+.035,top);ctx.stroke();
  }
  ctx.restore();ctx.globalAlpha=1;
 }
 function preview(ctx,id,w=112,h=58){ctx.clearRect(0,0,w,h);ctx.fillStyle='#f2e4cd';ctx.fillRect(0,0,w,h);ctx.save();ctx.transform(w*.80,0,0,-h*.65,w*.10,h*.65);drawTexture(ctx,style(id),'#503d32',42);ctx.restore();}
 function render(c,W,H,people,makeCanvas){
  for(let pi=0;pi<people.length;pi++){
   const {face,values:v}=people[pi];if(!v||v.brow<=.001||!v.browStyle||v.browStyle==='original')continue;
   const s=style(v.browStyle);if(s.id==='original')continue;
   for(const side of sides){
    const a=anchors(face,side,W,H,v);if(!a)continue;
    const points=[[-.16,-.9],[-.16,1.1],[1.18,-.9],[1.18,1.1]].map(([u,t])=>({x:a.x+a.ux*a.length*u+a.nx*a.height*t,y:a.y+a.uy*a.length*u+a.ny*a.height*t}));
    const ox=Math.max(0,Math.floor(Math.min(...points.map(p=>p.x))-2)),oy=Math.max(0,Math.floor(Math.min(...points.map(p=>p.y))-2));
    const w=Math.min(W-ox,Math.ceil(Math.max(...points.map(p=>p.x))+2)-ox),h=Math.min(H-oy,Math.ceil(Math.max(...points.map(p=>p.y))+2)-oy);if(w<2||h<2)continue;
    const layer=makeCanvas(w,h),x=layer.getContext('2d');x.save();transform(x,a,ox,oy);shapePath(x,s);x.fillStyle='#fff';x.fill();x.restore();const mask=x.getImageData(0,0,w,h).data;
    x.clearRect(0,0,w,h);x.beginPath();side.ids.forEach((id,i)=>{const px=face[id].x*W-ox,py=face[id].y*H-oy;i?x.lineTo(px,py):x.moveTo(px,py);});x.closePath();x.fillStyle='#fff';x.fill();const old=x.getImageData(0,0,w,h).data;
    const image=c.getImageData(ox,oy,w,h),d=image.data,base=new Uint8ClampedArray(d);
    // Fade original hairs only outside the new silhouette, sampling nearby skin above the brow.
    for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){
     const k=(yy*w+xx)*4,oldA=old[k+3]/255,newA=mask[k+3]/255;if(!oldA||newA>.9)continue;
     const sx=clamp(Math.round(xx+a.nx*a.span*.22),0,w-1),sy=clamp(Math.round(yy+a.ny*a.span*.22),0,h-1),q=(sy*w+sx)*4;
     const l=.2126*base[k]+.7152*base[k+1]+.0722*base[k+2],sl=.2126*base[q]+.7152*base[q+1]+.0722*base[q+2];
     const alpha=oldA*(1-newA)*v.brow*.78*clamp((sl-l)/55,0,1);for(let ch=0;ch<3;ch++)d[k+ch]+=(base[q+ch]-d[k+ch])*alpha;
    }
    c.putImageData(image,ox,oy);x.clearRect(0,0,w,h);x.save();transform(x,a,ox,oy);drawTexture(x,s,v.browColor||'#553c32',43+pi*17);x.restore();
    c.save();c.globalAlpha=clamp(v.brow,0,1);c.drawImage(layer,ox,oy);c.restore();layer.width=layer.height=0;
   }
  }
 }
 return{STYLES,style,center,thickness,shapePath,anchors,preview,render,sides};
});
