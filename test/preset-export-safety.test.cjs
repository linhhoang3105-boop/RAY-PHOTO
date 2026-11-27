const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Brush=require('../dist/darkroom/brush-core.js'),Tone=require('../dist/darkroom/tone-core.js');
async function setup({fail=false}={}){
 const stroke={mode:'paint',size:.3,softness:.6,points:[[.5,.5]]},P={...Brush.defaults,brushEV:.8,brushStrokes:[stroke],toneExposure:.25,temp:.2,frame:'scan',stamp:true,dateText:'2026 10 28'},layers=[{p:{...Brush.defaults,brushEV:-.6,brushStrokes:[stroke],toneBrightness:.2},title:'Lớp trước'}];
 const noOp=()=>{},element={after:noOp,addEventListener:noOp},busy={classList:{add:noOp,remove:noOp}},source={width:80,height:60},pixels=new Uint8ClampedArray(80*60*4);for(let i=0;i<pixels.length;i+=4)pixels.set([100,115,90,255],i);
 let rendered,applied=0;const draw=()=>{const out=new Uint8ClampedArray(pixels);for(const layer of [...layers,{p:P}])Tone.applyPixels(out,80,60,layer.p,{cx:.5,cy:.5,rx:.2,ry:.3});return out;};
 const session={documentKey:'legacy-advanced-draft',apply:async()=>{applied++;},ensureSaved:()=>{throw new Error('Storage full must not block exporting');}};
 const h={P,source,Rules:await import('../dist/darkroom/preset-rules.mjs'),session:()=>session,RaySession:session,RayQuality:{plan:()=>({width:80,height:60}),output:async options=>{options.render({},source);if(fail)throw new Error('encoder failed');return{blob:new Blob(['photo']),width:80,height:60};}},document:{createElement:()=>({setAttribute:noOp}),getElementById:()=>element},syncControls:noOp,draw:noOp,render:()=>{rendered=draw();},saveBtn:{disabled:false},BEAUTY:{},BODY_AI:{},busy,exportLong:null,nextFrame:async()=>{},stamp:()=>'ray.jpg'};h.window=h;vm.createContext(h);
 const module=fs.readFileSync(path.join(__dirname,'../dist/darkroom/my-presets.mjs'),'utf8'),start=module.indexOf('window.RayAccess='),end=module.indexOf('\nconst dialog=',start);vm.runInContext(module.slice(start,end),h);vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/darkroom/quality-editor.js'),'utf8'),h);
 return{h,layers,draw,get rendered(){return rendered;},get applied(){return applied;}};
}
test('anonymous exports retain every local stroke and effect in legacy drafts without a server or payment check',async()=>{
 const s=await setup(),before=JSON.stringify({p:s.h.P,layers:s.layers}),expected=s.draw(),result=await s.h.RayQualityExport.exportFile();assert.deepEqual(s.rendered,expected);assert.equal(result.basicCopy,false);assert.equal(result.origin,'darkroom');assert.equal(result.draftId,'legacy-advanced-draft');assert.equal(s.applied,1);assert.equal(JSON.stringify({p:s.h.P,layers:s.layers}),before);assert.equal(s.h.saveBtn.disabled,false);
 const stripped={...s.h.P,brushStrokes:[]},plain=new Uint8ClampedArray(80*60*4);for(let i=0;i<plain.length;i+=4)plain.set([100,115,90,255],i);Tone.applyPixels(plain,80,60,stripped,{cx:.5,cy:.5,rx:.2,ry:.3});assert.notDeepEqual(s.rendered,plain);
});
test('failed full exports preserve all settings and release the save button',async()=>{
 const s=await setup({fail:true}),before=JSON.stringify({p:s.h.P,layers:s.layers});await assert.rejects(s.h.RayQualityExport.exportFile(),/encoder failed/);assert.equal(JSON.stringify({p:s.h.P,layers:s.layers}),before);assert.equal(s.h.saveBtn.disabled,false);
});
