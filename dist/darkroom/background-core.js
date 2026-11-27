/* Local portrait placement, edge matting, scene occlusion and grounded shadows.
 * All coordinates in a recipe are normalized; original pixels and masks are retained. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./brush-core.js'):root.RayBrush);if(typeof module==='object'&&module.exports)module.exports=api;else root.RayBackgroundCore=api;})(typeof globalThis!=='undefined'?globalThis:this,Brush=>{
 'use strict';
 const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,finite(v,a)));
 const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
 function defaults(){return{version:3,subject:{x:.5,y:.5,scale:1,angle:0,yaw:0,pitch:0,warp:null,anchor:null,flipX:false,flipY:false,hidden:false},dehalo:.4,match:0,exposure:0,warmth:0,depth:'front',showGhost:true,occlusion:null,regions:[],selectedRegion:null,occlusionStrokes:[],shadow:{enabled:false,opacity:.28,length:.28,angle:35,softness:.5,contact:.5}};}
 function settings(value){const d=defaults(),s=value||{},regions=[...(s.regions||[])];if(s.occlusion&&!regions.some(r=>r.id==='legacy:'+s.occlusion.id))regions.unshift({id:'legacy:'+s.occlusion.id,label:'Vùng vật cũ',mask:s.occlusion,enabled:true});return{...d,...s,occlusion:null,regions,selectedRegion:s.selectedRegion||regions.at(-1)?.id||null,subject:{...d.subject,...s.subject},shadow:{...d.shadow,...s.shadow},occlusionStrokes:s.occlusionStrokes||[]};}
 function signature(value){if(!value)return null;const s=settings(value);return{...s,occlusion:null,removedObjects:s.removedObjects?.id||null,regions:s.regions.map(r=>({id:r.id,label:r.label,enabled:r.enabled,mask:r.mask?.id||null}))};}
 function regionAt(scene,x,y){if(x<0||x>1||y<0||y>1)return null;return settings(scene).regions.slice().reverse().find(r=>r.mask&&sample(r.mask,x,y)>.3*255)||null;}
 function toggleRegion(scene,id,enabled){const s=settings(scene);return{...s,depth:'behind',selectedRegion:id,regions:s.regions.map(r=>r.id===id?{...r,enabled:enabled===undefined?r.enabled===false:!!enabled}:r)};}
 function contour(mask){const data=new Uint8ClampedArray(mask.data.length),w=mask.width,h=mask.height;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(mask.data[i]<48)continue;if(!x||!y||x===w-1||y===h-1||mask.data[i-1]<48||mask.data[i+1]<48||mask.data[i-w]<48||mask.data[i+w]<48)data[i]=170;}return{width:w,height:h,data};}
 function matrix(subject,W,H){const s=subject||{},k=clamp(s.scale??1,.05,4),a=finite(s.angle)*Math.PI/180,cs=Math.cos(a)*k,sn=Math.sin(a)*k,fx=s.flipX?-1:1,fy=s.flipY?-1:1;return[cs*fx,sn*fx,-sn*fy,cs*fy,finite(s.x,.5)*W-(cs*fx*W-sn*fy*H)/2,finite(s.y,.5)*H-(sn*fx*W+cs*fy*H)/2];}
 const point=(m,x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
 function inverse(m){const d=m[0]*m[3]-m[1]*m[2];return[m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,(m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d];}
 function multiply(a,b){return[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
 const identity=()=>[1,0,0,0,1,0,0,0,1];
 function product3(a,b){const out=new Array(9).fill(0);for(let r=0;r<3;r++)for(let c=0;c<3;c++)for(let k=0;k<3;k++)out[r*3+c]+=a[r*3+k]*b[k*3+c];return out;}
 function inverse3(m){const [a,b,c,d,e,f,g,h,i]=m,out=[e*i-f*h,c*h-b*i,b*f-c*e,f*g-d*i,a*i-c*g,c*d-a*f,d*h-e*g,b*g-a*h,a*e-b*d],det=a*out[0]+b*out[3]+c*out[6];if(Math.abs(det)<1e-10)throw Error('Góc phối cảnh chưa hợp lệ.');return out.map(v=>v/det);}
 function point3(m,x,y){const z=m[6]*x+m[7]*y+m[8];return[(m[0]*x+m[1]*y+m[2])/z,(m[3]*x+m[4]*y+m[5])/z];}
 const affine3=m=>[m[0],m[2],m[4],m[1],m[3],m[5],0,0,1];
 function perspective(yaw=0,pitch=0,W=1,H=1){
  const y=clamp(yaw,-65,65)*Math.PI/180,p=clamp(pitch,-55,55)*Math.PI/180,cy=Math.cos(y),sy=Math.sin(y),cp=Math.cos(p),sp=Math.sin(p),unit=Math.max(W,H),sx=W/unit,sz=H/unit,d=2.5;
  // Project an actual rotated plane with a finite camera distance; no stretch-only approximation.
  const X=[cy*sx,sy*sp*sz,(-cy*sx-sy*sp*sz)/2],Y=[0,cp*sz,-cp*sz/2],Z=[sy*sx,-cy*sp*sz,d-sy*sx/2+cy*sp*sz/2];
  return[X[0]*d/sx+Z[0]/2,X[1]*d/sx+Z[1]/2,X[2]*d/sx+Z[2]/2,Y[0]*d/sz+Z[0]/2,Y[1]*d/sz+Z[1]/2,Y[2]*d/sz+Z[2]/2,...Z].map(v=>v/d);
 }
 function warpOf(subject,W,H){const w=subject?.warp;return Array.isArray(w)&&w.length===9&&w.every(Number.isFinite)?w:perspective(subject?.yaw,subject?.pitch,W,H);}
 const flat=m=>m.every((v,i)=>Math.abs(v-identity()[i])<1e-10);
 function localPoint(subject,W,H,x,y){const q=point3(warpOf(subject,W,H),x,y);return[q[0]*W,q[1]*H];}
 function project(subject,W,H,x,y){const q=localPoint(subject,W,H,x,y);return point(matrix(subject,W,H),...q);}
 function unproject(subject,W,H,x,y){const p=point(inverse(matrix(subject,W,H)),x*W,y*H);return point3(inverse3(warpOf(subject,W,H)),p[0]/W,p[1]/H);}
 function reframe(subject,values,W,H){const next={...subject,...values},anchor=subject.anchor;if(anchor&&Number.isFinite(anchor.u)&&Number.isFinite(anchor.v)&&!('x'in values)&&!('y'in values)){const a=project(subject,W,H,anchor.u,anchor.v),b=project(next,W,H,anchor.u,anchor.v);next.x=finite(next.x,.5)+(a[0]-b[0])/W;next.y=finite(next.y,.5)+(a[1]-b[1])/H;}return next;}
 // Direct handles rotate/scale around the visible cutout or its chosen contact,
 // rather than the original photo's potentially empty centre. This does not
 // replace the saved contact: a temporary handle pivot is gesture-local.
 function adjustAt(subject,values,W,H,pivot=subject?.anchor||{u:.5,v:.5}){
  const u=Array.isArray(pivot)?pivot[0]:pivot?.u,v=Array.isArray(pivot)?pivot[1]:pivot?.v;
  if(!subject||!Number.isFinite(W)||!Number.isFinite(H)||W<=0||H<=0||!Number.isFinite(u)||!Number.isFinite(v))return subject;
  const next={...subject,...values};if('anchor'in subject)next.anchor=subject.anchor;else delete next.anchor;
  if('scale'in (values||{}))next.scale=Number.isFinite(values.scale)?clamp(values.scale,.05,4):finite(subject.scale,1);
  if('angle'in (values||{}))next.angle=Number.isFinite(values.angle)?((values.angle+180)%360+360)%360-180:finite(subject.angle);
  const a=project(subject,W,H,u,v),b=project(next,W,H,u,v);
  if(!a.concat(b).every(Number.isFinite))return subject;
  next.x=finite(next.x,.5)+(a[0]-b[0])/W;next.y=finite(next.y,.5)+(a[1]-b[1])/H;return next;
 }
 // Pairs are world-normalized image points. Their similarity transform lives
 // outside the perspective plane, so all photographed points follow the same
 // fingers even after tilt/flip; a deliberate two-finger move moves the contact.
 function gestureTransform(subject,W,H,startPair,currentPair){
  const valid=pair=>Array.isArray(pair)&&pair.length===2&&pair.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite));
  if(!subject||!Number.isFinite(W)||!Number.isFinite(H)||W<=0||H<=0||!valid(startPair)||!valid(currentPair))return subject;
  const [a,b]=startPair.map(p=>[p[0]*W,p[1]*H]),[c,d]=currentPair.map(p=>[p[0]*W,p[1]*H]),sx=b[0]-a[0],sy=b[1]-a[1],cx=d[0]-c[0],cy=d[1]-c[1],before=Math.hypot(sx,sy),after=Math.hypot(cx,cy);
  if(before<1e-4||after<1e-4)return subject;
  const start=[(a[0]+b[0])/2,(a[1]+b[1])/2],end=[(c[0]+d[0])/2,(c[1]+d[1])/2],delta=Math.atan2(sx*cy-sy*cx,sx*cx+sy*cy)*180/Math.PI;
  let pivot;try{pivot=unproject(subject,W,H,start[0]/W,start[1]/H);}catch{return subject;}
  if(!pivot.every(Number.isFinite))return subject;
  const next=adjustAt(subject,{scale:clamp(finite(subject.scale,1)*after/before,.05,4),angle:finite(subject.angle)+delta},W,H,pivot);
  if(next===subject)return subject;return{...next,x:next.x+(end[0]-start[0])/W,y:next.y+(end[1]-start[1])/H};
 }
 function tilt(subject,values,W,H){const yaw=clamp(values.yaw??subject.yaw??0,-65,65),pitch=clamp(values.pitch??subject.pitch??0,-55,55),warp=product3(product3(perspective(yaw,pitch,W,H),inverse3(perspective(subject.yaw,subject.pitch,W,H))),warpOf(subject,W,H));const den=[[0,0],[1,0],[1,1],[0,1]].map(([x,y])=>warp[6]*x+warp[7]*y+warp[8]);if(den.some(v=>v<.08))return subject;return reframe(subject,{yaw,pitch,warp},W,H);}
 function placeAt(subject,bounds,W,H,x,y){const anchor={u:(bounds.left+bounds.right)/2,v:bounds.bottom},p=project(subject,W,H,anchor.u,anchor.v);return{...subject,hidden:false,anchor,x:finite(subject.x,.5)+x-p[0]/W,y:finite(subject.y,.5)+y-p[1]/H};}
 function remapSubject(subject,W,H,op){const m=multiply(multiply(op.matrix,matrix(subject,W,H)),inverse(op.matrix)),p=point(m,op.width/2,op.height/2),flip=m[0]*m[3]-m[1]*m[2]<0,t=affine3([op.matrix[0]*W/op.width,op.matrix[1]*W/op.height,op.matrix[2]*H/op.width,op.matrix[3]*H/op.height,op.matrix[4]/op.width,op.matrix[5]/op.height]),before=warpOf(subject,W,H),warp=flat(before)?null:product3(product3(t,before),inverse3(t)),a=subject.anchor?point3(t,subject.anchor.u,subject.anchor.v):null;return{...subject,x:p[0]/op.width,y:p[1]/op.height,scale:Math.hypot(m[0],m[1]),angle:Math.atan2(m[1],m[0])*180/Math.PI,flipX:false,flipY:flip,warp,anchor:a?{u:a[0],v:a[1]}:null};}
 function cover(W,H,IW,IH,zoom=1,x=.5,y=.5){const k=Math.max(W/IW,H/IH)*clamp(zoom,1,3),width=IW*k,height=IH*k;return{x:-(width-W)*clamp(x),y:-(height-H)*clamp(y),width,height};}
 function scenePoint(background,image,W,H,x,y){const r=cover(W,H,image.width,image.height,background.zoom,background.x,background.y);return[(x*W-r.x)/r.width,(y*H-r.y)/r.height];}
 function sample(mask,x,y){const u=clamp(x*mask.width-.5,0,mask.width-1),v=clamp(y*mask.height-.5,0,mask.height-1),ix=Math.floor(u),iy=Math.floor(v),nx=Math.min(ix+1,mask.width-1),ny=Math.min(iy+1,mask.height-1),fx=u-ix,fy=v-iy;return(mask.data[iy*mask.width+ix]*(1-fx)+mask.data[iy*mask.width+nx]*fx)*(1-fy)+(mask.data[ny*mask.width+ix]*(1-fx)+mask.data[ny*mask.width+nx]*fx)*fy;}
 function alphaBounds(mask){
  let left=1,right=0,top=1,bottom=0,total=0;const {width:w,height:h,data}=mask;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[y*w+x]>32){left=Math.min(left,x/w);right=Math.max(right,(x+1)/w);top=Math.min(top,y/h);bottom=Math.max(bottom,(y+1)/h);total++;}
  if(!total)return null;
  let sx=0,sw=0,fl=right,fr=left;const y0=Math.max(0,Math.floor((bottom-(bottom-top)*.08)*h)),y1=Math.min(h,Math.ceil(bottom*h));
  for(let y=y0;y<y1;y++)for(let x=0;x<w;x++){const a=data[y*w+x]/255;if(a<.3)continue;sx+=(x+.5)/w*a;sw+=a;fl=Math.min(fl,x/w);fr=Math.max(fr,(x+1)/w);}
  return{left,right,top,bottom,footX:sw?sx/sw:(left+right)/2,footWidth:Math.max((right-left)*.2,fr-fl),coverage:total/(w*h)};
 }
 function selectionMask(raw,at,id){
  const {width:w,height:h}=raw,n=w*h,seedX=Math.round(clamp(at.x)*(w-1)),seedY=Math.round(clamp(at.y)*(h-1)),byte=raw.data instanceof Uint8Array||raw.data instanceof Uint8ClampedArray?1:255,values=Uint8Array.from(raw.data,v=>Math.round(smooth((v*byte/255-.28)/.5)*255));
  let seed=-1,best=Infinity;for(let y=Math.max(0,seedY-8);y<=Math.min(h-1,seedY+8);y++)for(let x=Math.max(0,seedX-8);x<=Math.min(w-1,seedX+8);x++){const d=(x-seedX)**2+(y-seedY)**2;if(values[y*w+x]>96&&d<best){best=d;seed=y*w+x;}}
  if(seed<0)throw Error('Chưa thấy rõ vật được chạm. Chạm vào giữa vật hoặc tô bằng bút.');
  const seen=new Uint8Array(n),queue=new Int32Array(n);let read=0,write=1;queue[0]=seed;seen[seed]=1;
  while(read<write){const i=queue[read++],x=i%w,y=Math.floor(i/w);for(const k of [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1])if(k>=0&&!seen[k]&&values[k]>20){seen[k]=1;queue[write++]=k;}}
  if(write<n*.0002||write>n*.96)throw Error('Vùng nhận diện chưa rõ. Dùng bút tô phần vật cần che người.');
  return{id,width:w,height:h,data:Uint8Array.from(values,(v,i)=>seen[i]?v:0)};
 }
 function mergeMasks(a,b,id){if(!a)return{...b,id};const data=Uint8Array.from(b.data,(v,i)=>Math.max(v,sample(a,(i%b.width+.5)/b.width,(Math.floor(i/b.width)+.5)/b.height)));return{...b,id,data};}
 // After explicitly placing a cutout against a chair/table, only its front
 // below that contact should cover the person. Keep the AI source mask intact.
 function clipBelow(mask,yNorm){const edge=clamp(yNorm)*mask.height,data=new Uint8Array(mask.data.length);for(let y=0;y<mask.height;y++){const keep=smooth(y+1-edge);for(let x=0;x<mask.width;x++){const i=y*mask.width+x;data[i]=Math.round(mask.data[i]*keep);}}return{...mask,data};}
 function occlusionMask(scene,IW,IH){
  const s=settings(scene),k=Math.min(1,768/Math.max(IW,IH)),width=Math.max(2,Math.round(IW*k)),height=Math.max(2,Math.round(IH*k)),data=new Uint8ClampedArray(width*height);
  for(const region of s.regions)if(region.enabled!==false&&region.mask)for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x;data[i]=Math.max(data[i],sample(region.mask,(x+.5)/width,(y+.5)/height));}
  if(s.occlusionStrokes.length){
   // Apply strokes in order so a later eraser can also remove AI-selected areas.
   for(const stroke of s.occlusionStrokes){const m=Brush.raster([{...stroke,mode:'paint'}],width,height,{cap:Math.max(width,height),minSize:.001});for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x,a=m.sample(x,y);data[i]=stroke.mode==='erase'?data[i]*(1-a):Math.max(data[i],a*255);}}
  }
  if(s.removedObjects)for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x;data[i]*=1-sample(s.removedObjects,(x+.5)/width,(y+.5)/height)/255;}
  return{width,height,data};
 }
 function maskCanvas(mask,make){const cv=make();cv.width=mask.width;cv.height=mask.height;const c=cv.getContext('2d'),im=c.createImageData(cv.width,cv.height);for(let i=0;i<mask.data.length;i++){im.data[i*4]=im.data[i*4+1]=im.data[i*4+2]=255;im.data[i*4+3]=mask.data[i];}c.putImageData(im,0,0);return cv;}
 function refineAlpha(alpha,rgb,w,h,softness){
  const out=new Uint8ClampedArray(alpha.length),mix=clamp(softness)*.8;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,a=alpha[i];let sum=a*4,weight=4,low=a,high=a;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h)continue;const j=yy*w+xx;low=Math.min(low,alpha[j]);high=Math.max(high,alpha[j]);const d=Math.abs(rgb[i*4]-rgb[j*4])+Math.abs(rgb[i*4+1]-rgb[j*4+1])+Math.abs(rgb[i*4+2]-rgb[j*4+2]),k=Math.exp(-d/60)*(dx&&dy?.7:1);sum+=alpha[j]*k;weight+=k;}
   out[i]=high-low<2?a:Math.round(a*(1-mix)+sum/weight*mix);
  }return out;
 }
 let portraitCache=null,occlusionCache=null;
 const release=cv=>{if(cv)cv.width=cv.height=0;};
 function releasePortrait(p){for(const key of ['canvas','silhouette','tinted','blurred'])release(p[key]);release(p.portraitWarp?.canvas);release(p.shadowWarp?.canvas);}
 function clear(){if(portraitCache)releasePortrait(portraitCache);if(occlusionCache)release(occlusionCache.canvas);portraitCache=occlusionCache=null;}
 function prepareSubject(src,b,mask,make,retouch,tag){
  const s=settings(b.scene),key=JSON.stringify([src.width,src.height,b.mask?.id,b.strokes,b.softness,b.maskExact,b.cutoutRevision,s.dehalo,tag?.key]);
  if(tag&&portraitCache?.src===src&&portraitCache.key===key&&portraitCache.maps===tag.maps&&portraitCache.faces===tag.faces)return portraitCache;
  if(tag&&portraitCache)releasePortrait(portraitCache);if(tag)portraitCache=null;
  const cv=make(),W=cv.width=src.width,H=cv.height=src.height,c=cv.getContext('2d');c.drawImage(src,0,0);retouch?.(c,W,H);
  const k=Math.min(1,1536/Math.max(W,H)),w=Math.max(2,Math.round(W*k)),h=Math.max(2,Math.round(H*k)),guide=make();guide.width=w;guide.height=h;const gc=guide.getContext('2d');gc.drawImage(cv,0,0,w,h);const rgb=gc.getImageData(0,0,w,h).data;
  gc.clearRect(0,0,w,h);gc.drawImage(mask,0,0,w,h);const rgba=gc.getImageData(0,0,w,h).data,base=Uint8Array.from({length:w*h},(_,i)=>rgba[i*4+3]*rgb[i*4+3]/255),data=refineAlpha(base,rgb,w,h,clamp(b.softness,0,.5)*2);for(let i=0;i<data.length;i++)data[i]=Math.min(data[i],rgb[i*4+3]);const bounds=alphaBounds({width:w,height:h,data});
  if(s.dehalo>0&&bounds){const edge=gc.createImageData(w,h),radius=Math.max(2,Math.round(Math.max(w,h)/350));
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,a=data[i]/255;if(a<.035||a>.97)continue;let best=-1,distance=Infinity;
    for(const [dx,dy]of [[-radius,0],[radius,0],[0,-radius],[0,radius],[-radius,-radius],[radius,-radius],[-radius,radius],[radius,radius]]){const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy<0||yy>=h)continue;const j=yy*w+xx;if(data[j]<244)continue;const d=Math.abs(rgb[i*4]-rgb[j*4])+Math.abs(rgb[i*4+1]-rgb[j*4+1])+Math.abs(rgb[i*4+2]-rgb[j*4+2]);if(d<distance){distance=d;best=j;}}
    if(best<0)continue;for(let q=0;q<3;q++)edge.data[i*4+q]=rgb[best*4+q];edge.data[i*4+3]=Math.round(255*clamp(s.dehalo)*(.97-a)*.85);
   }gc.putImageData(edge,0,0);c.globalCompositeOperation='source-atop';c.drawImage(guide,0,0,W,H);c.globalCompositeOperation='source-over';
  }
  const applied=Uint8ClampedArray.from(data,(v,i)=>rgb[i*4+3]?v*255/rgb[i*4+3]:0),matte=maskCanvas({width:w,height:h,data:applied},make);c.globalCompositeOperation='destination-in';c.drawImage(matte,0,0,W,H);c.globalCompositeOperation='source-over';release(matte);release(guide);
  const silhouette=maskCanvas({width:w,height:h,data},make),sc=silhouette.getContext('2d');sc.globalCompositeOperation='source-in';sc.fillStyle='#16151a';sc.fillRect(0,0,w,h);
  const result={src,key,maps:tag?.maps,faces:tag?.faces,canvas:cv,silhouette,bounds,tinted:null,tintKey:null};if(tag)portraitCache=result;return result;
 }
 function warpImage(image,warp,W,H,make){
  if(flat(warp))return{canvas:image,x:0,y:0,width:W,height:H,owned:false};
  const src=make();src.width=image.width;src.height=image.height;const sc=src.getContext('2d');sc.drawImage(image,0,0);const data=sc.getImageData(0,0,src.width,src.height).data,IW=src.width,IH=src.height;let L=IW,R=0,T=IH,B=0;
  // Include low-confidence strands and the complete soft shadow, not only the
  // stronger silhouette used by the placement handles.
  for(let y=0;y<IH;y++)for(let x=0;x<IW;x++)if(data[(y*IW+x)*4+3]){L=Math.min(L,x);R=Math.max(R,x+1);T=Math.min(T,y);B=Math.max(B,y+1);}
  if(L>=R||T>=B){release(src);const canvas=make();return{canvas,x:0,y:0,width:1,height:1,owned:true};}
  const bounds={left:L/IW,top:T/IH,right:R/IW,bottom:B/IH},corners=[[bounds.left,bounds.top],[bounds.right,bounds.top],[bounds.right,bounds.bottom],[bounds.left,bounds.bottom]].map(p=>point3(warp,...p)),left=Math.floor(Math.min(...corners.map(p=>p[0]))*W)-1,top=Math.floor(Math.min(...corners.map(p=>p[1]))*H)-1,width=Math.ceil(Math.max(...corners.map(p=>p[0]))*W)-left+1,height=Math.ceil(Math.max(...corners.map(p=>p[1]))*H)-top+1;
  if(!Number.isFinite(width*height)||width<1||height<1||width*height>Math.max(4e6,W*H*2.5)){release(src);throw Error('Giảm độ nghiêng để giữ người trong phạm vi chỉnh.');}
  const out=make();out.width=width;out.height=height;const c=out.getContext('2d'),im=c.createImageData(width,height),d=im.data,m=inverse3(warp);
  // Inverse sampling in premultiplied alpha preserves hair and PNG edges and
  // avoids the cracks/overdraw seams of a clipped triangle mesh.
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const u=(left+x+.5)/W,v=(top+y+.5)/H,z=m[6]*u+m[7]*v+m[8],px=(m[0]*u+m[1]*v+m[2])/z*IW-.5,py=(m[3]*u+m[4]*v+m[5])/z*IH-.5;if(px<-.5||py<-.5||px>IW-.5||py>IH-.5)continue;
   const x0=Math.floor(px),y0=Math.floor(py),fx=px-x0,fy=py-y0,i00=(y0*IW+x0)*4,i10=i00+4,i01=i00+IW*4,i11=i01+4,a00=x0>=0&&y0>=0?data[i00+3]*(1-fx)*(1-fy):0,a10=x0+1<IW&&y0>=0?data[i10+3]*fx*(1-fy):0,a01=x0>=0&&y0+1<IH?data[i01+3]*(1-fx)*fy:0,a11=x0+1<IW&&y0+1<IH?data[i11+3]*fx*fy:0,a=a00+a10+a01+a11,k=(y*width+x)*4;if(a<=0)continue;d[k+3]=a;
   for(let ch=0;ch<3;ch++)d[k+ch]=((a00?data[i00+ch]*a00:0)+(a10?data[i10+ch]*a10:0)+(a01?data[i01+ch]*a01:0)+(a11?data[i11+ch]*a11:0))/a;
  }
  c.putImageData(im,0,0);release(src);return{canvas:out,x:left,y:top,width,height,owned:true};
 }
 function preparedWarp(p,slot,image,subject,W,H,make){const warp=warpOf(subject,W,H);if(flat(warp)){release(p[slot]?.canvas);p[slot]=null;return{canvas:image,x:0,y:0,width:W,height:H};}const key=JSON.stringify([warp,W,H]);if(p[slot]?.key===key&&p[slot].input===image)return p[slot];release(p[slot]?.canvas);return p[slot]={...warpImage(image,warp,W,H,make),input:image,key};}
 function drawWarp(c,value){c.drawImage(value.canvas,value.x,value.y,value.width,value.height);}
 function meanWith(cv,image,rect,mask){cv.width=40;cv.height=40;const c=cv.getContext('2d');c.drawImage(image,rect.x,rect.y,rect.width,rect.height,0,0,40,40);const d=c.getImageData(0,0,40,40).data;let n=0,r=0,g=0,b=0;for(let i=0;i<1600;i++){if(d[i*4+3]<220)continue;r+=d[i*4];g+=d[i*4+1];b+=d[i*4+2];n++;}return n?[r/n,g/n,b/n]:null;}
 function lightAdjust(portrait,b,bgImage,W,H,make){
  const s=settings(b.scene);let ev=clamp(s.exposure,-1.5,1.5),warm=clamp(s.warmth,-1,1);
  if(s.match>0&&bgImage&&portrait.bounds){const bounds=portrait.bounds,foot=project(s.subject,W,H,s.subject.anchor?.u??bounds.footX,s.subject.anchor?.v??bounds.bottom),r=cover(W,H,bgImage.width,bgImage.height,b.zoom,b.x,b.y),x=clamp((foot[0]-r.x)/r.width),y=clamp((foot[1]-r.y)/r.height),tmp=make(),foreground=meanWith(tmp,portrait.canvas,{x:bounds.left*W,y:bounds.top*H,width:(bounds.right-bounds.left)*W,height:(bounds.bottom-bounds.top)*H}),background=meanWith(tmp,bgImage,{x:clamp(x-.16)*bgImage.width,y:clamp(y-.25)*bgImage.height,width:Math.max(2,Math.min(.32,1-clamp(x-.16))*bgImage.width),height:Math.max(2,Math.min(.25,1-clamp(y-.25))*bgImage.height)});release(tmp);
   if(foreground&&background){const l=v=>v[0]*.2126+v[1]*.7152+v[2]*.0722;ev+=clamp(Math.log2((l(background)+20)/(l(foreground)+20)),-.8,.6)*clamp(s.match)*.65;warm+=clamp((background[0]-background[2]-foreground[0]+foreground[2])/180,-.4,.4)*clamp(s.match);}
  }
  ev=Math.round(ev*64)/64;warm=Math.round(warm*128)/128;if(!ev&&!warm)return portrait.canvas;
  const key=ev+':'+warm;if(portrait.tintKey===key&&portrait.tinted)return portrait.tinted;
  release(portrait.tinted);const cv=make();cv.width=W;cv.height=H;const c=cv.getContext('2d');c.drawImage(portrait.canvas,0,0);const im=c.getImageData(0,0,W,H),d=im.data,gain=2**ev;
  for(let i=0;i<d.length;i+=4)if(d[i+3]){d[i]=clamp((d[i]*gain+warm*16)/255)*255;d[i+1]=clamp((d[i+1]*gain+warm*2)/255)*255;d[i+2]=clamp((d[i+2]*gain-warm*13)/255)*255;}c.putImageData(im,0,0);portrait.tinted=cv;portrait.tintKey=key;return cv;
 }
 function blurAlpha(input,w,h,r){
  let data=Float32Array.from(input),temp=new Float32Array(data.length);r=Math.max(1,Math.round(r));
  for(let pass=0;pass<3;pass++){
   for(let y=0;y<h;y++){let sum=0;for(let x=-r;x<=r;x++)sum+=data[y*w+clamp(x,0,w-1)];for(let x=0;x<w;x++){temp[y*w+x]=sum/(r*2+1);sum+=data[y*w+clamp(x+r+1,0,w-1)]-data[y*w+clamp(x-r,0,w-1)];}}
   for(let x=0;x<w;x++){let sum=0;for(let y=-r;y<=r;y++)sum+=temp[clamp(y,0,h-1)*w+x];for(let y=0;y<h;y++){data[y*w+x]=sum/(r*2+1);sum+=temp[clamp(y+r+1,0,h-1)*w+x]-temp[clamp(y-r,0,h-1)*w+x];}}
  }return Uint8ClampedArray.from(data);
 }
 function softShadow(portrait,softness,make){
  const key=Math.round(clamp(softness)*100);if(portrait.blurred&&portrait.blurKey===key)return portrait.blurred;
  release(portrait.blurred);const src=portrait.silhouette,w=src.width,h=src.height,rgba=src.getContext('2d').getImageData(0,0,w,h).data,base=Uint8Array.from({length:w*h},(_,i)=>rgba[i*4+3]*(.35+.65*clamp((Math.floor(i/w)/h-portrait.bounds.top)/Math.max(.01,portrait.bounds.bottom-portrait.bounds.top)))),data=blurAlpha(base,w,h,Math.min(w,h)*(.001+clamp(softness)*.01)),cv=maskCanvas({width:w,height:h,data},make),c=cv.getContext('2d');c.globalCompositeOperation='source-in';c.fillStyle='#15151a';c.fillRect(0,0,w,h);c.globalCompositeOperation='source-over';portrait.blurred=cv;portrait.blurKey=key;return cv;
 }
 function drawShadow(c,portrait,scene,W,H,make){
  const s=settings(scene),sh=s.shadow,b=portrait.bounds;if(!sh.enabled||!b||sh.opacity<=0)return;const contact=s.subject.anchor||{u:b.footX,v:b.bottom},foot=localPoint(s.subject,W,H,contact.u,contact.v),footX=foot[0],footY=foot[1],edgeA=localPoint(s.subject,W,H,contact.u-b.footWidth/2,contact.v),edgeB=localPoint(s.subject,W,H,contact.u+b.footWidth/2,contact.v),span=Math.max(W*.015,Math.hypot(edgeA[0]-edgeB[0],edgeA[1]-edgeB[1])*.65),a=finite(sh.angle,35)*Math.PI/180,length=clamp(sh.length,0,1),vx=Math.cos(a)*length,vy=Math.sin(a)*length*.5;
  c.save();c.transform(...matrix(s.subject,W,H));c.globalAlpha=clamp(sh.opacity);c.save();c.transform(1,0,-vx,-vy,footY*vx,footY*(1+vy));drawWarp(c,preparedWarp(portrait,'shadowWarp',softShadow(portrait,sh.softness,make),s.subject,W,H,make));c.restore();
  const gradient=c.createRadialGradient(footX,footY,0,footX,footY,span);gradient.addColorStop(0,'rgba(10,9,13,'+clamp(sh.contact)+')');gradient.addColorStop(1,'rgba(10,9,13,0)');c.fillStyle=gradient;c.translate(footX,footY);c.scale(1,.12+clamp(sh.softness)*.12);c.translate(-footX,-footY);c.fillRect(footX-span,footY-span,span*2,span*2);c.restore();
 }
 function occlusionCanvas(background,image,W,H,make){const s=settings(background.scene);if(!image||(!s.regions.some(r=>r.enabled!==false)&&!s.occlusionStrokes.length))return null;const key=JSON.stringify([image.width,image.height,s.regions.map(r=>[r.mask?.id,r.enabled]),s.occlusionStrokes,s.removedObjects?.id]);if(occlusionCache?.key!==key){release(occlusionCache?.canvas);occlusionCache={key,canvas:maskCanvas(occlusionMask(s,image.width,image.height),make)};}const out=make();out.width=W;out.height=H;const r=cover(W,H,image.width,image.height,background.zoom,background.x,background.y);out.getContext('2d').drawImage(occlusionCache.canvas,r.x,r.y,r.width,r.height);return out;}
 function transformMask(mask,subject,W,H,make){const cv=make();cv.width=W;cv.height=H;const c=cv.getContext('2d'),warped=warpImage(mask,warpOf(subject,W,H),W,H,make);c.transform(...matrix(subject,W,H));drawWarp(c,warped);if(warped.owned)release(warped.canvas);return cv;}
 function compose(src,b,mask,bgImage,make,retouch,tag){
  const W=src.width,H=src.height,out=make();out.width=W;out.height=H;const c=out.getContext('2d');
  if(b.mode==='image'&&(!bgImage?.width||!bgImage?.height)){c.drawImage(src,0,0);retouch?.(c,W,H);return out;}
  const s=settings(b.scene),portrait=prepareSubject(src,b,mask,make,retouch,tag);
  if(b.mode==='image'){const r=cover(W,H,bgImage.width,bgImage.height,b.zoom,b.x,b.y);c.drawImage(bgImage,r.x,r.y,r.width,r.height);}else if(b.mode!=='transparent'){c.fillStyle=b.color||'#eee5d5';c.fillRect(0,0,W,H);}
  const occlusion=!s.subject.hidden&&b.mode==='image'&&s.depth==='behind'?occlusionCanvas(b,bgImage,W,H,make):null,layer=occlusion?make():out;if(occlusion){layer.width=W;layer.height=H;}const lc=layer.getContext('2d');
  if(!s.subject.hidden){if(b.mode!=='transparent')drawShadow(lc,portrait,s,W,H,make);lc.save();lc.transform(...matrix(s.subject,W,H));drawWarp(lc,preparedWarp(portrait,'portraitWarp',lightAdjust(portrait,b,bgImage,W,H,make),s.subject,W,H,make));lc.restore();}
  if(occlusion){lc.globalCompositeOperation='destination-out';lc.drawImage(occlusion,0,0);lc.globalCompositeOperation='source-over';c.drawImage(layer,0,0);release(layer);release(occlusion);}
  if(!tag)releasePortrait(portrait);return out;
 }
 return{defaults,settings,signature,regionAt,toggleRegion,contour,matrix,point,inverse,multiply,product3,inverse3,point3,perspective,warpOf,localPoint,project,reframe,adjustAt,gestureTransform,tilt,placeAt,warpImage,unproject,remapSubject,cover,scenePoint,sample,alphaBounds,selectionMask,mergeMasks,clipBelow,occlusionMask,maskCanvas,refineAlpha,blurAlpha,prepareSubject,occlusionCanvas,transformMask,compose,clear};
});
