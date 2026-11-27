const{test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const{createCanvas}=require('@napi-rs/canvas');
const M=require('../dist/makeup-core.js');M.setCanvasFactory(createCanvas);
function mesh(cx=.5){const pts=Array.from({length:478},()=>({x:cx,y:.45}));function ring(ids,x,y,rx,ry){ids.forEach((id,i)=>{const a=-Math.PI+2*Math.PI*i/ids.length;pts[id]={x:x+Math.cos(a)*rx,y:y+Math.sin(a)*ry};});}ring(M.LIP_OUTER,cx,.65,.11,.045);ring(M.LIP_INNER,cx,.65,.075,.012);ring(M.BROWS[0],cx-.13,.32,.09,.018);ring(M.BROWS[1],cx+.13,.32,.09,.018);return pts;}
const alpha=(mask,x,y)=>mask.getContext('2d').getImageData(x,y,1,1).data[3];
test('face masks select lips/brows, exclude the open mouth and support selecting face zero',()=>{
 const m=M.faceMasks(400,400,[mesh(.3),mesh(.75)],0);assert.ok(alpha(m.lips,120,246)>100);assert.equal(alpha(m.lips,120,260),0);assert.equal(alpha(m.lips,300,246),0);assert.ok(alpha(m.brows,68,128)>100);assert.equal(alpha(m.brows,68,160),0);assert.equal(alpha(m.brows,248,128),0);
});
test('hair confidence masks, painted corrections and erasing stay bounded',()=>{
 const mask=M.hairMask(100,100,Float32Array.from([0,1,0,1]),2,2);assert.ok(alpha(mask,90,50)>240);assert.equal(alpha(mask,5,50),0);
 M.brush(mask,{x:.10,y:.1},{x:.25,y:.25},.1);assert.ok(alpha(mask,10,10)>200);assert.equal(alpha(mask,5,80),0);M.brush(mask,{x:.1,y:.1},{x:.25,y:.25},.15,true);assert.ok(alpha(mask,10,10)<10);
 assert.throws(()=>M.hairMask(10,10,new Float32Array(1),2,2));
});
test('makeup preserves alpha and unmasked background, changes tint and retains original texture',()=>{
 const c=createCanvas(100,100),ctx=c.getContext('2d');ctx.fillStyle='#7d6757';ctx.fillRect(0,0,100,100);ctx.fillStyle='#b89886';ctx.fillRect(25,25,25,50);const original=ctx.getImageData(0,0,100,100),d=new Uint8ClampedArray(original.data),mask=M.canvas(100,100);M.brush(mask,{x:.5,y:.2},{x:.5,y:.8},.4);
 M.apply(d,100,100,{lips:mask},{lips:{color:'#b52551',strength:85}});const pixel=(a,x,y)=>Array.from(a.slice((y*100+x)*4,(y*100+x)*4+4));assert.deepEqual(pixel(d,0,0),pixel(original.data,0,0));assert.notDeepEqual(pixel(d,45,50),pixel(original.data,45,50));assert.ok(d[(50*100+45)*4]>d[(50*100+45)*4+1]);assert.notEqual(d[(50*100+45)*4],d[(50*100+55)*4]);for(let i=3;i<d.length;i+=4)assert.equal(d[i],original.data[i]);
 const zero=new Uint8ClampedArray(original.data);M.apply(zero,100,100,{lips:mask},{lips:{color:'#b52551',strength:0}});assert.deepEqual(zero,original.data);
});
test('self-hosted detection runtime and trained assets are present and have the expected formats',async()=>{
 const root=path.join(__dirname,'../dist/vendor/mediapipe');const m=await import(path.join(root,'vision_bundle.mjs'));assert.equal(typeof m.FaceLandmarker.createFromOptions,'function');assert.equal(typeof m.ImageSegmenter.prototype.getLabels,'function');
 for(const file of['wasm/vision_wasm_internal.wasm','wasm/vision_wasm_nosimd_internal.wasm'])assert.equal(fs.readFileSync(path.join(root,file)).subarray(0,4).toString('hex'),'0061736d');assert.ok(fs.readFileSync(path.join(root,'face_landmarker.task')).subarray(0,32).includes(Buffer.from('PK\u0003\u0004')));assert.equal(fs.readFileSync(path.join(root,'hair_segmenter.tflite')).subarray(4,8).toString(),'TFL3');
});
test('the makeup screen shares shade-aware hair dye and preserves refined soft edges',()=>{
 const mask=M.canvas(3,1),ctx=mask.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,2,1);
 for(const [source,color,target] of [[210,'#24262b',[36,38,43]],[45,'#bd9967',[189,153,103]]]){
  const data=new Uint8ClampedArray([source,source,source,255,source,source,source,170,source,source,source,255]);
  M.tint(data,3,1,mask,color,100,'hair');
  for(let c=0;c<3;c++)assert.ok(Math.abs(data[c]-target[c])<=2);
  assert.equal(data[7],170);assert.deepEqual(Array.from(data.slice(8)),[source,source,source,255]);
 }
 const refined=M.hairMask(3,1,new Float32Array([0,.08,1]),3,1,true);
 assert.equal(alpha(refined,0,0),0);assert.ok(Math.abs(alpha(refined,1,0)-20)<=1);assert.equal(alpha(refined,2,0),255);
});
module.exports={mesh};
