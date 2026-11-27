const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createCanvas}=require('@napi-rs/canvas');
const Tone=require('../dist/darkroom/tone-core.js'),Layers=require('../dist/darkroom/effect-layers.js'),{Timeline}=require('../dist/darkroom/edit-history.js');
const F={cx:.5,cy:.5,rx:.25,ry:.3},settings=p=>({...Tone.defaults,...p});
function fixture(W=120,H=80,value=90){const d=new Uint8ClampedArray(W*H*4);for(let i=0;i<d.length;i+=4)d.set([value,value,value,255],i);return d;}
function corrected(value,p){const d=fixture(1,1,value);Tone.applyPixels(d,1,1,settings(p),F);return d[0];}
test('turning local light off restores source pixels and turning it back on keeps the same shape recipe',()=>{
 const p=settings({toneLocalEV:1.1,toneLocalWarmth:.35,toneLocalShape:'beam',toneLocalAngle:32}),a=fixture(),b=fixture(),c=fixture();Tone.applyPixels(a,120,80,p,F);p.toneLocalEnabled=false;Tone.applyPixels(b,120,80,p,F);assert.deepEqual(b,fixture());assert.equal(Tone.active(p),false);assert.equal(Layers.active(p),false);p.toneLocalEnabled=true;Tone.applyPixels(c,120,80,p,F);assert.deepEqual(c,a);assert.notDeepEqual(a,b);
});
test('a disabled local shape does not disable global exposure or become an active applied layer',()=>{
 const p=settings({toneLocalEnabled:false,toneLocalEV:-2,toneLocalShape:'rect',toneLocalAngle:70,toneExposure:.7}),a=fixture(),b=fixture();Tone.applyPixels(a,120,80,p,F);Tone.applyPixels(b,120,80,settings({toneExposure:.7}),F);assert.deepEqual(a,b);assert.equal(Tone.active(p),true);assert.equal(Layers.active(p),true);const t=new Timeline();t.reset({key:'off',p});t.push({key:'on',p:{...p,toneLocalEnabled:true}});assert.equal(t.undo().p.toneLocalEnabled,false);assert.equal(t.redo().p.toneLocalEnabled,true);assert.equal(Layers.cleared(p).toneLocalEnabled,true);
});
test('zeroed tone controls preserve every original byte, including transparency',()=>{
 const d=Uint8ClampedArray.from({length:120*80*4},(_,i)=>i%256),before=new Uint8ClampedArray(d);Tone.applyPixels(d,120,80,Tone.defaults,F);assert.deepEqual(d,before);assert.equal(Tone.active(Tone.defaults),false);
});
test('exposure has positive and negative stops and doubles linear light per EV',()=>{
 const linear=v=>v/255<=.04045?v/255/12.92:((v/255+.055)/1.055)**2.4;
 const up=corrected(80,{toneExposure:1}),down=corrected(80,{toneExposure:-1});assert.ok(up>80&&down<80);assert.ok(Math.abs(linear(up)/linear(80)-2)<.04);assert.ok(Math.abs(linear(down)/linear(80)-.5)<.025);
});
test('brightness is bidirectional; shadows and highlights target their own tonal ranges',()=>{
 assert.ok(corrected(110,{toneBrightness:.7})>110);assert.ok(corrected(110,{toneBrightness:-.7})<110);
 assert.ok(corrected(45,{toneShadows:.8})-45>40);assert.equal(corrected(225,{toneShadows:.8}),225);
 assert.ok(225-corrected(225,{toneHighlights:-.8})>40);assert.equal(corrected(45,{toneHighlights:-.8}),45);
 assert.ok(corrected(245,{toneWhites:-1})<245);assert.ok(corrected(5,{toneBlacks:1})>5);
});
test('a local brighten or darken changes only the selected interior and preserves alpha',()=>{
 for(const ev of [-1,1]){const W=120,H=80,d=fixture(W,H),before=new Uint8ClampedArray(d);Tone.applyPixels(d,W,H,settings({toneLocalEV:ev}),F);
  const center=(40*W+60)*4;assert.ok(ev>0?d[center]>90:d[center]<90);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;assert.equal(d[i+3],255);if(Tone.regionWeight(x,y,W,H,F,.55,'in')===0)assert.deepEqual(d.slice(i,i+4),before.slice(i,i+4));}
 }
});
test('outside selection protects the center; a moved circle targets a different location',()=>{
 const W=120,H=80,out=fixture(W,H);Tone.applyPixels(out,W,H,settings({toneLocalEV:-1,toneLocalMode:'out'}),F);assert.equal(out[(40*W+60)*4],90);assert.ok(out[0]<90);
 const moved=fixture(W,H);Tone.applyPixels(moved,W,H,settings({toneLocalBrightness:.8}),{...F,cx:.15,rx:.12});assert.ok(moved[(40*W+18)*4]>90);assert.equal(moved[(40*W+80)*4],90);
});
test('feathering is continuous, complementary and consistent at preview and export sizes',()=>{
 const weights=[];for(let x=60;x<=90;x++)weights.push(Tone.regionWeight(x,39.5,120,80,F,.8));for(let i=1;i<weights.length;i++)assert.ok(weights[i]<=weights[i-1]);assert.ok(weights.some(w=>w>0&&w<1));
 for(const [x,y]of [[62,40],[83,44],[3,8]]){const small=Tone.regionWeight(x,y,120,80,F,.55),large=Tone.regionWeight((x+.5)*4-.5,(y+.5)*4-.5,480,320,F,.55);assert.ok(Math.abs(small-large)<1e-12);assert.ok(Math.abs(small+Tone.regionWeight(x,y,120,80,F,.55,'out')-1)<1e-12);}
});
test('local correction preserves transparent pixels and remains finite at image edges',()=>{
 const W=120,H=80,d=fixture(W,H);d[0]=12;d[1]=45;d[2]=67;d[3]=0;const first=Array.from(d.slice(0,4));Tone.applyPixels(d,W,H,settings({toneExposure:2,toneLocalEV:-2,toneLocalBrightness:-1}),{cx:0,cy:0,rx:.01,ry:.01});assert.deepEqual(Array.from(d.slice(0,4)),first);assert.ok(Array.from(d).every(Number.isFinite));
});
test('a rotated rectangle lights its corners and rotates in image pixels, with a protected outside',()=>{
 const W=200,H=100,f={cx:.5,cy:.5,rx:.35,ry:.1},at=(x,y,mode='in',angle=0)=>Tone.regionWeight(x-.5,y-.5,W,H,f,0,mode,'rect',angle);
 assert.equal(at(160,58),1);assert.equal(at(160,58,'out'),0);assert.equal(at(100,75),0);
 assert.equal(at(100,90,'in',90),1);assert.equal(at(160,50,'in',90),0);
 const d=fixture(W,H);Tone.applyPixels(d,W,H,settings({toneLocalShape:'rect',toneLocalAngle:90,toneLocalEV:-1,toneLocalFeather:0}),f);
 assert.ok(d[(90*W+100)*4]<90);assert.equal(d[(50*W+160)*4],90);
});
test('a light ray has a narrow origin, a broad tail and soft fading edges',()=>{
 const W=200,H=100,f={cx:.5,cy:.5,rx:.4,ry:.35},at=(x,y,feather=0,mode='in')=>Tone.regionWeight(x-.5,y-.5,W,H,f,feather,mode,'beam',0);
 assert.equal(at(40,60),0);assert.equal(at(160,60),1);assert.equal(at(100,50),1);assert.equal(at(100,50,0,'out'),0);assert.equal(at(190,50),0);
 const near=at(175,50,.8);assert.ok(near>0&&near<1);assert.ok(at(165,75,.8)<at(165,50,.8));
 const d=fixture(W,H);Tone.applyPixels(d,W,H,settings({toneLocalShape:'beam',toneLocalEV:1,toneLocalWarmth:.6,toneLocalFeather:0}),f);const center=(50*W+100)*4;assert.ok(d[center]>d[center+2]);assert.ok(d[center+2]>90);assert.deepEqual(Array.from(d.slice((60*W+40)*4,(60*W+40)*4+4)),[90,90,90,255]);
});
test('all local shapes retain the same coverage in portrait preview and full export',()=>{
 const f={cx:.63,cy:.4,rx:.48,ry:.11};
 for(const shape of ['ellipse','rect','beam'])for(const angle of [-137,-25,0,89,180])for(const [x,y]of [[120,160],[30,20],[170,85],[90,125]]){
  const small=Tone.regionWeight(x,y,200,300,f,.65,'in',shape,angle),large=Tone.regionWeight((x+.5)*4-.5,(y+.5)*4-.5,800,1200,f,.65,'in',shape,angle);
  assert.ok(Math.abs(small-large)<1e-12);assert.ok(Math.abs(small+Tone.regionWeight(x,y,200,300,f,.65,'out',shape,angle)-1)<1e-12);
 }
});
test('resizing a rotated local shape follows its visible axes on a portrait photo',()=>{
 const f={cx:.5,cy:.5,rx:.3,ry:.1},r=Tone.resizeRegion(f,200,300,0,20,90);assert.ok(Math.abs(r.rx-.4)<1e-12);assert.ok(Math.abs(r.ry-.1)<1e-12);
 const w=Tone.resizeRegion(f,200,300,-15,0,90);assert.ok(Math.abs(w.rx-.3)<1e-12);assert.ok(Math.abs(w.ry-.15)<1e-12);
 const opposite=Tone.resizeRegion(f,200,300,15,0,90,0,-1);assert.ok(Math.abs(opposite.rx-.3)<1e-12);assert.ok(Math.abs(opposite.ry-.15)<1e-12);
});
function engine(){
 const script=fs.readFileSync(path.join(__dirname,'../source/buong-toi-original.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split('/* ============ nối dây giao diện ============ */')[0],context={console,document:{createElement:()=>createCanvas(1,1)},view:{},beautyApply(){}};context.window=context;vm.createContext(context);vm.runInContext(script,context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/darkroom/tone-core.js'),'utf8'),context);vm.runInContext('this.e={P,F,NK,LK,render};',context);const e=context.e,defaults={...e.P,stamp:false,frame:'none'};
 const state=p=>({p:{...defaults,...p},focus:{...e.F},sun:{...e.NK},leak:{...e.LK}}),pass=(t,s,v)=>{Object.assign(e.P,Tone.defaults,v.p);Object.assign(e.F,v.focus);Object.assign(e.NK,v.sun);Object.assign(e.LK,v.leak);e.render(t,s);};
 const source=createCanvas(240,160),c=source.getContext('2d');c.fillStyle='#526065';c.fillRect(0,0,240,160);return{state,pass,source,context,e};
}
const bytes=c=>Buffer.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data);
test('a brightened region and a darkened region stack with film and keep identical pixels after draft restore',()=>{
 const h=engine(),film=h.state({temp:.2,contrast:.2}),bright=h.state({toneLocalEV:.8}),dark=h.state({toneLocalEV:-.8});bright.focus={cx:.2,cy:.5,rx:.15,ry:.3};dark.focus={cx:.8,cy:.5,rx:.15,ry:.3};
 const base=Layers.renderApplied(h.source,[film],h.pass,()=>createCanvas(1,1)),final=Layers.renderApplied(h.source,[film,bright,dark],h.pass,()=>createCanvas(1,1)),sample=(c,x)=>c.getContext('2d').getImageData(x,80,1,1).data[0];assert.ok(sample(final,48)>sample(base,48));assert.ok(sample(final,192)<sample(base,192));assert.equal(sample(final,120),sample(base,120));
 const history=new Timeline();history.reset({key:'film',layers:[film]});history.push({key:'bright',layers:[film,bright]});history.push({key:'dark',layers:[film,bright,dark]});assert.equal(history.undo().layers.length,2);assert.equal(history.redo().layers.length,3);const restored=new Timeline();restored.restore(structuredClone(history.serialize()));const replay=Layers.renderApplied(h.source,restored.current().layers,h.pass,()=>createCanvas(1,1));assert.deepEqual(bytes(final),bytes(replay));
 const clear=Layers.cleared({...bright.p,toneLocalMode:'out',toneLocalFeather:.7});for(const k of Tone.keys)assert.equal(clear[k],0);assert.equal(clear.toneLocalMode,'out');assert.equal(clear.toneLocalFeather,.7);
});
test('an old saved film without tone fields does not inherit the exposure being edited now',()=>{
 const h=engine(),element=()=>({setAttribute(){},before(){},prepend(){},append(){},replaceChildren(){},classList:{toggle(){}}});
 h.context.document.createElement=tag=>tag==='canvas'?createCanvas(1,1):element();h.context.document.querySelector=()=>element();h.context.document.querySelectorAll=()=>[];h.context.BEAUTY={peek:false,values:{},people:[],ready:{},maps:null,faces:[]};h.context.queue=h.context.syncControls=()=>{};
 const old=h.state({temp:.2});old.title='Lớp cũ';for(const key of Object.keys(Tone.defaults))delete old.p[key];
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/darkroom/effect-layers.js'),'utf8')+'\nthis.layerRender=render;',h.context);h.context.RayLayers.restore([old]);Object.assign(h.e.P,h.state({toneExposure:1}).p);const actual=createCanvas(1,1);h.context.layerRender(actual,h.source);
 const reference=engine(),film=createCanvas(1,1),expected=createCanvas(1,1);reference.pass(film,reference.source,reference.state({temp:.2}));reference.pass(expected,film,reference.state({toneExposure:1}));assert.deepEqual(bytes(actual),bytes(expected));
});
test('warm rays and cool rectangular shadows retain their independent geometry after apply, undo and draft replay',()=>{
 const h=engine(),ray=h.state({toneLocalShape:'beam',toneLocalAngle:-25,toneLocalEV:1,toneLocalWarmth:.4}),shadow=h.state({toneLocalShape:'rect',toneLocalAngle:35,toneLocalEV:-.6,toneLocalWarmth:-.2});ray.focus={cx:.3,cy:.35,rx:.4,ry:.15};shadow.focus={cx:.75,cy:.7,rx:.24,ry:.12};
 const original=Layers.renderApplied(h.source,[ray,shadow],h.pass,()=>createCanvas(1,1));const history=new Timeline();history.reset({key:'ray',layers:[ray]});history.push({key:'shadow',layers:[ray,shadow]});assert.equal(history.undo().layers.length,1);assert.equal(history.redo().layers[1].p.toneLocalAngle,35);
 const restored=new Timeline();restored.restore(JSON.parse(JSON.stringify(history.serialize())));assert.deepEqual(bytes(Layers.renderApplied(h.source,restored.current().layers,h.pass,()=>createCanvas(1,1))),bytes(original));
 const clear=Layers.cleared(ray.p);assert.equal(clear.toneLocalWarmth,0);assert.equal(clear.toneLocalShape,'beam');assert.equal(clear.toneLocalAngle,-25);assert.equal(Layers.active({...Tone.defaults,toneLocalWarmth:.2}),true);
});

test('straight light strokes have round ends, controlled thickness and a feather that can be turned off',()=>{
 const W=240,H=160,f={cx:.5,cy:.5,rx:.25,ry:.2},options={thickness:.1},at=(x,y,soft=0)=>Tone.regionWeight(x-.5,y-.5,W,H,f,soft,'in','line',0,options);
 assert.equal(at(120,80),1);assert.equal(at(120,87),1);assert.equal(at(120,89),0);assert.equal(at(55,80),1);assert.equal(at(51,80),0);assert.ok(at(120,86,.8)>0&&at(120,86,.8)<1);
 const count=t=>{const mask=Tone.regionMask(W,H,f,0,'in','line',0,{thickness:t});let n=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++)n+=mask(x,y);return n;};assert.ok(count(.12)>count(.03)*3);
});
test('curved light follows its exact centerline on either side, including steep curves',()=>{
 for(const bend of [-35,-8,0,8,35])for(const x of [-45,-20,0,20,45])for(const y of [-35,-5,0,12,40]){
  const actual=Tone.curveDistance(x,y,30,bend);let sampled=Infinity;
  for(let i=0;i<=4000;i++){const u=-1+i/2000;sampled=Math.min(sampled,Math.hypot(30*u-x,bend*(1-u*u)-y));}
  assert.ok(Math.abs(actual-sampled)<.02,JSON.stringify({x,y,bend,actual,sampled}));
 }
 const W=240,H=160,f={cx:.5,cy:.5,rx:.3,ry:.3};for(const curve of [-.8,.8]){const at=(x,y)=>Tone.regionWeight(x-.5,y-.5,W,H,f,0,'in','curve',0,{thickness:.04,curve});assert.equal(at(120,80+curve*48),1);assert.equal(at(120,80-curve*48),0);assert.equal(at(48,80),1);}
});
test('curves, lines and outline-only regions agree at preview and full resolution with complementary outside masks',()=>{
 const f={cx:.47,cy:.48,rx:.4,ry:.22};for(const shape of ['ellipse','rect','beam','curve','line'])for(const fill of ['solid','outline'])for(const curve of [-.7,.7])for(const angle of [-139,0,81])for(const [x,y]of [[89,99],[124,95],[55,45],[145,125]]){
  const opts={thickness:.055,curve,fill},a=Tone.regionWeight(x,y,200,300,f,.45,'in',shape,angle,opts),b=Tone.regionWeight((x+.5)*4-.5,(y+.5)*4-.5,800,1200,f,.45,'in',shape,angle,opts);
  assert.ok(Math.abs(a-b)<1e-10,shape);assert.ok(Math.abs(a+Tone.regionWeight(x,y,200,300,f,.45,'out',shape,angle,opts)-1)<1e-12);
 }
});
test('outline-only fills protect their centers and affect only the chosen border',()=>{
 const W=240,H=160,f={cx:.5,cy:.5,rx:.3,ry:.3};for(const shape of ['ellipse','rect','beam']){
  const mask=Tone.regionMask(W,H,f,0,'in',shape,0,{fill:'outline',thickness:.025});assert.equal(mask(119.5,79.5),0);let changed=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++)changed+=mask(x,y);assert.ok(changed>0);assert.equal(mask(0,0),0);
 }
});
test('arbitrary light colors preserve texture and alpha, with independent color and overall opacity controls',()=>{
 assert.equal(Tone.normalizeColor('#0AF'),'#00aaff');assert.equal(Tone.normalizeColor('ff12ab'),'#ff12ab');for(const invalid of ['red','#12345','url(x)','<svg>'])assert.equal(Tone.normalizeColor(invalid),null);
 const W=120,H=80,f={cx:.5,cy:.5,rx:.4,ry:.2},p=settings({toneLocalShape:'line',toneLocalThickness:.25,toneLocalFeather:0,toneLocalColor:'#ff0000',toneLocalColorAmount:.8}),d=fixture(),before=new Uint8ClampedArray(d);d[(40*W+60)*4+3]=77;Tone.applyPixels(d,W,H,p,f);const i=(40*W+60)*4;assert.ok(d[i]>90&&d[i+1]<90&&d[i+2]<90);assert.equal(d[i+3],77);assert.deepEqual(d.slice(0,4),before.slice(0,4));
 const neutral=fixture();Tone.applyPixels(neutral,W,H,{...p,toneLocalColorAmount:0},f);assert.deepEqual(neutral,fixture());
 const full=fixture(),half=fixture();Tone.applyPixels(full,W,H,p,f);Tone.applyPixels(half,W,H,{...p,toneLocalOpacity:.4},f);for(let c=0;c<3;c++)assert.ok(Math.abs(half[i+c]-(90+(full[i+c]-90)*.4))<=1);
 for(const extra of [{toneLocalOpacity:0},{toneLocalEnabled:false}]){const off={...p,...extra},out=fixture();Tone.applyPixels(out,W,H,off,f);assert.deepEqual(out,fixture());assert.equal(Tone.active(off),false);assert.equal(Layers.active(off),false);}
 const textured=fixture();textured[i]=70;textured[i+4]=110;Tone.applyPixels(textured,W,H,p,f);assert.ok(textured[i+4]>textured[i]);
});
test('colored curves and thin lines retain their own shape and color through apply, undo and saved draft replay',()=>{
 const h=engine(),arc=h.state({toneLocalShape:'curve',toneLocalCurve:-.65,toneLocalThickness:.08,toneLocalColor:'#d320ff',toneLocalColorAmount:.8,toneLocalOpacity:.7}),line=h.state({toneLocalShape:'line',toneLocalThickness:.035,toneLocalColor:'#00c4e8',toneLocalColorAmount:.6,toneLocalAngle:35});arc.focus={cx:.45,cy:.6,rx:.35,ry:.3};line.focus={cx:.7,cy:.3,rx:.25,ry:.2};
 const output=Layers.renderApplied(h.source,[arc,line],h.pass,()=>createCanvas(1,1));assert.notDeepEqual(bytes(output),bytes(h.source));
 const history=new Timeline();history.reset({key:'arc',layers:[arc]});history.push({key:'line',layers:[arc,line]});assert.equal(history.undo().layers.length,1);assert.equal(history.redo().layers[1].p.toneLocalShape,'line');
 const restored=new Timeline();restored.restore(JSON.parse(JSON.stringify(history.serialize())));assert.deepEqual(bytes(Layers.renderApplied(h.source,restored.current().layers,h.pass,()=>createCanvas(1,1))),bytes(output));const clear=Layers.cleared(arc.p);assert.equal(clear.toneLocalColorAmount,0);assert.equal(Tone.active(clear),false);
});
test('curved and straight strokes keep their image geometry when rotated, mirrored or cropped',()=>{
 const Photo=require('../dist/darkroom/photo-edit-core.js'),W=240,H=160,f={cx:.45,cy:.55,rx:.3,ry:.22};
 for(const shape of ['curve','line'])for(const kind of ['right','flipX','flipY','crop']){
  const p=settings({toneLocalShape:shape,toneLocalCurve:.7,toneLocalThickness:.045,toneLocalAngle:27}),snap={p,focus:f,sun:{x:.5,y:.1},leak:{x:.2,y:.1},layers:[],body:[]},op=Photo.operation(W,H,kind,{x:.1,y:.1,width:.7,height:.7}),next=Photo.remap(snap,W,H,op);
  const mask=(w,h,s)=>Tone.regionMask(w,h,s.focus,.3,'in',s.p.toneLocalShape,s.p.toneLocalAngle,{curve:s.p.toneLocalCurve,thickness:s.p.toneLocalThickness}),before=mask(W,H,snap),after=mask(op.width,op.height,next);
  for(let y=35;y<120;y+=7)for(let x=35;x<190;x+=9){const dest=Photo.point(op.matrix,x+.5,y+.5);if(dest.x<0||dest.y<0||dest.x>=op.width||dest.y>=op.height)continue;assert.ok(Math.abs(before(x,y)-after(dest.x-.5,dest.y-.5))<1e-8,shape+' '+kind);}
 }
});
