const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createCanvas}=require('@napi-rs/canvas');
const Catalog=require('../dist/darkroom/preset-catalog.js'),Runtime=require('../dist/darkroom/runtime-profile.js');
function original(){const html=fs.readFileSync(path.join(__dirname,'../dist/darkroom/index.html'),'utf8');return vm.runInNewContext('('+html.match(/const ROLLS = (\[[\s\S]*?\n\]);/)[1]+')');}
test('artistic groups alternate warm and cool colors, with every original recipe and stable ID retained',()=>{
 const old=original(),before=JSON.stringify(old),out=Catalog.extend(old);assert.equal(out.length,89);assert.equal(new Set(out.map(r=>r.id)).size,89);assert.equal(JSON.stringify(old),before);assert.equal(Catalog.extend(out).length,89);
 assert.equal(out[0].id,'goc');assert.equal(out[1].id,'trongveo');assert.deepEqual([...new Set(out.map(Catalog.groupOf))],Catalog.groupNames);
 for(const group of Catalog.groupNames){const rows=out.filter(r=>Catalog.groupOf(r)===group),warm=rows.filter(r=>(r.p.temp||0)>=0).length,cool=rows.length-warm;for(let i=1;i<Math.min(warm,cool)*2;i++)assert.notEqual((rows[i].p.temp||0)>=0,(rows[i-1].p.temp||0)>=0);}
 for(const r of old){const same=out.find(x=>x.id===r.id);assert.equal(same,r);assert.equal(same.g,r.g);assert.equal(JSON.stringify(same.p),JSON.stringify(r.p));}
});
test('home and editor metadata agree on IDs, names, groups and 88 filters plus original',()=>{
 const out=Catalog.extend(Runtime.rename(original())),home=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/presets.json'),'utf8'));assert.deepEqual(home.map(r=>r.id),out.map(r=>r.id));assert.equal(home.filter(r=>r.id!=='goc').length,88);
 for(let i=0;i<out.length;i++){assert.equal(home[i].name,out[i].name);assert.equal(home[i].group,Catalog.groupOf(out[i]));}
 for(const id of ['ngocdiep','tanhoc'])assert.ok(home.find(r=>r.id===id).description.length>30);
});
test('additional recipes produce distinct full-size pixels through the retained renderer without adding borders or retouching',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../dist/darkroom/index.html'),'utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1].split('/* ============ nối dây giao diện ============ */')[0],context={document:{createElement:()=>createCanvas(1,1)},view:{},beautyApply(){},bodyWarp(){}};context.window=context;vm.createContext(context);vm.runInContext(script+'\nthis.engine={P,render};',context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/darkroom/ray-preset-thu-nhat.js'),'utf8'),context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/darkroom/thu-nhat-adapter.js'),'utf8'),context);
 const source=createCanvas(320,240),ctx=source.getContext('2d'),gradient=ctx.createLinearGradient(0,0,320,240);gradient.addColorStop(0,'#f6decd');gradient.addColorStop(.4,'#91aeb9');gradient.addColorStop(.7,'#729263');gradient.addColorStop(1,'#192923');ctx.fillStyle=gradient;ctx.fillRect(0,0,320,240);ctx.fillStyle='#d7a78a';ctx.fillRect(35,40,80,100);const data=c=>Buffer.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data),before=data(source),defaults={...context.engine.P},results=[];
 for(const p of [{},...Catalog.additions.map(r=>r.p)]){Object.assign(context.engine.P,defaults,p,{stamp:false,frame:'none'});const out=createCanvas(1,1);context.engine.render(out,source);assert.deepEqual([out.width,out.height],[320,240]);assert.ok([...data(out)].every((v,i)=>i%4!==3||v===255));results.push(data(out));}
 assert.notDeepEqual(results[1],results[0]);assert.notDeepEqual(results[2],results[0]);assert.notDeepEqual(results[1],results[2]);assert.deepEqual(data(source),before);
 for(const r of Catalog.additions){assert.equal(r.p.frame,'none');assert.equal(r.p.leak,0);assert.ok(Object.keys(r.p).every(k=>!k.startsWith('brow')&&!['hair','skin','smooth','body'].includes(k)));}
});
