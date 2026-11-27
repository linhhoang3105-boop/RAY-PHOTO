/* Export uses the retained source; preview size never determines output pixels. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RayQuality=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const MAX_PIXELS=16e6;
 function plan(width,height,longEdge=null,maxPixels=MAX_PIXELS){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1)throw new Error('Ảnh chưa có kích thước hợp lệ.');
  const chosen=Number(longEdge)>0?Number(longEdge):null,requested=Math.min(1,chosen?chosen/Math.max(width,height):1),scale=Math.min(requested,Math.sqrt(maxPixels/(width*height)));
  return{width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale)),scale,limited:scale<requested-1e-8,requestedWidth:Math.max(1,Math.round(width*requested)),requestedHeight:Math.max(1,Math.round(height*requested))};
 }
 function resample(src,target,width,height,make,cover=false){
  width=Math.max(1,Math.round(width));height=Math.max(1,Math.round(height));
  const scale=Math.max(width/src.width,height/src.height),goalW=src.width*scale,goalH=src.height*scale;let input=src,owned=null;
  try{
   // A single large drawImage reduction can sample only a few source pixels, aliasing detail
   // and noise. Halve progressively so fine source detail is actually averaged before display.
   while(input.width>goalW*2&&input.height>goalH*2){
    const next=make();next.width=Math.max(1,Math.round(input.width/2));next.height=Math.max(1,Math.round(input.height/2));const c=next.getContext('2d');
    if(!c){next.width=next.height=0;throw new Error('Chưa đủ bộ nhớ để dựng ảnh.');}c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(input,0,0,next.width,next.height);
    if(owned)owned.width=owned.height=0;input=owned=next;
   }
   target.width=width;target.height=height;const c=target.getContext('2d');if(!c)throw new Error('Chưa đủ bộ nhớ để dựng ảnh.');c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
   if(cover){const k=Math.max(width/input.width,height/input.height),w=input.width*k,h=input.height*k;c.drawImage(input,(width-w)/2,(height-h)/2,w,h);}else c.drawImage(input,0,0,width,height);return target;
  }finally{if(owned)owned.width=owned.height=0;}
 }
 function resize(src,size,make){if(size.width===src.width&&size.height===src.height)return src;return resample(src,make(),size.width,size.height,make);}
 function encode(cv,type='image/jpeg',quality=.96){return new Promise((resolve,reject)=>{let done=false;const timer=setTimeout(()=>{done=true;reject(new Error('Tạo file ảnh quá lâu.'));},25000);try{cv.toBlob(blob=>{if(done)return;done=true;clearTimeout(timer);blob?.size?resolve(blob):reject(new Error('Máy chưa tạo được file ảnh.'));},type,quality);}catch(e){done=true;clearTimeout(timer);reject(e);}});}
 async function output({source,longEdge=null,type='image/jpeg',render,make,encode:write=encode,notify=()=>{},maxPixels=MAX_PIXELS}){
  const initial=plan(source.width,source.height,longEdge,maxPixels);let last;
  for(let attempt=0;attempt<3;attempt++){
   const factor=[1,.75,.5][attempt],size={width:Math.max(1,Math.round(initial.width*factor)),height:Math.max(1,Math.round(initial.height*factor))};let input=null,canvas=null;
   try{notify({attempt,...size});input=resize(source,size,make);canvas=make();render(canvas,input);const width=canvas.width,height=canvas.height,blob=await write(canvas,type,.96);return{blob,width,height,sourceWidth:source.width,sourceHeight:source.height,limited:initial.limited,fallback:attempt>0,renderWidth:size.width,renderHeight:size.height};}
   catch(e){last=e;}finally{if(input&&input!==source)input.width=input.height=0;if(canvas)canvas.width=canvas.height=0;}
  }
  throw last||new Error('Chưa lưu được ảnh.');
 }
 return{MAX_PIXELS,plan,resample,resize,encode,output};
});
