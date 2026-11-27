/* Khử mờ và Chi tiết (RayClarity) gắn vào RAY như Thu Nhật: chỉ đổi điểm ảnh ảnh chụp, trước bảng màu,
   ánh sáng, hạt, khung và dấu ngày; engine nhúng gốc giữ nguyên từng byte. */
(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./clarity-core.js'):root.RayClarity);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else{
  root.RayClarityAdapter=api;P.dehaze=0;P.detail=0;
  const previous=bodyWarp;bodyWarp=function(c,W,H){const result=previous(c,W,H);api.apply(c,W,H,P);return result;};
  if(typeof addSliders==='function'&&typeof document!=='undefined'&&document.getElementById?.('grpFilm')){
   const host=document.getElementById('grpFilm');addSliders(host,api.SLIDERS);
   const sharp=host.querySelector('input[data-k="sharp"]')?.closest('.row');
   if(sharp)for(const [key]of api.SLIDERS.slice().reverse()){const row=host.querySelector('input[data-k="'+key+'"]')?.closest('.row');if(row)sharp.after(row);}
  }
 }
})(typeof globalThis!=='undefined'?globalThis:this,clarity=>{
 const SLIDERS=[['detail','Chi tiết',0,1],['dehaze','Khử mờ',0,1]];
 function apply(ctx,width,height,p){
  const dehaze=Number(p?.dehaze)||0,detail=Number(p?.detail)||0;
  if(dehaze>.001||detail>.001)clarity.applyToContext(ctx,width,height,{dehaze,detail,unit:width/1200});
 }
 return{SLIDERS,apply};
});
