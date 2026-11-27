const {test}=require('node:test'),assert=require('node:assert/strict');
const Runtime=require('../dist/darkroom/ai-composer-runtime.js'),Recipes=require('../dist/darkroom/ai-composer-recipes.js');
const copy=x=>JSON.parse(JSON.stringify(x)),deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const focus={cx:.4,cy:.45,rx:.2,ry:.3},sun={x:.2,y:.1},leak={x:.8,y:.1};
function component(id,role,p){return{id,title:id==='balance'?'Cân bằng ảnh':'Sáng chủ thể',role,enabled:true,p,focus:{...focus},sun:{...sun},leak:{...leak},reason:'Theo độ sáng ảnh gốc',targetIntent:{role,adaptive:true,regionSource:role==='subject'?'estimated':'all',baseline:{p:copy(p),focus:{...focus},sun:{...sun},leak:{...leak}}}};}
function dependencies(){
 const calls={analyze:[],generate:[],adapt:[]},core={STYLES:[{id:'auto-beauty'}],
  analyze(data,W,H,recognition){calls.analyze.push({data:[...data],W,H,recognition});return{median:data[0]/255,recognition:recognition.maps?'ai':recognition.faces?.length?'face':'estimated',fingerprint:String(data[0])};},
  generate(analysis,{style,seed,count}){calls.generate.push({analysis,style,seed,count});return Array.from({length:count},(_,i)=>({version:1,id:'plan-'+seed+'-'+i,title:'Phương án '+(i+1),style,seed,basePreset:{id:'goc',name:'Gốc'},analysis:copy(analysis),components:[component('balance','global',{toneExposure:+(.5-analysis.median+i*.04).toFixed(4),seed}),component('subject','subject',{toneExposure:.2,adjustRegion:'in',adjustRegionShape:'ellipse',adjustRegionX:analysis.median,adjustRegionY:.4,adjustRegionRX:.2,adjustRegionRY:.3,adjustRegionFeather:.4})]}));},
  scale(plan,intensity){const p=copy(plan);p.components=p.components.map(c=>({...c,enabled:c.enabled!==false&&intensity>0,p:{...c.p,toneExposure:c.p.toneExposure*intensity/100}}));return p;},
  adapt(saved,analysis){calls.adapt.push({saved:copy(saved),analysis});const result=this.generate(analysis,{style:saved.style,seed:saved.seed,count:4})[0];result.title=saved.name;return result;}
 };
 return{core,recipes:Recipes,calls};
}
function fixture(options={}){
 const deps=dependencies(),original=new Uint8ClampedArray([64,50,40,255]),image={id:1,data:original},baseline={p:{temp:.12,frame:'none',stamp:true,dateText:'2026 11 25'},focus:{...focus},sun:{...sun},leak:{...leak},layers:[{id:'manual-existing',title:'Lớp đang có',p:{contrast:.1},enabled:true}]};
 let source=image,color=copy(baseline),reads=0,recognitions=0,paints=0,restores=0,busy=false;const records=[],changes=[],paintPlans=[];
 const host={seed:10,getSource:()=>source,readImage:photo=>{reads++;assert.equal(photo,source);return{data:photo.data,width:1,height:1};},getExistingRecognition:options.existing||(()=>null),recognize:async(photo,notify)=>{recognitions++;return options.recognize?options.recognize(photo,notify):{maps:{width:1,height:1,hair:new Uint8Array([255])},faces:[]};},presets:()=>[],capture:()=>copy(color),restore:value=>{restores++;color=copy(value);},paint:(base,components,plan)=>{paints++;paintPlans.push(copy(plan));color={...copy(base),layers:[...base.layers.filter(x=>!x.aiComposer),...components.map(c=>({...copy(c),aiComposer:true}))]};if(options.paintFailure)throw Error('paint failed');},record:label=>records.push(label),onChange:value=>changes.push(value),busy:()=>busy};
 const controller=Runtime.create(host,deps);
 return{controller,host,deps,image,original,baseline,records,changes,paintPlans,get reads(){return reads;},get recognitions(){return recognitions;},get paints(){return paints;},get restores(){return restores;},get color(){return copy(color);},setColor(value){color=copy(value);},setBusy(value){busy=value;},replace(value=192){source={id:2,data:new Uint8ClampedArray([value,20,10,255])};color={...copy(baseline),p:{...baseline.p,temp:.32}};return source;}};
}
async function waitFor(condition){for(let i=0;i<30&&!condition();i++)await Promise.resolve();assert.ok(condition(),'asynchronous step started');}

test('analysis always uses the original photo and repeated variations use the same base without stacking',async()=>{
 const f=fixture(),before=[...f.original];assert.equal(await f.controller.compose('natural'),true);const first=f.color;
 assert.equal(first.layers.length,3);assert.equal(f.reads,1);assert.equal(f.recognitions,1);assert.equal(f.records.length,1);
 f.controller.select(2);f.controller.setIntensity(55);assert.equal(f.color.layers.length,3);
 assert.equal(await f.controller.reroll(),true);assert.equal(f.color.layers.length,3);assert.equal(f.reads,1);assert.equal(f.recognitions,1);assert.deepEqual([...f.original],before);
 assert.deepEqual(f.deps.calls.analyze[0].data,before);assert.equal(f.deps.calls.generate[1].seed,f.deps.calls.generate[0].seed+1);
 assert.equal(f.records.length,1,'previews do not add history entries');assert.deepEqual(f.color.p,f.baseline.p,'manual pending values remain part of base');
});
test('bounded detail pixels reach analysis alongside original histogram pixels without entering the saved recipe',async()=>{
 const f=fixture(),detail={data:new Uint8ClampedArray(16).fill(90),width:2,height:2,sourceWidth:4000,sourceHeight:3000};f.host.readImage=()=>({data:f.image.data,width:1,height:1,detail});assert.equal(await f.controller.compose('restore-detail'),true);const analyzed=f.deps.calls.analyze[0];assert.deepEqual(analyzed.data,[...f.original]);assert.equal(analyzed.W,1);assert.equal(analyzed.recognition.detail,detail);assert.equal(f.controller.recipe('Phục hồi').analysis.detail,undefined);assert.deepEqual([...f.original],[64,50,40,255]);
});
test('zero intensity, comparison and initial cancel restore the exact pre-Composer state',async()=>{
 const f=fixture();await f.controller.compose('cinematic');f.controller.setIntensity(70);const preview=f.color;
 assert.equal(f.controller.compare(true),true);assert.deepEqual(f.color,f.baseline);assert.equal(f.controller.state.comparing,true);
 assert.equal(f.controller.compare(false),true);assert.deepEqual(f.color,preview);f.controller.setIntensity(0);assert.deepEqual(f.color,f.baseline);
 f.controller.setIntensity(70);assert.deepEqual(f.color,preview);assert.equal(f.controller.cancel(),true);assert.deepEqual(f.color,f.baseline);assert.equal(f.controller.state.active,false);
});
test('a new photo starts at full strength while same-photo choices and saved formulas retain their chosen strength',async()=>{
 const f=fixture();await f.controller.compose('natural');f.controller.setIntensity(0);await f.controller.compose('moody');assert.equal(f.controller.state.intensity,0);f.controller.setIntensity(23);await f.controller.reroll();assert.equal(f.controller.state.intensity,23);const saved=f.controller.recipe('Mức riêng');
 f.replace();await f.controller.compose('restore-detail');assert.equal(f.controller.state.intensity,100);assert.ok(f.controller.state.active);f.replace(220);await f.controller.loadRecipe(saved,{adapt:true});assert.equal(f.controller.state.intensity,23);
});
test('apply retains the original baseline for later rerolls and cancel restores the last applied checkpoint',async()=>{
 const f=fixture();await f.controller.compose('natural');f.controller.apply();const committed=f.color;assert.equal(f.records.length,2);assert.equal(f.controller.state.applied,true);
 await f.controller.reroll();assert.equal(f.color.layers.length,3,'reroll after Apply replaces its group');assert.notDeepEqual(f.color,committed);assert.equal(f.controller.state.applied,false);
 f.controller.cancel();assert.deepEqual(f.color,committed);assert.equal(f.controller.state.applied,true);
 await f.controller.reroll();f.controller.apply();assert.equal(f.color.layers.length,3);assert.equal(f.records.length,3,'only another Apply enters history');
 f.controller.compare(true);assert.deepEqual(f.color,f.baseline);f.controller.compare(false);assert.equal(f.color.layers.length,3);
});
test('a component edit, toggle and removal preserve independent component parameters and adaptation baseline',async()=>{
 const f=fixture();await f.controller.compose('editorial');const original=f.controller.state.variants[0],baseline=copy(original.components[0].targetIntent.baseline),other=copy(original.components[1]);
 assert.equal(f.controller.setComponent('balance',{p:{toneExposure:.7},sun:{x:.8}}),true);let plan=f.controller.state.variants[0];assert.equal(plan.components[0].p.toneExposure,.7);assert.equal(plan.components[0].sun.x,.8);assert.deepEqual(plan.components[0].targetIntent.baseline,baseline);assert.deepEqual(plan.components[1],other);
 f.controller.toggle('balance');assert.equal(f.controller.state.variants[0].components[0].enabled,false);assert.deepEqual(f.controller.state.variants[0].components[1],other);
 f.controller.remove('balance');assert.deepEqual(f.controller.state.variants[0].components,[other]);f.controller.remove('subject');assert.deepEqual(f.color,f.baseline);
});
test('invalid component ranges do not change preview, plan, or other manual settings',async()=>{
 const f=fixture();await f.controller.compose('natural');const before=f.color,plan=f.controller.state.variants;
 assert.equal(f.controller.setComponent('balance',{p:{toneExposure:99}}),false);assert.deepEqual(f.color,before);assert.deepEqual(f.controller.state.variants,plan);assert.match(f.controller.state.error,/phạm vi/);
});
test('mix weight edits preserve manual color deltas, independent tools and canonical strength through saving',async()=>{
 const Core=require('../dist/darkroom/ai-composer-core.js'),f=fixture();f.host.presets=()=>[{id:'warm',name:'Ấm',p:{temp:.25,tint:.04,split:.08,contrast:.1,sat:.04,lift:.03}},{id:'cool',name:'Mát',p:{temp:-.18,tint:-.03,split:.2,contrast:.2,sat:.14,lift:.02}}];const r=Runtime.create(f.host,{core:Core,recipes:Recipes});assert.equal(await r.compose('soft-dream'),true);
 const current=()=>r.state.variants[0].components.find(c=>c.id==='film'),before=current(),other=copy(r.state.variants[0].components.filter(c=>c.id!=='film')),base=Core.mixParameters(before.mix);assert.equal(before.mix.sources.length,2);assert.equal(r.setComponent('film',{p:{temp:before.p.temp+.04}}),true);
 const edited=copy(current()),mix=copy(edited.mix);mix.sources[0].weight=0;const next=Core.mixParameters(mix);assert.equal(r.setMix('film',{sourceIndex:0,weight:0}),true);for(const key of Object.keys(base))assert.ok(Math.abs(current().p[key]-(edited.p[key]+next[key]-base[key]))<.000002,key);assert.deepEqual(r.state.variants[0].components.filter(c=>c.id!=='film'),other);
 assert.equal(r.setMix('film',{strength:0}),true);const muted=current();for(const key of Object.keys(next)){const [min,max]=Recipes.limits[key],expected=Math.max(min,Math.min(max,edited.p[key]-base[key]));assert.ok(Math.abs(muted.p[key]-expected)<.00001,key);}assert.equal(r.setMix('film',{strength:.6}),true);r.setIntensity(73);const saved=r.recipe('Hai màu của tôi');assert.equal(saved.intensity,73);assert.equal(saved.components.find(c=>c.id==='film').mix.strength,.6);assert.equal(saved.components.find(c=>c.id==='film').mix.sources[0].weight,0);const color=f.color;
 r.setIntensity(0);assert.deepEqual(f.color,f.baseline);r.setIntensity(73);assert.deepEqual(f.color,color);r.compare(true);assert.deepEqual(f.color,f.baseline);r.compare(false);assert.deepEqual(f.color,color);assert.equal(await r.loadRecipe(saved,{adapt:false}),true);assert.deepEqual(r.state.variants[0].components.find(c=>c.id==='film').mix,saved.components.find(c=>c.id==='film').mix);
 const plans=r.state.variants,preview=f.color;for(const patch of [{weight:.4},{sourceIndex:0},{sourceIndex:-1,weight:.5},{sourceIndex:99,weight:.5},{sourceIndex:0,weight:NaN},{strength:1.1},{strength:0,foreign:1}])assert.equal(r.setMix('film',patch),false);assert.deepEqual(r.state.variants,plans);assert.deepEqual(f.color,preview);
});
test('failed AI recognition still provides statistical plans and explicitly labels estimated regions',async()=>{
 const f=fixture({recognize:async()=>{throw Error('offline model unavailable');}});assert.equal(await f.controller.compose('natural'),true);assert.equal(f.controller.state.analysis.recognition,'estimated');assert.match(f.controller.state.status,/ước lượng/);assert.equal(f.controller.state.variants.length,4);assert.equal(f.controller.state.error,null);
});
test('same-photo recognition is reused and a different-photo recognition cannot be borrowed',async()=>{
 const f=fixture({existing:photo=>({source:photo,maps:{width:1,height:1},faces:[]})});await f.controller.compose('natural');assert.equal(f.recognitions,0);await f.controller.reroll();assert.equal(f.recognitions,0);
 const g=fixture({existing:()=>({source:{},maps:{width:1,height:1}})});await g.controller.compose('natural');assert.equal(g.recognitions,1);
});
test('recovery requests missing face recognition once after an ordinary cached-mask analysis',async()=>{
 const maps={width:1,height:1},f=fixture({existing:photo=>({source:photo,maps,faces:[]}),recognize:async()=>({faces:[[{x:.3,y:.2},{x:.4,y:.3}]]})});await f.controller.compose('natural');assert.equal(f.recognitions,0);await f.controller.compose('restore-detail');assert.equal(f.recognitions,1);assert.equal(f.deps.calls.analyze.length,2);assert.equal(f.deps.calls.analyze[1].recognition.maps,maps);assert.ok(f.deps.calls.analyze[1].recognition.faces.length);await f.controller.reroll();assert.equal(f.recognitions,1);assert.equal(f.deps.calls.analyze.length,2);
});
test('film recovery refreshes missing face recognition for composition and adaptive recipe loading without repeated scans',async()=>{
 const make=()=>fixture({existing:photo=>({source:photo,maps:{width:1,height:1},faces:[]}),recognize:async()=>({faces:[[{x:.3,y:.2},{x:.4,y:.3}]]})}),f=make();await f.controller.compose('natural');assert.equal(f.recognitions,0);assert.equal(await f.controller.compose('film-recovery'),true);assert.equal(f.recognitions,1);assert.equal(f.deps.calls.analyze.length,2);assert.ok(f.deps.calls.analyze[1].recognition.faces.length);await f.controller.reroll();assert.equal(f.recognitions,1);
 const saved=f.controller.recipe('Fuji của tôi'),next=make();await next.controller.compose('natural');assert.equal(next.recognitions,0);assert.equal(await next.controller.loadRecipe(saved,{adapt:true}),true);assert.equal(next.recognitions,1);assert.equal(next.deps.calls.analyze.length,2);assert.ok(next.deps.calls.adapt[0].analysis);await next.controller.reroll();assert.equal(next.recognitions,1);
});
test('a failed missing-face refresh retains useful cached masks and does not retry every reroll',async()=>{
 const maps={width:1,height:1},f=fixture({existing:photo=>({source:photo,maps,faces:[]}),recognize:async()=>{throw Error('offline face model');}});await f.controller.compose('backlight');assert.equal(f.recognitions,1);assert.equal(f.deps.calls.analyze[0].recognition.maps,maps);assert.equal(f.controller.state.analysis.recognition,'ai');assert.equal(f.controller.state.error,null);await f.controller.reroll();assert.equal(f.recognitions,1);f.replace();await f.controller.compose('restore-detail');assert.equal(f.recognitions,2);
});
test('photo replacement invalidates cached analysis and recognition and cannot restore an old baseline',async()=>{
 const f=fixture();await f.controller.compose('natural');const second=f.replace(192),before=f.color;assert.equal(f.controller.cancel(),false);assert.deepEqual(f.color,before);
 await f.controller.compose('natural');assert.equal(f.reads,2);assert.equal(f.recognitions,2);assert.equal(f.controller.state.analysis.fingerprint,'192');assert.equal(f.color.p.temp,.32);assert.equal(f.image.id,1);assert.equal(second.id,2);
});
test('source replacement during asynchronous recognition rejects the stale result without writes',async()=>{
 const pending=deferred(),f=fixture({recognize:()=>pending.promise}),work=f.controller.compose('natural');await waitFor(()=>f.recognitions===1);f.replace();const before=f.color;
 pending.resolve({maps:{width:1,height:1},faces:[]});assert.equal(await work,false);assert.deepEqual(f.color,before);assert.equal(f.paints,0);assert.equal(f.controller.state.variants.length,0);
});
test('cancel during recognition prevents a delayed inference result from repainting',async()=>{
 const pending=deferred(),f=fixture({recognize:()=>pending.promise}),work=f.controller.compose('natural');await waitFor(()=>f.recognitions===1);assert.equal(f.controller.cancel(),true);const writes=f.restores;
 pending.resolve({maps:{width:1,height:1},faces:[]});assert.equal(await work,false);assert.deepEqual(f.color,f.baseline);assert.equal(f.paints,0);assert.equal(f.restores,writes);
});
test('a later compose supersedes a pending request while sharing original-image analysis',async()=>{
 const pending=deferred(),f=fixture({recognize:()=>pending.promise}),first=f.controller.compose('natural');await waitFor(()=>f.recognitions===1);const second=f.controller.compose('moody');pending.resolve({maps:{width:1,height:1},faces:[]});
 assert.equal(await first,false);assert.equal(await second,true);assert.equal(f.controller.state.style,'moody');assert.equal(f.paints,1);assert.equal(f.reads,1);
});
test('external manual changes are preserved and stale Composer mutations release ownership',async()=>{
 const f=fixture();await f.controller.compose('natural');const edited=f.color;edited.layers[0].p.contrast=.42;f.setColor(edited);
 assert.equal(f.controller.setIntensity(20),false);assert.deepEqual(f.color,edited);assert.equal(f.controller.state.active,false);assert.match(f.controller.state.status,/giữ chỉnh sửa bên ngoài/);
 assert.equal(f.controller.cancel(),false);assert.deepEqual(f.color,edited);assert.equal(await f.controller.compose('natural'),true);assert.equal(f.color.layers[0].p.contrast,.42);assert.equal(f.color.layers.length,3);
});
test('manual changes made during analysis are not overwritten when recognition finishes',async()=>{
 const pending=deferred(),f=fixture({recognize:()=>pending.promise}),work=f.controller.compose('natural');await waitFor(()=>f.recognitions===1);const edited=f.color;edited.p.temp=.7;f.setColor(edited);pending.resolve({maps:{width:1,height:1},faces:[]});
 assert.equal(await work,false);assert.deepEqual(f.color,edited);assert.equal(f.paints,0);assert.equal(f.controller.state.active,false);
});
test('saved formulas retain full component geometry and adapt against each new original photo',async()=>{
 const f=fixture();await f.controller.compose('golden-hour');f.controller.setComponent('subject',{p:{toneLocalEV:.4,toneLocalColor:'#ffd18c',toneLocalColorAmount:.1},sun:{x:.84,y:.23},focus:{cx:.62,rx:.31}});f.controller.setIntensity(63);
 const saved=f.controller.recipe('Nắng của tôi');assert.equal(saved.intensity,63);assert.equal(saved.components[1].p.toneLocalEV,.4);assert.equal(saved.components[1].sun.x,.84);assert.equal(saved.components[1].focus.cx,.62);
 f.replace(220);assert.equal(await f.controller.loadRecipe(saved,{adapt:true}),true);assert.equal(f.deps.calls.adapt.length,1);assert.equal(f.deps.calls.adapt[0].analysis.fingerprint,'220');assert.equal(f.controller.state.intensity,63);assert.equal(f.color.layers.length,3);
});
test('invalid imported formulas are rejected before altering the current preview',async()=>{
 const f=fixture();await f.controller.compose('natural');const before=f.color,saved=f.controller.recipe('Công thức');saved.components[0].p.toneExposure=400;
 await assert.rejects(f.controller.loadRecipe(saved),/phạm vi/);assert.deepEqual(f.color,before);
});
test('native host paint failure rolls color settings back to the previous image state',async()=>{
 const f=fixture({paintFailure:true});assert.equal(await f.controller.compose('natural'),false);assert.deepEqual(f.color,f.baseline);assert.match(f.controller.state.error,/paint failed/);assert.equal(f.controller.state.busy,false);assert.equal(f.controller.state.variants.length,0);
});
test('a failed reroll keeps the prior applied plan and its visible preview in sync',async()=>{
 const options={},f=fixture(options);await f.controller.compose('natural');f.controller.apply();const image=f.color,plan=f.controller.state.variants;
 options.paintFailure=true;assert.equal(await f.controller.reroll(),false);assert.deepEqual(f.color,image);assert.deepEqual(f.controller.state.variants,plan);assert.equal(f.controller.state.applied,true);
});
test('snapshots are detached and an unrelated busy tool prevents Composer writes',async()=>{
 const f=fixture();f.setBusy(true);assert.equal(await f.controller.compose('natural'),false);assert.equal(f.paints,0);f.setBusy(false);await f.controller.compose('natural');
 const state=f.controller.state;state.variants[0].components[0].p.toneExposure=100;assert.notEqual(f.controller.state.variants[0].components[0].p.toneExposure,100);state.analysis.median=1;assert.notEqual(f.controller.state.analysis.median,1);
});
test('the real adaptive core and validated recipes work through every style and photo reapplication',async()=>{
 const Core=require('../dist/darkroom/ai-composer-core.js'),Layers=require('../dist/darkroom/effect-layers.js'),f=fixture(),r=Runtime.create(f.host,{core:Core,recipes:Recipes});
 for(const style of Core.STYLES){assert.equal(await r.compose(style.id),true,style.id);assert.equal(r.state.variants.length,4);const components=r.state.variants[0].components;if(['backlight','restore-detail','film-recovery'].includes(style.id)){assert.ok(components.length>=3);assert.ok(components.every(c=>c.enabled!==false&&Layers.active(c.p)),'recovery contains only tools with an actual effect');}else assert.equal(components.length,6);assert.doesNotThrow(()=>r.recipe('Công thức '+style.name));assert.equal(f.color.layers.length,components.length+1);}
 r.setComponent('balance',{p:{toneExposure:.23}});r.setIntensity(61);const saved=r.recipe('Nắng riêng');r.apply();await r.reroll();assert.equal(f.color.layers.length,7);
 f.replace(210);assert.equal(await r.loadRecipe(saved,{adapt:true}),true);assert.equal(r.state.variants[0].title,'Nắng riêng');assert.equal(r.state.intensity,61);assert.equal(f.color.layers.length,7);assert.equal(f.reads,2);
});
