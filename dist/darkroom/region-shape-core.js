/* Assemble open strokes into editable, reusable selection outlines. No photo data. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RayRegionShape=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const MAX=2048,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),distance=(a,b,W=1,H=1)=>Math.hypot((a[0]-b[0])*W,(a[1]-b[1])*H),same=(a,b)=>distance(a,b)<1e-10;
 const bounds=points=>({left:Math.min(...points.map(p=>p[0])),right:Math.max(...points.map(p=>p[0])),top:Math.min(...points.map(p=>p[1])),bottom:Math.max(...points.map(p=>p[1]))});
 function checked(points){if(points.length>MAX)throw Error('Hình đã có nhiều điểm. Bắt đầu hình mới để vẽ tiếp.');return points;}
 function close(stroke){if(stroke.mode!=='lasso'||stroke.points.length<3)return stroke;const p=stroke.points;return{...stroke,open:false,points:checked(same(p[0],p.at(-1))?p.slice():[...p,p[0].slice()])};}
 function segment(a,b,kind,W,H,control){
  if(kind!=='curve')return[a.slice(),b.slice()];const dx=(b[0]-a[0])*W,dy=(b[1]-a[1])*H,c=control||[(a[0]+b[0])/2-dy/W*.45,(a[1]+b[1])/2+dx/H*.45],points=[];
  for(let i=0;i<=32;i++){const t=i/32,u=1-t;points.push([u*u*a[0]+2*u*t*c[0]+t*t*b[0],u*u*a[1]+2*u*t*c[1]+t*t*b[1]]);}return points;
 }
 function append(points,added){return checked([...points,...(points.length&&added.length&&same(points.at(-1),added[0])?added.slice(1):added)]);}
 function join(strokes,index,tolerance,W,H){
  let out=strokes.slice(),selected=index,changed=true;while(changed){changed=false;const a=out[selected];if(!a?.open||a.mode!=='lasso'||!a.points.length)break;let best=null,dist=tolerance;
   for(let i=0;i<out.length;i++){const b=out[i];if(i===selected||!b?.open||b.mode!=='lasso'||!b.points.length)continue;for(const ai of [0,a.points.length-1])for(const bi of [0,b.points.length-1]){const d=distance(a.points[ai],b.points[bi],W,H);if(d<dist){dist=d;best={i,ai,bi};}}}
   if(best){let left=a.points,right=out[best.i].points;if(best.ai===0)left=left.slice().reverse();if(best.bi!==0)right=right.slice().reverse();const merged={...a,points:append(left,right)},next=[];for(let i=0;i<out.length;i++){if(i===selected){selected=next.length;next.push(merged);}else if(i!==best.i)next.push(out[i]);}out=next;changed=true;}
  }
  const a=out[selected];if(a?.open&&a.points.length>=3&&distance(a.points[0],a.points.at(-1),W,H)<=tolerance)out=out.map((s,i)=>i===selected?close(s):s);return{strokes:out,index:selected};
 }
 function primitive(shape,f,W,H,options={}){
  const a=(options.angle||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),rx=f.rx*W,ry=f.ry*H,map=([x,y])=>[f.cx+(x*c-y*s)/W,f.cy+(x*s+y*c)/H];let points,open=false;
  if(shape==='ellipse')points=Array.from({length:73},(_,i)=>[Math.cos(i/72*Math.PI*2)*rx,Math.sin(i/72*Math.PI*2)*ry]);
  else if(shape==='rect')points=[[-rx,-ry],[rx,-ry],[rx,ry],[-rx,ry],[-rx,-ry]];
  else if(shape==='beam')points=[[-rx,0],[rx,-ry],[rx,ry],[-rx,0]];
  else{open=true;points=segment([-rx,0],[rx,0],shape==='curve'?'curve':'line',1,1,shape==='curve'?[0,2*ry*(options.curve??.7)]:null);}
  return{mode:'lasso',size:.006,open,points:points.map(map)};
 }
 function transform(points,W,H,{dx=0,dy=0,sx=1,sy=1,angle=0,center}={}){const b=bounds(points),cx=(center?.[0]??(b.left+b.right)/2)*W,cy=(center?.[1]??(b.top+b.bottom)/2)*H,a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return points.map(p=>{const x=(p[0]*W-cx)*sx,y=(p[1]*H-cy)*sy;return[(cx+x*c-y*s+dx)/W,(cy+x*s+y*c+dy)/H];});}
 function bend(points,index,dx,dy,W,H,span){const anchor=points[index],r=Math.max(1,span*Math.min(W,H));return points.map((p,i)=>{const d=distance(p,anchor,W,H)/r,f=points.length<12?(i===index||same(p,anchor)?1:0):Math.max(0,1-d)**2*(1+2*Math.min(1,d));return[clamp(p[0]+dx/W*f,-16,17),clamp(p[1]+dy/H*f,-16,17)];});}
 function hit(strokes,p,W,H,tolerance=20){let best=null,nearest=tolerance;for(let k=strokes.length-1;k>=0;k--){const s=strokes[k];if(s.mode!=='lasso')continue;const pts=s.points;for(let i=0;i<pts.length;i++){const d=distance(pts[i],p,W,H);if(d<nearest){nearest=d;best={index:k,point:i,distance:d};}if(i){const a=pts[i-1],b=pts[i],dx=(b[0]-a[0])*W,dy=(b[1]-a[1])*H,t=clamp(((p[0]-a[0])*W*dx+(p[1]-a[1])*H*dy)/(dx*dx+dy*dy||1)),d=distance([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],p,W,H);if(d<nearest){nearest=d;best={index:k,point:t<.5?i-1:i,distance:d};}}}}return best;}
 function importPaths(paths,W,H,size=.006){return paths.filter(p=>p.length>1).map(p=>{if(p.length>=MAX)throw Error('Nét quá dài để ghép. Chia thành hai hình để giữ đủ chi tiết.');return{mode:'lasso',size,open:!same(p[0],p.at(-1)),points:p.map(q=>q.slice())};});}
 return{MAX,distance,bounds,close,segment,append,join,primitive,transform,bend,hit,importPaths};
});
