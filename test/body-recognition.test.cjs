const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../dist/darkroom/body-ai/recognition-core.js'),P=require('../dist/darkroom/body-ai/pose-core.js'),fixture=require('./fixtures/body-pose.cjs');
const file={name:'portrait.jpg',size:240000,lastModified:1700000000000,type:'image/jpeg'};
function sample(){const pose=fixture.pose(),regions=P.limbRegions(pose,600,800),mask=fixture.mask(pose,600,800);return{people:[{regions,x:.5,y:.5,area:.7,rayHasPose:true,rayMask:mask}],selected:0,W:600,H:800,file,ui:{scope:'foreL',strength:65,mode:'balanced',outline:true,bodyMode:'body'}};}

test('draft masks round trip every pixel losslessly, including noisy confidence edges',()=>{
 for(const a of [new Uint8Array(320*240).fill(255),Uint8Array.from({length:160*120},(_,i)=>(i*73+Math.floor(i/13))%256)]){
  const encoded=C.encodeMask({width:a.length===320*240?320:160,height:a.length===320*240?240:120,foreground:a});
  assert.equal(encoded.encoding,a.length===320*240?'rle8':'raw8');assert.deepEqual(C.decodeMask(structuredClone(encoded)).foreground,a);
 }
});
test('malformed or oversized optional mask data is rejected before allocation',()=>{
 const candidates=[{width:999999,height:999999,encoding:'raw8',data:[]},{width:4,height:4,encoding:'rle8',data:[0]},{width:4,height:4,encoding:'rle8',data:[17<<8]},{width:4,height:4,encoding:'rle8',data:[15<<8]},{width:4,height:4,encoding:'raw8',data:Array(16).fill(999)},{width:4,height:4,encoding:'unknown',data:Array(16).fill(1)}];
 candidates.push({width:4,height:4,encoding:'rle8',data:{length:1,0:16<<8}});for(const saved of candidates)assert.equal(C.decodeMask(saved),null);
});
test('restoring a contour preserves limb measurements and the selected draft controls exactly',()=>{
 const state=sample(),ids=Object.keys(state.people[0].regions),saved=C.pack(state,ids),restored=C.unpack(structuredClone(saved),state,ids);
 assert.ok(restored);assert.deepEqual(restored.ui,state.ui);assert.deepEqual(restored.people[0].rayMask.foreground,state.people[0].rayMask.foreground);
 for(const id of ids){const p=state.people[0].regions[id],q=restored.people[0].regions[id];assert.deepEqual(P.measureWidth(state.people[0].rayMask,{...p,place:'ai'},600,800),P.measureWidth(restored.people[0].rayMask,{...q,place:'ai'},600,800));}
});
test('a cache from a different file or dimensions is ignored; old drafts need no cache',()=>{
 const state=sample(),ids=Object.keys(state.people[0].regions),saved=C.pack(state,ids);
 for(const change of [{file:{...file,size:file.size+1}},{file:{...file,lastModified:0}},{W:601},{H:801}])assert.equal(C.unpack(saved,{...state,...change},ids),null);
 assert.equal(C.unpack(null,state,ids),null);assert.equal(C.unpack({...saved,version:99},state,ids),null);
 const broken=structuredClone(saved);broken.people[0].regions.armL.rayPose.length+=1;assert.equal(C.unpack(broken,state,ids),null);
});
test('failed model scans explain graphics, loading and timeout causes without promising a result',()=>{
 assert.match(C.failure(new Error('WebGL context could not be created')),/xử lý đồ họa/);
 assert.match(C.failure(new Error('Failed to fetch'),false),/kết nối/);
 assert.match(C.failure(new Error('Tải AI quá lâu')),/quá thời gian/);
 assert.match(C.failure(new Error('unknown'),false),/xử lý đồ họa/);
 for(const message of ['WebGL context','fetch','timeout'])assert.match(C.failure(new Error(message)),/chỉnh sửa đã giữ vẫn còn/);
});
