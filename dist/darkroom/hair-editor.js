/* Keep skin/makeup separate; replace only the hair-color blend, never film recipes. */
(()=>{
 'use strict';
 const original=beautySkinHair;
 beautySkinHair=function(c,W,H){
  const values=beautySettings(),hair=values.map(v=>v.hair),settings=values.map(v=>({...v}));
  try{for(const v of values)v.hair=0;original(c,W,H);}finally{values.forEach((v,i)=>v.hair=hair[i]);}
  if(!BEAUTY.maps?.hair||!hair.some(v=>v>.001))return;const im=c.getImageData(0,0,W,H);RayHair.apply(im.data,W,H,BEAUTY.maps,settings);c.putImageData(im,0,0);
 };
 const ui=beautyUI;beautyUI=function(){ui();if(BEAUTY.maps&&!BEAUTY.people.length)document.getElementById('beautyPersonStatus').textContent='Chưa tìm thấy khuôn mặt. Da và tóc chỉ đổi trong vùng AI đã nhận diện; son, má và mày cần nhận diện mặt.';};
 const hint=document.createElement('p');hint.className='hint';hint.textContent='Kéo Độ phủ để lên màu đã chọn, giữ vân tóc và độ bóng. Bấm Nhận diện lại để cập nhật cả tóc con và đuôi tóc; mức 0 khôi phục màu tóc gốc.';document.getElementById('beautyHair').append(hint);beautyUI();
})();
