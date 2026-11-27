const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createCanvas}=require('@napi-rs/canvas');
const dir=path.join(__dirname,'../dist/darkroom');
const read=name=>name==='base-0.js'?fs.readFileSync(path.join(dir,'index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1]:fs.readFileSync(path.join(dir,({'base-26.js':'edit-history.js','base-27.js':'session.js','base-29.js':'preview-quality.js'}[name]||'body-ai/'+name)),'utf8');
function harness(pipeline=false){
 const nodes=new Map(),all=[],timers=[],pending=new Map();let clock=0;
 class E{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.style={};this.attributes={};this.listeners={};this.hidden=false;this.disabled=false;this._value=undefined;this._text='';this.classes=new Set();this.classList={add:(...x)=>x.forEach(v=>this.classes.add(v)),remove:(...x)=>x.forEach(v=>this.classes.delete(v)),contains:x=>this.classes.has(x),toggle:(x,b)=>{if(b??!this.classes.has(x))this.classes.add(x);else this.classes.delete(x);}};all.push(this);if(tag==='canvas'){this.canvas=createCanvas(600,800);this.width=600;this.height=800;}}
  set id(v){this._id=v;nodes.set(v,this);}get id(){return this._id;}
  get options(){return this.children.flatMap(c=>c.tagName==='OPTGROUP'?c.children:[c]).filter(c=>c.tagName==='OPTION');}
  get selectedOptions(){return this.options.filter(o=>o.value===this.value);}
  get value(){return this._value??this.options[0]?.value??'';}set value(v){this._value=String(v);}
  set textContent(s){this._text=String(s);}get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  get firstElementChild(){return this.children[0];}get previousElementSibling(){return this.parentElement?.children[this.parentElement.children.indexOf(this)-1];}
  append(...children){for(const c of children){c.parentElement=this;this.children.push(c);}}appendChild(c){this.append(c);return c;}
  prepend(...children){for(const c of [...children].reverse()){c.parentElement=this;this.children.unshift(c);}}
  insertBefore(c,b){if(c.parentElement)c.parentElement.children=c.parentElement.children.filter(x=>x!==c);c.parentElement=this;const i=this.children.indexOf(b);this.children.splice(i<0?this.children.length:i,0,c);}
  insertAdjacentElement(position,c){if(c.parentElement)c.parentElement.children=c.parentElement.children.filter(x=>x!==c);const p=this.parentElement;if(!p)return;const i=p.children.indexOf(this);c.parentElement=p;p.children.splice(i+(position==='afterend'),0,c);}
  replaceChildren(...children){this.children=[];this._text='';this.append(...children);}
  setAttribute(k,v){this.attributes[k]=v;if(k==='id')this.id=v;}
  getBoundingClientRect(){return{left:0,top:0,width:600,height:800};}
  get width(){return this.canvas?.width??this._width;}set width(v){if(this.canvas)this.canvas.width=v;else this._width=v;}
  get height(){return this.canvas?.height??this._height;}set height(v){if(this.canvas)this.canvas.height=v;else this._height=v;}
  getContext(){const ctx=this.canvas.getContext('2d');return new Proxy(ctx,{get(t,k){if(k==='drawImage')return(image,...args)=>t.drawImage(image.canvas||image,...args);const v=t[k];return typeof v==='function'?v.bind(t):v;},set(t,k,v){t[k]=v;return true;}});}
  addEventListener(type,f){(this.listeners[type]??=[]).push(f);}
  dispatchEvent(e){for(const f of this.listeners[e.type]||[])f(e);this['on'+e.type]?.(e);}
  click(){if(!this.disabled)this.dispatchEvent({type:'click',target:this});}
  scrollIntoView(){}
  querySelector(q){if(q==='.body-ai')return nodes.get('baseAI');return this.querySelectorAll(q)[0]||null;}
  querySelectorAll(q){const all=[];const walk=n=>{for(const c of n.children){all.push(c);walk(c);}};walk(this);return all.filter(e=>q.split(',').some(s=>{s=s.trim();const m=s.match(/^([a-z]+)?(?:\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\])?$/);if(!m)return false;return(!m[1]||e.tagName===m[1].toUpperCase())&&(!m[2]||m[2]in e.attributes&&(m[3]===undefined||e.attributes[m[2]]===m[3]));}));}
  after(c){this.insertAdjacentElement('afterend',c);}
  set innerHTML(html){
   const stack=[this];for(const m of html.matchAll(/<\/?[\w-]+\b[^>]*>|[^<]+/g)){
    const t=m[0];if(t.startsWith('</')){if(stack.length>1)stack.pop();continue;}if(!t.startsWith('<')){stack.at(-1)._text+=t;continue;}
    const tag=t.match(/^<([\w-]+)/)[1],e=new E(tag);for(const a of t.matchAll(/([\w-]+)="([^"]*)"/g)){const k=a[1],v=a[2];e.attributes[k]=v;if(k==='id')e.id=v;else if(k==='value')e.value=v;else if(k.startsWith('data-'))e.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;}
    if(/\bdisabled\b/.test(t))e.disabled=true;stack.at(-1).append(e);if(!['input','br','hr','img'].includes(tag)&&!t.endsWith('/>'))stack.push(e);
   }
  }
 }
 const docBody=new E('body');docBody.dataset.editorTool='body';
 const make=(id,tag='div')=>{const e=new E(tag);e.id=id;return e;};
 for(const id of ['bodyBox','canvasWrap','bodyParts','bodyCtl','baseAI','bodyReset1','bodyResetAll','bodyAiPerson','bodyAiScan','beautyScan','save','dateTxt','stampBtn','leakAngleRow'])make(id);
 const view=make('view','canvas');nodes.get('bodyBox').append(nodes.get('baseAI'),nodes.get('bodyParts'),nodes.get('bodyCtl'));
 const app=new E(),apply=new E('button'),resume=new E('button'),draft=make('sessionDraft','button');
 const document={body:docBody,addEventListener(){},getElementById:id=>nodes.get(id)||null,createElement:tag=>new E(tag),querySelector:q=>q==='.film-workspace'?app:q.includes('is-result-preview')?(app.classList.contains('is-result-preview')?app:null):q==='.session-apply'?apply:q==='.session-resume'?resume:q==='.session-toolbar button[aria-label="Lưu bản nháp"]'?draft:null,querySelectorAll:()=>[]};
 const h={document,console,source:{width:600,height:800},view,wrap:nodes.get('canvasWrap'),P:{},F:{},NK:{},LK:{},exportLong:null,LASTG:{W:600,H:800,bw:0,bb:0},BODY_AI:{people:[],selected:0,busy:false},BEAUTY:{maps:null,faces:[],instances:[],ready:{},people:[],values:{},selected:0,nextPerson:1,busy:false},bodyAiScan:nodes.get('bodyAiScan'),beautyScan:nodes.get('beautyScan'),devicePixelRatio:1,bodyUI(){},syncBody(){},bodyHistUI(){},queue(){},syncControls(){},drawReadout(){},beautyUI(){},beautyRenderPeople(){},syncOval(){},syncLeakHandle(){},syncNangHandle(){},update(){},bodyBegin(){},bodyEnd(){},render(){},addEventListener(){},requestAnimationFrame:()=>1,setTimeout:f=>(timers.push(f),timers.length),clearTimeout(){},setInterval:f=>(timers.push(f),timers.length),clearInterval(){},ResizeObserver:class{observe(){}},MutationObserver:class{observe(){}},Event:class{constructor(type,extra){this.type=type;Object.assign(this,extra);}}};
 h.window=h;h.parent=h;vm.createContext(h);
 const base=read('base-0.js');vm.runInContext(base.slice(base.indexOf('const BODY_DEF'),base.indexOf('/* ============ dựng ảnh')),h);
 vm.runInContext('const BODY_HIST={undo:[],redo:[],pending:null};const bodySnap=()=>JSON.stringify(BODY.parts);'+base.slice(base.indexOf('function bodyRestore'),base.indexOf('function bodyUndo')),h);
 vm.runInContext(read('base-26.js'),h);
 const sess=read('base-27.js');vm.runInContext(sess.slice(0,sess.indexOf(" const floating="))+'window.Test48={capture,restore,history};})();',h);
 const history=h.Test48.history;
 h.RaySession={record(label){return history.push(h.Test48.capture(),label);},refresh(){},undo(){const s=history.undo();if(s)h.Test48.restore(s);},showResult(on){app.classList.toggle('is-result-preview',on);}};
 if(pipeline){
  make('sizeSeg');h.source=photo(600,800);h.busy=new E();h.RayQuality=require('../dist/darkroom/quality-core.js');
  h.setTimeout=(f,ms=0)=>{const id=++clock;pending.set(id,{f,ms});return id;};h.clearTimeout=id=>pending.delete(id);
  h.fullRenders=0;h.render=(target,input)=>{if(target!==view)h.fullRenders++;target.width=input.width;target.height=input.height;const ctx=target.getContext('2d');ctx.drawImage(input.canvas||input,0,0);h.bodyWarp(ctx,input.width,input.height);return target;};
  h.draw=()=>h.render(view,h.source);
  vm.runInContext(read('base-29.js'),h,{filename:'v48-original-preview.js'});
 }
 for(const name of ['compat','geometry','face','overall','one-tap'])vm.runInContext(read(name+'.js'),h,{filename:name+'.js'});
 return{h,nodes,body:()=>vm.runInContext('BODY',h),strokes:()=>vm.runInContext('BODY_FINE.strokes',h),parts:()=>vm.runInContext('BODY.parts',h),history,timers,pending,flush(){for(const [id,task] of [...pending])if(pending.delete(id))task.f();}};
}
// Exercise the production Apply action with the real body history/pixel pipeline.
function sessionApply(f,tool='body'){
 const source=read('base-27.js'),action=source.slice(source.indexOf(' function applyStep()'),source.indexOf(' function cancelStep()'));
 return vm.runInContext(`(()=>{let activeTool=${JSON.stringify(tool)},stageBase,appliedKey,revision=0,documentKey='test-document';const history=Test48.history,capture=Test48.capture,names={body:'Chỉnh dáng',film:'Màu phim',adjust:'Điều chỉnh'};const record=label=>RaySession.record(label),showResult=on=>RaySession.showResult(on),saveDraft=()=>{window.savedApplies=(window.savedApplies||0)+1;return Promise.resolve(window.testSaveResult===undefined?capture():window.testSaveResult);},notify=message=>{(window.applyNotices??=[]).push(message);};${action};return applyStep;})()`,f.h);
}
function face(cx=.5,id=1){const points=Array.from({length:478},()=>({x:cx,y:.25})),put=(i,x,y)=>points[i]={x:cx+x-.5,y};
 for(const [i,x,y] of [[10,.5,.1],[152,.5,.4],[234,.35,.25],[454,.65,.25],[127,.37,.16],[356,.63,.16],[172,.38,.35],[397,.62,.35],[33,.4,.23],[133,.45,.23],[362,.55,.23],[263,.6,.23],[98,.47,.28],[327,.53,.28],[61,.44,.33],[291,.56,.33],[1,.5,.28]])put(i,x,y);
 return{id,face:points,ready:{face:true},values:{}};
}
function faces(f,people=[face()]){Object.assign(f.h.BEAUTY,{source:f.h.source,people,faces:people.map(p=>p.face)});f.nodes.get('r55Person').value='0';f.h.RayFace55.update();}
function photo(W=300,H=400){const c=createCanvas(W,H),ctx=c.getContext('2d'),im=ctx.createImageData(W,H);for(let y=0;y<H;y++)for(let x=0;x<W;x++)im.data.set([Math.round(x/W*230),Math.round(y/H*230),Math.round((Math.sin(x/W*18)*.5+.5)*170),255],(y*W+x)*4);ctx.putImageData(im,0,0);return c;}
const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
function draw(f,W=300,H=400){const c=photo(W,H);f.h.bodyWarp(c.getContext('2d'),W,H);return c;}

test('all imported controls initialize; no new body edit changes original pixels',()=>{const f=harness();for(const id of ['rayFace55','rayRatio54','rayOverall62','r48FaceOneTap','r48BodyOneTap'])assert.ok(f.nodes.get(id));assert.deepEqual(pixels(draw(f)),pixels(photo()));});
test('landmark geometry and four reference templates produce real, localized pixel changes',()=>{const f=harness();faces(f);const g=f.h.RayFace55.geometry();assert.ok(Math.abs(g.values.aspect-4/3)<1e-8);assert.equal(f.h.RayFace55.templates.phi.aspect,1.618);const original=pixels(photo());for(const name of ['phi','diamond','oval','vline']){f.nodes.get('r55Template').value=name;f.h.RayFace55.apply();const result=pixels(draw(f));assert.notDeepEqual(result,original,name);assert.ok(f.strokes().length>0);for(let y=250;y<400;y++)assert.deepEqual(result.subarray(y*300*4,(y+1)*300*4),original.subarray(y*300*4,(y+1)*300*4));assert.equal(f.h.RayFace55.guidesVisible,false);}});
test('v48 actual snapshot/history path preserves face recipes, old settings and draft data through Undo/Redo',()=>{const f=harness();faces(f);f.h.P.exposure=.22;f.h.NK.cx=.7;const original=f.h.Test48.capture();f.history.reset(original);f.h.RayFace55.apply();const edited=f.h.Test48.capture();assert.notEqual(edited.key,original.key);const rendered=pixels(draw(f));f.h.RaySession.undo();assert.equal(f.strokes().length,0);assert.deepEqual(pixels(draw(f)),pixels(photo()));f.h.Test48.restore(f.history.redo());assert.deepEqual(pixels(draw(f)),rendered);const saved=structuredClone(f.h.Test48.capture());f.h.Test48.restore(original);f.h.Test48.restore(saved);assert.deepEqual(pixels(draw(f)),rendered);assert.equal(f.h.P.exposure,.22);assert.equal(f.h.NK.cx,.7);assert.equal(original.body.find(p=>p.id==='face').ray67FaceStrokes,undefined);});
test('the actual session snapshot restores contour corrections on Undo/Redo without recording photo pixels',()=>{
 const f=harness(),state=require('../dist/darkroom/body-ai/contour-core.js').state();f.h.RayBodyContour=state;
 const before=f.h.Test48.capture();f.history.reset(before);state.set('body-person-1',[{mode:'drag',size:.1,points:[[.6,.5],[.55,.5]]}]);f.h.RaySession.record('Sửa viền vàng');const after=f.h.Test48.capture();assert.notEqual(after.key,before.key);assert.equal(after.bodyContour.people[0].strokes.length,1);
 f.h.RaySession.undo();assert.equal(state.capture(),null);f.h.Test48.restore(f.history.redo());assert.deepEqual(state.capture(),after.bodyContour);f.h.Test48.restore(JSON.parse(JSON.stringify(after)));assert.deepEqual(state.capture(),after.bodyContour);assert.deepEqual(pixels(draw(f)),pixels(photo()),'correcting recognition alone must not warp the photograph');
});
test('gold contour dragging reshapes photo pixels; recognition mode only edits the mask and both undo/redo',()=>{
 for(const fallback of [false,true])for(const mode of ['drag','mask']){const f=harness();bodyData(f);const p=f.h.BODY_AI.people[0],base=f.h.BEAUTY.maps;Object.assign(p,{rayPersonId:'body-person-1',raySource:f.h.source,rayMask:fallback?null:base});
 f.nodes.get('bodyBox').dataset.bodyMode='body';f.nodes.get('rayBodyOutline').checked=true;
 f.h.RayBodyCore=require('../dist/darkroom/body-ai/pose-core.js');f.h.RayContourCore=require('../dist/darkroom/body-ai/contour-core.js');f.h.RayBodyLineCore=require('../dist/darkroom/body-ai/line-core.js');f.h.RayBodyPose={mask:()=>p.rayMask};f.h.RayControls={bindDrag:require('../dist/darkroom/photo-controls.js').bindDrag};f.h.clamp=(v,a,b)=>Math.max(a,Math.min(b,v));f.h.draw=()=>{};f.h.bodyAiUI=()=>{};f.h.bodyGeo=()=>({k:1,ox:0,oy:0,W:600,H:800});
 vm.runInContext(read('contour-editor.js'),f.h);if(fallback){const E=f.nodes.get('bodyBox').constructor,pane=new E('section');pane.id='rayBodyLinesPane';f.nodes.get('bodyBox').append(pane);f.h.document.createElementNS=(_ns,tag)=>new E(tag);vm.runInContext(read('line-editor.js'),f.h);}const tools=f.nodes.get('rayContourTools'),surface=f.nodes.get('rayContourSurface'),before=base.foreground.slice();f.history.reset(f.h.Test48.capture());
 const pen=tools.querySelector('[data-contour-mode="'+mode+'"]');assert.equal(pen.disabled,false);pen.click();assert.equal(surface.hidden,false);
 const event=(type,x)=>surface.dispatchEvent({type,clientX:x,clientY:400,button:0,pointerType:'touch',pointerId:1,cancelable:true,preventDefault(){},stopImmediatePropagation(){}});
 event('pointerdown',398);event('pointermove',380);event('pointermove',363);event('pointerup',363);
 const edited=f.h.RayBodyPose.mask().foreground.slice();if(mode==='drag')assert.deepEqual(edited,before);else assert.notDeepEqual(edited,before);assert.deepEqual(base.foreground,before);assert.equal(f.h.RayBodyContour.capture().people[0].strokes.length,1);assert.equal(f.history.cursor,1);assert.equal(f.h.RayRatioLive.active,false,'correcting the gold contour must not automatically run whole-body reshaping');const rendered=pixels(draw(f));if(mode==='drag')assert.notDeepEqual(rendered,pixels(photo()),'contour pulls must visibly reshape the photo');else assert.deepEqual(rendered,pixels(photo()),'recognition correction must keep photo pixels unchanged');tools.querySelector('[data-contour-mode=off]').click();f.h.RaySession.showResult(true);assert.deepEqual(pixels(draw(f)),rendered,'finishing and applying the contour keeps the visible result');f.h.RaySession.showResult(false);
 f.h.RaySession.undo();assert.deepEqual(f.h.RayBodyPose.mask().foreground,before);assert.deepEqual(pixels(draw(f)),pixels(photo()));f.h.Test48.restore(f.history.redo());assert.deepEqual(f.h.RayBodyPose.mask().foreground,edited);assert.deepEqual(pixels(draw(f)),rendered);const stored=JSON.parse(JSON.stringify(f.h.Test48.capture()));f.h.RayBodyContour.clear();f.h.Test48.restore(stored);assert.deepEqual(pixels(draw(f)),rendered,'reopening a draft must restore the actual deformation');assert.equal(f.nodes.get('rayContourSurface').hidden,true,'history restore leaves the photo safe to scroll/compare');}
});
test('open-stroke UI keeps pixels editable after Done, repeated Apply, undo and draft recovery',async()=>{
 const f=harness(),E=f.nodes.get('bodyBox').constructor,pane=new E('section'),quick=new E('button');pane.id='rayBodyLinesPane';quick.id='rayContourQuick';f.nodes.get('bodyBox').append(pane);f.nodes.get('canvasWrap').append(quick);f.nodes.get('bodyBox').dataset.bodyMode='lines';
 f.h.document.createElementNS=(_ns,tag)=>new E(tag);f.h.RayBodyLineCore=require('../dist/darkroom/body-ai/line-core.js');f.h.RayControls={bindDrag:require('../dist/darkroom/photo-controls.js').bindDrag};f.h.RayBodyWorkspace={selectMode:next=>{f.nodes.get('bodyBox').dataset.bodyMode=next;}};f.h.bodyGeo=()=>({k:1,ox:0,oy:0,W:600,H:800});f.h.clamp=(v,a,b)=>Math.max(a,Math.min(b,v));f.h.draw=()=>{};
 f.nodes.get('bodyResetAll').onclick=()=>vm.runInContext('bodyDefaults()',f.h);vm.runInContext(read('line-editor.js'),f.h);const surface=f.nodes.get('rayBodyLineSurface');pane.querySelector('[data-line-mode=draw]').click();f.history.reset(f.h.Test48.capture());
 const event=(type,x,y)=>surface.dispatchEvent({type,clientX:x,clientY:y,button:0,pointerType:'touch',pointerId:1,cancelable:true,preventDefault(){},stopImmediatePropagation(){}});
 event('pointerdown',280,280);event('pointermove',300,340);event('pointermove',285,410);event('pointerup',285,410);const drawn=f.h.RayBodyLines.capture();assert.equal(drawn.lines.length,1);assert.equal(drawn.lines[0].points.length,3);assert.deepEqual(pixels(draw(f)),pixels(photo()),'drawing the line is not an automatic body edit');
 event('pointerdown',300,340);event('pointermove',285,340);event('pointerup',285,340);const bent=pixels(draw(f));assert.notDeepEqual(bent,pixels(photo()));const curved=f.h.RayBodyLines.capture().lines[0];assert.ok(Math.abs(curved.offsets[1][0])>Math.abs(curved.offsets[0][0]));f.h.RaySession.undo();assert.deepEqual(pixels(draw(f)),pixels(photo()));f.h.Test48.restore(f.history.redo());assert.deepEqual(pixels(draw(f)),bent);
 pane.querySelector('[data-line-nudge=left]').click();const edited=f.h.RayBodyLines.capture(),result=pixels(draw(f));assert.notDeepEqual(result,pixels(photo()));assert.ok(edited.lines[0].offsets.every(p=>p[0]<0));assert.ok(drawn.lines[0].offsets.every(p=>p[0]===0));
 f.h.RaySession.undo();assert.deepEqual(pixels(draw(f)),bent);f.h.Test48.restore(f.history.redo());assert.deepEqual(pixels(draw(f)),result);const saved=JSON.parse(JSON.stringify(f.h.Test48.capture()));f.h.RayBodyLines.clear();f.h.Test48.restore(saved);assert.deepEqual(pixels(draw(f)),result);assert.equal(surface.classList.contains('is-armed'),false,'restoring a draft must leave scrolling/compare available');

 const apply=sessionApply(f),done=pane.querySelector('[data-line-action=done]'),quickButton=f.nodes.get('rayBodyLineQuick');
 assert.match(quickButton.textContent,/Chỉnh tiếp nét/);done.click();assert.equal(surface.classList.contains('is-armed'),true);assert.deepEqual(pixels(draw(f)),result);
 for(let i=0;i<3;i++){
  const before=f.h.RayBodyLines.capture(),beforePixels=pixels(draw(f));await apply();
  assert.equal(f.h.document.querySelector('.film-workspace').classList.contains('is-result-preview'),false,'Apply must keep the body tools accessible');
  assert.equal(surface.hidden,false);assert.equal(surface.classList.contains('is-armed'),false,'Apply pauses drawing without losing the editable vector');
  assert.deepEqual(f.h.RayBodyLines.capture(),before);assert.deepEqual(pixels(draw(f)),beforePixels);assert.match(quickButton.textContent,/Chỉnh tiếp nét/);assert.match(done.textContent,/Chỉnh tiếp nét/);
  (i%2?done:quickButton).click();assert.equal(surface.classList.contains('is-armed'),true);assert.deepEqual(f.h.RayBodyLines.capture(),before);
  const lines=f.h.RayBodyLines.capture().lines,pt=f.h.RayBodyLineCore.project(lines[0].points[1],f.h.RayBodyLineCore.fields(lines,600,800),600,800),x=pt[0]*600,y=pt[1]*800;
  event('pointerdown',x,y);event('pointermove',x-5,y);event('pointerup',x-5,y);assert.notDeepEqual(pixels(draw(f)),beforePixels,'resumed pointer editing must change photo pixels');
  done.click();assert.equal(surface.classList.contains('is-armed'),false);done.click();assert.equal(surface.classList.contains('is-armed'),true,'Done becomes a direct resume action');
 }
 assert.equal(f.h.savedApplies,3);const final=f.h.Test48.capture(),finalPixels=pixels(draw(f));f.h.Test48.restore(JSON.parse(JSON.stringify(final)));assert.deepEqual(pixels(draw(f)),finalPixels);quickButton.click();assert.equal(surface.classList.contains('is-armed'),true);
 f.nodes.get('bodyResetAll').click();assert.equal(f.h.RayBodyLines.capture(),null);assert.deepEqual(pixels(draw(f)),pixels(photo()));
});
test('editing a second face preserves the first; removing one face template only removes its own recipe',()=>{const f=harness();faces(f,[face(.25,11),face(.75,22)]);f.h.RayFace55.apply();const first=JSON.stringify(f.strokes());assert.ok(f.strokes().every(s=>s.personId==='11'));f.nodes.get('r55Person').value='1';f.h.RayFace55.apply();assert.ok(f.strokes().some(s=>s.personId==='22'));assert.equal(JSON.stringify(f.strokes().filter(s=>s.personId==='11')),first);f.nodes.get('r55Reset').click();assert.equal(JSON.stringify(f.strokes()),first);});
test('preview is reversible and accepted without an export/preview mismatch; replacing a photo cannot reuse it',()=>{const f=harness();faces(f);f.nodes.get('r55Template').value='diamond';f.nodes.get('r55Template').onchange();const c=photo();f.h.RayLivePreviewMode=true;f.h.bodyWarp(c.getContext('2d'),300,400);const preview=pixels(c);f.h.RayFace55.acceptPreview();f.h.RayLivePreviewMode=false;assert.deepEqual(pixels(draw(f)),preview);f.nodes.get('r60Width').value='-20';f.nodes.get('r60Width').dispatchEvent({type:'input'});assert.equal(f.h.RayFace55.previewActive,true);f.h.source={width:600,height:800};vm.runInContext('bodyDefaults()',f.h);assert.deepEqual(pixels(draw(f)),pixels(photo()));assert.equal(f.h.RayFace55.previewActive,false);});
test('restoring old body undo data removes the new recipe; body reset and source reset clear it',()=>{const f=harness();faces(f);const original=vm.runInContext('bodySnap()',f.h);f.h.RayFace55.apply();f.h.bodyRestore(original);assert.equal(f.strokes().length,0);f.h.RayFace55.apply();f.body().sel='face';f.nodes.get('bodyReset1').click();assert.equal(f.strokes().length,0);assert.deepEqual(pixels(draw(f)),pixels(photo()));});
test('face geometry is normalized so preview and large export stay consistent',()=>{const f=harness();faces(f);f.h.RayFace55.apply();const small=pixels(draw(f,300,400)),large=pixels(draw(f,600,800));let sum=0,count=0;for(let y=30;y<180;y+=3)for(let x=75;x<225;x+=3)for(let ch=0;ch<3;ch++){sum+=Math.abs(small[(y*300+x)*4+ch]-large[((y*2)*600+x*2)*4+ch]);count++;}assert.ok(sum/count<2,'mean channel difference '+sum/count);});
function bodyData(f){
 const w=150,h=200,a=new Uint8Array(w*h);for(let y=15;y<185;y++)for(let x=50;x<100;x++)a[y*w+x]=255;
 f.h.BEAUTY.maps={width:w,height:h,foreground:a};f.h.BEAUTY.source=f.h.source;
 const regions={shL:{cx:.28,cy:.25},shR:{cx:.72,cy:.25}};f.h.BODY_AI.people=[{regions}];
 for(const p of f.parts()){p.place='ai';p.cx=.5;p.cy=['armL','armR'].includes(p.id)?.4:.55;p.rx=.08;p.ry=.065;}
 faces(f);f.h.BEAUTY.maps={width:w,height:h,foreground:a};
}
test('AI body proportions use pose and mask; applying twice is idempotent and keeps manual changes',()=>{const f=harness();bodyData(f);const m=f.h.RayOverall62.measure();assert.equal(m.ok,true);assert.ok(m.changes.length>=2);const p=f.parts().find(p=>p.id==='waist');p.wid=.05;const before=f.h.Test48.capture();f.history.reset(before);f.h.RayOverall62.apply();const key=vm.runInContext('bodySnap()',f.h);assert.ok(p.wid<.05);const result=pixels(draw(f));assert.notDeepEqual(result,pixels(photo()));f.h.RayOverall62.apply();assert.equal(vm.runInContext('bodySnap()',f.h),key);assert.deepEqual(pixels(draw(f)),result);f.h.RaySession.undo();assert.equal(f.parts().find(p=>p.id==='waist').wid,.05);});
test('missing segmentation, group photos and heavily oblique faces never claim an automatic result',()=>{const f=harness();faces(f);assert.equal(f.h.RayOverall62.measure().ok,false);bodyData(f);f.h.BODY_AI.people.push({regions:{}});assert.equal(f.h.RayOverall62.measure().ok,false);f.h.BEAUTY.people[0].face[1]={x:.4,y:.23};f.h.BEAUTY.people[0].face[33]={x:.3999,y:.23};f.h.BEAUTY.people[0].face[133]={x:.4001,y:.23};f.h.RayFace55.apply();assert.equal(f.strokes().length,0);});
test('the one-tap actions await scan and discard results for a replaced photo',async()=>{const f=harness();const order=[];f.h.RayFace55.scan=async()=>{order.push('scan');faces(f);};f.nodes.get('r48FaceOneTap').disabled=false;await f.nodes.get('r48FaceOneTap').onclick();assert.deepEqual(order,['scan']);assert.ok(f.strokes().length>0);const b=harness();b.h.RayOverall62.scan=async()=>{b.h.source={width:1,height:1};};b.nodes.get('r48BodyOneTap').disabled=false;await b.nodes.get('r48BodyOneTap').onclick();assert.match(b.nodes.get('ray62OverallStatus').textContent,/Ảnh đã thay đổi/);assert.ok(b.parts().every(p=>p.wid===0));});
test('v48 final-preview scheduler must not replace a pending face preview with unedited pixels',()=>{
 const f=harness(true);faces(f);f.nodes.get('r60Width').value='-25';f.nodes.get('r60Width').dispatchEvent({type:'input'});f.h.draw();
 const preview=Buffer.from(pixels(f.nodes.get('view').canvas));assert.equal(preview.equals(Buffer.from(pixels(f.h.source))),false);
 f.flush();assert.equal(Buffer.from(pixels(f.nodes.get('view').canvas)).equals(preview),true,'settling must preserve the visible draft');
});
test('Apply resumes the original full-quality pipeline once, preserving the face result',()=>{
 const f=harness(true);faces(f);f.nodes.get('r60Width').value='-25';f.nodes.get('r60Width').dispatchEvent({type:'input'});f.h.draw();
 assert.equal(f.h.RayBodyPreview48.active,true);
 assert.equal(f.h.fullRenders,0);
 const preview=Buffer.from(pixels(f.nodes.get('view').canvas));
 f.h.RayFace55.acceptPreview();f.h.draw();f.flush();f.flush();
 assert.equal(f.h.RayBodyPreview48.active,false);
 assert.equal(f.nodes.get('view').dataset.previewQuality,'full');
 assert.equal(Buffer.from(pixels(f.nodes.get('view').canvas)).equals(preview),true);
 assert.equal(f.pending.size,0);
 assert.equal(f.h.fullRenders,1);
});
test('pending body-ratio previews also stay visible and release quality refinement on commit',()=>{
 const f=harness(true);bodyData(f);f.nodes.get('r54Part').value='waist';f.nodes.get('r54Percent').value='-12';f.nodes.get('r54Percent').oninput();f.h.draw();
 const preview=Buffer.from(pixels(f.nodes.get('view').canvas));assert.equal(f.h.RayBodyPreview48.active,true);
 f.flush();assert.equal(Buffer.from(pixels(f.nodes.get('view').canvas)).equals(preview),true);
 f.h.RayRatioLive.accept();f.h.draw();f.flush();f.flush();
 assert.equal(f.h.RayBodyPreview48.active,false);assert.equal(f.nodes.get('view').dataset.previewQuality,'full');
 assert.equal(Buffer.from(pixels(f.nodes.get('view').canvas)).equals(preview),true);
});
test('canceling or leaving body tools releases the hold so other v48 tools keep full quality',()=>{
 const f=harness(true);faces(f);f.nodes.get('r60Width').value='-25';f.nodes.get('r60Width').dispatchEvent({type:'input'});f.h.draw();
 f.h.document.body.dataset.editorTool='film';f.h.draw();f.flush();f.flush();
 assert.equal(f.h.RayBodyPreview48.active,false);assert.equal(f.nodes.get('view').dataset.previewQuality,'full');
 assert.equal(Buffer.from(pixels(f.nodes.get('view').canvas)).equals(Buffer.from(pixels(f.h.source))),true);
});

test('choosing one AI body region leaves every unselected region unchanged and remains undoable',()=>{
 const f=harness();bodyData(f);f.nodes.get('ray62Scope').value='waist';
 const before=structuredClone(f.parts());f.history.reset(f.h.Test48.capture());
 const plan=f.h.RayOverall62.measure();assert.equal(plan.ok,true);assert.equal(plan.changes.length,1);assert.equal(plan.changes[0].id,'waist');
 f.h.RayOverall62.apply();assert.notEqual(f.parts().find(p=>p.id==='waist').wid,before.find(p=>p.id==='waist').wid);
 for(const p of f.parts())if(p.id!=='waist')assert.equal(JSON.stringify(p),JSON.stringify(before.find(b=>b.id===p.id)),p.id);
 f.h.RaySession.undo();assert.equal(JSON.stringify(f.parts()),JSON.stringify(before));
});

function headlessBody(withScanner=false){
 const f=harness(),fixture=require('./fixtures/body-pose.cjs'),base=read('base-0.js');
 f.h.RayBodyCore=require('../dist/darkroom/body-ai/pose-core.js');f.h.bodyChipEls=Object.fromEntries(f.parts().map(p=>[p.id,f.h.document.createElement('button')]));f.h.bodyAiEngine=()=>{};
 vm.runInContext(base.slice(base.indexOf('function bodyAiRegions'),base.indexOf('function bodyAiCurrent')),f.h);
 f.h.RayBodyRecognition=require('../dist/darkroom/body-ai/recognition-core.js');
 if(withScanner){
  f.h.source=photo(600,800);f.h.BODY_AI.job=0;
  for(const id of ['bodyAiAlign','bodyAiStatus']){const e=f.h.document.createElement('button');e.id=id;f.nodes.get('bodyBox').append(e);f.h[id]=e;}
  f.h.bodyAiPerson=f.nodes.get('bodyAiPerson');f.nodes.get('bodyBox').append(f.h.bodyAiPerson);
  f.h.bodyAiMessage=message=>{f.h.BODY_AI.message=message;f.nodes.get('bodyAiStatus').textContent=message;};
  f.h.bodyAiWorkerStop=()=>{};f.h.bodyAiDetect=(...args)=>f.detect(...args);
  f.h.RaySession.contextChanged=()=>{};
  vm.runInContext(base.slice(base.indexOf('function bodyAiCurrent'),base.indexOf('/* ============ làm đẹp')),f.h);
 }
 vm.runInContext(read('pose-adapter.js'),f.h,{filename:'pose-adapter.js'});
 const pose=fixture.pose(),mask=fixture.mask(pose,600,800);f.h.BODY_AI.people=f.h.bodyAiPeople({poses:[pose],faces:[],masks:[mask]},600,800);
 for(const p of f.parts()){const r=f.h.BODY_AI.people[0].regions[p.id];if(r)Object.assign(p,r,{place:'ai'});}
 f.nodes.get('bodyBox').dataset.bodyMode='body';return f;
}
test('a headless pose and its own person mask measure all eight limb regions without makeup recognition',()=>{
 const f=headlessBody(),plan=f.h.RayOverall62.measure();assert.equal(plan.ok,true);assert.equal(f.h.BEAUTY.maps,null);assert.equal(f.h.BEAUTY.people.length,0);
 for(const id of ['armL','armR','foreL','foreR','thL','thR','clL','clR'])assert.ok(plan.changes.some(e=>e.id===id),id+' is missing');
 for(const scope of ['arms','legs']){f.nodes.get('ray62Scope').value=scope;assert.equal(f.h.RayOverall62.measure().changes.length,4);}
});
test('AI forearm preview changes real pixels; Apply matches it exactly, other parts and Undo stay intact',()=>{
 const f=headlessBody();f.nodes.get('ray62Scope').value='foreL';f.history.reset(f.h.Test48.capture());const before=JSON.stringify(f.parts()),original=pixels(photo());
 f.h.RayOverall62.preview();f.h.RayLivePreviewMode=true;const preview=pixels(draw(f));assert.notDeepEqual(preview,original);assert.equal(JSON.stringify(f.parts()),before);
 f.h.RayRatioLive.accept();f.h.RayLivePreviewMode=false;assert.deepEqual(pixels(draw(f)),preview);
 const prior=JSON.parse(before);for(const p of f.parts())if(p.id!=='foreL')assert.equal(JSON.stringify(p),JSON.stringify(prior.find(a=>a.id===p.id)),p.id);
 f.h.RaySession.undo();assert.equal(JSON.stringify(f.parts()),before);assert.deepEqual(pixels(draw(f)),original);
});
test('body target outlines are visible in AI mode, hide in the result, and never modify image pixels',()=>{
 const f=headlessBody(),g=f.h.RayGeometry54,overlay=f.nodes.get('r54Overlay');g.guides(true,'overall');const before=pixels(photo());g.paintOverlay();assert.ok(pixels(overlay.canvas).some((n,i)=>i%4===3&&n>0));assert.deepEqual(pixels(photo()),before);
 f.h.RaySession.showResult(true);g.paintOverlay();assert.equal(pixels(overlay.canvas).some((n,i)=>i%4===3&&n>0),false);
 f.h.RaySession.showResult(false);g.guides(false);g.paintOverlay();assert.equal(pixels(overlay.canvas).some((n,i)=>i%4===3&&n>0),false);
});
test('temporarily hiding guides in manual mode preserves the body-outline preference',()=>{
 const f=headlessBody(),g=f.h.RayGeometry54,toggle=f.nodes.get('rayBodyOutline');toggle.checked=true;g.guides(false,'part');assert.equal(toggle.checked,true);g.guides(true,'overall');assert.equal(toggle.checked,true);
 toggle.checked=false;g.guides(false,'overall');g.guides(false,'part');assert.equal(toggle.checked,false);
});
test('refining the AI preview by region keeps the previewed shape and its undo point',()=>{
 const f=headlessBody();f.nodes.get('ray62Scope').value='clL';f.history.reset(f.h.Test48.capture());const before=JSON.stringify(f.parts());f.h.RayOverall62.preview();assert.equal(f.h.RayRatioLive.active,true);
 f.h.RayOverall62.refine();assert.equal(f.h.RayRatioLive.active,false);assert.ok(f.parts().find(p=>p.id==='clL').wid<0);f.h.RaySession.undo();assert.equal(JSON.stringify(f.parts()),before);
});
test('failed rescans keep valid contours and exactly preserve committed body pixels on the same photo',async()=>{
 const f=headlessBody(true);f.nodes.get('ray62Scope').value='foreL';f.h.RayOverall62.apply();const before=JSON.stringify(f.parts());
 const person=f.h.BODY_AI.people[0],mask=person.rayMask,rendered=pixels(draw(f));
 assert.equal(f.h.RayOverall62.measure().ok,true);f.detect=async()=>{throw new Error('WebGL context unavailable');};
 await f.nodes.get('bodyAiScan').onclick();assert.equal(f.h.BODY_AI.people[0],person);assert.equal(f.h.RayOverall62.measure().ok,true);assert.match(f.nodes.get('ray62OverallStatus').textContent,/xử lý đồ họa/);assert.equal(JSON.stringify(f.parts()),before);
 f.detect=async()=>({poses:[],faces:[],masks:[]});await f.nodes.get('bodyAiScan').onclick();assert.equal(f.h.BODY_AI.people[0].rayMask,mask);assert.equal(f.h.RayBodyPose.failure(),'');assert.match(f.h.RayBodyPose.warning(),/giữ viền/);assert.equal(JSON.stringify(f.parts()),before);
 f.detect=async()=>({poses:[],faces:[],masks:[],errors:['pose'],errorDetails:{pose:'Failed to fetch pose model'}});await f.nodes.get('bodyAiScan').onclick();assert.match(f.h.RayBodyPose.warning(),/Chưa tải được AI/);assert.equal(JSON.stringify(f.parts()),before);assert.deepEqual(pixels(draw(f)),rendered);
});
test('a canceled scan cannot erase recognition belonging to the next image',async()=>{
 const f=headlessBody(true);let finish;f.detect=()=>new Promise(resolve=>finish=resolve);const running=f.nodes.get('bodyAiScan').onclick();
 f.h.bodyAiReset();f.h.source=photo(600,800);const next={regions:{},raySource:f.h.source};f.h.BODY_AI.people=[next];finish({poses:[],faces:[],masks:[]});await running;assert.equal(f.h.BODY_AI.people[0],next);assert.equal(f.h.RayBodyPose.failure(),'');
});
test('restoring the draft contour needs no model and does not move existing body edits',()=>{
 const f=headlessBody();f.nodes.get('ray62Scope').value='foreL';f.nodes.get('ray62Strength').value='65';f.nodes.get('ray62Mode').value='balanced';f.nodes.get('rayBodyOutline').checked=false;
 const before=JSON.stringify(f.parts()),width=f.h.RayGeometry54.metricFor('foreL').widthPx,saved=structuredClone(f.h.RayBodyPose.capture());assert.ok(saved);
 f.h.BODY_AI.people=[];f.nodes.get('ray62Scope').value='all';f.nodes.get('ray62Strength').value='85';
 assert.equal(f.h.RayBodyPose.restore(saved),true);assert.equal(f.h.RayBodyPose.fromDraft(),true);assert.equal(f.h.RayGeometry54.metricFor('foreL').widthPx,width);assert.equal(JSON.stringify(f.parts()),before);assert.equal(f.nodes.get('ray62Scope').value,'foreL');assert.equal(f.nodes.get('ray62Strength').value,'65');assert.equal(f.nodes.get('rayBodyOutline').checked,false);assert.equal(f.h.RayOverall62.measure().ok,true);
 assert.equal(f.h.RayBodyPose.restore(null),false);assert.equal(JSON.stringify(f.parts()),before);
});
test('the primary body action reuses its valid contour and never applies a failed scan',async()=>{
 const f=headlessBody();let scans=0;f.h.RayOverall62.scan=async()=>{scans++;return false;};f.nodes.get('r48BodyOneTap').disabled=false;await f.nodes.get('r48BodyOneTap').onclick();assert.equal(scans,0);assert.equal(f.h.RayRatioLive.active,true);
 f.h.RayRatioLive.cancel();f.h.BODY_AI.people=[];await f.nodes.get('r48BodyOneTap').onclick();assert.equal(scans,1);assert.equal(f.h.RayRatioLive.active,false);
});
test('the first successful body scan only shows an editable contour and does not automatically reshape the person',async()=>{
 const f=harness();f.h.RayOverall62.scan=async()=>{bodyData(f);return true;};f.nodes.get('r48BodyOneTap').disabled=false;await f.nodes.get('r48BodyOneTap').onclick();assert.equal(f.h.RayOverall62.measure().ok,true);assert.equal(f.h.RayRatioLive.active,false);assert.deepEqual(pixels(draw(f)),pixels(photo()));assert.ok(f.parts().every(p=>p.wid===0&&p.len===0));
});
test('explicit draft save commits the visible body preview and keeps its undo point',()=>{
 const f=headlessBody();f.nodes.get('ray62Scope').value='foreL';f.history.reset(f.h.Test48.capture());const before=JSON.stringify(f.parts());f.h.RayOverall62.preview();f.h.RayLivePreviewMode=true;const preview=pixels(draw(f));
 f.nodes.get('sessionDraft').click();f.h.RayLivePreviewMode=false;assert.equal(f.h.RayRatioLive.active,false);assert.deepEqual(pixels(draw(f)),preview);assert.notEqual(JSON.stringify(f.parts()),before);f.h.RaySession.undo();assert.equal(JSON.stringify(f.parts()),before);
});

test('Apply still opens the result view for color tools and ignores busy body inference',async()=>{
 for(const tool of ['film','adjust']){const f=harness();await sessionApply(f,tool)();assert.equal(f.h.document.querySelector('.film-workspace').classList.contains('is-result-preview'),true);assert.equal(f.h.savedApplies,1);}
 const f=harness();f.h.BODY_AI.busy=true;assert.equal(sessionApply(f)(),undefined);assert.equal(f.h.savedApplies,undefined);
});
test('illustration edits participate in the real session history and old snapshots clear optional artwork',()=>{
 const f=harness(),core=require('../dist/darkroom/doodle-core.js'),state=core.state();f.h.RayDoodle=state;const base=f.h.Test48.capture();f.history.reset(base);
 const stroke={...core.defaults,id:'art-1',closed:false,points:[[.3,.3],[.4,.4]]};state.set([stroke]);f.h.RaySession.record('Vẽ nét');const first=f.h.Test48.capture();assert.notEqual(first.key,base.key);state.set([{...stroke,ink:'#112233',width:.009}]);f.h.RaySession.record('Đổi màu nét');const saved=JSON.parse(JSON.stringify(f.h.Test48.capture()));f.h.RaySession.undo();assert.equal(state.strokes[0].ink,core.defaults.ink);f.h.Test48.restore(f.history.redo());assert.equal(state.strokes[0].ink,'#112233');state.clear();f.h.Test48.restore(saved);assert.equal(state.strokes[0].width,.009);f.h.Test48.restore(base);assert.equal(state.capture(),null);
});

test('manual body Apply ends positioning, keeps pixels and settings editable, and confirms only a saved draft',async()=>{
 const f=harness(),before=f.h.Test48.capture();f.history.reset(before);const part=f.parts().find(p=>p.id==='waist');part.size=.55;part.wid=-.12;part.place='manual';
 const guide=[];f.h.RayEditorVisibility={guides:on=>guide.push(on)};const edited=pixels(draw(f)),apply=sessionApply(f);await apply();
 assert.deepEqual(guide,[false]);assert.equal(part.size,.55);assert.deepEqual(pixels(draw(f)),edited);assert.equal(f.h.document.querySelector('.film-workspace').classList.contains('is-result-preview'),false);assert.match(f.h.applyNotices[0],/Đã giữ chỉnh dáng/);assert.equal(f.h.savedApplies,1);
 const saved=JSON.parse(JSON.stringify(f.h.Test48.capture()));f.h.RaySession.undo();assert.deepEqual(pixels(draw(f)),pixels(photo()));f.h.Test48.restore(f.history.redo());assert.deepEqual(pixels(draw(f)),edited);f.h.Test48.restore(saved);assert.deepEqual(pixels(draw(f)),edited);f.parts().find(p=>p.id==='waist').size=.25;await apply();assert.equal(f.parts().find(p=>p.id==='waist').size,.25);assert.equal(f.h.applyNotices.length,2);
 f.h.testSaveResult=false;await apply();assert.equal(f.h.applyNotices.length,2,'failed draft writes cannot show a success confirmation');
});
test('programmatic body Apply commits a live AI preview before taking the durable snapshot',async()=>{
 const f=headlessBody();f.nodes.get('ray62Scope').value='foreL';f.history.reset(f.h.Test48.capture());f.h.RayOverall62.preview();f.h.RayLivePreviewMode=true;const visible=pixels(draw(f));assert.equal(f.h.RayRatioLive.active,true);await sessionApply(f)();f.h.RayLivePreviewMode=false;assert.equal(f.h.RayRatioLive.active,false);assert.deepEqual(pixels(draw(f)),visible);assert.match(f.h.applyNotices[0],/Đã giữ chỉnh dáng/);
});
