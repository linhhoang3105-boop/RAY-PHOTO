const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const rules=()=>import('../dist/darkroom/preset-rules.mjs');
const stroke={mode:'paint',size:.15,softness:.7,points:[[.2,.4],[.6,.8]]};
const snap=(p={},layers=[])=>({p,focus:{cx:.4},sun:{x:.2},leak:{x:.9},layers,body:[{x:.5}],beauty:{values:{hair:.8},people:[],faces:[],ready:{}},compose:{texts:[{text:'riêng tư'}]},key:JSON.stringify([p,layers])});
test('every retained filter and the two new colors are valid free reusable recipes',async()=>{
 const R=await rules(),html=fs.readFileSync(path.join(__dirname,'../dist/darkroom/index.html'),'utf8'),old=vm.runInNewContext('('+html.match(/const ROLLS = (\[[\s\S]*?\n\]);/)[1]+')'),catalog=require('../dist/darkroom/preset-catalog.js').extend(old);
 for(const preset of catalog){const recipe=R.capture(snap(preset.p),preset.name);assert.equal(R.advanced(recipe),false,preset.name);assert.equal(recipe.name,preset.name);assert.ok(recipe.layers.every(p=>!('frame'in p)));}
});
test('portable color recipes keep layer order but exclude photos, dates, faces, region coordinates and strokes',async()=>{
 const R=await rules(),original=snap({temp:.3,dateText:'private',frame:'film',toneLocalEV:1,brushEV:.8,brushSize:.15,brushSoftness:.7,brushStrokes:[stroke]},[{p:{temp:.1,sat:.2},focus:{cx:.2},sun:{x:.3},leak:{x:.4}}]),before=structuredClone(original),r=R.capture(original,'Màu Linh');
 assert.equal(r.layers.length,2);assert.equal(r.layers[0].temp,.1);assert.equal(r.layers[1].temp,.3);assert.deepEqual(r.tools.brush,{ev:.8,size:.15,softness:.7});assert.equal(R.advanced(r),true);
 const json=JSON.stringify(r);for(const text of ['brushStrokes','points','dateText','private','faces','body','texts','frame','cx'])assert.equal(json.includes(text),false,text);assert.deepEqual(original,before);
 const basic=R.basicRecipe(r);assert.equal(R.advanced(basic),false);assert.deepEqual(basic.layers,r.layers);assert.ok(r.tools);
});
test('foreign fields, non-finite values, malformed versions and oversized recipes are rejected before import',async()=>{
 const R=await rules(),base={version:1,name:'Linh',layers:[{temp:.2}]};
 for(const bad of [{...base,photo:'data:image/jpeg;base64,x'},{...base,premium:true},{...base,layers:[{body:{}}]},{...base,layers:[{temp:Infinity}]},{...base,layers:[{sat:99}]},{...base,version:2},{...base,name:'x'.repeat(49)},{...base,layers:Array.from({length:33},()=>({temp:.1}))},{...base,tools:{brush:{ev:.3,size:.1,softness:.5,points:[[.2,.3]]}}},JSON.parse('{"version":1,"name":"Linh","layers":[{"__proto__":{"photo":1}}]}')])assert.throws(()=>R.validate(bad));
 assert.equal(R.cleanCode('0123 4567'),'01234567');assert.throws(()=>R.cleanCode('<script>'));assert.equal(R.nameOf('  Ngọc Diệp  '),'Ngọc Diệp');
});
test('a basic draft is a separate recipe branch retaining all non-Premium edits, undo, redo and layer order',async()=>{
 const R=await rules(),advanced=snap({toneExposure:.3,brushEV:.8,brushStrokes:[stroke]},[{p:{temp:.4,brushEV:-.6,brushStrokes:[stroke]},title:'Nắng'}]),initial=snap({temp:.1}),keyOf=s=>JSON.stringify({p:s.p,layers:s.layers,body:s.body,compose:s.compose});advanced.key=keyOf(advanced);initial.key=keyOf(initial);
 const state={version:1,history:{entries:[{snapshot:initial,label:'Gốc'},{snapshot:advanced,label:'Bút vùng'},{snapshot:snap({tint:.2}),label:'Bước sau'}],cursor:1},current:advanced,stageBase:advanced,appliedKey:advanced.key,tool:'adjust'},before=structuredClone(state),basic=R.basicDraft(state,keyOf);
 assert.deepEqual(state,before);assert.equal(basic.history.cursor,1);assert.equal(R.projectAdvanced(basic.current),false);assert.equal(R.projectAdvanced(state.current),true);assert.equal(basic.history.entries.length,3);assert.equal(R.projectAdvanced(basic.history.entries[1].snapshot),false);assert.equal(R.projectAdvanced(state.history.entries[1].snapshot),true);assert.equal(basic.stageBase.p.toneExposure,.3);assert.equal(basic.stageBase.layers[0].p.temp,.4);assert.deepEqual(basic.stageBase.compose,advanced.compose);assert.deepEqual(basic.stageBase.body,advanced.body);assert.equal(basic.appliedKey,basic.stageBase.key);
});
