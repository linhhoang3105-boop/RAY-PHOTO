/* Lossless quarter turns, flips and a pixel-aligned crop on the retained source. */
(function(root,factory){const common=typeof module==='object'&&module.exports,api=factory(common?require('./background-core.js'):root.RayBackgroundCore);if(common)module.exports=api;else root.RayPhotoCore=api;})(typeof globalThis!=='undefined'?globalThis:this,Scene=>{
 'use strict';
 const identity=()=>[1,0,0,1,0,0],finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
 function multiply(a,b){return[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
 function inverse(m){const d=m[0]*m[3]-m[1]*m[2];if(Math.abs(d)<1e-9)throw new Error('Khung ảnh không hợp lệ.');return[m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,(m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d];}
 const point=(m,x,y)=>({x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]});
 function initial(W,H){return{width:W,height:H,matrix:identity()};}
 function operation(W,H,kind,rect){
  if(kind==='right')return{width:H,height:W,matrix:[0,1,-1,0,H,0]};
  if(kind==='left')return{width:H,height:W,matrix:[0,-1,1,0,0,W]};
  if(kind==='flipX')return{width:W,height:H,matrix:[-1,0,0,1,W,0]};
  if(kind==='flipY')return{width:W,height:H,matrix:[1,0,0,-1,0,H]};
  if(kind==='crop'){
   const x=Math.max(0,Math.min(W-2,Math.round(finite(rect?.x)*W))),y=Math.max(0,Math.min(H-2,Math.round(finite(rect?.y)*H))),width=Math.max(2,Math.min(W-x,Math.round(finite(rect?.width,1)*W))),height=Math.max(2,Math.min(H-y,Math.round(finite(rect?.height,1)*H)));
   return{width,height,matrix:[1,0,0,1,-x,-y]};
  }throw new Error('Thao tác ảnh chưa được hỗ trợ.');
 }
 function next(state,op){return{width:op.width,height:op.height,matrix:multiply(op.matrix,state.matrix)};}
 function render(src,state,makeCanvas){const cv=makeCanvas();cv.width=state.width;cv.height=state.height;const c=cv.getContext('2d');c.setTransform(...state.matrix);c.drawImage(src,0,0);c.setTransform(1,0,0,1,0,0);return cv;}
 function mapping(W,H,op){const m=op.matrix,nw=op.width,nh=op.height,inv=inverse(m);return{W,H,nw,nh,m,xy:(x,y)=>{const p=point(m,x*W,y*H);return{x:p.x/nw,y:p.y/nh};},vector:(x,y)=>({x:(m[0]*x*W+m[2]*y*H)/nw,y:(m[1]*x*W+m[3]*y*H)/nh}),angle:a=>Math.atan2(m[1]*Math.cos(a*Math.PI/180)+m[3]*Math.sin(a*Math.PI/180),m[0]*Math.cos(a*Math.PI/180)+m[2]*Math.sin(a*Math.PI/180))*180/Math.PI,inv};}
 function mapPlane(map,fields,t){
  if(!map)return map;
  // Turn the sampling grid too: keeping its old aspect ratio loses strand/edge samples.
  const w=map.width,h=map.height,m=t.m,
   width=Math.max(2,Math.round(t.nw*(Math.abs(m[0])*w/t.W+Math.abs(m[2])*h/t.H))),
   height=Math.max(2,Math.round(t.nh*(Math.abs(m[1])*w/t.W+Math.abs(m[3])*h/t.H))),out={...map,width,height};
  for(const key of fields){
   const data=map[key];if(!data||!ArrayBuffer.isView(data))continue;
   const result=new data.constructor(width*height);
   for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const p=point(t.inv,(x+.5)/width*t.nw,(y+.5)/height*t.nh),sx=Math.floor(p.x/t.W*w),sy=Math.floor(p.y/t.H*h);
    result[y*width+x]=sx>=0&&sx<w&&sy>=0&&sy<h?data[sy*w+sx]:0;
   }
   out[key]=result;
  }
  return out;
 }
 function remap(snapshot,W,H,op){
  const t=mapping(W,H,op),ratio=Math.min(W,H)/Math.min(t.nw,t.nh),maxRatio=Math.max(W,H)/Math.max(t.nw,t.nh),xy=o=>({...o,...t.xy(o.x,o.y)}),face=f=>f?.map(p=>p?({...p,...t.xy(p.x,p.y)}):p);
  const region=f=>{const p=t.xy(f.cx,f.cy);return{...f,cx:p.x,cy:p.y,rx:f.rx*W/t.nw,ry:f.ry*H/t.nh};};
  const strokes=list=>(list||[]).map(s=>({...s,size:s.size*ratio,points:s.points.map(([x,y])=>{const p=t.xy(x,y);return[p.x,p.y];})}));
  function params(p){const q={...p,brushStrokes:strokes(p.brushStrokes)};for(const k of ['focusAngle','toneLocalAngle','motionAngle','nangAngle','leakAngle'])if(Number.isFinite(p[k]))q[k]=t.angle(p[k]);if(p.nangSize)q.nangSize=p.nangSize*maxRatio;if(Number.isFinite(p.toneLocalThickness))q.toneLocalThickness=p.toneLocalThickness*ratio;if(p.toneLocalShape==='curve'&&t.m[0]*t.m[3]-t.m[1]*t.m[2]<0)q.toneLocalCurve=-(p.toneLocalCurve??.7);if(p.adjustRegion==='in'||p.adjustRegion==='out'){const c=t.xy(p.adjustRegionX??.5,p.adjustRegionY??.5);Object.assign(q,{adjustRegionX:c.x,adjustRegionY:c.y,adjustRegionRX:(p.adjustRegionRX??.32)*W/t.nw,adjustRegionRY:(p.adjustRegionRY??.32)*H/t.nh,adjustRegionAngle:t.angle(p.adjustRegionAngle||0),adjustRegionThickness:(p.adjustRegionThickness??.06)*ratio});if(p.adjustRegionShape==='curve'&&t.m[0]*t.m[3]-t.m[1]*t.m[2]<0)q.adjustRegionCurve=-(p.adjustRegionCurve??.7);}if(p.adjustRegionStrokes)q.adjustRegionStrokes=strokes(p.adjustRegionStrokes);if(p.adjustRegionStack)q.adjustRegionStack=p.adjustRegionStack.map(s=>{const mapped=params(s);delete mapped.brushStrokes;return mapped;});return q;}
  const pass=s=>({...s,p:{...params(s.p),nangManual:s.p.nang>.001?true:s.p.nangManual},focus:region(s.focus),sun:xy(s.p.nang>.001&&!s.p.nangManual?{x:.5,y:.04}:s.sun),leak:xy(s.leak)}),s=pass(snapshot);s.layers=(snapshot.layers||[]).map(pass);
  const bodyRegion=p=>{const c=t.xy(p.cx,p.cy),q={...p,cx:c.x,cy:c.y,rx:p.rx*H/t.nh,ry:p.ry*H/t.nh,rot:t.angle(p.rot||0),dir:t.angle(p.dir||0)};for(const k of ['ray67BaseRx','ray67BaseRy'])if(Number.isFinite(p[k]))q[k]=p[k]*H/t.nh;if(p.regionStrokes)q.regionStrokes=strokes(p.regionStrokes);if(p.rayArmGuards)q.rayArmGuards=strokes(p.rayArmGuards);if(p.rayPose){const a=t.xy(p.rayPose.a.x,p.rayPose.a.y),b=t.xy(p.rayPose.b.x,p.rayPose.b.y);q.rayPose={...p.rayPose,a,b,length:Math.hypot((b.x-a.x)*t.nw,(b.y-a.y)*t.nh)/t.nh};}return q;};
  s.body=(snapshot.body||[]).map(bodyRegion);
  if(snapshot.bodyProfiles)s.bodyProfiles={...snapshot.bodyProfiles,profiles:snapshot.bodyProfiles.profiles.map(p=>({...p,...t.xy(p.x,p.y),...(p.anchor?{anchor:t.xy(p.anchor.x,p.anchor.y)}:{}),parts:p.parts.map(bodyRegion)}))};
  if(snapshot.bodyContour)s.bodyContour={...snapshot.bodyContour,people:snapshot.bodyContour.people.map(p=>({...p,strokes:strokes(p.strokes)}))};
  if(snapshot.bodyLines)s.bodyLines={...snapshot.bodyLines,lines:snapshot.bodyLines.lines.map(l=>({...l,points:l.points.map(([x,y])=>{const p=t.xy(x,y);return[p.x,p.y];}),offsets:l.offsets.map(([x,y])=>{const p=t.vector(x,y);return[p.x,p.y];}),size:l.size*ratio}))};
  if(snapshot.doodle)s.doodle={...snapshot.doodle,strokes:snapshot.doodle.strokes.map(q=>({...q,width:q.width*ratio,points:q.points.map(([x,y])=>{const p=t.xy(x,y);return[p.x,p.y];})}))};
  const b=snapshot.beauty;if(b){const vals=v=>{const q={...v};for(const side of ['Left','Right']){const d=t.vector(v['brow'+side+'X']||0,v['brow'+side+'Y']||0);q['brow'+side+'X']=d.x;q['brow'+side+'Y']=d.y;}return q;};s.beauty={...b,maps:mapPlane(b.maps,['skin','hair','foreground','skinOwners','hairOwners'],t),faces:(b.faces||[]).map(face),instances:(b.instances||[]).map(m=>({...mapPlane(m,['data'],t),landmarks:face(m.landmarks)})),values:vals(b.values||{}),people:(b.people||[]).map(p=>{const f=face(p.face),xs=f?.filter(Boolean).map(q=>q.x)||[.5],ys=f?.filter(Boolean).map(q=>q.y)||[.5],left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys),nose=t.xy(p.g?.nx??.5,p.g?.ny??.5);return{...p,face:f,g:{...p.g,left,right,top,bottom,cx:(left+right)/2,cy:(top+bottom)/2,w:Math.max(.002,right-left),h:Math.max(.002,bottom-top),nx:nose.x,ny:nose.y},values:vals(p.values||{})};})};}
  if(snapshot.brows){s.brows={...snapshot.brows,points:(snapshot.brows.points||[]).map(xy),span:snapshot.brows.span*W/t.nw,face:face(snapshot.brows.face)};}
  if(snapshot.compose){const c=snapshot.compose,b=c.background||{},angle=(a,fx=false,fy=false)=>{const sign=fx?-1:1,u=point([t.m[0],t.m[1],t.m[2],t.m[3],0,0],Math.cos(a*Math.PI/180)*sign,Math.sin(a*Math.PI/180)*sign),det=(t.m[0]*t.m[3]-t.m[1]*t.m[2])*(fx?-1:1)*(fy?-1:1);return{angle:Math.atan2(u.y,u.x)*180/Math.PI,flipX:false,flipY:det<0};};s.compose={...c,subjectMask:c.subjectMask?{...mapPlane(c.subjectMask,['data'],t),id:c.subjectMask.id+':'+op.matrix.join(',')+':'+op.width+':'+op.height}:null,background:{...b,scene:b.scene?{...b.scene,subject:Scene.remapSubject(Scene.settings(b.scene).subject,W,H,op),shadow:{...Scene.settings(b.scene).shadow,angle:t.angle(Scene.settings(b.scene).shadow.angle)}}:b.scene,mask:b.mask?{...mapPlane(b.mask,['data'],t),id:b.mask.id+':'+op.matrix.join(',')+':'+op.width+':'+op.height}:null,strokes:strokes(b.strokes)},texts:(c.texts||[]).map(o=>({...xy(o),size:o.size*ratio,...angle(o.angle||0,o.flipX,o.flipY)})),people:(c.people||[]).map(o=>({...xy(o),size:o.size*ratio,...angle(o.angle||0,o.flipX,o.flipY)}))};}
  if(snapshot.removal){const r=snapshot.removal,mapDoc=r=>{const m=op.matrix,normalized=[m[0]*W/t.nw,m[1]*W/t.nh,m[2]*H/t.nw,m[3]*H/t.nh,m[4]/t.nw,m[5]/t.nh];const mask=m=>m?{...mapPlane(m,['data','candidate','exclusions'],t),point:m.point?t.xy(m.point.x,m.point.y):m.point,points:m.points?.map(p=>t.xy(p.x,p.y)),id:m.id+':'+op.matrix.join(',')+':'+op.width+':'+op.height}:null;return{...r,aiSelection:mask(r.aiSelection),lastAiSelection:mask(r.lastAiSelection),protectedMasks:(r.protectedMasks||[]).map(mask),autoMasks:(r.autoMasks||[]).map(mask),protectStrokes:strokes(r.protectStrokes),size:r.size*ratio,strokes:strokes(r.strokes),lastSelection:strokes(r.lastSelection),reference:r.reference?xy(r.reference):null,patches:r.patches.map(p=>({...p,placement:multiply(normalized,p.placement)}))};};const key=r.activeTarget||'source',mapped=key==='source'||key==='subject'?mapDoc(r):{...r};s.removal={...mapped,...(r.targetDocuments?{targetDocuments:Object.fromEntries(Object.entries(r.targetDocuments).map(([key,doc])=>[key,key==='source'||key==='subject'?mapDoc(doc):doc]))}:{})};}
  return s;
 }
 function fitCrop(W,H,aspect){if(!aspect)return{x:.1,y:.1,width:.8,height:.8};const width=Math.min(1,H*aspect/W)*.9,height=width*W/aspect/H;return{x:(1-width)/2,y:(1-height)/2,width,height};}
 return{initial,operation,next,render,remap,fitCrop,mapping,multiply,inverse,point};
});
