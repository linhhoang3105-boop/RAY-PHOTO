const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),vm=require('node:vm');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const C=require('../dist/darkroom/remove-core.js'),S=require('../dist/darkroom/remove-selection-core.js'),P=require('../dist/darkroom/region-paint-core.js'),Photo=require('../dist/darkroom/photo-edit-core.js'),AI=require('../dist/darkroom/remove-ai.js'),{Timeline}=require('../dist/darkroom/edit-history.js');
function mask(id,x0,x1,W=80,H=60){const data=new Uint8Array(W*H);for(let y=8;y<55;y++)for(let x=x0;x<x1;x++)data[y*W+x]=255;return{id,width:W,height:H,data};}
test('AI selects only the connected object at the tap, while brush erasing can refine its edge',()=>{
 const raw=new Float32Array(80*60);for(const m of [mask('a',10,25),mask('b',50,65)])for(let i=0;i<raw.length;i++)if(m.data[i])raw[i]=.95;
 const m=S.component(raw,80,60,{x:.2,y:.5},'picked');assert.ok(S.at(m,.2,.5)>.9);assert.equal(S.at(m,.7,.5),0);
 const state={...C.defaults(),aiSelection:m,strokes:[{mode:'erase',size:.18,points:[[.2,.5]]}]},r=S.raster(state,80,60,P);assert.equal(r.mask[30*80+16],0);assert.ok(r.mask[12*80+16]>.9);
});
test('automatic protection distinguishes a selected person from an accidentally overlapped neighbor',()=>{
 const people=[mask('keep',12,27),mask('remove',48,64)],selected=new Float32Array(80*60);for(let y=8;y<55;y++)for(let x=25;x<66;x++)selected[y*80+x]=1;
 assert.deepEqual(S.otherPeople(people,selected,80,60).map(m=>m.id),['keep']);
});
test('automatic guards fill enclosed confidence holes while user unprotect strokes can still reopen them',()=>{
 const keep=mask('keep',10,35),target=mask('target',50,65);for(let y=20;y<35;y++)for(let x=18;x<28;x++)keep.data[y*80+x]=0;const before=keep.data.slice(),guards=S.otherPeople([keep,target],new Float32Array(4800),80,60,[{x:.7,y:.3}]);assert.equal(S.at(guards[0],.27,.45),1);assert.equal(S.at(guards[0],.05,.45),0);assert.deepEqual(keep.data,before);
 const r=S.raster({...C.defaults(),autoMasks:guards,protectStrokes:[{mode:'erase',size:.12,points:[[.27,.45]]}]},80,60,P);assert.equal(r.protect[27*80+21],0);assert.equal(r.protect[15*80+21],1);
});
test('a tapped person includes disconnected candidate limbs while every other instance stays protected',()=>{
 const target=mask('target',10,25),neighbor=mask('neighbor',50,65),raw=new Float32Array(80*60);
 for(let i=0;i<raw.length;i++)if(target.data[i]||neighbor.data[i])raw[i]=.95;
 for(let y=25;y<30;y++)for(let x=10;x<25;x++)raw[y*80+x]=0;
 const tap={x:.2,y:.2},first=S.component(raw,80,60,tap,'head'),original=first.data.slice(),full=S.completePerson(first,[target,neighbor],'whole');
 assert.equal(S.at(first,.2,.7),0);assert.ok(S.at(full,.2,.7)>.9);assert.equal(S.at(full,.2,.45),0,'the intervening railing is not a limb');assert.equal(S.at(full,.7,.7),0);assert.deepEqual(first.data,original);
 const wide=Float32Array.from(raw,v=>v>.4?1:0),guards=S.otherPeople([target,neighbor],wide,80,60,S.anchors(full));assert.deepEqual(guards.map(m=>m.id),['neighbor'],'even a fully overlapped neighbor is not a target without a tap');
 const r=S.raster({...C.defaults(),aiSelection:full,autoMasks:guards},80,60,P);assert.equal(r.protect[42*80+16],0);assert.equal(r.protect[42*80+56],1);assert.equal(r.mask[42*80+56],0);assert.equal(r.mask[42*80+16],1);
});
test('AI correction unions the previous region and tap ownership without mutating its saved mask',()=>{
 const a={...mask('a',10,25),point:{x:.2,y:.3},points:[{x:.2,y:.3}]},b={...mask('b',28,36),point:{x:.4,y:.5},points:[{x:.4,y:.5}]};a.candidate=a.data.slice();b.candidate=b.data.slice();const before=structuredClone(a),merged=S.merge(a,b,'combined');
 assert.equal(S.at(merged,.2,.5),1);assert.equal(S.at(merged,.4,.5),1);assert.equal(S.at({...merged,data:merged.candidate},.2,.5),1);assert.deepEqual(S.anchors(merged),[a.point,b.point]);assert.deepEqual(a,before);
 const corrected=C.beginCorrection(C.completed({...C.defaults(),aiSelection:merged},{id:'patch'},[],1,null));assert.deepEqual(corrected.aiSelection,merged);
});
test('the visible AI cleanup rim includes the edge while later erasing and other-person guards still win',()=>{
 const tight={...mask('tight',10,25),point:{x:.2,y:.3},points:[{x:.2,y:.3}]},before=tight.data.slice(),wide=S.fringe(tight,'rim'),neighbor=mask('neighbor',27,35);assert.ok(wide.cleanupRim>=2);assert.equal(S.at(tight,.1,.3),0);assert.equal(S.at(wide,.1,.3),1);assert.deepEqual(tight.data,before);
 const guards=S.otherPeople([tight,neighbor],new Float32Array(80*60).fill(1),80,60,S.anchors(wide)),r=S.raster({...C.defaults(),aiSelection:wide,autoMasks:guards,strokes:[{mode:'erase',size:.2,points:[[.2,.5]]}]},80,60,P);assert.equal(r.mask[30*80+16],0,'manual trimming follows AI expansion');assert.equal(r.protect[30*80+28],1);assert.equal(r.mask[30*80+28],0);assert.equal(r.mask[15*80+16],1);
 assert.deepEqual(S.otherPeople([neighbor],new Float32Array(80*60).fill(1),80,60,[{x:.8,y:.1}]).map(m=>m.id),['neighbor'],'a person not owned by the tap stays protected even if the raw object mask overlaps them');
});
test('new automatic person guards cannot restore old deletions, including after cache invalidation',()=>{
 const src=createCanvas(80,60),sc=src.getContext('2d');sc.fillStyle='#234567';sc.fillRect(0,0,80,60);const patch=createCanvas(80,60),pc=patch.getContext('2d');pc.fillStyle='#f02040';pc.fillRect(0,0,80,60);
 const state={...C.defaults(),autoMasks:[mask('previously-removed',10,25)],patches:[{id:'old',placement:[1,0,0,1,0,0]}]},code=fs.readFileSync(require.resolve('../dist/darkroom/remove-editor.js'),'utf8'),prepare=code.slice(code.indexOf(' function prepare('),code.indexOf(' function record(')),context={source:src,documentSource:src,state,peek:false,cache:null,core:C,selectionCore:S,RayRegionPaint:P,hasGuard:()=>context.state.protectedMasks.length||P.hasPaint(context.state.protectStrokes),make:()=>createCanvas(1,1),tile:()=>patch,discard(){context.cache=null;}};
 vm.createContext(context);vm.runInContext(prepare,context);const pixels=()=>Buffer.from(context.prepare(src).getContext('2d').getImageData(0,0,80,60).data),before=pixels();assert.deepEqual([...before.subarray((30*80+16)*4,(30*80+16)*4+4)],[240,32,64,255]);
 context.state={...state,autoMasks:[mask('another-operation',5,30)]};assert.deepEqual(pixels(),before);context.cache=null;assert.deepEqual(pixels(),before);
 context.state={...context.state,protectedMasks:[mask('explicit-user-keep',32,40)]};const manual=pixels();assert.deepEqual([...manual.subarray((30*80+16)*4,(30*80+16)*4+4)],[240,32,64,255]);assert.deepEqual([...manual.subarray((30*80+36)*4,(30*80+36)*4+4)],[35,69,103,255]);
});
test('rotation remaps correction candidates and all tap anchors along with the visible selection',()=>{
 const selected={...mask('target',45,60),point:{x:.65,y:.5},points:[{x:.65,y:.5},{x:.7,y:.8}]};selected.candidate=selected.data.slice();const before=structuredClone(selected),snapshot={p:{},focus:{cx:.5,cy:.5,rx:.2,ry:.2},sun:{x:.5,y:.1},leak:{x:0,y:0},layers:[],body:[],removal:{...C.defaults(),aiSelection:selected}},rotated=Photo.remap(snapshot,80,60,Photo.operation(80,60,'right')).removal.aiSelection;
 assert.deepEqual(rotated.point,{x:.5,y:.65});assert.ok(Math.abs(rotated.points[1].x-.2)<1e-12);assert.equal(rotated.points[1].y,.7);assert.ok(S.at({...rotated,data:rotated.candidate},.5,.65)>.9);assert.deepEqual(selected,before);
});
test('adding protection also restores a subject covered by an earlier repair through the actual editor compositing path',()=>{
 const W=80,H=60,src=createCanvas(W,H),ctx=src.getContext('2d');ctx.fillStyle='#99aa77';ctx.fillRect(0,0,W,H);ctx.fillStyle='#234567';ctx.fillRect(32,8,8,47);const original=ctx.getImageData(0,0,W,H).data.slice(),patchCanvas=createCanvas(W,H);patchCanvas.getContext('2d').fillStyle='#f02040';patchCanvas.getContext('2d').fillRect(0,0,W,H);const keep=mask('keep',32,40),state={...C.defaults(),protectedMasks:[keep],patches:[{id:'old',placement:[1,0,0,1,0,0]}]};
 const code=fs.readFileSync(require.resolve('../dist/darkroom/remove-editor.js'),'utf8'),prepare=code.slice(code.indexOf(' function prepare('),code.indexOf(' function record(')),context={source:src,documentSource:src,state,peek:false,cache:null,core:C,selectionCore:S,RayRegionPaint:P,hasGuard:()=>true,make:()=>createCanvas(1,1),tile:()=>patchCanvas,discard(){context.cache=null;}};vm.createContext(context);vm.runInContext(prepare,context);const result=context.prepare(src).getContext('2d').getImageData(0,0,W,H).data;
 for(let y=8;y<55;y++)for(let x=32;x<40;x++){const k=(y*W+x)*4;assert.deepEqual(result.subarray(k,k+4),original.subarray(k,k+4));}assert.deepEqual([...result.subarray(0,4)],[240,32,64,255]);
});
test('a protected subject stays byte-for-byte intact after brush overlap, padding, native export and draft undo/redo',async()=>{
 const W=80,H=60,keep=mask('keep',32,40),state={...C.defaults(),protectedMasks:[keep],strokes:[{mode:'paint',size:.5,points:[[.53,.5]]}]},r=S.raster(state,W,H,P),data=new Uint8ClampedArray(W*H*4);
 for(let i=0;i<W*H;i++)data.set(keep.data[i]?[45,70,140,255]:[170,190,155,255],i*4);
 const original=data.slice(),plan=await C.repair({width:W,height:H,data,mask:r.mask,protect:r.protect,padding:6}),src=createCanvas(317,241),ctx=src.getContext('2d'),small=createCanvas(W,H),im=small.getContext('2d').createImageData(W,H);im.data.set(data);small.getContext('2d').putImageData(im,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(small,0,0,317,241);
 const before=ctx.getImageData(0,0,317,241).data.slice(),patch=C.materialize(src,plan,()=>createCanvas(1,1)),tile=createCanvas(patch.width,patch.height),pi=tile.getContext('2d').createImageData(patch.width,patch.height);pi.data.set(patch.data);tile.getContext('2d').putImageData(pi,0,0);C.drawPatch(ctx,patch,tile,317,241);const after=ctx.getImageData(0,0,317,241).data;
 for(let y=0;y<241;y++)for(let x=0;x<317;x++)if(S.at(keep,(x+.5)/317,(y+.5)/241)>.15){const i=(y*317+x)*4;assert.deepEqual(after.subarray(i,i+4),before.subarray(i,i+4));}
 for(const q of plan.donors)if(q>=0)assert.equal(r.protect[q],0,'kept person cannot become a background donor');assert.deepEqual(data,original);
 const timeline=new Timeline(),a={key:'a',removal:C.defaults()},b={key:'b',removal:{...state,patches:[{...patch,id:'p'}]}};timeline.reset(a);timeline.push(b);assert.equal(timeline.undo().removal.patches.length,0);assert.deepEqual(structuredClone(timeline.redo()).removal.protectedMasks[0].data,keep.data);
});
test('AI selection, protection and correction masks follow crop/rotation without corrupting old snapshots',()=>{
 const keep=mask('keep',10,25),target=mask('target',45,60),base={p:{},focus:{cx:.5,cy:.5,rx:.2,ry:.2},sun:{x:.5,y:.1},leak:{x:0,y:0},layers:[],body:[],removal:{...C.defaults(),aiSelection:target,lastAiSelection:target,protectedMasks:[keep],autoMasks:[keep],protectStrokes:[{mode:'paint',size:.1,points:[[.2,.4]]}]}},mapped=Photo.remap(base,80,60,Photo.operation(80,60,'right'));
 assert.equal(mapped.removal.protectedMasks[0].width,60);assert.equal(mapped.removal.protectedMasks[0].height,80);assert.ok(S.at(mapped.removal.protectedMasks[0],.5,.2)>.9);assert.equal(S.at(keep,.2,.5),1);assert.ok(mapped.removal.aiSelection.id!==target.id);
 const patch={id:'p',placement:[1,0,0,1,0,0]},done=C.completed({...base.removal},patch,[],1,null);assert.equal(done.aiSelection,null);assert.equal(done.lastAiSelection.id,'target');assert.equal(C.beginCorrection(done).aiSelection.id,'target');assert.equal(C.jobSettings(done,true).aiSelection.id,'target');assert.ok(C.signature(done).length<3000);
});
test('exemplar exports retain one original texture sample rather than averaging incompatible source detail',()=>{
 const src=createCanvas(20,20),c=src.getContext('2d'),im=c.createImageData(20,20);for(let y=0;y<20;y++)for(let x=0;x<20;x++){const v=(x+y)%2?80:180;im.data.set([v,v,v,255],(y*20+x)*4);}c.putImageData(im,0,0);
 const plan={width:2,height:2,donors:new Int32Array([1,3,5,7]),sampling:{width:4,height:4,x:0,y:0},correction:{width:2,height:2,data:new Float32Array(12)},texture:'native',synthesis:'exemplar',placement:[.5,0,0,.5,0,0]};
 const out=C.materialize(src,plan,()=>createCanvas(1,1));for(let i=0;i<out.data.length;i+=4)if(out.data[i+3])assert.ok(out.data[i]===80||out.data[i]===180,'no gray average of different fine textures');
});
test('the pinned object AI callback copies the foreground channel and closes its graph on success or error',async()=>{
 let closed=0,options;const foreground=new Float32Array(16).fill(.9),vision={FilesetResolver:{forVisionTasks:async()=>({})},InteractiveSegmenter:{async createFromOptions(_,o){options=o;return{segment(image,roi,cb){assert.deepEqual(roi,{keypoint:{x:.2,y:.4}});cb({confidenceMasks:[null,{width:4,height:4,getAsFloat32Array:()=>foreground}]});foreground.fill(0);},close(){closed++;}};}}};
 const infer=(0,eval)('('+AI.infer.toString()+')'),out=await infer({},'object',{x:.2,y:.4},{root:'local',object:'model'},()=>{},async()=>vision,async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)}));assert.ok(out.data[0]>.8);assert.equal(closed,1);assert.equal(options.outputConfidenceMasks,true);assert.equal(options.baseOptions.delegate,'CPU');
 vision.InteractiveSegmenter.createFromOptions=async()=>({segment(){throw Error('failed');},close(){closed++;}});await assert.rejects(infer({},'object',{x:.2,y:.4},{root:'local',object:'model'},()=>{},async()=>vision,async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)})),/failed/);assert.equal(closed,2);
});
test('portrait protection falls back from zero poses to independently face-seeded foreground instances',async()=>{
 const left=mask('left',10,25),right=mask('right',50,65),closed=[],fetched=[],faces=[[null,{x:.2,y:.3}],[null,{x:.7,y:.3}]],vision={FilesetResolver:{forVisionTasks:async()=>({})},PoseLandmarker:{async createFromOptions(){return{detect:()=>({segmentationMasks:[],close(){closed.push('pose-result');}}),close(){closed.push('pose');}};}},FaceLandmarker:{async createFromOptions(_,opts){assert.equal(opts.numFaces,6);assert.equal(opts.baseOptions.delegate,'CPU');return{detect:()=>({faceLandmarks:faces}),close(){closed.push('face');}};}},InteractiveSegmenter:{async createFromOptions(){return{segment(_,roi,cb){const m=roi.keypoint.x<.5?left:right;cb({confidenceMasks:[{width:80,height:60,getAsFloat32Array:()=>Float32Array.from(m.data,v=>v/255)}]});},close(){closed.push('object');}};}}};
 const infer=(0,eval)('('+AI.infer.toString()+')'),people=await infer({},'people',null,{root:'local',pose:'pose',face:'face',object:'object'},()=>{},async()=>vision,async url=>{fetched.push(url);return{ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};});assert.equal(people.length,2);assert.equal(S.at(people[0],.2,.3),1);assert.equal(S.at(people[1],.7,.3),1);assert.equal(S.at(people[0],.7,.3),0);assert.deepEqual(S.otherPeople(people,new Float32Array(4800).fill(1),80,60,[{x:.7,y:.3}]).map(m=>m.id),[people[0].id]);assert.deepEqual(closed,['pose-result','pose','face','object','object']);assert.deepEqual(fetched,['pose','face','object','object']);
});
test('an existing pose-owned face reuses its instance, and fallback errors close every active graph',async()=>{
 let poses=0,faces=0,objects=0;const keep=mask('pose',10,25),vision={FilesetResolver:{forVisionTasks:async()=>({})},PoseLandmarker:{async createFromOptions(){return{detect:()=>({segmentationMasks:[{width:80,height:60,getAsFloat32Array:()=>Float32Array.from(keep.data,v=>v/255)}]}),close(){poses++;}};}},FaceLandmarker:{async createFromOptions(){return{detect:()=>({faceLandmarks:[[null,{x:.2,y:.3}]]}),close(){faces++;}};}},InteractiveSegmenter:{async createFromOptions(){objects++;throw Error('must not segment a face already covered by its pose');}}};
 const infer=(0,eval)('('+AI.infer.toString()+')'),read=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)}),people=await infer({},'people',null,{root:'local',pose:'pose',face:'face',object:'object'},()=>{},async()=>vision,read);assert.equal(people.length,1);assert.equal(objects,0);assert.equal(poses,1);assert.equal(faces,1);
 vision.FaceLandmarker.createFromOptions=async()=>({detect(){throw Error('face failed');},close(){faces++;}});await assert.rejects(infer({},'people',null,{root:'local',pose:'pose',face:'face'},()=>{},async()=>vision,read),/face failed/);assert.equal(poses,2);assert.equal(faces,2);
});
test('the single foreground channel returned by the real pinned MagicTouch model becomes a bounded person selection',async()=>{
 const image=await loadImage(path.join(__dirname,'../docs/qa/removal-v89-cpu-mask.png')),canvas=createCanvas(image.width,image.height),c=canvas.getContext('2d');c.drawImage(image,0,0);const rgba=c.getImageData(0,0,image.width,image.height).data,values=Float32Array.from({length:image.width*image.height},(_,i)=>rgba[i*4]/255);
 let closed=0;const vision={FilesetResolver:{forVisionTasks:async()=>({})},InteractiveSegmenter:{createFromOptions:async()=>({segment(_,roi,cb){cb({confidenceMasks:[{width:image.width,height:image.height,getAsFloat32Array:()=>values}]});},close(){closed++;}})}};
 const result=await AI.infer({},'object',{x:.806,y:.61},{root:'local',object:'model'},()=>{},async()=>vision,async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)})),mask=S.component(result.data,result.width,result.height,{x:.806,y:.61},'real-cpu');
 assert.equal(closed,1);assert.equal(S.at(mask,.806,.61),1);assert.equal(S.at(mask,.2,.4),0);const area=mask.data.filter(v=>v>=102).length/mask.data.length;assert.ok(area>.04&&area<.06);
});
