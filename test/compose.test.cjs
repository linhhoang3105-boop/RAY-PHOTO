const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createCanvas,GlobalFonts}=require('@napi-rs/canvas');
const Core=require('../dist/darkroom/compose-core.js'),{Timeline}=require('../dist/darkroom/edit-history.js');
GlobalFonts.registerFromPath(path.join(__dirname,'../dist/fonts/noto-serif-regular.woff2'),'BT Serif');
GlobalFonts.registerFromPath(path.join(__dirname,'../dist/fonts/be-vietnam-regular.woff2'),'BT Sans');
for(const [file,family]of [['noto-serif-italic.woff2','BT Serif'],['dancing-script.woff2','Dancing Script'],['lora-regular.woff2','Lora'],['lora-italic.woff2','Lora'],['mali-regular.woff2','Mali'],['mali-italic.woff2','Mali']])GlobalFonts.registerFromPath(path.join(__dirname,'../dist/fonts/'+file),family);
for(const [file,family]of [['montserrat-regular.woff2','Montserrat'],['montserrat-italic.woff2','Montserrat'],['playfair-display-regular.woff2','Playfair Display'],['playfair-display-italic.woff2','Playfair Display'],['cormorant-garamond-regular.woff2','Cormorant Garamond'],['cormorant-garamond-italic.woff2','Cormorant Garamond'],['patrick-hand.woff2','Patrick Hand']])GlobalFonts.registerFromPath(path.join(__dirname,'../dist/fonts/'+file),family);
const make=()=>createCanvas(1,1),pixels=c=>Buffer.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data),pixel=(c,x,y)=>[...c.getContext('2d').getImageData(x,y,1,1).data];
function source(W=120,H=80){const c=createCanvas(W,H),x=c.getContext('2d');x.fillStyle='#924c37';x.fillRect(0,0,W,H);return c;}
function bg(values={}){return{...Core.defaults().background,enabled:true,...values};}
function mask(W=120,H=80){const data=new Uint8Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++)data[y*W+x]=x>=W*.35&&x<W*.65?255:0;return{id:'mask-1',width:W,height:H,data};}
test('poetic fonts render Vietnamese captions distinctly and italic remains independent of rotation',()=>{
 const settings={text:'Một chút nắng, một chút thương',x:.5,y:.5,size:.065,color:'#ffffff',opacity:1,angle:0},results=[];
 for(const font of ['dancing','mali','lora']){const cv=source(1200,240);Core.drawText(cv.getContext('2d'),{...settings,font},1200,240);results.push(pixels(cv));}
 assert.notDeepEqual(results[0],results[1]);assert.notDeepEqual(results[1],results[2]);
 for(const font of ['serif','dancing','mali','lora']){const a=source(1200,240),b=source(1200,240);Core.drawText(a.getContext('2d'),{...settings,font},1200,240);Core.drawText(b.getContext('2d'),{...settings,font,italic:true},1200,240);assert.notDeepEqual(pixels(a),pixels(b));}
});
test('italic text and a chosen font survive undo and draft restore and legacy text stays upright',()=>{
 const before=Core.defaults(),after={...before,texts:[{id:'poem',text:'Hải Phòng trong nắng',font:'lora',italic:true,angle:-12,size:.07}]},h=new Timeline();h.reset({key:Core.signature(before),compose:before});h.push({key:Core.signature(after),compose:after});assert.equal(h.undo().compose.texts.length,0);assert.equal(h.redo().compose.texts[0].italic,true);const restored=new Timeline();restored.restore(structuredClone(h.serialize()));assert.deepEqual(restored.current().compose.texts[0],after.texts[0]);assert.ok(!Core.textFont({font:'serif',bold:false},20).includes('italic'));assert.ok(Core.textFont(after.texts[0],20).startsWith('italic 400 '));
});
test('new caption fonts render distinct Vietnamese letters with independent bold and italic styling',()=>{
 const t={text:'Nắng ở Hải Phòng · một chút thương',x:.5,y:.5,size:.16,color:'#f4e5c7',opacity:1},results=[];
 for(const font of ['montserrat','playfair','cormorant','patrick']){const c=source(1200,240),italic=source(1200,240);Core.drawText(c.getContext('2d'),{...t,font},1200,240);Core.drawText(italic.getContext('2d'),{...t,font,italic:true,bold:true},1200,240);assert.notDeepEqual(pixels(c),pixels(italic));results.push(pixels(c));}
 for(let i=0;i<results.length;i++)for(let j=0;j<i;j++)assert.notDeepEqual(results[i],results[j]);assert.equal(Core.fontChoices.length,10);assert.equal(new Set(Core.fontChoices.map(f=>f.id)).size,10);
});
test('custom caption color changes only glyph pixels and is retained per text through undo and drafts',()=>{
 const a=source(600,300),b=source(600,300),t={text:'Nắng',font:'playfair',size:.3,x:.5,y:.5,color:'#e7c778',italic:true,angle:0};Core.drawText(a.getContext('2d'),t,600,300);Core.drawText(b.getContext('2d'),{...t,color:'#a6c9dc'},600,300);assert.notDeepEqual(pixels(a),pixels(b));assert.deepEqual(pixel(a,0,0),pixel(b,0,0));
 const before={...Core.defaults(),texts:[t,{...t,id:'second',color:'#171717',italic:false}]},after={...before,texts:before.texts.map((x,i)=>i?x:{...x,color:'#a6c9dc'})},h=new Timeline();h.reset({key:Core.signature(before),compose:before});h.push({key:Core.signature(after),compose:after});assert.equal(h.undo().compose.texts[0].color,'#e7c778');h.redo();const replay=new Timeline();replay.restore(structuredClone(h.serialize()));assert.equal(replay.current().compose.texts[0].color,'#a6c9dc');assert.equal(replay.current().compose.texts[1].color,'#171717');assert.equal(replay.current().compose.texts[0].italic,true);
});
test('corner resizing preserves aspect and center at any rotation and preview scale',()=>{
 for(const angle of [-125,-30,0,45,90,175])for(const k of [.2,1,3]){const p={size:.55,x:.4,y:.6,angle},image={width:600,height:1000},r=Core.personSize(p,image,1200,800),a=angle*Math.PI/180,dx=(r.width*Math.cos(a)-r.height*Math.sin(a))/2,dy=(r.width*Math.sin(a)+r.height*Math.cos(a))/2;const size=Core.resizePerson(p,image,1200,800,dx*k/k,dy*k/k),after=Core.personSize({...p,size},image,1200,800);assert.ok(Math.abs(size-1.1)<1e-10);assert.ok(Math.abs(after.height/after.width-5/3)<1e-10);assert.deepEqual(p,{size:.55,x:.4,y:.6,angle});}
});
test('corner resizing can shrink and clamp and stays editable through history and drafts',()=>{
 const p={id:'p',size:.55,angle:30},image={width:600,height:1000},r=Core.personSize(p,image,1200,800),a=Math.PI/6,x=(r.width*Math.cos(a)-r.height*Math.sin(a))/2,y=(r.width*Math.sin(a)+r.height*Math.cos(a))/2;
 assert.ok(Math.abs(Core.resizePerson(p,image,1200,800,-x*.5,-y*.5)-.275)<1e-10);assert.equal(Core.resizePerson(p,image,1200,800,-x*2,-y*2),.05);assert.equal(Core.resizePerson(p,image,1200,800,x*100,y*100),3);
 const history=new Timeline();history.reset({key:'before',people:[p]});history.push({key:'after',people:[{...p,size:1.1}]});assert.equal(history.undo().people[0].size,.55);assert.equal(history.redo().people[0].size,1.1);const restored=new Timeline();restored.restore(structuredClone(history.serialize()));assert.equal(restored.current().people[0].size,1.1);
});
test('a color backdrop replaces background pixels while retaining foreground and the untouched source',()=>{
 const src=source(),original=pixels(src),settings=bg({mode:'color',color:'#47a46a',mask:mask()}),m=Core.maskCanvas(Core.buildMask(settings,120,80),make),out=Core.prepareSource(src,settings,m,null,make);assert.deepEqual(pixel(out,60,40),[146,76,55,255]);assert.deepEqual(pixel(out,5,40),[71,164,106,255]);assert.deepEqual(pixels(src),original);
});
test('manual erasing and restoring work without AI and remain continuous between sparse pointer points',()=>{
 const erase={mode:'erase',size:.3,softness:0,points:[[.1,.2],[.1,.8]]},keep={mode:'paint',size:.12,softness:0,points:[[.1,.5]]},s=bg({strokes:[erase]}),a=Core.buildMask(s,120,80),b=Core.buildMask({...s,strokes:[erase,keep]},120,80);assert.equal(a.data[40*120+12],0);assert.equal(b.data[40*120+12],255);assert.equal(b.data[20*120+12],0);assert.equal(a.data[40*120+80],255);
});
test('mask edits are immutable and cover the same normalized region at preview and full size',()=>{
 const points=Object.freeze([Object.freeze([.3,.2]),Object.freeze([.7,.8])]),stroke=Object.freeze({mode:'erase',size:.2,softness:.65,points}),s=Object.freeze(bg({strokes:Object.freeze([stroke])}));const a=Core.buildMask(s,240,160),b=Core.buildMask(s,2400,1600);assert.ok(b.width<=768&&b.height<=768);const aa=a.data[80*240+120],bb=b.data[Math.floor(b.height*.5)*b.width+Math.floor(b.width*.5)];assert.ok(Math.abs(aa-bb)<3);assert.deepEqual(points,[[.3,.2],[.7,.8]]);
});
test('transparent output keeps alpha and photo borders; new text is drawn above the cutout',()=>{
 const cv=createCanvas(124,84),c=cv.getContext('2d');c.fillStyle='#ffffff';c.fillRect(0,0,124,84);c.drawImage(source(),2,2);const settings=bg({mask:mask()}),m=Core.maskCanvas(Core.buildMask(settings,120,80),make);Core.cutInterior(cv,m,120,80,2);assert.equal(pixel(cv,4,40)[3],0);assert.equal(pixel(cv,62,40)[3],255);assert.deepEqual(pixel(cv,0,0),[255,255,255,255]);const before=pixels(cv);Core.drawText(c,{text:'RAY',x:.15,y:.5,size:.18,font:'sans',color:'#ffffff',opacity:1},124,84);assert.notDeepEqual(pixels(cv),before);assert.equal(pixel(cv,4,5)[3],0);
});
test('background images cover the frame at every pan and zoom without exposed gaps',()=>{
 for(const [W,H,IW,IH]of [[600,900,1200,400],[900,600,400,1200]])for(const x of [0,.5,1])for(const y of [0,.5,1])for(const zoom of [1,2.5]){const r=Core.coverRect(W,H,IW,IH,zoom,x,y);assert.ok(r.x<=1e-8&&r.y<=1e-8);assert.ok(r.x+r.width>=W-1e-8&&r.y+r.height>=H-1e-8);assert.ok(Math.abs(r.width/r.height-IW/IH)<1e-10);}
});
test('text placement, line breaks and font size scale with export resolution',()=>{
 const c=createCanvas(10,10).getContext('2d'),t={text:'Hải Phòng\nChút nắng hôm nay',size:.07,font:'serif',bold:false},a=Core.textMetrics(c,t,600,900),b=Core.textMetrics(c,t,2400,3600);assert.equal(a.lines.length,2);assert.equal(b.size,a.size*4);assert.equal(b.height,a.height*4);assert.ok(Math.abs(b.width/a.width-4)<.01);
});
test('Unicode text and arbitrary HTML-like text render literally, and rotated text stays finite',()=>{
 const cv=source(),c=cv.getContext('2d'),before=pixels(cv);Core.drawText(c,{text:'<img onerror=alert(1)>\nNắng ở Hải Phòng',x:.5,y:.5,size:.08,font:'serif',color:'#ffffff',angle:28,opacity:.8,shadow:true,outline:true},120,80);assert.notDeepEqual(pixels(cv),before);assert.ok([...pixels(cv)].every(Number.isFinite));
});
test('undo, redo and a structured draft retain mask bytes, image blobs and editable text',()=>{
 const s=Core.defaults();s.background=bg({mask:mask(),asset:{id:'bg-1',name:'nền.png',blob:new Blob(['image'],{type:'image/png'})}});s.texts=[{id:'text-1',text:'Hải Phòng',x:.3,y:.8,size:.1,font:'serif',color:'#ffffff'}];s.selected='text-1';const t=new Timeline();t.reset({key:'empty',compose:Core.defaults()});t.push({key:Core.signature(s),compose:s});const edited={...s,texts:s.texts.map(x=>({...x,text:'Nắng mật'}))};t.push({key:Core.signature(edited),compose:edited});assert.equal(t.undo().compose.texts[0].text,'Hải Phòng');assert.equal(t.redo().compose.texts[0].text,'Nắng mật');const restored=new Timeline();restored.restore(structuredClone(t.serialize()));const out=restored.current().compose;assert.deepEqual(out.background.mask.data,s.background.mask.data);assert.equal(out.background.asset.blob.size,5);assert.equal(out.texts[0].text,'Nắng mật');assert.equal(Core.signature(out),Core.signature(edited));assert.ok(!Core.signature(out).includes('Uint8Array'));
});
