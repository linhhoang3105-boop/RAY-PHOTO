const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createCanvas}=require('@napi-rs/canvas');
const Scene=require('../dist/darkroom/background-core.js'),Core=require('../dist/darkroom/compose-core.js'),Photo=require('../dist/darkroom/photo-edit-core.js'),{Timeline}=require('../dist/darkroom/edit-history.js');
const make=()=>createCanvas(1,1),pixel=(c,x,y)=>[...c.getContext('2d').getImageData(x,y,1,1).data],bytes=c=>Buffer.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data);
function image(color,W=100,H=100){const cv=createCanvas(W,H),c=cv.getContext('2d');c.fillStyle=color;c.fillRect(0,0,W,H);return cv;}
function rectangle(id,x0,y0,x1,y1,W=100,H=100){const data=new Uint8Array(W*H);for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)data[y*W+x]=255;return{id,width:W,height:H,data};}
function recipe(patch={}){return{...Core.defaults().background,enabled:true,mode:'image',mask:rectangle('person',40,20,60,80),...patch};}
function render(b,src=image('#cb5945'),bg=image('#fafafa'),tag){const mask=Core.maskCanvas(Core.buildMask(b,src.width,src.height),make);return Core.prepareSource(src,b,mask,bg,make,null,tag);}
test('subject moves and scales independently of the background and never leaves its old silhouette behind',()=>{
 const original=image('#cb5945'),before=bytes(original),s=Scene.defaults(),b=recipe({scene:{...s,subject:{...s.subject,x:.72,scale:.5}}}),out=render(b,original);
 assert.deepEqual(pixel(out,72,50),[203,89,69,255]);assert.deepEqual(pixel(out,50,50),[250,250,250,255]);assert.deepEqual(pixel(out,72,15),[250,250,250,255]);assert.deepEqual(bytes(original),before);
});
test('an already transparent PNG keeps its alpha once, with bounds and contact at the real feet',()=>{
 const src=make();src.width=src.height=100;const c=src.getContext('2d');c.fillStyle='#cb5945';c.fillRect(40,20,20,60);c.fillStyle='rgba(203,89,69,.5)';c.fillRect(39,20,1,60);
 const b=recipe({mode:'transparent',mask:null}),out=render(b,src),edge=pixel(out,39,50);assert.ok(edge[3]>=118&&edge[3]<=130);assert.equal(pixel(out,0,0)[3],0);assert.deepEqual(pixel(out,50,50),[203,89,69,255]);
 const opaqueMask=image('#ffffff'),prepared=Scene.prepareSubject(src,b,opaqueMask,make);assert.ok(Math.abs(prepared.bounds.bottom-.8)<.02);prepared.canvas.width=prepared.canvas.height=0;prepared.silhouette.width=prepared.silhouette.height=0;
});
test('pointer coordinates invert rotated, flipped and resized subject placement without distorting its aspect',()=>{
 for(const scale of [.15,1,3])for(const angle of [-120,0,47,180])for(const flipX of [true,false]){const s={x:.72,y:.38,scale,angle,flipX};for(const pt of [[.1,.2],[.5,.5],[.9,.8]]){const q=Scene.point(Scene.matrix(s,800,1200),pt[0]*800,pt[1]*1200),p=Scene.unproject(s,800,1200,q[0]/800,q[1]/1200);assert.ok(Math.abs(p[0]-pt[0])<1e-12);assert.ok(Math.abs(p[1]-pt[1])<1e-12);}}
});
test('partial hair confidence remains translucent and softening preserves opaque texture pixels',()=>{
 const mask=rectangle('hair',40,20,60,80);for(let y=20;y<80;y++)mask.data[y*100+39]=70;const b=recipe({mask}),out=render({...b,mode:'transparent'}),built=Core.buildMask(b,100,100);
 assert.ok(built.data[50*100+39]>35);assert.ok(pixel(out,39,50)[3]>20&&pixel(out,39,50)[3]<200);assert.deepEqual(pixel(out,50,50),[203,89,69,255]);assert.equal(pixel(out,10,10)[3],0);
});
test('choosing a scene object occludes only the chosen part of the subject and front mode restores it',()=>{
 const s=Scene.defaults(),mask=rectangle('table-edge',45,55,90,90),b=recipe({scene:{...s,depth:'behind',occlusion:mask}}),back=render(b),front=render({...b,scene:{...b.scene,depth:'front'}});
 assert.deepEqual(pixel(back,50,65),[250,250,250,255]);assert.deepEqual(pixel(back,50,35),[203,89,69,255]);assert.deepEqual(pixel(front,50,65),[203,89,69,255]);assert.deepEqual(pixel(back,20,20),pixel(front,20,20));assert.equal(mask.data[65*100+50],255);
});
test('saved objects toggle independently, remain selectable when disabled, and survive undo and drafts',()=>{
 const first=rectangle('upper',45,20,90,45),second=rectangle('lower',45,55,90,90),s={...Scene.defaults(),depth:'behind',regions:[{id:'one',mask:first,enabled:true},{id:'two',mask:second,enabled:true}]},before=structuredClone(s),off=Scene.toggleRegion(s,'one'),all=render(recipe({scene:s})),partial=render(recipe({scene:off}));
 assert.deepEqual(pixel(all,50,30),[250,250,250,255]);assert.deepEqual(pixel(partial,50,30),[203,89,69,255]);assert.deepEqual(pixel(partial,50,65),[250,250,250,255]);assert.equal(Scene.regionAt(off,.5,.3).id,'one');assert.deepEqual(s,before);assert.equal(off.regions[0].mask,first);
 const restored=Scene.toggleRegion(off,'one');assert.deepEqual(bytes(render(recipe({scene:restored}))),bytes(all));const t=new Timeline();t.reset({key:'on',scene:s});t.push({key:'off',scene:off});assert.equal(t.undo().scene.regions[0].enabled,true);assert.equal(t.redo().scene.regions[0].enabled,false);const draft=new Timeline();draft.restore(structuredClone(t.serialize()));assert.deepEqual(draft.current().scene.regions[0].mask.data,first.data);assert.ok(JSON.stringify(Scene.signature(s)).length<1500);
 const legacy=Scene.settings({...Scene.defaults(),occlusion:first});assert.equal(legacy.regions.length,1);assert.equal(Scene.settings(legacy).regions.length,1);assert.equal(legacy.regions[0].mask,first);
});
test('hiding a portrait hides its shadow and keeps original pixels for an exact restoration',()=>{
 const src=image('#cb5945'),original=bytes(src),s=Scene.defaults(),scene={...s,showGhost:true,subject:{...s.subject,x:.7},shadow:{...s.shadow,enabled:true,opacity:.7}},shown=render(recipe({scene}),src),hidden=render(recipe({scene:{...scene,subject:{...scene.subject,hidden:true}}}),src);
 assert.deepEqual(bytes(hidden),bytes(image('#fafafa')));assert.deepEqual(bytes(render(recipe({scene:{...scene,showGhost:false}}),src)),bytes(shown),'guide visibility never changes exported pixels');assert.deepEqual(bytes(src),original);assert.deepEqual(bytes(render(recipe({scene}),src)),bytes(shown));
 const png=render(recipe({mode:'transparent',scene:{...scene,subject:{...scene.subject,hidden:true}}}),src);assert.ok(bytes(png).every(v=>v===0));
});
test('the hidden-person guide contains only the silhouette edge and retains the original alpha mask',()=>{
 const mask=rectangle('person',40,20,60,80),before=mask.data.slice(),edge=Scene.contour(mask);assert.equal(edge.data[50*100+50],0);assert.equal(edge.data[20*100+45],170);assert.equal(edge.data[10*100+10],0);assert.deepEqual(mask.data,before);assert.equal(edge.data.length,mask.data.length);
});
test('manual erasing can reveal part of an AI-selected object, and restoring paint is local',()=>{
 const mask=rectangle('object',0,0,100,100),erase={mode:'erase',size:.2,softness:0,points:[[.5,.5]]},s={...Scene.defaults(),occlusion:mask,occlusionStrokes:[erase]},a=Scene.occlusionMask(s,100,100),b=Scene.occlusionMask({...s,occlusionStrokes:[erase,{...erase,mode:'paint',size:.08}]},100,100);
 assert.equal(a.data[50*100+50],0);assert.equal(a.data[10*100+10],255);assert.equal(b.data[50*100+50],255);assert.equal(a.data[50*100+57],0);assert.equal(b.data[50*100+57],0);assert.equal(mask.data[50*100+50],255);
});
test('AI selection keeps the connected object under the tap and rejects empty or whole-image answers',()=>{
 const raw=rectangle('two-objects',2,3,8,17,20,20);for(let y=3;y<17;y++)for(let x=13;x<18;x++)raw.data[y*20+x]=255;
 const result=Scene.selectionMask(raw,{x:.2,y:.5},'picked');assert.equal(result.data[10*20+4],255);assert.equal(result.data[10*20+15],0);assert.equal(raw.data[10*20+15],255);
 const floats={width:20,height:20,data:Float32Array.from(raw.data,v=>v/255)};assert.deepEqual(Scene.selectionMask(floats,{x:.2,y:.5},'floats').data,result.data);
 assert.throws(()=>Scene.selectionMask({width:20,height:20,data:new Float32Array(400)},{x:.5,y:.5},'none'));assert.throws(()=>Scene.selectionMask({width:20,height:20,data:new Float32Array(400).fill(1)},{x:.5,y:.5},'all'));
});
test('object masks stay attached to the background image through pan and zoom',()=>{
 const b=recipe({zoom:2,x:.75,y:.25}),image={width:200,height:100},r=Scene.cover(100,100,200,100,b.zoom,b.x,b.y),native=[.6,.7],out=[(r.x+native[0]*r.width)/100,(r.y+native[1]*r.height)/100];
 const p=Scene.scenePoint(b,image,100,100,...out);assert.ok(Math.abs(p[0]-.6)<1e-12);assert.ok(Math.abs(p[1]-.7)<1e-12);
});
test('ground contact follows the feet while transparent exports never contain a cast shadow',()=>{
 const s=Scene.defaults(),b=recipe({scene:{...s,shadow:{...s.shadow,enabled:true,opacity:.65,length:.45,contact:1}}}),out=render(b),without=render({...b,scene:{...b.scene,shadow:{...b.scene.shadow,enabled:false}}});
 assert.ok(pixel(out,50,81)[0]<pixel(without,50,81)[0]);assert.deepEqual(pixel(out,0,0),pixel(without,0,0));
 const moved=render({...b,scene:{...b.scene,subject:{...s.subject,x:.75}}});assert.ok(pixel(moved,75,81)[0]<250);assert.deepEqual(pixel(moved,50,81),[250,250,250,255]);
 const a=render({...b,mode:'transparent'}),z=render({...b,mode:'transparent',scene:{...b.scene,shadow:{...b.scene.shadow,enabled:false}}});assert.deepEqual(bytes(a),bytes(z));
});
test('shadow softness is baked into alpha without depending on canvas filter support',()=>{
 const data=new Uint8Array(21*21);data[10*21+10]=255;const a=Scene.blurAlpha(data,21,21,1),b=Scene.blurAlpha(data,21,21,3);assert.ok(a[10*21+10]>b[10*21+10]);assert.ok(b[10*21+14]>a[10*21+14]);assert.equal(data[10*21+10],255);
});
test('subject light corrections change no background pixels and never mutate the source',()=>{
 const s=Scene.defaults(),src=image('#cb5945'),original=bytes(src),a=render(recipe(),src),b=render(recipe({scene:{...s,exposure:-.4,warmth:.3,match:.3}}),src);
 assert.notDeepEqual(pixel(a,50,40),pixel(b,50,40));assert.deepEqual(pixel(a,10,10),pixel(b,10,10));assert.deepEqual(bytes(src),original);
});
test('placement reuses a prepared cutout and retouch runs exactly once until beauty settings change',()=>{
 Scene.clear();const src=image('#cb5945'),b=recipe(),mask=Core.maskCanvas(Core.buildMask(b,100,100),make),background=image('#fafafa'),tag={key:'hair-one',maps:{},faces:[]};let count=0;const retouch=()=>count++;
 Core.prepareSource(src,b,mask,background,make,retouch,tag);const moved={...b,scene:{...b.scene,subject:{...b.scene.subject,x:.7}}};Core.prepareSource(src,moved,mask,background,make,retouch,tag);assert.equal(count,1);
 Core.prepareSource(src,moved,mask,background,make,retouch,{...tag,key:'hair-two'});assert.equal(count,2);Scene.clear();
});
test('draft and undo retain placement, occlusion bytes, lighting and shadow without serializing masks into render keys',()=>{
 const first=Core.defaults(),second={...first,background:recipe({scene:{...Scene.defaults(),depth:'behind',occlusion:rectangle('occlusion',0,60,100,100),subject:{...Scene.defaults().subject,x:.7,scale:.6},exposure:-.2,shadow:{...Scene.defaults().shadow,enabled:true}}})},t=new Timeline();t.reset({key:Core.signature(first),compose:first});t.push({key:Core.signature(second),compose:second});assert.equal(t.undo().compose.background.enabled,false);assert.equal(t.redo().compose.background.scene.subject.x,.7);
 const replay=new Timeline();replay.restore(structuredClone(t.serialize()));assert.deepEqual(replay.current().compose,second);assert.ok(Core.signature(second).length<1800);assert.notEqual(Core.signature(second),Core.signature({...second,background:{...second.background,scene:{...second.background.scene,occlusion:{...second.background.scene.occlusion,id:'new'}}}}));
});
test('quarter turns, flips and crop conjugate the placement transform and keep identity placement unchanged',()=>{
 for(const kind of ['right','left','flipX','flipY','crop']){const op=Photo.operation(800,600,kind,{x:.2,y:.1,width:.6,height:.7}),identity=Scene.remapSubject(Scene.defaults().subject,800,600,op);assert.ok(Math.abs(identity.x-.5)<1e-12);assert.ok(Math.abs(identity.y-.5)<1e-12);assert.ok(Math.abs(identity.scale-1)<1e-12);
  const s={...Scene.defaults().subject,x:.65,y:.4,scale:.7,angle:18},remapped=Scene.remapSubject(s,800,600,op),a=Scene.multiply(Scene.matrix(remapped,op.width,op.height),op.matrix),b=Scene.multiply(op.matrix,Scene.matrix(s,800,600));for(let i=0;i<6;i++)assert.ok(Math.abs(a[i]-b[i])<1e-8);
 }
});
