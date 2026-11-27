const {test}=require('node:test'),assert=require('node:assert/strict');
const {fitSize}=require('../dist/darkroom/body-ai/workspace.js');
const Workspace=require('../dist/darkroom/workspace-layout.js');
test('settling to a smaller preview buffer cannot shrink the displayed body-editing photograph',()=>{
 for(const space of [[390,310],[390,650],[1253,532],[1253,773]]){
  const expected=fitSize(1200,1600,...space);
  for(const buffer of [[1200,1600],[900,1200],[300,400],[75,100]]){
   const display=fitSize(...buffer,...space);
   assert.ok(Math.abs(display.width-expected.width)<.001);assert.ok(Math.abs(display.height-expected.height)<.001);
   assert.ok(display.width<=space[0]+.001&&display.height<=space[1]+.001);
  }
 }
});
test('every tool keeps display size independent of source and settled canvas dimensions',()=>{
 for(const [W,H]of [[3024,4032],[4032,3024],[8000,1600]]){
  const expected=Workspace.fitSize(W,H,394,280);for(const k of [1,.5,.1]){const shown=Workspace.fitSize(W*k,H*k,394,280);assert.ok(Math.abs(shown.width-expected.width)<1e-6);assert.ok(Math.abs(shown.height-expected.height)<1e-6);}
 }
 for(const tool of ['text','background','people','remove','body','adjust']){const tray=Workspace.limits(542,tool);assert.ok(tray.normal<=542*.25,tool+' must reserve most of the phone for the photo');assert.ok(tray.min<tray.normal&&tray.normal<tray.max);}
});
test('closing the tool tray grows the photo in the available space without changing its aspect ratio',()=>{
 const before=fitSize(4032,3024,390,240),after=fitSize(4032,3024,390,590);
 assert.ok(after.height>=before.height);assert.equal(after.width/after.height,4032/3024);
 assert.equal(fitSize(0,400,390,590),null);assert.equal(fitSize(300,400,390,0),null);
});
