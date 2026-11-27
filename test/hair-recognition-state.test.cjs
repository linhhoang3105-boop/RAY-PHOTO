const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createCanvas}=require('@napi-rs/canvas');
const root=path.join(__dirname,'../dist/darkroom'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),runtime=fs.readFileSync(path.join(root,'beauty-runtime.js'),'utf8');
const helpers=html.slice(html.indexOf('function beautyHasHair('),html.indexOf('function beautyExtendHairOwners('));
function maps(width=12,height=10,value=255){return{width,height,hair:new Uint8Array(width*height).fill(value),skin:new Uint8Array(width*height),foreground:new Uint8Array(width*height).fill(255)};}
function helperContext(){const h={};vm.createContext(h);vm.runInContext(helpers,h);return h;}
test('soft but usable hair enables controls while empty and isolated noise remain unavailable',()=>{
 const h=helperContext();assert.equal(h.beautyHasHair(new Uint8Array(120).fill(64)),true);assert.equal(h.beautyHasHair(new Uint8Array(120)),false);
 const noise=new Uint8Array(120);noise[0]=255;assert.equal(h.beautyHasHair(noise),false);
});
test('a collapsed rescan retains only the previous hair matte and leaves new skin/foreground intact',()=>{
 const h=helperContext(),previous=maps(4,3),next=maps(8,6,0),before=previous.hair.slice(),found={maps:next};
 h.beautyKeepHair(found,previous);assert.ok(found.maps.hair.every(v=>v===255));assert.equal(found.maps.skin,next.skin);assert.equal(found.maps.foreground,next.foreground);assert.deepEqual(previous.hair,before);assert.match(found.warnings[0],/giữ vùng tóc/);
 const useful={maps:maps()};h.beautyKeepHair(useful,previous);assert.equal(useful.warnings,undefined);
 const faceOnly={maps:null};h.beautyKeepHair(faceOnly,previous);assert.equal(faceOnly.maps,null);
});
function scanHarness({samePhoto=true,foundHair=0}={}){
 const image={width:12,height:10},old=maps(),BEAUTY={source:samePhoto?image:{},maps:old,job:0,busy:false,faces:[],people:[],instances:[],ready:{}},nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:''});return nodes.get(id);};
 const h={source:image,BEAUTY,beautyScan:{},beautyStatus:node('#beautyStatus'),$:node,document:{createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){}})})},beautyUI(){},beautyMessage(text){h.beautyStatus.textContent=text;},beautyDetect:async()=>({maps:maps(12,10,foundHair),errors:[],faces:[]}),beautyBuildPeople(){},beautyProtectSkin:x=>x,beautyAssignPeople(){},beautyRenderPeople(){},queue(){}};
 vm.createContext(h);vm.runInContext(helpers,h);vm.runInContext(html.match(/beautyScan\.onclick=async\(\)=>\{[\s\S]*?\n\};/)[0],h);return h;
}
test('the actual scan handler preserves same-photo hair on an empty rescan and explains the fallback',async()=>{
 const h=scanHarness();await h.beautyScan.onclick();assert.equal(h.BEAUTY.ready.hair,true);assert.ok(h.BEAUTY.maps.hair.every(v=>v===255));assert.match(h.beautyStatus.textContent,/giữ vùng tóc/);assert.equal(h.BEAUTY.busy,false);
});
test('the actual scan handler never copies hair from a different photo',async()=>{
 const h=scanHarness({samePhoto:false});await h.beautyScan.onclick();assert.equal(h.BEAUTY.ready.hair,false);assert.ok(h.BEAUTY.maps.hair.every(v=>v===0));assert.equal(h.BEAUTY.busy,false);
});
test('switching from a face-only brow scan tells the user to scan hair without starting inference',()=>{
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:''});return nodes.get(id);},h={api:{},BEAUTY:{busy:false,maps:null,faces:[[]],people:[{}],selected:0},source:{},scan:node('scan'),beautySelectedReady:()=>({face:true,hair:false}),beautyMessage:text=>node('status').textContent=text};
 vm.createContext(h);vm.runInContext(runtime.slice(runtime.indexOf('  let lastCategory,lastPerson,lastSource;'),runtime.indexOf('\n  beautyUI=function(){originalUI();')),h);
 h.api.onCategory('brow');h.api.onCategory('hair');assert.equal(h.scan.textContent,'AI · Nhận diện tóc');assert.match(node('status').textContent,/quét khuôn mặt chưa nhận diện vùng tóc/);
 node('status').textContent='Lỗi cụ thể cần giữ lại';h.api.onCategory('hair');assert.equal(node('status').textContent,'Lỗi cụ thể cần giữ lại');
 h.source={};h.api.onCategory('hair');assert.match(node('status').textContent,/quét khuôn mặt chưa nhận diện vùng tóc/);
});
test('a small owned hair region in a large group photo enables only its person and the global renderer',()=>{
 const m=maps(1000,1000,0);for(let y=248;y<253;y++)for(let x=245;x<255;x++)m.hair[y*1000+x]=128;
 const person=cx=>({g:{cx,cy:.3,w:.12,h:.15,bottom:.375,nx:cx,ny:.3}}),h={BEAUTY:{maps:m,people:[person(.25),person(.75)],instances:[],ready:{hair:false}}};
 vm.createContext(h);vm.runInContext(html.slice(html.indexOf('function beautyHasHair('),html.indexOf('function beautySettings(')),h);h.beautyAssignPeople();
 assert.equal(h.BEAUTY.ready.hair,true);assert.equal(h.BEAUTY.people[0].ready.hair,true);assert.equal(h.BEAUTY.people[1].ready.hair,false);assert.equal(m.hairOwners[250*1000+250],1);
});
test('the hair renderer uses an owned matte even when an older draft has a stale global ready flag',()=>{
 const c=createCanvas(4,4),ctx=c.getContext('2d');ctx.fillStyle='#786050';ctx.fillRect(0,0,4,4);const before=ctx.getImageData(0,0,4,4).data.slice(),values=[{hair:.8,hairColor:'#6b466e'}],h={BEAUTY:{maps:maps(4,4),ready:{hair:false},people:[{}]},RayHair:require('../dist/darkroom/hair-core.js'),beautySettings:()=>values,beautySkinHair(){assert.equal(values[0].hair,0);},beautyUI(){},document:{createElement:()=>({}),getElementById:()=>({append(){}})}};
 vm.createContext(h);vm.runInContext(fs.readFileSync(path.join(root,'hair-editor.js'),'utf8'),h);h.beautySkinHair(ctx,4,4);
 assert.notDeepEqual(ctx.getImageData(0,0,4,4).data,before);assert.equal(values[0].hair,.8);
});

// Run the real adapter around the native ownership function and scan order:
// inference resolves first, native readiness/people are published afterwards.
function runtimeAdapterHarness({category='hair',light=false,existing=false,selected=0,failDetect=false,onDetect=null}={}){
 const source={width:900,height:1200},W=160,H=120,m=maps(W,H,0),events=[],canvases=[],scan={disabled:false,textContent:''},active={dataset:{category}};
 const person=(id,cx,cy,w,h)=>({id,g:{cx,cy,w,h,bottom:cy+h/2,nx:cx,ny:cy},values:{hair:0,hairColor:'#794437'}}),people=[person('small-avatar',.10,.88,.045,.05),person('background-person',.28,.32,.13,.18),person('foreground-person',.64,.40,.27,.30)];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const u=(x+.5)/W,v=(y+.5)/H;if(u>.20&&u<.34&&v>.20&&v<.40||u>.50&&u<.78&&v>.15&&v<.55)m.hair[y*W+x]=255;}
 const counts={detect:0,assigned:0,rendered:0,workerStops:0,closed:0,saved:0,ui:0},BEAUTY={source,job:0,busy:false,maps:null,faces:[],people:existing?people:[],selected,values:existing?people[selected].values:{hair:0},instances:[],ready:{hair:false},main:null,mainRun:null};
 const h={source,BEAUTY,BEAUTY_ASSETS:{roots:['test'],segment:'data:,segment',hair:'data:,hair',face:'data:,face',pose:'data:,pose'},scan,active,counts,events,canvases,beautyEngine(){},URL,
  document:{body:{dataset:{lightPreview:String(light)}},currentScript:{src:'https://example.test/darkroom/beauty-runtime.js'},querySelector:q=>q==='.beauty-categories .active'?active:null,getElementById:id=>id==='beautyScan'?scan:null,createElement:()=>{const c={width:0,height:0,getContext:()=>({drawImage(){}})};canvases.push(c);return c;}},
  beautyWorkerStop(){counts.workerStops++;},beautyMessage(text){h.message=text;},beautyUI(){counts.ui++;},beautyRenderPeople(){counts.rendered++;},queue(){},
  beautySelectedReady(){return BEAUTY.people[BEAUTY.selected]?.ready||BEAUTY.ready;},
  async beautyDetect(input,id){counts.detect++;events.push({id,kinds:[...h.BEAUTY_ASSETS.kinds],width:input.width,height:input.height});BEAUTY.main=Promise.resolve({close(){counts.closed++;}});BEAUTY.mainRun=Promise.resolve();if(onDetect)await onDetect(h);if(failDetect)throw Error('test inference failed');return{maps:m,people,faces:people.map(()=>[]),instances:[],errors:[]};},
  RaySession:{async saveDraft(){counts.saved++;}}
 };
 h.window=h;vm.createContext(h);vm.runInContext(html.slice(html.indexOf('function beautyHasHair('),html.indexOf('function beautySettings(')),h);const nativeAssign=h.beautyAssignPeople;h.beautyAssignPeople=function(){counts.assigned++;return nativeAssign();};
 scan.onclick=async()=>{const image=h.source,id=++BEAUTY.job;BEAUTY.busy=true;try{const found=await h.beautyDetect(image,id);if(id!==BEAUTY.job||image!==h.source)return;BEAUTY.people=found.people;BEAUTY.faces=found.faces;BEAUTY.maps=found.maps;BEAUTY.source=image;BEAUTY.ready={hair:true};h.beautyAssignPeople();h.beautyRenderPeople();}finally{if(id===BEAUTY.job){BEAUTY.busy=false;h.beautyUI();}}};
 vm.runInContext(fs.readFileSync(path.join(root,'beauty-runtime.js'),'utf8'),h,{filename:'beauty-runtime.js'});
 return h;
}
test('the actual runtime routes hair scans without pose while brow and full Makeup keep their own model sets',async()=>{
 for(const [category,kinds]of [['hair',['segment','hair','face']],['brow',['face']],['skin',['segment','hair','face','pose']],['lip',['segment','hair','face','pose']]]){
  const h=runtimeAdapterHarness({category});await h.scan.onclick();assert.deepEqual(h.events[0].kinds,kinds,category);assert.equal(h.counts.detect,1);assert.equal(h.counts.saved,1);assert.equal(h.counts.workerStops,1);assert.equal(h.counts.closed,1);assert.equal(h.BEAUTY.main,null);assert.equal(h.BEAUTY.mainRun,null);assert.equal(h.BEAUTY.busy,false);
 }
});
test('a fresh hair scan selects the largest ready foreground face instead of a hairless avatar only after native ownership is assigned',async()=>{
 const h=runtimeAdapterHarness();await h.scan.onclick();assert.equal(h.counts.assigned,1);assert.equal(h.BEAUTY.people[0].ready.hair,false);assert.equal(h.BEAUTY.people[1].ready.hair,true);assert.equal(h.BEAUTY.people[2].ready.hair,true);assert.equal(h.BEAUTY.selected,2);assert.equal(h.BEAUTY.values,h.BEAUTY.people[2].values);assert.ok(h.counts.rendered>=1);assert.equal(h.BEAUTY.busy,false);
});
test('a rescan never changes a deliberately selected existing person, and a fresh non-hair scan preserves its selection',async()=>{
 for(const options of [{existing:true,selected:0},{existing:true,selected:1},{category:'skin'}]){const h=runtimeAdapterHarness(options);await h.scan.onclick();assert.equal(h.BEAUTY.selected,options.selected||0);}
 const ready=runtimeAdapterHarness({selected:1});await ready.scan.onclick();assert.equal(ready.BEAUTY.selected,1,'a currently ready person is kept even when another face is larger');
});
test('adapter cleanup releases compatibility resources and reduced inputs when detection fails',async()=>{
 const h=runtimeAdapterHarness({light:true,failDetect:true});await assert.rejects(h.scan.onclick(),/test inference failed/);assert.equal(h.events[0].height,768);assert.ok(h.events[0].width<768);assert.equal(h.canvases.length,1);assert.equal(h.canvases[0].width,0);assert.equal(h.canvases[0].height,0);assert.equal(h.counts.workerStops,1);assert.equal(h.counts.closed,1);assert.equal(h.BEAUTY.main,null);assert.equal(h.BEAUTY.busy,false);
});
test('late recognition from a changed job or source cannot auto-select a person in the replacement context',async()=>{
 for(const mode of ['job','source']){const h=runtimeAdapterHarness({onDetect(h){if(mode==='job')h.BEAUTY.job++;else h.source={width:900,height:1200};}});await h.scan.onclick();assert.equal(h.counts.assigned,0);const fresh=runtimeAdapterHarness();await fresh.scan.onclick();h.BEAUTY.people=fresh.BEAUTY.people;h.BEAUTY.maps=fresh.BEAUTY.maps;h.BEAUTY.selected=0;h.BEAUTY.values=h.BEAUTY.people[0].values;h.BEAUTY.busy=true;h.beautyAssignPeople();assert.equal(h.BEAUTY.selected,0);if(mode==='job'){assert.equal(h.counts.workerStops,0);assert.equal(h.counts.closed,0);}else{assert.equal(h.counts.workerStops,1);assert.equal(h.counts.closed,1);}}
});
test('a hairless selected person gets a choose-person hint when another recognized person already has usable hair',async()=>{
 const h=runtimeAdapterHarness({existing:true});await h.scan.onclick();assert.equal(h.BEAUTY.selected,0);h.RayBeautyRuntime.onCategory('hair');assert.match(h.message,/chọn.*người|người.*chọn/i);assert.doesNotMatch(h.message,/Chưa xác định rõ vùng tóc\./);assert.ok(h.BEAUTY.people.some(p=>p.ready.hair));
});

test('switching away from Hair during inference or assigning while idle never changes the selected person',async()=>{
 const changed=runtimeAdapterHarness({onDetect(h){h.active.dataset.category='skin';}});await changed.scan.onclick();assert.equal(changed.BEAUTY.selected,0);
 const idle=runtimeAdapterHarness();await idle.scan.onclick();idle.BEAUTY.selected=0;idle.BEAUTY.values=idle.BEAUTY.people[0].values;idle.BEAUTY.busy=false;idle.beautyAssignPeople();assert.equal(idle.BEAUTY.selected,0);
});
