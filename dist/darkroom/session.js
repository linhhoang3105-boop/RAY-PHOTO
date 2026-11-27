/* Editing session: reversible settings, explicit apply/cancel, and local drafts. */
(() => {
 'use strict';
 const host=window.parent!==window?window.parent.BuongToiHost:null,history=new RayEditHistory.Timeline(80);
 const app=document.querySelector('.film-workspace'),stage=document.getElementById('stage');
 let originalFile=null,documentKey=null,stageBase=null,appliedKey='',activeTool='film',timer=0,saveTimer=0,restoring=false,revision=0,saving=Promise.resolve(),savedRevision=-1,savedDocumentKey=null,savedSnapshotKey=null;
 const resumeKey='ray-photo-active-draft';let recovery=null;
 const album=window.RayAlbumStore?.create(indexedDB);let createdAt=Date.now(),restoringFile=false;
 const names={film:'Màu phim',adjust:'Điều chỉnh',sun:'Nắng',beauty:'Trang điểm',body:'Chỉnh dáng',background:'Thay nền',text:'Chữ trên ảnh',people:'Ghép người',remove:'Xóa người và vá nền',all:'Điều chỉnh'};
 const clone=o=>JSON.parse(JSON.stringify(o));
 function keyOf(snap){const beauty=snap.beauty,p={...snap.p};delete p.adjustRegionShow;delete p.adjustRegionPlaced;delete p.adjustRegionTargets;delete p.adjustRegionDrawing;delete p.adjustRegionPaintMode;delete p.adjustRegionBrushSize;if(p.adjustRegion!=='in'&&p.adjustRegion!=='out')for(const key of Object.keys(p))if(key.startsWith('adjustRegion')&&!(key==='adjustRegionStack'&&p[key]?.some(s=>s.adjustRegion==='in'||s.adjustRegion==='out')))delete p[key];return JSON.stringify({p,focus:snap.focus,sun:snap.sun,leak:snap.leak,layers:snap.layers,body:snap.bodyProfiles?undefined:snap.body,bodyProfiles:snap.bodyProfiles?.profiles,bodyContour:snap.bodyContour||undefined,bodyLines:snap.bodyLines||undefined,doodle:snap.doodle||undefined,brows:snap.brows,values:beauty.values,people:beauty.people.map(p=>({id:p.id,values:p.values})),faces:beauty.faces.map(f=>[f.length,f[1]?.x,f[1]?.y]),ready:beauty.ready,exportLong:snap.exportLong,photo:snap.photo,removal:window.RayRemove?.signature(snap.removal),compose:window.RayCompose?.signature(snap.compose)});}
 function capture(){
  const beauty={maps:BEAUTY.maps,faces:BEAUTY.faces,instances:BEAUTY.instances,ready:{...BEAUTY.ready},selected:BEAUTY.selected,nextPerson:BEAUTY.nextPerson,values:{...BEAUTY.values},
   people:BEAUTY.people.map(p=>({...p,ready:{...p.ready},values:{...p.values}}))};
  const snap={p:{...P},focus:{...F},sun:{...NK},leak:{...LK},layers:window.RayLayers?.capture()||[],body:BODY.parts.map(p=>({...p})),bodyProfiles:window.RayBodyPeople?.capture()||null,bodySelected:BODY.sel,beauty,brows:window.RayBrows?.capture(),exportLong,
   doodle:window.RayDoodle?.capture()||null,bodyLines:window.RayBodyLines?.capture()||null,bodyContour:window.RayBodyContour?.capture()||null,removal:window.RayRemove?.capture(),photo:window.RayPhotoEdit?.capture(),compose:window.RayCompose?.capture(),preset:document.querySelector('.roll.on')?.dataset.preset||null,presetTitle:document.querySelector('.roll.on')?.title||'Điều chỉnh'};
  snap.key=keyOf(snap);
  return snap;
 }
 function restore(snap){
  if(!snap)return;restoring=true;
  try{
   window.RayPhotoEdit?.restore(snap.photo);
   BEAUTY.job++;if(BEAUTY.busy)beautyWorkerStop();BEAUTY.busy=false;BEAUTY.peek=false;
   if(window.RayFilterStrength||Object.hasOwn(P,'rayFilterStrength'))P.rayFilterStrength=null;
   Object.assign(P,{stampScale:1},window.RayTone?.defaults,window.RayAdjustScope?.defaults,snap.p);Object.assign(F,snap.focus);Object.assign(NK,snap.sun);Object.assign(LK,snap.leak);exportLong=snap.exportLong??null;
   window.RayLayers?.restore(snap.layers);window.RayFilterStrength?.onRestore();
   BODY.parts=snap.body.map(p=>({...p}));BODY.sel=snap.bodySelected;BODY.peek=false;BODY_HIST.undo.length=BODY_HIST.redo.length=0;BODY_HIST.pending=null;
   window.RayBodyPeople?.restore(snap.bodyProfiles);
   window.RayBodyContour?.restore(snap.bodyContour);window.RayBodyLines?.restore(snap.bodyLines);window.RayDoodle?.restore(snap.doodle);
   const b=snap.beauty;Object.assign(BEAUTY,{maps:b.maps,faces:b.faces,instances:b.instances,ready:{...b.ready},selected:b.selected,nextPerson:b.nextPerson,faceCache:null,source});
   BEAUTY.people=b.people.map(p=>({...p,ready:{...p.ready},values:{...p.values}}));BEAUTY.values=BEAUTY.people[BEAUTY.selected]?.values||{...b.values};
   document.querySelectorAll('.roll').forEach(el=>el.classList.toggle('on',el.dataset.preset===snap.preset));syncControls();
   document.getElementById('dateTxt').value=P.dateText;document.getElementById('stampBtn').classList.toggle('on',P.stamp);document.getElementById('stampBtn').setAttribute('aria-pressed',String(P.stamp));drawReadout();
   const segs={rgAtmosSeg:P.rgAtmos,sparkModeSeg:P.sparkMode,nangModeSeg:P.nangManual?'manual':'auto',leakModeSeg:P.leakManual?'manual':'auto',leakShapeSeg:P.leakShape,sizeSeg:exportLong===null?'full':String(exportLong)};
   for(const [id,value]of Object.entries(segs))document.querySelectorAll('#'+id+' button').forEach(b=>b.classList.toggle('on',b.dataset.v===value));
   document.getElementById('leakAngleRow').style.display='';
   window.RayRemove?.restore(snap.removal);window.RayCompose?.restore(snap.compose);window.RayBrows?.restore(snap.brows);beautyRenderPeople();beautyUI();bodyUI();bodyHistUI();syncOval();syncLeakHandle();syncNangHandle();syncBody();queue();revision++;
  }finally{restoring=false;update();}
 }
 const floating=document.createElement('div');floating.className='session-toolbar';
 function button(label,text,action){const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label);b.title=label;b.textContent=text;b.onclick=action;return b;}
 const undo=button('Quay lại một bước','↶',()=>stepUndo()),redo=button('Làm lại một bước','↷',()=>stepRedo()),save=button('Lưu bản nháp','Lưu nháp',()=>saveDraft(true));
 const historyButtons=document.createElement('div');historyButtons.className='session-history';historyButtons.append(undo,redo);
 const compare=button('Giữ để xem ảnh ban đầu','So sánh',()=>{});const right=document.createElement('div');right.className='session-quick';right.append(compare,save);window.RayControls?.attachDateToggle(right);floating.append(historyButtons,right);stage.append(floating);
 const bar=document.createElement('div');bar.className='session-apply-bar';
 const cancel=button('Hủy chỉnh sửa của bước này','× Hủy bước',cancelStep),status=document.createElement('span');status.id='sessionStatus';status.setAttribute('role','status');
 const apply=button('Áp dụng bước chỉnh sửa','Áp dụng ✓',applyStep);apply.className='session-apply';
 const resume=button('Mở lại công cụ chỉnh ảnh','Chỉnh tiếp',()=>showResult(false));resume.className='session-resume';resume.hidden=true;
 const rebuild=button('Tái tạo lại vùng vá cuối bằng AI từ ảnh gốc','Dùng AI',rebuildRemoval);rebuild.className='session-rebuild';rebuild.hidden=true;
 const stopRemove=button('Dừng xử lý xóa và giữ nguyên vùng chọn','Dừng',()=>window.RayRemove?.cancel());stopRemove.className='session-remove-stop';stopRemove.hidden=true;
 bar.append(cancel,status,apply,stopRemove,rebuild,resume);app.append(bar);
 async function rebuildRemoval(){
  if(!source||BEAUTY.busy||BODY_AI.busy||window.RayCompose?.busy||window.RayRemove?.busy||!window.RayRemove?.resultInfo?.canRebuild)return false;
  const image=source,id=documentKey;window.BuongToiApp?.showTools?.('remove');activeTool='remove';showResult(false);
  const ok=await window.RayRemove.rebuildAI();if(source!==image||documentKey!==id||activeTool!=='remove')return false;
  if(!ok){notify(window.RayRemove.message,true);return false;}return applyStep();
 }
 function showResult(on){
  const viewing=!!on&&!!source,changed=app.classList.contains('is-result-preview')!==viewing;app.classList.toggle('is-result-preview',viewing);cancel.hidden=apply.hidden=viewing;resume.hidden=!viewing;if(changed){revision++;scheduleSave();}update();
  requestAnimationFrame(()=>{syncOval();syncLeakHandle();syncNangHandle();syncBody();});
 }
 const originalCanvas=document.createElement('canvas');originalCanvas.id='sessionOriginal';originalCanvas.hidden=true;document.getElementById('canvasWrap').append(originalCanvas);
 function peek(on){if(!source)return;if(on){originalCanvas.width=preview.width;originalCanvas.height=preview.height;originalCanvas.getContext('2d').drawImage(source,0,0,originalCanvas.width,originalCanvas.height);}originalCanvas.hidden=!on;view.style.visibility=on?'hidden':'';stage.classList.toggle('session-peeking',on);}
 compare.addEventListener('pointerdown',e=>{if(!source)return;peek(true);compare.setPointerCapture(e.pointerId);e.preventDefault();});for(const type of ['pointerup','pointercancel','lostpointercapture'])compare.addEventListener(type,()=>peek(false));window.addEventListener('blur',()=>peek(false));
 function update(){
  const enabled=!!source,aiBusy=BEAUTY.busy||BODY_AI.busy||(window.RayCompose?.busy||window.RayRemove?.busy);undo.disabled=!enabled||aiBusy||!history.canUndo;redo.disabled=!enabled||aiBusy||!history.canRedo;apply.disabled=cancel.disabled=save.disabled=compare.disabled=!enabled||BEAUTY.busy||BODY_AI.busy||(window.RayCompose?.busy||window.RayRemove?.busy);
  const viewing=app.classList.contains('is-result-preview'),info=window.RayRemove?.resultInfo,removing=enabled&&!!window.RayRemove?.busy,hasResult=enabled&&viewing&&!!info?.count;
  app.classList.toggle('has-remove-result',hasResult);app.classList.toggle('remove-processing',removing);status.dataset.removeKind=hasResult?info.kind:'';
  rebuild.hidden=!hasResult||!info.canRebuild;rebuild.disabled=!enabled||aiBusy;stopRemove.hidden=!removing;stopRemove.disabled=!removing;
  if(removing||hasResult)status.classList.remove('error');
  const layerCount=window.RayLayers?.count||0;status.textContent=!enabled?'Mở ảnh để bắt đầu':removing?window.RayRemove.message:hasResult?info.label:viewing?'Đã áp dụng · '+(layerCount?layerCount+' lớp':'Xem ảnh'):capture().key===appliedKey?(layerCount?'Đã giữ '+layerCount+' lớp · Chỉnh tiếp':'Đã áp dụng · '+history.cursor+' bước'):names[activeTool]||'Chỉnh ảnh';
 }
 function record(label=names[activeTool]){
  clearTimeout(timer);timer=0;if(restoring||!source||BEAUTY.busy||BODY_AI.busy||(window.RayCompose?.busy||window.RayRemove?.busy))return false;
  const changed=history.push(capture(),label);if(changed){revision++;scheduleSave();}update();return changed;
 }
 function schedule(label){if(restoring||!source)return;clearTimeout(timer);timer=setTimeout(()=>record(label),350);update();}
 function stepUndo(){showResult(false);record();const s=history.undo();if(s){restore(s);stageBase=s;appliedKey=s.key;scheduleSave();}}
 function stepRedo(){showResult(false);record();const s=history.redo();if(s){restore(s);stageBase=s;appliedKey=s.key;scheduleSave();}}
 function applyStep(){
  if(!source||BEAUTY.busy||BODY_AI.busy||(window.RayCompose?.busy||window.RayRemove?.busy))return;
  if(activeTool==='remove'&&window.RayRemove?.pending){const image=source,id=documentKey;return window.RayRemove.applySelection().then(ok=>{if(!ok){notify(window.RayRemove.message,true);return false;}if(source!==image||documentKey!==id||activeTool!=='remove')return false;return applyStep();});}
  const keepBodyTools=activeTool==='body';
  if(keepBodyTools){window.RayRatioLive?.accept();bodyEnd();}
  record(names[activeTool]);const title=document.querySelector('.roll.on')?.title;
  if(window.RayLayers?.commit(title&&title!=='Gốc'?title:activeTool==='sun'?document.querySelector('.sun-categories button.active')?.textContent:activeTool==='adjust'?(window.RayControls?.captureSelection()?.adjustName==='Bút ánh sáng'?window.RayBrushUI?.layerTitle():window.RayControls?.captureSelection()?.adjustName==='Sáng/tối vùng'?window.RayToneUI?.layerTitle():window.RayControls?.captureSelection()?.adjustName):names[activeTool])){history.replaceCurrent(capture(),'Giữ lớp hiệu ứng');revision++;scheduleSave();}
  stageBase=capture();appliedKey=stageBase.key;
  if(keepBodyTools){window.RayBodyContour?.finish();window.RayBodyLines?.finish();window.RayEditorVisibility?.guides(false);}
  showResult(!keepBodyTools);
  const appliedDocument=documentKey,committedKey=stageBase.key;
  return saveDraft(false).then(saved=>{if(saved&&keepBodyTools&&activeTool==='body'&&documentKey===appliedDocument&&capture().key===committedKey)notify('Đã giữ chỉnh dáng. Có thể chỉnh tiếp; bấm Lưu ảnh để tải về.');return saved;});
 }
 function cancelStep(){if(!stageBase||!source)return;clearTimeout(timer);restore(stageBase);record('Hủy bước '+(names[activeTool]||''));appliedKey=stageBase.key;update();scheduleSave();}
 function notify(text,error=false){if(host?.toast)host.toast(text,error);else{status.textContent=text;status.classList.toggle('error',error);}}
 function serialize(){return{version:1,history:history.serialize(),current:capture(),stageBase,appliedKey,tool:activeTool,section:window.RayControls?.captureSelection(),resultPreview:app.classList.contains('is-result-preview'),colorEditing:window.RayMyPresets?.editingState?.()||null,media:window.RayVideoEditor?.capture?.()||null,bodyRecognition:window.RayBodyPose?.capture?.()||null};}
 async function localSave(payload){
  if(album)return album.put('drafts',payload);
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('buong-toi-album',2);r.onupgradeneeded=()=>{for(const name of ['exports','drafts'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await new Promise((resolve,reject)=>{const tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put(payload);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
 }
 function rememberDraft(id){try{localStorage.setItem(resumeKey,id);}catch{}try{sessionStorage.setItem(resumeKey,id);}catch{}}
 function scheduleSave(){clearTimeout(saveTimer);if(!restoringFile)saveTimer=setTimeout(()=>saveDraft(false),300);}
 let lastPoster=null;
 function saveDraft(showMessage=false){
  clearTimeout(saveTimer);if(!source||!originalFile||restoringFile)return Promise.resolve(false);record();clearTimeout(saveTimer);
  saving=saving.catch(()=>{}).then(async()=>{
   if(!source||!originalFile)return false;const key=documentKey,rev=revision;
   if(savedDocumentKey===key&&savedRevision===rev&&savedSnapshotKey===capture().key){if(showMessage)notify('Đã lưu bản nháp đầy đủ trên thiết bị.');return true;}
   const state=serialize(),advanced=window.RayAccess?.isAdvancedSnapshot(capture())||false;
   const payload={id:key,name:originalFile.name||'Ảnh của bạn',sourceFile:originalFile,poster:lastPoster,state,origin:'draft',mime:originalFile.type||'image/jpeg',updated:Date.now(),created:createdAt,steps:history.cursor,advancedDraft:advanced};
   try{
    await(host?.saveDraft?host.saveDraft(payload):localSave(payload));savedDocumentKey=key;savedRevision=rev;savedSnapshotKey=state.current.key;rememberDraft(key);
    if(showMessage)notify(advanced?'Đã giữ nháp nâng cao đầy đủ. Không mua vẫn mở lại và chỉnh tiếp được.':'Đã lưu bản nháp đầy đủ trên thiết bị.');
    // Poster creation is optional; original pixels and the full recipe have already committed.
    if(!document.hidden){const canvas=document.createElement('canvas'),ratio=Math.min(1,560/Math.max(view.width,view.height));canvas.width=Math.max(1,Math.round(view.width*ratio));canvas.height=Math.max(1,Math.round(view.height*ratio));canvas.getContext('2d').drawImage(view,0,0,canvas.width,canvas.height);
     canvas.toBlob(poster=>{canvas.width=canvas.height=0;if(!poster||key!==documentKey||rev!==revision)return;lastPoster=poster;saving=saving.catch(()=>{}).then(async()=>{if(key!==documentKey||rev!==revision)return;await(host?.saveDraft?host.saveDraft({...payload,poster}):localSave({...payload,poster}));}).catch(()=>{});},'image/jpeg',.8);}
    return true;
   }catch(e){notify(e.message||'Chưa lưu được nháp. Kiểm tra dung lượng thiết bị rồi bấm Lưu nháp.',true);return false;}
  });return saving;
 }
 async function ensureSaved(){for(let attempt=0;attempt<3;attempt++){const ok=await saveDraft(false);if(ok&&savedDocumentKey===documentKey&&savedRevision===revision&&savedSnapshotKey===capture().key)return true;}throw new Error('Chưa bảo toàn được nháp đầy đủ. Hãy giải phóng dung lượng rồi bấm Lưu nháp; bản đang chỉnh vẫn ở đây.');}
 async function forkDraft(state,label='Bản cơ bản',options={}){
  const id=globalThis.crypto?.randomUUID?.()||'draft-'+Date.now().toString(36)+Math.random().toString(36).slice(2),now=Date.now();
  const payload={id,name:label+' · '+(originalFile.name||'Ảnh của bạn'),sourceFile:originalFile,poster:null,state,origin:'draft',mime:originalFile.type||'image/jpeg',updated:now,created:now,steps:state.history.cursor,parentId:documentKey,advancedDraft:!!(options.advancedDraft||options.premiumDraft),variant:options.variant||'basic'};
  await(host?.saveDraft?host.saveDraft(payload):localSave(payload));return id;
 }

 function reset(file,options={}){restoringFile=!!options.restoring;createdAt=options.draftCreated||Date.now();lastPoster=null;P.brushStrokes=[];P.lightGuide=false;window.RayFilterStrength?.onSourceReset();clearTimeout(timer);clearTimeout(saveTimer);app.classList.remove('is-result-preview');cancel.hidden=apply.hidden=false;resume.hidden=true;recovery?.remove();recovery=null;window.RayBrows?.restore(null);window.RayLayers?.restore([]);window.RayPhotoEdit?.reset();window.RayRemove?.reset();window.RayCompose?.reset();window.RayBodyContour?.clear();window.RayBodyLines?.clear();window.RayDoodle?.clear();Object.assign(P,window.RayAdjustScope?.defaults);originalFile=file;documentKey=options.draftId||globalThis.crypto?.randomUUID?.()||'draft-'+Date.now().toString(36)+Math.random().toString(36).slice(2);revision++;activeTool=document.body.dataset.editorTool||'film';stageBase=capture();history.reset(stageBase);appliedKey=stageBase.key;update();scheduleSave();queue();}
 function beforeReplace(){
  if(window.RayCompose?.busy)window.RayCompose.cancel();if(window.RayRemove?.busy)window.RayRemove.cancel();
  if(!source||!originalFile)return saving;
  record();clearTimeout(saveTimer);saveTimer=0;
  // Capture the old document before decoding the next file; saving never blocks the picker.
  const file=originalFile,state=serialize(),id=documentKey,steps=history.cursor,updated=Date.now(),canvas=document.createElement('canvas'),ratio=Math.min(1,560/Math.max(view.width,view.height));
  canvas.width=Math.max(1,Math.round(view.width*ratio));canvas.height=Math.max(1,Math.round(view.height*ratio));canvas.getContext('2d').drawImage(view,0,0,canvas.width,canvas.height);
  const poster=new Promise(resolve=>{try{canvas.toBlob(resolve,'image/jpeg',.8);}catch{resolve(null);}}).finally(()=>{canvas.width=canvas.height=0;});
  const created=createdAt;saving=saving.catch(()=>{}).then(async()=>{const payload={id,name:file.name||'Ảnh của bạn',sourceFile:file,poster:await poster,state,origin:'draft',mime:file.type||'image/jpeg',updated,created,steps};await(host?.saveDraft?host.saveDraft(payload):localSave(payload));rememberDraft(id);}).catch(e=>notify(e.message||'Chưa giữ được bản nháp của ảnh trước.',true));
  return saving;
 }
 function restoreDraft(data,id){
  if(!data||data.version!==1)throw new Error('Bản nháp này chưa được hỗ trợ.');clearTimeout(saveTimer);clearTimeout(timer);restoringFile=false;
  let snap=history.restore(data.history);if(data.current?.key&&data.current.key!==snap.key){history.push(data.current,'Nháp đang chỉnh');snap=data.current;}restore(snap);stageBase=data.stageBase||snap;appliedKey=data.appliedKey||snap.key;if(id)documentKey=id;
  window.RayBodyPose?.restore?.(data.bodyRecognition);activeTool=data.tool||'film';window.BuongToiApp.showTools(activeTool);window.RayControls?.restoreSelection(data.section);window.RayMyPresets?.restoreEditingState?.(data.colorEditing);showResult(!!data.resultPreview);update();scheduleSave();return window.RayVideoEditor?.restore?.(data.media);
 }
 function changedLabel(target){return target?.getAttribute?.('aria-label')||target?.closest?.('.roll')?.title||names[activeTool]||'Điều chỉnh';}
 async function offerRecovery(){
  let id;try{id=localStorage.getItem(resumeKey)||sessionStorage.getItem(resumeKey);}catch{}if(!id||source)return;
  let db;
  try{
   const row=album?await album.get('drafts',id):null;
   if(source||!row?.sourceFile||!row.state)return;
   recovery=document.createElement('div');recovery.className='session-recovery';const text=document.createElement('p');text.textContent='Ảnh đang chỉnh đã được giữ lại trên máy.';
   const resume=button('Khôi phục ảnh đang chỉnh','Tiếp tục chỉnh ảnh',async()=>{
    if(source)return;resume.disabled=true;
    try{await window.BuongToiApp.loadFile(row.sourceFile,{draftId:row.id,draftCreated:row.created,restoring:true});if(!source)throw new Error('Chưa mở được ảnh.');await restoreDraft(row.state,row.id);notify('Đã khôi phục ảnh và các bước chỉnh.');}
    catch(e){resume.disabled=false;notify(e.message||'Chưa khôi phục được ảnh.',true);}
   });resume.className='btn btn-amber';recovery.append(text,resume);document.getElementById('drop').append(recovery);
  }catch{}finally{db?.close();}
 }
 document.addEventListener('input',e=>{if(e.target.matches('input[type=range],input[type=color],#dateTxt'))schedule(changedLabel(e.target));});
 document.addEventListener('change',e=>{if(e.target.matches('input[type=range],input[type=color],#dateTxt'))record(changedLabel(e.target));});
 document.addEventListener('click',e=>{if(e.target.closest('.session-toolbar,.session-apply-bar,.editor-tabs,.beauty-categories,.beauty-person,.editor-control-head'))return;if(e.target.closest('.roll,.seg button,.beauty-swatch,.brow-style,.bbtn,.stamp-btn,#dice'))setTimeout(()=>record(changedLabel(e.target)),0);});
 document.addEventListener('pointerup',e=>{if(e.target.closest('#focusOval,#bodyOval,#leakHandle,#nangHandle'))setTimeout(()=>record('Vị trí vùng chỉnh'),0);});
 for(const id of ['beautyScan','bodyAiScan']){const b=document.getElementById(id),handler=b.onclick;b.onclick=async function(e){if((window.RayCompose?.busy||window.RayRemove?.busy))return;const result=handler.call(this,e);update();await result;record('Nhận diện khuôn mặt / cơ thể');update();};}
 window.addEventListener('keydown',e=>{if(document.getElementById('rayIntro')?.open||!(e.ctrlKey||e.metaKey)||/INPUT|TEXTAREA/.test(e.target.tagName)&&e.target.type!=='range')return;const k=e.key.toLowerCase();if(k==='z'||k==='y'){e.preventDefault();e.stopImmediatePropagation();k==='y'||e.shiftKey?stepRedo():stepUndo();}},{capture:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&source)saveDraft(false);});window.addEventListener('pagehide',()=>{if(source)saveDraft(false);});
 window.RaySession={get documentKey(){return documentKey;},refresh:update,removeProgress(text){if(window.RayRemove?.busy){status.classList.remove('error');status.textContent=text;}},contextChanged(){revision++;scheduleSave();},snapshot:capture,keyOf,ensureSaved,forkDraft,restoreSnapshot:restore,record,reset,beforeReplace,restoreDraft:(state,id)=>restoreDraft(state,id),serialize,saveDraft,undo:stepUndo,redo:stepRedo,apply:applyStep,cancel:cancelStep,showResult,
  beforeToolChange(tool){if(tool===activeTool)return;if(source){record(names[activeTool]);stageBase=capture();appliedKey=stageBase.key;}activeTool=tool;update();}};
 update();offerRecovery();
})();
