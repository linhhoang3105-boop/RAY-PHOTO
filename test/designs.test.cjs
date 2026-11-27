const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createCanvas,GlobalFonts}=require('@napi-rs/canvas');
const B=require('../dist/booth-core.js'),D=require('../dist/booth-designs.js');D.setCanvasFactory(createCanvas);
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf','Georgia');GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','Arial');
const out=path.join(require('node:os').tmpdir(),'pho-cang-photobooth-qa');fs.mkdirSync(out,{recursive:true});
const photos=['#c7c6a4','#c2a8a0','#9db5b5','#c7b795','#9fae9a','#c8a991'].map((color,i)=>{
 const image=createCanvas(800,600),x=image.getContext('2d');const gr=x.createLinearGradient(0,0,800,600);gr.addColorStop(0,color);gr.addColorStop(1,'#53665b');x.fillStyle=gr;x.fillRect(0,0,800,600);
 x.fillStyle='#f1d6ab';x.beginPath();x.ellipse(400,240,91,111,0,0,Math.PI*2);x.fill();x.fillStyle='#35473e';x.beginPath();x.ellipse(400,560,180,185,0,0,Math.PI*2);x.fill();x.fillStyle='#fff5de';x.font='italic 34px Georgia';x.fillText('memory 0'+(i+1),50,70);
 return{image,zoom:1,x:0,y:0,flip:false};
});
const base={theme:'cinema',layout:'strip',photoCount:4,photos,caption:'',date:'17.10.2026'};
test('40 reference-inspired theme/count/layout combinations agree with camera geometry and encode PNG',()=>{
 for(const theme of ['cinema','ticket','airmail','collage'])for(const photoCount of [2,3,4,5,6])for(const layout of ['grid','strip']){
  const state={...base,theme,photoCount,layout},c=createCanvas(1,1),g=B.render(c,state),expected=B.geometry(layout,null,photoCount,theme);
  assert.deepEqual(g,expected);assert.equal(g.slots.length,photoCount);assert.equal(c.width,g.width);assert.equal(c.height,g.height);
  for(const r of g.slots){assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=g.width&&r.y+r.h<=g.height);assert.equal(c.getContext('2d').getImageData(r.x+r.w/2,r.y+r.h/2,1,1).data[3],255);}
  const buffer=c.toBuffer('image/png');assert.deepEqual([...buffer.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  if((layout==='strip'&&photoCount===3)||(theme==='collage'&&photoCount===6&&layout==='grid'))fs.writeFileSync(path.join(out,`${theme}-${layout}-${photoCount}.png`),buffer);
 }
});
test('grain, flash, vignette and light leak are deterministic and preserve alpha',()=>{
 const w=80,h=60,flat=new Uint8ClampedArray(w*h*4);for(let i=0;i<flat.length;i+=4){flat[i]=flat[i+1]=flat[i+2]=110;flat[i+3]=i%12?255:127;}
 assert.deepEqual(B.applyPhotoFX(flat.slice(),w,h,{}),flat);
 for(const key of ['grain','flash','vignette','leak']){
  const e={[key]:80},a=B.applyPhotoFX(flat.slice(),w,h,e),b=B.applyPhotoFX(flat.slice(),w,h,e);assert.deepEqual(a,b);assert.notDeepEqual(a,flat);for(let i=3;i<a.length;i+=4)assert.equal(a[i],flat[i]);
  if(key==='grain')assert.ok(new Set(Array.from(a).filter((_,i)=>i%4===0)).size>10);
  if(key==='flash')assert.ok(a[(30*w+40)*4]>flat[(30*w+40)*4]);
  if(key==='vignette')assert.ok(a[0]<a[(30*w+40)*4]);
  if(key==='leak')assert.ok(a[(20*w+3)*4]>a[(20*w+77)*4]);
 }
});
test('3 and 6 photo templates round trip through automatic PNG window detection',()=>{
 for(const n of [3,6])for(const layout of ['grid','strip']){
  const c=createCanvas(1,1),g=B.render(c,{...base,theme:'newspaper',photoCount:n,layout,photos:[]}),x=c.getContext('2d');for(const r of g.slots)x.clearRect(r.x,r.y,r.w,r.h);
  assert.equal(B.detectHoles(x.getImageData(0,0,c.width,c.height)).length,n);
 }
});
test('all built-in frames honor edited titles, empty captions, and complete text removal',()=>{
 for(const theme of ['newspaper','harbor','scrapbook','midnight','cinema','ticket','airmail','collage']){
  const c=createCanvas(1,1),x=c.getContext('2d'),original=x.fillText.bind(x),labels=[];x.fillText=(s,...args)=>{labels.push(s);return original(s,...args);};
  const state={...base,theme,layout:'grid',title:'Ngày của Linh',subtitle:'Chúng mình thật xinh',caption:'',captionEdited:true};B.render(c,state);assert.ok(labels.some(s=>s.includes('Linh')||s==='Ngày của'),theme);assert.ok(!labels.includes(B.frameTextDefaults(theme).caption),theme);
  labels.length=0;B.render(c,{...state,showText:false});assert.equal(labels.length,0,theme);
 }
});
test('double vertical strips preserve capture count, duplicate the picture, and cap output memory',()=>{
 for(const theme of ['newspaper','cinema','ticket','airmail','collage'])for(const photoCount of [2,4,6]){
  const c=createCanvas(1,1),g=B.render(c,{...base,theme,photoCount,layout:'double'});assert.equal(g.slots.length,photoCount);assert.ok(c.width*c.height<=4006000);
  const r=g.slots[0],x=c.getContext('2d'),left=x.getImageData(r.x+r.w/2,r.y+r.h/2,1,1).data,right=x.getImageData(r.x+r.w/2+g.stripWidth+g.gap,r.y+r.h/2,1,1).data;
  for(let k=0;k<3;k++)assert.ok(Math.abs(left[k]-right[k])<5);
  if(theme==='cinema'&&photoCount===4)fs.writeFileSync(path.join(out,'cinema-double-4.png'),c.toBuffer('image/png'));
 }
});
test('travel newspaper frames have matching crop geometry, editable greeting/place, and removable text',()=>{
 for(const theme of ['hellonews','portnews'])for(const photoCount of [2,4,6])for(const layout of ['grid','strip','double']){
  const c=createCanvas(1,1),state={...base,theme,photoCount,layout,title:'Chào',subtitle:'Đà Lạt'},g=B.render(c,state,420),expected=B.geometry(layout,null,photoCount,theme);
  assert.equal(g.slots.length,photoCount);assert.deepEqual(g,expected);assert.equal(c.width,420);assert.equal(c.height,Math.round(g.height*420/g.width));assert.ok(g.slots.every(r=>r.x>=0&&r.y>=0&&r.x+r.w<=g.width&&r.y+r.h<=g.height));
  for(const r of g.slots){const d=c.getContext('2d').getImageData(Math.round((r.x+r.w/2)*420/g.width),Math.round((r.y+r.h/2)*420/g.width),1,1).data;assert.equal(d[3],255);}
  assert.deepEqual([...c.toBuffer('image/png').subarray(0,8)],[137,80,78,71,13,10,26,10]);
 }
 for(const theme of ['hellonews','portnews']){
  const c=createCanvas(1,1),ctx=c.getContext('2d'),draw=ctx.fillText.bind(ctx),labels=[];ctx.fillText=(s,...a)=>{labels.push(s);draw(s,...a);};const state={...base,theme,photoCount:2,layout:'grid',title:'Chào',subtitle:'Đà Lạt'};B.render(c,state,420);assert.ok(labels.includes('Chào Đà Lạt'));assert.ok(labels.includes(B.brandName));
  labels.length=0;B.render(c,{...state,title:'',subtitle:'Hải Phòng'},420);assert.ok(labels.includes('Hải Phòng'));assert.ok(!labels.some(s=>s.includes('Chào')));
  labels.length=0;B.render(c,{...state,showText:false},420);assert.equal(labels.length,0);
 }
});
