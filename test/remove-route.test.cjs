const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),Core=require('../dist/darkroom/remove-core.js');
const editor=fs.readFileSync(require.resolve('../dist/darkroom/remove-editor.js'),'utf8'),session=fs.readFileSync(require.resolve('../dist/darkroom/session.js'),'utf8');
const fast=()=>({...Core.defaults(),engine:'ai',patches:[{id:'old',detail:'original'}],lastPatchId:'old',lastSelection:[{mode:'paint',points:[[.2,.3],[.7,.8]],size:.12}]});
test('result labels describe saved pixels rather than the currently selected AI mode',()=>{
 const state=fast(),info=Core.resultInfo(state);assert.equal(info.kind,'patch');assert.match(info.label,/chưa chạy AI/);assert.equal(info.canRebuild,true);
 const neural={...state,patches:[{id:'old',engine:'lama',detail:'generated'}]},ai=Core.resultInfo(neural);assert.equal(ai.kind,'ai');assert.match(ai.label,/AI đã tái tạo/);assert.equal(ai.canRebuild,false);
 const mixed=Core.resultInfo({...neural,patches:[...neural.patches,{id:'other',detail:'original'},{id:'legacy'}]});assert.deepEqual([mixed.ai,mixed.fast,mixed.unknown],[1,1,1]);assert.equal(mixed.kind,'mixed');assert.match(mixed.label,/Vá nhanh: 1/);
 assert.equal(Core.resultInfo({patches:[{id:'unknown'}],engine:'ai'}).kind,'legacy');assert.equal(Core.resultInfo(Core.defaults()).kind,'none');
});
test('choosing a background sample never silently changes the selected reconstruction engine',()=>{
 const start=editor.indexOf("if(state.mode==='sample'){"),end=editor.indexOf('const guarding=',start),action='function sample(){'+editor.slice(start,end)+'}';
 for(const engine of ['ai','patch']){const c={state:{engine,mode:'sample'},p:[.2,.4],update(values){c.state={...c.state,...values};},sync(){}};vm.createContext(c);vm.runInContext(action,c);c.sample();assert.equal(c.state.engine,engine);assert.equal(c.state.mode,'paint');assert.deepEqual([...Object.values(c.state.reference)],[.2,.4]);}
});
test('rebuilding an old result explicitly chooses AI and reuses its saved selection',async()=>{
 const state=fast(),selection=state.lastSelection,events=[],c={core:Core,state:{...state,engine:'patch'},fileOnly:false,busy:false,otherBusy:()=>false,record(){},update(values){c.state={...c.state,...values};},async run(retry){events.push({retry,engine:c.state.engine,selection:c.state.lastSelection});return true;}};
 vm.createContext(c);vm.runInContext(editor.slice(editor.indexOf(' async function rebuildAI()'),editor.indexOf(" $('repairRemove').onclick")),c);assert.equal(await c.rebuildAI(),true);assert.equal(events.length,1);assert.equal(events[0].retry,true);assert.equal(events[0].engine,'ai');assert.equal(events[0].selection,selection);assert.equal(c.state.patches[0].id,'old','old result stays until inference succeeds');
 c.fileOnly=true;events.length=0;assert.equal(await c.rebuildAI(),false);assert.equal(events.length,0);
});
function sessionAction(repair){const events=[],remove={busy:false,resultInfo:{canRebuild:true},message:'AI chưa chạy được',rebuildAI:repair},c={source:{},documentKey:'a',activeTool:'film',BEAUTY:{busy:false},BODY_AI:{busy:false},window:{RayRemove:remove,BuongToiApp:{showTools:t=>events.push('tool:'+t)}},showResult:on=>events.push('result:'+on),notify:(text,error)=>events.push({text,error}),applyStep:async()=>{events.push('apply');return true;}};vm.createContext(c);vm.runInContext(session.slice(session.indexOf(' async function rebuildRemoval()'),session.indexOf(' function showResult(')),c);return{c,remove,events};}
test('the visible Use AI action awaits reconstruction before applying and saving the result',async()=>{
 let finish;const h=sessionAction(()=>new Promise(resolve=>finish=resolve)),pending=h.c.rebuildRemoval();assert.deepEqual(h.events,['tool:remove','result:false']);finish(true);assert.equal(await pending,true);assert.deepEqual(h.events,['tool:remove','result:false','apply']);
});
test('failed, cancelled or stale AI reconstruction never confirms a new result',async()=>{
 const failed=sessionAction(async()=>false);assert.equal(await failed.c.rebuildRemoval(),false);assert.ok(!failed.events.includes('apply'));assert.deepEqual(failed.events.at(-1),{text:'AI chưa chạy được',error:true});
 let finish;const changed=sessionAction(()=>new Promise(resolve=>finish=resolve)),pending=changed.c.rebuildRemoval();changed.c.documentKey='b';finish(true);assert.equal(await pending,false);assert.ok(!changed.events.includes('apply'));
 const busy=sessionAction(async()=>true);busy.remove.busy=true;assert.equal(await busy.c.rebuildRemoval(),false);assert.equal(busy.events.length,0);
});
function element(){const classes=new Set();return{dataset:{},disabled:false,hidden:false,textContent:'',classList:{contains:s=>classes.has(s),toggle(s,on){if(on)classes.add(s);else classes.delete(s);},remove:s=>classes.delete(s)}};}
test('the real session exposes processor proof and cancellable progress in the result toolbar',()=>{
 const app=element();app.classList.toggle('is-result-preview',true);const remove={resultInfo:Core.resultInfo(fast()),busy:false,message:''},c={app,source:{},BEAUTY:{busy:false},BODY_AI:{busy:false},window:{RayRemove:remove},history:{canUndo:true,canRedo:false,cursor:2},activeTool:'remove',names:{remove:'Xóa người'},capture:()=>({key:'same'}),appliedKey:'same'};
 for(const key of ['undo','redo','apply','cancel','save','compare','status','rebuild','stopRemove'])c[key]=element();vm.createContext(c);vm.runInContext(session.slice(session.indexOf(' function update(){'),session.indexOf(' function record(')),c);
 c.update();assert.equal(c.status.dataset.removeKind,'patch');assert.match(c.status.textContent,/chưa chạy AI/);assert.equal(c.rebuild.hidden,false);assert.equal(c.stopRemove.hidden,true);assert.equal(app.classList.contains('has-remove-result'),true);
 app.classList.toggle('is-result-preview',false);remove.busy=true;remove.message='AI đang tái tạo nền…';c.update();assert.equal(c.status.textContent,remove.message);assert.equal(c.rebuild.hidden,true);assert.equal(c.stopRemove.hidden,false);assert.equal(app.classList.contains('remove-processing'),true);
 remove.busy=false;remove.resultInfo=Core.resultInfo({...fast(),patches:[{id:'old',engine:'lama',detail:'generated'}]});app.classList.toggle('is-result-preview',true);c.update();assert.equal(c.status.dataset.removeKind,'ai');assert.match(c.status.textContent,/AI đã tái tạo/);assert.equal(c.rebuild.hidden,true);assert.equal(c.stopRemove.hidden,true);
});
