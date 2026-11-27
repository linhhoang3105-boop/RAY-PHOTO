/* Coherent background synthesis with boundary color correction at original detail. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RayRemoveCore=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 function defaults(){return{patches:[],strokes:[],lastSelection:[],lastPatchId:null,editingPatchId:null,reference:null,size:.12,padding:.004,mode:typeof location!=='undefined'&&location.protocol==='file:'?'paint':'ai-remove',engine:typeof location!=='undefined'&&location.protocol==='file:'?'patch':'ai',showMask:true,seed:1731,aiSelection:null,lastAiSelection:null,protectedMasks:[],autoMasks:[],protectStrokes:[],autoProtect:true};}
 function signature(s){const {targetDocuments,activeTarget,...value}=s||{};return JSON.stringify({...value,activeTarget,targetDocuments:targetDocuments?Object.fromEntries(Object.entries(targetDocuments).map(([key,doc])=>[key,signature(doc)])):undefined,aiSelection:s?.aiSelection?.id,lastAiSelection:s?.lastAiSelection?.id,protectedMasks:s?.protectedMasks?.map(m=>m.id),autoMasks:s?.autoMasks?.map(m=>m.id),patches:(s?.patches||[]).map(p=>({id:p.id,placement:p.placement}))});}
 function resultInfo(state){
  const patches=state?.patches||[],ai=patches.filter(p=>p.engine==='lama'&&p.detail==='generated').length,fast=patches.filter(p=>p.engine==='patch'||p.detail==='original').length,erased=patches.filter(p=>p.engine==='erase').length,unknown=patches.length-ai-fast-erased,last=patches.find(p=>p.id===state?.lastPatchId),lastAI=last?.engine==='lama'&&last?.detail==='generated';
  const kind=!patches.length?'none':ai===patches.length?'ai':fast===patches.length?'patch':erased===patches.length?'erase':unknown===patches.length?'legacy':'mixed';
  const label=kind==='none'?'':kind==='ai'?'AI đã tái tạo nền':kind==='patch'?'Vá nhanh · chưa chạy AI':kind==='erase'?'Đã xóa trên lớp ghép · giữ nền phía sau':kind==='legacy'?'Bản vá cũ · chưa xác minh AI':'AI: '+ai+' · Vá nhanh: '+fast+(erased?' · Lớp ghép: '+erased:'')+(unknown?' · Cũ: '+unknown:'');
  return{kind,label,count:patches.length,ai,fast,erased,unknown,canRebuild:!!last&&!lastAI&&last.engine!=='erase'&&!!(state.lastSelection?.length||state.lastAiSelection)};
 }
 function drawPatch(c,p,canvas,W,H){
  const m=p.placement;c.save();c.transform(m[0]*W,m[1]*H,m[2]*W,m[3]*H,m[4]*W,m[5]*H);
  if(p.tiles){
   const a=c.getTransform?.(),aligned=a&&(Math.abs(a.b)<1e-7&&Math.abs(a.c)<1e-7||Math.abs(a.a)<1e-7&&Math.abs(a.d)<1e-7);
   for(let i=0;i<p.tiles.length;i++){
    const t=p.tiles[i];
    if(aligned){
     // Share device-pixel boundaries when previewing, rotating or resizing.
     // Fractional destination edges otherwise expose the removed object as
     // hairline gaps between tiles. At native export this is the exact grid.
     const point=(x,y)=>[Math.round(a.a*x/p.width+a.c*y/p.height+a.e),Math.round(a.b*x/p.width+a.d*y/p.height+a.f)],o=point(t.x,t.y),x=point(t.x+t.width,t.y),y=point(t.x,t.y+t.height);
     if(x[0]===o[0]&&x[1]===o[1]||y[0]===o[0]&&y[1]===o[1])continue;
     c.setTransform(x[0]-o[0],x[1]-o[1],y[0]-o[0],y[1]-o[1],o[0],o[1]);c.drawImage(canvas[i],0,0,1,1);
    }else c.drawImage(canvas[i],t.x/p.width,t.y/p.height,t.width/p.width,t.height/p.height);
   }
  }else c.drawImage(canvas,0,0,1,1);
  c.restore();
 }
 // Self-contained so the exact same engine can run in a Worker or in Node tests.
 async function repair(input,notify=()=>{},stopped=()=>false){
  const {width:W,height:H}=input,N=W*H,original=input.data;
  if(!Number.isInteger(W)||!Number.isInteger(H)||W<4||H<4||N>1024*1024||!original||original.length!==N*4||input.mask?.length!==N)throw new Error('Ảnh hoặc vùng chọn chưa hợp lệ.');
  const selected=new Uint8Array(N);let count=0;for(let i=0;i<N;i++)if(input.mask[i]>.08){selected[i]=1;count++;}
  if(!count)throw new Error('Tô lên người hoặc vật cần xóa trước.');if(count>N*.7)throw new Error('Vùng chọn quá rộng. Hãy xóa từng vùng nhỏ hơn.');
  const radius=Math.max(0,Math.min(12,Math.round(Number(input.padding)||0)));
  if(radius){const horizontal=new Uint8Array(N);for(let y=0;y<H;y++)for(let x=0;x<W;x++){let n=0;for(let dx=-radius;dx<=radius;dx++)if(x+dx>=0&&x+dx<W)n|=selected[y*W+x+dx];horizontal[y*W+x]=n;}for(let y=0;y<H;y++)for(let x=0;x<W;x++){let n=0;for(let dy=-radius;dy<=radius;dy++)if(y+dy>=0&&y+dy<H)n|=horizontal[(y+dy)*W+x];selected[y*W+x]=n;}}
  const protection=input.protect?.length===N?new Float32Array(input.protect):null;
  if(protection){let available=0;for(let i=0;i<N;i++){if(protection[i]>.05)selected[i]=0;available+=selected[i];}if(!available)throw Error('Vùng xóa đang nằm trong vùng giữ lại. Chọn đúng vật cần xóa hoặc sửa vùng giữ.');}
  const missing=selected.slice(),work=new Uint8ClampedArray(original),blocked=new Uint8Array(N),integral=new Int32Array((W+1)*(H+1)),stride=W+1;
  let remaining=0,minX=W,minY=H,maxX=0,maxY=0;
  for(let y=0;y<H;y++){let row=0;for(let x=0;x<W;x++){const i=y*W+x,bad=selected[i]||protection?.[i]>.05||original[i*4+3]<250||(input.exclude?.length===N&&input.exclude[i]>96);blocked[i]=bad?1:0;row+=bad?1:0;integral[(y+1)*stride+x+1]=integral[y*stride+x+1]+row;if(selected[i]){remaining++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}}}
  if(remaining>N*.75)throw new Error('Nền còn lại quá ít để vá. Hãy thu nhỏ vùng chọn.');
  const total=remaining,ref=input.reference,refX=ref?ref.x*W:0,refY=ref?ref.y*H:0,refRadius=Math.max(12,Math.min(W,H)*.32);
  // Similar colors far above the object must not drag sky or distant detail into foreground texture.
  const spatialScale=(480/Math.max(W,H))**2;
  let R=Math.min(5,Math.max(3,Math.round(Math.max(W,H)/192))),valid=null,sources=[];
  function buildSources(){valid=new Uint8Array(N);sources=[];for(let y=R;y<H-R;y++)for(let x=R;x<W-R;x++){const x0=x-R,y0=y-R,x1=x+R+1,y1=y+R+1,bad=integral[y1*stride+x1]-integral[y0*stride+x1]-integral[y1*stride+x0]+integral[y0*stride+x0];if(!bad&&(!ref||(x-refX)**2+(y-refY)**2<=refRadius**2)){const i=y*W+x;valid[i]=1;sources.push(i);}}}
  buildSources();if(!sources.length){R=1;buildSources();}if(!sources.length)throw new Error(ref?'Vùng nền mẫu quá sát chỗ xóa. Chọn một khoảng nền sạch khác.':'Không còn đủ nền sạch để vá. Hãy chọn vùng nhỏ hơn.');
  let seed=(Number(input.seed)||1731)>>>0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const from=new Int32Array(N);from.fill(-1);const queued=new Uint8Array(N),heap=[];
  // Prefer one coherent translation when the surrounding scene supports it.
  // Match the complete boundary, including gradients; a flat color alone is
  // not evidence that sky, road, or a wall at another height is the same scene.
  const ring=[],seen=new Uint8Array(N),directions=[[-1,0],[1,0],[0,-1],[0,1]];
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)if(selected[y*W+x])for(const [dx,dy]of directions){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<W&&yy>=0&&yy<H){const i=yy*W+xx;if(!selected[i]&&!seen[i]&&original[i*4+3]>=250){seen[i]=1;ring.push(i);}}}
  const samples=ring.filter((_,i)=>i%Math.max(1,Math.ceil(ring.length/240))===0),tested=new Set();let coherent=null;
  function shift(dx,dy){
   if(!dx&&!dy)return;const key=dx+','+dy;if(tested.has(key))return;tested.add(key);
   const x0=minX+dx,y0=minY+dy,x1=maxX+dx+1,y1=maxY+dy+1;
   if(x0<0||y0<0||x1>W||y1>H||integral[y1*stride+x1]-integral[y0*stride+x1]-integral[y1*stride+x0]+integral[y0*stride+x0])return;
   if(ref&&Math.max((x0-refX)**2,(x1-1-refX)**2)+Math.max((y0-refY)**2,(y1-1-refY)**2)>refRadius**2)return;
   const offsets=[0,0,0];let used=0;
   for(const i of samples){const x=i%W+dx,y=Math.floor(i/W)+dy;if(x<1||x>=W-1||y<1||y>=H-1||blocked[y*W+x])continue;const q=y*W+x;for(let c=0;c<3;c++)offsets[c]+=original[i*4+c]-original[q*4+c];used++;}
   if(used<Math.min(12,samples.length*.6))return;for(let c=0;c<3;c++)offsets[c]=Math.max(-48,Math.min(48,offsets[c]/used));
   let cost=0;
   for(const i of samples){const x=i%W+dx,y=Math.floor(i/W)+dy;if(x<1||x>=W-1||y<1||y>=H-1||blocked[y*W+x])continue;const q=y*W+x;
    for(let c=0;c<3;c++){const d=original[i*4+c]-original[q*4+c]-offsets[c];cost+=d*d;
     for(const [ox,oy]of directions){const ix=i%W+ox,iy=Math.floor(i/W)+oy,j=i+oy*W+ox,k=q+oy*W+ox;if(ix<0||ix>=W||iy<0||iy>=H||selected[j]||blocked[k])continue;const dg=(original[j*4+c]-original[i*4+c])-(original[k*4+c]-original[q*4+c]);cost+=dg*dg*.2;}
    }
   }
   const error=cost/(used*3),score=error+(dx*dx*.04+dy*dy*.3)*spatialScale*.001;
   if(!coherent||score<coherent.score)coherent={dx,dy,error,score};
  }
  for(let dx=-minX;dx<W-maxX;dx++)shift(dx,0);
  for(let dy=-minY;dy<H-maxY;dy++)shift(0,dy);
  for(let k=0;k<220;k++)shift(Math.round(random()*(W-maxX+minX-1))-minX,Math.round(random()*(H-maxY+minY-1))-minY);
  if(coherent?.error<=36){for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const i=y*W+x;if(!selected[i])continue;const q=(y+coherent.dy)*W+x+coherent.dx;from[i]=q;work.set(original.subarray(q*4,q*4+4),i*4);missing[i]=0;}remaining=0;}
  function priority(i){const x=i%W,y=(i/W)|0;let known=0,edge=0;for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){const xx=x+dx,yy=y+dy;if(xx<0||xx>=W||yy<0||yy>=H)continue;const j=yy*W+xx;if(!missing[j]){known++;if(xx+1<W&&!missing[j+1])edge+=Math.abs(work[j*4+1]-work[(j+1)*4+1]);}}return known+Math.min(4,edge/180);}
  function push(i){if(i<0||i>=N||!missing[i]||queued[i])return;queued[i]=1;let k=heap.length;heap.push({i,p:priority(i)});while(k>0){const parent=(k-1)>>1;if(heap[parent].p>=heap[k].p)break;[heap[parent],heap[k]]=[heap[k],heap[parent]];k=parent;}}
  function pop(){const best=heap[0],tail=heap.pop();if(heap.length){heap[0]=tail;let k=0;for(;;){let j=k*2+1;if(j>=heap.length)break;if(j+1<heap.length&&heap[j+1].p>heap[j].p)j++;if(heap[k].p>=heap[j].p)break;[heap[k],heap[j]]=[heap[j],heap[k]];k=j;}}queued[best.i]=0;return best.i;}
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(missing[i]&&((x&&!missing[i-1])||(x+1<W&&!missing[i+1])||(y&&!missing[i-W])||(y+1<H&&!missing[i+W])))push(i);}
  let patches=0;
  while(remaining&&heap.length){
   if(stopped())throw new Error('Đã dừng vá nền.');const center=pop();if(!missing[center])continue;const x=center%W,y=(center/W)|0,samples=[],offsets=[];
   for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){const xx=x+dx,yy=y+dy;if(xx<0||xx>=W||yy<0||yy>=H)continue;const j=yy*W+xx;if(!missing[j]){samples.push([dx,dy,j*4]);if(from[j]>=0){const q=from[j]-dy*W-dx;if(q>=0&&q<N)offsets.push(q);}}}
   if(!samples.length)continue;let best=-1,bestCost=Infinity;
   function check(q){if(q<0||q>=N||!valid[q])return;const qx=q%W,qy=(q/W)|0;let cost=((qy-y)**2*.3+(qx-x)**2*.04)*spatialScale;for(const [dx,dy,k]of samples){const k2=((qy+dy)*W+qx+dx)*4,dr=work[k]-original[k2],dg=work[k+1]-original[k2+1],db=work[k+2]-original[k2+2];cost+=(dr*dr+dg*dg+db*db)/samples.length;if(cost>=bestCost)return;}if(cost<bestCost){bestCost=cost;best=q;}}
   for(const q of offsets)check(q);for(let k=0;k<110;k++)check(sources[(random()*sources.length)|0]);
   if(best<0)best=sources[0];for(let distance=Math.max(W,H)>>1;distance>=1;distance>>=1){const bx=best%W,by=(best/W)|0;for(let k=0;k<5;k++){const xx=Math.max(R,Math.min(W-R-1,bx+Math.round((random()*2-1)*distance))),yy=Math.max(R,Math.min(H-R-1,by+Math.round((random()*2-1)*distance)));check(yy*W+xx);}}
   const bx=best%W,by=(best/W)|0,changed=[];
   for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){const xx=x+dx,yy=y+dy;if(xx<0||xx>=W||yy<0||yy>=H)continue;const j=yy*W+xx;if(!missing[j])continue;const q=(by+dy)*W+bx+dx;work[j*4]=original[q*4];work[j*4+1]=original[q*4+1];work[j*4+2]=original[q*4+2];work[j*4+3]=255;from[j]=q;missing[j]=0;remaining--;changed.push(j);}
   for(const j of changed){const xx=j%W,yy=(j/W)|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(xx+dx>=0&&xx+dx<W&&yy+dy>=0&&yy+dy<H)push((yy+dy)*W+xx+dx);}
   if(++patches%50===0){notify(Math.min(.8,(1-remaining/total)*.8));await new Promise(resolve=>setTimeout(resolve,0));}
  }
  if(remaining)throw new Error('Chưa vá hết vùng chọn. Hãy chia vùng xóa nhỏ hơn.');
  const width=maxX-minX+1,height=maxY-minY+1,data=new Uint8ClampedArray(width*height*4),donors=new Int32Array(width*height);donors.fill(-1);
  // Solve only the low-frequency color difference. Texture still comes from
  // clean source pixels, and the original selected person is never blended back.
  const scale=Math.min(1,144/Math.max(width,height)),cw=Math.max(1,Math.ceil(width*scale)),ch=Math.max(1,Math.ceil(height*scale)),cn=cw*ch,area=new Uint8Array(cn),fixed=new Uint8Array(cn),weights=new Uint32Array(cn),field=new Float32Array(cn*3);
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const i=y*W+x;if(!selected[i])continue;const cell=Math.min(ch-1,Math.floor((y-minY)*ch/height))*cw+Math.min(cw-1,Math.floor((x-minX)*cw/width));area[cell]=1;const q=from[i],qx=q%W,qy=Math.floor(q/W);
   for(const [dx,dy]of directions){const xx=x+dx,yy=y+dy,sx=qx+dx,sy=qy+dy;if(xx<0||xx>=W||yy<0||yy>=H||sx<0||sx>=W||sy<0||sy>=H)continue;const j=yy*W+xx,p=sy*W+sx;if(selected[j]||blocked[p])continue;const delta=[0,1,2].map(c=>original[j*4+c]-original[p*4+c]);if(delta.some(d=>Math.abs(d)>64))continue;for(let c=0;c<3;c++)field[cell*3+c]+=Math.max(-48,Math.min(48,delta[c]));weights[cell]++;}
  }
  const frontier=new Int32Array(cn);let head=0,tail=0;
  for(let i=0;i<cn;i++)if(weights[i]){for(let c=0;c<3;c++)field[i*3+c]/=weights[i];fixed[i]=1;frontier[tail++]=i;}
  const initialized=fixed.slice();while(head<tail){const i=frontier[head++],x=i%cw,y=Math.floor(i/cw);for(const [dx,dy]of directions){const xx=x+dx,yy=y+dy;if(xx<0||xx>=cw||yy<0||yy>=ch)continue;const j=yy*cw+xx;if(area[j]&&!initialized[j]){initialized[j]=1;for(let c=0;c<3;c++)field[j*3+c]=field[i*3+c];frontier[tail++]=j;}}}
  for(let iteration=0;iteration<140;iteration++){
   if(stopped())throw new Error('Đã dừng vá nền.');let change=0;
   for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){const i=y*cw+x;if(!area[i]||fixed[i])continue;let n=0,r=0,g=0,b=0;for(const [dx,dy]of directions){const xx=x+dx,yy=y+dy;if(xx<0||xx>=cw||yy<0||yy>=ch)continue;const j=yy*cw+xx;if(area[j]){n++;r+=field[j*3];g+=field[j*3+1];b+=field[j*3+2];}}if(!n)continue;const values=[r/n,g/n,b/n];for(let c=0;c<3;c++){const d=(values[c]-field[i*3+c])*1.65;field[i*3+c]+=d;change=Math.max(change,Math.abs(d));}}
   if(iteration%20===0){notify(.82+iteration/140*.16);await new Promise(resolve=>setTimeout(resolve,0));}if(change<.02)break;
  }
  if(!ref&&(coherent?.error>36||!coherent)){
   // Exemplar texture can match locally but carry a different broad light/shadow
   // mass. Continue that broad tone from the real boundary, then retain the
   // source's fine texture. All box averages exclude selected/forbidden pixels.
   const sums=[0,1,2].map(()=>new Uint32Array((W+1)*(H+1))),blur=Math.max(4,R*2);
   for(let y=0;y<H;y++){const row=[0,0,0];for(let x=0;x<W;x++){const i=y*W+x,a=(y+1)*stride+x+1;for(let c=0;c<3;c++){if(!blocked[i])row[c]+=original[i*4+c];sums[c][a]=sums[c][a-stride]+row[c];}}}
   function localColor(i){const x=i%W,y=Math.floor(i/W),x0=Math.max(0,x-blur),y0=Math.max(0,y-blur),x1=Math.min(W,x+blur+1),y1=Math.min(H,y+blur+1),bad=integral[y1*stride+x1]-integral[y0*stride+x1]-integral[y1*stride+x0]+integral[y0*stride+x0],n=(x1-x0)*(y1-y0)-bad;if(!n)return[original[i*4],original[i*4+1],original[i*4+2]];return sums.map(s=>(s[y1*stride+x1]-s[y0*stride+x1]-s[y1*stride+x0]+s[y0*stride+x0])/n);}
   const sourceTone=new Float32Array(cn*3),hits=new Uint32Array(cn),tone=new Float32Array(cn*3),toneWeight=new Uint32Array(cn);let variation=0;
   for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const i=y*W+x;if(!selected[i])continue;const cell=Math.min(ch-1,Math.floor((y-minY)*ch/height))*cw+Math.min(cw-1,Math.floor((x-minX)*cw/width)),color=localColor(from[i]);for(let c=0;c<3;c++)sourceTone[cell*3+c]+=color[c];hits[cell]++;}
   let first=null;for(let i=0;i<cn;i++)if(hits[i]){for(let c=0;c<3;c++)sourceTone[i*3+c]/=hits[i];if(!first)first=sourceTone.slice(i*3,i*3+3);for(let c=0;c<3;c++)variation=Math.max(variation,Math.abs(sourceTone[i*3+c]-first[c]));}
   if(variation>3){
    for(const i of ring){if(blocked[i])continue;const x=i%W,y=Math.floor(i/W),color=localColor(i);for(const [dx,dy]of directions){const xx=x+dx,yy=y+dy;if(xx<minX||xx>maxX||yy<minY||yy>maxY||!selected[yy*W+xx])continue;const cell=Math.min(ch-1,Math.floor((yy-minY)*ch/height))*cw+Math.min(cw-1,Math.floor((xx-minX)*cw/width));for(let c=0;c<3;c++)tone[cell*3+c]+=color[c];toneWeight[cell]++;}}
    const depth=new Int16Array(cn);depth.fill(-1);head=tail=0;
    for(let i=0;i<cn;i++)if(toneWeight[i]){for(let c=0;c<3;c++)tone[i*3+c]/=toneWeight[i];depth[i]=0;frontier[tail++]=i;}
    while(head<tail){const i=frontier[head++],x=i%cw,y=Math.floor(i/cw);for(const [dx,dy]of directions){const xx=x+dx,yy=y+dy;if(xx<0||xx>=cw||yy<0||yy>=ch)continue;const j=yy*cw+xx;if(area[j]&&depth[j]<0){depth[j]=depth[i]+1;for(let c=0;c<3;c++)tone[j*3+c]=tone[i*3+c];frontier[tail++]=j;}}}
    for(let iteration=0;iteration<200;iteration++){if(stopped())throw new Error('Đã dừng vá nền.');let change=0;
     for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){const i=y*cw+x;if(!area[i]||toneWeight[i])continue;let n=0,r=0,g=0,b=0;for(const [dx,dy]of directions){const xx=x+dx,yy=y+dy;if(xx<0||xx>=cw||yy<0||yy>=ch)continue;const j=yy*cw+xx;if(area[j]){n++;r+=tone[j*3];g+=tone[j*3+1];b+=tone[j*3+2];}}if(!n)continue;const values=[r/n,g/n,b/n];for(let c=0;c<3;c++){const d=(values[c]-tone[i*3+c])*1.8;tone[i*3+c]+=d;change=Math.max(change,Math.abs(d));}}
     if(iteration%40===0)await new Promise(resolve=>setTimeout(resolve,0));if(change<.03)break;
    }
    for(let i=0;i<cn;i++)if(area[i]&&depth[i]>0){const mix=Math.min(.9,depth[i]/5);for(let c=0;c<3;c++){const correction=Math.max(-56,Math.min(56,tone[i*3+c]-sourceTone[i*3+c]));field[i*3+c]=field[i*3+c]*(1-mix)+correction*mix;}}
   }
  }
  function correction(x,y,c){const fx=Math.max(0,Math.min(cw-1,(x+.5)*cw/width-.5)),fy=Math.max(0,Math.min(ch-1,(y+.5)*ch/height-.5)),x0=Math.floor(fx),y0=Math.floor(fy),x1=Math.min(cw-1,x0+1),y1=Math.min(ch-1,y0+1),ax=fx-x0,ay=fy-y0;return(field[(y0*cw+x0)*3+c]*(1-ax)+field[(y0*cw+x1)*3+c]*ax)*(1-ay)+(field[(y1*cw+x0)*3+c]*(1-ax)+field[(y1*cw+x1)*3+c]*ax)*ay;}
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y+minY)*W+x+minX,k=(y*width+x)*4;if(!selected[i])continue;for(let c=0;c<3;c++)data[k+c]=work[i*4+c]+correction(x,y,c);data[k+3]=255;donors[y*width+x]=from[i];}
  notify(1);return{width,height,data,placement:[width/W,0,0,height/H,minX/W,minY/H],pixels:total,patches:patches||1,donors,blocked,protection,texture:'native',correction:{width:cw,height:ch,data:field},sampling:{width:W,height:H,x:minX,y:minY},synthesis:coherent?.error<=36?'coherent':'exemplar'};
 }
 // Reuse the chosen background at source resolution; never enlarge a small RGB patch.
 function materialize(source,plan,make){
  if(!plan.sampling||!plan.donors&&!plan.generated)return plan;
  const g=plan.sampling,W=source.width,H=source.height,sx=W/g.width,sy=H/g.height,left=Math.round(g.x*sx),top=Math.round(g.y*sy),width=Math.round((g.x+plan.width)*sx)-left,height=Math.round((g.y+plan.height)*sy)-top;
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1)throw Error('Ảnh hoặc vùng chọn chưa hợp lệ.');
  // A diagonal brush can span most of a photo while selecting very few pixels.
  // Budget occupied tiles, not its bounding rectangle, and retain one logical
  // patch so corrections, geometry changes and undo still act atomically.
  const size=512,tiled=width*height>4e6,regions=[],donor=(x,y)=>plan.generated?(plan.data[(y*plan.width+x)*4+3]?((g.y+y)*g.width+g.x+x):-1):plan.donors[y*plan.width+x];
  function runs(visit,region){
   const L=left+(region?.x||0),T=top+(region?.y||0),R=L+(region?.width||width),B=T+(region?.height||height),
    firstX=Math.max(0,Math.floor(L/sx)-g.x-1),lastX=Math.min(plan.width,Math.ceil(R/sx)-g.x+1),firstY=Math.max(0,Math.floor(T/sy)-g.y-1),lastY=Math.min(plan.height,Math.ceil(B/sy)-g.y+1);
   for(let y=firstY;y<lastY;y++)for(let x=firstX;x<lastX;){
    const q=donor(x,y);if(q<0){x++;continue;}
    const dx=q%g.width-g.x-x,dy=Math.floor(q/g.width)-g.y-y,start=x;
    while(++x<lastX){const next=donor(x,y);if(next<0||next%g.width-g.x-x!==dx||Math.floor(next/g.width)-g.y-y!==dy)break;}
    const ox=Math.round(dx*sx),oy=Math.round(dy*sy),l=Math.max(L,Math.round((g.x+start)*sx),-ox),r=Math.min(R,Math.round((g.x+x)*sx),W-ox),t=Math.max(T,Math.round((g.y+y)*sy),-oy),b=Math.min(B,Math.round((g.y+y+1)*sy),H-oy);
    if(r>l&&b>t)visit(l,r,t,b,ox,oy);
   }
  }
  if(tiled){
   const occupied=new Map();let pixels=0;
   runs((l,r,t,b)=>{for(let ty=Math.floor((t-top)/size);ty<=Math.floor((b-top-1)/size);ty++)for(let tx=Math.floor((l-left)/size);tx<=Math.floor((r-left-1)/size);tx++){
    const key=tx+','+ty;if(occupied.has(key))continue;const x=tx*size,y=ty*size,part={x,y,width:Math.min(size,width-x),height:Math.min(size,height-y)};
    pixels+=part.width*part.height;if(pixels>8e6)throw Error('Vùng xóa quá lớn để xử lý cùng lúc trên thiết bị. Xóa từng phần nhỏ hơn; vùng đã tô vẫn được giữ.');occupied.set(key,part);
   }});
   regions.push(...occupied.values());
  }else regions.push({x:0,y:0,width,height});
  let canvas=null;
  try{
   let c=plan.generated?null:source.getContext?.('2d',{willReadFrequently:true});
   if(!plan.generated&&!c){canvas=make();canvas.width=W;canvas.height=H;c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(source,0,0);}
   // Read only donor neighborhoods. Never allocate a second full-photo RGB
   // buffer just to repair a thin stroke on a large phone image.
   const originals=new Map();
   function originalAt(x,y){const tx=Math.floor(x/size),ty=Math.floor(y/size),key=tx+','+ty;let tile=originals.get(key);if(tile)originals.delete(key);else{const l=tx*size,t=ty*size,w=Math.min(size,W-l),h=Math.min(size,H-t);tile={x:l,y:t,width:w,data:c.getImageData(l,t,w,h).data};if(originals.size>=8)originals.delete(originals.keys().next().value);}originals.set(key,tile);return tile;}
   for(const part of regions){
    const {width:w,height:h}=part,data=part.data=new Uint8ClampedArray(w*h*4),L=left+part.x,T=top+part.y;
    if(plan.generated){
     // Generated color replaces only the selected pixels. Upsample its RGB
     // separately from the hard selection, keeping original/protected pixels
     // byte-for-byte intact at source resolution rather than scaling an alpha.
     runs((l,r,t,b)=>{for(let y=t;y<b;y++)for(let x=l;x<r;x++){
      const px=Math.max(0,Math.min(plan.width-1,(x+.5)/sx-g.x-.5)),py=Math.max(0,Math.min(plan.height-1,(y+.5)/sy-g.y-.5)),x0=Math.floor(px),y0=Math.floor(py),x1=Math.min(plan.width-1,x0+1),y1=Math.min(plan.height-1,y0+1),u=px-x0,v=py-y0,k=((y-T)*w+x-L)*4;
      for(let ch=0;ch<3;ch++)data[k+ch]=(plan.data[(y0*plan.width+x0)*4+ch]*(1-u)+plan.data[(y0*plan.width+x1)*4+ch]*u)*(1-v)+(plan.data[(y1*plan.width+x0)*4+ch]*(1-u)+plan.data[(y1*plan.width+x1)*4+ch]*u)*v;data[k+3]=255;
     }},part);
    }else runs((l,r,t,b,ox,oy)=>{for(let y=t;y<b;y++)for(let x=l;x<r;){const tile=originalAt(x+ox,y+oy),end=Math.min(r,tile.x+tile.width-ox),start=((y+oy-tile.y)*tile.width+x+ox-tile.x)*4;data.set(tile.data.subarray(start,start+(end-x)*4),((y-T)*w+x-L)*4);x=end;}},part);
    if(plan.correction){
    const field=plan.correction,cw=field.width,ch=field.height,coherent=plan.synthesis==='coherent'||plan.texture==='native';
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const k=(y*w+x)*4;if(!data[k+3])continue;const X=part.x+x,Y=part.y+y;
     // Vote only across changes of donor displacement, using full-resolution
     // source texture. No blur of the photograph and no transparent feathering.
     const px=(left+X+.5)/sx-g.x-.5,py=(top+Y+.5)/sy-g.y-.5,bx=Math.floor(px),by=Math.floor(py),ax=px-bx,ay=py-by;let weight=coherent?1:0,r=coherent?data[k]:0,green=coherent?data[k+1]:0,b=coherent?data[k+2]:0;
     if(!coherent)for(let oy=0;oy<2;oy++)for(let ox=0;ox<2;ox++){const xx=bx+ox,yy=by+oy;if(xx<0||xx>=plan.width||yy<0||yy>=plan.height)continue;const q=plan.donors[yy*plan.width+xx];if(q<0)continue;const dx=Math.round((q%g.width-g.x-xx)*sx),dy=Math.round((Math.floor(q/g.width)-g.y-yy)*sy),qx=left+X+dx,qy=top+Y+dy;if(qx<0||qx>=W||qy<0||qy>=H)continue;const tx=Math.min(g.width-1,Math.floor((qx+.5)/sx)),ty=Math.min(g.height-1,Math.floor((qy+.5)/sy));if(plan.blocked?.[ty*g.width+tx])continue;const a=(ox?ax:1-ax)*(oy?ay:1-ay),tile=originalAt(qx,qy),j=((qy-tile.y)*tile.width+qx-tile.x)*4;weight+=a;r+=tile.data[j]*a;green+=tile.data[j+1]*a;b+=tile.data[j+2]*a;}
     const fx=Math.max(0,Math.min(cw-1,(X+.5)*cw/width-.5)),fy=Math.max(0,Math.min(ch-1,(Y+.5)*ch/height-.5)),x0=Math.floor(fx),y0=Math.floor(fy),x1=Math.min(cw-1,x0+1),y1=Math.min(ch-1,y0+1),u=fx-x0,v=fy-y0;
     for(let c=0;c<3;c++){const d=(field.data[(y0*cw+x0)*3+c]*(1-u)+field.data[(y0*cw+x1)*3+c]*u)*(1-v)+(field.data[(y1*cw+x0)*3+c]*(1-u)+field.data[(y1*cw+x1)*3+c]*u)*v;data[k+c]=(weight>1e-8?[r,green,b][c]/weight:data[k+c])+d;}data[k+3]=255;
    }
    }
    if(plan.protection)for(let y=0;y<h;y++)for(let x=0;x<w;x++){const xx=Math.min(g.width-1,Math.floor((L+x+.5)/sx)),yy=Math.min(g.height-1,Math.floor((T+y+.5)/sy));if(plan.protection[yy*g.width+xx]>.05)data[(y*w+x)*4+3]=0;}
   }
   return{width,height,...(tiled?{tiles:regions}:{data:regions[0].data}),placement:[width/W,0,0,height/H,left/W,top/H],pixels:plan.pixels,patches:plan.patches,detail:plan.generated?'generated':'original',...(plan.generated?{engine:'lama'}:{})};
  }finally{if(canvas)canvas.width=canvas.height=0;}
 }
 function beginCorrection(state){
  if(!state.lastPatchId||!state.patches.some(p=>p.id===state.lastPatchId)||!state.lastSelection?.length&&!state.lastAiSelection)return state;
  return{...state,aiSelection:state.lastAiSelection||null,strokes:state.lastSelection.map(s=>({...s,points:s.points.map(p=>p.slice())})),editingPatchId:state.lastPatchId,showMask:true,mode:'paint'};
 }
 function footprint(p,W,H,make){
  const patches=Array.isArray(p)?p:p?[p]:[];if(!patches.length)return null;const cv=make();cv.width=W;cv.height=H;const c=cv.getContext('2d');c.imageSmoothingQuality='high';
  try{for(const patch of patches){const parts=(patch.tiles||[patch]).map(part=>{const tile=make();tile.width=part.width;tile.height=part.height;const x=tile.getContext('2d'),im=x.createImageData(part.width,part.height);im.data.set(part.data);x.putImageData(im,0,0);return tile;});try{drawPatch(c,patch,patch.tiles?parts:parts[0],W,H);}finally{for(const tile of parts)tile.width=tile.height=0;}}const rgba=c.getImageData(0,0,W,H).data;return Float32Array.from({length:W*H},(_,i)=>rgba[i*4+3]>0?1:0);}finally{cv.width=cv.height=0;}
 }
 function erasePlan(input){
  const W=input.width,H=input.height,N=W*H;if(!Number.isInteger(W)||!Number.isInteger(H)||W<1||H<1||N>1048576||input.mask?.length!==N)throw Error('Vùng xóa chưa hợp lệ.');const selected=Uint8Array.from(input.mask,v=>v>.08?1:0),radius=Math.max(0,Math.min(12,Math.round(input.padding||0)));let left=W,top=H,right=0,bottom=0,count=0;
  if(radius){const horizontal=new Uint8Array(N);for(let y=0;y<H;y++){let sum=0;for(let x=0;x<=radius&&x<W;x++)sum+=selected[y*W+x];for(let x=0;x<W;x++){horizontal[y*W+x]=sum?1:0;if(x-radius>=0)sum-=selected[y*W+x-radius];if(x+radius+1<W)sum+=selected[y*W+x+radius+1];}}for(let x=0;x<W;x++){let sum=0;for(let y=0;y<=radius&&y<H;y++)sum+=horizontal[y*W+x];for(let y=0;y<H;y++){selected[y*W+x]=sum?1:0;if(y-radius>=0)sum-=horizontal[(y-radius)*W+x];if(y+radius+1<H)sum+=horizontal[(y+radius+1)*W+x];}}}
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(input.protect?.[i]>.05)selected[i]=0;if(selected[i]){count++;left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1);}}
  if(!count)throw Error('Chọn phần cần xóa trên lớp ghép trước.');const width=right-left,height=bottom-top,data=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++)data[(y*width+x)*4+3]=selected[(y+top)*W+x+left]?255:0;return{width,height,data,placement:[width/W,0,0,height/H,left/W,top/H],sampling:{width:W,height:H,x:left,y:top},generated:true,engine:'erase',detail:'layer-erasure',pixels:count,patches:1,protection:input.protect};
 }
 function clearSelection(state){return{...state,strokes:[],aiSelection:null,editingPatchId:null,showMask:false};}
 function jobSettings(state,retry=false){
  const pending=!!state.aiSelection||!!state.strokes?.length,replay=retry&&!pending,id=replay?state.lastPatchId:state.editingPatchId;
  return{selection:replay?state.lastSelection:state.strokes,aiSelection:replay?state.lastAiSelection:state.aiSelection,replaceId:state.patches.some(p=>p.id===id)?id:null};
 }
 function completed(state,patch,selection,seed,replaceId){return{...state,patches:[...state.patches.filter(p=>p.id!==replaceId),patch],lastAiSelection:state.aiSelection,aiSelection:null,strokes:[],lastSelection:selection,lastPatchId:patch.id,editingPatchId:null,seed,showMask:false};}
 return{defaults,signature,resultInfo,drawPatch,repair,materialize,footprint,erasePlan,clearSelection,beginCorrection,jobSettings,completed};
});
