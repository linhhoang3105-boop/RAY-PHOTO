const {test}=require('node:test'),assert=require('node:assert/strict');
const Layers=require('../dist/darkroom/effect-layers.js');
const model=()=>import('../dist/darkroom/layer-parameters.mjs');
test('editing one stored layer retains all masks, its position, visibility and the current photo data',()=>{
 const a={id:'a',title:'Tất cả',enabled:false,p:{toneBrightness:.1,temp:.2,adjustRegion:'out',adjustRegionShape:'freehand',adjustRegionStrokes:[{mode:'lasso',open:false,size:.006,points:[[.1,.1],[.8,.1],[.5,.8]]}],adjustRegionStack:[{adjustRegion:'in',adjustRegionX:.3}],toneLocalColor:'#b070f1'},focus:{cx:.2},sun:{x:.8},leak:{y:.7}},b={id:'b',p:{grain:.2},title:'B'};
 const all=[a,b],before=structuredClone(all),next=Layers.withValues(all,'a',{toneBrightness:0,temp:-.34,grain:.18,toneExposure:.65});
 assert.deepEqual(all,before);assert.equal(next.length,2);assert.equal(next[1],b);assert.equal(next[0].id,'a');assert.equal(next[0].enabled,false);assert.equal(next[0].focus,a.focus);assert.equal(next[0].p.adjustRegionStrokes,a.p.adjustRegionStrokes);assert.equal(next[0].p.adjustRegionStack,a.p.adjustRegionStack);assert.equal(next[0].p.toneLocalColor,'#b070f1');assert.equal(next[0].p.toneBrightness,0);
 assert.equal(Layers.withValues(next,'missing',{temp:.2}),next);assert.equal(Layers.withValues(next,'a',{temp:-.34}),next);
});
test('a parameter edit cannot inject other state, NaN, strings or out-of-range values',()=>{
 const all=[{id:'a',p:{temp:0}}];
 for(const p of [{photo:1},{adjustRegionX:.5},{temp:NaN},{grain:2},{temp:'0.5'},{toneExposure:3},{toneLocalEV:-3}])assert.throws(()=>Layers.withValues(all,'a',p));
 assert.equal(all[0].p.temp,0);
});
test('parameter descriptions show neutral values and resets relative to the actual base preset',async()=>{
 const {describeLayer,formatValue}=await model(),{bases}=await import('../dist/darkroom/preset-bases.mjs'),base=bases.find(b=>b.p.temp>0&&b.p.contrast>0),p={...base.p,temp:0,toneExposure:.65,toneBrightness:-.12,sat:-.3,rayBasePreset:base.id},before=structuredClone(p),d=describeLayer({p,title:'Tất cả'});
 assert.equal(d.title,'Điều chỉnh');assert.equal(d.baseName,base.names.at(-1));const rows=Object.fromEntries(d.rows.map(r=>[r.key,r]));assert.equal(rows.temp.changed,true);assert.equal(rows.temp.value,0);assert.equal(rows.toneExposure.formatted,'+0.65 EV');assert.equal(rows.toneBrightness.formatted,'-12');assert.equal(rows.sat.formatted,'-30');assert.equal(rows.toneHighlights.value,0);assert.equal(formatValue(1.25,{scale:1,unit:'°'}),'+1.25°');assert.deepEqual(p,before);
 for(const key of ['toneExposure','toneBrightness','contrast','toneHighlights','toneShadows','toneWhites','toneBlacks','temp','tint','split','sat','lift','grain','sharp','dust','halation'])assert.ok(rows[key],key);
 const brush=describeLayer({p:{brushEV:.6,brushSize:.12,brushSoftness:.65}}).rows.filter(r=>r.group==='Bút ánh sáng');assert.ok(brush.every(r=>!r.active&&!r.changed));
});
test('the recipe save/reopen values include every basic and film slider after editing an applied layer',async()=>{
 const R=await import('../dist/darkroom/preset-rules.mjs'),{describeLayer}=await model();
 const values={toneExposure:.43,toneBrightness:-.12,toneHighlights:.21,toneShadows:-.13,toneWhites:.24,toneBlacks:-.14,contrast:.32,temp:-.2,tint:.12,split:.23,sat:-.33,lift:.14,grain:.34,sharp:.15,glow:.16,kinh:.17,filmExp:.18,halation:.19,flash:.2,vignette:.21,dust:.22,ca:.23,paper:.24,gloss:.25,soft:.26,ptex:.27,film:.28,printClear:.29};
 const initial=[{id:'x',title:'Màu phim',enabled:true,p:{temp:.7,contrast:.6},focus:{cx:.5},sun:{x:.6},leak:{x:.4}}],edited=Layers.withValues(initial,'x',values),recipe=R.validate(R.capture({layers:edited,p:{sat:0}},'Màu cụ thể')),restored={...R.defaults,...recipe.layers[0]};
 for(const [key,v]of Object.entries(values))assert.equal(restored[key],v,key);
 const d=describeLayer({p:restored,title:recipe.layerMeta[0].title},{basePreset:recipe.layerMeta[0].basePreset,portable:true});for(const [key,v]of Object.entries(values))assert.equal(d.rows.find(r=>r.key===key).value,v,key);
 assert.equal(initial[0].p.temp,.7);
});
test('inside/outside descriptions retain drawn and nested regions with disabled layers',async()=>{
 const {describeLayer}=await model(),d=describeLayer({title:'Màu phim',enabled:false,p:{adjustRegion:'out',adjustRegionShape:'freehand',adjustRegionStrokes:[{points:[[0,0]]}],adjustRegionStack:[{adjustRegion:'in',adjustRegionShape:'rect'}]}});
 assert.equal(d.enabled,false);assert.match(d.region,/Ngoài vùng · Vẽ tự do · 1 nét/);assert.match(d.region,/Giới hạn thêm: Trong vùng · Chữ nhật/);
});
