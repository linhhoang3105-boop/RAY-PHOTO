/* A shaded face needs local relighting; a black garment and white logo are not underexposed skin. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createCanvas,DOMMatrix}=require('@napi-rs/canvas');
const Core=require('../dist/darkroom/ai-composer-core.js'),Layers=require('../dist/darkroom/effect-layers.js'),Recipes=require('../dist/darkroom/ai-composer-recipes.js'),Catalog=require('../dist/darkroom/preset-catalog.js');
const copy=v=>JSON.parse(JSON.stringify(v)),root=path.join(__dirname,'../dist/darkroom'),make=()=>createCanvas(1,1);
function harness(){
 const script=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split('/* ============ nối dây giao diện ============ */')[0];
 const c={DOMMatrix,document:{createElement:make,body:{classList:{contains:()=>false}}},CanvasRenderingContext2D:make().getContext('2d').constructor,view:{},beautyApply(){},BEAUTY:{peek:true,maps:null,faces:[],values:{},people:[],ready:{}}};c.window=c;vm.createContext(c);vm.runInContext(script+'\nthis.e={P,F,NK,LK,BODY,ROLLS};',c);
 for(const name of ['brush-core.js','tone-core.js','ray-preset-thu-nhat.js','thu-nhat-adapter.js','clarity-core.js','clarity-adapter.js','ray-film-looks.js','film-looks-adapter.js','light-core.js','region-paint-core.js','adjust-scope-core.js'])vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),c,{filename:name});
 vm.runInContext('this.e.render=render;',c);const e=c.e,defaults={...e.P,frame:'none',stamp:false};e.BODY.peek=true;
 const state=()=>({p:{...defaults},focus:{...e.F},sun:{x:.5,y:.04},leak:{x:.08,y:.08},enabled:true});
 function pass(target,source,layer){Object.assign(e.P,defaults,layer.p,{frame:'none',stamp:false});Object.assign(e.F,layer.focus);Object.assign(e.NK,layer.sun);Object.assign(e.LK,layer.leak);e.render(target,source);}
 return{presets:Catalog.extend(copy(e.ROLLS)),render(source,plan){const layers=Core.scale(plan,100).components.map(p=>({...state(),...copy(p),p:{...defaults,...copy(p.p),frame:'none',stamp:false}}));return Layers.renderApplied(source,layers,pass,make);}};
}
function portrait({skinMode='face'}={}){
 const W=240,H=320,canvas=createCanvas(W,H),ctx=canvas.getContext('2d'),im=ctx.createImageData(W,H),foreground=new Uint8Array(W*H),skin=new Uint8Array(W*H),hair=new Uint8Array(W*H);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const k=y*W+x,head=((x-120)/45)**2+((y-85)/65)**2<1,face=((x-120)/26)**2+((y-101)/38)**2<1,hand=x>85&&x<160&&y>57&&y<68,shirt=x>68&&x<177&&y>146&&y<316,logo=shirt&&x>88&&x<157&&y>169&&y<225,t=x%6<3?-4:4;
  let rgb=y<145?[75+t,108+t,67+t]:[139+t,117+t,91+t];
  if(shirt)rgb=logo?[237,240,245]:[34+t,36+t,43+t];
  if(head)rgb=[48+t,30+t,23+t];
  if(face)rgb=y<99?[52+t,28+t,28+t]:[129+t,79+t,80+t];
  if(face&&x>122&&y>108&&y<124)rgb=[190+t,147+t,129+t];
  if(hand)rgb=[183,141,119];
  im.data.set([...rgb,255],k*4);foreground[k]=head||hand||shirt?255:0;skin[k]=hand||face&&skinMode==='face'?255:0;hair[k]=head&&!face&&!hand?255:0;
 }
 ctx.putImageData(im,0,0);
 return{canvas,data:im.data,W,H,maps:{width:W,height:H,foreground,skin,hair},faces:[[{x:94/W,y:63/H},{x:146/W,y:63/H},{x:146/W,y:139/H},{x:94/W,y:139/H}]],boxes:{shadow:[110,83,130,95],cheek:[109,109,120,120],brightSkin:[126,111,138,122],black:[85,246,156,291],logo:[99,181,145,211],hair:[150,92,157,114],background:[195,167,229,266]}};
}
function sample(data,W,box){const values=[],rgb=[0,0,0];let clips=0,edge=0,nedge=0;for(let y=box[1];y<box[3];y++)for(let x=box[0];x<box[2];x++){const i=(y*W+x)*4,l=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];values.push(l);for(let k=0;k<3;k++)rgb[k]+=data[i+k];if(Math.max(data[i],data[i+1],data[i+2])===255)clips++;if(x>box[0]){edge+=Math.abs(l-(.2126*data[i-4]+.7152*data[i-3]+.0722*data[i-2]));nedge++;}}values.sort((a,b)=>a-b);return{mean:values.reduce((a,b)=>a+b,0)/values.length,p10:values[Math.floor(values.length*.1)],rgb:rgb.map(v=>v/values.length),clips,edge:edge/Math.max(1,nedge)};}
test('person relighting opens mixed face shadow without fading black knit or clipping skin and the white logo',()=>{
 const h=harness(),f=portrait();
 for(const detection of ['landmarks','skin-fallback'])for(const style of ['backlight','restore-detail']){
  const a=Core.analyze(f.data,f.W,f.H,{maps:f.maps,faces:detection==='landmarks'?f.faces:[]}),plan=Core.generate(a,{style,seed:177,presets:h.presets})[0],out=h.render(f.canvas,plan),data=out.getContext('2d').getImageData(0,0,f.W,f.H).data,label=style+' / '+detection,before=Object.fromEntries(Object.entries(f.boxes).map(([k,b])=>[k,sample(f.data,f.W,b)])),after=Object.fromEntries(Object.entries(f.boxes).map(([k,b])=>[k,sample(data,f.W,b)]));
  assert.ok(after.shadow.mean>before.shadow.mean*2,label+': shadow under the hand visibly opens');
  assert.ok(after.shadow.edge>before.shadow.edge*.75,label+': warm shadow detail is not flattened into a bright plateau');
  assert.ok(after.shadow.rgb[0]-after.shadow.rgb[1]<(before.shadow.rgb[0]-before.shadow.rgb[1])*2,label+': recovered skin does not develop a strong red cast');
  assert.ok(after.cheek.mean>before.cheek.mean*1.5,label+': face midtones brighten');
  assert.ok(after.black.mean<=before.black.mean+6,label+': black knit is not mistaken for underexposed skin');
  assert.equal(after.logo.clips,0,label+': the white logo gains no clipped channels');assert.equal(after.brightSkin.clips,0,label+': bright skin retains channel headroom');
  assert.ok(after.background.mean<=before.background.mean+4,label+': face rescue adds no background exposure');
  assert.ok(after.hair.edge>before.hair.edge*.65,label+': surviving hair texture stays visible');
  for(const c of plan.components)assert.ok((c.p.toneExposure||0)<=2,label+': native exposure range stays bounded');
  const saved=Recipes.decode(Recipes.encode(Recipes.create(plan)));assert.deepEqual(saved.components.map(c=>c.p),plan.components.map(c=>c.p),label+': native relighting remains an editable recipe');
 }
});
test('a hand-only skin detection does not receive a strong invented face fill',()=>{
 const f=portrait({skinMode:'hand'}),a=Core.analyze(f.data,f.W,f.H,{maps:f.maps,faces:[]}),plan=Core.generate(a,{style:'restore-detail',seed:177,presets:[]})[0];
 for(const c of plan.components.filter(c=>c.id.startsWith('face-'))){assert.ok((c.p.toneExposure||0)<=.8,'an uncorroborated hand is not exposed as a confident face');assert.ok((c.p.toneShadows||0)<=.2,'an uncorroborated hand gets no strong face-shadow lift');}
});
test('an ordinary color style also relights face shadow and leaves an already lit face alone',()=>{
 const h=harness(),f=portrait(),analyze=()=>Core.analyze(f.data,f.W,f.H,{maps:f.maps,faces:f.faces}),plan=Core.generate(analyze(),{style:'natural',seed:177,presets:h.presets})[0],plain=copy(plan);plain.components=plain.components.filter(c=>!c.id.startsWith('face-'));
 const read=p=>{const c=h.render(f.canvas,p);return c.getContext('2d').getImageData(0,0,f.W,f.H).data;},before=read(plain),after=read(plan);
 assert.ok(sample(after,f.W,f.boxes.shadow).mean>sample(before,f.W,f.boxes.shadow).mean+25,'face shadow is relit in addition to the color style');
 assert.ok(sample(after,f.W,f.boxes.brightSkin).clips<=sample(before,f.W,f.boxes.brightSkin).clips,'local face relighting adds no clipped skin');
 for(let k=0;k<f.W*f.H;k++)if(f.maps.skin[k])f.data.set([185,145,130,255],k*4);
 const lit=Core.generate(analyze(),{style:'natural',seed:177,presets:h.presets})[0];assert.ok(!lit.components.some(c=>c.id.startsWith('face-')),'a reliably lit face does not receive an unnecessary face lift');
});
