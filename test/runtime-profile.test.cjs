const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createCanvas}=require('@napi-rs/canvas');
const Runtime=require('../dist/darkroom/runtime-profile.js');
test('agreed display names preserve every preset ID, group and color recipe, including old draft titles',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../source/buong-toi-original.html'),'utf8'),match=html.match(/const ROLLS = (\[[\s\S]*?\n\]);/),rolls=vm.runInNewContext('('+match[1]+')'),before=structuredClone(rolls),catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/presets.json'),'utf8'));
 Runtime.rename(rolls);assert.equal(rolls.length,86);assert.equal(Object.keys(Runtime.names).length,24);
 for(let i=0;i<rolls.length;i++){const r=rolls[i];assert.equal(r.id,before[i].id);assert.equal(r.g,before[i].g);assert.deepEqual(JSON.parse(JSON.stringify(r.p)),before[i].p);assert.equal(r.name,catalog.find(x=>x.id===r.id).name);}
 assert.equal(Runtime.displayName('Spotmatic'),'Nắng cũ');assert.equal(Runtime.displayName('Portra 400'),'Hồng mơ');assert.equal(Runtime.displayName('Nắng tỏa'),'Nắng tỏa');
});
test('low-memory, low-core or data-saving devices use the light preview, with safe missing-hint fallbacks',()=>{
 for(const hints of [{deviceMemory:2},{deviceMemory:4,hardwareConcurrency:8},{hardwareConcurrency:4},{connection:{saveData:true}}])assert.equal(Runtime.limited(hints),true);
 for(const hints of [{},{deviceMemory:0,hardwareConcurrency:0},{deviceMemory:8,hardwareConcurrency:8,connection:{saveData:false}}])assert.equal(Runtime.limited(hints),false);
});
test('light preview reduces work while preserving the source dimensions and pixels for export',()=>{
 const source=createCanvas(1536,1024),x=source.getContext('2d');x.fillStyle='#b68b63';x.fillRect(0,0,source.width,source.height);const original=Buffer.from(x.getImageData(0,0,1536,1024).data),old={width:80,height:80};
 const preview=Runtime.previewCanvas(source,{light:true,width:390,dpr:3},()=>createCanvas(1,1),old);assert.equal(preview.width,800);assert.equal(preview.height,533);assert.equal(old.width,0);assert.equal(old.height,0);assert.equal(source.width,1536);assert.equal(source.height,1024);assert.deepEqual(Buffer.from(x.getImageData(0,0,1536,1024).data),original);
 const released={width:preview.width,height:preview.height},next=Runtime.previewCanvas(source,{light:false,width:390,dpr:3},()=>createCanvas(1,1),released);assert.equal(next.width,1024);assert.equal(next.height,683);assert.equal(released.width,0);assert.equal(released.height,0);assert.deepEqual(Runtime.previewSize(300,500,{light:true}),{width:300,height:500});
});
