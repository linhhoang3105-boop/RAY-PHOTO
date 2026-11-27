const {test}=require('node:test'),assert=require('node:assert/strict');
const {bindTransform}=require('../dist/darkroom/photo-controls.js');

class Target{
 constructor(){this.listeners=new Map();}
 addEventListener(type,fn,options){const list=this.listeners.get(type)||[];list.push({fn,options});this.listeners.set(type,list);}
 removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(x=>x.fn!==fn));}
 emit(type,data={}){const e={type,cancelable:true,prevented:false,stopped:false,immediate:false,target:this,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.stopped=true;this.immediate=true;},...data};for(const {fn}of this.listeners.get(type)||[]){fn(e);if(e.immediate)break;}return e;}
}
class Surface extends Target{
 constructor(pointer=true){super();this.ownerDocument=new Target();this.ownerDocument.defaultView=pointer?{PointerEvent:function(){}}:{};this.captured=new Set();this.released=[];}
 setPointerCapture(id){this.captured.add(id);}
 releasePointerCapture(id){this.captured.delete(id);this.released.push(id);this.emit('lostpointercapture',{pointerId:id});}
}
const pointer=(id,x=10,y=20,type='touch')=>({pointerId:id,pointerType:type,clientX:x,clientY:y,button:0});
const touch=(id,x=10,y=20)=>({identifier:id,clientX:x,clientY:y});
function fixture(pointerSupport=true,options={}){
 const el=new Surface(pointerSupport),doc=el.ownerDocument,starts=[],moves=[],ends=[],gestures=[],gestureMoves=[],gestureEnds=[];
 const handlers={start(e){starts.push(e);return options.reject?.(e)?null:{start:e};},move(s,p){moves.push({context:s,...p});},end(s){ends.push(s);}};
 if(options.gesture!==false)handlers.gesture={start(pair){gestures.push(pair);return options.rejectGesture?null:{initial:pair};},move(s,pair){gestureMoves.push({context:s,pair});},end(s){gestureEnds.push(s);}};
 const dispose=bindTransform(el,handlers);return{el,doc,starts,moves,ends,gestures,gestureMoves,gestureEnds,dispose};
}

test('pointer drag keeps the original start event, offsets and capture until a single release',()=>{
 const f=fixture(),start=f.el.emit('pointerdown',pointer(1,40,80,'mouse'));
 assert.equal(f.starts[0],start);assert.equal(start.prevented,true);assert.deepEqual([...f.el.captured],[1]);
 f.doc.emit('pointermove',pointer(1,55,15,'mouse'));f.doc.emit('pointermove',pointer(1,30,95,'mouse'));
 assert.deepEqual(f.moves.map(({dx,dy,clientX,clientY})=>({dx,dy,clientX,clientY})),[{dx:15,dy:-65,clientX:55,clientY:15},{dx:-10,dy:15,clientX:30,clientY:95}]);
 f.doc.emit('pointerup',pointer(1));f.doc.emit('pointerup',pointer(1));
 assert.equal(f.ends.length,1);assert.equal(f.ends[0].cancelled,undefined);assert.equal(f.el.captured.size,0);assert.deepEqual(f.el.released,[1]);
 assert.equal(f.el.listeners.has('touchstart'),false);assert.equal(f.el.listeners.has('mousedown'),false);
});

test('two pointers cancel the old tap, transform from a stable pair and block the remaining finger until all lift',()=>{
 const f=fixture();f.el.emit('pointerdown',pointer(1,10,20));f.doc.emit('pointermove',pointer(1,12,25));f.el.emit('pointerdown',pointer(2,60,40));
 assert.equal(f.starts.length,1);assert.equal(f.ends.length,1);assert.equal(f.ends[0].moved,true);assert.equal(f.ends[0].cancelled,true);
 assert.deepEqual(f.gestures[0].map(p=>[p.clientX,p.clientY]),[[12,25],[60,40]]);
 f.doc.emit('pointermove',pointer(2,80,50));assert.deepEqual(f.gestureMoves[0].pair.map(p=>[p.clientX,p.clientY]),[[12,25],[80,50]]);
 assert.deepEqual(f.gestures[0].map(p=>[p.clientX,p.clientY]),[[12,25],[60,40]],'start coordinates remain immutable');
 f.doc.emit('pointerup',pointer(1));assert.equal(f.gestureEnds.length,1);assert.equal(f.gestureEnds[0].cancelled,undefined);
 f.doc.emit('pointermove',pointer(2,100,100));f.el.emit('pointerdown',pointer(3));f.doc.emit('pointermove',pointer(3,50,50));
 assert.equal(f.moves.length,1);assert.equal(f.gestureMoves.length,1);assert.equal(f.starts.length,1);assert.equal(f.gestures.length,1);
 f.doc.emit('pointerup',pointer(2));f.doc.emit('pointerup',pointer(3));f.el.emit('pointerdown',pointer(4));assert.equal(f.starts.length,2);f.doc.emit('pointerup',pointer(4));
});

test('an extra finger never changes the chosen pair or ends its gesture',()=>{
 const f=fixture();for(const id of [1,2,3])f.el.emit('pointerdown',pointer(id,id*10,20));
 f.doc.emit('pointermove',pointer(3,200,200));assert.equal(f.gestureMoves.length,0);f.doc.emit('pointerup',pointer(3));assert.equal(f.gestureEnds.length,0);
 f.doc.emit('pointermove',pointer(1,15,30));assert.deepEqual(f.gestureMoves[0].pair.map(p=>p.pointerId),[1,2]);f.doc.emit('pointerup',pointer(1));f.doc.emit('pointerup',pointer(2));assert.equal(f.gestureEnds.length,1);
});

test('cancelling a gesture releases every capture, ends once and suppresses the still-down pointer',()=>{
 const f=fixture();f.el.emit('pointerdown',pointer(1));f.el.emit('pointerdown',pointer(2));const cancelled=f.doc.emit('pointercancel',pointer(1));
 assert.equal(cancelled.prevented,true);assert.equal(f.gestureEnds.length,1);assert.equal(f.gestureEnds[0].cancelled,true);assert.equal(f.el.captured.size,0);assert.deepEqual(f.el.released,[1,2]);
 f.el.emit('lostpointercapture',pointer(2));f.doc.emit('pointermove',pointer(2,99,99));assert.equal(f.gestureEnds.length,1);assert.equal(f.gestureMoves.length,0);
 f.doc.emit('pointerup',pointer(2));f.el.emit('pointerdown',pointer(3));assert.equal(f.starts.length,2);f.doc.emit('pointerup',pointer(3));
});

test('lost capture cancels a pending single tap and a binder without gesture callbacks safely ignores the second finger',()=>{
 const f=fixture(true,{gesture:false});f.el.emit('pointerdown',pointer(1));f.el.emit('lostpointercapture',pointer(1));assert.equal(f.ends.length,1);assert.equal(f.ends[0].moved,true);
 f.el.emit('pointerdown',pointer(2));f.el.emit('pointerdown',pointer(3));assert.equal(f.ends.length,2);assert.equal(f.ends[1].cancelled,true);
 f.doc.emit('pointermove',pointer(2,99,99));f.doc.emit('pointerup',pointer(2));f.doc.emit('pointerup',pointer(3));assert.equal(f.moves.length,0);assert.equal(f.ends.length,2);
});

test('rejected starts, child controls, right clicks and foreign pointers remain available to other handlers',()=>{
 const child={},f=fixture(true,{reject:e=>e.target===child});let childStarts=0;f.el.addEventListener('pointerdown',()=>childStarts++);
 const rejected=f.el.emit('pointerdown',{...pointer(1),target:child});assert.equal(rejected.prevented,false);assert.equal(childStarts,1);assert.equal(f.el.captured.size,0);
 const right=f.el.emit('pointerdown',{...pointer(2,0,0,'mouse'),button:2});assert.equal(right.stopped,false);assert.equal(f.starts.length,1);
 const foreign=f.doc.emit('pointermove',pointer(99));assert.equal(foreign.prevented,false);assert.equal(f.moves.length,0);
 f.el.emit('pointerdown',pointer(3));assert.equal(childStarts,2,'accepted parent start stops before child');assert.equal(f.starts.length,2);f.doc.emit('pointerup',pointer(3));
});

test('a rejected two-finger transform never resumes the old drag or produces a tap',()=>{
 const f=fixture(true,{rejectGesture:true});f.el.emit('pointerdown',pointer(1));f.el.emit('pointerdown',pointer(2));f.doc.emit('pointermove',pointer(1,40,40));f.doc.emit('pointerup',pointer(2));f.doc.emit('pointermove',pointer(1,60,60));f.doc.emit('pointerup',pointer(1));
 assert.equal(f.ends.length,1);assert.equal(f.ends[0].cancelled,true);assert.equal(f.gestures.length,1);assert.equal(f.gestureEnds.length,0);assert.equal(f.moves.length,0);
});

test('touch fallback uses stable identifiers for one- and two-finger movement without pointer compatibility listeners',()=>{
 const f=fixture(false),a=touch(7,20,50),b=touch(8,80,50);assert.equal(f.el.listeners.has('pointerdown'),false);
 const start=f.el.emit('touchstart',{changedTouches:[a],touches:[a]});assert.equal(start.prevented,true);f.doc.emit('touchmove',{changedTouches:[touch(7,25,30)],touches:[touch(7,25,30)]});assert.equal(f.moves[0].dy,-20);
 f.el.emit('touchstart',{changedTouches:[b],touches:[touch(7,25,30),b]});assert.equal(f.ends[0].cancelled,true);
 f.doc.emit('touchmove',{changedTouches:[touch(7,40,40)],touches:[touch(8,80,50),touch(7,40,40)]});assert.deepEqual(f.gestureMoves[0].pair.map(p=>[p.identifier,p.clientX,p.clientY]),[[7,40,40],[8,80,50]]);
 f.doc.emit('touchend',{changedTouches:[b],touches:[touch(7,40,40)]});f.doc.emit('touchmove',{changedTouches:[touch(7,45,45)],touches:[touch(7,45,45)]});assert.equal(f.gestureEnds.length,1);assert.equal(f.gestureMoves.length,1);
 f.doc.emit('touchend',{changedTouches:[touch(7,45,45)],touches:[]});const compatibility=f.el.emit('mousedown',pointer(0,40,40,'mouse'));assert.equal(compatibility.prevented,false);assert.equal(f.starts.length,1);
 for(const item of f.doc.listeners.get('touchmove'))assert.equal(item.options.passive,false);
});

test('touch cancellation ends once and mouse-only fallback still follows movement outside the surface',()=>{
 const f=fixture(false);f.el.emit('touchstart',{changedTouches:[touch(1),touch(2)],touches:[touch(1),touch(2)]});f.doc.emit('touchcancel',{changedTouches:[touch(1)],touches:[touch(2)]});f.doc.emit('touchend',{changedTouches:[touch(2)],touches:[]});assert.equal(f.gestureEnds.length,1);assert.equal(f.gestureEnds[0].cancelled,true);
 const m=fixture(false);m.el.emit('mousedown',{clientX:20,clientY:40,button:0});m.doc.emit('mousemove',{clientX:30,clientY:10});m.doc.emit('mouseup',{button:2});assert.equal(m.ends.length,0);m.doc.emit('mouseup',{button:0});assert.equal(m.moves[0].dx,10);assert.equal(m.moves[0].dy,-30);assert.equal(m.ends.length,1);
});

test('disposal cancels the live input once, releases captures and removes every listener',()=>{
 const f=fixture();f.el.emit('pointerdown',pointer(1));f.el.emit('pointerdown',pointer(2));f.dispose();f.dispose();assert.equal(f.gestureEnds.length,1);assert.equal(f.gestureEnds[0].cancelled,true);assert.equal(f.el.captured.size,0);
 f.el.emit('pointerdown',pointer(3));f.doc.emit('pointermove',pointer(3));assert.equal(f.starts.length,1);assert.equal(f.gestureMoves.length,0);
 for(const target of [f.el,f.doc])for(const list of target.listeners.values())assert.equal(list.length,0);
});

test('later document observers receive every move and release so sharp preview can resume after dragging',()=>{
 const f=fixture(),held=new Set(),seen=[];
 f.doc.addEventListener('pointerdown',e=>held.add(e.pointerId),{capture:true});
 for(const type of ['pointermove','pointerup','pointercancel'])f.doc.addEventListener(type,e=>{seen.push([type,e.pointerId]);if(type!=='pointermove')held.delete(e.pointerId);},{capture:true});
 const down=id=>{f.doc.emit('pointerdown',{...pointer(id),target:f.el});f.el.emit('pointerdown',pointer(id));};
 down(1);assert.equal(held.size,1);const moved=f.doc.emit('pointermove',pointer(1,20,30));assert.equal(moved.prevented,true);assert.equal(moved.immediate,false);assert.equal(moved.stopped,true);
 f.doc.emit('pointerup',pointer(1));assert.equal(held.size,0,'the idle-preview tracker sees the release after the binder');
 down(2);down(3);f.doc.emit('pointercancel',pointer(2));assert.deepEqual([...held],[3]);f.doc.emit('pointerup',pointer(3));assert.equal(held.size,0);
 assert.deepEqual(seen,[['pointermove',1],['pointerup',1],['pointercancel',2],['pointerup',3]]);assert.equal(f.gestureEnds.length,1);
});
