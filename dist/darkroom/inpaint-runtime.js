/* Verified, lazy model download and real ONNX inference; never uploads photos. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RayInpaintRuntime=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const model={id:'lama-512-int8-v1',bytes:62074990,sha256:'cab19978adc306622fe37ef60d4a52103b99c98141d499c2a2366a7ed1255dbe'};
 async function hash(data,subtle){return Array.from(new Uint8Array(await subtle.digest('SHA-256',data)),v=>v.toString(16).padStart(2,'0')).join('');}
 async function loadModel(root,report=()=>{},{read=url=>fetch(url),storage=globalThis.caches,subtle=globalThis.crypto?.subtle}={}){
  if(!subtle)throw Error('Trình duyệt chưa hỗ trợ tải AI an toàn. Dùng Vá nền nhanh hoặc mở RAY qua HTTPS.');
  const response=await read(root+'model.json');if(!response.ok)throw Error('Chưa tải được thông tin AI. Kiểm tra mạng rồi thử lại.');const manifest=await response.json();
  if(manifest.id!==model.id||manifest.bytes!==model.bytes||manifest.sha256!==model.sha256||!Array.isArray(manifest.chunks)||manifest.chunks.length!==4)throw Error('Tệp AI chưa đúng phiên bản. Tải lại RAY rồi thử lại.');
  let cache=null;try{cache=await storage?.open('ray-inpaint-'+model.id);}catch{}
  const bytes=new Uint8Array(model.bytes);let offset=0,last=-1;
  const progress=loaded=>{const percent=Math.min(100,Math.floor(loaded/model.bytes*100));if(percent!==last){last=percent;report('Đang tải AI tái tạo nền · '+Math.round(loaded/1e6)+' / 62 MB · '+percent+'%');}};
  for(const chunk of manifest.chunks){
   if(!/^lama-512-int8-\d{2}\.bin$/.test(chunk.file)||!Number.isInteger(chunk.bytes)||chunk.bytes<1||chunk.bytes>20*1024*1024||offset+chunk.bytes>bytes.length||!/^[a-f0-9]{64}$/.test(chunk.sha256))throw Error('Tệp AI chưa hợp lệ. Tải lại RAY rồi thử lại.');
   const url=root+chunk.file;let data=null;
   try{const saved=await cache?.match(url);if(saved){const candidate=new Uint8Array(await saved.arrayBuffer());if(candidate.length===chunk.bytes&&await hash(candidate,subtle)===chunk.sha256)data=candidate;else await cache.delete(url);}}catch{}
   if(!data){
    const response=await read(url);if(!response.ok)throw Error('Chưa tải xong AI. Kiểm tra mạng rồi thử lại; vùng tô vẫn được giữ.');data=new Uint8Array(chunk.bytes);let length=0;
    if(response.body?.getReader){const reader=response.body.getReader();try{for(;;){const {done,value}=await reader.read();if(done)break;if(length+value.length>data.length)throw Error('Tệp AI tải chưa đúng. Thử lại khi mạng ổn định.');data.set(value,length);length+=value.length;progress(offset+length);}}finally{reader.releaseLock();}}
    else{const incoming=new Uint8Array(await response.arrayBuffer());length=incoming.length;if(length===data.length)data.set(incoming);}
    if(length!==chunk.bytes||await hash(data,subtle)!==chunk.sha256)throw Error('Tệp AI tải chưa đủ hoặc bị lỗi. Thử lại; vùng tô vẫn được giữ.');
    try{await cache?.put(url,new Response(data,{headers:{'Content-Type':'application/octet-stream'}}));}catch{}
   }
   bytes.set(data,offset);offset+=data.length;progress(offset);
  }
  if(offset!==bytes.length||await hash(bytes,subtle)!==model.sha256)throw Error('Tệp AI chưa toàn vẹn. Thử tải lại AI.');
  return bytes;
 }
 async function infer(prepared,ort,bytes,core,report=()=>{}){
  let session=null,input=null,outputs=null;
  try{
   report('Đang chuẩn bị AI tái tạo nền…');session=await ort.InferenceSession.create(bytes,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
   if(session.inputNames.length!==1||session.inputNames[0]!=='input'||!session.outputNames.includes('output'))throw Error('Mô hình AI chưa đúng định dạng.');
   input=new ort.Tensor('float32',prepared.tensor,[1,4,core.size,core.size]);report('AI đang tái tạo nền và nối chi tiết… Có thể mất vài chục giây.');
   outputs=await session.run({input});const output=outputs.output;
   if(!output||output.dims.join(',')!==[1,3,core.size,core.size].join(','))throw Error('AI chưa trả được nền hợp lệ.');
   report('Đang hòa màu viền nền và giữ vùng xanh…');const result=core.result(prepared,output.data);return core.finish?core.finish(prepared,result):result;
  }finally{input?.dispose?.();if(outputs)for(const output of Object.values(outputs))output.dispose?.();await session?.release();}
 }
 return{model,hash,loadModel,infer};
});
