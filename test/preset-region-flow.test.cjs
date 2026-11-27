const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createCanvas,DOMMatrix}=require('@napi-rs/canvas');
const Scope=require('../dist/darkroom/adjust-scope-core.js'),Photo=require('../dist/darkroom/photo-edit-core.js');
const clone=x=>JSON.parse(JSON.stringify(x)),pixels=c=>Buffer.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data);
async function setup({filmAdapters=false}={}){
 const Rules=await import('../dist/darkroom/preset-rules.mjs'),html=fs.readFileSync(path.join(__dirname,'../dist/darkroom/index.html'),'utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1].split('/* ============ nối dây giao diện ============ */')[0];
 const node=()=>({hidden:false,textContent:'',classList:{toggle(){},remove(){},add(){},contains(){return false;}},setAttribute(){},replaceChildren(){},append(){},before(){}}),nodes=new Map(),make=()=>createCanvas(1,1);
 const document={createElement:tag=>tag==='canvas'?make():node(),querySelector:()=>node(),querySelectorAll:()=>[],getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},body:node()};
 const source=createCanvas(100,80),c=source.getContext('2d'),g=c.createLinearGradient(0,0,100,80);g.addColorStop(0,'#355980');g.addColorStop(1,'#c99d75');c.fillStyle=g;c.fillRect(0,0,100,80);
 let next=0;const h={DOMMatrix,document,source,view:{},BEAUTY:{peek:false,values:{},people:[],ready:{},maps:null,faces:[]},BODY_AI:{busy:false},beautyApply(){},syncControls(){},queue(){},queueMicrotask:f=>f(),uid:()=>String(++next),Rules:{...Rules,validate:r=>Rules.validate(clone(r))},trialBar:node(),trialName:node(),cancelPreview(){},keepTrial(){},$:id=>document.getElementById(id)};h.window=h;vm.createContext(h);vm.runInContext(script,h);
 for(const file of ['tone-core.js',...(filmAdapters?['ray-preset-thu-nhat.js','thu-nhat-adapter.js']:[]),'region-paint-core.js','adjust-scope-core.js','effect-layers.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/darkroom',file),'utf8'),h);
 vm.runInContext('this.state={P,F,NK,LK};',h);const p=h.state.P;Object.assign(p,h.RayLayers.cleared(p),{stamp:false,frame:'none',adjustRegionShape:'rect',adjustRegionX:.5,adjustRegionY:.5,adjustRegionRX:.22,adjustRegionRY:.22,adjustRegionFeather:0,adjustRegionPlaced:true});
 const snapshot=()=>({p:clone(p),focus:clone(h.state.F),sun:clone(h.state.NK),leak:clone(h.state.LK),layers:clone(h.RayLayers.capture())}),session={record(){},snapshot};h.session=()=>session;h.RaySession=session;
 const my=fs.readFileSync(path.join(__dirname,'../dist/darkroom/my-presets.mjs'),'utf8');vm.runInContext(my.slice(my.indexOf('function applyRecipe('),my.indexOf('\nconst trialBar=')),h);
 const draw=()=>{const out=make();h.render(out,source);return pixels(out);},setScope=mode=>{p.adjustRegion=mode;h.RayLayers.updateScope();};
 return{h,p,Rules,source,draw,setScope,snapshot,apply:r=>h.applyRecipe(r)};
}
const recipe={version:1,name:'Màu tự lưu',layers:[{temp:.5,contrast:.15},{sat:-.85,grain:.1}]};
function protectedPixels(actual,before,at,expected){for(let y=0;y<80;y++)for(let x=0;x<100;x++){const w=at(x,y),i=(y*100+x)*4;if(w===0)assert.deepEqual(actual.subarray(i,i+4),before.subarray(i,i+4));else if(w===1&&expected)assert.deepEqual(actual.subarray(i,i+4),expected.subarray(i,i+4));}}
test('saved multi-layer preset can change All → Inside → Outside after selection, move its region and Apply without an empty duplicate',async()=>{
 const s=await setup(),before=s.draw();s.apply(recipe);const full=s.draw(),original=s.snapshot();assert.notDeepEqual(full,before);assert.equal(s.p.adjustRegionTargets.length,2);
 for(const mode of ['in','out']){s.setScope(mode);protectedPixels(s.draw(),before,Scope.weight(s.p,100,80),full);}
 s.p.adjustRegionX=.25;s.h.RayLayers.updateScope();protectedPixels(s.draw(),before,Scope.weight(s.p,100,80),full);assert.equal(original.layers[0].p.adjustRegionStack.at(-1).adjustRegion,'all');
 s.setScope('all');assert.deepEqual(s.draw(),full);s.setScope('in');const applied=s.draw();assert.equal(s.h.RayLayers.commit('Màu tự lưu'),true);assert.equal(s.h.RayLayers.count,2);assert.equal(s.p.adjustRegionTargets.length,0);assert.equal(s.p.adjustRegion,'all');assert.deepEqual(s.draw(),applied);
 s.setScope('out');assert.deepEqual(s.draw(),applied,'the next empty step must not alter a completed recipe');
});
test('choosing the region before a saved preset equals choosing it after, and a reopened pending draft stays editable',async()=>{
 const a=await setup(),b=await setup();a.setScope('in');a.apply(recipe);b.apply(recipe);b.setScope('in');assert.deepEqual(a.draw(),b.draw());
 const draft=b.snapshot();b.h.RayLayers.restore(clone(draft.layers));Object.assign(b.p,clone(draft.p));b.setScope('out');const c=await setup();c.setScope('out');c.apply(recipe);assert.deepEqual(b.draw(),c.draw());
 b.h.RayLayers.releaseScope();const kept=b.draw();b.setScope('in');assert.deepEqual(b.draw(),kept,'selecting another built-in preset releases the old recipe target');
});
test('outer preset coverage preserves the recipe’s own regions and survives reusable formula capture and reload',async()=>{
 const s=await setup(),before=s.draw(),inner={...Scope.settings(s.p),adjustRegion:'in',adjustRegionX:.38,adjustRegionRX:.3};s.apply({...recipe,layers:[{temp:.7,...inner}]});s.p.adjustRegionX=.62;s.setScope('in');
 const expected=s.draw(),p=s.h.RayLayers.capture()[0].p,at=Scope.weight(p,100,80);assert.equal(p.adjustRegionX,.38);assert.equal(p.adjustRegionStack.at(-1).adjustRegionX,.62);protectedPixels(expected,before,at);assert.notDeepEqual(expected,before);
 const reusable=s.Rules.capture(s.snapshot(),'Vùng giữ lại'),copy=await setup();copy.apply(clone(reusable));assert.deepEqual(copy.draw(),expected);assert.equal(reusable.layers[0].adjustRegionStack.length,1);assert.equal('adjustRegionTargets'in reusable.layers[0],false);
 s.setScope('all');const original=await setup();original.apply({...recipe,layers:[{temp:.7,...inner}]});assert.deepEqual(s.draw(),original.draw(),'All removes only the new clipping region, preserving the saved recipe');
});
test('nested reusable masks follow crop, turn and flip and reject private or malformed nested payloads',async()=>{
 const s=await setup();s.apply(recipe);s.setScope('out');const snap=s.snapshot(),p=snap.layers[0].p;
 for(const kind of ['right','flipX','flipY','crop']){const op=Photo.operation(100,80,kind,{x:.1,y:.1,width:.8,height:.8}),next=Photo.remap(snap,100,80,op),a=Scope.weight(p,100,80),b=Scope.weight(next.layers[0].p,op.width,op.height);for(let y=12;y<68;y+=7)for(let x=12;x<88;x+=7){const q=Photo.point(op.matrix,x+.5,y+.5);assert.ok(Math.abs(a(x,y)-b(q.x-.5,q.y-.5))<1e-10);}s.Rules.capture(next,'Sau cắt xoay');}
 for(const mask of [{photo:'private'},{adjustRegion:'forged'},{adjustRegionX:Infinity},{adjustRegionStack:[]}])assert.throws(()=>s.Rules.validate({...recipe,layers:[{temp:.3,adjustRegionStack:[mask]}]}));
 assert.throws(()=>s.Rules.validate({...recipe,layers:[{temp:.3,adjustRegionStack:Array(33).fill({adjustRegion:'in'})}]}));
});
test('a saved multi-layer preset uses a drawn mask before or after selection and retains it after Apply and reuse',async()=>{
 const a=await setup(),b=await setup(),strokes=[{mode:'lasso',size:.1,points:[[.2,.2],[.8,.2],[.7,.8],[.2,.7]]},{mode:'erase',size:.15,points:[[.5,.5]]}],drawn={adjustRegionShape:'freehand',adjustRegionStrokes:strokes,adjustRegionFeather:0};
 Object.assign(a.p,drawn);a.setScope('in');a.apply(recipe);b.apply(recipe);Object.assign(b.p,drawn);b.setScope('in');assert.deepEqual(a.draw(),b.draw());
 const before=await setup();protectedPixels(b.draw(),before.draw(),Scope.weight(b.p,100,80));const expected=b.draw();b.h.RayLayers.commit();assert.deepEqual(b.draw(),expected);const r=b.Rules.capture(b.snapshot(),'Bút với preset'),c=await setup();c.apply(r);assert.deepEqual(c.draw(),expected);
});
test('detailed mask capture and reuse render identical pixels to the complete original values',async()=>{
 const {detailedSnapshot}=require('./fixtures/detailed-recipe.cjs'),snapshot=detailedSnapshot(),a=await setup(),b=await setup(),compact=a.Rules.capture(snapshot,'Bốn vùng chi tiết');
 const legacy={...compact,layers:snapshot.layers.map(s=>({...a.Rules.defaults,...clone(s.p)}))};assert.ok(JSON.stringify(compact).length>32000);assert.ok(JSON.stringify(compact).length<JSON.stringify(legacy).length);a.apply(legacy);b.apply(compact);assert.deepEqual(b.draw(),a.draw());
});
test('omitting only default values preserves the exact output of every existing preset',async()=>{
 const html=fs.readFileSync(path.join(__dirname,'../dist/darkroom/index.html'),'utf8'),old=vm.runInNewContext('('+html.match(/const ROLLS = (\[[\s\S]*?\n\]);/)[1]+')'),catalog=require('../dist/darkroom/preset-catalog.js').extend(old);
 for(const preset of catalog){const a=await setup(),b=await setup(),compact=a.Rules.capture({p:preset.p,layers:[]},preset.name);if(!compact.layers.length)continue;const full=Object.fromEntries(Object.keys(a.Rules.defaults).map(k=>[k,preset.p[k]??a.Rules.defaults[k]]));a.apply({...compact,layers:[full]});b.apply(compact);assert.deepEqual(b.draw(),a.draw(),preset.id);}
});

function projectStrength(s,model,amount){
 const Strength=require('../dist/darkroom/filter-strength-core.js'),next=Strength.project(model,{p:clone(s.p),layers:clone(s.h.RayLayers.capture())},amount);Object.assign(s.p,next.p);s.h.RayLayers.restore(next.layers);return next.state;
}
test('ordinary filter strength retains the native full look and zero baseline for every catalog color, including Thu Nhật, without accumulating doses',async()=>{
 const Strength=require('../dist/darkroom/filter-strength-core.js'),html=fs.readFileSync(path.join(__dirname,'../dist/darkroom/index.html'),'utf8'),old=vm.runInNewContext('('+html.match(/const ROLLS = (\[[\s\S]*?\n\]);/)[1]+')'),catalog=require('../dist/darkroom/preset-catalog.js').extend(old),s=await setup({filmAdapters:true}),base=clone(s.p),source=pixels(s.source);let checked=0,visible=0;
 assert.ok(catalog.some(r=>r.id==='thunhat'));assert.equal(catalog.length,89);
 for(const preset of catalog){
  Object.assign(s.p,clone(base),{toneExposure:.17});const neutral=s.draw();Object.assign(s.p,preset.p,{frame:'none',stamp:false,rayBasePreset:preset.id});const full=s.draw();let model=Strength.create({kind:'current',name:preset.name,presetId:preset.id,targets:[{id:'current',p:clone(s.p),keys:Object.keys(preset.p)}]});
  model=projectStrength(s,model,100);assert.deepEqual(s.draw(),full,preset.id+' 100% retains the unmodified native preset');model=projectStrength(s,model,0);assert.deepEqual(s.draw(),neutral,preset.id+' 0% removes only preset-owned parameters');assert.equal(s.p.toneExposure,.17,'independent exposure survives');
  model=projectStrength(s,model,20);const first=s.draw();model=projectStrength(s,model,80);const stronger=s.draw();model=projectStrength(s,model,20);assert.deepEqual(s.draw(),first,preset.id+' repeated intensity changes are reversible');if(!full.equals(neutral)){visible++;assert.notDeepEqual(stronger,first,preset.id+' intermediate strengths produce different native pixels');}
  model=projectStrength(s,model,100);assert.deepEqual(s.draw(),full,preset.id+' returning to 100% restores the full look');assert.equal(s.draw().length,100*80*4);checked++;
 }
 assert.equal(checked,89);assert.ok(visible>80);assert.deepEqual(pixels(s.source),source);assert.deepEqual([s.source.width,s.source.height],[100,80]);
});
test('personal filter strength targets only the selected layer group and does not revive removed or disabled components',async()=>{
 const Strength=require('../dist/darkroom/filter-strength-core.js'),s=await setup({filmAdapters:true});s.p.toneExposure=.18;s.h.RayLayers.commit('Sáng riêng trước màu');const prior=clone(s.h.RayLayers.capture());s.apply(recipe);const group=clone(s.h.RayLayers.capture().filter(l=>!prior.some(p=>p.id===l.id)));s.p.toneExposure=-.07;let model=Strength.create({kind:'layers',name:recipe.name,targets:group.map(layer=>({id:layer.id,p:layer.p}))}),full=s.draw();
 model=projectStrength(s,model,0);const baseline=await setup({filmAdapters:true});baseline.h.RayLayers.restore(prior);baseline.p.toneExposure=-.07;assert.deepEqual(s.draw(),baseline.draw(),'zero leaves earlier layers and the separate live adjustment');assert.equal(s.p.toneExposure,-.07);assert.deepEqual(clone(s.h.RayLayers.capture().filter(l=>prior.some(p=>p.id===l.id))),prior);
 model=projectStrength(s,model,100);assert.deepEqual(s.draw(),full);model=projectStrength(s,model,20);const first=s.draw();model=projectStrength(s,model,80);assert.notDeepEqual(s.draw(),first);model=projectStrength(s,model,20);assert.deepEqual(s.draw(),first);
 const changed=clone(s.h.RayLayers.capture()).filter(l=>l.id!==group[1].id);changed.find(l=>l.id===group[0].id).enabled=false;s.h.RayLayers.restore(changed);model=projectStrength(s,model,75);assert.deepEqual(s.h.RayLayers.capture().map(l=>l.id),changed.map(l=>l.id));assert.equal(s.h.RayLayers.capture().find(l=>l.id===group[0].id).enabled,false);assert.equal(s.h.RayLayers.capture().some(l=>l.id===group[1].id),false);assert.deepEqual(clone(s.h.RayLayers.capture().filter(l=>prior.some(p=>p.id===l.id))),prior);
});
test('personal filter strength keeps local masks, draft references and effective saved formulas editable with native pixel parity',async()=>{
 const Strength=require('../dist/darkroom/filter-strength-core.js'),s=await setup({filmAdapters:true}),before=s.draw();s.apply(recipe);let model=Strength.create({kind:'layers',name:recipe.name,targets:s.h.RayLayers.capture().map(l=>({id:l.id,p:clone(l.p)}))});model=projectStrength(s,model,40);const all=s.draw();s.setScope('in');const selected=s.draw();protectedPixels(selected,before,Scope.weight(s.p,100,80),all);const geometry=clone(s.h.RayLayers.capture().map(l=>({focus:l.focus,p:{adjustRegion:l.p.adjustRegion,adjustRegionStack:l.p.adjustRegionStack}})));
 model=projectStrength(s,model,75);assert.deepEqual(clone(s.h.RayLayers.capture().map(l=>({focus:l.focus,p:{adjustRegion:l.p.adjustRegion,adjustRegionStack:l.p.adjustRegionStack}}))),geometry);model=projectStrength(s,model,40);assert.deepEqual(s.draw(),selected);
 s.setScope('out');protectedPixels(s.draw(),before,Scope.weight(s.p,100,80),all);s.setScope('in');assert.deepEqual(s.draw(),selected);
 const draft=clone({snapshot:s.snapshot(),strength:model}),restored=await setup({filmAdapters:true});Object.assign(restored.p,draft.snapshot.p);restored.h.RayLayers.restore(draft.snapshot.layers);let reopened=Strength.validate(draft.strength);assert.deepEqual(restored.draw(),selected);model=projectStrength(s,model,68);reopened=projectStrength(restored,reopened,68);assert.deepEqual(restored.draw(),s.draw());
 const saved=s.Rules.capture(s.snapshot(),'Màu vừa độ đậm'),copy=await setup({filmAdapters:true});copy.apply(clone(saved));assert.deepEqual(copy.draw(),s.draw(),'a reusable formula stores the actual selected strength and mask');assert.equal(JSON.stringify(saved).includes('rayFilterStrength'),false);assert.deepEqual(pixels(s.source),pixels(copy.source));
});
