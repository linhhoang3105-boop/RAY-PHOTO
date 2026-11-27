/* Explicit integration check: runs the exact shipped neural model on WASM. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),{webcrypto}=require('node:crypto');
const {createCanvas}=require('@napi-rs/canvas');
const AI=require('../dist/darkroom/inpaint-core.js'),Runtime=require('../dist/darkroom/inpaint-runtime.js'),Core=require('../dist/darkroom/remove-core.js');
const make=()=>createCanvas(1,1),rgba=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
test('the shipped LaMa WASM model reconnects occluded railings and improves on fragmented exemplar fill',{skip:process.env.RAY_INPAINT_MODEL_TEST!=='1',timeout:180000},async()=>{
 const root=path.join(__dirname,'../dist/vendor/inpaint/'),ort=require(path.join(root,'ort.wasm.min.js'));ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.wasm.wasmPaths=pathToFileURL(root).href;
 const W=512,H=512,N=W*H,src=createCanvas(W,H),c=src.getContext('2d'),maskCanvas=createCanvas(W,H),mc=maskCanvas.getContext('2d'),grad=c.createLinearGradient(0,0,0,H);grad.addColorStop(0,'#586b65');grad.addColorStop(1,'#203536');c.fillStyle=grad;c.fillRect(0,0,W,H);c.fillStyle='#998374';c.fillRect(0,90,W,34);c.fillStyle='#806957';c.fillRect(0,320,W,24);
 for(let x=30;x<W;x+=42){c.strokeStyle='#31383b';c.lineWidth=11;c.beginPath();c.moveTo(x,0);c.lineTo(x+16,H);c.stroke();c.strokeStyle='#d0d7d1';c.lineWidth=5;c.beginPath();c.moveTo(x-1,0);c.lineTo(x+15,H);c.stroke();}
 const truth=rgba(src).slice();c.strokeStyle='#e1ac65';c.lineWidth=29;c.beginPath();c.moveTo(26,170);c.lineTo(492,450);c.stroke();mc.strokeStyle='#fff';mc.lineWidth=39;mc.lineCap='round';mc.beginPath();mc.moveTo(26,170);mc.lineTo(492,450);mc.stroke();
 const maskRGBA=rgba(maskCanvas),mask=Float32Array.from({length:N},(_,i)=>maskRGBA[i*4+3]>8?1:0),input={width:W,height:H,data:rgba(src),mask,padding:1,seed:0},original=input.data.slice(),prepared=AI.prepare(input),statuses=[];
 const bytes=await Runtime.loadModel(pathToFileURL(root).href,()=>{},{read:async url=>new Response(fs.readFileSync(new URL(url))),storage:null,subtle:webcrypto.subtle}),start=performance.now(),result=await Runtime.infer(prepared,ort,bytes,AI,s=>statuses.push(s)),modelMs=performance.now()-start,oldPlan=await Core.repair(input);
 function composite(plan){const p=Core.materialize(src,plan,make),out=createCanvas(W,H),x=out.getContext('2d'),tile=createCanvas(p.width,p.height),tc=tile.getContext('2d'),im=tc.createImageData(p.width,p.height);im.data.set(p.data);tc.putImageData(im,0,0);x.drawImage(src,0,0);Core.drawPatch(x,p,tile,W,H);return out;}
 const neural=composite(result),old=composite(oldPlan),newData=rgba(neural),oldData=rgba(old);let newError=0,oldError=0,channels=0,outsideChanges=0;
 for(let i=0;i<N;i++)for(let ch=0;ch<4;ch++){const k=i*4+ch;if(prepared.selected[i]){if(ch<3){newError+=Math.abs(newData[k]-truth[k]);oldError+=Math.abs(oldData[k]-truth[k]);channels++;}}else if(newData[k]!==original[k])outsideChanges++;}
 const metrics={model:Runtime.model.id,modelSha256:Runtime.model.sha256,runtime:ort.env.versions.web,backend:'WASM',threads:1,image:[W,H],modelMs:Math.round(modelMs),meanAbsoluteChannelError:{ai:newError/channels,fast:oldError/channels},outsideChanges,maxResidentKiB:process.resourceUsage().maxRSS};console.log(JSON.stringify(metrics));
 assert.equal(outsideChanges,0);assert.ok(newError/channels<12);assert.ok(newError<oldError*.8,'AI must improve the structured scene rather than just rename the old fill');assert.deepEqual(input.data,original);assert.ok(statuses.some(s=>s.includes('nối chi tiết')));
 if(process.env.RAY_INPAINT_WRITE_QA==='1'){
  const qa=path.join(__dirname,'../docs/qa'),sheet=createCanvas(W*3+32,H+64),s=sheet.getContext('2d');s.fillStyle='#f6f3ec';s.fillRect(0,0,sheet.width,sheet.height);s.font='18px sans-serif';s.fillStyle='#222';
  for(const [index,[label,image]]of [['Test image',src],['Fast patch',old],['AI reconstruction',neural]].entries()){const x=8+index*(W+8);s.fillText(label,x,25);s.drawImage(image,x,34);}
  s.font='13px sans-serif';s.fillText('Synthetic test scene, not the user photo. Quality and speed vary by scene and device.',8,H+55);
  fs.writeFileSync(path.join(qa,'removal-v91-structure.png'),sheet.toBuffer('image/png'));fs.writeFileSync(path.join(qa,'removal-v91-model.json'),JSON.stringify(metrics,null,2)+'\n');
 }
});
