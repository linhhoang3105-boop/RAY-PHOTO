/* LaMa input geometry and masked compositing, shared by the worker and tests. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RayInpaintCore=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const size=512,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function reflect(x,n){if(n<=1)return 0;const period=2*(n-1);x=(x%period+period)%period;return x<=n-1?x:period-x;}
 function prepare(image){
  const {width:W,height:H,data}=image,N=W*H;
  if(!Number.isInteger(W)||!Number.isInteger(H)||W<4||H<4||N>1024*1024||data?.length!==N*4||image.mask?.length!==N)throw Error('Ảnh hoặc vùng chọn chưa hợp lệ.');
  const selected=Uint8Array.from(image.mask,v=>v>.08?1:0);let count=selected.reduce((a,b)=>a+b,0);
  if(!count)throw Error('Tô lên người hoặc vật cần xóa trước.');if(count>N*.7)throw Error('Vùng chọn quá rộng. Hãy xóa từng vùng nhỏ hơn.');
  const radius=clamp(Math.round(Number(image.padding)||0),0,12);
  if(radius){const horizontal=new Uint8Array(N);for(let y=0;y<H;y++)for(let x=0;x<W;x++){for(let dx=-radius;dx<=radius;dx++)if(x+dx>=0&&x+dx<W&&selected[y*W+x+dx]){horizontal[y*W+x]=1;break;}}for(let y=0;y<H;y++)for(let x=0;x<W;x++){selected[y*W+x]=0;for(let dy=-radius;dy<=radius;dy++)if(y+dy>=0&&y+dy<H&&horizontal[(y+dy)*W+x]){selected[y*W+x]=1;break;}}}
  const protection=image.protect?.length===N?new Float32Array(image.protect):null;let left=W,top=H,right=0,bottom=0;count=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(protection?.[i]>.05)selected[i]=0;if(selected[i]){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;}}
  if(!count)throw Error('Vùng xóa đang nằm trong vùng giữ lại. Chọn đúng vật cần xóa hoặc sửa vùng giữ.');
  if(count>N*.75)throw Error('Nền còn lại quá ít để tái tạo. Hãy thu nhỏ vùng chọn.');
  // Kept people are immutable output, but must not become donor context for
  // the removed person. Hide them from the model; composite only `selected`.
  const context=Uint8Array.from(selected,(v,i)=>v||protection?.[i]>.05||image.exclude?.[i]>=128?1:0);
  const seed=(Number(image.seed)||0)>>>0,flip=!!(seed&1),width=right-left+1,height=bottom-top+1,side=Math.min(Math.max(W,H),Math.max(128,Math.ceil(Math.max(width,height)*(1.4+seed%3*.08)))),
   rx=Math.round(clamp((left+right+1-side)/2,Math.min(0,W-side),Math.max(0,W-side))),ry=Math.round(clamp((top+bottom+1-side)/2,Math.min(0,H-side),Math.max(0,H-side))),roi={x:rx,y:ry,size:side},step=side/size,n=size*size,tensor=new Float32Array(n*4);let visible=0;
  // Preserve aspect ratio and context. Reflection supplies context at photo
  // edges; its mask is reflected too, so the removed object cannot leak back.
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const i=y*size+x,px=rx+((flip?size-1-x:x)+.5)*step-.5,py=ry+(y+.5)*step-.5,span=Math.max(.5,step/2);let hole=0;
   for(let yy=Math.ceil(py-span);yy<=Math.floor(py+span)&&!hole;yy++)for(let xx=Math.ceil(px-span);xx<=Math.floor(px+span);xx++)if(context[reflect(yy,H)*W+reflect(xx,W)]){hole=1;break;}
   if(!hole)hole=context[Math.round(reflect(py,H))*W+Math.round(reflect(px,W))];
   tensor[n*3+i]=hole;if(hole)continue;visible++;
   const sx=reflect(px,W),sy=reflect(py,H),x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(W-1,x0+1),y1=Math.min(H-1,y0+1),u=sx-x0,v=sy-y0;
   for(let ch=0;ch<3;ch++)tensor[n*ch+i]=((data[(y0*W+x0)*4+ch]*(1-u)+data[(y0*W+x1)*4+ch]*u)*(1-v)+(data[(y1*W+x0)*4+ch]*(1-u)+data[(y1*W+x1)*4+ch]*u)*v)/255;
  }
  if(visible<n*.02)throw Error('Chưa đủ nền sạch quanh vùng xóa để tái tạo. Thu nhỏ vùng xóa hoặc chỉnh lại vùng giữ.');
  return{tensor,selected,protection,roi,flip,width,height,left,top,photoWidth:W,photoHeight:H,pixels:count,original:data,context};
 }
 function result(prepared,output){
  const n=size*size;if(!output||output.length!==n*3)throw Error('AI chưa trả được nền hợp lệ.');
  for(let i=0;i<output.length;i++)if(!Number.isFinite(output[i]))throw Error('AI chưa tái tạo được nền. Vùng chọn vẫn được giữ.');
  const {width,height,left,top,photoWidth:W,photoHeight:H,roi,flip,selected,protection,pixels}=prepared,data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const k=(y*width+x)*4,position=clamp((left+x+.5-roi.x)*size/roi.size-.5,0,size-1),px=flip?size-1-position:position,py=clamp((top+y+.5-roi.y)*size/roi.size-.5,0,size-1),x0=Math.floor(px),y0=Math.floor(py),x1=Math.min(size-1,x0+1),y1=Math.min(size-1,y0+1),u=px-x0,v=py-y0;
   for(let ch=0;ch<3;ch++){const start=ch*n;data[k+ch]=255*((output[start+y0*size+x0]*(1-u)+output[start+y0*size+x1]*u)*(1-v)+(output[start+y1*size+x0]*(1-u)+output[start+y1*size+x1]*u)*v);}
   data[k+3]=selected[(top+y)*W+left+x]?255:0;
  }
  return{width,height,data,placement:[width/W,0,0,height/H,left/W,top/H],sampling:{width:W,height:H,x:left,y:top},protection,pixels,patches:1,generated:true,engine:'lama',detail:'generated'};
 }
 // Correct only a small, smooth colour mismatch at the generated boundary.
 // The original pixels inside the hole never participate: otherwise a second
 // cleanup could blend the removed person straight back into the repair.
 function finish(prepared,patch){
  const {original,context,selected,photoWidth:W,photoHeight:H,left,top}=prepared,{width:w,height:h,data}=patch;
  if(!original||!context||!selected||!w||!h||data?.length!==w*h*4)return patch;
  const gw=Math.min(32,Math.max(2,Math.ceil(w/8))),gh=Math.min(32,Math.max(2,Math.ceil(h/8))),n=gw*gh,active=new Uint8Array(n),weight=new Float32Array(n),sums=new Float32Array(n*3),samples=[];
  const cell=(x,y)=>Math.min(gh-1,Math.floor(y*gh/h))*gw+Math.min(gw-1,Math.floor(x*gw/w));
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(selected[(top+y)*W+left+x]&&data[(y*w+x)*4+3])active[cell(x,y)]=1;
  const stride=Math.max(1,Math.ceil(w*h/16384));
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const X=left+x,Y=top+y,k=(y*w+x)*4;if(!selected[Y*W+X]||!data[k+3])continue;
   if((y*w+x)%stride)continue;
   for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){
    const ax=X+dx,ay=Y+dy,bx=X+2*dx,by=Y+2*dy;if(ax<0||ay<0||bx<0||by<0||ax>=W||ay>=H||bx>=W||by>=H)continue;
    const a=ay*W+ax,b=by*W+bx;if(context[a]||context[b]||original[a*4+3]<240||original[b*4+3]<240)continue;
    const target=[],delta=[];let gradient=0,largest=0;for(let ch=0;ch<3;ch++){gradient+=Math.abs(original[a*4+ch]-original[b*4+ch]);target[ch]=clamp(2*original[a*4+ch]-original[b*4+ch],0,255);delta[ch]=target[ch]-data[k+ch];largest=Math.max(largest,Math.abs(delta[ch]));}
    // A rail, hair edge or a high contrast texture is not a colour seam.
    if(gradient>48||largest>72)continue;
    const g=cell(x,y);weight[g]++;for(let ch=0;ch<3;ch++)sums[g*3+ch]+=clamp(delta[ch],-32,32);samples.push({x,y,k,g,target});
   }
  }
  if(samples.length<8)return patch;
  // Independent disconnected selections must not borrow a colour correction
  // from one another. Each coarse component needs its own clean boundary.
  const labels=new Int16Array(n).fill(-1),components=[];
  for(let start=0;start<n;start++)if(active[start]&&labels[start]<0){const id=components.length,queue=[start],mean=[0,0,0];let total=0;labels[start]=id;for(let q=0;q<queue.length;q++){const i=queue[q],x=i%gw,y=Math.floor(i/gw);total+=weight[i];for(let ch=0;ch<3;ch++)mean[ch]+=sums[i*3+ch];for(const j of [x?i-1:-1,x+1<gw?i+1:-1,y?i-gw:-1,y+1<gh?i+gw:-1])if(j>=0&&active[j]&&labels[j]<0){labels[j]=id;queue.push(j);}}components.push({nodes:queue,total,mean:mean.map(v=>v/Math.max(1,total))});}
  let field=new Float32Array(n*3),next=new Float32Array(n*3);for(const c of components)if(c.total>=8)for(const i of c.nodes)for(let ch=0;ch<3;ch++)field[i*3+ch]=c.mean[ch];
  for(let iteration=0;iteration<144;iteration++){
   for(let i=0;i<n;i++){if(!active[i]||components[labels[i]].total<8)continue;const x=i%gw,y=Math.floor(i/gw),neighbors=[x?i-1:-1,x+1<gw?i+1:-1,y?i-gw:-1,y+1<gh?i+gw:-1].filter(j=>j>=0&&active[j]),anchor=weight[i]?4:0,den=neighbors.length+anchor;for(let ch=0;ch<3;ch++){let sum=anchor?sums[i*3+ch]/weight[i]*anchor:0;for(const j of neighbors)sum+=field[j*3+ch];next[i*3+ch]=den?sum/den:field[i*3+ch];}}
   const swap=field;field=next;next=swap;
  }
  function correction(x,y,ch){const gx=clamp((x+.5)*gw/w-.5,0,gw-1),gy=clamp((y+.5)*gh/h-.5,0,gh-1),x0=Math.floor(gx),y0=Math.floor(gy),x1=Math.min(gw-1,x0+1),y1=Math.min(gh-1,y0+1),u=gx-x0,v=gy-y0,label=labels[cell(x,y)];let sum=0,total=0;for(const [i,t]of [[y0*gw+x0,(1-u)*(1-v)],[y0*gw+x1,u*(1-v)],[y1*gw+x0,(1-u)*v],[y1*gw+x1,u*v]])if(labels[i]===label){sum+=field[i*3+ch]*t;total+=t;}return total?sum/total:0;}
  const errors=components.map(()=>({before:0,after:0,used:0}));for(const s of samples){if(components[labels[s.g]].total<8)continue;const error=errors[labels[s.g]];error.used++;for(let ch=0;ch<3;ch++){error.before+=Math.abs(s.target[ch]-data[s.k+ch]);error.after+=Math.abs(s.target[ch]-Math.round(clamp(data[s.k+ch]+correction(s.x,s.y,ch),0,255)));}}
  const enabled=errors.map(e=>e.used>=8&&e.before/e.used/3>=2&&e.after<=e.before*.9);if(!enabled.some(Boolean))return patch;
  let before=0,after=0,used=0;errors.forEach((e,i)=>{if(enabled[i]){before+=e.before;after+=e.after;used+=e.used;}});
  const adjusted=new Uint8ClampedArray(data);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const k=(y*w+x)*4,g=cell(x,y);if(!selected[(top+y)*W+left+x]||!data[k+3]||!enabled[labels[g]])continue;for(let ch=0;ch<3;ch++)adjusted[k+ch]=data[k+ch]+correction(x,y,ch);}
  return{...patch,data:adjusted,harmonization:{samples:used,before:before/used/3,after:after/used/3,maxCorrection:32}};
 }
 return{size,prepare,result,finish};
});
