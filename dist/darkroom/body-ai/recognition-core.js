/* Optional local draft data: keep the exact AI contour, separate from edit history. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RayBodyRecognition=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 const dimensions=(w,h)=>Number.isInteger(w)&&Number.isInteger(h)&&w>0&&h>0&&w<=2048&&h<=2048;
 function fileKey(file){return file?JSON.stringify([file.name||'',file.size,file.lastModified,file.type||'']):null;}
 function encodeMask(mask){
  if(!mask)return null;const {width,height}=mask,a=mask.foreground;
  if(!dimensions(width,height)||!a||a.length!==width*height)return null;
  const raw=Uint8Array.from(a),runs=[];
  for(let i=0;i<raw.length;){const value=raw[i];let end=i+1;while(end<raw.length&&raw[end]===value&&end-i<65535)end++;runs.push(((end-i)<<8)|value);i=end;if(runs.length*4>=raw.length)return{width,height,encoding:'raw8',data:raw};}
  return{width,height,encoding:runs.length*4<raw.length?'rle8':'raw8',data:runs.length*4<raw.length?Uint32Array.from(runs):raw};
 }
 function decodeMask(saved){
  if(!saved||!dimensions(saved.width,saved.height))return null;
  const n=saved.width*saved.height,a=saved.data;if(!a||!(Array.isArray(a)||ArrayBuffer.isView(a))||!Number.isInteger(a.length)||a.length<1||a.length>n)return null;
  const foreground=new Uint8Array(n);
  if(saved.encoding==='raw8'){
   if(a.length!==n)return null;for(let i=0;i<n;i++){if(!Number.isInteger(a[i])||a[i]<0||a[i]>255)return null;foreground[i]=a[i];}
  }else if(saved.encoding==='rle8'){
   let offset=0;for(const run of a){if(!Number.isInteger(run)||run<256||run>16777215)return null;const count=run>>>8;if(offset+count>n)return null;foreground.fill(run&255,offset,offset+count);offset+=count;}if(offset!==n)return null;
  }else return null;
  return{width:saved.width,height:saved.height,foreground};
 }
 function regions(value,allowed,W,H){
  if(!value||typeof value!=='object')return null;const result={};
  for(const id of allowed){const p=value[id];if(!p)continue;
   if(!finite(p.cx,0,1)||!finite(p.cy,0,1)||!finite(p.rx,.00001,.7)||!finite(p.ry,.00001,.7)||!finite(p.rot,-360,360))return null;
   const r={cx:p.cx,cy:p.cy,rx:p.rx,ry:p.ry,rot:p.rot},s=p.rayPose;
   if(s){if(![s.a,s.b].every(q=>q&&finite(q.x,0,1)&&finite(q.y,0,1))||!finite(s.confidence,.5,1)||!finite(s.length,.00001,20))return null;
    const length=Math.hypot((s.b.x-s.a.x)*W/H,s.b.y-s.a.y);if(Math.abs(s.length-length)>1e-6)return null;
    r.rayPose={a:{x:s.a.x,y:s.a.y},b:{x:s.b.x,y:s.b.y},length:s.length,confidence:s.confidence};
   }result[id]=r;
  }
  return Object.keys(result).length?result:null;
 }
 function pack({people,selected,W,H,file,ui},allowed){
  if(!finite(W,1,100000)||!finite(H,1,100000))return null;
  const entries=[];for(const person of people.slice(0,6)){const r=regions(person.regions,allowed,W,H);if(!r)return null;
   entries.push({regions:r,x:person.x,y:person.y,area:person.area,personId:/^body-person-\d+$/.test(person.rayPersonId)?person.rayPersonId:null,hasPose:!!person.rayHasPose,mask:encodeMask(person.rayMask)});
  }
  return{version:1,W,H,file:fileKey(file),selected,people:entries,ui};
 }
 function unpack(saved,{W,H,file},allowed){
  if(!saved||saved.version!==1||saved.W!==W||saved.H!==H||saved.file!==fileKey(file)||!Array.isArray(saved.people)||saved.people.length>6)return null;
  const people=[];for(const p of saved.people){const r=regions(p.regions,allowed,W,H),mask=decodeMask(p.mask);
   if(!r||p.mask&&!mask||!finite(p.x,0,1)||!finite(p.y,0,1)||!finite(p.area,0,20))return null;
   people.push({regions:r,x:p.x,y:p.y,area:p.area,...(/^body-person-\d+$/.test(p.personId)?{rayPersonId:p.personId}:{}),rayHasPose:p.hasPose===true,rayMask:mask});
  }
  const selected=Number.isInteger(saved.selected)&&saved.selected>=0&&saved.selected<people.length?saved.selected:0;
  return{people,selected,ui:saved.ui&&typeof saved.ui==='object'?saved.ui:{}};
 }
 function failure(error,graphics){
  const text=String(error?.message||error||'');let reason;
  if(/webgl|egl|gl context|gpu|graphics|canvas context/i.test(text))reason='Trình duyệt chưa mở được xử lý đồ họa cho AI. Thử tải lại trang hoặc dùng trình duyệt khác.';
  else if(/timeout|time.?out|quá lâu|thời gian|abort/i.test(text))reason='Quét AI quá thời gian. Thử lại khi kết nối ổn định.';
  else if(/fetch|network|mạng|tải|load|import/i.test(text))reason='Chưa tải được AI. Kiểm tra kết nối rồi bấm quét lại.';
  else if(graphics===false)reason='Trình duyệt chưa mở được xử lý đồ họa cho AI. Thử tải lại trang hoặc dùng trình duyệt khác.';
  else reason='AI chưa xử lý được ảnh này. Thử quét lại hoặc dùng ảnh rõ hơn.';
  return reason+' Các chỉnh sửa đã giữ vẫn còn; có thể chuyển sang Từng vùng để chỉnh tay.';
 }
 return{fileKey,encodeMask,decodeMask,regions,pack,unpack,failure};
});
