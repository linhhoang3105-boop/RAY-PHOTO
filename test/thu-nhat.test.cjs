const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto');
const {createCanvas,DOMMatrix}=require('@napi-rs/canvas');
const preset=require('../dist/darkroom/ray-preset-thu-nhat.js'),adapter=require('../dist/darkroom/thu-nhat-adapter.js'),Scope=require('../dist/darkroom/adjust-scope-core.js'),Layers=require('../dist/darkroom/effect-layers.js'),Catalog=require('../dist/darkroom/preset-catalog.js');
const read=n=>fs.readFileSync(path.join(__dirname,'../dist/darkroom',n),'utf8'),make=()=>createCanvas(1,1),pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
function harness(integrated){
 const script=read('index.html').match(/<script>([\s\S]*?)<\/script>/)[1].split('/* ============ nối dây giao diện ============ */')[0];
 const h={DOMMatrix,document:{createElement:make,body:{classList:{contains:()=>false}}},view:{},beautyApply(){},BEAUTY:{peek:false,values:{},people:[],ready:{},maps:null,faces:[]}};h.window=h;vm.createContext(h);vm.runInContext(script,h);vm.runInContext(read('tone-core.js'),h);
 if(integrated)for(const n of ['ray-preset-thu-nhat.js','thu-nhat-adapter.js','clarity-core.js','clarity-adapter.js','ray-film-looks.js','film-looks-adapter.js'])vm.runInContext(read(n),h);
 vm.runInContext('this.e={P,render};',h);const defaults={...h.e.P,stamp:false,frame:'none'};
 return{draw(src,p={}){Object.assign(h.e.P,defaults,p);const out=make();Scope.renderScoped(out,src,h.e.P,h.e.render,make);return out;}};
}
function scene(){const c=createCanvas(160,120),ctx=c.getContext('2d'),g=ctx.createLinearGradient(0,0,160,120);g.addColorStop(0,'#345a38');g.addColorStop(.4,'#d0a58a');g.addColorStop(1,'#99c1df');ctx.fillStyle=g;ctx.fillRect(0,0,160,120);return c;}
test('every existing preset retains identical full-resolution pixels and relative order',()=>{
 const old=harness(false),next=harness(true),src=scene(),html=read('index.html'),rolls=vm.runInNewContext('('+html.match(/const ROLLS = (\[[\s\S]*?\n\]);/)[1]+')'),existing=Catalog.extend(rolls).filter(r=>r.id!=='thunhat'&&r.id!=='nangpho');
 for(const r of existing)assert.deepEqual(pixels(next.draw(src,r.p)),pixels(old.draw(src,r.p)),r.id);
 // Frozen v114 order also works in a source ZIP without a .git directory.
 assert.deepEqual(existing.map(r=>r.id),require('./fixtures/preset-order-v114.json').order);
});
test('Thu Nhật uses the supplied algorithm, preserves dimensions and resets to exact original',()=>{
 const h=harness(true),legacy=harness(false),src=scene(),graded=scene();adapter.apply(graded.getContext('2d'),160,120,1);
 assert.deepEqual(pixels(h.draw(src,{rayThuNhat:1})),pixels(legacy.draw(graded)));assert.notDeepEqual(pixels(h.draw(src,{rayThuNhat:1})),pixels(h.draw(src)));
 assert.deepEqual([h.draw(src,{rayThuNhat:1}).width,h.draw(src,{rayThuNhat:1}).height],[160,120]);assert.deepEqual(pixels(h.draw(src,{rayThuNhat:0})),pixels(legacy.draw(src)));
 const a={width:2,height:1,data:new Uint8ClampedArray([45,90,140,73,10,90,45,0])},b=structuredClone(a);preset.apply(a);preset.apply(b);assert.deepEqual(a.data,b.data);assert.equal(a.data[3],73);assert.equal(a.data[7],0);
});
test('custom grade is confined to inside/outside masks and never touches frame pixels',()=>{
 const h=harness(true),src=scene(),region={adjustRegionShape:'rect',adjustRegionFeather:0,adjustRegionRX:.2,adjustRegionRY:.2},base=pixels(h.draw(src)),full=pixels(h.draw(src,{rayThuNhat:1}));
 for(const side of ['in','out']){const p={...Scope.defaults,...region,rayThuNhat:1,adjustRegion:side},actual=pixels(h.draw(src,p)),weight=Scope.weight(p,160,120);for(let y=0;y<120;y++)for(let x=0;x<160;x++){const i=(y*160+x)*4;assert.deepEqual(actual.subarray(i,i+4),(weight(x,y)?full:base).subarray(i,i+4));}}
 const a=h.draw(src,{frame:'polaroid'}),b=h.draw(src,{frame:'polaroid',rayThuNhat:1}),pa=pixels(a),pb=pixels(b),bw=Math.round(160*.055);assert.deepEqual([a.width,a.height],[b.width,b.height]);for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++)if(x<bw||x>=bw+160||y<bw||y>=bw+120){const i=(y*a.width+x)*4;assert.deepEqual(pa.subarray(i,i+4),pb.subarray(i,i+4));}
});
test('apply, layer value editing, portable recipes and descriptions retain custom strength',async()=>{
 const Rules=await import('../dist/darkroom/preset-rules.mjs'),Details=await import('../dist/darkroom/layer-parameters.mjs'),p={rayThuNhat:1,rayBasePreset:'thunhat',...Scope.defaults,adjustRegion:'out'};
 assert.equal(Layers.active(p),true);assert.equal(Layers.cleared(p).rayThuNhat,0);assert.equal(Layers.active(Layers.cleared(p)),false);
 const edited=Layers.withValues([{id:'thu',p}],'thu',{rayThuNhat:.65});assert.equal(edited[0].p.rayThuNhat,.65);
 const recipe=Rules.capture({p:edited[0].p,layers:[]},'Thu đã chỉnh'),restored=Rules.validate(JSON.parse(JSON.stringify(recipe)));assert.equal(restored.layers[0].rayThuNhat,.65);assert.equal(restored.layers[0].adjustRegion,'out');assert.throws(()=>Rules.validate({...recipe,layers:[{rayThuNhat:2}]}));
 assert.equal(Details.describeLayer({p}).rows.find(r=>r.key==='rayThuNhat').formatted,'+100');
});
// v104 starting source, commit 2824452: Composer must not edit this engine.
test('original inline engine stays byte-for-byte intact',()=>{const html=read('index.html'),inline=html.match(/<script>([\s\S]*?)<\/script>/)[1];assert.equal(crypto.createHash('sha256').update(inline).digest('hex'),'9ec934f1561ed7ff6d201ce59d264e1d37f3014c2f510d4d04540dcd8421b12d');});
