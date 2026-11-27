/* Tool-specific tray sizes affect layout only, never photo pixels or history. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.RayWorkspace=api;api.init();}})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 function limits(h,tool,width=0){
  const min=Math.max(64,Math.min(88,h*.13)),max=Math.max(min,Math.min(320,h*.46)),rich=['text','background','people','remove'].includes(tool);
  // Tall portrait screens have spare room above a full-width landscape photo.
  // Spend it on the placement tools; compact and landscape layouts retain
  // their original tray size, and user-resized heights still take precedence.
  const placement=tool==='background'&&h>=560&&(!width||width<=h);
  return{min,max,normal:tool==='film'?min:Math.min(max,placement?Math.max(220,Math.min(260,h*.32)):rich?Math.max(88,Math.min(136,h*.18)):tool==='body'?Math.max(112,Math.min(176,h*.24)):Math.max(96,Math.min(160,h*.21)))};
 }
 function fitSize(w,h,spaceWidth,spaceHeight){if(![w,h,spaceWidth,spaceHeight].every(n=>Number.isFinite(n)&&n>0))return null;const k=Math.min(spaceWidth/w,spaceHeight/h);return{width:w*k,height:h*k};}
 function init(){
  const app=document.querySelector('.film-workspace'),panel=app.querySelector('.panel'),scroll=panel.querySelector('.scroll'),wrap=document.getElementById('canvasWrap');
  const grip=document.createElement('button');grip.type='button';grip.className='editor-tools-resize';grip.setAttribute('aria-controls','editorControls');scroll.id='editorControls';
  const line=document.createElement('span');line.className='editor-grip-line';line.setAttribute('aria-hidden','true');const label=document.createElement('span');label.className='editor-grip-label';grip.append(line,label);panel.prepend(grip);
  const sizes=new Map(),tool=()=>document.body.dataset.editorTool||'film',measure=()=>{const r=app.getBoundingClientRect();return limits(r.height,tool(),r.width);};let height=null,frame=0;
  function fitPhoto(){if(!source||!wrap)return;const r=wrap.getBoundingClientRect(),size=fitSize(view.width,view.height,r.width,r.height);if(!size)return;view.style.width=size.width+'px';view.style.height=size.height+'px';const original=document.getElementById('sessionOriginal');if(original){original.style.width=size.width+'px';original.style.height=size.height+'px';}syncOval();syncLeakHandle();syncNangHandle();syncBody();window.RayCompose?.syncGeometry?.();window.RayBackgroundEditor?.syncGeometry?.();window.RayPeopleEditor?.syncGeometry?.();window.RayRemove?.syncGeometry?.();}
  function scheduleFit(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;fitPhoto();});}
  function update(value,remember=false){const l=measure();height=Math.max(l.min,Math.min(l.max,value??l.normal));if(remember)sizes.set(tool(),height);app.style.setProperty('--editor-controls-height',Math.round(height)+'px');const expanded=height>l.min+30;grip.setAttribute('aria-expanded',String(expanded));grip.setAttribute('aria-label',expanded?'Thu gọn bảng công cụ để xem ảnh':'Mở rộng bảng công cụ');grip.title='Kéo lên hoặc xuống để đổi chiều cao bảng công cụ';label.textContent=expanded?'Thu gọn để xem ảnh':'Mở rộng công cụ';grip.disabled=!source;if(!frame)frame=requestAnimationFrame(()=>{frame=0;fitPhoto();const tabs=document.querySelector('.editor-tabs'),active=tabs?.querySelector('.active');if(active&&tabs.scrollWidth>tabs.clientWidth){const a=active.getBoundingClientRect(),r=tabs.getBoundingClientRect();tabs.scrollLeft+=a.left-r.left-(tabs.clientWidth-a.width)/2;}syncOval();syncLeakHandle();syncNangHandle();syncBody();});}
  function toggle(){const l=measure();update(height>l.min+30?l.min:l.max,true);}
  RayControls.bindDrag(grip,{start(){if(!source)return;return{height:height??measure().normal,moved:false};},move(s,p){if(Math.abs(p.dy)>4)s.moved=true;if(s.moved)update(s.height-p.dy,true);},end(s){if(!s.moved)toggle();}});
  grip.onclick=e=>{if(e.detail===0)toggle();};grip.onkeydown=e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();update(height+(e.key==='ArrowUp'?24:-24),true);}};
  const change=RayControls.onToolChange;RayControls.onToolChange=function(next){change(next);scroll.scrollTop=0;update(sizes.get(next));};
  const before=draw;draw=function(){before();grip.disabled=!source;fitPhoto();};new ResizeObserver(()=>{update(sizes.get(tool()));scheduleFit();}).observe(app);
  if(wrap)new ResizeObserver(()=>{scheduleFit();window.RayPreview?.layoutChanged?.();}).observe(wrap);if(window.MutationObserver)new MutationObserver(scheduleFit).observe(view,{attributes:true,attributeFilter:['width','height']});
  api.photoBox=()=>wrap?.getBoundingClientRect();api.fitPhoto=fitPhoto;update();
 }
 const api={limits,fitSize,init};return api;
});
