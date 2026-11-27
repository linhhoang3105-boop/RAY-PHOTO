const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createCanvas}=require('@napi-rs/canvas');
const Core=require('../dist/darkroom/compose-core.js'),Photo=require('../dist/darkroom/photo-edit-core.js'),{Timeline}=require('../dist/darkroom/edit-history.js');
const make=()=>createCanvas(1,1),pixel=(c,x,y)=>[...c.getContext('2d').getImageData(x,y,1,1).data];
function image(color,W=10,H=10){const c=createCanvas(W,H);c.getContext('2d').fillStyle=color;c.getContext('2d').fillRect(0,0,W,H);return c;}
function scene(people,mask=null,W=100,H=100){const c=image('#ffffff',W,H);Core.drawPeople(c.getContext('2d'),people,p=>image(p.color),W,H,mask,make);return c;}
const a={id:'a',color:'#ff0000',x:.5,y:.5,size:.6,opacity:1},b={...a,id:'b',color:'#0000ff',x:.6};
test('front and back change overlap pixels without mutating recipes or untouched photo pixels',()=>{
 const people=Object.freeze([Object.freeze(a),Object.freeze(b)]),before=scene(people),front=Core.movePerson(people,'a','front'),back=Core.movePerson(front,'a','back');
 assert.deepEqual(pixel(before,50,50),[0,0,255,255]);assert.deepEqual(pixel(scene(front),50,50),[255,0,0,255]);assert.deepEqual(pixel(scene(back),50,50),[0,0,255,255]);assert.deepEqual(pixel(scene(front),0,0),[255,255,255,255]);assert.deepEqual(people.map(p=>p.id),['a','b']);assert.deepEqual(front.map(p=>p.id),['b','a']);
});
test('behind original subject is occluded only by the mask and a front cutout can cover the subject',()=>{
 const mask=image('#ffffff',100,100);mask.getContext('2d').clearRect(0,0,45,100);const behind={...a,behindSubject:true},back=scene([behind],mask),front=scene([a],mask);
 assert.deepEqual(pixel(back,35,50),[255,0,0,255]);assert.deepEqual(pixel(back,55,50),[255,255,255,255]);assert.deepEqual(pixel(front,55,50),[255,0,0,255]);assert.deepEqual(pixel(scene([behind,b],mask),55,50),[0,0,255,255]);
});
test('hidden layers stay hidden, legacy layers stay in front, and both planes retain stacking order',()=>{
 const people=[{...a,id:'front'},{...b,id:'back',behindSubject:true},{...a,id:'hidden',hidden:true,behindSubject:true}];
 assert.deepEqual(Core.orderPeople(people).map(p=>p.id),['back','hidden','front']);assert.deepEqual(pixel(scene(people),50,50),[255,0,0,255]);assert.equal(Core.movePerson(people,'missing','front'),people);assert.equal(Core.movePerson(people,'front','invalid'),people);
});
test('soft mask edges and cutout transparency survive composition and scale with output resolution',()=>{
 const mask=make();mask.width=100;mask.height=100;const c=mask.getContext('2d');c.fillStyle='rgba(255,255,255,.5)';c.fillRect(0,0,100,100);
 const back=scene([{...a,behindSubject:true}],mask);const p=pixel(back,50,50);assert.equal(p[0],255);assert.ok(p[1]>=126&&p[1]<=129);assert.equal(p[3],255);
 const large=scene([{...a,behindSubject:true}],mask,400,400);assert.deepEqual(pixel(large,200,200),p);
 const empty=make();empty.width=100;empty.height=100;Core.drawPeople(empty.getContext('2d'),[{...a,opacity:.5}],()=>image('#ff0000'),100,100,null,make);assert.ok(pixel(empty,50,50)[3]>=127&&pixel(empty,50,50)[3]<=128);assert.equal(pixel(empty,0,0)[3],0);
});
test('undo redo and reopening drafts retain independent ordering, original mask bytes and source asset blobs',()=>{
 const start={...Core.defaults(),subjectMask:{id:'original',width:2,height:2,data:new Uint8Array([255,0,128,0])},people:[{...a,asset:{id:'image-a',blob:new Blob(['a'])}},b]},after={...start,people:Core.movePerson(start.people,'a','front').map(p=>p.id==='a'?{...p,behindSubject:true}:p)},h=new Timeline();
 h.reset({key:Core.signature(start),compose:start});h.push({key:Core.signature(after),compose:after});assert.deepEqual(h.undo().compose.people.map(p=>p.id),['a','b']);assert.equal(h.redo().compose.people[1].behindSubject,true);const saved=new Timeline();saved.restore(structuredClone(h.serialize()));assert.deepEqual(saved.current().compose.subjectMask.data,start.subjectMask.data);assert.equal(saved.current().compose.people[1].asset.blob.size,1);assert.equal(Core.signature(saved.current().compose),Core.signature(after));assert.ok(!Core.signature(after).includes('255'));
});
test('turn crop and flip remap original subject mask along with people while retaining their depth',()=>{
 const s={p:{},focus:{cx:.5,cy:.5,rx:.2,ry:.3},sun:{x:.5,y:0},leak:{x:0,y:0},compose:{...Core.defaults(),subjectMask:{id:'s',width:4,height:2,data:new Uint8Array([1,2,3,4,5,6,7,8])},people:[{...a,behindSubject:true}]}};
 const turned=Photo.remap(s,800,400,Photo.operation(800,400,'right'));assert.deepEqual([...turned.compose.subjectMask.data],[5,1,6,2,7,3,8,4]);assert.equal(turned.compose.people[0].behindSubject,true);const back=Photo.remap(turned,400,800,Photo.operation(400,800,'left'));assert.deepEqual(back.compose.subjectMask.data,s.compose.subjectMask.data);
 const crop=Photo.remap(s,800,400,Photo.operation(800,400,'crop',{x:.25,y:0,width:.5,height:1}));assert.deepEqual([...crop.compose.subjectMask.data],[2,3,6,7]);assert.deepEqual([...s.compose.subjectMask.data],[1,2,3,4,5,6,7,8]);
});
