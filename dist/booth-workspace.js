/* Keep the print and playback visible; reuse the original controls and handlers. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id),workspace=document.querySelector('.workspace'),studio=document.querySelector('.studio'),frames=document.querySelector('.print-desk'),desk=document.querySelector('.preview-desk'),preview=$('preview');
 if(!workspace||!studio||!frames||!desk||!preview)return;
 const make=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls||'';if(text)node.textContent=text;return node;};
 document.body.classList.add('booth-workspace');
 const controls=make('section','booth-controls'),tabs=make('nav','booth-tabs'),scroll=make('div','booth-controls-scroll'),footer=make('div','booth-export'),phone=window.matchMedia('(max-width:760px)');
 let focused=false,raf=0,lastSelected=-1,lastLive=false,toolsHeight=0,resizeDrag=null,ignoreGripClick=false;
 const grip=make('button','booth-tools-grip','Mở rộng công cụ');grip.type='button';grip.id='boothToolsGrip';scroll.id='boothToolPanel';grip.setAttribute('aria-controls',scroll.id);
 const maxToolsHeight=()=>Math.max(120,Math.min(280,workspace.getBoundingClientRect().height*.42));
 const normalToolsHeight=()=>Math.min(maxToolsHeight(),Math.max(164,workspace.getBoundingClientRect().height*.25));
 function setToolsHeight(value){toolsHeight=Math.max(0,Math.min(maxToolsHeight(),value));const open=toolsHeight>12;controls.style.setProperty('--booth-tools-height',Math.round(toolsHeight)+'px');document.body.classList.toggle('booth-tools-open',open);scroll.inert=phone.matches&&!open;grip.textContent=open?'Thu gọn để xem ảnh':'Mở rộng công cụ';grip.setAttribute('aria-expanded',String(open));grip.setAttribute('aria-label',open?'Thu gọn bảng công cụ để xem ảnh lớn':'Mở rộng bảng công cụ');for(const b of tabs.children)b.setAttribute('aria-expanded',String(!phone.matches||open&&b.getAttribute('aria-selected')==='true'));schedule();}
 tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Công cụ Photobooth');
 for(const selector of ['.export-kind','#videoFormatHint','.export-actions','#renderProgress','#exportHint']){const el=frames.querySelector(selector);if(el)footer.append(el);}
 const panels=[['photos','Khoảnh khắc',studio],['frames','Khung & chữ',frames]];
 function select(key){if(key==='frames'&&focused){focused=false;window.RayBoothWorkspace?.sync();}for(const [id,,panel]of panels){const active=id===key;panel.hidden=!active;const button=$('booth-tab-'+id);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;button.setAttribute('aria-expanded',String(!phone.matches||toolsHeight>12&&active));}scroll.scrollTop=key==='photos'&&!$('photoEditor').hidden?Math.max(0,$('photoEditor').offsetTop-studio.offsetTop-95):0;}
 for(const [id,label,panel]of panels){
  panel.id=panel.id||'booth-panel-'+id;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','booth-tab-'+id);
  const button=make('button','',label);button.type='button';button.id='booth-tab-'+id;button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);button.onclick=()=>{const same=button.getAttribute('aria-selected')==='true';select(id);if(phone.matches)setToolsHeight(same&&toolsHeight>12?0:normalToolsHeight());};tabs.append(button);scroll.append(panel);
 }
 controls.append(grip,tabs,scroll,footer);workspace.replaceChildren(desk,controls);desk.setAttribute('aria-label','Bản xem trước Photobooth');
 // The media picker and slot editor come before optional camera and colour tools.
 const title=studio.querySelector('.section-heading'),trayTitle=studio.querySelector('.photo-tray-heading'),privacy=studio.querySelector('.privacy-note'),viewfinder=$('viewfinder');
 const cameraStatus=$('cameraStatus'),cameraTools=studio.querySelector('.camera-toolbar'),shoot=$('shootAll'),cancel=$('cancelShoot'),captureTip=$('captureTip');
 const cameraDetails=make('details','booth-extra booth-camera'),cameraSummary=make('summary','','Chụp bằng camera');cameraDetails.append(cameraSummary,cameraStatus);
 const cameraLaunch=make('button','button secondary','Bật camera');cameraLaunch.type='button';cameraLaunch.onclick=()=>$('startCamera').click();cameraDetails.append(cameraLaunch,shoot,cancel,cameraTools,captureTip);
 const colour=make('details','booth-extra'),colourTitle=make('summary','','Màu & hiệu ứng cho ô này');colour.append(colourTitle,studio.querySelector('.lab-section'),studio.querySelector('.beauty-controls'),$('effectsControls'));
 const upload=make('section','booth-upload'),uploadTitle=make('p','booth-upload-title','Mỗi ô, một khoảnh khắc.'),uploadCopy=make('p','booth-upload-copy','Ghép ảnh, GIF và video ngắn trong cùng một khung.');
 $('importPhotos').innerHTML='<svg class="icon"><use href="#i-upload"/></svg> Thêm ảnh / GIF / video';$('importPhotos').classList.replace('secondary','primary');
 const liveHelp=make('details','booth-live-help');liveHelp.id='livePhotoHelp';liveHelp.append(make('summary','','Dùng Live Photo từ iPhone'));
 liveHelp.append(make('p','','Trong Ảnh trên iPhone: mở Live Photo → nút ⋯ → Lưu thành video. Chọn video vừa lưu ở đây để giữ chuyển động. Nếu dùng Lặp lại / Nảy lên, hãy chuyển về Live trước.'));
 const livePick=make('button','button secondary','Chọn video từ Live Photo');livePick.type='button';livePick.onclick=()=>$('liveInput').click();liveHelp.append(livePick);
 liveHelp.append(make('p','booth-live-note','Nếu chọn ảnh Live mà ô đứng yên, trình duyệt chỉ nhận được ảnh tĩnh. Bản gốc xuất kèm ảnh + MOV cùng tên có thể chọn cùng lúc để ghép thành một ô chuyển động.'));
 upload.append(uploadTitle,uploadCopy,$('importPhotos'),liveHelp);
 const motion=document.querySelector('.motion-panel'),motionSettings=motion.querySelector('.motion-settings'),motionHint=$('motionHint');
 const timing=make('details','booth-extra booth-timing');timing.append(make('summary','','Độ dài & chất lượng video'),motionSettings,motionHint);motionHint.textContent='Live Photo và GIF tự lặp trong khung. Chọn từng ô để cắt đầu / cuối, chỉnh tốc độ hoặc bật lặp video.';
 title.querySelector('h2').textContent='Ghép khoảnh khắc';
 studio.replaceChildren(title,upload,$('countControls'),trayTitle,$('photoTray'),$('photoEditor'),timing,colour,cameraDetails,privacy);
 $('replacePhoto').innerHTML='<svg class="icon"><use href="#i-upload"/></svg> Thay ảnh / video';
 viewfinder.querySelector('#editingLabel').textContent='Kéo vị trí · chụm hai ngón để phóng';
 // Both the complete print and an enlarged cell use the exact same crop state.
 const paper=$('printPaper'),stage=make('div','booth-stage'),toolbar=make('div','booth-preview-toolbar'),hint=make('p','booth-gesture-hint','Chạm ô để chọn · kéo để căn · chụm để phóng');
 const focus=make('button','','Phóng ô đang chọn');focus.type='button';focus.id='focusBoothSlot';focus.setAttribute('aria-pressed','false');
 const quickAdd=make('button','booth-quick-add','＋ Thêm ảnh / video');quickAdd.type='button';quickAdd.id='quickBoothImport';quickAdd.setAttribute('aria-label','Thêm ảnh hoặc video');quickAdd.onclick=()=>$('importPhotos').click();
 const play=$('playTimeline');toolbar.append(focus,play,quickAdd);
 desk.querySelector('.desk-caption').firstElementChild.textContent='KHUNG CỦA BẠN';desk.querySelector('.desk-footnote').remove();
 stage.append(paper,viewfinder);desk.append(toolbar,stage,hint);timing.before(motion);
 $('motionTitle').textContent='CHUYỂN ĐỘNG';
 function sync(){
  const state=window.PhoCangBridge?.getWorkspaceState();if(!state)return;
  if(state.selected<0)focused=false;
  if(state.live&&!lastLive){focused=false;cameraDetails.open=true;}
  lastLive=state.live;
  const camera=state.live&&state.selected<0,showSlot=focused&&state.selected>=0;
  desk.classList.toggle('show-slot',showSlot);desk.classList.toggle('show-camera',camera);focus.disabled=state.locked||state.selected<0;
  focus.textContent=showSlot?'Xem cả khung':state.selected>=0?`Phóng ô ${state.selected+1}`:'Phóng ô đang chọn';
  if(showSlot)focus.textContent='Xem cả khung';focus.setAttribute('aria-pressed',String(showSlot));quickAdd.disabled=grip.disabled=state.locked;play.hidden=motion.hidden=!state.hasMotion;
  livePick.disabled=cameraLaunch.disabled=state.locked;
  hint.textContent=camera?'Đặt dáng trong khung rồi bấm Chụp.':state.selected>=0?`Ô ${state.selected+1} · kéo vị trí · chụm hai ngón hoặc dùng thanh Phóng ô`:'Chạm ô trống để thêm · chạm ảnh để kéo và phóng';
  if(state.selected!==lastSelected&&state.selected>=0){select('photos');scroll.scrollTop=Math.max(0,$('photoEditor').offsetTop-studio.offsetTop-95);lastSelected=state.selected;}else if(state.selected<0)lastSelected=-1;
  schedule();
 }
 focus.onclick=()=>{focused=!focused;sync();};
 grip.onclick=()=>{if(ignoreGripClick){ignoreGripClick=false;return;}setToolsHeight(toolsHeight>12?0:normalToolsHeight());};
 grip.addEventListener('pointerdown',e=>{if(e.button!==undefined&&e.button!==0||grip.disabled)return;resizeDrag={id:e.pointerId,y:e.clientY,height:toolsHeight,moved:false};grip.setPointerCapture(e.pointerId);});
 grip.addEventListener('pointermove',e=>{if(!resizeDrag||resizeDrag.id!==e.pointerId||grip.disabled)return;const dy=resizeDrag.y-e.clientY;if(Math.abs(dy)>4)resizeDrag.moved=true;if(resizeDrag.moved){setToolsHeight(resizeDrag.height+dy);e.preventDefault();}});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])grip.addEventListener(event,e=>{if(resizeDrag?.id===e.pointerId){ignoreGripClick=event==='pointerup'&&resizeDrag.moved;resizeDrag=null;}});
 grip.addEventListener('keydown',e=>{if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();setToolsHeight(e.key==='Home'?0:e.key==='End'?maxToolsHeight():toolsHeight+(e.key==='ArrowUp'?24:-24));});
 function fit(){
  raf=0;const rect=stage.getBoundingClientRect(),style=getComputedStyle(stage),px=value=>parseFloat(value)||0,width=Math.max(1,rect.width-px(style.paddingLeft)-px(style.paddingRight)),height=Math.max(1,rect.height-px(style.paddingTop)-px(style.paddingBottom));
  const scale=Math.min(width/preview.width,height/preview.height);paper.style.width=Math.max(1,preview.width*scale)+'px';
  const ratio=parseFloat(viewfinder.style.aspectRatio?.split('/')[0])/parseFloat(viewfinder.style.aspectRatio?.split('/')[1])||4/3;viewfinder.style.width=Math.max(1,Math.min(width,height*ratio))+'px';
 }
 function schedule(){if(!raf)raf=requestAnimationFrame(fit);}
 new ResizeObserver(schedule).observe(stage);new MutationObserver(schedule).observe(preview,{attributes:true,attributeFilter:['width','height']});
 tabs.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const key=studio.hidden?'photos':'frames';select(key);if(phone.matches)setToolsHeight(normalToolsHeight());$('booth-tab-'+key).focus();};
 phone.addEventListener('change',()=>setToolsHeight(toolsHeight));
 window.RayBoothWorkspace={sync};select('photos');setToolsHeight(0);sync();schedule();
})();
