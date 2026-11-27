const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const B=require('../dist/booth-core.js');
const {createCanvas,GlobalFonts}=require('@napi-rs/canvas');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf','Georgia');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','Arial');
const out=path.join(require('node:os').tmpdir(),'pho-cang-photobooth-qa');fs.mkdirSync(out,{recursive:true});

test('cover crops stay inside the original at every pan/zoom extreme',()=>{
  for(const [iw,ih] of [[4000,3000],[3000,4000],[1200,1200],[400,3000]])for(const [dw,dh] of [[532,399],[704,528],[250,520]])for(const zoom of [1,1.5,3])for(const x of [-1,0,1])for(const y of [-1,0,1]){
    const r=B.cropRect(iw,ih,dw,dh,zoom,x,y);
    assert.ok(r.x>=-1e-9&&r.y>=-1e-9&&r.x+r.w<=iw+1e-9&&r.y+r.h<=ih+1e-9);
    assert.ok(Math.abs(r.w/r.h-dw/dh)<1e-7);
  }
  assert.throws(()=>B.cropRect(0,300,400,300));
});
test('filters retain alpha and exported monochrome has equal RGB channels',()=>{
  for(const kind of ['natural','film','mono','soft']){
    const d=new Uint8ClampedArray([211,104,62,199,0,0,0,0,255,255,255,255]);
    B.applyFilter(d,kind);assert.equal(d[3],199);assert.equal(d[7],0);assert.equal(d[11],255);
    if(kind==='mono')for(let i=0;i<d.length;i+=4){assert.equal(d[i],d[i+1]);assert.equal(d[i+1],d[i+2]);}
  }
});
test('quarter-turn rotation keeps correct corners, mirror order and filled crops at every pan extreme',()=>{
 const source=createCanvas(80,40),x=source.getContext('2d'),colors=['#ff0000','#00ff00','#0000ff','#ffff00'];for(let i=0;i<4;i++){x.fillStyle=colors[i];x.fillRect(i%2*40,Math.floor(i/2)*20,40,20);}
 const rgb=[[255,0,0],[0,255,0],[0,0,255],[255,255,0]],orders={0:[0,1,2,3],90:[2,0,3,1],180:[3,2,1,0],270:[1,3,0,2]};
 for(const rotation of [0,90,180,270])for(const flip of [false,true]){
  const size=B.orientedSize(80,40,rotation),c=createCanvas(size.width,size.height);B.drawCover(c.getContext('2d'),source,0,0,c.width,c.height,{rotation,flip});const order=orders[rotation],corners=[[4,4],[c.width-5,4],[4,c.height-5],[c.width-5,c.height-5]];
  corners.forEach(([px,py],i)=>assert.deepEqual(Array.from(c.getContext('2d').getImageData(px,py,1,1).data),[...rgb[order[flip?i^1:i]],255]));
  for(const [w,h]of[[90,140],[140,90]])for(const zoom of[1,2.5])for(const panX of[-1,1])for(const panY of[-1,1]){const out=createCanvas(w,h);B.drawCover(out.getContext('2d'),source,0,0,w,h,{rotation,flip,zoom,x:panX,y:panY});for(const[px,py]of[[2,2],[w-3,2],[2,h-3],[w-3,h-3],[w/2,h/2]])assert.equal(out.getContext('2d').getImageData(px,py,1,1).data[3],255);}
 }
 assert.deepEqual(B.orientedSize(80,40,-90),{width:40,height:80});assert.deepEqual(B.orientedSize(80,40,360),{width:80,height:40});
});
test('PNG window detection ignores transparent margins and keeps reading order',()=>{
  const c=createCanvas(300,400),ctx=c.getContext('2d');ctx.fillStyle='#ad342f';ctx.fillRect(10,10,280,380);
  const slots=[{x:25,y:60,w:115,h:135},{x:160,y:60,w:115,h:135},{x:25,y:215,w:115,h:135},{x:160,y:215,w:115,h:135}];
  for(const r of slots)ctx.clearRect(r.x,r.y,r.w,r.h);
  const holes=B.detectHoles(ctx.getImageData(0,0,300,400));assert.equal(holes.length,4);
  holes.forEach((h,i)=>{assert.equal(h.x,slots[i].x/300);assert.equal(h.y,slots[i].y/400);assert.equal(h.w,slots[i].w/300);});
  ctx.clearRect(0,0,300,400);assert.equal(B.detectHoles(ctx.getImageData(0,0,300,400)).length,0);
});

function scene(color,label){
  const c=createCanvas(1000,750),x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,1000,750);
  const sky=x.createLinearGradient(0,0,0,750);sky.addColorStop(0,'#fff6da00');sky.addColorStop(1,'#112b2d55');x.fillStyle=sky;x.fillRect(0,0,1000,750);
  x.fillStyle='#f0dca9';x.beginPath();x.arc(740,160,70,0,Math.PI*2);x.fill();
  x.fillStyle='#2a443d';x.fillRect(0,545,1000,205);for(let i=0;i<10;i++){const h=50+(i*41)%150;x.fillRect(i*110,545-h,70,h);}
  x.fillStyle='#fcf3dc';x.font='italic 55px Georgia';x.fillText(label,65,110);return c;
}
const photos=['#b9c2ac','#a0b5ba','#c5b092','#b2a5a3','#cbb778'].map((c,i)=>({image:scene(c,['hello, sunshine','a little slow day','from Hải Phòng','with love','make it golden'][i]),zoom:1,x:0,y:0,flip:false}));
const base={theme:'newspaper',layout:'grid',filter:'natural',photos,caption:'Một ngày thật xinh.',date:'17.10.2026',custom:null};
test('all 30 theme/layout/count combinations export valid PNGs with exact dimensions and filled photo areas',()=>{
  for(const theme of ['newspaper','harbor','scrapbook','midnight','custom'])for(const layout of ['grid','strip'])for(const photoCount of [2,4,5]){
    const c=createCanvas(1,1),state={...base,theme,layout,photoCount};if(theme==='custom')state.custom={mode:'background',image:scene('#a5b7bf','our photo diary')};
    const g=B.render(c,state);assert.equal(c.width,g.width);assert.equal(c.height,g.height);
    assert.equal(g.slots.length,photoCount);
    const ctx=c.getContext('2d');for(const r of g.slots){assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=c.width&&r.y+r.h<=c.height);const d=ctx.getImageData(r.x+r.w/2,r.y+r.h/2,1,1).data;assert.equal(d[3],255);}
    const buffer=c.toBuffer('image/png');assert.deepEqual([...buffer.subarray(0,8)],[137,80,78,71,13,10,26,10]);
    fs.writeFileSync(path.join(out,`${theme}-${layout}-${photoCount}.png`),buffer);
  }
});
test('all 2/4/5 layouts have separated slots and custom templates retain the selected count',()=>{
  for(const style of ['grid','strip'])for(const n of [2,4,5]){
    const g=B.geometry(style,null,n);assert.equal(g.slots.length,n);
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const a=g.slots[i],b=g.slots[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);}
    const c=createCanvas(1,1);B.render(c,{...base,layout:style,photoCount:n,photos:[]});const ctx=c.getContext('2d');for(const r of g.slots)ctx.clearRect(r.x,r.y,r.w,r.h);
    const holes=B.detectHoles(ctx.getImageData(0,0,c.width,c.height));assert.equal(holes.length,n,`${style} ${n}`);
  }
});
test('preview and exported pixels use the same composition geometry',()=>{
  const full=createCanvas(1,1),small=createCanvas(1,1);B.render(full,base);B.render(small,base,480);
  assert.equal(small.height,640);const a=full.getContext('2d'),b=small.getContext('2d');
  for(const r of B.geometry('grid').slots){const x=r.x+r.w*.45,y=r.y+r.h*.3,one=a.getImageData(x,y,1,1).data,two=b.getImageData(x*.4,y*.4,1,1).data;for(let k=0;k<3;k++)assert.ok(Math.abs(one[k]-two[k])<=2);}
});
test('transparent template round trips through detection and overlay rendering',()=>{
  const template=createCanvas(1,1),g=B.render(template,{...base,photos:[]});const ctx=template.getContext('2d');for(const r of g.slots)ctx.clearRect(r.x,r.y,r.w,r.h);
  const holes=B.detectHoles(ctx.getImageData(0,0,template.width,template.height));assert.equal(holes.length,4);
  const custom={mode:'overlay',image:template,width:template.width,height:template.height,holes};
  const c=createCanvas(1,1);const layout=B.render(c,{...base,theme:'custom',custom});assert.equal(layout.slots.length,4);
  const r=layout.slots[0];assert.equal(c.getContext('2d').getImageData(r.x+20,r.y+20,1,1).data[3],255);
  fs.writeFileSync(path.join(out,'transparent-template.png'),template.toBuffer('image/png'));
  fs.writeFileSync(path.join(out,'overlay-roundtrip.png'),c.toBuffer('image/png'));
});
test('arbitrary 1–6 photo overlay sizes retain source aspect ratio',()=>{
  for(let n=1;n<=6;n++){
    const holes=Array.from({length:n},(_,i)=>({x:.1,y:.05+i*.9/n,w:.8,h:.8/n}));
    const g=B.geometry('grid',{mode:'overlay',width:2400,height:3600,holes});assert.equal(g.width,1600);assert.equal(g.height,2400);assert.equal(g.slots.length,n);
  }
});
