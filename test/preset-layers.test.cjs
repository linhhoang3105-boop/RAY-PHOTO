const{test}=require('node:test'),assert=require('node:assert/strict');
const rules=()=>import('../dist/darkroom/preset-rules.mjs');
const stroke={mode:'paint',points:[[.2,.3],[.7,.8]],size:.12,softness:.6};
const layer=(title,p,enabled=true)=>({title,enabled,p,focus:{cx:.4,cy:.4,rx:.2,ry:.3},sun:{x:.5,y:.04},leak:{x:.1,y:.1}});
test('A+B+C+D+sun+exposure saves a Free recipe whose individual layers can lose B and D and gain E',async()=>{
 const R=await rules(),full={p:{brushEV:.8,brushSize:.12,brushSoftness:.6,brushStrokes:[stroke]},layers:[layer('A',{temp:.1}),layer('B',{tint:.1}),layer('C',{contrast:.2}),layer('D',{grain:.1}),layer('Nắng',{nang:.3}),layer('Tăng sáng',{toneExposure:.4})]},before=structuredClone(full),original=R.capture(full,'Màu đang thử'),basic=R.basicRecipe(original);
 assert.equal(R.advanced(original),true);assert.equal(R.advanced(basic),false);assert.deepEqual(basic.layerMeta.map(s=>s.title),['A','B','C','D','Nắng','Tăng sáng']);
 const keep=[0,2,4,5],edited=R.validate({...basic,layers:[...keep.map(i=>basic.layers[i]),{sat:.25}],layerMeta:[...keep.map(i=>basic.layerMeta[i]),{title:'E',enabled:true,basePreset:'goc'}]});
 assert.deepEqual(edited.layerMeta.map(s=>s.title),['A','C','Nắng','Tăng sáng','E']);assert.equal(edited.layers[3].toneExposure,.4);assert.equal(edited.layers[2].nang,.3);assert.deepEqual(full,before);assert.ok(original.tools.brush);assert.ok(!JSON.stringify(edited).includes('points'));
});
test('the four Premium groups strip from a separate basic draft while every free adjustment and old free preset survives',async()=>{
 const R=await rules(),p={rayBasePreset:'ngocdiep',temp:.1,printClear:.18,paper:.45,bgBlur:.4,motion:.2,rgAtmos:'out',toneLocalEV:.8,toneLocalWarmth:.2,brushEV:.7,brushStrokes:[stroke],toneExposure:.5,nang:.25,spark:.2,grain:.1,frame:'film',stamp:true},s={p,layers:[layer('Lớp trước',{toneBrightness:.2,toneLocalEV:-.5,gloss:.5})],key:'original'},state={history:{entries:[{snapshot:s,label:'Đang chỉnh'}],cursor:0},stageBase:s,current:s,appliedKey:'original'},before=structuredClone(state),basic=R.basicDraft(state,s=>JSON.stringify([s.p,s.layers]));
 assert.equal(R.projectAdvanced(s),true);assert.equal(R.projectAdvanced(basic.current),false);for(const k of ['paper','bgBlur','motion','toneLocalEV','toneLocalWarmth'])assert.equal(basic.current.p[k],0);assert.equal(basic.current.p.printClear,.18);for(const k of ['temp','toneExposure','nang','spark','grain','frame','stamp'])assert.equal(basic.current.p[k],p[k]);assert.equal(basic.current.layers[0].p.toneBrightness,.2);assert.deepEqual(state,before);
 for(const effect of [{toneLocalEV:.2},{brushEV:.4,brushStrokes:[stroke]},{paper:.3},{bgBlur:.1}])assert.equal(R.projectAdvanced({p:effect}),true);
 assert.equal(R.projectAdvanced({p:{},layers:[layer('Ẩn',{paper:.5},false)]}),false);
});
test('free preset provenance permits only its existing print values and cannot authorize new Premium values',async()=>{
 const R=await rules(),base={version:1,name:'Màu Free',layers:[{printClear:.18,temp:.3}],layerMeta:[{title:'Ngọc Diệp',enabled:true,basePreset:'ngocdiep'}]};
 assert.equal(R.advanced(base),false);assert.equal(R.advanced({...base,layers:[{printClear:.9,temp:.3}]}),true);assert.equal(R.basicRecipe({...base,layers:[{printClear:.9,temp:.3}]}).layers[0].printClear,.18);
 assert.throws(()=>R.validate({...base,layerMeta:[{...base.layerMeta[0],basePreset:'forged'}]}));assert.throws(()=>R.validate({...base,layerMeta:[]}));assert.throws(()=>R.validate({...base,layerMeta:[{...base.layerMeta[0],photo:'private'}]}));
 const disabled={...base,layerMeta:[{...base.layerMeta[0],enabled:false}]};assert.equal(R.validate(disabled).layerMeta[0].enabled,false);
});
test('Premium-only layers disappear from the basic formula and draft instead of becoming empty filter chips',async()=>{
 const R=await rules(),recipe={version:1,name:'Linh',layers:[{temp:.2},{paper:.5}],layerMeta:[{title:'A',enabled:true,basePreset:'goc'},{title:'Ảnh in',enabled:true,basePreset:'goc'}]},basic=R.basicRecipe(recipe);assert.equal(basic.layers.length,1);assert.equal(basic.layerMeta[0].title,'A');assert.equal(recipe.layers.length,2);assert.equal(R.basicLayer(layer('Vùng nét',{bgBlur:.2})),null);assert.equal(R.basicLayer(layer('Bút',{brushEV:.7,brushStrokes:[stroke]})),null);assert.equal(R.basicLayer(layer('Nắng và bút',{nang:.3,brushEV:.7,brushStrokes:[stroke]})).p.nang,.3);
});
