/* Offline image analysis and orchestration plans. All rendering remains in RAY's existing engines. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./region-paint-core.js'):root.RayRegionPaint,typeof module==='object'&&module.exports?require('./ai-composer-regions.js'):root.RayAIComposerRegions);if(typeof module==='object'&&module.exports)module.exports=api;else root.RayAIComposerCore=api;})(typeof globalThis!=='undefined'?globalThis:this,(Paint,Regions)=>{
 'use strict';
 const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(Number(n))?Number(n):a)),copy=v=>JSON.parse(JSON.stringify(v)),lum=(r,g,b)=>(r*.2126+g*.7152+b*.0722)/255;
 const styles=[
  {id:'auto-beauty',name:'Auto Beauty',description:'Cân bằng tổng thể, ưu tiên da và chi tiết.'},
  {id:'backlight',name:'Cứu ngược sáng',description:'Bù sáng chủ thể tối, giữ vùng nền sáng và màu da tự nhiên.'},
  {id:'restore-detail',name:'Cứu sáng & nét',description:'Cứu ngược sáng, mở bóng trên mặt và làm rõ chi tiết còn có trong ảnh.'},
  {id:'film-recovery',name:'Màu phim cứu sáng',description:'Cứu sáng chủ thể, phối màu phim cảm hứng Fuji riêng cho cảnh và giữ da tự nhiên.'},
  {id:'natural',name:'Natural',description:'Trong trẻo, giữ ánh sáng và màu tự nhiên.'},
  {id:'cinematic',name:'Cinematic',description:'Sắc độ điện ảnh và chiều sâu có kiểm soát.'},
  {id:'golden-hour',name:'Golden Hour',description:'Nắng vàng mềm theo ánh sáng trong ảnh.'},
  {id:'vintage-film',name:'Vintage Film',description:'Sắc phim hoài cổ và hạt mịn theo kết cấu ảnh.'},
  {id:'editorial',name:'Editorial',description:'Sạch, sang trọng và rõ cấu trúc ánh sáng.'},
  {id:'soft-dream',name:'Soft Dream',description:'Ánh sáng dịu, sắc độ nhẹ, giữ chi tiết nguồn.'},
  {id:'moody',name:'Moody',description:'Trầm có chiều sâu, giữ chủ thể rõ.'},
  {id:'creative',name:'Creative AI',description:'Khám phá tổ hợp màu, ánh sáng và chất phim từ ảnh.'}
 ];
 // Keep every published style ID readable/callable. The picker has one rescue
 // choice because backlight and restore-detail share the same native workflow.
 const styleCuration={backlight:{visible:false,canonicalId:'restore-detail',reason:'Đã gộp vào Cứu sáng & nét.'},'restore-detail':{visible:true,canonicalId:'restore-detail',aliases:['backlight']}};
 function getVisibleStyles(){return styles.filter(style=>styleCuration[style.id]?.visible!==false).map(style=>({...style,...(styleCuration[style.id]?.aliases?{aliases:styleCuration[style.id].aliases.slice()}:{})}));}
 const NUM={temp:[-1,1],tint:[-1,1],split:[-1,1],contrast:[-1,1],sat:[-1,1],lift:[0,1],halation:[0,1],grain:[0,1],vignette:[0,1],leak:[0,1],dust:[0,1],ca:[0,1],flash:[0,1],glow:[0,1],nang:[0,1],filmExp:[0,1],sharp:[0,1],kinh:[0,1],bgBlur:[0,1],motion:[0,1],spark:[0,1],paper:[0,1],gloss:[0,1],soft:[0,1],ptex:[0,1],film:[0,1],printClear:[0,1],dehaze:[0,1],detail:[0,1],rayNangPho:[0,1.5],rayThuNhat:[0,1.5],toneExposure:[-2,2],toneBrightness:[-1,1],toneHighlights:[-1,1],toneShadows:[-1,1],toneWhites:[-1,1],toneBlacks:[-1,1],toneLocalEV:[-2,2],toneLocalBrightness:[-1,1],toneLocalWarmth:[-1,1],toneLocalColorAmount:[0,1]};
 const OPTIONAL={haltint:[0,1],leakAngle:[-180,180],leakBandWidth:[.04,1],leakHue:[-45,75],leakSat:[0,2],nangSat:[0,2],nangSize:[.15,1.4],nangAspect:[.25,4],nangAngle:[-180,180],leakAspect:[.25,4],motionAngle:[-180,180],adjustRegionX:[-4,5],adjustRegionY:[-4,5],adjustRegionRX:[.001,16],adjustRegionRY:[.001,16],adjustRegionAngle:[-180,180],adjustRegionFeather:[0,1],adjustRegionThickness:[.000001,8],adjustRegionCurve:[-1,1],toneLocalOpacity:[0,1],toneLocalFeather:[0,1],toneLocalAngle:[-180,180],toneLocalCurve:[-1,1],toneLocalThickness:[.000001,4]};
 const EFFECTS=Object.keys(NUM),finite=n=>typeof n==='number'&&Number.isFinite(n);
 function normalizedPlane(m,name){
  const data=m?.[name],width=m?.width,height=m?.height;if(!data||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||data.length!==width*height)return null;
  let divisor=255;if(!(data instanceof Uint8Array)&&!(data instanceof Uint8ClampedArray)){let max=0;for(let i=0;i<data.length;i+=Math.max(1,Math.floor(data.length/128)))max=Math.max(max,Number(data[i])||0);divisor=max>1?255:1;}
  return {data,width,height,at(u,v){return clamp(data[Math.min(height-1,Math.floor(clamp(v)*height))*width+Math.min(width-1,Math.floor(clamp(u)*width))]/divisor);}};
 }
 function faceRegion(faces){
  const points=(faces||[]).flatMap(face=>Array.isArray(face)?face.filter(p=>finite(p?.x)&&finite(p?.y)):[]);if(!points.length)return null;
  const left=clamp(Math.min(...points.map(p=>p.x))),right=clamp(Math.max(...points.map(p=>p.x))),top=clamp(Math.min(...points.map(p=>p.y))),bottom=clamp(Math.max(...points.map(p=>p.y)));
  if(right-left<.005||bottom-top<.005)return null;
  const w=right-left,h=bottom-top,cx=(left+right)/2,cy=clamp((top+bottom)/2+h*.6),rx=clamp(w*.95,.055,.48),ry=clamp(h*1.8,.09,.6);
  return {cx,cy,rx,ry};
 }
 const inside=(f,u,v)=>clamp(1-((u-f.cx)/f.rx)**2-((v-f.cy)/f.ry)**2)*1.8;
 function area(path){let a=0;for(let i=0,j=path.length-1;i<path.length;j=i++)a+=path[j][0]*path[i][1]-path[i][0]*path[j][1];return a/2;}
 function describeRegion(foreground,faces){
  const face=faceRegion(faces),fallback=face||{cx:.5,cy:.48,rx:.28,ry:.40};
  if(foreground&&Paint?.contours){
   const scale=Math.min(1,128/Math.max(foreground.width,foreground.height)),width=Math.max(2,Math.round(foreground.width*scale)),height=Math.max(2,Math.round(foreground.height*scale)),data=new Float32Array(width*height);let coverage=0,x0=width,y0=height,x1=0,y1=0;
   for(let y=0;y<height;y++)for(let x=0;x<width;x++){const v=foreground.at((x+.5)/width,(y+.5)/height);data[y*width+x]=v;coverage+=v;if(v>.45){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}}
   coverage/=data.length;
   if(coverage>.005&&coverage<.97&&x1>x0&&y1>y0){
    const paths=Paint.contours({width,height,data},.45).filter(p=>p.length>=4&&Math.abs(area(p))>.00015).sort((a,b)=>Math.abs(area(b))-Math.abs(area(a))).slice(0,8),points=[],perPath=Math.max(8,Math.floor(232/Math.max(1,paths.length)));
    // Join closed contour loops with doubled bridges. The existing even/odd lasso
    // engine cancels each bridge and retains holes between arms or separate people.
    for(const path of paths){const step=Math.max(1,Math.ceil((path.length-1)/(perPath-1))),loop=path.filter((_,j)=>j%step===0).map(p=>[clamp(p[0]),clamp(p[1])]);if(loop.length<3)continue;if(loop[0][0]!==loop.at(-1)[0]||loop[0][1]!==loop.at(-1)[1])loop.push(loop[0].slice());if(points.length){points.push(loop[0].slice(),...loop.slice(1),points[0].slice());}else points.push(...loop);}
    const strokes=points.length>=4?[{mode:'lasso',size:.01,points}]:[];
    const focus={cx:(x0+x1)/2/width,cy:(y0+y1)/2/height,rx:clamp((x1-x0)/2/width,.025,.7),ry:clamp((y1-y0)/2/height,.025,.7)};
    if(strokes.some(s=>s.mode==='lasso'))return{source:'ai',focus,coverage,p:{adjustRegion:'in',adjustRegionShape:'freehand',adjustRegionX:focus.cx,adjustRegionY:focus.cy,adjustRegionRX:focus.rx,adjustRegionRY:focus.ry,adjustRegionAngle:0,adjustRegionFeather:.36,adjustRegionStrokes:strokes}};
   }
  }
  return {source:face?'face':'estimated',focus:fallback,coverage:clamp(Math.PI*fallback.rx*fallback.ry),p:{adjustRegion:'in',adjustRegionShape:'ellipse',adjustRegionX:fallback.cx,adjustRegionY:fallback.cy,adjustRegionRX:fallback.rx,adjustRegionRY:fallback.ry,adjustRegionAngle:0,adjustRegionFeather:.65}};
 }

 // Portable skin/shadow coverage is derived from the current photo, never a fixed portrait oval.
 function faceLightRegions(data,W,H,skin,hair,foreground,f,p10,p90){
  if(!skin||!Paint?.contours)return{};
  const left=clamp(f.cx-f.rx*1.5),right=clamp(f.cx+f.rx*1.5),top=clamp(f.cy-f.ry*1.6),bottom=clamp(f.cy+f.ry*1.65),fw=right-left,fh=bottom-top;
  if(fw<=0||fh<=0)return{};
  const scale=Math.min(1,128/Math.max(fw*W,fh*H)),width=Math.max(8,Math.round(fw*W*scale)),height=Math.max(8,Math.round(fh*H*scale)),full=new Float32Array(width*height),dark=new Float32Array(width*height),cut=clamp((p10+p90)*.55,.12,.30);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const u=left+(x+.5)/width*fw,v=top+(y+.5)/height*fh,rad=((u-f.cx)/(f.rx*1.5))**2+((v-f.cy)/(f.ry*1.6))**2;if(rad>1)continue;
   const k=(Math.min(H-1,Math.floor(v*H))*W+Math.min(W-1,Math.floor(u*W)))*4,h=hair?.at(u,v)||0,fg=foreground?.at(u,v)??1,sk=skin.at(u,v),weight=fg*Math.max(sk,p90>=.40&&rad<.55&&h<.15?.52:0)*(1-clamp((h-.18)/.42))*data[k+3]/255;
   full[y*width+x]=weight;dark[y*width+x]=weight*clamp((cut+.045-lum(data[k],data[k+1],data[k+2]))/.07);
  }
  function vector(plane,feather){
   const local=describeRegion({width,height,data:plane,at(u,v){return plane[Math.min(height-1,Math.floor(v*height))*width+Math.min(width-1,Math.floor(u*width))];}},[]);
   if(local.source!=='ai'||local.p.adjustRegionShape!=='freehand')return null;
   const q=copy(local.p);q.adjustRegionX=left+q.adjustRegionX*fw;q.adjustRegionY=top+q.adjustRegionY*fh;q.adjustRegionRX=Math.max(.001,q.adjustRegionRX*fw);q.adjustRegionRY=Math.max(.001,q.adjustRegionRY*fh);q.adjustRegionFeather=feather;
   for(const stroke of q.adjustRegionStrokes)for(const point of stroke.points){point[0]=clamp(left+point[0]*fw);point[1]=clamp(top+point[1]*fh);}return q;
  }
  const region=vector(full,.85),shadowRegion=vector(dark,.95);return{...(region?{region}:{}),...(shadowRegion?{shadowRegion}:{})};
 }

 // Convert a bounded semantic plane to the same portable native lasso used by RAY.
 function skinVector(plane,W,H){
  let x0=W,y0=H,x1=0,y1=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(plane[y*W+x]>.45){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}if(x1<=x0||y1<=y0)return null;
  x0=Math.max(0,x0-3);y0=Math.max(0,y0-3);x1=Math.min(W,x1+3);y1=Math.min(H,y1+3);const width=x1-x0,height=y1-y0;
  const local=describeRegion({width,height,at(u,v){return plane[(y0+Math.min(height-1,Math.floor(v*height)))*W+x0+Math.min(width-1,Math.floor(u*width))];}},[]);if(local.source!=='ai')return null;
  const q=copy(local.p),left=x0/W,top=y0/H,fw=width/W,fh=height/H;q.adjustRegionX=left+q.adjustRegionX*fw;q.adjustRegionY=top+q.adjustRegionY*fh;q.adjustRegionRX=Math.max(.001,q.adjustRegionRX*fw);q.adjustRegionRY=Math.max(.001,q.adjustRegionRY*fh);q.adjustRegionFeather=.36;
  for(const stroke of q.adjustRegionStrokes||[])for(const point of stroke.points){point[0]=clamp(left+point[0]*fw);point[1]=clamp(top+point[1]*fh);}return q;
 }
 function extraSkinAnalysis(data,W,H,skin,hair,foreground,face){
  if(!skin||!foreground||!Paint?.raster)return null;
  const scale=Math.min(1,384/Math.max(W,H)),width=Math.max(2,Math.round(W*scale)),height=Math.max(2,Math.round(H*scale)),plane=new Float32Array(width*height),hist=new Float64Array(256),channels=new Float64Array(256),residual=[];
  const mask=face.region?.adjustRegionStrokes?Paint.raster(face.region.adjustRegionStrokes,width,height,{cap:384,feather:face.region.adjustRegionFeather}):null,f=face.focus;let n=0,sum=0,warm=0,tint=0,texture=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const u=(x+.5)/width,v=(y+.5)/height;if(((u-f.cx)/(f.rx*1.25))**2+((v-f.cy)/(f.ry*1.25))**2<=1)continue;const faceWeight=mask?mask.at(u,v):clamp(inside(f,u,v)),weight=skin.at(u,v)*foreground.at(u,v)*(1-faceWeight)*(1-clamp(((hair?.at(u,v)||0)-.18)/.42));if(weight<.02)continue;
   const xx=Math.min(W-2,Math.max(1,Math.floor(u*W))),yy=Math.min(H-2,Math.max(1,Math.floor(v*H))),i=(yy*W+xx)*4,w=weight*data[i+3]/255;if(w<.02)continue;plane[y*width+x]=w;
   const r=data[i],g=data[i+1],b=data[i+2],l=lum(r,g,b),at=k=>lum(data[k],data[k+1],data[k+2]),left=at(i-4),right=at(i+4),up=at(i-W*4),down=at(i+W*4);n+=w;sum+=l*w;hist[Math.round(l*255)]+=w;channels[Math.max(r,g,b)]+=w;warm+=(r-b)/255*w;tint+=((r+b)/2-g)/255*w;texture+=(Math.abs(right-left)+Math.abs(down-up))*.5*w;if(w>.5)residual.push(Math.abs(l-(left+right+up+down)/4));
  }
  const region=skinVector(plane,width,height);if(n<12||!region)return null;const percentile=(q,h=hist)=>{let total=0;for(let j=0;j<256;j++){total+=h[j];if(total>=n*q)return j/255;}return 1;};residual.sort((a,b)=>a-b);
  return{focus:{cx:region.adjustRegionX,cy:region.adjustRegionY,rx:region.adjustRegionRX,ry:region.adjustRegionRY},region,mean:sum/n,p10:percentile(.1),p90:percentile(.9),channelP95:percentile(.95,channels),noise:clamp((residual[Math.floor(residual.length*.5)]||0)*.8),texture:clamp(texture/n),warmCast:clamp(warm/n,-1,1),tintCast:clamp(tint/n,-1,1),confidence:.9};
 }
 function diffuseShadeStrength(r,a){
  const gap=Number(a.backgroundBrightness)-r.mean,span=r.p90-r.p10;if(r.confidence<=.7||r.mean<.14||r.mean>=.34||r.p90>=.44||span>=.32||gap<=.15)return 0;
  const t=Math.min(clamp((r.mean-.14)/.04),clamp((.34-r.mean)/.03),clamp((.44-r.p90)/.03),clamp((.32-span)/.04),clamp((gap-.15)/.05));return t*t*(3-2*t);
 }
 function needsPersonRefinement(a){return(a?.recovery?.faces||[]).some(r=>r.confidence>.7&&(r.mean<.22&&r.p90<.4&&Number(a.backgroundBrightness)-r.mean>.10||diffuseShadeStrength(r,a)>0));}

 function recoveryZone(data,W,H,foreground,region,faces,background=false,exclude=null){
  const hist=new Float64Array(256),residual=[];let n=0,sum=0,shadow=0,highlight=0,texture=0,neutral=0,warm=0,tint=0,darkSum=0,chromaSum=0;
  const step=Math.max(1,Math.ceil(Math.sqrt(W*H/160000)));
  for(let y=1;y<H-1;y+=step)for(let x=1;x<W-1;x+=step){const u=(x+.5)/W,v=(y+.5)/H,fg=foreground?foreground.at(u,v):clamp(inside(region.focus,u,v)),i=(y*W+x)*4;let w=(background?1-fg:fg)*data[i+3]/255;if(!background)for(const face of faces){const f=face.focus;if(((u-f.cx)/(f.rx*1.1))**2+((v-f.cy)/(f.ry*1.1))**2<1){w=0;break;}}if(exclude)w*=1-exclude.at(u,v);if(w<.02)continue;
   const r=data[i],g=data[i+1],b=data[i+2],l=lum(r,g,b),at=k=>lum(data[k],data[k+1],data[k+2]),left=at(i-4),right=at(i+4),up=at(i-W*4),down=at(i+W*4);n+=w;sum+=l*w;hist[Math.round(l*255)]+=w;shadow+=(l<.35?w:0);highlight+=(l>.85?w:0);texture+=(Math.abs(right-left)+Math.abs(down-up))*.5*w;if(w>.5)residual.push(Math.abs(l-(left+right+up+down)/4));
   const mx=Math.max(r,g,b),mn=Math.min(r,g,b);darkSum+=mn/255*w;chromaSum+=(mx-mn)/255*w;if(l>.22&&l<.88&&mx<245&&(mx-mn)/Math.max(1,mx)<.13){neutral+=w;warm+=(r-b)/255*w;tint+=((r+b)/2-g)/255*w;}
  }
  const percentile=q=>{let total=0;for(let i=0;i<256;i++){total+=hist[i];if(total>=n*q)return i/255;}return 0;};residual.sort((a,b)=>a-b);
  return {mean:n?clamp(sum/n):0,p10:n?percentile(.1):0,p90:n?percentile(.9):0,shadowCoverage:n?clamp(shadow/n):0,highlightCoverage:n?clamp(highlight/n):0,texture:n?clamp(texture/n):0,noise:clamp((residual[Math.floor(residual.length*.5)]||0)*.8),neutralCoverage:n?clamp(neutral/n):0,neutralWarmCast:neutral?clamp(warm/neutral,-1,1):0,neutralTintCast:neutral?clamp(tint/neutral,-1,1):0,darkMean:n?clamp(darkSum/n):0,chroma:n?clamp(chromaSum/n):0};
 }
 function recoveryAnalysis(data,W,H,faces,skin,foreground,region,hair,personGuided=false){
  const boxes=[];
  for(const face of (faces||[])){const pts=Array.isArray(face)?face.filter(p=>finite(p?.x)&&finite(p?.y)):[];if(pts.length<4)continue;const x0=clamp(Math.min(...pts.map(p=>p.x))),x1=clamp(Math.max(...pts.map(p=>p.x))),y0=clamp(Math.min(...pts.map(p=>p.y))),y1=clamp(Math.max(...pts.map(p=>p.y)));if(x1-x0<.008||y1-y0<.008)continue;boxes.push({focus:{cx:(x0+x1)/2,cy:(y0+y1)/2,rx:clamp((x1-x0)*.58,.008,.5),ry:clamp((y1-y0)*.58,.008,.5)},confidence:.95});}
  if(!boxes.length&&skin&&foreground&&Paint?.contours){const width=Math.min(128,skin.width),height=Math.max(2,Math.round(width*skin.height/skin.width)),plane=new Float32Array(width*height);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const u=(x+.5)/width,v=(y+.5)/height;plane[y*width+x]=skin.at(u,v)*foreground.at(u,v);}for(const path of Paint.contours({width,height,data:plane},.45)){if(path.length<4)continue;const x0=Math.min(...path.map(p=>p[0])),x1=Math.max(...path.map(p=>p[0])),y0=Math.min(...path.map(p=>p[1])),y1=Math.max(...path.map(p=>p[1])),w=x1-x0,h=y1-y0;if(w*h<.0003||w*h>.20||w/h<.3||w/h>2||(y0+y1)/2>region.focus.cy-region.focus.ry*.12)continue;let hairWeight=0,nearby=0;if(hair)for(let y=Math.max(0,Math.floor((y0-h*.55)*height));y<Math.min(height,Math.ceil((y1+h*.35)*height));y++)for(let x=Math.max(0,Math.floor((x0-w*.45)*width));x<Math.min(width,Math.ceil((x1+w*.45)*width));x++){const u=(x+.5)/width,v=(y+.5)/height;if(u>x0&&u<x1&&v>y0&&v<y1)continue;nearby++;hairWeight+=hair.at(u,v)*foreground.at(u,v);}const headShape=w/h>.45&&w/h<1.55,corroborated=headShape&&nearby&&hairWeight/nearby>.16;boxes.push({focus:{cx:(x0+x1)/2,cy:(y0+y1)/2,rx:clamp(w*.57,.008,.5),ry:clamp(h*.57,.008,.5)},confidence:corroborated?.80:.45});}}
  boxes.sort((a,b)=>b.focus.rx*b.focus.ry-a.focus.rx*a.focus.ry);const measured=[];
  for(const box of boxes){if(measured.some(v=>Math.hypot(v.focus.cx-box.focus.cx,v.focus.cy-box.focus.cy)<Math.min(v.focus.rx,box.focus.rx)))continue;const f=box.focus,hist=new Float64Array(256),channels=new Float64Array(256),residual=[],weights=[];let n=0,sum=0,warm=0,tint=0,texture=0,nt=0;
   for(let y=Math.max(1,Math.floor((f.cy-f.ry)*H));y<Math.min(H-1,Math.ceil((f.cy+f.ry)*H));y++)for(let x=Math.max(1,Math.floor((f.cx-f.rx)*W));x<Math.min(W-1,Math.ceil((f.cx+f.ry)*W));x++){const u=(x+.5)/W,v=(y+.5)/H,radius=((u-f.cx)/f.rx)**2+((v-f.cy)/f.ry)**2;if(radius>.85)continue;const i=(y*W+x)*4,a=data[i+3]/255;if(a<.1)continue;const w=a*(skin?Math.max(.15,skin.at(u,v)):1)*(foreground?Math.max(.1,foreground.at(u,v)):1),r=data[i],g=data[i+1],b=data[i+2],l=lum(r,g,b),at=k=>lum(data[k],data[k+1],data[k+2]),left=at(i-4),right=at(i+4),up=at(i-W*4),down=at(i+W*4);sum+=l*w;n+=w;hist[Math.round(l*255)]+=w;channels[Math.max(r,g,b)]+=w;warm+=(r-b)/255*w;tint+=((r+b)/2-g)/255*w;texture+=(Math.abs(right-left)+Math.abs(down-up))*.5*w;nt+=w;residual.push(Math.abs(l-(left+right+up+down)/4));}
   if(n<3)continue;const percentile=(q,h=hist)=>{let total=0;for(let j=0;j<256;j++){total+=h[j];if(total>=n*q)return j/255;}return 1;};residual.sort((a,b)=>a-b);const record={focus:f,mean:sum/n,p10:percentile(.1),p90:percentile(.9),channelP95:percentile(.95,channels),texture:clamp(texture/(nt||1)),noise:clamp((residual[Math.floor(residual.length*.5)]||0)*.8),warmCast:clamp(warm/n,-1,1),tintCast:clamp(tint/n,-1,1),confidence:box.confidence};Object.assign(record,faceLightRegions(data,W,H,skin,hair,foreground,f,record.p10,record.p90));measured.push(record);if(measured.length===3)break;
  }
  const zones={subject:recoveryZone(data,W,H,foreground,region,measured),background:recoveryZone(data,W,H,foreground,region,measured,true)};
  if(personGuided&&faces?.length===1&&measured.length===1&&measured[0].confidence>.7&&skin&&foreground){const extra=extraSkinAnalysis(data,W,H,skin,hair,foreground,measured[0]);if(extra)measured[0].extraSkin=extra;zones.clothing=recoveryZone(data,W,H,foreground,region,measured,false,{at(u,v){return Math.max(skin.at(u,v),hair?.at(u,v)||0);}});}
  return {version:1,faces:measured,zones};
 }
 const linear=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
 const rescueStyle=style=>style==='backlight'||style==='restore-detail'||style==='film-recovery';
 function analyze(data,W,H,{maps=null,faces=[],detail=null}={}){
  if(!Number.isInteger(W)||!Number.isInteger(H)||W<1||H<1||!data||data.length!==W*H*4)throw Error('Ảnh phân tích không hợp lệ.');
  const foreground=normalizedPlane(maps,'foreground'),skin=normalizedPlane(maps,'skin'),region=describeRegion(foreground,faces),histogram=new Array(256).fill(0),hue=new Array(12).fill(0),step=Math.max(1,Math.ceil(Math.sqrt(W*H/120000)));
  let count=0,sum=0,shadows=0,highlights=0,clippedHighlights=0,clippedShadows=0,skinWeight=0,skinL=0,skinWarm=0,subjectWeight=0,subjectL=0,bgWeight=0,bgL=0,chroma=0,warm=0,tint=0,texture=0,textureN=0,brightX=0,brightY=0,brightW=0,hash=2166136261;
  for(let y=0;y<H;y+=step)for(let x=0;x<W;x+=step){const i=(y*W+x)*4,a=clamp(data[i+3]/255);if(a<.02)continue;const r=data[i],g=data[i+1],b=data[i+2],l=lum(r,g,b),u=(x+.5)/W,v=(y+.5)/H,max=Math.max(r,g,b),min=Math.min(r,g,b),c=(max-min)/255;
   histogram[Math.round(l*255)]+=a;count+=a;sum+=l*a;shadows+=(l<.15?a:0);highlights+=(l>.85?a:0);clippedHighlights+=(Math.max(r,g,b)>=250&&l>.78?a:0);clippedShadows+=(max<=8?a:0);chroma+=c*a;warm+=(r-b)/255*a;tint+=((r+b)/2-g)/255*a;
   const cb=128-.168736*r-.331264*g+.5*b,cr=128+.5*r-.418688*g-.081312*b,heuristic=r>40&&r>g*.9&&r>b*1.05&&cb>76&&cb<128&&cr>132&&cr<178?Math.min(1,(cr-128)/35):0,s=skin?skin.at(u,v):heuristic;
   skinWeight+=s*a;skinL+=l*s*a;skinWarm+=(r-b)/255*s*a;
   const subject=foreground?foreground.at(u,v):clamp(inside(region.focus,u,v));subjectWeight+=subject*a;subjectL+=l*subject*a;bgWeight+=(1-subject)*a;bgL+=l*(1-subject)*a;
   const bright=l*l*l*(1-s*.6)*a;brightX+=u*bright;brightY+=v*bright;brightW+=bright;
   if(x>=step){texture+=Math.abs(l-lum(data[i-step*4],data[i-step*4+1],data[i-step*4+2]))*a;textureN+=a;}
   if(c>.02){let h=max===r?((g-b)/(max-min)+6)%6:max===g?(b-r)/(max-min)+2:(r-g)/(max-min)+4;hue[Math.min(11,Math.floor(h*2))]+=c*a;}
   hash=Math.imul(hash^r,16777619);hash=Math.imul(hash^g,16777619);hash=Math.imul(hash^b,16777619);hash=Math.imul(hash^Math.round(a*255),16777619);
  }
  const percentile=q=>{if(!count)return 0;let cumulative=0;for(let i=0;i<256;i++){cumulative+=histogram[i];if(cumulative>=count*q)return i/255;}return 1;},mean=count?sum/count:0,p10=percentile(.1),p50=percentile(.5),p95=percentile(.95),p99=percentile(.99),dynamicRange=clamp(p95-p10),lightX=brightW?brightX/brightW:.5,lightY=brightW?brightY/brightW:.08,confidence=clamp(dynamicRange*1.2)*clamp(Math.hypot(lightX-.5,lightY-.5)*3);
  const result={version:1,width:W,height:H,fingerprint:((hash^W^Math.imul(H,31))>>>0).toString(16).padStart(8,'0'),histogram,mean,median:p50,p10,p50,p95,p99,shadows:count?shadows/count:0,highlights:count?highlights/count:0,clippedHighlights:count?clippedHighlights/count:0,clippedShadows:count?clippedShadows/count:0,colorfulness:count?chroma/count:0,warmCast:count?clamp(warm/count,-1,1):0,tintCast:count?clamp(tint/count,-1,1):0,skinCoverage:count?skinWeight/count:0,skinLuma:skinWeight?skinL/skinWeight:mean,skinWarmth:skinWeight?clamp(skinWarm/skinWeight,-1,1):0,texture:textureN?clamp(texture/textureN):0,dynamicRange,subjectCoverage:count?subjectWeight/count:0,subjectBrightness:subjectWeight?subjectL/subjectWeight:mean,backgroundBrightness:bgWeight?bgL/bgWeight:mean,recognition:region.source,region,light:{x:lightX,y:lightY,angle:Math.atan2(.5-lightY,.5-lightX)*180/Math.PI,confidence},dominantHue:hue.indexOf(Math.max(...hue))/12,empty:!count};
  const d=detail?.data&&Number.isInteger(detail.width)&&Number.isInteger(detail.height)&&detail.data.length===detail.width*detail.height*4?detail:{data,width:W,height:H};result.recovery=recoveryAnalysis(d.data,d.width,d.height,faces,skin,foreground,region,normalizedPlane(maps,'hair'),maps?.personGuided===true);if(maps?.personGuided===true)result.recovery.personGuided=true;
  result.palette=Regions?.analyze(data,W,H,{foreground,skin,hair:normalizedPlane(maps,'hair'),faces:result.recovery.faces,region})||{version:1,sky:null,land:null};return result;
 }
 const INTENTS={
  'film-recovery':{temp:.06,tint:-.06,contrast:.16,sat:.26,lift:.02,grain:.015,glow:0,depth:.06,mood:0},
  'restore-detail':{temp:.015,tint:.01,contrast:.01,sat:.015,lift:.01,grain:0,glow:0,depth:.015,mood:0},
  backlight:{temp:.015,tint:.01,contrast:.01,sat:.015,lift:.01,grain:.005,glow:0,depth:.015,mood:0},
  'auto-beauty':{temp:.05,tint:.035,contrast:.04,sat:.035,lift:.035,grain:.018,glow:.045,depth:.05,mood:0},natural:{temp:.015,tint:.015,contrast:.025,sat:.02,lift:.015,grain:.012,glow:.025,depth:.035,mood:0},cinematic:{temp:-.07,tint:.01,contrast:.21,sat:-.12,lift:.045,grain:.065,glow:.035,depth:.15,mood:-.045},'golden-hour':{temp:.26,tint:.025,contrast:.055,sat:.035,lift:.06,grain:.035,glow:.10,depth:.085,mood:.035},'vintage-film':{temp:.15,tint:.035,contrast:-.03,sat:-.09,lift:.12,grain:.14,glow:.075,depth:.07,mood:.01},editorial:{temp:-.015,tint:.015,contrast:.20,sat:-.045,lift:.015,grain:.025,glow:.02,depth:.11,mood:-.01},'soft-dream':{temp:.04,tint:.045,contrast:-.12,sat:-.055,lift:.09,grain:.02,glow:.13,depth:.045,mood:.035},moody:{temp:-.10,tint:.005,contrast:.19,sat:-.17,lift:.045,grain:.07,glow:.02,depth:.18,mood:-.085},creative:{temp:.04,tint:.02,contrast:.12,sat:.04,lift:.055,grain:.075,glow:.06,depth:.12,mood:0}
 };
 function rng(seed){let n=seed>>>0;return()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
 function clean(p){const out={};for(const [key,value]of Object.entries(p||{})){const range=NUM[key]||OPTIONAL[key];if(range&&finite(value))out[key]=+clamp(value,...range).toFixed(5);else if(key==='seed')out.seed=Number(value)>>>0;else if(['adjustRegion','adjustRegionShape','sparkMode','leakShape','toneLocalMode','toneLocalShape','toneLocalFill','toneLocalColor'].includes(key)&&typeof value==='string')out[key]=value;else if(['nangManual','leakManual','toneLocalEnabled','toneLocalShow'].includes(key)&&typeof value==='boolean')out[key]=value;else if(key==='adjustRegionStrokes'||key==='adjustRegionStack')out[key]=copy(value);}return out;}
 const summary=a=>({...Object.fromEntries(['mean','median','p10','p50','p95','p99','shadows','highlights','clippedHighlights','clippedShadows','skinCoverage','skinLuma','skinWarmth','subjectCoverage','subjectBrightness','backgroundBrightness','texture','colorfulness','warmCast','tintCast','dynamicRange','dominantHue','recognition','fingerprint'].map(k=>[k,a[k]])),lightX:a.light.x,lightY:a.light.y,lightConfidence:a.light.confidence});
 function scaledParams(p,amount){const out=copy(p||{});for(const k of EFFECTS)if(finite(out[k]))out[k]=+(out[k]*amount).toFixed(6);return out;}
 function presetScore(r,t,a){const p=r.p||{},dist=Math.abs((p.temp||0)-t.temp)*1.6+Math.abs((p.tint||0)-t.tint)*1.25+Math.abs((p.contrast||0)-t.contrast)*1.3+Math.abs((p.sat||0)-t.sat)+Math.abs((p.lift||0)-t.lift)*.5;const optics=(p.grain||0)*.3+(p.ca||0)*.8+(p.flash||0)*.8+(p.leak||0)*.35;return dist+optics*(.5+a.skinCoverage)+(p.sat<=-.7&&a.skinCoverage>.04?.7:0)+(p.contrast||0)*a.dynamicRange*.18+(r.id==='goc'?.035:0);}
 function makeComponent(id,title,role,p,region,light,reason){const focus=copy(region?.focus||{cx:.5,cy:.5,rx:.32,ry:.4}),sun={x:clamp(light?.x??.5),y:clamp(light?.y??.08)},leak=copy(sun),component={id,title,role,enabled:true,p:clean(p),focus,sun,leak,reason,targetIntent:{role,adaptive:true,regionSource:region?.source||'all'}};if(component.p.nang>.001)component.p.nangManual=true;if(component.p.leak>.001)component.p.leakManual=true;component.targetIntent.baseline={p:copy(component.p),focus:copy(focus),sun:copy(sun),leak:copy(leak)};return component;}
 function relightPeople(plan,a,variant){
  if(a.recovery)plan.analysis.recovery={...copy(a.recovery),personLightVersion:1};
  // Deep backlight is a separate measured condition, not a larger fixed fill.
  // Leave the mixed sun/shadow curve intact when either face metric is brighter.
  const severity=r=>{if(r.confidence<=.7)return 0;const t=Math.min(clamp((.22-r.mean)/.14),clamp((.40-r.p90)/.24));return t*t*(3-2*t);};
  const records=a.recovery?.faces||[],active=records.map((r,index)=>({r,index,severe:severity(r),diffuse:diffuseShadeStrength(r,a)})).filter(({r})=>r.mean<.46||r.p10<.15&&r.p90-r.p10>.25);if(!active.length){plan.components=plan.components.filter(c=>!c.id.startsWith('face-'));return plan;}
  const rescue=rescueStyle(plan.style),extraRecords=active.filter(v=>(v.diffuse>0||v.severe>0)&&v.r.extraSkin),excluded=active.map(({r})=>r.region?{...copy(r.region),adjustRegion:'out'}:{adjustRegion:'out',adjustRegionShape:'ellipse',adjustRegionX:r.focus.cx,adjustRegionY:r.focus.cy,adjustRegionRX:r.focus.rx*1.12,adjustRegionRY:r.focus.ry*1.12,adjustRegionAngle:0,adjustRegionFeather:.25}),zone=a.recovery?.zones?.subject;
  for(const {r}of extraRecords)excluded.push({...copy(r.extraSkin.region),adjustRegion:'out'});
  const clothing=a.recovery?.zones?.clothing,diffuse=Math.max(...active.map(v=>v.diffuse)),coat=rescue&&a.recovery?.personGuided===true&&clothing&&clothing.mean>.07&&clothing.p90<.32&&clothing.highlightCoverage<.004&&clothing.mean<Math.max(...active.map(v=>v.r.mean))*.65?diffuse:0;
  const whiteAnchor=zone?Math.max(clamp((zone.highlightCoverage-.004)/.025),clamp((zone.p90-.67)/.16)):0,severe=Math.max(...active.map(r=>r.severe)),bodySeverity=rescue&&a.region.source==='ai'&&a.recovery?.personGuided===true&&zone&&whiteAnchor===0?severe*Math.min(clamp((.20-zone.mean)/.12),clamp((.40-zone.p90)/.24)):0,bodyNoise=zone?clamp(1-zone.noise/Math.max(.025,zone.mean)*3,.35,1):1,bodyEV=bodySeverity?Math.min(.25,clamp(Math.log2(linear(.20)/Math.max(.0008,linear(zone.mean)))*.75,0,1.4)*clamp(bodySeverity*2.5)*bodyNoise):0;
  const background=a.recovery?.zones?.background,dusk=rescue&&background?severe*Math.min(clamp((.11-background.p10)/.08),clamp((background.shadowCoverage-.30)/.20)):0;
  for(const component of plan.components){
   if(severe>0&&rescue&&component.id==='balance'&&finite(component.p.toneExposure))component.p.toneExposure*=1-severe;
   if(component.id==='subject'){
    component.p.adjustRegionStack=[...(component.p.adjustRegionStack||[]),...copy(excluded)];
    if(rescue)for(const key of ['filmExp','toneShadows','toneBrightness'])if(finite(component.p[key]))component.p[key]*=1-whiteAnchor;
    if(coat>0){for(const key of ['filmExp','toneShadows','toneBrightness'])if(finite(component.p[key]))component.p[key]*=1-coat;component.p.contrast=clamp((component.p.contrast||0)+clamp((.32-(clothing.p90-clothing.p10))*.85,.08,.28)*coat,-1,1);component.p.toneBlacks=clamp((component.p.toneBlacks||0)-clamp((clothing.p10-.045)*.45,0,.035)*coat,-1,1);}
    if(bodyEV>0){component.p.toneExposure=clamp((component.p.toneExposure||0)+bodyEV,0,2);if(finite(component.p.filmExp))component.p.filmExp*=1-clamp(bodySeverity*3);for(const key of ['toneShadows','toneBrightness'])if(finite(component.p[key]))component.p[key]*=1-clamp(bodySeverity*3);}
   }
   if(rescue&&component.id==='light'&&finite(component.p.toneLocalEV))component.p.toneLocalEV*=(1-whiteAnchor)*(1-Math.max(severe,coat));
   if(extraRecords.length&&['subject-color','film-subject'].includes(component.id))component.p.adjustRegionStack=[...(component.p.adjustRegionStack||[]),...extraRecords.map(({r})=>({...copy(r.extraSkin.region),adjustRegion:'out'}))];
   if(component.id==='texture'||component.id==='clarity')component.p.adjustRegionStack=[...(component.p.adjustRegionStack||[]),...copy(excluded)];
   if(bodyEV>0&&component.id==='texture')for(const key of ['sharp','printClear','detail'])if(finite(component.p[key]))component.p[key]*=clamp(1-bodyEV*.28,.3,1)*bodyNoise;
   if(bodyEV>0&&component.id==='clarity')component.p.adjustRegionStack.push({...copy(a.region.p),adjustRegion:'out'});
   if(severe>0&&rescue&&component.id==='depth'&&finite(component.p.dehaze)){component.p.dehaze=Math.min(component.p.dehaze,.35+.25*(1-severe))*(1-dusk)**2;if(dusk>0)for(const key of ['sat','contrast','toneShadows','toneBlacks'])if(finite(component.p[key]))component.p[key]*=1-dusk;}
   if(severe>0&&rescue&&component.id==='clarity'&&finite(component.p.detail))component.p.detail*=(1-dusk*.65)/(1+severe*2);
  }
  const globalEV=plan.components.reduce((sum,c)=>sum+(!c.p.adjustRegion||c.p.adjustRegion==='all'?Number(c.p.toneExposure)||0:0),0),faces=[];
  for(const {r,index,severe,diffuse}of active){
   const deepBlend=clamp(severe*2.5);
   const reliable=r.confidence>.7,noise=clamp(1-r.noise*5,.6,1),target=reliable?clamp(r.p90+.08,.48,.58):.38,need=Math.max(0,Math.log2(linear(target)/Math.max(.0008,linear(r.mean)))),channel=r.channelP95??clamp(r.p90+Math.abs(r.warmCast)*.5),rawHeadroom=Math.max(0,Math.log2(linear(.90)/Math.max(.0008,linear(channel)))-Math.max(0,globalEV)),headroom=clamp(rawHeadroom,0,1),normalEV=clamp(need*.40,0,reliable?headroom*.45:.22),normalFilm=clamp((target-r.mean)*4.3,0,reliable?.92:.22)*noise,deepTarget=clamp(.32+((background?.mean??a.backgroundBrightness)-.4)*.25,.30,.40),deepNeed=Math.max(0,Math.log2(linear(deepTarget)/Math.max(.0008,linear(r.mean)))),deepSignal=clamp(1-r.noise/Math.max(.025,r.mean)*2,.65,1),deepTotal=clamp(deepNeed+.10,0,Math.min(4,Math.max(0,rawHeadroom-.18)))*deepSignal,baseEV=severe?normalEV*(1-deepBlend)+Math.min(2,deepTotal)*deepBlend:normalEV,baseFilm=severe?normalFilm*(1-clamp(deepBlend*1.4)):normalFilm,shadeTarget=Math.min(.44,r.mean+clamp((a.backgroundBrightness-r.mean)*(.35+clamp((.27-r.mean)*1.5,0,.20)),.06,.14+clamp((.27-r.mean)*1.4,0,.14))),shadeNeed=Math.max(0,Math.log2(linear(shadeTarget)/Math.max(.0008,linear(r.mean)))),shadeContrast=clamp((.38-(r.p90-r.p10))*1.45,.06,.24)*noise,ev=baseEV*(1-diffuse)+clamp(shadeNeed+shadeContrast*.15,0,Math.min(2,Math.max(0,rawHeadroom-.05)))*diffuse,film=baseFilm*(1-diffuse)+clamp((shadeTarget-r.mean)*.35,0,.05)*noise*diffuse;
   const f=copy(r.focus),region=copy(r.region||{adjustRegion:'in',adjustRegionShape:'ellipse',adjustRegionX:f.cx,adjustRegionY:f.cy,adjustRegionRX:f.rx,adjustRegionRY:f.ry,adjustRegionAngle:0,adjustRegionFeather:.55}),p={...region,adjustRegionStack:a.region.source==='ai'?[copy(a.region.p)]:[],toneExposure:ev,filmExp:film,toneShadows:0,toneBrightness:0,sat:-clamp((r.warmCast-.10)*.8,0,.10),toneHighlights:-clamp((channel-.55)*.35,0,.12),toneWhites:-clamp((channel-.75)*.12,0,.025)};
   const profile=Math.max(deepBlend,diffuse),fitFeather=clamp(Math.min(f.rx*a.width,f.ry*a.height)/Math.min(a.width,a.height)*5,.22,.5);if(profile>0){region.adjustRegionFeather=(region.adjustRegionFeather??.55)*(1-profile)+fitFeather*profile;p.adjustRegionFeather=region.adjustRegionFeather;}
   if(diffuse>0){p.contrast=shadeContrast*diffuse;p.temp=clamp((.16-r.warmCast)*.4,-.04,.04)*diffuse;p.tint=clamp(-r.tintCast*.25,-.025,.025)*diffuse;}
   if(severe>0){const green=clamp(-r.tintCast/Math.max(.04,r.mean),-.20,.20),amount=severe*(1-diffuse);p.temp=(p.temp||0)+clamp(green*1.5,-.12,.30)*amount;p.tint=(p.tint||0)+clamp(green*2.8,-.25,.50)*amount;p.contrast=clamp((p.contrast||0)+.08*amount*deepSignal,0,.30);p.toneBlacks=-.004*amount;}
   // The native per-channel film curve opens skin without a large luma gain
   // that would clip warm channels and create gray/red plateaus.
   faces.push(makeComponent('face-'+index,'Ánh sáng khuôn mặt '+(index+1),'skin',p,{focus:f,source:reliable?'face':'ai'},a.light,'Bù sáng bằng phơi sáng có giới hạn màu và đường cong phim RAY trên vùng da đã nhận diện; giữ áo, tóc và cảnh bên ngoài.'));
   const shadowRequest=reliable?(clamp((clamp(target*.60,.24,.34)-r.p10)*5.5,0,1.25)*(1-deepBlend)+Math.min(2,Math.max(0,deepTotal-ev))*deepBlend)*noise:0,shadowEV=(severe>0?Math.min(shadowRequest,Math.max(0,rawHeadroom-ev-.12*severe)):shadowRequest)*(1-diffuse);
   if(r.shadowRegion&&shadowEV>.015){const shadow={...copy(r.shadowRegion),...(profile>0?{adjustRegionFeather:r.shadowRegion.adjustRegionFeather*(1-profile)+Math.min(.5,fitFeather*1.1)*profile}:{}),adjustRegionStack:[copy(region),...(a.region.source==='ai'?[copy(a.region.p)]:[])],toneExposure:shadowEV,toneHighlights:-.06};faces.push(makeComponent('face-shadow-'+index,'Bóng trên mặt '+(index+1),'skin',shadow,{focus:f,source:'face'},a.light,'Mở thêm phần da trong bóng tay hoặc tóc bằng vùng bóng đo từ ảnh; không tăng sáng da và quần áo đã sáng.'));}
  }
  for(const {r,index,diffuse}of extraRecords){
   const e=r.extraSkin;if(e.mean>=.40&&e.p10>=.20)continue;
   const target=Math.min(.44,e.mean+clamp((a.backgroundBrightness-e.mean)*.30,.04,.12)),headroom=Math.max(0,Math.log2(linear(.90)/Math.max(.0008,linear(e.channelP95)))-Math.max(0,globalEV)-.08),noise=clamp(1-e.noise/Math.max(.025,e.mean)*2.5,.35,1),ev=clamp(Math.log2(linear(target)/Math.max(.0008,linear(e.mean))),0,Math.min(2,headroom))*noise;
   if(ev<.015)continue;const faceRegion=copy(r.region||{adjustRegion:'in',adjustRegionShape:'ellipse',adjustRegionX:r.focus.cx,adjustRegionY:r.focus.cy,adjustRegionRX:r.focus.rx,adjustRegionRY:r.focus.ry,adjustRegionFeather:.55});const profile=Math.max(diffuse,severity(r));if(profile>0)faceRegion.adjustRegionFeather=faceRegion.adjustRegionFeather*(1-profile)+clamp(Math.min(r.focus.rx*a.width,r.focus.ry*a.height)/Math.min(a.width,a.height)*5,.22,.5)*profile;const p={...copy(e.region),adjustRegionStack:[{...faceRegion,adjustRegion:'out'},copy(a.region.p)],toneExposure:ev,filmExp:clamp((target-e.mean)*.18,0,.025)*noise,contrast:clamp((.38-(e.p90-e.p10))*.8,0,.16)*noise,toneHighlights:-clamp((e.channelP95-.65)*.25,0,.10)};
   faces.push(makeComponent('face-extra-'+index,'Da cổ và tay '+(index+1),'skin',p,{focus:copy(e.focus),source:'ai'},a.light,'Đo sáng riêng phần da ngoài mặt trong người đã chọn; giữ nguyên da đã sáng và tách khỏi áo/tóc.'));
  }
  const finish=plan.components.filter(c=>c.id==='clarity'||c.id==='texture');plan.components=plan.components.filter(c=>!c.id.startsWith('face-')&&c.id!=='clarity'&&c.id!=='texture');plan.components.push(...faces,...finish);
  for(const c of plan.components){c.p=clean(c.p);c.targetIntent.baseline={p:copy(c.p),focus:copy(c.focus),sun:copy(c.sun),leak:copy(c.leak)};}return plan;
 }
 const MIX_KEYS=['temp','tint','split','contrast','sat','lift'];
 function mixParameters(mix){
  const result=Object.fromEntries(MIX_KEYS.map(k=>[k,0])),sources=Array.isArray(mix?.sources)?mix.sources.slice(0,3):[],total=sources.reduce((n,s)=>n+clamp(s.weight),0),strength=clamp(mix?.strength);
  if(total<=0||strength<=0)return result;
  for(const key of MIX_KEYS)result[key]=+clamp(sources.reduce((n,s)=>n+clamp(finite(s.p?.[key])?s.p[key]:0,...NUM[key])*clamp(s.weight)/total,0)*strength,...NUM[key]).toFixed(6);
  return result;
 }
 const PALETTE_INTENTS={
  'auto-beauty':{name:'Xanh lam trong',sky:['#8bbcff',.44,.035,.11,.10,.17,.11,0],land:['#f5d5b6',.28,.11,.045,.08,.12,.08,0],light:'#ffe8d0'},
  natural:{name:'Lam ngọc & xanh lá',sky:['#8fe8ef',.49,-.16,-.14,.12,.20,.12,0],land:['#8de8b5',.38,-.07,-.13,.08,.18,.11,0],light:'#fff1df'},
  cinematic:{name:'Teal & hổ phách',sky:['#63d0bd',.64,-.23,-.22,.34,.08,.21,-.035],land:['#edb77c',.46,.24,.06,.25,-.025,.18,0],light:'#ffd6aa'},
  'golden-hour':{name:'Hổ phách & olive',sky:['#ffd092',.58,.44,.085,.10,.16,.095,0],land:['#d8b46e',.44,.25,-.09,.16,.12,.13,0],light:'#ffd292'},
  'vintage-film':{name:'Champagne & rêu bạc',sky:['#dfd0a1',.47,.22,-.075,.18,-.18,-.045,.045],land:['#8cbfa2',.60,-.15,-.20,.29,-.07,.12,.045],light:'#f5d9b1'},
  editorial:{name:'Xanh thép & sage',sky:['#b8c5ff',.56,-.235,.18,-.10,.035,.24,-.015],land:['#b5d2cb',.35,-.13,.075,-.04,-.08,.22,0],light:'#ffe7d4'},
  'soft-dream':{name:'Tử đinh hương & đào',sky:['#f7c1ee',.61,.12,.38,-.20,-.015,-.025,.025],land:['#ffd6bf',.40,.20,.14,-.08,-.10,-.035,.035],light:'#ffe4d4'},
  moody:{name:'Cobalt & rừng sâu',sky:['#7a88e8',.65,-.37,.20,.26,.13,.25,-.035],land:['#758f85',.47,-.22,-.14,.20,-.13,.24,0],light:'#efd7bd'},
  creative:{name:'Tím & san hô',sky:['#c195ff',.65,-.10,.35,-.23,.22,.17,0],land:['#ffad91',.56,.27,.23,-.13,.18,.16,0],light:'#e5d1ff'}
 };
 // Scene directions are targets for the orchestrator, not catalog presets. Each
 // target is metered against this photograph before native RAY tools are set.
 const SCENE_DIRECTIONS={
  'auto-beauty':[
   ['Lam trong & lá tươi','#8bbcff','#a3ddb0','#f5d5b6','#ffe8d0',0,0,0,.02,.035,.03],
   ['Nắng đào & xanh ngọc','#9bdfe7','#a1d5bf','#f1c9ab','#ffe1c3',.10,.015,.04,.04,.10,-.01],
   ['Lam sâu & rừng mát','#91a8ee','#88b8aa','#d3c4b2','#e9edff',-.11,.065,-.07,.08,.02,.08],
   ['Mây sữa & sage','#c0dbef','#bdcba5','#e8d9bd','#fff0db',.045,-.055,.065,.015,.055,-.04]],
  natural:[
   ['Lam ngọc & lá xanh','#8fe8ef','#8de8b5','#d3dbc2','#fff1df',0,0,.02,.02,.035,.02],
   ['Nắng sớm & lá non','#a3d4ec','#c5df91','#e8d2ad','#ffe0b3',.15,-.03,.055,.025,.105,-.025],
   ['Lam trời & rừng mát','#7eadeb','#77c8b3','#b7c9d7','#e0eaff',-.12,.045,-.055,.07,.025,.085],
   ['Mây ngọc & sage','#c4e6dc','#b0cfb9','#ded6bb','#fff1dd',.03,-.09,.075,.01,.06,-.055]],
  cinematic:[
   ['Teal & rừng olive','#63d0bd','#a3bd7e','#edb77c','#ffd6aa',0,0,-.055,.075,.075,.06],
   ['Lam thép & đất ấm','#80a2df','#79ada5','#e7c1a2','#f4e3d5',-.11,.095,-.12,.10,.025,.12],
   ['Hoàng hôn & rêu','#c9b4bd','#b5b481','#f0aa83','#ffd0a0',.24,.10,-.02,.035,.14,-.035],
   ['Lam sâu & lá bạc','#9c99dc','#91b3ac','#c5b5bc','#e1d9ff',-.17,.19,-.15,.085,.04,.08]],
  'golden-hour':[
   ['Nắng mật & olive','#ffd092','#c8c58b','#dbb077','#ffd292',0,0,.01,.025,.12,.02],
   ['Nắng đào & lá bạc','#f4b9b3','#b7cda7','#edbaa4','#ffd5bb',-.16,.15,.075,.015,.08,-.04],
   ['Nắng chiều & rêu','#e5ac74','#98b48b','#d49b78','#ffc987',.13,-.045,-.10,.075,.16,.10],
   ['Vàng nhẹ & xanh ngọc','#eddfac','#99c7b4','#d8c5a2','#fff1cc',-.23,-.055,.045,.035,.055,-.025]],
  'vintage-film':[
   ['Champagne & rêu bạc','#dfd0a1','#8cbfa2','#d9bd96','#f5d9b1',0,0,.015,.025,.06,-.025],
   ['Lam bạc & olive','#b9d1db','#bec28d','#d1bfa6','#ebe4d4',-.18,.025,.07,.01,.025,-.055],
   ['Đào phim & rừng trầm','#e8b5a7','#8eaa92','#d3a58b','#f3cfac',.10,.16,-.07,.07,.105,.075],
   ['Ngọc xám & cỏ vàng','#b4d9c6','#c5c08b','#d4c49a','#f4e9c8',-.075,-.12,.035,.035,.045,.02]],
  editorial:[
   ['Lam thép & sage','#b8c5ff','#b5d2cb','#c9c7d7','#ffe7d4',0,0,-.025,.055,.045,.08],
   ['Ngọc lạnh & đá ấm','#8dd7d3','#91bda5','#e7d0ba','#fff0dc',-.04,-.17,.025,.035,.085,.035],
   ['Tím xám & olive','#c6b7da','#bac19d','#d5bdba','#eedde7',.09,.16,-.10,.095,.02,.13],
   ['Sữa đào & xanh bạc','#ded5cf','#b8c9ba','#e5ccbb','#ffe8d0',.20,-.025,.09,.01,.075,-.06]],
  'soft-dream':[
   ['Mây tím & lá sage','#f7c1ee','#bdc9b5','#efd2c3','#ffe4d4',0,0,.055,.01,.08,-.035],
   ['Mây đào & xanh sương','#f7cdb7','#b0d6cd','#efd9bc','#ffe8c9',.16,-.22,.10,0,.12,-.07],
   ['Hồng ngọc & rêu bạc','#e9afcd','#a9bba3','#ddc2b8','#ffe1e1',-.08,.07,-.045,.075,.035,.035],
   ['Lam sữa & sage','#bedbf2','#c2d3ba','#e0d9d0','#e9efff',-.24,-.19,.035,.045,.055,-.005]],
  moody:[
   ['Cobalt & rừng sâu','#7a88e8','#758f85','#a0a4b8','#efd7bd',0,0,-.12,.08,.035,.08],
   ['Teal tối & olive','#6caaa7','#9b9f78','#b2a184','#e0d5b5',.10,-.22,-.17,.11,.075,.12],
   ['Mận xám & rêu','#b18cb9','#839585','#b39b9b','#e9c9cb',.16,.15,-.09,.065,.055,.035],
   ['Lam khói & lá bạc','#91a8bf','#a5b3aa','#b8b4ac','#dbe5eb',.06,-.055,-.045,.035,.015,-.035]],
  creative:[
   ['Tím & san hô','#c195ff','#a0c4b4','#ffad91','#e5d1ff',0,0,-.025,.06,.065,.04],
   ['Ngọc & hồng đào','#7ce7ee','#c2d38b','#f0a6cc','#cef5f1',-.12,-.25,.065,.025,.12,-.035],
   ['San hô & rừng ngọc','#ffac8e','#78bfb8','#9ddbe2','#ffe0cb',.27,-.13,-.065,.085,.15,.10],
   ['Tử đinh hương & ochre','#d3a0ea','#b8bd83','#d8d68e','#eddbff',.08,.17,-.11,.10,.035,.075]]
 };
 const FOLIAGE={
  'auto-beauty':[.32,.025,-.08,.04,.10,.08,0],natural:[.42,-.045,-.12,.07,.14,.10,0],cinematic:[.45,.015,-.11,.15,-.08,.16,0],
  'golden-hour':[.40,.06,-.13,.10,-.025,.09,0],'vintage-film':[.48,-.09,-.15,.21,-.10,.07,.025],editorial:[.37,-.08,-.04,.035,-.10,.19,0],
  'soft-dream':[.34,.015,-.045,-.025,-.13,-.04,.025],moody:[.47,-.17,-.10,.14,-.12,.18,0],creative:[.47,-.015,-.09,.05,.09,.12,0]
 };
 const blendHex=(a,b,amount)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-amount)+parseInt(b.slice(i,i+2),16)*amount).toString(16).padStart(2,'0')).join('');
 function applyPalette(plan,a,style,variant){
  const base=PALETTE_INTENTS[style];if(!base)return plan;
  const random=rng(plan.seed^parseInt(a.fingerprint||'0',16)^0x73fa51),profile=copy(base),directions=SCENE_DIRECTIONS[style],offset=(((plan.seed-Math.imul(variant+1,2654435761))>>>0)^parseInt(a.fingerprint||'0',16))>>>0,direction=directions[(variant+(style==='creative'?offset:0))%directions.length];
  const [name,skyColor,leafColor,landColor,lightColor,warmth,tintShift,backgroundEV,subjectEV,lightEV,contrastShift]=direction;
  profile.name=name;profile.sky[0]=skyColor;profile.sky[2]+=warmth*.75;profile.sky[3]+=tintShift*.65;profile.sky[6]+=contrastShift*.65;profile.land[0]=landColor;profile.land[2]+=warmth*.40;profile.land[3]+=tintShift*.35;
  const foliage=[leafColor,...FOLIAGE[style]];foliage[2]+=warmth*.26;foliage[3]+=tintShift*.20;foliage[6]+=contrastShift*.55;
  const film=plan.components.find(c=>c.id==='film'),balance=plan.components.find(c=>c.id==='balance'),subject=plan.components.find(c=>c.id==='subject'),depth=plan.components.find(c=>c.id==='depth'),light=plan.components.find(c=>c.id==='light'),finish=plan.components.find(c=>c.id==='texture'),certainty=a.region.source==='estimated'?.45:1;
  const totalTemp=(film?.p.temp||0)+(balance?.p.temp||0),totalTint=(film?.p.tint||0)+(balance?.p.tint||0),lightBudget=clamp(1-a.clippedHighlights*2.4-a.highlights*.6,.2,1);
  // One direction controls the foreground/background relationship as well as
  // local hues. Skin receives conservative ambient matching, not foliage color.
  if(subject){subject.p.toneExposure=clamp((subject.p.toneExposure||0)+subjectEV*certainty,-.12,.50);subject.p.temp=clamp(-totalTemp*.42+warmth*.025,-.065,.065)*certainty;subject.p.tint=clamp(-totalTint*.42+tintShift*.015,-.045,.045)*certainty;subject.reason='Cân sáng chủ thể theo cùng hướng phối cảnh; bù ám màu từ nền phim ở mức nhẹ, giữ sắc da và chi tiết tóc.';}
  if(depth){depth.p.toneExposure=clamp((depth.p.toneExposure||0)+backgroundEV*certainty,-.32,.18);depth.p.contrast=clamp(contrastShift*.35,-.04,.055);}
  if(light){light.p.toneLocalColor=lightColor;light.p.toneLocalEV=clamp(lightEV*lightBudget*(.65+a.light.confidence*.35),0,.18);light.p.toneLocalColorAmount=clamp((.025+Math.abs(warmth)*.07)*lightBudget,.012,.065);light.p.adjustRegionRX=clamp((light.p.adjustRegionRX||.4)*[1,1.25,.8,1.10][variant%4],.12,.85);light.p.adjustRegionFeather=variant%2?.94:.84;light.reason='Ánh sáng '+name.toLowerCase()+' nối màu mây, cảnh và chủ thể; hướng theo sáng gốc, không thêm nguồn sáng ngược chiều tùy ý.';}
  const layerFor=(kind,z,values,label,subtract=null)=>{
   if(!z||z.confidence<.45||!z.p)return null;
   const cloud=kind==='clouds',leaf=kind==='vegetation',[color,weight,temp,tint,split,sat,contrast,lift]=values,confidence=clamp(.72+z.confidence*.28),variation=.94+(random()-.5)*.09,colorBudget=clamp(1-Math.max(0,z.colorfulness-.22)*(leaf?1.10:.65),leaf?.50:.64,1),amount=clamp(weight*confidence*colorBudget*variation,cloud?.018:.12,cloud?.075:.75),channels=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255),maxEV=(Math.max(...channels)-.5)*2*amount;
   const localTemp=cloud?clamp(-totalTemp*.82+warmth*.018,-.17,.17):temp*confidence-(leaf?totalTemp*.40:0),localTint=cloud?clamp(-totalTint*.82+tintShift*.012,-.14,.14):tint*confidence-(leaf?totalTint*.35:0),gain=Math.max(0,localTemp*.212,-localTint*.13,-localTemp*.206),headroom=clamp((cloud?.025:.055)+gain*.55+Math.abs(split)*.045+Math.max(0,sat)*.16+z.highlightCoverage*.06,.025,.19),p={...copy(z.p),temp:localTemp,tint:localTint,split:split*confidence,sat:sat*colorBudget,contrast:contrast*(1-z.highlightCoverage*.2),lift:Math.max(0,lift||0),toneExposure:0,toneHighlights:-headroom,toneWhites:-clamp((cloud?.004:.010)+z.highlightCoverage*.025,.004,.04),toneLocalEnabled:true,toneLocalMode:'all',toneLocalEV:-Math.max(0,maxEV)-(cloud?.005:.025),toneLocalBrightness:0,toneLocalWarmth:0,toneLocalColor:color,toneLocalColorAmount:amount,toneLocalOpacity:1,toneLocalShow:false};
   if(subtract?.p){const outside=copy(subtract.p);delete outside.adjustRegionStack;outside.adjustRegion='out';p.adjustRegionStack=[...(p.adjustRegionStack||[]),outside];}
   return makeComponent('palette-'+kind,label+' · '+name,'background',p,{source:'estimated',focus:copy(z.focus)},a.light,cloud?'Giữ mây gần trung tính, giảm ám màu nền phim và giữ chuyển sáng; chỉ lấy một phần sắc ánh sáng chung của cảnh.':leaf?'Cân sắc lá và độ đậm theo cùng bảng màu trời, mây, địa hình; giảm ám vàng từ nền phim, bảo vệ chủ thể và tóc.':'Phối '+label.toLowerCase()+' theo hướng chung '+name.toLowerCase()+', đo sáng và sắc độ riêng từ vùng ước lượng; bảo vệ da, tóc và kết cấu ảnh.');
  };
  const scene=a.palette||{},cloudColor=blendHex(blendHex('#ffffff',lightColor,.18),skyColor,.08),sky=layerFor('sky',scene.sky,profile.sky,'Trời',scene.clouds),clouds=layerFor('clouds',scene.clouds,[cloudColor,.045,0,0,0,-.055,-.015,0],'Mây'),vegetation=layerFor('vegetation',scene.vegetation,foliage,'Cây cối'),landZone=scene.vegetation?scene.terrain:scene.terrain||scene.land,land=layerFor('land',landZone,profile.land,'Cảnh nền');
  if(finish){const noise=Math.max(a.recovery?.zones?.subject?.noise||0,...(a.recovery?.faces||[]).map(f=>f.noise)),budget=clamp(1-noise*11,.25,1);finish.p.grain=0;finish.p.sharp=clamp((.105+a.texture*.08)*budget,.025,.12);finish.p.printClear=clamp(.16*budget,.04,.16);finish.reason='Độ trong và tăng nét RAY làm rõ chi tiết nguồn sau phối màu; mức theo nhiễu, không thêm hạt hoặc làm mờ ảnh.';}
  plan.title=styles.find(s=>s.id===style).name+' · '+name;
  plan.components=plan.components.filter(c=>c.id!=='texture');for(const c of [sky,clouds,vegetation,land,finish])if(c)plan.components.push(c);
  for(const c of plan.components){c.p=clean(c.p);c.targetIntent.baseline={p:copy(c.p),focus:copy(c.focus),sun:copy(c.sun),leak:copy(c.leak)};}
  if(a.palette)plan.analysis.palette=copy(a.palette);return plan;
 }
 function upgradeComposition(plan,a,catalog,style,variant){
  const t=INTENTS[style],dream=style==='soft-dream',creative=style==='creative',random=rng(plan.seed^parseInt(a.fingerprint||'0',16)^0x51f15e),jitter=random()-.5,desired=dream?{temp:.025,tint:.025,split:.015,contrast:-.015,sat:.025,lift:.02}:{...t},colorDistance=(l,r)=>MIX_KEYS.reduce((n,k)=>n+Math.abs((l[k]||0)-(r[k]||0))*(k==='temp'||k==='tint'?1.5:1),0);
  const explicit=catalog.filter(r=>MIX_KEYS.some(k=>Math.abs(Number(r.p?.[k])||0)>.001)&&Number(r.p?.sat||0)>-.55),safe=explicit.filter(r=>!dream||(Number(r.p?.contrast||0)>=-.18&&Number(r.p?.lift||0)<=.14&&Number(r.p?.sat||0)>=-.14)),available=safe.length?safe:explicit.length?explicit:catalog;
  const ranked=available.map(r=>({r,score:presetScore(r,desired,a)})).sort((l,r)=>l.score-r.score||l.r.id.localeCompare(r.r.id)),pool=ranked.slice(0,Math.min(ranked.length,creative?16:8)),primary=pool[Math.min(pool.length-1,variant===0?0:1+Math.floor(random()*Math.max(1,pool.length-1)))]?.r||catalog[0],chosen=[primary],weights=creative?[.49+jitter*.07,.30-jitter*.04,.21-jitter*.03]:[clamp(.61+jitter*.16+a.dynamicRange*.045,.52,.75),0];if(!creative)weights[1]=1-weights[0];
  const sourceP=r=>Object.fromEntries(MIX_KEYS.map(k=>[k,clamp(r.p?.[k]||0,...NUM[k])]));
  for(let index=1;index<(creative?3:2);index++){
   const candidates=available.filter(r=>!chosen.some(s=>s.id===r.id));if(!candidates.length)break;
   const selected=candidates.map(r=>{const blend=Object.fromEntries(MIX_KEYS.map(k=>[k,(sourceP(primary)[k]*weights[0]+sourceP(r)[k]*weights[index])/(weights[0]+weights[index])])),distance=colorDistance(sourceP(primary),sourceP(r));return{r,score:colorDistance(blend,desired)+(distance<.07?.10:0)+Math.max(0,distance-1.3)*.10};}).sort((l,r)=>l.score-r.score||l.r.id.localeCompare(r.r.id));
   chosen.push(selected[Math.min(selected.length-1,Math.floor(random()*Math.min(3,selected.length)))]?.r||selected[0].r);
  }
  const baseStrength=({'auto-beauty':.48,natural:.46,cinematic:.67,'golden-hour':.60,'vintage-film':.64,editorial:.59,'soft-dream':.48,moody:.67,creative:.76})[style],strength=clamp(baseStrength*(1-Math.max(0,a.colorfulness-.16)*.45)*(1-a.clippedHighlights*.18)+(variant-1.5)*.018+jitter*.025,.25,.84),mix={version:1,strength:+strength.toFixed(6),sources:chosen.map((r,index)=>({id:r.id,name:r.name||r.names?.at(-1)||r.id,weight:+weights[index].toFixed(6),p:sourceP(r)}))},palette=mixParameters(mix),byId=new Map(plan.components.map(c=>[c.id,c])),film=byId.get('film'),balance=byId.get('balance'),subject=byId.get('subject'),depth=byId.get('depth'),light=byId.get('light'),texture=byId.get('texture'),zones=a.recovery?.zones||{},subjectZone=zones.subject||{mean:a.subjectBrightness,shadowCoverage:a.shadows,highlightCoverage:a.highlights,noise:0},backgroundZone=zones.background||{mean:a.backgroundBrightness,neutralCoverage:0,neutralWarmCast:0,neutralTintCast:0},neutralConfidence=clamp((backgroundZone.neutralCoverage||0)/.15),lightBudget=clamp((1-a.clippedHighlights*2.5)*(1-a.highlights*.6)),certainty=a.region.source==='estimated'?.55:1;
  const names=mix.sources.map(s=>s.name).join(' + '),weightTotal=mix.sources.reduce((n,s)=>n+s.weight,0),fractions=mix.sources.map(s=>Math.round(s.weight/weightTotal*100)+'% '+s.name).join(' + '),gain=Math.max(1+palette.temp*.212,1-palette.tint*.13,1-palette.temp*.206),headroom=clamp(.025+Math.max(0,gain-1+Math.abs(palette.split)*.055)*1.6+Math.max(0,palette.sat)*.24+a.clippedHighlights*.12,.025,.20);
  film.p=clean({...palette,toneHighlights:-headroom,toneWhites:-clamp(a.clippedHighlights*.08,0,.035)});film.mix=mix;film.title='Phối màu · '+names;film.reason='Trộn thông số màu của các preset theo tỉ lệ và độ đậm ở thanh trượt phối màu. Ánh sáng, cân chỉnh và độ nét được điều phối riêng theo ảnh để không cộng dồn hiệu ứng.';
  const median=Math.max(.035,a.median),target=.46+t.mood+(variant-1.5)*.014,ev=clamp(Math.log2(target/median)*.32-a.clippedHighlights*.10,-.28,.50),cast=neutralConfidence>.15?(backgroundZone.neutralWarmCast||0)*neutralConfidence:(a.warmCast||0)*.30,tint=neutralConfidence>.15?(backgroundZone.neutralTintCast||0)*neutralConfidence:(a.tintCast||0)*.30;
  balance.p=clean({toneExposure:ev,toneShadows:clamp((.20-a.p10)*.55,0,.11),toneHighlights:-clamp((a.p95-.90)*(dream?.40:.70)+a.clippedHighlights*(dream?.20:.35),0,dream?.11:.23),toneWhites:-clamp(a.clippedHighlights*.18,0,.075),toneBlacks:clamp((a.clippedShadows-.08)*.12,-.012,.025),temp:clamp(-cast*.38,-.075,.075),tint:clamp(-tint*.45,-.055,.055),contrast:clamp((.64-a.dynamicRange)*(dream?.035:.07),dream?-.015:-.035,.045),sat:clamp((.13-a.colorfulness)*.07,-.015,.012)});balance.reason='Tính lại phơi sáng, tương phản, nhiệt độ và ám màu theo histogram và điểm gần trung tính; tách cân sáng khỏi bảng màu đã trộn.';
  const subjectMean=Math.max(.045,a.subjectBrightness),subjectEV=clamp(Math.log2(.43/subjectMean)*.28+Math.max(0,a.backgroundBrightness-subjectMean)*.35-ev*.50+(variant-1.5)*.012,-.08,.45)*certainty;
  subject.p=clean({...copy(a.region.p),toneExposure:subjectEV,toneShadows:clamp((.27-subjectZone.mean)*.18,0,.055),toneHighlights:-clamp(subjectZone.highlightCoverage*.18,0,.07)});subject.reason='Đo sáng chủ thể độc lập với cảnh nền và mức bù sáng tổng thể, giữ vùng da và kết cấu nguồn.';
  const sceneEV=dream?clamp(Math.log2(.50/Math.max(.05,a.backgroundBrightness))*.12,-.07,.08):-clamp(t.depth*(.45+a.backgroundBrightness)+Math.max(0,a.backgroundBrightness-a.subjectBrightness)*.12,0,.18);
  depth.p=clean({...copy(a.region.p),adjustRegion:'out',toneExposure:sceneEV*(a.region.source==='estimated'?.45:1),toneShadows:clamp((.20-backgroundZone.mean)*.16,0,.035),toneHighlights:-clamp(a.clippedHighlights*.08,0,.025),sat:dream?0:-clamp(Math.max(0,a.colorfulness-.20)*.06,0,.025)});depth.reason=dream?'Tạo độ dịu bằng phân bổ sáng ở cảnh nền, giữ chi tiết cây, tóc và kiến trúc; không tự làm mờ ảnh.':'Cân sáng và sắc độ ngoài chủ thể theo độ chênh sáng, tạo chiều sâu mà không làm mờ nền.';
  const warm=style==='golden-hour'?1:dream?.35:creative?.50:.10,color=style==='golden-hour'?'#ffe3be':dream?'#fff3e9':creative&&variant%2?'#dceaff':'#fff2e2';
  light.p=clean({...light.p,adjustRegionRX:dream?.62:light.p.adjustRegionRX,adjustRegionRY:dream?.50:light.p.adjustRegionRY,adjustRegionFeather:dream?.94:.86,toneExposure:0,temp:0,glow:0,nang:style==='golden-hour'?clamp(.045*lightBudget,0,.045):0,leak:creative&&variant>1?Math.min(light.p.leak||0,.025):0,toneLocalEnabled:true,toneLocalMode:'all',toneLocalEV:clamp((dream?.055:.035)+warm*.06,0,.14)*lightBudget*(.65+a.light.confidence*.35),toneLocalColor:color,toneLocalColorAmount:clamp((dream?.018:creative?.050:.025)*lightBudget,0,.05),toneLocalOpacity:1,toneLocalShow:false});if(light.p.nang>.001)light.p.nangManual=true;light.title=dream?'Ánh sáng mềm theo vùng':'Phối ánh sáng theo vùng';light.reason='Kết hợp ánh sáng màu cục bộ, hình vùng và hướng sáng nhận diện với bảng màu đã trộn; vùng và màu đều chỉnh được.';
  // Native grain has a visible minimum amplitude whenever it is enabled.
  // Clean/light styles must use exact zero, rather than a deceptively tiny value.
  const noise=Math.max(subjectZone.noise||0,...(a.recovery?.faces||[]).map(f=>f.noise)),detailBudget=clamp(1-noise*8,.25,1),grainBudget=({'auto-beauty':0,natural:0,cinematic:.035,'golden-hour':0,'vintage-film':.075,editorial:0,'soft-dream':0,moody:.035,creative:.040})[style]*clamp(1-a.texture*2.3,.30,1);
  texture.p=clean({seed:plan.seed,grain:grainBudget*(.85+random()*.15),glow:0,halation:dream?0:clamp((style==='vintage-film'?.035:style==='golden-hour'?.020:.008)*(1-a.clippedHighlights*3),0,.035),vignette:clamp(t.depth*.22*(1-a.clippedShadows*.5),0,.040),sharp:clamp((.030-a.texture*.10)*detailBudget,.008,.035),printClear:clamp((dream?.055:.040)*detailBudget,0,.055),...(style==='vintage-film'?{dust:Math.min(texture.p.dust||0,.008),ptex:.010}:{})});texture.title='Hoàn thiện chất ảnh';texture.reason='Một ngân sách hạt, độ trong và chi tiết chung sau phối màu/ánh sáng; không thừa hưởng làm mờ hoặc quang sai từ từng preset.';
  for(const c of plan.components){c.p=clean(c.p);c.targetIntent.baseline={p:copy(c.p),focus:copy(c.focus),sun:copy(c.sun),leak:copy(c.leak)};}
  plan.basePreset={id:primary.id,name:primary.name||primary.names?.at(-1)||primary.id};plan.analysis.recovery=copy(a.recovery);return applyPalette(plan,a,style,variant);
 }
 function filmRecovery(analysis,{seed=1,count=4,presets=[],keepNeutralComponents=false}={}){
  // Recovery and film grading stay separate native layers. Reuse the proven
  // recovery foundation; no existing style, preset or renderer is rewritten.
  const a=analysis,catalog=(Array.isArray(presets)?presets:[]).filter(r=>r&&typeof r.id==='string'&&r.p&&typeof r.p==='object'),available=catalog.length?catalog:[{id:'goc',name:'Gốc',p:{}}],random=rng((seed>>>0)^parseInt(a.fingerprint||'0',16)),profiles=[
   {name:'Fuji trong',id:'fujicam',amount:.86,body:.18,temp:.015,tint:0,split:.02,sat:.02,contrast:0},
   {name:'Fuji xanh',id:'fujicam3',amount:.90,body:.16,temp:-.025,tint:-.02,split:.04,sat:.015,contrast:-.015},
   {name:'Fuji ấm',id:'fujicam2',amount:.83,body:.23,temp:.025,tint:0,split:.01,sat:.025,contrast:-.005},
   {name:'Fuji điện ảnh',id:'fujicam3',amount:.74,body:.16,temp:.015,tint:.015,split:.10,sat:-.05,contrast:.035},
   {name:'Fuji dịu',id:'fujicam',amount:.69,body:.15,temp:.025,tint:.01,split:.02,sat:-.015,contrast:-.015}
  ],foundation=generate(a,{style:'backlight',seed,count,presets,keepNeutralComponents});
  return foundation.map((plan,index)=>{
   const profile=profiles[index],preferred=available.find(r=>r.id===profile.id),target=INTENTS['film-recovery'],preset=preferred||available.slice().sort((l,r)=>presetScore(l,target,a)-presetScore(r,target,a)||l.id.localeCompare(r.id))[0],jitter=random()-.5,certainty=a.region.source==='estimated'?.55:1,colorBudget=clamp(1-Math.max(0,a.colorfulness-.18)*1.6,.56,1),amount=clamp(profile.amount*colorBudget+(random()-.5)*.12,.48,1),neutral=a.recovery?.zones?.background,neutralConfidence=clamp((neutral?.neutralCoverage||0)/.20),grade={};
   for(const key of ['temp','tint','split','contrast','sat','lift','film'])if(finite(preset.p[key]))grade[key]=preset.p[key]*amount;
   grade.temp=clamp((grade.temp||0)+profile.temp+jitter*.04-(neutral?.neutralWarmCast||0)*neutralConfidence*.15,-.30,.32);
   grade.tint=clamp((grade.tint||0)+profile.tint+jitter*.025-(neutral?.neutralTintCast||0)*neutralConfidence*.20,-.20,.16);
   grade.split=clamp((grade.split||0)+profile.split+jitter*.035,-.12,.70);
   grade.sat=clamp((grade.sat||0)+profile.sat+(random()-.5)*.045,-.12,.30);
   grade.contrast=clamp((grade.contrast||0)+profile.contrast-(a.dynamicRange>.85?.025:0),-.04,.26);
   grade.lift=clamp(grade.lift||0,0,.075);grade.film=clamp((.10+a.dynamicRange*.06)*colorBudget*(.9+profile.amount*.1),.08,.18);
   // Native tone runs before the film LUT. Reserve highlight headroom for
   // channel gains, split toning and saturation before applying that palette.
   const channelGain=Math.max(1+grade.temp*.212,1-grade.tint*.13,1-grade.temp*.206),headroom=.06+Math.max(0,channelGain-1+Math.abs(grade.split)*.055)*2.5+Math.max(0,grade.sat)*.40+a.clippedHighlights*.10;
   grade.toneHighlights=-clamp(headroom,.06,.28);
   grade.toneWhites=-clamp(.012+a.clippedHighlights*.07,0,.035);
   const outside={source:a.region.source,focus:copy(a.region.focus)},backgroundP={...copy(a.region.p),adjustRegion:'out',...grade},faceOut=(a.recovery?.faces||[]).map(r=>({adjustRegion:'out',adjustRegionShape:'ellipse',adjustRegionX:r.focus.cx,adjustRegionY:r.focus.cy,adjustRegionRX:r.focus.rx*1.10,adjustRegionRY:r.focus.ry*1.10,adjustRegionAngle:0,adjustRegionFeather:.35})),bodyP={...copy(a.region.p),adjustRegionStack:faceOut};
   for(const key of ['temp','tint','split','sat','contrast','lift'])if(finite(grade[key]))bodyP[key]=grade[key]*profile.body*certainty;
   const background=makeComponent('film-background','Màu phim cảnh · '+(preset.name||preset.id),'background',backgroundP,outside,a.light,'Phối màu từ preset và chất phim tráng in RAY trong hậu cảnh đã nhận diện; cân mức theo độ đậm màu và vùng sáng của ảnh. Có thể sửa riêng màu, vùng và tương phản.'),body=makeComponent('film-subject','Màu phim chủ thể · giữ da','grade',bodyP,{source:a.region.source,focus:copy(a.region.focus)},a.light,'Phối nhẹ cùng màu phim trên chủ thể, loại vùng mặt để giữ màu da tự nhiên. Không cộng thêm phơi sáng.');
   const detail=plan.components.find(c=>c.id==='texture');if(detail){detail.p.printClear=clamp(detail.p.printClear||0,0,.12);detail.p.sharp=clamp(detail.p.sharp||0,0,.07);detail.p.grain=0;detail.p=clean(detail.p);detail.title='Chi tiết tự nhiên';detail.reason='Giữ kết cấu nguồn bằng độ trong và tăng nét RAY; không thêm hạt hoặc làm mềm chủ thể.';detail.targetIntent.baseline.p=copy(detail.p);}
   const clarity=plan.components.find(c=>c.id==='clarity'),layers=plan.components.filter(c=>c.id!=='texture'&&c.id!=='clarity');layers.push(background,body);if(clarity)layers.push(clarity);if(detail)layers.push(detail);
   const result={...plan,id:'ray-ai-'+a.fingerprint+'-film-recovery-'+plan.seed,style:'film-recovery',title:'Màu phim cứu sáng · '+profile.name,basePreset:{id:preset.id,name:preset.name||preset.names?.at(-1)||preset.id},components:layers};
   return a.empty?scale(result,0):result;
  });
 }
 function generate(analysis,{style='auto-beauty',seed=1,count=4,presets=[],keepNeutralComponents=false}={}){
  if(!analysis||analysis.version!==1||!finite(analysis.mean))throw Error('Cần phân tích ảnh trước khi tự phối.');
  if(style==='film-recovery')return filmRecovery(analysis,{seed,count,presets,keepNeutralComponents});
  if(!INTENTS[style])throw Error('Phong cách AI Composer không hợp lệ.');
  const a=analysis,n=Math.round(clamp(count,3,5)),start=seed>>>0,t=INTENTS[style],random=rng(start^parseInt(a.fingerprint||'0',16)),catalog=(Array.isArray(presets)?presets:[]).filter(r=>r&&typeof r.id==='string'&&r.p&&typeof r.p==='object');if(!catalog.length)catalog.push({id:'goc',name:'Gốc',p:{}});
  const creative=style==='creative',backlight=rescueStyle(style),candidateTarget={...t,temp:t.temp-clamp(a.warmCast||0,-.4,.4)*.20,tint:t.tint-clamp(a.tintCast||0,-.3,.3)*.25};
  const ranked=catalog.map(r=>({r,score:presetScore(r,candidateTarget,a)})).sort((x,y)=>x.score-y.score||x.r.id.localeCompare(y.r.id)),pool=ranked.slice(0,Math.min(ranked.length,creative?24:12)),chosen=new Set(),plans=[];
  for(let variant=0;variant<n;variant++){
   const rank=variant===0?0:Math.min(pool.length-1,1+Math.floor(random()*Math.max(1,pool.length-1))),selection=pool[rank]?.r||pool[0].r;let preset=selection;
   if(chosen.has(preset.id)){preset=pool.find(x=>!chosen.has(x.r.id))?.r||preset;}chosen.add(preset.id);
   const profile=backlight?((style==='restore-detail'?[
    {name:'Trong & nét',body:.95,scene:.85,light:.75,color:1,detail:1},
    {name:'Sáng sạch',body:1.2,scene:.9,light:1.15,color:.9,detail:1},
    {name:'Rõ chi tiết',body:.9,scene:1,light:.55,color:.8,detail:1.4},
    {name:'Cân màu',body:1.05,scene:.9,light:.9,color:1.5,detail:1.1}
   ]:[
    {name:'Cân bằng vùng',body:1,scene:1,light:1,color:1,detail:1},
    {name:'Sáng rõ chủ thể',body:1.25,scene:1.05,light:1.3,color:.9,detail:.9},
    {name:'Giữ vùng sáng',body:1.05,scene:1.45,light:.65,color:.8,detail:1},
    {name:'Màu & chiều sâu',body:1.1,scene:1,light:1.1,color:1.6,detail:1.2}
   ])[variant%4]):null;
   const jitter=(random()-.5),spread=creative?1.8:1,localSeed=(start+Math.imul(variant+1,2654435761))>>>0,filmAmount=clamp(.32+variant*.035+(creative?.07:0)-a.skinCoverage*.10-a.clippedHighlights*.08,.22,.52)*(backlight?.45:1),film=scaledParams(clean(preset.p),filmAmount);
   // Explicit optical budget: preset texture is kept restrained so later stages cannot pile up unchecked.
   for(const k of ['grain','halation','glow','vignette','leak','dust','ca','flash','nang','sharp','soft','film','ptex'])if(film[k])film[k]=Math.min(film[k],({grain:.045,halation:.06,glow:.04,vignette:.06,leak:.025,dust:.012,ca:.012,flash:.035,nang:.025,sharp:.035,soft:.035,film:.035,ptex:.025})[k]);
   if(backlight){
    // Recovery uses the existing native neutral grade, without print/paper optics.
    for(const key of EFFECTS)if(finite(film[key]))film[key]=0;
   }
   const grainBudget=({'restore-detail':0,backlight:.005,'auto-beauty':.010,natural:.008,cinematic:.035,'golden-hour':.025,'vintage-film':.075,editorial:.015,'soft-dream':.012,moody:.035,creative:.040}[style])*clamp(1-a.texture*2.3,.30,1)*(a.skinCoverage>.002?.8:1);
   // Thu Nhật supplies its own grain inside its unchanged native adapter.
   // Count that texture in the same budget as explicit film and finish grain.
   if(film.rayThuNhat>0)film.rayThuNhat=Math.min(film.rayThuNhat,grainBudget/.25);
   const implicitGrain=(film.rayThuNhat||0)*.25;
   if(film.grain>0)film.grain=Math.min(film.grain,Math.max(0,grainBudget-implicitGrain));
   film.seed=localSeed;
   const median=Math.max(.035,a.median),target=.43+t.mood+(variant-1.5)*.018,night=a.mean<.17&&a.shadows>.5,ev=clamp(Math.log2(target/median)*(night?.23:.43)-a.clippedHighlights*.25,-.50,.65),colorLimit=a.skinCoverage>.08?.20:.32;
   const balance={toneExposure:ev,toneShadows:clamp((.22-a.p10)*1.05+Math.max(0,a.backgroundBrightness-a.subjectBrightness)*.12,0,.28),toneHighlights:-clamp((a.p95-.87)*1.3+a.clippedHighlights*.65,0,.38),toneWhites:-clamp(a.clippedHighlights*.30,0,.12),toneBlacks:clamp((a.clippedShadows-.10)*.16,-.018,.045),temp:clamp(candidateTarget.temp*.35-(film.temp||0)*.22+jitter*.028*spread,-colorLimit,colorLimit),tint:clamp(candidateTarget.tint*.35-(film.tint||0)*.16,-.09,.09),contrast:clamp((.45-a.dynamicRange)*.20+t.contrast*.22+jitter*.018,-.10,.12),sat:clamp((.20-a.colorfulness)*.18+t.sat*.16,-.12,.10)};
   const f=a.region,insideP=copy(f.p),outsideP={...copy(f.p),adjustRegion:'out'},subjectEV=clamp(Math.log2(.45/Math.max(.05,a.subjectBrightness))*.30+Math.max(0,a.backgroundBrightness-a.subjectBrightness)*.45+(variant-1.5)*.025,-.12,.48),depthEV=-clamp(t.depth*(.55+a.backgroundBrightness)+Math.max(0,a.backgroundBrightness-a.subjectBrightness)*.22+jitter*.025,0,.24);
   const subject={...insideP,toneExposure:subjectEV,toneShadows:clamp((.32-a.subjectBrightness)*.25,0,.10)},depth={...outsideP,toneExposure:f.source==='estimated'?depthEV*.45:depthEV,sat:-clamp(a.colorfulness*.08+t.depth*.12,0,.065)};
   const lightBudget=clamp((1-a.clippedHighlights*2.5)*(1-a.highlights*.6)),warmLight=style==='golden-hour'?1:creative?.55:style==='soft-dream'?.35:.15,lightX=clamp(a.light.x+(random()-.5)*.08),lightY=clamp(a.light.y+(random()-.5)*.06),light={x:lightX,y:lightY,angle:a.light.angle,confidence:a.light.confidence};
   const glow=clamp(t.glow*(1-a.texture*.8)*(1-a.clippedHighlights)*(.80+variant*.07),0,.13),lightP={adjustRegion:'in',adjustRegionShape:variant%2?'curve':'beam',adjustRegionX:clamp(lightX*.65+.175),adjustRegionY:clamp(lightY*.7+.12),adjustRegionRX:.40,adjustRegionRY:clamp(.26+(1-a.dynamicRange)*.13,.24,.42),adjustRegionAngle:clamp(light.angle,-180,180),adjustRegionCurve:clamp(.35+jitter*.30,-1,1),adjustRegionThickness:.12,adjustRegionFeather:.82,toneExposure:clamp((.035+warmLight*.12)*lightBudget*(.65+a.light.confidence*.35),0,.18),temp:clamp(warmLight*.13*lightBudget,0,.16),nang:clamp(warmLight*.085*lightBudget,0,.10),nangSat:1,glow:glow*.5};
   const textureBudget=clamp(1-a.texture*2.3,.15,1),texture={seed:localSeed,grain:clamp(t.grain*textureBudget*(.8+random()*.35)-(film.grain||0)*.35,0,.14),glow:Math.max(0,glow-(film.glow||0)*.5),halation:clamp((style==='golden-hour'?.05:style==='vintage-film'?.055:.014)*(1-a.clippedHighlights*3),0,.06),vignette:clamp(t.depth*.26*(1-a.clippedShadows*.5),0,.055),sharp:clamp((.025-a.texture)*1.1,0,.025)};
   texture.grain=Math.min(texture.grain,Math.max(0,grainBudget-implicitGrain-(film.grain||0)));
   if(style==='soft-dream'&&f.source!=='estimated'){depth.bgBlur=clamp(.055+(1-a.texture)*.035,0,.09);depth.soft=.025;}
   if(style==='vintage-film'){texture.dust=clamp(.012*textureBudget,0,.012);texture.ptex=.015;}
   if(creative&&variant>1&&lightBudget>.45){lightP.leak=.035*lightBudget;lightP.leakHue=clamp(-15+random()*55,-45,75);lightP.leakSat=.65;}
   let bodyRegion=copy(f.p),zoneSubject=null,zoneBackground=null;
   if(backlight){
    const records=a.recovery?.faces||[],zones=a.recovery?.zones||{},fallback={mean:a.subjectBrightness,p10:a.p10,p90:a.p95,shadowCoverage:a.shadows,highlightCoverage:a.highlights,texture:a.texture,noise:0,neutralCoverage:0,neutralWarmCast:0,neutralTintCast:0};zoneSubject=zones.subject||fallback;zoneBackground=zones.background||{...fallback,mean:a.backgroundBrightness};
    const faceOut=records.map(r=>({adjustRegion:'out',adjustRegionShape:'ellipse',adjustRegionX:r.focus.cx,adjustRegionY:r.focus.cy,adjustRegionRX:r.focus.rx*1.10,adjustRegionRY:r.focus.ry*1.10,adjustRegionAngle:0,adjustRegionFeather:.35}));bodyRegion={...copy(f.p),adjustRegionStack:faceOut};
    const certainty=f.source==='estimated'?.48:1,bodyNeed=clamp((.34-zoneSubject.p10)*1.4+zoneSubject.shadowCoverage*.45),sceneNeed=clamp((.27-zoneBackground.p10)*.8+zoneBackground.shadowCoverage*.20);
    balance.toneExposure=clamp(Math.log2(.51/median)*.035,-.035,.055);balance.toneShadows=balance.toneHighlights=balance.toneWhites=balance.toneBlacks=balance.contrast=balance.temp=balance.tint=balance.sat=0;
    Object.assign(subject,bodyRegion,{toneExposure:0,filmExp:clamp((.07+bodyNeed*.16)*profile.body*certainty,0,.24),toneShadows:clamp((.012+bodyNeed*.025)*profile.body*certainty,0,.055),toneBrightness:clamp(bodyNeed*.004*profile.body*certainty,0,.006),toneHighlights:-clamp((.035+zoneSubject.highlightCoverage*.05)*profile.body,0,.075)});
    Object.assign(depth,{toneExposure:0,toneShadows:clamp(sceneNeed*(style==='backlight'?.22:.14)*profile.scene*certainty,0,.16),toneHighlights:-clamp(((a.p95-.91)*.45+a.clippedHighlights*.25)*profile.scene,0,.085),toneWhites:-clamp(a.clippedHighlights*.13*profile.scene,0,.025),toneBlacks:-clamp(sceneNeed*.035,0,.015),sat:0,contrast:clamp(sceneNeed*.035,0,.025)});
    // Hậu cảnh mờ sương / bạc màu: khử mờ khí quyển RAY (kênh tối + guided filter) và cân ám màu theo sương.
    // Mức theo độ "sương" đo được: kênh tối cao, độ rực thấp. Cảnh trong sẵn chỉ nhận mức rất nhẹ.
    const haze=clamp((Number(zoneBackground.darkMean??.2)-.20)*1.6+(.14-Number(zoneBackground.chroma??.14))*2);
    depth.dehaze=clamp(((style==='restore-detail'?.30:.22)+haze*.55)*profile.scene*(f.source==='estimated'?.7:1),0,.8);
    depth.sat=clamp(haze*.10*profile.color,0,.08);
    // Khử mờ RAY cân trắng hậu cảnh theo màu sương/mây trước bảng màu, nên không cộng thêm nhiệt màu ở đây.
    const bodyFocus=f.focus,dirX=clamp(bodyFocus.cx+(a.light.x-bodyFocus.cx)*.2),dirY=clamp(bodyFocus.cy+(a.light.y-bodyFocus.cy)*.15),confidence=clamp(zoneSubject.neutralCoverage/.15),warm=zoneSubject.neutralWarmCast||0,tintCast=zoneSubject.neutralTintCast||0;
    const color=confidence>.25?(tintCast>.025?'#ddffe2':warm<-.02?'#ffe6ca':warm>.03?'#d9eaff':'#ffffff'):'#ffffff',colorAmount=confidence>.25?clamp((Math.abs(warm)+Math.abs(tintCast))*.65*profile.color,0,.055):0;
    Object.assign(lightP,{...bodyRegion,adjustRegionShape:variant%2?'beam':'curve',adjustRegionX:dirX,adjustRegionY:dirY,adjustRegionRX:clamp(bodyFocus.rx*1.25,.08,.60),adjustRegionRY:clamp(bodyFocus.ry*.65,.08,.6),adjustRegionAngle:clamp(a.light.angle-90,-180,180),adjustRegionCurve:variant%2?.2:.35,adjustRegionThickness:clamp(bodyFocus.rx*.8,.045,.20),adjustRegionFeather:.85,adjustRegionStrokes:[],adjustRegionStack:[copy(f.p),...faceOut],toneExposure:0,temp:0,nang:0,glow:0,toneLocalEnabled:true,toneLocalMode:'all',toneLocalEV:clamp(bodyNeed*.10*profile.light*certainty,0,.12),toneLocalBrightness:0,toneLocalWarmth:0,toneLocalColor:color,toneLocalColorAmount:colorAmount,toneLocalOpacity:1,toneLocalShape:'ellipse',toneLocalShow:false});
    texture.glow=texture.halation=texture.vignette=texture.grain=0;
   }
   const components=[makeComponent('film',backlight?'Giữ màu gốc':'Màu phim · '+(preset.name||preset.names?.at(-1)||preset.id),'global',film,null,light,backlight?'Giữ nền màu trung tính để ưu tiên cứu sáng; có thể tự chỉnh màu.':'Chọn từ preset RAY theo ánh sáng, màu và phong cách.'),makeComponent('balance','Cân bằng ánh sáng và màu','global',balance,null,light,'Cân theo histogram; giảm vùng sáng mạnh và bù vùng tối vừa đủ.'),makeComponent('subject',backlight?'Cứu sáng chủ thể':'Ánh sáng chủ thể','subject',subject,f,light,f.source==='estimated'?'Ước lượng vùng trung tâm khi chưa có nhận diện; chỉnh mức nhẹ.':backlight?'Bù sáng chủ thể theo độ thiếu sáng và chênh lệch với nền; tránh tăng sáng toàn ảnh.':'Bù sáng trong vùng chủ thể đã nhận diện.'),makeComponent('depth',backlight?'Bảo vệ nền sáng':'Chiều sâu hậu cảnh','background',depth,f,light,backlight?'Giữ vùng nền sáng bằng giảm highlight riêng; không tăng phơi sáng bầu trời.':'Giảm sáng và màu hậu cảnh theo chênh lệch với chủ thể.'),makeComponent('light',backlight?'Giữ ánh sáng hiện có':'Ánh sáng sáng tạo','light',lightP,{source:f.source,focus:{cx:lightP.adjustRegionX,cy:lightP.adjustRegionY,rx:lightP.adjustRegionRX,ry:lightP.adjustRegionRY}},light,backlight?'Không thêm nắng hoặc flare vào ảnh đang ngược sáng; các thông số vẫn chỉnh được.':'Vị trí và mức sáng dựa theo phân bố ánh sáng trong ảnh.'),makeComponent('texture','Chất phim và chi tiết','texture',texture,null,light,'Giới hạn hạt, quầng sáng và độ mềm theo kết cấu ảnh gốc.')];
   if(f.source==='estimated'){components[2].p.toneExposure*=.55;components[2].targetIntent.baseline.p=copy(components[2].p);}
   if(backlight){
    const records=a.recovery?.faces||[];
    const detail=style==='restore-detail',zone=zoneSubject,noise=Math.max(zone.noise||0,...records.map(r=>r.noise)),budget=noise>.035?.12:clamp(1-noise*9,.35,1),certainty=f.source==='estimated'?.5:1;
    Object.assign(components[5].p,copy(f.p),{sharp:clamp((detail?.22:.035)*profile.detail*budget*certainty,0,detail?.32:.07),printClear:clamp((detail?.30:.08)*profile.detail*budget*certainty,0,detail?.44:.15),grain:0,glow:0,halation:0,vignette:0});components[5].focus=copy(f.focus);components[5].targetIntent.regionSource=f.source;components[5].p=clean(components[5].p);components[5].title=detail?'Trong và rõ chi tiết':'Chi tiết tự nhiên';components[5].reason='Dùng độ trong ảnh và tăng nét RAY trong chủ thể; giảm mức theo nhiễu, giữ chi tiết nguồn.';components[5].targetIntent.baseline={p:copy(components[5].p),focus:copy(components[5].focus),sun:copy(components[5].sun),leak:copy(components[5].leak)};
    const confidence=clamp(zone.neutralCoverage/.15),colorP={...bodyRegion,temp:clamp(-zone.neutralWarmCast/(Math.max(.25,zone.mean)*.4+.018),-.20,.20)*confidence*profile.color,tint:clamp(-zone.neutralTintCast/(Math.max(.25,zone.mean)*.13+.01),-.22,.22)*confidence*profile.color,sat:clamp((.16-a.colorfulness)*.18,0,.035)*profile.color};
    if(confidence>.15||colorP.sat>.005||keepNeutralComponents)components.push(makeComponent('subject-color','Cân màu vùng chủ thể','grade',colorP,{source:f.source,focus:copy(f.focus)},light,'Cân nhiệt độ và ám màu theo điểm gần trung tính trong chủ thể; giữ màu mặt riêng.'));
    components[1].title='Cân sáng tổng thể';components[2].title='Mở sáng vùng tối chủ thể';components[2].reason='Dùng đường cong sáng phim, Vùng tối và bảo vệ Vùng sáng RAY trong chủ thể; loại vùng mặt để không cộng dồn cứu sáng.';components[3].title='Cân vùng sáng và tối hậu cảnh';components[3].reason='Cân vùng tối, vùng sáng và điểm trắng RAY bên ngoài chủ thể theo histogram.';components[4].title='Bù ánh sáng theo vùng';components[4].reason='Dùng ánh sáng cục bộ RAY theo hướng sáng đo được; vùng, màu và mức sáng đều chỉnh được.';
    for(const [index,r]of records.entries()){
     const target=(r.confidence>.7?(detail?.47:.44):.40)+(variant-1.5)*(detail?.016:.013),need=Math.max(0,Math.log2(linear(target)/Math.max(.0008,linear(r.mean)))),confidence=r.confidence,amount=clamp(need*(confidence>.7?.95:.88),0,confidence>.7?(r.noise>.035?1.5:2):.8),foc=copy(r.focus),highlightRisk=confidence>.7&&need>1&&r.p90>.35,p={adjustRegion:'in',adjustRegionShape:'ellipse',adjustRegionX:foc.cx,adjustRegionY:foc.cy,adjustRegionRX:foc.rx,adjustRegionRY:foc.ry,adjustRegionAngle:0,adjustRegionFeather:.50,adjustRegionStack:f.source==='ai'?[copy(f.p)]:[],toneExposure:Math.max(0,amount-(highlightRisk?.12:0)),toneShadows:clamp((.30-r.mean)*.55,0,confidence>.7?(r.noise>.035?.10:.18):.07),toneBrightness:clamp((need-amount)*.08,0,confidence>.7?(r.noise>.035?.07:.12):.035),toneHighlights:-Math.max(highlightRisk?.10:0,clamp((r.p90-.65)*.4,0,.15)),temp:clamp((.07-r.warmCast)*.22,-.035,.055)*clamp(need),tint:clamp(-r.tintCast*.4,-.055,.055)*clamp(need)};
     components.push(makeComponent('face-'+index,'Ánh sáng khuôn mặt '+(index+1),'skin',p,{focus:foc,source:confidence>.7?'face':'ai'},light,confidence>.7?'Đo sáng riêng khuôn mặt; giữ áo và mây ngoài vùng chỉnh.':'Vùng da ứng viên theo AI, mức bù nhẹ; kiểm tra lại vị trí vùng.'));
    }
   }
   if(backlight){
    // Chi tiết thật toàn cảnh: dải nét mịn + dải rõ khối theo độ phân giải, giảm theo nhiễu đo được.
    const recs=a.recovery?.faces||[],noise=Math.max(zoneSubject?.noise||0,zoneBackground?.noise||0,...recs.map(r=>r.noise)),budget=clamp(1-noise*7,.35,1);
    components.push(makeComponent('clarity','Chi tiết toàn cảnh','texture',{detail:clamp((style==='restore-detail'?.46:.30)*profile.detail*budget,0,.65)},null,light,'Làm rõ chi tiết thật của cả ảnh bằng hai dải tần trên kênh sáng; bỏ nhiễu nhỏ và giới hạn viền sáng. Chỉnh hoặc tắt riêng được.'));
   }
   if(backlight){const index=components.findIndex(c=>c.id==='texture'),last=components.splice(index,1)[0];components.push(last);for(let i=components.length-1;i>=0;i--)if(!keepNeutralComponents&&!EFFECTS.some(k=>Math.abs(Number(components[i].p[k])||0)>.001))components.splice(i,1);}
   const name=styles.find(s=>s.id===style).name,title=name+' · '+(backlight?profile.name:['Cân bằng','Ánh sáng','Sắc độ','Chất phim','Khám phá'][variant]);
   const plan={version:1,id:'ray-ai-'+a.fingerprint+'-'+style+'-'+localSeed,style,seed:localSeed,title,basePreset:backlight?{id:'goc',name:'Công cụ vùng RAY'}:{id:preset.id,name:preset.name||preset.names?.at(-1)||preset.id},analysis:{...summary(a),...(backlight&&a.recovery?{recovery:copy(a.recovery)}:{})},components};plans.push(relightPeople(backlight?plan:upgradeComposition(plan,a,catalog,style,variant),a,variant));
  }
  return a.empty?plans.map(plan=>scale(plan,0)):plans;
 }
 function scale(plan,intensity=100){if(!plan||!Array.isArray(plan.components))throw Error('Công thức AI không hợp lệ.');const out=copy(plan),amount=clamp(Number(intensity)/100);out.components=out.components.map(c=>({...c,enabled:c.enabled!==false&&amount>0,p:scaledParams(c.p,amount)}));return out;}
 function adapt(recipe,newAnalysis,{seed,presets=[]}={}){
  if(!recipe||!Array.isArray(recipe.components)||!INTENTS[recipe.style])throw Error('Công thức AI không hợp lệ.');
  const catalog=Array.isArray(presets)?presets:[],preferred=catalog.find(r=>r.id===recipe.basePreset?.id),list=preferred?[preferred]:catalog,previous=recipe.analysis||{},regionComponent=recipe.components.find(c=>c.role==='subject'||c.role==='background'),baseRegion=regionComponent?.targetIntent?.baseline||regionComponent;
  const referenceRegion=copy(baseRegion?.p||newAnalysis.region.p);if(rescueStyle(recipe.style))for(const key of Object.keys(referenceRegion))if(!key.startsWith('adjustRegion')||key==='adjustRegionStack')delete referenceRegion[key];
  const oldRegion={source:previous.recognition||'estimated',focus:copy(baseRegion?.focus||{cx:.5,cy:.48,rx:.28,ry:.4}),p:referenceRegion};oldRegion.p.adjustRegion='in';
  const oldLight={x:previous.lightX??.5,y:previous.lightY??.08,confidence:previous.lightConfidence??0};oldLight.angle=Math.atan2(.5-oldLight.y,.5-oldLight.x)*180/Math.PI;
  const oldAnalysis={...newAnalysis,...previous,version:1,region:oldRegion,light:oldLight,empty:false};
  const oldGenerated=generate(oldAnalysis,{style:recipe.style,seed:recipe.seed,count:4,presets:list,keepNeutralComponents:true})[0],generated=generate(newAnalysis,{style:recipe.style,seed:seed??recipe.seed,count:4,presets:list,keepNeutralComponents:true})[0],oldById=new Map(oldGenerated.components.map(c=>[c.id,c])),fresh=new Map(generated.components.map(c=>[c.id,c]));
  const components=[];
  for(const old of recipe.components){const base=old.targetIntent?.baseline,current=fresh.get(old.id),oldReference=oldById.get(old.id),paletteRegion=old.id.startsWith('palette-');if(!current||old.targetIntent?.adaptive===false){if(current||old.targetIntent?.adaptive===false||!paletteRegion&&!old.id.startsWith('face-'))components.push(copy(old));continue;}
   const legacyFace=recipe.analysis?.recovery?.personLightVersion!==1&&/^face-\d+$/.test(old.id)&&!!base?.p,next=copy(current),newBase=legacyFace?copy(current.targetIntent.baseline):base?copy(base):{p:copy(old.p),focus:copy(old.focus),sun:copy(old.sun),leak:copy(old.leak)};next.title=old.title;next.enabled=old.enabled!==false;if(old.mix)next.mix=copy(old.mix);else delete next.mix;
   // Transfer the image-dependent change, rather than regenerating a different
   // style variant. Applying to the same analysis is consequently an identity.
   // Pre-person-light face formulas use the current safer native curve, then
   // the saved manual delta below. Their old exposure is not a creative delta.
   if(!legacyFace)for(const key of EFFECTS){const range=NUM[key];if(finite(newBase.p[key])||finite(current.p[key]))newBase.p[key]=+clamp((newBase.p[key]||0)+(current.p[key]||0)-(oldReference?.p[key]||0),...range).toFixed(6);}
   if(old.mix)for(const key of MIX_KEYS)newBase.p[key]=base?.p?.[key]??old.p[key]??0;
   if(old.role==='subject'||old.role==='background'||old.role==='skin'||['texture','clarity'].includes(old.id)||rescueStyle(recipe.style)&&['subject-color','film-subject'].includes(old.id)){
    for(const key of Object.keys(newBase.p))if(key.startsWith('adjustRegion'))delete newBase.p[key];
    for(const [key,value]of Object.entries(current.p))if(key.startsWith('adjustRegion'))newBase.p[key]=copy(value);
    newBase.focus=copy(current.focus);
   }else if(old.role==='light')for(const key of Object.keys(OPTIONAL))if(key.startsWith('adjustRegion')&&finite(current.p[key]))newBase.p[key]=+clamp((newBase.p[key]??0)+current.p[key]-(oldReference?.p[key]??0),...OPTIONAL[key]).toFixed(6);
   if(!legacyFace)for(const group of ['sun','leak',...(old.role==='light'?['focus']:[])])if(newBase[group]&&current[group]&&oldReference?.[group])for(const key of Object.keys(current[group]))newBase[group][key]=clamp(newBase[group][key]+current[group][key]-oldReference[group][key],key==='rx'||key==='ry'?.001:0,key==='rx'||key==='ry'?2:1);
   if(rescueStyle(recipe.style)&&old.id==='light'){newBase.p.adjustRegionStack=copy(current.p.adjustRegionStack||[]);newBase.p.toneLocalColor=current.p.toneLocalColor;}
   next.p=copy(newBase.p);next.focus=copy(newBase.focus);next.sun=copy(newBase.sun);next.leak=copy(newBase.leak);
   if(base?.p){
    for(const key of new Set([...Object.keys(base.p),...Object.keys(old.p||{})]))if((NUM[key]||OPTIONAL[key])&&finite(old.p?.[key]))next.p[key]=+clamp((next.p[key]||0)+old.p[key]-(base.p[key]||0),...(NUM[key]||OPTIONAL[key])).toFixed(6);
    const manualShape=old.p.adjustRegion!==base.p.adjustRegion||old.p.adjustRegionShape!==base.p.adjustRegionShape||JSON.stringify(old.p.adjustRegionStrokes||[])!==JSON.stringify(base.p.adjustRegionStrokes||[])||JSON.stringify(old.p.adjustRegionStack||[])!==JSON.stringify(base.p.adjustRegionStack||[]);
    if(manualShape)for(const [key,value]of Object.entries(old.p))if(key.startsWith('adjustRegion'))next.p[key]=copy(value);
    for(const key of ['nangManual','leakManual','sparkMode','leakShape','seed','toneLocalColor','toneLocalMode','toneLocalShape','toneLocalFill','toneLocalEnabled'])if(old.p[key]!==undefined&&old.p[key]!==base.p[key])next.p[key]=copy(old.p[key]);
    for(const group of ['focus','sun','leak'])if(base[group]&&old[group])for(const [key,value]of Object.entries(old[group]))if(finite(value))next[group][key]=clamp(next[group][key]+value-base[group][key],key==='rx'||key==='ry'?.001:0,key==='rx'||key==='ry'?2:1);
   }
   next.targetIntent.baseline=copy(newBase);components.push(next);
  }
  if(recipe.analysis?.recovery?.personLightVersion!==1){
   const oldFaces=recipe.components.filter(c=>/^face-\d+$/.test(c.id)),hadFace=(recipe.analysis?.recovery?.faces||[]).length>0,canIntroduce=!oldFaces.length&&(!rescueStyle(recipe.style)?recipe.components.some(c=>c.role==='subject'):!hadFace),ids=new Set(components.map(c=>c.id)),added=[];
   for(const c of generated.components.filter(c=>c.id.startsWith('face-')&&!ids.has(c.id))){const main=oldFaces.find(old=>c.id==='face-shadow-'+old.id.slice(5));if(canIntroduce)added.push(copy(c));else if(main){const next=copy(c);next.enabled=main.enabled!==false&&['toneExposure','toneBrightness','toneShadows','filmExp'].some(k=>Math.abs(Number(main.p[k])||0)>.001);added.push(next);}}
   if(added.length){const index=components.findIndex(c=>c.id==='clarity'||c.id==='texture');components.splice(index<0?components.length:index,0,...added);}
  }
  const chosenSeed=(seed??recipe.seed)>>>0;
  return {...generated,id:'ray-ai-'+newAnalysis.fingerprint+'-'+recipe.style+'-'+chosenSeed,seed:chosenSeed,title:recipe.title||generated.title,basePreset:copy(recipe.basePreset||generated.basePreset),components};
 }

 return {VERSION:1,styles,STYLES:styles,styleCuration:copy(styleCuration),getVisibleStyles,needsPersonRefinement,analyze,generate,scale,adapt,mixParameters,effectKeys:EFFECTS.slice(),parameterRanges:copy({...NUM,...OPTIONAL})};
});
