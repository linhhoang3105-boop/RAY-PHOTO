const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createCanvas}=require('@napi-rs/canvas');
const Layers=require('../dist/darkroom/effect-layers.js'),{Timeline}=require('../dist/darkroom/edit-history.js');
function harness(){
 const script=fs.readFileSync(path.join(__dirname,'../source/buong-toi-original.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split('/* ============ nối dây giao diện ============ */')[0];
 const context={console,document:{createElement:()=>createCanvas(1,1)},view:{},retouch:false,retouchCount:0,beautyApply(c){if(context.retouch){context.retouchCount++;c.fillStyle='#343a41';c.fillRect(0,0,4,4);}}};context.window=context;vm.createContext(context);vm.runInContext(script+'\nthis.engine={P,F,NK,LK,render};',context);
 const e=context.engine,defaults={...e.P};
 const state=(p={})=>({p:{...defaults,stamp:false,frame:'none',...p},focus:{...e.F},sun:{x:.5,y:.04},leak:{x:0,y:0}});
 const pass=(target,src,s,retouch,decorate)=>{Object.assign(e.P,s.p,{...(!decorate?{frame:'none',stamp:false}:{})});Object.assign(e.F,s.focus);Object.assign(e.NK,s.sun);Object.assign(e.LK,s.leak);context.retouch=retouch;e.render(target,src);};
 const source=createCanvas(240,180),c=source.getContext('2d'),g=c.createLinearGradient(0,0,240,180);g.addColorStop(0,'#28516a');g.addColorStop(1,'#c19d75');c.fillStyle=g;c.fillRect(0,0,240,180);
 return{source,state,pass,context};
}
const pixels=c=>Buffer.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data);
test('a saved film plus a circular sun and a colored strip remain in the final pixels',()=>{
 const h=harness(),a=h.state({temp:.25,contrast:.2,sat:-.08}),b=h.state({nang:.35,nangManual:true}),d=h.state({leak:.22,leakManual:true,leakShape:'patch',leakAngle:32,leakHue:-35});b.sun={x:.8,y:.12};d.leak={x:.2,y:.3};
 const film=Layers.renderApplied(h.source,[a],h.pass,()=>createCanvas(1,1)),withSun=Layers.renderApplied(h.source,[a,b],h.pass,()=>createCanvas(1,1)),stack=Layers.renderApplied(h.source,[a,b,d],h.pass,()=>createCanvas(1,1));
 assert.notDeepEqual(pixels(film),pixels(withSun));assert.notDeepEqual(pixels(withSun),pixels(stack));
 const expected=createCanvas(1,1);h.pass(expected,withSun,d,false,false);assert.deepEqual(pixels(stack),pixels(expected));
});
test('applied layers keep image dimensions and run makeup/body input once, with a single final border',()=>{
 const h=harness(),a=h.state({temp:.2,frame:'polaroid',stamp:true,dateText:'2026 10 26'}),b=h.state({leak:.1,frame:'film'});h.context.retouchCount=0;
 const base=Layers.renderApplied(h.source,[a,b],h.pass,()=>createCanvas(1,1));assert.equal(h.context.retouchCount,1);assert.equal(base.width,240);assert.equal(base.height,180);
 const output=createCanvas(1,1);h.pass(output,base,h.state({frame:'film'}),false,true);assert.equal(h.context.retouchCount,1);assert.equal(output.width,256);assert.equal(output.height,196);
});
test('undo, redo and draft serialization preserve both applied effect recipes and their pixels',()=>{
 const h=harness(),t=new Timeline(),a=h.state({nang:.2}),b=h.state({leak:.3,leakManual:true,leakShape:'patch',leakAngle:45});b.leak={x:.7,y:.4};
 const snap=layers=>({key:JSON.stringify(layers),layers});t.reset(snap([]));t.push(snap([a]));t.push(snap([a,b]));assert.equal(t.undo().layers.length,1);assert.equal(t.redo().layers.length,2);
 const restored=new Timeline();restored.restore(structuredClone(t.serialize()));const first=Layers.renderApplied(h.source,t.current().layers,h.pass,()=>createCanvas(1,1)),second=Layers.renderApplied(h.source,restored.current().layers,h.pass,()=>createCanvas(1,1));assert.deepEqual(pixels(first),pixels(second));
 const p=Layers.cleared({...a.p,frame:'polaroid',stamp:true,nangSize:.8,leakHue:-30});assert.equal(Layers.active(p),false);assert.equal(p.nangSize,.8);assert.equal(p.leakHue,-30);assert.equal(p.frame,'polaroid');assert.equal(p.stamp,true);
});
test('applying a layer replaces its preview history point, so undo does not waste a step on identical pixels',()=>{
 const t=new Timeline();t.reset({key:'original',layers:[]});t.push({key:'preview',layers:[],strength:.3});t.replaceCurrent({key:'applied',layers:[{strength:.3}]});assert.equal(t.entries.length,2);assert.equal(t.undo().key,'original');assert.equal(t.redo().key,'applied');t.undo();t.replaceCurrent({key:'branch',layers:[]});assert.equal(t.canRedo,false);
});
test('hiding B and D then adding E renders exactly A+C+E, and reopening preserves the same editable pixels',()=>{
 const h=harness(),A={...h.state({temp:.2}),title:'A'},B={...h.state({contrast:.3}),title:'B'},C={...h.state({sat:.2}),title:'C'},D={...h.state({grain:.3}),title:'D'},E={...h.state({nang:.2}),title:'E'};
 const all=[A,B,C,D],edited=[A,{...B,enabled:false},C,{...D,enabled:false},E],expected=Layers.renderApplied(h.source,[A,C,E],h.pass,()=>createCanvas(1,1)),actual=Layers.renderApplied(h.source,structuredClone(edited),h.pass,()=>createCanvas(1,1));assert.deepEqual(pixels(actual),pixels(expected));
 const t=new Timeline();t.reset({key:'all',layers:all});t.push({key:'edited',layers:edited});assert.equal(t.undo().layers.length,4);const restored=new Timeline();restored.restore(structuredClone(t.serialize()));const redone=restored.redo();assert.equal(redone.layers[1].enabled,false);const output=Layers.renderApplied(h.source,redone.layers,h.pass,()=>createCanvas(1,1));assert.deepEqual(pixels(output),pixels(expected));
});
test('preview layer reuse skips old work while an export still independently renders identical pixels',()=>{
 const h=harness(),element=()=>({hidden:false,textContent:'',className:'',classList:{toggle(){}},setAttribute(){},replaceChildren(){},append(){},before(){}});
 h.context.document={createElement:tag=>tag==='canvas'?createCanvas(1,1):element(),querySelector:()=>element(),querySelectorAll:()=>[],getElementById:()=>element()};
 h.context.BODY={parts:[],peek:false};h.context.BEAUTY={peek:false,maps:null,faces:[],values:{},people:[],ready:{}};h.context.syncControls=()=>{};h.context.queue=()=>{};
 const original=h.context.render;let passes=0;h.context.render=(...args)=>{passes++;return original(...args);};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/darkroom/effect-layers.js'),'utf8'),h.context);
 const api=h.context.RayLayers;api.restore([h.state({temp:.12}),h.state({contrast:.16})]);Object.assign(h.context.engine.P,api.cleared(h.state().p));
 const first=createCanvas(1,1),second=createCanvas(1,1),exported=createCanvas(1,1);api.preview(()=>h.context.render(first,h.source));assert.equal(passes,3);
 api.preview(()=>h.context.render(second,h.source));assert.equal(passes,4);assert.deepEqual(pixels(first),pixels(second));
 h.context.render(exported,h.source);assert.equal(passes,7,'export must render every kept layer from its source');assert.deepEqual(pixels(first),pixels(exported));
 vm.runInContext("BODY.parts=[{id:'waist',cx:.5,cy:.5,rx:.1,ry:.15,rot:0,size:0,wid:-.1,len:0,push:0,dir:0,soft:.5}]",h.context);api.preview(()=>h.context.render(second,h.source));assert.equal(passes,10,'changed body edits invalidate the preview base');
 let contour=null;h.context.RayBodyContour={capture:()=>contour};api.preview(()=>h.context.render(second,h.source));assert.equal(passes,13);
 contour={version:1,people:[{id:'body-person-1',strokes:[{mode:'pull',effect:'reshape',size:.14,points:[[.7,.5],[.65,.5]]}]}]};api.preview(()=>h.context.render(second,h.source));assert.equal(passes,16,'a changed gold contour must invalidate the already-applied preset pixels');
 api.invalidate();assert.deepEqual([h.source.width,h.source.height],[240,180]);
});
test('preview cache releases evicted canvases and never reuses a changed source or mask',()=>{
 const cache=Layers.previewCache(300),src={width:10,height:10},mask={},a={width:10,height:10},b={width:10,height:10};
 assert.equal(cache.put(src,'a',a,[mask]),true);assert.equal(cache.get(src,'a',[mask]),a);assert.equal(cache.get(src,'a',[{}]),null);src.width=11;assert.equal(cache.get(src,'a',[mask]),null);
 assert.equal(cache.put(src,'b',b),true);assert.equal(a.width,0);for(let i=0;i<4;i++)cache.put({width:10,height:10},String(i),{width:10,height:10});assert.equal(b.width,0);
 const huge={width:20,height:20};assert.equal(cache.put(src,'huge',huge),false);assert.equal(huge.width,20);cache.clear();
});
test('changing saved values updates the same layer pixels and undo restores the old color',()=>{
 const h=harness(),a={...h.state({temp:.12}),id:'a',enabled:true},b={...h.state({grain:.08}),id:'b',enabled:true},all=[a,b],t=new Timeline();
 const before=Layers.renderApplied(h.source,all,h.pass,()=>createCanvas(1,1)),next=Layers.withValues(all,'a',{temp:-.4,contrast:.35}),after=Layers.renderApplied(h.source,next,h.pass,()=>createCanvas(1,1));
 assert.notDeepEqual(pixels(before),pixels(after));assert.equal(next[0].id,a.id);assert.equal(next[1],b);assert.deepEqual([after.width,after.height],[h.source.width,h.source.height]);
 t.reset({key:'before',layers:all});t.push({key:'after',layers:next});const undone=Layers.renderApplied(h.source,t.undo().layers,h.pass,()=>createCanvas(1,1));assert.deepEqual(pixels(undone),pixels(before));const restored=Layers.renderApplied(h.source,t.redo().layers,h.pass,()=>createCanvas(1,1));assert.deepEqual(pixels(restored),pixels(after));
});
