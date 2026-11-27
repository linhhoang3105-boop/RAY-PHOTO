(function(){
 'use strict';
 const $=id=>document.getElementById(id),M=window.MakeupCore,Lab=window.BuongToiLab;
 const parts=['lips','brows','hair'],names={lips:'môi',brows:'lông mày',hair:'tóc'};
 const palettes={lips:[['#a33d42','Đỏ gạch'],['#bd6875','Hồng đất'],['#d47861','Cam đào'],['#823146','Đỏ rượu'],['#bd3553','Hồng đỏ']],brows:[['#49372d','Nâu tự nhiên'],['#2f2b2a','Nâu đen'],['#63524b','Nâu lạnh'],['#89715c','Nâu nhạt']],hair:[['#624332','Nâu socola'],['#977153','Nâu trà'],['#6f4541','Nâu đỏ'],['#29272c','Đen tự nhiên'],['#614458','Tím mận']]};
 const initial=()=>({lips:{color:palettes.lips[0][0],strength:0},brows:{color:palettes.brows[0][0],strength:0},hair:{color:palettes.hair[0][0],strength:0}});
 let source=null,rendered=null,masks={},autoResult=null,settings=initial(),active='lips',tool='view',before=false,loading=false,analysing=false,exporting=false,dirty=false,uploadJob=0,analysisJob=0,drawTimer=null,drag=null,history=[],ready=null,outputURL=null,toastTimer;
 const IOS=/iP(hone|ad|od)/.test(navigator.userAgent||'')||(/Mac/.test(navigator.userAgent||'')&&navigator.maxTouchPoints>1);
 const frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 function toast(s){clearTimeout(toastTimer);$('makeupToast').textContent=s;$('makeupToast').hidden=false;toastTimer=setTimeout(()=>{$('makeupToast').hidden=true;},4500);}
 function status(s,error=false){$('detectionStatus').textContent=s;$('detectionStatus').classList.toggle('error',error);}
 function release(c){if(c)c.width=c.height=1;}
 function closeSave(){if($('beautySaveDialog').open)$('beautySaveDialog').close();$('beautySaveDialog').hidden=true;}
 function clearOutput(){closeSave();if(outputURL)URL.revokeObjectURL(outputURL);outputURL=null;ready=null;$('beautySavedImage').removeAttribute('src');$('beautyDownload').removeAttribute('href');}
 function maskSize(){const s=Math.min(1,512/Math.max(source.width,source.height));return{w:Math.max(1,Math.round(source.width*s)),h:Math.max(1,Math.round(source.height*s))};}
 function resetMasks(){
  Object.values(masks).forEach(release);if(!source){masks={};return;}const{w,h}=maskSize();
  const selectedFace=Number($('faceChoice').value);masks=M.faceMasks(w,h,autoResult?.faces||[],Number.isInteger(selectedFace)?selectedFace:-1);
  masks.hair=autoResult?.hair?M.hairMask(w,h,autoResult.hair.values,autoResult.hair.width,autoResult.hair.height,autoResult.hair.refined):M.canvas(w,h);history=[];
 }
 function controls(){
  const locked=!source||loading||analysing||exporting;
  for(const id of ['makeupColor','makeupStrength','brushSize','skinSmooth','skinBright','beautyRoll','showMask','faceChoice','clearMask','resetMakeup','compareOriginal','viewZoom','tabLips','tabBrows','tabHair','toolView','toolPaint','toolErase'])$(id).disabled=locked;
  $('saveMakeup').disabled=locked;$('saveMakeup').textContent=exporting?'Đang chuẩn bị ảnh…':'Lưu ảnh đã chỉnh';
  $('openPhoto').disabled=loading||exporting;$('pickEmpty').disabled=loading||exporting;$('recognizeAgain').disabled=!source||loading||analysing||exporting;
  $('useManual').hidden=!analysing;$('undoMask').disabled=locked||!history.length;
  $('makeupColor').value=settings[active].color;$('makeupStrength').value=settings[active].strength;$('strengthValue').textContent=settings[active].strength+'%';
  $('brushSizeValue').textContent=$('brushSize').value+'%';$('skinSmoothValue').textContent=($('skinSmooth').value||0)+'%';$('skinBrightValue').textContent=($('skinBright').value||0)+'%';
  $('compareOriginal').textContent=before?'Trở về ảnh đã chỉnh':'Xem ảnh gốc';$('compareOriginal').setAttribute('aria-pressed',String(before));
  for(const p of parts){const b=$('tab'+({lips:'Lips',brows:'Brows',hair:'Hair'}[p]));b.classList.toggle('active',p===active);b.setAttribute('aria-pressed',String(p===active));}
  for(const t of ['view','paint','erase']){const b=$('tool'+t[0].toUpperCase()+t.slice(1));b.classList.toggle('active',t===tool);b.setAttribute('aria-pressed',String(t===tool));}
  $('canvasStack').classList.toggle('viewing',tool==='view');
  $('featureHint').textContent=!source?`Chọn ảnh để nhận diện vùng ${names[active]}.`:analysing?'Đang nhận diện. Có thể chuyển sang tô thủ công.':M.hasPixels(masks[active])?`Màu chỉ áp dụng trong vùng ${names[active]}. Kéo Độ đậm để thử.`:`Chưa có vùng ${names[active]}. Chọn Cọ tô để đánh dấu trên ảnh.`;
  for(const b of $('makeupPalette').children){b.disabled=locked;b.classList.toggle('active',b.dataset.color===settings[active].color);b.setAttribute('aria-pressed',String(b.dataset.color===settings[active].color));}
 }
 function palette(){
  $('makeupPalette').replaceChildren();for(const[color,name]of palettes[active]){const b=document.createElement('button');b.type='button';b.className='tone-swatch';b.style.background=color;b.dataset.color=color;b.title=name;b.setAttribute('aria-label',name);b.addEventListener('click',()=>{settings[active].color=color;if(!settings[active].strength)settings[active].strength=active==='lips'?45:35;changed();controls();});$('makeupPalette').append(b);}controls();
 }
 function sizeView(){if(!source)return;const stage=$('makeupStage'),width=stage.clientWidth||stage.getBoundingClientRect().width||600,height=stage.clientHeight||Math.min(650,window.innerHeight*.60)||500,fit=Math.min(width/source.width,height/source.height,1),zoom=+$('viewZoom').value||1;$('canvasStack').style.width=Math.max(1,Math.round(source.width*fit*zoom))+'px';}
 function drawOverlay(){
  const c=$('maskOverlay'),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);
  if(!source||!$('showMask').checked||before)return;ctx.save();ctx.drawImage(masks[active],0,0,c.width,c.height);ctx.globalCompositeOperation='source-in';ctx.fillStyle='rgba(210,69,122,.38)';ctx.fillRect(0,0,c.width,c.height);ctx.restore();
 }
 function display(){if(!source)return;const c=$('makeupView');c.width=source.width;c.height=source.height;c.getContext('2d').drawImage(before?source:(rendered||source),0,0);$('maskOverlay').width=source.width;$('maskOverlay').height=source.height;drawOverlay();sizeView();}
 function render(){
  clearTimeout(drawTimer);drawTimer=null;if(!source)return;
  const c=M.canvas(source.width,source.height),ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0);const im=ctx.getImageData(0,0,c.width,c.height);
  window.PhotoBeauty.apply(im.data,c.width,c.height,{smooth:+$('skinSmooth').value,brighten:+$('skinBright').value});M.apply(im.data,c.width,c.height,masks,settings);ctx.putImageData(im,0,0);
  release(rendered);if($('beautyRoll').value!=='goc'){rendered=M.canvas(1,1);Lab.renderPhoto(rendered,c,Lab.parameters($('beautyRoll').value));release(c);}else rendered=c;
  display();controls();
 }
 function changed(){dirty=true;before=false;clearOutput();clearTimeout(drawTimer);drawTimer=setTimeout(render,90);}
 function setTool(t){tool=t;if(t!=='view'){before=false;$('showMask').checked=true;}display();controls();}
 function updateFaces(){
  const select=$('faceChoice');select.replaceChildren();const all=document.createElement('option');all.value='-1';all.textContent='Tất cả khuôn mặt';select.append(all);
  (autoResult?.faces||[]).forEach((_,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=`Khuôn mặt ${i+1}`;select.append(o);});select.value='-1';$('faceChoiceLabel').hidden=(autoResult?.faces?.length||0)<2;
 }
 async function recognize(){
  if(!source)return;const ticket=++analysisJob,img=source;analysing=true;setTool('view');controls();await frame();const s=Math.min(1,768/Math.max(img.width,img.height)),input=M.canvas(Math.round(img.width*s),Math.round(img.height*s));input.getContext('2d').drawImage(img,0,0,input.width,input.height);
  try{
   const result=await window.MakeupDetection.detect(input,s=>{if(ticket===analysisJob)status(s);});if(ticket!==analysisJob||img!==source)return;
   autoResult=result;updateFaces();resetMasks();const count=result.faces.length,hair=M.hasPixels(masks.hair);
   status(count||hair?`${count?`Đã nhận ${count} khuôn mặt`:'Chưa nhận rõ khuôn mặt'}${hair?' và vùng tóc.':'.'} Chọn màu rồi kéo Độ đậm; dùng cọ / tẩy khi cần.`:'Chưa nhận được vùng tự động. Chọn Cọ tô rồi tô vào môi, lông mày hoặc tóc trên ảnh.');
   if(result.warnings?.length)status($('detectionStatus').textContent+' '+result.warnings.join(' '));
  }catch(e){if(ticket===analysisJob)status('Chưa nhận được vùng tự động trên máy này. Cọ tô / tẩy vẫn dùng được.',true);}
  finally{release(input);if(ticket===analysisJob){analysing=false;controls();render();}}
 }
 async function load(file){
  if(!file)return;const ticket=++uploadJob;++analysisJob;loading=true;analysing=false;controls();status('Đang mở ảnh…');let url;
  try{
   if(file.size>30*1024*1024)throw new Error('Ảnh lớn hơn 30 MB. Hãy chọn ảnh nhỏ hơn.');url=URL.createObjectURL(file);const im=new Image();
   await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=()=>reject(new Error('Chưa đọc được ảnh. Hãy chọn JPG, PNG hoặc WebP.'));im.src=url;});if(ticket!==uploadJob)return;
   const scale=Math.min(1,1600/Math.max(im.naturalWidth,im.naturalHeight));if(!scale||!Number.isFinite(scale))throw new Error('Ảnh không hợp lệ.');const next=M.canvas(Math.max(1,Math.round(im.naturalWidth*scale)),Math.max(1,Math.round(im.naturalHeight*scale)));next.getContext('2d').drawImage(im,0,0,next.width,next.height);
   clearTimeout(drawTimer);drawTimer=null;release(source);release(rendered);rendered=null;source=next;autoResult=null;settings=initial();dirty=false;before=false;$('skinSmooth').value=$('skinBright').value='0';$('beautyRoll').value='goc';$('viewZoom').value='1';$('showMask').checked=false;updateFaces();resetMasks();clearOutput();
   $('makeupEmpty').hidden=true;$('canvasStack').hidden=false;$('imageDimensions').textContent=`${source.width} × ${source.height} PX`;loading=false;palette();render();await recognize();
  }catch(e){if(ticket===uploadJob){status(e.message,true);toast(e.message);}}
  finally{if(url)URL.revokeObjectURL(url);if(ticket===uploadJob){loading=false;controls();$('makeupFile').value='';}}
 }
 function point(e){const r=$('maskOverlay').getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};}
 function remember(){history.push({part:active,data:masks[active].getContext('2d').getImageData(0,0,masks[active].width,masks[active].height)});if(history.length>8)history.shift();}
 function paint(from,to){M.brush(masks[active],from,to,(+$('brushSize').value||3)/100,tool==='erase');dirty=true;before=false;clearOutput();drawOverlay();}
 $('maskOverlay').addEventListener('pointerdown',e=>{if(!source||analysing||loading||exporting||tool==='view')return;e.preventDefault();remember();const p=point(e);drag={id:e.pointerId,last:p};$('maskOverlay').setPointerCapture(e.pointerId);paint(p,p);});
 $('maskOverlay').addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;e.preventDefault();const p=point(e);paint(drag.last,p);drag.last=p;});
 function endStroke(){if(!drag)return;drag=null;if(tool==='paint'&&!settings[active].strength)settings[active].strength=40;render();}
 for(const type of ['pointerup','pointercancel','lostpointercapture'])$('maskOverlay').addEventListener(type,endStroke);
 function canShare(file){try{return!!(navigator.share&&navigator.canShare?.({files:[file]}));}catch(e){return false;}}
 function pngBlob(c){return new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Xuất ảnh quá lâu.')),20000);try{c.toBlob(b=>{clearTimeout(t);b?resolve(b):reject(new Error('Chưa tạo được ảnh.'));},'image/png');}catch(e){clearTimeout(t);reject(e);}});}
 function blobFromData(data){if(!data.startsWith('data:image/png;base64,'))throw new Error('Chưa tạo được ảnh.');const s=atob(data.split(',')[1]),a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return new Blob([a],{type:'image/png'});}
 async function save(){
  if(!source||analysing||exporting)return;exporting=true;controls();await frame();
  try{
   if(drawTimer||!rendered)render();const data=IOS?rendered.toDataURL('image/png'):null,blob=data?blobFromData(data):await pngBlob(rendered),name='pho-cang-makeup-'+new Date().toISOString().slice(0,10)+'.png';
   clearOutput();outputURL=URL.createObjectURL(blob);ready={file:new File([blob],name,{type:'image/png'}),name};$('beautySavedImage').src=data||outputURL;$('beautyDownload').href=outputURL;$('beautyDownload').download=name;$('beautyShare').hidden=!canShare(ready.file);$('beautySaveStatus').textContent='Bấm Lưu vào Ảnh / Chia sẻ rồi chọn Lưu hình ảnh, hoặc nhấn giữ ảnh phía trên để lưu.';$('beautySaveDialog').hidden=false;$('beautySaveDialog').showModal();
   if(!IOS){const a=document.createElement('a');a.href=outputURL;a.download=name;document.body.append(a);a.click();a.remove();}
  }catch(e){toast('Chưa tạo được ảnh để lưu. Hãy thử lại.');}finally{exporting=false;controls();}
 }
 async function share(){if(!ready||!canShare(ready.file))return;$('beautyShare').disabled=true;try{await navigator.share({files:[ready.file],title:'Phố Cảng · ảnh của bạn'});}catch(e){$('beautySaveStatus').textContent=e.name==='AbortError'?'Ảnh vẫn ở đây. Bấm lưu lại hoặc nhấn giữ ảnh để lưu.':'Chưa mở được bảng chia sẻ. Nhấn giữ ảnh phía trên để lưu, hoặc dùng Tải PNG.';}finally{$('beautyShare').disabled=false;}}
 for(const id of ['openPhoto','pickEmpty'])$(id).addEventListener('click',()=>$('makeupFile').click());$('makeupFile').addEventListener('change',e=>load(e.target.files[0]));
 for(const p of parts)$('tab'+({lips:'Lips',brows:'Brows',hair:'Hair'}[p])).addEventListener('click',()=>{active=p;palette();drawOverlay();});
 $('makeupColor').addEventListener('input',()=>{settings[active].color=$('makeupColor').value;if(!settings[active].strength)settings[active].strength=40;changed();controls();});
 $('makeupStrength').addEventListener('input',()=>{settings[active].strength=+$('makeupStrength').value;changed();controls();});
 for(const id of ['skinSmooth','skinBright','beautyRoll'])$(id).addEventListener(id==='beautyRoll'?'change':'input',()=>{changed();controls();});
 for(const t of ['view','paint','erase'])$('tool'+t[0].toUpperCase()+t.slice(1)).addEventListener('click',()=>setTool(t));
 $('brushSize').addEventListener('input',controls);$('showMask').addEventListener('change',drawOverlay);$('viewZoom').addEventListener('change',sizeView);
 $('compareOriginal').addEventListener('click',()=>{if(drawTimer)render();before=!before;display();controls();});
 $('undoMask').addEventListener('click',()=>{const prev=history.pop();if(!prev)return;active=prev.part;masks[active].getContext('2d').putImageData(prev.data,0,0);palette();changed();render();});
 $('clearMask').addEventListener('click',()=>{remember();masks[active].getContext('2d').clearRect(0,0,masks[active].width,masks[active].height);changed();render();});
 $('recognizeAgain').addEventListener('click',recognize);
 $('useManual').addEventListener('click',()=>{++analysisJob;analysing=false;status('Đã chuyển sang tô thủ công. Chọn Cọ tô, tô vùng cần đổi màu rồi kéo Độ đậm.');setTool('paint');controls();});
 $('faceChoice').addEventListener('change',()=>{const{w,h}=maskSize(),m=M.faceMasks(w,h,autoResult?.faces||[],+$('faceChoice').value);release(masks.lips);release(masks.brows);masks.lips=m.lips;masks.brows=m.brows;history=[];changed();render();});
 $('resetMakeup').addEventListener('click',()=>{settings=initial();$('skinSmooth').value=$('skinBright').value='0';$('beautyRoll').value='goc';$('showMask').checked=false;before=false;dirty=false;resetMasks();clearOutput();palette();setTool('view');render();toast('Đã trở về ảnh gốc.');});
 $('saveMakeup').addEventListener('click',save);$('beautyShare').addEventListener('click',share);$('beautyCloseSave').addEventListener('click',closeSave);$('beautySaveDialog').addEventListener('cancel',()=>{$('beautySaveDialog').hidden=true;});
 for(const r of Lab.rolls){const o=document.createElement('option');o.value=r.id;o.textContent=r.name;$('beautyRoll').append(o);}$('beautyRoll').value='goc';$('faceChoice').value='-1';$('brushSize').value='3';palette();
 window.addEventListener('resize',sizeView);
})();
