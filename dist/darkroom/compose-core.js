/* Photo composition is separate from the original film renderer. */
(function(root,factory){const common=typeof module==='object'&&module.exports,api=factory(common?require('./brush-core.js'):root.RayBrush,common?require('./background-core.js'):root.RayBackgroundCore);if(common)module.exports=api;else root.RayComposeCore=api;})(typeof globalThis!=='undefined'?globalThis:this,(Brush,Scene)=>{
 'use strict';
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
 const fonts={sans:'"BT Sans", sans-serif',serif:'"BT Serif", serif',mono:'monospace',dancing:'"Dancing Script", "BT Serif", cursive',mali:'"Mali", "BT Sans", cursive',lora:'"Lora", "BT Serif", serif',montserrat:'"Montserrat", "BT Sans", sans-serif',playfair:'"Playfair Display", "BT Serif", serif',cormorant:'"Cormorant Garamond", "BT Serif", serif',patrick:'"Patrick Hand", "Mali", cursive'};
 const fontChoices=[
  {id:'sans',name:'Be Vietnam',note:'Hiện đại',group:'Thông dụng'},
  {id:'montserrat',name:'Montserrat',note:'Gọn gàng',group:'Thông dụng'},
  {id:'mono',name:'Máy chữ',note:'Mộc mạc',group:'Thông dụng'},
  {id:'serif',name:'Noto Serif',note:'Cổ điển',group:'Thơ & cổ điển'},
  {id:'lora',name:'Lora',note:'Thi ca',group:'Thơ & cổ điển'},
  {id:'playfair',name:'Playfair Display',note:'Thanh lịch',group:'Thơ & cổ điển'},
  {id:'cormorant',name:'Cormorant Garamond',note:'Hoài niệm',group:'Thơ & cổ điển'},
  {id:'dancing',name:'Dancing Script',note:'Mây viết tay',group:'Viết tay'},
  {id:'mali',name:'Mali',note:'Thư tay',group:'Viết tay'},
  {id:'patrick',name:'Patrick Hand',note:'Nhật ký',group:'Viết tay'}
 ];
 const textColors=[['Trắng','#ffffff'],['Vàng kem','#f4e5c7'],['Vàng nắng','#e7c778'],['Đen','#171717'],['Đỏ gạch','#af4f48'],['Hồng phấn','#e7b4b3'],['Xanh trời','#a6c9dc'],['Xanh lá dịu','#b6c7ae']];
 function textFont(text,size){return(text.italic?'italic ':'')+(text.bold?'600 ':'400 ')+size+'px '+(fonts[text.font]||fonts.serif);}
 function defaults(){return{background:{enabled:false,mode:'transparent',color:'#eee5d5',asset:null,zoom:1,x:.5,y:.5,softness:.18,mask:null,strokes:[],scene:Scene.defaults()},subjectMask:null,people:[],selectedPerson:null,texts:[],selected:null};}
 function signature(state){if(!state)return'';const b=state.background||{};return JSON.stringify({...state,subjectMask:state.subjectMask?.id||null,people:(state.people||[]).map(p=>({...p,asset:p.asset?.id||null,mask:p.mask?.id||null})),background:{...b,asset:b.asset?.id||null,mask:b.mask?.id||null,scene:Scene.signature(b.scene)}});}
 function coverRect(W,H,IW,IH,zoom=1,x=.5,y=.5){const s=Math.max(W/IW,H/IH)*clamp(zoom,1,3),w=IW*s,h=IH*s;return{x:-(w-W)*clamp(x),y:-(h-H)*clamp(y),width:w,height:h};}
 function sample(data,w,h,x,y){const u=clamp(x*w-.5,0,w-1),v=clamp(y*h-.5,0,h-1),x0=Math.floor(u),y0=Math.floor(v),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),fx=u-x0,fy=v-y0;return(data[y0*w+x0]*(1-fx)+data[y0*w+x1]*fx)*(1-fy)+(data[y1*w+x0]*(1-fx)+data[y1*w+x1]*fx)*fy;}
 function buildMask(background,W,H){
  const ratio=Math.min(1,768/Math.max(W,H)),width=Math.max(2,Math.round(W*ratio)),height=Math.max(2,Math.round(H*ratio)),data=new Uint8ClampedArray(width*height),base=background.mask,soft=clamp(background.softness,0,.5);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){let a=base?sample(base.data,base.width,base.height,(x+.5)/width,(y+.5)/height)/255:1;if(base&&!background.maskExact){if(background.scene){const t=clamp((a-.02)/.96),keep=.5+soft;a=a*keep+t*t*(3-2*t)*(1-keep);}else{const t=clamp((a-(.5-soft))/(Math.max(.02,soft*2)));a=t*t*(3-2*t);}}data[y*width+x]=Math.round(a*255);}
  for(const stroke of background.strokes||[]){const paint=Brush.raster([{...stroke,mode:'paint'}],width,height);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x,a=paint.sample(x,y);data[i]=stroke.mode==='erase'?data[i]*(1-a):Math.max(data[i],a*255);}}
  return{width,height,data};
 }
 function maskCanvas(mask,makeCanvas){const canvas=makeCanvas();canvas.width=mask.width;canvas.height=mask.height;const c=canvas.getContext('2d'),im=c.createImageData(mask.width,mask.height);for(let i=0;i<mask.data.length;i++){im.data[i*4]=im.data[i*4+1]=im.data[i*4+2]=255;im.data[i*4+3]=mask.data[i];}c.putImageData(im,0,0);return canvas;}
 function prepareSource(src,background,mask,bgImage,makeCanvas,retouch,cacheTag){
  if(background.scene)return Scene.compose(src,background,mask,bgImage,makeCanvas,retouch,cacheTag);
  const W=src.width,H=src.height,cv=makeCanvas();cv.width=W;cv.height=H;const c=cv.getContext('2d');c.drawImage(src,0,0);retouch?.(c,W,H);
  if(background.mode==='image'&&(!bgImage?.width||!bgImage?.height))return cv;
  c.globalCompositeOperation='destination-in';c.drawImage(mask,0,0,W,H);c.globalCompositeOperation='destination-over';
  if(background.mode==='image'&&bgImage){const r=coverRect(W,H,bgImage.width,bgImage.height,background.zoom,background.x,background.y);c.drawImage(bgImage,r.x,r.y,r.width,r.height);}
  else if(background.mode!=='transparent'){c.fillStyle=background.color||'#eee5d5';c.fillRect(0,0,W,H);}c.globalCompositeOperation='source-over';return cv;
 }
 function cutInterior(canvas,mask,W,H,bw=0){const c=canvas.getContext('2d');c.save();c.beginPath();c.rect(bw,bw,W,H);c.clip();c.globalCompositeOperation='destination-in';c.drawImage(mask,bw,bw,W,H);c.restore();}
 function personSize(person,image,W,H){const width=Math.min(W,H)*clamp(person.size??.45,.02,5);return{width,height:width*image.height/image.width};}
 function personPoint(person,image,W,H,u,v){const r=personSize(person,image,W,H),a=(person.angle||0)*Math.PI/180,x=(u-.5)*r.width*(person.flipX?-1:1),y=(v-.5)*r.height*(person.flipY?-1:1);return[person.x*W+x*Math.cos(a)-y*Math.sin(a),person.y*H+x*Math.sin(a)+y*Math.cos(a)];}
 function personUnproject(person,image,W,H,x,y){const r=personSize(person,image,W,H),a=(person.angle||0)*Math.PI/180,dx=x*W-person.x*W,dy=y*H-person.y*H;return[(dx*Math.cos(a)+dy*Math.sin(a))*(person.flipX?-1:1)/r.width+.5,(-dx*Math.sin(a)+dy*Math.cos(a))*(person.flipY?-1:1)/r.height+.5];}
 function resizePerson(person,image,W,H,dx,dy){const r=personSize(person,image,W,H),a=(person.angle||0)*Math.PI/180,x=(r.width*Math.cos(a)-r.height*Math.sin(a))/2,y=(r.width*Math.sin(a)+r.height*Math.cos(a))/2;return clamp(person.size*(1+(dx*x+dy*y)/Math.max(1,x*x+y*y)),.05,3);}
 function drawPerson(c,person,image,W,H){if(person.hidden||!image)return;const r=personSize(person,image,W,H);c.save();c.translate(Number(person.x)*W,Number(person.y)*H);c.rotate((person.angle||0)*Math.PI/180);c.scale(person.flipX?-1:1,person.flipY?-1:1);c.globalAlpha=clamp(person.opacity??1);c.drawImage(image,-r.width/2,-r.height/2,r.width,r.height);c.restore();}
 function orderPeople(people){return[...people.filter(p=>p.behindSubject),...people.filter(p=>!p.behindSubject)];}
 function movePerson(people,id,direction){
  const i=people.findIndex(p=>p.id===id);if(i<0||!['front','back'].includes(direction))return people;
  const out=people.slice(),[person]=out.splice(i,1);direction==='front'?out.push(person):out.unshift(person);return out;
 }
 function drawPeople(c,people,imageFor,W,H,subjectMask,makeCanvas){
  const behind=people.filter(p=>p.behindSubject&&!p.hidden);
  if(behind.length&&subjectMask){
   const layer=makeCanvas();layer.width=W;layer.height=H;const lc=layer.getContext('2d');
   for(const p of behind)drawPerson(lc,p,imageFor(p),W,H);
   lc.globalCompositeOperation='destination-out';lc.drawImage(subjectMask,0,0,W,H);c.drawImage(layer,0,0);layer.width=layer.height=0;
  }else for(const p of behind)drawPerson(c,p,imageFor(p),W,H);
  for(const p of people)if(!p.behindSubject)drawPerson(c,p,imageFor(p),W,H);
 }
 function textMetrics(c,text,W,H){const size=clamp(text.size,.002,5)*Math.min(W,H);c.font=textFont(text,size);const lines=String(text.text||'').slice(0,500).split('\n').slice(0,12),lineHeight=size*1.28,width=Math.max(size,...lines.map(line=>c.measureText(line).width));return{size,lines,lineHeight,width,height:lineHeight*lines.length};}
 function drawText(c,text,W,H){if(text.hidden||!String(text.text||'').trim())return;const m=textMetrics(c,text,W,H);c.save();c.translate((Number(text.x)||0)*W,(Number(text.y)||0)*H);c.rotate((Number(text.angle)||0)*Math.PI/180);c.scale(text.flipX?-1:1,text.flipY?-1:1);c.globalAlpha=clamp(text.opacity??1);c.textAlign='center';c.textBaseline='middle';c.fillStyle=/^#[0-9a-f]{6}$/i.test(text.color)?text.color:'#ffffff';c.lineJoin='round';if(text.shadow){c.shadowColor='rgba(0,0,0,.55)';c.shadowBlur=m.size*.12;c.shadowOffsetY=m.size*.06;}for(let i=0;i<m.lines.length;i++){const y=(i-(m.lines.length-1)/2)*m.lineHeight;if(text.outline){c.strokeStyle='#171717';c.lineWidth=m.size*.045;c.strokeText(m.lines[i],0,y);}c.fillText(m.lines[i],0,y);}c.restore();}
 return{defaults,signature,coverRect,buildMask,maskCanvas,prepareSource,cutInterior,personSize,personPoint,personUnproject,resizePerson,drawPerson,orderPeople,movePerson,drawPeople,textFont,textMetrics,drawText,fonts,fontChoices,textColors};
});
