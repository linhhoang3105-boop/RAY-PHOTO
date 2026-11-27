const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createCanvas}=require('@napi-rs/canvas');
const Brush=require('../dist/darkroom/brush-core.js'),Tone=require('../dist/darkroom/tone-core.js'),Layers=require('../dist/darkroom/effect-layers.js'),{Timeline}=require('../dist/darkroom/edit-history.js');
const f={cx:.5,cy:.5,rx:.2,ry:.2},stroke=(points,extra={})=>({mode:'paint',size:.12,softness:0,points,...extra}),settings=p=>({...Tone.defaults,...p});
function image(W=200,H=160){const data=new Uint8ClampedArray(W*H*4);for(let i=0;i<data.length;i+=4)data.set([80,95,100,255],i);return data;}
const sample=(data,x,y,W=200)=>Array.from(data.slice((y*W+x)*4,(y*W+x)*4+4));
test('an empty brush, zero EV or an eraser alone leaves every original byte unchanged',()=>{
 for(const p of [{},{brushEV:0,brushStrokes:[stroke([[.5,.5]])]},{brushStrokes:[stroke([[.5,.5]],{mode:'erase'})]}]){const d=image(),before=new Uint8ClampedArray(d);Tone.applyPixels(d,200,160,settings(p),f);assert.deepEqual(d,before);}
 assert.equal(Layers.active({...Tone.defaults}),false);
});
test('fast freehand segments remain continuous around a corner and affect only the painted area',()=>{
 const d=image(),p=settings({brushEV:1,brushStrokes:[stroke([[.15,.2],[.8,.2],[.8,.75]])]});Tone.applyPixels(d,200,160,p,f);
 for(let x=30;x<=160;x++)assert.ok(sample(d,x,32)[0]>80);
 for(let y=32;y<=120;y++)assert.ok(sample(d,160,y)[0]>80);
 assert.deepEqual(sample(d,30,120),[80,95,100,255]);
});
test('the same freehand mask supports positive and negative exposure with preserved alpha',()=>{
 for(const ev of [-1,1]){const d=image();d[(80*200+100)*4+3]=127;Tone.applyPixels(d,200,160,settings({brushEV:ev,brushStrokes:[stroke([[.5,.5]])]}),f);assert.ok(ev>0?sample(d,100,80)[0]>80:sample(d,100,80)[0]<80);assert.equal(sample(d,100,80)[3],127);}
});
test('a soft brush has a smooth edge and an eraser cuts a hole without deleting the surrounding paint',()=>{
 const paint=stroke([[.5,.5]],{size:.5,softness:.8}),mask=Brush.raster([paint],200,160),weights=[0,8,16,24,32,40].map(dx=>mask.sample(99.5+dx,79.5));assert.ok(weights[0]>.99);assert.ok(weights.some(w=>w>0&&w<1));for(let i=1;i<weights.length;i++)assert.ok(weights[i]<=weights[i-1]);
 const erase=stroke([[.5,.5]],{mode:'erase',size:.12}),cut=Brush.raster([paint,erase],200,160);assert.equal(cut.sample(99.5,79.5),0);assert.ok(cut.sample(123,80)>.2);
});
test('overlapping paint makes one uniform region rather than amplifying exposure per input event',()=>{
 const s=stroke([[.2,.5],[.8,.5]],{size:.2,softness:.5}),one=image(),two=image();Tone.applyPixels(one,200,160,settings({brushEV:1,brushStrokes:[s]}),f);Tone.applyPixels(two,200,160,settings({brushEV:1,brushStrokes:[s,s]}),f);assert.deepEqual(one,two);
});
test('normalized strokes cover the same places in preview and full-size export with bounded mask memory',()=>{
 const strokes=[stroke([[.1,.2],[.75,.65],[.8,.9]],{size:.18,softness:.7}),stroke([[.75,.65]],{mode:'erase',size:.05})],a=Brush.raster(strokes,400,600),b=Brush.raster(strokes,1200,1800);assert.ok(a.width<=768&&a.height<=768&&b.width<=768&&b.height<=768);
 for(const [x,y]of [[.1,.2],[.3,.34],[.75,.65],[.79,.85],[.98,.05]])assert.ok(Math.abs(a.sample(x*400-.5,y*600-.5)-b.sample(x*1200-.5,y*1800-.5))<.00001);
});
test('painting outside the image is clipped and immutable vector records are not modified by rendering',()=>{
 const s=Object.freeze({mode:'paint',size:.12,softness:.5,points:Object.freeze([Object.freeze([-.2,.5]),Object.freeze([1.2,.5])])}),strokes=Object.freeze([s]),mask=Brush.raster(strokes,200,160);assert.ok(mask.sample(0,80)>.9);assert.equal(mask.sample(100,0),0);assert.deepEqual(s.points,[[-.2,.5],[1.2,.5]]);
});
function engine(){
 const script=fs.readFileSync(path.join(__dirname,'../source/buong-toi-original.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split('/* ============ nối dây giao diện ============ */')[0],context={console,document:{createElement:()=>createCanvas(1,1)},view:{},beautyApply(){}};context.window=context;vm.createContext(context);vm.runInContext(script,context);for(const file of ['brush-core.js','tone-core.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/darkroom/'+file),'utf8'),context);vm.runInContext('this.e={P,F,NK,LK,render};',context);const e=context.e,defaults={...e.P,stamp:false,frame:'none'},state=p=>({p:{...defaults,...p},focus:{...e.F},sun:{...e.NK},leak:{...e.LK}}),pass=(t,s,v)=>{Object.assign(e.P,Tone.defaults,v.p);Object.assign(e.F,v.focus);e.render(t,s);};
 const source=createCanvas(240,160),c=source.getContext('2d');c.fillStyle='#505f64';c.fillRect(0,0,240,160);return{state,pass,source,context,e};
}
const bytes=c=>Buffer.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data);
test('independent bright and dark brush layers keep identical pixels after undo, redo and draft restoration',()=>{
 const h=engine(),light=h.state({brushEV:1,brushStrokes:[stroke([[.2,.3],[.2,.7]])]}),dark=h.state({brushEV:-1,brushStrokes:[stroke([[.8,.3],[.8,.7]])]}),out=Layers.renderApplied(h.source,[light,dark],h.pass,()=>createCanvas(1,1)),s=x=>out.getContext('2d').getImageData(x,80,1,1).data[0];assert.ok(s(48)>80);assert.ok(s(192)<80);assert.equal(s(120),80);
 const history=new Timeline();history.reset({key:'light',layers:[light]});history.push({key:'dark',layers:[light,dark]});assert.equal(history.undo().layers.length,1);assert.equal(history.redo().layers.length,2);const restored=new Timeline();restored.restore(JSON.parse(JSON.stringify(history.serialize())));assert.deepEqual(bytes(out),bytes(Layers.renderApplied(h.source,restored.current().layers,h.pass,()=>createCanvas(1,1))));
 const next=Layers.cleared(light.p);assert.deepEqual(next.brushStrokes,[]);assert.equal(next.brushSize,light.p.brushSize);assert.equal(next.brushEV,1);assert.equal(Layers.active(next),false);
});
test('an old film layer without brush fields does not inherit the current painted area',()=>{
 const h=engine(),element=()=>({setAttribute(){},prepend(){},append(){},before(){},replaceChildren(){},classList:{toggle(){}}});h.context.document.createElement=tag=>tag==='canvas'?createCanvas(1,1):element();h.context.document.querySelector=()=>element();h.context.document.querySelectorAll=()=>[];h.context.BEAUTY={peek:false,values:{},people:[],ready:{},maps:null,faces:[]};h.context.queue=h.context.syncControls=()=>{};
 const old=h.state({temp:.2});old.title='Film';for(const key of Object.keys(Brush.defaults))delete old.p[key];vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/darkroom/effect-layers.js'),'utf8')+'\nthis.layerRender=render;',h.context);h.context.RayLayers.restore([old]);Object.assign(h.e.P,h.state({brushEV:1,brushStrokes:[stroke([[.5,.5]])]}).p);const actual=createCanvas(1,1);h.context.layerRender(actual,h.source);
 const ref=engine(),film=createCanvas(1,1),expected=createCanvas(1,1);ref.pass(film,ref.source,ref.state({temp:.2}));ref.pass(expected,film,ref.state({brushEV:1,brushStrokes:[stroke([[.5,.5]])]}));assert.deepEqual(bytes(actual),bytes(expected));
});
