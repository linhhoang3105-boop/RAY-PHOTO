
/* RAY PHOTO: reversible one-tap *estimated* body-ratio preview from existing v54 AI and masks.
   Does not claim a universal ideal proportion; never changes film/color render or AI detectors.
   Only accepts regions that have both an AI placement and a measured subject boundary. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const clamp=(x,lo,hi)=>Math.min(hi,Math.max(lo,x));
 const body=$('bodyBox'),ratio=$('rayRatio54');if(!body||!ratio)return;
 const section=document.createElement('section');section.id='rayOverall62';
 section.innerHTML=`<h3>✧ Dáng tổng thể · AI + chỉnh ảnh thật</h3>
 <p>AI xác định vùng cơ thể và đo viền. Sau đó <b>Áp dáng tổng thể</b> thực sự thay đổi các vùng được nhận diện, không chỉ vẽ vòng. Có thể chọn mức nhẹ/rõ và Hoàn tác. Số đo 2D chỉ mang tính tham khảo.</p>
 <div class="ray62-line"><label for="ray62Mode">Mục tiêu</label><select id="ray62Mode"><option value="slimmer">Thon gọn rõ · vẫn tự nhiên</option><option value="balanced">Cân đối nhẹ</option><option value="keep">Giữ nguyên</option></select></div>
 <div class="ray62-line"><label for="ray62Scope">Vùng áp dụng</label><select id="ray62Scope"><option value="all">Toàn thân · eo, bụng, hông, tay &amp; chân</option><option value="arms">Hai tay · bắp tay + cẳng tay</option><option value="legs">Hai chân · đùi + bắp chân</option><option value="waist">Chỉ eo</option><option value="belly">Chỉ bụng</option><option value="hip">Chỉ hông</option><option value="armL">Chỉ bắp tay trái</option><option value="armR">Chỉ bắp tay phải</option><option value="foreL">Chỉ cẳng tay trái</option><option value="foreR">Chỉ cẳng tay phải</option><option value="thL">Chỉ đùi trái</option><option value="thR">Chỉ đùi phải</option><option value="clL">Chỉ bắp chân trái</option><option value="clR">Chỉ bắp chân phải</option></select></div>
 <div class="ray62-line"><label for="ray62Strength">Mức thay đổi</label><input type="range" id="ray62Strength" min="0" max="100" step="5" value="85" aria-label="Mức tác động dáng tổng thể" style="flex:1 1 120px;accent-color:#e7c778"><output id="ray62StrengthValue" style="min-width:36px;color:#f0d38f;font-size:13px">85%</output></div>
 <label class="ray-body-outline"><input type="checkbox" id="rayBodyOutline" checked> Viền dáng mục tiêu</label><p class="ray-body-outline-note">Vàng: dáng trước bước này · Ngà nét đứt: dáng dự kiến. Viền chỉ để chỉnh, không in vào ảnh.</p>
 <div class="ray62-actions"><button type="button" id="ray62Scan">✧ Quét AI &amp; tính tỷ lệ</button><button type="button" id="ray62Apply" class="ray62-primary" disabled>✓ Áp dáng tổng thể · Xem ảnh ngay</button></div>
 <div id="ray62OverallStatus" role="status" aria-live="polite">Quét AI để đo các vùng cơ thể trước khi áp dụng. Kết quả sẽ hiện toàn ảnh không vòng, còn vòng vẫn dùng được khi chỉnh tiếp.</div>
 <details id="rayBodyDetections" class="ray-body-details"><summary id="rayBodyDetectionSummary">Kết quả nhận diện từng vùng</summary><ul id="rayBodyDetectionList"></ul></details>
 <div class="ray62-actions"><button type="button" id="ray62Undo" disabled>↶ Không ưng · Quay lại</button><button type="button" id="ray62Refine">Điều chỉnh từng bộ phận</button></div>
 <p class="ray62-diagnostic">Vùng không đo đủ được bỏ qua. Chọn mức thấp nếu ảnh có váy rộng, mặt nghiêng hoặc phông có đường thẳng. Có thể quay lại nguyên trạng bằng nút Quay lại trên ảnh.</p>`;
 ratio.insertAdjacentElement('beforebegin',section);
 const status=msg=>$('ray62OverallStatus').textContent=msg;
 const names={waist:'Eo',belly:'Bụng',hip:'Hông',armL:'Bắp tay trái',armR:'Bắp tay phải',foreL:'Cẳng tay trái',foreR:'Cẳng tay phải',thL:'Đùi trái',thR:'Đùi phải',clL:'Bắp chân trái',clR:'Bắp chân phải'};
 const limbUnits=['rộng vùng / dài mặt','rộng vùng / dài đoạn tay chân'];
 const rules={
  // Suggested silhouette changes, NOT a universal beauty ratio. Always apply when a
  // region has a trustworthy pose/foreground measurement; a 'within range' metric
  // is not an excuse to silently skip an explicit one-tap user request.
  waist:{balanced:-.135,slimmer:-.215,kind:'rộng vùng / khoảng vai',low:.62},
  belly:{balanced:-.115,slimmer:-.185,kind:'rộng vùng / khoảng vai',low:.70},
  hip:{balanced:-.065,slimmer:-.100,kind:'rộng vùng / khoảng vai',low:.88},
  armL:{balanced:-.120,slimmer:-.180,kind:limbUnits,low:.17},
  armR:{balanced:-.120,slimmer:-.180,kind:limbUnits,low:.17},
  foreL:{balanced:-.075,slimmer:-.120,kind:limbUnits,low:.12},
  foreR:{balanced:-.075,slimmer:-.120,kind:limbUnits,low:.12},
  thL:{balanced:-.080,slimmer:-.135,kind:limbUnits,low:.24},
  thR:{balanced:-.080,slimmer:-.135,kind:limbUnits,low:.24},
  clL:{balanced:-.075,slimmer:-.120,kind:limbUnits,low:.15},
  clR:{balanced:-.075,slimmer:-.120,kind:limbUnits,low:.15}
 };
 let token=0,lastApplied=false,beforeKey='',afterKey='';
 function measure(){
  const api=window.RayGeometry54;
  const mode=$('ray62Mode').value;
  const strength=clamp(Number($('ray62Strength').value)||0,0,100)/100;
  if(!source)return{ok:false,why:'Mở ảnh trước khi quét AI.'};
  if(BODY_AI.busy||BEAUTY.busy)return{ok:false,why:BODY_AI.busy?(BODY_AI.message||'AI đang xử lý…'):'Đang tách viền người…'};
  const failure=window.RayBodyPose?.failure?.();if(failure)return{ok:false,why:failure};
  if(!BODY_AI.people.length)return{ok:false,why:'Chưa có vùng AI cơ thể. Bấm Quét AI & xem trước dáng.'};
  if((BODY_AI.people.length>1||BEAUTY.people.length>1)&&!window.RayBodyPeople?.canIsolate())return{ok:false,why:'AI chưa tách rõ viền riêng của người đang chọn. Đổi người hoặc chuyển sang Từng vùng.'};
  if(!(api?.getMask?.()||(BEAUTY.source===source&&BEAUTY.maps?.foreground)))return{ok:false,why:'Chưa có viền người. Bấm Quét AI & xem trước.'};
  if(!api?.metricFor||!api?.commit)return{ok:false,why:'Chức năng chỉnh dáng AI chưa khởi tạo. Tải lại app.'};
  const scope=$('ray62Scope').value||'all',groups={arms:['armL','armR','foreL','foreR'],legs:['thL','thR','clL','clR']},selected=Object.entries(rules).filter(([id])=>scope==='all'||id===scope||groups[scope]?.includes(id));
  const available=[],skipped=[],changes=[],diagnostics=[];
  for(const [id,r] of selected){
   const m=api.metricFor(id);
   if(!m?.ok||!(Array.isArray(r.kind)?r.kind.includes(m.unit):m.unit===r.kind)){skipped.push(names[id]);diagnostics.push({id,name:names[id],ok:false,why:m?.why||'Chưa có mốc và viền đủ rõ'});continue;}
   diagnostics.push({id,name:names[id],ok:true});
   available.push({id,m});
   if(mode==='keep'||strength<=0)continue;
   // Profile poses and wide dresses produce unreliable projected widths.
   // Reduce the edit strength on unusually narrow detections, but don't
   // treat any arbitrary reference band as a no-op when a user asks to apply.
   const attenuation=m.ratio<r.low*.75?.50:m.ratio<r.low?.75:1;
   const delta=clamp(r[mode]*strength*attenuation,-.28,-.008);
   if(Math.abs(delta)>.007){
    const torso=['waist','belly','hip'].includes(id);
    const measuredWidth=Number(m.widthPx)||0;
    const originalRx=m.p.ray67BaseRx??m.p.rx, originalRy=m.p.ray67BaseRy??m.p.ry;
    // The v54 ellipse falls to zero at its outer edge. Enlarge its support so
    // the PERSON contour, not just the pixels inside the body, can move.
    // Torso uses actual measured segmentation width. Limbs use pose radius
    // because a union silhouette can accidentally include a nearby torso.
    const byBoundary=torso&&measuredWidth>15?measuredWidth/source.height*.93:originalRx*(torso?1.55:1.65);
    const rx=clamp(Math.max(originalRx*1.2,byBoundary),originalRx,Math.min(.23,originalRx*(torso?2.65:2.0)));
    const ry=clamp(originalRy*(torso?1.24:1.17),originalRy,Math.min(.28,originalRy*1.35));
    changes.push({p:m.p,axis:'x',delta,ratio:m.ratio,id,rx,ry});
   }
  }
  if(!selected.length||available.length<Math.min(2,selected.length))return{ok:false,why:'Chưa đo đủ vùng đã chọn. Thử quét lại hoặc dùng Từng vùng để đặt vòng bằng tay.',skipped,diagnostics};
  return{ok:true,available,changes,skipped,mode,strength,diagnostics};
 }
 function refresh(){
  const measured=measure();$('ray62StrengthValue').textContent=$('ray62Strength').value+'%';$('ray62Apply').disabled=!measured.ok||measured.mode==='keep'||!measured.changes?.length;
  const list=$('rayBodyDetectionList');list.replaceChildren();for(const item of measured.diagnostics||[]){const li=document.createElement('li');li.textContent=(item.ok?'✓ ':'— ')+item.name+(item.ok?' · Đã đo rõ':' · '+item.why);list.append(li);}
  $('rayBodyDetectionSummary').textContent=measured.diagnostics?.length?'Đã đo '+(measured.available?.length||measured.diagnostics.filter(d=>d.ok).length)+'/'+measured.diagnostics.length+' vùng · Xem chi tiết':'Kết quả nhận diện từng vùng';
  $('ray62Scan').disabled=!source||BODY_AI.busy||BEAUTY.busy;
  if(!measured.ok){status(measured.why+(measured.skipped?.length?'\nChưa đo: '+measured.skipped.join(', '):''));return measured;}
  const c=measured.changes;
  if(lastApplied&&document.querySelector('.film-workspace.is-result-preview'))return measured;
  status((window.RayBodyPose?.warning?.()?window.RayBodyPose.warning()+'\n':'')+(window.RayBodyPose?.fromDraft?.()?'Đã khôi phục viền AI từ nháp.\n':'')+'Đã đo '+measured.available.length+'/'+measured.diagnostics.length+' vùng có mốc AI và viền người.'+
   (c.length?(window.RayRatioLive?.active?'\nĐang xem trước '+c.length+' vùng. Bấm Áp dụng ✓ dưới ảnh để giữ.':'\nKéo viền vàng bằng Nắn theo viền hoặc dùng Bút nét để đổi dáng ngay. Xem trước dáng đã chọn dùng các mức AI bên dưới.'):'\nKhông chỉnh AI (đã chọn giữ nguyên hoặc mức tác động là 0%). Vẫn có thể kéo Nắn theo viền hoặc dùng Bút nét.')+
   (measured.skipped.length?'\nKhông đủ dữ liệu: '+measured.skipped.join(', '):'')+
   '\nĐây là tỷ lệ hiển thị 2D, không phải số đo cơ thể thật.');
  return measured;
 }
 function preview(){
  const computed=refresh();if(!computed.ok||computed.mode==='keep'||!computed.changes.length){window.RayRatioLive?.cancel();window.RayGeometry54?.scheduleOverlay();return;}
  window.RayGeometry54?.previewEntries(computed.changes,'Áp dáng cơ thể · '+($('ray62Scope').selectedOptions?.[0]?.textContent||'vùng đã chọn'));refresh();
 }
 async function scan(){
  if(!source)return false;
  const image=source,id=++token;
  window.RayRatioLive?.cancel();
  $('ray62Scan').disabled=true;status('Đang quét AI tư thế, mặt và viền người…');
  try{
   const result=await window.RayGeometry54.scan();
   if(id!==token||image!==source){status('Ảnh đã thay đổi. Hãy quét lại ảnh đang mở.');return false;}
   const measured=refresh();return result!==false&&measured.ok;
  }catch(e){status('AI chưa hoàn thành: '+String(e.message||e));return false;}
  finally{$('ray62Scan').disabled=!source||BODY_AI.busy||BEAUTY.busy;}
 }
 function apply(){
  const computed=measure();if(!computed.ok){refresh();return;}
  if(computed.mode==='keep'||!computed.changes.length){refresh();return;}
  // Close pending slider history and preserve a single pre-change undo point.
  bodyEnd();
  beforeKey=bodySnap();
  bodyBegin('ray62-all');
  const changed=window.RayGeometry54.commit(computed.changes,'Áp tỷ lệ dáng tổng thể');
  bodyEnd();
  if(!changed){status('Tỷ lệ đã nằm ở mức đang chọn hoặc chạm giới hạn an toàn. Không có pixel nào mới được ghi.');return;}
  lastApplied=true;afterKey=bodySnap();
  BODY.hide=true;bodyUI();syncBody();queue();
  window.RayFace55?.hideGuides('result');
  window.RaySession?.showResult(true);
  $('ray62Undo').disabled=false;
  status('Đã ghi chỉnh sửa vào ảnh cho '+computed.changes.length+' vùng: '+computed.changes.map(e=>names[e.id]+' '+Math.round(e.delta*100)+'%').join(' · ')+'\nĐang xem dáng toàn ảnh, không có vòng che.'+
   '\nNếu chưa ưng, dùng nút Quay lại trên ảnh; nếu muốn nắn tiếp, bấm Điều chỉnh từng bộ phận.'+
   (computed.skipped.length?'\nVùng chưa đo không được chỉnh: '+computed.skipped.join(', '):''));
 }
 function undo(){
  if(!lastApplied||!source)return;
  // Restore only if nothing else has been edited since the automatic application.
  const before=beforeKey;
  if(!before)return;
  bodyEnd();
  const current=bodySnap();
  if(current===before){lastApplied=false;$('ray62Undo').disabled=true;return;}
  if(current!==afterKey){status('Bà đã chỉnh thêm vùng khác sau khi áp dáng AI. Hãy dùng nút ↶ của RAY để quay lại từng bước, tránh mất các chỉnh sửa mới.');lastApplied=false;$('ray62Undo').disabled=true;return;}
  // Use the app's main Undo so draft, face edits and session history stay in sync.
  window.RaySession?.undo();
  lastApplied=false;beforeKey='';afterKey='';$('ray62Undo').disabled=true;
  BODY.hide=false;bodyUI();syncBody();queue();
  status('Đã quay lại bước trước khi áp dáng tổng thể. Ảnh được giữ nguyên để bà thử mẫu khác.');
 }
 function refine(){
  if(!source)return;
  window.RayRatioLive?.accept();
  window.RaySession?.showResult(false);
  BODY.hide=false;
  BODY.sel=BODY.sel||'waist';
  bodyUI();syncBody();queue();
  document.getElementById('bodyCtl')?.scrollIntoView({behavior:'smooth',block:'nearest'});
  status('Chọn vùng muốn chỉnh → kéo các thanh To/nhỏ, Ngang, Dọc… Ảnh thay đổi ngay. Khi xem tổng thể, bấm Áp dụng ✓ ở thanh dưới.');
 }
 $('ray62Apply').onclick=apply;$('ray62Undo').onclick=undo;$('ray62Refine').onclick=refine;
 const changed=()=>{preview();window.RaySession?.contextChanged();};
 $('ray62Scan').onclick=async()=>{if(await scan()){window.RayRatioLive?.cancel();window.RayGeometry54?.guides(true,'overall');refresh();}};$('ray62Mode').onchange=changed;$('ray62Scope').onchange=changed;$('ray62Strength').oninput=changed;
 $('rayBodyOutline').onchange=()=>{window.RayGeometry54?.guides($('rayBodyOutline').checked,'overall');window.RaySession?.contextChanged();};
 // Session is restored automatically by v54 on photo replacement; don't carry undo between photos.
 let lastSource=source,stamp='';
 setInterval(()=>{
  if(source!==lastSource){lastSource=source;lastApplied=false;beforeKey='';afterKey='';$('ray62Undo').disabled=true;}
  const next=[BODY_AI.people.length,BEAUTY.people.length,BEAUTY.source===source,BEAUTY.maps?.foreground?.length||0,bodySnap().length].join(':');
  if(next!==stamp){stamp=next;refresh();}
  const top=$('ray62UndoTop');if(top)top.disabled=!lastApplied;
 },1100);
 window.RayOverall62={measure,refresh,scan,preview,apply,undo,refine};
 refresh();
})();
