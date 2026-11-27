/* Original frames inspired by the user's visual references. */
(function(root,factory){
  const B=typeof module==='object'&&module.exports?require('./booth-core.js'):root.BoothCore;
  const api=factory(B);B.setDesigns(api);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.BoothDesigns=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(B){
  'use strict';
  const THEMES=['cinema','airmail','ticket','collage','hellonews','portnews'];let canvasFactory=null,activeState=null,activeWidth=1200;
  const isTravel=theme=>theme==='hellonews'||theme==='portnews';
  const supports=theme=>THEMES.includes(theme);
  function setCanvasFactory(factory){canvasFactory=factory;}
  function makeCanvas(w,h){
    if(canvasFactory)return canvasFactory(w,h);
    if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(w,h);
    const c=document.createElement('canvas');c.width=w;c.height=h;return c;
  }
  function geometry(style,n,theme){
    if(isTravel(theme))return travelGeometry(style,n,theme);
    if(style==='strip'){
      const w=900,top=theme==='cinema'||theme==='ticket'?360:theme==='airmail'?245:170,ph=585,gap=theme==='collage'?70:27,bottom=theme==='ticket'?250:190;
      return{width:w,height:top+n*ph+(n-1)*gap+bottom,slots:Array.from({length:n},(_,i)=>({x:60,y:top+i*(ph+gap),w:780,h:ph,angle:theme==='collage'?(i%2?.026:-.024):0}))};
    }
    if(theme==='collage'&&(n===5||n===6)){
      const slots=[{x:72,y:180,w:1056,h:520,angle:.014},{x:63,y:774,w:348,h:440,angle:-.026},{x:426,y:738,w:348,h:510,angle:.01},{x:789,y:774,w:348,h:440,angle:.026}];
      if(n===5)slots.push({x:72,y:1304,w:1056,h:390,angle:-.014});
      else slots.push({x:72,y:1304,w:510,h:390,angle:-.02},{x:618,y:1304,w:510,h:390,angle:.017});
      return{width:1200,height:1810,slots};
    }
    const g=B.geometry('grid',null,n);
    if(theme==='collage'){g.height-=120;g.slots=g.slots.map((r,i)=>({...r,y:r.y-100,angle:i%2?.025:-.025}));}
    return g;
  }
  function txt(c,s,x,y,size,{color='#3d2829',italic=false,bold=false,sans=false,max,align='center'}={}){
    const mapped=B.resolveFrameText(s,activeState);if(mapped===null||mapped==='')return;if(mapped!==s){s=mapped;max=max||activeWidth-130;}
    c.save();c.fillStyle=color;c.textAlign=align;c.textBaseline='alphabetic';c.font=`${italic?'italic ':''}${bold?'700 ':''}${size}px ${sans?'Arial, sans-serif':'Georgia, "Times New Roman", serif'}`;
    if(max){const m=c.measureText(s).width;if(m>max)c.font=c.font.replace(`${size}px`,`${size*max/m}px`);}c.fillText(s,x,y);c.restore();
  }
  function line(c,x,y,x2,y2,color='#6a1b2c',width=2,dash=[]){c.save();c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();c.restore();}
  function heart(c,x,y,s,color='#7d1f32'){c.save();c.translate(x,y);c.scale(s/40,s/40);c.fillStyle=color;c.beginPath();c.moveTo(0,15);c.bezierCurveTo(-45,-13,-15,-40,0,-20);c.bezierCurveTo(15,-40,45,-13,0,15);c.fill();c.restore();}
  function camera(c,x,y,s,color='#6a1b2c'){c.save();c.translate(x,y);c.rotate(.16);c.scale(s,s);c.fillStyle=color;c.fillRect(-42,-24,84,52);c.fillRect(-21,-34,32,12);c.strokeStyle='#fff8ed';c.lineWidth=3;c.beginPath();c.arc(5,1,19,0,Math.PI*2);c.stroke();c.beginPath();c.arc(5,1,12,0,Math.PI*2);c.stroke();c.fillStyle='#fff8ed';c.fillRect(-32,-16,10,5);c.restore();}
  function barcode(c,x,y,w,h){let at=x,i=0;c.fillStyle='#4b2030';while(at<x+w){const bw=2+(i*7%5);c.fillRect(at,y,bw,h-(i%5===0?0:8));at+=bw+2+(i*3%3);i++;}}
  function torn(c,x,y,w,h){c.beginPath();c.moveTo(x,y);for(let p=0;p<w;p+=21)c.lineTo(x+p,y+(Math.sin(p*1.7)*2.6));c.lineTo(x+w,y);for(let p=0;p<h;p+=21)c.lineTo(x+w+Math.cos(p)*2,y+p);c.lineTo(x+w,y+h);for(let p=w;p>0;p-=21)c.lineTo(x+p,y+h+Math.sin(p)*2.8);c.lineTo(x,y+h);for(let p=h;p>0;p-=21)c.lineTo(x+Math.cos(p)*2,y+p);c.closePath();}
  function softBackdrop(c,state,g){
    c.fillStyle='#657a70';c.fillRect(0,0,g.width,g.height);
    const p=state.photos.find(Boolean);
    if(p){
      const small=makeCanvas(48,Math.round(48*g.height/g.width)),cx=small.getContext('2d');B.drawCover(cx,p.filtered||p.image,0,0,small.width,small.height,p);
      let im=cx.getImageData(0,0,small.width,small.height),src=im.data;
      for(let pass=0;pass<3;pass++){const target=new Uint8ClampedArray(src.length);for(let y=0;y<small.height;y++)for(let x=0;x<small.width;x++)for(let k=0;k<4;k++){let sum=0,n=0;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const xx=B.clamp(x+dx,0,small.width-1),yy=B.clamp(y+dy,0,small.height-1);sum+=src[(yy*small.width+xx)*4+k];n++;}target[(y*small.width+x)*4+k]=sum/n;}src=target;}
      im.data.set(src);cx.putImageData(im,0,0);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(small,0,0,g.width,g.height);small.width=small.height=1;
    }else{const gr=c.createLinearGradient(0,0,g.width,g.height);gr.addColorStop(0,'#c2b6a0');gr.addColorStop(.5,'#6f887e');gr.addColorStop(1,'#a26e5b');c.fillStyle=gr;c.fillRect(0,0,g.width,g.height);}
    c.fillStyle='#12211f50';c.fillRect(0,0,g.width,g.height);
  }
  function paper(c,g,color='#fbf3df'){c.fillStyle=color;c.fillRect(0,0,g.width,g.height);c.fillStyle='#6c3b1710';for(let y=0;y<g.height;y+=9)for(let x=(y%2)*3;x<g.width;x+=13)c.fillRect(x,y,1,1);}
  function travelGeometry(style,n,theme){
    const top=theme==='portnews'?440:350;
    if(style==='strip'){const slots=Array.from({length:n},(_,i)=>({x:60,y:top+i*550,w:780,h:520})),articleY=top+n*550+40;return{width:900,height:articleY+350,slots,articleY,articleW:780,articleH:200};}
    const slots=[{x:60,y:top,w:1080,h:630}];
    if(n===2){slots.push({x:840,y:top+805,w:300,h:320,round:theme==='portnews'});return{width:1200,height:top+1370,slots,articleY:top+815,articleW:720,articleH:350,sidePhoto:true};}
    const cols=n===4?3:2,rows=Math.ceil((n-1)/cols),y0=top+735,cw=(1080-(cols-1)*36)/cols;
    for(let i=0;i<n-1;i++){const wide=n===6&&i===n-2;slots.push({x:wide?60:60+i%cols*(cw+36),y:y0+Math.floor(i/cols)*386,w:wide?1080:cw,h:354});}
    const articleY=y0+rows*386+55;return{width:1200,height:articleY+370,slots,articleY,articleW:1080,articleH:205};
  }
  function flag(c,x,y,w){
    c.fillStyle='#b84132';c.fillRect(x,y,w,w*.63);c.fillStyle='#ebc45b';c.beginPath();
    for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=w*(i%2?.085:.21),xx=x+w/2+Math.cos(a)*r,yy=y+w*.315+Math.sin(a)*r;i?c.lineTo(xx,yy):c.moveTo(xx,yy);}c.closePath();c.fill();
  }
  function waterfront(c,x,y,w,h){
    c.save();c.translate(x,y);c.scale(w/1080,h/205);c.beginPath();c.rect(0,0,1080,205);c.clip();const sky=c.createLinearGradient(0,0,0,205);sky.addColorStop(0,'#c8cebd');sky.addColorStop(.7,'#e8d6ad');sky.addColorStop(1,'#529496');c.fillStyle=sky;c.fillRect(0,0,1080,205);
    for(let i=0;i<30;i++){const bx=i*38-5,bh=40+(i*73%89);c.fillStyle=['#536e77','#748783','#8f9b8c'][i%3];c.fillRect(bx,155-bh,29,bh);c.fillStyle='#e9dfbf70';for(let yy=164-bh;yy<145;yy+=13)for(let xx=bx+5;xx<bx+25;xx+=10)c.fillRect(xx,yy,3,6);}
    c.fillStyle='#4a8d94';c.fillRect(0,155,1080,50);for(let i=0;i<20;i++){c.strokeStyle=i%2?'#cfdbc160':'#256a7b50';c.beginPath();c.moveTo(i*59,171+i%3*9);c.lineTo(i*59+38,171+i%3*9);c.stroke();}
    c.strokeStyle='#365661';c.lineWidth=3;c.beginPath();c.moveTo(750,116);c.lineTo(750,181);c.stroke();c.fillStyle='#f0e6c9';c.beginPath();c.moveTo(746,122);c.lineTo(704,169);c.lineTo(746,169);c.fill();c.fillStyle='#b75d42';c.beginPath();c.moveTo(699,178);c.lineTo(797,178);c.lineTo(775,192);c.lineTo(714,192);c.closePath();c.fill();c.restore();
  }
  function paragraph(c,content,x,y,w,maxLines,color){
    const size=18,lineHeight=27;c.save();c.font='18px Georgia';let current='',row=0;
    for(const word of content.split(/\s+/)){const next=current?current+' '+word:word;if(c.measureText(next).width>w&&current){txt(c,current,x,y+row*lineHeight,size,{align:'left',color,max:w});current=word;if(++row>=maxLines)break;}else current=next;}
    if(current&&row<maxLines)txt(c,current,x,y+row*lineHeight,size,{align:'left',color,max:w});c.restore();
  }
  function travelRender(c,state,g){
    const w=g.width,h=g.height,port=state.theme==='portnews',strip=state.layout==='strip',f=B.frameTextDefaults(state.theme),greeting=state.title??f.title,place=state.subtitle??f.subtitle,ink=port?'#284c59':'#353127',accent=port?'#315e69':'#964b35';
    paper(c,g,port?'#ece5cb':'#ead3ac');
    const shade=c.createLinearGradient(0,0,w,h);shade.addColorStop(0,'#9b5d2d17');shade.addColorStop(.35,'#fffbe831');shade.addColorStop(1,'#985c2f30');c.fillStyle=shade;c.fillRect(0,0,w,h);
    c.strokeStyle='#a17a4b66';c.lineWidth=2;c.strokeRect(23,23,w-46,h-46);line(c,w*.49,28,w*.49,h-28,'#fffaf440',2);line(c,w*.49+3,28,w*.49+3,h-28,'#7951270d',1);
    if(port){
      txt(c,[greeting,place].filter(Boolean).join(' '),w/2,145,strip?85:108,{italic:true,color:ink,max:w-120});
      waterfront(c,60,195,w-120,205);txt(c,'NHẬT KÝ NHỮNG CHUYẾN ĐI',w/2,422,14,{sans:true,color:ink,max:w-120});
    }else{
      line(c,60,65,w-60,65,ink,2);line(c,60,171,w-60,171,ink,2);line(c,60,179,w-60,179,ink,1);
      txt(c,'SPECIAL EDITION',w/2,97,16,{sans:true,color:ink});
      txt(c,place,w/2,147,strip?36:45,{bold:true,sans:true,color:ink,max:w*.48});flag(c,w*.18,108,strip?48:63);flag(c,w*.76,108,strip?48:63);
      txt(c,'BREAKING',w*.12,115,13,{italic:true,color:ink});txt(c,'MEMORIES',w*.12,138,13,{italic:true,color:ink});txt(c,'GOOD NEWS',w*.88,128,13,{italic:true,color:ink});
      txt(c,[greeting,place].filter(Boolean).join(' '),w/2,288,strip?76:95,{bold:true,sans:true,color:ink,max:w-120});
      line(c,60,316,w-60,316,ink,1);
    }
    for(let i=0;i<g.slots.length;i++){
      const r=g.slots[i],p=state.photos[i];c.save();c.fillStyle='#f9f1d8';c.fillRect(r.x-7,r.y-7,r.w+14,r.h+14);
      if(r.round){c.beginPath();c.ellipse(r.x+r.w/2,r.y+r.h/2,r.w/2,r.h/2,0,0,Math.PI*2);c.clip();}
      if(p?.image)B.drawCover(c,p.filtered||p.image,r.x,r.y,r.w,r.h,p);else{c.fillStyle=port?'#a8b7aa':'#b8ad96';c.fillRect(r.x,r.y,r.w,r.h);txt(c,String(i+1).padStart(2,'0'),r.x+r.w/2,r.y+r.h/2+17,48,{italic:true,color:'#fff5dc'});}c.restore();
      c.strokeStyle='#72655266';c.lineWidth=1;c.strokeRect(r.x-7,r.y-7,r.w+14,r.h+14);
    }
    const first=g.slots[0],captionY=first.y+first.h+58;
    // Stacked strips reserve the story beneath the complete photo sequence.
    if(!strip)txt(c,state.caption||f.caption,w/2,captionY,port?31:32,{bold:true,color:accent,max:w-120});
    const y=g.articleY,cols=g.sidePhoto?2:strip?2:3,cw=(g.articleW-(cols-1)*28)/cols;
    txt(c,strip?(state.caption||f.caption):'NHỮNG ĐIỀU MÌNH MUỐN NHỚ',60,y-27,strip?27:21,{bold:true,color:accent,max:g.articleW,align:'left'});
    const stories=[
      'Có những chuyến đi bắt đầu từ một lời hẹn rất nhỏ. Mình đi qua những con đường, ngắm một góc trời và giữ lại một nụ cười. Tấm ảnh này dành cho ngày hôm nay: một ngày bình thường, nhưng thật đáng nhớ. Có nhau trong khung hình, mọi nơi đều thành kỷ niệm.',
      'Một chút nắng trên vai, một câu chuyện chưa kể hết. Chúng mình chậm lại để nhìn thành phố, ghé một quán quen và gom những điều dễ thương. Mai này mở lại trang báo nhỏ này, mong vẫn nhớ cảm giác vui vẻ của chuyến đi. Gửi một chút thương vào từng khoảnh khắc.',
      'Không cần một dịp thật đặc biệt để lưu giữ điều mình thích. Có thể là bữa ăn ngon, một buổi chiều dịu dàng hay người đang ngồi bên cạnh. Hôm nay đã được cất vào đây, để những ngày sau còn có điều mà mỉm cười. Một trang nhỏ, một câu chuyện của riêng mình.'
    ];
    for(let i=0;i<cols;i++){paragraph(c,stories[i],60+i*(cw+28),y+10,cw,Math.floor((g.articleH-20)/27),ink);if(i)line(c,46+i*(cw+28),y-6,46+i*(cw+28),y+g.articleH-25,'#8d785b55',1);}
    if(g.sidePhoto){txt(c,'a little memory',990,g.slots[1].y+g.slots[1].h+38,25,{italic:true,color:accent,max:300});}
    line(c,60,h-98,w-60,h-98,ink,1);txt(c,B.brandName,w/2,h-57,strip?23:25,{bold:true,color:ink,max:w-120});txt(c,(state.date?state.date+'   /   ':'')+'PRINTED WITH LOVE',w/2,h-31,13,{sans:true,color:accent,max:w-120});
  }
  function backdrop(c,state,g){
    const {width:w,height:h}=g;
    if(state.theme==='collage'){softBackdrop(c,state,g);return;}
    if(state.theme==='cinema'){
      c.fillStyle='#383443';c.fillRect(0,0,w,h);c.fillStyle='#fff7e4';c.fillRect(22,18,w-44,h-36);
      for(let y=30;y<h-20;y+=24){c.fillStyle='#383443';c.beginPath();c.arc(22,y,4,0,Math.PI*2);c.arc(w-22,y,4,0,Math.PI*2);c.fill();}
      c.strokeStyle='#7e7560';c.lineWidth=2;c.strokeRect(40,38,w-80,h-76);return;
    }
    if(state.theme==='ticket'){
      c.fillStyle='#641327';c.fillRect(0,0,w,h);c.fillStyle='#faf1ec';c.fillRect(24,20,w-48,h-40);
      const ys=[28,...g.slots.map(r=>r.y-30),h-28];for(const y of ys){c.fillStyle='#641327';c.beginPath();c.arc(24,y,20,0,Math.PI*2);c.arc(w-24,y,20,0,Math.PI*2);c.fill();}
      return;
    }
    paper(c,g,'#f0e8cf');
    c.save();c.beginPath();c.rect(0,0,31,h);c.rect(w-31,0,31,h);c.rect(0,0,w,28);c.rect(0,h-28,w,28);c.clip();
    for(let y=-w;y<h+w;y+=86){c.fillStyle=(Math.round((y+w)/86)%2)?'#21465e':'#a94743';c.beginPath();c.moveTo(0,y);c.lineTo(w,y+w*.42);c.lineTo(w,y+w*.42+34);c.lineTo(0,y+34);c.closePath();c.fill();}c.restore();
  }
  function heading(c,state,g){
    const w=g.width,strip=state.layout==='strip';
    if(state.theme==='cinema'){
      txt(c,'Movie',w/2,153,112,{italic:true,color:'#39362b',max:w-140});
      txt(c,'◆  ◆  ◆',w/2,192,16,{color:'#39362b'});line(c,50,212,w-50,212,'#877f6d',1);
      const fields=[['NGÀY KỶ NIỆM',state.date],['HÀNG','01'],['KHOẢNH KHẮC',String(g.slots.length).padStart(2,'0')]];
      fields.forEach((f,i)=>{const x=50+(i+.5)*(w-100)/3;txt(c,f[0],x,247,14,{sans:true,max:(w-100)/3-15});txt(c,f[1],x,286,28,{bold:true,max:(w-100)/3-15});if(i)line(c,50+i*(w-100)/3,213,50+i*(w-100)/3,307,'#aaa18c',1);});line(c,50,308,w-50,308,'#877f6d',1);
    }else if(state.theme==='ticket'){
      txt(c,'Special',w/2-30,143,92,{italic:true,bold:true,color:'#641327',max:w-180});txt(c,'Day',w/2+90,220,91,{italic:true,bold:true,color:'#641327',max:w-180});
      camera(c,w-100,78,.62);heart(c,w-124,38,13);heart(c,98,113,16);line(c,65,290,w-65,290,'#641327',3,[12,10]);
      txt(c,state.date+'   /   ONE BEAUTIFUL DAY',w/2,328,17,{sans:true,color:'#641327',max:w-150});
    }else if(state.theme==='airmail'){
      const y=strip?102:132;txt(c,'POSTCARD',w*.44,y,strip?66:100,{bold:true,color:'#23445a',max:w*.70});
      txt(c,'FROM HẢI PHÒNG, WITH LOVE',w*.44,y+47,strip?18:23,{sans:true,color:'#a54843',max:w*.65});
      const sx=w-174,sy=strip?62:79,sz=strip?102:136;c.strokeStyle='#9c7e63';c.lineWidth=2;c.setLineDash([3,4]);c.strokeRect(sx-10,sy-10,sz,sz);c.setLineDash([]);
      c.fillStyle='#a9474330';c.fillRect(sx,sy,sz-20,sz-20);txt(c,'Linh Linh',sx+(sz-20)/2,sy+sz*.35,strip?15:21,{bold:true,color:'#a54843',max:sz-26});txt(c,'Phố Cảng',sx+(sz-20)/2,sy+sz*.65,strip?15:21,{bold:true,color:'#a54843',max:sz-26});
      for(let i=0;i<3;i++){c.strokeStyle='#23445a80';c.beginPath();c.moveTo(w-250,sy+sz+8+i*10);c.bezierCurveTo(w-200,sy+sz-8+i*10,w-140,sy+sz+25+i*10,w-70,sy+sz+7+i*10);c.stroke();}
      if(!strip)txt(c,'A LITTLE LETTER FROM OUR EVERYDAY LIFE',w/2,308,18,{sans:true,color:'#8b7862',max:w-140});
    }else{
      txt(c,'little moments',w/2,100,strip?65:80,{italic:true,color:'#fff9eb',max:w-140});txt(c,state.date+'   •   THƯƠNG NHỮNG NGÀY BÌNH THƯỜNG',w/2,140,strip?14:17,{sans:true,color:'#fff9eb',max:w-140});
    }
  }
  function slot(c,p,r,i,theme){
    c.save();c.translate(r.x+r.w/2,r.y+r.h/2);c.rotate(r.angle||0);const x=-r.w/2,y=-r.h/2;
    if(theme==='collage'){
      c.shadowColor='#0a191d70';c.shadowBlur=20;c.shadowOffsetY=9;c.fillStyle='#fff9ed';torn(c,x-12,y-12,r.w+24,r.h+24);c.fill();c.shadowColor='transparent';
    }else{c.fillStyle=theme==='ticket'?'#e6d5d1':'#fff9e9';c.fillRect(x-7,y-7,r.w+14,r.h+14);}
    if(p&&p.image)B.drawCover(c,p.filtered||p.image,x,y,r.w,r.h,p);
    else{c.fillStyle=theme==='ticket'?'#b9c3ae':'#b8c4b7';c.fillRect(x,y,r.w,r.h);txt(c,String(i+1).padStart(2,'0'),0,17,47,{italic:true,color:'#f5f0df'});}
    if(theme==='airmail'){c.fillStyle='#94816d';for(let xx=x-3;xx<x+r.w+3;xx+=18){c.beginPath();c.arc(xx,y-13,3,0,Math.PI*2);c.arc(xx,y+r.h+13,3,0,Math.PI*2);c.fill();}}
    c.restore();
  }
  function footer(c,state,g){
    const {width:w,height:h}=g,strip=state.layout==='strip',last=Math.max(...g.slots.map(r=>r.y+r.h));
    if(state.theme==='cinema'){
      txt(c,state.caption||'ADMIT ONE MORE MEMORY',w/2,h-78,strip?28:39,{bold:true,color:'#39362b',max:w-130});txt(c,B.brandName+'  /  KEEP THIS TICKET',w/2,h-45,strip?11:16,{sans:true,color:'#7e7560',max:w-120});
      if(!strip){barcode(c,w/2-145,h-260,290,72);txt(c,state.date,w/2,h-159,18,{sans:true,color:'#39362b'});}
    }else if(state.theme==='ticket'){
      line(c,65,last+35,w-65,last+35,'#641327',3,[12,10]);txt(c,state.caption||'our special little day.',w/2,last+87,strip?30:43,{italic:true,color:'#641327',max:w-145});barcode(c,w*.18,h-132,w*.64,65);txt(c,B.brandName,w/2,h-44,strip?13:17,{sans:true,color:'#641327',max:w-140});
    }else if(state.theme==='airmail'){
      txt(c,state.caption||'gửi một chút thương từ phố cảng.',w/2,last+70,strip?30:45,{italic:true,color:'#23445a',max:w-145});
      txt(c,state.date+'   /   '+B.brandName,w/2,last+110,strip?15:19,{sans:true,color:'#a54843',max:w-140});
      if(!strip){line(c,80,h-86,w-80,h-86,'#9d8c72',1);txt(c,'YOU ARE MY FAVOURITE POSTCARD.',w/2,h-47,18,{sans:true,color:'#23445a',max:w-160});}
    }else{
      txt(c,state.caption||'little things, big feelings.',w/2,h-63,strip?31:37,{italic:true,color:'#fff9eb',max:w-140});txt(c,B.brandName,w/2,h-27,strip?12:15,{sans:true,color:'#fff9eb',max:w-130});
      if(g.slots.length>=4){heart(c,45,last-12,18,'#fff9eb');heart(c,w-43,last-35,13,'#fff9eb');}
    }
  }
  function render(canvas,state,outputWidth){
    const g=geometry(state.layout,[2,3,4,5,6].includes(+state.photoCount)?+state.photoCount:4,state.theme),scale=(outputWidth||g.width)/g.width;
    activeState=state;activeWidth=g.width;
    canvas.width=Math.round(g.width*scale);canvas.height=Math.round(g.height*scale);const c=canvas.getContext('2d');c.setTransform(scale,0,0,scale,0,0);
    if(isTravel(state.theme))travelRender(c,state,g);else{backdrop(c,state,g);heading(c,state,g);g.slots.forEach((r,i)=>slot(c,state.photos[i],r,i,state.theme));footer(c,state,g);}c.setTransform(1,0,0,1,0,0);return g;
  }
  return{supports,geometry,render,setCanvasFactory,makeCanvas};
});
