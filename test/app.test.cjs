// Controller integration tests, with native canvas and a minimal DOM/media fixture.
// These exercise events and real image encoding; they do not replace browser QA.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {File}=require('node:buffer');
const {spawnSync}=require('node:child_process');
const {createCanvas,Image:NativeImage}=require('@napi-rs/canvas');
const B=require('../dist/booth-core.js');
require('../dist/booth-designs.js').setCanvasFactory(createCanvas);
const Beauty=require('../dist/photo-beauty.js');
const Lab=require('../dist/buongtoi-lab.js');Lab.setCanvasFactory(createCanvas);

function harness(options={}){
  const ids=new Map(),nodes=[],urls=new Map(),frames=[],recordings=[],motionSources=[];let serial=0,clock=Date.now(),cameraCalls=0,downloads=[],shares=[],encodeFailures=options.encodeFailures||0;
  class Element{
    constructor(tag='div'){this.tagName=tag.toUpperCase();this.dataset={};this.attrs={};this.children=[];this.style={};this.events={};this.className='';this.value='';this.textContent='';this.hidden=false;this.disabled=false;this.files=[];this.parent=null;}
    get classList(){const e=this;return{add(...names){const s=new Set(e.className.split(/\s+/));names.forEach(n=>s.add(n));e.className=[...s].filter(Boolean).join(' ');},remove(...names){e.className=e.className.split(/\s+/).filter(n=>!names.includes(n)).join(' ');},contains(n){return e.className.split(/\s+/).includes(n);},toggle(n,on){const have=this.contains(n);const next=on===undefined?!have:on;if(next)this.add(n);else this.remove(n);return next;}};}
    addEventListener(t,f){(this.events[t]??=[]).push(f);}
    removeEventListener(t,f){this.events[t]=(this.events[t]||[]).filter(x=>x!==f);}
    async emit(t,extra={}){const event={target:this,currentTarget:this,preventDefault(){},...extra};for(const fn of this.events[t]||[])await fn(event);}
    click(){if(this.tagName==='A')downloads.push(this.download);if(!this.disabled)return this.emit('click');}
    append(...els){for(const e of els){e.parent=this;this.children.push(e);}}
    replaceChildren(...els){this.children=[];this.append(...els);}
    setAttribute(k,v){this.attrs[k]=v;}
    removeAttribute(k){delete this.attrs[k];if(k==='src')this.src='';}
    closest(q){if(q.startsWith('[data-')){const key=q.slice(6,-1);if(this.dataset[key]!==undefined)return this;}return this.parent?.closest(q)||null;}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(e=>e!==this);}
    getBoundingClientRect(){return{left:0,top:0,right:640,bottom:480,width:640,height:480};}
    setPointerCapture(){}
    showModal(){this.open=true;}close(){this.open=false;}
    set innerHTML(s){this.html=s;this.children=[];}get innerHTML(){return this.html||'';}
  }
  function augmentCanvas(c,tag='canvas'){
    const element=new Element(tag);for(const k of Object.keys(element))c[k]=element[k];
    for(const k of Object.getOwnPropertyNames(Element.prototype)){if(k==='constructor')continue;Object.defineProperty(c,k,Object.getOwnPropertyDescriptor(Element.prototype,k));}
    c.toBlob=(fn,mime)=>{if(encodeFailures){encodeFailures--;fn(null);return;}c.encode('png').then(bytes=>fn(new Blob([bytes],{type:mime})));};
    if(options.recorder)c.captureStream=fps=>{const frames=[],sizes=[],track={stopped:false,stop(){this.stopped=true;},requestFrame(){frames.push(c.toBuffer('image/png'));sizes.push([c.width,c.height]);}};const s={getTracks:()=>[track],getVideoTracks:()=>[track],frames,sizes,track,fps};recordings.push(s);return s;};return c;
  }
  function create(tag){const e=tag==='canvas'?augmentCanvas(createCanvas(1,1)):new Element(tag);nodes.push(e);return e;}
  const html=fs.readFileSync(path.join(__dirname,'../dist/photobooth/index.html'),'utf8');
  for(const match of html.matchAll(/<([a-zA-Z][\w-]*)([^<>]*)>/g)){
    const [,tag,attrs]=match;if(!/\bid="|\bdata-theme=|\bdata-filter=|\bdata-layout=|class="text-button help-open/.test(attrs))continue;
    let e=tag==='video'?augmentCanvas(createCanvas(1600,1200),'video'):create(tag);
    if(tag==='video'){nodes.push(e);e.videoWidth=1600;e.videoHeight=1200;e.readyState=2;e.play=async()=>{};const x=e.getContext('2d');x.fillStyle='#d1af87';x.fillRect(0,0,1600,1200);x.fillStyle='#32412d';x.fillRect(0,0,800,1200);}
    for(const a of attrs.matchAll(/([\w-]+)="([^"]*)"/g)){const [,key,val]=a;if(key==='id'){e.id=val;ids.set(val,e);}else if(key==='class')e.className=val;else if(key.startsWith('data-'))e.dataset[key.slice(5)]=val;else if(key==='value')e.value=val;else e.attrs[key]=val;}
    e.hidden=/\shidden(?:\s|$)/.test(attrs);e.disabled=/\sdisabled(?:\s|$)/.test(attrs);
  }
  const $=id=>ids.get(id);$('timer').value='0';$('customMode').value='background';
  const document={hidden:false,getElementById:$,createElement:create,createTextNode:t=>({textContent:t}),body:create('body'),events:{},addEventListener(t,fn){(this.events[t]??=[]).push(fn);},querySelectorAll(q){
    if(q==='#photoEditor button,#photoEditor input')return ['closeEditor','zoom','retake','replacePhoto','flipPhoto','deletePhoto'].map($);
    const found=new Set();for(const s of q.split(','))for(const e of nodes){if(s.startsWith('#')&&e.id===s.slice(1))found.add(e);else if(s.startsWith('.')&&e.classList.contains(s.slice(1)))found.add(e);else if(s.startsWith('[data-')&&e.dataset[s.slice(6,-1)]!==undefined)found.add(e);}return[...found];
  }};
  function BrowserImage(){const img=new NativeImage(),desc=Object.getOwnPropertyDescriptor(NativeImage.prototype,'src');Object.defineProperty(img,'complete',{get(){return false;}});Object.defineProperty(img,'src',{set(value){const item=urls.get(value);desc.set.call(img,item?.bytes||value);},get(){return desc.get.call(img);}});return img;}
  const FakeDate=class extends Date{static now(){return clock;}};
  let lastTrack=null;
  const context={console,atob,AbortController,document,BoothCore:B,BuongToiLab:Lab,PhotoBeauty:Beauty,Image:BrowserImage,Blob,File,Uint8Array,Uint8ClampedArray,Int32Array,Date:FakeDate,
    URL:{createObjectURL(blob){const id='blob:test-'+(++serial);urls.set(id,blob);return id;},revokeObjectURL(id){urls.delete(id);}},
    navigator:{userAgent:options.ios?'iPhone':'test',...(options.ios?{canShare:({files})=>files[0].size>0,share:async data=>{shares.push(data);if(options.cancelShare)throw Object.assign(new Error('cancelled'),{name:'AbortError'});}}:{}),mediaDevices:{async getUserMedia(){cameraCalls++;lastTrack={enabled:true,stopped:false,stop(){this.stopped=true;},getSettings(){return{facingMode:'user'};},addEventListener(){}};return{getTracks:()=>[lastTrack],getVideoTracks:()=>[lastTrack]};}}},
    isSecureContext:true,performance:{now:()=>clock},confirm:()=>true,requestAnimationFrame:fn=>frames.push(fn),setTimeout(fn,ms){if(ms<=1000){clock+=ms;setImmediate(fn);}return serial++;},clearTimeout(){},addEventListener(){},
  };
  if(options.recorder)context.MediaRecorder=class{
    static isTypeSupported(t){return t.includes(options.recorder==='webm'?'webm':'mp4');}
    constructor(s,settings){this.stream=s;this.stream.settings=settings;this.mimeType=settings.mimeType;this.state='inactive';}
    start(){this.state='recording';}
    stop(){if(this.state==='inactive')return;this.state='inactive';let bytes=new Uint8Array(64);
      if(options.realEncoder&&this.stream.frames.length){const r=spawnSync('ffmpeg',['-v','error','-f','image2pipe','-framerate',String(this.stream.fps||15),'-i','pipe:0','-an','-c:v','libx264','-pix_fmt','yuv420p','-movflags','frag_keyframe+empty_moov','-f','mp4','pipe:1'],{input:Buffer.concat(this.stream.frames),maxBuffer:10e6});assert.equal(r.status,0,r.stderr.toString());bytes=r.stdout;}
      this.ondataavailable({data:new Blob([bytes],{type:this.mimeType})});this.onstop();
    }
  };
  context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/vendor/gifuct/gifuct.js'),'utf8'),context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/booth-media.js'),'utf8'),context);context.BoothMedia.setCanvasFactory((w,h)=>augmentCanvas(createCanvas(w,h)));vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/booth-gestures.js'),'utf8'),context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/app.js'),'utf8'),context,{filename:'app.js'});
  const loadMedia=context.BoothMedia.load;context.BoothMedia.load=async file=>{
    if(!context.BoothMedia.isVideo(file))return loadMedia(file);
    const source={kind:'video',duration:10,width:file.width||320,height:file.height||240,canvas:augmentCanvas(createCanvas(320,240)),version:0,lastTime:-1,disposed:false,caps:[],
      async drawAt(t,cap=480){assert.equal(this.disposed,false);this.caps.push(cap);const scale=Math.min(1,cap/Math.max(this.width,this.height)),w=Math.round(this.width*scale),h=Math.round(this.height*scale);if(t===this.lastTime&&this.canvas.width===w&&this.canvas.height===h)return false;this.lastTime=t;this.canvas.width=w;this.canvas.height=h;const x=this.canvas.getContext('2d');x.fillStyle=file.color||(t<2?'#ee2211':t<3?'#11cc33':'#2244ee');x.fillRect(0,0,w,h);if(file.quadrants)for(let i=0;i<4;i++){x.fillStyle=['#ff0000','#00ff00','#0000ff','#ffff00'][i];x.fillRect(i%2*w/2,Math.floor(i/2)*h/2,w/2,h/2);}this.version++;return true;},dispose(){this.disposed=true;this.canvas.width=this.canvas.height=1;}};
    await source.drawAt(0);motionSources.push(source);return source;
  };
  const flush=async()=>{for(let rounds=0;rounds<6;rounds++){while(frames.length)frames.shift()();await new Promise(r=>setImmediate(r));}};
  function file(color='#c7d0b0'){const c=createCanvas(320,240),x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,320,240);const bytes=c.toBuffer('image/png');return{size:bytes.length,type:'image/png',bytes};}
  function gif(){const bytes=fs.readFileSync(path.join(__dirname,'fixtures/three-frames.gif'));return{size:bytes.length,name:'three-frames.gif',type:'image/gif',arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};}
  return{$,nodes,context,flush,file,gif,urls,shares,motionSources,recordings,get downloads(){return downloads;},get cameraCalls(){return cameraCalls;},get lastTrack(){return lastTrack;}};
}
test('actual controller imports, edits, filters, exports, and preserves photos when layouts change',async()=>{
  const h=harness();await h.flush();assert.equal(h.$('photoTray').children.length,4);assert.equal(h.$('download').disabled,true);
  h.$('photoInput').files=[h.file(),h.file('#aa9080'),h.file('#b9ccdd'),h.file('#8a9d8a')];await h.$('photoInput').emit('change');await h.flush();assert.equal(h.$('photoCount').textContent,'4 / 4 ảnh');assert.equal(h.$('download').disabled,false);
  await h.$('photoTray').children[0].click();await h.flush();assert.equal(h.$('photoEditor').hidden,false);assert.equal(h.$('selectedImage').hidden,false);
  h.$('zoom').value='1.5';await h.$('zoom').emit('input');await h.flush();assert.equal(h.$('zoomValue').textContent,'1.5×');
  h.$('labRoll').value='denrang';await h.$('labRoll').emit('change');await h.flush();
  const d=h.$('preview').getContext('2d').getImageData(100,180,1,1).data;assert.ok(Math.abs(d[0]-d[1])<=5);assert.ok(Math.abs(d[1]-d[2])<=5);
  await h.$('layoutGroup').emit('click',{target:h.nodes.find(e=>e.dataset.layout==='strip')});await h.flush();assert.equal(h.$('preview').height,1590);assert.equal(h.$('photoCount').textContent,'4 / 4 ảnh');
  await h.$('download').click();await h.flush();assert.equal(h.downloads.length,1);assert.equal(h.$('saveFallback').hidden,false);assert.ok(h.$('savedImage').src.startsWith('blob:'));
  await h.$('deletePhoto').click();await h.flush();assert.equal(h.$('photoCount').textContent,'3 / 4 ảnh');assert.equal(h.$('download').disabled,true);assert.equal(h.$('saveFallback').hidden,true);
});
test('capture obtains video only, fills four slots, and releases camera on stop',async()=>{
  const h=harness();await h.flush();let constraints;
  const get=h.context.navigator.mediaDevices.getUserMedia;h.context.navigator.mediaDevices.getUserMedia=async c=>{constraints=c;return get();};
  await h.$('startCamera').click();await h.flush();assert.equal(h.cameraCalls,1);assert.equal(constraints.audio,false);assert.equal(h.$('video').hidden,false);assert.equal(h.$('shootAll').disabled,false);
  await h.$('shootAll').click();
  for(let i=0;i<110;i++){await h.flush();if(h.$('photoCount').textContent==='4 / 4 ảnh'&&!h.$('cancelShoot').hidden)continue;if(h.$('photoCount').textContent==='4 / 4 ảnh')break;}
  assert.equal(h.$('photoCount').textContent,'4 / 4 ảnh');assert.equal(h.$('download').disabled,false);
  await h.$('stopCamera').click();await h.flush();assert.equal(h.lastTrack.stopped,true);assert.equal(h.$('shootAll').disabled,true);assert.equal(h.$('photoCount').textContent,'4 / 4 ảnh');
});
test('camera rejection leaves a working photo import route and never enables shutter',async()=>{
  const h=harness();h.context.navigator.mediaDevices.getUserMedia=async()=>{const e=new Error('denied');e.name='NotAllowedError';throw e;};await h.flush();await h.$('startCamera').click();await h.flush();
  assert.equal(h.$('cameraMessage').hidden,false);assert.match(h.$('cameraMessage').textContent,/Safari\/Chrome/);assert.equal(h.$('shootAll').disabled,true);assert.equal(h.$('importPhotos').disabled,false);
});
test('uploaded transparent frame activates its detected slot count and exported layout',async()=>{
  const h=harness();await h.flush();const c=createCanvas(400,600),x=c.getContext('2d');x.fillStyle='#9e3e32';x.fillRect(0,0,400,600);x.clearRect(40,60,320,210);x.clearRect(40,310,320,210);
  const bytes=c.toBuffer('image/png');h.$('backgroundInput').files=[{size:bytes.length,type:'image/png',bytes}];await h.$('backgroundInput').emit('change');await h.flush();
  assert.equal(h.$('customMode').value,'overlay',h.$('toast').textContent);assert.equal(h.$('layoutGroup').hidden,true);assert.equal(h.$('photoTray').children.length,2);assert.equal(h.$('caption').disabled,true);
  assert.equal(h.$('countControls').hidden,true);
  h.$('photoInput').files=[h.file(),h.file()];await h.$('photoInput').emit('change');await h.flush();assert.equal(h.$('photoCount').textContent,'2 / 2 ảnh');assert.equal(h.$('download').disabled,false);assert.equal(h.$('preview').height,720);
});
test('2/4/5 selection preserves existing photos and the camera-overlay shutter fills only missing slots',async()=>{
  const h=harness();await h.flush();h.$('photoInput').files=[h.file(),h.file(),h.file(),h.file()];await h.$('photoInput').emit('change');await h.flush();
  await h.$('photoTray').children[3].click();await h.flush();
  await h.$('countGroup').emit('click',{target:h.$('countTwo')});await h.flush();assert.equal(h.$('photoCount').textContent,'2 / 2 ảnh');assert.equal(h.$('download').disabled,false);assert.equal(h.$('photoEditor').hidden,true);
  await h.$('countGroup').emit('click',{target:h.$('countFive')});await h.flush();assert.equal(h.$('photoCount').textContent,'4 / 5 ảnh');assert.equal(h.$('photoTray').children.length,5);assert.equal(h.$('download').disabled,true);assert.equal(h.$('preview').height,896);
  await h.$('themeGroup').emit('click',{target:h.nodes.find(e=>e.dataset.theme==='scrapbook')});await h.flush();
  await h.$('startCamera').click();await h.flush();assert.equal(h.$('quickShoot').hidden,false);assert.equal(h.$('quickShootLabel').textContent,'Chụp 1 kiểu');
  await h.$('quickShoot').click();for(let i=0;i<80;i++){await h.flush();if(h.$('photoCount').textContent==='5 / 5 ảnh'&&h.$('cancelShoot').hidden)break;}
  assert.equal(h.$('photoCount').textContent,'5 / 5 ảnh');assert.equal(h.$('download').disabled,false);
  await h.$('countGroup').emit('click',{target:h.$('countFour')});await h.flush();assert.equal(h.$('photoCount').textContent,'4 / 4 ảnh');
  await h.$('countGroup').emit('click',{target:h.$('countFive')});await h.flush();assert.equal(h.$('photoCount').textContent,'5 / 5 ảnh');
  await h.$('layoutGroup').emit('click',{target:h.nodes.find(e=>e.dataset.layout==='strip')});await h.flush();assert.equal(h.$('preview').height,1921);
  await h.$('download').click();await h.flush();assert.equal(h.downloads.length,1);
});
test('effect presets modify actual photo pixels and reset restores them; new frame and 3/6 counts work',async()=>{
 const h=harness();await h.flush();h.$('photoInput').files=[h.file(),h.file(),h.file(),h.file()];await h.$('photoInput').emit('change');await h.flush();
 const sample=()=>Array.from(h.$('preview').getContext('2d').getImageData(100,180,1,1).data),original=sample();
 h.$('fxPreset').value='flash';await h.$('fxPreset').emit('change');await h.flush();assert.notDeepEqual(sample(),original);assert.equal(h.$('fx-flash').value,42);
 h.$('fxPreset').value='clean';await h.$('fxPreset').emit('change');await h.flush();assert.deepEqual(sample(),original);
 await h.$('themeGroup').emit('click',{target:h.nodes.find(e=>e.dataset.theme==='cinema')});await h.flush();assert.equal(h.$('preview').width,480);assert.ok(h.$('preview').height>1000);
 await h.$('countGroup').emit('click',{target:h.$('countThree')});await h.flush();assert.equal(h.$('photoCount').textContent,'3 / 3 ảnh');assert.equal(h.$('download').disabled,false);
 await h.$('countGroup').emit('click',{target:h.$('countSix')});await h.flush();assert.equal(h.$('photoCount').textContent,'4 / 6 ảnh');assert.equal(h.$('download').disabled,true);
 await h.$('themeGroup').emit('click',{target:h.nodes.find(e=>e.dataset.theme==='collage')});await h.flush();assert.equal(h.$('preview').height,724);assert.equal(h.$('photoTray').children.length,6);
});
test('user can edit/remove frame text, use original Buồng Tối rolls, and export double strips',async()=>{
 const h=harness();await h.flush();h.$('frameTitle').value='Linh lên báo';await h.$('frameTitle').emit('input');await h.flush();assert.equal(h.$('frameTitle').value,'Linh lên báo');
 await h.$('clearFrameText').click();await h.flush();assert.equal(h.$('showFrameText').checked,false);
 await h.$('resetFrameText').click();await h.flush();assert.equal(h.$('showFrameText').checked,true);assert.equal(h.$('frameTitle').value,'Linh Linh - Phố Cảng');
 h.$('photoInput').files=[h.file(),h.file(),h.file(),h.file()];await h.$('photoInput').emit('change');await h.flush();h.$('labRoll').value='anhrua';await h.$('labRoll').emit('change');await h.flush();assert.equal(h.$('labRoll').value,'anhrua');assert.equal(h.$('labRoll').children.length,10);assert.equal(h.$('fx-grain').value,10);
 await h.$('layoutGroup').emit('click',{target:h.nodes.find(e=>e.dataset.layout==='double')});await h.flush();assert.equal(h.$('photoCount').textContent,'4 / 4 ảnh');assert.equal(h.$('download').disabled,false);
 h.$('caption').value='';await h.$('caption').emit('input');await h.flush();await h.$('download').click();await h.flush();assert.equal(h.downloads.length,1);
});

test('each photo keeps its own filter and skin settings after Done, reselection, layout changes and export',async()=>{
 const h=harness();await h.flush();h.$('photoInput').files=Array.from({length:4},()=>h.file('#c69880'));await h.$('photoInput').emit('change');await h.flush();
 const g=B.geometry('grid',null,4,'newspaper'),sample=i=>{const r=g.slots[i],s=480/g.width;return Array.from(h.$('preview').getContext('2d').getImageData(Math.round((r.x+r.w/2)*s),Math.round((r.y+r.h/2)*s),1,1).data);};
 const originals=[0,1,2,3].map(sample);
 await h.$('photoTray').children[0].click();h.$('labRoll').value='denrang';await h.$('labRoll').emit('change');await h.flush();const mono=sample(0);assert.notDeepEqual(mono,originals[0]);assert.deepEqual(sample(1),originals[1]);
 await h.$('closeEditor').click();await h.flush();assert.deepEqual(sample(0),mono);
 await h.$('photoTray').children[1].click();assert.equal(h.$('labRoll').value,'goc');h.$('labRoll').value='nanghoa';await h.$('labRoll').emit('change');h.$('beauty-brighten').value='65';await h.$('beauty-brighten').emit('input');h.$('beauty-smooth').value='40';await h.$('beauty-smooth').emit('input');await h.flush();const warm=sample(1);assert.notDeepEqual(warm,originals[1]);assert.deepEqual(sample(0),mono);assert.deepEqual(sample(2),originals[2]);
 await h.$('closeEditor').click();await h.$('photoTray').children[0].click();await h.flush();assert.equal(h.$('labRoll').value,'denrang');assert.equal(h.$('beauty-brighten').value,0);
 await h.$('photoTray').children[1].click();await h.flush();assert.equal(h.$('labRoll').value,'nanghoa');assert.equal(h.$('beauty-brighten').value,65);assert.equal(h.$('beauty-smooth').value,40);
 await h.$('layoutGroup').emit('click',{target:h.nodes.find(e=>e.dataset.layout==='double')});await h.flush();await h.$('download').click();await h.flush();assert.equal(h.$('saveFallback').open,true);assert.ok(h.urls.get(h.$('downloadReady').href).size>1000);
 await h.$('closeFallback').click();await h.$('photoTray').children[1].click();await h.flush();assert.equal(h.$('labRoll').value,'nanghoa');assert.equal(h.$('beauty-brighten').value,65);
 await h.$('applyAllFX').click();await h.flush();await h.$('photoTray').children[2].click();await h.flush();assert.equal(h.$('labRoll').value,'nanghoa');assert.equal(h.$('beauty-smooth').value,40);
});
test('iPhone saving prepares a visible image and shares a real PNG from a second tap; cancel and close preserve photos',async()=>{
 const h=harness({ios:true,cancelShare:true});await h.flush();h.$('photoInput').files=[h.file('#c69880')];await h.$('photoInput').emit('change');await h.flush();await h.$('photoTray').children[0].click();await h.flush();assert.equal(h.$('download').disabled,true);assert.equal(h.$('downloadSingle').disabled,false);
 await h.$('downloadSingle').click();await h.flush();assert.equal(h.$('saveFallback').open,true);assert.ok(h.$('savedImage').src.startsWith('data:image/png;base64,'));assert.equal(h.downloads.length,0);assert.equal(h.shares.length,0);assert.equal(h.$('saveToPhotos').hidden,false);
 await h.$('saveToPhotos').click();assert.equal(h.shares.length,1);assert.equal(h.shares[0].files[0].type,'image/png');assert.ok(h.shares[0].files[0].size>1000);assert.deepEqual(Array.from(new Uint8Array(await h.shares[0].files[0].arrayBuffer()).slice(0,8)),[137,80,78,71,13,10,26,10]);assert.equal(h.$('saveFallback').open,true);assert.match(h.$('saveStatus').textContent,/vẫn ở đây/);
 await h.$('closeFallback').click();await h.flush();assert.equal(h.$('saveFallback').hidden,true);assert.equal(h.$('photoCount').textContent,'1 / 4 ảnh');await h.$('closeEditor').click();await h.$('photoTray').children[0].click();await h.$('downloadSingle').click();await h.flush();assert.equal(h.$('saveFallback').open,true);assert.ok(h.urls.has(h.$('downloadReady').href));
});

test('mixed photo/GIF/video slots scrub together with per-slot trim, speed, offset and retained filters',async()=>{
 const h=harness({recorder:true});await h.flush();h.$('photoInput').files=[{type:'video/mp4',name:'clip.mp4',size:3000},h.gif(),h.file(),h.file()];await h.$('photoInput').emit('change');await h.flush();
 assert.equal(h.$('photoCount').textContent,'4 / 4 ảnh');assert.equal(h.$('exportKind').value,'both');assert.equal(h.$('playTimeline').disabled,false);
 await h.$('photoTray').children[1].click();assert.equal(h.$('clipLoop').checked,true);assert.match(h.$('clipInfo').textContent,/GIF/);
 await h.$('photoTray').children[0].click();assert.equal(h.$('selectedMotion').hidden,false);assert.equal(h.$('selectedImage').hidden,true);assert.equal(h.$('clipLoop').checked,false);
 for(const [id,value]of[['clipStart','2'],['clipEnd','4'],['clipOffset','1'],['clipSpeed','2']]){h.$(id).value=value;await h.$(id).emit('change');}await h.flush();
 for(const [time,want]of[[0,2],[1.25,2.5],[4,3.999]]){h.$('timelineTime').value=String(time);await h.$('timelineTime').emit('input');await h.flush();assert.ok(Math.abs(h.motionSources[0].lastTime-want)<.0001);}
 h.$('labRoll').value='denrang';await h.$('labRoll').emit('change');await h.flush();
 h.$('timelineTime').value='1.25';await h.$('timelineTime').emit('input');await h.flush();const d=h.$('selectedMotion').getContext('2d').getImageData(240,180,1,1).data;assert.ok(Math.abs(d[0]-d[1])<6&&Math.abs(d[1]-d[2])<6);
 await h.$('closeEditor').click();await h.$('photoTray').children[0].click();assert.equal(h.$('labRoll').value,'denrang');assert.equal(h.$('clipStart').value,2);assert.equal(h.$('clipSpeed').value,2);
 await h.$('deletePhoto').click();await h.flush();assert.equal(h.motionSources[0].disposed,true);assert.equal(h.$('photoCount').textContent,'3 / 4 ảnh');
});
test('two imported videos have independent visible canvas thumbnails that follow scrubbing',async()=>{
 const h=harness({recorder:true});await h.flush();await h.$('countGroup').emit('click',{target:h.$('countTwo')});h.$('photoInput').files=[{type:'video/mp4',name:'first.mp4',size:1000},{type:'video/mp4',name:'second.mp4',size:1000,color:'#2244ee'}];await h.$('photoInput').emit('change');await h.flush();
 const thumb=i=>h.$('photoTray').children[i].children[0],sample=i=>Array.from(thumb(i).getContext('2d').getImageData(75,50,1,1).data);
 assert.equal(h.$('photoCount').textContent,'2 / 2 ảnh');assert.equal(thumb(0).tagName,'CANVAS');assert.equal(thumb(1).tagName,'CANVAS');assert.notEqual(thumb(0),thumb(1));assert.deepEqual(sample(0),[238,34,17,255]);assert.deepEqual(sample(1),[34,68,238,255]);
 h.$('timelineTime').value='2.5';await h.$('timelineTime').emit('input');await h.flush();assert.deepEqual(sample(0),[17,204,51,255]);assert.deepEqual(sample(1),[34,68,238,255]);
 await h.$('photoTray').children[0].click();await h.flush();assert.deepEqual(sample(0),[17,204,51,255]);assert.deepEqual(sample(1),[34,68,238,255]);assert.equal(h.$('selectedMotion').hidden,false);
});
test('photo/video rotation is per slot, survives scrubbing/Done, and reaches single PNG and recorded frames',async()=>{
 const h=harness({ios:true,recorder:true});await h.flush();await h.$('countGroup').emit('click',{target:h.$('countTwo')});const raw=createCanvas(320,240),x=raw.getContext('2d');for(let i=0;i<4;i++){x.fillStyle=['#ff0000','#00ff00','#0000ff','#ffff00'][i];x.fillRect(i%2*160,Math.floor(i/2)*120,160,120);}const bytes=raw.toBuffer('image/png');h.$('photoInput').files=[{type:'video/mp4',name:'upside.mp4',size:1000,quadrants:true},{type:'image/png',size:bytes.length,bytes}];await h.$('photoInput').emit('change');await h.flush();
 const thumb=i=>h.$('photoTray').children[i].children[0],videoColor=()=>Array.from(thumb(0).getContext('2d').getImageData(15,12,1,1).data);await h.$('photoTray').children[0].click();await h.flush();await h.$('rotateHalf').click();await h.flush();assert.equal(h.$('rotationValue').textContent,'180°');assert.deepEqual(videoColor(),[255,255,0,255]);
 h.$('timelineTime').value='1';await h.$('timelineTime').emit('input');await h.flush();assert.deepEqual(videoColor(),[255,255,0,255]);await h.$('closeEditor').click();await h.$('photoTray').children[1].click();await h.flush();assert.equal(h.$('rotationValue').textContent,'0°');await h.$('rotateRight').click();assert.equal(h.$('rotationValue').textContent,'90°');await h.$('closeEditor').click();await h.$('photoTray').children[0].click();assert.equal(h.$('rotationValue').textContent,'180°');
 const decode=async bytes=>{const im=new NativeImage();await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=reject;im.src=Buffer.from(bytes);});const c=createCanvas(im.width,im.height);c.getContext('2d').drawImage(im,0,0);return c;};
 await h.$('downloadSingle').click();await h.flush();const png=await decode(await h.urls.get(h.$('downloadReady').href).arrayBuffer());assert.deepEqual(Array.from(png.getContext('2d').getImageData(120,180,1,1).data),[255,255,0,255]);await h.$('closeFallback').click();
 h.$('outputDuration').value='1';h.$('videoQuality').value='720';await h.$('download').click();await h.flush();const frame=await decode(h.recordings[0].frames[0]),g=B.geometry('grid',null,2,'newspaper'),scale=frame.width/g.width;for(const [i,color]of[[0,[255,255,0,255]],[1,[0,0,255,255]]]){const r=g.slots[i];assert.deepEqual(Array.from(frame.getContext('2d').getImageData(Math.round((r.x+r.w*.15)*scale),Math.round((r.y+r.h*.15)*scale),1,1).data),color);}
 await h.$('closeFallback').click();await h.$('photoTray').children[1].click();await h.flush();assert.equal(h.$('rotationValue').textContent,'90°');await h.$('rotateLeft').click();assert.equal(h.$('rotationValue').textContent,'0°');
});
test('travel frame greeting and place controls keep their own edits and export both media formats',async()=>{
 const h=harness({ios:true,recorder:true});await h.flush();await h.$('countGroup').emit('click',{target:h.$('countTwo')});h.$('photoInput').files=[h.gif(),h.file()];await h.$('photoInput').emit('change');await h.flush();
 const choose=async theme=>{await h.$('themeGroup').emit('click',{target:h.nodes.find(n=>n.dataset.theme===theme)});await h.flush();};await choose('hellonews');assert.equal(h.$('frameTitle').value,'HELLO');assert.equal(h.$('frameSubtitle').value,'VIỆT NAM');assert.equal(h.$('frameSubtitleLabel').textContent,'Địa danh');
 h.$('frameTitle').value='Chào';await h.$('frameTitle').emit('input');h.$('frameSubtitle').value='Đà Lạt';await h.$('frameSubtitle').emit('input');await h.flush();await choose('portnews');assert.equal(h.$('frameTitle').value,'Bến');assert.equal(h.$('frameSubtitle').value,'Bạch Đằng');await choose('hellonews');assert.equal(h.$('frameTitle').value,'Chào');assert.equal(h.$('frameSubtitle').value,'Đà Lạt');
 h.$('outputDuration').value='1';h.$('videoQuality').value='720';await h.$('download').click();await h.flush();assert.equal(h.urls.get(h.$('downloadReady').href).type,'video/mp4');await h.$('outputImageTab').click();assert.equal(h.urls.get(h.$('downloadReady').href).type,'image/png');await h.$('closeFallback').click();assert.equal(h.$('frameSubtitle').value,'Đà Lạt');
});
test('both output opens and shares a real video first, with the scrubbed PNG available separately',async()=>{
 const h=harness({ios:true,recorder:true,realEncoder:true});await h.flush();h.$('photoInput').files=[{type:'video/mp4',name:'clip.mp4',size:3000},h.gif(),h.file(),h.file()];await h.$('photoInput').emit('change');await h.flush();
 h.$('outputDuration').value='1';await h.$('outputDuration').emit('change');h.$('videoQuality').value='720';h.$('timelineTime').value='.15';await h.$('timelineTime').emit('input');await h.flush();await h.$('download').click();await h.flush();
 assert.equal(h.$('saveTitle').textContent,'Video và ảnh đã sẵn sàng');assert.equal(h.$('outputTabs').hidden,false);assert.equal(h.$('savedVideo').hidden,false);assert.equal(h.$('savedImage').hidden,true);assert.equal(h.$('outputVideoTab').attrs['aria-pressed'],'true');assert.equal(h.$('saveToPhotos').textContent,'Lưu video / Chia sẻ');assert.equal(h.shares.length,0);assert.equal(h.$('shareBothFiles').hidden,false);
 const movie=h.urls.get(h.$('downloadReady').href);assert.equal(movie.type,'video/mp4');await h.$('saveToPhotos').click();assert.equal(h.shares[0].files.length,1);assert.equal(h.shares[0].files[0].type,'video/mp4');assert.match(h.shares[0].files[0].name,/\.mp4$/);
 await h.$('outputImageTab').click();assert.equal(h.$('saveToPhotos').textContent,'Lưu ảnh / Chia sẻ');assert.equal(h.$('savedImage').hidden,false);assert.ok(h.$('savedImage').src.startsWith('data:image/png;base64,'));
 const png=h.urls.get(h.$('downloadReady').href);assert.equal(png.type,'image/png');const im=new NativeImage(),bytes=Buffer.from(await png.arrayBuffer());await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=reject;im.src=bytes;});const c=createCanvas(im.width,im.height);c.getContext('2d').drawImage(im,0,0);const g=B.geometry('grid',null,4,'newspaper'),slot=g.slots[1],d=c.getContext('2d').getImageData(Math.round((slot.x+slot.w/2)*c.width/g.width),Math.round((slot.y+slot.h/2)*c.height/g.height),1,1).data;assert.ok(d[1]>190&&d[0]<35,'PNG holds the selected green GIF frame: '+Array.from(d)+' at '+c.width+'x'+c.height);
 await h.$('saveToPhotos').click();assert.equal(h.shares[1].files.length,1);assert.equal(h.shares[1].files[0].type,'image/png');
 await h.$('outputVideoTab').click();assert.equal(h.$('savedVideo').hidden,false);assert.equal(h.$('savedImage').hidden,true);assert.match(h.$('downloadReady').download,/\.mp4$/);
 const probe=spawnSync('ffprobe',['-v','error','-show_entries','stream=codec_name,width,height,duration','-of','json','pipe:0'],{input:Buffer.from(await movie.arrayBuffer())});assert.equal(probe.status,0,probe.stderr.toString());const video=JSON.parse(probe.stdout).streams[0];assert.equal(video.codec_name,'h264');assert.equal(video.width%2,0);assert.equal(video.height%2,0);assert.equal(Math.max(video.width,video.height),720);assert.ok(+video.duration>=.9);
 await h.$('saveToPhotos').click();assert.equal(h.shares[2].files[0].type,'video/mp4');await h.$('shareBothFiles').click();assert.deepEqual(Array.from(h.shares[3].files,f=>f.type),['image/png','video/mp4']);assert.ok(h.recordings.every(s=>s.track.stopped));assert.ok(h.recordings[0].sizes.every(s=>s[0]===video.width&&s[1]===video.height));assert.equal(h.$('timelineTime').value,.15);
 await h.$('closeFallback').click();await h.flush();assert.equal(h.$('photoCount').textContent,'4 / 4 ảnh');assert.equal(h.$('download').disabled,false);
});
test('video-only export labels and shares a video file without preparing a PNG fallback',async()=>{
 const h=harness({ios:true,recorder:'webm'});await h.flush();await h.$('countGroup').emit('click',{target:h.$('countTwo')});h.$('photoInput').files=[h.gif(),h.file()];await h.$('photoInput').emit('change');await h.flush();h.$('exportKind').value='video';await h.$('exportKind').emit('change');assert.match(h.$('download').innerHTML,/Tạo video/);h.$('outputDuration').value='1';h.$('videoQuality').value='720';await h.$('download').click();await h.flush();
 assert.equal(h.$('saveTitle').textContent,'Video đã sẵn sàng');assert.equal(h.$('outputTabs').hidden,true);assert.equal(h.$('savedVideo').hidden,false);assert.equal(h.$('savedImage').hidden,true);assert.equal(h.$('saveToPhotos').textContent,'Lưu video / Chia sẻ');assert.equal(h.$('downloadReady').textContent,'Tải video WEBM');assert.equal(h.urls.get(h.$('downloadReady').href).type,'video/webm');await h.$('saveToPhotos').click();assert.equal(h.shares[0].files.length,1);assert.equal(h.shares[0].files[0].type,'video/webm');assert.match(h.shares[0].files[0].name,/\.webm$/);
});
test('a failed video encode persistently identifies the remaining file as PNG instead of claiming video success',async()=>{
 const h=harness({ios:true,recorder:true});await h.flush();await h.$('countGroup').emit('click',{target:h.$('countTwo')});h.$('photoInput').files=[h.gif(),h.file()];await h.$('photoInput').emit('change');await h.flush();h.context.BoothMedia.record=async()=>{throw new Error('Bộ xuất video bị gián đoạn');};await h.$('download').click();await h.flush();
 assert.equal(h.$('saveFallback').open,true);assert.equal(h.$('saveTitle').textContent,'Chưa tạo được video');assert.match(h.$('saveStatus').textContent,/Hiện chỉ có ảnh PNG/);assert.equal(h.$('saveToPhotos').textContent,'Lưu ảnh / Chia sẻ');assert.equal(h.$('savedVideo').hidden,true);assert.equal(h.$('photoCount').textContent,'2 / 2 ảnh');assert.equal(h.$('download').disabled,false);
});
test('cancelling a video export preserves its prepared PNG, mixed slots and editing controls',async()=>{
 const h=harness({ios:true,recorder:true});await h.flush();h.$('photoInput').files=[h.gif(),h.file(),h.file(),h.file()];await h.$('photoInput').emit('change');await h.flush();h.$('outputDuration').value='20';h.$('videoQuality').value='720';
 const pending=h.$('download').click();for(let i=0;i<20&&!h.recordings.length;i++)await new Promise(r=>setImmediate(r));assert.equal(h.recordings.length,1);await h.$('cancelVideoExport').click();await pending;await h.flush();
 assert.equal(h.$('saveFallback').open,true);assert.equal(h.$('outputTabs').hidden,true);assert.equal(h.urls.get(h.$('downloadReady').href).type,'image/png');assert.equal(h.$('photoCount').textContent,'4 / 4 ảnh');assert.equal(h.$('download').disabled,false);assert.equal(h.$('renderProgress').hidden,true);assert.ok(h.recordings[0].track.stopped);assert.match(h.$('toast').textContent,/Đã dừng/);
});
test('a failed PNG encode leaves photos intact and saving can be retried',async()=>{
 const h=harness({encodeFailures:1});await h.flush();h.$('photoInput').files=[h.file()];await h.$('photoInput').emit('change');await h.flush();await h.$('photoTray').children[0].click();await h.flush();await h.$('downloadSingle').click();await h.flush();assert.equal(h.$('downloadSingle').disabled,false);assert.equal(h.$('photoCount').textContent,'1 / 4 ảnh');assert.match(h.$('toast').textContent,/Chưa tạo/);
 await h.$('downloadSingle').click();await h.flush();assert.equal(h.$('saveFallback').open,true);assert.equal(h.downloads.length,1);
});

test('HD booth export decodes from source for zoomed slots, reports actual dimensions and restores light preview buffers',async()=>{
 const h=harness({recorder:true});await h.flush();assert.equal(h.$('videoQuality').value,'1920');await h.$('countGroup').emit('click',{target:h.$('countTwo')});h.$('photoInput').files=[{type:'video/mp4',name:'hd.mp4',size:1000,width:1920,height:1080},h.file()];await h.$('photoInput').emit('change');await h.flush();await h.$('photoTray').children[0].click();h.$('zoom').value='2';await h.$('zoom').emit('input');await h.flush();h.$('exportKind').value='video';await h.$('exportKind').emit('change');h.$('outputDuration').value='1';await h.$('download').click();await h.flush();
 const rec=h.recordings[0];assert.ok(rec);assert.deepEqual(rec.sizes[0],[1440,1920]);assert.equal(rec.fps,24);assert.ok(rec.settings.videoBitsPerSecond>15000000);assert.ok(h.motionSources[0].caps.some(n=>n>1200));assert.equal(h.motionSources[0].caps.at(-1),480);assert.equal(h.motionSources[0].canvas.width,480);assert.match(h.$('saveStatus').textContent,/1440 × 1920 px/);assert.equal(h.$('photoCount').textContent,'2 / 2 ảnh');
});

test('Live Photo image/MOV pairs occupy one slot and preserve the adjacent still',async()=>{
 const h=harness({recorder:true});await h.flush();const still={...h.file(),name:'IMG_7001.JPG'},mov={type:'video/quicktime',name:'IMG_7001.MOV',size:3000};
 h.$('photoInput').files=[still,mov,h.file('#22aa88')];await h.$('photoInput').emit('change');await h.flush();
 assert.equal(h.$('photoCount').textContent,'2 / 4 ảnh');assert.equal(h.motionSources.length,1);assert.match(h.$('clipInfo').textContent,/LIVE PHOTO/);assert.equal(h.$('clipLoop').checked,true);assert.match(h.$('photoTray').children[0].children[1].textContent,/LIVE/);assert.equal(h.$('slotOverlay').children.length,4);
 await h.$('nextSlot').click();await h.flush();assert.match(h.$('photoTray').children[1].children[1].textContent,/LIVE/);assert.equal(h.motionSources[0].disposed,false);assert.equal(h.$('clipLoop').checked,true);
});
test('print-slot gestures pan actual pixels, pinch to zoom and keep the other slot unchanged',async()=>{
 const h=harness();await h.flush();const c=createCanvas(320,240),x=c.getContext('2d');for(let i=0;i<320;i++){x.fillStyle=`rgb(${Math.round(i/320*255)},100,80)`;x.fillRect(i,0,1,240);}const bytes=c.toBuffer('image/png');
 h.$('photoInput').files=[{type:'image/png',name:'gradient.png',bytes,size:bytes.length},h.file('#11aa55')];await h.$('photoInput').emit('change');await h.flush();
 const g=B.geometry('grid',null,4,'newspaper'),sample=i=>{const r=g.slots[i];return Array.from(h.$('preview').getContext('2d').getImageData(Math.round((r.x+r.w/2)*.4),Math.round((r.y+r.h/2)*.4),1,1).data);};
 h.$('zoom').value='2';await h.$('zoom').emit('input');await h.flush();const before=sample(0),other=sample(1),slot=h.$('slotOverlay').children[0];
 await slot.emit('pointerdown',{pointerId:1,button:0,clientX:320,clientY:240});await slot.emit('pointermove',{pointerId:1,clientX:440,clientY:240});await slot.emit('pointerup',{pointerId:1});await h.flush();assert.ok(sample(0)[0]<before[0]-10);assert.deepEqual(sample(1),other);
 await h.$('centerPhoto').click();await h.flush();assert.equal(h.$('zoomValue').textContent,'1.0×');
 await slot.emit('pointerdown',{pointerId:2,clientX:200,clientY:240});await slot.emit('pointerdown',{pointerId:3,clientX:400,clientY:240});await slot.emit('pointermove',{pointerId:3,clientX:600,clientY:240});await slot.emit('pointerup',{pointerId:3});await slot.emit('pointercancel',{pointerId:2});await h.flush();assert.equal(h.$('zoomValue').textContent,'2.0×');assert.deepEqual(sample(1),other);
});
test('dropping a video onto a chosen print slot leaves all other media intact',async()=>{
 const h=harness({recorder:true});await h.flush();h.$('photoInput').files=[h.file('#aa3322'),h.file('#2277aa')];await h.$('photoInput').emit('change');await h.flush();
 const first=h.$('photoTray').children[0].children[0].src;await h.$('slotOverlay').children[1].emit('drop',{dataTransfer:{files:[{name:'one.mov',type:'video/quicktime',size:4000}]}});await h.flush();
 assert.equal(h.$('photoCount').textContent,'2 / 4 ảnh');assert.equal(h.$('photoTray').children[0].children[0].src,first);assert.equal(h.$('photoTray').children[1].children[0].tagName,'CANVAS');assert.equal(h.$('exportKind').value,'both');
});
