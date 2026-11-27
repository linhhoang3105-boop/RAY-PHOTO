const {test}=require('node:test'),assert=require('node:assert/strict');

async function fixture(p={temp:.2,toneBrightness:.15}){
 const {saveCreativeSnapshot}=await import('../dist/darkroom/creative-save.mjs'),records=new Map(),forks=[];
 const snapshot={p,layers:[{p:{sat:.12},title:'A',enabled:true}],preset:'goc'},before=structuredClone(snapshot);
 const state={version:1,current:snapshot,history:{cursor:1,entries:[{snapshot:structuredClone(snapshot),label:'A + sáng'}]}};
 let saved=0;
 const store={all:async()=>[...records.values()].map(record=>structuredClone(record)),put:async record=>records.set(record.id,structuredClone(record))};
 const session={documentKey:'photo-1',ensureSaved:async()=>{saved++;},snapshot:()=>snapshot,serialize:()=>state,forkDraft:async(s,label,options)=>{forks.push({state:structuredClone(s),label,options});return 'kept-photo-'+forks.length;}};
 return{saveCreativeSnapshot,records,forks,snapshot,before,state,store,session,get saved(){return saved;}};
}

test('one tap saves named color layers locally; subsequent saves create independent numbered formulas',async()=>{
 const h=await fixture(),poster=new Blob(['preview'],{type:'image/jpeg'}),first=await h.saveCreativeSnapshot({store:h.store,session:h.session,preview:()=>poster});
 assert.equal(first.name,'Công thức 01');assert.equal(first.recipe.layers.length,2);assert.equal(first.recipe.layers[0].sat,.12);assert.equal(first.recipe.layers[1].toneBrightness,.15);assert.equal(first.code,null);assert.equal(first.requiresPremium,false);assert.equal(first.thumbnail,poster);assert.equal(h.saved,1);assert.deepEqual(h.snapshot,h.before);assert.equal(h.forks.length,0);
 h.snapshot.p.temp=.7;const renamed=h.records.get(first.id);renamed.name='Màu đã đổi tên';renamed.recipe.name=renamed.name;
 const second=await h.saveCreativeSnapshot({store:h.store,session:h.session});
 assert.equal(second.name,'Công thức 02');assert.notEqual(second.id,first.id);assert.equal(h.records.get(first.id).recipe.layers[1].temp,.2);assert.equal(second.recipe.layers[1].temp,.7);assert.equal(h.records.size,2);
});

test('local edits keep a full photo draft while the complete formula is immediately free to use',async()=>{
 const strokes=[{mode:'paint',points:[[.2,.3],[.4,.6]],size:.1,softness:.7}],h=await fixture({temp:.2,brushEV:.8,brushSize:.1,brushSoftness:.7,brushStrokes:strokes,bgBlur:.3});
 const record=await h.saveCreativeSnapshot({store:h.store,session:h.session});
 assert.equal(record.draft,false);assert.equal(record.requiresPremium,false);assert.equal(record.photoHasLocalEdits,true);assert.equal(record.photoDraftId,'kept-photo-1');assert.equal(h.forks.length,1);assert.equal(h.forks[0].options.advancedDraft,true);assert.deepEqual(h.forks[0].state.current.p.brushStrokes,strokes);assert.equal(h.forks[0].state.history.cursor,1);assert.equal(record.recipe.tools.brush.ev,.8);assert.equal(JSON.stringify(record.recipe).includes('points'),false);
 h.snapshot.p.brushStrokes=[];h.snapshot.p.temp=-.5;
 assert.deepEqual(h.forks[0].state.current.p.brushStrokes,strokes);assert.equal(h.records.get(record.id).recipe.layers[1].temp,.2);
});

test('failed draft preservation or a replaced photo cannot create a formula from the wrong photo',async()=>{
 const h=await fixture();h.session.ensureSaved=async()=>{throw new Error('storage full');};await assert.rejects(h.saveCreativeSnapshot({store:h.store,session:h.session}),/storage full/);assert.equal(h.records.size,0);
 const other=await fixture();other.store.all=async()=>{other.session.documentKey='photo-2';return[];};await assert.rejects(other.saveCreativeSnapshot({store:other.store,session:other.session}),/Ảnh đã thay đổi/);assert.equal(other.records.size,0);assert.equal(other.forks.length,0);
});

test('optional preview failure does not lose a valid formula; storage failure is reported after the advanced draft is retained',async()=>{
 const h=await fixture();const r=await h.saveCreativeSnapshot({store:h.store,session:h.session,preview:()=>{throw new Error('canvas');}});assert.equal(r.thumbnail,null);assert.equal(h.records.size,1);
 const advanced=await fixture({toneLocalEV:1,temp:.2});advanced.store.put=async()=>{throw new Error('quota');};await assert.rejects(advanced.saveCreativeSnapshot({store:advanced.store,session:advanced.session}),/quota/);assert.equal(advanced.forks.length,1);assert.equal(advanced.forks[0].state.current.p.toneLocalEV,1);assert.deepEqual(advanced.snapshot,advanced.before);
});
test('four detailed regional layers save locally and reopen without dropping or rounding any points',async()=>{
 const {detailedSnapshot}=require('./fixtures/detailed-recipe.cjs'),R=await import('../dist/darkroom/preset-rules.mjs'),h=await fixture({});Object.assign(h.snapshot,detailedSnapshot());const original=structuredClone(h.snapshot),record=await h.saveCreativeSnapshot({store:h.store,session:h.session});
 assert.ok(new TextEncoder().encode(JSON.stringify(record.recipe)).length>32000);assert.equal(record.recipe.layers.length,4);for(let i=0;i<4;i++)assert.deepEqual(record.recipe.layers[i].adjustRegionStrokes,original.layers[i].p.adjustRegionStrokes);assert.deepEqual(h.snapshot,original);assert.deepEqual(R.validate(h.records.get(record.id).recipe),record.recipe);assert.deepEqual(R.validateShared(record.recipe),record.recipe);
});
test('a large local formula remains saved and reusable when it exceeds the separate sharing budget',async()=>{
 const {detailedSnapshot}=require('./fixtures/detailed-recipe.cjs'),R=await import('../dist/darkroom/preset-rules.mjs'),h=await fixture({});Object.assign(h.snapshot,detailedSnapshot({layers:32,points:2048}));const record=await h.saveCreativeSnapshot({store:h.store,session:h.session}),bytes=new TextEncoder().encode(JSON.stringify(record.recipe)).length;
 assert.ok(bytes>R.MAX_BYTES);assert.ok(bytes<R.MAX_LOCAL_BYTES);assert.equal(record.recipe.layers.length,32);assert.throws(()=>R.validateShared(record.recipe),/mã chia sẻ/);assert.deepEqual(R.validate(h.records.get(record.id).recipe),record.recipe);assert.equal(h.records.size,1);
});
