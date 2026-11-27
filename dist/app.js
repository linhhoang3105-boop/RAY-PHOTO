/* All photo processing stays in this browser. No image upload requests. */
(() => {
  'use strict';
  const B=window.BoothCore,Lab=window.BuongToiLab,Media=window.BoothMedia, $=id=>document.getElementById(id);
  const video=$('video'), canvas=$('preview');
  const now=new Date(), dateISO=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const state={theme:'newspaper',layout:'grid',photoCount:4,filter:'natural',rollId:'',lab:{...Lab.defaults},effects:{grain:0,flash:0,vignette:0,leak:0},beauty:{smooth:0,brighten:0},photos:Array(6).fill(null),caption:'',captionEdited:false,showText:true,title:undefined,subtitle:undefined,textByTheme:{},date:dateISO.split('-').reverse().join('.'),custom:null};
  let stream=null,facing='user',mirror=true,selected=-1,busy=false,cameraPending=false,importing=false,exporting=false,runId=0,toastTimer,drawScheduled=false,exportURL=null,readyExport=null,replacementIndex=-1,effectTimer=null;
  let timelineTime=0,timelinePlaying=false,timelineToken=0,frameSerial=0,frameQueue=Promise.resolve(),videoExporting=false,videoAbort=null,outputFiles=[];
  const IOS=/iP(hone|ad|od)/.test(navigator.userAgent||'')||(/Mac/.test(navigator.userAgent||'')&&navigator.maxTouchPoints>1);
  const cloneLook=look=>({...look,lab:{...look.lab},effects:{...look.effects},beauty:{...look.beauty}});
  const currentLook=()=>({filter:state.filter,rollId:state.rollId,lab:{...state.lab},effects:{...state.effects},beauty:{...state.beauty},preset:$('fxPreset').value||'clean'});
  let newPhotoLook=currentLook();
  const filterCSS={natural:'none',film:'sepia(.22) saturate(.85) brightness(1.02)',mono:'grayscale(1) contrast(1.08) brightness(1.03)',soft:'contrast(.89) brightness(1.1)',faded:'saturate(.8) contrast(.86) brightness(1.08)',amber:'sepia(.3) saturate(.85)',cool:'saturate(.92) hue-rotate(8deg)'};
  const layoutGeometry=()=>B.geometry(state.layout,state.theme==='custom'?state.custom:null,state.photoCount,state.theme);
  const count=()=>layoutGeometry().slots.length;
  const activePhotos=()=>state.photos.slice(0,count());
  const countFilled=()=>activePhotos().filter(Boolean).length;
  const icon=name=>`<svg class="icon"><use href="#i-${name}"/></svg>`;
  function toast(message,error=false){const t=$('toast');clearTimeout(toastTimer);t.textContent=message;t.classList.toggle('error',error);t.hidden=false;toastTimer=setTimeout(()=>{t.hidden=true;},error?6500:3500);}
  function setCameraMessage(message){$('cameraMessage').textContent=message;$('cameraMessage').hidden=!message;}
  function requestDraw(){if(drawScheduled)return;drawScheduled=true;requestAnimationFrame(()=>{drawScheduled=false;draw();});}
  function closeSaved(){$('savedVideo').pause?.();if($('saveFallback').open)$('saveFallback').close();$('saveFallback').hidden=true;}
  function clearSaved(){closeSaved();$('savedVideo').pause?.();$('savedVideo').removeAttribute('src');for(const f of outputFiles)URL.revokeObjectURL(f.url);outputFiles=[];if(exportURL){URL.revokeObjectURL(exportURL);exportURL=null;}readyExport=null;$('savedImage').removeAttribute('src');$('downloadReady').removeAttribute('href');}
  function invalidate(){if(timelinePlaying)pauseTimeline();clearSaved();requestDraw();}
  function filterPhoto(photo,options={}){
    if(!photo)return;
    const look=photo.look;
    const beautyOn=Object.values(look.beauty).some(Boolean);
    if(!look.rollId&&look.filter==='natural'&&!Object.values(look.effects).some(Boolean)&&!beautyOn){photo.filtered=null;return;}
    const maxEdge=Number(options?.maxEdge)||1200;
    const key=(look.rollId?'lab|'+JSON.stringify(look.lab):look.filter+'|'+['grain','flash','vignette','leak'].map(k=>look.effects[k]).join('|'))+'|beauty:'+JSON.stringify(look.beauty)+'|frame:'+(photo.media?.version||0)+(options?.maxEdge?'|export:'+maxEdge:'');
    if(!photo.cache)photo.cache=new Map();
    if(!photo.cache.has(key)){
      const c=document.createElement('canvas');c.width=photo.image.width;c.height=photo.image.height;
      let original=photo.image,retouched=null,prepared=null;
      if(options?.maxEdge&&Math.max(original.width,original.height)>maxEdge){const s=maxEdge/Math.max(original.width,original.height);prepared=document.createElement('canvas');prepared.width=Math.max(1,Math.round(original.width*s));prepared.height=Math.max(1,Math.round(original.height*s));const ctx=prepared.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(original,0,0,prepared.width,prepared.height);original=prepared;}
      if(beautyOn){
        const s=Math.min(1,maxEdge/Math.max(original.width,original.height));retouched=document.createElement('canvas');retouched.width=Math.round(original.width*s);retouched.height=Math.round(original.height*s);
        const ctx=retouched.getContext('2d',{willReadFrequently:true});ctx.drawImage(original,0,0,retouched.width,retouched.height);const data=ctx.getImageData(0,0,retouched.width,retouched.height);
        window.PhotoBeauty.apply(data.data,data.width,data.height,look.beauty);ctx.putImageData(data,0,0);original=retouched;
      }
      if(look.rollId){
        let source=original;const scale=Math.min(1,maxEdge/Math.max(source.width,source.height));
        if(scale<1){source=document.createElement('canvas');source.width=Math.round(original.width*scale);source.height=Math.round(original.height*scale);source.getContext('2d').drawImage(original,0,0,source.width,source.height);}
        Lab.renderPhoto(c,source,look.lab);if(source!==original)source.width=source.height=1;
      }else{c.width=original.width;c.height=original.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(original,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height);B.applyFilter(pixels.data,look.filter);B.applyPhotoFX(pixels.data,c.width,c.height,look.effects);ctx.putImageData(pixels,0,0);}
      if(retouched)retouched.width=retouched.height=1;
      if(prepared)prepared.width=prepared.height=1;
      photo.cache.set(key,c);
      // Bound memory on iPhones; the original plus the selected effect is sufficient.
      for(const k of photo.cache.keys())if(k!==key){const old=photo.cache.get(k);old.width=old.height=1;photo.cache.delete(k);}
    }
    photo.filtered=photo.cache.get(key);
  }
  function makePhoto(image,look=newPhotoLook){const p={image,look:cloneLook(look),zoom:1,x:0,y:0,flip:false,rotation:0,filtered:null,cache:new Map()};filterPhoto(p);return p;}
  function syncEffectControls(){for(const k of ['grain','flash','vignette','leak']){$('fx-'+k).value=state.effects[k];$('fx-'+k+'-value').textContent=state.effects[k]+'%';}for(const k of ['smooth','brighten']){$('beauty-'+k).value=state.beauty[k];$('beauty-'+k+'-value').textContent=state.beauty[k]+'%';}}
  function restoreLook(look){Object.assign(state,cloneLook(look));$('labRoll').value=look.rollId||'goc';$('fxPreset').value=look.preset||'custom';syncEffectControls();}
  function saveCurrentLook(){
    const look=currentLook();
    if(selected<0){const i=activePhotos().findIndex(Boolean);if(i>=0)selected=i;}
    if(selected>=0&&state.photos[selected])state.photos[selected].look=cloneLook(look);
    else newPhotoLook=cloneLook(look);
  }
  function syncFrameText(){const d=B.frameTextDefaults(state.theme),t=state.textByTheme[state.theme]||{},strip=state.layout!=='grid'&&state.theme==='newspaper',travel=['hellonews','portnews'].includes(state.theme);state.title=t.title;state.subtitle=t.subtitle;$('frameTitle').value=state.title??d.title;$('frameSubtitle').value=state.subtitle??(strip?`${count()} TẤM ẢNH • MỘT NGÀY ĐẸP`:d.subtitle);$('frameTitleLabel').textContent=travel?'Chữ mở đầu (Hello, Chào, Bến…)':'Tiêu đề';$('frameSubtitleLabel').textContent=travel?'Địa danh':'Dòng phụ';$('frameTitle').placeholder=travel?'Để trống để xóa chữ mở đầu':'Để trống để xóa tiêu đề';$('frameSubtitle').placeholder=travel?'Ví dụ: Hải Phòng, Đà Lạt…':'Để trống để xóa dòng phụ';}
  function applyCurrentEffects(){clearTimeout(effectTimer);effectTimer=null;state.photos.forEach(filterPhoto);if(selected>=0)renderSelected();invalidate();}
  function disposePhoto(p){if(!p)return;p.media?.dispose();p.image.width=p.image.height=1;for(const c of p.cache?.values()||[])c.width=c.height=1;p.cache?.clear();}
  function replaceAt(i,p){disposePhoto(state.photos[i]);state.photos[i]=p;}
  function croppedCanvas(photo,width=500,index=selected){
    const slot=layoutGeometry().slots[Math.max(0,index)]||{w:4,h:3};
    const c=document.createElement('canvas');c.width=width;c.height=Math.round(width*slot.h/slot.w);
    B.drawCover(c.getContext('2d'),photo.filtered||photo.image,0,0,c.width,c.height,photo);return c;
  }
  function renderSelected(){
    const p=state.photos[selected];
    if(!p||selected<0){$('selectedImage').hidden=true;$('selectedMotion').hidden=true;$('editingLabel').hidden=true;$('photoEditor').hidden=true;return;}
    $('selectedImage').hidden=!!p.media;$('selectedMotion').hidden=!p.media;
    if(p.media)drawSelectedMotion();else $('selectedImage').src=croppedCanvas(p,700).toDataURL('image/jpeg',.88);
    $('editingLabel').hidden=false;$('cameraEmpty').hidden=true;video.hidden=true;$('cameraBadge').hidden=true;
    $('photoEditor').hidden=false;$('editorTitle').textContent=`Chỉnh ảnh ${selected+1}`;
    $('zoom').value=p.zoom;$('zoomValue').textContent=p.zoom.toFixed(1)+'×';
    $('rotationValue').textContent=(p.rotation||0)+'°';
    const g=layoutGeometry(),r=g.slots[selected];
    $('viewfinder').style.aspectRatio=r?`${r.w} / ${r.h}`:'4 / 3';
    syncClipControls();
  }
  function drawSelectedMotion(){const p=state.photos[selected];if(!p?.media)return;const r=layoutGeometry().slots[selected],c=$('selectedMotion');c.width=480;c.height=Math.round(480*r.h/r.w);B.drawCover(c.getContext('2d'),p.filtered||p.image,0,0,c.width,c.height,p);}
  function showLive(){
    if(effectTimer)applyCurrentEffects();
    selected=-1;$('selectedImage').hidden=true;$('selectedMotion').hidden=true;$('editingLabel').hidden=true;$('photoEditor').hidden=true;
    restoreLook(newPhotoLook);
    video.hidden=!stream;$('cameraEmpty').hidden=!!stream;$('cameraBadge').hidden=!stream;
    const r=layoutGeometry().slots[0];
    $('viewfinder').style.aspectRatio=`${r.w} / ${r.h}`;requestDraw();
  }
  function selectPhoto(i){if(busy||importing||exporting)return;pauseTimeline();if(effectTimer)applyCurrentEffects();setCameraMessage('');if(!state.photos[i]){replacementIndex=i;$('replaceInput').click();return;}selected=i;restoreLook(state.photos[i].look);renderSelected();requestDraw();}
  function bindSlotDrop(button,index){
    button.addEventListener('dragover',e=>{if(busy||importing||exporting)return;e.preventDefault();e.stopPropagation?.();button.classList.add('drop-target');});
    button.addEventListener('dragleave',()=>button.classList.remove('drop-target'));
    button.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation?.();button.classList.remove('drop-target');if(busy||importing||exporting)return;const files=[...(e.dataTransfer?.files||[])].filter(f=>/^(image|video)\//.test(f.type)||/\.(gif|jpe?g|png|webp|heic|heif|mp4|mov|m4v|webm)$/i.test(f.name||''));if(files.length)importImages(files,index);});
  }
  function drawSlotOverlay(){
    const overlay=$('slotOverlay');if(!overlay)return;const g=layoutGeometry(),slots=g.double?[...g.slots,...g.slots.map(r=>({...r,x:r.x+g.stripWidth+g.gap}))]:g.slots;
    if(overlay.children.length!==slots.length){overlay.replaceChildren();slots.forEach((r,i)=>{const index=i%count(),button=document.createElement('button');button.type='button';button.className='print-slot';bindCropSurface(button,()=>index,true);button.addEventListener('click',()=>selectPhoto(index));bindSlotDrop(button,index);overlay.append(button);});}
    [...overlay.children].forEach((button,i)=>{const index=i%count(),r=slots[i],p=state.photos[index];Object.assign(button.style,{left:r.x/g.width*100+'%',top:r.y/g.height*100+'%',width:r.w/g.width*100+'%',height:r.h/g.height*100+'%'});button.classList.toggle('active',selected===index);button.classList.toggle('empty',!p);button.disabled=busy||importing||exporting;button.setAttribute('aria-label',p?`Ô ${index+1} · ${p.media?(p.livePhoto?'Live Photo':p.media.kind==='gif'?'GIF':'Video'):'Ảnh'} · kéo để chỉnh vị trí`:`Thêm ảnh, GIF hoặc video vào ô ${index+1}`);button.setAttribute('aria-pressed',String(selected===index));button.textContent=p?'':`＋ Ô ${index+1}`;});
  }
  function drawTray(){
    const tray=$('photoTray'),n=count();
    if(tray.children.length!==n){tray.replaceChildren();for(let i=0;i<n;i++){
      const b=document.createElement('button');b.className='photo-slot';b.type='button';b.addEventListener('click',()=>selectPhoto(i));bindSlotDrop(b,i);tray.append(b);
    }}
    tray.style.gridTemplateColumns=`repeat(${n>4?3:n},minmax(0,1fr))`;
    [...tray.children].forEach((b,i)=>{
      const p=state.photos[i];b.disabled=busy||importing;b.classList.toggle('filled',!!p);b.classList.toggle('active',selected===i);b.setAttribute('aria-label',p?`Chỉnh ảnh ${i+1}`:`Thêm ảnh vào ô ${i+1}`);for(const child of b.children)if(child.tagName==='CANVAS')child.width=child.height=1;b.replaceChildren();
      if(p){let thumb;if(p.media){thumb=croppedThumb(p,150,true);thumb.setAttribute('role','img');thumb.setAttribute('aria-label',`Xem trước ${p.media.kind==='video'?'video':'GIF'} ${i+1}`);}else{thumb=document.createElement('img');thumb.src=croppedThumb(p,150);thumb.alt=`Ảnh ${i+1}`;}b.append(thumb);const label=document.createElement('span');label.className='photo-number'+(p.media?' motion-tag':'');label.textContent=`0${i+1}`+(p.media?' · '+(p.livePhoto?'LIVE':p.media.kind.toUpperCase()):'');b.append(label);}
      else{b.textContent=String(i+1).padStart(2,'0');const plus=document.createElement('span');plus.className='slot-plus';plus.textContent='+';b.append(plus);}
    });
  }
  function croppedThumb(p,w,asCanvas=false){const c=document.createElement('canvas');c.width=w;c.height=Math.round(w*.75);B.drawCover(c.getContext('2d'),p.filtered||p.image,0,0,c.width,c.height,p);if(asCanvas)return c;const url=c.toDataURL('image/jpeg',.75);c.width=c.height=1;return url;}
  function refreshMotionThumbs(){[...$('photoTray').children].forEach((b,i)=>{const p=state.photos[i],c=b.children[0];if(p?.media&&c?.tagName==='CANVAS'){const x=c.getContext('2d');x.clearRect(0,0,c.width,c.height);B.drawCover(x,p.filtered||p.image,0,0,c.width,c.height,p);}});}
  function outputDuration(){return B.clamp(+$('outputDuration').value||5,1,20);}
  function pauseTimeline(){timelinePlaying=false;++timelineToken;++frameSerial;$('playTimeline').textContent='▶ Xem chuyển động';}
  function syncClipControls(){
    const p=state.photos[selected];$('clipEditor').hidden=!p?.media;if(!p?.media)return;
    p.clip=Media.normalizeClip(p.clip,p.media.duration,p.media.kind);const c=p.clip;
    $('clipInfo').textContent=(p.livePhoto?'LIVE PHOTO':p.media.kind.toUpperCase())+' · '+p.media.width+' × '+p.media.height+' px · nguồn dài '+Media.formatTime(p.media.duration);
    for(const [id,key]of[['clipStart','start'],['clipEnd','end'],['clipOffset','offset'],['clipSpeed','speed']])$(id).value=c[key];$('clipStart').max=$('clipEnd').max=p.media.duration;$('clipLoop').checked=c.loop;
  }
  function seekTimeline(time,cap=480,options={}){
    const serial=++frameSerial,t=B.clamp(time,0,outputDuration());
    frameQueue=frameQueue.catch(()=>{}).then(async()=>{
      if(!options.required&&serial!==frameSerial)return;
      // Seek one decoder at a time; each slot retains its own last decoded canvas.
      for(const [i,p]of activePhotos().entries()){if(!p)continue;const edge=typeof cap==='function'?cap(p,i):cap;
        if(p.media){const clip=Media.normalizeClip(p.clip,p.media.duration,p.media.kind),tSource=Media.sourceTime(t,clip,p.media.duration,p.media.kind),playing=t>=clip.offset&&(clip.loop||(t-clip.offset)*clip.speed<clip.end-clip.start-.001),changed=await p.media.drawAt(tSource,edge,{realtime:options.realtime,playing,speed:clip.speed,start:clip.start,end:clip.end});if(changed||options.highQuality){p.image=p.media.canvas;filterPhoto(p,options.highQuality?{maxEdge:edge}:undefined);}}
        else if(options.highQuality||options.restore)filterPhoto(p,options.highQuality?{maxEdge:edge}:undefined);
      }
      if(options.visible===false||(!options.required&&serial!==frameSerial))return;
      B.render(canvas,state,480);refreshMotionThumbs();if(selected>=0&&state.photos[selected]?.media)drawSelectedMotion();controls();
    });return frameQueue;
  }
  function exportSourceEdges(g,width,index=-1){return(p,i)=>{const slot=g.slots[i],s=index===i?1200/slot.w:width/g.width,source=p.media||p.image,w=source.video?.videoWidth||source.naturalWidth||source.width,h=source.video?.videoHeight||source.naturalHeight||source.height;return Media.sourceEdge(w,h,slot.w*s,slot.h*s,p);};}
  async function playTimeline(){
    if(timelinePlaying){pauseTimeline();controls();return;}
    if(busy||importing||exporting||!activePhotos().some(p=>p?.media))return;
    if(timelineTime>=outputDuration()-.02)timelineTime=0;timelinePlaying=true;const token=++timelineToken,origin=Date.now()-timelineTime*1000;controls();
    try{while(token===timelineToken&&timelinePlaying){timelineTime=Math.min(outputDuration(),(Date.now()-origin)/1000);await seekTimeline(timelineTime,360);if(timelineTime>=outputDuration())break;await new Promise(r=>setTimeout(r,65));}}
    catch(e){toast(e.message||'Chưa xem được đoạn này.',true);}finally{if(token===timelineToken){timelinePlaying=false;requestDraw();}}
  }
  function controls(){
    const n=count(),filled=countFilled(),complete=filled===n,locked=busy||importing||cameraPending||exporting;
    $('photoCount').textContent=`${filled} / ${n} ảnh`;
    $('shootAll').disabled=!stream||locked;
    $('shootLabel').textContent=filled===n?`Chụp bộ ${n} ảnh mới`:`Chụp ${n-filled} kiểu${filled?' còn lại':''}`;
    $('quickShoot').hidden=!stream||selected>=0||busy;$('quickShoot').disabled=locked;
    $('quickShootLabel').textContent=filled===n?'Chụp bộ mới':`Chụp ${n-filled} kiểu`;
    const overlay=!!(state.theme==='custom'&&state.custom?.mode==='overlay');
    $('countControls').hidden=overlay;
    $('countHint').textContent=state.layout==='double'?`${state.photoCount} ảnh, in thành hai dải dọc giống nhau.`:state.layout==='strip'?`${state.photoCount} ảnh nối thành một dải kỷ niệm.`:state.photoCount===2?'Hai chân dung, một câu chuyện.':state.photoCount===5?'Một ảnh lớn + bốn khoảnh khắc nhỏ.':`${state.photoCount} khoảnh khắc, vừa xinh một trang.`;
    $('importPhotos').disabled=locked;$('importHero').disabled=locked;$('startCamera').disabled=locked;
    $('download').disabled=!complete||locked||exporting;$('share').disabled=!complete||locked||exporting;
    $('applyAllFX').disabled=!filled||locked;
    $('effectTarget').textContent=selected>=0?`Đang chỉnh ảnh ${selected+1} · tự giữ khi bấm Xong`:'Chọn một ô ảnh để chỉnh màu riêng. Mỗi ảnh giữ màu của mình.';
    const exportLabel=$('exportKind').value==='video'?'Tạo video':$('exportKind').value==='both'?'Tạo ảnh + video':'Lưu ảnh PNG';
    $('download').innerHTML=exporting?(videoExporting?'Đang dựng video…':'Đang chuẩn bị ảnh…'):icon('download')+' '+exportLabel;
    $('cancelShoot').hidden=!busy;$('shootAll').hidden=busy;
    $('switchCamera').disabled=!stream||locked;$('stopCamera').hidden=!stream;$('stopCamera').disabled=busy;
    $('flip').disabled=busy;$('reset').disabled=locked;$('timer').disabled=busy;
    document.querySelectorAll('[data-theme],[data-layout],[data-count],#caption,#printDate,#chooseBackground,#customMode,#downloadTemplate').forEach(e=>e.disabled=locked);
    document.querySelectorAll('#photoEditor button,#photoEditor input,#effectsControls input,#effectsControls select,.beauty-controls input,#labRoll,#rerollFX,#frameTextControls input,#frameTextControls button').forEach(e=>e.disabled=locked);
    $('downloadSingle').disabled=selected<0||!state.photos[selected]||locked;
    for(const id of ['rotateLeft','rotateRight','rotateHalf'])$(id).disabled=selected<0||!state.photos[selected]||locked;
    for(const id of ['zoomIn','zoomOut','centerPhoto'])if($(id))$(id).disabled=selected<0||!state.photos[selected]||locked;
    if($('previousSlot'))$('previousSlot').disabled=selected<=0||locked;
    if($('nextSlot'))$('nextSlot').disabled=selected<0||selected>=n-1||locked;
    for(const id of ['timelineTime','outputDuration','videoQuality','exportKind','clipStart','clipEnd','clipOffset','clipSpeed','clipLoop'])$(id).disabled=locked;
    $('playTimeline').disabled=locked||!activePhotos().some(p=>p?.media);$('playTimeline').textContent=timelinePlaying?'Ⅱ Tạm dừng':'▶ Xem chuyển động';
    const total=outputDuration();timelineTime=B.clamp(timelineTime,0,total);$('timelineTime').max=total;$('timelineTime').value=timelineTime;$('timelineValue').textContent=Media.formatTime(timelineTime)+' / '+Media.formatTime(total);
    const type=Media.recordingType(),videoFormat=type?(type.includes('mp4')?'MP4':'WebM'):null;
    $('exportVideoOption').disabled=$('exportBothOption').disabled=!videoFormat;
    $('exportVideoOption').textContent=videoFormat?'Video '+videoFormat:'Video · chưa được hỗ trợ';
    const videoSize=Media.exportSize(layoutGeometry().width,layoutGeometry().height,$('videoQuality').value);
    $('videoFormatHint').textContent=videoFormat?`Video ${videoFormat} · ${videoSize.width} × ${videoSize.height} px · 24 khung/giây mục tiêu, không có âm thanh. Ảnh PNG lấy đúng thời điểm đang chọn.`:'Trình duyệt này chưa hỗ trợ xuất video. Ảnh PNG vẫn lưu được; thử mở bằng Safari/Chrome mới hơn.';
    $('renderProgress').hidden=!videoExporting;
    $('layoutGroup').hidden=!!(state.theme==='custom'&&state.custom?.mode==='overlay');
    $('caption').disabled=locked||!!(state.theme==='custom'&&state.custom?.mode==='overlay');
    $('printDate').disabled=$('caption').disabled;
    $('exportHint').textContent=complete?'Sẵn sàng rồi! Lưu cả bộ, hoặc chọn một ô để lưu ảnh lẻ.':`Thêm đủ ${n} ảnh để lưu bộ. Muốn lưu ảnh lẻ, chọn một ô rồi bấm Lưu ảnh này.`;
    $('exportHint').classList.toggle('ready',complete);
    $('shotCounter').textContent=`${String(Math.min(filled+1,n)).padStart(2,'0')} — ${String(n).padStart(2,'0')}`;
    const secs=+$('timer').value;$('captureTip').textContent=busy?'Giữ nguyên trang, nhìn vào camera và cứ tự nhiên nhé.':secs?`Mỗi kiểu cách nhau ${secs} giây. Cứ tự nhiên, ở đây chỉ có bạn thôi.`:'Chụp liên tiếp, mỗi kiểu cách nhau một nhịp. Sẵn sàng nhé!';
    window.RayBoothWorkspace?.sync();
  }
  function draw(){
    const g=B.render(canvas,state,480);$('dimensions').textContent=`${g.width} × ${g.height} PX`;
    $('printPaper').classList.toggle('strip',state.layout==='strip'&&!(state.theme==='custom'&&state.custom?.mode==='overlay'));
    $('printPaper').classList.toggle('custom-overlay',state.theme==='custom'&&state.custom?.mode==='overlay');
    $('printPaper').classList.toggle('double-strip',state.layout==='double');
    canvas.setAttribute('aria-label',`Bản xem trước khung ${state.theme==='newspaper'?'báo':state.theme==='harbor'?'Hải Phòng':state.theme==='scrapbook'?'sổ kỷ niệm':state.theme==='midnight'?'đêm lấp lánh':state.theme==='cinema'?'vé phim':state.theme==='ticket'?'Special Day':state.theme==='airmail'?'tem thư':state.theme==='collage'?'collage':'tải lên'}, ${countFilled()} trên ${count()} ảnh`);
    drawTray();drawSlotOverlay();controls();
  }
  function cameraError(err){
    if(err.name==='NotAllowedError'||err.name==='SecurityError')return 'Chưa được phép dùng camera. Hãy cho phép camera trong cài đặt trang; nếu mở trong ứng dụng, thử mở bằng Safari/Chrome. Bạn vẫn có thể chọn ảnh có sẵn.';
    if(err.name==='NotFoundError'||err.name==='DevicesNotFoundError')return 'Không tìm thấy camera. Bạn có thể chọn ảnh có sẵn để ghép.';
    if(err.name==='NotReadableError'||err.name==='TrackStartError')return 'Camera đang được ứng dụng khác sử dụng hoặc chưa sẵn sàng. Đóng ứng dụng đó rồi thử lại.';
    return 'Chưa mở được camera. Hãy thử lại bằng Safari/Chrome hoặc chọn ảnh có sẵn.';
  }
  function stopStream(){if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;$('cameraStatus').classList.remove('live');$('cameraStatus').replaceChildren(Object.assign(document.createElement('i'),{}),document.createTextNode(' CHƯA BẬT CAMERA'));}
  async function waitVideo(){
    const start=Date.now();while(video.readyState<2||!video.videoWidth){if(Date.now()-start>10000)throw new Error('Camera video timeout');await new Promise(r=>setTimeout(r,80));}
  }
  async function startCamera(){
    if(cameraPending||busy)return;
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){setCameraMessage('Camera cần trang HTTPS và trình duyệt hỗ trợ. Mở đường dẫn bằng Safari/Chrome, hoặc chọn ảnh có sẵn.');return;}
    cameraPending=true;controls();setCameraMessage('');$('startCamera').textContent='Đang mở camera…';
    try{
      stopStream();
      try{stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:1920},height:{ideal:1440}}});}
      catch(e){if(e.name==='OverconstrainedError')stream=await navigator.mediaDevices.getUserMedia({audio:false,video:true});else throw e;}
      video.srcObject=stream;video.muted=true;video.playsInline=true;showLive();await video.play();await waitVideo();
      const settings=stream.getVideoTracks()[0].getSettings?.()||{};if(settings.facingMode)facing=settings.facingMode;
      video.classList.toggle('mirrored',mirror);video.style.filter=filterCSS[state.filter];
      const track=stream.getVideoTracks()[0];track.addEventListener('ended',()=>{if(stream&&stream.getVideoTracks()[0]===track){++runId;busy=false;stopStream();showLive();setCameraMessage('Camera đã dừng. Bật lại camera để tiếp tục.');controls();}},{once:true});
      $('cameraStatus').classList.add('live');$('cameraStatus').replaceChildren(document.createElement('i'),document.createTextNode(' CAMERA ĐANG BẬT'));showLive();toast('Camera sẵn sàng. Thả dáng thôi!');
    }catch(err){stopStream();showLive();setCameraMessage(cameraError(err));}
    finally{cameraPending=false;$('startCamera').innerHTML=icon('camera')+' Bật camera';controls();}
  }
  async function delay(ms,id){const end=Date.now()+ms;while(Date.now()<end){if(id!==runId)throw new Error('cancelled');await new Promise(r=>setTimeout(r,Math.min(100,end-Date.now())));}if(id!==runId)throw new Error('cancelled');}
  async function capture(indices){
    if(busy||cameraPending||importing||exporting||!stream)return;
    pauseTimeline();busy=true;const id=++runId;controls();await frameQueue.catch(()=>{});
    if(id!==runId)return;showLive();clearSaved();controls();setCameraMessage('');
    try{
      for(let k=0;k<indices.length;k++){
        const i=indices[k];$('shotCounter').textContent=`${String(i+1).padStart(2,'0')} — ${String(count()).padStart(2,'0')}`;
        const slot=layoutGeometry().slots[i];$('viewfinder').style.aspectRatio=`${slot.w} / ${slot.h}`;
        const secs=+$('timer').value;
        for(let n=secs;n>0;n--){$('countdown').hidden=false;$('countdown').textContent=n;await delay(1000,id);}
        if(!secs)await delay(650,id);$('countdown').hidden=true;
        if(!stream||!stream.getVideoTracks()[0].enabled||video.readyState<2||!video.videoWidth)throw new Error('Camera chưa sẵn sàng.');
        const c=document.createElement('canvas'),scale=Math.min(1,1600/Math.max(video.videoWidth,video.videoHeight));
        c.width=Math.round(video.videoWidth*scale);c.height=Math.round(video.videoHeight*scale);
        const ctx=c.getContext('2d');if(mirror){ctx.translate(c.width,0);ctx.scale(-1,1);}ctx.drawImage(video,0,0,c.width,c.height);
        replaceAt(i,makePhoto(c,state.photos[i]?.look||newPhotoLook));$('flash').classList.remove('active');void $('flash').offsetWidth;$('flash').classList.add('active');requestDraw();
        if(k<indices.length-1)await delay(450,id);
      }
      toast(indices.length===1?'Đã chụp lại ô ảnh.':`Đủ ${count()} kiểu rồi. Ghé xem bản in nhé!`);
    }catch(e){if(e.message!=='cancelled')toast('Camera bị gián đoạn. Các ảnh đã chụp vẫn được giữ lại.',true);}
    finally{if(id===runId){busy=false;$('countdown').hidden=true;requestDraw();}}
  }
  function cancelCapture(message=true){++runId;busy=false;$('countdown').hidden=true;controls();if(message)toast('Đã dừng. Các ảnh vừa chụp vẫn được giữ lại.');}
  async function loadImage(file,maxSide=1600){
    if(!file)throw new Error('Chưa chọn ảnh.');
    if(file.size>30*1024*1024)throw new Error('Ảnh lớn hơn 30 MB. Hãy chọn ảnh JPG/PNG nhỏ hơn.');
    const url=URL.createObjectURL(file);
    try{
      const img=new Image();img.src=url;
      await new Promise((resolve,reject)=>{if(img.complete&&img.naturalWidth)return resolve();img.onload=resolve;img.onerror=()=>reject(new Error('Không đọc được ảnh này. Hãy dùng JPG, PNG hoặc WebP; nếu là HEIC, hãy xuất sang JPG.'));});
      if(!img.naturalWidth||!img.naturalHeight)throw new Error('Ảnh không hợp lệ.');
      const s=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*s));c.height=Math.max(1,Math.round(img.naturalHeight*s));c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c;
    }finally{URL.revokeObjectURL(url);}
  }
  async function importImages(files,replace=-1,options={}){
    if(busy||importing||exporting||!files.length)return;
    const items=Media.importItems(files);
    pauseTimeline();importing=true;controls();await frameQueue.catch(()=>{});let added=0,errors=[],motionAdded=false,firstAdded=-1;
    const n=count(),empty=Array.from({length:n},(_,i)=>i).filter(i=>!state.photos[i]);
    const targets=replace>=0?[replace]:(empty.length?empty:items.length===1&&selected>=0?[selected]:Array.from({length:n},(_,i)=>i));
    try{
      for(let j=0;j<Math.min(items.length,targets.length);j++){
        try{const i=targets[j],look=state.photos[i]?.look||newPhotoLook;let p;
          const file=items[j].file;
          if(Media.isVideo(file)||Media.isGIF(file)){const media=await Media.load(file);try{p=makePhoto(media.canvas,look);}catch(e){media.dispose();throw e;}p.media=media;p.livePhoto=items[j].live||!!options.live;p.clip=Media.normalizeClip({end:Math.min(media.duration,5),...(p.livePhoto?{loop:true}:{})},media.duration,media.kind);motionAdded=true;}
          else{const img=await loadImage(file);p=makePhoto(img,look);}replaceAt(i,p);if(firstAdded<0)firstAdded=i;added++;requestDraw();
        }catch(e){errors.push(e.message);}
      }
      clearSaved();
      if(motionAdded&&Media.recordingType())$('exportKind').value='both';
      if(added){selected=firstAdded;restoreLook(state.photos[selected].look);renderSelected();toast(`Đã thêm ${added} ${motionAdded?'ảnh / video':'ảnh'}.${items.length>targets.length?` Chỉ nhận ${targets.length} khoảnh khắc; các tệp còn lại chưa được thêm.`:''}${motionAdded?' Bấm Xem chuyển động để phát cả khung.':''}`);}
      if(added&&activePhotos().some(p=>p?.media)){await seekTimeline(timelineTime,480,{required:true,visible:false});if(selected>=0)renderSelected();}
      if(errors.length)toast(errors[0],true);
    }finally{importing=false;requestDraw();$('photoInput').value='';$('replaceInput').value='';if($('liveInput'))$('liveInput').value='';}
  }
  function inspectHoles(image){
    const c=document.createElement('canvas'),s=Math.min(1,420/Math.max(image.width,image.height));c.width=Math.max(1,Math.round(image.width*s));c.height=Math.max(1,Math.round(image.height*s));const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,c.width,c.height);const holes=B.detectHoles(ctx.getImageData(0,0,c.width,c.height));c.width=c.height=1;return holes;
  }
  function chooseTheme(theme){
    state.theme=theme;$('customControls').hidden=theme!=='custom';
    if(['cinema','airmail','ticket'].includes(theme))state.layout='strip';
    if(['collage','hellonews','portnews'].includes(theme))state.layout='grid';
    syncFrameText();
    document.querySelectorAll('[data-layout]').forEach(el=>{const on=el.dataset.layout===state.layout;el.classList.toggle('active',on);el.setAttribute('aria-pressed',String(on));});
    document.querySelectorAll('[data-theme]').forEach(b=>{const on=b.dataset.theme===theme;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
    $('caption').placeholder=B.frameTextDefaults(theme).caption;
    if(selected>=count())showLive();else if(selected>=0)renderSelected();else showLive();invalidate();
  }
  async function importBackground(file){
    if(!file||busy||importing)return;importing=true;controls();
    try{
      const image=await loadImage(file,2400);
      if(image.height/image.width>6||image.width/image.height>3)throw new Error('Phông quá dài hoặc quá ngang. Hãy chọn phông có tỷ lệ gần bưu thiếp hoặc dải ảnh.');
      const holes=inspectHoles(image);let mode=$('customMode').value;
      if(holes.length)mode='overlay';
      else if(mode==='overlay')throw new Error('Chưa tìm thấy ô trong suốt hình chữ nhật. Chọn “Ảnh nền JPG / PNG”, hoặc dùng mẫu khung tải từ ứng dụng.');
      if(state.custom?.image)state.custom.image.width=state.custom.image.height=1;
      state.custom={image,mode,holes,width:image.width,height:image.height};$('customMode').value=mode;
      $('backgroundInfo').textContent=mode==='overlay'?`Đã nhận ${holes.length} ô ảnh trong suốt. Bố cục và số ảnh giữ theo khung gốc.`:'Đã tải phông. Ảnh nền nằm dưới các ô ảnh; chọn bố cục bạn thích.';
      chooseTheme('custom');toast(mode==='overlay'?`Đã nhận khung ${holes.length} ô. Sẵn sàng ghép ảnh!`:'Đã tải phông của bạn.');
    }catch(e){toast(e.message,true);}finally{importing=false;$('backgroundInput').value='';requestDraw();}
  }
  function toBlob(c){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Xuất ảnh mất quá lâu. Hãy thử lại.')),20000);try{c.toBlob(b=>{clearTimeout(timer);b?resolve(b):reject(new Error('Chưa xuất được ảnh. Hãy thử lại.'));},'image/png');}catch(e){clearTimeout(timer);reject(e);}});}
  function filename(prefix='pho-cang'){return `${prefix}-${$('printDate').value||dateISO}.png`;}
  function triggerDownload(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  function canShareFile(file){try{return !!(navigator.share&&navigator.canShare?.({files:[file]}));}catch(e){return false;}}
  function dataBlob(url){if(!url.startsWith('data:image/png;base64,'))throw new Error('Không tạo được ảnh PNG.');const raw=atob(url.split(',')[1]),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return new Blob([bytes],{type:'image/png'});}
  function openSaved(){const d=$('saveFallback');d.hidden=false;if(!d.open&&d.showModal)d.showModal();}
  function selectOutput(index){
    const f=outputFiles[index];if(!f)return;$('savedVideo').pause?.();readyExport={blob:f.blob,name:f.name,file:f.file,kind:f.kind};
    $('savedImage').hidden=f.kind!=='image';$('savedVideo').hidden=f.kind!=='video';
    if(f.kind==='image')$('savedImage').src=f.data||f.url;else $('savedVideo').src=f.url;
    $('downloadReady').href=f.url;$('downloadReady').download=f.name;$('downloadReady').textContent=f.kind==='image'?'Tải ảnh PNG':'Tải video '+f.ext.toUpperCase();$('saveToPhotos').hidden=!canShareFile(f.file);
    $('saveToPhotos').textContent=f.kind==='video'?'Lưu video / Chia sẻ':'Lưu ảnh / Chia sẻ';
    for(const [id,on] of [['outputImageTab',f.kind==='image'],['outputVideoTab',f.kind==='video']]){$(id).classList.toggle('active',on);$(id).setAttribute('aria-pressed',String(on));}
    $('saveStatus').textContent=f.kind==='image'?'Đang chọn ảnh PNG. Bấm Lưu ảnh / Chia sẻ, hoặc nhấn giữ ảnh để lưu.':(f.width&&f.height?`${f.width} × ${f.height} px · `:'')+(f.ext==='mp4'?'Đang chọn video MP4. Bấm Lưu video / Chia sẻ rồi chọn Lưu video.':'Đang chọn video WebM. Bấm Lưu video / Chia sẻ; nếu không có Lưu video, chọn Lưu vào Tệp.')+(outputFiles.length>1?' Ảnh tĩnh nằm ở tab Ảnh PNG.':'');
  }
  function showOutputs(files){
    clearSaved();outputFiles=files.map(f=>({...f,url:URL.createObjectURL(f.blob),file:new File([f.blob],f.name,{type:f.blob.type})}));
    $('outputTabs').hidden=files.length<2;$('outputImageTab').hidden=!files.some(f=>f.kind==='image');$('outputVideoTab').hidden=!files.some(f=>f.kind==='video');
    const movie=files.find(f=>f.kind==='video');if(movie)$('outputVideoTab').textContent='Video '+movie.ext.toUpperCase();
    $('shareBothFiles').hidden=files.length<2||!canShareFiles(outputFiles.map(f=>f.file));
    $('saveTitle').textContent=files.length>1?'Video và ảnh đã sẵn sàng':movie?'Video đã sẵn sàng':'Ảnh đã sẵn sàng';selectOutput(movie?files.indexOf(movie):0);openSaved();
    if(window.parent&&window.parent!==window)window.parent.BuongToiHost?.onBoothOutputs(files);
  }
  function canShareFiles(files){try{return!!(navigator.share&&navigator.canShare?.({files}));}catch(e){return false;}}
  async function buildImageOutput(index=-1){
    const g=layoutGeometry();await seekTimeline(timelineTime,exportSourceEdges(g,g.width,index),{required:true,visible:false,highQuality:true});let c;
    try{if(index>=0)c=croppedCanvas(state.photos[index],1200,index);else{c=document.createElement('canvas');B.render(c,state);}const data=IOS?c.toDataURL('image/png'):null,blob=data?dataBlob(data):await toBlob(c);return{kind:'image',blob,data,name:index>=0?filename(`pho-cang-anh-${index+1}`):filename(),ext:'png'};}finally{if(c)c.width=c.height=1;}
  }
  async function exportPhoto(share=false,index=-1){
    if(exporting||(index<0?countFilled()!==count():!state.photos[index]))return;if(effectTimer)applyCurrentEffects();pauseTimeline();exporting=true;controls();
    try{
      const file=await buildImageOutput(index);showOutputs([file]);if(!IOS&&!share)triggerDownload(file.blob,file.name);
    }catch(e){toast('Chưa tạo được ảnh để lưu. Hãy thử lại hoặc chọn bộ ít ảnh hơn.',true);}
    finally{exporting=false;await seekTimeline(timelineTime,480,{required:true,visible:false,restore:true}).catch(()=>{});if(selected>=0)renderSelected();requestDraw();controls();}
  }
  async function exportSet(share=false){
    const kind=$('exportKind').value||'image';if(kind==='image')return exportPhoto(share);
    if(exporting||countFilled()!==count())return;if(effectTimer)applyCurrentEffects();pauseTimeline();exporting=true;videoExporting=true;videoAbort=new AbortController();controls();const files=[];let frame,out;
    try{
      if(kind==='both')files.push(await buildImageOutput());
      const g=layoutGeometry(),size=Media.exportSize(g.width,g.height,$('videoQuality').value);out=document.createElement('canvas');out.width=size.width;out.height=size.height;frame=document.createElement('canvas');const edges=exportSourceEdges(g,out.width);let live=false;
      const result=await Media.record(out,{duration:outputDuration(),fps:24,signal:videoAbort.signal,onStart:()=>{live=true;},onStop:()=>{live=false;for(const p of activePhotos())p?.media?.video?.pause();},renderAt:async t=>{await seekTimeline(t,edges,{required:true,visible:false,highQuality:true,realtime:live});B.render(frame,state,out.width);const ctx=out.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(frame,0,0,frame.width,frame.height,0,0,out.width,out.height);},onProgress:(t,d)=>{$('videoProgress').value=t/d;$('renderStatus').textContent=`Đang dựng video ${Media.formatTime(t)} / ${Media.formatTime(d)} · ${out.width} × ${out.height} px. Giữ trang mở; có thể bấm Dừng xuất.`;}});
      files.push({kind:'video',blob:result.blob,ext:result.ext,width:result.width,height:result.height,name:filename('pho-cang-video').replace(/\.png$/,'.'+result.ext)});showOutputs(files);
    }catch(e){if(files.length){showOutputs(files);$('saveTitle').textContent=e.name==='AbortError'?'Đã dừng tạo video':'Chưa tạo được video';$('saveStatus').textContent=(e.name==='AbortError'?'Đã dừng xuất video.':'Chưa tạo được video: '+(e.message||'Lỗi bộ xuất video')+'.')+' Hiện chỉ có ảnh PNG; quay lại và tạo video lần nữa. Các ô ảnh vẫn được giữ.';}toast(e.name==='AbortError'?'Đã dừng xuất video. Các ô ảnh vẫn được giữ.':(e.message||'Chưa xuất được video. Hãy thử lại.'),true);}
    finally{if(frame)frame.width=frame.height=1;if(out)out.width=out.height=1;videoExporting=false;videoAbort=null;exporting=false;await seekTimeline(timelineTime,480,{required:true,visible:false,restore:true}).catch(()=>{});if(selected>=0)renderSelected();requestDraw();controls();}
  }
  async function shareReady(){
    if(!readyExport||!canShareFile(readyExport.file))return;
    // The file is already encoded. Invoke share directly from this fresh tap.
    $('saveToPhotos').disabled=true;
    try{await navigator.share({files:[readyExport.file],title:'Linh Linh - Phố Cảng'});$('saveStatus').textContent='Bạn có thể lưu lại hoặc quay về chỉnh ảnh.';}
    catch(e){$('saveStatus').textContent=e.name==='AbortError'?'Tệp vẫn ở đây. Bạn có thể bấm lưu lại bất cứ lúc nào.':'Chưa mở được bảng chia sẻ. Dùng nút Tải phía trên, hoặc thử bấm chia sẻ lại.';}
    finally{$('saveToPhotos').disabled=false;}
  }
  async function downloadTemplate(){
    const blank={...state,theme:'newspaper',layout:state.layout==='double'?'strip':state.layout,photos:Array(6).fill(null),custom:null,caption:'',date:state.date};
    const c=document.createElement('canvas'),g=B.render(c,blank);const ctx=c.getContext('2d');for(const r of g.slots)ctx.clearRect(r.x,r.y,r.w,r.h);
    try{triggerDownload(await toBlob(c),`khung-bao-${state.photoCount}-anh-${state.layout}-trong-suot.png`);toast('Đã tải mẫu PNG. Có thể trang trí thêm rồi tải lại vào app.');}catch(e){toast(e.message,true);}finally{c.width=c.height=1;}
  }
  async function resetAll(){
    if(countFilled()&&!window.confirm('Bắt đầu bộ ảnh mới? Ảnh chưa tải về sẽ được xóa khỏi buồng chụp.'))return;
    pauseTimeline();await frameQueue.catch(()=>{});cancelCapture(false);state.photos.forEach(disposePhoto);state.photos=Array(6).fill(null);timelineTime=0;clearSaved();showLive();toast('Buồng chụp đã sẵn sàng cho bộ ảnh mới.');
  }

  $('printDate').value=dateISO;
  $('startCamera').addEventListener('click',startCamera);
  $('stopCamera').addEventListener('click',()=>{cancelCapture(false);stopStream();showLive();});
  $('switchCamera').addEventListener('click',()=>{facing=facing==='user'?'environment':'user';startCamera();});
  $('flip').addEventListener('click',()=>{mirror=!mirror;video.classList.toggle('mirrored',mirror);$('flip').setAttribute('aria-pressed',String(mirror));toast(mirror?'Đã bật lật gương cho camera.':'Đã tắt lật gương cho camera.');});
  function shootCurrent(){const empty=Array.from({length:count()},(_,i)=>i).filter(i=>!state.photos[i]);if(!empty.length&&!window.confirm('Chụp bộ mới và thay tất cả ảnh hiện tại? Hãy tải ảnh trước nếu muốn giữ bộ này.'))return;capture(empty.length?empty:Array.from({length:count()},(_,i)=>i));}
  $('shootAll').addEventListener('click',shootCurrent);$('quickShoot').addEventListener('click',shootCurrent);
  $('cancelShoot').addEventListener('click',()=>cancelCapture());$('timer').addEventListener('change',controls);
  for(const id of ['importPhotos','importHero'])$(id).addEventListener('click',()=>$('photoInput').click());
  $('photoInput').addEventListener('change',e=>importImages([...e.target.files]));
  $('replaceInput').addEventListener('change',e=>{if(e.target.files.length)importImages([...e.target.files],replacementIndex);});
  $('liveInput')?.addEventListener('change',e=>{if(e.target.files.length)importImages([...e.target.files],-1,{live:true});});
  for(const k of ['grain','flash','vignette','leak'])$('fx-'+k).addEventListener('input',()=>{
    state.effects[k]=+$('fx-'+k).value;if(state.rollId)state.lab[k]=state.effects[k]/100;$('fxPreset').value='custom';syncEffectControls();saveCurrentLook();clearSaved();clearTimeout(effectTimer);effectTimer=setTimeout(applyCurrentEffects,140);
  });
  for(const k of ['smooth','brighten'])$('beauty-'+k).addEventListener('input',()=>{state.beauty[k]=+$('beauty-'+k).value;syncEffectControls();saveCurrentLook();clearSaved();clearTimeout(effectTimer);effectTimer=setTimeout(applyCurrentEffects,140);});
  $('fxPreset').addEventListener('change',()=>{
    const options={clean:{grain:0,flash:0,vignette:0,leak:0},film:{grain:30,flash:4,vignette:22,leak:10},flash:{grain:8,flash:42,vignette:30,leak:0},dream:{grain:8,flash:20,vignette:10,leak:25}};
    if(options[$('fxPreset').value]){if($('fxPreset').value==='clean'){state.rollId='';state.filter='natural';state.lab={...Lab.defaults};$('labRoll').value='goc';}state.effects={...options[$('fxPreset').value]};if(state.rollId)for(const k of ['grain','flash','vignette','leak'])state.lab[k]=state.effects[k]/100;syncEffectControls();saveCurrentLook();applyCurrentEffects();}
  });
  $('labRoll').addEventListener('change',()=>{
    const id=$('labRoll').value;state.rollId=id==='goc'?'':id;state.filter='natural';state.lab=Lab.parameters(id);
    for(const k of ['grain','flash','vignette','leak'])state.effects[k]=Math.round(state.lab[k]*100);
    syncEffectControls();$('fxPreset').value=id==='goc'?'clean':'custom';video.style.filter='none';saveCurrentLook();applyCurrentEffects();
  });
  $('rerollFX').addEventListener('click',()=>{if(!state.rollId){toast('Chọn một màu phim để đổi hạt.');return;}state.lab.seed=Math.floor(Math.random()*1e9);saveCurrentLook();applyCurrentEffects();});
  $('applyAllFX').addEventListener('click',()=>{if(effectTimer)applyCurrentEffects();const look=currentLook();newPhotoLook=cloneLook(look);for(const p of state.photos)if(p)p.look=cloneLook(look);applyCurrentEffects();toast('Đã áp dụng chỉnh sửa này cho cả bộ ảnh.');});
  $('themeGroup').addEventListener('click',e=>{const b=e.target.closest('[data-theme]');if(!b||busy||importing)return;chooseTheme(b.dataset.theme);if(b.dataset.theme==='custom'&&!state.custom)$('backgroundInput').click();});
  $('layoutGroup').addEventListener('click',e=>{const b=e.target.closest('[data-layout]');if(!b||busy||importing)return;state.layout=b.dataset.layout;document.querySelectorAll('[data-layout]').forEach(el=>{const on=el===b;el.classList.toggle('active',on);el.setAttribute('aria-pressed',String(on));});syncFrameText();if(selected>=0)renderSelected();else showLive();invalidate();});
  $('countGroup').addEventListener('click',e=>{
    const b=e.target.closest('[data-count]');if(!b||busy||importing)return;
    state.photoCount=Number(b.dataset.count);
    document.querySelectorAll('[data-count]').forEach(el=>{const on=el===b;el.classList.toggle('active',on);el.setAttribute('aria-pressed',String(on));});
    syncFrameText();if(selected>=count())showLive();else if(selected>=0)renderSelected();else showLive();invalidate();
  });
  $('chooseBackground').addEventListener('click',()=>$('backgroundInput').click());
  $('backgroundInput').addEventListener('change',e=>importBackground(e.target.files[0]));
  $('customMode').addEventListener('change',()=>{
    if(!state.custom)return;
    if($('customMode').value==='overlay'&&!state.custom.holes.length){$('customMode').value='background';toast('Phông này chưa có ô trong suốt. Hãy dùng ảnh nền hoặc tải mẫu khung PNG.',true);return;}
    state.custom.mode=$('customMode').value;$('backgroundInfo').textContent=state.custom.mode==='overlay'?`Đã nhận ${state.custom.holes.length} ô ảnh trong suốt.`:'Ảnh nền nằm dưới các ô ảnh.';if(selected>=count())showLive();else if(selected>=0)renderSelected();else showLive();invalidate();
  });
  $('downloadTemplate').addEventListener('click',downloadTemplate);
  $('caption').addEventListener('input',()=>{state.caption=$('caption').value;state.captionEdited=true;state.showText=true;$('showFrameText').checked=true;invalidate();});
  for(const [id,key] of [['frameTitle','title'],['frameSubtitle','subtitle']])$(id).addEventListener('input',()=>{state[key]=$(id).value;state.textByTheme[state.theme]={title:state.title,subtitle:state.subtitle};state.showText=true;$('showFrameText').checked=true;invalidate();});
  $('showFrameText').addEventListener('change',()=>{state.showText=$('showFrameText').checked;invalidate();});
  $('clearFrameText').addEventListener('click',()=>{state.showText=false;$('showFrameText').checked=false;invalidate();});
  $('resetFrameText').addEventListener('click',()=>{delete state.textByTheme[state.theme];state.showText=true;state.caption='';state.captionEdited=false;$('caption').value='';$('showFrameText').checked=true;syncFrameText();invalidate();});
  $('printDate').addEventListener('change',()=>{const val=$('printDate').value;state.date=val?val.split('-').reverse().join('.'):'';invalidate();});
  $('closeEditor').addEventListener('click',showLive);
  $('zoom').addEventListener('input',()=>{const p=state.photos[selected];if(p){p.zoom=+$('zoom').value;renderSelected();invalidate();}});
  $('replacePhoto').addEventListener('click',()=>{replacementIndex=selected;$('replaceInput').click();});
  $('flipPhoto').addEventListener('click',()=>{const p=state.photos[selected];if(p){p.flip=!p.flip;renderSelected();invalidate();}});
  function rotateSelected(delta){const p=state.photos[selected];if(!p||busy||importing||exporting)return;pauseTimeline();p.rotation=((p.rotation||0)+delta+360)%360;p.x=p.y=0;renderSelected();invalidate();}
  $('rotateLeft').addEventListener('click',()=>rotateSelected(-90));$('rotateRight').addEventListener('click',()=>rotateSelected(90));$('rotateHalf').addEventListener('click',()=>rotateSelected(180));
  $('deletePhoto').addEventListener('click',async()=>{pauseTimeline();await frameQueue.catch(()=>{});if(selected>=0){replaceAt(selected,null);showLive();invalidate();}});
  $('retake').addEventListener('click',async()=>{const i=selected;if(!stream){await startCamera();if(!stream)return;}capture([i]);});
  let cropDrawScheduled=false;
  function paintCrop(){if(cropDrawScheduled)return;cropDrawScheduled=true;requestAnimationFrame(()=>{cropDrawScheduled=false;B.render(canvas,state,480);const p=state.photos[selected];if(p){$('zoom').value=p.zoom;$('zoomValue').textContent=p.zoom.toFixed(1)+'×';if(p.media)drawSelectedMotion();else{const c=$('selectedMotion'),r=layoutGeometry().slots[selected];c.width=700;c.height=Math.round(700*r.h/r.w);B.drawCover(c.getContext('2d'),p.filtered||p.image,0,0,c.width,c.height,p);$('selectedImage').hidden=true;c.hidden=false;}}});}
  function bindCropSurface(editor,index,selectOnStart=false){
    if(!window.BoothGestures)return;
    window.BoothGestures.bind(editor,{
      start(){const i=index();if(i<0||!state.photos[i]||busy||importing||exporting)return false;pauseTimeline();clearSaved();if(selectOnStart&&selected!==i)selectPhoto(i);return true;},
      snapshot(){const i=index(),p=state.photos[i];return p&&i===selected?{index:i,photo:p,x:p.x,y:p.y,zoom:p.zoom}:null;},
      change(base,{dx,dy,ratio,bounds}){
        const p=state.photos[base.index];if(p!==base.photo||selected!==base.index||busy||importing||exporting)return;
        const r=layoutGeometry().slots[base.index],size=B.orientedSize(p.image.width,p.image.height,p.rotation),old=B.cropRect(size.width,size.height,r.w,r.h,base.zoom,base.x,base.y);
        p.zoom=B.clamp(base.zoom*ratio,1,3);const next=B.cropRect(size.width,size.height,r.w,r.h,p.zoom,0,0),rx=(size.width-next.w)/2,ry=(size.height-next.h)/2;
        const u=(base.center.x-bounds.left)/bounds.width,v=(base.center.y-bounds.top)/bounds.height,ux=u+dx/bounds.width,vy=v+dy/bounds.height;
        const left=old.x+(p.flip?1-u:u)*old.w-(p.flip?1-ux:ux)*next.w,top=old.y+v*old.h-vy*next.h;
        p.x=rx?B.clamp((left-rx)/rx,-1,1):0;p.y=ry?B.clamp((top-ry)/ry,-1,1):0;paintCrop();
      },
      end(){if(selected>=0)renderSelected();requestDraw();},
      wheel(e){const i=index();if(i<0||!state.photos[i]||busy||importing||exporting)return false;if(selectOnStart&&selected!==i)selectPhoto(i);setZoom(state.photos[i].zoom*Math.exp(-e.deltaY*.0015));return true;}
    });
  }
  bindCropSurface($('viewfinder'),()=>selected);
  function setZoom(value){const p=state.photos[selected];if(!p||busy||importing||exporting)return;p.zoom=B.clamp(value,1,3);renderSelected();invalidate();}
  $('zoomOut')?.addEventListener('click',()=>setZoom((state.photos[selected]?.zoom||1)-.1));
  $('zoomIn')?.addEventListener('click',()=>setZoom((state.photos[selected]?.zoom||1)+.1));
  $('centerPhoto')?.addEventListener('click',()=>{const p=state.photos[selected];if(!p||busy||importing||exporting)return;p.x=p.y=0;p.zoom=1;renderSelected();invalidate();});
  function swapSlot(delta){const next=selected+delta;if(selected<0||next<0||next>=count()||busy||importing||exporting)return;pauseTimeline();[state.photos[selected],state.photos[next]]=[state.photos[next],state.photos[selected]];selected=next;restoreLook(state.photos[selected].look);renderSelected();invalidate();}
  $('previousSlot')?.addEventListener('click',()=>swapSlot(-1));$('nextSlot')?.addEventListener('click',()=>swapSlot(1));
  $('playTimeline').addEventListener('click',playTimeline);
  $('exportKind').addEventListener('change',()=>{clearSaved();controls();});
  $('timelineTime').addEventListener('input',()=>{pauseTimeline();timelineTime=+$('timelineTime').value;clearSaved();controls();seekTimeline(timelineTime,480).catch(e=>toast(e.message,true));});
  $('outputDuration').addEventListener('change',()=>{pauseTimeline();$('outputDuration').value=outputDuration();timelineTime=Math.min(timelineTime,outputDuration());invalidate();seekTimeline(timelineTime).catch(e=>toast(e.message,true));});
  $('videoQuality').addEventListener('change',()=>{clearSaved();controls();});
  for(const id of ['clipStart','clipEnd','clipOffset','clipSpeed','clipLoop'])$(id).addEventListener('change',()=>{const p=state.photos[selected];if(!p?.media)return;pauseTimeline();p.clip=Media.normalizeClip({start:+$('clipStart').value,end:+$('clipEnd').value,offset:+$('clipOffset').value,speed:+$('clipSpeed').value,loop:$('clipLoop').checked},p.media.duration,p.media.kind);syncClipControls();invalidate();seekTimeline(timelineTime).catch(e=>toast(e.message,true));});
  $('cancelVideoExport').addEventListener('click',()=>videoAbort?.abort());
  $('outputImageTab').addEventListener('click',()=>selectOutput(outputFiles.findIndex(f=>f.kind==='image')));
  $('outputVideoTab').addEventListener('click',()=>selectOutput(outputFiles.findIndex(f=>f.kind==='video')));
  $('shareBothFiles').addEventListener('click',async()=>{const files=outputFiles.map(f=>f.file);if(!canShareFiles(files))return;try{await navigator.share({files,title:'Ảnh và video Linh Linh - Phố Cảng'});}catch(e){if(e.name!=='AbortError')toast('Hãy chọn tab Ảnh hoặc Video để lưu từng tệp.',true);}});
  $('download').addEventListener('click',()=>exportSet(false));$('share').addEventListener('click',()=>exportSet(true));
  $('downloadSingle').addEventListener('click',()=>exportPhoto(false,selected));
  const editInDarkroom=document.getElementById('editInDarkroom');
  if(editInDarkroom){editInDarkroom.hidden=window.parent===window;editInDarkroom.addEventListener('click',async()=>{if(selected<0||!state.photos[selected]||exporting)return;try{pauseTimeline();const index=selected,out=await buildImageOutput(index);await window.parent.BuongToiHost?.openBoothPhoto(new File([out.blob],out.name,{type:out.blob.type}),index);}catch(e){toast(e.message||'Chưa chuyển được ảnh.',true);}});}
  $('saveToPhotos').addEventListener('click',shareReady);
  if(navigator.share&&navigator.canShare)$('share').hidden=false;
  $('closeFallback').addEventListener('click',closeSaved);$('saveFallback').addEventListener('cancel',closeSaved);$('reset').addEventListener('click',resetAll);
  const help=$('helpDialog');document.querySelectorAll('.help-open').forEach(b=>b.addEventListener('click',()=>help.showModal()));
  for(const id of ['closeHelp','gotIt'])$(id).addEventListener('click',()=>help.close());
  help.addEventListener('click',e=>{if(e.target===help){const r=help.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)help.close();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(busy)cancelCapture(false);pauseTimeline();if(videoExporting)videoAbort?.abort();}});
  window.addEventListener('pagehide',()=>{pauseTimeline();videoAbort?.abort();cancelCapture(false);stopStream();});
  window.addEventListener('pageshow',e=>{if(e.persisted){stopStream();showLive();controls();}});
  for(const r of Lab.rolls){const o=document.createElement('option');o.value=r.id;o.textContent=r.name;$('labRoll').append(o);}
  window.PhoCangBridge={
    deactivate(){pauseTimeline();cancelCapture(false);stopStream();},
    async importEditedPhoto(file,index=null){if(busy||importing||exporting)throw new Error('Chờ photobooth xử lý xong rồi thử lại.');let target=Number.isInteger(index)&&index>=0&&index<count()?index:activePhotos().findIndex(p=>!p);if(target<0)target=selected>=0?selected:0;await importImages([file],target);const p=state.photos[target];if(p){p.look={filter:'natural',rollId:'',lab:{...Lab.defaults},effects:{grain:0,flash:0,vignette:0,leak:0},beauty:{smooth:0,brighten:0},preset:'clean'};filterPhoto(p);restoreLook(p.look);renderSelected();invalidate();}},
    importFiles:files=>importImages(files),
    getWorkspaceState:()=>({selected,live:!!stream,locked:busy||importing||cameraPending||exporting,hasMotion:activePhotos().some(p=>p?.media),filled:countFilled()}),
  };
  $('labRoll').value='goc';$('fxPreset').value='clean';$('exportKind').value='image';$('outputDuration').value='5';$('videoQuality').value='1920';syncFrameText();$('showFrameText').checked=true;requestDraw();
})();
