const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Core=require('../dist/darkroom/filter-strength-core.js'),Layers=require('../dist/darkroom/effect-layers.js');
const copy=value=>JSON.parse(JSON.stringify(value));
function current(p={temp:.6,sat:-.4,grain:.2,toneExposure:.8}){const state=Core.create({kind:'current',name:'Màu phim',presetId:'film',targets:[{id:'current',p,keys:['temp','sat','grain']}]});return{state,p,layers:[]};}
function apply(model,amount){const next=Core.project(model.state,model,amount);return next;}
test('strength supports every native amplitude and excludes geometry, seed, frame and mode selectors',()=>{
 assert.deepEqual(Core.keys,Layers.keys);for(const key of Core.keys)assert.deepEqual(Core.ranges[key],Layers.valueLimits[key]);
 const p={temp:.6,sat:-.4,rayThuNhat:1.5,toneExposure:-1.8,toneLocalEV:-.9,adjustRegionX:.9,seed:123,frame:'film',stamp:true,haltint:.3,nangSize:1.2};
 const state=Core.create({kind:'current',name:'Ngọc',targets:[{id:'current',p,keys:Object.keys(p)}]});assert.deepEqual(Object.keys(state.refs[0].full),['temp','sat','rayThuNhat','toneExposure','toneLocalEV']);
 const half=Core.project(state,{p},50);for(const key of ['adjustRegionX','seed','frame','stamp','haltint','nangSize'])assert.equal(half.p[key],p[key]);assert.equal(half.p.rayThuNhat,.75);assert.equal(half.p.toneExposure,-.9);
});
test('zero removes only the selected filter and full strength is the original recipe with independent tone preserved',()=>{
 const start=current(),before=copy(start),zero=apply(start,0);for(const key of ['temp','sat','grain'])assert.equal(zero.p[key],0);assert.equal(zero.p.toneExposure,.8);
 const full=apply(zero,100);assert.deepEqual(full.p,start.p);assert.deepEqual(full.state.refs[0].full,start.state.refs[0].full);assert.deepEqual(start,before);
 const explicitAmount=Core.create({kind:'current',name:'Màu',amount:25,targets:[{id:'current',p:{temp:.6}}]});assert.equal(explicitAmount.amount,100,'creation always captures a full-strength reference');
});
test('repeated strength changes rebuild from an immutable reference instead of accumulating or losing negative values',()=>{
 const initial=current(),twenty=apply(initial,20),eighty=apply(twenty,80),again=apply(eighty,20);assert.deepEqual(again.p,twenty.p);assert.deepEqual(again.state.refs[0].full,initial.state.refs[0].full);
 let model=again;for(let i=0;i<50;i++)model=apply(apply(model,83),20);assert.deepEqual(model.p,twenty.p);assert.deepEqual(apply(model,100).p,initial.p);
});
test('manual changes remain independent and clipped offsets are reversible without weakening native ranges',()=>{
 let model=current();model=apply(model,50);model.p.temp+=.1;model.p.toneExposure=-.7;model=apply(model,0);assert.ok(Math.abs(model.p.temp-.1)<1e-12);assert.equal(model.p.toneExposure,-.7);model=apply(model,100);assert.ok(Math.abs(model.p.temp-.7)<1e-12);
 let clipped={state:Core.create({kind:'current',name:'Âm',targets:[{id:'current',p:{temp:-1}}]}),p:{temp:-1},layers:[]};clipped=apply(clipped,0);clipped.p.temp=1;clipped=apply(clipped,100);assert.equal(clipped.p.temp,0);clipped.p.temp=1;clipped=apply(clipped,100);assert.equal(clipped.state.refs[0].offset.temp,2);assert.equal(clipped.p.temp,1);const high=apply(clipped,0);assert.equal(high.p.temp,1);assert.deepEqual(apply(high,100).p,clipped.p);
});
test('personal preset strength affects only matching layers and preserves masks, disabled states and deleted steps',()=>{
 const p={toneExposure:.4,brushStrokes:[{points:[[.1,.2]]}]},older={id:'older',enabled:true,p:{temp:.2}},one={id:'one',title:'Trời',enabled:false,p:{temp:-.5,adjustRegion:'in',adjustRegionStrokes:[{mode:'lasso',size:.01,points:[[.1,.2],[.4,.5],[.1,.2]]}],seed:123}},two={id:'two',enabled:true,p:{sat:.3}},ai={id:'ai',p:{toneExposure:.7},aiComposer:{group:'saved'}},layers=[older,one,two,ai],before=copy({p,layers}),state=Core.create({kind:'layers',name:'Màu của tôi',targets:[one,two].map(layer=>({id:layer.id,p:layer.p}))});
 const half=Core.project(state,{p,layers},50);assert.equal(half.p,p);assert.equal(half.layers[0],older);assert.equal(half.layers[3],ai);assert.equal(half.layers[1].enabled,false);assert.equal(half.layers[1].p.temp,-.25);assert.deepEqual(half.layers[1].p.adjustRegionStrokes,one.p.adjustRegionStrokes);assert.equal(half.layers[1].p.seed,123);assert.deepEqual({p,layers},before);
 half.layers=half.layers.filter(layer=>layer.id!=='two');const next=Core.project(half.state,half,100);assert.equal(next.layers.some(layer=>layer.id==='two'),false);assert.deepEqual(next.state.refs.map(ref=>ref.id),['one']);assert.equal(next.layers[1].enabled,false);assert.equal(next.layers[1].p.temp,-.5);
});
test('JSON round trips retain editable canonical values, offsets and the selected dose',()=>{
 let model=apply(current(),37);model.p.sat+=.05;model=apply(model,72);const restored=Core.validate(JSON.parse(JSON.stringify(model.state))),projected=Core.project(restored,copy(model),22),original=Core.project(model.state,model,22);assert.deepEqual(projected,original);assert.notEqual(restored,model.state);assert.notEqual(restored.refs[0].full,model.state.refs[0].full);
});
test('state validation rejects malformed, excessive, accessor, prototype and non-finite metadata before it can change live values',()=>{
 const base=current().state;
 for(const mutate of [s=>{s.version=2;},s=>{s.amount=101;},s=>{s.kind='all';},s=>{s.name='';},s=>{s.extra='x';},s=>{s.refs[0].id='other';},s=>{s.refs[0].full.temp=NaN;},s=>{s.refs[0].rendered.temp=1.1;},s=>{s.refs[0].offset.temp=2.1;},s=>{s.refs[0].full.seed=123;},s=>{delete s.refs[0].offset.temp;},s=>{s.refs.push(copy(s.refs[0]));},s=>{s.refs=Array(33).fill(s.refs[0]);}]){const bad=copy(base);mutate(bad);assert.throws(()=>Core.validate(bad));}
 const getter=copy(base);let called=0;Object.defineProperty(getter,'amount',{enumerable:true,get(){called++;return 10;}});assert.throws(()=>Core.validate(getter));assert.equal(called,0);
 const arrayGetter=copy(base);Object.defineProperty(arrayGetter.refs,'0',{enumerable:true,get(){called++;return base.refs[0];}});assert.throws(()=>Core.validate(arrayGetter));assert.equal(called,0);
 const nonplain=Object.create({inherited:1});Object.assign(nonplain,base);assert.throws(()=>Core.validate(nonplain));const subclass=copy(base);Object.setPrototypeOf(subclass.refs,Object.create(Array.prototype));assert.throws(()=>Core.validate(subclass));const symbol=copy(base);symbol[Symbol('hidden')]=1;assert.throws(()=>Core.validate(symbol));const hostile=JSON.parse(JSON.stringify(base).replace('"version":1','"__proto__":{},"version":1'));assert.throws(()=>Core.validate(hostile));assert.equal({}.polluted,undefined);
 const invalidLive=current();invalidLive.p.temp=Infinity;assert.throws(()=>apply(invalidLive,20));
});
test('the pure model runs in another browser realm without DOM, storage or renderer access',()=>{
 const realm={};vm.createContext(realm);vm.runInContext(fs.readFileSync(require.resolve('../dist/darkroom/filter-strength-core.js'),'utf8'),realm);const api=realm.RayFilterStrengthCore,model=current();assert.deepEqual(copy(api.project(model.state,model,50)),copy(apply(model,50)));
 const foreign=vm.runInContext('({version:1,kind:"current",name:"Màu",amount:100,refs:[{id:"current",full:{temp:.5},offset:{temp:0},rendered:{temp:.5}}]})',realm);assert.equal(Core.validate(foreign).refs[0].full.temp,.5);
});
