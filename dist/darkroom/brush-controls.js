/* A small local dodge/burn brush. Stroke arrays are immutable so drafts and applied layers stay independent. */
(() => {
 'use strict';
 const core=window.RayBrush,pane=document.createElement('div');pane.id='grpBrush';pane.className='grp';pane.innerHTML='<p class="lbl">Bút ánh sáng</p><p class="hint brush-intro">Tô tự do trên ảnh. Kéo thanh về + để sáng, − để tối. Áp dụng giữ lớp rồi tô tiếp.</p>';document.getElementById('grpLocalTone').after(pane);
 const modes=document.createElement('div');modes.className='seg brush-modes';modes.setAttribute('aria-label','Chế độ bút');pane.append(modes);
 const rows=[];
 for(const [mode,text]of [['paint','✦ Tô vùng'],['erase','⌫ Tẩy vùng']]){const b=document.createElement('button');b.type='button';b.dataset.brushMode=mode;b.textContent=text;b.onclick=()=>{P.brushMode=mode;sync();window.RayControls.openSection('Bút ánh sáng');};modes.append(b);}
 function slider(key,title,min,max,step){const row=document.createElement('label');row.className='row brush-row';row.innerHTML='<span class="t"><span>'+title+'</span><em></em></span><input type="range" min="'+min+'" max="'+max+'" step="'+step+'" data-k="'+key+'" aria-label="'+title+'">';const input=row.querySelector('input'),value=row.querySelector('em');input.oninput=()=>{P[key]=Number(input.value);sync();queue();};input.ondblclick=()=>{P[key]=core.defaults[key];syncControls();queue();window.RaySession?.record('Thông số bút');};rows.push({key,input,value});pane.append(row);}
 const tones=document.createElement('div');tones.className='seg brush-tones';tones.setAttribute('aria-label','Sáng hoặc tối');pane.append(tones);
 for(const [ev,text]of [[.6,'☀ Làm sáng'],[-.6,'◐ Làm tối']]){const b=document.createElement('button');b.type='button';b.dataset.brushTone=ev>0?'light':'dark';b.textContent=text;b.onclick=()=>{P.brushEV=(ev>0?1:-1)*Math.max(.2,Math.abs(P.brushEV)||.6);P.brushMode='paint';syncControls();queue();};tones.append(b);}
 slider('brushEV','Sáng / tối bút',-2,2,.01);modes.before(rows[0].input.closest('.row'));slider('brushSize','Cỡ bút',.015,.5,.005);slider('brushSoftness','Mềm viền bút',0,1,.01);pane.append(tones);
 const actions=document.createElement('div');actions.className='bodybtns brush-actions';pane.append(actions);
 function button(text,fn){const b=document.createElement('button');b.type='button';b.className='bbtn';b.textContent=text;b.onclick=fn;actions.append(b);return b;}
 const see=button('Xem vùng tô',()=>{P.brushShowMask=!P.brushShowMask;sync();});see.setAttribute('aria-label','Hiện hoặc ẩn vùng đã tô');
 const undoStroke=button('Bỏ nét cuối',()=>{P.brushStrokes=(P.brushStrokes||[]).slice(0,-1);sync();queue();});
 const clear=button('Xóa vùng tô',()=>{P.brushStrokes=[];sync();queue();});
 const status=document.createElement('p');status.className='hint brush-status';status.setAttribute('role','status');pane.append(status);
 let layer=null,maskView=null,cursor=null,hud=null,lastMask=null,lastW=0,lastH=0;
 function editing(){return !!source&&document.body.dataset.editorTool==='adjust'&&window.RayControls?.captureSelection().adjustName==='Bút ánh sáng'&&!document.querySelector('.film-workspace').classList.contains('is-result-preview');}
 function drawMask(g){if(!maskView)return;maskView.hidden=!P.brushShowMask;if(maskView.hidden||!g)return;const strokes=P.brushStrokes||[];if(lastMask===strokes&&lastW===g.W&&lastH===g.H)return;const mask=core.raster(strokes,g.W,g.H);maskView.width=mask.width;maskView.height=mask.height;const c=maskView.getContext('2d'),im=c.createImageData(mask.width,mask.height);for(let i=0;i<mask.data.length;i++){im.data[i*4]=241;im.data[i*4+1]=191;im.data[i*4+2]=86;im.data[i*4+3]=Math.round(mask.data[i]*115);}c.putImageData(im,0,0);lastMask=strokes;lastW=g.W;lastH=g.H;}
 function syncLayer(){if(!layer)return;const on=editing(),stage=document.getElementById('stage');stage.classList.toggle('brush-editing',on);layer.hidden=!on;if(!on){cursor.hidden=true;return;}const g=bodyGeo();if(!g)return;const wr=document.getElementById('canvasWrap').getBoundingClientRect();Object.assign(layer.style,{left:(g.ox-wr.left)+'px',top:(g.oy-wr.top)+'px',width:g.W*g.k+'px',height:g.H*g.k+'px'});const diameter=Math.min(g.W,g.H)*g.k*P.brushSize;cursor.style.width=cursor.style.height=diameter+'px';cursor.classList.toggle('erasing',P.brushMode==='erase');hud.textContent=P.brushMode==='erase'?'Tẩy vùng tô':(P.brushEV<0?'Bút tối ':'Bút sáng ')+(P.brushEV>0?'+':'')+Number(P.brushEV).toFixed(2)+' EV';drawMask(g);}
 function sync(){
  for(const r of rows){const n=Number(P[r.key]??core.defaults[r.key]);r.input.value=n;r.input.disabled=!source;r.value.textContent=r.key==='brushEV'?(n>0?'+':'')+n.toFixed(2)+' EV':Math.round(n*100)+'%';}
  for(const b of modes.querySelectorAll('button')){const on=b.dataset.brushMode===P.brushMode;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));b.disabled=!source;}
  for(const b of tones.querySelectorAll('button')){const on=b.dataset.brushTone===(P.brushEV<0?'dark':'light')&&P.brushEV!==0;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));b.disabled=!source;}
  const count=P.brushStrokes?.length||0;see.disabled=!source;undoStroke.disabled=clear.disabled=!source||!count;see.classList.toggle('on',!!P.brushShowMask);see.setAttribute('aria-pressed',String(!!P.brushShowMask));see.textContent=P.brushShowMask?'Ẩn vùng tô':'Xem vùng tô';status.textContent=count?count+' nét · Đổi thanh sáng/tối để chỉnh vùng đã tô. Áp dụng giữ lớp này.':'Chọn cỡ bút rồi tô lên ảnh. Chạm một lần tạo một đốm; kéo để vẽ nét liên tục.';syncLayer();
 }
 const oldSync=syncControls;syncControls=function(){oldSync();sync();};
 window.RayBrushUI={sync,layerTitle:()=>P.brushEV<0?'Bút ánh sáng · Tối':'Bút ánh sáng · Sáng',attach(){
  const wrap=document.getElementById('canvasWrap');layer=document.createElement('div');layer.id='brushLayer';layer.className='brush-layer';layer.setAttribute('aria-label','Vẽ ánh sáng trực tiếp trên ảnh');layer.hidden=true;maskView=document.createElement('canvas');maskView.className='brush-mask-view';maskView.setAttribute('aria-hidden','true');cursor=document.createElement('div');cursor.className='brush-cursor';cursor.hidden=true;hud=document.createElement('span');hud.className='brush-hud';layer.append(maskView,cursor,hud);wrap.append(layer);
  function ring(x,y,g){cursor.hidden=false;cursor.style.left=(x-g.ox)+'px';cursor.style.top=(y-g.oy)+'px';}
  function point(g,x,y){return[clamp((x-g.ox)/(g.W*g.k),0,1),clamp((y-g.oy)/(g.H*g.k),0,1)];}
  function publish(s){P.brushStrokes=[...s.before,{mode:s.mode,size:s.size,softness:s.softness,points:s.points.slice()}];queue();drawMask(s.g);status.textContent=P.brushStrokes.length+' nét · Đang tô';}
  RayControls.bindDrag(layer,{start(e){const g=bodyGeo();if(!editing()||!g)return;window.RaySession?.record('Thông số bút');const s={g,before:P.brushStrokes||[],points:[point(g,e.clientX,e.clientY)],mode:P.brushMode,size:P.brushSize,softness:P.brushSoftness,touch:e.pointerType!=='mouse'};ring(e.clientX,e.clientY,g);publish(s);return s;},move(s,p){const pt=point(s.g,p.clientX,p.clientY),last=s.points[s.points.length-1],distance=Math.hypot((pt[0]-last[0])*s.g.W,(pt[1]-last[1])*s.g.H);ring(p.clientX,p.clientY,s.g);if(distance<Math.min(s.g.W,s.g.H)*s.size*.04)return;s.points.push(pt);publish(s);},end(s){if(s.touch)cursor.hidden=true;sync();window.RaySession?.record(s.mode==='erase'?'Tẩy vùng tô':'Nét bút ánh sáng');}});
  layer.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&editing()){const g=bodyGeo();if(g)ring(e.clientX,e.clientY,g);}});layer.addEventListener('pointerleave',()=>{cursor.hidden=true;});
  const oldOval=syncOval;syncOval=function(){oldOval();sync();};new ResizeObserver(syncLayer).observe(wrap);sync();
 }};
 sync();
})();
