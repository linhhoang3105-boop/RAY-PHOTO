/* ============ làm đẹp: tách vùng da/tóc và mốc makeup, độc lập với P/preset ============ */
const BEAUTY_DEFAULT = {skin:0,smooth:0,hair:0,lip:0,blush:0,brow:0,
  hairColor:"#794437",lipColor:"#b7374d",blushColor:"#dc7b88",browColor:"#553c32"};
const BEAUTY = {values:{...BEAUTY_DEFAULT},open:false,peek:false,busy:false,job:0,source:null,
  maps:null,faces:[],people:[],selected:0,nextPerson:0,instances:[],worker:null,pending:null,main:null,mainRun:null,faceCache:null,ready:{skin:false,smooth:false,hair:false,face:false}};
const BEAUTY_ASSETS = {
  roots:BODY_AI_ASSETS.roots,
  segment:"https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite",
  hair:"https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/1/hair_segmenter.tflite",
  face:BODY_AI_ASSETS.face,pose:BODY_AI_ASSETS.pose
};
async function beautyEngine(assets){
  const limit=(promise,ms)=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error("Tải AI quá lâu")),ms);
    Promise.resolve(promise).then(v=>{clearTimeout(timer);resolve(v);},e=>{clearTimeout(timer);reject(e);});
  });
  let api,files;const libErrors=[];
  for(const root of assets.roots){
    try{
      api=await limit(import(root+"/vision_bundle.mjs"),20000);
      files=await limit(api.FilesetResolver.forVisionTasks(root+"/wasm"),10000);
      break;
    }catch(e){api=null;libErrors.push(String(e&&e.message||e).slice(0,60));}
  }
  if(!api) throw new Error("Không tải được thư viện AI ("+libErrors.join(" / ")+")");
  const clamp01=x=>x<0?0:x>1?1:x;
  const tasks={};let plainCanvas=false;
  async function task(kind,notify){
    if(!tasks[kind]) tasks[kind]=(async()=>{
      notify(kind === "segment" ? "Đang tải AI da và tóc…" : kind === "pose" ? "Đang tải AI tách từng người…" : "Đang tải AI khuôn mặt…");
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
      let bytes;
      try{
        const response=await fetch(assets[kind],{signal:controller.signal,credentials:"omit"});
        if(!response.ok)throw new Error("Không tải được mô hình");
        bytes=new Uint8Array(await response.arrayBuffer());
      }finally{clearTimeout(timer);}
      const options={baseOptions:{modelAssetBuffer:bytes,delegate:"CPU"},runningMode:"IMAGE"};
      if(plainCanvas&&typeof document!=="undefined")options.canvas=document.createElement("canvas");
      if(kind === "segment"){
        Object.assign(options,{outputConfidenceMasks:true,outputCategoryMask:false});
        return limit(api.ImageSegmenter.createFromOptions(files,options),45000);
      }
      if(kind === "pose"){
        Object.assign(options,{numPoses:10,minPoseDetectionConfidence:.55,minPosePresenceConfidence:.55,outputSegmentationMasks:true});
        return limit(api.PoseLandmarker.createFromOptions(files,options),45000);
      }
      Object.assign(options,{numFaces:10,minFaceDetectionConfidence:.55,minFacePresenceConfidence:.55,
        outputFaceBlendshapes:false,outputFacialTransformationMatrixes:false});
      return limit(api.FaceLandmarker.createFromOptions(files,options),45000);
    })().catch(error=>{delete tasks[kind];throw error;});
    return tasks[kind];
  }
  return {async detect(image,notify){
    const output={maps:null,faces:[],instances:[],errors:[],reasons:[]};
    for(const kind of ["segment","face","pose"]){
      if(kind === "pose"&&(!output.maps||output.faces.length<2))continue;
      for(let attempt=0;attempt<2;attempt++)try{
        const model=await task(kind,notify);
        notify(kind === "segment" ? "Đang tách vùng da và tóc…" : kind === "pose" ? "Đang tách vùng riêng cho từng người…" : "Đang tìm các khuôn mặt…");
        await new Promise(resolve=>setTimeout(resolve,0));
        if(kind === "face") output.faces=model.detect(image).faceLandmarks || [];
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
            const skin=new Uint8Array(n),hair=new Uint8Array(n);
            // Nhãn chính thức: 0 nền, 1 tóc, 2 da cơ thể, 3 da mặt, 4 quần áo, 5 phụ kiện.
            const ramp=(v,a,b)=>{let t=(v-a)/(b-a);t=t<0?0:t>1?1:t;return t*t*(3-2*t);};
            for(let i=0;i<n;i++){
              const s=values[2][i]+values[3][i],h=values[1][i];
              const other=Math.max(values[0][i],values[4][i],values[5][i]);
              skin[i]=255*ramp(s,.45,.90)*ramp(s-Math.max(h,other),.04,.38);
              hair[i]=255*ramp(h,.45,.90)*ramp(h-Math.max(s,other),.04,.38);
            }
            output.maps={width,height,skin,hair};
          }finally{if(result.close)result.close();}
        }
        break;
      }catch(e){
        const text=String(e&&e.message||e);
        if(attempt===0&&!plainCanvas&&typeof document!=="undefined"&&/clone/i.test(text)){
          plainCanvas=true;delete tasks[kind];notify("Đang thử lại bằng chế độ tương thích…");continue;
        }
        output.errors.push(kind);
        output.reasons.push(kind+": "+(e&&e.name&&e.name!=="Error"?e.name+" ":"")+text.slice(0,70)+(e&&e.stack&&typeof DOMException!=="undefined"&&e instanceof DOMException?" @"+String(e.stack).split("\n").slice(0,2).join("|").replace(/https?:\/\/[^\s|]*\//g,"").slice(0,90):""));
        break;
      }
    }
    if(["segment","face"].every(kind=>output.errors.includes(kind)))throw new Error("Không khởi chạy được AI làm đẹp ("+output.reasons.join("; ")+")");
    return output;
  }};
}
function beautyWorkerStop(){
  if(BEAUTY.worker){BEAUTY.worker.terminate();BEAUTY.worker=null;}
  const pending=BEAUTY.pending;BEAUTY.pending=null;
  if(pending){clearTimeout(pending.timer);pending.reject(new Error("Đã dừng nhận diện"));}
}
function beautyWorker(){
  if(BEAUTY.worker)return BEAUTY.worker;
  const code='"use strict";const start='+beautyEngine.toString()+`;
    let engine;
    self.onmessage=async({data})=>{
      const {id,image,assets}=data;
      try{
        if(!engine)engine=await start(assets);
        const result=await engine.detect(image,message=>self.postMessage({id,message}));
        const transfers=result.maps?[result.maps.skin.buffer,result.maps.hair.buffer]:[];
        for(const instance of result.instances||[])transfers.push(instance.data.buffer);
        self.postMessage({id,result},transfers);
      }catch(e){engine=null;self.postMessage({id,error:String(e.message||e)});}
      finally{if(image&&image.close)image.close();}
    };`;
  const url=URL.createObjectURL(new Blob([code],{type:"text/javascript"}));let worker;
  try{worker=new Worker(url);}finally{URL.revokeObjectURL(url);}
  worker.onmessage=({data})=>{
    const p=BEAUTY.pending;if(!p||p.id!==data.id)return;
    if(data.message){if(data.id===BEAUTY.job)beautyMessage(data.message);return;}
    clearTimeout(p.timer);BEAUTY.pending=null;
    if(data.error)p.reject(new Error(data.error));else p.resolve(data.result);
  };
  worker.onerror=e=>{e.preventDefault();BEAUTY.note="worker: "+String(e.message||"không tải được worker").slice(0,70);beautyWorkerStop();};
  worker.onmessageerror=()=>{BEAUTY.note="worker: lỗi truyền dữ liệu";beautyWorkerStop();};
  BEAUTY.worker=worker;return worker;
}
async function beautyDetect(input,id){
  BEAUTY.trail=[];BEAUTY.note="";
  if(typeof Worker!=="undefined"&&typeof OffscreenCanvas!=="undefined"&&typeof createImageBitmap==="function"){
    let bitmap;
    try{
      const worker=beautyWorker();bitmap=await createImageBitmap(input);
      if(id!==BEAUTY.job)throw new Error("Ảnh đã đổi");
      return await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>beautyWorkerStop(),240000);
        BEAUTY.pending={id,timer,resolve,reject};
        try{worker.postMessage({id,image:bitmap,assets:BEAUTY_ASSETS},[bitmap]);bitmap=null;}
        catch(error){clearTimeout(timer);BEAUTY.pending=null;reject(error);}
      });
    }catch(error){
      const note=BEAUTY.note;if(bitmap)bitmap.close();beautyWorkerStop();
      if(id!==BEAUTY.job)throw error;
      BEAUTY.trail.push(note||("worker: "+String(error&&error.message||error).slice(0,90)));
      beautyMessage("Đang chuyển sang chế độ AI tương thích…");
    }
  }
  const probe=document.createElement("canvas");
  const gl=probe.getContext("webgl2")||probe.getContext("webgl");
  if(!gl){BEAUTY.trail.push("không có WebGL");throw new Error("BEAUTY_WEBGL_UNAVAILABLE");}
  const release=gl.getExtension("WEBGL_lose_context");if(release)release.loseContext();
  probe.width=probe.height=0;
  const run=(BEAUTY.mainRun||Promise.resolve()).catch(()=>{}).then(async()=>{
    if(id!==BEAUTY.job)throw new Error("Ảnh đã đổi");
    if(!BEAUTY.main)BEAUTY.main=beautyEngine(BEAUTY_ASSETS).catch(e=>{BEAUTY.main=null;throw e;});
    const engine=await BEAUTY.main;
    if(id!==BEAUTY.job)throw new Error("Ảnh đã đổi");
    return engine.detect(input,message=>{if(id===BEAUTY.job)beautyMessage(message);});
  });
  BEAUTY.mainRun=run.catch(()=>{});return run;
}

