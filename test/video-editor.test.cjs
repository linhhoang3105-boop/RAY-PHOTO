const {test}=require('node:test');
const assert=require('node:assert/strict');
const V=require('../dist/darkroom/video-editor.js');

test('video trim can select a later minute without exceeding the source or export limit',()=>{
 assert.deepEqual(V.planClip(180,75,150),{start:75,end:135,duration:60});
 assert.deepEqual(V.planClip(8,-5,99),{start:0,end:8,duration:8});
 const tail=V.planClip(8,50,1);assert.equal(tail.start,7.8);assert.equal(tail.end,8);assert.ok(tail.duration>=.1999);
 assert.deepEqual(V.planClip(3,.4,2.4),{start:.4,end:2.4,duration:2});
 assert.throws(()=>V.planClip(Infinity),/ít nhất/);assert.throws(()=>V.planClip(.1),/ít nhất/);
});

test('video frame dimensions keep orientation, even codec sizes and avoid enlarging small sources',()=>{
 assert.deepEqual(V.frameSize(3840,2160),{width:1080,height:606});
 assert.deepEqual(V.frameSize(2160,3840,720),{width:404,height:720});
 assert.deepEqual(V.frameSize(320,240),{width:320,height:240});
 assert.deepEqual(V.frameSize(641,481),{width:640,height:480});
 assert.equal(V.active,false);
});
