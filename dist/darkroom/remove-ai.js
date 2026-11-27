/* On-device object selection and person instance masks; no photo upload. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RayRemoveAI=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 function detectionStats(raw,point){
  const {width:W,height:H,data}=raw,N=W*H,x=Math.max(0,Math.min(W-1,Math.floor(point.x*W))),y=Math.max(0,Math.min(H-1,Math.floor(point.y*H)));let seed=y*W+x,nearest=Infinity;
  if(data[seed]<.45)for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){const xx=x+dx,yy=y+dy,d=dx*dx+dy*dy;if(xx>=0&&xx<W&&yy>=0&&yy<H&&data[yy*W+xx]>=.45&&d<nearest){seed=yy*W+xx;nearest=d;}}
  if(data[seed]<.45)return{area:0,confidence:data[seed]||0,left:x,top:y,right:x+1,bottom:y+1,touch:[false,false,false,false]};
  const seen=new Uint8Array(N),queue=new Int32Array(N);queue[0]=seed;seen[seed]=1;let read=0,write=1,left=W,top=H,right=0,bottom=0;
  while(read<write){const i=queue[read++],xx=i%W,yy=Math.floor(i/W);left=Math.min(left,xx);top=Math.min(top,yy);right=Math.max(right,xx+1);bottom=Math.max(bottom,yy+1);for(const j of [xx?i-1:-1,xx<W-1?i+1:-1,yy?i-W:-1,yy<H-1?i+W:-1])if(j>=0&&!seen[j]&&data[j]>=.4){seen[j]=1;queue[write++]=j;}}
  return{area:write,confidence:data[seed],left,top,right,bottom,touch:[left===0,top===0,right===W,bottom===H]};
 }
 function detectionPlan(raw,point,W,H,attempt=0){
  const s=detectionStats(raw,point),fallback=s.area<8||s.area>raw.width*raw.height*.8,ratio=1.7+attempt*.8,width=Math.min(W,Math.max(96,Math.ceil(fallback?W*(.5+attempt*.3):(s.right-s.left)*W/raw.width*ratio))),height=Math.min(H,Math.max(96,Math.ceil(fallback?H*(.5+attempt*.3):(s.bottom-s.top)*H/raw.height*ratio)));
  if(width*height>W*H*.92)return null;const cx=fallback?point.x*W:(s.left+s.right)/2*W/raw.width,cy=fallback?point.y*H:(s.top+s.bottom)/2*H/raw.height,x=Math.max(0,Math.min(W-width,Math.round(cx-width/2))),y=Math.max(0,Math.min(H-height,Math.round(cy-height/2)));return{x,y,width,height,sourceWidth:W,sourceHeight:H,point:{x:(point.x*W-x)/width,y:(point.y*H-y)/height}};
 }
 function refinedDetection(raw,close,plan){
  const s=detectionStats(close,plan.point),touch=s.touch;if(s.area<8||s.area>close.width*close.height*.85||touch[0]&&plan.x>0||touch[1]&&plan.y>0||touch[2]&&plan.x+plan.width<plan.sourceWidth||touch[3]&&plan.y+plan.height<plan.sourceHeight)return null;
  // A tighter crop can reinterpret a whole chair as only its tapped leg.
  // Compare connected areas in native coordinates before replacing a confident
  // bounded object; different model/crop resolutions are not comparable counts.
  const base=detectionStats(raw,{x:(plan.x+plan.point.x*plan.width)/plan.sourceWidth,y:(plan.y+plan.point.y*plan.height)/plan.sourceHeight}),baseArea=base.area*plan.sourceWidth*plan.sourceHeight/(raw.width*raw.height),closeArea=s.area*plan.width*plan.height/(close.width*close.height);
  if(base.area>=8&&base.confidence>=.65&&base.area<raw.width*raw.height*.6&&!base.touch.some(Boolean)&&closeArea<baseArea*.35)return null;
  const data=raw.data.slice(),W=raw.width,H=raw.height;for(let y=Math.floor(plan.y/plan.sourceHeight*H);y<Math.min(H,Math.ceil((plan.y+plan.height)/plan.sourceHeight*H));y++)for(let x=Math.floor(plan.x/plan.sourceWidth*W);x<Math.min(W,Math.ceil((plan.x+plan.width)/plan.sourceWidth*W));x++){const px=Math.max(0,Math.min(close.width-1,((x+.5)*plan.sourceWidth/W-plan.x)/plan.width*close.width-.5)),py=Math.max(0,Math.min(close.height-1,((y+.5)*plan.sourceHeight/H-plan.y)/plan.height*close.height-.5)),x0=Math.floor(px),y0=Math.floor(py),x1=Math.min(close.width-1,x0+1),y1=Math.min(close.height-1,y0+1),u=px-x0,v=py-y0;data[y*W+x]=(close.data[y0*close.width+x0]*(1-u)+close.data[y0*close.width+x1]*u)*(1-v)+(close.data[y1*close.width+x0]*(1-u)+close.data[y1*close.width+x1]*u)*v;}
  return{...raw,data,refined:true,region:{x:plan.x/plan.sourceWidth,y:plan.y/plan.sourceHeight,width:plan.width/plan.sourceWidth,height:plan.height/plan.sourceHeight}};
 }
 // Deliberately self-contained: identical code runs in a Worker and in tests.
 async function infer(image,kind,point,assets,report=()=>{},loadModule=url=>import(url),read=url=>fetch(url)){
  const vision=await loadModule(assets.root+'/vision_bundle.mjs'),files=await vision.FilesetResolver.forVisionTasks(assets.root+'/wasm');
  report('Đang chuẩn bị nhận diện '+(kind==='object'?'vật được chạm':'người cần giữ')+'…');
  const response=await read(kind==='object'?assets.object:assets.pose);if(!response.ok)throw Error('Chưa tải được mô hình nhận diện.');const bytes=new Uint8Array(await response.arrayBuffer());let task;
  try{
   if(kind==='object'){
    task=await vision.InteractiveSegmenter.createFromOptions(files,{baseOptions:{modelAssetBuffer:bytes,delegate:'CPU'},outputConfidenceMasks:true,outputCategoryMask:false});
    const detect=(input,at)=>{let output;task.segment(input,{keypoint:at},result=>{const masks=result.confidenceMasks,mask=masks?.length===1?masks[0]:masks?.[1];if(!mask)throw Error('AI chưa trả được vùng vật.');output={width:mask.width,height:mask.height,data:new Float32Array(mask.getAsFloat32Array())};});if(!output)throw Error('AI chưa nhận diện được vật.');return output;},base=detect(image,point),makeCrop=typeof OffscreenCanvas!=='undefined'?(W,H)=>new OffscreenCanvas(W,H):typeof document!=='undefined'?(W,H)=>{const c=document.createElement('canvas');c.width=W;c.height=H;return c;}:null;
    if(assets.refine===false||!makeCrop||!image.width||!image.height)return base;
    for(let attempt=0;attempt<2;attempt++){const plan=detectionPlan(base,point,image.width,image.height,attempt);if(!plan)break;const crop=makeCrop(plan.width,plan.height);try{const c=crop.getContext('2d');if(!c)break;c.drawImage(image,plan.x,plan.y,plan.width,plan.height,0,0,plan.width,plan.height);report('Đang xem kỹ đường viền vật được chạm…');const close=detect(crop,plan.point),result=refinedDetection(base,close,plan);if(result)return result;}finally{crop.width=crop.height=0;}}
    return base;
   }
   task=await vision.PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetBuffer:bytes,delegate:'CPU'},runningMode:'IMAGE',numPoses:6,outputSegmentationMasks:true,minPoseDetectionConfidence:.4,minPosePresenceConfidence:.4});
   const result=task.detect(image);let people;try{people=(result.segmentationMasks||[]).map((mask,i)=>({width:mask.width,height:mask.height,data:Uint8Array.from(mask.getAsFloat32Array(),v=>Math.round(Math.max(0,Math.min(1,v))*255)),id:'person-'+i}));}finally{result.close?.();task.close();task=null;}
   // Low-angle selfies can have clear faces but no detectable full-body pose.
   // Use each uncovered face as an independent interactive foreground seed.
   report('Đang kiểm tra khuôn mặt để giữ đúng từng người…');const faceResponse=await read(assets.face||assets.root+'/face_landmarker.task');if(!faceResponse.ok)throw Error('Chưa tải được nhận diện khuôn mặt.');
   task=await vision.FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetBuffer:new Uint8Array(await faceResponse.arrayBuffer()),delegate:'CPU'},runningMode:'IMAGE',numFaces:6,minFaceDetectionConfidence:.4,minFacePresenceConfidence:.4});let faces;
   try{faces=task.detect(image).faceLandmarks||[];}finally{task.close();task=null;}
   for(const [index,face]of faces.entries()){
    const seed=face[1];if(!seed||!Number.isFinite(seed.x)||!Number.isFinite(seed.y)||seed.x<0||seed.x>1||seed.y<0||seed.y>1)continue;
    if(people.some(m=>m.data[Math.min(m.height-1,Math.floor(seed.y*m.height))*m.width+Math.min(m.width-1,Math.floor(seed.x*m.width))]>=64))continue;
    const raw=await infer(image,'object',{x:seed.x,y:seed.y},{...assets,refine:false},report,loadModule,read),data=Uint8Array.from(raw.data,v=>Math.round(Math.max(0,Math.min(1,v))*255)),area=data.reduce((n,v)=>n+(v>=128),0);if(area<8||area>data.length*.92)throw Error('Chưa tách rõ từng người. Dùng AI chạm chủ thể để giữ trước.');people.push({id:'face-person-'+index,width:raw.width,height:raw.height,data});
   }
   return people;
  }finally{task?.close?.();}
 }
 let active=null,sequence=0;
 function friendly(error){const text=String(error?.message||error);return /WebGL|kGpuService|emscripten|GPU/i.test(text)?'Trình duyệt chưa chạy được đồ họa cho AI. Dùng bút giữ lại hoặc thử Chrome/Safari trên thiết bị.':/quá lâu|Đã dừng/.test(text)?text:/fetch|network|tải được/i.test(text)?'Chưa tải được mô hình AI. Kiểm tra kết nối rồi thử lại.':'AI chưa thấy rõ vùng này. Chạm vào giữa vật hoặc dùng bút tô.';}
 function cancel(){sequence++;if(active){active.worker?.terminate();active.reject?.(Error('Đã dừng nhận diện.'));active=null;}}
 async function run(image,kind,point,report=()=>{}){
  cancel();const token=sequence,root=typeof BODY_AI_ASSETS!=='undefined'?BODY_AI_ASSETS.roots[0]:new URL('../vendor/mediapipe/',location.href).href.replace(/\/$/,''),assets={root,object:typeof BODY_AI_ASSETS!=='undefined'&&BODY_AI_ASSETS.object||(/cdn.jsdelivr.net|unpkg.com/.test(root)?'https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite':root+'/magic_touch.tflite'),pose:typeof BODY_AI_ASSETS!=='undefined'?BODY_AI_ASSETS.pose:root+'/pose_landmarker_lite.task',face:typeof BODY_AI_ASSETS!=='undefined'?BODY_AI_ASSETS.face:root+'/face_landmarker.task'};
  let timer,worker,url,bitmap;
  try{
   if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined')return await infer(image,kind,point,assets,report);
   const code='const detectionStats='+detectionStats.toString()+';const detectionPlan='+detectionPlan.toString()+';const refinedDetection='+refinedDetection.toString()+';const infer='+infer.toString()+';self.onmessage=async({data:d})=>{try{const result=await infer(d.image,d.kind,d.point,d.assets,text=>postMessage({status:text}));postMessage({result});}catch(e){postMessage({error:String(e.message||e)});}finally{d.image.close?.();}};';
   url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));worker=new Worker(url);bitmap=await createImageBitmap(image);if(token!==sequence)throw Error('Đã dừng nhận diện.');
   return await new Promise((resolve,reject)=>{active={worker,reject};timer=setTimeout(()=>reject(Error('Nhận diện mất quá lâu. Thử lại hoặc dùng bút giữ lại.')),60000);worker.onmessage=({data:d})=>{if(d.status){report(d.status);return;}d.error?reject(Error(d.error)):resolve(d.result);};worker.onerror=()=>reject(Error('Trình duyệt chưa chạy được AI. Dùng bút giữ lại hoặc thử trình duyệt khác.'));worker.postMessage({image:bitmap,kind,point,assets},[bitmap]);bitmap=null;});
  }catch(error){
   // Some browsers expose Workers without an OffscreenCanvas WebGL context.
   if(worker&&token===sequence&&!/Đã dừng|quá lâu/.test(error.message)){worker.terminate();worker=null;report('Đang thử nhận diện tương thích…');try{return await infer(image,kind,point,assets,report);}catch(e){throw Error(friendly(e));}}
   throw Error(friendly(error));
  }finally{clearTimeout(timer);worker?.terminate();bitmap?.close();if(url)URL.revokeObjectURL(url);if(token===sequence)active=null;}
 }
 return{infer,detectionStats,detectionPlan,refinedDetection,segment:(image,point,report)=>run(image,'object',point,report),people:(image,report)=>run(image,'people',null,report),cancel};
});
