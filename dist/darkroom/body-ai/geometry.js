
/* RAY PHOTO v54: geometry presets ONLY. Leaves v49 legacy UI, 85+ film presets, renderer, AI libraries, draft/history and fine retouch untouched.
   Numbers are apparent 2D image ratios, not centimetres and not a universal attractiveness assessment.
   Constrained to the existing safe ellipse warp. Group edits use the selected pose mask and preserve neighboring people. */
(()=>{'use strict';
 const $=id=>document.getElementById(id),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const base=$('bodyBox'),wrap=$('canvasWrap'),view=$('view');if(!base||!wrap||!view)return;
 const panel=document.createElement('section');panel.id='rayRatio54';
 panel.innerHTML=`<p class="r54-title">◇ Tỷ lệ gương mặt &amp; cơ thể <span class="r54-chip">AI · từ v67</span></p>
 <p class="r54-note">Dùng các vòng và thanh chỉnh dáng của v48 bên dưới. Phần mới đo từ mốc AI + viền người, không suy đoán số đo thật dưới quần áo.</p>
 <div class="r54-line"><button type="button" id="r54Scan" class="r54-primary">✧ Quét AI &amp; viền</button><button type="button" id="r54Toggle">Hiện nét mẫu</button></div>
 <div class="r54-line"><label for="r54Part">Bộ phận</label><select id="r54Part">
 <optgroup label="Khuôn mặt"><option value="face">Mặt · dài/rộng</option><option value="chin">Cằm / nọng · độ rộng</option></optgroup>
 <optgroup label="Thân trên"><option value="neck">Cổ · dài/ngắn</option><option value="shL">Vai trái</option><option value="shR">Vai phải</option><option value="chest">Ngực / thân trên</option><option value="back">Lưng · đặt vùng tay</option><option value="armL">Bắp tay trái</option><option value="armR">Bắp tay phải</option><option value="foreL">Cẳng tay trái</option><option value="foreR">Cẳng tay phải</option></optgroup>
 <optgroup label="Thân giữa"><option value="waist">Eo</option><option value="belly">Bụng</option><option value="hip">Hông</option><option value="butt">Mông · đặt vùng tay</option></optgroup>
 <optgroup label="Chân"><option value="thL">Đùi trái</option><option value="thR">Đùi phải</option><option value="clL">Bắp chân trái</option><option value="clR">Bắp chân phải</option></optgroup>
 </select></div>
 <div class="r54-line"><label for="r54Preset">Khuôn mẫu</label><select id="r54Preset">
 <option value="keep">Nguyên bản</option><option value="slim">Thon/gọn nhẹ · -5% (gợi ý)</option><option value="slim10">Thon/gọn · -10%</option><option value="full">Đầy hơn · +5%</option>
 <option value="phi" data-face="1">Tỷ lệ vàng φ · tham khảo</option>
 <option value="diamond" data-face="1">Mặt kim cương · mô phỏng</option>
 <option value="oval" data-face="1">Mặt oval · mô phỏng</option>
 <option value="vline" data-face="1">Mặt V-line · mô phỏng</option>
 <option value="percent">Tùy chỉnh ±%</option><option value="target">Nhập tỷ lệ mục tiêu</option>
 </select></div>
 <div class="r54-line"><label for="r54Percent">Điều chỉnh</label><input id="r54Percent" type="range" min="-40" max="40" step="1" value="-5"/><output class="r54-value" id="r54PctText">−5%</output></div>
 <div class="r54-line"><label for="r54Target">Tỷ lệ đích</label><input type="number" id="r54Target" min="0.15" max="4" step="0.01" value="1.00"/><span class="r54-note" id="r54Metric">Chưa đo</span></div>
 <div class="r54-line"><label for="r54Strength">Áp dụng</label><input type="range" id="r54Strength" min="0" max="100" step="5" value="100"/><output class="r54-value" id="r54StrengthText">100%</output></div>
 <div id="r54Status" role="status" aria-live="polite">Mở ảnh, bấm Quét AI &amp; viền, chọn vùng để tính tỷ lệ.</div><p class="r54-note" id="r54LiveHint">Kéo thanh để xem ảnh thay đổi ngay. −5% chỉ là gợi ý; có thể chọn bất kỳ mức trong khoảng −40% đến +40%. Bấm Áp dụng vùng để giữ thay đổi.</p>
 <div class="r54-line"><button type="button" id="r54Apply" class="r54-primary">Áp dụng vùng</button><button type="button" id="r54SlimAll">Thon thân nhẹ · 1 chạm</button><button type="button" id="r54Reset">Đưa vùng về 0</button></div>
 <p class="r54-note">Vàng: viền ảnh hiện tại · ngà nét đứt: đích dự kiến (không lưu vào ảnh). Bụng/eo dưới áo rộng chỉ là đường viền trang phục. Kim cương/V-line/oval là mô phỏng hình học, không phải tiêu chuẩn đẹp bắt buộc. Giữ nút Hoàn tác của RAY.</p>`;
 const aiBox=base.querySelector('.body-ai');(aiBox||base.firstElementChild).insertAdjacentElement('afterend',panel);
 const overlay=document.createElement('canvas');overlay.id='r54Overlay';overlay.setAttribute('aria-hidden','true');wrap.appendChild(overlay);
 const state={enabled:false,scanning:false,source:null,live:false,preview:null,previewKind:'part',previewLabel:''},status=msg=>$('r54Status').textContent=msg;
 const getPart=(id=$('r54Part').value)=>bodyPart(id);
 const facePoints=()=>{if(base.dataset.bodyMode==='face')return BEAUTY.people?.[BEAUTY.selected]?.face||null;const person=BODY_AI.people[BODY_AI.selected];if(person?.rayFace)return person.rayFace;const p=person?.regions.face;if(p){const list=(BEAUTY.people||[]).filter(p=>p.face?.[1]);list.sort((a,b)=>Math.hypot((a.face[1].x-p.cx)*source.width/source.height,a.face[1].y-p.cy)-Math.hypot((b.face[1].x-p.cx)*source.width/source.height,b.face[1].y-p.cy));return list[0]?.face||null;}return BODY_AI.people.length>1?null:BEAUTY.people?.[BEAUTY.selected]?.face||null;};
 const pt=(face,i)=>face?.[i]&&Number.isFinite(face[i].x)&&Number.isFinite(face[i].y)?face[i]:null;
 const gap=(a,b)=>Math.hypot((a.x-b.x)*source.width,(a.y-b.y)*source.height);
 const faceGeometry=()=>{const f=facePoints();if(!source||!f)return null;
  const top=pt(f,10),bottom=pt(f,152),left=pt(f,234),right=pt(f,454),jawL=pt(f,172),jawR=pt(f,397);
  if(!top||!bottom||!left||!right)return null;
  const length=gap(top,bottom),width=gap(left,right);
  if(length<12||width<12)return null;
  const jaw=jawL&&jawR?gap(jawL,jawR):null;
  return {length,width,ratio:length/width,jaw,cheekJaw:jaw&&jaw>4?width/jaw:null};
 };
 function getMask(){if(!source)return null;
  // Group editing requires the selected pose's own mask, never the union silhouette.
  if(BODY_AI.people.length>1)return window.RayBodyPeople?.canIsolate()?window.RayBodyPose?.mask?.():null;
  return window.RayBodyPose?.mask?.()||(BEAUTY.source===source&&BEAUTY.maps?.foreground?BEAUTY.maps:null);
 }
 const pixelInside=(m,x,y)=>{const w=m.width,h=m.height,a=m.foreground||m.data;return x>=0&&x<w&&y>=0&&y<h&&a[Math.floor(y)*w+Math.floor(x)]>=155;};
 const multi=()=>BODY_AI.people.length>1||BEAUTY.people.length>1;
 function metricFor(id){const p=getPart(id),m=getMask();
  if(!source)return {ok:false,why:'Chưa có ảnh'};
  if(multi()&&!window.RayBodyPeople?.canIsolate())return {ok:false,why:'AI chưa tách rõ viền riêng của người đang chọn. Có thể đổi người hoặc dùng Từng vùng.'};
  if(!p)return {ok:false,why:'Thiếu vùng chỉnh'};
  if(p.place!=='ai'&&p.place!=='manual')return {ok:false,why:'Chưa định vị '+p.name+'. Quét AI hoặc đặt vùng bằng công cụ cũ'};
  if(id==='face'){
   const f=faceGeometry();if(!f)return {ok:false,why:'Cần nhận diện các mốc mặt (hoặc mặt bị nghiêng/che)'};
   return {ok:true,p,kind:'face',ratio:f.ratio,unit:'dài mặt / rộng mặt',f,mask:m};
  }
  if(!m)return {ok:false,why:'Chưa có mặt nạ tách người: bấm Quét AI & viền'};
  const f=faceGeometry(),head=p=>p&&p.place==='ai'?Math.max(.015,p.ry*2)*source.height:null;
  const hm=(f?.length||head(getPart('face'))||0);
  if(id==='neck'){
   // This is an estimate based on pose-landmark ellipse, NOT measured neck in centimetres.
   if(!hm)return {ok:false,why:'Chưa có mốc chiều dài đầu để so cổ'};
   const approx=(p.ry*2*source.height)/hm;
   if(approx<.05||approx>3)return {ok:false,why:'Ước lượng cổ không đủ tin cậy'};
   return {ok:true,p,kind:'length',ratio:approx,unit:'dài cổ ước lượng / dài mặt',mask:m,approx:true};
  }
  if(window.RayBodyCore){
   const measured=window.RayBodyCore.measureWidth(m,p,source.width,source.height);if(!measured.ok)return measured;
   const regions=BODY_AI.people?.[BODY_AI.selected]?.regions;let ref=hm,unit='rộng vùng / dài mặt';
   if(window.RayBodyCore.LIMBS[id]){ref=measured.lengthPx||((p.ray67BaseRy??p.ry)*2*source.height);unit='rộng vùng / dài đoạn tay chân';}
   else if(['waist','belly','hip','chest','back'].includes(id)&&regions?.shL&&regions?.shR){ref=Math.hypot((regions.shL.cx-regions.shR.cx)*source.width,(regions.shL.cy-regions.shR.cy)*source.height);unit='rộng vùng / khoảng vai';}
   if(!ref||ref<5)return{ok:false,why:'Chưa đủ mốc vai hoặc chiều dài vùng để đo'};
   const ratio=measured.widthPx/ref;if(!(ratio>.05&&ratio<6))return{ok:false,why:'Tỷ lệ vùng chưa đủ tin cậy'};
   return{ok:true,p,kind:'width',ratio,unit,mask:m,...measured,approx:['belly','back','butt','chest'].includes(id)};
  }
  const w=m.width,h=m.height,cx=Math.round(clamp(p.cx,0,1)*(w-1)),cy=Math.round(clamp(p.cy,0,1)*(h-1));
  if(!pixelInside(m,cx,cy))return {ok:false,why:'Tâm '+p.name+' nằm ngoài viền người; chỉnh lại mốc'};
  const angle=p.rot*Math.PI/180,ux=Math.cos(angle),uy=Math.sin(angle);
  const sample=t=>pixelInside(m,Math.round(cx+ux*t),Math.round(cy+uy*t));
  const maxSteps=Math.max(8,Math.min(Math.round(Math.hypot(w,h)*.26),Math.round(p.rx*source.height/source.width*w*3)));
  let L=0,R=0;while(L<maxSteps&&sample(-L-1))L++;while(R<maxSteps&&sample(R+1))R++;
  if(L===maxSteps||R===maxSteps)return {ok:false,why:'Viền '+p.name+' vượt khỏi vùng đo (có thể chạm tóc/tay hoặc trang phục)'};
  const width=(L+R+1)/w*source.width;
  if(width<5)return {ok:false,why:'Vùng quá nhỏ để đo'};
  const regions=BODY_AI.people?.[BODY_AI.selected]?.regions;
  let ref=hm,unit='rộng vùng / dài mặt';
  if(['waist','belly','hip','chest','back'].includes(id)&&regions?.shL&&regions?.shR){
    ref=Math.hypot((regions.shL.cx-regions.shR.cx)*source.width,(regions.shL.cy-regions.shR.cy)*source.height);unit='rộng vùng / khoảng vai';
  }
  if(!ref||ref<5)return {ok:false,why:'Thiếu mốc đầu/vai để quy đổi tỷ lệ'};
  const ratio=width/ref;
  if(!(ratio>.07&&ratio<6))return {ok:false,why:'Tỷ lệ ngoài phạm vi tin cậy'};
  return {ok:true,p,kind:'width',ratio,unit,mask:m,widthPx:width,approx:['belly','back','butt','chest'].includes(id)};
 }
 const metric=()=>metricFor($('r54Part').value);
 function readSetting(a){const preset=$('r54Preset').value,v=Number($('r54Percent').value)/100;
  if(!a.ok)return null;
  if(preset==='diamond'||preset==='oval'||preset==='vline'){
   if(a.kind!=='face')return null;
   // modest shape contour simulations, NOT exact Marquardt mask.
   const profiles={diamond:[['face','x',.025],['chin','x',-.075]],oval:[['face','x',-.035],['chin','y',.025]],vline:[['face','x',-.025],['chin','x',-.09]]};
   return {type:'shape',shape:preset,deltas:profiles[preset],label:'Mẫu hình mặt (mô phỏng)'};
  }
  let delta=0;
  if(preset==='slim')delta=-.05;else if(preset==='slim10')delta=-.10;else if(preset==='full')delta=.05;else if(preset==='percent')delta=clamp(v,-.40,.40);
  else if(preset==='target'){const t=Number($('r54Target').value);if(!(t>.15&&t<4))return null;delta=clamp(t/a.ratio-1,-.40,.40);}
  else if(preset==='phi'){
   if(a.kind!=='face'&&!(a.p.id==='waist'&&a.unit==='rộng vùng / khoảng vai'))return null;
   const target=a.kind==='face'?1.618:1/1.618;
   delta=clamp(target/a.ratio-1,-.40,.40);
  }
  if(preset==='keep')delta=0;
  return {type:'adjust',delta,axis:(a.kind==='face'||a.kind==='length')?'y':'x',label:(delta>=0?'+':'')+(delta*100).toFixed(1)+'%'};
 }
 function desired(a){const setting=readSetting(a);if(!setting)return null; if($('r54Preset').value==='phi')return a.kind==='face'?1.618:1/1.618;return setting.type==='adjust'?a.ratio*(1+setting.delta):null;}
 function plan(a){const setting=readSetting(a),strength=Number($('r54Strength').value)/100;
  if(!setting)return [];
  if(setting.type==='shape')return setting.deltas.map(([id,axis,d])=>({p:getPart(id),axis,delta:d*strength})).filter(e=>e.p?.place==='ai'||e.p?.place==='manual');
  return [{p:a.p,axis:setting.axis,delta:setting.delta*strength}];
 }
 function refresh(){const face=$('r54Part').value==='face';
  for(const opt of $('r54Preset').options)if(opt.dataset.face)opt.disabled=!face;
  if(!face&&$('r54Preset').selectedOptions[0]?.disabled)$('r54Preset').value='slim';
  const a=metric(),setting=readSetting(a);
  if(state.live&&state.previewKind==='part'){state.preview=a.ok&&setting?plan(a):null;scheduleLive();}
  $('r54Metric').textContent=a.ok?'Hiện tại '+a.ratio.toFixed(3)+' · '+a.unit:'Chưa đo';
  $('r54PctText').textContent=(Number($('r54Percent').value)>0?'+':'')+$('r54Percent').value+'%';
  $('r54StrengthText').textContent=$('r54Strength').value+'%';
  $('r54Target').disabled=$('r54Preset').value!=='target';
  $('r54Percent').disabled=false; // Direct slider always available; moving it switches preset to Custom.
  $('r54Apply').disabled=!a.ok||!setting||!plan(a).length;
  if(a.ok&&$('r54Preset').value!=='target')$('r54Target').value=(desired(a)??a.ratio).toFixed(3);
  if(!state.scanning){
   if(!a.ok)status(a.why);
   else if(!setting)status('Mẫu φ chỉ hỗ trợ tỷ lệ dài/rộng mặt và eo/vai; các dáng khác dùng tỷ lệ ±%.');
   else status(a.p.name+': '+a.ratio.toFixed(3)+' ('+a.unit+'). '+($('r54Preset').value==='phi'?'Mục tiêu φ tham khảo; thanh chỉnh thủ công trong khoảng ±40%, biến dạng có giới hạn an toàn. ':'')+(a.approx?'Chỉ là ước lượng theo trang phục/mốc, không phải số đo người thật.':'Thử mức nhẹ trước để tránh méo nền.')+(setting.type==='shape'?' Mẫu mặt chỉ mô phỏng theo 2 vùng, chưa phải mặt nạ Phi Mask đầy đủ.':''));
  }
  scheduleOverlay();
 }
 // Idempotent geometric presets: repeated click at the same strength must not double-warp.
 // Keep user's older/manual slider adjustments; replace only the contribution of this add-on.
 function commit(entries,label){state.live=false;state.preview=null;if(!entries.length)return false;
  if(state.source!==source)state.source=source;
  const wanted=new Map();for(const e of entries){if(!e.p)continue;
    const field=e.axis==='y'?'len':'wid',key=e.p.id+':'+field;
    const d=clamp(e.delta,-.40,.40);
    wanted.set(key,{p:e.p,field,contrib:Math.log(1+d)/(Math.LN2*BODY_E),rx:e.rx,ry:e.ry});
  }
  // Face templates can use both face and chin. Clear the previous preset portion when switching shape.
  if(entries.some(e=>e.p?.id==='face'||e.p?.id==='chin'))for(const key of ['face:wid','face:len','chin:wid','chin:len']){
    if(!wanted.has(key)&&Math.abs(getPart(key.split(':')[0])?.['ray54'+key.split(':')[1]]||0)>.00001){
      const [id,field]=key.split(':');wanted.set(key,{p:getPart(id),field,contrib:0});
    }
  }
  const changes=[];
  for(const [key,item] of wanted){if(!item.p)continue;
    const old=item.p['ray54'+item.field]||0,step=item.contrib-old;
    const next=clamp(item.p[item.field]+step,-.65,.65);
    const needsSize=Number.isFinite(item.rx)&&item.rx>item.p.rx+.000001||Number.isFinite(item.ry)&&item.ry>item.p.ry+.000001;
    if(Math.abs(next-item.p[item.field])<.00001&&!needsSize)continue;
    changes.push({...item,key,next});
  }
  if(!changes.length)return false;
  window.RaySession?.record('Trước '+label);
  for(const x of changes){
    x.p[x.field]=x.next;
    // Keep the detected subject boundary inside the smooth warp support.
    // This is vital: a tiny ellipse only shifts internal texture, not the visible silhouette.
    if(Number.isFinite(x.rx)&&x.rx>x.p.rx){if(!Number.isFinite(x.p.ray67BaseRx))x.p.ray67BaseRx=x.p.rx;x.p.rx=x.rx;}
    if(Number.isFinite(x.ry)&&x.ry>x.p.ry){if(!Number.isFinite(x.p.ray67BaseRy))x.p.ray67BaseRy=x.p.ry;x.p.ry=x.ry;}
    x.p.place=x.p.place==='ai'?'ai':'manual';x.p['ray54'+x.field]=x.contrib;
  }
  BODY.sel=entries[0].p.id;BODY.hide=true;bodyUI();syncBody();queue();window.RaySession?.record(label);
  return true;
 }
 function apply(){const a=metric();if(!a.ok){state.live=false;state.preview=null;status(a.why);queue();return;}
  const entries=plan(a);if(!entries.length){state.live=false;state.preview=null;status('Chưa có mô hình đo/điểm đặt vùng để biến đổi');queue();return;}
  if(commit(entries,'Chỉnh tỷ lệ '+a.p.name))status('Đã áp mức nhẹ trên '+a.p.name+'. Kiểm tra đường viền thật và ảnh xuất; hoàn tác nếu bị méo.');
  else status('Thông số bằng 0 hoặc đã đạt giới hạn an toàn, ảnh không đổi.');
  scheduleOverlay();
 }
 function slimAll(){if(multi()){status('Không áp dụng toàn thân cho ảnh nhóm khi chưa khóa từng người.');return;}
  if(!source){status('Chưa có ảnh');return;}
  const ids=['armL','armR','waist','belly','hip'],items=[];let skip=[];
  for(const id of ids){const a=metricFor(id);if(a.ok)items.push({p:a.p,axis:'x',delta:-.035*Number($('r54Strength').value)/100});else skip.push(id);}
  if(items.length<2){status('Cần ít nhất hai vùng được AI đo rõ. Chưa áp dụng: '+skip.join(', '));return;}
  if(commit(items,'Thon thân nhẹ nhiều vùng'))status('Đã chỉnh '+items.length+' vùng mức nhẹ (−3,5% × mức áp dụng). Bỏ qua vùng thiếu mốc: '+(skip.join(', ')||'không')+'. Vùng bụng dưới váy/áo rộng chỉ đổi viền trang phục.');
  else status('Không có thay đổi.');
  scheduleOverlay();
 }
 function reset(){state.live=false;state.preview=null;const p=getPart();if(!p)return;
  window.RaySession?.record('Trước đặt lại '+p.name);p.wid=0;p.len=0;p.ray54wid=0;p.ray54len=0;BODY.hide=true;bodyUI();syncBody();queue();window.RaySession?.record('Đặt lại '+p.name);status('Đã đưa các thanh ngang/dọc của '+p.name+' về 0.');scheduleOverlay();
 }
 function coords(){const wr=wrap.getBoundingClientRect(),r=view.getBoundingClientRect();return {left:r.left-wr.left,top:r.top-wr.top,width:r.width,height:r.height};}
 let raf=0,outlineMask=null,outlinePaths=null;function scheduleOverlay(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;paintOverlay();});}
 function paintOverlay(){const r=coords(),dpr=Math.min(2,devicePixelRatio||1),W=Math.max(1,Math.round(r.width*dpr)),H=Math.max(1,Math.round(r.height*dpr));
  overlay.style.left=r.left+'px';overlay.style.top=r.top+'px';overlay.style.width=r.width+'px';overlay.style.height=r.height+'px';
  if(overlay.width!==W)overlay.width=W;if(overlay.height!==H)overlay.height=H;
  const ctx=overlay.getContext('2d');ctx.clearRect(0,0,W,H);
  const overall=['body','lines'].includes(base.dataset.bodyMode)&&state.previewKind==='overall';
  if(!state.enabled||!source||!r.width||!['body','all'].includes(document.body.dataset.editorTool)||document.querySelector('.film-workspace.is-result-preview')||
   (!overall&&document.body.classList.contains('ray54-guide-clean')&&['face','chin'].includes($('r54Part').value)))return;
  const a=overall?null:metric(),mask=overall?getMask():a?.ok?a.mask:null;if(!mask)return;
  const fg=mask.foreground||mask.data,mw=mask.width,mh=mask.height;
  const bw=LASTG?.bw||0,bb=LASTG?.bb||0,picW=(LASTG?.W||source.width)+2*bw,picH=(LASTG?.H||source.height)+bw+bb;
  const toX=u=>(bw+u*(LASTG?.W||source.width))/picW*r.width;
  const toY=v=>(bw+v*(LASTG?.H||source.height))/picH*r.height;
  const entries=overall?(state.live&&state.previewKind==='overall'?state.preview:[]):plan(a);
  const core=window.RayBodyCore;
  if(core){
   if(outlineMask!==mask){outlineMask=mask;outlinePaths=core.tracePaths(core.boundaries(mask));}
   const kernel={guard:bodyGuard,coef:bodyCoef},planned=core.plannedParts(BODY.parts,entries||[],BODY_E),current=core.compile(window.RayBodyPeople?.parts()||BODY.parts,source.width,source.height,kernel),target=core.compile(window.RayBodyPeople?.parts(planned)||planned,source.width,source.height,kernel);
   ctx.setTransform(dpr,0,0,dpr,0,0);
   for(const [index,warps]of (entries?.length?[current,target]:[current]).entries()){
    ctx.strokeStyle=index?'#fff4d4':'#e7b34c';ctx.lineWidth=index?2:1.3;ctx.setLineDash(index?[5,4]:[]);ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();
    for(const path of outlinePaths){let first=true;for(const point of path){let projected=core.project(point,warps,source.width,source.height);if(window.RayBodyContour?.project)projected=window.RayBodyContour.project(projected);if(window.RayBodyLines)projected=window.RayBodyLines.project(projected);const [u,v]=projected;if(first){ctx.moveTo(toX(u),toY(v));first=false;}else ctx.lineTo(toX(u),toY(v));}}
    ctx.stroke();
   }
   return;
  }
  const move=(u,v)=>{let x=u*source.width,y=v*source.height;
   for(const e of entries){const p=e.p,rad=p.rot*Math.PI/180,cs=Math.cos(rad),sn=Math.sin(rad),dx=x-p.cx*source.width,dy=y-p.cy*source.height;
    const lx=cs*dx+sn*dy,ly=-sn*dx+cs*dy,Rx=Math.max(1,p.rx*source.height),Ry=Math.max(1,p.ry*source.height),rr=(lx/Rx)**2+(ly/Ry)**2;
    if(rr>=1)continue;const v1=clamp(1-Math.sqrt(rr),0,1),fall=v1*v1*(3-2*v1),k=1+e.delta*fall;
    const xx=e.axis==='x'?lx*k:lx,yy=e.axis==='y'?ly*k:ly;
    x=p.cx*source.width+cs*xx-sn*yy;y=p.cy*source.height+sn*xx+cs*yy;
   }
   return [x/source.width,y/source.height];
  };
  ctx.setTransform(dpr,0,0,dpr,0,0);
  for(let t=0;t<2;t++){
   ctx.save();ctx.strokeStyle=t?'rgba(255,244,212,.95)':'rgba(244,192,99,.68)';ctx.lineWidth=t?1.7:1;ctx.setLineDash(t?[3.5,4.5]:[]);ctx.beginPath();
   for(let y=1;y<mh-1;y+=2)for(let x=1;x<mw-1;x+=2){const i=y*mw+x;if(fg[i]<155)continue;
    if(fg[i-1]>=155&&fg[i+1]>=155&&fg[i-mw]>=155&&fg[i+mw]>=155)continue;
    let u=(x+.5)/mw,v=(y+.5)/mh;if(t)[u,v]=move(u,v);
    ctx.moveTo(toX(u),toY(v));ctx.lineTo(toX(u)+.9,toY(v)+.9);
   }ctx.stroke();ctx.restore();
  }
 }
 async function scan(){if(state.scanning||!source){status('Mở ảnh trước khi quét AI.');return false;}
  const image=source;state.scanning=true;$('r54Scan').disabled=true;status('Đang quét mốc tư thế, mặt và tách viền. Lần đầu cần kết nối mạng.');
  const wait=async cond=>{for(let i=0;i<240;i++){if(source!==image)throw new Error('Ảnh đã thay đổi');if(cond())return;await new Promise(r=>setTimeout(r,500));}throw new Error('Quá thời gian quét AI');};
  try{
   if(!BODY_AI.busy)bodyAiScan.click();await wait(()=>!BODY_AI.busy);
   if(!BODY_AI.people.length||window.RayBodyPose?.failure?.()){status(window.RayBodyPose?.failure?.()||'AI chưa nhận diện được tư thế. Có thể dùng Từng vùng để chỉnh tay.');return false;}
   if(!getMask()){if(!BEAUTY.busy)beautyScan.click();await wait(()=>!BEAUTY.busy);}
   if(base.dataset.bodyMode==='body')guides($('rayBodyOutline')?.checked!==false,'overall');
   refresh();status('Tìm thấy '+BODY_AI.people.length+' người. '+(multi()?'Chọn người muốn chỉnh ở phía trên.':'Chọn vùng để đo và chỉnh, có thể sửa mốc thủ công.'));return true;
  }catch(e){status('Chưa quét được AI: '+String(e.message||e)+'; vẫn chỉnh thủ công được.');throw e;}
  finally{state.scanning=false;$('r54Scan').disabled=false;scheduleOverlay();}
 }

 // Non-destructive preview: overrides the 2D warp values only while drawing the onscreen canvas.
 // Never changes the original parts, undo stack, saved draft or exported pixels until Apply.
 const previousBodyWarp54=bodyWarp;
 bodyWarp=function(c,W,H){
   if(state.live&&(state.source!==source||state.parts!==BODY.parts)){state.live=false;state.preview=null;}
   const entries=window.RayLivePreviewMode&&state.live&&state.preview&&document.body.dataset.editorTool==='body'?state.preview:null;
   if(!entries||!entries.length)return previousBodyWarp54(c,W,H);
   const originals=[];
   try{
    for(const e of entries){if(!e.p)continue;
    const field=e.axis==='y'?'len':'wid',p=e.p,old=p[field];
     const d=clamp(e.delta,-.40,.40),wanted=Math.log(1+d)/(Math.LN2*BODY_E),prior=p['ray54'+field]||0;
     originals.push([p,field,old,p.rx,p.ry]);p[field]=clamp(old+wanted-prior,-.65,.65);if(e.rx)p.rx=Math.max(p.rx,e.rx);if(e.ry)p.ry=Math.max(p.ry,e.ry);
    }
    return previousBodyWarp54(c,W,H);
   }finally{for(const [p,field,old,rx,ry] of originals){p[field]=old;p.rx=rx;p.ry=ry;}}
 };
 let liveTimer=0;
 function scheduleLive(){clearTimeout(liveTimer);liveTimer=setTimeout(()=>{
   if(document.body.dataset.editorTool==='body'&&source)queue();
 },70);}
 // If saving/committing the session, accept the onscreen preview first. 
 function acceptLive(){if(!state.live)return;if(state.source!==source||state.parts!==BODY.parts){state.live=false;state.preview=null;return;}
  if(state.previewKind==='overall'){if(state.preview?.length)commit(state.preview,state.previewLabel||'Áp dáng cơ thể');}
  else{const a=metric();if(a.ok){const entries=plan(a);if(entries.length)commit(entries,'Chỉnh tỷ lệ trực tiếp '+a.p.name);}}
  state.live=false;state.preview=null;
 }
 document.querySelector('.session-apply')?.addEventListener('click',acceptLive,true);
 document.querySelector('.session-toolbar button[aria-label="Lưu bản nháp"]')?.addEventListener('click',acceptLive,true);
 $('save')?.addEventListener('click',acceptLive,true);
 function cancelLive(){state.live=false;state.preview=null;window.RayLayers?.invalidate?.();queue();scheduleOverlay();}
 window.RayRatioLive={get active(){return state.live;},accept:acceptLive,cancel:cancelLive};
 $('r54Scan').onclick=scan;
 function guides(on,kind){state.enabled=!!on;if(kind)state.previewKind=kind;$('r54Toggle').textContent=state.enabled?'Ẩn nét mẫu':'Hiện nét mẫu';const toggle=$('rayBodyOutline');if(toggle&&state.previewKind==='overall')toggle.checked=state.enabled;scheduleOverlay();}
 $('r54Toggle').onclick=()=>guides(!state.enabled);
 const changeLive=()=>{state.source=source;state.parts=BODY.parts;state.live=true;state.previewKind='part';window.RayLayers?.invalidate?.();refresh();};
 $('r54Part').onchange=()=>{state.live=false;state.preview=null;refresh();queue();};
 $('r54Preset').onchange=changeLive;
 $('r54Percent').oninput=()=>{$('r54Preset').value='percent';changeLive();};
 $('r54Target').oninput=()=>{$('r54Preset').value='target';changeLive();};
 $('r54Strength').oninput=changeLive;
 $('r54Apply').onclick=apply;$('r54SlimAll').onclick=()=>{state.live=false;state.preview=null;slimAll();};$('r54Reset').onclick=reset;
 $('bodyAiPerson').addEventListener('change',()=>setTimeout(refresh,100));
 bodyAiScan.addEventListener('click',()=>setTimeout(refresh,1500));beautyScan.addEventListener('click',()=>setTimeout(refresh,1500));
 window.addEventListener('resize',scheduleOverlay,{passive:true});if(window.ResizeObserver)new ResizeObserver(scheduleOverlay).observe(view);
 let lastSource=null,lastReady='';setInterval(()=>{
  if(source!==lastSource){lastSource=source;state.source=source;state.live=false;state.preview=null;refresh();}
  const ready=[BODY_AI.people.length,BEAUTY.people.length,BEAUTY.maps?.foreground?.length||0,BEAUTY.source===source].join(':');
  if(ready!==lastReady){lastReady=ready;refresh();}
 },950);
 // Expose small test hooks: no remote services, no changes to other modules.
 function previewEntries(entries,label){state.source=source;state.parts=BODY.parts;state.live=true;state.previewKind='overall';state.previewLabel=label;state.preview=entries;BODY.hide=true;window.RaySession?.showResult(false);window.RayLayers?.invalidate?.();guides($('rayBodyOutline')?.checked!==false);queue();}
 window.RayGeometry54={metric,metricFor,getMask,readSetting,plan,commit,refresh,apply,slimAll,reset,scan,paintOverlay,guides,previewEntries,scheduleOverlay};
 refresh();
})();
