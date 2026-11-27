/* Cancellable on-device background reconstruction. Patch fill is an explicit option. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RayInpaint=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const script=typeof document==='undefined'?'':document.currentScript?.src;
 function createClient(options={}){
  let active=null,sequence=0;
  function cancel(){sequence++;if(active){active.worker.terminate();active.reject(Error('Đã dừng AI. Vùng tô vẫn được giữ.'));active=null;}}
  async function repair(input,report=()=>{}){
   cancel();const token=sequence;
   let worker,timer;
   try{
    const base=options.base||new URL('./',script||(typeof location==='undefined'?'https://ray.invalid/darkroom/':location.href)).href,root=new URL('../vendor/inpaint/',base).href;
    worker=options.makeWorker?options.makeWorker(new URL('inpaint-worker.js',base).href):new Worker(new URL('inpaint-worker.js',base).href);
    return await new Promise((resolve,reject)=>{
     active={worker,reject};timer=setTimeout(()=>reject(Error('AI mất quá lâu trên thiết bị này. Vùng tô vẫn giữ; thử vùng nhỏ hơn hoặc chọn Vá nền nhanh.')),options.timeout||180000);
     worker.onmessage=({data})=>{if(token!==sequence)return;if(data.status){report(data.status);return;}data.error?reject(Error(data.error)):data.result?resolve(data.result):reject(Error('AI chưa trả được nền hợp lệ.'));};
     worker.onerror=()=>reject(Error('Trình duyệt chưa chạy được AI tái tạo nền. Vùng tô vẫn giữ; thử lại hoặc chọn Vá nền nhanh.'));
     worker.postMessage({input,assets:{root}},[input.data.buffer,input.mask.buffer,...(input.protect?[input.protect.buffer]:[]),...(input.exclude?[input.exclude.buffer]:[])]);
    });
   }catch(error){if(/Worker is not defined|SecurityError/i.test(String(error)))throw Error('Trình duyệt chưa mở được AI tái tạo nền. Chọn Vá nền nhanh hoặc mở bản web RAY.');throw error;}
   finally{clearTimeout(timer);worker?.terminate();if(token===sequence)active=null;}
  }
  return{repair,cancel};
 }
 return{...createClient(),createClient};
});
