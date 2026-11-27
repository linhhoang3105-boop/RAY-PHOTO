/* Device-local scene-color regions. Reuse RAY vector masks; never replace source pixels. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./region-paint-core.js'):root.RayRegionPaint);if(typeof module==='object'&&module.exports)module.exports=api;else root.RayAIComposerRegions=api;})(typeof globalThis!=='undefined'?globalThis:this,(Paint)=>{
 'use strict';
 const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:0)),lum=(r,g,b)=>(r*.2126+g*.7152+b*.0722)/255,copy=v=>JSON.parse(JSON.stringify(v));
 const area=points=>points.reduce((n,p,i)=>{const q=points[(i+1)%points.length];return n+p[0]*q[1]-q[0]*p[1];},0)/2;
 function region(mask,W,H,samples,confidence,subject){
  let count=0,x0=W,y0=H,x1=0,y1=0,total=0,chroma=0,warm=0,tint=0,high=0;const histogram=new Float64Array(256);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const j=y*W+x;if(!mask[j])continue;const [r,g,b,l,s]=samples[j];count++;total+=l;chroma+=s;warm+=(r-b)/255;tint+=((r+b)/2-g)/255;high+=l>.86;x0=Math.min(x0,x);x1=Math.max(x1,x+1);y0=Math.min(y0,y);y1=Math.max(y1,y+1);histogram[Math.round(l*255)]++;}
  const coverage=count/(W*H);if(count<12||coverage<.008||!Paint?.contours)return null;
  const paths=Paint.contours({width:W,height:H,data:mask},.5).filter(p=>p.length>=4&&Math.abs(area(p))>.0002).sort((a,b)=>Math.abs(area(b))-Math.abs(area(a))).slice(0,10),points=[],budget=Math.max(12,Math.floor(600/Math.max(1,paths.length)));
  for(const path of paths){const step=Math.max(1,Math.ceil((path.length-1)/(budget-1))),loop=path.filter((_,i)=>i%step===0).map(p=>[clamp(p[0]),clamp(p[1])]);if(loop.length<3)continue;if(loop[0][0]!==loop.at(-1)[0]||loop[0][1]!==loop.at(-1)[1])loop.push([...loop[0]]);if(points.length)points.push([...loop[0]],...loop.slice(1),[...points[0]]);else points.push(...loop);}
  if(points.length<4)return null;
  const focus={cx:(x0+x1)/2/W,cy:(y0+y1)/2/H,rx:Math.max(.004,(x1-x0)/2/W),ry:Math.max(.004,(y1-y0)/2/H)},p={adjustRegion:'in',adjustRegionShape:'freehand',adjustRegionX:focus.cx,adjustRegionY:focus.cy,adjustRegionRX:focus.rx,adjustRegionRY:focus.ry,adjustRegionAngle:0,adjustRegionFeather:.45,adjustRegionStrokes:[{mode:'lasso',size:.004,points}]};
  if(subject?.source==='ai'||subject?.source==='face')p.adjustRegionStack=[{...copy(subject.p),adjustRegion:'out'}];
  const percentile=q=>{let n=0;for(let i=0;i<256;i++){n+=histogram[i];if(n>=count*q)return i/255;}return 1;};
  return{confidence:clamp(confidence),coverage,mean:total/count,p10:percentile(.1),p90:percentile(.9),highlightCoverage:high/count,colorfulness:chroma/count,warmCast:clamp(warm/count,-1,1),tintCast:clamp(tint/count,-1,1),focus,p};
 }
 function analyze(data,W,H,{foreground=null,skin=null,hair=null,faces=[],region:subject=null}={}){
  if(!data||!Number.isInteger(W)||!Number.isInteger(H)||W<1||H<1||data.length!==W*H*4)throw Error('Ảnh phân vùng màu chưa hợp lệ.');
  const scale=Math.min(1,112/Math.max(W,H)),w=Math.max(2,Math.round(W*scale)),h=Math.max(2,Math.round(H*scale)),N=w*h,samples=new Array(N),protectedPixels=new Uint8Array(N),eligible=new Uint8Array(N),blue=new Uint8Array(N),sky=new Float32Array(N),land=new Float32Array(N),queue=new Int32Array(N),upperBlueLuma=[];let blueCount=0,upperBlueCount=0,tail=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const u=(x+.5)/w,v=(y+.5)/h,j=y*w+x,i=(Math.min(H-1,Math.floor(v*H))*W+Math.min(W-1,Math.floor(u*W)))*4,r=data[i],g=data[i+1],b=data[i+2],l=lum(r,g,b),s=(Math.max(r,g,b)-Math.min(r,g,b))/255,cb=128-.168736*r-.331264*g+.5*b,cr=128+.5*r-.418688*g-.081312*b,skinFallback=!skin&&r>45&&r>g*.95&&r>b*1.08&&cb>76&&cb<128&&cr>132&&cr<178;let protect=data[i+3]<220||skinFallback||!hair&&l<.10||(foreground?.at(u,v)||0)>.16||(skin?.at(u,v)||0)>.15||(hair?.at(u,v)||0)>.08;
   for(const face of faces){const f=face.focus;if(f&&((u-f.cx)/(f.rx*1.20))**2+((v-f.cy)/(f.ry*1.20))**2<1)protect=true;}
   samples[j]=[r,g,b,l,s];protectedPixels[j]=protect?1:0;if(protect)continue;
   const cool=b>r+5&&b>g*.96&&s>.045&&l>.18;
   if(cool&&v<.55){blue[j]=1;blueCount++;if(v<.26)upperBlueCount++;if(v<.13)upperBlueLuma.push(l);}
  }
  // Meter the upper blue region rather than imposing one brightness cutoff:
  // darker blue skies remain eligible while distant, darker blue hills stop
  // the flood. Bright cloud pixels can bridge the same connected sky region.
  upperBlueLuma.sort((a,b)=>a-b);const skyFloor=clamp((upperBlueLuma[Math.floor(upperBlueLuma.length*.30)]??.66)-.08,.24,.64);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const j=y*w+x,[r,g,b,l,s]=samples[j];if(!protectedPixels[j]&&((b>r+5&&b>g*.96&&s>.045&&l>skyFloor)||(l>.67&&s<.21)))eligible[j]=1;}
  // A sky candidate needs blue/cool evidence plus connection to an upper image
  // edge. White walls alone and isolated blue clothing cannot seed a sky mask.
  if(blueCount>N*.004&&upperBlueCount>Math.max(2,N*.001)&&upperBlueLuma.length>Math.max(2,N*.001)){
   for(let y=0;y<Math.max(1,Math.round(h*.13));y++)for(let x=0;x<w;x++){const j=y*w+x;if(eligible[j]&&!sky[j]){sky[j]=1;queue[tail++]=j;}}
   for(let head=0;head<tail;head++){const j=queue[head],x=j%w,y=Math.floor(j/w);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,k=yy*w+xx;if(xx>=0&&xx<w&&yy>=0&&yy<h&&eligible[k]&&!sky[k]){sky[k]=1;queue[tail++]=k;}}}
  }
  const clouds=new Float32Array(N),vegetation=new Float32Array(N),terrain=new Float32Array(N);let skyBlue=0,skyN=0,landN=0,cloudN=0,vegetationN=0,terrainN=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const j=y*w+x,[r,g,b,l,s]=samples[j],v=(y+.5)/h;if(sky[j]){skyN++;skyBlue+=blue[j];continue;}if(protectedPixels[j])continue;
   const foliage=g>r*.97&&g>b*1.025&&s>.07&&l>.07,blueRidge=b>r*1.04&&l<.62&&s>.045,earth=v>.35&&r>g*.98&&g>b*1.03&&s>.07&&l>.08&&l<.86;
   if(foliage||blueRidge||earth){land[j]=1;landN++;if(foliage){vegetation[j]=1;vegetationN++;}else{terrain[j]=1;terrainN++;}}
  }
  // An indoor portrait can still have a real background-color region even
  // without vegetation. Do not invent a sky or a region on an empty image.
  let backgroundFallback=false;if(landN<N*.008&&subject?.source==='ai'&&foreground){for(let j=0;j<N;j++)if(!protectedPixels[j]&&!sky[j]){land[j]=1;landN++;}backgroundFallback=true;}
  const skyConfidence=skyN?clamp(.46+Math.min(.24,skyBlue/N*2)+Math.min(.22,skyN/N)) : 0,landConfidence=backgroundFallback?.48:landN?clamp(.48+Math.min(.28,landN/N*.7)):0;
  const skyRegion=skyN&&skyBlue>Math.max(3,N*.002)?region(sky,w,h,samples,skyConfidence,subject):null;
  // Keep the aggregate regions portable for older formulas. Their optional
  // subregions let the orchestrator reserve neutral cloud highlights and grade
  // foliage independently of earth/ridges. These remain color estimates, not
  // claims of semantic segmentation, and never include protected pixels.
  if(skyRegion)for(let j=0;j<N;j++){const [r,g,b,l,s]=samples[j];if(sky[j]&&l>.60&&s<.17&&Math.min(r,g,b)>122){clouds[j]=1;cloudN++;}}
  const result={version:1,sky:skyRegion,land:region(land,w,h,samples,landConfidence,subject)},optional=[['clouds',clouds,cloudN,Math.min(skyConfidence,.84)],['vegetation',vegetation,vegetationN,clamp(.52+Math.min(.25,vegetationN/N*.7))],['terrain',terrain,terrainN,clamp(.50+Math.min(.24,terrainN/N*.7))]];
  for(const [name,mask,count,confidence]of optional){if(!count)continue;const value=region(mask,w,h,samples,confidence,subject);if(value)result[name]=value;}
  return result;
 }
 return{VERSION:1,analyze};
});
