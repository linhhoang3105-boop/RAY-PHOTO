/* v116: màu phim đo từ ảnh mẫu (Nắng Phố), Khử mờ và Chi tiết; engine nhúng gốc không đổi. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createCanvas}=require('@napi-rs/canvas');
const Clarity=require('../dist/darkroom/clarity-core.js'),Looks=require('../dist/darkroom/ray-film-looks.js'),Core=require('../dist/darkroom/ai-composer-core.js'),Recipes=require('../dist/darkroom/ai-composer-recipes.js'),Catalog=require('../dist/darkroom/preset-catalog.js');
const read=n=>fs.readFileSync(path.join(__dirname,'../dist/darkroom',n),'utf8'),lum=(d,i)=>(d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722)/255;
function image(W,H,fn){const data=new Uint8ClampedArray(W*H*4);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,c=fn(x,y);data[i]=c[0];data[i+1]=c[1];data[i+2]=c[2];data[i+3]=c[3]??255;}return{width:W,height:H,data};}
const copy=im=>({width:im.width,height:im.height,data:new Uint8ClampedArray(im.data)});
function stats(im,box,f=(d,i)=>lum(d,i)){const v=[];for(let y=box[1];y<box[3];y++)for(let x=box[0];x<box[2];x++)v.push(f(im.data,(y*im.width+x)*4));const m=v.reduce((a,b)=>a+b,0)/v.length;return{mean:m,sd:Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/v.length)};}
// Cảnh núi mờ sương ám tím: trời/mây sáng gần trung tính ngả lam-tím, núi có vân bị lớp sương phủ.
function hazy(){return image(240,160,(x,y)=>{if(y<50)return[200,202,226];if(y<70&&x%40<20)return[214,214,236];const tex=(x%6<3?14:-14)+(y%10<5?6:-6),veil=y<110?.55:.2,base=[60+tex,92+tex,70+tex];return base.map((v,c)=>Math.round(v*(1-veil)+[205,206,230][c]*veil));});}

test('zero levels keep pixels, alpha and dimensions exactly; transparent pixels stay untouched',()=>{
 const src=image(64,48,(x,y)=>[x*3,y*4,(x+y)*2,x<6?0:255]),a=copy(src);Clarity.apply(a,{dehaze:0,detail:0});assert.deepEqual(a.data,src.data);
 const b=copy(src);Clarity.apply(b,{dehaze:.8,detail:.8});for(let i=3;i<b.data.length;i+=4)assert.equal(b.data[i],src.data[i]);for(let y=0;y<48;y++)for(let x=0;x<6;x++){const i=(y*64+x)*4;assert.deepEqual([...b.data.subarray(i,i+3)],[...src.data.subarray(i,i+3)]);}
 const c=copy(src);Looks.apply(c,{look:'nangpho',strength:0});assert.deepEqual(c.data,src.data);
});
test('dehaze opens hazy texture, neutralizes a mid-tone purple cast and keeps dark detail and sky headroom',()=>{
 const src=hazy(),out=copy(src);Clarity.apply(out,{dehaze:.6});
 const land=[0,72,240,108],before=stats(src,land),after=stats(out,land);assert.ok(after.sd>before.sd*1.35,'hazy land texture gains real contrast: '+before.sd.toFixed(3)+' → '+after.sd.toFixed(3));
 const cast=(d,i)=>d[i+2]-(d[i]+d[i+1])/2,cloud=[0,0,240,48];assert.ok(stats(out,cloud,cast).mean<stats(src,cloud,cast).mean*.7,'purple/blue cast of neutral clouds is reduced');
 for(let i=0;i<out.data.length;i+=4)assert.ok(Math.max(out.data[i],out.data[i+1],out.data[i+2])<255||Math.max(src.data[i],src.data[i+1],src.data[i+2])>=250,'no new clipped highlights');
 const clear=image(120,80,(x,y)=>x%8<4?[40,60,30]:[180,170,150]),kept=copy(clear);Clarity.apply(kept,{dehaze:.6});assert.ok(Math.abs(stats(kept,[0,0,120,80]).mean-stats(clear,[0,0,120,80]).mean)<.06,'a clear, contrasty scene changes only mildly');
});
test('detail sharpens real edges, ignores flat areas and has no seams between processing strips',()=>{
 const W=200,H=300,src=image(W,H,(x,y)=>x<100?[90,90,90]:[150,150,150]),out=copy(src);Clarity.apply(out,{detail:.7});
 const edge=im=>Math.abs(lum(im.data,(150*W+101)*4)-lum(im.data,(150*W+98)*4));assert.ok(edge(out)>edge(src)*1.1,'edge contrast increases');
 assert.equal(lum(out.data,(150*W+20)*4),lum(src.data,(150*W+20)*4),'flat area unchanged');
 // Ảnh đồng nhất theo chiều dọc phải ra kết quả đồng nhất theo chiều dọc: ranh giới các dải 128 hàng không để lại vệt.
 for(let y=1;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,j=((y-1)*W+x)*4;assert.equal(out.data[i],out.data[j]);}
 const noisy=image(160,160,(x,y)=>{const n=((x*7919+y*104729)%13)-6;return[120+n,120+n,120+n];}),n2=copy(noisy);Clarity.apply(n2,{detail:.7});assert.ok(stats(n2,[0,0,160,160]).sd<stats(noisy,[0,0,160,160]).sd*1.6,'fine noise is cored rather than amplified like an unsharp mask');
});
test('Nắng Phố grades deep blacks, soft white roll-off, teal greens and protects skin from crushing',()=>{
 const grade=(rgb,s=1)=>Looks.grade(Looks.LOOKS.nangpho,...rgb.map(v=>v/255),s).map(v=>Math.round(v*255));
 const shadow=grade([70,70,70]),white=grade([255,255,255]),mid=grade([128,128,128]);assert.ok(shadow[1]<62,'shadows get denser: '+shadow);assert.ok(white[1]<248&&white[1]>225,'white rolls off softly instead of clipping: '+white);assert.ok(Math.abs(mid[1]-128)<14,'mid grey stays close');
 const green=grade([110,150,60]),hue=c=>Math.atan2(Math.sqrt(3)*(c[1]-c[2]),2*c[0]-c[1]-c[2])*180/Math.PI;assert.ok(hue(green)>hue([110,150,60])+3,'yellow-green turns toward teal');
 const Y=c=>c[0]*.2126+c[1]*.7152+c[2]*.0722,skin=grade([200,150,128]),wood=grade([110,80,66]);assert.ok(Y(skin)>=Y([200,150,128])-1,'lit skin is not crushed: '+skin);assert.ok(Y(wood)<Y([110,80,66])-4,'darker warm surfaces still deepen: '+wood);
 const im=image(33,33,(x,y)=>[x*8,y*8,(x*5+y*3)%256]),a=copy(im);Looks.apply(a,{look:'nangpho',strength:1});for(let k=0;k<200;k++){const i=((k*7)%(33*33))*4,direct=grade([im.data[i],im.data[i+1],im.data[i+2]]);for(let c=0;c<3;c++)assert.ok(Math.abs(a.data[i+c]-direct[c])<=3,'3D table matches the direct grade');}
});
function harness(){
 const script=read('index.html').match(/<script>([\s\S]*?)<\/script>/)[1].split('/* ============ nối dây giao diện ============ */')[0],make=()=>createCanvas(1,1);
 const h={document:{createElement:make,body:{classList:{contains:()=>false}}},view:{},beautyApply(){},BEAUTY:{peek:false,values:{},people:[],ready:{},maps:null,faces:[]}};h.window=h;vm.createContext(h);vm.runInContext(script,h);
 for(const n of ['ray-preset-thu-nhat.js','thu-nhat-adapter.js','clarity-core.js','clarity-adapter.js','ray-film-looks.js','film-looks-adapter.js'])vm.runInContext(read(n),h);vm.runInContext('this.e={P,render};',h);const defaults={...h.e.P,stamp:false,frame:'none'};
 return{e:h.e,draw(src,p={}){Object.assign(h.e.P,defaults,p);const out=make();h.e.render(out,src);return out;}};
}
test('native adapters add Khử mờ, Chi tiết and Nắng Phố without changing neutral renders or frames',()=>{
 const h=harness(),src=createCanvas(160,120),ctx=src.getContext('2d'),g=ctx.createLinearGradient(0,0,160,120);g.addColorStop(0,'#c9cbe2');g.addColorStop(.5,'#6d8070');g.addColorStop(1,'#2c3328');ctx.fillStyle=g;ctx.fillRect(0,0,160,120);ctx.fillStyle='#b98f78';ctx.fillRect(60,30,30,40);
 const px=c=>Buffer.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data),base=px(h.draw(src));
 assert.equal(h.e.P.dehaze,0);assert.equal(h.e.P.detail,0);assert.equal(h.e.P.rayNangPho,0);
 for(const p of [{dehaze:.6},{detail:.6},{rayNangPho:1}])assert.notDeepEqual(px(h.draw(src,p)),base,JSON.stringify(p));
 assert.deepEqual(px(h.draw(src,{dehaze:0,detail:0,rayNangPho:0})),base);
 const framed=h.draw(src,{frame:'polaroid',rayNangPho:1,detail:.5}),plain=h.draw(src,{frame:'polaroid'});assert.deepEqual([framed.width,framed.height],[plain.width,plain.height]);
 const recipe=Catalog.additions.find(r=>r.id==='nangpho');assert.equal(recipe.p.rayNangPho,1);assert.equal(Catalog.groupOf(recipe),'Trầm & sâu');
});
test('rescue styles add measured dehaze to the background and editable scene detail that survive recipe JSON',()=>{
 const make=(veil)=>{const W=160,H=120,data=new Uint8ClampedArray(W*H*4),foreground=new Uint8Array(W*H),skin=new Uint8Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x,person=x>60&&x<100&&y>30,face=person&&y<52;const tex=x%6<3?12:-12,bg=[70+tex,95+tex,80+tex].map((v,c)=>Math.round(v*(1-veil)+[210,210,232][c]*veil));data.set([...(person?(face?[96,70,60]:[60,58,62]):bg),255],i*4);foreground[i]=person?255:0;skin[i]=face?255:0;}return Core.analyze(data,W,H,{maps:{width:W,height:H,foreground,skin},faces:[[{x:.4,y:.26},{x:.62,y:.26},{x:.62,y:.43},{x:.4,y:.43}]]});};
 const misty=make(.6),clear=make(0);
 for(const style of ['backlight','restore-detail','film-recovery']){
  const m=Core.generate(misty,{style,seed:7,presets:[]})[0],c=Core.generate(clear,{style,seed:7,presets:[]})[0],depth=p=>p.components.find(x=>x.id==='depth').p;
  assert.ok(depth(m).dehaze>depth(c).dehaze+.1,style+': hazier background gets more dehaze');assert.equal(depth(m).adjustRegion,'out');
  const clarity=m.components.find(x=>x.id==='clarity');assert.ok(clarity.p.detail>.15,style+': scene detail present');
  const ids=m.components.map(x=>x.id);assert.ok(ids.indexOf('clarity')>ids.indexOf('face-0'),'detail follows tone and face recovery');if(style==='film-recovery')assert.ok(ids.indexOf('clarity')>ids.indexOf('film-background'));
  const restored=Recipes.decode(Recipes.encode(Recipes.create(m,{intensity:80})));assert.equal(restored.components.find(x=>x.id==='depth').p.dehaze,depth(m).dehaze);assert.equal(restored.components.find(x=>x.id==='clarity').p.detail,clarity.p.detail);
 }
 assert.ok(Core.generate(misty,{style:'restore-detail',seed:7,presets:[]})[0].components.find(x=>x.id==='clarity').p.detail>Core.generate(misty,{style:'backlight',seed:7,presets:[]})[0].components.find(x=>x.id==='clarity').p.detail,'restore mode is the sharper rescue');
 // Công thức đã lưu trước v116 (không có số đo sương) vẫn mở được.
 const plan=Core.generate(misty,{style:'restore-detail',seed:7,presets:[]})[0],old=JSON.parse(Recipes.encode(Recipes.create(plan)));for(const zone of Object.values(old.analysis?.recovery?.zones||{})){delete zone.darkMean;delete zone.chroma;}assert.doesNotThrow(()=>Recipes.decode(JSON.stringify(old)));
});
