/* One worker per repair: cancellation also releases the model and WASM memory. */
'use strict';
importScripts('inpaint-core.js','inpaint-runtime.js');
self.onmessage=async({data:{input,assets}})=>{
 const report=status=>postMessage({status});
 try{
  const prepared=RayInpaintCore.prepare(input);report('Đang chuẩn bị AI tái tạo nền…');
  const bytes=await RayInpaintRuntime.loadModel(assets.root,report);
  importScripts(assets.root+'ort.wasm.min.js');
  ort.env.wasm.wasmPaths=assets.root;ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;
  const result=await RayInpaintRuntime.infer(prepared,ort,bytes,RayInpaintCore,report);
  postMessage({result},[result.data.buffer,...(result.protection?[result.protection.buffer]:[])]);
 }catch(error){const message=String(error.message||error);postMessage({error:/[À-ỹ]/.test(message)?message:/memory|alloc|out of bounds/i.test(message)?'Thiết bị chưa đủ bộ nhớ để AI tái tạo vùng này. Vùng tô vẫn giữ; thử vùng nhỏ hơn hoặc chọn Vá nền nhanh.':'Chưa chạy được AI tái tạo nền. Kiểm tra mạng, tải lại RAY rồi thử lại, hoặc chọn Vá nền nhanh. Vùng tô vẫn được giữ.'});}
 finally{self.close();}
};
