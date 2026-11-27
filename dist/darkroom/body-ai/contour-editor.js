/* Drag the gold contour to reshape pixels, or correct recognition separately for each person. */
(()=>{'use strict';
 const core=RayContourCore,warpCore=RayBodyLineCore,state=core.state(),$=id=>document.getElementById(id),box=$('bodyBox'),pane=$('rayOverall62'),wrap=$('canvasWrap');if(!pane)return;
 const originalMask=RayBodyPose.mask,cache=new WeakMap();let mode='off',lastPerson=null,raf=0,renderTimer=0,warpPeople,warpLines=[],warpFields=[],warpAspect=0;
 const person=()=>BODY_AI.people[BODY_AI.selected],id=p=>p?.rayPersonId||'pose-'+BODY_AI.selected;
 function baseMask(p=person()){if(!p||p.raySource!==source||!source)return null;return p.rayMask||(BODY_AI.people.length===1&&BEAUTY.source===source&&BEAUTY.maps?.foreground?BEAUTY.maps:null);}
 function mask(p=person()){const base=baseMask(p);if(!base)return null;const strokes=state.strokes(id(p));if(!strokes.length)return base;const known=cache.get(base);if(known?.strokes===strokes&&known.W===source.width&&known.H===source.height)return known.mask;const result=core.raster(base,strokes,source.width,source.height);cache.set(base,{strokes,W:source.width,H:source.height,mask:result});return result;}
 RayBodyPose.mask=()=>mask()||originalMask();
 const tools=document.createElement('section');tools.className='ray-contour-tools';tools.id='rayContourTools';tools.innerHTML='<h3>Sửa viền vàng</h3><p class="hint">Nắn theo viền: kéo viền vàng, ảnh thay đổi ngay; bấm ✓ để giữ. Sửa nhận diện / Thêm / Bớt chỉ sửa vùng AI, không nắn ảnh.</p><div class="ray-contour-modes" role="group" aria-label="Bút sửa viền vàng"><button type="button" data-contour-mode="drag">↔ Nắn theo viền</button><button type="button" data-contour-mode="mask">✎ Sửa nhận diện</button><button type="button" data-contour-mode="paint">＋ Thêm vùng</button><button type="button" data-contour-mode="erase">− Bớt vùng</button><button type="button" data-contour-mode="off">✓ Xong viền</button></div><label class="row"><span class="t">Vùng uốn viền <output>14%</output></span><input type="range" min="0.015" max="0.3" step="0.005" value="0.14" aria-label="Cỡ bút uốn viền vàng"></label><div class="ray-contour-actions"><button type="button" data-contour-action="undo">Bỏ nét viền cuối</button><button type="button" data-contour-action="reset">Viền AI ban đầu</button></div><p class="hint" role="status" aria-live="polite"></p>';pane.querySelector('p').after(tools);
 const surface=document.createElement('div');surface.id='rayContourSurface';surface.setAttribute('aria-label','Kéo bút để sửa viền vàng trên ảnh');surface.hidden=true;const cursor=document.createElement('div');cursor.className='ray-contour-cursor';cursor.hidden=true;surface.append(cursor);wrap.append(surface);
 const quick=document.createElement('button');quick.type='button';quick.id='rayContourQuick';quick.hidden=true;wrap.append(quick);quick.onclick=()=>{if(box.dataset.bodyMode!=='body')window.RayBodyWorkspace?.selectMode('body');choose(mode==='off'?'drag':'off');};
 const size=tools.querySelector('input'),status=tools.querySelector('[role=status]');
 const active=()=>!!source&&document.body.dataset.editorTool==='body'&&box.dataset.bodyMode==='body'&&!document.querySelector('.film-workspace.is-result-preview');
 const ready=()=>active()&&!BODY_AI.busy&&!!mask();
 function choose(next){mode=next;if(mode!=='off'){window.RayRatioLive?.cancel();window.RayBodyLines?.finish();$('rayBodyOutline').checked=true;RayGeometry54.guides(true,'overall');}sync();}
 function lines(){const people=state.capture()?.people;if(people!==warpPeople){warpPeople=people;warpLines=core.reshapeLines(state.capture());warpFields=[];warpAspect=0;}return warpLines;}
 function compiled(){const list=lines(),aspect=source?source.width/source.height:0;if(aspect!==warpAspect){warpAspect=aspect;warpFields=source?warpCore.fields(list,source.width,source.height):[];}return warpFields;}
 function project(point){return source?warpCore.project(point,compiled(),source.width,source.height):point;}
 function redraw(immediate=false){window.RayLayers?.invalidate?.();RayGeometry54.scheduleOverlay();clearTimeout(renderTimer);if(immediate)queue();else renderTimer=setTimeout(()=>queue(),70);}
 function changed(label){redraw(true);RayGeometry54.refresh();RayOverall62.refresh();RayGeometry54.scheduleOverlay();window.RaySession?.record(label);sync();}
 function action(label,fn){if(!ready())return;window.RayRatioLive?.cancel();window.RaySession?.record();fn();changed(label);}
 for(const b of tools.querySelectorAll('[data-contour-mode]'))b.onclick=()=>choose(b.dataset.contourMode);
 tools.querySelector('[data-contour-action=undo]').onclick=()=>action('Bỏ nét sửa viền cuối',()=>state.set(id(person()),state.strokes(id(person())).slice(0,-1)));
 tools.querySelector('[data-contour-action=reset]').onclick=()=>action('Khôi phục viền AI',()=>state.set(id(person()),[]));
 size.oninput=()=>{size.previousElementSibling.querySelector('output').textContent=Math.round(Number(size.value)*100)+'%';sync();};
 function layout(){const g=bodyGeo();if(!g||surface.hidden)return;const r=wrap.getBoundingClientRect();Object.assign(surface.style,{left:g.ox-r.left+'px',top:g.oy-r.top+'px',width:g.W*g.k+'px',height:g.H*g.k+'px'});const diameter=Number(size.value)*Math.min(g.W,g.H)*g.k;cursor.style.width=cursor.style.height=diameter+'px';surface.dataset.mode=mode;}
 function sync(){
  const p=person(),key=p?.raySource===source?id(p):null;if(key!==lastPerson){mode='off';lastPerson=key;}
  const enabled=ready(),strokes=p?state.strokes(id(p)):[];surface.hidden=!enabled||mode==='off'||!$('rayBodyOutline').checked;quick.hidden=(!enabled&&!(source&&document.body.dataset.editorTool==='body'&&box.dataset.bodyMode==='lines'&&mask()))||!$('rayBodyOutline').checked;quick.textContent=mode==='off'?'✎ Sửa viền vàng':'✓ Xong viền';quick.setAttribute('aria-pressed',String(mode!=='off'));quick.setAttribute('aria-label',mode==='off'?'Bật bút sửa viền vàng':'Tắt bút sửa viền vàng');
  for(const b of tools.querySelectorAll('button,input'))b.disabled=!enabled;
  for(const b of tools.querySelectorAll('[data-contour-mode]'))b.setAttribute('aria-pressed',String(b.dataset.contourMode===mode));
  for(const b of tools.querySelectorAll('[data-contour-action]'))b.disabled=!enabled||!strokes.length;
  status.textContent=!source?'Mở ảnh để sửa viền.':BODY_AI.busy?'Đang nhận diện…':!mask()?'Quét AI để có viền người.':strokes.length?'Người '+(BODY_AI.selected+1)+' · '+strokes.length+' nét sửa viền · Có thể Hoàn tác.':'Chọn Nắn theo viền để kéo và đổi dáng ngay. Sửa nhận diện / Thêm / Bớt chỉ sửa vùng AI.';
  layout();
 }
 function screenPoint(e,g){const p=[clamp((e.clientX-g.ox)/(g.W*g.k),0,1),clamp((e.clientY-g.oy)/(g.H*g.k),0,1)];return window.RayBodyLines?.unproject(p)||p;}
 function point(e,g,warps,fields){const screen=warpCore.unproject(screenPoint(e,g),fields,source.width,source.height),p=RayBodyCore.unproject(screen,warps,source.width,source.height);return p.map(v=>clamp(v,0,1));}
 function ring(e,g){cursor.hidden=false;cursor.style.left=e.clientX-g.ox+'px';cursor.style.top=e.clientY-g.oy+'px';}
 function publish(s,stroke,segment){const p=person();if(p!==s.person||source!==s.source)return;const result=core.applyStroke(stroke.mode==='pull'?s.base:s.rendered,stroke.mode==='pull'?stroke:segment,source.width,source.height);s.rendered=result;s.stroke=stroke;const strokes=[...s.before,stroke];state.set(s.id,strokes);cache.set(baseMask(s.person),{strokes,W:source.width,H:source.height,mask:result});RayGeometry54.scheduleOverlay();if(stroke.effect==='reshape')redraw();status.textContent=(stroke.effect==='reshape'?'Đang nắn dáng Người ':'Đang sửa nhận diện Người ')+(BODY_AI.selected+1);}
 function nearest(e,g,warps){
  let found=null,distance=24;for(const segment of RayBodyCore.boundaries(mask()))for(const pt of segment){const rendered=project(RayBodyCore.project(pt,warps,source.width,source.height)),q=window.RayBodyLines?.project(rendered)||rendered;const d=Math.hypot(g.ox+q[0]*g.W*g.k-e.clientX,g.oy+q[1]*g.H*g.k-e.clientY);if(d<distance){distance=d;found={base:pt,rendered};}}return found;
 }
 RayControls.bindDrag(surface,{
  start(e){const g=bodyGeo(),p=person();if(!ready()||mode==='off'||!g||!p)return;const before=state.strokes(id(p));if(before.length>=160){status.textContent='Đã có 160 nét. Bỏ bớt nét hoặc về viền AI ban đầu để vẽ lại.';return;}
   const warps=RayBodyCore.compile(window.RayBodyPeople?.parts()||BODY.parts,source.width,source.height,{guard:bodyGuard,coef:bodyCoef}),fields=compiled(),contact=mode==='drag'?screenPoint(e,g):point(e,g,warps,fields),hit=['drag','mask'].includes(mode)?nearest(e,g,warps):null,anchor=mode==='drag'?hit?.rendered:mode==='mask'?hit?.base:contact;
   if(!anchor){status.textContent='Chạm sát viền vàng để uốn. Dùng Thêm / Bớt vùng nếu muốn sửa bên trong.';return;}
   window.RayRatioLive?.cancel();window.RaySession?.record();const stroke={mode:['drag','mask'].includes(mode)?'pull':mode,...(mode==='drag'?{effect:'reshape'}:{}),size:Number(size.value),points:[anchor]},s={g,warps,fields,person:p,id:id(p),source,before,contact,anchor,stroke,base:mask(p),rendered:mask(p)};ring(e,g);publish(s,stroke,stroke);return s;},
  move(s,e){let next=s.stroke.effect==='reshape'?screenPoint(e,s.g):point(e,s.g,s.warps,s.fields);ring(e,s.g);
   if(s.stroke.mode==='pull'){next=s.anchor.map((v,i)=>clamp(v+next[i]-s.contact[i],0,1));publish(s,{...s.stroke,points:[s.anchor,next]},null);return;}
   const last=s.stroke.points.at(-1);if(s.stroke.points.length>=512||Math.hypot((next[0]-last[0])*source.width,(next[1]-last[1])*source.height)<Math.min(source.width,source.height)*s.stroke.size*.025)return;publish(s,{...s.stroke,points:[...s.stroke.points,next]},{...s.stroke,points:[last,next]});},
  end(s){cursor.hidden=true;if(source===s.source&&person()===s.person){if(s.stroke.mode==='pull'&&s.stroke.points.length===1)state.set(s.id,s.before);changed(s.stroke.effect==='reshape'?'Nắn dáng theo viền vàng':'Sửa vùng nhận diện');}}
 });
 surface.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&!surface.hidden){const g=bodyGeo();if(g)ring(e,g);}});surface.addEventListener('pointerleave',()=>cursor.hidden=true);
 const api={capture:()=>state.capture(),restore(value){state.restore(value);mode='off';redraw();sync();},clear(){state.clear();mode='off';redraw();sync();},finish(){choose('off');},mask,lines,project,sync};window.RayBodyContour=api;
 const originalWarp=bodyWarp;bodyWarp=function(c,W,H){const r=originalWarp(c,W,H);if(!BODY.peek&&source&&!window.RayBodyLines?.handlesContour)warpCore.apply(c,W,H,lines());return r;};
 const ui=bodyAiUI;bodyAiUI=function(...args){const r=ui.apply(this,args);sync();return r;};const drawBefore=draw;draw=function(...args){const r=drawBefore.apply(this,args);sync();return r;};
 const reset=$('bodyResetAll').onclick;$('bodyResetAll').onclick=function(...args){window.RaySession?.record();state.clear();const r=reset.apply(this,args);window.RaySession?.record('Xóa chỉnh dáng và sửa viền');sync();return r;};
 $('rayBodyOutline').addEventListener('change',sync);new MutationObserver(sync).observe(box,{attributes:true,attributeFilter:['data-body-mode']});new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['data-editor-tool']});new MutationObserver(sync).observe(document.querySelector('.film-workspace'),{attributes:true,attributeFilter:['class']});new ResizeObserver(()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;layout();});}).observe(wrap);sync();
})();
