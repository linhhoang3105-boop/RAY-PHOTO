const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createCanvas}=require('@napi-rs/canvas');
const Light=require('../dist/darkroom/light-core.js'),Tone=require('../dist/darkroom/tone-core.js');
function harness(W=240,H=180){
 const script=fs.readFileSync(path.join(__dirname,'../source/buong-toi-original.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split('/* ============ nối dây giao diện ============ */')[0];
 const context={document:{createElement:()=>createCanvas(1,1)},view:{},beautyApply(){}};context.window=context;vm.createContext(context);vm.runInContext(script+'\nthis.engine={P,F,NK,LK,render};',context);
 const e=context.engine,defaults={...e.P,...Light.defaults,stamp:false,frame:'none'},source=createCanvas(W,H),c=source.getContext('2d');c.fillStyle='rgb(60,75,80)';c.fillRect(0,0,W,H);
 const proto=Object.getPrototypeOf(c),original=e.render;
 function render(p={},focus={}){Object.assign(e.P,defaults,p);Object.assign(e.F,{cx:.5,cy:.5,rx:.35,ry:.1},focus);Object.assign(e.NK,{x:.5,y:.5});Object.assign(e.LK,{x:.5,y:.5});const out=createCanvas(1,1);Light.withGeometry(original,out,source,e.P,e.F,e.NK,e.LK,proto,()=>createCanvas(1,1));return out;}
 return{e,source,proto,render,original};
}
const rgba=(cv,x,y)=>[...cv.getContext('2d').getImageData(x,y,1,1).data],pixels=cv=>Buffer.from(cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data);
test('default geometry preserves every pixel of the original sunlight and focus renderer',()=>{
 const h=harness(),p={nang:.4,nangManual:true,leak:.2,leakManual:true,leakShape:'patch',leakAngle:28,rgAtmos:'out',bgBlur:.2};const extended=h.render(p),plain=createCanvas(1,1);h.original(plain,h.source);assert.deepEqual(pixels(extended),pixels(plain));
});
test('an elongated sun rotates in photo pixels, leaving its center fixed',()=>{
 const h=harness(),p={nang:.6,nangManual:true,nangSize:.3,nangAspect:4},a=h.render({...p,nangAngle:0}),b=h.render({...p,nangAngle:90});assert.ok(rgba(a,160,90)[0]>rgba(b,160,90)[0]+15);assert.ok(rgba(b,120,130)[0]>rgba(a,120,130)[0]+15);assert.deepEqual(rgba(a,120,90),rgba(b,120,90));
});
test('oval light leaks rotate while the original round leak remains unchanged',()=>{
 const h=harness(),p={leak:.7,leakManual:true,leakBandWidth:.15,leakShape:'oval',leakAspect:4},a=h.render({...p,leakAngle:0}),b=h.render({...p,leakAngle:90});assert.ok(rgba(a,160,90)[0]>rgba(b,160,90)[0]+20);assert.ok(rgba(b,120,130)[0]>rgba(a,120,130)[0]+20);
 const round=h.render({...p,leakShape:'circle',leakAspect:1,leakAngle:0}),rotatedRound=h.render({...p,leakShape:'circle',leakAspect:1,leakAngle:83});assert.deepEqual(pixels(round),pixels(rotatedRound));
});
test('inside and outside sunlight masks follow a rotated oval instead of an upright one',()=>{
 const h=harness(),p={nang:.8,nangManual:true,nangSize:.8,rgAtmos:'in'},a=h.render({...p,focusAngle:0}),b=h.render({...p,focusAngle:90});assert.ok(rgba(a,165,90)[0]>rgba(b,165,90)[0]+10);assert.deepEqual(rgba(b,165,90),[60,75,80,255]);assert.ok(rgba(b,120,135)[0]>rgba(a,120,135)[0]+10);
 const outside=h.render({...p,focusAngle:90,rgAtmos:'out'});assert.deepEqual(rgba(outside,120,90),[60,75,80,255]);assert.ok(rgba(outside,165,90)[0]>60);
});
test('background and motion blur preserve the rotated sharp oval',()=>{
 const h=harness(),c=h.source.getContext('2d');for(let y=0;y<180;y+=6)for(let x=0;x<240;x+=6){c.fillStyle=((x+y)/6)%2?'#eeeeee':'#111111';c.fillRect(x,y,6,6);}
 for(const p of [{bgBlur:.8},{motion:.8,motionAngle:30}]){const a=h.render({...p,focusAngle:0}),b=h.render({...p,focusAngle:90});assert.notDeepEqual(pixels(a),pixels(b));assert.deepEqual(rgba(a,120,90),rgba(h.source,120,90));assert.deepEqual(rgba(b,120,90),rgba(h.source,120,90));}
});
test('temporary canvas hooks are restored even when rendering fails',()=>{
 const h=harness(),scale=h.proto.scale,radial=h.proto.createRadialGradient;assert.throws(()=>Light.withGeometry(()=>{throw new Error('render failed');},createCanvas(1,1),h.source,{...Light.defaults,focusAngle:30},h.e.F,h.e.NK,h.e.LK,h.proto),/render failed/);assert.equal(h.proto.scale,scale);assert.equal(h.proto.createRadialGradient,radial);
});
test('local exposure ellipses rotate consistently at preview and export resolution',()=>{
 const f={cx:.5,cy:.5,rx:.3,ry:.06};assert.equal(Tone.regionWeight(160,90,240,180,f,0,'in','ellipse',0),1);assert.equal(Tone.regionWeight(160,90,240,180,f,0,'in','ellipse',90),0);assert.equal(Tone.regionWeight(120,130,240,180,f,0,'in','ellipse',90),1);
 const a=Tone.regionWeight(130,118,240,180,f,.6,'in','ellipse',37),b=Tone.regionWeight(130*4+1.5,118*4+1.5,960,720,f,.6,'in','ellipse',37);assert.ok(Math.abs(a-b)<1e-6);
});
