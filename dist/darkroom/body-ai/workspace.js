/* A single body-editing workspace. Existing controls, warps and draft formats stay in place. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.RayBodyWorkspace=api;api.init();}})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 function fitSize(width,height,spaceWidth,spaceHeight){
  if(![width,height,spaceWidth,spaceHeight].every(n=>Number.isFinite(n)&&n>0))return null;
  const scale=Math.min(spaceWidth/width,spaceHeight/height);
  return{width:width*scale,height:height*scale};
 }
 function init(){
  const $=id=>document.getElementById(id),box=$('bodyBox'),photo=$('view'),wrap=$('canvasWrap');
  if(!box||!photo||!wrap)return;
  const text=(tag,value,className)=>{const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;return el;};
  const details=(label,...nodes)=>{const el=document.createElement('details');el.className='ray-body-details';el.append(text('summary',label),...nodes.filter(Boolean));return el;};
  const navigation=document.createElement('nav');navigation.className='ray-body-tabs';navigation.setAttribute('role','tablist');navigation.setAttribute('aria-label','Cách chỉnh dáng');
  const manual=document.createElement('section');manual.id='rayBodyManual';
  const bodyAI=$('rayOverall62'),faceAI=$('rayFace55'),ratio=$('rayRatio54'),parts=$('bodyParts'),controls=$('bodyCtl'),oldAI=box.querySelector('.body-ai');
  const lines=document.createElement('section');lines.id='rayBodyLinesPane';
  const modes=[['manual','To/nhỏ · Bè/thon',manual],['body','AI cơ thể',bodyAI],['face','AI mặt',faceAI],['lines','Bút nét',lines]];
  let mode='manual',fitted=false,frame=0;
  for(const [key,label,pane]of modes){
   const button=text('button',label);button.type='button';button.id='rayBodyTab-'+key;button.setAttribute('role','tab');button.setAttribute('aria-controls',pane.id);button.onclick=()=>selectMode(key);navigation.append(button);
   pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby',button.id);
  }
  const partLabel=text('label','Bộ phận');partLabel.className='ray-body-picker';
  const picker=document.createElement('select');picker.id='rayBodyPart';picker.setAttribute('aria-label','Bộ phận muốn chỉnh');
  for(const [label,ids]of [['Mặt & cổ',['face','chin','neck']],['Tay',['armL','foreL','armR','foreR']],['Thân',['shL','shR','chest','back','waist','belly','hip','butt']],['Chân',['thL','clL','thR','clR']],['Vùng tự do',['f1','f2']]]){const group=document.createElement('optgroup');group.label=label;for(const id of ids){const p=BODY.parts.find(p=>p.id===id);if(!p)continue;const option=text('option',p.name);option.value=p.id;group.append(option);}picker.append(group);}partLabel.append(picker);
  box.append(manual);
  const partHint=text('p','Chọn vùng, đặt vòng lên ảnh rồi kéo thanh. Chỉ vùng đang chọn thay đổi.','ray-body-help');partHint.id='rayBodyPartHint';partHint.setAttribute('role','status');
  manual.append(partLabel,controls,partHint,parts);
  parts.hidden=true;
  const extra=document.createElement('div');for(const row of [...$('bodySliders').children])if(['push','dir','soft','rot'].includes(row.querySelector('input')?.dataset.bk))extra.append(row);
  controls.append(details('Đẩy, xoay & độ mềm viền',extra,$('bodyAiAlign')));
  const scanDetails=details('AI hỗ trợ đặt vị trí',oldAI);manual.append(scanDetails);
  if(oldAI){for(const p of oldAI.querySelectorAll('p'))if(p.id!=='bodyAiStatus')p.hidden=true;$('bodyAiScan').textContent='Nhận diện vị trí bộ phận';}
  manual.append($('bodyReset1'));
  const reference=details('Tỷ lệ tham khảo · tùy chọn',ratio);
  bodyAI.append(reference);
  const measurements=details('Số đo mặt · tham khảo',$('r55Metrics'));faceAI.append(measurements);
  for(const paragraph of [...box.querySelectorAll(':scope > .hint')])paragraph.hidden=true;
  for(const node of box.querySelectorAll('.bodyhist'))node.hidden=true;
  $('bodyPeek').hidden=true;$('bodyHide').hidden=true;
  $('bodyReset1').textContent='Đặt lại vùng này';$('bodyResetAll').textContent='Xóa toàn bộ chỉnh dáng';
  const reset=document.createElement('div');reset.className='ray-body-reset';reset.append($('bodyResetAll'));
  box.prepend(navigation);box.append(manual,bodyAI,faceAI,lines,reset);
  // One scan-and-apply action per AI pane; the common Apply/Undo controls handle the session.
  for(const id of ['r55Scan','r55Apply','r60CommitFine','r54Scan','r54SlimAll','ray62Apply','ray62Undo'])$(id).hidden=true;
  $('r48FaceOneTap').textContent='Quét và áp mẫu mặt';$('r48BodyOneTap').textContent='Quét AI & hiện viền';
  faceAI.querySelector('h3').textContent='Mẫu mặt & tinh chỉnh';faceAI.querySelector('.r55-tag').hidden=true;
  faceAI.querySelector('.r55-desc').textContent='Chọn người, mẫu và mức chỉnh. Kéo từng thanh để tinh chỉnh; bấm Áp dụng dưới ảnh để giữ.';
  for(const p of faceAI.querySelectorAll(':scope > .r55-small'))p.hidden=true;
  $('r60Feedback').hidden=false;$('r60Feedback').textContent='Kéo từng thanh để xem kết quả. Bấm Áp dụng dưới ảnh để giữ.';$('r55LiveHint').hidden=true;
  bodyAI.querySelector('h3').textContent='AI cơ thể';bodyAI.querySelector('p').textContent='Quét để hiện viền vàng rồi sửa cho đúng người. Chọn vùng và mức thay đổi khi muốn nắn bằng AI; Bút nét cho tự vẽ và uốn từng nét.';
  $('ray62Refine').textContent='Chuyển sang chỉnh từng vùng';
  $('ray62OverallStatus').textContent='Chọn vùng rồi bấm Quét AI & xem trước dáng.';
  $('r54Toggle').hidden=true;
  const refine=$('ray62Refine').onclick;$('ray62Refine').onclick=()=>{window.RayRatioLive?.accept();selectMode('manual');refine?.();};
  const originalUI=bodyUI;bodyUI=function(...args){const result=originalUI.apply(this,args);syncPicker();return result;};
  function syncPicker(){if(BODY.sel)picker.value=BODY.sel;picker.disabled=!source||BODY_AI.busy;
   const person=BODY_AI.people[BODY_AI.selected],regions=person?.raySource===source?person.regions:null,part=bodyPart(BODY.sel);
   for(const option of picker.options){const p=bodyPart(option.value),label=p&&p.name+(regions&&!regions[p.id]?' · đặt tay':'');if(label&&option.textContent!==label)option.textContent=label;}
   const message=!source?'Mở ảnh để chỉnh từng vùng.':BODY_AI.busy?'AI đang nhận diện. Các vùng đã chỉnh được giữ lại.':regions&&part&&!regions[part.id]?'AI chưa định vị '+part.name.toLowerCase()+'. Kéo vòng lên đúng vùng trong ảnh, đổi cỡ vòng rồi kéo thanh để chỉnh.':regions&&part?'Đang chỉnh '+part.name.toLowerCase()+' của Người '+(BODY_AI.selected+1)+'. Kéo lại vòng nếu vị trí AI chưa khớp.':'Chọn vùng, đặt vòng lên ảnh rồi kéo thanh. Chỉ vùng đang chọn thay đổi.';
   if(partHint.textContent!==message)partHint.textContent=message;
  }
  picker.onchange=()=>{BODY.sel=picker.value;BODY.hide=false;bodyUI();window.RayEditorVisibility?.guides?.(true);syncBody();};
  function selectMode(next){
   const changed=mode!==next;
   if(mode!==next)window.RayRatioLive?.cancel();
   mode=next;box.dataset.bodyMode=mode;
   for(const [key,,pane]of modes){const active=key===mode;pane.hidden=!active;const button=$('rayBodyTab-'+key);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
   if(mode==='manual'&&source){BODY.sel=BODY.sel||'waist';BODY.hide=false;bodyUI();window.RayEditorVisibility?.guides?.(true);}
   else{window.RayEditorVisibility?.guides?.(false);BODY.hide=true;syncBody();}
   if(mode!=='face')window.RayFace55?.hideGuides('manual');
   window.RayGeometry54?.guides(['body','lines'].includes(mode)&&$('rayBodyOutline').checked,['body','lines'].includes(mode)?'overall':'part');
   if(mode==='body')window.RayOverall62?.refresh();
   window.RayBodyPeople?.syncPicker();
   const scroll=box.closest('.scroll');if(changed&&scroll)scroll.scrollTop=0;
   fit();
   if(changed&&source)window.RaySession?.contextChanged();
  }
  navigation.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const index=modes.findIndex(([key])=>key===mode),next=modes[(index+(e.key==='ArrowRight'?1:modes.length-1))%modes.length][0];selectMode(next);$('rayBodyTab-'+next).focus();};
  document.addEventListener('input',e=>{if(mode==='manual'&&e.target.closest('#bodySliders'))window.RayEditorVisibility?.guides?.(true);},{capture:true});
  function fit(){
   if(window.RayWorkspace?.fitPhoto){window.RayWorkspace.fitPhoto();return;}
   const active=document.body.dataset.editorTool==='body';
   if(!active||!source){if(fitted){photo.style.removeProperty('width');photo.style.removeProperty('height');fitted=false;}return;}
   const rect=wrap.getBoundingClientRect(),size=fitSize(photo.width,photo.height,rect.width,rect.height);if(!size)return;
   photo.style.width=size.width+'px';photo.style.height=size.height+'px';fitted=true;
   syncOval();syncLeakHandle();syncNangHandle();syncBody();
  }
  const schedule=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;fit();});};
  if(window.ResizeObserver)new ResizeObserver(schedule).observe(wrap);
  if(window.MutationObserver){
   new MutationObserver(schedule).observe(photo,{attributes:true,attributeFilter:['width','height']});
   new MutationObserver(()=>{if(document.body.dataset.editorTool==='body')selectMode(mode);else fit();}).observe(document.body,{attributes:true,attributeFilter:['data-editor-tool']});
  }
  const originalDraw=draw;draw=function(...args){const result=originalDraw.apply(this,args);syncPicker();fit();return result;};
  api.selectMode=selectMode;selectMode('manual');
 }
 const api={fitSize,init};return api;
});
