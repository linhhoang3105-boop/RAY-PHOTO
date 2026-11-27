const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),vm=require('node:vm');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const Q=require('../dist/darkroom/quality-core.js');
test('original 12 MP is kept, each requested long edge is honored and small photos are never enlarged',()=>{
 const full=Q.plan(4032,3024);assert.equal(full.width,4032);assert.equal(full.height,3024);assert.equal(full.limited,false);
 for(const edge of [2048,1600,1080]){const s=Q.plan(4032,3024,edge);assert.equal(s.width,edge);assert.equal(s.height,edge*.75);}
 assert.deepEqual(Q.plan(300,400,2048),{width:300,height:400,scale:1,limited:false,requestedWidth:300,requestedHeight:400});
});
test('large-source memory limit is explicit and independent of preview resolution',()=>{
 const s=Q.plan(8000,6000);assert.equal(s.requestedWidth,8000);assert.equal(s.limited,true);assert.ok(s.width*s.height<=16005000);assert.ok(s.width>4000);assert.equal(Q.plan(8000,6000,2048).limited,false);
});
test('export renders original pixels once and a PNG round trip preserves fine detail and alpha exactly',async()=>{
 const src=createCanvas(600,400),c=src.getContext('2d'),im=c.createImageData(600,400);for(let i=0;i<im.data.length;i+=4){const p=i/4;im.data[i]=p%251;im.data[i+1]=(p*7)%253;im.data[i+2]=(p*13)%255;im.data[i+3]=p%3?255:140;}c.putImageData(im,0,0);let calls=0;
 const out=await Q.output({source:src,type:'image/png',make:()=>createCanvas(1,1),render(target,input){calls++;assert.equal(input,src);target.width=input.width;target.height=input.height;target.getContext('2d').drawImage(input,0,0);},encode:async(cv,type,q)=>{assert.equal(type,'image/png');assert.equal(q,.96);return new Blob([cv.toBuffer(type)],{type});}});
 const pic=await loadImage(Buffer.from(await out.blob.arrayBuffer())),decoded=createCanvas(600,400);decoded.getContext('2d').drawImage(pic,0,0);assert.equal(calls,1);assert.equal(out.width,600);assert.equal(out.height,400);assert.equal(src.width,600);assert.deepEqual(decoded.getContext('2d').getImageData(0,0,600,400).data,c.getImageData(0,0,600,400).data);
});
test('memory fallback reports actual dimensions, uses high-quality scaling and releases only owned canvases',async()=>{
 const source=Object.freeze({width:4032,height:3024}),made=[];let attempts=0;const make=()=>{const cv={width:1,height:1,context:{drawImage(){},imageSmoothingQuality:''},getContext(){return this.context;}};made.push(cv);return cv;};
 const out=await Q.output({source,make,render(cv,input){cv.width=input.width;cv.height=input.height;},encode:async()=>{if(!attempts++)throw new Error('memory');return new Blob(['ok']);}});assert.equal(out.fallback,true);assert.equal(out.width,3024);assert.equal(out.height,2268);assert.ok(made.every(c=>c.width===0&&c.height===0));assert.ok(made.some(c=>c.context.imageSmoothingQuality==='high'));assert.equal(source.width,4032);
});
test('a failed export keeps the original intact and surfaces failure after bounded retries',async()=>{
 const source=Object.freeze({width:100,height:200}),made=[];let n=0;await assert.rejects(Q.output({source,make:()=>{const c={width:1,height:1,getContext:()=>({drawImage(){}})};made.push(c);return c;},render(c,s){c.width=s.width;c.height=s.height;},encode:async()=>{n++;throw new Error('cannot encode');}}),/cannot encode/);assert.equal(n,3);assert.ok(made.every(c=>c.width===0));assert.equal(source.height,200);
});
test('the retained film engine is exact at zero and sharpening raises local edge contrast without resizing',()=>{
 const js=fs.readFileSync(path.join(__dirname,'../source/buong-toi-original.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split('/* ============ nối dây giao diện ============ */')[0],ctx={document:{createElement:()=>createCanvas(1,1)},view:{},beautyApply(){}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(js+'\nthis.e={P,render};',ctx);
 const src=createCanvas(240,160),x=src.getContext('2d');for(let k=0;k<24;k++){x.fillStyle=k%2?'#b4b4b4':'#323232';x.fillRect(k*10,0,10,160);}const before=x.getImageData(0,0,240,160).data,a=createCanvas(1,1),b=createCanvas(1,1);Object.assign(ctx.e.P,{stamp:false,frame:'none'});ctx.e.render(a,src);assert.deepEqual(a.getContext('2d').getImageData(0,0,240,160).data,before);ctx.e.P.sharp=1;ctx.e.render(b,src);const p=(cv,xx)=>cv.getContext('2d').getImageData(xx,80,1,1).data[0];assert.ok(p(b,10)-p(b,9)>p(a,10)-p(a,9));assert.equal(b.width,240);assert.equal(b.height,160);
});
