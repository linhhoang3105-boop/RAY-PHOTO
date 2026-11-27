/* Body-only geometry. Coordinates use image pixels even when the AI mask is square. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RayBodyCore=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const LIMBS={armL:'Bắp tay trái',armR:'Bắp tay phải',foreL:'Cẳng tay trái',foreR:'Cẳng tay phải',thL:'Đùi trái',thR:'Đùi phải',clL:'Bắp chân trái',clR:'Bắp chân phải'};
 function point(pose,index,W,H){const p=pose?.[index];return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&(p.visibility??1)>=.5&&(p.presence??1)>=.5?{x:p.x*W,y:p.y*H,confidence:Math.min(p.visibility??1,p.presence??1)}:null;}
 function limbRegions(pose,W,H){
  const result={};if(!pose||!W||!H)return result;
  function chains(roots,hinges,ends,upper,lower,width){
   const anchors=roots.map(i=>point(pose,i,W,H)),center=anchors.filter(Boolean).reduce((s,p)=>s+p.x,0)/(anchors.filter(Boolean).length||1)||W/2;
   const leftIndex=anchors[0]&&anchors[1]?(anchors[0].x<=anchors[1].x?0:1):null;
   for(let i=0;i<2;i++){
    const side=leftIndex===null?((anchors[i]?.x??center)<W/2?'L':'R'):(i===leftIndex?'L':'R');
    for(const [prefix,aIndex,bIndex,radius]of [[upper,roots[i],hinges[i],width],[lower,hinges[i],ends[i],width*.84]]){
     const a=point(pose,aIndex,W,H),b=point(pose,bIndex,W,H);if(!a||!b)continue;
     const length=Math.hypot(b.x-a.x,b.y-a.y);if(length<Math.max(12,H*.025))continue;
     const id=prefix+side,rot=Math.atan2(-(b.x-a.x),b.y-a.y)*180/Math.PI;
     result[id]={cx:(a.x+b.x)/(2*W),cy:(a.y+b.y)/(2*H),rx:Math.min(.7,length/H*radius),ry:Math.min(.7,length/H*.62),rot,
      rayPose:{a:{x:a.x/W,y:a.y/H},b:{x:b.x/W,y:b.y/H},length: length/H,confidence:Math.min(a.confidence,b.confidence)}};
    }
   }
  }
  chains([11,12],[13,14],[15,16],'arm','fore',.25);
  chains([23,24],[25,26],[27,28],'th','cl',.27);
  return result;
 }
 function inside(mask,x,y,W,H){const mx=Math.floor(x/W*mask.width),my=Math.floor(y/H*mask.height),a=mask.foreground||mask.data;return mx>=0&&my>=0&&mx<mask.width&&my<mask.height&&a[my*mask.width+mx]>=128;}
 function measureWidth(mask,p,W,H){
  if(!mask?.width||!mask?.height||!(mask.foreground||mask.data))return{ok:false,why:'Chưa có viền người'};
  const angle=(p.rot||0)*Math.PI/180,ux=Math.cos(angle),uy=Math.sin(angle),step=Math.max(.5,Math.min(W/mask.width,H/mask.height));
  const segment=p.place==='ai'?p.rayPose:null,length=segment?segment.length*H:0;
  const halfLimit=length?length*.39:Math.max(12,p.rx*H*3),samples=[];
  const centers=segment?[.32,.5,.68].map(t=>({x:(segment.a.x+(segment.b.x-segment.a.x)*t)*W,y:(segment.a.y+(segment.b.y-segment.a.y)*t)*H})):[{x:p.cx*W,y:p.cy*H}];
  for(const c of centers){
   if(!inside(mask,c.x,c.y,W,H))continue;
   let l=0,r=0;while(l<halfLimit&&inside(mask,c.x-ux*(l+step),c.y-uy*(l+step),W,H))l+=step;while(r<halfLimit&&inside(mask,c.x+ux*(r+step),c.y+uy*(r+step),W,H))r+=step;
   const ends=[[c.x-ux*l,c.y-uy*l],[c.x+ux*r,c.y+uy*r]];
   if(l>=halfLimit||r>=halfLimit||ends.some(([x,y])=>x<=step||y<=step||x>=W-step||y>=H-step))continue;
   const width=l+r+step;if(width<Math.max(5,step*2)||length&&Math.max(l,r)>Math.max(l+r,step)*.84)continue;
   samples.push({width,left:l,right:r,center:c});
  }
  if(!samples.length||segment&&samples.length<2)return{ok:false,why:'Vùng bị che, chạm thân hoặc thiếu viền rõ; có thể đặt vòng bằng tay'};
  samples.sort((a,b)=>a.width-b.width);const middle=samples[Math.floor(samples.length/2)];
  if(segment&&samples.at(-1).width>middle.width*1.65)return{ok:false,why:'Viền đoạn tay/chân chưa tách rõ khỏi thân'};
  return{ok:true,widthPx:middle.width,lengthPx:length||null,samples:samples.length,left:middle.left,right:middle.right};
 }
 function boundaries(mask,cap=256){
  const data=mask.foreground||mask.data,mw=mask.width,mh=mask.height,scale=Math.min(1,cap/Math.max(mw,mh)),w=Math.max(2,Math.round(mw*scale)),h=Math.max(2,Math.round(mh*scale));
  const at=(x,y)=>x<0||y<0||x>=w||y>=h?0:data[Math.min(mh-1,Math.floor((y+.5)*mh/h))*mw+Math.min(mw-1,Math.floor((x+.5)*mw/w))]/255;
  const table=[[],[[3,0]],[[0,1]],[[3,1]],[[1,2]],[[3,0],[1,2]],[[0,2]],[[3,2]],[[2,3]],[[0,2]],[[0,1],[2,3]],[[1,2]],[[1,3]],[[0,1]],[[3,0]],[]],segments=[];
  for(let y=-1;y<h;y++)for(let x=-1;x<w;x++){
   const v=[at(x,y),at(x+1,y),at(x+1,y+1),at(x,y+1)],code=v.reduce((n,a,i)=>n|(a>=.5?1<<i:0),0);if(!code||code===15)continue;
   const corners=[[x+.5,y+.5],[x+1.5,y+.5],[x+1.5,y+1.5],[x+.5,y+1.5]],edge=i=>{const j=(i+1)%4,t=clamp((.5-v[i])/(v[j]-v[i]||1),0,1);return[clamp((corners[i][0]+(corners[j][0]-corners[i][0])*t)/w,0,1),clamp((corners[i][1]+(corners[j][1]-corners[i][1])*t)/h,0,1)];};
   for(const [a,b]of table[code])segments.push([edge(a),edge(b)]);
  }
  return segments;
 }
 function tracePaths(segments){
  const vertices=new Map(),edges=[],key=p=>p.map(v=>Math.round(v*1e6)).join(':');
  for(const segment of segments){const a=key(segment[0]),b=key(segment[1]);if(a===b)continue;const index=edges.length;edges.push([a,b]);for(let i=0;i<2;i++){const k=i?b:a;if(!vertices.has(k))vertices.set(k,{point:segment[i],edges:[]});vertices.get(k).edges.push(index);}}
  const used=new Set(),paths=[];
  for(let i=0;i<edges.length;i++){if(used.has(i))continue;const path=[],start=edges[i][0];let current=start,next=i;path.push(vertices.get(start).point);
   while(next!==undefined&&!used.has(next)){used.add(next);const edge=edges[next];current=edge[0]===current?edge[1]:edge[0];path.push(vertices.get(current).point);if(current===start)break;next=vertices.get(current).edges.find(index=>!used.has(index));}
   if(path.length>2)paths.push(path);
  }return paths.sort((a,b)=>b.length-a.length);
 }
 function plannedParts(parts,entries,E=.75){
  const updates=new Map(entries.map(e=>[e.p?.id,e]));return parts.map(p=>{const e=updates.get(p.id);if(!e)return{...p};const field=e.axis==='y'?'len':'wid',contrib=Math.log(1+clamp(e.delta,-.4,.4))/(Math.LN2*E);return{...p,[field]:clamp((p[field]||0)+contrib-(p['ray54'+field]||0),-.65,.65),rx:Math.max(p.rx,e.rx||0),ry:Math.max(p.ry,e.ry||0)};});
 }
 let regionMasker=null;
 function sourceAt(co,x,y){const r2=(x/co.Rx)**2+(y/co.Ry)**2;if(r2>=1)return[x,y];const t=Math.min(1,(1-Math.sqrt(r2))/co.span),f=t*t*(3-2*t)*(co.maskAt?co.maskAt(x,y):1);return[x*(1-co.ax*f)-co.dx*f,y*(1-co.ay*f)-co.dy*f];}
 function compile(parts,W,H,kernel){return parts.filter(p=>Math.abs(p.size||0)>.001||Math.abs(p.wid||0)>.001||Math.abs(p.len||0)>.001||(p.push||0)>.001).map(p=>{const k=kernel.guard(p).k,a=(p.rot||0)*Math.PI/180,cs=Math.cos(a),sn=Math.sin(a),co=kernel.coef(p,k,p.rx*H,p.ry*H),mask=regionMasker?.(p,W,H);if(mask)co.maskAt=(x,y)=>mask.sample(p.cx*W+cs*x-sn*y-.5,p.cy*H+sn*x+cs*y-.5);return{cx:p.cx*W,cy:p.cy*H,cs,sn,co};});}
 function project(point,warps,W,H){let x=point[0]*W,y=point[1]*H;for(const p of warps){const dx=x-p.cx,dy=y-p.cy,sx=p.cs*dx+p.sn*dy,sy=-p.sn*dx+p.cs*dy;if((sx/p.co.Rx)**2+(sy/p.co.Ry)**2>=1)continue;let lx=sx,ly=sy;
   for(let i=0;i<12;i++){const s=sourceAt(p.co,lx,ly),ex=sx-s[0],ey=sy-s[1];if(Math.hypot(ex,ey)<.025)break;const d=.1,a=sourceAt(p.co,lx+d,ly),b=sourceAt(p.co,lx,ly+d),aa=(a[0]-s[0])/d,ab=(b[0]-s[0])/d,ba=(a[1]-s[1])/d,bb=(b[1]-s[1])/d,det=aa*bb-ab*ba;if(Math.abs(det)<.01)break;lx+=(bb*ex-ab*ey)/det;ly+=(-ba*ex+aa*ey)/det;}
   x=p.cx+p.cs*lx-p.sn*ly;y=p.cy+p.sn*lx+p.cs*ly;
  }return[x/W,y/H];}
 function unproject(point,warps,W,H){let x=point[0]*W,y=point[1]*H;for(let i=warps.length-1;i>=0;i--){const p=warps[i],dx=x-p.cx,dy=y-p.cy,[sx,sy]=sourceAt(p.co,p.cs*dx+p.sn*dy,-p.sn*dx+p.cs*dy);x=p.cx+p.cs*sx-p.sn*sy;y=p.cy+p.sn*sx+p.cs*sy;}return[x/W,y/H];}
 return{LIMBS,point,limbRegions,measureWidth,boundaries,tracePaths,plannedParts,sourceAt,compile,project,unproject,setRegionMasker:fn=>{regionMasker=fn;}};
});
