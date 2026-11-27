/* Makeup extension. The supplied film renderer remains unchanged. */
(() => {
 'use strict';
 const kit=window.RayBrowKit,defaults={browStyle:'original',browThickness:1,browLength:1,browLift:0,browRotation:0,browLeftX:0,browLeftY:0,browRightX:0,browRightY:0};
 const manual={enabled:false,span:.09,points:[{x:.44,y:.34},{x:.56,y:.34}]};
 Object.assign(BEAUTY_DEFAULT,defaults);Object.assign(BEAUTY.values,defaults);
 const section=document.getElementById('beautyBrow'),gallery=document.createElement('div');gallery.className='brow-styles';gallery.id='browStyles';gallery.setAttribute('role','group');gallery.setAttribute('aria-label','Dáng lông mày');
 const heading=document.createElement('p');heading.className='brow-heading';heading.textContent='Chọn dáng lông mày';
 const cards=[];
 for(const s of kit.STYLES){
  const b=document.createElement('button');b.type='button';b.className='brow-style';b.dataset.browStyle=s.id;b.setAttribute('aria-label',s.name);
  const cv=document.createElement('canvas');cv.width=112;cv.height=58;cv.setAttribute('aria-hidden','true');kit.preview(cv.getContext('2d'),s.id,112,58);
  const label=document.createElement('span');label.textContent=s.name;b.append(cv,label);gallery.append(b);cards.push(b);
  b.onclick=()=>{BEAUTY.values.browStyle=s.id;BEAUTY.values.brow=s.id==='original'?0:Math.max(.60,BEAUTY.values.brow||0);if(s.id!=='original'&&!selectedFace())manual.enabled=true;beautyUI();queue();};
 }
 section.prepend(heading,gallery);
 const hint=document.createElement('p');hint.className='hint brow-help';hint.textContent='Chọn người để chỉnh riêng. Mức 40–65 thường tự nhiên hơn; chỉnh độ dày, độ dài và vị trí cho vừa chân mày của bạn.';section.append(hint);
 const rows=[];
 for(const [key,label,min,max,step]of [['browThickness','Độ dày chân mày',.5,1.6,.01],['browLength','Độ dài chân mày',.75,1.3,.01],['browLift','Nâng / hạ chân mày',-.6,.6,.01],['browRotation','Góc chân mày',-12,12,1]]){
  const row=document.createElement('label');row.className='row brow-adjust';const title=document.createElement('span');title.className='t';const text=document.createElement('span');text.textContent=label;const value=document.createElement('em');title.append(text,value);
  const input=document.createElement('input');input.type='range';input.min=min;input.max=max;input.step=step;input.dataset.browSetting=key;input.setAttribute('aria-label',label);input.oninput=()=>{BEAUTY.values[key]=Number(input.value);beautyUI();queue();};row.append(title,input);section.append(row);rows.push({key,input,value});
 }
 const manualButton=document.createElement('button');manualButton.type='button';manualButton.className='bbtn brow-manual';manualButton.textContent='Đặt vị trí mày thủ công';manualButton.setAttribute('aria-label','Đặt vị trí mày thủ công');heading.after(manualButton);
 const manualSize=document.createElement('label');manualSize.className='row brow-adjust';manualSize.innerHTML='<span class="t"><span>Cỡ mày thủ công</span></span><input type="range" min="0.015" max="0.2" step="0.002" aria-label="Cỡ mày thủ công">';section.append(manualSize);manualSize.hidden=true;
 manualSize.querySelector('input').oninput=e=>{const before=manual.span;manual.span=Number(e.target.value);if(manual.face){const pts=manual.points,cx=(pts[0].x+pts[1].x)/2,cy=(pts[0].y+pts[1].y)/2;manual.face=manual.face.map(p=>p?{...p,x:cx+(p.x-cx)*manual.span/before,y:cy+(p.y-cy)*manual.span/before}:p);}queue();syncManual();};
 function selectedFace(){return BEAUTY.people[BEAUTY.selected]?.face||BEAUTY.faces[0]||null;}
 function manualMode(){return manual.enabled&&!selectedFace();}
 function manualFace(W,H){if(manual.face)return manual.face;const face=[];kit.sides.forEach((side,i)=>{const p=manual.points[i],sign=i?1:-1;side.ids.forEach((id,k)=>{const u=k<5?1-k/4:(k-5)/4;face[id]={x:p.x+sign*(u-.5)*manual.span,y:p.y+(k<5?-.012:.012)*W/H};});});return face;}
 function anchorAt(i,g){
  const face=manualMode()?manualFace(g.W,g.H):selectedFace(),a=face&&kit.anchors(face,kit.sides[i],g.W,g.H,BEAUTY.values);if(!a)return null;
  return{x:(a.x+a.ux*a.length*.5)/g.W,y:(a.y+a.uy*a.length*.5)/g.H,width:a.length/g.W};
 }
 manualButton.onclick=()=>{if(!BEAUTY.values.browStyle||BEAUTY.values.browStyle==='original'){BEAUTY.values.browStyle='natural';BEAUTY.values.brow=.6;}if(!selectedFace())manual.enabled=true;beautyUI();queue();};
 const resetPosition=document.createElement('button');resetPosition.type='button';resetPosition.className='bbtn brow-reset-position';resetPosition.textContent='Đặt lại vị trí';resetPosition.onclick=()=>{for(const k of ['browLeftX','browLeftY','browRightX','browRightY'])BEAUTY.values[k]=0;manual.face=null;manual.points=[{x:.44,y:.34},{x:.56,y:.34}];beautyUI();queue();};manualButton.after(resetPosition);
 const handles=[0,1].map(i=>{
  const h=document.createElement('button');h.type='button';h.className='manual-brow-anchor';h.textContent=i?'Mày phải':'Mày trái';h.setAttribute('aria-label','Kéo vị trí '+h.textContent.toLowerCase());h.title='Kéo lên / xuống / trái / phải cho khớp chân mày';document.getElementById('canvasWrap').append(h);
  window.RayControls.bindDrag(h,{start(){const g=bodyGeo();if(!g||!source)return;const key=i?'browRight':'browLeft';return{ox:BEAUTY.values[key+'X']||0,oy:BEAUTY.values[key+'Y']||0,key,g,values:BEAUTY.values};},move(d,p){d.values[d.key+'X']=clamp(d.ox+p.dx/(d.g.W*d.g.k),-1,1);d.values[d.key+'Y']=clamp(d.oy+p.dy/(d.g.H*d.g.k),-1,1);syncManual();syncPositions();queue();},end(){window.RaySession?.record('Vị trí chân mày');}});
  h.addEventListener('keydown',e=>{const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key],g=bodyGeo();if(!delta||!g)return;e.preventDefault();const key=i?'browRight':'browLeft',step=e.shiftKey?10:1;BEAUTY.values[key+'X']=clamp((BEAUTY.values[key+'X']||0)+delta[0]*step/(g.W*g.k),-1,1);BEAUTY.values[key+'Y']=clamp((BEAUTY.values[key+'Y']||0)+delta[1]*step/(g.H*g.k),-1,1);syncManual();syncPositions();queue();window.RaySession?.record('Vị trí chân mày');});return h;
 });
 const positions=document.createElement('div');positions.className='brow-positions';const positionRows=[];
 for(const [key,name]of [['browLeftY','Lên / xuống mày trái'],['browRightY','Lên / xuống mày phải']]){const label=document.createElement('label');label.className='row';const title=document.createElement('span');title.className='t';const text=document.createElement('span');text.textContent=name;const value=document.createElement('em');title.append(text,value);const input=document.createElement('input');input.type='range';input.min=-.5;input.max=.5;input.step=.002;input.setAttribute('aria-label',name);input.oninput=()=>{BEAUTY.values[key]=Number(input.value);syncManual();syncPositions();queue();};label.append(title,input);positions.append(label);positionRows.push({key,input,value});}gallery.after(positions);
 function syncPositions(){for(const r of positionRows){const v=BEAUTY.values[r.key]||0;r.input.value=v;r.value.textContent=(v>0?'+':'')+Math.round(v*100)+'%';r.input.disabled=!source||BEAUTY.busy||BEAUTY.values.browStyle==='original';}}
 function syncManual(){
  const g=bodyGeo(),wrap=document.getElementById('canvasWrap').getBoundingClientRect(),show=!!(source&&g&&!BEAUTY.busy&&BEAUTY.values.browStyle&&BEAUTY.values.browStyle!=='original'&&document.body.dataset.editorTool==='beauty'&&selected==='brow');
  handles.forEach((h,i)=>{const p=g&&anchorAt(i,g);h.hidden=!show||!p;if(p){h.style.left=(g.ox+p.x*g.W*g.k-wrap.left)+'px';h.style.top=(g.oy+p.y*g.H*g.k-wrap.top)+'px';h.style.width=(p.width*g.W*g.k)+'px';}});
 }
 const originalUI=beautyUI;beautyUI=function(){
  originalUI();const v=BEAUTY.values;
  for(const b of cards){const selected=b.dataset.browStyle===(v.browStyle||'original');b.classList.toggle('on',selected);b.setAttribute('aria-pressed',String(selected));b.disabled=!source||BEAUTY.busy;}
  for(const r of rows){const value=v[r.key]??defaults[r.key];r.input.value=value;r.value.textContent=r.key==='browRotation'?Math.round(value)+'°':Math.round(value*100)+(r.key==='browLift'?'':'%');r.input.disabled=(!beautySelectedReady().face&&!manualMode())||BEAUTY.busy||!v.browStyle||v.browStyle==='original';}
  manualButton.disabled=resetPosition.disabled=!source||BEAUTY.busy;manualButton.textContent='↕↔ Kéo mày lên / xuống, trái / phải';manualButton.classList.toggle('on',manualMode());manualSize.hidden=!manualMode();manualSize.querySelector('input').value=manual.span;syncPositions();
  hint.textContent='Kéo giữa vòng Mày trái / Mày phải lên, xuống hoặc sang ngang cho khớp chân mày. Hai thanh Lên / xuống giúp đặt chính xác từng bên. Chỉnh độ dày, độ dài và góc cho vừa.';
  if(manualMode())section.querySelectorAll('input[data-beauty="brow"],input[type=color],.beauty-swatch').forEach(el=>el.disabled=false);
  syncManual();window.RaySession?.refresh();
 };
 const originalMakeup=beautyMakeup;beautyMakeup=function(c,W,H){
  const settings=beautySettings(),amounts=settings.map(v=>v.brow);
  try{for(const v of settings)if(v.browStyle&&v.browStyle!=='original')v.brow=0;originalMakeup(c,W,H);}finally{settings.forEach((v,i)=>v.brow=amounts[i]);}
  if(!BEAUTY.ready.face||manualMode())return;
  const people=BEAUTY.people.length?BEAUTY.people:BEAUTY.faces.map(face=>({face,values:BEAUTY.values}));
  kit.render(c,W,H,people,(w,h)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;return cv;});
 };
 const originalApply=beautyApply;beautyApply=function(c,W,H){originalApply(c,W,H);if(!manualMode()||BEAUTY.peek||BEAUTY.source!==source)return;kit.render(c,W,H,[{face:manualFace(W,H),values:BEAUTY.values}],(w,h)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;return cv;});};
 const categories=document.createElement('nav');categories.className='beauty-categories';categories.setAttribute('aria-label','Mục trang điểm');
 const sections=[['skin','Da'],['hair','Tóc'],['lip','Môi'],['blush','Má hồng'],['brow','Mày']];
 let selected='skin';
 function choose(key){selected=key;for(const [id]of sections)document.getElementById('beauty'+id[0].toUpperCase()+id.slice(1)).hidden=id!==key;document.getElementById('beautySmooth').hidden=key!=='skin';categories.querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.category===key);b.setAttribute('aria-pressed',String(b.dataset.category===key));});syncManual();window.RayBeautyRuntime?.onCategory(key);}
 for(const [key,label]of sections){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.category=key;b.onclick=()=>{choose(key);categories.parentElement.closest('.scroll').scrollTop=0;};categories.append(b);}
 document.getElementById('beautySkin').before(categories);choose(selected);beautyUI();
 new ResizeObserver(syncManual).observe(document.getElementById('canvasWrap'));new MutationObserver(syncManual).observe(document.body,{attributes:true,attributeFilter:['data-editor-tool']});
 window.RayBrows={capture:()=>({...JSON.parse(JSON.stringify(manual)),face:manual.enabled&&source?manualFace(source.width,source.height):null,category:selected}),restore(value){if(value)Object.assign(manual,JSON.parse(JSON.stringify(value)));else{manual.enabled=false;manual.face=null;manual.span=.09;manual.points=[{x:.44,y:.34},{x:.56,y:.34}];}choose(value?.category||'skin');syncManual();}};
})();
