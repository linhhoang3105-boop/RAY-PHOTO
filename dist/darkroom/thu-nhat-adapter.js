/* Uploaded Thu Nhật grade: photo pixels only, before frames and date stamps. */
(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./ray-preset-thu-nhat.js'):root.RayPresetThuNhat);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else{root.RayThuNhat=api;P.rayThuNhat=0;const previous=bodyWarp;bodyWarp=function(c,W,H){const result=previous(c,W,H);api.apply(c,W,H,P.rayThuNhat);return result;};}
})(typeof globalThis!=='undefined'?globalThis:this,preset=>{
 function apply(ctx,width,height,strength){
  if(!(Number(strength)>0))return;
  const image=ctx.getImageData(0,0,width,height);
  preset.apply(image,{strength:Math.min(1.5,Number(strength))});
  ctx.putImageData(image,0,0);
 }
 return{apply};
});
