const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../dist/darkroom/body-ai/pose-core.js'),{engine}=require('../dist/darkroom/body-ai/pose-adapter.js'),fixture=require('./fixtures/body-pose.cjs');

test('eight limb regions include upper/lower arms and thighs/calves without requiring a head',()=>{
 const p=fixture.pose();for(const point of p.filter(Boolean))point.visibility=.60;
 const regions=C.limbRegions(p,600,800);assert.deepEqual(Object.keys(regions).sort(),Object.keys(C.LIMBS).sort());
 for(const [id,r]of Object.entries(regions)){assert.ok(r.rayPose.confidence>=.5);assert.ok(r.rx>0&&r.ry>r.rx);assert.equal(Number.isFinite(r.rot),true,id);}
 p[15].visibility=.2;p[28].y=1.1;const partial=C.limbRegions(p,600,800);assert.ok(partial.armL&&partial.thR);assert.equal(partial.foreL,undefined);assert.equal(partial.clR,undefined);
});
test('bent or crossed forearms retain their own shoulder side',()=>{
 const p=fixture.pose();p[15].x=.98;p[16].x=.02;const r=C.limbRegions(p,600,800);
 assert.equal(r.foreL.rayPose.a.x,p[13].x);assert.equal(r.foreR.rayPose.a.x,p[14].x);assert.ok(r.foreL.cx>r.foreR.cx);
});
test('limb widths are measured perpendicular in image pixels for square and non-square masks',()=>{
 const p=fixture.pose();for(const [W,H,mw,mh]of [[600,800,256,256],[1000,600,400,128],[600,1000,128,400]]){
  const mask=fixture.mask(p,W,H,mw,mh),r=C.limbRegions(p,W,H);
  for(const [id,width]of [['armL',.052],['foreR',.043],['thL',.074],['clR',.052]]){
   const m=C.measureWidth(mask,{...r[id],id,place:'ai'},W,H);assert.equal(m.ok,true,id+' '+W+'x'+H+' '+m.why);assert.ok(Math.abs(m.widthPx-H*width)<Math.max(W/mw,H/mh)*4,id+' width '+m.widthPx);assert.ok(m.samples>=2);
  }
 }
});
test('a limb joined to an unbounded foreground or outside the image cannot be reported as measured',()=>{
 const r=C.limbRegions(fixture.pose(),600,800).armL,mask={width:100,height:100,foreground:new Uint8Array(10000).fill(255)};
 assert.equal(C.measureWidth(mask,{...r,place:'ai'},600,800).ok,false);
 const p=fixture.pose();p[15].x=-.1;assert.equal(C.limbRegions(p,600,800).foreL,undefined);
});
test('a silhouette is traced as connected paths so dashed target lines have real gaps',()=>{
 const mask=fixture.mask(fixture.pose()),paths=C.tracePaths(C.boundaries(mask));assert.ok(paths.length>0);assert.ok(paths[0].length>100);assert.deepEqual(paths[0][0],paths[0].at(-1));
 assert.ok(paths.flat().every(p=>p.every(n=>n>=0&&n<=1)));
});
test('target contours invert the unchanged safe body warp and include prior body edits',()=>{
 const html=fs.readFileSync(require('node:path').join(__dirname,'../dist/darkroom/index.html'),'utf8'),base=html.match(/<script>([\s\S]*?)<\/script>/)[1],h={};vm.createContext(h);vm.runInContext(base.slice(base.indexOf('const BODY_DEF'),base.indexOf('/* ============ dựng ảnh')),h);
 const p={id:'armL',cx:.35,cy:.4,rx:.2,ry:.24,rot:37,size:.08,wid:-.16,len:.04,push:.07,dir:25,soft:.5},W=600,H=800,kernel={guard:h.bodyGuard,coef:h.bodyCoef},warps=C.compile([p],W,H,kernel),co=warps[0].co;
 for(const point of [[.31,.39],[.37,.43],[.34,.5]]){const out=C.project(point,warps,W,H),w=warps[0],dx=out[0]*W-w.cx,dy=out[1]*H-w.cy,[sx,sy]=C.sourceAt(co,w.cs*dx+w.sn*dy,-w.sn*dx+w.cs*dy),x=w.cx+w.cs*sx-w.sn*sy,y=w.cy+w.sn*sx+w.cs*sy;assert.ok(Math.hypot(x-point[0]*W,y-point[1]*H)<.05);}
 const planned=C.plannedParts([p],[{p,axis:'x',delta:-.15,rx:.25,ry:.3}]);assert.equal(p.rx,.2);assert.equal(planned[0].rx,.25);assert.ok(planned[0].wid<p.wid);assert.notDeepEqual(C.project([.31,.39],C.compile(planned,W,H,kernel),W,H),C.project([.31,.39],warps,W,H));
});
test('CPU pose inference copies person masks before closing results and survives an unavailable face model',async()=>{
 const mask=new Float32Array([0,.2,.8,1]),configs=[];let closed=0;
 const api={FilesetResolver:{forVisionTasks:async()=>({})},PoseLandmarker:{createFromOptions:async(_,options)=>{configs.push(options);return{detect:()=>({landmarks:[fixture.pose()],segmentationMasks:[{width:2,height:2,getAsFloat32Array:()=>mask}],close(){mask.fill(0);closed++;}})};}},FaceLandmarker:{createFromOptions:async()=>{throw new Error('face unavailable');}}};
 const detector=await engine({roots:['fixture'],pose:'pose.task',face:'face.task'},()=>{},{importModule:async()=>api,fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)})});
 const result=await detector.detect({});assert.equal(configs[0].numPoses,6);assert.equal(configs[0].outputSegmentationMasks,true);assert.equal(configs[0].baseOptions.delegate,'CPU');assert.deepEqual([...result.masks[0].foreground],[0,51,204,255]);assert.deepEqual(result.errors,['face']);assert.equal(result.poses.length,1);assert.equal(closed,1);
});

test('repeated and concurrent scans release every model before opening another graph',async()=>{
 let live=0,maxLive=0,created=0,closed=0,fetches=0;
 const create=kind=>async()=>{live++;created++;maxLive=Math.max(maxLive,live);const points=[[{x:.3,y:.4,visibility:.9}]],values=new Float32Array([0,1]);return{
  detect:image=>{if(image.fail&&kind==='pose')throw new Error('inference failed');return{...(kind==='pose'?{landmarks:points,segmentationMasks:[{width:2,height:1,getAsFloat32Array:()=>values}]}:{faceLandmarks:points}),close(){values.fill(0);}};},
  close(){live--;closed++;points[0][0].x=999;}
 };};
 const api={FilesetResolver:{forVisionTasks:async()=>({})},PoseLandmarker:{createFromOptions:create('pose')},FaceLandmarker:{createFromOptions:create('face')}};
 const detector=await engine({roots:['fixture'],pose:'pose',face:'face'},()=>{},{importModule:async()=>api,fetch:async()=>{fetches++;return{ok:true,arrayBuffer:async()=>new ArrayBuffer(4)};}});
 const [first,partial,third]=await Promise.all([detector.detect({}),detector.detect({fail:true}),detector.detect({})]);
 assert.equal(maxLive,1);assert.equal(live,0);assert.equal(created,6);assert.equal(closed,6);assert.equal(fetches,2);
 assert.equal(first.poses[0][0].x,.3);assert.equal(first.faces[0][0].x,.3);assert.deepEqual([...third.masks[0].foreground],[0,255]);assert.deepEqual(partial.errors,['pose']);assert.equal(partial.faces.length,1);
});
