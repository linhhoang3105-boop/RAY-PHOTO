const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function harness(error){
 const messages=[],canvases=[],closed={worker:0,main:0},text=fs.readFileSync(path.join(__dirname,'../dist/darkroom/compose-editor.js'),'utf8'),start=text.indexOf('\n async function segment(image,notify)'),end=text.indexOf("\n $('removeBackground').onclick",start);let mainRuns=0;
 const h={BEAUTY_ASSETS:{roots:['local-models']},RayBeautyRuntime:{async engine(config,loader){mainRuns++;assert.equal(typeof loader,'function');return{async detect(){return{maps:{width:2,height:2,foreground:new Uint8Array([0,255,128,0])}};},async close(){closed.main++;}};}},makeCanvas:()=>{const cv={width:1,height:1};canvases.push(cv);return cv;},Worker:class{postMessage(){queueMicrotask(()=>this.onmessage({data:{error}}));}terminate(){closed.worker++;}},OffscreenCanvas:class{},createImageBitmap:async()=>({close(){}}),URL:{createObjectURL:()=> 'blob:test-background',revokeObjectURL(){}},Blob,setTimeout,clearTimeout,queueMicrotask,worker:null,rejectWorker:null};
 vm.createContext(h);vm.runInContext(text.slice(start,end),h);return{run:()=>h.segment({width:600,height:800},m=>messages.push(m)),messages,canvases,closed,get mainRuns(){return mainRuns;}};
}
test('a worker graphics error retries on the document canvas and releases both model lifetimes',async()=>{
 const f=harness('INTERNAL: Service kGpuService unavailable'),out=await f.run();assert.deepEqual([...out.data],[0,255,128,0]);assert.equal(f.mainRuns,1);assert.ok(f.closed.worker>=1);assert.equal(f.closed.main,1);assert.ok(f.messages.some(x=>x.includes('tương thích')));assert.ok(f.canvases.every(x=>!x.width&&!x.height));
});
test('an explicitly cancelled background scan does not start another model',async()=>{
 const f=harness('Đã dừng AI.');await assert.rejects(f.run(),/Đã dừng/);assert.equal(f.mainRuns,0);assert.ok(f.closed.worker>=1);
});
