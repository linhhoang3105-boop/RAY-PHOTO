const {test}=require('node:test'),assert=require('node:assert/strict');
const Hair=require('../dist/darkroom/hair-core.js');
const linear=x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;};
function fixture(W=200,H=120){const d=new Uint8ClampedArray(W*H*4);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,v=25+(x%7)*4+(y%3);d[i]=v+8;d[i+1]=v+3;d[i+2]=v;d[i+3]=(x+y)%3?255:170;}const width=20,height=12,hair=new Uint8Array(width*height),skin=new Uint8Array(width*height);for(let y=2;y<10;y++)for(let x=3;x<17;x++)hair[y*width+x]=255;return{d,W,H,m:{width,height,hair,skin}};}
test('hair color at zero is byte exact and dye never touches unmasked pixels or alpha',()=>{
 const {d,W,H,m}=fixture(),before=d.slice();Hair.apply(d,W,H,m,[{hair:0,hairColor:'#bd9967'}]);assert.deepEqual(d,before);Hair.apply(d,W,H,m,[{hair:.8,hairColor:'#794437'}]);assert.notDeepEqual(d,before);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;assert.equal(d[i+3],before[i+3]);if(x<10||y<10||x>190||y>110)assert.deepEqual(d.slice(i,i+4),before.slice(i,i+4));}
});
test('dye changes the shade while retaining ordered strand luminance contrast',()=>{
 const values=[20,35,45,60,80,120,210],d=new Uint8ClampedArray(values.flatMap(v=>[v,v,v,255])),m={width:values.length,height:1,hair:new Uint8Array(values.length).fill(255)};
 Hair.apply(d,values.length,1,m,[{hair:1,hairColor:'#794437'}]);
 const result=values.map((_,i)=>linear(d[i*4])*.2126+linear(d[i*4+1])*.7152+linear(d[i*4+2])*.0722);
 for(let i=1;i<result.length;i++)assert.ok(result[i]>result[i-1]+.0005,'strand shading must remain ordered');
 assert.ok(result.at(-1)-result[0]>.1,'highlights and dark strands remain visibly different');
 assert.ok(Math.abs(result[3]-(linear(121)*.2126+linear(68)*.7152+linear(55)*.0722))<.002,'hair midtone follows the selected shade');
});
test('light dye keeps true black and transparency while dark strands retain ordered shading',()=>{
 const values=[0,4,8,16,32,64,160,240],d=new Uint8ClampedArray([...values.flatMap(v=>[v,v,v,255]),8,9,10,0]),before=d.slice(),m={width:values.length+1,height:1,hair:new Uint8Array(values.length+1).fill(255),skin:new Uint8Array(values.length+1)};
 Hair.apply(d,values.length+1,1,m,[{hair:1,hairColor:'#bd9967'}]);
 assert.deepEqual([...d.slice(0,4)],[0,0,0,255]);assert.deepEqual(d.slice(-4),before.slice(-4));
 let previous=0;for(let i=1;i<values.length;i++){const l=linear(d[i*4])*.2126+linear(d[i*4+1])*.7152+linear(d[i*4+2])*.0722;assert.ok(l>previous,'dark strands must not flatten to one gray floor');previous=l;}
 assert.ok(d[(values.length-1)*4]>220,'bright reflections stay bright');
});
test('covered underexposed hair receives dye instead of remaining black behind a shadow cutoff',()=>{
 // Actual crown and inner-hair samples from the reported photo; AI alpha is high.
 const source=[[6,5,19],[3,2,20],[5,3,16],[1,2,7],[4,0,10]],d=new Uint8ClampedArray(source.flatMap(v=>[...v,255])),m={width:source.length,height:1,hair:new Uint8Array([250,254,255,255,255]),skin:new Uint8Array(source.length)};
 Hair.apply(d,source.length,1,m,[{hair:1,hairColor:'#6b466e'}]);
 for(let i=0;i<source.length;i++){const out=[...d.slice(i*4,i*4+3)];assert.ok(Math.max(...out)>=25,`covered dark sample ${source[i]} must receive visible pigment: ${out}`);assert.ok(out[0]>out[1]&&out[2]>out[1],'purple hue also reaches dark strands');}
 const brightness=source.map((v,i)=>({before:linear(v[0])*.2126+linear(v[1])*.7152+linear(v[2])*.0722,after:linear(d[i*4])*.2126+linear(d[i*4+1])*.7152+linear(d[i*4+2])*.0722})).sort((a,b)=>a.before-b.before);
 for(let i=1;i<brightness.length;i++)assert.ok(brightness[i].after>brightness[i-1].after,'individual dark strands retain their shading');
});
test('skin protection and per-person ownership prevent tint on skin and other people',()=>{
 const d=new Uint8ClampedArray([60,50,40,255,60,50,40,255,160,110,90,255]),before=d.slice(),m={width:3,height:1,hair:new Uint8Array(3).fill(255),skin:new Uint8Array([0,0,255]),hairOwners:new Uint8Array([1,2,1])};const settings=Object.freeze([Object.freeze({hair:1,hairColor:'#b33145'}),Object.freeze({hair:0,hairColor:'#3355bb'})]);Hair.apply(d,3,1,m,settings);assert.notDeepEqual(d.slice(0,4),before.slice(0,4));assert.deepEqual(d.slice(4),before.slice(4));assert.ok(d[0]>d[1]);
});
test('hair recipes survive a structured draft and are resolution independent in uniform interior regions',()=>{
 const a=fixture(100,60),b=fixture(400,240),settings=[{hair:.55,hairColor:'#6b466e'}],copy=structuredClone(settings);Hair.apply(a.d,a.W,a.H,a.m,settings);Hair.apply(b.d,b.W,b.H,b.m,copy);assert.deepEqual(settings,copy);assert.ok(a.d.every(Number.isFinite)&&b.d.every(Number.isFinite));const x=new Uint8ClampedArray([70,60,50,255]),y=x.slice(),m={width:1,height:1,hair:new Uint8Array([255]),skin:new Uint8Array([0])};Hair.apply(x,1,1,m,settings);Hair.apply(y,1,1,m,copy);assert.deepEqual(x,y);
});

function uniform(rgb,hex,{strength=1,width=8,height=4,mapWidth=width,mapHeight=height}={}){
 const data=new Uint8ClampedArray(Array.from({length:width*height},()=>[...rgb,255]).flat());
 Hair.apply(data,width,height,{width:mapWidth,height:mapHeight,hair:new Uint8Array(mapWidth*mapHeight).fill(255)},[{hair:strength,hairColor:hex}]);return data;
}
const rgb=hex=>[0,2,4].map(i=>parseInt(hex.slice(i+1,i+3),16));
test('full coverage matches every palette shade on dark, medium, blonde and gray hair',()=>{
 for(const hex of ['#735440','#794437','#24262b','#655d57','#6b466e','#bd9967','#3355bb'])for(const source of [45,80,140,210,240]){
  const actual=uniform([source,source,source],hex),expected=rgb(hex);
  expected.forEach((v,i)=>assert.ok(Math.abs(actual[i]-v)<=2,`${source} to ${hex}: ${[...actual.slice(0,3)]}`));
 }
});
test('full strength replaces an old warm tint without a residual ten-percent color cast',()=>{
 const result=uniform([100,60,35],'#3355bb'),expected=rgb('#3355bb');expected.forEach((v,i)=>assert.ok(Math.abs(result[i]-v)<=2));
});
test('each person uses their own hair exposure anchor',()=>{
 const d=new Uint8ClampedArray([45,45,45,255,210,210,210,255]),m={width:2,height:1,hair:new Uint8Array([255,255]),hairOwners:new Uint8Array([1,2])};
 Hair.apply(d,2,1,m,[{hair:1,hairColor:'#bd9967'},{hair:1,hairColor:'#bd9967'}]);
 for(let i=0;i<3;i++){assert.ok(Math.abs(d[i]-rgb('#bd9967')[i])<=2);assert.ok(Math.abs(d[i+4]-d[i])<=1);}
});
test('skin and transparent pixels cannot move a person exposure anchor',()=>{
 const d=new Uint8ClampedArray([45,45,45,255,240,240,240,255,240,240,240,0]),before=d.slice(),m={width:3,height:1,hair:new Uint8Array([255,255,255]),skin:new Uint8Array([0,255,0])};
 Hair.apply(d,3,1,m,[{hair:1,hairColor:'#bd9967'}]);
 rgb('#bd9967').forEach((v,i)=>assert.ok(Math.abs(d[i]-v)<=2));assert.deepEqual(d.slice(4),before.slice(4));
});
test('owned interpolation never borrows a neighboring inactive person or colors unowned hair',()=>{
 const W=8,d=new Uint8ClampedArray(Array.from({length:W},()=>[80,80,80,255]).flat()),before=d.slice(),m={width:4,height:1,hair:new Uint8Array([255,255,255,255]),hairOwners:new Uint8Array([1,2,0,0])};
 Hair.apply(d,W,1,m,[{hair:1,hairColor:'#b33145'},{hair:0,hairColor:'#3355bb'}]);
 assert.notDeepEqual(d.slice(0,8),before.slice(0,8));assert.deepEqual(d.slice(8),before.slice(8));
});
test('a soft fringe retains its owned dye after the nearest cell reaches zero alpha',()=>{
 const W=8,d=new Uint8ClampedArray(Array.from({length:W},()=>[80,80,80,255]).flat()),before=d.slice(),m={width:2,height:1,hair:new Uint8Array([255,0]),hairOwners:new Uint8Array([1,0])};
 Hair.apply(d,W,1,m,[{hair:1,hairColor:'#b33145'}]);
 assert.notDeepEqual(d.slice(4*4,5*4),before.slice(4*4,5*4),'owned bilinear fringe survives');assert.deepEqual(d.slice(6*4),before.slice(6*4),'unmasked background stays exact');
});
test('soft hair confidence keeps fine strands without adding a background floor',()=>{
 assert.equal(Hair.confidence(0),0);assert.equal(Hair.confidence(.02),0);assert.ok(Hair.confidence(.2)>.08);assert.equal(Hair.confidence(1),1);assert.ok(Hair.confidence(.9)>.9);
 let previous=0;for(let i=0;i<=100;i++){const next=Hair.confidence(i/100);assert.ok(next>=previous&&next<=1);previous=next;}
});
test('source maps and settings remain reusable without render-side mutation',()=>{
 const f=fixture(),maps=structuredClone(f.m),settings=[{hair:.6,hairColor:'#bd9967'}],saved=structuredClone(settings);
 Hair.apply(f.d,f.W,f.H,f.m,settings);assert.deepEqual(f.m,maps);assert.deepEqual(settings,saved);
});
test('the same uniform photo uses the same shade across preview and export resolutions',()=>{
 const small=uniform([75,60,45],'#bd9967',{width:24,height:12,mapWidth:6,mapHeight:3}),large=uniform([75,60,45],'#bd9967',{width:240,height:120,mapWidth:6,mapHeight:3});
 assert.deepEqual(small.slice(0,4),large.slice(0,4));
});
