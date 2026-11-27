const {test}=require('node:test'),assert=require('node:assert/strict');
const Core=require('../dist/darkroom/ai-composer-core.js'),Recipes=require('../dist/darkroom/ai-composer-recipes.js');
const published=['auto-beauty','backlight','restore-detail','film-recovery','natural','cinematic','golden-hour','vintage-film','editorial','soft-dream','moody','creative'];
function analysis(){const W=32,H=32,data=new Uint8ClampedArray(W*H*4);for(let y=0;y<H;y++)for(let x=0;x<W;x++)data.set([70+x,85+y,105,255],(y*W+x)*4);return Core.analyze(data,W,H);}
test('the style picker merges the two rescue choices while every published recipe ID stays supported',()=>{
 assert.deepEqual(Core.styles.map(style=>style.id),published);assert.deepEqual(Core.STYLES.map(style=>style.id),published);
 const visible=Core.getVisibleStyles();assert.equal(visible.length,11);assert.equal(new Set(visible.map(style=>style.id)).size,11);assert.equal(visible.some(style=>style.id==='backlight'),false);
 const rescue=visible.find(style=>style.id==='restore-detail');assert.equal(rescue.name,'Cứu sáng & nét');assert.deepEqual(rescue.aliases,['backlight']);assert.equal(Core.styleCuration.backlight.canonicalId,rescue.id);
 const a=analysis();for(const style of published){const plan=Core.generate(a,{style,seed:177,presets:[]})[0],saved=Recipes.decode(Recipes.encode(Recipes.create(plan)));assert.equal(plan.style,style);assert.equal(saved.style,style);assert.ok(plan.id.includes('-'+style+'-'));}
});
test('consumer changes to visible labels and aliases do not alter future choices or legacy styles',()=>{
 const first=Core.getVisibleStyles(),rescue=first.find(style=>style.id==='restore-detail');rescue.name='Changed';rescue.aliases.push('unknown');first.pop();
 const next=Core.getVisibleStyles();assert.equal(next.length,11);assert.equal(next.find(style=>style.id==='restore-detail').name,'Cứu sáng & nét');assert.deepEqual(next.find(style=>style.id==='restore-detail').aliases,['backlight']);assert.equal(Core.styles.find(style=>style.id==='backlight').name,'Cứu ngược sáng');
});
function portrait(mixed=false){const W=64,H=80,data=new Uint8ClampedArray(W*H*4),foreground=new Uint8Array(W*H),skin=new Uint8Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x,person=x>12&&x<52&&y>8,face=x>25&&x<40&&y>15&&y<35,color=mixed?(y<24?[30,20,18]:[125,85,70]):[65,45,38];data.set([...(face?color:person?[85,90,95]:[165,175,185]),255],i*4);foreground[i]=person?255:0;skin[i]=face?255:0;}return Core.analyze(data,W,H,{maps:{width:W,height:H,foreground,skin},faces:[[{x:.39,y:.19},{x:.63,y:.19},{x:.63,y:.44},{x:.39,y:.44}]]});}
test('old color formulas acquire adaptive face light while a newly deleted face layer stays deleted',()=>{
 const a=portrait(),plan=Core.generate(a,{style:'natural',seed:177,presets:[]})[0],saved=Recipes.create(plan);assert.ok(saved.components.some(c=>c.id==='face-0'));assert.equal(saved.analysis.recovery.personLightVersion,1);
 const removed=JSON.parse(JSON.stringify(saved));removed.components=removed.components.filter(c=>!c.id.startsWith('face-'));const legacy=JSON.parse(JSON.stringify(removed));delete legacy.analysis.recovery.personLightVersion;for(const face of legacy.analysis.recovery.faces)delete face.channelP95;
 assert.doesNotThrow(()=>Recipes.decode(Recipes.encode(legacy)));assert.ok(Core.adapt(legacy,a,{presets:[]}).components.some(c=>c.id==='face-0'),'an old color recipe gains local face recovery');assert.equal(Core.adapt(removed,a,{presets:[]}).components.some(c=>c.id==='face-0'),false,'the new strategy marker preserves an explicit deletion');
 const invalid=JSON.parse(JSON.stringify(saved));invalid.analysis.recovery.personLightVersion=2;assert.throws(()=>Recipes.validate(invalid));invalid.analysis.recovery.personLightVersion=1;invalid.analysis.recovery.faces[0].channelP95=1.1;assert.throws(()=>Recipes.validate(invalid));
});
test('skin and face-shadow vector geometry round trips and rejects malformed or unrelated effect data',()=>{
 const a=portrait(true),saved=Recipes.create(Core.generate(a,{style:'restore-detail',seed:177,presets:[]})[0]),face=saved.analysis.recovery.faces[0];
 assert.equal(face.region.adjustRegionShape,'freehand');assert.ok(face.region.adjustRegionStrokes[0].points.length>3);assert.equal(face.shadowRegion.adjustRegionShape,'freehand');
 assert.deepEqual(Recipes.decode(Recipes.encode(saved)),saved);
 for(const mutate of [f=>{f.region.adjustRegion='out';},f=>{f.region.adjustRegionShape='ellipse';},f=>{f.region.adjustRegionStrokes[0].points[0][0]=Infinity;},f=>{f.region.toneExposure=1;},f=>{f.shadowRegion.adjustRegionStrokes[0].mode='unknown';},f=>{f.shadowRegion.adjustRegionRX=0;}]){
  const invalid=structuredClone(saved);mutate(invalid.analysis.recovery.faces[0]);assert.throws(()=>Recipes.validate(invalid));
 }
});
test('a removed face-shadow layer stays removed while manual face edits survive same-photo adaptation',()=>{
 const a=portrait(true),saved=Recipes.create(Core.generate(a,{style:'natural',seed:177,presets:[]})[0]);assert.ok(saved.components.some(c=>c.id==='face-shadow-0'));
 saved.components=saved.components.filter(c=>c.id!=='face-shadow-0');const face=saved.components.find(c=>c.id==='face-0');face.p.filmExp=Math.max(0,face.p.filmExp-.07);face.enabled=false;
 const next=Core.adapt(saved,a,{presets:[]});assert.equal(next.components.some(c=>c.id==='face-shadow-0'),false);const adapted=next.components.find(c=>c.id==='face-0');assert.equal(adapted.enabled,false);assert.ok(Math.abs(adapted.p.filmExp-face.p.filmExp)<.00001);assert.deepEqual(adapted.p.adjustRegionStrokes,face.p.adjustRegionStrokes);assert.doesNotThrow(()=>Recipes.create(next));
});
test('adaptive face layers do not float onto a new photo with no detected face',()=>{
 const a=portrait(true),noFace=analysis();assert.equal(noFace.recovery.faces.length,0);
 for(const style of ['restore-detail','natural','film-recovery']){const saved=Recipes.create(Core.generate(a,{style,seed:177,presets:[]})[0]);assert.ok(saved.components.some(c=>c.id==='face-0'),style);assert.equal(Core.adapt(saved,noFace,{presets:[]}).components.some(c=>c.id.startsWith('face-')),false,style);
  const manual=structuredClone(saved),face=manual.components.find(c=>c.id==='face-0');face.targetIntent.adaptive=false;assert.ok(Core.adapt(manual,noFace,{presets:[]}).components.some(c=>c.id==='face-0'),'explicitly manual face geometry remains under user control');}
});
test('adapting a pre-person-light face formula upgrades its automatic curve and preserves manual deltas and disabled state',()=>{
 const a=portrait(true),fresh=Core.generate(a,{style:'restore-detail',seed:177,presets:[]})[0],saved=Recipes.create(fresh),original=saved.components.find(c=>c.id==='face-0');
 delete saved.analysis.recovery.personLightVersion;for(const face of saved.analysis.recovery.faces){delete face.channelP95;delete face.region;delete face.shadowRegion;}
 saved.components=saved.components.filter(c=>!c.id.startsWith('face-shadow-'));const legacyP={...original.targetIntent.baseline.p,toneExposure:1.3,filmExp:0,toneShadows:.025,toneBrightness:0};original.targetIntent.baseline.p=structuredClone(legacyP);original.p={...legacyP,toneExposure:1.37,filmExp:.05};original.enabled=false;
 const next=Core.adapt(saved,a,{presets:[]}),face=next.components.find(c=>c.id==='face-0'),reference=Core.generate(a,{style:'restore-detail',seed:saved.seed,presets:[],keepNeutralComponents:true})[0].components.find(c=>c.id==='face-0');
 assert.equal(face.enabled,false);assert.ok(Math.abs(face.p.toneExposure-(reference.p.toneExposure+.07))<.00001);assert.ok(Math.abs(face.p.filmExp-Math.min(1,reference.p.filmExp+.05))<.00001);assert.equal(face.p.toneShadows,reference.p.toneShadows);assert.deepEqual(face.targetIntent.baseline,reference.targetIntent.baseline);assert.deepEqual(face.p.adjustRegionStrokes,reference.p.adjustRegionStrokes);assert.equal(next.components.find(c=>c.id==='face-shadow-0').enabled,false);assert.doesNotThrow(()=>Recipes.create(next));
 const deleted=structuredClone(saved);deleted.components=deleted.components.filter(c=>!c.id.startsWith('face-'));assert.equal(Core.adapt(deleted,a,{presets:[]}).components.some(c=>c.id.startsWith('face-')),false,'a deleted legacy rescue face is not restored');
 const withoutBaseline=structuredClone(saved),untracked=withoutBaseline.components.find(c=>c.id==='face-0');delete untracked.targetIntent.baseline;const conservative=Core.adapt(withoutBaseline,a,{presets:[]}).components.find(c=>c.id==='face-0');assert.ok(Math.abs(conservative.p.toneExposure-untracked.p.toneExposure)<.00001,'a baseline-less legacy value cannot be distinguished from a manual edit');
});
