const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createCanvas}=require('@napi-rs/canvas');
const Preview=require('../dist/darkroom/preview-quality.js'),Quality=require('../dist/darkroom/quality-core.js'),Catalog=require('../dist/darkroom/preset-catalog.js');
const make=()=>createCanvas(1,1),data=c=>Buffer.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data);
function engine(){
 const html=fs.readFileSync(path.join(__dirname,'../dist/darkroom/index.html'),'utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1].split('/* ============ nối dây giao diện ============ */')[0],h={document:{createElement:make},view:{},beautyApply(){},bodyWarp(){}};h.window=h;vm.createContext(h);vm.runInContext(script+'\nthis.engine={P,render};',h);return h.engine;
}
function scene(W=800,H=600){
 const c=createCanvas(W,H),x=c.getContext('2d'),g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,'#ddbe9d');g.addColorStop(.5,'#67977b');g.addColorStop(1,'#192f43');x.fillStyle=g;x.fillRect(0,0,W,H);
 for(let i=0;i<100;i++){x.strokeStyle=i%2?'#47352c':'#e8d8c5';x.lineWidth=1;x.beginPath();x.moveTo(W*.2+i*.7,H*.1);x.bezierCurveTo(W*.6,H*.25,W*.25,H*.7,W*.5+i,H*.9);x.stroke();}
 x.fillStyle='#f6efe4';x.font='28px serif';x.fillText('RAY PHOTO · 2026',40,H-40);return c;
}
const error=(a,b)=>a.reduce((n,v,i)=>n+(i%4===3?0:(v-b[i])**2),0)/(a.length*.75);
test('settled preview matches an independent source-size export with film grain, soft optics and borders',async()=>{
 const {P,render}=engine(),defaults={...P},source=scene(),before=data(source);
 for(const recipe of [Catalog.additions[0].p,Catalog.additions[1].p,{grain:.65,soft:.7,sharp:.35,temp:.2,halation:.2,frame:'scan'}]){
  Object.assign(P,defaults,recipe,{stamp:false});let exported;
  await Quality.output({source,render,make,encode:async cv=>{exported=createCanvas(cv.width,cv.height);exported.getContext('2d').drawImage(cv,0,0);return new Blob(['image']);}});
  const expected=createCanvas(310,230),k=Math.min(310/exported.width,230/exported.height);expected.width=Math.round(exported.width*k);expected.height=Math.round(exported.height*k);expected.getContext('2d').imageSmoothingQuality='high';Quality.resample(exported,expected,expected.width,expected.height,make);
  const actual=make(),buffers=[],info=Preview.finalPreview({source,target:actual,render,make:()=>{const c=make();buffers.push(c);return c;},screen:{width:expected.width,height:expected.height,dpr:1}});
  assert.deepEqual([actual.width,actual.height],[expected.width,expected.height]);assert.ok(data(actual).equals(data(expected)),'Preview pixels differ from source-size export');assert.deepEqual([info.renderWidth,info.renderHeight],[800,600]);assert.ok(buffers.every(c=>c.width*c.height<800*600));assert.ok(data(source).equals(before),'Source changed');
  assert.ok(Math.abs(info.geometry.W/actual.width-800/exported.width)<1e-8);
 }
});
test('preset thumbnails render details and grain before shrinking, instead of processing a 110-pixel photo',()=>{
 const {P,render}=engine(),source=scene();Object.assign(P,{grain:.6,soft:.6,sharp:.25,temp:.18,stamp:false,frame:'none'});
 const full=make();render(full,source);const expected=make();Preview.copy(full,expected,186,159,true,make);
 const oldSource=make();Preview.copy(source,oldSource,110,83,false,make);const oldRender=make();render(oldRender,oldSource);const old=make();Preview.copy(oldRender,old,186,159,true,make);
 const work=Preview.thumbnailSource(source,make),actual=make();Preview.thumbnail({source:work,target:actual,render,make,dpr:3});
 const oldError=error(data(old),data(expected)),newError=error(data(actual),data(expected));assert.ok(oldError>25);assert.ok(newError<oldError*.15,{oldError,newError});assert.ok(newError<2,{oldError,newError});assert.deepEqual([actual.width,actual.height],[186,159]);assert.equal(source.width,800);
});
test('retina presentation is bounded without enlarging small sources and preserves export geometry',()=>{
 assert.deepEqual(Preview.screenSize(4000,6000,{width:280,height:420,dpr:3}),{width:840,height:1260});assert.deepEqual(Preview.screenSize(200,300,{width:400,height:600,dpr:3}),{width:200,height:300});
 for(const light of [false,true]){const p=Preview.screenSize(8000,6000,{width:2000,height:1500,dpr:3,light});assert.ok(p.width*p.height<=3e6+5000);assert.ok(Math.max(p.width,p.height)<=2400);}
 const source=scene(),target=make(),full=createCanvas(856,656);full.getContext('2d').drawImage(source,28,28);const info=Preview.present({canvas:full,target,renderWidth:800,renderHeight:600,screen:{width:428,height:328,dpr:1}});assert.deepEqual(info.geometry,{W:400,H:300,bw:14,bb:14});assert.equal(full.width,856);
});
test('a failed high-quality render keeps the visible quick preview and frees temporary canvases',()=>{
 const source=scene(),target=scene(120,90),before=data(target),buffers=[];
 assert.throws(()=>Preview.finalPreview({source,target,render(){throw new Error('memory');},make:()=>{const c=make();buffers.push(c);return c;},screen:{width:120,height:90,dpr:1}}),/memory/);assert.ok(data(target).equals(before),'Visible preview changed on failure');assert.ok(buffers.every(c=>c.width*c.height<800*600));assert.equal(source.width,800);
});
test('large-source refinement covers the retina display without scheduling a 12–48 MP render',()=>{
 for(const [W,H]of [[3024,4032],[4032,3024],[8064,6048]])for(const light of [false,true]){
  const screen={width:394,height:300,dpr:3,light},plan=Preview.refinementPlan(W,H,{screen});
  const actual=Preview.screenSize(W,H,screen);assert.ok(plan.width>=actual.width&&plan.height>=actual.height);assert.ok(plan.width*plan.height<=1.6e6+2500);assert.ok(Math.max(plan.width,plan.height)<=1600);
 }
 const small=Preview.refinementPlan(200,300,{screen:{width:390,height:600,dpr:3}});assert.deepEqual([small.width,small.height],[200,300]);
 const capped=Preview.refinementPlan(3024,4032,{longEdge:720,screen:{width:390,height:600,dpr:3}});assert.equal(capped.height,720);
});

test('light mode changes interaction speed, never the settled retina detail',()=>{const screen={width:326,height:556,dpr:3},normal=Preview.refinementPlan(3024,5160,{screen}),light=Preview.refinementPlan(3024,5160,{screen:{...screen,light:true}});assert.deepEqual(light,normal);assert.deepEqual(Preview.screenSize(3024,5160,screen),Preview.screenSize(3024,5160,{...screen,light:true}));});
