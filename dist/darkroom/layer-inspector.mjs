/* Inspect stored values and replace numeric settings in place, preserving layer order. */
import {describeLayer,extraParameters,summarizeLayer} from './layer-parameters.mjs';
const text=(tag,value,cls='')=>{const e=document.createElement(tag);e.textContent=value;e.className=cls;return e;};
const button=(label,fn,cls='')=>{const e=text('button',label,cls);e.type='button';e.onclick=fn;return e;};
function parameterTable(description,{all=false,editing=false,limits={},inputs=[]}={}){
 const host=document.createElement('div');host.className='ray-parameter-groups';
 const rows=description.rows.filter(r=>all||editing||r.active||r.changed),groups=[...new Set(rows.map(r=>r.group))];
 for(const name of groups){
  const section=document.createElement('section');section.append(text('h3',name));const table=document.createElement('table');table.className='ray-parameter-table';table.setAttribute('aria-label','Thông số '+name);
  const body=document.createElement('tbody');for(const row of rows.filter(r=>r.group===name)){
   const tr=document.createElement('tr'),label=document.createElement('th'),value=document.createElement('td');label.scope='row';label.append(text('span',row.label));if(row.changed)label.append(text('small','Khác preset gốc ('+row.baseFormatted+')'));
   // Brush footprints keep size and softness on each stored stroke.
   if(editing&&limits[row.key]&&!['brushSize','brushSoftness'].includes(row.key)){
    const input=document.createElement('input'),range=limits[row.key];input.type='number';input.inputMode='decimal';input.min=range[0]*row.scale;input.max=range[1]*row.scale;input.step='any';input.value=String(Number((row.value*row.scale).toFixed(6)));input.dataset.initialValue=input.value;input.setAttribute('aria-label',row.label+' của lớp');input.required=true;inputs.push({input,row});value.append(input);if(row.unit)value.append(text('small',row.unit.trim()));
   }else value.append(text('strong',row.formatted));tr.append(label,value);body.append(tr);
  }table.append(body);section.append(table);host.append(section);
 }
 if(!rows.length)host.append(text('p','Các thông số màu đang ở mức gốc. Bật xem tất cả để thấy từng giá trị.','ray-layer-note'));
 return host;
}
function checkAll(action){const label=document.createElement('label');label.className='ray-layer-all';const input=document.createElement('input');input.type='checkbox';input.onchange=()=>action(input.checked);label.append(input,text('span','Hiện tất cả thông số, kể cả giá trị 0'));return label;}
export function recipeDetails(recipe){
 const details=document.createElement('details');details.className='my-recipe-details';details.append(text('summary','Công thức đã lưu · '+recipe.layers.length+' lớp'));
 details.append(text('p','Các thanh Cơ bản, Nhóm màu và Chất phim được giữ theo từng lớp. Giá trị không chỉnh là 0 hoặc mức mặc định.','my-hint'));
 const list=document.createElement('ol'),entries=[];let all=false;
 const refresh=()=>{for(const entry of entries){entry.values.replaceChildren(parameterTable(entry.description,{all}));}};
 details.append(checkAll(value=>{all=value;refresh();}),list);
 recipe.layers.forEach((p,i)=>{const meta=recipe.layerMeta?.[i],description=describeLayer({p,title:meta?.title||'Lớp '+(i+1),enabled:meta?.enabled},{basePreset:meta?.basePreset,portable:true}),li=document.createElement('li'),layer=document.createElement('details'),values=document.createElement('div');layer.className='ray-recipe-layer';
  layer.append(text('summary',description.title+(description.enabled?'':' · Đang ẩn')),text('p','Preset gốc: '+description.baseName+' · '+description.region,'my-hint'),values);li.append(layer);list.append(li);entries.push({values,description});
 });refresh();
 if(recipe.tools?.brush)details.append(text('p','Bút ánh sáng: '+recipe.tools.brush.ev+' EV · Cỡ '+Math.round(recipe.tools.brush.size*100)+' · Mềm viền '+Math.round(recipe.tools.brush.softness*100)+'. Nét bút giữ trong nháp ảnh.','my-hint'));
 return details;
}
export function initLayerInspector(){
 if(window.RayLayerInspector)return window.RayLayerInspector;
 const dialog=document.createElement('dialog');dialog.className='ray-layer-dialog';dialog.setAttribute('aria-labelledby','rayLayerTitle');document.body.append(dialog);
 let selected=null,description=null,original=null,all=false,editing=false,inputs=[],values,footer,status,allControl;
 const close=()=>dialog.close();
 function actions(){
  footer.replaceChildren();
  if(editing){footer.append(button('Hủy sửa',()=>{editing=false;render();}));const save=button('Lưu thông số lớp',null,'ray-layer-primary');save.type='submit';footer.append(save);}
  else footer.append(button('Đóng',close),button('Chỉnh thông số',()=>{editing=true;render();},'ray-layer-primary'));
 }
 function render(){
  inputs=[];values.replaceChildren(parameterTable(description,{all,editing,limits:window.RayLayers.valueLimits,inputs}));allControl.hidden=editing;status.textContent=editing?'Nhập giá trị theo thang của các thanh chỉnh. Bấm Lưu để cập nhật đúng lớp này.':'';actions();
 }
 function open(id){
  const list=window.RayLayers.capture(),i=list.findIndex(s=>s.id===id);if(i<0)return;
  selected=id;original=list[i];description=describeLayer(original);all=editing=false;inputs=[];dialog.replaceChildren();
  const form=document.createElement('form'),head=document.createElement('header'),title=text('h2','Lớp '+(i+1)+' · '+description.title);title.id='rayLayerTitle';const x=button('×',close);x.setAttribute('aria-label','Đóng thông số lớp');head.append(title,x);
  const body=document.createElement('div');body.className='ray-layer-body';body.append(text('p','Đây là các giá trị đã giữ khi áp dụng lớp. Lưu công thức giữ các lớp theo đúng thứ tự.','ray-layer-note'),text('p','Preset gốc: '+description.baseName+' · '+(description.enabled?'Đang hiện':'Đang ẩn'),'ray-layer-meta'),text('p',description.region,'ray-layer-meta'));
  if(original.title==='Tất cả')body.append(text('p','“Tất cả” là tên nhóm công cụ lúc áp dụng. Các thông số cụ thể nằm bên dưới.','ray-layer-note'));
  for(const info of extraParameters(original))body.append(text('p',info,'ray-layer-meta'));
  allControl=checkAll(value=>{all=value;render();});values=document.createElement('div');status=text('p','','ray-layer-status');status.setAttribute('role','status');footer=document.createElement('footer');body.append(allControl,values,status);form.append(head,body,footer);dialog.append(form);
  form.onsubmit=e=>{e.preventDefault();if(!editing)return;const patch={};for(const {input,row}of inputs)if(input.value!==input.dataset.initialValue)patch[row.key]=Number(input.value)/row.scale;
   try{const current=window.RayLayers.capture().find(s=>s.id===selected);if(current!==original)throw Error('Lớp đã thay đổi. Đóng và mở lại thông số trước khi sửa.');
    if(Object.keys(patch).length&&!window.RayLayers.setValues(selected,patch))throw Error('Chưa cập nhật được lớp. Chờ ảnh xử lý xong rồi lưu lại.');close();
    const host=window.parent!==window?window.parent.BuongToiHost:null;host?.toast?.('Đã giữ thông số lớp '+description.title+'. Lưu công thức để dùng màu này cho ảnh khác.');
   }catch(e){status.textContent=e.message;}
  };
  render();if(!dialog.open)dialog.showModal();
 }
 dialog.addEventListener('cancel',()=>{selected=null;});dialog.addEventListener('close',()=>{selected=null;inputs=[];original=null;});
 window.RayLayerInspector={open,summary:summarizeLayer};return window.RayLayerInspector;
}
