const {test}=require('node:test'),assert=require('node:assert/strict');
const {engine}=require('../dist/darkroom/beauty-runtime.js');

function models({faces=1,fail=[],segmentValues=null,width=2,height=1,hairValues=null,hairWidth=width,hairHeight=height,hairLabels=['background','hair']}={}){
 const active=new Set(),events=[];let results=0;
 function create(kind){
  assert.equal(active.size,0,'previous model must close before loading another');
  active.add(kind);events.push('open:'+kind);
  return {
   close(){assert.equal(active.delete(kind),true);events.push('close:'+kind);},
   detect(){
    if(fail.includes(kind))throw new Error('inference failed');
    if(kind==='face')return{faceLandmarks:Array.from({length:faces},()=>[{x:.2,y:.3}])};
    return{landmarks:[[{x:.4,y:.5}]],segmentationMasks:[{width:2,height:2,getAsFloat32Array:()=>new Float32Array([0,1,.5,0])}],close(){results++;}};
   },
   segment(){
    if(fail.includes(kind))throw new Error('inference failed');
    const values=kind==='hair'?(hairValues||[[1,0],[0,1]]):(segmentValues||[[0,0],[0,1],[1,0],[0,0],[0,0],[0,0]]);
    return{confidenceMasks:values.map(a=>({width:kind==='hair'?hairWidth:width,height:kind==='hair'?hairHeight:height,getAsFloat32Array:()=>Float32Array.from(a)})),close(){results++;}};
   },
   getLabels(){return kind==='hair'?hairLabels:[];}
  };
 }
 const api={FilesetResolver:{forVisionTasks:async()=>({})},ImageSegmenter:{createFromOptions:async(files,options)=>create(new TextDecoder().decode(options.baseOptions.modelAssetBuffer)==='hair'?'hair':'segment')},FaceLandmarker:{createFromOptions:async()=>create('face')},PoseLandmarker:{createFromOptions:async()=>create('pose')}};
 const assets={roots:['local-test'],segment:'data:application/octet-stream,segment',face:'data:application/octet-stream,face',pose:'data:application/octet-stream,pose'};
 return{api,assets,active,events,get results(){return results;}};
}
test('brow scan loads only the face model, releases it, and keeps usable landmarks',async()=>{
 const m=models(),run=await engine({...m.assets,kinds:['face']},async()=>m.api);
 const out=await run.detect({},()=>{});assert.equal(out.faces[0][0].x,.2);assert.equal(out.maps,null);assert.deepEqual(out.errors,[]);
 assert.deepEqual(m.events,['open:face','close:face']);assert.equal(m.active.size,0);await run.close();
 await run.detect({},()=>{});assert.deepEqual(m.events.slice(2),['open:face','close:face']);
});

const withHair=m=>({...m.assets,hair:'data:application/octet-stream,hair',kinds:['segment','hair','face','pose']});
test('detailed hair inference runs sequentially, releases its result/model, and preserves skin and foreground',async()=>{
 const m=models({faces:2}),run=await engine(withHair(m),async()=>m.api),out=await run.detect({},()=>{});
 assert.deepEqual(m.events,['open:segment','close:segment','open:hair','close:hair','open:face','close:face','open:pose','close:pose']);
 assert.equal(m.active.size,0);assert.equal(m.results,3);assert.deepEqual(out.errors,[]);
 assert.equal(out.maps.width,2);assert.equal(out.maps.height,1);assert.deepEqual([...out.maps.skin],[255,0]);assert.deepEqual([...out.maps.foreground],[255,255]);assert.deepEqual([...out.maps.hair],[0,255]);
});
test('connected mixed strands survive while certain skin, background, clothes, accessories and pet fur stay clear',async()=>{
 const segmentValues=[[.02,.60,.02,.98,0,0],[.98,.35,.03,.01,0,0],[0,.02,.95,0,0,0],[0,0,0,0,0,0],[0,.02,0,0,1,0],[0,.01,0,.01,0,1]],hairValues=[[0,.65,.05,.05,.05,.05],[1,.35,.95,.95,.95,.95]],m=models({width:6,segmentValues,hairValues});
 const baseline=models({width:6,segmentValues}),original=await(await engine({...baseline.assets,kinds:['segment']},async()=>baseline.api)).detect({},()=>{});
 const out=await(await engine(withHair(m),async()=>m.api)).detect({},()=>{});
 assert.equal(original.maps.hair[1],0);assert.ok(out.maps.hair[1]>60&&out.maps.hair[1]<130,'fractional edge retained');assert.deepEqual([...out.maps.hair.slice(2)],[0,0,0,0]);
 assert.deepEqual(out.maps.skin,original.maps.skin);assert.deepEqual(out.maps.foreground,original.maps.foreground);
});
test('ambiguous dedicated predictions retain original hair cores while certain background removes them',async()=>{
 const m=models({segmentValues:[[0,0],[1,1],[0,0],[0,0],[0,0],[0,0]],hairValues:[[.88,1],[.12,0]]}),out=await(await engine(withHair(m),async()=>m.api)).detect({},()=>{});
 assert.deepEqual([...out.maps.hair],[255,0]);
});
test('confident joint hair can establish a core when the multiclass model never reaches its old threshold',async()=>{
 const segmentValues=[[.78,.78,.98],[.22,.22,.02],[0,0,0],[0,0,0],[0,0,0],[0,0,0]],m=models({width:3,segmentValues,hairValues:[[.04,.05,.01],[.96,.95,.99]]});
 const baseline=models({width:3,segmentValues}),old=await(await engine({...baseline.assets,kinds:['segment']},async()=>baseline.api)).detect({},()=>{});assert.deepEqual([...old.maps.hair],[0,0,0]);
 const out=await(await engine(withHair(m),async()=>m.api)).detect({},()=>{});assert.ok(out.maps.hair[0]>80&&out.maps.hair[1]>80);assert.equal(out.maps.hair[2],0,'confident background/fur stays excluded');assert.deepEqual(out.errors,[]);assert.equal(out.warnings.length,1);assert.match(out.warnings[0],/chưa chắc chắn/);assert.deepEqual(out.maps.skin,old.maps.skin);assert.deepEqual(out.maps.foreground,old.maps.foreground);
});
test('a successful but empty detailed mask preserves a usable original mask and reports a warning',async()=>{
 const m=models({hairValues:[[1,1],[0,0]]}),out=await(await engine(withHair(m),async()=>m.api)).detect({},()=>{});
 assert.deepEqual([...out.maps.hair],[0,255]);assert.deepEqual(out.errors,[]);assert.equal(out.warnings.length,1);assert.match(out.warnings[0],/giữ vùng tóc/);assert.equal(m.active.size,0);
});
test('an entirely uncertain original is preserved if a successful detailed result would erase it',async()=>{
 const m=models({segmentValues:[[.4,.4],[.6,.6],[0,0],[0,0],[0,0],[0,0]],hairValues:[[1,1],[0,0]]}),out=await(await engine(withHair(m),async()=>m.api)).detect({},()=>{});
 assert.ok(out.maps.hair.every(v=>v>0&&v<80));assert.equal(out.warnings.length,1);assert.deepEqual(out.errors,[]);
});
test('a detailed mask with a few strong pixels cannot disable a previously usable original',async()=>{
 const values=Array(9).fill(.03);values[0]=1;const m=models({width:3,height:3,segmentValues:[Array(9).fill(0),Array(9).fill(1),Array(9).fill(0),Array(9).fill(0),Array(9).fill(0),Array(9).fill(0)],hairValues:[values.map(p=>1-p),values]}),out=await(await engine(withHair(m),async()=>m.api)).detect({},()=>{});
 assert.deepEqual([...out.maps.hair],Array(9).fill(255));assert.equal(out.warnings.length,1);assert.match(out.warnings[0],/giữ vùng tóc/);assert.deepEqual(out.errors,[]);
});
test('new weak hair cannot form disconnected blobs or extend indefinitely from a core',async()=>{
 const width=20,segmentValues=Array.from({length:6},()=>Array(width).fill(0));segmentValues[0].fill(.65);segmentValues[1].fill(.35);segmentValues[0][0]=0;segmentValues[1][0]=1;
 const values=Array(width).fill(.35);values[0]=1;values[7]=0;const m=models({width,segmentValues,hairValues:[values.map(p=>1-p),values]}),out=await(await engine(withHair(m),async()=>m.api)).detect({},()=>{});
 assert.equal(out.maps.hair[0],255);assert.ok(out.maps.hair[3]>0);assert.equal(out.maps.hair[4],0);assert.equal(out.maps.hair[8],0);
});
test('hair confidence downsampling preserves partial subpixel coverage instead of missing thin strands',async()=>{
 const m=models({segmentValues:[[0,.60],[1,.35],[0,0],[0,0],[0,0],[0,0]],hairWidth:4,hairValues:[[0,0,0,1],[1,1,1,0]]}),out=await(await engine(withHair(m),async()=>m.api)).detect({},()=>{});
 assert.equal(out.maps.width,2);assert.deepEqual([...out.maps.hair],[255,128]);
});
test('smaller detailed masks interpolate smoothly to the unchanged multiclass dimensions',async()=>{
 const m=models({width:4,segmentValues:[[0,.60,.60,.60],[1,.35,.35,.35],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],hairWidth:2,hairValues:[[0,.6],[1,.4]]}),out=await(await engine(withHair(m),async()=>m.api)).detect({},()=>{});
 assert.equal(out.maps.width,4);const h=out.maps.hair;assert.equal(h[0],255);assert.ok(h[1]>h[2]&&h[2]>h[3]&&h[3]>0);
});
test('hair labels select the hair plane even if its confidence index changes',async()=>{
 const m=models({hairLabels:['hair','background'],hairValues:[[0,1],[1,0]]}),out=await(await engine(withHair(m),async()=>m.api)).detect({},()=>{});assert.deepEqual([...out.maps.hair],[0,255]);assert.deepEqual(out.errors,[]);
});
test('failed optional hair refinement keeps a usable multiclass hair mask and closes the model',async()=>{
 for(const options of [{fail:['hair']},{hairLabels:['background','person']}]){
  const m=models(options),out=await(await engine(withHair(m),async()=>m.api)).detect({},()=>{});assert.deepEqual([...out.maps.hair],[0,255]);assert.deepEqual(out.errors,['hair']);assert.equal(out.faces.length,1);assert.equal(m.active.size,0);assert.ok(m.events.includes('close:hair'));
 }
});
test('optional hair never turns an entirely failed recognition into an empty success',async()=>{
 const m=models({fail:['segment','face']}),run=await engine(withHair(m),async()=>m.api);await assert.rejects(run.detect({},()=>{}),/Không khởi chạy được/);assert.equal(m.active.size,0);assert.ok(!m.events.includes('open:hair'));
});
test('serialized worker engine contains all detailed hair logic without outer-scope dependencies',async()=>{
 const serialized=Function('return ('+engine.toString()+')')(),m=models(),out=await(await serialized(withHair(m),async()=>m.api)).detect({},()=>{});assert.deepEqual([...out.maps.hair],[0,255]);assert.deepEqual(out.errors,[]);
});
test('legacy pages can load the shared runtime without initializing darkroom-only globals',()=>{
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),context={};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/darkroom/beauty-runtime.js'),'utf8'),context);assert.equal(typeof context.RayBeautyRuntime.engine,'function');
});
test('full makeup releases each model sequentially and preserves copied skin, hair and person maps',async()=>{
 const m=models({faces:2}),run=await engine(m.assets,async()=>m.api),out=await run.detect({},()=>{});
 assert.deepEqual(m.events,['open:segment','close:segment','open:face','close:face','open:pose','close:pose']);assert.equal(m.active.size,0);assert.equal(m.results,2);
 assert.deepEqual(Array.from(out.maps.skin),[255,0]);assert.deepEqual(Array.from(out.maps.hair),[0,255]);assert.deepEqual(Array.from(out.instances[0].data),[0,255,128,0]);assert.equal(out.faces.length,2);
});
test('inference errors close models before fallback and do not leave an AI allocation alive',async()=>{
 const m=models({fail:['segment']}),run=await engine(m.assets,async()=>m.api),out=await run.detect({},()=>{});
 assert.deepEqual(out.errors,['segment']);assert.equal(out.faces.length,1);assert.equal(m.active.size,0);assert.deepEqual(m.events,['open:segment','close:segment','open:face','close:face']);
});
test('a failed face-only scan releases its model and surfaces a failure to the editor',async()=>{
 const m=models({fail:['face']}),run=await engine({...m.assets,kinds:['face']},async()=>m.api);
 await assert.rejects(run.detect({},()=>{}),/Không khởi chạy được/);assert.equal(m.active.size,0);assert.deepEqual(m.events,['open:face','close:face']);await run.close();
});
test('background removal retains clothes as foreground without changing the skin or hair maps',async()=>{
 const m=models({segmentValues:[[1,0],[0,0],[0,0],[0,0],[0,1],[0,0]]}),run=await engine({...m.assets,kinds:['segment']},async()=>m.api),out=await run.detect({},()=>{});assert.deepEqual(Array.from(out.maps.foreground),[0,255]);assert.deepEqual(Array.from(out.maps.skin),[0,0]);assert.deepEqual(Array.from(out.maps.hair),[0,0]);assert.equal(m.active.size,0);assert.deepEqual(m.events,['open:segment','close:segment']);
});
test('a distant face gets one hair-guided crop retry and landmarks map back to the full photo',async()=>{
 const previous=global.OffscreenCanvas,canvases=[];global.OffscreenCanvas=class{constructor(w,h){this.width=w;this.height=h;canvases.push(this);}getContext(){return{drawImage(){},imageSmoothingQuality:''};}};
 try{let calls=0;const n=100,values=Array.from({length:6},()=>new Float32Array(n));for(let y=0;y<10;y++)for(let x=0;x<10;x++)values[x>=4&&x<6&&y>=1&&y<7?1:0][y*10+x]=1;
  const api={FilesetResolver:{forVisionTasks:async()=>({})},ImageSegmenter:{createFromOptions:async()=>({segment:()=>({confidenceMasks:values.map(data=>({width:10,height:10,getAsFloat32Array:()=>data})),close(){}}),close(){}})},FaceLandmarker:{createFromOptions:async()=>({detect:()=>({faceLandmarks:++calls===1?[]:[[{x:.5,y:.4,z:.1}]]}),close(){}})}};
  const run=await engine({roots:['mock'],segment:'data:,segment',face:'data:,face',kinds:['segment','face']},async()=>api),out=await run.detect({width:1000,height:800},()=>{});assert.equal(calls,2);assert.equal(out.faces.length,1);assert.ok(Math.abs(out.faces[0][0].x-.5)<1e-8);assert.ok(Math.abs(out.faces[0][0].y-.34)<1e-8);assert.ok(Math.abs(out.faces[0][0].z-.036)<1e-8);assert.ok(canvases.every(c=>c.width===0&&c.height===0));assert.deepEqual(out.errors,[]);await run.close();
 }finally{if(previous===undefined)delete global.OffscreenCanvas;else global.OffscreenCanvas=previous;}
});

function smallHeadFace(cx=.5,cy=.3,size=.04){return Array.from({length:478},(_,i)=>({x:cx+Math.cos(i/478*Math.PI*2)*size/2,y:cy+Math.sin(i/478*Math.PI*2)*size/1.6,z:0}));}
async function headFixture({failCrop=false,enabled=true,faces=[smallHeadFace()],serialized=false}={}){
 const previous=global.OffscreenCanvas,canvases=[],events=[],active=new Set();let resultsClosed=0;
 class Crop{constructor(w,h){this.width=w;this.height=h;this.initialWidth=w;this.initialHeight=h;canvases.push(this);}getContext(){return{drawImage:(...args)=>{this.draw=args;},imageSmoothingQuality:''};}}
 global.OffscreenCanvas=Crop;
 try{
  const W=20,H=16,N=W*H,full=Array.from({length:6},()=>new Float32Array(N));full[0].fill(1);full[0][42]=0;full[1][42]=1;full[0][89]=0;full[2][89]=1;
  function segment(kind,image){
   const crop=image instanceof Crop;if(crop&&failCrop&&kind==='hair')throw Error('crop inference failed');
   const width=crop?8:W,height=crop?8:H,n=width*height,values=Array.from({length:kind==='hair'?2:6},()=>new Float32Array(n));
   if(crop){for(let y=0;y<height;y++)for(let x=0;x<width;x++)values[kind==='hair'?(x<4?0:1):(x<4?2:1)][y*width+x]=1;}
   else if(kind==='segment')for(let i=0;i<6;i++)values[i].set(full[i]);
   else{values[0].fill(1);values[0][42]=0;values[1][42]=1;}
   return{confidenceMasks:values.map(data=>({width,height,getAsFloat32Array:()=>data})),close(){resultsClosed++;}};
  }
  function open(kind){assert.equal(active.size,0,'head models must not overlap in memory');active.add(kind);events.push('open:'+kind);return{getLabels:()=>kind==='hair'?['background','hair']:[],segment:image=>segment(kind,image),detect:()=>({faceLandmarks:faces}),close(){assert.equal(active.delete(kind),true);events.push('close:'+kind);}};}
  const api={FilesetResolver:{forVisionTasks:async()=>({})},ImageSegmenter:{createFromOptions:async(f,o)=>open(new TextDecoder().decode(o.baseOptions.modelAssetBuffer))},FaceLandmarker:{createFromOptions:async()=>open('face')}};
  const start=serialized?Function('return ('+engine.toString()+')')():engine,run=await start({roots:['mock'],segment:'data:,segment',hair:'data:,hair',face:'data:,face',kinds:['segment','hair','face'],refineHeads:enabled},async()=>api),source={width:1000,height:800},out=await run.detect(source,()=>{});await run.close();
  assert.equal(active.size,0);return{out,canvases,events,resultsClosed,full,source};
 }finally{if(previous===undefined)delete global.OffscreenCanvas;else global.OffscreenCanvas=previous;}
}
test('a distant head gets sequential local semantics and hair, projected without altering skin or foreground',async()=>{
 const q=await headFixture(),m=q.out.maps;
 assert.deepEqual(q.events,['open:segment','close:segment','open:hair','close:hair','open:face','close:face','open:segment','close:segment','open:hair','close:hair']);
 assert.equal(q.resultsClosed,4);assert.equal(q.canvases.length,1);assert.ok(q.canvases[0].initialWidth<=512&&q.canvases[0].initialHeight<=512);assert.equal(q.canvases[0].width,0);assert.equal(q.canvases[0].height,0);
 assert.equal(m.hair[42],255,'previous hair outside crop retained');assert.equal(m.hair[4*20+10],255,'new hair projected to matching photo position');assert.equal(m.hair[4*20+9],0,'local skin semantic protects hand side');assert.equal(m.hair[0],0,'crop never affects unrelated background');
 assert.equal(m.skin[89],255);assert.equal(m.foreground[42],255);assert.equal(m.foreground[0],0);assert.equal(m.skin.reduce((a,b)=>a+b,0),255);assert.equal(m.foreground.reduce((a,b)=>a+b,0),510);assert.deepEqual(q.out.errors,[]);
});
test('optional head inference failure preserves existing hair and releases its result, model and canvas',async()=>{
 const q=await headFixture({failCrop:true});assert.equal(q.out.maps.hair[42],255);assert.equal(q.out.maps.hair[4*20+10],0);assert.equal(q.out.warnings.length,1);assert.match(q.out.warnings[0],/giữ vùng tóc/);assert.equal(q.canvases[0].width,0);assert.equal(q.canvases[0].height,0);assert.deepEqual(q.out.errors,[]);
});
test('head refinement stays bounded and skips close portraits or explicitly disabled passes',async()=>{
 const disabled=await headFixture({enabled:false});assert.equal(disabled.canvases.length,0);assert.equal(disabled.events.length,6);
 const close=await headFixture({faces:[smallHeadFace(.5,.5,.4)]});assert.equal(close.canvases.length,0);assert.equal(close.events.length,6);
 const group=await headFixture({faces:[smallHeadFace(.15,.2),smallHeadFace(.35,.3),smallHeadFace(.6,.4),smallHeadFace(.85,.6)]});assert.equal(group.canvases.length,3);assert.ok(group.canvases.every(c=>c.width===0&&c.height===0));
});
test('serialized worker engine includes the complete distant-head refinement',async()=>{
 const q=await headFixture({serialized:true});assert.equal(q.out.maps.hair[4*20+10],255);assert.equal(q.canvases.length,1);
});
