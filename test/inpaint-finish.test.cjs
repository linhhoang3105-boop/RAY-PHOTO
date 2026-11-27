const {test}=require('node:test'),assert=require('node:assert/strict'),AI=require('../dist/darkroom/inpaint-core.js'),Runtime=require('../dist/darkroom/inpaint-runtime.js');
function scene(){
 const W=80,H=64,data=new Uint8ClampedArray(W*H*4),mask=new Float32Array(W*H),protect=new Float32Array(W*H),exclude=new Uint8Array(W*H),truth=(x,y,ch)=>[95+x*.3,110+y*.4,130+(x+y)*.2][ch];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;data.set([truth(x,y,0),truth(x,y,1),truth(x,y,2),255],i*4);if(x>=24&&x<56&&y>=18&&y<46){mask[i]=1;data.set([250,10,40,255],i*4);}}
 const p=AI.prepare({width:W,height:H,data,mask,protect,exclude}),patch=AI.result(p,new Float32Array(AI.size**2*3));
 for(let y=0;y<patch.height;y++)for(let x=0;x<patch.width;x++)for(let ch=0;ch<3;ch++)patch.data[(y*patch.width+x)*4+ch]=truth(p.left+x,p.top+y,ch)+18+(x%2?3:-3);
 return{W,H,data,mask,protect,exclude,p,patch,truth};
}
test('neural finishing reduces a colour seam using clean context and retains the generated fine texture',()=>{
 const s=scene(),before=s.patch.data.slice(),original=s.data.slice(),out=AI.finish(s.p,s.patch);assert.ok(out.harmonization);assert.ok(out.harmonization.after<out.harmonization.before*.3);let error=0,count=0;
 for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++){const k=(y*out.width+x)*4;assert.equal(out.data[k+3],before[k+3]);for(let ch=0;ch<3;ch++){error+=Math.abs(out.data[k+ch]-(s.truth(s.p.left+x,s.p.top+y,ch)+(x%2?3:-3)));count++;assert.ok(Math.abs(out.data[k+ch]-before[k+ch])<=32);}}
 assert.ok(error/count<1.2);const y=10,x=10,k=(y*out.width+x)*4;assert.ok(Math.abs((out.data[k+4]-out.data[k])-(before[k+4]-before[k]))<=1,'smooth correction preserves the model texture');assert.deepEqual(s.data,original);assert.deepEqual(s.patch.data,before,'the raw model result remains immutable');
});
test('changing the erased original object cannot change the harmonized generated fill',()=>{
 const s=scene(),other=new Uint8ClampedArray(s.data);for(let i=0;i<s.mask.length;i++)if(s.mask[i])other.set([10,250,220,255],i*4);const out=AI.finish(s.p,s.patch),changed=AI.finish({...s.p,original:other},s.patch);assert.deepEqual(changed.data,out.data,'no erased original RGB may enter the correction');
});
test('protected, excluded and unselected patch bytes do not change',()=>{
 const s=scene();for(let y=0;y<s.patch.height;y++)for(let x=13;x<17;x++){const i=(s.p.top+y)*s.W+s.p.left+x;s.p.protection[i]=1;s.p.context[i]=1;s.p.selected[i]=0;s.patch.data[(y*s.patch.width+x)*4+3]=0;}for(let y=0;y<s.H;y++)for(let x=0;x<24;x++)s.p.context[y*s.W+x]=1;
 const before=s.patch.data.slice(),out=AI.finish(s.p,s.patch);assert.ok(out.harmonization);let unselected=0;for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++){const k=(y*out.width+x)*4;if(!s.p.selected[(s.p.top+y)*s.W+s.p.left+x]){assert.deepEqual(out.data.slice(k,k+4),before.slice(k,k+4));unselected++;}}assert.ok(unselected>50);
});
test('no clean context, strong edges or an already matching boundary leaves the model output untouched',()=>{
 for(const mode of ['hidden','edges','matching']){const s=scene();if(mode==='hidden')s.p.context.fill(1);if(mode==='edges')for(let y=0;y<s.H;y++)for(let x=0;x<s.W;x++)if(!s.mask[y*s.W+x])s.data.set((x+y)%2?[0,0,0,255]:[255,255,255,255],(y*s.W+x)*4);if(mode==='matching')for(let y=0;y<s.patch.height;y++)for(let x=0;x<s.patch.width;x++)for(let ch=0;ch<3;ch++)s.patch.data[(y*s.patch.width+x)*4+ch]=s.truth(s.p.left+x,s.p.top+y,ch);assert.equal(AI.finish(s.p,s.patch),s.patch,mode);}
});
test('the real inference runtime invokes finishing after decoding generated neural output and still releases its session',async()=>{
 const s=scene();let finished=0,released=0;const core={...AI,finish(prepared,result){finished++;assert.equal(prepared,s.p);assert.equal(result.engine,'lama');return{...result,finished:true};}},ort={Tensor:class{dispose(){}},InferenceSession:{async create(){return{inputNames:['input'],outputNames:['output'],async run(){return{output:{dims:[1,3,512,512],data:new Float32Array(512**2*3),dispose(){}}};},async release(){released++;}};}}};const out=await Runtime.infer(s.p,ort,new Uint8Array(),core);assert.equal(finished,1);assert.equal(released,1);assert.equal(out.finished,true);
});
