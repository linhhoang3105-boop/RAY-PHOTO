const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createCanvas}=require('@napi-rs/canvas');
const C=require('../dist/darkroom/doodle-core.js'),Scope=require('../dist/darkroom/adjust-scope-core.js'),Photo=require('../dist/darkroom/photo-edit-core.js');
const shape=(extra={})=>({...C.defaults,id:'art-1',closed:true,points:[[.2,.2],[.8,.2],[.8,.8],[.2,.8],[.2,.2]],...extra});
function canvas(W=200,H=200){const c=createCanvas(W,H),x=c.getContext('2d');x.fillStyle='#808080';x.fillRect(0,0,W,H);return c;}
const rgb=(c,x,y)=>Array.from(c.getContext('2d').getImageData(x,y,1,1).data),pixels=c=>Buffer.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data);
test('open illustration strokes and eye dots render without filling their background',()=>{
 const c=canvas(),before=pixels(c),s=shape({closed:false,points:[[.2,.5],[.8,.5]],ink:'#ff0000',width:.02,fillSide:'out',fillOpacity:1});C.draw(c.getContext('2d'),200,200,{strokes:[s,{...s,id:'art-2',points:[[.5,.3]]}]});
 assert.deepEqual(rgb(c,100,100),[255,0,0,255]);assert.deepEqual(rgb(c,100,60),[255,0,0,255]);assert.deepEqual(rgb(c,100,150),[128,128,128,255]);assert.notDeepEqual(pixels(c),before);
});
test('each closed shape has an independent color, and outside fill is complementary to inside fill',()=>{
 const inside=canvas(),outside=canvas(),base=canvas(),s=shape({opacity:0,fill:'#00ff00',fillOpacity:1,fillSide:'in'});C.draw(inside.getContext('2d'),200,200,{strokes:[s]});C.draw(outside.getContext('2d'),200,200,{strokes:[{...s,fillSide:'out'}]});
 assert.deepEqual(rgb(inside,100,100),[0,255,0,255]);assert.deepEqual(rgb(inside,10,10),rgb(base,10,10));assert.deepEqual(rgb(outside,100,100),rgb(base,100,100));assert.deepEqual(rgb(outside,10,10),[0,255,0,255]);
 const c=canvas(),second=shape({id:'art-2',points:[[.4,.4],[.6,.4],[.6,.6],[.4,.6]],opacity:0,fill:'#0000ff',fillSide:'in',fillOpacity:1});C.draw(c.getContext('2d'),200,200,{strokes:[s,second]});assert.deepEqual(rgb(c,100,100),[0,0,255,255]);assert.deepEqual(rgb(c,60,60),[0,255,0,255]);assert.equal(s.fill,'#00ff00');
});
test('a shape copies into the existing regional mask without importing illustration paint or sharing mutable points',()=>{
 const s=shape({fillSide:'out',ink:'#ff0000'}),m=C.mask(s);assert.equal(C.mask({...s,closed:false}),null);assert.deepEqual(Object.keys(m).sort(),['mode','open','points','size']);m.points[0][0]=.3;assert.equal(s.points[0][0],.2);
 const p={...Scope.defaults,adjustRegionShape:'freehand',adjustRegionStrokes:[C.mask(s)],adjustRegionFeather:0,adjustRegion:'in'},a=Scope.weight(p,200,200),b=Scope.weight({...p,adjustRegion:'out'},200,200);for(const [x,y]of [[100,100],[10,10],[60,60],[190,10]])assert.ok(Math.abs(a(x,y)+b(x,y)-1)<1e-6);assert.equal(a(100,100),1);assert.equal(a(10,10),0);
});
test('vectors, all paint properties and exact rendered pixels survive a JSON draft round trip',()=>{
 const a=shape({ink:'#123456',opacity:.7,fill:'#ab78cd',fillOpacity:.4,fillSide:'out'}),s=C.state();s.set([a]);const saved=JSON.stringify(s.capture()),c=canvas();C.draw(c.getContext('2d'),200,200,s.capture());s.clear();s.restore(JSON.parse(saved));const d=canvas();C.draw(d.getContext('2d'),200,200,s.capture());assert.deepEqual(pixels(c),pixels(d));assert.equal(JSON.stringify(s.capture()),saved);s.strokes[0].points[0][0]=.1;assert.equal(JSON.parse(saved).strokes[0].points[0][0],.2);
});
test('malformed or oversized drawing states are rejected and old drafts need no artwork',()=>{
 const a=shape();for(const bad of [null,{version:2,strokes:[a]},{version:1,strokes:[a,a]},{version:1,strokes:[{...a,width:Infinity}]},{version:1,strokes:[{...a,ink:'red; url(x)'}]},{version:1,strokes:[{...a,points:[[NaN,.2]]}]},{version:1,strokes:Array.from({length:257},(_,i)=>({...a,id:'art-'+i}))}])assert.equal(C.restore(bad),null);const s=C.state();s.set([a]);s.restore(undefined);assert.equal(s.capture(),null);
});
test('illustration coordinates, inside/outside and stroke width follow crop, turn and mirror',()=>{
 const a=shape({fillSide:'out'}),snap={p:{},focus:{cx:.5,cy:.5,rx:.2,ry:.2},sun:{x:.5,y:.1},leak:{x:.2,y:.2},body:[],doodle:{version:1,strokes:[a]}},before=JSON.stringify(snap);
 for(const kind of ['right','left','flipX','flipY','crop']){const op=Photo.operation(600,800,kind,{x:.1,y:.1,width:.8,height:.8}),s=Photo.remap(snap,600,800,op).doodle.strokes[0];assert.ok(C.valid(s));assert.equal(s.fillSide,'out');assert.equal(s.width*Math.min(op.width,op.height),a.width*600);a.points.forEach((p,i)=>{const q=Photo.point(op.matrix,p[0]*600,p[1]*800);assert.ok(Math.hypot(s.points[i][0]*op.width-q.x,s.points[i][1]*op.height-q.y)<1e-8);});}assert.equal(JSON.stringify(snap),before);
});
test('preview and full export draw at matching normalized positions with proportional stroke thickness',()=>{
 const s=shape({closed:false,points:[[.3,.2],[.3,.8]],ink:'#ff0000',width:.04}),small=canvas(200,300),large=canvas(1000,1500);C.draw(small.getContext('2d'),200,300,{strokes:[s]});C.draw(large.getContext('2d'),1000,1500,{strokes:[s]});for(const [x,y]of [[.3,.5],[.28,.5],[.25,.5],[.3,.9]])assert.deepEqual(rgb(small,Math.floor(x*200),Math.floor(y*300)),rgb(large,Math.floor(x*1000),Math.floor(y*1500)));
 assert.equal(small.width,200);assert.equal(large.width,1000);assert.equal(C.contains(shape(),[.5,.5]),true);assert.equal(C.contains(shape(),[.1,.1]),false);
});
