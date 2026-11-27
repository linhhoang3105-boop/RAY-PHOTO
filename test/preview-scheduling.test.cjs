const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createCanvas}=require('@napi-rs/canvas');
const Quality=require('../dist/darkroom/quality-core.js');

function editor(large=false){
 const timers=new Map(),idle=new Map(),events={},windowEvents={},created=[],nodes={beautyScan:{},bodyAiScan:{onclick:async()=>{}},sizeSeg:{addEventListener(){}}};let sequence=0,renders=0,finishAI;
 const source=createCanvas(large?3024:40,large?4032:30),view=createCanvas(20,15),inputs=[];view.dataset={};view.getBoundingClientRect=()=>large?{width:200,height:270}:{width:20,height:15};
 const faces=[{id:'kept-face'}],beauty={busy:false,faces};
 nodes.beautyScan.onclick=async()=>{beauty.busy=true;await new Promise(resolve=>finishAI=resolve);beauty.busy=false;};
 const h={RayQuality:Quality,source,view,exportLong:null,LASTG:null,BEAUTY:beauty,BODY_AI:{busy:false},RayCompose:{busy:false},RayRemove:{busy:false},busy:{classList:{contains:()=>false}},
  document:{hidden:false,body:{dataset:{}},createElement(tag){created.push(tag);assert.equal(tag,'canvas','refinement must not add a status overlay');return createCanvas(1,1);},getElementById:id=>nodes[id],addEventListener(type,fn){events[type]=fn;}},
  setTimeout(fn){const id=++sequence;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),
  requestIdleCallback(fn){const id=++sequence;idle.set(id,fn);return id;},cancelIdleCallback:id=>idle.delete(id),addEventListener(type,fn){windowEvents[type]=fn;},devicePixelRatio:1,
  draw(){},render(target,input){renders++;inputs.push(input);if(!large)assert.equal(input,source,'small sources do not need resampling');else assert.ok(input.width*input.height<=1602500);target.width=input.width;target.height=input.height;target.getContext('2d').drawImage(input,0,0);},syncOval(){},syncLeakHandle(){},syncNangHandle(){},syncBody(){},queue(){h.draw();}};
 h.window=h;vm.createContext(h);vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/darkroom/preview-quality.js'),'utf8'),h);
 function drain(map){for(const [id,fn]of [...map]){map.delete(id);fn();}}
 return{h,nodes,timers,idle,events,windowEvents,created,faces,inputs,get renders(){return renders;},finishAI:()=>finishAI(),timer:()=>drain(timers),settle(){drain(timers);drain(idle);}};
}
test('AI takes priority over stale refinement, then keeps its face result when the preview settles silently',async()=>{
 const e=editor();e.h.draw();e.timer();const stale=[...e.idle.values()][0];assert.ok(stale);
 const detection=e.nodes.beautyScan.onclick();assert.equal(e.idle.size,0);stale();e.h.draw();e.settle();assert.equal(e.renders,0);
 e.finishAI();await detection;e.settle();assert.equal(e.renders,1);assert.equal(e.h.BEAUTY.faces,e.faces);assert.equal(e.h.view.dataset.previewQuality,'full');assert.ok(e.created.every(x=>x==='canvas'));
});
test('a long slider drag never starts source-size refinement until all pointers release',()=>{
 const e=editor();e.events.pointerdown({pointerId:1});e.h.draw();e.settle();assert.equal(e.renders,0);
 e.events.pointerdown({pointerId:2});e.events.pointerup({pointerId:1});e.settle();assert.equal(e.renders,0);
 e.events.pointerup({pointerId:2});e.settle();assert.equal(e.renders,1);
});
test('AI starting after idle scheduling still prevents a heavy render, without touching the detected face',()=>{
 const e=editor();e.h.draw();e.timer();e.h.BEAUTY.busy=true;e.settle();assert.equal(e.renders,0);assert.equal(e.h.BEAUTY.faces,e.faces);
 e.h.BEAUTY.busy=false;e.h.draw();e.settle();assert.equal(e.renders,1);
});
test('repeated edits reuse a bounded screen input, while export still receives the 12 MP source',async()=>{
 const e=editor(true),photo=e.h.source;e.h.draw();e.settle();assert.equal(e.h.view.dataset.previewQuality,'screen');e.h.draw();e.settle();assert.equal(e.inputs[0],e.inputs[1]);assert.notEqual(e.inputs[0],photo);assert.deepEqual([photo.width,photo.height],[3024,4032]);
 let exported;const result=await Quality.output({source:photo,make:()=>createCanvas(1,1),render(target,input){assert.equal(input,photo);target.width=input.width;target.height=input.height;target.getContext('2d').drawImage(input,0,0);},encode:async cv=>{exported=[cv.width,cv.height];return new Blob(['image']);}});
 assert.deepEqual(exported,[3024,4032]);assert.deepEqual([result.width,result.height],[3024,4032]);assert.deepEqual([photo.width,photo.height],[3024,4032]);
});
test('export pauses refinement and thumbnails, then keeps the source-rendered view when released',()=>{
 const e=editor();e.h.draw();assert.equal(e.h.RayPreview.isQuiet(),false);const resume=e.h.RayPreview.pause({refineOnResume:false});e.settle();assert.equal(e.renders,0);assert.equal(e.h.RayPreview.isQuiet(),false);
 const image=createCanvas(40,30);e.h.RayPreview.showExport(image,40,30);resume();e.settle();assert.equal(e.renders,0);assert.equal(e.h.view.dataset.previewQuality,'full');assert.equal(e.h.RayPreview.isQuiet(),true);
});
test('expanding the photo area refreshes its retina buffer without changing the source or photo ratio',()=>{
 const e=editor(true);let box={width:200,height:270};e.h.RayWorkspace={photoBox:()=>box};e.h.devicePixelRatio=3;e.h.draw();e.settle();const before=[e.h.view.width,e.h.view.height];
 box={width:394,height:450};e.h.RayPreview.layoutChanged();e.settle();assert.ok(e.h.view.width>before[0]&&e.h.view.height>before[1]);assert.ok(Math.abs(e.h.view.width/e.h.view.height-.75)<.002);assert.deepEqual([e.h.source.width,e.h.source.height],[3024,4032]);
});
test('scrolling the tools leaves queued refinement running while sliders still pause it',()=>{
 const e=editor(),scroll={closest:s=>s==='.panel .scroll'?{}:null};e.h.draw();e.timer();assert.equal(e.idle.size,1);e.events.pointerdown({pointerId:1,target:scroll});assert.equal(e.idle.size,1);e.settle();assert.equal(e.renders,1);
 const slider={closest:()=>({})};e.events.pointerup({pointerId:1});e.events.pointerdown({pointerId:2,target:slider});e.h.draw();e.settle();assert.equal(e.renders,1);e.events.pointerup({pointerId:2});e.settle();assert.equal(e.renders,2);
});
test('shrinking and restoring the tool panel retains the sharper buffer and source pixels',()=>{
 const e=editor(true),source=e.h.source;let box={width:390,height:500},fits=0;e.h.RayWorkspace={photoBox:()=>box,fitPhoto:()=>fits++};e.h.devicePixelRatio=3;e.h.draw();e.settle();const buffer=[e.h.view.width,e.h.view.height],count=e.renders;
 box={width:220,height:280};e.h.RayPreview.layoutChanged();e.settle();assert.deepEqual([e.h.view.width,e.h.view.height],buffer);assert.equal(e.renders,count);box={width:390,height:500};e.h.RayPreview.layoutChanged();e.settle();assert.deepEqual([e.h.view.width,e.h.view.height],buffer);assert.equal(e.renders,count);assert.ok(fits>=3);assert.equal(e.h.source,source);
});

test('returning from the browser bar resumes a cancelled quick preview',()=>{const e=editor();e.h.draw();e.windowEvents.blur();e.settle();assert.equal(e.renders,0);e.windowEvents.focus();e.settle();assert.equal(e.renders,1);assert.equal(e.h.view.dataset.previewQuality,'full');});
