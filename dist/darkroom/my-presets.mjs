import {describeRecipe} from './recipe-description.mjs';
import * as Rules from './preset-rules.mjs';
import {presetStore} from './my-presets-store.mjs';
import {saveCreativeSnapshot} from './creative-save.mjs';
import {recipeDetails} from './layer-inspector.mjs';
const $=id=>document.getElementById(id),store=presetStore(),uid=()=>globalThis.crypto?.randomUUID?.()||[...crypto.getRandomValues(new Uint8Array(16))].map(n=>n.toString(16).padStart(2,'0')).join(''),host=window.parent!==window?window.parent.BuongToiHost:null,portable=window.RAY_PORTABLE_MODE===true;
let csrf=null,editingId=null,pendingImport=null,lastCode='',previewBefore=null,working=false;
const text=(tag,value,className)=>{const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;return el;};
function button(value,action,className='my-action'){const b=text('button',value,className);b.type='button';b.onclick=action;return b;}
function message(value,error=false){$('myColorsStatus').textContent=value;$('myColorsStatus').classList.toggle('error',error);}
function session(){return window.RaySession;}
async function api(path,{method='GET',body}={}){
 if(portable)throw new Error('Mã chia sẻ dùng trên bản web. Bản HTML vẫn cho chỉnh ảnh, lưu màu và giữ nháp trên thiết bị.');
 if(method!=='GET'&&!csrf)await refreshSession();
 const res=await fetch('/api/ray/'+path,{method,credentials:'same-origin',cache:'no-store',headers:method==='GET'?{}:{'content-type':'application/json','x-ray-csrf':csrf||''},...(body?{body:JSON.stringify(body)}:{})});
 const data=await res.json();if(!res.ok)throw new Error(data.error||'Chưa kết nối được kho mã.');return data;
}
async function refreshSession(){try{const nonce=uid(),data=await api('session?nonce='+nonce);csrf=data.nonce===nonce?data.csrf:null;}catch{csrf=null;}}
// Export is local and always keeps the complete edit, including saved legacy drafts.
window.RayAccess={
 isAdvancedSnapshot:Rules.projectAdvanced,
 async prepareExport(){return{kind:'full',draftId:session().documentKey};}
};
const dialog=document.createElement('dialog');dialog.id='myColorsDialog';dialog.className='my-colors-dialog';dialog.setAttribute('aria-labelledby','myColorsTitle');
dialog.innerHTML='<div class="my-dialog-head"><div><p class="my-eyebrow">CÔNG THỨC CỦA RIÊNG BẠN</p><h2 id="myColorsTitle">Màu của tôi</h2></div><button type="button" class="my-close" id="closeMyColors" aria-label="Đóng Màu của tôi">×</button></div><p class="my-hint">Bấm Lưu công thức khi chỉnh ảnh thấy ưng. App giữ ngay ở đây; bạn đổi tên, sửa từng lớp và tạo mã sau.</p><button type="button" class="my-action my-gold my-quick-save" id="quickSaveMyColor">＋ Lưu công thức đang chỉnh</button><form id="saveMyColorForm" class="my-save-form" hidden><label for="myColorName">Tên màu</label><input id="myColorName" maxlength="96" placeholder="Ví dụ: Nắng của Linh" autocomplete="off"><div class="my-form-actions"><button type="submit" id="saveMyColor" class="my-action my-gold">＋ Lưu màu đang chỉnh</button><button type="button" id="newMyColor" class="my-action" hidden>Lưu thành màu mới</button></div><p id="myColorEditing" class="my-hint"></p></form><details class="my-import"><summary>Nhập mã màu</summary><form id="findMyColorForm"><label class="my-sr" for="myColorCode">Mã màu 8 chữ số</label><input id="myColorCode" inputmode="numeric" autocomplete="off" maxlength="20" placeholder="Nhập 8 chữ số của bạn bè"><button type="submit" class="my-action">Tìm công thức màu</button></form><section id="myImportedColor" hidden></section></details><p id="myColorsStatus" class="my-status" role="status"></p><section id="myColorsList" class="my-colors-list" aria-label="Các màu đã lưu"></section><div id="mySharedCode" class="my-share-code" hidden><span>Mã màu của bạn</span><strong id="mySharedCodeValue"></strong><button type="button" class="my-action" id="copyMyColorCode">Sao chép mã</button></div><p class="my-storage-note">Màu và nháp lưu trên thiết bị này, chưa tự đồng bộ sang máy khác. Xóa dữ liệu trang web hoặc dùng chế độ riêng tư có thể làm mất nháp. Chỉ công thức bạn chọn chia sẻ mới được gửi lên kho mã, gồm màu và hình vùng chọn. Không gửi ảnh, khuôn mặt hay dữ liệu nhận diện.</p><button type="button" class="my-action my-quiet" id="keepMyDrafts">Giữ nháp trên thiết bị</button>';
document.body.append(dialog);
if(portable){const note=text('p','Bản HTML: chỉnh ảnh, lưu màu và nháp trên thiết bị. Nhận diện AI cần mạng khi dùng lần đầu; nhập/chia sẻ mã dùng trên bản web.','my-storage-note');const url=window.RAY_PORTABLE_WEB_URL;if(url&&/^https:\/\//.test(url)){const link=text('a','Mở RAY PHOTO trên web','my-action');link.href=url;link.target='_blank';link.rel='noopener';note.append(document.createElement('br'),link);}dialog.querySelector('.my-hint').after(note);}
function cancelPreview(){if(previewBefore){session().restoreSnapshot(previewBefore);session().record('Trở lại trước khi thử màu');previewBefore=null;}if(window.RayMyTrialBar)window.RayMyTrialBar.hidden=true;}
$('closeMyColors').onclick=()=>dialog.close();dialog.addEventListener('cancel',e=>{e.preventDefault();dialog.close();});
function resetEditing(){const changed=editingId!==null;$('saveMyColorForm').hidden=true;editingId=null;$('myColorEditing').textContent='';$('saveMyColor').textContent='＋ Lưu màu đang chỉnh';$('newMyColor').hidden=true;if(changed)session()?.contextChanged?.();}
$('newMyColor').onclick=()=>{resetEditing();void saveCurrent();};
function applyRecipe(recipe,{trial=false,replace=false}={}){
 if(!source)throw new Error('Mở một ảnh trước để xem thử màu. Bạn vẫn có thể nhập và lưu công thức khi chưa mở ảnh.');const r=Rules.validate(recipe);const filterAmount=window.RayFilterStrength?.amount??100;
 if(trial)cancelPreview();else keepTrial();const region=RayAdjustScope.settings(P),placed=!!P.adjustRegionPlaced,drawing=!!P.adjustRegionDrawing;session().record('Trước khi thêm màu '+r.name);const before=session().snapshot();if(trial){previewBefore=before;trialName.textContent='Đang thử · '+r.name;trialBar.hidden=false;}
 if(replace){RayLayers.restore([]);Object.assign(P,RayLayers.cleared(P),{rgAtmos:'off'});}else if(RayLayers.active(P))RayLayers.commit('Lớp đang chỉnh');
 const existing=RayLayers.capture(),base=RayLayers.cleared(P);
 const additions=r.layers.map((values,i)=>{const meta=r.layerMeta?.[i];return{id:uid(),enabled:meta?.enabled!==false,p:{...base,...Rules.defaults,...values,adjustRegionStack:[...(values.adjustRegionStack||[]).map(s=>({...s})),{...region}],adjustRegionTargets:[],adjustRegionStrokes:(values.adjustRegionStrokes||[]).map(s=>({...s,points:s.points.map(p=>p.slice())})),rayBasePreset:meta?.basePreset||Rules.baseId(values),frame:'none',stamp:false,rgAtmos:'off',nangManual:false,leakManual:false,bgBlur:0,motion:0,brushStrokes:[],toneLocalEV:0,toneLocalBrightness:0,toneLocalWarmth:0},focus:{...F},sun:{x:.5,y:.04},leak:{x:.08,y:.08},title:meta?.title||r.name};});
 RayLayers.restore([...existing,...additions]);Object.assign(P,RayLayers.cleared(P),region,{adjustRegionPlaced:placed,adjustRegionDrawing:drawing&&region.adjustRegionShape==='freehand',adjustRegionShow:RayAdjustScope.regional(region),adjustRegionTargets:additions.map(s=>s.id)});if(r.tools?.brush)Object.assign(P,{brushEV:r.tools.brush.ev,brushSize:r.tools.brush.size,brushSoftness:r.tools.brush.softness});
 window.RayFilterStrength?.selectLayers(r.name,additions,filterAmount);
 document.querySelectorAll('.roll').forEach(b=>b.classList.remove('on'));syncControls();queue();session().record((trial?'Thử màu ':'Thêm màu ')+r.name);queueMicrotask(()=>$('activePreset').textContent=r.name);
}
const trialBar=document.createElement('div');trialBar.className='my-trial-bar';trialBar.hidden=true;const trialName=text('span','Đang thử màu');trialBar.append(trialName,button('Giữ màu',keepTrial),button('Trở lại',cancelPreview));$('stage').append(trialBar);window.RayMyTrialBar=trialBar;
function keepTrial(){previewBefore=null;trialBar.hidden=true;}
for(const key of ['beforeToolChange','beforeReplace','reset']){const original=session()[key];session()[key]=function(...args){keepTrial();if(key==='reset')resetEditing();return original.apply(this,args);};}
document.addEventListener('input',e=>{if(previewBefore&&!e.target.closest('#myColorsDialog'))keepTrial();},{capture:true});
document.addEventListener('click',e=>{if(e.target.closest('.roll'))RayLayers.releaseScope();},{capture:true});
document.addEventListener('click',e=>{if(previewBefore&&e.target.closest('.roll,.session-toolbar,.session-apply-bar,.editor-tabs'))keepTrial();},{capture:true});
async function putRecipe(recipe,{id=null,parentId=null,code=null}={}){const valid=Rules.validate(recipe),record={id:id||uid(),recipe:valid,name:valid.name,updated:Date.now(),created:Date.now(),draft:false,requiresPremium:false,parentId,code};await store.put(record);return record;}
const creativeNotice=document.createElement('div');creativeNotice.className='my-creative-notice';creativeNotice.hidden=true;creativeNotice.setAttribute('role','status');document.body.append(creativeNotice);let creativeTimer=0;
function notifyCreative(value,error=false){if(host?.toast){host.toast(value,error);return;}clearTimeout(creativeTimer);creativeNotice.textContent=value;creativeNotice.classList.toggle('error',error);creativeNotice.hidden=false;creativeTimer=setTimeout(()=>creativeNotice.hidden=true,error?7000:4500);}
function creativePreview(){const canvas=document.createElement('canvas'),scale=Math.min(1,240/Math.max(view.width,view.height));canvas.width=Math.max(1,Math.round(view.width*scale));canvas.height=Math.max(1,Math.round(view.height*scale));canvas.getContext('2d').drawImage(view,0,0,canvas.width,canvas.height);return new Promise(resolve=>canvas.toBlob(blob=>{canvas.width=canvas.height=0;resolve(blob);},'image/jpeg',.82));}
async function saveCreative(){
 if(working)return null;if(!source){notifyCreative('Mở ảnh và chỉnh màu trước khi lưu công thức.',true);return null;}working=true;
 try{const record=await saveCreativeSnapshot({store,session:session(),preview:creativePreview});await renderDock();if(dialog.open)dialog.close();nameCreative(record);return{id:record.id,name:record.name};}
 catch(e){notifyCreative(e.message||'Chưa lưu được công thức. Bản đang chỉnh vẫn được giữ.',true);return null;}finally{working=false;}
}
async function saveCurrent(){
 if(working)return;if(!source){message('Mở ảnh và chỉnh màu trước khi lưu công thức.',true);return;}working=true;
 try{
  await session().ensureSaved();const snapshot=session().snapshot(),recipe=Rules.capture(snapshot,Rules.nameOf($('myColorName').value)),originalId=editingId;
  await putRecipe(recipe,{id:originalId});message(originalId?'Đã cập nhật công thức đầy đủ. Mã đã chia sẻ trước đó giữ công thức cũ.':'Đã lưu công thức đầy đủ miễn phí. Nét bút và vùng chỉnh riêng được giữ trong nháp ảnh.');
  resetEditing();await renderList();
 }catch(e){message(e.message,true);}finally{working=false;}
}
$('quickSaveMyColor').onclick=async()=>{const b=$('quickSaveMyColor');b.disabled=true;try{await saveCreative();}finally{b.disabled=false;}};
$('saveMyColorForm').onsubmit=e=>{e.preventDefault();void saveCurrent();};
async function share(record){
 try{
  const recipe=record.code?record.recipe:Rules.validateShared(record.recipe);
  const response=record.code?{code:record.code}:await api('presets',{method:'POST',body:recipe});record={...record,code:response.code,updated:Date.now()};await store.put(record);lastCode=response.code;$('mySharedCodeValue').textContent=lastCode;$('mySharedCode').hidden=false;message('Mã màu '+lastCode+'. Bạn bè nhập mã này để xem thử và lưu màu.');await renderList();
 }catch(e){message(e.message,true);}
}
$('copyMyColorCode').onclick=async()=>{try{await navigator.clipboard.writeText(lastCode);message('Đã sao chép mã '+lastCode+'.');}catch{message('Mã màu: '+lastCode+'. Bạn có thể nhấn giữ để sao chép.');}};
async function renderList(){
 recipeURLs.splice(0).forEach(url=>URL.revokeObjectURL(url));
 await renderDock();
 const items=(await store.all()).filter(item=>!item.deletedAt).sort((a,b)=>b.updated-a.updated),list=$('myColorsList');list.replaceChildren();
 if(!items.length){list.append(text('p','Chỉnh ảnh thấy ưng, bấm Lưu công thức cạnh Lưu ảnh. App giữ ngay; bạn đặt tên và tạo mã sau ở đây.','my-hint'));return;}
 for(const item of items){const row=document.createElement('article');row.className='my-preset-card';const head=document.createElement('div');head.className='my-preset-title';head.append(text('h3',item.name),text('span','Miễn phí','my-tier'));
  if(item.thumbnail instanceof Blob){const picture=document.createElement('img');picture.className='my-recipe-preview';picture.alt='Ảnh xem trước '+item.name;picture.src=URL.createObjectURL(item.thumbnail);recipeURLs.push(picture.src);head.prepend(picture);}
  const info=text('p',item.recipe.layers.length+' lớp màu'+(item.recipe.tools?.brush?' · Có thông số bút; không có nét bút':'')+(item.code?' · Mã '+item.code:''),'my-hint'),actions=document.createElement('div');actions.className='my-row-actions';
  actions.append(button('Áp dụng',()=>{try{applyRecipe(item.recipe);dialog.close();host?.toast?.('Đã thêm màu '+item.name+'. Hoàn tác để trở lại.');}catch(e){message(e.message,true);}}),button('Sửa công thức',()=>editRecipe(item)),button('Đổi tên',()=>rename(item)),button('Chia sẻ mã',()=>share(item)));row.append(head,info,recipeDetails(item.recipe),actions);list.append(row);
  actions.append(button('Xóa',async()=>{try{await store.put({...item,deletedAt:Date.now()});await renderList();message('Đã bỏ '+item.name+' khỏi danh sách. Nháp ảnh vẫn được giữ.');$('myColorsStatus').append(button('Hoàn tác xóa',async()=>{try{await store.put(item);await renderList();message('Đã khôi phục '+item.name+'.');}catch(e){message(e.message,true);}},'my-action my-quiet'));}catch(e){message(e.message,true);}}));
 }
}
const recipeURLs=[];
dialog.addEventListener('close',()=>recipeURLs.splice(0).forEach(url=>URL.revokeObjectURL(url)));
async function editRecipe(item){
 if(working)return;working=true;
 try{if(!source)throw new Error('Mở ảnh để sửa công thức màu.');await session().ensureSaved();const state=session().serialize(),id=await session().forkDraft(state,'Sửa màu '+item.name,{variant:'preset-edit',advancedDraft:Rules.projectAdvanced(state.current)});session().restoreDraft(state,id);applyRecipe(item.recipe,{replace:true});restoreEditingState({id:item.id,name:item.name});session().contextChanged();await session().ensureSaved();dialog.close();host?.toast?.('Đã mở các lớp của '+item.name+' trong nháp riêng.');}catch(e){message(e.message,true);}finally{working=false;}
}
function rename(item){
 const row=document.createElement('form');row.className='my-rename';const input=document.createElement('input');input.value=item.name;input.maxLength=96;input.setAttribute('aria-label','Tên mới cho '+item.name);const save=text('button','Lưu tên','my-action');save.type='submit';row.append(input,save,button('Hủy',()=>row.remove()));$('myColorsList').prepend(row);input.focus();input.select();row.onsubmit=async e=>{e.preventDefault();try{const name=Rules.nameOf(input.value);await store.put({...item,name,recipe:{...item.recipe,name},code:null,updated:Date.now()});await renderList();message('Đã đổi tên. Công thức màu không thay đổi.');}catch(e){message(e.message,true);}};
}
$('findMyColorForm').onsubmit=async e=>{
 e.preventDefault();try{const code=Rules.cleanCode($('myColorCode').value),response=await api('presets/'+code);pendingImport={code,recipe:Rules.validate(response.recipe)};cancelPreview();
  const section=$('myImportedColor');section.replaceChildren(text('h3',pendingImport.recipe.name),text('p',pendingImport.recipe.layers.length+' lớp màu · '+'Miễn phí đầy đủ','my-hint'));
  section.append(button('Xem thử trên ảnh',()=>{try{applyRecipe(pendingImport.recipe,{trial:true});dialog.close();}catch(err){message(err.message,true);}}),button('Lưu vào Màu của tôi',async()=>{
   try{await putRecipe(pendingImport.recipe,{code:pendingImport.code});await renderList();message('Đã thêm màu vào bộ sưu tập trên thiết bị.');}catch(err){message(err.message,true);}
  }));section.hidden=false;message('Đã tìm thấy màu. Mã không chứa ảnh hoặc dữ liệu nhận diện.');await renderList();
 }catch(err){message(err.message,true);}
};
$('keepMyDrafts').onclick=async()=>{try{const retained=await navigator.storage?.persist?.();message(retained?'Trình duyệt đã cho lưu bền hơn trên thiết bị. Xóa dữ liệu trang web vẫn xóa nháp.':'Trình duyệt chưa cấp lưu bền. Nháp vẫn lưu trên thiết bị; tránh xóa dữ liệu trang web hoặc dùng chế độ riêng tư.');}catch{message('Nháp lưu trên thiết bị; trình duyệt có thể thu hồi dữ liệu khi thiếu dung lượng.');}};
async function open(){try{message('');await renderList();$('saveMyColor').disabled=!source;$('quickSaveMyColor').disabled=!source;dialog.showModal();void refreshSession();}catch(e){host?.toast?.(e.message,true);}}
function restoreEditingState(link){if(!link?.id||typeof link.id!=='string'){resetEditing();return;}editingId=link.id;$('saveMyColorForm').hidden=false;$('myColorName').value=String(link.name||'Màu đang sửa');$('myColorEditing').textContent='Đang sửa '+$('myColorName').value+'. Bấm tên lớp để xem/sửa thông số, ◉ để ẩn/hiện, × để bỏ lớp. Mở lại đây để Cập nhật công thức.';$('saveMyColor').textContent='Cập nhật công thức';$('newMyColor').hidden=false;}
$('myColorName').addEventListener('input',()=>{if(editingId)session().contextChanged();});
window.RayMyPresets={open,saveCreative,editingState:()=>editingId?{id:editingId,name:$('myColorName').value}:null,restoreEditingState};window.BuongToiApp.showMyPresets=open;window.BuongToiApp.saveCreative=saveCreative;
const group=document.createElement('section');group.className='roll-group my-colors-group';group.setAttribute('aria-label','Màu của tôi');const heading=text('div','Màu của tôi','rollhead'),items=document.createElement('div');items.className='roll-group-items';const entry=button('＋\nLưu / nhập',open,'my-colors-entry');entry.setAttribute('aria-label','Mở Màu của tôi để lưu và nhập mã màu');items.append(entry);group.append(heading,items);$('rolls').prepend(group);
for(const group of [$('grpBrush'),$('grpLocalTone'),$('bgBlur')?.closest('.grp'),document.querySelector('input[data-k="bgBlur"]')?.closest('.grp'),$('grpPrint')?.closest('.grp')].filter((g,i,list)=>g&&list.indexOf(g)===i)){const label=group.querySelector('.lbl');if(label)label.after(text('p','Miễn phí · Lưu ảnh giữ đầy đủ hiệu ứng đã chỉnh.','my-tool-note'));}
const storageNote=text('p','Nháp lưu đầy đủ trên thiết bị này. Xóa dữ liệu trình duyệt có thể làm mất nháp.','hint my-draft-note');$('dateTxt').closest('.grp').append(storageNote);

// Presentation adapters only; saved values and the color engine are unchanged.
const naming=document.createElement('dialog');naming.className='my-colors-dialog my-name-creative';naming.setAttribute('aria-label','Đặt tên công thức');document.body.append(naming);
function nameCreative(record){naming.replaceChildren();const form=document.createElement('form'),input=document.createElement('input'),status=text('p','','my-status');input.value=record.name;input.maxLength=48;input.setAttribute('aria-label','Tên công thức sáng tạo');const save=button('Lưu tên & hiện hiệu ứng',null,'my-action my-gold');save.type='submit';form.append(text('h2','Đã giữ công thức của bạn'),text('p','Đặt tên để nhận ra hiệu ứng của mình trên dải bộ lọc.','my-hint'),input,recipeDetails(record.recipe),status,save,button('Để sau',()=>finishCreative(record.id),'my-action my-quiet'));form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{const name=Rules.nameOf(input.value),current=await store.get(record.id);if(!current||current.deletedAt)throw new Error('Công thức này đã được xóa khỏi danh sách.');await store.put({...current,name,recipe:{...current.recipe,name},code:null,updated:Date.now()});await finishCreative(record.id);}catch(error){status.textContent=error.message;}finally{save.disabled=false;}};naming.append(form);naming.showModal();}
async function finishCreative(id){naming.close();await renderDock();window.BuongToiApp.showTools('film');const target=[...items.querySelectorAll('[data-recipe-id]')].find(b=>b.dataset.recipeId===id);target?.scrollIntoView({block:'nearest',inline:'center'});notifyCreative('Đã lưu hiệu ứng vào Màu của tôi trên dải bộ lọc.');}
const dockURLs=[];let dockRevision=0;
async function renderDock(){const revision=++dockRevision,records=(await store.all()).filter(r=>!r.deletedAt).sort((a,b)=>b.updated-a.updated);if(revision!==dockRevision)return;dockURLs.splice(0).forEach(url=>URL.revokeObjectURL(url));items.replaceChildren(entry);for(const record of records){const tile=button('',()=>{try{applyRecipe(record.recipe);window.BuongToiApp.showTools('film');tile.setAttribute('aria-pressed','true');notifyCreative('Đã thêm hiệu ứng '+record.name+'. Hoàn tác để trở lại.');}catch(error){notifyCreative(error.message,true);}},'my-colors-entry my-saved-effect');tile.dataset.recipeId=record.id;tile.setAttribute('aria-label','Áp dụng hiệu ứng '+record.name);tile.title=record.name+' · '+describeRecipe(record.recipe).map(x=>x.title).join(' + ');if(record.thumbnail instanceof Blob){const img=document.createElement('img');img.alt='';img.src=URL.createObjectURL(record.thumbnail);dockURLs.push(img.src);tile.append(img);}else tile.append(text('span','✦','my-effect-placeholder'));tile.append(text('span',record.name,'my-effect-name'));items.append(tile);}}
void renderDock().catch(()=>{});
