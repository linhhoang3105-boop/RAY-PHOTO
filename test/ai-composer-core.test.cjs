const {test}=require('node:test'),assert=require('node:assert/strict');
const Core=require('../dist/darkroom/ai-composer-core.js'),Paint=require('../dist/darkroom/region-paint-core.js');
const presets=[{id:'goc',name:'Gốc',p:{}},{id:'natural',name:'Trong',p:{temp:.04,tint:.02,contrast:.06,sat:.04,grain:.02}},{id:'warm',name:'Nắng',p:{temp:.30,tint:.03,contrast:.1,sat:.06,lift:.08,grain:.10,glow:.1}},{id:'cool',name:'Mát',p:{temp:-.20,tint:-.04,contrast:.2,sat:-.1,lift:.04}},{id:'soft',name:'Mơ',p:{temp:.08,tint:.06,contrast:-.2,sat:-.06,lift:.2,glow:.4}},{id:'deep',name:'Trầm',p:{temp:-.1,contrast:.38,sat:-.2,grain:.2,vignette:.3}},{id:'vintage',name:'Cũ',p:{temp:.16,tint:.06,contrast:-.08,sat:-.12,lift:.2,grain:.3}}];
function image(W=96,H=64,color=[100,105,110]){const data=new Uint8ClampedArray(W*H*4);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const c=typeof color==='function'?color(x,y,W,H):color;data.set([...c,255],(y*W+x)*4);}return{data,W,H};}
const analyze=(f,extra)=>Core.analyze(f.data,f.W,f.H,extra);
const plan=(a,extra)=>Core.generate(a,{style:'natural',seed:42,presets,...extra})[0];
const component=(p,id)=>p.components.find(c=>c.id===id);
function subjectFixture({left=.2,right=.6,inside=60,outside=210}={}){const f=image(100,80,(x,y,W,H)=>x/W>left&&x/W<right&&y/H>.1&&y/H<.9?[inside,inside,inside]:[outside,outside,outside]),foreground=new Uint8Array(100*80);for(let y=8;y<72;y++)for(let x=Math.floor(left*100);x<Math.floor(right*100);x++)foreground[y*100+x]=255;return{...f,maps:{width:100,height:80,foreground,skin:new Uint8Array(8000)}};}
test('analysis measures clipping, shadows, casts and alpha without changing source or recognition',()=>{
 const f=image(80,50,(x)=>x<20?[0,0,0]:x<40?[255,255,255]:[160,110,80]),before=f.data.slice(),maps={width:2,height:1,foreground:new Uint8Array([255,0]),skin:new Uint8Array([0,0])},saved=structuredClone(maps),a=analyze(f,{maps});
 assert.ok(a.clippedHighlights>.2&&a.clippedShadows>.2);assert.ok(a.warmCast>0);assert.equal(a.histogram.length,256);assert.deepEqual(f.data,before);assert.deepEqual(maps,saved);assert.ok(a.fingerprint.length>=8);
 assert.throws(()=>Core.analyze(new Uint8Array(3),1,1));
});
test('transparent samples do not skew statistics and an empty image generates neutral disabled components',()=>{
 const f=image(8,8,[255,0,0]);f.data.fill(0);const a=analyze(f),plans=Core.generate(a,{presets});assert.equal(a.empty,true);assert.equal(a.mean,0);for(const p of plans)for(const c of p.components){assert.equal(c.enabled,false);for(const k of Core.effectKeys)if(k in c.p)assert.equal(c.p[k],0);}
 const g=image(2,1,(x)=>x?[0,0,0]:[200,200,200]);g.data[7]=0;assert.ok(Math.abs(analyze(g).mean-200/255)<1e-6);
});
test('each requested style produces four bounded distinct image-adaptive alternatives',()=>{
 const a=analyze(image(90,60,(x,y)=>[40+x,40+y*2,100])),catalog=structuredClone(presets);assert.equal(Core.styles.length,12);
 for(const style of Core.styles){const plans=Core.generate(a,{style:style.id,seed:15,presets});assert.equal(plans.length,4);assert.equal(new Set(plans.map(p=>JSON.stringify(p.components.map(c=>c.p)))).size,4);for(const p of plans){assert.equal(p.style,style.id);assert.ok(p.components.length<=9);assert.ok(presets.some(r=>r.id===p.basePreset.id));for(const c of p.components){assert.equal(c.enabled,true);assert.ok(c.reason.length>10);for(const [k,v]of Object.entries(c.p))if(Core.parameterRanges[k]){assert.ok(v>=Core.parameterRanges[k][0]&&v<=Core.parameterRanges[k][1],k);assert.ok(Number.isFinite(v));}}}}
 assert.deepEqual(presets,catalog);
});
test('a single style rescues a dark photo and restrains a bright clipped photo differently',()=>{
 const dark=plan(analyze(image(64,64,[35,35,35]))),bright=plan(analyze(image(64,64,[250,250,250]))),d=component(dark,'balance').p,b=component(bright,'balance').p;
 assert.ok(d.toneExposure>b.toneExposure+.4);assert.ok(d.toneShadows>b.toneShadows);assert.ok(b.toneHighlights<d.toneHighlights);assert.notDeepEqual(dark.components,bright.components);
});
test('subject and background measurements drive local rescue instead of a fixed exposure recipe',()=>{
 const backlit=subjectFixture(),balanced=subjectFixture({inside:170,outside:130}),a=analyze(backlit,{maps:backlit.maps}),b=analyze(balanced,{maps:balanced.maps}),pa=plan(a),pb=plan(b);
 assert.equal(a.recognition,'ai');assert.ok(a.subjectBrightness<a.backgroundBrightness);assert.ok(component(pa,'subject').p.toneExposure>component(pb,'subject').p.toneExposure+.1);assert.equal(component(pa,'depth').p.adjustRegion,'out');assert.equal(component(pa,'subject').p.adjustRegionShape,'freehand');
});
test('AI contours use existing lasso semantics and preserve holes and disconnected people',()=>{
 const f=image(80,80),foreground=new Uint8Array(6400);for(let y=10;y<70;y++)for(let x=10;x<60;x++)if(!(x>25&&x<45&&y>25&&y<50))foreground[y*80+x]=255;for(let y=15;y<25;y++)for(let x=67;x<76;x++)foreground[y*80+x]=255;
 const a=analyze(f,{maps:{width:80,height:80,foreground}}),mask=Paint.raster(a.region.p.adjustRegionStrokes,400,400,{feather:0});assert.equal(a.recognition,'ai');assert.ok(a.region.p.adjustRegionStrokes[0].points.length<=256);assert.equal(mask.at(.2,.3),1);assert.equal(mask.at(.43,.45),0);assert.equal(mask.at(.89,.24),1);assert.equal(mask.at(.97,.9),0);
});
test('warm and cool originals receive different white-balance corrections',()=>{
 const warm=component(plan(analyze(image(64,64,[160,110,70]))),'balance').p,cool=component(plan(analyze(image(64,64,[70,110,160]))),'balance').p;assert.ok(warm.temp<cool.temp);
});
test('crisp palettes do not substitute grain for detail and creative lighting follows the observed bright side',()=>{
 const smooth=analyze(image(96,64,[100,100,100])),textured=analyze(image(96,64,(x,y)=>(x+y)%2?[190,190,190]:[10,10,10]));assert.ok(textured.texture>smooth.texture+.5);for(const style of Core.styles.filter(s=>!['backlight','restore-detail','film-recovery'].includes(s.id)))for(const a of [smooth,textured])assert.equal(component(plan(a,{style:style.id}),'texture').p.grain,0);
 const left=analyze(image(100,60,x=>x<40?[240,240,240]:[60,60,60])),right=analyze(image(100,60,x=>x>60?[240,240,240]:[60,60,60]));assert.ok(left.light.x<right.light.x);assert.ok(component(plan(left,{style:'golden-hour'}),'light').p.adjustRegionX<component(plan(right,{style:'golden-hour'}),'light').p.adjustRegionX);
});
test('native sunlight and flare geometry are explicitly manual so detected positions are used',()=>{
 const a=analyze(image(100,60,x=>x>60?[240,240,240]:[60,60,60]));
 const plans=Core.generate(a,{style:'creative',seed:17,presets});
 for(const p of plans)for(const c of p.components){if(c.p.nang>.001){assert.equal(c.p.nangManual,true);assert.deepEqual(c.targetIntent.baseline.sun,c.sun);}if(c.p.leak>.001){assert.equal(c.p.leakManual,true);assert.deepEqual(c.targetIntent.baseline.leak,c.leak);}}
 const golden=plan(a,{style:'golden-hour'}),light=component(golden,'light');assert.equal(light.p.nangManual,true);assert.ok(light.sun.x>.5);assert.ok(light.leak.x>.5);
});
test('stable seeds are reproducible, reroll explores different parameters, and generation never mutates analysis',()=>{
 const a=analyze(image()),saved=structuredClone(a),one=Core.generate(a,{seed:78,presets}),two=Core.generate(a,{seed:78,presets}),rerolled=Core.generate(a,{seed:79,presets});assert.deepEqual(one,two);assert.notDeepEqual(one.map(p=>p.components),rerolled.map(p=>p.components));assert.deepEqual(a,saved);
});
test('intensity scales weights from one immutable plan and zero leaves no active native effect',()=>{
 const p=plan(analyze(image())),saved=structuredClone(p),half=Core.scale(p,50),zero=Core.scale(p,0);for(let i=0;i<p.components.length;i++){assert.deepEqual(half.components[i].focus,p.components[i].focus);for(const key of Core.effectKeys)if(key in p.components[i].p){assert.ok(Math.abs(half.components[i].p[key]-p.components[i].p[key]/2)<1e-6);assert.equal(zero.components[i].p[key],0);}assert.equal(zero.components[i].enabled,false);assert.deepEqual(zero.components[i].targetIntent,p.components[i].targetIntent);}assert.deepEqual(p,saved);
});
test('recipe adaptation moves semantic regions while retaining deleted, disabled and edited components',()=>{
 const first=subjectFixture({left:.1,right:.35}),next=subjectFixture({left:.6,right:.85,inside:80,outside:200}),a=analyze(first,{maps:first.maps}),b=analyze(next,{maps:next.maps}),p=plan(a);p.components=p.components.filter(c=>c.id!=='texture');component(p,'depth').enabled=false;component(p,'subject').p.toneExposure+=.05;const before=structuredClone(p),adapted=Core.adapt(p,b,{presets}),subject=component(adapted,'subject');
 assert.ok(subject.focus.cx>component(p,'subject').focus.cx+.3);assert.equal(component(adapted,'depth').enabled,false);assert.equal(component(adapted,'texture'),undefined);assert.ok(Math.abs(subject.p.toneExposure-subject.targetIntent.baseline.p.toneExposure-.05)<.00001);assert.deepEqual(p,before);assert.equal(adapted.analysis.fingerprint,b.fingerprint);
});
test('adaptation preserves a chosen variant on the same image instead of rolling it again',()=>{
 const a=analyze(image(96,64,(x,y)=>[40+x,60+y,80]));for(const p of Core.generate(a,{style:'creative',seed:102,presets})){const adapted=Core.adapt(p,a,{presets});for(let i=0;i<p.components.length;i++)for(const [k,v]of Object.entries(p.components[i].p))if(typeof v==='number')assert.ok(Math.abs(adapted.components[i].p[k]-v)<.00001,k);assert.equal(adapted.basePreset.id,p.basePreset.id);}
});
test('manually changed region shapes remain under user control when re-adapting another photo',()=>{
 const a=analyze(image()),p=plan(a),subject=component(p,'subject');subject.p.adjustRegionShape='rect';subject.p.adjustRegionX=.22;subject.p.adjustRegionY=.31;const adapted=Core.adapt(p,analyze(image(80,60,[80,90,100])),{presets});assert.equal(component(adapted,'subject').p.adjustRegionShape,'rect');assert.equal(component(adapted,'subject').p.adjustRegionX,.22);assert.equal(component(adapted,'subject').p.adjustRegionY,.31);
});
test('generated plans fit the standalone recipe validator including adaptation baselines',()=>{
 const R=require('../dist/darkroom/ai-composer-recipes.js'),f=subjectFixture(),a=analyze(f,{maps:f.maps});for(const style of Core.styles)for(const p of Core.generate(a,{style:style.id,seed:17,presets})){const recipe=R.create(p,{name:'Công thức '+style.name,intensity:71});assert.deepEqual(R.validate(JSON.parse(JSON.stringify(recipe))),recipe);}
});
test('backlight recovery targets the measured dark subject while a normally lit subject stays restrained',()=>{
 const shadow=subjectFixture({inside:45,outside:245}),even=subjectFixture({inside:160,outside:170}),a=analyze(shadow,{maps:shadow.maps}),b=analyze(even,{maps:even.maps}),recovered=plan(a,{style:'backlight'}),natural=plan(a),normal=plan(b,{style:'backlight'});
 assert.equal(Core.styles.find(s=>s.id==='backlight').name,'Cứu ngược sáng');
 assert.ok(component(recovered,'subject').p.filmExp>.12,'native film exposure curve opens the silhouette without excessive shadow gain');
 assert.ok(component(recovered,'subject').p.filmExp>component(normal,'subject').p.filmExp+.06,'native exposure curve adapts to subject brightness');
 assert.ok(component(recovered,'balance').p.toneExposure<=0,'bright sky is not globally exposed upward');
 assert.ok(component(recovered,'depth').p.toneHighlights<=0);assert.ok(component(recovered,'depth').p.toneExposure<=0);
 assert.equal(component(recovered,'subject').p.adjustRegion,'in');assert.equal(component(recovered,'depth').p.adjustRegion,'out');
 for(const c of recovered.components)assert.ok(!c.p.nang&&!c.p.leak&&!c.p.glow&&!c.p.bgBlur,'recovery retains existing light and detail');
});
test('backlight adaptation remeasures fill and relocalizes the recovered subject without reviving deleted components',()=>{
 const first=subjectFixture({left:.12,right:.38,inside:40,outside:245}),next=subjectFixture({left:.62,right:.88,inside:140,outside:180}),a=analyze(first,{maps:first.maps}),b=analyze(next,{maps:next.maps}),p=plan(a,{style:'backlight'});p.components=p.components.filter(c=>c.id!=='light');component(p,'texture').enabled=false;
 const adapted=Core.adapt(p,b,{presets});assert.ok(component(adapted,'subject').focus.cx>component(p,'subject').focus.cx+.4);assert.ok(component(adapted,'subject').p.filmExp<component(p,'subject').p.filmExp-.05);assert.equal(component(adapted,'light'),undefined);assert.equal(component(adapted,'texture').enabled,false);
});

function faceFixture({face=45,coat=210,left=.40,noise=0}={}){const f=image(160,120,(x,y,W,H)=>{const u=x/W,v=y/H,isFace=u>left&&u<left+.16&&v>.20&&v<.46,isPerson=u>left-.08&&u<left+.24&&v>.15&&v<.96,texture=Math.round(Math.sin(x*.7)*4),jitter=noise?((x*17+y*31)%13-6)*noise:0;return isFace?[face+10+texture+jitter,face+texture+jitter,face-5+texture+jitter]:isPerson?[coat,coat,coat]:[241,245,249];}),foreground=new Uint8Array(f.W*f.H),skin=new Uint8Array(f.W*f.H);for(let y=0;y<f.H;y++)for(let x=0;x<f.W;x++){const u=x/f.W,v=y/f.H,i=y*f.W+x;foreground[i]=u>left-.08&&u<left+.24&&v>.15&&v<.96?255:0;skin[i]=u>left&&u<left+.16&&v>.20&&v<.46?255:0;}const faces=[[{x:left,y:.20},{x:left+.16,y:.20},{x:left+.16,y:.46},{x:left,y:.46}]];return{...f,maps:{width:f.W,height:f.H,foreground,skin},faces};}
test('a bright coat cannot suppress dark-face metering and face-local recovery does not turn into full person exposure',()=>{
 const f=faceFixture(),a=analyze(f,{maps:f.maps,faces:f.faces}),p=plan(a,{style:'restore-detail'}),r=a.recovery.faces[0],face=component(p,'face-0');assert.ok(a.subjectBrightness>r.mean+.3);assert.ok(face.p.toneExposure>0);assert.ok(face.p.filmExp>.3,'native film curve carries the face lift without excessive EV');assert.ok(component(p,'face-shadow-0').p.toneExposure>.2,'dark skin has its own measured shadow fill');assert.equal(component(p,'subject').p.toneExposure,0);assert.equal(face.role,'skin');assert.ok(face.p.adjustRegionStack.length);assert.ok(component(p,'texture').p.sharp>.06);assert.ok(r.focus.ry<.2);for(const c of p.components)for(const key of ['paper','gloss','grain','rayThuNhat','glow','nang','leak','soft'])assert.ok(!c.p[key],key);
});
test('detail analysis does not alter the original histogram and protects noisy skin from extra sharpening',()=>{
 const f=faceFixture(),noisy=faceFixture({noise:5}),a=analyze(f,{maps:f.maps,faces:f.faces}),b=analyze(f,{maps:f.maps,faces:f.faces,detail:{data:noisy.data,width:noisy.W,height:noisy.H,sourceWidth:noisy.W,sourceHeight:noisy.H}});assert.deepEqual(a.histogram,b.histogram);assert.equal(a.fingerprint,b.fingerprint);assert.ok(b.recovery.faces[0].noise>a.recovery.faces[0].noise);assert.ok(component(plan(b,{style:'restore-detail'}),'texture').p.sharp<component(plan(a,{style:'restore-detail'}),'texture').p.sharp);
});
test('face recovery re-adapts to a relocated face while keeping edits and explicit disabled/deleted choices',()=>{
 const first=faceFixture(),next=faceFixture({face:110,left:.70}),a=analyze(first,{maps:first.maps,faces:first.faces}),b=analyze(next,{maps:next.maps,faces:next.faces}),p=plan(a,{style:'restore-detail'});component(p,'face-0').p.toneExposure-=.12;component(p,'texture').enabled=false;p.components=p.components.filter(c=>c.id!=='light');const adapted=Core.adapt(p,b,{presets});assert.ok(component(adapted,'face-0').focus.cx>component(p,'face-0').focus.cx+.25);assert.ok(Math.abs(component(adapted,'face-0').p.toneExposure-component(adapted,'face-0').targetIntent.baseline.p.toneExposure+.12)<.0001);assert.equal(component(adapted,'texture').enabled,false);assert.equal(component(adapted,'light'),undefined);
});

test('a dark face containing measured bright skin gets a highlight guard instead of clipping its brighter features',()=>{
 const f=faceFixture(),a=analyze(f,{maps:f.maps,faces:f.faces}),high=structuredClone(a);high.recovery.faces[0].p90=.46;high.recovery.faces[0].channelP95=.72;const low=component(plan(a,{style:'restore-detail'}),'face-0'),guarded=component(plan(high,{style:'restore-detail'}),'face-0');assert.ok(guarded.p.toneExposure<low.p.toneExposure);assert.ok(guarded.p.toneHighlights<low.p.toneHighlights);assert.ok(guarded.p.toneExposure>0&&guarded.p.filmExp>.3,'dark skin still receives local exposure and film-curve recovery');assert.equal(component(plan(high,{style:'restore-detail'}),'subject').p.toneExposure,0);
});

test('rescue uses meaningful native zone tools with detail last and no neutral preset placeholders',()=>{
 const f=faceFixture({coat:85}),a=analyze(f,{maps:f.maps,faces:f.faces});for(const style of ['backlight','restore-detail'])for(const p of Core.generate(a,{style,seed:101,presets})){
  assert.equal(p.basePreset.id,'goc');assert.equal(component(p,'film'),undefined);assert.equal(p.components.at(-1).id,'texture');assert.ok(component(p,'subject').p.filmExp>.1);assert.ok(component(p,'subject').p.toneShadows<.06);assert.ok(component(p,'subject').p.adjustRegionStack.some(r=>r.adjustRegion==='out'));assert.ok(component(p,'light').p.toneLocalEV>0);assert.equal(component(p,'light').p.toneLocalMode,'all');assert.ok(component(p,'texture').p.printClear>0);for(const c of p.components)assert.ok(Core.effectKeys.some(k=>Math.abs(c.p[k]||0)>.001));
 }
});
test('neutral zone metering supports corrective colors without treating saturated material as a lighting cast',()=>{
 const make=color=>{const f=subjectFixture({inside:100,outside:230});for(let i=0;i<f.maps.foreground.length;i++)if(f.maps.foreground[i])f.data.set([...color,255],i*4);return f;},neutral=make([105,110,116]),blue=make([30,45,160]),a=analyze(neutral,{maps:neutral.maps}),b=analyze(blue,{maps:blue.maps});assert.ok(a.recovery.zones.subject.neutralCoverage>.5);assert.equal(b.recovery.zones.subject.neutralCoverage,0);const pa=plan(a,{style:'backlight'}),pb=plan(b,{style:'backlight'});assert.ok(component(pa,'subject-color').p.temp>0);assert.equal(component(pb,'subject-color'),undefined);
});
test('rescue adaptation preserves same-photo profiles and retargets color and lighting while keeping manual edits',()=>{
 const first=faceFixture({coat:85}),next=faceFixture({face:90,left:.68}),a=analyze(first,{maps:first.maps,faces:first.faces}),b=analyze(next,{maps:next.maps,faces:next.faces}),R=require('../dist/darkroom/ai-composer-recipes.js');
 for(const p of Core.generate(a,{style:'restore-detail',seed:932,presets})){const same=Core.adapt(p,a,{presets});for(const c of p.components){const kept=component(same,c.id);assert.ok(kept);assert.deepEqual(kept.p,c.p,c.id);assert.deepEqual(kept.focus,c.focus,c.id);}}
 const p=Core.generate(a,{style:'restore-detail',seed:932,presets})[3];component(p,'light').p.toneLocalColor='#d1eaff';component(p,'light').p.adjustRegionCurve=.65;component(p,'subject-color').p.temp+=.05;component(p,'depth').enabled=false;p.components=p.components.filter(c=>c.id!=='balance');const saved=R.decode(R.encode(R.create(p))),adapted=Core.adapt(saved,b,{presets});assert.equal(component(adapted,'light').p.toneLocalColor,'#d1eaff');assert.equal(component(adapted,'depth').enabled,false);assert.equal(component(adapted,'balance'),undefined);assert.ok(component(adapted,'subject-color').focus.cx>component(p,'subject-color').focus.cx+.2);assert.ok(Math.abs(component(adapted,'subject-color').p.temp-component(adapted,'subject-color').targetIntent.baseline.p.temp-.05)<.00001);assert.doesNotThrow(()=>R.create(adapted));
});

const fujiPresets=[...presets,{id:'fujicam',name:'Fuji',p:{temp:.06,tint:-.06,split:.15,contrast:.16,sat:.26,lift:.02,halation:.08,grain:.06,vignette:.06,dust:.01,ca:.03}},{id:'fujicam2',name:'Fuji 2',p:{temp:.24,tint:.06,split:.1,contrast:.18,sat:.06,lift:.06,halation:.08,grain:.04,vignette:.08,dust:.01,ca:.02,sharp:.55}},{id:'fujicam3',name:'Fuji 3',p:{temp:-.04,tint:-.12,split:.62,contrast:.3,sat:.2,lift:.1,halation:.08,grain:.22,vignette:.08,dust:.02,ca:.03}}];
test('film recovery uses existing Fuji palettes in editable scene and face-excluded body layers without inheriting preset optics',()=>{
 const f=faceFixture({coat:85}),a=analyze(f,{maps:f.maps,faces:f.faces}),before=structuredClone(fujiPresets),plans=Core.generate(a,{style:'film-recovery',seed:729,presets:fujiPresets});
 assert.equal(plans.length,4);assert.deepEqual(plans.map(p=>p.basePreset.id),['fujicam','fujicam3','fujicam2','fujicam3']);
 for(const p of plans){const scene=component(p,'film-background'),body=component(p,'film-subject');assert.equal(p.style,'film-recovery');assert.equal(scene.p.adjustRegion,'out');assert.equal(body.p.adjustRegion,'in');assert.equal(scene.role,'background');assert.ok(body.p.adjustRegionStack.some(r=>r.adjustRegion==='out'));assert.ok(Math.abs(body.p.split)<Math.abs(scene.p.split));assert.ok(scene.p.toneHighlights<0);assert.equal(p.components.at(-1).id,'texture');assert.ok(p.components.at(-1).p.grain<=.015);for(const c of [scene,body])for(const key of ['grain','sharp','halation','glow','leak','dust','ca','soft','nang'])assert.ok(!c.p[key],key);}
 assert.deepEqual(fujiPresets,before);assert.equal(new Set(plans.map(p=>JSON.stringify(component(p,'film-background').p))).size,4);
 const rerolled=Core.generate(a,{style:'film-recovery',seed:730,presets:fujiPresets});assert.notDeepEqual(plans.map(p=>component(p,'film-background').p),rerolled.map(p=>component(p,'film-background').p));
 for(const count of [3,5])assert.equal(Core.generate(a,{style:'film-recovery',count,presets:fujiPresets}).length,count);
 const rich=structuredClone(a);rich.colorfulness=.65;assert.ok(component(Core.generate(rich,{style:'film-recovery',seed:729,presets:fujiPresets})[0],'film-background').p.sat<component(plans[0],'film-background').p.sat);
});
test('every saved Fuji alternative reopens identically and adapts palette regions while retaining user edits and deleted choices',()=>{
 const f=faceFixture({coat:85}),next=faceFixture({face:95,coat:130,left:.70}),a=analyze(f,{maps:f.maps,faces:f.faces}),b=analyze(next,{maps:next.maps,faces:next.faces}),R=require('../dist/darkroom/ai-composer-recipes.js');
 for(const p of Core.generate(a,{style:'film-recovery',seed:1239,presets:fujiPresets})){const recipe=R.decode(R.encode(R.create(p,{intensity:73}))),same=Core.adapt(recipe,a,{presets:fujiPresets});assert.equal(same.basePreset.id,p.basePreset.id);for(const c of p.components){assert.deepEqual(component(same,c.id).p,c.p,c.id);assert.deepEqual(component(same,c.id).focus,c.focus,c.id);}
  component(recipe,'film-background').p.sat+=.025;component(recipe,'film-subject').p.temp+=.02;component(recipe,'texture').enabled=false;recipe.components=recipe.components.filter(c=>c.id!=='light');const adapted=Core.adapt(recipe,b,{presets:fujiPresets}),body=component(adapted,'film-subject');assert.equal(adapted.basePreset.id,p.basePreset.id);assert.ok(body.focus.cx>component(p,'film-subject').focus.cx+.25);assert.ok(body.p.adjustRegionStack[0].adjustRegionX>component(p,'film-subject').p.adjustRegionStack[0].adjustRegionX+.25);assert.ok(Math.abs(body.p.temp-body.targetIntent.baseline.p.temp-.02)<.00001);assert.ok(Math.abs(component(adapted,'film-background').p.sat-component(adapted,'film-background').targetIntent.baseline.p.sat-.025)<.00001);assert.equal(component(adapted,'light'),undefined);assert.equal(component(adapted,'texture').enabled,false);assert.doesNotThrow(()=>R.create(adapted));
 }
});
test('film recovery remains usable without Fuji catalog entries or recognition and an empty source stays neutral',()=>{
 const a=analyze(image(48,32,[75,95,115]));assert.equal(a.recognition,'estimated');const plans=Core.generate(a,{style:'film-recovery',seed:414,presets:[]});assert.equal(plans.length,4);for(const p of plans){assert.equal(p.basePreset.id,'goc');assert.equal(component(p,'film-background').p.adjustRegion,'out');assert.equal(component(p,'film-subject').targetIntent.regionSource,'estimated');assert.ok(component(p,'film-background').p.film>0);}
 const f=image(8,8);f.data.fill(0);for(const p of Core.generate(analyze(f),{style:'film-recovery',presets:fujiPresets}))for(const c of p.components){assert.equal(c.enabled,false);for(const key of Core.effectKeys)if(key in c.p)assert.equal(c.p[key],0);}
 const recipe=structuredClone(plans[0]),film=component(recipe,'film-background');film.p.adjustRegionShape='rect';film.p.adjustRegionX=.22;film.p.adjustRegionY=.31;const next=Core.adapt(recipe,analyze(image(48,32,[160,145,125])),{presets:[]});assert.equal(component(next,'film-background').p.adjustRegionShape,'rect');assert.equal(component(next,'film-background').p.adjustRegionX,.22);assert.equal(component(next,'film-background').p.adjustRegionY,.31);
});

test('existing creative styles mix normalized native color parameters and keep preset optics in a separate shared budget',()=>{
 const a=analyze(image(100,70,(x,y)=>[65+x*.7,75+y*.7,115])),saved=structuredClone(presets),upgraded=Core.styles.filter(s=>!['backlight','restore-detail','film-recovery'].includes(s.id));assert.equal(upgraded.length,9);
 for(const style of upgraded)for(const p of Core.generate(a,{style:style.id,seed:444,presets})){const film=component(p,'film'),blend=Core.mixParameters(film.mix);assert.equal(film.mix.version,1);assert.equal(film.mix.sources.length,style.id==='creative'?3:2);assert.equal(new Set(film.mix.sources.map(s=>s.id)).size,film.mix.sources.length);assert.ok(film.mix.sources.every(s=>presets.some(r=>r.id===s.id)));for(const [key,value]of Object.entries(blend))assert.ok(Math.abs(film.p[key]-value)<.00001,key);for(const key of ['bgBlur','motion','soft','glow','grain','ca','paper','gloss','ptex','film','rayThuNhat'])assert.ok(!film.p[key],key);assert.ok(component(p,'light').p.toneLocalEV>0);assert.equal(component(p,'light').p.toneLocalMode,'all');assert.ok(p.analysis.recovery.zones);}
 assert.deepEqual(presets,saved);
 const p=plan(a,{style:'soft-dream'});for(const c of p.components)for(const key of ['bgBlur','soft','motion','ca','paper','gloss'])assert.ok(!c.p[key],key);assert.equal(component(p,'texture').p.glow,0);assert.ok(component(p,'texture').p.printClear>0);for(const style of ['auto-beauty','natural','editorial','golden-hour','soft-dream'])assert.equal(component(plan(a,{style}),'texture').p.grain,0,'clean styles must not enable the native minimum grain amplitude');
 const mix=structuredClone(component(p,'film').mix),copy=structuredClone(mix),zero={...mix,sources:mix.sources.map(s=>({...s,weight:0}))};assert.deepEqual(Core.mixParameters(zero),{temp:0,tint:0,split:0,contrast:0,sat:0,lift:0});assert.deepEqual(mix,copy);const half=Core.mixParameters({...mix,strength:mix.strength/2}),full=Core.mixParameters(mix);for(const key of Object.keys(full))assert.ok(Math.abs(half[key]-full[key]/2)<.000001);
});
test('saved mixed palettes retain sources, weights, strength and manual color edits while adapting other light and subject regions',()=>{
 const first=subjectFixture({left:.1,right:.35,inside:55,outside:220}),second=subjectFixture({left:.6,right:.85,inside:135,outside:170}),a=analyze(first,{maps:first.maps}),b=analyze(second,{maps:second.maps}),R=require('../dist/darkroom/ai-composer-recipes.js');
 for(const style of ['soft-dream','natural','creative'])for(const p of Core.generate(a,{style,seed:728,presets})){const film=component(p,'film');film.mix.sources[0].weight=.11;film.mix.strength=.58;film.p.temp+=.017;film.enabled=false;p.components=p.components.filter(c=>c.id!=='texture');const saved=R.decode(R.encode(R.create(p,{intensity:73}))),same=Core.adapt(saved,a,{presets});for(const c of p.components){for(const [key,value]of Object.entries(c.p))if(typeof value==='number')assert.ok(Math.abs(component(same,c.id).p[key]-value)<.00001,c.id+' '+key);else assert.deepEqual(component(same,c.id).p[key],value);assert.deepEqual(component(same,c.id).mix,c.mix,c.id);}
  const adapted=Core.adapt(saved,b,{presets}),kept=component(adapted,'film');assert.deepEqual(kept.mix,film.mix);for(const key of ['temp','tint','split','contrast','sat','lift'])assert.ok(Math.abs(kept.p[key]-film.p[key])<.00001,key);assert.equal(kept.enabled,false);assert.equal(component(adapted,'texture'),undefined);assert.ok(component(adapted,'subject').focus.cx>component(p,'subject').focus.cx+.3);assert.notEqual(component(adapted,'balance').p.toneExposure,component(p,'balance').p.toneExposure);assert.doesNotThrow(()=>R.create(adapted));
 }
 const legacy=plan(a);delete component(legacy,'film').mix;const adapted=Core.adapt(legacy,b,{presets});assert.equal(component(adapted,'film').mix,undefined);
});

function paletteFixture({skyX=.5,sky=true,land=true}={}){
 const f=subjectFixture(),a=analyze(f,{maps:f.maps}),zone=(cx,cy,rx,ry)=>({confidence:.87,coverage:.25,mean:.56,p10:.31,p90:.84,highlightCoverage:.05,colorfulness:.23,warmCast:-.11,tintCast:.025,focus:{cx,cy,rx,ry},p:{adjustRegion:'in',adjustRegionShape:'rect',adjustRegionX:cx,adjustRegionY:cy,adjustRegionRX:rx,adjustRegionRY:ry,adjustRegionAngle:0,adjustRegionFeather:.25,adjustRegionStack:[{...structuredClone(a.region.p),adjustRegion:'out'}]}});
 a.palette={version:1,sky:sky?zone(skyX,.18,.43,.18):null,land:land?zone(.5,.73,.44,.24):null};return a;
}
test('scene palettes add two native region grades with distinct intent families while retaining source and original preset catalog',()=>{
 const a=paletteFixture(),before=structuredClone(a),catalog=structuredClone(presets),colors=new Set();
 for(const style of Core.styles.filter(s=>!['backlight','restore-detail','film-recovery'].includes(s.id))){const p=plan(a,{style:style.id}),sky=component(p,'palette-sky'),land=component(p,'palette-land');assert.ok(sky&&land);colors.add(sky.p.toneLocalColor);assert.equal(sky.role,'background');assert.equal(sky.targetIntent.regionSource,'estimated');assert.deepEqual(sky.p.adjustRegionStack,a.palette.sky.p.adjustRegionStack);assert.equal(sky.p.toneLocalMode,'all');assert.ok(sky.p.toneLocalColorAmount>.15);assert.ok(sky.p.toneLocalEV<0);assert.equal(p.components.at(-1).id,'texture');assert.equal(component(p,'texture').p.grain,0);assert.ok(component(p,'texture').p.sharp<=.12);assert.ok(component(p,'texture').p.printClear<=.16);for(const c of [sky,land])for(const key of ['film','grain','soft','bgBlur','motion','ca','paper','gloss'])assert.ok(!c.p[key],key);}
 assert.equal(colors.size,9);assert.deepEqual(a,before);assert.deepEqual(presets,catalog);
 const uncertain=paletteFixture();uncertain.palette.sky.confidence=.2;assert.equal(component(plan(uncertain),'palette-sky'),undefined);assert.ok(component(plan(uncertain),'palette-land'));
});
test('saved scene palettes retain every alternative and user colors while retargeting exact zone masks and dropping missing sky',()=>{
 const a=paletteFixture(),b=paletteFixture({skyX:.28}),R=require('../dist/darkroom/ai-composer-recipes.js');
 for(const style of ['natural','soft-dream','creative'])for(const p of Core.generate(a,{style,seed:553,presets})){const saved=R.decode(R.encode(R.create(p,{intensity:71}))),same=Core.adapt(saved,a,{presets});for(const c of p.components){const kept=component(same,c.id);assert.ok(kept,c.id);for(const[key,value]of Object.entries(c.p))if(typeof value==='number')assert.ok(Math.abs(kept.p[key]-value)<.00001,c.id+' '+key);else assert.deepEqual(kept.p[key],value,c.id+' '+key);}
  component(saved,'palette-sky').p.toneLocalColor='#ffaa77';component(saved,'palette-sky').p.sat+=.02;component(saved,'palette-land').enabled=false;const next=Core.adapt(saved,b,{presets}),sky=component(next,'palette-sky');assert.equal(sky.p.toneLocalColor,'#ffaa77');assert.ok(Math.abs(sky.p.sat-sky.targetIntent.baseline.p.sat-.02)<.00001);assert.equal(sky.p.adjustRegionX,b.palette.sky.p.adjustRegionX);assert.equal(sky.focus.cx,b.palette.sky.focus.cx);assert.equal(component(next,'palette-land').enabled,false);
  const missing=Core.adapt(saved,paletteFixture({sky:false}),{presets});assert.equal(component(missing,'palette-sky'),undefined);saved.components=saved.components.filter(c=>c.id!=='palette-land');assert.equal(component(Core.adapt(saved,b,{presets}),'palette-land'),undefined);
 }
});
function wholeSceneFixture(){const f=image(120,90,(x,y)=>y<45?(x>75&&y>10&&y<30?[228,230,234]:[105,175,235]):x<65?[50,100,65]:[100,120,145]);return analyze(f);}
test('one-tap directions coordinate sky, neutral clouds, foliage, terrain and subject light without overlapping the sky grade over clouds',()=>{
 const a=wholeSceneFixture(),before=structuredClone(a);for(const style of ['natural','cinematic','golden-hour','soft-dream','moody','creative']){const options=Core.generate(a,{style,seed:42,presets});assert.equal(new Set(options.map(p=>p.title)).size,4);for(const id of ['palette-sky','palette-vegetation','palette-land'])assert.equal(new Set(options.map(p=>component(p,id).p.toneLocalColor)).size,4,id);assert.equal(new Set(options.map(p=>component(p,'depth').p.toneExposure)).size,4);assert.equal(new Set(options.map(p=>component(p,'subject').p.toneExposure)).size,4);for(const p of options){const sky=component(p,'palette-sky'),cloud=component(p,'palette-clouds'),tree=component(p,'palette-vegetation'),land=component(p,'palette-land');assert.ok(sky.p.adjustRegionStack.some(s=>s.adjustRegion==='out'&&JSON.stringify(s.adjustRegionStrokes)===JSON.stringify(a.palette.clouds.p.adjustRegionStrokes)));assert.ok(cloud.p.toneLocalColorAmount<=.075);assert.equal(cloud.p.split,0);assert.ok(tree.p.sat<.16);assert.deepEqual(land.p.adjustRegionStrokes,a.palette.terrain.p.adjustRegionStrokes);assert.equal(p.components.at(-1).p.grain,0);}}
 assert.deepEqual(a,before);
});
test('whole-scene formulas preserve every chosen direction and edits, omit lost subregions and do not reintroduce deleted layers',()=>{
 const a=wholeSceneFixture(),R=require('../dist/darkroom/ai-composer-recipes.js');for(const p of Core.generate(a,{style:'creative',seed:87,presets})){const recipe=R.decode(R.encode(R.create(p,{intensity:73}))),same=Core.adapt(recipe,a,{presets});for(const c of recipe.components)assert.deepEqual(component(same,c.id).p,c.p,c.id);const b=structuredClone(a);delete b.palette.clouds;delete b.palette.vegetation;component(recipe,'palette-land').enabled=false;recipe.components=recipe.components.filter(c=>c.id!=='light');const adapted=Core.adapt(recipe,b,{presets});assert.equal(component(adapted,'palette-clouds'),undefined);assert.equal(component(adapted,'palette-vegetation'),undefined);assert.equal(component(adapted,'palette-land').enabled,false);assert.equal(component(adapted,'light'),undefined);assert.doesNotThrow(()=>R.create(adapted));}
 const allTrees=structuredClone(a);delete allTrees.palette.terrain;assert.equal(component(plan(allTrees),'palette-land'),undefined,'aggregate land is not reapplied over its vegetation subregion');
});
