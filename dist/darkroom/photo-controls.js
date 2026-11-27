/* Expose every supplied adjustment and add scalable, instantly removable date stamps. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.RayControls=api;api.init();}})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 function stampPlacement(text,x,y,h,scale,measure){const s=Math.min(2.4,Math.max(.4,Number(scale)||1)),height=h*s;return{x:x+measure(text,h)-measure(text,height),y:y+h-height,h:height};}
 // Change direction by moving the existing light source, preserving the original radial renderer.
 function sunAngle(point,W,H){const dx=(point.x-.5)*W,dy=(point.y-.5)*H;return Math.hypot(dx,dy)<1e-8?0:Math.atan2(dx,-dy)*180/Math.PI;}
 function sunPositionAtAngle(point,degrees,W,H){
  const edge=angle=>Math.min(Math.abs(Math.sin(angle))>1e-10?W/2/Math.abs(Math.sin(angle)):Infinity,Math.abs(Math.cos(angle))>1e-10?H/2/Math.abs(Math.cos(angle)):Infinity);
  const distance=Math.hypot((point.x-.5)*W,(point.y-.5)*H),before=sunAngle(point,W,H)*Math.PI/180,after=degrees*Math.PI/180;
  const reach=distance<1e-8?.92:Math.min(1,distance/edge(before)),radius=reach*edge(after);
  return{x:Math.max(0,Math.min(1,.5+Math.sin(after)*radius/W)),y:Math.max(0,Math.min(1,.5-Math.cos(after)*radius/H))};
 }
 function bindDrag(element,handlers){
  let active=null;
  const stop=e=>{if(e.cancelable!==false)e.preventDefault();e.stopImmediatePropagation?.();};
  function begin(point,kind,pointerId,touchId){const context=handlers.start(point);if(!context)return false;active={context,x:point.clientX,y:point.clientY,kind,pointerId,touchId};return true;}
  function move(point){if(active)handlers.move(active.context,{dx:point.clientX-active.x,dy:point.clientY-active.y,clientX:point.clientX,clientY:point.clientY});}
  function finish(){if(!active)return;const context=active.context;active=null;handlers.end?.(context);}
  const pointer=(name,fn)=>element.addEventListener(name,fn,{capture:true,passive:false});
  pointer('pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;if(active){stop(e);return;}if(begin(e,e.pointerType||'mouse',e.pointerId,null)){stop(e);try{element.setPointerCapture(e.pointerId);}catch{}}});
  pointer('pointermove',e=>{if(!active||e.pointerId!==active.pointerId)return;stop(e);move(e);});
  pointer('pointerup',e=>{if(!active||e.pointerId!==active.pointerId)return;stop(e);finish();});
  for(const event of ['pointercancel','lostpointercapture'])pointer(event,e=>{if(!active||e.pointerId!==active.pointerId)return;stop(e);if(active.kind==='touch'&&active.touchId!==null)return;finish();});
  element.addEventListener('touchstart',e=>{const t=e.changedTouches[0];if(!t)return;if(active?.kind==='touch'){if(active.touchId===null)active.touchId=t.identifier;stop(e);}else if(!active&&begin(t,'touch',null,t.identifier))stop(e);},{passive:false,capture:true});
  element.addEventListener('touchmove',e=>{if(!active||active.kind!=='touch')return;const t=Array.from(e.touches).find(t=>t.identifier===active.touchId);if(!t)return;stop(e);move(t);},{passive:false,capture:true});
  for(const event of ['touchend','touchcancel'])element.addEventListener(event,e=>{if(!active||active.kind!=='touch'||!Array.from(e.changedTouches).some(t=>t.identifier===active.touchId))return;stop(e);finish();},{passive:false,capture:true});
 }
 // A single input stream owns a drag or a two-finger transform. In particular,
 // changing finger count must not turn the old drag into a tap on the subject.
 function bindTransform(element,handlers){
  const doc=element.ownerDocument,events=doc||element,env=doc?.defaultView||globalThis,points=new Map(),captures=new Set(),listeners=[];
  let active=null,kind=null,lastTouch=-Infinity;
  const listen=(target,name,fn)=>{const options={capture:true,passive:false};target.addEventListener(name,fn,options);listeners.push(()=>target.removeEventListener(name,fn,options));};
  // Document peers (including the sharp-preview idle tracker) must still see
  // every release. Only element starts suppress other handlers on that target.
  const stop=(e,documentEvent=false)=>{if(e.cancelable!==false)e.preventDefault();if(documentEvent&&events!==element)e.stopPropagation?.();else e.stopImmediatePropagation?.();};
  const point=(p,e)=>({clientX:p.clientX,clientY:p.clientY,target:p.target||e.target,pointerId:p.pointerId,identifier:p.identifier});
  const cancelContext=context=>{if(context&&typeof context==='object')try{context.moved=true;context.cancelled=true;}catch{}};
  function finish(cancelled=false){const previous=active;active=null;if(!previous)return;if(cancelled)cancelContext(previous.context);if(previous.type==='gesture')handlers.gesture?.end?.(previous.context);else handlers.end?.(previous.context);}
  function release(ids=[...captures]){const held=ids.filter(id=>captures.has(id));for(const id of held)captures.delete(id);for(const id of held)try{element.releasePointerCapture(id);}catch{}}
  function capture(id){try{element.setPointerCapture(id);captures.add(id);}catch{}}
  function pair(){return active?.ids.map(id=>({...points.get(id)}));}
  function add(id,p,inputKind,startPoint=p){
   if(points.has(id)||kind&&kind!==inputKind)return false;
   if(!points.size){const context=handlers.start(startPoint);if(!context)return false;kind=inputKind;points.set(id,p);active={type:'single',context,id,x:p.clientX,y:p.clientY};return true;}
   if(inputKind==='mouse')return false;points.set(id,p);
   if(points.size===2&&active?.type==='single'){
    finish(true);const ids=[...points.keys()],initial=ids.map(key=>({...points.get(key)})),context=handlers.gesture?.start?.(initial);
    if(context)active={type:'gesture',context,ids};
   }
   return true;
  }
  function move(){if(active?.type==='single'){const p=points.get(active.id);handlers.move?.(active.context,{dx:p.clientX-active.x,dy:p.clientY-active.y,clientX:p.clientX,clientY:p.clientY});}else if(active?.type==='gesture')handlers.gesture?.move?.(active.context,pair());}
  function end(ids,cancelled=false){
   const owned=ids.filter(id=>points.has(id));if(!owned.length)return false;
   if(cancelled){finish(true);release();}
   else if(active&&(active.type==='single'?owned.includes(active.id):active.ids.some(id=>owned.includes(id))))finish();
   for(const id of owned)points.delete(id);release(owned);if(!points.size)kind=null;return true;
  }
  if(typeof env.PointerEvent!=='undefined'){
   listen(element,'pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;const inputKind=e.pointerType||'mouse';if(add(e.pointerId,point(e,e),inputKind,e)){stop(e);capture(e.pointerId);}});
   listen(events,'pointermove',e=>{if(!points.has(e.pointerId))return;stop(e,true);points.set(e.pointerId,point(e,e));if(active?.type==='single'&&active.id===e.pointerId||active?.type==='gesture'&&active.ids.includes(e.pointerId))move();});
   listen(events,'pointerup',e=>{if(!points.has(e.pointerId))return;stop(e,true);end([e.pointerId]);});
   listen(events,'pointercancel',e=>{if(!points.has(e.pointerId))return;stop(e,true);end([e.pointerId],true);});
   listen(element,'lostpointercapture',e=>{if(!captures.has(e.pointerId)||!points.has(e.pointerId))return;stop(e);end([e.pointerId],true);});
  }else{
   const touches=e=>Array.from(e.changedTouches||[]),refresh=e=>{for(const t of Array.from(e.touches||[]))if(points.has(t.identifier))points.set(t.identifier,point(t,e));};
   listen(element,'touchstart',e=>{lastTouch=Date.now();refresh(e);let accepted=false;for(const t of touches(e))accepted=add(t.identifier,point(t,e),'touch')||accepted;if(accepted)stop(e);});
   listen(events,'touchmove',e=>{if(kind!=='touch'||!Array.from(e.touches||[]).some(t=>points.has(t.identifier)))return;stop(e,true);refresh(e);const changed=touches(e);if(!changed.length||changed.some(t=>active?.type==='single'?active.id===t.identifier:active?.ids.includes(t.identifier)))move();});
   listen(events,'touchend',e=>{lastTouch=Date.now();if(kind==='touch'&&end(touches(e).map(t=>t.identifier)))stop(e,true);});
   listen(events,'touchcancel',e=>{lastTouch=Date.now();const ids=touches(e).map(t=>t.identifier);if(kind==='touch'&&end(ids.length?ids:[...points.keys()],true))stop(e,true);});
   listen(element,'mousedown',e=>{if(e.button!==undefined&&e.button!==0||Date.now()-lastTouch<800)return;if(add('mouse',point(e,e),'mouse',e))stop(e);});
   listen(events,'mousemove',e=>{if(kind!=='mouse'||!points.has('mouse'))return;stop(e,true);points.set('mouse',point(e,e));move();});
   listen(events,'mouseup',e=>{if(e.button!==undefined&&e.button!==0)return;if(kind==='mouse'&&end(['mouse']))stop(e,true);});
  }
  return()=>{finish(true);release();points.clear();kind=null;for(const remove of listeners)remove();};
 }
 const api={stampPlacement,bindDrag,bindTransform,sunAngle,sunPositionAtAngle};
 api.init=()=>{
  P.stampScale=1;
  const originalStamp=drawStamp;drawStamp=function(c,text,x,y,h,glow){if(c.canvas.id!=='readout'){const p=stampPlacement(text,x,y,h,P.stampScale,stampWidth);return originalStamp(c,text,p.x,p.y,p.h,glow);}return originalStamp(c,text,x,y,h,glow);};
  const scroller=document.querySelector('.panel>.scroll'),tabs=document.querySelector('.editor-tabs'),groups=[...scroller.querySelectorAll(':scope>.grp')].filter(g=>!['grpBeauty','grpBody'].includes(g.id));
  const nav=document.createElement('nav');nav.className='adjust-categories';nav.setAttribute('aria-label','Các mục điều chỉnh');tabs.after(nav);
  const entries=[{key:'all',name:'Tất cả'}];groups.forEach((group,i)=>{const name=group.querySelector(':scope>.lbl')?.textContent.trim();if(!name)return;group.dataset.adjustSection='adjust-'+i;entries.push({key:group.dataset.adjustSection,name,group});});
  let selected=entries.find(e=>e.name==='Cơ bản')?.key||'all',selectedLight='Nắng',tool=document.body.dataset.editorTool,drawSun=()=>{};
  const lightNav=document.createElement('nav');lightNav.className='sun-categories';lightNav.setAttribute('aria-label','Kiểu ánh nắng');lightNav.hidden=true;nav.after(lightNav);
  function chooseLight(name,activate=false){selectedLight=name;if(activate)api.activateLight?.(name);for(const e of entries)if(e.group)e.group.hidden=e.name!==name;for(const b of lightNav.querySelectorAll('button')){const on=b.dataset.light===name;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));}scroller.scrollTop=0;drawSun();syncNangHandle();syncLeakHandle();syncOval();}
  for(const [name,label]of [['Nắng','Nắng tỏa'],['Vệt nắng','Vệt nắng · Tròn / Oval / Dải']]){const b=document.createElement('button');b.type='button';b.dataset.light=name;b.textContent=label;b.onclick=()=>chooseLight(name,true);lightNav.append(b);}
  function choose(key){selected=key;document.body.dataset.adjustSection=key;for(const e of entries)if(e.group)e.group.hidden=!!e.group.dataset.toolOnly||key!=='all'&&e.key!==key;nav.querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.section===key);b.setAttribute('aria-pressed',String(b.dataset.section===key));});scroller.scrollTop=0;drawSun();syncNangHandle();syncOval();}
  for(const e of entries){if(e.group?.dataset.toolOnly)continue;const b=document.createElement('button');b.type='button';b.dataset.section=e.key;b.textContent=e.name;b.onclick=()=>{choose(e.key);b.scrollIntoView({block:'nearest',inline:'center'});};nav.append(b);}
  api.onToolChange=value=>{tool=value;nav.hidden=value!=='adjust';lightNav.hidden=value!=='sun';if(value==='adjust')choose(selected);if(value==='sun')chooseLight(selectedLight);drawSun();syncNangHandle();syncOval();};
  api.captureSelection=()=>({adjustName:entries.find(e=>e.key===selected)?.name||'Cơ bản',lightName:selectedLight});
  const unified=name=>['Màu','Chất phim'].includes(name)?'Cơ bản':name;
  api.restoreSelection=value=>{if(!value)return;selected=entries.find(e=>e.name===unified(value.adjustName))?.key||selected;if(['Nắng','Vệt nắng'].includes(value.lightName))selectedLight=value.lightName;api.onToolChange(document.body.dataset.editorTool);};
  api.openSection=name=>{if(name==='Nắng'||name==='Vệt nắng'){window.BuongToiApp.showTools('sun');chooseLight(name);return;}window.BuongToiApp.showTools('adjust');const entry=entries.find(e=>e.name===unified(name));choose(entry?.key||'all');};
  function mirror(key,title,section){
   const original=document.querySelector('input[data-k="'+key+'"]'),entry=entries.find(e=>e.name===section);if(!original||!entry)return;
   const row=document.createElement('label');row.className='row effect-strength';row.innerHTML='<span class="t"><span>'+title+'</span><em></em></span><input type="range" min="0" max="1" step="0.01" aria-label="'+title+'">';const input=row.querySelector('input'),value=row.querySelector('em');input.dataset.effectMirror=key;
   input.oninput=()=>{original.value=input.value;original.dispatchEvent(new Event('input',{bubbles:true}));};input.onchange=()=>original.dispatchEvent(new Event('change',{bubbles:true}));entry.group.querySelector('.lbl').after(row);return()=>{input.value=P[key];value.textContent=Math.round(P[key]*100);};
  }
  const sunEntry=entries.find(e=>e.name==='Nắng'),sunStrength=document.querySelector('input[data-k="nang"]')?.closest('.row'),sunSaturation=document.querySelector('input[data-k="nangSat"]')?.closest('.row');
  sunStrength.classList.add('effect-strength');sunStrength.querySelector('.t span').textContent='Cường độ nắng';sunStrength.querySelector('input').setAttribute('aria-label','Cường độ nắng');sunEntry.group.querySelector('.lbl').after(sunStrength);sunEntry.group.querySelector('input[data-k="nangSize"]').closest('.row').after(sunSaturation);
  const leakEntry=entries.find(e=>e.name==='Vệt nắng'),leakStrength=document.querySelector('input[data-k="leak"]')?.closest('.row');leakStrength.classList.add('effect-strength');leakStrength.querySelector('.t span').textContent='Cường độ vệt nắng';leakStrength.querySelector('input').setAttribute('aria-label','Cường độ vệt nắng');leakEntry.group.querySelector('.lbl').after(leakStrength);
  api.activateLight=(name=selectedLight)=>{if(!source)return;const key=name==='Nắng'?'nang':'leak';if(P[key]<=.001){P[key]=.35;syncControls();queue();window.RaySession?.record('Bật '+name.toLocaleLowerCase('vi'));}};
  const guideButtons=[],lightToggles=[];
  function toggleLight(key){if(!source)return;window.RaySession?.record('Thông số ánh nắng');const on=P[key]>.001;P[key]=on?0:.35;if(on)P.lightGuide=false;syncControls();syncOval();syncNangHandle();syncLeakHandle();queue();window.RaySession?.record((on?'Tắt ':'Bật ')+(key==='leak'?'vệt nắng':'nắng'));}
  function lightActions(key,compact=false){
   const actions=document.createElement('div');actions.className='light-view-actions';
   const toggle=document.createElement('button');toggle.type='button';toggle.dataset.lightKey=key;toggle.setAttribute('aria-label','Bật hoặc tắt '+(key==='leak'?'vệt nắng':'nắng')+(compact?' cạnh hình dạng':''));toggle.onclick=()=>toggleLight(key);lightToggles.push(toggle);
   const guide=document.createElement('button');guide.type='button';guide.dataset.compact=compact?'1':'0';guide.setAttribute('aria-label',compact?'Hiện hoặc ẩn khung chỉnh cạnh hình dạng':'Hiện hoặc ẩn tay chỉnh ánh nắng');guide.onclick=()=>{P.lightGuide=!P.lightGuide;syncControls();syncOval();syncNangHandle();syncLeakHandle();};guideButtons.push(guide);actions.append(toggle,guide);return actions;
  }
  for(const [entry,key]of [[sunEntry,'nang'],[leakEntry,'leak']]){
   const actions=lightActions(key);entry.group.querySelector('.effect-strength').after(actions);
   const tip=document.createElement('p');tip.className='hint light-move-hint';tip.textContent='Chạm hoặc kéo trên ảnh để đặt nắng. Bật tay chỉnh khi cần đổi cỡ, độ dẹt hoặc xoay; ẩn lại để xem ảnh sạch.';actions.after(tip);
  }
  function lightSlider(entry,key,label,min,max,step){const row=document.createElement('label');row.className='row light-geometry-row';row.innerHTML='<span class="t"><span>'+label+'</span><em data-v="'+key+'"></em></span><input type="range" data-k="'+key+'" aria-label="'+label+'" min="'+min+'" max="'+max+'" step="'+step+'">';const input=row.querySelector('input');input.oninput=()=>{P[key]=Number(input.value);syncControls();syncNangHandle();syncLeakHandle();queue();};entry.group.append(row);return row;}
  const sunShape=document.createElement('div');sunShape.className='seg light-shapes';sunShape.setAttribute('aria-label','Hình nắng tỏa');
  for(const [label,aspect]of [['Tròn',1],['Oval',2.2]]){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.sunAspect=aspect;b.onclick=()=>{P.nangAspect=aspect;api.activateLight('Nắng');syncControls();syncNangHandle();queue();};sunShape.append(b);}sunEntry.group.querySelector('.light-move-hint').after(sunShape);
  lightSlider(sunEntry,'nangAspect','Dài / rộng nắng',.25,4,.01);lightSlider(sunEntry,'nangAngle','Góc oval nắng',-180,180,1);
  const ovalLeak=document.createElement('button');ovalLeak.type='button';ovalLeak.dataset.v='oval';ovalLeak.textContent='Oval';document.querySelector('#leakShapeSeg').append(ovalLeak);document.querySelector('#leakShapeSeg').style.gridTemplateColumns='repeat(3,1fr)';
  const shapeActions=lightActions('leak',true);shapeActions.classList.add('light-shape-actions');shapeActions.setAttribute('role','group');shapeActions.setAttribute('aria-label','Tắt vệt nắng và ẩn khung cạnh hình dạng');document.getElementById('leakShapeSeg').after(shapeActions);
  const leakAspectRow=lightSlider(leakEntry,'leakAspect','Dài / rộng vệt',.25,4,.01);
  document.querySelector('#leakShapeSeg').addEventListener('click',e=>{const shape=e.target.closest('button')?.dataset.v;if(!shape)return;if(shape==='oval'&&P.leakAspect===1)P.leakAspect=2.2;if(shape==='circle')P.leakAspect=1;api.activateLight('Vệt nắng');syncControls();syncLeakHandle();queue();});
  const mirrors=[];
  document.querySelector('#leakShapeSeg [data-v="patch"]').textContent='Dải nắng';
  function addCorners(entry,point,key){const block=document.createElement('div');block.className='light-corners';block.setAttribute('role','group');block.setAttribute('aria-label','Đặt '+key+' ở bốn góc');const title=document.createElement('p');title.className='effect-region-title';title.textContent='Cố định ở góc';block.append(title);for(const [name,x,y]of [['↖ Trên trái',0,0],['↗ Trên phải',1,0],['↙ Dưới trái',0,1],['↘ Dưới phải',1,1]]){const b=document.createElement('button');b.type='button';b.dataset.cornerX=x;b.dataset.cornerY=y;b.textContent=name;b.onclick=()=>{P[key==='nắng'?'nangManual':'leakManual']=true;point.x=x;point.y=y;syncControls();syncNangHandle();syncLeakHandle();queue();window.RaySession?.record('Đặt '+key+' '+name);};block.append(b);}entry.group.querySelector('#'+(key==='nắng'?'nangModeSeg':'leakModeSeg')).after(block);return{block,point,key};}
  const cornerControls=[addCorners(sunEntry,NK,'nắng'),addCorners(leakEntry,LK,'vệt nắng')];
  const randomLeak=document.createElement('button');randomLeak.type='button';randomLeak.className='btn light-random';randomLeak.textContent='↻ Đổi góc ngẫu nhiên';randomLeak.onclick=()=>{P.leakManual=false;document.getElementById('dice').click();syncControls();syncLeakHandle();window.RaySession?.record('Vệt nắng ngẫu nhiên');};leakEntry.group.querySelector('#leakModeSeg').after(randomLeak);
  const colors=document.createElement('div');colors.className='light-colors';colors.setAttribute('role','group');colors.setAttribute('aria-label','Sắc màu vệt nắng');for(const [name,hue,color]of [['Vàng',0,'#ffcf69'],['Cam',-20,'#ff9e49'],['Đỏ',-42,'#f0634d']]){const b=document.createElement('button');b.type='button';b.textContent=name;b.style.setProperty('--light-color',color);b.onclick=()=>{const input=document.querySelector('input[data-k="leakHue"]');input.value=hue;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));};colors.append(b);}leakEntry.group.querySelector('input[data-k="leakHue"]').closest('.row').before(colors);
  const regionSource=document.getElementById('rgAtmosSeg'),regionMirrors=[];
  for(const [section,label]of [['Nắng','Vùng áp dụng nắng'],['Vệt nắng','Vùng áp dụng vệt nắng']]){
   const entry=entries.find(e=>e.name===section);if(!entry)continue;const block=document.createElement('details');block.className='effect-region';const summary=document.createElement('summary');summary.textContent='Vùng oval riêng (tùy chọn)';block.append(summary);block.setAttribute('role','group');block.setAttribute('aria-label',label);
   const title=document.createElement('p');title.className='effect-region-title';title.textContent='Vùng áp dụng';const seg=document.createElement('div');seg.className='seg region-seg';
   for(const original of regionSource.querySelectorAll('button')){const b=document.createElement('button');b.type='button';b.dataset.region=original.dataset.v;b.textContent=original.textContent;b.onclick=()=>{original.click();sync();};seg.append(b);regionMirrors.push(b);}
   const help=document.createElement('p');help.className='hint';help.textContent='Dùng chung vùng oval với Vùng nét. Bật tay chỉnh để kéo, đổi cỡ hoặc xoay; ẩn tay chỉnh vẫn giữ nguyên hiệu ứng.';block.append(title,seg,help);entry.group.append(block);
  }
  regionSource.addEventListener('click',()=>{sync();syncOval();});
  const oval=document.getElementById('focusOval'),sizeHandle=document.getElementById('focusHandle'),wrap=document.getElementById('canvasWrap');
  const sunRing=document.createElement('div'),sunResize=document.createElement('button'),heightResize=document.createElement('button'),rotateLight=document.createElement('button'),lightSurface=document.createElement('div');
  sunRing.id='sunRing';sunRing.className='sun-ring';sunRing.setAttribute('aria-hidden','true');sunRing.hidden=true;
  for(const [button,id,label]of [[sunResize,'sunRingResize','Kéo để đổi chiều ngang ánh nắng'],[heightResize,'lightHeightResize','Kéo để đổi chiều dọc ánh nắng'],[rotateLight,'lightRotateHandle','Kéo để xoay hình ánh nắng']]){button.id=id;button.type='button';button.className='light-geometry-handle';button.textContent=button===rotateLight?'↻':'↔';button.setAttribute('aria-label',label);button.title=label;button.hidden=true;}
  lightSurface.id='lightMoveSurface';lightSurface.className='light-move-surface';lightSurface.setAttribute('aria-label','Chạm hoặc kéo để đặt ánh nắng');lightSurface.hidden=true;wrap.append(lightSurface,sunRing,sunResize,heightResize,rotateLight);
  const sunEditing=()=>tool==='sun'&&selectedLight==='Nắng';
  const sunCenter=()=>P.nangManual?NK:{x:.5,y:.04};
  const lightCenter=()=>sunEditing()?sunCenter():P.leakManual?LK:(()=>{const p=RayLight.corner(P.seed);return{x:p[0],y:p[1]};})();
  function currentLight(g){const sun=sunEditing(),point=lightCenter(),shape=!sun&&P.leakShape==='patch'?'rect':'ellipse',v=RayLight.geometry(sun?'sun':'leak',P,point,g.W,g.H),fraction=sun?.38:.64;return{...v,shape,sun,rx:shape==='rect'?Math.max(g.W,g.H)*(.03+(P.leakBandWidth??.3)*.35):v.rx*fraction,ry:shape==='rect'?Math.max(g.W,g.H)*1.6:v.ry*fraction,fraction};}
  function insidePoint(g,v,x,y,margin=16){const a=v.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:clamp(g.ox+(v.cx+x*c-y*s)*g.k,g.ox+margin,g.ox+g.W*g.k-margin),y:clamp(g.oy+(v.cy+x*s+y*c)*g.k,g.oy+48,g.oy+g.H*g.k-margin)};}
  drawSun=()=>{
   const g=bodyGeo(),active=!!source&&tool==='sun'&&(sunEditing()?P.nang:P.leak)>.001,show=active&&!!P.lightGuide&&!document.querySelector('.film-workspace').classList.contains('is-result-preview');sunRing.hidden=sunResize.hidden=heightResize.hidden=rotateLight.hidden=!show;lightSurface.hidden=!active;document.getElementById('stage').classList.toggle('sun-editing',show&&sunEditing());if(!active||!g)return;
   const wr=wrap.getBoundingClientRect();Object.assign(lightSurface.style,{left:(g.ox-wr.left)+'px',top:(g.oy-wr.top)+'px',width:g.W*g.k+'px',height:g.H*g.k+'px'});if(!show)return;
   const v=currentLight(g);Object.assign(sunRing.style,{left:(g.ox+v.cx*g.k-wr.left)+'px',top:(g.oy+v.cy*g.k-wr.top)+'px',width:v.rx*2*g.k+'px',height:v.ry*2*g.k+'px',borderRadius:v.shape==='rect'?'2px':'50%',transform:'translate(-50%,-50%) rotate('+v.angle+'deg)'});
   for(const [handle,x,y]of [[sunResize,v.rx,0],[heightResize,0,v.ry],[rotateLight,0,-Math.min(v.ry*g.k+23,g.H*g.k*.35)/g.k]]){const p=insidePoint(g,v,x,y);handle.style.left=(p.x-wr.left)+'px';handle.style.top=(p.y-wr.top)+'px';}heightResize.hidden=v.shape==='rect';
  };
  bindDrag(lightSurface,{start(e){const g=bodyGeo();if(!source||tool!=='sun'||!g)return;const sun=sunEditing(),point=sun?NK:LK;window.RaySession?.record('Thông số ánh nắng');P[sun?'nangManual':'leakManual']=true;point.x=clamp((e.clientX-g.ox)/(g.W*g.k),0,1);point.y=clamp((e.clientY-g.oy)/(g.H*g.k),0,1);syncControls();syncNangHandle();syncLeakHandle();queue();return{g,sun,x:point.x,y:point.y};},move(s,p){const point=s.sun?NK:LK;point.x=clamp(s.x+p.dx/(s.g.W*s.g.k),0,1);point.y=clamp(s.y+p.dy/(s.g.H*s.g.k),0,1);syncControls();syncNangHandle();syncLeakHandle();queue();},end(){window.RaySession?.record('Đặt ánh nắng trực tiếp');}});
  for(const [element,axis]of [[sunResize,'x'],[heightResize,'y']])bindDrag(element,{start(){const g=bodyGeo();return source&&g?{g,v:currentLight(g)}:null;},move(s,p){const a=s.v.angle*Math.PI/180,dx=p.dx/s.g.k,dy=p.dy/s.g.k,rx=axis==='x'?Math.max(4,s.v.rx+dx*Math.cos(a)+dy*Math.sin(a)):s.v.rx,ry=axis==='y'?Math.max(4,s.v.ry-dx*Math.sin(a)+dy*Math.cos(a)):s.v.ry,unit=Math.max(s.g.W,s.g.H);if(s.v.shape==='rect')P.leakBandWidth=clamp((rx/unit-.03)/.35,.04,1);else{const r=Math.sqrt(rx*ry)/s.v.fraction;P[s.v.sun?'nangAspect':'leakAspect']=clamp(rx/ry,.25,4);P[s.v.sun?'nangSize':'leakBandWidth']=s.v.sun?clamp(r/unit,.15,1.4):clamp((r/unit-.16)/.85,.04,1);if(!s.v.sun)P.leakShape=Math.abs(P.leakAspect-1)<.02?'circle':'oval';}syncControls();syncNangHandle();syncLeakHandle();queue();},end(){window.RaySession?.record('Dài / rộng ánh nắng');}});
  bindDrag(rotateLight,{start(e){const g=bodyGeo();if(!source||!g)return;const v=currentLight(g),cx=g.ox+v.cx*g.k,cy=g.oy+v.cy*g.k;return{cx,cy,angle:v.angle,key:v.sun?'nangAngle':'leakAngle',from:Math.atan2(e.clientY-cy,e.clientX-cx)*180/Math.PI};},move(s,p){P[s.key]=Math.round(RayLight.degrees(s.angle+Math.atan2(p.clientY-s.cy,p.clientX-s.cx)*180/Math.PI-s.from));syncControls();syncNangHandle();syncLeakHandle();queue();},end(){window.RaySession?.record('Xoay hình ánh nắng');}});
  rotateLight.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const key=sunEditing()?'nangAngle':'leakAngle';P[key]=RayLight.degrees((P[key]||0)+(e.key==='ArrowRight'?5:-5));syncControls();syncNangHandle();syncLeakHandle();queue();window.RaySession?.record('Xoay hình ánh nắng');};
  const centerSun=document.createElement('button');centerSun.type='button';centerSun.className='btn center-sun';centerSun.textContent='Đặt nắng giữa ảnh';centerSun.onclick=()=>{P.nangManual=true;NK.x=NK.y=.5;syncControls();syncNangHandle();queue();window.RaySession?.record('Đặt nắng giữa ảnh');};sunEntry?.group.querySelector('#nangModeSeg')?.after(centerSun);
  const angleBlock=document.createElement('div');angleBlock.className='sun-angle-controls';angleBlock.innerHTML='<label class="row"><span class="t"><span>Góc nắng</span><em></em></span><input type="range" min="-180" max="180" step="1" value="0" aria-label="Góc nắng"></label><div class="sun-angle-buttons"><button type="button" aria-label="Xoay nắng ngược chiều 15 độ">↶ −15°</button><button type="button" aria-label="Đưa góc nắng về 0 độ">0° · Từ trên</button><button type="button" aria-label="Xoay nắng cùng chiều 15 độ">+15° ↷</button></div>';
  const angleInput=angleBlock.querySelector('input'),angleValue=angleBlock.querySelector('em');centerSun.after(angleBlock);
  function setSunAngle(degrees){const size=source||{width:1,height:1},position=sunPositionAtAngle(sunCenter(),degrees,size.width,size.height);P.nangManual=true;Object.assign(NK,position);sync();syncNangHandle();queue();}
  angleInput.oninput=()=>setSunAngle(Number(angleInput.value));
  [...angleBlock.querySelectorAll('button')].forEach((button,index)=>{button.onclick=()=>{const size=source||{width:1,height:1},degrees=index===1?0:sunAngle(sunCenter(),size.width,size.height)+(index===0?-15:15);setSunAngle(degrees);window.RaySession?.record('Góc nắng');};});
  const focusEntry=entries.find(e=>e.name==='Vùng nét');lightSlider(focusEntry,'focusAngle','Góc vòng chọn',-180,180,1);
  oval.setAttribute('aria-label','Vòng chọn vùng ánh sáng');sizeHandle.title='Kéo để đổi cỡ vòng ánh sáng';
  const photoPoint=clientToFrac;clientToFrac=function(x,y){const g=bodyGeo();return g?{x:(x-g.ox)/(g.W*g.k),y:(y-g.oy)/(g.H*g.k)}:photoPoint(x,y);};
  syncOval=function(){const g=bodyGeo();if(!g){oval.classList.remove('on');return;}const wr=wrap.getBoundingClientRect();oval.style.left=(g.ox+F.cx*g.W*g.k-wr.left)+'px';oval.style.top=(g.oy+F.cy*g.H*g.k-wr.top)+'px';oval.style.width=(F.rx*2*g.W*g.k)+'px';oval.style.height=(F.ry*2*g.H*g.k)+'px';oval.style.transform='translate(-50%,-50%) rotate('+(P.focusAngle||0)+'deg)';oval.classList.toggle('on',!!source&&((tool==='adjust'&&entries.find(e=>e.key===selected)?.name==='Vùng nét')||(tool==='sun'&&P.lightGuide))&&(P.bgBlur>.001||P.motion>.001||P.rgAtmos!=='off'));};
  for(const [element,resize]of [[oval,false],[sizeHandle,true]])bindDrag(element,{start(point){if(!source||(!resize&&point.target===sizeHandle))return;const g=bodyGeo();return g?{g,cx:F.cx,cy:F.cy,rx:F.rx,ry:F.ry,localAngle:window.RayToneUI?.dragAngle(),signX:Number(sizeHandle.dataset.toneX??1),signY:Number(sizeHandle.dataset.toneY??1)}:null;},move(start,p){const dx=p.dx/(start.g.W*start.g.k),dy=p.dy/(start.g.H*start.g.k);if(resize){if(start.localAngle!=null)Object.assign(F,window.RayTone.resizeRegion(start,start.g.W,start.g.H,p.dx/start.g.k,p.dy/start.g.k,start.localAngle,start.signX,start.signY));else{F.rx=clamp(start.rx+dx,.08,.9);F.ry=clamp(start.ry+dy,.08,.9);}}else{F.cx=clamp(start.cx+dx,.05,.95);F.cy=clamp(start.cy+dy,.05,.95);}syncOval();queue();},end(){window.RaySession?.record('Vị trí / cỡ vùng ánh sáng');}});
  for(const [id,state,enabled]of [['nangHandle',NK,()=>tool==='sun'&&sunEditing()&&P.lightGuide&&P.nang>.001],['leakHandle',LK,()=>tool==='sun'&&selectedLight==='Vệt nắng'&&P.lightGuide&&P.leak>.001]]){
   const isSun=id==='nangHandle',handle=document.getElementById(id),draw=()=>{const g=bodyGeo(),position=lightCenter();if(g){const wr=wrap.getBoundingClientRect();handle.style.left=(g.ox+position.x*g.W*g.k-wr.left)+'px';handle.style.top=(g.oy+position.y*g.H*g.k-wr.top)+'px';}handle.classList.toggle('on',!!source&&enabled());drawSun();};
   if(isSun){handle.setAttribute('aria-label','Kéo tâm nắng');handle.title='Kéo tâm nắng';}
   if(id==='nangHandle')syncNangHandle=draw;else syncLeakHandle=draw;
   bindDrag(handle,{start(){const g=bodyGeo(),position=lightCenter();return source&&g?{g,x:position.x,y:position.y}:null;},move(start,p){P[isSun?'nangManual':'leakManual']=true;state.x=clamp(start.x+p.dx/(start.g.W*start.g.k),0,1);state.y=clamp(start.y+p.dy/(start.g.H*start.g.k),0,1);sync();draw();queue();},end(){window.RaySession?.record('Vị trí ánh sáng');}});
  }
  for(const [name,oldText,newText]of [['Nắng','Cần bật thanh "Nắng" ở mục Chất phim trước.','Kéo Cường độ nắng để bật.'],['Vệt nắng','Cần bật thanh "Vệt sáng lọt" ở mục Chất phim trước.','Kéo Cường độ vệt nắng để bật.']]){const hint=entries.find(e=>e.name===name)?.group?.querySelector(':scope>.hint:not(.light-move-hint)');if(hint)hint.textContent=hint.textContent.replace(oldText,newText);}
  const sunHint=sunEntry?.group.querySelector(':scope>.hint:not(.light-move-hint)');if(sunHint)sunHint.textContent='Chọn Nắng để bật ngay. Chạm hoặc kéo trên ảnh để đặt nguồn sáng. Tròn giữ nắng gốc; Oval có dài / rộng và góc nghiêng riêng. Hiện tay chỉnh khi cần kéo đổi cỡ / xoay. Góc nắng vẫn đổi hướng đặt nguồn sáng quanh ảnh; Trong vòng / Ngoài vòng dùng oval có thể xoay.';
  const leakHint=leakEntry.group.querySelector(':scope>.hint:not(.light-move-hint)');if(leakHint)leakHint.textContent='Tròn tỏa đều, Oval kéo dẹt và nghiêng được, Dải nắng là vệt dài mềm viền. Chạm hoặc kéo bất cứ đâu trên ảnh để đặt vệt; bật tay chỉnh để đổi cỡ và xoay trực tiếp. Vàng / Cam / Đỏ và các thanh sắc độ giữ cách chỉnh cũ. Áp dụng giữ lớp rồi thêm hiệu ứng khác.';
  const frameHint=document.createElement('p');frameHint.className='hint';frameHint.textContent='Chọn viền riêng cho ảnh. Đổi màu phim sẽ giữ viền bạn đã chọn.';entries.find(e=>e.name==='Khung')?.group.append(frameHint);
  const dateGroup=document.getElementById('dateTxt').closest('.grp'),stamp=document.getElementById('stampBtn'),label=stamp.querySelector('span'),dateRow=document.createElement('label');dateRow.className='row stamp-size';dateRow.innerHTML='<span class="t"><span>Cỡ dấu ngày</span><em></em></span><input type="range" min="0.4" max="2.4" step="0.05" value="1" aria-label="Cỡ dấu ngày" data-k="stampScale">';dateGroup.append(dateRow);
  const dateSize=dateRow.querySelector('input'),dateValue=dateRow.querySelector('em');dateSize.oninput=()=>{P.stampScale=Number(dateSize.value);sync();queue();};dateSize.ondblclick=()=>{P.stampScale=1;sync();queue();window.RaySession?.record('Cỡ dấu ngày');};
  let quickDate;
  function sync(){for(const b of guideButtons){b.disabled=!source;b.textContent=b.dataset.compact==='1'?(P.lightGuide?'Ẩn khung chỉnh':'Hiện khung chỉnh'):(P.lightGuide?'Ẩn tay chỉnh':'Hiện tay chỉnh · kéo / xoay');b.setAttribute('aria-pressed',String(!!P.lightGuide));}for(const b of lightToggles){const on=P[b.dataset.lightKey]>.001;b.disabled=!source;b.textContent=(on?'Tắt ':'Bật ')+(b.dataset.lightKey==='leak'?'vệt nắng':'nắng');b.setAttribute('aria-pressed',String(on));}for(const b of sunShape.querySelectorAll('button')){b.disabled=!source;const a=Number(P.nangAspect)||1;b.classList.toggle('on',b.dataset.sunAspect==='1'?Math.abs(a-1)<.02:Math.abs(a-1)>=.02);}leakAspectRow.hidden=P.leakShape==='patch';document.getElementById('leakAngleRow').style.display='';for(const b of document.querySelectorAll('#leakShapeSeg button'))b.classList.toggle('on',b.dataset.v===P.leakShape);for(const key of ['nangAspect','leakAspect','nangAngle','focusAngle']){const value=document.querySelector('em[data-v="'+key+'"]');if(value)value.textContent=key.includes('Angle')?Math.round(P[key]||0)+'°':Number(P[key]||1).toFixed(2)+'×';}for(const m of mirrors)m();for(const {block,point,key}of cornerControls)for(const b of block.querySelectorAll('button')){const on=P[key==='nắng'?'nangManual':'leakManual']&&point.x===Number(b.dataset.cornerX)&&point.y===Number(b.dataset.cornerY);b.classList.toggle('on',!!on);b.setAttribute('aria-pressed',String(!!on));}for(const b of document.querySelectorAll('#leakModeSeg button'))b.classList.toggle('on',b.dataset.v===(P.leakManual?'manual':'auto'));const dimensions=source||{width:1,height:1},angle=Math.round(sunAngle(sunCenter(),dimensions.width,dimensions.height));angleInput.value=angle;angleValue.textContent=angle+'°';for(const b of regionMirrors){const on=b.dataset.region===P.rgAtmos;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));}for(const b of document.querySelectorAll('#nangModeSeg button'))b.classList.toggle('on',b.dataset.v===(P.nangManual?'manual':'auto'));centerSun.disabled=!source;dateSize.value=P.stampScale||1;dateValue.textContent=Math.round((P.stampScale||1)*100)+'%';if(label)label.textContent=P.stamp?'Dấu ngày đang bật · bấm để ẩn':'Dấu ngày đang tắt · bấm để hiện';if(quickDate){quickDate.disabled=!source;quickDate.classList.toggle('on',P.stamp);quickDate.setAttribute('aria-pressed',String(P.stamp));quickDate.textContent=P.stamp?'Ngày ✓':'Ngày ×';quickDate.title=P.stamp?'Ẩn dấu ngày ngay':'Hiện dấu ngày';}drawSun();}
  const toggle=stamp.onclick;stamp.onclick=function(e){toggle.call(this,e);sync();};
  api.attachDateToggle=parent=>{quickDate=document.createElement('button');quickDate.type='button';quickDate.className='quick-date';quickDate.setAttribute('aria-label','Bật hoặc tắt dấu ngày');quickDate.onclick=()=>{stamp.click();window.RaySession?.record('Bật / tắt dấu ngày');};parent.prepend(quickDate);sync();};
  const originalSync=syncControls;syncControls=function(){originalSync();sync();};
  document.addEventListener('input',sync);document.addEventListener('change',sync);new MutationObserver(sync).observe(document.getElementById('stage'),{attributes:true,attributeFilter:['class']});
  window.RayToneUI?.attach();window.RayBrushUI?.attach();api.sync=sync;api.onToolChange(tool);sync();
 };
 return api;
});
