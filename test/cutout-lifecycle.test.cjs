const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const editor=fs.readFileSync(require.resolve('../dist/darkroom/cutout-editor.js'),'utf8'),compose=fs.readFileSync(require.resolve('../dist/darkroom/compose-editor.js'),'utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function jobs(){const notices=[],h={working:false,readToken:1,dialog:{open:true},syncs:0,notify:text=>notices.push(text),sync(){h.syncs++;}};vm.createContext(h);vm.runInContext(editor.slice(editor.indexOf(' async function job('),editor.indexOf(" button('apply').onclick=")),h);return{h,notices};}
test('a late modal job cannot close a reopened studio or clear its new busy operation',async()=>{
 const {h,notices}=jobs(),wait=deferred();let closes=0;const pending=h.job(async valid=>{await wait.promise;if(valid())closes++;});assert.equal(h.working,true);assert.equal(h.syncs,1);h.dialog.open=false;h.readToken++;h.dialog.open=true;h.working=true;wait.resolve();await pending;assert.equal(closes,0);assert.equal(h.working,true);assert.equal(h.syncs,1);assert.deepEqual(notices,[]);
});
test('a stale rejected modal job cannot overwrite a new selection status',async()=>{
 const {h,notices}=jobs(),wait=deferred(),pending=h.job(async()=>wait.promise);h.readToken++;h.dialog.open=true;h.working=true;wait.reject(Error('old error'));await pending;assert.deepEqual(notices,[]);assert.equal(h.working,true);assert.equal(h.syncs,1);
});
test('current modal jobs report errors and release busy state; concurrent clicks are ignored',async()=>{
 const {h,notices}=jobs(),wait=deferred();let calls=0;const pending=h.job(async valid=>{assert.equal(valid(),true);calls++;await wait.promise;});await h.job(async()=>{calls++;});assert.equal(calls,1);wait.resolve();await pending;assert.equal(h.working,false);assert.equal(h.syncs,2);await h.job(async()=>{throw Error('current error');});assert.deepEqual(notices,['current error']);assert.equal(h.working,false);
});
function composer(){const wait=deferred(),original={width:640,height:480};let serial=0,actions=0;const h={source:original,busy:false,window:{RayRemove:{busy:false}},BEAUTY:{busy:false},BODY_AI:{busy:false},state:{people:[],selectedPerson:null},uid:()=>String(++serial),decodeAsset:()=>wait.promise,action(label,fn){actions++;fn();}};vm.createContext(h);vm.runInContext(compose.slice(compose.indexOf(' async function addSticker('),compose.indexOf(' window.RayCompose=')),h);return{h,wait,original,get actions(){return actions;}};}
const record=()=>({name:'Tranh.png',blob:new Blob(['png'],{type:'image/png'}),width:50,height:40});
test('a decoded sticker cannot append after its studio session was closed',async()=>{
 const e=composer();let valid=true;const pending=e.h.addSticker(record(),{valid:()=>valid});valid=false;e.wait.resolve({width:50,height:40});await assert.rejects(pending);assert.equal(e.h.state.people.length,0);assert.equal(e.actions,0);assert.equal(e.h.source,e.original);
});
test('source changes, another AI operation or a full layer list during decode cannot silently swallow sticker insertion',async()=>{
 for(const changed of ['source','busy','full']){const e=composer(),pending=e.h.addSticker(record(),{valid:()=>true});if(changed==='source')e.h.source={};else if(changed==='busy')e.h.busy=true;else e.h.state.people=Array.from({length:4},(_,i)=>({id:String(i)}));e.wait.resolve({width:50,height:40});await assert.rejects(pending);assert.equal(e.actions,0);assert.equal(e.h.state.people.length,changed==='full'?4:0);}
});
test('a current decoded cutout is inserted as an independent editable sticker layer',async()=>{
 const e=composer(),input=record(),pending=e.h.addSticker(input,{valid:()=>true});e.wait.resolve({width:50,height:40});const id=await pending,p=e.h.state.people[0];assert.equal(e.actions,1);assert.equal(p.id,id);assert.equal(e.h.state.selectedPerson,id);assert.equal(p.asset.blob,input.blob);assert.equal(p.kind,'sticker');assert.equal(p.hidden,false);assert.equal(p.mask,null);assert.deepEqual(Array.from(p.strokes),[]);assert.equal(e.h.source,e.original);
});
test('the actual Use action cannot close a reopened studio after delayed layer decoding',async()=>{
 const {h,notices}=jobs(),wait=deferred(),started=deferred(),buttons=new Map();let closed=0,tools=0;h.button=id=>{if(!buttons.has(id))buttons.set(id,{});return buttons.get(id);};h.dialog.close=()=>{closed++;h.dialog.open=false;};h.output=async()=>record();h.api={addSticker:async()=>{started.resolve();await wait.promise;}};h.window={BuongToiApp:{showTools(){tools++;}}};vm.runInContext(editor.slice(editor.indexOf(" button('use').onclick="),editor.indexOf(" button('save').onclick=")),h);const pending=h.button('use').onclick();await started.promise;h.dialog.open=false;h.readToken++;h.dialog.open=true;h.working=true;wait.resolve();await pending;assert.equal(closed,0);assert.equal(tools,0);assert.equal(h.working,true);assert.deepEqual(notices,[]);
});
