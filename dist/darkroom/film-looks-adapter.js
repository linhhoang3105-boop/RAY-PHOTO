/* Màu phim đo từ ảnh mẫu (RayFilmLooks): chỉ đổi điểm ảnh ảnh chụp, trước bảng màu RAY, khung và dấu ngày. */
(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./ray-film-looks.js'):root.RayFilmLooks);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else{root.RayFilmLook=api;P.rayNangPho=0;const previous=bodyWarp;bodyWarp=function(c,W,H){const result=previous(c,W,H);api.apply(c,W,H,P);return result;};}
})(typeof globalThis!=='undefined'?globalThis:this,looks=>{
 const KEYS={rayNangPho:'nangpho'};
 function apply(ctx,width,height,p){
  for(const [key,look]of Object.entries(KEYS)){const strength=Math.min(1.5,Number(p?.[key])||0);if(strength>0)looks.applyToContext(ctx,width,height,{look,strength});}
 }
 return{KEYS,apply};
});
