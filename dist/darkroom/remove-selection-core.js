/* Object masks and protected subjects are independent of the color engine. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RayRemoveSelection=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const valid=m=>!!m&&Number.isInteger(m.width)&&Number.isInteger(m.height)&&m.width>0&&m.height>0&&m.width*m.height<=1048576&&m.data?.length===m.width*m.height;
 const at=(m,x,y)=>valid(m)?m.data[Math.min(m.height-1,Math.max(0,Math.floor(y*m.height)))*m.width+Math.min(m.width-1,Math.max(0,Math.floor(x*m.width)))]/255:0;
 function component(values,width,height,point,id,maxFraction=.72){
  if(!values||values.length!==width*height||width*height>1048576)throw Error('AI trả vùng chọn chưa hợp lệ.');
  const x=Math.min(width-1,Math.max(0,Math.floor(point.x*width))),y=Math.min(height-1,Math.max(0,Math.floor(point.y*height)));let seed=y*width+x,best=values[seed];
  if(best<.45){let distance=Infinity;for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){const xx=x+dx,yy=y+dy,d=dx*dx+dy*dy;if(xx<0||xx>=width||yy<0||yy>=height)continue;const i=yy*width+xx;if(values[i]>=.45&&d<distance){distance=d;best=values[i];seed=i;}}}
  if(best<.45)throw Error('AI chưa thấy rõ vật tại điểm chạm. Chạm vào giữa vật hoặc dùng bút tô.');
  const data=new Uint8Array(values.length),seen=new Uint8Array(values.length),queue=new Int32Array(values.length);let head=0,tail=1;queue[0]=seed;seen[seed]=1;
  while(head<tail){const i=queue[head++],xx=i%width,yy=Math.floor(i/width);data[i]=Math.round(Math.max(0,Math.min(1,values[i]))*255);for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){const a=xx+dx,b=yy+dy;if(a<0||a>=width||b<0||b>=height)continue;const j=b*width+a;if(!seen[j]&&values[j]>=.4){seen[j]=1;queue[tail++]=j;}}}
  if(tail<8||tail>values.length*maxFraction)throw Error('Vùng AI quá nhỏ hoặc quá rộng. Chạm rõ hơn vào đúng vật cần chọn.');
  return{id,width,height,data,point:{...point},points:[{...point}],candidate:Uint8Array.from(values,v=>Math.round(Math.max(0,Math.min(1,v))*255))};
 }
 function anchors(mask){return(mask?.points?.length?mask.points:mask?.point?[mask.point]:[]).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1);}
 function owners(people,points){const found=new Set();for(const p of points||[]){let best=null,score=.2;for(const m of people.filter(valid)){let value=at(m,p.x,p.y);if(value<.35)for(const [dx,dy]of [[-.008,0],[.008,0],[0,-.008],[0,.008]])value=Math.max(value,at(m,p.x+dx,p.y+dy)*.8);if(value>score){score=value;best=m;}}if(best)found.add(best);}return found;}
 function merge(a,b,id){if(!valid(a))return b;const width=b.width,height=b.height,data=new Uint8Array(b.data.length),candidate=new Uint8Array(data.length),exclusions=new Uint8Array(data.length),am={...a,data:a.candidate||a.data},bm={...b,data:b.candidate||b.data},ae=a.exclusions?{...a,data:a.exclusions}:null,be=b.exclusions?{...b,data:b.exclusions}:null;for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x,u=(x+.5)/width,v=(y+.5)/height;exclusions[i]=at(ae,u,v)>.4||at(be,u,v)>.4?255:0;if(!exclusions[i]){data[i]=Math.max(b.data[i],Math.round(at(a,u,v)*255));candidate[i]=Math.max(bm.data[i],Math.round(at(am,u,v)*255));}}const points=[...anchors(a),...anchors(b)].filter((p,i,all)=>at({width,height,data},p.x,p.y)>.4&&all.findIndex(q=>Math.abs(q.x-p.x)+Math.abs(q.y-p.y)<1e-6)===i);return{...b,id,data,candidate,exclusions,points,point:points.at(-1)||null};}
 function subtract(a,b,id){if(!valid(a)||!valid(b))return a;const data=a.data.slice(),candidate=(a.candidate||a.data).slice(),exclusions=a.exclusions?.slice()||new Uint8Array(data.length);let count=0;for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){const i=y*a.width+x;if(at(b,(x+.5)/a.width,(y+.5)/a.height)>=.4){data[i]=candidate[i]=0;exclusions[i]=255;}if(data[i]>=102)count++;}if(count<8)return null;const points=anchors(a).filter(p=>at({...a,data},p.x,p.y)>=.4);return{...a,id,data,candidate,exclusions,points,point:points.at(-1)||null};}
 function completePerson(mask,people,id){
  if(!valid(mask)||mask.candidate?.length!==mask.data.length)return mask;const target=owners((people||[]).filter(valid),anchors(mask));if(!target.size)return mask;
  const targets=[...target],others=(people||[]).filter(m=>valid(m)&&!target.has(m)),data=mask.data.slice();let changed=false;
  for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++){const i=y*mask.width+x,u=(x+.5)/mask.width,v=(y+.5)/mask.height;if(mask.exclusions?.[i]>=128||mask.candidate[i]<64||!targets.some(m=>at(m,u,v)>=.15)||others.some(m=>at(m,u,v)>=.2))continue;const value=Math.max(128,mask.candidate[i]);if(value>data[i]){data[i]=value;changed=true;}}
  return changed?{...mask,id,data}:mask;
 }
 // The interactive mask is tight: a small visible rim removes hair/cloth
 // leftovers that would otherwise be fed back into the reconstruction model.
 // Apply once to a fresh AI pick; manual erase strokes and person guards follow.
 function fringe(mask,id){
  if(!valid(mask))return mask;const W=mask.width,H=mask.height,N=W*H,base=Uint8Array.from(mask.data,v=>v>=102?1:0);let l=W,r=0,t=H,b=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(base[y*W+x]){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}if(l>r)return mask;
  const radius=Math.max(2,Math.min(24,Math.round(Math.max(r-l+1,b-t+1)*.06))),horizontal=new Uint8Array(N),data=new Uint8Array(N);let count=0;
  for(let y=0;y<H;y++){let sum=0;for(let x=0;x<=radius&&x<W;x++)sum+=base[y*W+x];for(let x=0;x<W;x++){horizontal[y*W+x]=sum?1:0;if(x-radius>=0)sum-=base[y*W+x-radius];if(x+radius+1<W)sum+=base[y*W+x+radius+1];}}
  for(let x=0;x<W;x++){let sum=0;for(let y=0;y<=radius&&y<H;y++)sum+=horizontal[y*W+x];for(let y=0;y<H;y++){const i=y*W+x;if(sum){data[i]=255;count++;}if(y-radius>=0)sum-=horizontal[(y-radius)*W+x];if(y+radius+1<H)sum+=horizontal[(y+radius+1)*W+x];}}
  return count>N*.7?mask:{...mask,id,data,cleanupRim:radius};
 }
 function hasSelection(state,paint){return valid(state.aiSelection)||paint.hasPaint(state.strokes);}
 const cache=[];
 function raster(state,W,H,paint){
  const keys=[state.aiSelection,state.strokes,state.protectedMasks,state.autoMasks,state.protectStrokes],found=cache.find(c=>c.width===W&&c.height===H&&keys.every((v,i)=>v===c.keys[i]));if(found)return found;
  if(!Number.isInteger(W)||!Number.isInteger(H)||W<1||H<1||W*H>1048576)throw Error('Vùng chọn quá lớn.');
  const mask=new Float32Array(W*H),protect=new Float32Array(W*H),ai=state.aiSelection,masks=[...(state.protectedMasks||[]),...(state.autoMasks||[])].filter(valid);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x,u=(x+.5)/W,v=(y+.5)/H;if(valid(ai))mask[i]=at(ai,u,v)>=.4?1:0;for(const m of masks)if(at(m,u,v)>=.15){protect[i]=1;break;}}
  for(const s of state.strokes||[])paint.stamp(s,mask,W,H);
  for(const s of state.protectStrokes||[])paint.stamp(s,protect,W,H);
  // Keep a narrow conservative rim for hair, fingers and uncertain boundaries.
  if(masks.length){const copy=protect.slice(),r=Math.max(1,Math.round(Math.max(W,H)/480));for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(copy[y*W+x])for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)if(x+dx>=0&&x+dx<W&&y+dy>=0&&y+dy<H)protect[(y+dy)*W+x+dx]=1;}
  for(let i=0;i<mask.length;i++)if(protect[i]>.05)mask[i]=0;
  const result={mask,protect,width:W,height:H,keys};if(cache.length>=3)cache.shift();cache.push(result);return result;
 }
 function otherPeople(people,selection,W,H,points=null){
  const target=points?.length?owners((people||[]).filter(valid),points):null;if(target)return(people||[]).filter(m=>valid(m)&&!target.has(m)).map(sealGuard);
  return(people||[]).filter(valid).filter(m=>{let total=0,covered=0;for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++){const i=y*m.width+x;if(m.data[i]<128)continue;total++;const xx=Math.min(W-1,Math.floor((x+.5)*W/m.width)),yy=Math.min(H-1,Math.floor((y+.5)*H/m.height));if(selection[yy*W+xx]>.5)covered++;}return total>8&&covered/total<.65;}).map(sealGuard);
 }
 function sealGuard(m){
  const W=m.width,H=m.height,N=W*H,seen=new Uint8Array(N),queue=new Int32Array(N);let read=0,write=0;
  const add=i=>{if(!seen[i]&&m.data[i]<39){seen[i]=1;queue[write++]=i;}};
  for(let x=0;x<W;x++){add(x);add((H-1)*W+x);}for(let y=0;y<H;y++){add(y*W);add(y*W+W-1);}
  while(read<write){const i=queue[read++],x=i%W,y=Math.floor(i/W);if(x)add(i-1);if(x<W-1)add(i+1);if(y)add(i-W);if(y<H-1)add(i+W);}
  let data=null;for(let i=0;i<N;i++)if(!seen[i]&&m.data[i]<39){if(!data)data=m.data.slice();data[i]=255;}return data?{...m,data}:m;
 }
 function retainRepair(raster,prior,explicit){
  if(!prior)return raster;const mask=raster.mask.slice(),protect=raster.protect.slice();
  for(let i=0;i<mask.length;i++)if(prior[i]){const keep=explicit?.[i]>.05;mask[i]=keep?0:1;protect[i]=keep?1:0;}
  return{...raster,mask,protect};
 }
 function withRepairProtection(state,W,H,paint,repairs){
  const r=raster(state,W,H,paint);if(!repairs||!state.autoMasks?.length)return r;const explicit=raster({...state,autoMasks:[]},W,H,paint),mask=r.mask.slice(),protect=r.protect.slice();for(let i=0;i<mask.length;i++)if(repairs[i]){mask[i]=explicit.mask[i];protect[i]=explicit.protect[i];}return{...r,mask,protect};
 }
 function signature(m){return valid(m)?m.id:null;}
 return{valid,at,anchors,owners,merge,subtract,completePerson,fringe,component,hasSelection,raster,otherPeople,retainRepair,withRepairProtection,signature};
});
