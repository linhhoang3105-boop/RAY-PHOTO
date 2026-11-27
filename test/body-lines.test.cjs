const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createCanvas}=require('@napi-rs/canvas');
const C=require('../dist/darkroom/body-ai/line-core.js'),Photo=require('../dist/darkroom/photo-edit-core.js'),Contour=require('../dist/darkroom/body-ai/contour-core.js');
const line=(points=[[.45,.3],[.48,.4],[.46,.5],[.44,.6],[.45,.7]],extra={})=>({id:'line-1',personId:'manual',points,offsets:points.map(()=>[0,0]),size:.12,strength:1,...extra});
const pixels=c=>Buffer.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data);
function scene(W=180,H=240){const c=createCanvas(W,H),x=c.getContext('2d'),im=x.createImageData(W,H);for(let y=0;y<H;y++)for(let xx=0;xx<W;xx++)im.data.set([xx%255,y%255,(xx*17+y*7)%255,255],(y*W+xx)*4);x.putImageData(im,0,0);return c;}
test('drawing an open line, a curve or a loop does not move any photo pixel until explicitly bent',()=>{
 for(const points of [[[.2,.3],[.7,.3]],[[.3,.3],[.4,.4],[.5,.3]],[[.3,.3],[.6,.3],[.6,.6],[.3,.3]]]){const c=scene(),before=pixels(c);assert.equal(C.apply(c.getContext('2d'),c.width,c.height,[line(points)]),false);assert.deepEqual(pixels(c),before);}
});
test('bending a curve changes local pixels, keeps the source/old recipe immutable, and preserves distant pixels exactly',()=>{
 const original=line(),snapshot=structuredClone(original),edited=C.move(original,2,-12,3,600,800),src=scene(),c=scene(),before=pixels(src);assert.equal(C.apply(c.getContext('2d'),c.width,c.height,[edited]),true);const after=pixels(c);assert.notDeepEqual(after,before);assert.deepEqual(original,snapshot);assert.deepEqual(pixels(src),before);
 for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(x<40||x>135||y<35||y>205){const i=(y*c.width+x)*4;assert.deepEqual(after.subarray(i,i+4),before.subarray(i,i+4));}
 const reset={...edited,offsets:edited.points.map(()=>[0,0])},restored=scene();assert.equal(C.apply(restored.getContext('2d'),180,240,[reset]),false);assert.deepEqual(pixels(restored),before);
});
test('large and intersecting edits have positive Jacobians rather than folding or inverting the photograph',()=>{
 for(const points of [[[.4,.3],[.4,.7]],[[.3,.3],[.7,.7],[.7,.3],[.3,.7]],[[.3,.5],[.4,.3],[.6,.7],[.7,.5]]]){const l=line(points,{offsets:points.map((_,i)=>[i%2?.8:-.7,i%2?-.6:.6]),size:.08}),f=C.compile(l,600,800);assert.ok(f.gradient<=.6500001);let min=1;
  for(let y=f.top+f.sy/2;y<f.bottom;y+=f.sy)for(let x=f.left+f.sx/2;x<f.right;x+=f.sx){const e=1e-6,a=C.at(f,x+e,y),b=C.at(f,x-e,y),c=C.at(f,x,y+e),d=C.at(f,x,y-e),xx=1-(a[0]-b[0])/(2*e),yy=1-(c[1]-d[1])/(2*e),xy=-(c[0]-d[0])/(2*e),yx=-(a[1]-b[1])/(2*e);min=Math.min(min,xx*yy-xy*yx);}assert.ok(min>.1,'minimum Jacobian '+min);
 }
});
test('forward guide positions and inverse photo sampling agree across preview/export scales and multiple strokes',()=>{
 const a=C.move(line(),2,-18,4,600,800),b=C.move(line([[.3,.25],[.55,.3],[.7,.25]],{id:'line-2',size:.15}),1,4,16,600,800);
 for(const [W,H]of [[150,200],[600,800],[3024,4032]]){const fields=C.fields([a,b],W,H);for(const p of [[.48,.4],[.44,.5],[.56,.29],[.5,.9]]){const q=C.project(p,fields,W,H),back=C.unproject(q,fields,W,H);assert.ok(Math.hypot((back[0]-p[0])*W,(back[1]-p[1])*H)<.001);const small=C.project(p,C.fields([a,b],150,200),150,200);assert.ok(Math.hypot(q[0]-small[0],q[1]-small[1])<1e-9);}}
});
test('saved vector strokes round-trip without AI or pixels; malformed and unbounded states are rejected',()=>{
 const state=C.state(),a=C.move(line(),2,10,0,600,800);state.set([a]);const saved=structuredClone(state.capture());state.clear();state.restore(JSON.parse(JSON.stringify(saved)));assert.deepEqual(state.capture(),saved);const before=scene(),replay=scene();C.apply(before.getContext('2d'),180,240,[a]);C.apply(replay.getContext('2d'),180,240,state.lines);assert.deepEqual(pixels(replay),pixels(before));
 for(const bad of [null,{version:2,lines:[a]},{version:1,lines:[{...a,points:[[NaN,.3],[.3,.4]]}]},{version:1,lines:[{...a,offsets:[]}]},{version:1,lines:[a,a]},{version:1,lines:Array.from({length:65},(_,i)=>({...a,id:'line-'+i}))}])assert.equal(C.restore(bad),null);assert.equal(C.compile(a,0,100),null);assert.equal(C.compile(a,Infinity,100),null);
});
test('crop, quarter turn and mirror carry each line, displacement direction and influence radius with the image',()=>{
 const W=600,H=800,a=C.move(line(),2,-12,4,W,H),snapshot={p:{},focus:{cx:.5,cy:.5,rx:.2,ry:.2},sun:{x:.5,y:.1},leak:{x:.1,y:.1},body:[],bodyLines:{version:1,lines:[a]}},original=structuredClone(snapshot);
 for(const kind of ['right','flipX','flipY','crop']){const op=Photo.operation(W,H,kind,{x:.1,y:.1,width:.8,height:.8}),next=Photo.remap(snapshot,W,H,op),mapped=next.bodyLines.lines[0];assert.ok(C.restore(next.bodyLines));for(const p of [[.45,.5],[.5,.4],[.5,.8]]){const q=C.project(p,C.fields([a],W,H),W,H),pt=Photo.point(op.matrix,p[0]*W,p[1]*H),qt=Photo.point(op.matrix,q[0]*W,q[1]*H),after=C.project([pt.x/op.width,pt.y/op.height],C.fields([mapped],op.width,op.height),op.width,op.height);assert.ok(Math.hypot(after[0]*op.width-qt.x,after[1]*op.height-qt.y)<.02,kind);}}assert.deepEqual(snapshot,original);
});
test('replaying a gold contour pull samples the original mask once and is independent of pointer event frequency',()=>{
 const w=160,h=200,foreground=new Uint8Array(w*h);for(let y=20;y<180;y++)for(let x=45;x<110;x++)foreground[y*w+x]=255;const mask={width:w,height:h,foreground},s={mode:'pull',size:.22,points:[[.69,.5],[.65,.51]]},a=Contour.applyStroke(mask,s,600,800);let last;for(let i=1;i<=30;i++)last=Contour.applyStroke(mask,{...s,points:[s.points[0],[.69+(.65-.69)*i/30,.5+.01*i/30]]},600,800);assert.deepEqual(last.foreground,a.foreground);assert.deepEqual(Contour.raster(mask,[JSON.parse(JSON.stringify(s))],600,800),a);assert.equal(mask.foreground[100*w+109],255);assert.notDeepEqual(a.foreground,mask.foreground);
});
