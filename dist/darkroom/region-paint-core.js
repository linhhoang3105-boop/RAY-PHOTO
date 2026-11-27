/* Reusable vector selections. Pixels and AI recognition never enter this data. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RayRegionPaint=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const MAX_STROKES=256,MAX_POINTS=2048,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),smooth=t=>t*t*(3-2*t),point=p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1]);
 const hasPaint=strokes=>Array.isArray(strokes)&&strokes.some(s=>s&&s.mode!=='erase'&&!(s.mode==='lasso'&&s.open===true)&&s?.points?.filter(point).length>=(s.mode==='lasso'?3:1));
 const caches=[];
 function sample(data,W,H,u,v){const x=clamp(u*W-.5,0,W-1),y=clamp(v*H-.5,0,H-1),a=Math.floor(x),b=Math.floor(y),c=Math.min(W-1,a+1),d=Math.min(H-1,b+1),fx=x-a,fy=y-b;return(data[b*W+a]*(1-fx)+data[b*W+c]*fx)*(1-fy)+(data[d*W+a]*(1-fx)+data[d*W+c]*fx)*fy;}
 function stamp(stroke,data,W,H){
  const pts=(stroke?.points||[]).filter(point);if(!pts.length||stroke.mode==='lasso'&&(pts.length<3||stroke.open===true))return;
  const radius=Math.max(.5,clamp(Number(stroke.size)||.12,.001,4)*Math.min(W,H)/2),mask=new Float32Array(W*H);
  let x0=W,y0=H,x1=-1,y1=-1;
  if(stroke.mode==='lasso'&&pts.length>=3){
   const left=Math.max(0,Math.floor(Math.min(...pts.map(p=>p[0]))*W)),right=Math.min(W-1,Math.ceil(Math.max(...pts.map(p=>p[0]))*W)),top=Math.max(0,Math.floor(Math.min(...pts.map(p=>p[1]))*H)),bottom=Math.min(H-1,Math.ceil(Math.max(...pts.map(p=>p[1]))*H));
   x0=left;x1=right;y0=top;y1=bottom;
   for(let y=top;y<=bottom;y++){
    const v=(y+.5)/H,crossings=[];for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[j],b=pts[i];if((a[1]>v)!==(b[1]>v))crossings.push((a[0]+(v-a[1])*(b[0]-a[0])/(b[1]-a[1]))*W);}
    crossings.sort((a,b)=>a-b);for(let i=0;i+1<crossings.length;i+=2)for(let x=Math.max(left,Math.ceil(crossings[i]-.5));x<=Math.min(right,Math.floor(crossings[i+1]-.5));x++)mask[y*W+x]=1;
   }
  }else{
   for(let n=0;n<Math.max(1,pts.length-1);n++){
    const a=pts[n],b=pts[Math.min(n+1,pts.length-1)],ax=a[0]*W,ay=a[1]*H,bx=b[0]*W,by=b[1]*H,dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy;
    const l=Math.max(0,Math.floor(Math.min(ax,bx)-radius-1)),r=Math.min(W-1,Math.ceil(Math.max(ax,bx)+radius+1)),t=Math.max(0,Math.floor(Math.min(ay,by)-radius-1)),bottom=Math.min(H-1,Math.ceil(Math.max(ay,by)+radius+1));x0=Math.min(x0,l);x1=Math.max(x1,r);y0=Math.min(y0,t);y1=Math.max(y1,bottom);
    for(let y=t;y<=bottom;y++)for(let x=l;x<=r;x++){const u=len?clamp(((x+.5-ax)*dx+(y+.5-ay)*dy)/len):0,coverage=clamp(radius+.5-Math.hypot(x+.5-ax-u*dx,y+.5-ay-u*dy)),i=y*W+x;if(coverage>mask[i])mask[i]=coverage;}
   }
  }
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=y*W+x;data[i]=stroke.mode==='erase'?data[i]*(1-mask[i]):Math.max(data[i],mask[i]);}
 }
 function blur(input,W,H,radius){
  if(radius<1)return input;let data=input;
  // Three box passes approximate a Gaussian while keeping allocation and work bounded.
  for(let pass=0;pass<3;pass++)for(let axis=0;axis<2;axis++){
   const out=new Float32Array(data.length),outer=axis?W:H,inner=axis?H:W,span=radius*2+1,at=(a,b)=>axis?b*W+a:a*W+b;
   for(let a=0;a<outer;a++){let sum=0;for(let b=-radius;b<=radius;b++)sum+=data[at(a,clamp(b,0,inner-1))];for(let b=0;b<inner;b++){out[at(a,b)]=sum/span;sum+=data[at(a,clamp(b+radius+1,0,inner-1))]-data[at(a,clamp(b-radius,0,inner-1))];}}
   data=out;
  }return data;
 }
 function raster(strokes,W,H,{cap=1536,feather=0}={}){
  const edge=Math.max(2,Math.min(1536,cap)),k=Math.min(1,edge/Math.max(W,H)),width=Math.max(2,Math.round(W*k)),height=Math.max(2,Math.round(H*k)),soft=clamp(Number(feather)||0),found=caches.find(c=>c.strokes===strokes&&c.width===width&&c.height===height&&c.soft===soft);
  if(found)return found;
  const list=Array.isArray(strokes)?strokes:[],previous=caches.find(c=>c.width===width&&c.height===height&&c.strokes.length&&list.length>=c.strokes.length&&c.strokes.slice(0,-1).every((s,i)=>list[i]===s));
  let raw=new Float32Array(width*height),start=0,before=raw;
  if(previous){if(list.length>previous.strokes.length&&previous.strokes.every((s,i)=>list[i]===s)){raw=new Float32Array(previous.raw);start=previous.strokes.length;}else{raw=new Float32Array(previous.before);start=previous.strokes.length-1;}}
  for(let i=start;i<list.length;i++){if(i===list.length-1)before=new Float32Array(raw);stamp(list[i],raw,width,height);}
  const radius=Math.round(soft*Math.min(width,height)*.012),data=blur(raw,width,height,radius),entry={strokes:list,width,height,soft,raw,before,data,at:(u,v)=>sample(data,width,height,u,v)};
  while(caches.length&&(caches.length>=3||caches.reduce((n,c)=>n+c.width*c.height,0)+width*height>2.5e6))caches.shift();caches.push(entry);return entry;
 }
 function contours(mask,threshold=.5){
  const {width:W,height:H,data}=mask,segments=[],value=(x,y)=>x<0||y<0||x>=W||y>=H?0:data[y*W+x],table={1:[[3,0]],2:[[0,1]],3:[[3,1]],4:[[1,2]],5:[[3,0],[1,2]],6:[[0,2]],7:[[3,2]],8:[[2,3]],9:[[2,0]],10:[[0,1],[2,3]],11:[[2,1]],12:[[1,3]],13:[[1,0]],14:[[0,3]]};
  for(let y=-1;y<H;y++)for(let x=-1;x<W;x++){
   const v=[value(x,y),value(x+1,y),value(x+1,y+1),value(x,y+1)],code=v.reduce((n,a,i)=>n+(a>=threshold?1<<i:0),0),pairs=table[code];if(!pairs)continue;
   const points=[[x+.5,y+.5],[x+1.5,y+.5],[x+1.5,y+1.5],[x+.5,y+1.5]],edge=n=>{const a=n,b=(n+1)%4,t=(threshold-v[a])/(v[b]-v[a]||1);return[(points[a][0]+(points[b][0]-points[a][0])*t)/W,(points[a][1]+(points[b][1]-points[a][1])*t)/H];};
   for(const pair of pairs)segments.push(pair.map(edge));
  }
  const key=p=>Math.round(p[0]*1e7)+','+Math.round(p[1]*1e7),links=new Map(),used=new Set();segments.forEach((s,i)=>s.forEach(p=>{const k=key(p);if(!links.has(k))links.set(k,[]);links.get(k).push(i);}));const paths=[];
  for(let i=0;i<segments.length;i++){if(used.has(i))continue;const path=[segments[i][0],segments[i][1]];used.add(i);let tip=key(path.at(-1));while(tip!==key(path[0])){const next=links.get(tip)?.find(j=>!used.has(j));if(next===undefined)break;used.add(next);const s=segments[next],p=key(s[0])===tip?s[1]:s[0];path.push(p);tip=key(p);}if(path.length>2)paths.push(path);}
  return paths;
 }
 function append(points,next,minDistance=.0005){if(!point(next))return points;const last=points.at(-1);if(last&&Math.hypot(next[0]-last[0],next[1]-last[1])<minDistance)return points;if(points.length>=MAX_POINTS)return points;return[...points,[clamp(next[0]),clamp(next[1])]];}
 return{MAX_STROKES,MAX_POINTS,hasPaint,stamp,raster,contours,append,invalidate(){caches.length=0;}};
});
