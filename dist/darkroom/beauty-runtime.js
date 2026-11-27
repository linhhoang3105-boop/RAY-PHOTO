/* Bound AI model lifetime. This adapter preserves the supplied film renderer. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.RayBeautyRuntime=api;api.init();}})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
async function engine(assets,loadLibrary=url=>import(url)){
  const limit=(promise,ms)=>new Promise((resolve,reject)=>{
    let expired=false;const timer=setTimeout(()=>{expired=true;reject(new Error("Tải AI quá lâu"));},ms);
    Promise.resolve(promise).then(v=>{clearTimeout(timer);if(expired){try{v?.close?.();}catch{}return;}resolve(v);},e=>{clearTimeout(timer);reject(e);});
  });
  let api,files;const libErrors=[];
  for(const root of assets.roots){
    try{
      api=await limit(loadLibrary(root+"/vision_bundle.mjs"),20000);
      files=await limit(api.FilesetResolver.forVisionTasks(root+"/wasm"),10000);
      break;
    }catch(e){api=null;libErrors.push(String(e&&e.message||e).slice(0,60));}
  }
  if(!api) throw new Error("Không tải được thư viện AI ("+libErrors.join(" / ")+")");
  const clamp01=x=>x<0?0:x>1?1:x;
  const ramp=(v,a,b)=>{const t=clamp01((v-a)/(b-a));return t*t*(3-2*t);};
  // Keep fractional strand coverage. The multiclass mask deliberately uses a
  // stricter threshold for shared skin/background tasks; it is not a hair matte.
  function hairMatte(mask,W,H,semantic,originalHair){
    const sw=mask.width,sh=mask.height,raw=mask.getAsFloat32Array();
    if(!Number.isInteger(sw)||!Number.isInteger(sh)||sw<1||sh<1||raw.length!==sw*sh)throw new Error("Mặt nạ tóc không hợp lệ");
    const alpha=new Float32Array(raw.length);
    for(let i=0;i<raw.length;i++){const p=Number.isFinite(raw[i])?clamp01(raw[i]):0;alpha[i]=clamp01((p-.035)/.93)*ramp(p,.035,.14);}
    const axes=(from,to)=>Array.from({length:to},(_,i)=>{
      if(from>to){const left=i*from/to,right=(i+1)*from/to,weights=[];for(let j=Math.floor(left);j<Math.ceil(right);j++)weights.push([Math.min(from-1,j),(Math.min(right,j+1)-Math.max(left,j))/(right-left)]);return weights;}
      const p=Math.max(0,Math.min(from-1,(i+.5)*from/to-.5)),a=Math.floor(p),f=p-a;return [[a,1-f],[Math.min(from-1,a+1),f]];
    });
    const X=sw===W?null:axes(sw,W),Y=sh===H?null:axes(sh,H),hair=new Uint8Array(W*H),distance=new Uint8Array(W*H).fill(255),queue=new Int32Array(W*H),limit=Math.max(3,Math.min(32,Math.ceil(Math.min(W,H)*.04)));let tail=0;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      let a=0,p=0;if(!X&&!Y){a=alpha[y*W+x];p=raw[y*W+x];}
      else for(const [yy,wy]of Y?Y[y]:[[y,1]])for(const [xx,wx]of X?X[x]:[[x,1]]){const k=yy*sw+xx,w=wy*wx;a+=alpha[k]*w;p+=(Number.isFinite(raw[k])?clamp01(raw[k]):0)*w;}
      const k=y*W+x,skin=(semantic?.skin[k]||0)/255,h=(semantic?.hair[k]||0)/255,other=(semantic?.other[k]||0)/255;
      // Hair-only inference can mistake fur, clothing or texture for human hair.
      // Require multiclass hair evidence, reject certain non-hair, and protect
      // skin without discarding the soft roots that both models agree on.
      a*=ramp(h,.035,.13)*(1-ramp(other,.70,.94))*(1-ramp(skin,.55,.94));
      // Keep a useful original core when the detailed model is uncertain, but
      // do not retain it against that model's certain-background prediction.
      hair[k]=Math.round(255*Math.max(a,(originalHair[k]||0)/255*ramp(Number.isFinite(p)?p:0,.005,.08)));
      // The multiclass model can be uncertain across an entire soft/blurred
      // head. Let agreement with very confident dedicated hair establish a
      // core too, without accepting fur that has no semantic hair evidence.
      if(hair[k]&&(originalHair[k]>80||p>=.90&&h>=.12&&skin<.55&&other<.94)){distance[k]=0;queue[tail++]=k;}
    }
    // New detail must stay attached to a known hair core. A bounded expansion
    // prevents a false-positive blob from growing into a cat or the backdrop.
    for(let head=0;head<tail;head++){
      const k=queue[head],d=distance[k];if(d>=limit)continue;const x=k%W,y=Math.floor(k/W);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const xx=x+dx,yy=y+dy;if((!dx&&!dy)||xx<0||xx>=W||yy<0||yy>=H)continue;const next=yy*W+xx;
        if(distance[next]!==255||!hair[next])continue;distance[next]=d+1;queue[tail++]=next;
      }
    }
    for(let k=0;k<hair.length;k++)if(distance[k]===255)hair[k]=0;
    return hair;
  }
  const tasks={};let plainCanvas=false;
  async function task(kind,notify){
    if(!tasks[kind]) tasks[kind]=(async()=>{
      notify(kind === "segment" ? "Đang tải AI da và tóc…" : kind === "hair" ? "Đang tải AI nhận diện sợi tóc…" : kind === "pose" ? "Đang tải AI tách từng người…" : "Đang tải AI khuôn mặt…");
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
      let bytes;
      try{
        const response=await fetch(assets[kind],{signal:controller.signal,credentials:"omit"});
        if(!response.ok)throw new Error("Không tải được mô hình");
        bytes=new Uint8Array(await response.arrayBuffer());
      }finally{clearTimeout(timer);}
      const options={baseOptions:{modelAssetBuffer:bytes,delegate:"CPU"},runningMode:"IMAGE"};
      if(plainCanvas&&typeof document!=="undefined")options.canvas=document.createElement("canvas");
      if(kind === "segment"||kind === "hair"){
        Object.assign(options,{outputConfidenceMasks:true,outputCategoryMask:false});
        return limit(api.ImageSegmenter.createFromOptions(files,options),45000);
      }
      if(kind === "pose"){
        Object.assign(options,{numPoses:10,minPoseDetectionConfidence:.55,minPosePresenceConfidence:.55,outputSegmentationMasks:true});
        return limit(api.PoseLandmarker.createFromOptions(files,options),45000);
      }
      Object.assign(options,{numFaces:Number.isInteger(assets.numFaces)?Math.max(1,Math.min(10,assets.numFaces)):10,minFaceDetectionConfidence:.5,minFacePresenceConfidence:.5,
        outputFaceBlendshapes:false,outputFacialTransformationMatrixes:false});
      return limit(api.FaceLandmarker.createFromOptions(files,options),45000);
    })().catch(error=>{delete tasks[kind];throw error;});
    return tasks[kind];
  }
  async function release(kind){const pending=tasks[kind];delete tasks[kind];if(pending)try{(await pending)?.close?.();}catch{}}
  function headCrops(image,faces){
    const W=image.width,H=image.height;
    if(!Number.isFinite(W)||!Number.isFinite(H)||W<2||H<2||typeof OffscreenCanvas==='undefined'&&typeof document==='undefined')return [];
    const jobs=[];
    for(const face of faces){
      if(face.length<468||![10,152,234,454].every(i=>Number.isFinite(face[i]?.x)&&Number.isFinite(face[i]?.y)))continue;
      const points=face.filter(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)),left=Math.min(...points.map(p=>p.x))*W,right=Math.max(...points.map(p=>p.x))*W,top=Math.min(...points.map(p=>p.y))*H,bottom=Math.max(...points.map(p=>p.y))*H,fw=right-left,fh=bottom-top;
      // The full-frame model has too few head pixels in distant portraits.
      // Inspect a bounded head/shoulder crop, not a second full-size photo.
      if(fw<6||fh<6||Math.max(fw/W,fh/H)>.22)continue;
      const x=Math.max(0,Math.floor(left-fw*.9)),y=Math.max(0,Math.floor(top-fh*.85)),x1=Math.min(W,Math.ceil(right+fw*.9)),y1=Math.min(H,Math.ceil(bottom+fh*1.2)),width=x1-x,height=y1-y;
      if(width<2||height<2||width*height>W*H*.45)continue;
      if(jobs.some(j=>Math.abs((j.x+j.width/2)-(x+width/2))<Math.min(j.width,width)*.3&&Math.abs((j.y+j.height/2)-(y+height/2))<Math.min(j.height,height)*.3))continue;
      const scale=Math.min(4,512/Math.max(width,height)),w=Math.max(2,Math.round(width*scale)),h=Math.max(2,Math.round(height*scale));let canvas;
      try{canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):document.createElement('canvas');canvas.width=w;canvas.height=h;const c=canvas.getContext('2d');if(!c)throw Error('Không mở được vùng đầu');c.imageSmoothingQuality='high';c.drawImage(image,x,y,width,height,0,0,w,h);jobs.push({x,y,width,height,canvas});}catch{if(canvas)canvas.width=canvas.height=0;}
      if(jobs.length===3)break;
    }
    return jobs;
  }
  async function refineHeads(image,output,notify){
    const jobs=headCrops(image,output.faces);if(!jobs.length)return;
    let failed=false;
    try{
      notify('Đang nhìn kỹ tóc hai bên và đuôi tóc…');
      try{
        const model=await task('segment',notify);
        for(const job of jobs){let result;try{
          result=model.segment(job.canvas);const masks=result.confidenceMasks;
          if(masks?.length!==6)throw Error('Không đủ vùng đầu');
          const width=masks[0].width,height=masks[0].height,n=width*height,values=masks.map(m=>m.getAsFloat32Array()),semantic={skin:new Uint8Array(n),hair:new Uint8Array(n),other:new Uint8Array(n)},original=new Uint8Array(n);
          for(let k=0;k<n;k++){
            const skin=values[2][k]+values[3][k],hair=values[1][k],other=Math.max(values[0][k],values[4][k],values[5][k]);
            semantic.skin[k]=Math.round(clamp01(skin)*255);semantic.hair[k]=Math.round(clamp01(hair)*255);semantic.other[k]=Math.round(clamp01(other)*255);
            original[k]=255*ramp(hair,.45,.90)*ramp(hair-Math.max(skin,other),.04,.38);
          }
          job.local={width,height,semantic,original};
        }catch{failed=true;}finally{result?.close?.();}}
      }catch{failed=true;}finally{await release('segment');}
      if(!jobs.some(job=>job.local))return;
      try{
        const model=await task('hair',notify),labels=typeof model.getLabels==='function'?model.getLabels():[],label=labels.findIndex(value=>/^(?:hair|tóc)$/i.test(String(value).trim()));
        if(labels.length&&label<0)throw Error('Không có nhãn tóc');
        const maps=output.maps,W=maps.width,H=maps.height,combined=maps.hair.slice();
        for(const job of jobs){if(!job.local)continue;let result;try{
          result=model.segment(job.canvas);const masks=result.confidenceMasks,index=label>=0?label:(masks?.length===1?0:1),mask=masks?.[index];if(!mask)throw Error('Không có vùng tóc');
          const local=job.local,matte=hairMatte(mask,local.width,local.height,local.semantic,local.original),MW=local.width,MH=local.height;
          const sample=(x,y)=>{const xx=Math.max(0,Math.min(MW-1,x)),yy=Math.max(0,Math.min(MH-1,y)),x0=Math.floor(xx),y0=Math.floor(yy),fx=xx-x0,fy=yy-y0,x1=Math.min(MW-1,x0+1),y1=Math.min(MH-1,y0+1);return(matte[y0*MW+x0]*(1-fx)+matte[y0*MW+x1]*fx)*(1-fy)+(matte[y1*MW+x0]*(1-fx)+matte[y1*MW+x1]*fx)*fy;};
          const x0=Math.max(0,Math.ceil(job.x*W/image.width-.5)),y0=Math.max(0,Math.ceil(job.y*H/image.height-.5)),x1=Math.min(W,Math.ceil((job.x+job.width)*W/image.width-.5)),y1=Math.min(H,Math.ceil((job.y+job.height)*H/image.height-.5));
          for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
            const u=((x+.5)*image.width/W-job.x)/job.width,v=((y+.5)*image.height/H-job.y)/job.height,edge=Math.min(u,v,1-u,1-v),a=sample(u*MW-.5,v*MH-.5)*ramp(edge,0,.045),k=y*W+x;
            // Crop semantics protect the hand, clothing and nearby trees. Never
            // replace global skin/foreground maps or remove earlier hair.
            combined[k]=Math.max(combined[k],Math.round(a));
          }
        }catch{failed=true;}finally{result?.close?.();}}
        output.maps={...maps,hair:combined};
      }catch{failed=true;}finally{await release('hair');}
    }finally{
      for(const job of jobs)job.canvas.width=job.canvas.height=0;
      if(failed)output.warnings.push('Chưa quét kỹ được một phần tóc; đang giữ vùng tóc đã nhận diện.');
    }
  }
  return {async close(){for(const kind of Object.keys(tasks))await release(kind);},async detect(image,notify){
    const output={maps:null,faces:[],instances:[],errors:[],reasons:[],warnings:[]},kinds=assets.kinds||(assets.hair?["segment","hair","face","pose"]:["segment","face","pose"]);let semantic=null;
    for(const kind of kinds){
      if(kind === "pose"&&(!output.maps||output.faces.length<2))continue;
      if(kind === "hair"&&(!output.maps||!assets.hair))continue;
      for(let attempt=0;attempt<2;attempt++)try{
        const model=await task(kind,notify);
        notify(kind === "segment" ? "Đang tách vùng da và tóc…" : kind === "hair" ? "Đang nhận diện kỹ tóc con và mép tóc…" : kind === "pose" ? "Đang tách vùng riêng cho từng người…" : "Đang tìm các khuôn mặt…");
        await new Promise(resolve=>setTimeout(resolve,0));
        if(kind === "face") {
          output.faces=model.detect(image).faceLandmarks || [];
          // One bounded retry around detected hair makes a distant face larger for the same model.
          if(!output.faces.length&&output.maps?.hair&&(typeof OffscreenCanvas!=='undefined'||typeof document!=='undefined')){
            const m=output.maps;let x0=m.width,y0=m.height,x1=0,y1=0,hits=0;
            for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++)if(m.hair[y*m.width+x]>96){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);hits++;}
            if(hits>=12){const padX=(x1-x0)*.4,padY=(y1-y0)*.25,left=Math.max(0,(x0-padX)/m.width),top=Math.max(0,(y0-padY)/m.height),right=Math.min(1,(x1+padX)/m.width),bottom=Math.min(1,(y1+padY)/m.height),fw=right-left,fh=bottom-top;
              if(fw*fh<.8&&fw>.02&&fh>.02){const W=image.width,H=image.height,scale=Math.min(3,768/Math.max(fw*W,fh*H)),w=Math.max(2,Math.round(fw*W*scale)),h=Math.max(2,Math.round(fh*H*scale)),crop=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):document.createElement('canvas');crop.width=w;crop.height=h;
                try{const c=crop.getContext('2d');if(c){c.imageSmoothingQuality='high';c.drawImage(image,left*W,top*H,fw*W,fh*H,0,0,w,h);notify('Đang nhìn kỹ khuôn mặt trong vùng tóc…');const faces=model.detect(crop).faceLandmarks||[];output.faces=faces.map(face=>face.map(p=>({...p,x:left+p.x*fw,y:top+p.y*fh,z:(p.z||0)*fw})));}}catch{/* The optional crop retry must not discard a usable skin/hair result. */}finally{crop.width=crop.height=0;}
              }
            }
          }
        }
        else if(kind === "hair"){
          const result=model.segment(image);
          try{
            const masks=result.confidenceMasks,labels=typeof model.getLabels==='function'?model.getLabels():[],label=labels.findIndex(value=>/^(?:hair|tóc)$/i.test(String(value).trim()));
            if(!masks?.length||labels.length&&label<0)throw new Error("Mô hình không trả vùng tóc");
            const index=label>=0?label:(masks.length===1?0:1),mask=masks[index];
            if(!mask)throw new Error("Mô hình không trả vùng tóc");
            const original=output.maps.hair,refined=hairMatte(mask,output.maps.width,output.maps.height,semantic,original),threshold=Math.max(8,original.length*.00015);let hasOriginal=false,hasRefined=false,originalCore=0,refinedCore=0;
            for(let i=0;i<original.length;i++){if(original[i])hasOriginal=true;if(refined[i])hasRefined=true;if(original[i]>80)originalCore++;if(refined[i]>80)refinedCore++;}
            if(hasOriginal&&(!hasRefined||originalCore>=threshold&&refinedCore<threshold))output.warnings.push('Lượt nhận diện chi tiết chưa tìm thấy tóc rõ hơn; đang giữ vùng tóc đã nhận diện.');
            else{
              output.maps.hair=refined;
              if(!hasRefined)output.warnings.push('AI chưa nhận diện rõ tóc trong ảnh này. Thử ảnh rõ hơn hoặc nhận diện lại.');
              else if(!originalCore)output.warnings.push('Vùng tóc nhận diện còn chưa chắc chắn. Kiểm tra tóc con và đuôi tóc trước khi áp dụng.');
            }
          }finally{if(result.close)result.close();}
        }
        else if(kind === "pose"){
          const result=model.detect(image);
          try{
            output.instances=(result.segmentationMasks||[]).map((mask,k)=>{
              const raw=mask.getAsFloat32Array(),s=Math.min(1,256/Math.max(mask.width,mask.height));
              const width=Math.max(2,Math.round(mask.width*s)),height=Math.max(2,Math.round(mask.height*s)),data=new Uint8Array(width*height);
              for(let y=0;y<height;y++)for(let x=0;x<width;x++){
                const xx=Math.min(mask.width-1,Math.floor((x+.5)*mask.width/width)),yy=Math.min(mask.height-1,Math.floor((y+.5)*mask.height/height));
                data[y*width+x]=Math.round(clamp01(raw[yy*mask.width+xx])*255);
              }
              return {landmarks:result.landmarks[k]||[],width,height,data};
            });
          }finally{if(result.close)result.close();}
        }else{
          const result=model.segment(image);
          try{
            const masks=result.confidenceMasks;
            if(!masks || masks.length !== 6)throw new Error("Mô hình không trả đủ sáu vùng");
            const width=masks[0].width,height=masks[0].height,n=width*height;
            const values=masks.map(mask=>mask.getAsFloat32Array());
            const skin=new Uint8Array(n),hair=new Uint8Array(n),foreground=new Uint8Array(n);
            semantic={skin:new Uint8Array(n),hair:new Uint8Array(n),other:new Uint8Array(n)};
            // Nhãn chính thức: 0 nền, 1 tóc, 2 da cơ thể, 3 da mặt, 4 quần áo, 5 phụ kiện.
            for(let i=0;i<n;i++){
              foreground[i]=Math.round(clamp01(1-values[0][i])*255);
              const s=values[2][i]+values[3][i],h=values[1][i];
              const other=Math.max(values[0][i],values[4][i],values[5][i]);
              semantic.skin[i]=Number.isFinite(s)?Math.round(clamp01(s)*255):0;semantic.hair[i]=Number.isFinite(h)?Math.round(clamp01(h)*255):0;semantic.other[i]=Number.isFinite(other)?Math.round(clamp01(other)*255):255;
              skin[i]=255*ramp(s,.45,.90)*ramp(s-Math.max(h,other),.04,.38);
              hair[i]=255*ramp(h,.45,.90)*ramp(h-Math.max(s,other),.04,.38);
            }
            output.maps={width,height,skin,hair,foreground};
          }finally{if(result.close)result.close();}
        }
        break;
      }catch(e){
        const text=String(e&&e.message||e);
        if(attempt===0&&!plainCanvas&&typeof document!=="undefined"&&/clone/i.test(text)){
          plainCanvas=true;notify("Đang thử lại bằng chế độ tương thích…");continue;
        }
        output.errors.push(kind);
        output.reasons.push(kind+": "+(e&&e.name&&e.name!=="Error"?e.name+" ":"")+text.slice(0,70)+(e&&e.stack&&typeof DOMException!=="undefined"&&e instanceof DOMException?" @"+String(e.stack).split("\n").slice(0,2).join("|").replace(/https?:\/\/[^\s|]*\//g,"").slice(0,90):""));
        break;
      }finally{await release(kind);}
    }
    if(output.maps&&assets.hair&&kinds.includes('hair')&&kinds.includes('face')&&assets.refineHeads!==false)await refineHeads(image,output,notify);
    const primary=kinds.filter(kind=>kind==="segment"||kind==="face");
    if(primary.length?primary.every(kind=>output.errors.includes(kind)):!output.maps&&!output.faces.length)throw new Error("Không khởi chạy được AI làm đẹp ("+output.reasons.join("; ")+")");
    return output;
  }};
}
 const api={engine};
 api.init=()=>{
  if(typeof beautyEngine==='undefined'||typeof BEAUTY_ASSETS==='undefined')return;
  beautyEngine=engine;
  if(!BEAUTY_ASSETS.hair)BEAUTY_ASSETS.hair=document.currentScript?.src?new URL('../vendor/mediapipe/hair_segmenter.tflite',document.currentScript.src).href:'https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/1/hair_segmenter.tflite';
  const detect=beautyDetect;let scanRequest=null;
  beautyDetect=async function(input,id){
   const light=document.body.dataset.lightPreview==='true',category=document.querySelector('.beauty-categories .active')?.dataset.category;
   // Hair uses face landmarks for ownership; body pose is optional for this
   // tool and must not hold usable hair results behind a second-person scan.
   scanRequest={id,image:source,category,firstPeople:!BEAUTY.people.length};
   BEAUTY_ASSETS.kinds=category==='brow'?['face']:category==='hair'?['segment','hair','face']:['segment','hair','face','pose'];
   let reduced=null;
   try{
    if(light&&Math.max(input.width,input.height)>768){const ratio=768/Math.max(input.width,input.height);reduced=document.createElement('canvas');reduced.width=Math.max(2,Math.round(input.width*ratio));reduced.height=Math.max(2,Math.round(input.height*ratio));reduced.getContext('2d').drawImage(input,0,0,reduced.width,reduced.height);}
    return await detect(reduced||input,id);
   }finally{
    if(reduced)reduced.width=reduced.height=0;
    if(id===BEAUTY.job){
     beautyWorkerStop();const main=BEAUTY.main;BEAUTY.main=null;BEAUTY.mainRun=null;
     if(main)try{await(await main).close();}catch{}
    }
   }
  };
  if(typeof beautyAssignPeople==='function'){
   const assign=beautyAssignPeople;
   beautyAssignPeople=function(...args){
    const result=assign.apply(this,args),request=scanRequest;
    // A fresh group scan defaults to the leftmost face. A cap-wearing person
    // can have no hair matte while the foreground person's hair is ready.
    // Keep existing/explicit selections; only improve that first default.
    if(!BEAUTY.busy||!request||request.id!==BEAUTY.job||request.image!==source||request.category!=='hair'||document.querySelector('.beauty-categories .active')?.dataset.category!=='hair'||!request.firstPeople||BEAUTY.people[BEAUTY.selected]?.ready?.hair)return result;
    let best=-1,area=-1;
    BEAUTY.people.forEach((person,index)=>{if(!person.ready?.hair)return;const size=person.g?.w*person.g?.h,score=Number.isFinite(size)?size:0;if(score>area){best=index;area=score;}});
    if(best>=0){BEAUTY.selected=best;BEAUTY.values=BEAUTY.people[best].values;}
    return result;
   };
  }
  const scan=document.getElementById('beautyScan'),scanPhoto=scan.onclick;let starting=false;
  scan.onclick=async function(e){
   if(starting||!source||BEAUTY.busy)return;starting=true;const image=source;scan.disabled=true;
   try{await window.RaySession?.saveDraft(false);if(source===image)return await scanPhoto.call(this,e);}
   finally{starting=false;beautyUI();}
  };
  const originalUI=beautyUI;
  let lastCategory,lastPerson,lastSource;let lastHairState;
  api.onCategory=key=>{
   if(BEAUTY.busy)return;
   const missingHair=key==='hair'&&!beautySelectedReady().hair,recognized=BEAUTY.people.map((p,i)=>p.ready?.hair?i+1:0).filter(Boolean),hairState=recognized.join(',')+'|'+!!BEAUTY.maps;
   scan.textContent=key==='brow'?'AI · Nhận diện khuôn mặt cho mày':key==='hair'?(missingHair&&!recognized.length?'AI · Nhận diện tóc':'AI · Nhận diện lại tóc'):(BEAUTY.maps||BEAUTY.faces.length?'AI · Nhận diện lại':'AI · Nhận diện da, tóc và mặt');
   if(source&&missingHair&&(lastCategory!==key||lastPerson!==BEAUTY.selected||lastSource!==source||lastHairState!==hairState))beautyMessage(recognized.length?'Đã nhận diện tóc của Người '+recognized.join(', Người ')+'. Chọn ảnh nhỏ của người muốn nhuộm rồi chọn màu và kéo Độ phủ màu tóc.':(BEAUTY.faces.length&&!BEAUTY.maps?'Lần quét khuôn mặt chưa nhận diện vùng tóc.':BEAUTY.people.length>1?'Chưa xác định rõ tóc của người đang chọn.':'Chưa xác định rõ vùng tóc.')+' Bấm “AI · Nhận diện tóc” để quét tóc trước khi chọn màu.');
   lastCategory=key;lastPerson=BEAUTY.selected;lastSource=source;lastHairState=hairState;
  };
  beautyUI=function(){originalUI();api.onCategory(document.querySelector('.beauty-categories .active')?.dataset.category);};
 };
 return api;
});
