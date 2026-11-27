const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createCanvas,DOMMatrix}=require('@napi-rs/canvas');
const Scope=require('../dist/darkroom/adjust-scope-core.js'),Layers=require('../dist/darkroom/effect-layers.js'),Photo=require('../dist/darkroom/photo-edit-core.js'),{Timeline}=require('../dist/darkroom/edit-history.js');
const make=()=>createCanvas(1,1),pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
function harness(){
 const script=fs.readFileSync(path.join(__dirname,'../dist/darkroom/index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split('/* ============ nối dây giao diện ============ */')[0];
 const h={DOMMatrix,document:{createElement:make,body:{classList:{contains:()=>false}}},view:{},beautyApply(){},BEAUTY:{peek:false,values:{},people:[],ready:{},maps:null,faces:[]}};h.window=h;vm.createContext(h);vm.runInContext(script,h);vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/darkroom/tone-core.js'),'utf8'),h);vm.runInContext('this.e={P,F,NK,LK,render};',h);
 const e=h.e,defaults={...e.P,...Scope.defaults,stamp:false,frame:'none',adjustRegionShape:'rect',adjustRegionFeather:0,adjustRegionRX:.25,adjustRegionRY:.3};
 function draw(src,changes={},scoped=true){Object.assign(e.P,defaults,changes);const out=make();if(scoped)Scope.renderScoped(out,src,e.P,e.render,make);else e.render(out,src);return out;}
 return{h,e,defaults,draw};
}
function scene(W=100,H=80){const c=createCanvas(W,H),x=c.getContext('2d'),g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,'#335780');g.addColorStop(1,'#cdad85');x.fillStyle=g;x.fillRect(0,0,W,H);return c;}
test('whole-photo mode follows the exact legacy path and does not allocate any mask or baseline',()=>{
 const h=harness(),src=scene(),p={temp:.3,toneExposure:.4,grain:.2,adjustRegion:'all'},expected=h.draw(src,p,false),actual=h.draw(src,p);assert.deepEqual(pixels(actual),pixels(expected));let allocations=0,calls=0;Scope.renderScoped(make(),src,p,()=>calls++,()=>{allocations++;return make();});assert.equal(calls,1);assert.equal(allocations,0);
});
test('inside/outside covers every basic, color, optical, film and local-light parameter independently',()=>{
 const h=harness(),src=scene(),base=pixels(h.draw(src,{}));
 for(const key of Scope.effects){const p={...h.defaults,[key]:key==='toneExposure'||key==='toneLocalEV'?1:.6},full=pixels(h.draw(src,p,false));for(const mode of ['in','out']){const actual=pixels(h.draw(src,{...p,adjustRegion:mode})),at=Scope.weight({...p,adjustRegion:mode},100,80);for(let y=0;y<80;y++)for(let x=0;x<100;x++){const i=(y*100+x)*4,w=at(x,y),expected=w===0?base:full;assert.deepEqual(actual.subarray(i,i+4),expected.subarray(i,i+4),key+' '+mode+' '+x+','+y);}}}
});
test('soft region mixing preserves alpha with premultiplied colors and has complementary coverage',()=>{
 const before=new Uint8ClampedArray([20,80,140,100,10,40,70,0]),after=new Uint8ClampedArray([220,180,60,100,100,200,240,0]);Scope.blendPixels(before,after,2,1,()=>.5);assert.deepEqual(Array.from(after),[120,130,100,100,10,40,70,0]);
 for(const shape of ['ellipse','rect','beam','curve','line'])for(const [x,y]of [[50,40],[30,25],[1,2]]){const p={...Scope.defaults,adjustRegion:'in',adjustRegionShape:shape,adjustRegionAngle:27},a=Scope.weight(p,100,80),b=Scope.weight({...p,adjustRegion:'out'},100,80);assert.ok(Math.abs(a(x,y)+b(x,y)-1)<1e-12);const big=Scope.weight(p,400,320);assert.ok(Math.abs(a(x,y)-big(x*4+1.5,y*4+1.5))<1e-12);}
});
test('borders keep their exact pixels and photograph dimensions during regional color edits',()=>{
 const h=harness(),src=scene(160,120),p={temp:.7,sat:.5,frame:'polaroid',adjustRegion:'in'},out=h.draw(src,p),all=h.draw(src,{...p,adjustRegion:'all'}),a=pixels(out),b=pixels(all),bw=Math.round(160*.055);assert.deepEqual([out.width,out.height],[all.width,all.height]);for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++)if(x<bw||x>=bw+160||y<bw||y>=bw+120){const i=(y*out.width+x)*4;assert.deepEqual(a.subarray(i,i+4),b.subarray(i,i+4));}
});
test('each applied layer retains its region through apply, undo, saved draft and a new layer',()=>{
 const h=harness(),src=scene(),state=p=>({p:{...h.defaults,...p},focus:{...h.e.F},sun:{...h.e.NK},leak:{...h.e.LK}}),a=state({temp:.7,adjustRegion:'in'}),b=state({temp:-.7,adjustRegion:'out',adjustRegionX:.7}),pass=(out,input,s)=>{Object.assign(h.e.P,h.defaults,s.p);Scope.renderScoped(out,input,h.e.P,h.e.render,make);};
 const expected=Layers.renderApplied(src,[a,b],pass,make),timeline=new Timeline();timeline.reset({key:'a',layers:[a]});timeline.push({key:'ab',layers:[a,b]});assert.equal(timeline.undo().layers.length,1);const saved=new Timeline();saved.restore(structuredClone(timeline.serialize()));const replay=Layers.renderApplied(src,saved.redo().layers,pass,make);assert.deepEqual(pixels(replay),pixels(expected));const clean=Layers.cleared(a.p);assert.equal(clean.adjustRegion,'all');assert.equal(a.p.adjustRegion,'in');
});
test('scope coordinates and coverage follow rotate, mirror and crop for live and applied layers',()=>{
 const W=200,H=300,p={...Scope.defaults,adjustRegion:'in',adjustRegionShape:'curve',adjustRegionX:.45,adjustRegionY:.5,adjustRegionAngle:27},snap={p,focus:{cx:.5,cy:.5,rx:.3,ry:.3},sun:{x:.5,y:.1},leak:{x:.2,y:.1},body:[],layers:[{p,focus:{cx:.5,cy:.5,rx:.3,ry:.3},sun:{x:.5,y:.1},leak:{x:.2,y:.1}}]};
 for(const kind of ['right','flipX','flipY','crop']){const op=Photo.operation(W,H,kind,{x:.1,y:.1,width:.8,height:.8}),next=Photo.remap(snap,W,H,op),before=Scope.weight(p,W,H),after=Scope.weight(next.p,op.width,op.height);assert.deepEqual(next.p,next.layers[0].p);for(let y=35;y<240;y+=13)for(let x=30;x<170;x+=13){const q=Photo.point(op.matrix,x+.5,y+.5);if(q.x>=0&&q.y>=0&&q.x<op.width&&q.y<op.height)assert.ok(Math.abs(before(x,y)-after(q.x-.5,q.y-.5))<1e-10,kind);}}
});
test('portable color recipes preserve regional settings without private pixels and reject malformed geometry',async()=>{
 const Rules=await import('../dist/darkroom/preset-rules.mjs'),p={...Scope.defaults,temp:.3,adjustRegion:'out',adjustRegionShape:'beam',adjustRegionAngle:-29},recipe=Rules.capture({p,layers:[]},'Màu trong vùng');assert.equal(recipe.layers[0].adjustRegion,'out');assert.equal(recipe.layers[0].adjustRegionShape,'beam');assert.equal(recipe.layers[0].adjustRegionAngle,-29);assert.deepEqual(Rules.validate(JSON.parse(JSON.stringify(recipe))),recipe);
 assert.equal('adjustRegionShow'in recipe.layers[0],false);const old=Rules.capture({p:{temp:.3},layers:[]},'Màu cũ');assert.equal(Object.keys(old.layers[0]).some(k=>k.startsWith('adjustRegion')),false);assert.throws(()=>Rules.validate({...recipe,layers:[{...recipe.layers[0],adjustRegionShape:'injected'}]}));assert.throws(()=>Rules.validate({...recipe,layers:[{...recipe.layers[0],adjustRegionRX:Infinity}]}));
});
test('preview caches only the neutral baseline; changing a slider reuses it, exports remain independent',()=>{
 const h=harness(),src=scene(),target=make();h.h.view=target;let passes=0;const original=h.h.render;h.h.render=(...a)=>{passes++;return original(...a);};vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/darkroom/adjust-scope-core.js'),'utf8'),h.h);
 Object.assign(h.e.P,h.defaults,{temp:.4,adjustRegion:'in'});h.h.render(target,src);assert.equal(passes,2);h.e.P.temp=.7;h.h.render(target,src);assert.equal(passes,3);const expected=make();h.h.render(expected,src);assert.equal(passes,5,'an export must not reuse the preview baseline');assert.deepEqual(pixels(target),pixels(expected));
 h.h.RayAdjustScope.invalidate();h.h.render(target,src);assert.equal(passes,7);h.e.P.adjustRegion='all';h.h.render(target,src);assert.equal(passes,8);
});
test('failed regional renders restore parameters and release temporary full-resolution canvases',()=>{
 const src=scene(),p={...Scope.defaults,temp:.5,adjustRegion:'in'},saved={...p},allocated=[];let calls=0;
 assert.throws(()=>Scope.renderScoped(make(),src,p,()=>{if(++calls===2)throw new Error('memory');},()=>{const c=make();c.width=1600;c.height=1200;allocated.push(c);return c;}),/memory/);assert.deepEqual(p,saved);assert.ok(allocated.every(c=>c.width*c.height<1e6));
});
test('a freehand selection gates every existing color, basic, film and optical control in previews and exports',()=>{
 const h=harness(),src=scene(),base=pixels(h.draw(src,{})),strokes=[{mode:'lasso',size:.1,points:[[.25,.25],[.75,.25],[.75,.75],[.25,.75]]},{mode:'erase',size:.12,points:[[.5,.5]]}];
 for(const key of Scope.effects){const p={...h.defaults,[key]:.6,adjustRegionShape:'freehand',adjustRegionStrokes:strokes},full=pixels(h.draw(src,p,false));for(const mode of ['in','out']){const actual=pixels(h.draw(src,{...p,adjustRegion:mode})),at=Scope.weight({...p,adjustRegion:mode},100,80);for(let y=0;y<80;y++)for(let x=0;x<100;x++){const i=(y*100+x)*4,w=at(x,y);if(w===0||w===1)assert.deepEqual(actual.subarray(i,i+4),(w===0?base:full).subarray(i,i+4),key+' '+mode);}}}
});

test('shared local light uses a single complementary mask, retaining solid and outline without squared feather',()=>{
 const h=harness(),src=scene(),base=pixels(h.draw(src,{}));
 for(const fill of ['solid','outline'])for(const shape of ['ellipse','rect','beam','curve','line']){
  const p={toneLocalEV:1,toneLocalBrightness:.12,toneLocalWarmth:.2,toneLocalMode:'all',toneLocalFill:fill,toneLocalShape:shape,adjustRegionShape:shape,adjustRegionFeather:.35,adjustRegionThickness:.08},full=pixels(h.draw(src,p,false)),inside=pixels(h.draw(src,{...p,adjustRegion:'in'})),outside=pixels(h.draw(src,{...p,adjustRegion:'out'}));
  let changed=0,soft=0;const at=Scope.weight({...h.defaults,...p,adjustRegion:'in'},100,80);
  for(let y=0;y<80;y++)for(let x=0;x<100;x++){const i=(y*100+x)*4,w=at(x,y);if(w>0&&w<1)soft++;for(let c=0;c<3;c++){assert.ok(Math.abs(inside[i+c]+outside[i+c]-base[i+c]-full[i+c])<=2,shape+' '+fill);assert.ok(Math.abs(inside[i+c]-(base[i+c]*(1-w)+full[i+c]*w))<=1);if(inside[i+c]!==base[i+c])changed++;}}
  assert.ok(changed>0);assert.ok(soft>0);
 }
});
test('shared local light works in drawn inside/outside regions and survives applied draft replay',()=>{
 const h=harness(),src=scene(),p={toneLocalEV:.8,toneLocalMode:'all',adjustRegion:'out',adjustRegionShape:'freehand',adjustRegionStrokes:[{mode:'lasso',open:false,points:[[.2,.2],[.8,.2],[.8,.8],[.2,.8]]}],adjustRegionFeather:0},expected=h.draw(src,p),base=h.draw(src,{}),a=pixels(expected),b=pixels(base);assert.deepEqual(a.subarray((40*100+50)*4,(40*100+50)*4+4),b.subarray((40*100+50)*4,(40*100+50)*4+4));assert.notDeepEqual(a.subarray(0,4),b.subarray(0,4));
 const snapshot=structuredClone({p:{...h.defaults,...p},focus:{...h.e.F},sun:{...h.e.NK},leak:{...h.e.LK}}),replay=Layers.renderApplied(src,[snapshot],(out,input,s)=>{Object.assign(h.e.P,h.defaults,s.p);Scope.renderScoped(out,input,h.e.P,h.e.render,make);},make);assert.deepEqual(pixels(replay),a);
});
