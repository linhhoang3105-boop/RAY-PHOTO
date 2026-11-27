const {test}=require('node:test');
const assert=require('node:assert/strict');
const Beauty=require('../dist/photo-beauty.js');
function fixture(){const w=80,h=40,d=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,n=((x+y)%2?8:-8);d[i]=x<40?196+n:40;d[i+1]=x<40?146+n:85;d[i+2]=x<40?120+n:200;d[i+3]=(x+y)%3?255:170;}return{d,w,h};}
test('beauty at zero is exact; skin lightening preserves alpha and blue backgrounds',()=>{
 const {d,w,h}=fixture(),original=new Uint8ClampedArray(d);Beauty.apply(d,w,h,{smooth:0,brighten:0});assert.deepEqual(d,original);Beauty.apply(d,w,h,{brighten:70});
 let sum=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;assert.equal(d[i+3],original[i+3]);if(x<40)sum+=d[i]-original[i];else assert.deepEqual(d.slice(i,i+4),original.slice(i,i+4));}assert.ok(sum>10000);
});
test('skin smoothing reduces small texture while preserving a dark edge and transparency',()=>{
 const {d,w,h}=fixture();for(let y=0;y<h;y++)for(let x=18;x<21;x++){const i=(y*w+x)*4;d[i]=d[i+1]=d[i+2]=20;}const original=new Uint8ClampedArray(d);Beauty.apply(d,w,h,{smooth:100});
 const variance=data=>{const values=[];for(let y=5;y<35;y++)for(let x=3;x<15;x++)values.push(data[(y*w+x)*4]);const mean=values.reduce((a,b)=>a+b,0)/values.length;return values.reduce((a,b)=>a+(b-mean)**2,0)/values.length;};
 assert.ok(variance(d)<variance(original)*.6);for(let y=0;y<h;y++){const i=(y*w+19)*4;assert.equal(d[i],20);}for(let i=3;i<d.length;i+=4)assert.equal(d[i],original[i]);
});
