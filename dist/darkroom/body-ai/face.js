
/* RAY PHOTO v54+ -- FACE REFERENCE ADD-ON ONLY.
   Reuses MediaPipe FaceLandmarker output already stored in BEAUTY.people.
   Phi-inspired reference and face-shape archetypes are OPTIONAL 2D examples,
   never a verified beauty standard or true physical measurements.
   All retouch updates are stored in BODY_FINE.strokes, already part of app snapshots,
   undo/redo/drafts, and applied in bodyWarp before unchanged color renderer.
*/
(()=>{'use strict';
 const $=id=>document.getElementById(id),c=(x,a,b)=>Math.max(a,Math.min(b,x));
 const body=$('bodyBox'),wrap=$('canvasWrap'),view=$('view');if(!body||!wrap||!view)return;
 const panel=document.createElement('section');panel.id='rayFace55';
 panel.innerHTML=`<header><h3>✧ Chỉnh mặt theo tỷ lệ</h3><span class="r55-tag">AI · từ v67</span></header>
 <p class="r55-desc">1. Quét AI → 2. Chọn mẫu → 3. Bấm <b>Áp dáng mặt ngay</b>. Kết quả là ảnh thực, không phải nét vẽ. Nếu muốn điều chỉnh thêm, kéo thanh ngay bên dưới. Giữ nguyên các công cụ v48.</p>
 <div class="r55-actions"><button type="button" id="r55Scan" class="r55-primary">✧ AI quét &amp; đo khuôn mặt</button><button type="button" id="r55Guide">Ẩn mặt nạ</button></div>
 <div class="r55-field"><label for="r55Person">Người trong ảnh</label><select id="r55Person"><option value="0">Người 1</option></select></div>
 <div class="r55-field"><label for="r55Template">Khuôn mẫu</label><select id="r55Template"><option value="phi">Tỷ lệ vàng φ · tham khảo</option><option value="diamond">Mặt kim cương</option><option value="oval">Mặt oval</option><option value="vline">Mặt V-line</option><option value="natural">Giữ tỷ lệ hiện tại</option></select></div>
 <div class="r55-rows" id="r55Metrics"><div class="r55-head">Phép đo</div><div class="r55-head r55-num">Hiện tại</div><div class="r55-head r55-num">Mẫu</div><div>Chưa quét AI</div><div class="r55-num">—</div><div class="r55-num">—</div></div>
 <div class="r55-result" id="r55Status" role="status" aria-live="polite">Bấm “AI quét &amp; đo khuôn mặt”. Các công cụ chỉnh dáng v48 vẫn dùng bình thường.</div>
 <div class="r55-field"><label for="r55Intensity">Mức chỉnh nhẹ</label><div style="display:flex;align-items:center;gap:8px"><input type="range" id="r55Intensity" min="0" max="100" step="5" value="75"><output id="r55IntensityLabel">75%</output></div></div>
 <p class="r55-small" id="r55LiveHint"><b>75%</b> là lực áp dụng khuôn mẫu, không phải số đo cơ thể hay mức bóp cố định 5%. Kéo thanh để nhìn ảnh đổi ngay. Sau khi áp dụng, ảnh sẽ không có đường vàng hay nét đứt.</p>
 <div class="r55-actions"><button type="button" class="r55-primary" id="r55Apply" disabled>✓ Áp dáng mặt ngay</button><button type="button" id="r55Reset">Gỡ chỉnh khuôn mẫu</button></div>
 <p class="r55-small"><b>Chỉnh từng phần — kéo trực tiếp, xem ngay</b>. 0 = nguyên bản; âm = thu nhỏ/gọn; dương = phóng to/đầy hơn. Chỉ áp dụng sau khi đã nhận diện mặt.</p>
 <div id="r60FineControls" class="r60-fine-controls">
  <label for="r60Size">Mặt · To / nhỏ <output id="r60SizeValue">0%</output></label><input id="r60Size" type="range" min="-40" max="40" step="1" value="0"/>
  <label for="r60Width">Mặt · Ngang bè / thon <output id="r60WidthValue">0%</output></label><input id="r60Width" type="range" min="-40" max="40" step="1" value="0"/>
  <label for="r60Jaw">Hàm / cằm · Rộng / gọn <output id="r60JawValue">0%</output></label><input id="r60Jaw" type="range" min="-40" max="40" step="1" value="0"/>
  <label for="r60Eyes">Mắt · To / nhỏ <output id="r60EyesValue">0%</output></label><input id="r60Eyes" type="range" min="-40" max="40" step="1" value="0"/>
  <label for="r60Nose">Mũi · Rộng / gọn <output id="r60NoseValue">0%</output></label><input id="r60Nose" type="range" min="-40" max="40" step="1" value="0"/>
  <label for="r60Mouth">Môi · Rộng / hẹp <output id="r60MouthValue">0%</output></label><input id="r60Mouth" type="range" min="-40" max="40" step="1" value="0"/>
 </div>
 <div class="r55-actions"><button type="button" id="r60CommitFine" class="r55-primary" disabled>✓ Giữ chỉnh từng phần</button><button type="button" id="r60ClearFine">Đưa các thanh về 0</button></div>
 <p class="r55-small" id="r60Feedback" role="status">Sau khi AI nhận diện, kéo thử Mặt ngang −20% để kiểm tra ảnh đổi trực tiếp.</p>
 <p class="r55-small">Mốc vàng và nét đứt chỉ là đường hướng dẫn khi bấm <b>Hiện mặt nạ</b>. Khi bấm <b>Áp dáng mặt ngay</b>, mặt nạ khuôn mặt sẽ tự ẩn để xem ảnh thật; riêng vòng/chỉ dẫn chỉnh dáng v48 vẫn giữ nguyên để tiếp tục tinh chỉnh. Khuôn mẫu là tham chiếu hình học, không phải tiêu chuẩn vẻ đẹp. Mặt nghiêng chỉ áp nắn viền ngoài, không ép đối xứng mắt/mũi. Có Hoàn tác.</p>`;
 body.insertBefore(panel,body.firstElementChild);
 // Reposition the REAL v54 component selector and sliders immediately under the ratio block.
 // Their original listeners and bodyWarp engine remain unchanged.
 const selectBody=document.getElementById('bodyParts'),bodyControls=document.getElementById('bodyCtl');
 const ratioBlock=document.getElementById('rayRatio54');
 if(selectBody&&bodyControls&&ratioBlock){
  ratioBlock.insertAdjacentElement('afterend',selectBody);
  selectBody.insertAdjacentElement('afterend',bodyControls);
  selectBody.setAttribute('aria-label','Chọn bộ phận để nắn trực tiếp bằng thanh v54');
 }
 const overlay=document.createElement('canvas');overlay.id='r55Mask';overlay.setAttribute('aria-hidden','true');wrap.appendChild(overlay);overlay.style.display='none';
 const state={visible:false,scanning:false,src:null,faces:0,faceId:0,live:false,previewEdits:null};
 document.getElementById('r55Guide').textContent='Hiện mặt nạ';
 // Two-layer editing model: guides are DOM overlays, never image pixels.
 // After committing or exporting a photograph, hide guide canvases until user explicitly requests them.
 function hideGuides(reason='save'){
  state.visible=false;
  overlay.style.display='none';
  const context=overlay.getContext('2d');
  if(context)context.clearRect(0,0,overlay.width,overlay.height);
  document.body.classList.add('ray54-guide-clean');
  if(['face','chin'].includes(BODY.sel)&&reason!=='manual'){BODY.hide=true;bodyUI();syncBody();}
  q('Guide').textContent='Hiện mặt nạ';
  if(reason==='save'&&q('Status'))q('Status').dataset.guidesHidden='true';
  // Only hide face guides here. Body / shape guides from v54 remain available for manual refinement.
  queue();
 }
 function showGuides(){
  if(document.querySelector('.film-workspace.is-result-preview')){hideGuides('result');return;}
  state.visible=true;overlay.style.display='';
  document.body.classList.remove('ray54-guide-clean');
  q('Guide').textContent='Ẩn mặt nạ';schedule();queue();
 }
 const templates={
  phi:{name:'Tỷ lệ vàng φ (tham khảo)',aspect:1.618,eyeGap:1.0,noseMouth:1/1.618,mouthFace:.43,jawCheek:.76,foreheadCheek:.90},
  diamond:{name:'Mặt kim cương',aspect:1.54,eyeGap:1.0,noseMouth:.66,mouthFace:.43,jawCheek:.69,foreheadCheek:.83},
  oval:{name:'Mặt oval',aspect:1.52,eyeGap:1.0,noseMouth:.66,mouthFace:.43,jawCheek:.84,foreheadCheek:.94},
  vline:{name:'Mặt V-line',aspect:1.60,eyeGap:1.0,noseMouth:.65,mouthFace:.43,jawCheek:.64,foreheadCheek:.91}
 };
 const map=[['aspect','Dài mặt / rộng gò má'],['eyeGap','Khoảng mắt / rộng mắt'],['noseMouth','Rộng mũi / rộng môi'],['mouthFace','Rộng môi / rộng mặt'],['jawCheek','Rộng hàm / gò má'],['foreheadCheek','Trán / gò má']];
 const q=i=>$('r55'+i),fmt=x=>Number.isFinite(x)?x.toFixed(3):'—';
 const getPeople=()=>BEAUTY.people?.filter(p=>Array.isArray(p.face)&&p.face.length>400)||[];
 const selected=()=>getPeople()[Number(q('Person').value)||0]||null;
 const owner=()=>String(selected()?.id??q('Person').value??'0');
 const own=s=>s.part==='ray55-template'&&String(s.personId??'0')===owner();
 const keepOthers=()=>BODY_FINE.strokes.filter(s=>!own(s));
 const armPreview=()=>{state.live=true;state.previewSource=source;state.previewParts=BODY.parts;};
 function cancelPreview(){state.live=false;state.previewEdits=null;queue();}
 const validPreview=()=>state.previewSource===source&&state.previewParts===BODY.parts;
 const p=(f,i)=>f?.[i]&&Number.isFinite(f[i].x)&&Number.isFinite(f[i].y)?f[i]:null;
 const dst=(a,b)=>Math.hypot((a.x-b.x)*source.width,(a.y-b.y)*source.height);
 const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
 function geom(){if(!source||BEAUTY.source!==source)return null;const face=selected()?.face;if(!face)return null;
  const need=[10,152,234,454,127,356,172,397,33,133,362,263,98,327,61,291,1];
  if(need.some(i=>!p(face,i)))return null;
  const get=i=>face[i],head=mid(get(234),get(454)),eyeL=mid(get(33),get(133)),eyeR=mid(get(362),get(263)),nose=mid(get(98),get(327)),mouth=mid(get(61),get(291));
  const fw=dst(get(234),get(454)),height=dst(get(10),get(152)),ew=(dst(get(33),get(133))+dst(get(362),get(263)))/2;
  const gap=dst(get(133),get(362)),nw=dst(get(98),get(327)),mw=dst(get(61),get(291)),jw=dst(get(172),get(397)),fore=dst(get(127),get(356));
  if(fw<12||height<12||ew<4||mw<3||nw<2)return null;
  const values={aspect:height/fw,eyeGap:gap/ew,noseMouth:nw/mw,mouthFace:mw/fw,jawCheek:jw/fw,foreheadCheek:fore/fw};
  const eyeMid=mid(eyeL,eyeR),leftNose=dst(get(1),eyeL),rightNose=dst(get(1),eyeR),yaw=Math.abs(leftNose-rightNose)/Math.max(1,leftNose+rightNose);
  const eyes=Math.max(dst(eyeL,eyeR),1),roll=Math.atan2((eyeR.y-eyeL.y)*source.height,(eyeR.x-eyeL.x)*source.width);
  // An image has only 2D projection. Detect strong nose asymmetry, not a calibrated yaw angle.
  const oblique=yaw>.23,tooOblique=yaw>.68;
  return {face,head,eyeL,eyeR,eyeMid,nose,mouth,chin:get(152),faceTop:get(10),cheekL:get(234),cheekR:get(454),jawL:get(172),jawR:get(397),fw,height,ew,roll,eyes,values,yaw,oblique,tooOblique};
 }
 function choose(){const v=q('Template').value;return v==='natural'?null:templates[v];}
 function score(g,t){if(!g||!t||g.oblique)return null;
  const weights={aspect:2,eyeGap:.7,noseMouth:.9,mouthFace:.8,jawCheek:1.25,foreheadCheek:.65};let sum=0,n=0;
  for(const [k,w] of Object.entries(weights)){const a=g.values[k],b=t[k];if(!(a>0&&b>0))continue;sum+=w*Math.abs(Math.log(a/b));n+=w;}
  return n?Math.round(c((1-sum/n/.55)*100,0,100)):null;
 }
 function syncPeople(){const current=q('Person').value||'0',people=getPeople();q('Person').replaceChildren();
  if(!people.length){const opt=document.createElement('option');opt.value='0';opt.textContent='Chưa có mặt';q('Person').append(opt);return;}
  people.forEach((_,i)=>{const opt=document.createElement('option');opt.value=String(i);opt.textContent='Người '+(i+1);q('Person').append(opt);});q('Person').value=String(c(Number(current)||0,0,people.length-1));
 }
 let raf=0;function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;paint();});}
 function update(msg){if(!source){q('Status').textContent='Mở ảnh trước khi quét AI.';q('Apply').disabled=true;schedule();return;}
  const g=geom(),t=choose(),rows=q('Metrics');rows.replaceChildren();
  const cell=(txt,klass)=>{let el=document.createElement('div');el.textContent=txt;if(klass)el.className=klass;rows.appendChild(el);};
  ['Phép đo','Hiện tại','Mẫu'].forEach((x,i)=>cell(x,'r55-head'+(i?' r55-num':'')));
  for(const [key,title] of map){cell(title);cell(g?fmt(g.values[key]):'—','r55-num');cell(t?fmt(t[key]):'Gốc','r55-num');}
  q('Apply').disabled=!g||!t||g.tooOblique||state.scanning||Number(q('Intensity').value)===0;
  const fineButton=$('r60CommitFine');if(fineButton)fineButton.disabled=!g||g.tooOblique;
  q('IntensityLabel').textContent=q('Intensity').value+'%';
  if(state.live){state.previewEdits=g&&!g.tooOblique?plannedEdits(g,t):[];scheduleLiveFace();}
  if(msg){q('Status').textContent=msg;}else if(!g){q('Status').textContent='Chưa có mốc mặt. Chọn mẫu rồi bấm Quét và áp mẫu mặt.';}
  else {const s=score(g,t);q('Status').textContent='Đã nhận diện mặt · '+(g.tooOblique?'Góc nghiêng quá lớn, không đủ mốc tin cậy để áp tự động.':g.oblique?'Mặt nghiêng 3/4: chỉ chỉnh rất nhẹ viền má, hàm và cằm đang thấy; không chỉnh mắt, mũi, môi. Không chấm điểm φ từ ảnh nghiêng.':'Mức khớp khuôn mẫu: '+(t?(s+' / 100'):'giữ nguyên')+' (chỉ so hình học 2D).')+'\nMốc: mắt, mũi, môi, cằm. Đây là tỷ lệ của ảnh gốc trước chỉnh; không phải số đo cơ thể thật.';}
  schedule();
 }
 function imageRect(){const a=wrap.getBoundingClientRect(),b=view.getBoundingClientRect(),bw=LASTG?.bw||0,bb=LASTG?.bb||0,W=LASTG?.W||source?.width||1,H=LASTG?.H||source?.height||1;
  const tw=W+2*bw,th=H+bw+bb;return {x:b.left-a.left,y:b.top-a.top,w:b.width,h:b.height,toX:u=>(bw+u*W)/tw*b.width,toY:v=>(bw+v*H)/th*b.height};}
 function paint(){const rect=imageRect(),scale=Math.min(2,window.devicePixelRatio||1);overlay.style.left=rect.x+'px';overlay.style.top=rect.y+'px';overlay.style.width=rect.w+'px';overlay.style.height=rect.h+'px';
  const ww=Math.max(1,Math.round(rect.w*scale)),hh=Math.max(1,Math.round(rect.h*scale));if(overlay.width!==ww)overlay.width=ww;if(overlay.height!==hh)overlay.height=hh;
  const ctx=overlay.getContext('2d');ctx.clearRect(0,0,ww,hh);const g=geom();if(!state.visible||!g||!rect.w||document.querySelector('.film-workspace.is-result-preview')||!['body','all'].includes(document.body.dataset.editorTool))return;
  ctx.setTransform(scale,0,0,scale,0,0);const X=x=>rect.toX(x),Y=y=>rect.toY(y);
  const dot=(a,r=2.7)=>{ctx.beginPath();ctx.arc(X(a.x),Y(a.y),r,0,Math.PI*2);ctx.fill();};
  const path=(ids,color,dash=[])=>{ctx.beginPath();let began=false;for(const i of ids){const a=p(g.face,i);if(!a)continue;if(!began)ctx.moveTo(X(a.x),Y(a.y)),began=true;else ctx.lineTo(X(a.x),Y(a.y));}ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);};
  const oval=[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109,10];
  path(oval,'rgba(233,184,89,.85)');path([33,160,158,133,153,144,33],'rgba(233,184,89,.87)');path([362,385,387,263,373,380,362],'rgba(233,184,89,.87)');
  path([98,1,327],'rgba(233,184,89,.87)');path([61,40,0,270,291,321,17,91,61],'rgba(233,184,89,.87)');
  ctx.fillStyle='rgba(241,192,99,.9)';[g.eyeL,g.eyeR,g.nose,g.mouth,g.chin].forEach(a=>dot(a));
  const t=choose();if(!t)return;ctx.strokeStyle='rgba(253,247,222,.95)';ctx.fillStyle='rgba(253,247,222,.8)';ctx.setLineDash([5,4]);ctx.lineWidth=1.6;
  const ellipse=(center,rx,ry,angle=0)=>{ctx.beginPath();ctx.ellipse(X(center.x),Y(center.y),Math.max(2,rx),Math.max(2,ry),angle,0,Math.PI*2);ctx.stroke();};
  const px=rect.w/Math.max(1,source.width),py=rect.h/Math.max(1,source.height),facePixels=g.fw*px,faceHeight=g.height*py;
  const targetFaceWidth=g.height/t.aspect;ellipse(g.head,targetFaceWidth*px*.50,faceHeight*.50,g.roll);
  const eyeW=g.ew*px;const targetEyeW=g.eyes/t.eyeGap*px;
  ellipse(g.eyeL,Math.min(facePixels*.18,targetEyeW*.5),Math.max(3,eyeW*.20),g.roll);ellipse(g.eyeR,Math.min(facePixels*.18,targetEyeW*.5),Math.max(3,eyeW*.20),g.roll);
  const mouthW=t.mouthFace*targetFaceWidth*px;ellipse(g.mouth,mouthW*.5,Math.max(3,faceHeight*.048),g.roll);
  ellipse(g.nose,Math.min(facePixels*.26,mouthW*t.noseMouth*.5),Math.max(3,faceHeight*.085),g.roll);
  ellipse(g.chin,t.jawCheek*targetFaceWidth*px*.36,Math.max(3,faceHeight*.16),g.roll);
  ctx.setLineDash([]);
 }
 function faceEdits(g,t,intensity){if(!g||!t||g.tooOblique)return [];
  if(g.oblique){
   // Angled portraits: emphasise visible outer contour so the user can actually see a change.
   // Avoid frontal-feature matching here; only visible cheek / jaw / chin / temple are adjusted.
   const sign=g.nose.x>=g.eyeMid.x?1:-1;
   const cheek=sign>0?g.cheekR:g.cheekL, jaw=sign>0?g.jawR:g.jawL, temple=sign>0?mid(g.faceTop,g.cheekR):mid(g.faceTop,g.cheekL);
   const farCheek=sign>0?g.cheekL:g.cheekR, farJaw=sign>0?g.jawL:g.jawR;
   const options={phi:[-.034,-.044,.010,-.018],diamond:[.016,-.072,.018,.022],oval:[-.024,-.042,.012,-.010],vline:[-.028,-.082,.024,-.020]};
   const [templeShift,jawShift,chinShift,cheekShift]=options[q('Template').value]||[0,0,0,0];
   const warp=(pt,rx,ry,sx,sy=0)=>({part:'ray55-template',mode:'local-scale',points:[],cx:pt.x,cy:pt.y,rx,ry,sx,sy});
   const fx=g.fw/source.width,fy=g.height/source.height;
   const clampSide=v=>c(v*intensity,-.085,.085);
   const edits=[];
   if(Math.abs(templeShift)>.0018)edits.push(warp(temple,Math.max(.012,fx*.17),Math.max(.018,fy*.18),clampSide(templeShift)));
   if(Math.abs(cheekShift)>.0018)edits.push(warp(cheek,Math.max(.012,fx*.16),Math.max(.018,fy*.22),clampSide(cheekShift)));
   if(Math.abs(jawShift)>.0018)edits.push(warp(jaw,Math.max(.014,fx*.24),Math.max(.018,fy*.22),clampSide(jawShift)));
   if(Math.abs(chinShift)>.0018)edits.push(warp({x:g.chin.x,y:g.chin.y-fy*.06},Math.max(.014,fx*.24),Math.max(.018,fy*.22),0,c(chinShift*intensity,-.04,.04)));
   if(Math.abs(jawShift)>.0022)edits.push(warp(farJaw,Math.max(.010,fx*.16),Math.max(.015,fy*.18),c(-jawShift*intensity*.18,-.018,.018)));
   if(Math.abs(cheekShift)>.0022)edits.push(warp(farCheek,Math.max(.010,fx*.12),Math.max(.014,fy*.16),c(-cheekShift*intensity*.15,-.015,.015)));
   return edits;
  }
  const rect=(point,rx,ry,sx=0,sy=0)=>({part:'ray55-template',mode:'local-scale',points:[],cx:point.x,cy:point.y,rx,ry,sx,sy});
  const add=(list,point,rx,ry,sx=0,sy=0,min=.0008)=>{if(!point)return;if(Math.abs(sx)<min&&Math.abs(sy)<min)return;list.push(rect(point,rx,ry,sx,sy));};
  const widen=(target,current,cap)=>c((target/Math.max(current,1e-5)-1)*intensity,-cap,cap);
  const slimByAspect=(current,target,cap)=>c((current/Math.max(target,1e-5)-1)*intensity,-cap,cap);
  const stretchByAspect=(target,current,cap)=>c((target/Math.max(current,1e-5)-1)*intensity*.52,-cap,cap);
  const fpx=g.fw/source.width,fpy=g.height/source.height;
  const faceWidthSX=slimByAspect(g.values.aspect,t.aspect,.24);
  const faceHeightSY=stretchByAspect(t.aspect,g.values.aspect,.12);
  const templeSX=widen(t.foreheadCheek,g.values.foreheadCheek,.18);
  const jawSX=widen(t.jawCheek,g.values.jawCheek,.24);
  const mouthSX=widen(t.mouthFace,g.values.mouthFace,.16);
  const noseSX=widen(t.noseMouth,g.values.noseMouth,.13);
  const eyeSX=widen(t.eyeGap,g.values.eyeGap,.09);
  const result=[];
  const templeL=mid(g.faceTop,g.cheekL),templeR=mid(g.faceTop,g.cheekR);
  const jawLC=mid(g.jawL,g.chin),jawRC=mid(g.jawR,g.chin);
  const cheekMidL=mid(g.cheekL,g.jawL),cheekMidR=mid(g.cheekR,g.jawR);
  const chinLift={x:g.chin.x,y:g.chin.y-fpy*.075};
  add(result,g.head,fpx*.58,fpy*.60,faceWidthSX,faceHeightSY);
  add(result,templeL,fpx*.18,fpy*.20,templeSX,0);
  add(result,templeR,fpx*.18,fpy*.20,templeSX,0);
  add(result,g.cheekL,fpx*.16,fpy*.18,faceWidthSX*.82,0);
  add(result,g.cheekR,fpx*.16,fpy*.18,faceWidthSX*.82,0);
  add(result,cheekMidL,fpx*.15,fpy*.17,jawSX*.45,0);
  add(result,cheekMidR,fpx*.15,fpy*.17,jawSX*.45,0);
  add(result,jawLC,fpx*.19,fpy*.19,jawSX,0);
  add(result,jawRC,fpx*.19,fpy*.19,jawSX,0);
  add(result,chinLift,fpx*.33,fpy*.24,jawSX*.86,faceHeightSY*.72);
  const eyeRad=Math.max(.009,g.ew/source.width*.75);
  add(result,g.eyeL,eyeRad*1.24,eyeRad*source.width/source.height*.80,eyeSX*.72,0);
  add(result,g.eyeR,eyeRad*1.24,eyeRad*source.width/source.height*.80,eyeSX*.72,0);
  add(result,g.nose,Math.max(.011,g.fw/source.width*.19),Math.max(.013,g.height/source.height*.14),noseSX,0);
  add(result,g.mouth,Math.max(.013,g.fw/source.width*.36),Math.max(.011,g.height/source.height*.13),mouthSX,0);
  if(typeof bodyPart==='function'){
   const neck=bodyPart('neck');
   if(getPeople().length===1&&neck?.place==='ai'&&Number.isFinite(neck.cx)&&Number.isFinite(neck.cy)){
    add(result,{x:neck.cx,y:neck.cy},Math.max(.030,neck.rx*.98),Math.max(.038,neck.ry*1.08),faceWidthSX*.38+jawSX*.18,faceHeightSY*.28);
   }
  }
  return result;
 }

 // v60: explicit region controls run through SAME local pixel deformation as presets.
 // No segmentation or color renderer changes; preview is never committed until Apply/Save.
 const fineIds=['Size','Width','Jaw','Eyes','Nose','Mouth'];
 const fineValue=id=>Number($('r60'+id)?.value||0);
 const fineActive=()=>fineIds.some(id=>fineValue(id)!==0);
 function fineEdits(g){
  if(!g||g.tooOblique)return [];
  const fx=g.fw/source.width,fy=g.height/source.height;
  const control=(point,rx,ry,sx=0,sy=0)=>({part:'ray55-template',mode:'local-scale',points:[],cx:point.x,cy:point.y,rx,ry,sx,sy});
  const result=[];
  const add=(point,rx,ry,sx,sy)=>{if(point&&(Math.abs(sx)>.0001||Math.abs(sy)>.0001))result.push(control(point,rx,ry,sx,sy));};
  const size=fineValue('Size')/100,width=fineValue('Width')/100,jaw=fineValue('Jaw')/100;
  const eyes=fineValue('Eyes')/100,nose=fineValue('Nose')/100,mouth=fineValue('Mouth')/100;
  // Normalized strengths deliberately bounded to avoid extreme face damage.
  add(g.head,fx*.62,fy*.59,c(size*.46+width*.66,-.30,.30),c(size*.44,-.20,.20));
  const jawL=mid(g.jawL,g.chin),jawR=mid(g.jawR,g.chin);
  add(jawL,fx*.24,fy*.24,c(jaw*.67,-.26,.26),0);
  add(jawR,fx*.24,fy*.24,c(jaw*.67,-.26,.26),0);
  add(g.chin,fx*.30,fy*.19,c(jaw*.40,-.16,.16),0);
  if(!g.oblique){
   for(const eye of [g.eyeL,g.eyeR])add(eye,fx*.13,fy*.13,c(eyes*.55,-.20,.20),c(eyes*.55,-.20,.20));
   add(g.nose,fx*.17,fy*.15,c(nose*.62,-.25,.25),0);
   add(g.mouth,fx*.26,fy*.14,c(mouth*.62,-.25,.25),0);
  }
  return result;
 }
 function plannedEdits(g,t){return [...(t?faceEdits(g,t,Number(q('Intensity').value)/100):[]),...fineEdits(g)];}
 function updateFineLabels(){for(const id of fineIds){const el=$('r60'+id+'Value');if(el){const v=fineValue(id);el.textContent=(v>0?'+':'')+v+'%';}}}
 function clearFineUI(){for(const id of fineIds){const e=$('r60'+id);if(e)e.value='0';}updateFineLabels();}
 function restoreForm(){const form=BODY_FINE.strokes.find(own)?.form;clearFineUI();q('Template').value=form?.template||'phi';q('Intensity').value=form?.intensity??'75';for(const id of fineIds){if(form?.fine&&Number.isFinite(form.fine[id]))$('r60'+id).value=String(form.fine[id]);}updateFineLabels();}
 function applyFine(){
  const g=geom();if(!g||g.tooOblique){$('r60Feedback').textContent='Cần AI nhận diện mặt đủ rõ; ảnh nghiêng quá lớn chưa hỗ trợ.';return;}
  const strokes=plannedEdits(g,choose());
  if(!strokes.length){$('r60Feedback').textContent='Chưa có thay đổi. Hãy kéo một thanh ra khỏi 0.';return;}
  replace(strokes,'Chỉnh từng phần khuôn mặt');hideGuides('apply');queue();
  $('r60Feedback').textContent='Đã giữ '+strokes.length+' vùng biến dạng trên ảnh. Có thể so trước/sau bằng Hoàn tác.';
 }
 for(const id of fineIds){
  const input=$('r60'+id);if(!input)continue;
  input.addEventListener('input',()=>{updateFineLabels();armPreview();hideGuides('fine');update();queue();$('r60Feedback').textContent='Đang chỉnh '+input.previousElementSibling?.textContent.split('  ')[0]+' trực tiếp trên ảnh';});
  input.addEventListener('dblclick',()=>{input.value='0';input.dispatchEvent(new Event('input',{bubbles:true}));});
 }
 $('r60CommitFine').addEventListener('click',applyFine);
 $('r60ClearFine').addEventListener('click',()=>{clearFineUI();armPreview();hideGuides('fine');update();queue();$('r60Feedback').textContent='Đã đưa thanh về 0. Bản chỉnh đã Áp dụng trước đó vẫn còn; bấm Gỡ chỉnh khuôn mẫu để khôi phục.';});
 updateFineLabels();
 // Extra localized affine warp AFTER original brush. Only per-region pixels change; near boundary influence tends to zero.
 function applyLocal(cxt,W,H,s){const cx=s.cx*W,cy=s.cy*H,rx=Math.max(3,s.rx*W),ry=Math.max(3,s.ry*H);
  const x0=Math.max(0,Math.floor(cx-rx-2)),y0=Math.max(0,Math.floor(cy-ry-2)),x1=Math.min(W,Math.ceil(cx+rx+2)),y1=Math.min(H,Math.ceil(cy+ry+2));if(x1<=x0||y1<=y0)return;
  const pad=Math.ceil(Math.max(rx*Math.abs(s.sx),ry*Math.abs(s.sy)))+4;
  const sx0=Math.max(0,x0-pad),sy0=Math.max(0,y0-pad),sx1=Math.min(W,x1+pad),sy1=Math.min(H,y1+pad);
  const bw=sx1-sx0,bh=sy1-sy0,S=cxt.getImageData(sx0,sy0,bw,bh).data;
  const iw=x1-x0,ih=y1-y0,output=cxt.createImageData(iw,ih),D=output.data;
  for(let j=0;j<ih;j++)for(let i=0;i<iw;i++){
   const xp=x0+i+.5,yp=y0+j+.5,dx=xp-cx,dy=yp-cy,r2=(dx/rx)**2+(dy/ry)**2;
   let u=xp-.5-sx0,v=yp-.5-sy0;
   if(r2<1){const k=1-r2,f=k*k*(3-2*k);u=(cx+dx/(1+s.sx*f))-.5-sx0;v=(cy+dy/(1+s.sy*f))-.5-sy0;}
   u=c(u,0,bw-1);v=c(v,0,bh-1);const x=Math.floor(u),y=Math.floor(v),xx=Math.min(bw-1,x+1),yy=Math.min(bh-1,y+1),fx=u-x,fy=v-y;
   const a=(y*bw+x)*4,b=(y*bw+xx)*4,d=(yy*bw+x)*4,e=(yy*bw+xx)*4,o=(j*iw+i)*4;
   for(let ch=0;ch<4;ch++)D[o+ch]=S[a+ch]*(1-fx)*(1-fy)+S[b+ch]*fx*(1-fy)+S[d+ch]*(1-fx)*fy+S[e+ch]*fx*fy;
  }
  cxt.putImageData(output,x0,y0);
 }
 const original=rayFineWarp;
 rayFineWarp=function(cxt,W,H){
  original(cxt,W,H);
  if(state.live&&!validPreview())cancelPreview();
  const useLive=!!window.RayLivePreviewMode&&state.live&&state.previewEdits!==null&&document.body.dataset.editorTool==='body';
  for(const s of (useLive?[...keepOthers(),...state.previewEdits]:BODY_FINE.strokes))if(s.part==='ray55-template'&&s.mode==='local-scale')applyLocal(cxt,W,H,s);
 };
 let liveFaceTimer=0;
 function scheduleLiveFace(){clearTimeout(liveFaceTimer);liveFaceTimer=setTimeout(()=>{
   if(source&&document.body.dataset.editorTool==='body')queue();
 },70);}
 function changeFaceLive(){
   armPreview();
   hideGuides('preview');  // NO golden guides over the visual result while sliding
   update('Kéo để xem mức thay đổi. Bấm Áp dụng dưới ảnh để giữ kết quả.');
   queue();
  }
 function acceptFaceLive(){if(!state.live)return;if(!validPreview()){cancelPreview();return;}
  const g=geom(),t=choose();if(g&&!g.tooOblique){
    const strokes=plannedEdits(g,t);
     replace(strokes,'Chỉnh mặt theo khuôn mẫu '+(t?t.name:'thủ công'));
  }
  state.live=false;state.previewEdits=null;
 }

 function replace(strokes,label){state.live=false;state.previewEdits=null;const old=BODY_FINE.strokes.filter(own);const prev=keepOthers();
  if(!old.length&&!strokes.length)return;
  window.RaySession?.record('Trước '+label);
  BODY_FINE.strokes=prev.concat(strokes.map((s,i)=>({...s,personId:owner(),...(i===0?{form:{template:q('Template').value,intensity:q('Intensity').value,fine:Object.fromEntries(fineIds.map(id=>[id,fineValue(id)]))}}:{})})));
  queue();
  window.RaySession?.record(label);
  window.RaySession?.refresh();
 }
 function apply(){const g=geom(),t=choose();if(!g||!t){state.live=false;state.previewEdits=null;update('Chưa có mốc mặt hoặc chưa chọn khuôn mẫu.');return;}if(g.tooOblique){update('Mặt nghiêng quá lớn: chưa áp tự động để tránh méo viền.');return;}
  if(getPeople().length>1){const other=getPeople().some(x=>x!==selected()&&x.face?.[1]&&Math.hypot((x.face[1].x-g.head.x)*source.width,(x.face[1].y-g.head.y)*source.height)<g.fw*.9);
   if(other){update('Hai khuôn mặt quá sát nhau; tạm không áp tự động để tránh ảnh hưởng người bên cạnh.');return;}}
  const strokes=plannedEdits(g,t);
   if(!strokes.length){hideGuides('apply');update('Gương mặt đang rất gần khuôn mẫu này, chưa có thay đổi đủ lớn để áp. Hãy chọn khuôn mẫu khác hoặc kéo thanh chỉnh từng phần ngay bên dưới.');return;}
  replace(strokes,'Mặt nạ khuôn mẫu '+t.name);
  hideGuides('apply');
  update('Đã áp '+t.name+' · '+(g.oblique?'mặt nghiêng: chỉ nắn viền má, hàm, cằm':'mặt chính diện: chỉnh viền ngoài, mắt, mũi, môi, cằm')+' ở mức '+q('Intensity').value+'%. Mốc mặt đã ẩn. Chọn Từng vùng nếu muốn tinh chỉnh thêm.');
 }
 async function scan(){if(!source){update('Mở ảnh trước khi quét AI.');return;}if(state.scanning)return;
  const image=source;state.scanning=true;q('Scan').disabled=true;update('Đang tải và chạy Face Landmarker. Lần đầu cần mạng.');
  try{if(!BEAUTY.busy&&(!getPeople().length||BEAUTY.source!==source))$('beautyScan').click();
   for(let i=0;i<180;i++){if(source!==image)throw new Error('Ảnh đã thay đổi; hãy quét ảnh đang mở');if(!BEAUTY.busy&&(getPeople().length||i>3))break;await new Promise(r=>setTimeout(r,350));}
   syncPeople();if(getPeople().length){showGuides();update('AI trả về '+getPeople().length+' gương mặt. Đã đo các mốc mắt, mũi, môi và cằm.');}else update(document.getElementById('beautyStatus')?.textContent||'AI chưa nhận diện được mốc mặt. Thử ảnh chính diện rõ hơn.');
  }catch(e){update('Không chạy được AI: '+String(e.message||e));}
  finally{state.scanning=false;q('Scan').disabled=false;update(q('Status').textContent);}
 }
 // Common session Apply / Save must hide ALL guides (not only the face Apply button).
 document.querySelector('.session-apply')?.addEventListener('click',()=>{acceptFaceLive();hideGuides('apply');},true);
 document.querySelector('.session-resume')?.addEventListener('click',()=>hideGuides('result'),true);
 const session=window.RaySession;
 if(session?.showResult){const prev=session.showResult.bind(session);
  session.showResult=(on,...args)=>{if(on)hideGuides('result');return prev(on,...args);};}
 const workspace=document.querySelector('.film-workspace');
 if(workspace&&window.MutationObserver){new MutationObserver(()=>{
  if(workspace.classList.contains('is-result-preview')&&state.visible)hideGuides('result');
 }).observe(workspace,{attributes:true,attributeFilter:['class']});}
 q('Scan').onclick=scan;q('Template').onchange=changeFaceLive;q('Person').onchange=()=>{state.live=false;state.previewEdits=null;restoreForm();update();queue();};q('Intensity').oninput=changeFaceLive;
 q('Guide').onclick=()=>{if(state.visible)hideGuides('manual');else showGuides();};
 $('save')?.addEventListener('click',()=>{acceptFaceLive();hideGuides('save');},true);
 // Also guard exports triggered from the host or API rather than the visible save button.
 if(window.RayQualityExport?.exportFile){const exportOriginal=window.RayQualityExport.exportFile;window.RayQualityExport.exportFile=(...args)=>{window.RayRatioLive?.accept();acceptFaceLive();hideGuides('save');return exportOriginal(...args);};}
 if(window.BuongToiApp?.exportFile){const exportOriginal=window.BuongToiApp.exportFile;window.BuongToiApp.exportFile=(...args)=>{window.RayRatioLive?.accept();acceptFaceLive();hideGuides('save');return exportOriginal(...args);};}
  q('Apply').onclick=apply;q('Reset').onclick=()=>{state.live=false;state.previewEdits=null;replace([],'Gỡ mặt nạ');hideGuides('reset');queue();update('Đã gỡ chỉnh mặt; các chỉnh sửa v48 giữ nguyên. Đường hướng dẫn đã được ẩn.');};
 window.addEventListener('resize',schedule,{passive:true});if(window.ResizeObserver)new ResizeObserver(schedule).observe(view);
 let lastSource=null,lastFaces='';setInterval(()=>{
  const faces=getPeople(),stamp=[faces.length,BEAUTY.selected,BEAUTY.source===source,source?.width,source?.height].join(':');
  if(source!==lastSource||state.formParts!==BODY.parts){lastSource=source;state.formParts=BODY.parts;state.live=false;state.previewEdits=null;restoreForm();update();}
  if(stamp!==lastFaces){lastFaces=stamp;syncPeople();update();}
 },900);
 window.RayFace55={cancelPreview,acceptPreview:acceptFaceLive,apply,geometry:geom,templates,score,update,scan,paint,faceEdits,applyLocal,hideGuides,showGuides,get guidesVisible(){return state.visible;},get previewActive(){return state.live;}};
 // Route temporary previews exclusively to the visible canvas; full exports use committed edits.
 const stableRender57=render;
 render=function(target,image){
  window.RayBodyPreview48.sync();
  const old=window.RayLivePreviewMode;window.RayLivePreviewMode=target===view;
  try{return stableRender57(target,image);}finally{window.RayLivePreviewMode=old;window.RayBodyPreview48.sync();}
 };
 update();
})();
