const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../dist/darkroom/body-ai/contour-core.js'),P=require('../dist/darkroom/body-ai/pose-core.js'),Photo=require('../dist/darkroom/photo-edit-core.js'),History=require('../dist/darkroom/edit-history.js');
const Lines=require('../dist/darkroom/body-ai/line-core.js'),path=require('node:path'),{createCanvas}=require('@napi-rs/canvas');
function rectangle(w=160,h=160){const a=new Uint8Array(w*h);for(let y=Math.ceil(h*.15);y<h*.85;y++)for(let x=Math.ceil(w*.3);x<w*.7;x++)a[y*w+x]=255;return{width:w,height:h,foreground:a};}
const pixel=(m,x,y)=>m.foreground[Math.floor(y*m.height)*m.width+Math.floor(x*m.width)];
const stroke=(mode,points,size=.28)=>({mode,size,points});
test('dragging the gold boundary moves the recognition mask locally without mutating the AI map',()=>{
 const base=rectangle(),original=base.foreground.slice(),edit=stroke('drag',[[.7,.5],[.66,.5],[.62,.5]]),out=C.raster(base,[edit],600,800);
 assert.deepEqual(base.foreground,original);assert.ok(pixel(out,.675,.5)<128);assert.equal(pixel(out,.5,.5),255);assert.equal(pixel(out,.65,.2),255);assert.equal(pixel(out,.1,.5),0);
 assert.ok(P.tracePaths(P.boundaries(out))[0].length>100);
 const p={id:'waist',cx:.5,cy:.5,rx:.08,ry:.1,rot:0};assert.ok(P.measureWidth(out,p,600,800).widthPx<P.measureWidth(base,p,600,800).widthPx);
});
test('add/remove brushes correct missing regions and arm/background joins with a soft edge',()=>{
 const base=rectangle(),add=stroke('paint',[[.70,.45],[.70,.55]],.12),remove=stroke('erase',[[.685,.45],[.685,.55]],.12),grown=C.raster(base,[add],600,800),cut=C.raster(base,[remove],600,800);
 assert.ok(pixel(grown,.72,.5)>128);assert.ok(pixel(cut,.68,.5)<128);assert.equal(pixel(cut,.5,.5),255);assert.equal(pixel(grown,.9,.5),0);
 assert.ok(cut.foreground.some(v=>v>0&&v<255),'correction must retain a smooth confidence edge');
});
test('a pen contact on an already reshaped gold guide maps back to the same original contour',()=>{
 const warps=[{cx:300,cy:400,cs:1,sn:0,co:{Rx:180,Ry:200,span:.6,ax:-.15,ay:.04,dx:3,dy:-2}},{cx:340,cy:400,cs:Math.cos(.2),sn:Math.sin(.2),co:{Rx:160,Ry:180,span:.5,ax:.08,ay:0,dx:0,dy:2}}];
 for(const pt of [[.3,.5],[.65,.45],[.5,.5],[.75,.8]]){const screen=P.project(pt,warps,600,800),back=P.unproject(screen,warps,600,800);assert.ok(Math.hypot((back[0]-pt[0])*600,(back[1]-pt[1])*800)<.08);}
});
test('incremental pen input replays exactly from a saved stroke, including non-square image/mask grids',()=>{
 for(const [W,H,w,h]of [[600,800,160,160],[1200,600,256,128]])for(const mode of ['drag','paint','erase']){
  const base=rectangle(w,h),s=stroke(mode,[[.7,.45],[.68,.46],[.65,.48],[.63,.5]],.18);let out=C.applyStroke(base,{...s,points:[s.points[0]]},W,H);
  for(let i=1;i<s.points.length;i++)out=C.applyStroke(out,{...s,points:s.points.slice(i-1,i+1)},W,H);
  assert.deepEqual(out.foreground,C.raster(base,[JSON.parse(JSON.stringify(s))],W,H).foreground,mode);
 }
});
test('contour corrections keep a separate immutable history for each person and restore old drafts',()=>{
 const state=C.state(),timeline=new History.Timeline(),base=rectangle();timeline.reset({key:'base',contour:state.capture()});
 const a=stroke('erase',[[.7,.5]],.12),b=stroke('paint',[[.3,.5]],.1);state.set('body-person-1',[a]);const savedA=state.capture();timeline.push({key:'one',contour:savedA});state.set('body-person-2',[b]);timeline.push({key:'two',contour:state.capture()});
 assert.equal(savedA.people.length,1);state.restore(timeline.undo().contour);assert.equal(state.strokes('body-person-2').length,0);assert.equal(state.strokes('body-person-1').length,1);state.restore(timeline.redo().contour);assert.equal(state.strokes('body-person-2').length,1);
 const copy=JSON.parse(JSON.stringify(state.capture()));state.clear();state.restore(copy);assert.deepEqual(C.raster(base,state.strokes('body-person-1'),600,800),C.raster(base,[a],600,800));state.restore(null);assert.equal(state.capture(),null);
});
test('rotating or cropping a photo carries the editable pen coordinates and brush size with it',()=>{
 const s=stroke('drag',[[.7,.5],[.65,.5]],.12),snapshot={p:{},focus:{cx:.5,cy:.5,rx:.1,ry:.1},sun:{x:.5,y:.1},leak:{x:.1,y:.1},body:[],bodyContour:{version:1,people:[{id:'body-person-1',strokes:[s]}]}};
 const turned=Photo.remap(snapshot,600,800,Photo.operation(600,800,'right'));assert.deepEqual(turned.bodyContour.people[0].strokes[0].points,[[.5,.7],[.5,.65]]);
 const cropped=Photo.remap(snapshot,600,800,Photo.operation(600,800,'crop',{x:.1,y:.1,width:.8,height:.8}));assert.ok(Math.abs(cropped.bodyContour.people[0].strokes[0].size-.15)<1e-10);assert.deepEqual(snapshot.bodyContour.people[0].strokes[0],s);
});
test('malformed strokes and oversized maps do not allocate or corrupt the original mask',()=>{
 for(const bad of [null,{version:2,people:[]},{version:1,people:[{id:'body-person-1',strokes:[stroke('bad',[[.5,.5]])]}]},{version:1,people:[{id:'body-person-1',strokes:[stroke('drag',[[NaN,.5]])]}]}])assert.equal(C.restore(bad),null);
 const base=rectangle();assert.equal(C.applyStroke(base,stroke('bad',[[.5,.5]]),600,800),base);assert.equal(C.validMask({width:999999,height:999999,foreground:[]}),false);assert.equal(C.raster(base,[],600,800),base);
});
test('only explicit reshape pulls change photo pixels; old recognition edits retain their exact meaning',()=>{
 const mask=rectangle(),old=stroke('pull',[[.7,.5],[.65,.51]],.25),edit={...old,effect:'reshape'},state=C.state();state.set('body-person-1',[old]);assert.equal(C.reshapeLines(state.capture()).length,0);
 state.set('body-person-1',[edit]);const saved=JSON.parse(JSON.stringify(state.capture())),restored=C.restore(saved),lines=C.reshapeLines(restored);
 assert.equal(restored.people[0].strokes[0].effect,'reshape');assert.equal(C.raster(mask,[edit],600,800),mask);assert.equal(lines.length,1);assert.ok(Lines.valid(lines[0]));
 const image=createCanvas(180,240),ctx=image.getContext('2d'),data=ctx.createImageData(180,240);for(let y=0;y<240;y++)for(let x=0;x<180;x++)data.data.set([x,y,(x*13+y*7)%256,255],(y*180+x)*4);ctx.putImageData(data,0,0);const before=ctx.getImageData(0,0,180,240).data.slice();
 assert.equal(Lines.apply(ctx,180,240,lines),true);const after=ctx.getImageData(0,0,180,240).data;assert.notDeepEqual(after,before);assert.deepEqual(after.subarray(0,180*40*4),before.subarray(0,180*40*4));assert.deepEqual([image.width,image.height],[180,240]);
 for(const bad of [{...edit,effect:true},{...edit,effect:'unknown'},{...edit,mode:'paint'}])assert.equal(C.validStroke(bad),false);
});
test('reshaping guides match export sampling, preserve people, and follow crop/turn/flip',()=>{
 const W=600,H=800,s={...stroke('pull',[[.7,.5],[.65,.51]],.25),effect:'reshape'},state=C.state();state.set('body-person-2',[{...s,points:[[.3,.4],[.32,.4]]}]);state.set('body-person-1',[s]);
 const snapshot={p:{},focus:{cx:.5,cy:.5,rx:.1,ry:.1},sun:{x:.5,y:.1},leak:{x:.1,y:.1},body:[],bodyContour:state.capture()},before=structuredClone(snapshot),lines=C.reshapeLines(snapshot.bodyContour);
 assert.equal(lines.length,2);assert.equal(lines[0].personId,'body-person-1');const fields=Lines.fields(lines,W,H);
 for(const point of [[.7,.5],[.3,.4],[.5,.8]]){const q=Lines.project(point,fields,W,H),back=Lines.unproject(q,fields,W,H);assert.ok(Math.hypot((point[0]-back[0])*W,(point[1]-back[1])*H)<.001);}
 for(const kind of ['right','flipX','flipY','crop']){const op=Photo.operation(W,H,kind,{x:.1,y:.1,width:.8,height:.8}),mapped=Photo.remap(snapshot,W,H,op),restored=C.restore(mapped.bodyContour);assert.ok(restored);assert.equal(restored.people[0].strokes[0].effect,'reshape');
  for(const point of [[.7,.5],[.3,.4]]){const q=Lines.project(point,fields,W,H),a=Photo.point(op.matrix,point[0]*W,point[1]*H),b=Photo.point(op.matrix,q[0]*W,q[1]*H),out=Lines.project([a.x/op.width,a.y/op.height],Lines.fields(C.reshapeLines(restored),op.width,op.height),op.width,op.height);assert.ok(Math.hypot(out[0]*op.width-b.x,out[1]*op.height-b.y)<.02,kind);}
 }assert.deepEqual(snapshot,before);
});
