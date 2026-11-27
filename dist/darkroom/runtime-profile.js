/* Display names and a smaller editing preview; the source photo and color engine stay intact. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./quality-core.js'):root.RayQuality);if(typeof module==='object'&&module.exports)module.exports=api;else{root.RayRuntime=api;api.init();}})(typeof globalThis!=='undefined'?globalThis:this,Quality=>{
 'use strict';
 const names={spotmatic:'Nắng cũ',ae1:'Hiên nhà',fm2:'Gió sớm',portra400:'Hồng mơ',mamiya7:'Khoảng trời',cw503:'Sương lam',gold200:'Nắng mật',colorplus200:'Ngày vàng',cinestill:'Phố lên đèn',polaroid:'Mảnh nhớ',fujicam:'Vườn sau mưa',fujicam2:'Chiều nghiêng',fujicam3:'Bóng lá',srt101:'Mơ chiều',industar50:'Rêu nắng',ae:'Nắng lụa',fxs:'Hồng sương',grx:'Phố lặng',ccd:'Ngày trong',fx400:'Lá non',p400:'Lụa hồng',e100:'Ráng hạ',h400:'Mây ngọc',toyd:'Kẹo nắng'};
 const legacy={'Spotmatic':'Nắng cũ','AE-1':'Hiên nhà','FM2':'Gió sớm','Portra 400':'Hồng mơ','Mamiya 7':'Khoảng trời','503 CW':'Sương lam','Gold 200':'Nắng mật','ColorPlus 200':'Ngày vàng','Cinestill':'Phố lên đèn','Polaroid':'Mảnh nhớ','Fuji':'Vườn sau mưa','Fuji 2':'Chiều nghiêng','Fuji 3':'Bóng lá','SRT 101':'Mơ chiều','Industar 50':'Rêu nắng','AE':'Nắng lụa','FXS':'Hồng sương','GRX':'Phố lặng','CCD':'Ngày trong','FX400':'Lá non','P400':'Lụa hồng','E100':'Ráng hạ','H400':'Mây ngọc','Toy D':'Kẹo nắng'};
 const displayName=value=>legacy[value]||value;
 function rename(rolls){for(const roll of rolls)if(names[roll.id])roll.name=names[roll.id];return rolls;}
 function limited(device={}){return !!device.connection?.saveData||Number(device.deviceMemory)>0&&Number(device.deviceMemory)<=4||Number(device.hardwareConcurrency)>0&&Number(device.hardwareConcurrency)<=4;}
 function previewSize(W,H,{light=false,width=900,dpr=1}={}){const cap=light?800:width<=860?1024:Math.min(1440,Math.max(1024,Math.round(width*Math.min(2,dpr)))),ratio=Math.min(1,cap/Math.max(W,H));return{width:Math.max(1,Math.round(W*ratio)),height:Math.max(1,Math.round(H*ratio))};}
 function previewCanvas(bmp,options,makeCanvas,previous){const size=previewSize(bmp.width,bmp.height,options),cv=Quality.resample(bmp,makeCanvas(),size.width,size.height,makeCanvas);if(previous&&previous!==bmp&&previous!==cv)previous.width=previous.height=0;return cv;}
 const api={names,displayName,rename,limited,previewSize,previewCanvas};
 api.init=()=>{
  rename(ROLLS);let preference=null;try{preference=localStorage.getItem('ray-photo-preview-light');}catch{}
  let light=preference===null?limited(navigator):preference==='on';
  makePreview=bmp=>previewCanvas(bmp,{light,width:window.innerWidth,dpr:window.devicePixelRatio||1},()=>document.createElement('canvas'),preview);
  document.body.dataset.lightPreview=String(light);
  api.attach=host=>{const b=document.createElement('button');b.type='button';b.className='preview-lite';b.textContent='Nhẹ';b.setAttribute('aria-label','Xem trước nhẹ');
   function sync(){b.classList.toggle('on',light);b.setAttribute('aria-pressed',String(light));b.title=light?'Xem nhanh khi kéo. Ảnh sẽ rõ lại sau khi thả tay; ảnh lưu dùng nguồn gốc.':'Bật xem trước nhẹ để kéo mượt hơn. Ảnh sẽ rõ lại sau khi thả tay.';document.body.dataset.lightPreview=String(light);}
   b.onclick=()=>{light=!light;try{localStorage.setItem('ray-photo-preview-light',light?'on':'off');}catch{}sync();if(source){preview=makePreview(source);draw();}};host.append(b);sync();
  };
 };
 return api;
});
