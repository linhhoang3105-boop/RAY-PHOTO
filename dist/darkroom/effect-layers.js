/* Keep applied photo effects as recipes on the original photo, without a JPEG round trip. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.RayLayers=api;api.init();}})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const keys=['rayThuNhat','rayNangPho','temp','tint','split','contrast','sat','lift','halation','grain','vignette','leak','dust','ca','flash','glow','nang','filmExp','sharp','kinh','bgBlur','motion','spark','paper','gloss','soft','ptex','film','printClear','dehaze','detail','toneExposure','toneBrightness','toneHighlights','toneShadows','toneWhites','toneBlacks','toneLocalEV','toneLocalBrightness','toneLocalWarmth','toneLocalColorAmount'];
 const valueLimits=Object.fromEntries(keys.map(k=>[k,[-1,1]]));
 for(const k of keys)if(!['temp','tint','split','contrast','sat','toneBrightness','toneHighlights','toneShadows','toneWhites','toneBlacks','toneLocalBrightness','toneLocalWarmth'].includes(k))valueLimits[k]=[0,1];
 Object.assign(valueLimits,{rayThuNhat:[0,1.5],rayNangPho:[0,1.5],toneExposure:[-2,2],toneLocalEV:[-2,2],haltint:[0,1],leakAngle:[-180,180],leakBandWidth:[.04,1],leakHue:[-45,75],leakSat:[0,2],nangSat:[0,2],nangSize:[.15,1.4],nangAspect:[.25,4],nangAngle:[-180,180],leakAspect:[.25,4],motionAngle:[-180,180],toneLocalOpacity:[0,1],toneLocalFeather:[0,1],toneLocalThickness:[.002,.3],toneLocalCurve:[-1,1],toneLocalAngle:[-180,180],brushEV:[-2,2],brushSize:[.015,.5],brushSoftness:[0,1]});
 function withValues(all,id,values){
  if(!values||typeof values!=='object'||Array.isArray(values))throw Error('Thông số lớp không hợp lệ.');
  for(const [key,v]of Object.entries(values)){const range=valueLimits[key];if(!range||typeof v!=='number'||!Number.isFinite(v)||v<range[0]||v>range[1])throw Error('Thông số lớp nằm ngoài phạm vi hỗ trợ.');}
  const i=all.findIndex(s=>s.id===id);if(i<0||!Object.keys(values).some(k=>values[k]!==all[i].p[k]))return all;
  return all.map((s,k)=>k===i?{...s,p:{...s.p,...values}}:s);
 }
 function cleared(p){const result={...p};if(Object.hasOwn(result,'rayFilterStrength'))result.rayFilterStrength=null;for(const key of keys)result[key]=0;result.brushStrokes=[];result.toneLocalEnabled=true;result.toneLocalOpacity=1;result.rayBasePreset='goc';result.adjustRegion='all';result.adjustRegionShow=false;result.adjustRegionStack=[];result.adjustRegionTargets=[];result.adjustRegionDrawing=false;return result;}
 // The selected saved recipe remains the current step until Apply. Its own masks stay
 // intact; the editable parent coverage intersects them without changing color values.
 function scopeTargets(layers,ids,scope){
  const targets=new Set(ids||[]);if(!targets.size)return layers;let changed=false;
  const out=layers.map(layer=>{if(!targets.has(layer.id))return layer;const stack=layer.p.adjustRegionStack||[],last=stack.at(-1);if(last&&JSON.stringify(last)===JSON.stringify(scope))return layer;changed=true;return{...layer,p:{...layer.p,adjustRegionStack:[...stack.slice(0,-1),{...scope}]}};});
  return changed?out:layers;
 }
 const active=p=>keys.some(key=>!((p.toneLocalEnabled===false||Number(p.toneLocalOpacity??1)<=.00001)&&key.startsWith('toneLocal'))&&Math.abs(Number(p[key])||0)>.001)||Math.abs(Number(p.brushEV)||0)>.001&&Array.isArray(p.brushStrokes)&&p.brushStrokes.some(s=>s&&s.mode!=='erase'&&s.points?.length);
 function renderApplied(src,layers,pass,makeCanvas){
  let current=src,owned=null;
  try{let active=0;for(let i=0;i<layers.length;i++){if(layers[i].enabled===false)continue;const next=makeCanvas();try{pass(next,current,layers[i],active++===0,false);}catch(e){next.width=next.height=0;throw e;}if(owned)owned.width=owned.height=0;current=owned=next;}return owned;}
  catch(e){if(owned)owned.width=owned.height=0;throw e;}
 }
 // Small preview inputs share their already-rendered layers. Export never uses this cache.
 function previewCache(maxPixels=3e6){
  const entries=[];const remove=i=>{const [entry]=entries.splice(i,1);entry.canvas.width=entry.canvas.height=0;};
  return{
   get(src,key,dependencies=[]){const i=entries.findIndex(e=>e.src===src&&e.width===src.width&&e.height===src.height&&e.key===key&&e.dependencies.length===dependencies.length&&dependencies.every((v,j)=>v===e.dependencies[j]));if(i<0)return null;const [entry]=entries.splice(i,1);entries.push(entry);return entry.canvas;},
   put(src,key,canvas,dependencies=[]){if(canvas.width*canvas.height>maxPixels)return false;for(let i=entries.length-1;i>=0;i--)if(entries[i].src===src)remove(i);while(entries.length>=3||entries.reduce((n,e)=>n+e.canvas.width*e.canvas.height,0)+canvas.width*canvas.height>maxPixels)remove(0);entries.push({src,width:src.width,height:src.height,key,canvas,dependencies:dependencies.slice()});return true;},
   clear(){while(entries.length)remove(0);}
  };
 }
 const api={keys,valueLimits,withValues,cleared,active,scopeTargets,renderApplied,previewCache};
 api.init=()=>{
  let layers=[],previewing=0;const cache=previewCache();
  const originalRender=render,makeCanvas=()=>document.createElement('canvas');
  const strip=document.createElement('div');strip.className='effect-layers';strip.setAttribute('aria-label','Các lớp hiệu ứng đã giữ');strip.hidden=true;document.querySelector('.editor-tabs').before(strip);
  const capture=()=>({p:{...P},focus:{...F},sun:{...NK},leak:{...LK}});
  function setState(state){Object.assign(P,{rayNangPho:0,dehaze:0,detail:0},window.RayTone?.defaults,window.RayAdjustScope?.defaults,state.p);Object.assign(F,state.focus);Object.assign(NK,state.sun);Object.assign(LK,state.leak);}
  function pass(target,src,state,retouch,decorate){
   const saved=capture(),beautyPeek=BEAUTY.peek,bodyPeek=BODY.peek;
   try{setState(state);if(!decorate){P.frame='none';P.stamp=false;}if(!retouch)BEAUTY.peek=BODY.peek=true;return originalRender(target,src);}
   finally{setState(saved);BEAUTY.peek=beautyPeek;BODY.peek=bodyPeek;}
  }
  function discardCache(){cache.clear();window.RayAdjustScope?.invalidate();}
  api.invalidate=discardCache;
  api.updateScope=()=>{const next=scopeTargets(layers,P.adjustRegionTargets,window.RayAdjustScope.settings(P));if(next===layers)return false;layers=next;discardCache();return true;};
  api.releaseScope=()=>{const pending=(P.adjustRegionTargets||[]).some(id=>layers.some(s=>s.id===id));P.adjustRegionTargets=[];return pending;};
  api.preview=paint=>{previewing++;try{return paint();}finally{previewing--;}};
  function sync(){strip.replaceChildren();strip.hidden=!layers.length;for(let i=0;i<layers.length;i++){const layer=layers[i],raw=window.RayRuntime?.displayName(layer.title)||layer.title||'Điều chỉnh',title=raw==='Tất cả'?'Điều chỉnh':raw,chip=document.createElement('div');chip.className='effect-layer-chip';chip.classList.toggle('muted',layer.enabled===false);const inspect=document.createElement('button');inspect.type='button';inspect.className='effect-layer-inspect';const name=document.createElement('strong'),summary=document.createElement('small');name.textContent=(i+1)+' · '+title;summary.textContent=window.RayLayerInspector?.summary?.(layer)||'Xem thông số';inspect.append(name,summary);inspect.setAttribute('aria-label','Xem thông số lớp '+(i+1)+' · '+title);inspect.title='Xem và sửa các thông số đã lưu trong lớp';inspect.onclick=()=>api.inspect(layer.id);const toggle=document.createElement('button');toggle.type='button';toggle.className='effect-layer-toggle';toggle.textContent=layer.enabled===false?'○':'◉';toggle.setAttribute('aria-label',(layer.enabled===false?'Hiện lớp ':'Ẩn lớp ')+title);toggle.setAttribute('aria-pressed',String(layer.enabled!==false));toggle.onclick=()=>api.toggle(layer.id);const remove=document.createElement('button');remove.type='button';remove.className='effect-layer-remove';remove.textContent='×';remove.setAttribute('aria-label','Xóa lớp '+title);remove.onclick=()=>api.remove(layer.id);chip.append(inspect,toggle,remove);strip.append(chip);}strip.title='Bấm tên để xem và sửa thông số, ◉ để ẩn/hiện, × để bỏ lớp. Hoàn tác để khôi phục.';}
  function edit(id,action,label){if(!source||BEAUTY.busy||BODY_AI.busy||window.RayCompose?.busy||window.RayRemove?.busy)return false;const index=layers.findIndex(s=>s.id===id);if(index<0)return false;window.RaySession?.record();layers=action(layers,index);discardCache();sync();window.RaySession?.showResult(false);queue();window.RaySession?.record(label);return true;}
  api.toggle=id=>edit(id,(all,i)=>all.map((s,k)=>k===i?{...s,enabled:s.enabled===false}:s),'Ẩn / hiện một lớp màu');
  api.inspect=id=>{if(window.RayLayerInspector)return window.RayLayerInspector.open(id);const message='Bảng thông số chưa tải được. Lưu nháp rồi tải lại trang để mở.',host=window.parent!==window?window.parent.BuongToiHost:null;if(host?.toast)host.toast(message,true);else{const notice=document.createElement('div');notice.className='my-creative-notice error';notice.setAttribute('role','status');notice.textContent=message;document.body.append(notice);setTimeout(()=>notice.remove(),7000);}};
  api.remove=id=>edit(id,(all,i)=>all.filter((_,k)=>k!==i),'Bỏ một lớp màu');
  api.setValues=(id,values)=>{const next=withValues(layers,id,values);return next===layers?false:edit(id,()=>next,'Sửa thông số lớp màu');};
  function retouchKey(){return JSON.stringify({body:BODY.parts,bodyProfiles:window.RayBodyPeople?.capture(),bodyContour:window.RayBodyContour?.capture(),bodyLines:window.RayBodyLines?.capture(),bodyPeek:BODY.peek,beautyPeek:BEAUTY.peek,values:BEAUTY.values,people:BEAUTY.people.map(p=>({id:p.id,values:p.values})),ready:BEAUTY.ready,brows:window.RayBrows?.capture()});}
  render=function(target,src){
   if(!layers.some(s=>s.enabled!==false))return originalRender(target,src);
   const state=capture();let base,temporary=false;
   if(target===view||previewing){
    const key=JSON.stringify(layers)+retouchKey()+(window.RayPreviewTexture?.referenceKey||'');
    const dependencies=[BEAUTY.maps,BEAUTY.faces];base=cache.get(src,key,dependencies);
    if(!base){base=renderApplied(src,layers,pass,makeCanvas);temporary=!cache.put(src,key,base,dependencies);}
   }else{base=renderApplied(src,layers,pass,makeCanvas);temporary=true;}
   try{return pass(target,base,state,false,true);}finally{if(temporary)base.width=base.height=0;}
  };
  api.capture=()=>layers.slice();
  api.restore=value=>{layers=Array.isArray(value)?value.filter(x=>x&&x.p&&x.focus&&x.sun&&x.leak).map((x,i)=>({...x,id:x.id||'legacy-'+i,enabled:x.enabled!==false,p:{...x.p},focus:{...x.focus},sun:{...x.sun},leak:{...x.leak}})):[];discardCache();sync();};
  api.commit=title=>{
   const pending=api.releaseScope();
   if(!active(P)){if(!pending)return false;Object.assign(P,cleared(P));sync();syncControls();queue();return true;}
   const state=capture();state.id=globalThis.crypto?.randomUUID?.()||'layer-'+Date.now().toString(36)+Math.random().toString(36).slice(2);state.enabled=true;state.p.frame='none';state.p.stamp=false;state.title=title||'Hiệu ứng';layers=[...layers,state];Object.assign(P,cleared(P));
   document.querySelectorAll('.roll').forEach(b=>b.classList.toggle('on',b.dataset.preset==='goc'));document.getElementById('activePreset').textContent='Gốc · thêm lớp mới';discardCache();sync();syncControls();queue();return true;
  };
  Object.defineProperty(api,'count',{get:()=>layers.length});
  sync();
 };
 return api;
});
