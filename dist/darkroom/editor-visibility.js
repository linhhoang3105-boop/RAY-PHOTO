/* Photo-first editing controls. Colors still flow through the existing makeup handlers. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.RayEditorVisibility=api;api.init();}})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function hexToHSV(hex,lastHue=0){
  const rgb=hex.replace('#','').match(/../g).map(n=>parseInt(n,16)/255),[r,g,b]=rgb,max=Math.max(...rgb),min=Math.min(...rgb),d=max-min;
  let h=lastHue;if(d)h=60*((max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4));
  return{h,s:max?d/max*100:0,v:max*100};
 }
 function hsvToHex({h,s,v}){
  const hue=((Number(h)%360)+360)%360,sat=clamp(Number(s)/100,0,1),value=clamp(Number(v)/100,0,1),c=value*sat,x=c*(1-Math.abs(hue/60%2-1)),m=value-c;
  const rgb=hue<60?[c,x,0]:hue<120?[x,c,0]:hue<180?[0,c,x]:hue<240?[0,x,c]:hue<300?[x,0,c]:[c,0,x];
  return'#'+rgb.map(n=>Math.round((n+m)*255).toString(16).padStart(2,'0')).join('');
 }
 function inlineColor(input,doc=document){
  const name=input.getAttribute('aria-label'),details=doc.createElement('details');details.className='ray-color-details';
  const summary=doc.createElement('summary'),chip=doc.createElement('span'),caption=doc.createElement('span');chip.className='ray-color-current';chip.setAttribute('aria-hidden','true');summary.append(chip,caption);summary.setAttribute('aria-label',name+' · mở bảng màu trong ứng dụng');details.append(summary);
  const field=doc.createElement('fieldset');field.className='ray-color-fields';const legend=doc.createElement('legend');legend.textContent=name;legend.className='my-sr';field.append(legend);details.append(field);
  const spectrum=doc.createElement('div');spectrum.className='ray-color-spectrum';spectrum.setAttribute('role','group');spectrum.setAttribute('aria-label','Dải màu '+name.toLowerCase());field.append(spectrum);
  let current=input.value.toLowerCase(),hsv=hexToHSV(current);const sliders=[];
  function emit(type='input'){input.value=hsvToHex(hsv);current=input.value;input.dispatchEvent(new Event(type,{bubbles:true}));paint();}
  const options=[['Đen','#202024'],['Trắng','#f8f4e9'],['Đỏ','#cb3548'],['Cam','#e9784b'],['Vàng','#dcb766'],['Xanh lá','#59966c'],['Xanh lam','#487dbe'],['Tím','#8856ad'],['Hồng','#d7789c'],['Nâu','#79513c']];
  const choices=options.map(([title,color])=>{const b=doc.createElement('button');b.type='button';b.className='beauty-swatch ray-color-chip';b.style.backgroundColor=color;b.setAttribute('aria-label',name+' · '+title);b.onclick=()=>{hsv=hexToHSV(color,hsv.h);emit();input.dispatchEvent(new Event('change',{bubbles:true}));};spectrum.append(b);return{button:b,color};});
  for(const [key,title,max]of [['h','Sắc màu',360],['s','Độ đậm màu',100],['v','Độ sáng màu',100]]){
   const row=doc.createElement('label');row.className='ray-color-row';const label=doc.createElement('span'),range=doc.createElement('input');label.textContent=title;range.type='range';range.min='0';range.max=String(max);range.step='1';range.dataset.colorAxis=key;range.setAttribute('aria-label',title+' · '+name.toLowerCase());range.oninput=()=>{hsv[key]=Number(range.value);emit();};range.onchange=()=>input.dispatchEvent(new Event('change',{bubbles:true}));row.append(label,range);field.append(row);sliders.push({key,range});
  }
  const hexRow=doc.createElement('label');hexRow.className='ray-color-hex';const hexLabel=doc.createElement('span'),hex=doc.createElement('input');hexLabel.textContent='Mã màu';hex.type='text';hex.maxLength=7;hex.autocomplete='off';hex.spellcheck=false;hex.setAttribute('aria-label','Mã hex · '+name.toLowerCase());hex.oninput=()=>{const valid=/^#[\da-f]{6}$/i.test(hex.value);hex.setAttribute('aria-invalid',String(!valid));if(valid){hsv=hexToHSV(hex.value,hsv.h);emit();}};hex.onchange=()=>input.dispatchEvent(new Event('change',{bubbles:true}));hexRow.append(hexLabel,hex);field.append(hexRow);
  const sourceLabel=input.closest('.beauty-custom');sourceLabel.hidden=true;sourceLabel.after(details);
  summary.addEventListener('click',e=>{if(input.disabled)e.preventDefault();});
  details.addEventListener('toggle',()=>{if(details.open)requestAnimationFrame(()=>{const scroll=details.closest('.scroll');if(scroll&&details.open)scroll.scrollTop+=details.getBoundingClientRect().top-scroll.getBoundingClientRect().top;});});
  function paint(){chip.style.backgroundColor=current;caption.textContent='Màu khác · '+current.toUpperCase();for(const {key,range}of sliders)range.value=String(Math.round(hsv[key]));if(doc.activeElement!==hex)hex.value=current.toUpperCase();for(const {button,color}of choices){const selected=color===current;button.classList.toggle('on',selected);button.setAttribute('aria-pressed',String(selected));}}
  function sync(){const next=input.value.toLowerCase();if(next!==current){current=next;hsv=hexToHSV(next,hsv.h);hex.value=next.toUpperCase();hex.removeAttribute('aria-invalid');}field.disabled=input.disabled;summary.setAttribute('aria-disabled',String(input.disabled));details.classList.toggle('unavailable',input.disabled);paint();}
  sync();return{sync,details,field,hex,sliders};
 }
 function init(){
  const app=document.querySelector('.film-workspace'),editors=beautyColors.map(({input})=>inlineColor(input)),grip=app.querySelector('.editor-tools-resize');
  const header=document.createElement('div');header.className='editor-tray-head';grip.before(header);header.append(grip);
  const toggle=document.createElement('button');toggle.type='button';toggle.className='editor-guide-toggle';header.append(toggle);let visible=false,lastTool=null,lastPart=null;
  const scroll=app.querySelector('.scroll'),pager=document.createElement('div');pager.className='editor-scroll-buttons';pager.setAttribute('role','group');pager.setAttribute('aria-label','Cuộn bảng công cụ');header.append(pager);
  scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Bảng công cụ chỉnh ảnh, cuộn dọc');
  const paging=[[-1,'↑','Cuộn công cụ lên'],[1,'↓','Cuộn công cụ xuống']].map(([direction,text,label])=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',label);b.setAttribute('aria-controls',scroll.id);b.onclick=()=>scroll.scrollBy({top:direction*Math.max(70,scroll.clientHeight*.72),behavior:'smooth'});pager.append(b);return b;});
  function syncScroll(){const max=scroll.scrollHeight-scroll.clientHeight;pager.hidden=scroll.hidden||max<2;paging[0].disabled=scroll.scrollTop<=1;paging[1].disabled=scroll.scrollTop>=max-1;}
  scroll.addEventListener('scroll',syncScroll,{passive:true});new ResizeObserver(syncScroll).observe(scroll);new MutationObserver(syncScroll).observe(scroll,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
  const category=()=>document.querySelector('.beauty-categories .active')?.dataset.category;
  function relevant(){return document.body.dataset.editorTool==='body'&&document.getElementById('bodyBox').dataset.bodyMode==='manual'||document.body.dataset.editorTool==='beauty'&&category()==='brow';}
  function sync(){
   const tool=document.body.dataset.editorTool;if(tool!==lastTool||tool==='body'&&BODY.sel!==lastPart){visible=false;lastTool=tool;lastPart=BODY.sel;}
   const active=relevant();app.classList.toggle('ray-position-guides',active&&visible);toggle.hidden=!active;toggle.disabled=tool==='body'?(!source||!BODY.sel):(!source||BEAUTY.busy||!BEAUTY.values.browStyle||BEAUTY.values.browStyle==='original');
   toggle.textContent=visible?'Xong vị trí':'Đặt vị trí';toggle.setAttribute('aria-label',visible?'Ẩn khung để xem ảnh':'Hiện khung để đặt vị trí');toggle.setAttribute('aria-pressed',String(visible));
   document.querySelector('.brow-manual').textContent='Đặt vị trí mày trên ảnh';document.querySelector('.brow-help').textContent='Chọn dáng và màu để xem trên ảnh. Bấm Đặt vị trí để kéo riêng từng bên; khi kéo thanh, khung tự ẩn để thấy kết quả.';
   for(const editor of editors)editor.sync();
   syncScroll();
  }
  function guides(on){visible=!!on;if(on&&document.body.dataset.editorTool==='body'){BODY.hide=false;syncBody();}sync();}
  window.RayEditorVisibility.guides=guides;
  toggle.onclick=()=>guides(!visible);
  const oldBodyUI=bodyUI;bodyUI=function(){oldBodyUI();sync();};const oldBeautyUI=beautyUI;beautyUI=function(){oldBeautyUI();sync();};
  const manual=document.querySelector('.brow-manual'),place=manual.onclick;manual.onclick=function(...args){const result=place.apply(this,args);guides(true);return result;};
  const bodyHide=document.getElementById('bodyHide');bodyHide.hidden=true;
  const oldDraw=draw;draw=function(){oldDraw();sync();};
  document.addEventListener('input',e=>{if(e.target.matches('input[type=range]')&&e.target.closest('#beautyBrow'))guides(false);},{capture:true});
  document.addEventListener('click',e=>{if(e.target.closest('.beauty-categories,.brow-style')){visible=false;sync();}},{capture:true});
  document.querySelector('.beauty-categories').addEventListener('click',sync);
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['data-editor-tool']});
  new MutationObserver(sync).observe(document.getElementById('bodyBox'),{attributes:true,attributeFilter:['data-body-mode']});
  const bodyHint=document.getElementById('bodyBox').querySelector(':scope > .hint');bodyHint.textContent='Chọn bộ phận rồi bấm Đặt vị trí ở đầu bảng để kéo hoặc xoay vùng chỉnh. Khi kéo thanh, khung tự ẩn; hiệu ứng vẫn giữ nguyên. Quay lại để hoàn tác.';
  sync();
 }
 return{hexToHSV,hsvToHex,inlineColor,init};
});
