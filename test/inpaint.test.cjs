const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto,createHash}=require('node:crypto');
const {createCanvas}=require('@napi-rs/canvas');
const AI=require('../dist/darkroom/inpaint-core.js'),Runtime=require('../dist/darkroom/inpaint-runtime.js'),Client=require('../dist/darkroom/inpaint.js'),Core=require('../dist/darkroom/remove-core.js'),Selection=require('../dist/darkroom/remove-selection-core.js'),Paint=require('../dist/darkroom/region-paint-core.js');
const make=()=>createCanvas(1,1),assets=path.join(__dirname,'../dist/vendor/inpaint');
function scene(W=80,H=60){const data=new Uint8ClampedArray(W*H*4),mask=new Float32Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const k=(y*W+x)*4;data.set([x*255/W,y*255/H,100,255],k);if(x>=W*.35&&x<W*.65&&y>=H*.2&&y<H*.8){mask[y*W+x]=1;data.set([245,20,30,255],k);}}return{width:W,height:H,data,mask,seed:0};}
function output(r=.3,g=.55,b=.4){const n=AI.size**2,out=new Float32Array(n*3);out.fill(r,0,n);out.fill(g,n,n*2);out.fill(b,n*2);return out;}
test('the hosted app defaults to neural reconstruction while a local standalone HTML keeps its working fast mode',()=>{
 const source=fs.readFileSync(require.resolve('../dist/darkroom/remove-core.js'),'utf8');for(const [protocol,engine]of [['https:','ai'],['capacitor:','ai'],['file:','patch']]){const context={module:{exports:{}},location:{protocol}};vm.createContext(context);vm.runInContext(source,context);assert.equal(context.module.exports.defaults().engine,engine);}
});
test('AI validates masks before loading weights, matches protection/padding semantics and never mutates the photo',async()=>{
 const input=scene(),before=input.data.slice(),maskBefore=input.mask.slice(),protect=new Float32Array(input.mask.length);for(let y=10;y<50;y++)for(let x=36;x<43;x++)protect[y*80+x]=1;
 assert.throws(()=>AI.prepare({...input,mask:new Float32Array(4800)}),/Tô lên/);assert.throws(()=>AI.prepare({...input,mask:new Float32Array(4800).fill(1)}),/quá rộng/);assert.throws(()=>AI.prepare({...input,protect:input.mask}),/vùng giữ/);
 const prepared=AI.prepare({...input,protect,padding:3}),patch=await Core.repair({...input,protect,padding:3});
 for(let y=0;y<60;y++)for(let x=0;x<80;x++){const px=x-patch.sampling.x,py=y-patch.sampling.y,alpha=px>=0&&px<patch.width&&py>=0&&py<patch.height?patch.data[(py*patch.width+px)*4+3]:0;assert.equal(prepared.selected[y*80+x],alpha?1:0);}
 assert.deepEqual(input.data,before);assert.deepEqual(input.mask,maskBefore);
});
test('model input is masked RGB plus a binary erase channel, with undistorted square context and reversible retry mirroring',()=>{
 const input=scene(200,80),n=AI.size**2;
 for(const seed of [0,1,2]){
  const p=AI.prepare({...input,seed}),fake=new Float32Array(n*3);assert.equal(p.tensor.length,n*4);assert.ok(p.roi.size>=128);
  for(let i=0;i<n;i++){const hole=p.tensor[n*3+i];assert.ok(hole===0||hole===1);if(hole)assert.equal(p.tensor[i]+p.tensor[n+i]+p.tensor[n*2+i],0);}
  for(let y=0;y<AI.size;y++)for(let x=0;x<AI.size;x++){const i=y*AI.size+x;fake[i]=(p.roi.x+((p.flip?AI.size-1-x:x)+.5)*p.roi.size/AI.size)/input.width;fake[n+i]=(p.roi.y+(y+.5)*p.roi.size/AI.size)/input.height;fake[n*2+i]=.5;}
  const result=AI.result(p,fake);let errors=0;
  for(let y=0;y<result.height;y++)for(let x=0;x<result.width;x++){const k=(y*result.width+x)*4;if(Math.abs(result.data[k]-(p.left+x+.5)*255/input.width)>.51||Math.abs(result.data[k+1]-(p.top+y+.5)*255/input.height)>.51)errors++;assert.equal(result.data[k+3],p.selected[(p.top+y)*input.width+p.left+x]?255:0);}
  assert.equal(errors,0);assert.equal(result.generated,true);assert.equal(result.engine,'lama');
 }
 assert.throws(()=>AI.result(AI.prepare(input),new Float32Array(10)),/hợp lệ/);const invalid=output();invalid[123]=NaN;assert.throws(()=>AI.result(AI.prepare(input),invalid),/chưa tái tạo/);
});
test('kept people are excluded from neural context without becoming part of the output deletion',()=>{
 const input=scene(200,160),before=input.data.slice(),protect=new Float32Array(200*160),exclude=new Uint8Array(200*160);for(let y=0;y<160;y++)for(let x=40;x<58;x++)protect[y*200+x]=1;for(let y=0;y<160;y++)for(let x=140;x<160;x++)exclude[y*200+x]=255;
 const p=AI.prepare({...input,protect,exclude}),n=AI.size**2;let checked=0;for(let y=0;y<AI.size;y++)for(let x=0;x<AI.size;x++){const px=p.roi.x+(x+.5)*p.roi.size/AI.size,py=p.roi.y+(y+.5)*p.roi.size/AI.size;if(py<2||py>158||!(px>43&&px<55||px>143&&px<157))continue;const i=y*AI.size+x;assert.equal(p.tensor[3*n+i],1);assert.equal(p.tensor[i]+p.tensor[n+i]+p.tensor[2*n+i],0);checked++;}assert.ok(checked>1000);assert.equal(p.selected[80*200+45],0);assert.equal(p.selected[80*200+150],0);assert.deepEqual(input.data,before);assert.throws(()=>AI.prepare({...input,exclude:new Uint8Array(200*160).fill(255)}),/đủ nền sạch/);
});
test('neural color is materialized at native size while protected and unselected pixels stay untouched, including sparse large repairs',()=>{
 const W=160,H=120,state={...Core.defaults(),strokes:[{mode:'paint',size:.12,points:[[.08,.15],[.92,.85]]}],protectStrokes:[{mode:'paint',size:.12,points:[[.5,.5]]}]},r=Selection.raster(state,W,H,Paint),input={...scene(W,H),mask:r.mask,protect:r.protect,padding:2},p=AI.result(AI.prepare(input),output()),native=Core.materialize({width:3203,height:2401,getContext(){throw Error('generated fill must not read original RGB');}},p,()=>{throw Error('no whole-photo canvas');});
 assert.ok(native.width*native.height>4e6);assert.ok(native.tiles.length>1);assert.equal(native.detail,'generated');assert.equal(native.engine,'lama');assert.equal(native.sampling,undefined);assert.equal(native.donors,undefined);
 const sx=3203/W,sy=2401/H,left=Math.round(p.sampling.x*sx),top=Math.round(p.sampling.y*sy);let opaque=0,guardErrors=0,colorErrors=0;
 for(const t of native.tiles)for(let y=0;y<t.height;y++)for(let x=0;x<t.width;x++){const k=(y*t.width+x)*4,X=left+t.x+x,Y=top+t.y+y,kept=r.protect[Math.min(H-1,Math.floor((Y+.5)/sy))*W+Math.min(W-1,Math.floor((X+.5)/sx))]>.05;if(kept&&t.data[k+3])guardErrors++;if(t.data[k+3]){opaque++;if(t.data[k]!==77||t.data[k+1]!==140||t.data[k+2]!==102||t.data[k+3]!==255)colorErrors++;}}
 assert.ok(opaque>300000);assert.equal(guardErrors,0);assert.equal(colorErrors,0);
 const src=createCanvas(317,241),c=src.getContext('2d'),im=c.createImageData(317,241);for(let i=0;i<317*241;i++)im.data.set(i%2?[70,90,120,255]:[190,210,140,255],i*4);c.putImageData(im,0,0);const small=Core.materialize(src,p,make),tile=createCanvas(small.width,small.height),tc=tile.getContext('2d'),ti=tc.createImageData(small.width,small.height);ti.data.set(small.data);tc.putImageData(ti,0,0);Core.drawPatch(c,small,tile,317,241);const after=c.getImageData(0,0,317,241).data,l=Math.round(small.placement[4]*317),t=Math.round(small.placement[5]*241);let changed=0;
 for(let y=0;y<241;y++)for(let x=0;x<317;x++){const px=x-l,py=y-t,k=(y*317+x)*4,alpha=px>=0&&px<small.width&&py>=0&&py<small.height?small.data[(py*small.width+px)*4+3]:0;if(alpha)changed++;else for(let ch=0;ch<4;ch++)assert.equal(after[k+ch],im.data[k+ch]);}assert.ok(changed>1000);
});
test('pinned model chunks reassemble to the original SHA, fit hosting limits and work from a verified offline cache',async()=>{
 const cache=new Map(),deleted=[],reads=[],root='https://ray.test/vendor/inpaint/',storage={open:async()=>({match:async url=>cache.get(url)?.clone(),put:async(url,r)=>cache.set(url,r.clone()),delete:async url=>{deleted.push(url);return cache.delete(url);}})},read=async url=>{reads.push(url);return new Response(fs.readFileSync(path.join(assets,new URL(url).pathname.split('/').at(-1))));};
 const messages=[],bytes=await Runtime.loadModel(root,s=>messages.push(s),{read,storage,subtle:webcrypto.subtle});assert.equal(bytes.length,Runtime.model.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),Runtime.model.sha256);assert.equal(cache.size,4);assert.ok(messages.at(-1).includes('100%'));
 reads.length=0;const offline=await Runtime.loadModel(root,()=>{},{read:async url=>{assert.ok(url.endsWith('model.json'),'cached chunks must not require the network');return read(url);},storage,subtle:webcrypto.subtle});assert.equal(offline.length,bytes.length);assert.equal(reads.length,1);
 const first=[...cache.keys()][0];cache.set(first,new Response(new Uint8Array([1,2])));reads.length=0;await Runtime.loadModel(root,()=>{},{read,storage,subtle:webcrypto.subtle});assert.deepEqual(deleted,[first]);assert.ok(reads.includes(first));
 for(const file of fs.readdirSync(assets))assert.ok(fs.statSync(path.join(assets,file)).size<25*1024*1024,file+' exceeds the hosting asset limit');
});
test('model load and inference errors leave no partial result and always release the neural session',async()=>{
 let released=0,disposed=0;const p=AI.prepare(scene()),session={inputNames:['input'],outputNames:['output'],async run(){throw Error('run failed');},async release(){released++;}},ort={InferenceSession:{create:async()=>session},Tensor:class{dispose(){disposed++;}}};
 await assert.rejects(Runtime.infer(p,ort,new Uint8Array(),AI),/run failed/);assert.equal(released,1);assert.equal(disposed,1);
 session.run=async()=>({output:{dims:[1,3,4,4],data:new Float32Array(48),dispose(){disposed++;}}});await assert.rejects(Runtime.infer(p,ort,new Uint8Array(),AI),/hợp lệ/);assert.equal(released,2);assert.equal(disposed,3);
});
function fakeClient(){const workers=[],statuses=[],client=Client.createClient({base:'https://ray.test/darkroom/',makeWorker(url){const worker={url,terminated:0,postMessage(data,transfer){this.data=data;this.transfer=transfer;},terminate(){this.terminated++;}};workers.push(worker);return worker;}});return{workers,statuses,client};}
test('the client uses only the AI worker and forwards progress; cancel terminates inference and ignores late results',async()=>{
 const h=fakeClient(),input=scene(),pending=h.client.repair(input,s=>h.statuses.push(s)),worker=h.workers[0];assert.equal(worker.url,'https://ray.test/darkroom/inpaint-worker.js');assert.equal(worker.data.assets.root,'https://ray.test/vendor/inpaint/');assert.ok(worker.transfer.includes(input.data.buffer));worker.onmessage({data:{status:'Đang tái tạo'}});assert.deepEqual(h.statuses,['Đang tái tạo']);
 const rejection=assert.rejects(pending,/Đã dừng/);h.client.cancel();worker.onmessage({data:{result:{id:'late'}}});await rejection;assert.ok(worker.terminated>0);
 const next=h.client.repair(scene()),fresh=h.workers[1],result={id:'new'};fresh.onmessage({data:{result}});assert.equal(await next,result);
});
test('a neural worker error is shown without silently substituting the old patch engine',async()=>{
 const h=fakeClient(),pending=h.client.repair(scene()),rejection=assert.rejects(pending,/chưa chạy được/);h.workers[0].onerror();await rejection;assert.ok(h.workers[0].terminated>0);
});
test('the actual worker prepares the mask, uses one WASM thread, transfers the generated result and closes on success or failure',async()=>{
 const imports=[],posts=[];let closed=0,loaded=0,inferred=0,failed=false;
 const context={self:{close(){closed++;}},RayInpaintCore:AI,RayInpaintRuntime:{async loadModel(root){loaded++;assert.equal(root,'https://ray.test/vendor/inpaint/');if(failed)throw Error('Failed to fetch');return new Uint8Array([1]);},async infer(prepared,ort,bytes,core){inferred++;assert.equal(ort.env.wasm.numThreads,1);assert.equal(ort.env.wasm.proxy,false);assert.equal(ort.env.wasm.wasmPaths,'https://ray.test/vendor/inpaint/');return core.result(prepared,output());}},ort:{env:{wasm:{}}},importScripts(...urls){imports.push(...urls);},postMessage:(data,transfer)=>posts.push({data,transfer})};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/darkroom/inpaint-worker.js'),'utf8'),context);const request={data:{input:scene(),assets:{root:'https://ray.test/vendor/inpaint/'}}};await context.self.onmessage(request);const done=posts.find(p=>p.data.result);assert.equal(done.data.result.generated,true);assert.equal(done.transfer[0],done.data.result.data.buffer);assert.equal(closed,1);assert.equal(loaded,1);assert.equal(inferred,1);assert.ok(imports.includes('https://ray.test/vendor/inpaint/ort.wasm.min.js'));
 failed=true;posts.length=0;await context.self.onmessage(request);assert.equal(closed,2);assert.equal(inferred,1);assert.match(posts.at(-1).data.error,/Vùng tô vẫn được giữ/);
 posts.length=0;await context.self.onmessage({data:{...request.data,input:{...scene(),mask:new Float32Array(4800)}}});assert.equal(loaded,2,'empty mask fails before any model download');assert.equal(closed,3);assert.match(posts.at(-1).data.error,/Tô lên/);
});
function editor(ai,engine='ai',old=false){
 const source=createCanvas(80,60);source.getContext('2d').fillStyle='#b4c8a0';source.getContext('2d').fillRect(0,0,80,60);const state={...Core.defaults(),autoProtect:false,engine,strokes:[{mode:'paint',size:.2,points:[[.5,.5]]}],...(old?{patches:[{id:'old',width:1,height:1,data:new Uint8ClampedArray([250,0,0,255]),placement:[.2,0,0,.2,.4,.4]}],lastPatchId:'old',lastSelection:[{mode:'paint',size:.2,points:[[.5,.5]]}],strokes:[]}: {})},events=[],status={};
 const c={core:Core,state,source,busy:false,job:0,peopleCache:null,otherBusy:()=>false,selected:s=>Selection.hasSelection(s,Paint),selectionCore:Selection,RayRegionPaint:Paint,document:{body:{dataset:{}}},BEAUTY:{source:null},make,scaledSource:s=>s,prepare(s,skip){events.push(['prepare',skip]);return s;},window:{RayInpaint:{repair:ai},RaySession:{refresh(){}}},progress(text){c.message=text;status.textContent=text;},repairPixels:async input=>{events.push(['fast']);return Core.repair(input);},record:label=>events.push(['record',label]),sync(){},queue(){},discard(){},release(){},uid:()=> 'new',$:()=>status};
 const code=fs.readFileSync(require.resolve('../dist/darkroom/remove-editor.js'),'utf8');vm.createContext(c);vm.runInContext(code.slice(code.indexOf(' async function run('),code.indexOf(" $('repairRemove').onclick")),c);return{c,events};
}
test('the real editor selects AI by default, materializes the generated fill and can replace an older fragmented patch',async()=>{
 const h=editor(async input=>AI.result(AI.prepare(input),output()),'ai',true);assert.equal(await h.c.run(true),true);assert.equal(h.c.state.patches.length,1);assert.equal(h.c.state.patches[0].id,'new');assert.equal(h.c.state.patches[0].engine,'lama');assert.ok(h.events.some(e=>e[0]==='prepare'&&e[1]==='old'));assert.ok(!h.events.some(e=>e[0]==='fast'));assert.equal(h.c.state.strokes.length,0);
});
test('a failed AI repair preserves the old patch and editable selection; fast fill requires its explicit mode',async()=>{
 const h=editor(async()=>{throw Error('AI chưa sẵn sàng');});const before=h.c.state.strokes;assert.equal(await h.c.run(),false);assert.equal(h.c.state.patches.length,0);assert.equal(h.c.state.strokes,before);assert.match(h.c.message,/chưa sẵn sàng/);assert.ok(!h.events.some(e=>e[0]==='fast'));
 const old=editor(async()=>{throw Error('tải thất bại');},'ai',true);assert.equal(await old.c.run(true),false);assert.equal(old.c.state.patches[0].id,'old');
 const fast=editor(async()=>{throw Error('AI must not be called');},'patch');assert.equal(await fast.c.run(),true);assert.ok(fast.events.some(e=>e[0]==='fast'));assert.equal(fast.c.state.patches[0].detail,'original');
});
test('AI mode cannot accept an exemplar result as if neural reconstruction succeeded',async()=>{
 const h=editor(async input=>Core.repair(input));assert.equal(await h.c.run(),false);assert.equal(h.c.state.patches.length,0);assert.match(h.c.message,/AI chưa trả được kết quả/);assert.ok(!h.events.some(e=>e[0]==='fast'));
});
test('a photo changed during neural inference never receives the previous photo’s fill',async()=>{
 let finish;const h=editor(input=>new Promise(resolve=>{finish=()=>resolve(AI.result(AI.prepare(input),output()));})),pending=h.c.run();assert.equal(h.c.busy,true);h.c.source=createCanvas(90,70);finish();assert.equal(await pending,false);assert.equal(h.c.state.patches.length,0);
 const missing=editor(async()=>{});delete missing.c.window.RayInpaint;assert.equal(await missing.c.run(),false);assert.match(missing.c.message,/AI chưa tải xong/);assert.equal(missing.c.state.patches.length,0);
});
test('service worker upgrades keep the verified model cache and do not duplicate lazy model chunks',async()=>{
 const cacheSource=fs.readFileSync(path.join(__dirname,'../dist/sw.js'),'utf8'),current=cacheSource.match(/const CACHE='([^']+)'/)[1],listeners={},removed=[],context={URL,self:{location:{origin:'https://ray.test'},addEventListener:(name,fn)=>listeners[name]=fn,clients:{claim:async()=>{}}},importScripts(){},caches:{keys:async()=>['ray-photo-old',current,'ray-inpaint-lama-512-int8-v1','other-feature'],delete:async key=>removed.push(key)}};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/sw.js'),'utf8'),context);let pending;listeners.activate({waitUntil:p=>pending=p});await pending;assert.deepEqual(removed,['ray-photo-old']);let intercepted=false;listeners.fetch({request:{url:'https://ray.test/vendor/inpaint/lama-512-int8-01.bin',method:'GET'},respondWith(){intercepted=true;}});assert.equal(intercepted,false);
});
