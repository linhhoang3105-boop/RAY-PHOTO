/* UI adapter. The supplied color, beauty and body processing script is unchanged. */
(() => {
 'use strict';
 const host=window.parent!==window?window.parent.BuongToiHost:null;
 if(host)document.body.classList.add('embedded-editor');
 const assetRoot=new URL('../vendor/mediapipe/',location.href).href.replace(/\/$/,'');
 BODY_AI_ASSETS.roots.splice(0,BODY_AI_ASSETS.roots.length,assetRoot);BODY_AI_ASSETS.pose=assetRoot+'/pose_landmarker_lite.task';BODY_AI_ASSETS.face=assetRoot+'/face_landmarker.task';BEAUTY_ASSETS.roots=BODY_AI_ASSETS.roots;BEAUTY_ASSETS.pose=BODY_AI_ASSETS.pose;BEAUTY_ASSETS.face=BODY_AI_ASSETS.face;BEAUTY_ASSETS.segment=assetRoot+'/selfie_multiclass_256x256.tflite';BEAUTY_ASSETS.hair=assetRoot+'/hair_segmenter.tflite';

 const app=document.querySelector('.app'),panel=document.querySelector('.panel'),scroller=panel.querySelector('.scroll');
 app.classList.add('film-workspace');
 const groups=[...scroller.querySelectorAll(':scope>.grp')],rollsEl=document.getElementById('rolls');
 const presetGroup=rollsEl.closest('.grp'),rollButtons=[...rollsEl.querySelectorAll('.roll')];
 // Keep the original group labels above their original preset buttons.
 const filmGroups=[];let filmGroup=null;
 function addFilmGroup(name,heading){
  const section=document.createElement('div');section.className='roll-group';section.setAttribute('role','group');
  if(!heading){heading=document.createElement('div');heading.className='rollhead';heading.textContent=name;}
  heading.id='presetGroupLabel'+filmGroups.length;section.setAttribute('aria-labelledby',heading.id);
  const items=document.createElement('div');items.className='roll-group-items';section.append(heading,items);rollsEl.append(section);
  filmGroup={name,section,items,buttons:[]};filmGroups.push(filmGroup);
 }
 [...rollsEl.children].forEach(node=>{
  if(node.classList.contains('rollhead'))addFilmGroup(node.textContent.trim(),node);
  else if(node.classList.contains('roll')){if(!filmGroup)addFilmGroup('Gốc');node.dataset.presetGroup=filmGroup.name;filmGroup.items.append(node);filmGroup.buttons.push(node);}
 });
 let activeGroup='Tất cả';
 function filterPresets(){
  const q=search.value.trim().toLocaleLowerCase('vi');
  filmGroups.forEach(group=>{group.buttons.forEach(b=>{const recipe=ROLLS.find(r=>r.id===b.dataset.preset);b.hidden=!!q&&!((b.title||b.textContent)+' '+group.name+' '+(recipe?.g||'')).toLocaleLowerCase('vi').includes(q);});group.section.hidden=activeGroup!=='Tất cả'&&activeGroup!==group.name||group.buttons.every(b=>b.hidden);});const mine=rollsEl.querySelector('.my-colors-group');if(mine)mine.hidden=activeGroup!=='Tất cả'&&activeGroup!=='Màu của tôi';
 }
 const dock=document.createElement('section');dock.className='preset-dock';dock.setAttribute('aria-label','Bộ lọc phim');
 const dockHead=document.createElement('div');dockHead.className='preset-dock-head';
 const dockTitle=document.createElement('div');dockTitle.className='preset-dock-title';
 const dockLabel=document.createElement('span');dockLabel.textContent='Bộ lọc';
 const selectedLabel=document.createElement('span');selectedLabel.id='activePreset';selectedLabel.textContent='Gốc';selectedLabel.setAttribute('aria-live','polite');
 const count=document.createElement('span');count.className='preset-dock-count';count.textContent=ROLLS.filter(r=>r.id!=='goc').length+' bộ lọc + Gốc';
 dockTitle.append(dockLabel,selectedLabel);dockHead.append(dockTitle,count);
 const dockTools=document.createElement('div');dockTools.className='preset-dock-tools';
 const searchToggle=document.createElement('button');searchToggle.type='button';searchToggle.className='preset-search-toggle';searchToggle.setAttribute('aria-label','Tìm bộ lọc');searchToggle.setAttribute('aria-expanded','false');searchToggle.setAttribute('aria-controls','presetSearch');searchToggle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>';
 const dice=document.getElementById('dice');dice.setAttribute('aria-label','Đổi vị trí hạt và ánh sáng');
 dockTools.append(searchToggle,dice);window.RayRuntime?.attach(dockTools);dockHead.append(dockTools);
 const search=document.createElement('input');search.type='search';search.id='presetSearch';search.className='preset-search';search.placeholder='Tìm bộ lọc…';search.setAttribute('aria-label','Tìm bộ lọc');search.hidden=true;
 const paletteNav=document.createElement('nav');paletteNav.className='preset-groups';paletteNav.setAttribute('aria-label','Nhóm màu hội họa');
 for(const name of ['Tất cả','Màu của tôi',...filmGroups.map(g=>g.name)]){const b=document.createElement('button');b.type='button';b.textContent=name;b.setAttribute('aria-pressed',String(name===activeGroup));b.onclick=()=>{activeGroup=name;for(const other of paletteNav.children)other.setAttribute('aria-pressed',String(other===b));filterPresets();rollsEl.scrollLeft=0;};paletteNav.append(b);}
 dock.append(dockHead,search,paletteNav,rollsEl);app.insertBefore(dock,panel);presetGroup.remove();

 const sunGroup=document.getElementById('nangModeSeg').closest('.grp'),leakGroup=document.getElementById('leakModeSeg').closest('.grp');sunGroup.dataset.toolOnly=leakGroup.dataset.toolOnly='sun';
 const tabs=document.createElement('nav');tabs.className='editor-tabs';tabs.setAttribute('aria-label','Công cụ chỉnh ảnh');
 const icons={film:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v18M16 3v18M4 8h4m8 0h4M4 16h4m8 0h4"/>',adjust:'<path d="M5 3v18M12 3v18M19 3v18M2 8h6m1 9h6m1-10h6"/><circle cx="5" cy="8" r="2"/><circle cx="12" cy="17" r="2"/><circle cx="19" cy="7" r="2"/>',beauty:'<path d="M5 11h7v10H5zM6 11V5l5-3v9M3 21h11M18 3v6m-3-3h6"/>',body:'<circle cx="12" cy="4" r="2"/><path d="M8 8c1 3 0 5-1 7l2 7m7-14c-1 3 0 5 1 7l-2 7M8 8l-4 4m12-4 4 4M9 14h6"/>'};
 icons.background='<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m3 17 6-7 4 4 3-3 5 6"/><circle cx="16" cy="7" r="1"/>';icons.remove='<path d="m4 13 8-9 9 8-8 9H9zM7 17l8-9M13 21h9"/>';icons.people='<circle cx="9" cy="7" r="4"/><path d="M2 22v-3a7 7 0 0 1 14 0v3M20 8v8m-4-4h8"/>';icons.text='<path d="M4 5h16M12 5v16M8 21h8"/>';
 icons.sun='<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>';
 const toolLabels={film:'Bộ lọc',adjust:'Điều chỉnh',sun:'Nắng',beauty:'Makeup',body:'Chỉnh dáng',background:'Thay nền',remove:'Xóa người',people:'Ghép / sticker',text:'Chữ',all:'Tất cả công cụ'};
 const controlHead=document.createElement('div');controlHead.className='editor-control-head';controlHead.hidden=true;
 const controlTitle=document.createElement('span');
 const done=document.createElement('button');done.type='button';done.textContent='Xong ✓';done.setAttribute('aria-label','Xong, trở lại bộ lọc');done.onclick=()=>setTools('film');controlHead.append(controlTitle,done);
 let searchExpanded=false;
 function syncOverlays(){syncOval();syncLeakHandle();syncNangHandle();syncBody();}
 function setTools(tool){
  if(!toolLabels[tool])tool='film';
  window.RaySession?.showResult(false);
  window.RaySession?.beforeToolChange(tool);
  document.body.dataset.editorTool=tool;scroller.scrollTop=0;host?.onToolChanged?.(tool);
  tabs.querySelectorAll('button').forEach(b=>{const active=b.dataset.tool===tool;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  dock.hidden=tool!=='film';scroller.hidden=tool==='film';controlHead.hidden=tool==='film';controlTitle.textContent=toolLabels[tool];
  [...scroller.querySelectorAll(':scope>.grp')].forEach(g=>{if(g===presetGroup)return;g.hidden=g.dataset.toolOnly?g.dataset.toolOnly!==tool:tool==='all'?false:['sun','background','remove','people','text'].includes(tool)?true:tool==='beauty'?g.id!=='grpBeauty':tool==='body'?g.id!=='grpBody':['grpBeauty','grpBody'].includes(g.id);});
  search.hidden=tool!=='film'||!searchExpanded;
  if(tool==='beauty'&&!BEAUTY.open)document.getElementById('beautyHead').click();
   if(tool==='body'&&document.getElementById('bodyBox').hidden)document.getElementById('bodyHead').click();
  window.RayControls?.onToolChange(tool);
  requestAnimationFrame(syncOverlays);
 }
 for(const tool of ['film','adjust','sun','beauty','body','background','remove','people','text']){
  const b=document.createElement('button');b.type='button';b.dataset.tool=tool;
  b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[tool]+'</svg><span>'+toolLabels[tool]+'</span>';
  b.onclick=()=>{setTools(tool);if(tool==='sun')window.RayControls?.activateLight();};tabs.append(b);
 }
 panel.querySelector('.head').after(tabs,controlHead);
 searchToggle.onclick=()=>{searchExpanded=!searchExpanded;search.hidden=!searchExpanded;searchToggle.setAttribute('aria-expanded',String(searchExpanded));if(searchExpanded)search.focus();};
 search.oninput=filterPresets;
 search.addEventListener('keydown',e=>{if(e.key==='Escape'){searchExpanded=false;search.hidden=true;searchToggle.setAttribute('aria-expanded','false');searchToggle.focus();}});

 // Preserve the original preset buttons and handlers. Only visible thumbnails are rendered.
 const thumbDefaults={...P},thumbQueue=[];let thumbSource=null,thumbVersion=0,thumbScheduled=false;
 const visiblePresets=new Set();
 rollButtons.forEach((button,index)=>{
  const chooseColor=button.onclick;
  button.onclick=function(e){const choose=()=>{const chosenFrame=P.frame;P.film=0;P.printClear=0;P.rayThuNhat=0;try{return chooseColor.call(this,e);}finally{P.frame=chosenFrame;P.rayBasePreset=button.dataset.preset;syncControls();queue();}};return window.RayFilterStrength?window.RayFilterStrength.selectPreset(ROLLS[index],choose):choose();};
  const text=document.createElement('span');text.className='roll-name';text.textContent=ROLLS[index].name;
  const thumb=document.createElement('canvas');thumb.className='roll-thumb';thumb.width=84;thumb.height=64;thumb.setAttribute('aria-hidden','true');
  const ctx=thumb.getContext('2d');ctx.fillStyle=ROLLS[index].dot;ctx.fillRect(0,0,84,64);
  button.replaceChildren(thumb,text);button.dataset.preset=ROLLS[index].id;button.title=ROLLS[index].name;
  button.addEventListener('click',()=>{if(searchExpanded){searchExpanded=false;search.value='';search.hidden=true;searchToggle.setAttribute('aria-expanded','false');filterPresets();}syncActivePreset();button.scrollIntoView({block:'nearest',inline:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
 });
 function syncActivePreset(){
  const chosen=rollButtons.find(b=>b.classList.contains('on'));
  selectedLabel.textContent=chosen?.title||'Tùy chỉnh';
  rollButtons.forEach(b=>b.setAttribute('aria-pressed',String(b===chosen)));
 }
 new MutationObserver(syncActivePreset).observe(rollsEl,{subtree:true,attributes:true,attributeFilter:['class']});
 function queueThumb(button){
  if(!thumbSource||button.dataset.thumbVersion===String(thumbVersion)||thumbQueue.some(job=>job.button===button&&job.version===thumbVersion))return;
  thumbQueue.push({button,version:thumbVersion});scheduleThumb();
 }
 function scheduleThumb(){
  if(thumbScheduled||!thumbQueue.length)return;thumbScheduled=true;
  const schedule=window.requestIdleCallback?fn=>requestIdleCallback(fn,{timeout:400}):requestAnimationFrame;
  schedule(()=>{
   thumbScheduled=false;
   if(document.hidden||document.body.dataset.editorTool!=='film'||document.querySelector('.film-workspace.is-result-preview')){thumbQueue.length=0;return;}
   if(window.RayPreview?.isQuiet&&!RayPreview.isQuiet()){setTimeout(scheduleThumb,180);return;}
   const job=thumbQueue.shift();
   if(job?.version===thumbVersion&&thumbSource){
    const preset=ROLLS.find(r=>r.id===job.button.dataset.preset),saved={...P};
    try{Object.assign(P,thumbDefaults,preset.p,{frame:'none',stamp:false});RayPreview.thumbnail({source:thumbSource,target:job.button.querySelector('canvas'),render:RayPreview.paint,make:()=>document.createElement('canvas'),dpr:window.devicePixelRatio||1});job.button.dataset.thumbVersion=String(thumbVersion);}
    catch{ /* Keep the color swatch when a thumbnail cannot render. */ }
    finally{Object.assign(P,saved);}
   }
   scheduleThumb();
  });
 }
 if('IntersectionObserver'in window){
  const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){visiblePresets.add(entry.target);queueThumb(entry.target);}else visiblePresets.delete(entry.target);});},{root:rollsEl,rootMargin:'0px 100px',threshold:0});
  rollButtons.forEach(b=>observer.observe(b));
 }else rollButtons.forEach(b=>visiblePresets.add(b));
 function refreshThumbnails(){
  thumbVersion++;thumbQueue.length=0;if(!source)return;
  if(thumbSource)thumbSource.width=thumbSource.height=0;
  thumbSource=RayPreview.thumbnailSource(source,()=>document.createElement('canvas'),{light:document.body.dataset.lightPreview==='true'});
  visiblePresets.forEach(queueThumb);
 }
 const stampButton=document.getElementById('stampBtn');stampButton.classList.add('editor-date-toggle');
 const stampLabel=document.createElement('span');stampLabel.textContent='Hiện dấu ngày';stampButton.prepend(stampLabel);document.getElementById('dateTxt').closest('.grp').append(stampButton);
 new ResizeObserver(()=>requestAnimationFrame(syncOverlays)).observe(document.getElementById('canvasWrap'));
 setTools('film');syncActivePreset();

 document.querySelector('.drop p').textContent='Mở ảnh để chọn màu phim, trang điểm hoặc chỉnh dáng. Ảnh được xử lý trên thiết bị của bạn.';document.querySelector('.drop h1').textContent='Bức ảnh của bạn, chất riêng của bạn.';
 document.querySelector('#beautyHead>span').textContent='Trang điểm & làm đẹp';
 document.querySelector('input[data-k="filmExp"]')?.closest('.row')?.querySelector('.t span')?.replaceChildren(document.createTextNode('Phơi sáng phim'));
 document.querySelector('input[data-k="filmExp"]')?.setAttribute('aria-label','Phơi sáng phim');
 document.querySelector('.who span').textContent=ROLLS.filter(r=>r.id!=='goc').length+' bộ lọc + Gốc';
 document.getElementById('beautyStatus').textContent='Nhận diện da, tóc và khuôn mặt trên thiết bị. Mô hình được đóng gói cùng app; bản web tải khi dùng lần đầu.';
 document.querySelector('.who b').textContent='RAY PHOTO';
 const originalStamp=stamp;stamp=function(){return originalStamp().replace(/^buongtoi-/,'ray-photo-');};
 let sessionFile=null;
 function resetColor(){window.RayFilterStrength?.reset();window.RayLayers?.restore([]);Object.assign(P,thumbDefaults,{rayBasePreset:'goc'});document.querySelectorAll('.roll').forEach(b=>b.classList.toggle('on',b.dataset.preset==='goc'));syncControls();queue();}
 const originalLoad=load;load=async function(file,options={}){const old=source;if(file)window.RaySession?.beforeReplace();await originalLoad(file);if(source&&source!==old){if(options.resetColor){resetColor();draw();}sessionFile=file;window.RaySession?.reset(file,options);refreshThumbnails();old?.close?.();const pick=document.getElementById('pick2'),text=[...pick.childNodes].find(n=>n.nodeType===3);if(text)text.textContent='Thay ảnh';pick.querySelector('input')?.setAttribute('aria-label','Thay ảnh');host?.onImageLoaded(file);}};
 const originalMakeOutput=makeOutput;makeOutput=async function(cv){const out=await originalMakeOutput(cv);let blob=out.blob;if(!blob&&out.dataUrl)blob=await(await fetch(out.dataUrl)).blob();if(blob)host?.onExport({blob,name:stamp(),origin:'darkroom'});return out;};
 window.BuongToiApp={
  async loadFile(file,options){const old=source;await load(file,options);if(!source||source===old)throw new Error('Chưa đọc được ảnh mới. Thử ảnh JPG hoặc PNG.');return true;},
  hasImage:()=>!!source,
  sourceFile:()=>sessionFile,
  restoreDraft:(state,id)=>window.RaySession.restoreDraft(state,id),
  saveDraft:()=>window.RaySession.saveDraft(true),
  flushDraft:()=>window.RaySession.saveDraft(false),
  resetColor,refreshThumbnails,
  selectPreset(id){const index=ROLLS.findIndex(r=>r.id===id);setTools('film');if(index>=0)rollButtons[index].click();},
  showTools:setTools,
  focusPresets(){setTools('film');searchExpanded=true;search.hidden=false;searchToggle.setAttribute('aria-expanded','true');search.focus();},
  async exportFile(){return window.RayQualityExport.exportFile();},
  presetCount:ROLLS.length,
 };
})();
