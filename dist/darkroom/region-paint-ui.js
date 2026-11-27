/* Draw the current adjustment coverage directly on the photograph. Guides never export. */
(()=>{'use strict';
 const core=RayRegionPaint,scope=RayAdjustScopeUI,$=id=>document.getElementById(id),wrap=$('canvasWrap'),app=document.querySelector('.film-workspace'),details=document.querySelector('.adjust-scope-settings');
 const pane=document.createElement('div');pane.className='region-paint-tools';pane.innerHTML='<p class="hint">Tô nhiều vùng rời nhau, hoặc khoanh đường bao để lấy cả phần bên trong. Viền nét đứt chỉ là hướng dẫn, không nằm trên ảnh lưu.</p>';details.querySelector('.adjust-scope-shape').after(pane);
 const modeRows=[],modes=[['paint','Tô vùng'],['lasso','Khoanh vùng'],['shape','Ghép nét'],['erase','Tẩy vùng']];
 const layer=document.createElement('div');layer.id='regionPaintLayer';layer.setAttribute('role','group');layer.setAttribute('aria-label','Vẽ vùng áp dụng trực tiếp trên ảnh');layer.hidden=true;
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 1000 1000');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
 const back=document.createElementNS(svg.namespaceURI,'path'),front=document.createElementNS(svg.namespaceURI,'path');back.classList.add('region-paint-back');front.classList.add('region-paint-front');svg.append(back,front);
 const cursor=document.createElement('span');cursor.className='region-paint-cursor';cursor.hidden=true;layer.append(svg,cursor);wrap.append(layer);
 const toolbar=document.createElement('div');toolbar.id='regionPaintToolbar';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Bút vẽ vùng trên ảnh');toolbar.hidden=true;wrap.append(toolbar);
 const title=document.createElement('span');title.className='region-paint-label';toolbar.append(title);
 function act(label,fn){scope.act(label,fn);}
 function start(){act('Bút vẽ vùng',()=>{P.adjustRegionShape='freehand';if(P.adjustRegion==='all')P.adjustRegion='in';P.adjustRegionPlaced=true;P.adjustRegionShow=true;P.adjustRegionDrawing=true;});}
 for(const row of document.querySelectorAll('.adjust-scope-bar')){const b=document.createElement('button');b.type='button';b.className='adjust-region-paint';b.textContent='✎ Vẽ vùng';b.setAttribute('aria-label','Bút vẽ vùng');b.onclick=start;row.insertBefore(b,row.querySelector('.adjust-scope-edit'));}
 function modeBar(host,label){const row=document.createElement('div');row.className='region-paint-modes';row.setAttribute('role','group');row.setAttribute('aria-label',label);for(const [mode,text]of modes){const b=document.createElement('button');b.type='button';b.dataset.regionPaintMode=mode;b.textContent=text;b.onclick=()=>{P.adjustRegionPaintMode=mode;P.adjustRegionDrawing=true;P.adjustRegionShow=true;sync();window.RaySession?.contextChanged();};row.append(b);}host.append(row);modeRows.push(row);}
 modeBar(pane,'Cách vẽ vùng');modeBar(toolbar,'Cách vẽ trên ảnh');
 const size=document.createElement('label');size.className='row';size.innerHTML='<span class="t"><span>Cỡ bút vùng</span><output></output></span><input type="range" min=".005" max=".6" step=".005" aria-label="Cỡ bút vẽ vùng">';const input=size.querySelector('input'),sizeValue=size.querySelector('output');input.oninput=()=>{P.adjustRegionBrushSize=Number(input.value);sync();};input.onchange=()=>window.RaySession?.contextChanged();pane.append(size);
 const actions=document.createElement('div');actions.className='adjust-scope-actions';pane.append(actions);
 function button(host,label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;host.append(b);return b;}
 const undo=button(actions,'Bỏ nét vùng cuối',()=>act('Bỏ nét vùng cuối',()=>{P.adjustRegionStrokes=(P.adjustRegionStrokes||[]).slice(0,-1);}));
 const clear=button(actions,'Xóa vùng đã vẽ',()=>act('Xóa vùng đã vẽ',()=>{P.adjustRegionStrokes=[];}));
 const done=button(toolbar,'✓ Xong vẽ',()=>{if(P.adjustRegionPaintMode==='shape'&&window.RayRegionShapeUI?.finish()===false)return;P.adjustRegionDrawing=false;core.interactive=false;sync();queue();window.RaySession?.contextChanged();});done.setAttribute('aria-label','Xong vẽ vùng');
 const help=document.createElement('p');help.className='hint';help.setAttribute('role','status');pane.append(help);
 let lastStrokes=null,lastFeather=-1,lastW=0,lastH=0,timer=0;
 function guide(g){
  const strokes=P.adjustRegionStrokes||[];if(lastStrokes===strokes&&lastFeather===P.adjustRegionFeather&&lastW===g.W&&lastH===g.H)return;
  const mask=core.raster(strokes,g.W,g.H,{cap:384,feather:P.adjustRegionFeather??.4}),paths=core.contours(mask),d=paths.map(points=>'M'+points.map(p=>(p[0]*1000).toFixed(2)+' '+(p[1]*1000).toFixed(2)).join('L')+'Z').join('');back.setAttribute('d',d);front.setAttribute('d',d);lastStrokes=strokes;lastFeather=P.adjustRegionFeather;lastW=g.W;lastH=g.H;
 }
 function sync(){
  const free=P.adjustRegionShape==='freehand',on=free&&scope.visible(),drawing=on&&P.adjustRegionDrawing,disabled=!source||BEAUTY.busy||BODY_AI.busy,strokes=P.adjustRegionStrokes||[];pane.hidden=!free;layer.hidden=toolbar.hidden=!on;layer.classList.toggle('is-drawing',drawing);cursor.hidden=P.adjustRegionPaintMode==='shape'||!drawing||cursor.hidden;
  for(const b of document.querySelectorAll('.adjust-region-paint')){b.disabled=disabled;b.setAttribute('aria-pressed',String(drawing));}
  for(const row of modeRows)for(const b of row.querySelectorAll('button')){b.disabled=disabled;b.setAttribute('aria-pressed',String(b.dataset.regionPaintMode===P.adjustRegionPaintMode&&drawing));}
  input.value=P.adjustRegionBrushSize??.12;input.disabled=disabled;sizeValue.textContent=(Number(input.value)*100).toFixed(1)+'%';undo.disabled=clear.disabled=disabled||!strokes.length;
  help.textContent=strokes.length?strokes.length+' nét · Đổi Trong/Ngoài để chọn phía áp dụng.':(P.adjustRegionPaintMode==='lasso'?'Khoanh một đường bao bất kỳ; khi thả tay vùng sẽ khép kín.':'Chọn cỡ bút rồi tô lên ảnh. Chạm để tạo đốm, kéo để vẽ nét liên tục.');
  title.textContent=P.adjustRegion==='out'?'Ngoài vùng vẽ':'Trong vùng vẽ';done.hidden=!drawing;
  window.RayRegionShapeUI?.sync();if(!on){cursor.hidden=true;core.interactive=false;return;}const g=bodyGeo();if(!g)return;const wr=wrap.getBoundingClientRect();Object.assign(layer.style,{left:g.ox-wr.left+'px',top:g.oy-wr.top+'px',width:g.W*g.k+'px',height:g.H*g.k+'px'});const diameter=(P.adjustRegionBrushSize||.12)*Math.min(g.W,g.H)*g.k;cursor.style.width=cursor.style.height=diameter+'px';cursor.classList.toggle('is-erasing',P.adjustRegionPaintMode==='erase');guide(g);
 }
 function point(g,x,y){return[clamp((x-g.ox)/(g.W*g.k),0,1),clamp((y-g.oy)/(g.H*g.k),0,1)];}
 function ring(g,x,y){cursor.hidden=false;cursor.style.left=x-g.ox+'px';cursor.style.top=y-g.oy+'px';}
 function apply(){clearTimeout(timer);timer=0;RayLayers.updateScope();queue();}
 function publish(s,now=false){P.adjustRegionStrokes=[...s.before,{mode:s.mode,size:s.size,points:s.points}];guide(s.g);if(now)apply();else if(!timer)timer=setTimeout(apply,100);}
 RayControls.bindDrag(layer,{
  start(e){if(P.adjustRegionPaintMode==='shape'&&window.RayRegionShapeUI)return;if(!source||P.adjustRegionShape!=='freehand'||!scope.visible()||!P.adjustRegionDrawing||BEAUTY.busy||BODY_AI.busy)return;const g=bodyGeo();if(!g)return;const before=P.adjustRegionStrokes||[];if(before.length>=core.MAX_STROKES){help.textContent='Đã có 256 nét. Bỏ nét thừa hoặc Áp dụng để vẽ vùng tiếp theo.';return;}window.RaySession?.record();core.interactive=true;const s={g,before,mode:P.adjustRegionPaintMode||'paint',size:P.adjustRegionBrushSize||.12,points:[point(g,e.clientX,e.clientY)],touch:e.pointerType!=='mouse'};ring(g,e.clientX,e.clientY);publish(s,true);return s;},
  move(s,e){ring(s.g,e.clientX,e.clientY);const next=core.append(s.points,point(s.g,e.clientX,e.clientY),Math.max(.0004,s.size*.02));if(next===s.points)return;s.points=next;publish(s);},
  end(s){core.interactive=false;apply();if(s.touch)cursor.hidden=true;sync();window.RaySession?.record(s.mode==='erase'?'Tẩy vùng áp dụng':s.mode==='lasso'?'Khoanh vùng áp dụng':'Tô vùng áp dụng');}
 });
 layer.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&P.adjustRegionDrawing&&P.adjustRegionPaintMode!=='shape'){const g=bodyGeo();if(g)ring(g,e.clientX,e.clientY);}});layer.addEventListener('pointerleave',()=>cursor.hidden=true);
 window.RayRegionPaintUI={sync,start,layer,toolbar,pane};new ResizeObserver(sync).observe(wrap);sync();
})();
