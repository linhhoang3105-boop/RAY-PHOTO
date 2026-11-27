/* Open, editable body strokes. Guides are vectors; pixels are sampled once from the retained render. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RayBodyLineCore=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=t=>t*t*(3-2*t),cache=new WeakMap();
 const MAX_LINES=64,MAX_POINTS=256,MAX_TOTAL=8192;
 const pair=p=>Array.isArray(p)&&p.length===2&&p.every(v=>Number.isFinite(v)&&v>=-32&&v<=33);
 function valid(line){return !!line&&typeof line.id==='string'&&/^line-\d+$/.test(line.id)&&Array.isArray(line.points)&&line.points.length>=2&&line.points.length<=MAX_POINTS&&line.points.every(pair)&&Array.isArray(line.offsets)&&line.offsets.length===line.points.length&&line.offsets.every(pair)&&Number.isFinite(line.size)&&line.size>=.003&&line.size<=8&&Number.isFinite(line.strength)&&line.strength>=0&&line.strength<=1;}
 function restore(value){if(!value||value.version!==1||!Array.isArray(value.lines)||value.lines.length>MAX_LINES||value.lines.reduce((n,l)=>n+(l?.points?.length||0),0)>MAX_TOTAL||!value.lines.every(valid)||new Set(value.lines.map(l=>l.id)).size!==value.lines.length)return null;return value.lines.length?{version:1,lines:value.lines.map(l=>({id:l.id,personId:typeof l.personId==='string'?l.personId:'manual',points:l.points.map(p=>p.slice()),offsets:l.offsets.map(p=>p.slice()),size:l.size,strength:l.strength}))}:null;}
 function state(){let lines=[];return{capture:()=>lines.length?{version:1,lines}:null,restore:v=>{lines=restore(v)?.lines||[];},get lines(){return lines;},set(next){lines=next;},clear(){lines=[];}};}
 function stroke(points,W,H){
  const unique=[];for(const p of points)if(pair(p)&&(!unique.length||Math.hypot((p[0]-unique.at(-1)[0])*W,(p[1]-unique.at(-1)[1])*H)>.001))unique.push(p.slice());
  if(unique.length<2)return null;if(unique.length<=MAX_POINTS)return unique;
  const length=[0];for(let i=1;i<unique.length;i++)length.push(length.at(-1)+Math.hypot((unique[i][0]-unique[i-1][0])*W,(unique[i][1]-unique[i-1][1])*H));
  const out=[unique[0]];let j=1;for(let i=1;i<MAX_POINTS-1;i++){const d=length.at(-1)*i/(MAX_POINTS-1);while(j<length.length-1&&length[j]<d)j++;const t=(d-length[j-1])/(length[j]-length[j-1]||1);out.push(unique[j-1].map((v,k)=>v+(unique[j][k]-v)*t));}out.push(unique.at(-1));return out;
 }
 function move(line,index,dx,dy,W,H,whole=false){
  const L=Math.min(W,H),radius=line.size*L,arc=[0];for(let i=1;i<line.points.length;i++)arc.push(arc.at(-1)+Math.hypot((line.points[i][0]-line.points[i-1][0])*W,(line.points[i][1]-line.points[i-1][1])*H));
  const offsets=line.offsets.map((p,i)=>{const f=whole?1:smooth(clamp(1-Math.abs(arc[i]-arc[index])/Math.max(1,radius*1.5),0,1));let x=p[0]*W+dx*f,y=p[1]*H+dy*f;const k=Math.min(1,radius*.4/(Math.hypot(x,y)||1));return[x*k/W,y*k/H];});return{...line,offsets};
 }
 function compile(line,W,H){
  if(!Number.isFinite(W)||!Number.isFinite(H)||W<=0||H<=0||!valid(line)||line.strength<=0||!line.offsets.some(p=>Math.hypot(...p)>1e-9))return null;
  const aspect=W/H,key=aspect.toFixed(10);let entries=cache.get(line);if(entries?.has(key))return entries.get(key);if(!entries){entries=new Map();cache.set(line,entries);}
  const L=Math.min(W,H),ax=W/L,ay=H/L,R=line.size,points=line.points.map((p,i)=>{let dx=line.offsets[i][0]*ax,dy=line.offsets[i][1]*ay;const k=Math.min(1,R*.4/(Math.hypot(dx,dy)||1))*line.strength;dx*=k;dy*=k;return[p[0]*ax+dx,p[1]*ay+dy,dx,dy];});
  const left=Math.max(-R,Math.min(...points.map(p=>p[0]))-R),right=Math.min(ax+R,Math.max(...points.map(p=>p[0]))+R),top=Math.max(-R,Math.min(...points.map(p=>p[1]))-R),bottom=Math.min(ay+R,Math.max(...points.map(p=>p[1]))+R);
  if(right<=left||bottom<=top)return null;
  let nx=Math.max(2,Math.ceil((right-left)/(R/12)-1e-8)),ny=Math.max(2,Math.ceil((bottom-top)/(R/12)-1e-8));const reduction=Math.max(1,Math.sqrt(nx*ny/80000),nx/512,ny/512);nx=Math.ceil(nx/reduction-1e-8)+1;ny=Math.ceil(ny/reduction-1e-8)+1;
  const sx=(right-left)/(nx-1),sy=(bottom-top)/(ny-1),x=new Float32Array(nx*ny),y=new Float32Array(nx*ny);
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
   const px=left+i*sx,py=top+j*sy;let distance=R*R,vx=0,vy=0;
   for(let k=1;k<points.length;k++){const a=points[k-1],b=points[k],dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((px-a[0])*dx+(py-a[1])*dy)/(dx*dx+dy*dy||1e-20),0,1),d=(px-a[0]-dx*t)**2+(py-a[1]-dy*t)**2;if(d<distance){distance=d;vx=a[2]+(b[2]-a[2])*t;vy=a[3]+(b[3]-a[3])*t;}}
   const f=smooth(clamp(1-Math.sqrt(distance)/R,0,1)),n=j*nx+i;x[n]=vx*f;y[n]=vy*f;
  }
  // A bound on each bilinear cell's displacement gradient prevents folded/overlapping pixels.
  let gradient=0;for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){const a=j*nx+i,b=a+1,c=a+nx,d=c+1;for(const [u,v]of [[a,c],[b,d]])for(const [q,r]of [[a,b],[c,d]])gradient=Math.max(gradient,Math.hypot((x[r]-x[q])/sx,(y[r]-y[q])/sx,(x[v]-x[u])/sy,(y[v]-y[u])/sy));}
  const gain=Math.min(1,.65/(gradient||1));if(gain<1)for(let i=0;i<x.length;i++){x[i]*=gain;y[i]*=gain;}
  const field={left,right,top,bottom,nx,ny,sx,sy,x,y,gain,gradient:gradient*gain,extent:Math.max(...points.map(p=>Math.hypot(p[2],p[3])))*gain};entries.set(key,field);return field;
 }
 function at(field,px,py){if(!field||px<=field.left||py<=field.top||px>=field.right||py>=field.bottom)return[0,0];const u=(px-field.left)/field.sx,v=(py-field.top)/field.sy,i=Math.min(field.nx-2,Math.floor(u)),j=Math.min(field.ny-2,Math.floor(v)),fx=u-i,fy=v-j,a=j*field.nx+i,b=a+field.nx,sample=d=>(d[a]*(1-fx)+d[a+1]*fx)*(1-fy)+(d[b]*(1-fx)+d[b+1]*fx)*fy;return[sample(field.x),sample(field.y)];}
 function fields(lines,W,H){return(lines||[]).map(l=>compile(l,W,H)).filter(Boolean);}
 function unproject(point,compiled,W,H){const L=Math.min(W,H);let x=point[0]*W/L,y=point[1]*H/L;for(let i=compiled.length-1;i>=0;i--){const d=at(compiled[i],x,y);x-=d[0];y-=d[1];}return[x*L/W,y*L/H];}
 function project(point,compiled,W,H){const L=Math.min(W,H);let x=point[0]*W/L,y=point[1]*H/L;for(const f of compiled){const bx=x,by=y;for(let i=0;i<35;i++){const d=at(f,x,y),nx=bx+d[0],ny=by+d[1];if(Math.hypot(nx-x,ny-y)<1e-8){x=nx;y=ny;break;}x=nx;y=ny;}}return[x*L/W,y*L/H];}
 function apply(c,W,H,lines){
  const compiled=fields(lines,W,H);if(!compiled.length)return false;const L=Math.min(W,H),margin=compiled.reduce((n,f)=>n+f.extent,0)*L+3,x0=clamp(Math.floor(Math.min(...compiled.map(f=>f.left))*L-margin),0,W),y0=clamp(Math.floor(Math.min(...compiled.map(f=>f.top))*L-margin),0,H),x1=clamp(Math.ceil(Math.max(...compiled.map(f=>f.right))*L+margin),0,W),y1=clamp(Math.ceil(Math.max(...compiled.map(f=>f.bottom))*L+margin),0,H),w=x1-x0,h=y1-y0;
  if(w<=0||h<=0)return false;const before=c.getImageData(x0,y0,w,h),out=c.createImageData(w,h),S=before.data,O=out.data;O.set(S);
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
   let u=(x+.5)/L,v=(y+.5)/L;for(let i=compiled.length-1;i>=0;i--){const d=at(compiled[i],u,v);u-=d[0];v-=d[1];}
   const px=clamp(u*L-.5-x0,0,w-1),py=clamp(v*L-.5-y0,0,h-1);if(Math.abs(px-(x-x0))+Math.abs(py-(y-y0))<1e-7)continue;
   const ix=Math.floor(px),iy=Math.floor(py),jx=Math.min(ix+1,w-1),jy=Math.min(iy+1,h-1),fx=px-ix,fy=py-iy,ids=[(iy*w+ix)*4,(iy*w+jx)*4,(jy*w+ix)*4,(jy*w+jx)*4],weights=[(1-fx)*(1-fy),fx*(1-fy),(1-fx)*fy,fx*fy],n=((y-y0)*w+x-x0)*4;let alpha=0;for(let k=0;k<4;k++)alpha+=S[ids[k]+3]*weights[k];for(let ch=0;ch<3;ch++){let value=0;for(let k=0;k<4;k++)value+=S[ids[k]+ch]*S[ids[k]+3]*weights[k];O[n+ch]=alpha?value/alpha:0;}O[n+3]=alpha;
  }c.putImageData(out,x0,y0);return true;
 }
 return{MAX_LINES,MAX_POINTS,MAX_TOTAL,valid,restore,state,stroke,move,compile,fields,at,project,unproject,apply};
});
