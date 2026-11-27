const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createCanvas}=require('@napi-rs/canvas');
const Brow=require('../dist/darkroom/brow-core.js'),{Timeline}=require('../dist/darkroom/edit-history.js');
const Controls=require('../dist/darkroom/photo-controls.js');
function face(cx=.5,cy=.4,scale=1,rotation=0){
 const f=Array.from({length:468},()=>({x:cx,y:cy})),cs=Math.cos(rotation),sn=Math.sin(rotation);
 for(let side=0;side<2;side++){
  const sign=side===0?-1:1,s=Brow.sides[side];
  s.ids.forEach((id,i)=>{const u=i<5?1-i/4:(i-5)/4,x=sign*(.04+.14*u)*scale,y=(-.025-(i<5?.012:-.012)-.018*Math.sin(u*Math.PI))*scale;f[id]={x:cx+x*cs-y*sn,y:cy+x*sn+y*cs};});
 }return f;
}
function image(){const c=createCanvas(400,300),x=c.getContext('2d');x.fillStyle='#d5b39b';x.fillRect(0,0,400,300);return c;}
const bytes=c=>Buffer.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data);
const values=(id='arched')=>({brow:.75,browStyle:id,browColor:'#463129',browThickness:1,browLength:1,browLift:0,browRotation:0});
test('different eyebrow shapes produce different localized pixels, preserving the rest of the photo',()=>{
 const a=image(),b=image(),before=bytes(a),f=face();Brow.render(a.getContext('2d'),400,300,[{face:f,values:values('straight')}],createCanvas);Brow.render(b.getContext('2d'),400,300,[{face:f,values:values('arched')}],createCanvas);
 const aa=bytes(a),bb=bytes(b);assert.notDeepEqual(aa,bb);assert.notDeepEqual(aa,before);
 for(let y=180;y<300;y++)for(let x=0;x<400;x++){const i=(y*400+x)*4;assert.equal(aa[i],before[i]);assert.equal(bb[i],before[i]);}
});
test('zero strength and missing face landmarks leave every pixel unchanged',()=>{
 const c=image(),before=bytes(c);Brow.render(c.getContext('2d'),400,300,[{face:face(),values:{...values(),brow:0}},{face:[],values:values()}],createCanvas);assert.deepEqual(bytes(c),before);
});
test('one person can receive a brow shape without changing the other person',()=>{
 const c=image(),before=bytes(c);Brow.render(c.getContext('2d'),400,300,[{face:face(.25,.4,.6),values:values('fluffy')},{face:face(.75,.4,.6),values:{...values(),brow:0}}],createCanvas);const after=bytes(c);assert.notDeepEqual(after,before);
 for(let y=0;y<300;y++)for(let x=210;x<400;x++){const i=(y*400+x)*4;assert.equal(after[i],before[i]);}
});
test('brow anchors stay orthogonal and finite on rotated faces and cropped images',()=>{
 const f=face(.1,.1,1,.32);for(const side of Brow.sides){const a=Brow.anchors(f,side,1200,900,{browRotation:9,browLift:.6,browLength:1.3});assert.ok(a);assert.ok(Math.abs(a.ux*a.nx+a.uy*a.ny)<1e-10);assert.ok(a.ny<0);assert.ok(Number.isFinite(a.x+a.y+a.length));}
 const c=image();assert.doesNotThrow(()=>Brow.render(c.getContext('2d'),400,300,[{face:face(.01,.01,1,.5),values:values('thin')}],createCanvas));
});
test('each brow can move independently and the correction scales with export resolution',()=>{
 const f=face(),v=values(),a=Brow.anchors(f,Brow.sides[0],400,300,v),b=Brow.anchors(f,Brow.sides[1],400,300,v),moved={...v,browLeftX:.13,browLeftY:.08};
 const next=Brow.anchors(f,Brow.sides[0],400,300,moved),other=Brow.anchors(f,Brow.sides[1],400,300,moved),large=Brow.anchors(f,Brow.sides[0],1600,1200,moved);
 assert.ok(Math.abs(next.x-a.x-52)<1e-10);assert.ok(Math.abs(next.y-a.y-24)<1e-10);assert.deepEqual(other,b);assert.ok(Math.abs(large.x/4-next.x)<1e-10);assert.ok(Math.abs(large.y/4-next.y)<1e-10);
 const c=image();assert.doesNotThrow(()=>Brow.render(c.getContext('2d'),400,300,[{face:f,values:{...moved,browLeftX:-.9,browRightY:1}}],createCanvas));
});
test('date scaling preserves the original bottom and right margins at every size',()=>{
 const measure=(text,h)=>[...text].reduce((n,ch)=>n+(ch===' '?h*.34:h*.8),0);
 for(const [W,H]of [[400,300],[300,400],[2048,1536]])for(const scale of [.4,.75,1,1.7,2.4]){
  const h=Math.min(W,H)*.042,txt='2026 10 26',margin=Math.min(W,H)*.045,x=W-margin-measure(txt,h),y=H-margin-h,p=Controls.stampPlacement(txt,x,y,h,scale,measure);
  assert.ok(Math.abs(p.x+measure(txt,p.h)-(W-margin))<1e-9);assert.ok(Math.abs(p.y+p.h-(H-margin))<1e-9);assert.ok(p.h>0);if(scale===1)assert.deepEqual(p,{x,y,h});
 }
});
const snapshot=(filter,lip=0,brow='original')=>({key:JSON.stringify([filter,lip,brow]),p:{filter},people:[{id:1,lip,brow}]});
test('undo and redo cross film and makeup steps without flattening or dropping earlier settings',()=>{
 const t=new Timeline();t.reset(snapshot('goc'));t.push(snapshot('gold200'),'Màu phim');t.push(snapshot('gold200',.4),'Son môi');t.push(snapshot('gold200',.4,'straight'),'Mày ngang');
 assert.equal(t.undo().people[0].brow,'original');assert.equal(t.current().people[0].lip,.4);assert.equal(t.undo().p.filter,'gold200');assert.equal(t.current().people[0].lip,0);assert.equal(t.redo().people[0].lip,.4);
});
test('editing after undo creates a new branch and a new image resets the old history',()=>{
 const t=new Timeline();t.reset(snapshot('goc'));t.push(snapshot('gold200'));t.push(snapshot('gold200',.4));t.undo();t.push(snapshot('gold200',.2));assert.equal(t.canRedo,false);assert.equal(t.current().people[0].lip,.2);t.reset(snapshot('goc'));assert.equal(t.canUndo,false);
});
test('draft serialization preserves the current point and future redo entries',()=>{
 const t=new Timeline();t.reset(snapshot('goc'));t.push(snapshot('gold200'));t.push(snapshot('gold200',.4));t.undo();const restored=new Timeline();restored.restore(structuredClone(t.serialize()));assert.equal(restored.current().p.filter,'gold200');assert.equal(restored.current().people[0].lip,0);assert.equal(restored.redo().people[0].lip,.4);
});
test('a bounded history rejects invalid drafts and avoids duplicate no-op steps',()=>{
 const t=new Timeline(4);t.reset(snapshot('goc'));assert.equal(t.push(snapshot('goc')),false);for(let i=1;i<=9;i++)t.push(snapshot('f'+i));assert.equal(t.entries.length,4);assert.equal(t.current().p.filter,'f9');assert.throws(()=>t.restore({entries:[],cursor:0}));assert.throws(()=>t.restore({entries:[{snapshot:{key:'x'}}],cursor:3}));
});
