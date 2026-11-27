/* Phố Cảng Photobooth — canvas composition, shared by preview and PNG export. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BoothCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const PALE = '#f4eedf', INK = '#292c27', RED = '#a83e30';
  const BRAND='Linh Linh - Phố Cảng';
  let designs=null;
  function setDesigns(value){designs=value;}
  let textState=null,textWidth=1200;
  const frameLabels={
    newspaper:{title:BRAND,subtitle:'CHUYỆN HÔM NAY: CHÚNG MÌNH THẬT XINH.',titles:[BRAND],subtitles:['CHUYỆN HÔM NAY: CHÚNG MÌNH THẬT XINH.'],caption:'Hôm nay lên báo vì quá xinh.'},
    harbor:{title:'Hải Phòng',subtitle:'THÀNH PHỐ HOA PHƯỢNG ĐỎ',caption:'Có hẹn với Hải Phòng.'},
    scrapbook:{title:'dear, today.',subtitle:'CẮT MỘT CHÚT HÔM NAY, DÁN VÀO NGÀY MAI.',caption:'gom những ngày thật xinh.'},
    midnight:{title:'AFTER HOURS',subtitle:'a night to remember',caption:'đêm nay, mình thật rực rỡ.'},
    custom:{title:'Những ngày thật xinh',subtitle:'OUR LITTLE PHOTO DIARY',subtitles:['OUR LITTLE PHOTO DIARY'],caption:'Một ngày đáng nhớ.'},
    cinema:{title:'Movie',subtitle:BRAND+'  /  KEEP THIS TICKET',caption:'ADMIT ONE MORE MEMORY'},
    ticket:{title:'Special Day',subtitle:'ONE BEAUTIFUL DAY',caption:'our special little day.'},
    airmail:{title:'POSTCARD',subtitle:'FROM HẢI PHÒNG, WITH LOVE',caption:'gửi một chút thương từ phố cảng.'},
    collage:{title:'little moments',subtitle:'THƯƠNG NHỮNG NGÀY BÌNH THƯỜNG',caption:'little things, big feelings.'},
    hellonews:{title:'HELLO',subtitle:'VIỆT NAM',caption:'Một chuyến đi, thật nhiều điều để nhớ.'},
    portnews:{title:'Bến',subtitle:'Bạch Đằng',caption:'Giữ một chút bình yên bên dòng sông.'}
  };
  function frameTextDefaults(theme){return frameLabels[theme]||frameLabels.newspaper;}
  function resolveFrameText(label,state){
    if(!state)return label;if(state.showText===false)return null;
    const f=frameTextDefaults(state.theme),titles=f.titles||[f.title],subtitles=f.subtitles||[f.subtitle];
    if(state.title!==undefined){
      if(state.theme==='ticket'&&(label==='Special'||label==='Day')){const words=state.title.trim().split(/\s+/),mid=Math.ceil(words.length/2);return(label==='Special'?words.slice(0,mid):words.slice(mid)).join(' ');}
      if(titles.includes(label))return state.title;
    }
    if(state.subtitle!==undefined){
      if(subtitles.includes(label)||/^\d TẤM ẢNH • MỘT NGÀY ĐẸP$/.test(label))return state.subtitle;
      if(state.theme==='collage'&&label.includes('THƯƠNG NHỮNG NGÀY BÌNH THƯỜNG'))return state.date+'   •   '+state.subtitle;
      if(state.theme==='ticket'&&label.includes('ONE BEAUTIFUL DAY'))return state.date+'   /   '+state.subtitle;
    }
    if(state.captionEdited&&label===f.caption)return state.caption;
    return label;
  }

  function geometry(style = 'grid', custom = null, photoCount = 4, theme = '') {
    if (custom && custom.mode === 'overlay' && custom.holes && custom.holes.length) {
      const width = Math.min(1600, custom.width);
      const height = Math.round(width * custom.height / custom.width);
      return { width, height, slots: custom.holes.map(h => ({ x:h.x*width, y:h.y*height, w:h.w*width, h:h.h*height })) };
    }
    const n=[2,3,4,5,6].includes(Number(photoCount))?Number(photoCount):4;
    if(style==='double'){
      const single=geometry('strip',null,n,theme),rawWidth=single.width*2+32,scale=Math.min(1,Math.sqrt(4e6/(rawWidth*single.height)));
      return{width:Math.round(rawWidth*scale),height:Math.round(single.height*scale),slots:single.slots.map(r=>({...r,x:r.x*scale,y:r.y*scale,w:r.w*scale,h:r.h*scale})),double:true,stripWidth:single.width*scale,gap:32*scale};
    }
    if(designs&&designs.supports(theme))return designs.geometry(style,n,theme);
    if (style === 'strip') return { width:800, height:246+n*528+(n-1)*24+220, slots:Array.from({length:n}, (_,i)=>({x:48,y:246+i*552,w:704,h:528})) };
    if(n===2) return { width:1200,height:1600,slots:[{x:56,y:350,w:532,h:798},{x:612,y:350,w:532,h:798}] };
    if(n===3) return { width:1200,height:1810,slots:[{x:56,y:350,w:1088,h:612},{x:56,y:986,w:532,h:399},{x:612,y:986,w:532,h:399}] };
    if(n===5) return { width:1200,height:2240,slots:[{x:56,y:350,w:1088,h:612},...Array.from({length:4},(_,i)=>({x:56+(i%2)*556,y:986+Math.floor(i/2)*423,w:532,h:399}))] };
    if(n===6) return { width:1200,height:2040,slots:Array.from({length:6},(_,i)=>({x:56+(i%2)*556,y:350+Math.floor(i/2)*423,w:532,h:399})) };
    return { width:1200, height:1600, slots:Array.from({length:4},(_,i)=>({x:56+(i%2)*556,y:350+Math.floor(i/2)*423,w:532,h:399})) };
  }

  // Coordinates are normalized so a crop survives a layout change.
  function cropRect(iw, ih, dw, dh, zoom = 1, panX = 0, panY = 0) {
    if (![iw, ih, dw, dh].every(v=>Number.isFinite(v) && v>0)) throw new Error('Invalid image dimensions');
    zoom = clamp(Number(zoom)||1, 1, 3);
    const scale = Math.max(dw/iw,dh/ih)*zoom;
    const w=dw/scale, h=dh/scale;
    return { x:clamp((iw-w)/2 + clamp(panX,-1,1)*(iw-w)/2,0,iw-w), y:clamp((ih-h)/2 + clamp(panY,-1,1)*(ih-h)/2,0,ih-h), w, h };
  }

  function applyFilter(data, kind) {
    if (kind === 'natural') return data;
    for (let i=0;i<data.length;i+=4) {
      const r=data[i],g=data[i+1],b=data[i+2];
      if (kind==='mono') {
        const l=clamp((.2126*r+.7152*g+.0722*b-128)*1.08+136,0,255);
        data[i]=data[i+1]=data[i+2]=l;
      } else if (kind==='film') {
        const l=.2126*r+.7152*g+.0722*b;
        data[i]=clamp((r*.82+l*.18)*.94+15,0,255);
        data[i+1]=clamp((g*.82+l*.18)*.94+9,0,255);
        data[i+2]=clamp((b*.82+l*.18)*.90+5,0,255);
      } else if (kind==='soft') {
        data[i]=clamp(r*.89+24,0,255); data[i+1]=clamp(g*.89+22,0,255); data[i+2]=clamp(b*.91+21,0,255);
      } else if(kind==='faded'){
        const l=.2126*r+.7152*g+.0722*b;
        data[i]=clamp((r*.78+l*.22)*.86+29,0,255);data[i+1]=clamp((g*.78+l*.22)*.87+24,0,255);data[i+2]=clamp((b*.78+l*.22)*.86+20,0,255);
      } else if(kind==='amber'){
        const l=.299*r+.587*g+.114*b;
        data[i]=clamp(r*.72+l*.28+16,0,255);data[i+1]=clamp(g*.8+l*.2+3,0,255);data[i+2]=clamp(b*.74+l*.26-12,0,255);
      } else if(kind==='cool'){
        data[i]=clamp((r-128)*.96+124,0,255);data[i+1]=clamp((g-128)*.96+131,0,255);data[i+2]=clamp((b-128)*.96+139,0,255);
      }
    }
    return data;
  }
  // Deterministic, resolution-independent finishes; preview/export reuse these pixels.
  function applyPhotoFX(data,width,height,effects={}){
    const grain=clamp(+effects.grain||0,0,100)/100,vignette=clamp(+effects.vignette||0,0,100)/100,flash=clamp(+effects.flash||0,0,100)/100,leak=clamp(+effects.leak||0,0,100)/100;
    if(!grain&&!vignette&&!flash&&!leak)return data;
    const xs=new Float32Array(width),lx=new Float32Array(width);
    for(let x=0;x<width;x++){xs[x]=(x/(width-1||1)-.5)*1.6;lx[x]=Math.exp(-Math.pow((x/width-.06)/.24,2));}
    for(let y=0;y<height;y++){
      const ny=(y/(height-1||1)-.45)*1.55,ly=Math.exp(-Math.pow((y/height-.3)/.65,2));
      for(let x=0;x<width;x++){
        const i=(y*width+x)*4,d=xs[x]*xs[x]+ny*ny;
        const shade=1-vignette*.50*clamp((d-.12)/1.2,0,1),lift=flash*.34*clamp(1-d*.25,.3,1),warm=leak*lx[x]*ly*.54;
        let seed=((x+1)*374761393)^((y+17)*668265263);seed=Math.imul(seed^(seed>>>13),1274126177);seed=(seed^(seed>>>16))>>>0;
        const noise=((seed&65535)/65535-.5)*grain*30;
        for(let k=0;k<3;k++){let v=data[i+k]*shade;v+=lift*(255-v);const tint=k===0?255:k===1?139:65;v=v*(1-warm)+tint*warm;data[i+k]=clamp(v+noise,0,255);}
      }
    }
    return data;
  }

  // Find enclosed, predominantly rectangular transparent windows in a PNG.
  function detectHoles(image) {
    const {width:w,height:h,data}=image, total=w*h;
    const seen=new Uint8Array(total), queue=new Int32Array(total), found=[];
    for(let start=0;start<total;start++) {
      if(seen[start] || data[start*4+3]>=48) continue;
      let head=0,tail=1,count=0,minX=w,minY=h,maxX=0,maxY=0,border=false;
      queue[0]=start;seen[start]=1;
      while(head<tail) {
        const p=queue[head++], x=p%w,y=Math.floor(p/w);count++;
        minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
        if(x===0||y===0||x===w-1||y===h-1) border=true;
        const neighbors=[x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1];
        for(const q of neighbors) if(q>=0&&!seen[q]&&data[q*4+3]<48){seen[q]=1;queue[tail++]=q;}
      }
      const bw=maxX-minX+1,bh=maxY-minY+1;
      if(!border&&bw>w*.10&&bh>h*.055&&count>total*.012&&count/(bw*bh)>.84) {
        found.push({x:minX/w,y:minY/h,w:bw/w,h:bh/h});
      }
    }
    found.sort((a,b)=>Math.abs(a.y-b.y)<.04?a.x-b.x:a.y-b.y);
    return found.length<=6 ? found : [];
  }

  function text(ctx, label, x, y, size, opts={}) {
    const resolved=resolveFrameText(label,textState);if(resolved===null||resolved==='')return;
    if(resolved!==label){opts={...opts,max:opts.max||textWidth-112};label=resolved;}
    ctx.save();ctx.fillStyle=opts.color||INK;ctx.textAlign=opts.align||'center';ctx.textBaseline='alphabetic';
    ctx.font=`${opts.italic?'italic ':''}${opts.bold?'700 ':''}${size}px ${opts.sans?'Arial, sans-serif':'Georgia, "Times New Roman", serif'}`;
    if(opts.max) {
      const m=ctx.measureText(label).width;
      if(m>opts.max) ctx.font=ctx.font.replace(`${size}px`,`${size*opts.max/m}px`);
    }
    ctx.fillText(label,x,y);ctx.restore();
  }
  function line(ctx,x,y,x2,y2,color=INK,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();}
  function bloom(ctx,x,y,s=1) {
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);
    for(let i=0;i<5;i++){ctx.save();ctx.rotate(i*Math.PI*2/5);ctx.fillStyle=i===0?'#c66442':RED;ctx.beginPath();ctx.ellipse(0,-28,19,33,0,0,Math.PI*2);ctx.fill();ctx.restore();}
    ctx.fillStyle='#e8bb68';ctx.beginPath();ctx.arc(0,0,9,0,Math.PI*2);ctx.fill();
    for(let i=0;i<5;i++){const a=i*1.3;line(ctx,0,0,Math.cos(a)*26,Math.sin(a)*26,'#e8bb68',2);}
    ctx.restore();
  }
  function star(ctx,x,y,size,color='#c06b4d',rotation=0){
    ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.fillStyle=color;ctx.beginPath();
    for(let i=0;i<8;i++){const a=i*Math.PI/4-Math.PI/2,r=i%2?size*.23:size;const px=Math.cos(a)*r,py=Math.sin(a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fill();ctx.restore();
  }
  function heart(ctx,x,y,size,color=RED){
    ctx.save();ctx.translate(x,y);ctx.scale(size/40,size/40);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,14);ctx.bezierCurveTo(-48,-14,-15,-42,0,-21);ctx.bezierCurveTo(15,-42,48,-14,0,14);ctx.fill();ctx.restore();
  }
  function tape(ctx,x,y,w,rotation,color='#dfbf888f'){
    ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(-w/2,-13);ctx.lineTo(w/2-6,-13);ctx.lineTo(w/2,-4);ctx.lineTo(w/2-4,5);ctx.lineTo(w/2,13);ctx.lineTo(-w/2,13);ctx.lineTo(-w/2+5,3);ctx.closePath();ctx.fill();
    for(let i=-w/2+7;i<w/2;i+=9)line(ctx,i,-11,i+7,11,'#fff5df40',1);ctx.restore();
  }
  function decoratedPaper(ctx,state,g){
    const {width:w,height:h}=g;
    if(state.theme==='scrapbook'){
      ctx.fillStyle='#f2e5dc';ctx.fillRect(0,0,w,h);
      for(let y=18;y<h;y+=31)line(ctx,0,y,w,y,'#b3937a15',1);
      for(let x=18;x<w;x+=31)line(ctx,x,0,x,h,'#b3937a10',1);
      ctx.fillStyle='#fffaf1';ctx.beginPath();ctx.moveTo(25,0);for(let y=0;y<h;y+=27)ctx.lineTo(25+(y%54?7:0),y);ctx.lineTo(0,h);ctx.lineTo(0,0);ctx.fill();
    }else if(state.theme==='midnight'){
      ctx.fillStyle='#1f3338';ctx.fillRect(0,0,w,h);
      for(let y=28;y<h-18;y+=58){ctx.fillStyle='#eee6cf';ctx.fillRect(14,y,15,27);ctx.fillRect(w-29,y,15,27);}
      line(ctx,38,18,38,h-18,'#c8a77970',1);line(ctx,w-38,18,w-38,h-18,'#c8a77970',1);
    }
  }
  function photoDecorations(ctx,state,g){
    if(state.theme==='scrapbook'){
      g.slots.forEach((r,i)=>tape(ctx,r.x+r.w*(i%2?.72:.29),r.y,Math.min(138,r.w*.25),i%2?.12:-.13,i%2?'#9fbaa9bd':'#dfb171b3'));
      const bottom=Math.max(...g.slots.map(r=>r.y+r.h));
      heart(ctx,g.width-84,bottom+55,24,'#a94739');star(ctx,75,bottom+58,22,'#92754c',.17);
    }else if(state.theme==='harbor'){
      const bottom=Math.max(...g.slots.map(r=>r.y+r.h));
      bloom(ctx,51,bottom+8,.42);bloom(ctx,g.width-49,bottom+8,.35);
      ctx.save();ctx.strokeStyle='#71846c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(40,bottom+40);ctx.quadraticCurveTo(22,bottom-8,37,bottom-70);ctx.stroke();ctx.restore();
    }else if(state.theme==='midnight'){
      g.slots.forEach((r,i)=>{ctx.fillStyle='#e6c68e';ctx.fillRect(r.x+r.w-43,r.y+r.h-29,43,29);text(ctx,String(i+1).padStart(2,'0'),r.x+r.w-21,r.y+r.h-8,16,{sans:true,color:'#26373a'});});
    }
  }
  function skyline(ctx,x,y,w,color=RED) {
    ctx.save();ctx.translate(x,y);ctx.scale(w/1000,w/1000);ctx.strokeStyle=color;ctx.lineWidth=3;ctx.lineJoin='round';
    line(ctx,0,100,1000,100,color,3);
    // A port, a cable-stayed bridge and a small waterfront street.
    for(const [bx,bw,bh] of [[35,72,65],[115,55,92],[180,85,70],[280,52,52]]){
      ctx.strokeRect(bx,100-bh,bw,bh);
      for(let wy=100-bh+14;wy<89;wy+=18)for(let wx=bx+12;wx<bx+bw-9;wx+=18)ctx.strokeRect(wx,wy,6,7);
    }
    line(ctx,430,100,430,-65,color,4);line(ctx,670,100,670,-65,color,4);
    line(ctx,365,70,735,70,color,3);
    for(let d=-60;d<=60;d+=20){line(ctx,430,-50,430+d,70,color,1.5);line(ctx,670,-50,670+d,70,color,1.5);}
    line(ctx,800,100,800,-40,color,4);line(ctx,780,-40,940,-40,color,4);line(ctx,800,-40,900,-85,color,3);line(ctx,900,-85,940,-40,color,3);line(ctx,930,-40,930,25,color,2);
    for(let i=0;i<3;i++) ctx.strokeRect(780+i*59,70,53,28);
    for(let yy=125;yy<168;yy+=20){for(let i=0;i<7;i++){ctx.beginPath();ctx.moveTo(i*154,yy);ctx.bezierCurveTo(i*154+25,yy-9,i*154+50,yy+9,i*154+80,yy);ctx.stroke();}}
    ctx.restore();
  }
  const quarterTurns=rotation=>((Math.round((Number(rotation)||0)/90)%4)+4)%4;
  function orientedSize(width,height,rotation=0){return quarterTurns(rotation)%2?{width:height,height:width}:{width,height};}
  function drawCover(ctx,img,x,y,w,h,crop={}) {
    const iw=img.naturalWidth||img.videoWidth||img.width,ih=img.naturalHeight||img.videoHeight||img.height;
    const turns=quarterTurns(crop.rotation),size=orientedSize(iw,ih,crop.rotation),c=cropRect(size.width,size.height,w,h,crop.zoom,crop.x,crop.y);
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
    if(!turns){if(crop.flip){ctx.translate(x+w,y);ctx.scale(-1,1);ctx.drawImage(img,c.x,c.y,c.w,c.h,0,0,w,h);}else ctx.drawImage(img,c.x,c.y,c.w,c.h,x,y,w,h);}
    else{
      // Crop/pan in the rotated image's coordinate space; mirror the final view.
      ctx.translate(x+(crop.flip?w:0),y);if(crop.flip)ctx.scale(-1,1);
      ctx.scale(w/c.w,h/c.h);ctx.translate(-c.x,-c.y);
      if(turns===1){ctx.translate(size.width,0);ctx.rotate(Math.PI/2);}
      else if(turns===2){ctx.translate(size.width,size.height);ctx.rotate(Math.PI);}
      else{ctx.translate(0,size.height);ctx.rotate(-Math.PI/2);}
      ctx.drawImage(img,0,0,iw,ih);
    }
    ctx.restore();
  }
  function paper(ctx,w,h){
    ctx.fillStyle=PALE;ctx.fillRect(0,0,w,h);
    ctx.fillStyle='rgba(91,74,45,.035)';
    for(let y=0;y<h;y+=9)for(let x=(y%2)*3;x<w;x+=11)ctx.fillRect(x,y,1,1);
  }
  function placeholder(ctx,r,i,theme) {
    ctx.fillStyle=theme==='harbor'?'#dde3d8':'#e3ddd1';ctx.fillRect(r.x,r.y,r.w,r.h);
    ctx.strokeStyle=theme==='harbor'?'#bac6b5':'#c8c0b1';ctx.lineWidth=1.5;
    const pad=22;ctx.strokeRect(r.x+pad,r.y+pad,r.w-2*pad,r.h-2*pad);
    text(ctx,String(i+1).padStart(2,'0'),r.x+r.w/2,r.y+r.h/2+13,50,{color:'#a8a28f',italic:true});
    text(ctx,'một khoảnh khắc của bạn',r.x+r.w/2,r.y+r.h/2+48,16,{color:'#8d8a7d',sans:true,max:r.w-45});
  }
  function header(ctx,state,g) {
    const {width:w}=g, strip=state.layout==='strip',theme=state.theme;
    if(theme==='scrapbook'){
      text(ctx,'THE LITTLE THINGS CLUB',w/2,strip?61:70,strip?17:23,{sans:true,color:'#806c53'});
      text(ctx,'dear, today.',w/2,strip?147:193,strip?83:120,{italic:true,color:'#a84639',max:w-125});
      text(ctx,'CẮT MỘT CHÚT HÔM NAY, DÁN VÀO NGÀY MAI.',w/2,strip?202:273,strip?15:21,{sans:true,color:'#806c53',max:w-130});
      if(!strip){text(ctx,'a page from our little life',w/2,318,24,{italic:true,color:'#8a9279'});heart(ctx,97,136,37);star(ctx,w-95,153,35,'#ab8557',.2);star(ctx,w-116,104,13,'#7f947b');}
      else{star(ctx,72,112,22,'#ab8557',.1);heart(ctx,w-78,140,24);}
    }else if(theme==='midnight'){
      text(ctx,BRAND,w/2,strip?56:66,strip?17:22,{sans:true,color:'#d3b47b',max:w-130});
      text(ctx,'AFTER HOURS',w/2,strip?142:183,strip?66:108,{bold:true,color:'#f3ecd9',max:w-130});
      text(ctx,'a night to remember',w/2,strip?194:259,strip?29:43,{italic:true,color:'#d3b47b'});
      line(ctx,70,strip?217:301,w-70,strip?217:301,'#d3b47b',1);
      if(!strip)text(ctx,'BẬT MỘT CHÚT LẤP LÁNH CHO NGÀY HÔM NAY',w/2,329,17,{sans:true,color:'#d3b47b',max:w-160});
      star(ctx,82,strip?103:151,strip?18:28,'#d3b47b');star(ctx,w-82,strip?103:151,strip?18:28,'#d3b47b');
    }else if(theme==='custom') {
      ctx.fillStyle='rgba(255,255,255,.84)';ctx.fillRect(w*.08,38,w*.84,strip?143:225);
      text(ctx,'OUR LITTLE PHOTO DIARY',w/2,strip?87:101,strip?17:22,{sans:true,max:w*.77});
      text(ctx,state.title||'Những ngày thật xinh',w/2,strip?148:190,strip?42:70,{italic:true,max:w*.76});
    } else if(theme==='harbor') {
      text(ctx,'MÌNH CÓ MỘT CUỘC HẸN',w/2,strip?55:65,strip?18:23,{sans:true,color:RED});
      text(ctx,'Hải Phòng',w/2,strip?139:184,strip?87:125,{italic:true,color:RED});
      text(ctx,'THÀNH PHỐ HOA PHƯỢNG ĐỎ',w/2,strip?185:239,strip?17:22,{sans:true,color:'#4e6656'});
      line(ctx,56,strip?212:286,w-56,strip?212:286,'#4e6656',2);
      if(!strip){bloom(ctx,92,154,.63);bloom(ctx,w-92,154,.63);text(ctx,'từ phố cảng, với thương mến.',w/2,320,24,{italic:true,color:'#4e6656'});}
    } else {
      line(ctx,48,37,w-48,37,INK,2);
      text(ctx,'NHẬT BÁO CỦA NHỮNG KHOẢNH KHẮC',w/2,strip?67:75,strip?16:23,{sans:true,max:w-100});
      text(ctx,BRAND,w/2,strip?145:180,strip?76:98,{bold:true,max:w-94});
      line(ctx,48,strip?168:211,w-48,strip?168:211,INK,4);line(ctx,48,strip?175:220,w-48,strip?175:220,INK,1);
      text(ctx,strip?`${g.slots.length} TẤM ẢNH • MỘT NGÀY ĐẸP`:'CHUYỆN HÔM NAY: CHÚNG MÌNH THẬT XINH.',w/2,strip?211:280,strip?18:30,{bold:true,max:w-100});
      if(!strip)text(ctx,'Ấn bản kỷ niệm  /  Hải Phòng, Việt Nam  /  '+state.date,w/2,318,18,{sans:true});
    }
  }
  function footer(ctx,state,g) {
    const {width:w,height:h}=g,strip=state.layout==='strip';
    const lastBottom=Math.max(...g.slots.map(r=>r.y+r.h)), base=lastBottom+(strip?55:74);
    const color=state.theme==='harbor'?RED:INK;
    if(state.theme==='scrapbook'){
      text(ctx,state.caption||'gom những ngày thật xinh.',w/2,base,strip?31:49,{italic:true,color:'#a84639',max:w-160});
      text(ctx,state.date+'  /  '+BRAND,w/2,base+(strip?39:51),strip?14:20,{sans:true,color:'#806c53',max:w-100});
      if(!strip){tape(ctx,200,h-113,158,-.1,'#9fbaa99c');text(ctx,'keep this feeling',w/2,h-111,39,{italic:true,color:'#7c8c71'});heart(ctx,w-159,h-105,32);star(ctx,96,h-79,20,'#ab8557');line(ctx,100,h-53,w-100,h-53,'#ad937a65',1);}
      else{text(ctx,'♡   KEEP THIS FEELING   ♡',w/2,h-47,16,{sans:true,color:'#806c53'});}
      return;
    }
    if(state.theme==='midnight'){
      text(ctx,state.caption||'đêm nay, mình thật rực rỡ.',w/2,base,strip?29:48,{italic:true,color:'#f3ecd9',max:w-150});
      text(ctx,state.date+'  •  ALL THE GOOD NIGHTS',w/2,base+(strip?41:54),strip?14:20,{sans:true,color:'#d3b47b',max:w-150});
      if(!strip){star(ctx,w/2,h-125,39,'#d3b47b');star(ctx,w/2-92,h-125,16,'#d3b47b');star(ctx,w/2+92,h-125,16,'#d3b47b');text(ctx,'ADMIT ONE  /  AN UNFORGETTABLE MOMENT',w/2,h-47,18,{sans:true,color:'#d3b47b',max:w-160});}
      else{text(ctx,'★  THIS NIGHT IS OURS  ★',w/2,h-47,16,{sans:true,color:'#d3b47b'});}
      return;
    }
    if(state.theme==='custom'){
      ctx.fillStyle='rgba(255,255,255,.87)';ctx.fillRect(w*.08,lastBottom+30,w*.84,h-lastBottom-58);
      text(ctx,state.caption||'Một ngày đáng nhớ.',w/2,base,strip?27:42,{italic:true,max:w*.77});
      text(ctx,state.date+'  •  '+BRAND,w/2,base+(strip?40:56),strip?17:22,{sans:true,max:w*.77});return;
    }
    if(state.theme==='harbor') {
      text(ctx,state.caption||'Có hẹn với Hải Phòng.',w/2,base,strip?32:51,{italic:true,color,max:w-100});
      text(ctx,state.date+'  •  '+BRAND,w/2,base+(strip?38:48),strip?15:19,{sans:true,color:'#4e6656',max:w-100});
      if(!strip){skyline(ctx,105,h-151,w-210);bloom(ctx,69,h-65,.48);bloom(ctx,w-69,h-65,.48);}
      else {line(ctx,75,h-49,w-75,h-49,'#4e6656',1);bloom(ctx,w-76,h-111,.35);}
    } else {
      line(ctx,48,lastBottom+28,w-48,lastBottom+28,INK,2);
      text(ctx,state.caption||'Hôm nay lên báo vì quá xinh.',w/2,base,strip?29:48,{italic:true,bold:true,max:w-112});
      if(strip){text(ctx,state.date+'  /  '+BRAND,w/2,base+43,17,{sans:true,max:w-100});line(ctx,48,h-39,w-48,h-39,INK,1);}
      else {
        const top=base+53;
        const cols=[['TIN VUI TRONG NGÀY','Một chút nắng, một nụ cười.','Gói lại những điều bé nhỏ,','giữ cho một ngày mai.'],['LƯU GIỮ KỶ NIỆM',`${g.slots.length} bức ảnh, một câu chuyện.`,'Để sau này khi nhìn lại,','vẫn nhớ mình đã vui.'],['CHUYỆN CỦA CHÚNG MÌNH','Hải Phòng, một ngày đẹp trời.','Có những khoảnh khắc','xứng đáng được in ra.']];
        cols.forEach((c,i)=>{const x=75+i*371;text(ctx,c[0],x,top,19,{bold:true,align:'left',sans:true,max:335});for(let j=1;j<c.length;j++)text(ctx,c[j],x,top+32*j,23,{align:'left',max:335});if(i<2)line(ctx,x+343,top-14,x+343,top+108,'#8d897c',1);});
        line(ctx,48,h-62,w-48,h-62,INK,1);text(ctx,state.date+'     •     '+BRAND+'     •     ẤN BẢN DUY NHẤT CỦA BẠN',w/2,h-31,17,{sans:true,max:w-100});
      }
    }
  }
  function render(canvas,state,outputWidth) {
    textState=state;textWidth=geometry(state.layout,state.theme==='custom'?state.custom:null,state.photoCount,state.theme).width;
    if(state.layout==='double'&&!(state.theme==='custom'&&state.custom?.mode==='overlay')){
      const g=geometry('double',null,state.photoCount,state.theme),ratio=(outputWidth||g.width)/g.width,off=designs.makeCanvas(1,1);
      render(off,{...state,layout:'strip'},Math.max(1,Math.round(g.stripWidth*ratio)));
      canvas.width=Math.round(g.width*ratio);canvas.height=Math.round(g.height*ratio);const c=canvas.getContext('2d');c.setTransform(ratio,0,0,ratio,0,0);c.fillStyle='#f6f0e3';c.fillRect(0,0,g.width,g.height);c.drawImage(off,0,0,g.stripWidth,g.height);c.drawImage(off,g.stripWidth+g.gap,0,g.stripWidth,g.height);c.strokeStyle='#9a9386';c.lineWidth=1;c.setLineDash([7,8]);c.beginPath();c.moveTo(g.stripWidth+g.gap/2,12);c.lineTo(g.stripWidth+g.gap/2,g.height-12);c.stroke();c.setLineDash([]);c.setTransform(1,0,0,1,0,0);off.width=off.height=1;return g;
    }
    if(designs&&designs.supports(state.theme))return designs.render(canvas,state,outputWidth);
    const custom=state.theme==='custom'?state.custom:null,g=geometry(state.layout,custom,state.photoCount,state.theme);
    const width=outputWidth||g.width, ratio=width/g.width;
    canvas.width=Math.round(width);canvas.height=Math.round(g.height*ratio);
    const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);
    const overlay=custom&&custom.mode==='overlay';
    if(overlay){ctx.fillStyle='#fff';ctx.fillRect(0,0,g.width,g.height);}
    else if(custom&&custom.image) drawCover(ctx,custom.image,0,0,g.width,g.height);
    else {paper(ctx,g.width,g.height);if(state.theme==='harbor'){ctx.fillStyle='#f4f1e5';ctx.fillRect(0,0,g.width,g.height);}}
    if(!overlay){decoratedPaper(ctx,state,g);header(ctx,state,g);}
    g.slots.forEach((r,i)=>{
      if(!overlay){const pad=state.theme==='scrapbook'?9:3;ctx.fillStyle=state.theme==='midnight'?'#e6c68e':state.theme==='scrapbook'||state.theme==='harbor'?'#fffdf6':INK;ctx.fillRect(r.x-pad,r.y-pad,r.w+pad*2,r.h+pad*2);}
      const p=state.photos[i];
      if(p&&p.image)drawCover(ctx,p.filtered||p.image,r.x,r.y,r.w,r.h,p);
      else placeholder(ctx,r,i,state.theme);
    });
    if(overlay)ctx.drawImage(custom.image,0,0,g.width,g.height);
    else {photoDecorations(ctx,state,g);footer(ctx,state,g);}
    ctx.setTransform(1,0,0,1,0,0);return g;
  }
  return { brandName:BRAND,geometry,cropRect,orientedSize,applyFilter,applyPhotoFX,detectHoles,render,drawCover,clamp,setDesigns,frameTextDefaults,resolveFrameText };
});
