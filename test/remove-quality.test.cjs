const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createCanvas}=require('@napi-rs/canvas');
const Core=require('../dist/darkroom/remove-core.js');
function scene(kind='gradient',W=200,H=150){
 const data=new Uint8ClampedArray(W*H*4),truth=new Uint8ClampedArray(data.length),mask=new Float32Array(W*H);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x,k=i*4,line=kind==='tiles'&&(x%24<2||y%18<2)?-40:0;data.set([75+x*.45+y*.2+line,110+x*.3+y*.12+line,145+x*.2+line,255],k);truth.set(data.subarray(k,k+4),k);if(x>=80&&x<120&&y>=25&&y<125){mask[i]=1;data.set([245,10,30,255],k);}}
 return{width:W,height:H,data,truth,mask,seed:31};
}
function error(input,p){let sum=0,n=0,max=0;for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){const k=(y*p.width+x)*4,i=((y+p.sampling.y)*input.width+x+p.sampling.x)*4;if(p.data[k+3])for(let c=0;c<3;c++){const e=Math.abs(p.data[k+c]-input.truth[i+c]);sum+=e;max=Math.max(max,e);n++;}}return{mean:sum/n,max};}
test('smooth illumination continues through the whole deleted person without a rectangular color plateau',async()=>{
 const input=scene(),original=input.data.slice(),p=await Core.repair(input),e=error(input,p);
 assert.ok(e.mean<.5,'mean channel error '+e.mean);assert.ok(e.max<=2,'maximum error '+e.max);assert.deepEqual(input.data,original);
 for(const q of p.donors)if(q>=0)assert.equal(input.mask[q],0);
});
test('a tiled wall retains both directions of grout across a large deletion while matching the illumination gradient',async()=>{
 const input=scene('tiles'),p=await Core.repair(input),e=error(input,p);assert.ok(e.mean<1,'mean reconstruction error '+e.mean);
 for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)assert.equal(p.data[(y*p.width+x)*4+3],255,'no original person blended through the boundary');
});
test('boundary correction reaches the native export and keeps fine source texture rather than enlarging the analysis image',async()=>{
 const W=800,H=600,src=createCanvas(W,H),c=src.getContext('2d'),im=c.createImageData(W,H),truth=new Uint8ClampedArray(im.data.length);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const k=(y*W+x)*4,v=(x+y)%2?10:-10,line=x%96<8||y%72<8?-40:0;im.data.set([75+x*.1125+y*.05+v+line,110+x*.075+y*.03+v+line,145+x*.05+v+line,255],k);truth.set(im.data.subarray(k,k+4),k);if(x>=320&&x<480&&y>=100&&y<500)im.data.set([245,10,30,255],k);}
 c.putImageData(im,0,0);const small=createCanvas(200,150);small.getContext('2d').drawImage(src,0,0,200,150);const mask=scene().mask,p=await Core.repair({width:200,height:150,data:small.getContext('2d').getImageData(0,0,200,150).data,mask,seed:31}),native=Core.materialize(src,p,()=>createCanvas(1,1));
 let sum=0,n=0,contrast=0;const left=Math.round(native.placement[4]*W),top=Math.round(native.placement[5]*H);
 for(let y=0;y<native.height;y++)for(let x=0;x<native.width;x++){const k=(y*native.width+x)*4,i=((y+top)*W+x+left)*4;if(native.data[k+3]){for(let a=0;a<3;a++){sum+=Math.abs(native.data[k+a]-truth[i+a]);n++;}if(x&&x<native.width-1)contrast+=Math.abs(native.data[k]-native.data[k-4]);}}
 assert.ok(sum/n<2,'native mean error '+sum/n);assert.ok(contrast/(native.width*native.height)>15,'native checker texture must remain sharp');assert.equal(native.donors,undefined);assert.equal(native.correction,undefined);assert.deepEqual(c.getImageData(0,0,W,H).data,im.data);
});
test('the real worker-serializable repair is self-contained, cancellable during harmonization and never mutates the input',async()=>{
 const repair=(0,eval)('('+Core.repair.toString()+')'),input=scene('tiles'),before=input.data.slice();let stop=false;
 await assert.rejects(repair(input,p=>{if(p>=.82)stop=true;},()=>stop),/Đã dừng/);assert.deepEqual(input.data,before);
 const patch=await repair(input);assert.ok(error(input,patch).mean<1);
});
