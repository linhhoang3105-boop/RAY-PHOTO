/* RAY PHOTO app shell. Photo processing remains in the supplied editor. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),modulePromises=new Map(),viewIds={home:'homeView',darkroom:'darkroomView',booth:'boothView',album:'albumView'};
 let activeTool='film',albumFilter='all';
 let current='home',rolls=[],pendingPreset=null,returnSlot=null,toastTimer,selectedResult=null,resultURL=null,albumURLs=[];
 let savedFavorites=[];try{savedFavorites=JSON.parse(localStorage.getItem('bt-favorites')||'[]');}catch{}
 const favorites=new Set(Array.isArray(savedFavorites)?savedFavorites:[]);
 function toast(message,error=false){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;$('toast').classList.toggle('error',error);toastTimer=setTimeout(()=>$('toast').hidden=true,error?7000:3500);}
 function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS(svg.namespaceURI,'use');use.setAttribute('href','#s-'+name);svg.append(use);return svg;}
 function moduleReady(kind){
  if(modulePromises.has(kind))return modulePromises.get(kind);
  const frame=$(kind==='darkroom'?'darkroomFrame':'boothFrame'),key=kind==='darkroom'?'BuongToiApp':'PhoCangBridge';
  const promise=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{modulePromises.delete(kind);reject(new Error('Chưa mở được khu chỉnh ảnh. Kiểm tra mạng rồi thử lại.'));},25000);frame.addEventListener('load',()=>{try{const api=frame.contentWindow[key];if(!api)throw new Error('Chưa khởi tạo được công cụ.');clearTimeout(timeout);$(kind==='darkroom'?'darkroomLoading':'boothLoading').hidden=true;resolve(api);}catch(e){clearTimeout(timeout);modulePromises.delete(kind);reject(e);}},{once:true});frame.src=frame.dataset.src;});modulePromises.set(kind,promise);return promise;
 }
 async function showView(name,{history=true}={}){
  if(current==='darkroom'&&name!=='darkroom'&&$('darkroomFrame').contentWindow?.RayVideoEditor?.exporting){toast('Video đang được xuất. Chờ hoàn tất hoặc bấm Dừng xuất trong trình chỉnh video.');return;}
  if(!viewIds[name])name='home';if(current==='booth'&&name!=='booth')$('boothFrame').contentWindow?.PhoCangBridge?.deactivate();if(current==='darkroom'&&name!=='darkroom'){$('darkroomFrame').contentWindow?.RayVideoEditor?.pause();await $('darkroomFrame').contentWindow?.BuongToiApp?.flushDraft?.();}
  current=name;document.body.dataset.view=name;for(const [key,id]of Object.entries(viewIds))$(id).hidden=key!==name;
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===name);if(b.dataset.view===name)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  if(history&&location.hash!=='#'+name)window.history.replaceState(null,'','#'+name);window.scrollTo({top:0});
  try{if(name==='darkroom'||name==='booth')await moduleReady(name);if(name==='album')await renderAlbum();}catch(e){toast(e.message,true);}
  window.BuongToiNative?.tap?.();
 }
 async function loadFile(file,slot=null,{rememberSource=true,resetColor=false}={}){
  if(!file)return;returnSlot=slot;await showView('darkroom');try{const api=await moduleReady('darkroom');await api.loadFile(file,{resetColor});if(rememberSource&&slot===null)await remember({blob:file,name:file.name},'upload');if(pendingPreset){api.selectPreset(pendingPreset);pendingPreset=null;}$('toBooth').disabled=$('saveCreative').disabled=$('saveDarkroom').disabled=false;syncBoothAction(slot);api.showTools(activeTool);const video=$('darkroomFrame').contentWindow?.RayVideoEditor?.active;toast(video?'Video đã mở. Chọn màu phim, kéo thời gian hoặc chọn đoạn để xuất.':activeTool==='beauty'?'Ảnh đã mở. Chọn nhận diện để trang điểm, chỉnh da và màu tóc.':activeTool==='body'?'Ảnh đã mở. Chọn vùng muốn chỉnh dáng.':'Ảnh đã mở. Chọn màu phim bạn thích.');}catch(e){toast(e.message,true);}
 }
 const toolCopy={remove:['Xóa người, giữ khoảnh khắc.','Tô chọn vùng cần xóa, vá nền rồi ghép người mới vào ảnh.'],people:['Thêm một người vào kỷ niệm.','Ghép ảnh người, kéo vị trí, chỉnh kích thước và sửa mép nền.'],background:['Đổi phông, giữ khoảnh khắc.','Xóa nền ảnh người, sửa bằng bút rồi thay màu hoặc ảnh nền mới.'],text:['Viết lên bức ảnh.','Thêm chữ tiếng Việt, đổi kiểu và kéo đến vị trí bạn thích.'],film:['Chỉnh màu phim.','Chọn bộ lọc, chỉnh ánh sáng và thêm chất phim.'],adjust:['Điều chỉnh ảnh.','Ánh sáng, hạt phim, khung và dấu ngày.'],sun:['Nắng.','Đặt nguồn sáng, chỉnh góc, độ lan và vùng nhận nắng.'],beauty:['Trang điểm · Makeup.','Chỉnh da, son môi, má hồng, chân mày và màu tóc.'],body:['Chỉnh dáng theo vùng.','Chọn vùng cần chỉnh, điều chỉnh mức độ rồi xem kết quả.'],all:['Công cụ chỉnh ảnh.','Màu phim, trang điểm và chỉnh dáng trong cùng một nơi.']};
 function syncBoothAction(slot=null){const b=$('toBooth'),label=document.createElement('span');label.textContent=slot===null?'Photobooth':`Trả ô ${slot+1}`;b.replaceChildren(icon('camera'),label);b.title=slot===null?'Đưa vào photobooth':`Trả về ô ${slot+1}`;b.setAttribute('aria-label',b.title);}
 function syncToolTitle(tool){activeTool=toolCopy[tool]?tool:'film';$('editorTitle').textContent=toolCopy[activeTool][0];$('editorDescription').textContent=toolCopy[activeTool][1];}
 async function openTool(tool){try{if(tool!=='film')pendingPreset=null;syncToolTitle(tool);await showView('darkroom');(await moduleReady('darkroom')).showTools(tool);}catch(e){toast(e.message,true);}}
 function pick(){const input=$('studioFile');input.value='';input.click();}
 function renderFilmCards(){
  const ids=['trongveo','ngocdiep','trongxanh','tanhoc','portra400','gold200'],chosen=ids.map(id=>rolls.find(r=>r.id===id)).filter(Boolean);$('filmCards').replaceChildren();
  chosen.forEach((r,i)=>{const card=document.createElement('article');card.className='film-card';const pick=document.createElement('button');pick.className='film-pick';const art=document.createElement('div');art.className='film-art';art.style.setProperty('--swatch',r.dot);const no=document.createElement('small');no.textContent='BT / '+String(i+1).padStart(2,'0');const title=document.createElement('strong');title.textContent=r.name;const code=document.createElement('small');code.textContent=r.group==='Máy ảnh số'?'KỸ THUẬT SỐ · TRONG TRẺO':'MÀU PHIM · KỶ NIỆM';const bar=document.createElement('div');bar.className='film-barcode';art.append(no,title,code,bar);const name=document.createElement('h3');name.textContent=r.name;const desc=document.createElement('p');desc.textContent=r.description||r.group;pick.append(art,name,desc);pick.onclick=async()=>{pendingPreset=r.id;await showView('darkroom');const api=await moduleReady('darkroom');syncToolTitle('film');api.selectPreset(r.id);toast(api.hasImage()?'Đã chọn cuộn '+r.name:'Đã chọn cuộn '+r.name+'. Mở ảnh để bắt đầu.');};
   const favorite=document.createElement('button');favorite.className='favorite';favorite.classList.toggle('active',favorites.has(r.id));favorite.setAttribute('aria-label','Yêu thích '+r.name);favorite.setAttribute('aria-pressed',String(favorites.has(r.id)));favorite.append(icon('star'));favorite.onclick=()=>{favorites.has(r.id)?favorites.delete(r.id):favorites.add(r.id);favorite.classList.toggle('active',favorites.has(r.id));favorite.setAttribute('aria-pressed',String(favorites.has(r.id)));try{localStorage.setItem('bt-favorites',JSON.stringify([...favorites]));}catch{};};card.append(pick,favorite);$('filmCards').append(card);});
 }
 const album=RayAlbumStore.create(indexedDB);
 const transaction=(mode,action,storeName='exports')=>album.request(mode,action,storeName);
 let albumPage=1,albumRenderVersion=0;const albumMore=document.createElement('button');albumMore.type='button';albumMore.className='button outline';albumMore.textContent='Xem thêm ảnh và nháp';albumMore.hidden=true;albumMore.onclick=()=>{albumPage++;void renderAlbum();};$('albumGrid').after(albumMore);
 async function saveDraft(record){await transaction('readwrite',store=>store.put(record),'drafts');if(current==='album')await renderAlbum();}
 async function openDraft(record){try{pendingPreset=null;returnSlot=null;syncToolTitle(record.state.tool||'film');await showView('darkroom');const api=await moduleReady('darkroom');await api.loadFile(record.sourceFile,{draftId:record.id,draftCreated:record.created,restoring:true});await api.restoreDraft(record.state,record.id);$('toBooth').disabled=$('saveCreative').disabled=$('saveDarkroom').disabled=false;syncBoothAction();toast('Đã mở bản nháp cùng lịch sử chỉnh ảnh.');}catch(e){toast(e.message||'Chưa mở được bản nháp.',true);}}
 async function makePoster(blob){
  const video=blob.type.startsWith('video/'),url=URL.createObjectURL(blob);let media;
  try{
   media=video?document.createElement('video'):new Image();
   const ready=await new Promise(resolve=>{let done=false;const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value);};const timer=setTimeout(()=>finish(false),video?8000:6000);media.onerror=()=>finish(false);if(video){media.muted=true;media.playsInline=true;media.preload='auto';media.onloadeddata=()=>finish(true);}else media.onload=()=>finish(true);media.src=url;if(video)media.load();});
   if(!ready)return null;
   const w=video?media.videoWidth:media.naturalWidth,h=video?media.videoHeight:media.naturalHeight;if(!w||!h)return null;
   const c=document.createElement('canvas'),scale=Math.min(1,600/Math.max(w,h));c.width=Math.max(1,Math.round(w*scale));c.height=Math.max(1,Math.round(h*scale));c.getContext('2d').drawImage(media,0,0,c.width,c.height);const poster=await new Promise(resolve=>c.toBlob(resolve,'image/jpeg',.78));c.width=c.height=1;return poster;
  }catch{return null;}finally{if(video&&media){media.pause();media.removeAttribute('src');media.load();}URL.revokeObjectURL(url);}
 }
 const recorded=new WeakSet();
 async function remember(file,origin='darkroom',poster=null){
  if(!file?.blob||recorded.has(file.blob))return;recorded.add(file.blob);
  try{const rec={id:globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2),name:file.name||'ray-photo-'+Date.now()+'.jpg',blob:file.blob,mime:file.blob.type,created:Date.now(),updated:Date.now(),origin,draftId:file.draftId||null,width:file.width,height:file.height,...(file.editKey?{editKey:await RayAlbumStore.fingerprint(file.editKey)}:{}),poster:poster||await makePoster(file.blob)};const saved=await album.saveExport(rec);if(current==='album')await renderAlbum();return saved;}
  catch(e){recorded.delete(file.blob);toast(e.message||'Chưa lưu được vào kho ảnh. Hãy tải tệp về máy.',true);}
 }
 function originLabel(rec){return rec.origin==='draft'?((rec.advancedDraft||rec.premiumDraft)?'Nháp nâng cao · ':rec.variant==='basic'?'Nháp cơ bản · ':'Bản nháp · ')+(rec.steps||0)+' bước':rec.origin==='upload'?(rec.mime.startsWith('video/')?'Video tải lên':'Ảnh tải lên'):rec.origin==='photobooth'?'Photobooth':'Đã chỉnh';}
 async function renderAlbum(){
  const version=++albumRenderVersion;try{
   const lists=await Promise.all([album.list('exports'),album.list('drafts')]);if(version!==albumRenderVersion)return;const all=lists.flat().sort((a,b)=>(b.updated||b.created)-(a.updated||a.created)),query=$('albumSearch').value.trim().toLocaleLowerCase('vi');
   const items=all.filter(rec=>(albumFilter==='all'||albumFilter==='upload'&&rec.origin==='upload'||albumFilter==='edited'&&!['upload','draft'].includes(rec.origin)||albumFilter==='draft'&&rec.origin==='draft'||albumFilter==='video'&&rec.mime.startsWith('video/'))&&(!query||rec.name.toLocaleLowerCase('vi').includes(query)));
   albumURLs.forEach(URL.revokeObjectURL);albumURLs=[];$('albumCount').textContent=all.length+' tệp';$('albumEmpty').hidden=all.length>0;$('albumNoMatches').hidden=all.length===0||items.length>0;$('albumGrid').replaceChildren();
   for(const rec of items.slice(0,albumPage*24)){
    const card=document.createElement('article');card.className='album-card'+(rec.origin==='draft'?' draft-card':'');const open=document.createElement('button');open.className='album-open';const poster=rec.poster;let picture;
    if(poster){picture=document.createElement('img');picture.src=URL.createObjectURL(poster);albumURLs.push(picture.src);picture.alt=rec.name;picture.className='album-thumb';}else{picture=document.createElement('div');picture.className='album-thumb album-video-placeholder';picture.textContent=rec.mime.startsWith('video/')?'▶':'▧';}
    const title=document.createElement('h3');title.textContent=rec.name;const date=document.createElement('small');date.textContent=new Date(rec.updated||rec.created).toLocaleDateString('vi-VN')+' · '+(rec.origin==='draft'?'CHỈNH TIẾP ↗':rec.mime.startsWith('video/')?'VIDEO':'ẢNH');const badge=document.createElement('span');badge.className='album-origin';badge.textContent=originLabel(rec);open.append(picture,badge,title,date);open.onclick=async()=>{open.disabled=true;try{const full=await album.get(rec.origin==='draft'?'drafts':'exports',rec.id);if(!full)throw new Error('Tệp này không còn trong kho.');if(rec.origin==='draft')await openDraft(full);else openResult(full);}catch(error){toast(error.message,true);}finally{open.disabled=false;}};
    const del=document.createElement('button');del.className='delete-item';del.textContent='×';del.setAttribute('aria-label','Xóa '+rec.name+' khỏi kho ảnh');del.onclick=async()=>{if(confirm('Xóa tệp này khỏi kho ảnh trên thiết bị?')){await transaction('readwrite',store=>store.delete(rec.id),rec.origin==='draft'?'drafts':'exports');await renderAlbum();}};card.append(open,del);$('albumGrid').append(card);
   }albumMore.hidden=items.length<=albumPage*24;
  }catch(e){toast(e.message||'Chưa mở được kho ảnh.',true);}
 }
 function openResult(file){
  selectedResult=file;if(resultURL)URL.revokeObjectURL(resultURL);resultURL=URL.createObjectURL(file.blob);const video=file.blob.type.startsWith('video/'),media=document.createElement(video?'video':'img');media.src=resultURL;
  if(video){media.controls=true;media.playsInline=true;}else media.alt=file.origin==='upload'?'Ảnh của bạn':'Ảnh đã chỉnh';
  $('resultMedia').replaceChildren(media);$('resultTitle').textContent=file.origin==='upload'?(video?'Video của bạn':'Ảnh của bạn'):video?'Một đoạn kỷ niệm':'Một chút hôm nay';$('editResult').hidden=false;$('editResult').textContent=video?'Chỉnh video này ↗':'Chỉnh ảnh này ↗';$('resultStatus').textContent=(video?(/mp4/i.test(file.blob.type)?'MP4 · ':'WebM · '):'')+(file.width&&file.height?file.width+' × '+file.height+' px · ':'')+(file.fallback||file.limited?'Đã giảm kích thước để phù hợp bộ nhớ. ':'')+(file.basicCopy?'Bản cơ bản riêng · nháp nâng cao gốc vẫn được giữ. ':'')+'Mở lại để chỉnh tiếp, ghép photobooth hoặc lưu về máy.';$('resultDialog').showModal();
 }
 async function importToAlbum(files){
  const valid=[...files].filter(file=>file.type.startsWith('image/')||file.type.startsWith('video/'));if(!valid.length){toast('Hãy chọn ảnh hoặc video từ máy.',true);return;}
  const button=$('albumImport'),label=button.innerHTML;button.disabled=true;albumFilter='all';$('albumSearch').value='';document.querySelectorAll('[data-album-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.albumFilter==='all');b.setAttribute('aria-pressed',String(b.dataset.albumFilter==='all'));});let saved=0;
  try{for(const file of valid){button.textContent='Đang lưu '+(saved+1)+' / '+valid.length+'…';if(await remember({blob:file,name:file.name},'upload'))saved++;}await renderAlbum();toast('Đã thêm '+saved+' tệp vào kho ảnh của bạn.');}catch(e){toast(e.message||'Chưa thêm được ảnh.',true);}finally{button.innerHTML=label;button.disabled=false;}
 }
 function download(file){const a=document.createElement('a');a.href=URL.createObjectURL(file.blob);a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),30000);}
 async function saveFile(file){if(window.BuongToiNative?.isNative){await window.BuongToiNative.saveFile(file);toast('Đã lưu vào thư viện Ảnh của máy.');return;}const f=new File([file.blob],file.name,{type:file.blob.type});if(navigator.canShare?.({files:[f]}))await navigator.share({files:[f],title:'RAY PHOTO'});else download(file);}
 async function shareFile(file){const f=new File([file.blob],file.name,{type:file.blob.type});if(window.BuongToiNative?.isNative)return window.BuongToiNative.shareFiles([f]);if(navigator.canShare?.({files:[f]}))return navigator.share({files:[f],title:'RAY PHOTO'});download(file);}
 window.BuongToiHost={
  toast,loadFile,showView,openResult,saveFile,saveDraft,onToolChanged:syncToolTitle,
  onMediaChanged(kind){const video=kind==='video';$('saveDarkroom').querySelector('span').textContent=video?'Lưu video':'Lưu ảnh';const label=video?'Thay ảnh / video':'Thay ảnh';$('editorPick').querySelector('span').textContent=label;$('editorPick').setAttribute('aria-label',label);$('editorFile').setAttribute('aria-label',label);if(video)syncToolTitle('film');},
  onImageLoaded(){ $('toBooth').disabled=$('saveCreative').disabled=$('saveDarkroom').disabled=false;const control=$('editorPick');control.querySelector('span').textContent='Thay ảnh';control.title='Thay ảnh';control.setAttribute('aria-label','Thay ảnh');$('editorFile').setAttribute('aria-label','Thay ảnh'); },
  onExport(file){void remember(file,file.origin||'darkroom');},
  async onBoothOutputs(files){const posterFile=files.find(f=>f.blob.type.startsWith('image/')),poster=posterFile?await makePoster(posterFile.blob):null;for(const file of files)await remember(file,'photobooth',file.blob.type.startsWith('video/')?poster:null);},
  async openBoothPhoto(file,slot){await loadFile(file,slot);},
 };
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));document.querySelectorAll('[data-open-tool]').forEach(b=>b.onclick=()=>openTool(b.dataset.openTool));document.querySelectorAll('[data-open-booth]').forEach(b=>b.onclick=()=>showView('booth'));document.querySelectorAll('[data-return-home]').forEach(b=>b.onclick=()=>showView('home'));
 $('pickPhoto').onclick=$('startEditing').onclick=pick;
 const pickImage=input=>async()=>{const file=input.files[0];try{if(file)await loadFile(file);}finally{input.value='';}};
 $('studioFile').onchange=pickImage($('studioFile'));$('editorFile').onchange=pickImage($('editorFile'));
 $('openMyColors').onclick=async()=>{await openTool('film');(await moduleReady('darkroom')).showMyPresets();};
 $('saveCreative').onclick=async()=>{const b=$('saveCreative');b.disabled=true;try{const api=await moduleReady('darkroom');if(!api.saveCreative)throw new Error('Công cụ lưu công thức đang cập nhật. Tải lại trang rồi thử nhé.');await api.saveCreative();}catch(e){toast(e.message,true);}finally{b.disabled=false;}};
 $('allPresets').onclick=async()=>{await openTool('film');(await moduleReady('darkroom')).focusPresets();};$('boothHelp').onclick=()=>$('boothFrame').contentWindow?.document.getElementById('importPhotos')?.click();
 $('saveDarkroom').onclick=async()=>{const b=$('saveDarkroom');b.disabled=true;try{const file=await(await moduleReady('darkroom')).exportFile();await remember(file);openResult(file);if(window.BuongToiNative?.isNative)await saveFile(file);}catch(e){toast(e.message,true);}finally{b.disabled=false;}};
 $('toBooth').onclick=async()=>{const b=$('toBooth');b.disabled=true;try{const file=await(await moduleReady('darkroom')).exportFile();await remember(file);await showView('booth');const booth=await moduleReady('booth'),edited=new File([file.blob],file.name,{type:file.blob.type}),video=file.blob.type.startsWith('video/');if(video)await booth.importFiles([edited]);else await booth.importEditedPhoto(edited,returnSlot);returnSlot=null;syncBoothAction();toast((video?'Video':'Ảnh')+' từ RAY PHOTO đã vào khung photobooth.');}catch(e){toast(e.message,true);}finally{b.disabled=false;}};
 $('albumImport').onclick=$('albumImportEmpty').onclick=()=>{const input=$('albumFile');input.value='';input.click();};
 $('albumFile').onchange=()=>importToAlbum($('albumFile').files);
 document.querySelectorAll('[data-album-filter]').forEach(button=>button.onclick=()=>{albumFilter=button.dataset.albumFilter;albumPage=1;document.querySelectorAll('[data-album-filter]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});void renderAlbum();});
 $('albumSearch').oninput=()=>{albumPage=1;void renderAlbum();};
 $('editResult').onclick=async()=>{const rec=selectedResult;if(!rec)return;$('resultMedia').querySelector('video')?.pause();$('resultDialog').close();if(rec.draftId){const draft=await transaction('readonly',store=>store.get(rec.draftId),'drafts');if(draft){await openDraft(draft);return;}}await loadFile(new File([rec.blob],rec.name,{type:rec.blob.type}),null,{rememberSource:false,resetColor:true});};
 $('boothResult').onclick=async()=>{const rec=selectedResult;if(!rec)return;const button=$('boothResult');button.disabled=true;try{$('resultMedia').querySelector('video')?.pause();$('resultDialog').close();await showView('booth');await(await moduleReady('booth')).importFiles([new File([rec.blob],rec.name,{type:rec.blob.type})]);toast('Đã đưa tệp từ kho ảnh vào photobooth.');}catch(e){toast(e.message||'Chưa đưa được tệp vào khung.',true);}finally{button.disabled=false;}};
 $('aboutButton').onclick=()=>$('aboutDialog').showModal();document.querySelectorAll('[data-close-dialog]').forEach(b=>b.onclick=()=>{const d=$(b.dataset.closeDialog);d.querySelector('video')?.pause();d.close();});$('resultDialog').addEventListener('close',()=>$('resultMedia').querySelector('video')?.pause());
 $('saveResult').onclick=async()=>{try{if(selectedResult)await saveFile(selectedResult);}catch(e){if(e.name!=='AbortError')toast(e.message||'Chưa lưu được. Thử Chia sẻ hoặc tải lại.',true);}};$('shareResult').onclick=async()=>{try{if(selectedResult)await shareFile(selectedResult);}catch(e){if(e.name!=='AbortError')toast(e.message,true);}};
 let installPrompt;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('installButton').hidden=false;});$('installButton').onclick=async()=>{await installPrompt?.prompt();installPrompt=null;$('installButton').hidden=true;};
 fetch('presets.json').then(r=>r.json()).then(data=>{rolls=data;$('presetCount').textContent=data.filter(r=>r.id!=='goc').length+' bộ lọc màu';renderFilmCards();}).catch(()=>toast('Chưa mở được danh sách cuộn phim.',true));
 document.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('Files'))e.preventDefault();});
 document.addEventListener('drop',async e=>{const files=[...(e.dataTransfer?.files||[])].filter(f=>/^(image|video)\//.test(f.type)||/\.(mp4|mov|m4v|webm)$/i.test(f.name));if(!files.length)return;e.preventDefault();if(current==='booth'){await(await moduleReady('booth')).importFiles(files);}else await loadFile(files[0]);});
 if('serviceWorker'in navigator&&!window.BuongToiNative?.isNative)navigator.serviceWorker.register('sw.js').catch(()=>{});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)$('boothFrame').contentWindow?.PhoCangBridge?.deactivate();});window.addEventListener('hashchange',()=>showView(location.hash.slice(1),{history:false}));showView(location.hash.slice(1)||'home',{history:false});
})();
