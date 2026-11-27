const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createCanvas}=require('@napi-rs/canvas');
const root=path.join(__dirname,'../dist/darkroom'),read=name=>fs.readFileSync(path.join(root,name),'utf8'),copy=value=>JSON.parse(JSON.stringify(value));
const addedDefaults={rayNangPho:0,dehaze:0,detail:0},pixels=canvas=>Buffer.from(canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data);
function harness({session=false}={}){
 const node=()=>({hidden:false,textContent:'',style:{},dataset:{},classList:{toggle(){},contains(){return false;}},setAttribute(){},replaceChildren(){},append(){},before(){}}),nodes=new Map(),make=()=>createCanvas(1,1);
 const document={createElement:tag=>tag==='canvas'?make():node(),querySelector:()=>node(),querySelectorAll:()=>[],getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},body:node()};
 const source=createCanvas(120,90),ctx=source.getContext('2d'),image=ctx.createImageData(120,90);
 for(let y=0;y<90;y++)for(let x=0;x<120;x++){const texture=x%8<4?-12:12;image.data.set([90+x*.7+texture,110+y*.4+texture,130+x*.3+texture,255],(y*120+x)*4);}ctx.putImageData(image,0,0);
 const h={document,source,view:{},BEAUTY:{peek:false,busy:false,maps:null,faces:[],instances:[],values:{},people:[],ready:{},job:0},BODY_AI:{busy:false},BODY_HIST:{undo:[],redo:[],pending:null},exportLong:null,beautyApply(){},syncControls(){},queue(){},drawReadout(){},beautyRenderPeople(){},beautyUI(){},bodyUI(){},bodyHistUI(){},syncOval(){},syncLeakHandle(){},syncNangHandle(){},syncBody(){},update(){}};h.window=h;h.parent=h;vm.createContext(h);
 const native=read('index.html').match(/<script>([\s\S]*?)<\/script>/)[1].split('/* ============ nối dây giao diện ============ */')[0];vm.runInContext(native,h);
 // Clarity adds real controls in the app; this rendering fixture has no slider UI.
 document.getElementById=()=>null;
 for(const file of ['tone-core.js','ray-preset-thu-nhat.js','thu-nhat-adapter.js','clarity-core.js','clarity-adapter.js','ray-film-looks.js','film-looks-adapter.js','region-paint-core.js','adjust-scope-core.js'])vm.runInContext(read(file),h,{filename:file});
 document.getElementById=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
 vm.runInContext('this.state={P,F,NK,LK};',h);vm.runInContext(read('effect-layers.js'),h);
 const p=h.state.P;Object.assign(p,h.RayLayers.cleared(p),{frame:'none',stamp:false});
 const state=(values={})=>({id:'legacy',enabled:true,p:{...p,...values},focus:{...h.state.F},sun:{...h.state.NK},leak:{...h.state.LK},title:'Màu cũ'});
 function draw(preview=false){const out=make();if(preview)h.RayLayers.preview(()=>h.render(out,source));else h.render(out,source);return pixels(out);}
 if(session){
  vm.runInContext(read('edit-history.js'),h);
  const script=read('session.js');vm.runInContext(script.slice(0,script.indexOf(' const floating='))+'window.sessionFixture={capture,restore,history};})();',h);
 }
 return{h,p,state,draw,source};
}
function legacy(value){const saved=copy(value);for(const key of Object.keys(addedDefaults))delete saved.p[key];return saved;}

test('new effects stay in the current step when previewing and exporting pre-v116 saved layers',()=>{
 for(const [key,strength]of [['rayNangPho',1],['dehaze',.65],['detail',.7]]){
  const old=harness(),clean=harness(),saved=legacy(old.state({temp:.12,contrast:.1})),source=pixels(old.source);
  old.h.RayLayers.restore([saved]);clean.h.RayLayers.restore([{...copy(saved),p:{...saved.p,...addedDefaults}}]);
  assert.ok(old.draw(true).equals(clean.draw()),key+' neutral legacy rendering');
  old.p[key]=clean.p[key]=strength;
  const preview=old.draw(true),expected=clean.draw();
  assert.ok(preview.equals(expected),key+' preview changes only the current step');
  assert.ok(old.draw().equals(expected),key+' export agrees with cached preview');
  assert.equal(old.p[key],strength);assert.equal(Object.hasOwn(old.h.RayLayers.capture()[0].p,key),false,'legacy layer settings remain unchanged');assert.deepEqual(pixels(old.source),source);
 }
});

test('restoring and undoing a pre-v116 snapshot clears new current effects without dropping saved layers',()=>{
 const f=harness({session:true}),api=f.h.sessionFixture,savedLayer=legacy(f.state({temp:.18}));f.h.RayLayers.restore([savedLayer]);
 const saved=legacy(copy(api.capture())),expected=f.draw();saved.p.unknownLegacyValue=.37;api.history.reset(saved);
 Object.assign(f.p,{rayNangPho:.9,dehaze:.6,detail:.7});api.history.push(api.capture(),'Nét và màu mới');assert.notDeepEqual(f.draw(),expected);
 api.restore(api.history.undo());
 for(const key of Object.keys(addedDefaults))assert.equal(f.p[key],0,key+' clears on legacy undo');
 assert.equal(f.p.unknownLegacyValue,.37);assert.equal(f.h.RayLayers.count,1);assert.ok(f.draw().equals(expected));
 api.restore(api.history.redo());assert.equal(f.p.rayNangPho,.9);assert.equal(f.p.dehaze,.6);assert.equal(f.p.detail,.7);
 api.restore(saved);assert.ok(f.draw().equals(expected),'opening the legacy snapshot after new effects restores its pixels');
});
