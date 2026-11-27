const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const R=require('../dist/darkroom/ai-composer-recipes.js');
function component(id='subject'){
 const p={toneLocalEV:.65,toneLocalBrightness:.06,toneLocalWarmth:.12,toneLocalColorAmount:.15,toneLocalColor:'#FFD18C',toneLocalOpacity:.7,toneLocalEnabled:true,toneLocalMode:'all',toneLocalShape:'curve',toneLocalCurve:.4,toneLocalThickness:.035,toneLocalFill:'outline',adjustRegion:'in',adjustRegionShape:'freehand',adjustRegionFeather:.3,adjustRegionStrokes:[{mode:'lasso',size:.003,points:[[.2,.1],[.7,.15],[.8,.9],[.15,.85]],open:false}],adjustRegionStack:[{adjustRegion:'out',adjustRegionShape:'ellipse',adjustRegionX:.55,adjustRegionY:.35,adjustRegionRX:.06,adjustRegionRY:.08}],brushEV:.25,brushStrokes:[{mode:'paint',size:.05,softness:.7,points:[[.4,.2],[.4,.7]]}],bgBlur:.12,motion:.04,motionAngle:-35,nang:.2,nangManual:true,nangAngle:25,leak:.08,leakManual:true,leakHue:14,focusAngle:7};
 return{id,title:'Cứu sáng chủ thể',role:'subject',enabled:true,p,focus:{cx:.42,cy:.49,rx:.25,ry:.41},sun:{x:.2,y:.05},leak:{x:.85,y:.1},reason:'Chủ thể tối hơn hậu cảnh.',targetIntent:{role:'subject',adaptive:true,regionSource:'ai',baseline:{p:{toneLocalEV:.5},focus:{cx:.4,cy:.5,rx:.24,ry:.4},sun:{x:.1,y:.08},leak:{x:.9,y:.12}}}};
}
function plan(){return{version:1,id:'plan-123',style:'natural',seed:123,title:'Trong trẻo 01',basePreset:{id:'goc',name:'Gốc'},analysis:{mean:.4,median:.38,shadows:.17,highlights:.06,clippedHighlights:.01,clippedShadows:.02,skinCoverage:.13,subjectBrightness:.28,backgroundBrightness:.6,texture:.3,recognition:'local-ai',fingerprint:'123abc',warmCast:-.2,lightConfidence:.8},components:[component()]};}
function fixture(){
 const rows=new Map(),opened=[],created=[];let hasStore=false,failWrite=false,failOpen=false,blocked=false,closed=0;
 const db={objectStoreNames:{contains:n=>n==='presets'&&hasStore},createObjectStore(n,o){created.push([n,o]);hasStore=true;},close(){closed++;},transaction(n,mode){assert.equal(n,'presets');assert.ok(['readonly','readwrite'].includes(mode));let pending=0,aborted=false;const tx={error:null,abort(){aborted=true;setImmediate(()=>tx.onabort?.({target:tx}));}};
  function request(work){const r={};pending++;setImmediate(()=>{try{if(aborted)return;r.result=structuredClone(work());r.onsuccess?.();}catch(error){aborted=true;tx.error=error;tx.onabort?.({target:tx});}finally{pending--;if(!pending&&!aborted)setImmediate(()=>{if(!pending&&!aborted)tx.oncomplete?.();});}});return r;}
  const s={get:id=>request(()=>rows.get(id)),getAll:()=>request(()=>[...rows.values()]),delete:id=>request(()=>rows.delete(id)),put(value){return request(()=>{if(failWrite)throw new DOMException('full','QuotaExceededError');rows.set(value.id,structuredClone(value));return value.id;});}};tx.objectStore=n=>{assert.equal(n,'presets');return s;};return tx;}};
 const factory={open(n,v){opened.push([n,v]);const r={};setImmediate(()=>{if(failOpen){r.error=new DOMException('storage disabled','InvalidStateError');r.onerror?.();return;}r.result=db;if(blocked){r.onblocked?.();setImmediate(()=>r.onsuccess?.());return;}if(!hasStore)r.onupgradeneeded?.();r.onsuccess?.();});return r;}};
 return{rows,opened,created,factory,db,get closed(){return closed;},set failWrite(v){failWrite=v;},set failOpen(v){failOpen=v;},set blocked(v){blocked=v;}};
}
test('full AI recipes preserve native light, blur, vector selections and adaptation baselines through JSON',()=>{
 const input=plan(),before=structuredClone(input),saved=R.create(input,{name:'Ánh sáng của tôi',intensity:63}),copy=R.decode(R.encode(saved));
 assert.deepEqual(input,before);assert.deepEqual(copy,saved);assert.equal(copy.kind,'ray-ai-composer');assert.equal(copy.intensity,63);assert.equal(copy.components[0].p.toneLocalColor,'#ffd18c');
 assert.deepEqual(copy.components[0].p.adjustRegionStrokes,input.components[0].p.adjustRegionStrokes);assert.deepEqual(copy.components[0].p.brushStrokes,input.components[0].p.brushStrokes);assert.deepEqual(copy.components[0].targetIntent.baseline,input.components[0].targetIntent.baseline);assert.deepEqual(copy.components[0].sun,input.components[0].sun);assert.equal(copy.components[0].p.bgBlur,.12);assert.equal(copy.components[0].p.motionAngle,-35);
 copy.components[0].p.adjustRegionStrokes[0].points[0][0]=.9;assert.equal(saved.components[0].p.adjustRegionStrokes[0].points[0][0],.2);
});
test('zero intensity, hidden and removed components round-trip without re-enabling effects',()=>{
 const p=plan();p.components[0].enabled=false;const saved=R.create(p,{intensity:0});assert.equal(R.decode(R.encode(saved)).intensity,0);assert.equal(R.validate(saved).components[0].enabled,false);
 saved.components=[];assert.deepEqual(R.validate(saved).components,[]);
});
test('optional preset mixes preserve sources, zero weights, native edits and strength while old recipes remain unchanged',()=>{
 const original=R.create(plan());assert.equal('mix' in original.components[0],false);assert.deepEqual(R.decode(R.encode(original)),original);
 const p=plan();p.components[0].mix={version:1,strength:.48,sources:[{id:'fuji',name:'Fuji',weight:.65,p:{temp:.06,tint:-.06,split:.15,contrast:.16,sat:.26,lift:.02}},{id:'soft',name:'Dịu',weight:0,p:{temp:.01,tint:.02,split:0,contrast:-.1,sat:.02,lift:.03}}]};p.components[0].p.temp=.17;
 const saved=R.create(p,{intensity:73}),decoded=R.decode(R.encode(saved));assert.deepEqual(decoded,saved);assert.equal(decoded.components[0].mix.strength,.48);assert.equal(decoded.components[0].mix.sources[1].weight,0);assert.equal(decoded.components[0].p.temp,.17);p.components[0].mix.sources[0].p.temp=.9;assert.equal(saved.components[0].mix.sources[0].p.temp,.06);
 const valid=saved.components[0].mix,cases=[{...valid,version:2},{...valid,strength:NaN},{...valid,sources:[]},{...valid,sources:Array(4).fill(valid.sources[0])},{...valid,sources:[valid.sources[0],valid.sources[0]]},{...valid,sources:[{...valid.sources[0],weight:1.1}]},{...valid,sources:[{...valid.sources[0],p:{...valid.sources[0].p,photo:'data:image/png;base64,x'}}]},{...valid,sources:[{...valid.sources[0],p:{temp:.1}}]},{...valid,sources:[{...valid.sources[0],p:{...valid.sources[0].p,lift:-.1}}]}];
 for(const mix of cases)assert.throws(()=>R.validate({...saved,components:[{...saved.components[0],mix}]}));
});
test('scene palette analysis preserves bounded vector regions without accepting images or rendering parameters',()=>{
 const p=plan(),c=component(),zone={confidence:.8,coverage:.3,mean:.6,p10:.3,p90:.9,highlightCoverage:.1,colorfulness:.2,warmCast:-.1,tintCast:.03,focus:c.focus,p:{adjustRegion:'in',adjustRegionShape:'freehand',adjustRegionFeather:.45,adjustRegionStrokes:c.p.adjustRegionStrokes,adjustRegionStack:c.p.adjustRegionStack}};p.analysis.palette={version:1,sky:zone,land:null};const saved=R.create(p),decoded=R.decode(R.encode(saved));assert.deepEqual(decoded,saved);assert.deepEqual(decoded.analysis.palette,p.analysis.palette);p.analysis.palette.sky.p.adjustRegionStrokes[0].points[0][0]=.8;assert.notEqual(saved.analysis.palette.sky.p.adjustRegionStrokes[0].points[0][0],.8);
 const valid=saved.analysis.palette,bad=[{...valid,version:2},{...valid,photo:'pixels'},{...valid,sky:{...valid.sky,confidence:NaN}},{...valid,sky:{...valid.sky,coverage:1.1}},{...valid,sky:{...valid.sky,p10:.95,p90:.1}},{...valid,sky:{...valid.sky,p:{...valid.sky.p,toneExposure:1}}},{...valid,sky:{...valid.sky,p:{...valid.sky.p,raster:[0,1]}}},{...valid,sky:{...valid.sky,p:{...valid.sky.p,adjustRegion:'all'}}}];for(const palette of bad)assert.throws(()=>R.validate({...saved,analysis:{...saved.analysis,palette}}));
 assert.deepEqual(R.create({...plan(),analysis:{palette:{version:1,sky:null,land:null}}}).analysis.palette,{version:1,sky:null,land:null});
});
test('film recovery uses the existing portable recipe format and preserves independent palette edits and masks',()=>{
 const p=plan();p.style='film-recovery';p.basePreset={id:'fujicam3',name:'Fuji 3'};const background=component('film-background');background.role=background.targetIntent.role='background';background.title='Màu phim hậu cảnh';background.p={temp:-.04,tint:-.12,split:.42,contrast:.16,sat:.18,lift:.04,adjustRegion:'out',adjustRegionShape:'freehand',adjustRegionStrokes:structuredClone(p.components[0].p.adjustRegionStrokes)};background.targetIntent.baseline={p:structuredClone(background.p),focus:structuredClone(background.focus),sun:structuredClone(background.sun),leak:structuredClone(background.leak)};background.enabled=false;p.components.push(background);
 const saved=R.create(p,{name:'Fuji của tôi',intensity:84}),decoded=R.decode(R.encode(saved));assert.deepEqual(decoded,saved);assert.equal(decoded.style,'film-recovery');assert.equal(decoded.basePreset.id,'fujicam3');assert.equal(decoded.components[1].enabled,false);assert.equal(decoded.components[1].p.adjustRegion,'out');assert.equal(decoded.components[1].p.split,.42);assert.equal(decoded.components[0].p.toneLocalEV,.65);assert.ok(!JSON.stringify(decoded).includes('data:image'));
});
test('legacy full-P capture keeps only supported Composer tools and never copies photo or makeup data',()=>{
 const p={...component().p,frame:'film',stamp:true,dateText:'riêng tư',body:[{size:.3}],hairColor:'#123456',photo:'data:image/png;base64,x',adjustRegionTargets:['foreign-layer']},out=R.pickParameters(p);
 assert.equal(out.toneLocalEV,.65);assert.deepEqual(out.brushStrokes,p.brushStrokes);assert.equal(out.bgBlur,.12);
 for(const key of ['frame','stamp','dateText','body','hairColor','photo','adjustRegionTargets'])assert.equal(Object.hasOwn(out,key),false,key);
});
test('imports reject photos, AI masks, foreign tools, prototype payloads and non-finite values before use',()=>{
 const valid=R.create(plan()),cases=[{...valid,photo:'data:image/png;base64,x'},{...valid,version:2},{...valid,style:'unknown'},{...valid,intensity:101},{...valid,seed:NaN},{...valid,seed:.5},{...valid,analysis:{histogram:[0,1]}},{...valid,components:[{...valid.components[0],p:{hair:1}}]},{...valid,components:[{...valid.components[0],p:{toneExposure:Infinity}}]},{...valid,components:[{...valid.components[0],p:{toneLocalColor:'javascript:alert(1)'}}]},{...valid,components:[{...valid.components[0],targetIntent:{role:'subject',adaptive:true,baseline:{p:{mask:new Uint8Array(4)}}}}]}];
 for(const bad of cases)assert.throws(()=>R.validate(bad));
 assert.throws(()=>R.decode(JSON.stringify(valid).replace('"p":{','"p":{"__proto__":{"polluted":true},')));assert.equal({}.polluted,undefined);
 assert.throws(()=>R.decode('{bad json'));assert.throws(()=>R.decode(' '.repeat(R.MAX_BYTES+1)));
});
test('import bounds cover every native numeric layer control without discarding supported values',()=>{
 const native=require('../dist/darkroom/effect-layers.js');for(const [key,range]of Object.entries(native.valueLimits)){
  for(const value of range){const p=plan();p.components[0].p={[key]:value};assert.equal(R.create(p).components[0].p[key],value,key);}
 }
});
test('malformed geometry, excessive regions, ambiguous IDs and unsupported stroke data are rejected',()=>{
 const valid=R.create(plan()),c=valid.components[0],bad=[{...c,focus:{cx:.5,cy:.5,rx:0,ry:.2}},{...c,sun:{x:Infinity,y:.1}},{...c,p:{adjustRegionStrokes:[{mode:'lasso',size:.1,points:[[NaN,.2]]}]}},{...c,p:{adjustRegionStrokes:[{mode:'paint',size:.1,points:[[.2,.3]],open:true}]}},{...c,p:{brushStrokes:[{mode:'paint',size:.1,softness:.5,points:[[.2,.3]],image:'pixels'}]}},{...c,p:{adjustRegionStack:Array.from({length:33},()=>({adjustRegion:'in'}))}},{...c,targetIntent:{role:'background',adaptive:true}}];
 for(const component of bad)assert.throws(()=>R.validate({...valid,components:[component]}));
 assert.throws(()=>R.validate({...valid,components:[c,c]}));assert.throws(()=>R.validate({...valid,components:Array.from({length:33},(_,i)=>({...c,id:'part-'+i}))}));
});
test('the recipe module is usable in a browser realm without storage or engine side effects',()=>{
 const context={TextEncoder};vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../dist/darkroom/ai-composer-recipes.js'),'utf8'),context);
 const recipe=context.RayAIComposerRecipes.create(plan());assert.equal(recipe.style,'natural');assert.equal(context.RayAIComposerRecipes.validate(recipe).components.length,1);
});
test('offline recipe saving uses an isolated store and independent IDs, preserving edits as deep copies',async()=>{
 const f=fixture(),s=R.store(f.factory),input=R.create(plan()),first=await s.put({id:'one',recipe:input,created:123}),second=await s.put({id:'two',recipe:R.create(plan(),{name:'Thử khác'})});
 input.components[0].p.toneLocalEV=1.9;first.recipe.components[0].p.toneLocalEV=-1.8;
 assert.equal((await s.get('one')).recipe.components[0].p.toneLocalEV,.65);assert.equal((await s.get('two')).recipe.name,'Thử khác');assert.deepEqual(f.opened,[['ray-photo-ai-composer',1]]);assert.deepEqual(f.created,[['presets',{keyPath:'id'}]]);
 assert.notEqual(first.id,second.id);assert.equal((await s.all()).length,2);await s.remove('one');assert.equal(await s.get('one'),undefined);assert.equal((await s.get('two')).id,'two');
});
test('updating one saved recipe preserves its creation time and unrelated recipes',async()=>{
 const f=fixture(),s=R.store(f.factory),recipe=R.create(plan());await s.put({id:'one',recipe,created:123});await s.put({id:'two',recipe,created:456});const next=await s.put({id:'one',name:'Đã sửa tên',recipe,created:999});
 assert.equal(next.created,123);assert.equal((await s.get('one')).recipe.name,'Đã sửa tên');assert.equal((await s.get('two')).created,456);assert.equal(f.rows.size,2);
});
test('invalid recipes are rejected before opening storage and quota errors preserve existing work',async()=>{
 const f=fixture(),s=R.store(f.factory);await assert.rejects(s.put({recipe:{}}));assert.equal(f.opened.length,0);await s.put({id:'keep',recipe:R.create(plan())});f.failWrite=true;
 await assert.rejects(s.put({id:'next',recipe:R.create(plan())}),/xuất JSON/);assert.equal(f.rows.size,1);assert.equal((await s.get('keep')).id,'keep');
});
test('blocked or failed storage can retry and database changes release only the Composer connection',async()=>{
 const f=fixture(),s=R.store(f.factory);f.failOpen=true;await assert.rejects(s.all());f.failOpen=false;await s.put(R.create(plan()));assert.equal(f.opened.length,2);f.db.onversionchange();assert.equal(f.closed,1);await s.all();assert.equal(f.opened.length,3);
 const blocked=fixture(),b=R.store(blocked.factory);blocked.blocked=true;await assert.rejects(b.open(),/đóng tab/);await new Promise(resolve=>setImmediate(resolve));assert.equal(blocked.closed,1);blocked.blocked=false;await b.open();assert.equal(blocked.opened.length,2);await assert.rejects(R.store(null).all(),/kho trên thiết bị/);
});
test('backlight formulas use the same full recipe format and retain all nine prior style IDs',()=>{
 const legacy=['auto-beauty','natural','cinematic','golden-hour','vintage-film','editorial','soft-dream','moody','creative'];
 for(const style of [...legacy,'backlight','restore-detail','film-recovery']){const input={...plan(),style},saved=R.create(input,{name:style==='backlight'?'Cứu ngược sáng':'Công thức đã lưu'}),restored=R.decode(R.encode(saved));assert.equal(restored.style,style);assert.equal(restored.version,1);assert.deepEqual(restored.components,saved.components);}
 assert.deepEqual(R.styles.filter(s=>!['backlight','restore-detail','film-recovery'].includes(s)),legacy);
});
test('face recovery summaries round trip as bounded measurements without images or raster masks',()=>{
 const face={focus:{cx:.5,cy:.3,rx:.06,ry:.1},mean:.18,p10:.08,p90:.35,texture:.025,noise:.01,warmCast:-.08,tintCast:.02,confidence:1},input={...plan(),style:'restore-detail',analysis:{mean:.5,recognition:'ai',recovery:{version:1,faces:[face]}}},saved=R.create(input),restored=R.decode(R.encode(saved));
 assert.deepEqual(restored.analysis.recovery,input.analysis.recovery);face.mean=.7;assert.equal(saved.analysis.recovery.faces[0].mean,.18);
 for(const bad of [{version:2,faces:[]},{version:1,faces:Array(4).fill(restored.analysis.recovery.faces[0])},{version:1,faces:[{...restored.analysis.recovery.faces[0],noise:NaN}]},{version:1,faces:[{...restored.analysis.recovery.faces[0],focus:{cx:1.1,cy:.3,rx:.06,ry:.1}}]},{version:1,faces:[{...restored.analysis.recovery.faces[0],p10:.9,p90:.1}]},{version:1,faces:[],pixels:[255]}])assert.throws(()=>R.validate({...restored,analysis:{...restored.analysis,recovery:bad}}));
});
test('adaptive light/color zone summaries are optional, bounded and portable while older formulas remain valid',()=>{
 const zone={mean:.28,p10:.07,p90:.71,shadowCoverage:.42,highlightCoverage:.02,texture:.025,noise:.008,neutralCoverage:.19,neutralWarmCast:-.06,neutralTintCast:.04},input={...plan(),style:'restore-detail',analysis:{mean:.45,recovery:{version:1,faces:[],zones:{subject:zone,background:{...zone,mean:.7}}}}},saved=R.create(input),restored=R.decode(R.encode(saved));assert.deepEqual(restored.analysis.recovery.zones,input.analysis.recovery.zones);zone.mean=.9;assert.equal(saved.analysis.recovery.zones.subject.mean,.28);
 const older=structuredClone(restored);delete older.analysis.recovery.zones;assert.doesNotThrow(()=>R.validate(older));
 for(const mutate of [v=>{v.zones.subject.noise=NaN;},v=>{v.zones.background.neutralTintCast=-1.1;},v=>{v.zones.subject.photo='data:image/png';},v=>{delete v.zones.background;},v=>{v.zones.subject.p10=.95;v.zones.subject.p90=.2;}]){const bad=structuredClone(restored);mutate(bad.analysis.recovery);assert.throws(()=>R.validate(bad));}
});
test('whole-scene subregion summaries round trip without weakening the bounded data-only schema',()=>{
 const Core=require('../dist/darkroom/ai-composer-core.js'),W=120,H=90,data=new Uint8ClampedArray(W*H*4);for(let y=0;y<H;y++)for(let x=0;x<W;x++)data.set([...(y<45?(x>75&&y>10&&y<30?[228,230,234]:[105,175,235]):x<65?[50,100,65]:[100,120,145]),255],(y*W+x)*4);const a=Core.analyze(data,W,H),p=Core.generate(a,{style:'natural',seed:42,presets:[{id:'goc',name:'Gốc',p:{}}]})[0],saved=R.create(p),restored=R.decode(R.encode(saved));for(const key of ['clouds','vegetation','terrain'])assert.deepEqual(restored.analysis.palette[key],a.palette[key]);
 const legacy=structuredClone(saved);for(const key of ['clouds','vegetation','terrain'])delete legacy.analysis.palette[key];assert.doesNotThrow(()=>R.validate(legacy));for(const mutate of [v=>{v.clouds.photo='data:image/png';},v=>{v.vegetation.mean=NaN;},v=>{v.terrain.p.temp=.2;},v=>{v.clouds.focus.cx=1.1;},v=>{v.subjectPixels=[1];}]){const bad=structuredClone(saved);mutate(bad.analysis.palette);assert.throws(()=>R.validate(bad));}
});
