// Native canvas and a reference encoder verify media math/pixels/container.
// Browser MediaRecorder and a physical iPhone still need device QA.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {createCanvas}=require('@napi-rs/canvas');
const M=require('../dist/booth-media.js');M.setCanvasFactory(createCanvas);
const pixel=(c,x=0,y=0)=>Array.from(c.getContext('2d').getImageData(x,y,1,1).data);
const decoderContext={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/vendor/gifuct/gifuct.js'),'utf8'),decoderContext);
const GIF=decoderContext.GIFUCT;

test('independent clip trim, offset, speed, loop and end hold map the shared timeline',()=>{
 const clip={start:2,end:4,offset:1,speed:2,loop:false};
 assert.equal(M.sourceTime(0,clip,10),2);assert.equal(M.sourceTime(1.25,clip,10),2.5);assert.equal(M.sourceTime(9,clip,10),3.999);
 assert.equal(M.sourceTime(2.25,{...clip,loop:true},10),2.5);
 assert.deepEqual(M.normalizeClip({start:11,end:0,speed:9,offset:-1},10),{start:9.98,end:10,speed:4,offset:0,loop:false});
 assert.equal(M.normalizeClip({},.6,'gif').loop,true);assert.equal(M.formatTime(65.25),'1:05.25');
});
test('the bundled decoder plays a real GIF at its frame delays, rewinds and reuses unchanged frames',async()=>{
 const bytes=fs.readFileSync(path.join(__dirname,'fixtures/three-frames.gif')),source=new M.GIFSource(GIF.parseGIF(bytes),GIF);
 assert.equal(source.duration,.6);await source.drawAt(0);assert.deepEqual(pixel(source.canvas),[238,34,17,255]);
 const version=source.version;assert.equal(await source.drawAt(.05),false);assert.equal(source.version,version);
 await source.drawAt(.1);assert.deepEqual(pixel(source.canvas),[17,204,51,255]);
 await source.drawAt(.3);assert.deepEqual(pixel(source.canvas),[34,68,238,255]);
 await source.drawAt(.02,24);assert.equal(source.canvas.width,24);assert.deepEqual(pixel(source.canvas),[238,34,17,255]);
 source.dispose();await assert.rejects(source.drawAt(0),/đã đóng/);
});
function patch(color,width=1,height=1,left=0,disposalType=1){return{dims:{width,height,left,top:0},disposalType,patch:new Uint8ClampedArray(Array.from({length:width*height},()=>color).flat())};}
function fakeGIF(frames){return new M.GIFSource({lsd:{width:2,height:1},frames:frames.map(f=>({image:true,gce:{delay:10},decoded:f}))},{decompressFrame:f=>f.decoded});}
test('GIF transparency and disposal 2/3 compose patches after the previous frame is displayed',async()=>{
 const red=[255,0,0,255],green=[0,255,0,255],blue=[0,0,255,255],clear=[0,0,0,0];
 const source=fakeGIF([patch(red,2),patch(green,1,1,0,3),patch(blue,1,1,1,2),patch(clear)]);
 await source.drawAt(.15);assert.deepEqual(pixel(source.canvas),green);assert.deepEqual(pixel(source.canvas,1),red);
 await source.drawAt(.25);assert.deepEqual(pixel(source.canvas),red);assert.deepEqual(pixel(source.canvas,1),blue);
 await source.drawAt(.35);assert.deepEqual(pixel(source.canvas),red);assert.deepEqual(pixel(source.canvas,1),clear);
 await source.drawAt(0);assert.deepEqual(pixel(source.canvas,1),red);source.dispose();
});
test('nearby video seeks wait for a decoded new frame rather than resolving from the old frame',async()=>{
 const v=createCanvas(64,48),listeners=new Map();let current=0,completed=0;
 Object.assign(v,{videoWidth:64,videoHeight:48,duration:2,readyState:2,seeking:false,addEventListener(t,fn){if(!listeners.has(t))listeners.set(t,new Set());listeners.get(t).add(fn);},removeEventListener(t,fn){listeners.get(t)?.delete(fn);}});
 Object.defineProperty(v,'currentTime',{get:()=>current,set(t){current=t;v.seeking=true;setImmediate(()=>{v.getContext('2d').fillStyle=t>=.05?'#00ff00':'#ff0000';v.getContext('2d').fillRect(0,0,64,48);v.seeking=false;completed++;for(const fn of listeners.get('seeked')||[])fn();});}});
 const source=new M.VideoSource(v,'blob:test');await source.drawAt(.06);assert.equal(completed,1);assert.deepEqual(pixel(source.canvas),[0,255,0,255]);
 assert.equal(await source.drawAt(.06),false);await source.drawAt(.01,32);assert.equal(completed,2);assert.equal(source.canvas.width,32);assert.deepEqual(pixel(source.canvas),[255,0,0,255]);
});
test('two first-frame posters wait for compositor callbacks even when metadata is already ready',async()=>{
 function video(color){const v=createCanvas(64,48),listeners=new Map(),callbacks=new Map();let time=0,serial=0,plays=0,pauses=0;
  Object.assign(v,{videoWidth:64,videoHeight:48,duration:5,readyState:2,seeking:false,play:async()=>{plays++;},pause(){pauses++;},requestVideoFrameCallback(fn){callbacks.set(++serial,fn);return serial;},cancelVideoFrameCallback(id){callbacks.delete(id);},addEventListener(t,fn){if(!listeners.has(t))listeners.set(t,new Set());listeners.get(t).add(fn);},removeEventListener(t,fn){listeners.get(t)?.delete(fn);}});
  Object.defineProperty(v,'currentTime',{get:()=>time,set(t){time=t;v.seeking=true;setImmediate(()=>{v.seeking=false;for(const fn of listeners.get('seeked')||[])fn();setTimeout(()=>{const x=v.getContext('2d');x.fillStyle=color;x.fillRect(0,0,64,48);for(const [id,fn]of callbacks){callbacks.delete(id);fn(0,{mediaTime:t});}},12);});}});
  return{v,counts:()=>({plays,pauses,pending:callbacks.size})};
 }
 const first=video('#ee2211'),second=video('#2244ee'),a=new M.VideoSource(first.v,'blob:first'),b=new M.VideoSource(second.v,'blob:second');await a.drawAt(0);await b.drawAt(0);
 assert.deepEqual(pixel(a.canvas),[238,34,17,255]);assert.deepEqual(pixel(b.canvas),[34,68,238,255]);assert.notEqual(a.canvas,b.canvas);assert.deepEqual(first.counts(),{plays:1,pauses:1,pending:0});assert.deepEqual(second.counts(),{plays:1,pauses:1,pending:0});
 assert.equal(await a.drawAt(0),false);assert.deepEqual(pixel(a.canvas),[238,34,17,255]);
});
test('scrubbing waits for the compositor after seeked before reading the selected video frame',async()=>{
 const listeners=new Map();let current=0,frameReady=false,callback;
 const v={duration:3,readyState:2,seeking:false,addEventListener(t,f){listeners.set(t,f);},removeEventListener(t){listeners.delete(t);},requestVideoFrameCallback(f){callback=f;return 1;},cancelVideoFrameCallback(){}};
 Object.defineProperty(v,'currentTime',{get:()=>current,set(t){current=t;v.seeking=true;setImmediate(()=>{v.seeking=false;listeners.get('seeked')?.();setTimeout(()=>{frameReady=true;callback();},10);});}});
 await M.seekFrame(v,1.2);assert.equal(current,1.2);assert.equal(frameReady,true);assert.equal(listeners.size,0);
});
test('recording samples playing video without seeking every frame and still respects loop and trim boundaries',async()=>{
 const v=createCanvas(64,48),listeners=new Map(),callbacks=new Map();let current=.3,seeks=0,serial=0;
 Object.assign(v,{videoWidth:64,videoHeight:48,duration:2,readyState:2,seeking:false,paused:true,play:async()=>{v.paused=false;},pause(){v.paused=true;},requestVideoFrameCallback(fn){callbacks.set(++serial,fn);return serial;},cancelVideoFrameCallback(id){callbacks.delete(id);},addEventListener(t,fn){listeners.set(t,fn);},removeEventListener(t){listeners.delete(t);}});
 Object.defineProperty(v,'currentTime',{get:()=>current,set(t){seeks++;current=t;v.seeking=true;setImmediate(()=>{v.getContext('2d').fillStyle='#ee2211';v.getContext('2d').fillRect(0,0,64,48);v.seeking=false;listeners.get('seeked')?.();for(const [id,fn]of callbacks){callbacks.delete(id);fn();}});}});
 const source=new M.VideoSource(v,'blob:playing');await source.drawAt(.3,64);assert.equal(seeks,1);
 const live={realtime:true,playing:true,speed:2,start:.3,end:.8};current=.35;v.getContext('2d').fillStyle='#2244ee';v.getContext('2d').fillRect(0,0,64,48);
 await source.drawAt(.35,64,live);assert.equal(seeks,1);assert.equal(v.paused,false);assert.equal(v.playbackRate,2);assert.deepEqual(pixel(source.canvas),[34,68,238,255]);
 current=.4;await source.drawAt(.31,64,live);assert.equal(seeks,2,'a short loop must seek even when drift is within the tolerance');
 current=.85;await source.drawAt(.76,64,live);assert.equal(seeks,3,'do not sample outside the selected trim');
 await source.drawAt(.79,64,{...live,playing:false});assert.equal(v.paused,true);const heldSeeks=seeks;
 assert.equal(await source.drawAt(.79,64,{...live,playing:false}),false);assert.equal(seeks,heldSeeks);assert.equal(callbacks.size,0);
});
function mockRecorder({supported='mp4',fail=false,frames=[]}={}){
 return class Recorder{
  static isTypeSupported(t){return t.includes(supported);}
  constructor(stream,options){this.stream=stream;this.mimeType=options.mimeType;this.state='inactive';}
  start(){this.state='recording';if(fail)this.onerror({error:new Error('encoder failed')});}
  stop(){if(this.state==='inactive')return;this.state='inactive';this.ondataavailable({data:new Blob([new Uint8Array(64)],{type:this.mimeType})});this.onstop();}
 };
}
function recordingTarget(){const c=createCanvas(64,48),track={stopped:false,requestFrame(){},stop(){this.stopped=true;}};c.captureStream=()=>({getVideoTracks:()=>[track],getTracks:()=>[track]});return{c,track};}
test('recording detects the actual container, draws by elapsed time, and releases tracks',async()=>{
 for(const supported of ['mp4','webm']){
  let clock=0;const times=[],{c,track}=recordingTarget(),out=await M.record(c,{Recorder:mockRecorder({supported}),duration:.3,now:()=>clock,sleep:async ms=>{clock+=ms;},renderAt:async t=>{times.push(t);}});
  assert.equal(out.ext,supported);assert.equal(out.blob.type,'video/'+supported);assert.equal(track.stopped,true);assert.equal(times[0],0);assert.ok(times.at(-1)>=.299);assert.ok(times.every((t,i)=>!i||t>=times[i-1]));
 }
 assert.equal(M.recordingType(null),null);assert.throws(()=>M.format('application/octet-stream'),/chưa được/);
});
test('abort and encoder errors stop recording promptly, keep caller data, and release tracks',async()=>{
 const ctrl=new AbortController();let clock=0;const {c,track}=recordingTarget();
 await assert.rejects(M.record(c,{Recorder:mockRecorder(),signal:ctrl.signal,duration:1,now:()=>clock,sleep:async ms=>{clock+=ms;ctrl.abort();},renderAt:async()=>{}}),{name:'AbortError'});assert.equal(track.stopped,true);assert.ok(clock<1000);
 const second=recordingTarget();let draws=0;await assert.rejects(M.record(second.c,{Recorder:mockRecorder({fail:true}),renderAt:async()=>{draws++;}}),/encoder failed/);assert.equal(draws,1);assert.equal(second.track.stopped,true);
});
test('video recording starts playback after capture, includes cloned audio, and leaves the reusable source alive',async()=>{
 const events=[],video={stop(){events.push('video stopped');}},copy={stop(){events.push('audio copy stopped');}},original={stop(){throw new Error('Must not stop the source audio');},clone(){events.push('audio cloned');return copy;}};
 const tracks=[video],target={captureStream(){events.push('capture');return{addTrack(t){tracks.push(t);},getVideoTracks:()=>[video],getTracks:()=>tracks};}};
 class Recorder extends mockRecorder(){start(){events.push('recorder started');assert.deepEqual(this.stream.getTracks(),[video,copy]);super.start();}}
 let clock=0;
 const out=await M.record(target,{Recorder,duration:.2,audioStream:{getAudioTracks:()=>[original]},now:()=>clock,sleep:async ms=>clock+=ms,renderAt:async()=>events.push('frame'),onStart:async()=>{events.push('play');clock+=500;},onStop:()=>events.push('pause')});
 assert.equal(out.duration,.2);assert.ok(events.indexOf('frame')<events.indexOf('capture'));assert.ok(events.indexOf('recorder started')<events.indexOf('play'));assert.ok(clock>=700);assert.deepEqual(events.slice(-3),['video stopped','audio copy stopped','pause']);
});
test('preset video opts into sixty seconds while booth recording keeps its twenty second limit',async()=>{
 for(const [maxDuration,expected]of [[undefined,20],[60,60]]){
  let clock=0;const {c}=recordingTarget();const out=await M.record(c,{Recorder:mockRecorder(),duration:90,maxDuration,now:()=>clock,sleep:async()=>clock+=10000,renderAt:async()=>{}});assert.equal(out.duration,expected);
 }
});
test('a playback startup failure still pauses the source and releases recording audio/video tracks',async()=>{
 const {c,track}=recordingTarget();let pauses=0;
 await assert.rejects(M.record(c,{Recorder:mockRecorder(),renderAt:async()=>{},onStart:async()=>{throw new Error('playback blocked');},onStop:()=>pauses++}),/playback blocked/);
 assert.equal(track.stopped,true);assert.equal(pauses,1);
});
test('export frame sequence encodes into a playable MP4 with changing frames (reference encoder)',async()=>{
 const {c,track}=recordingTarget(),pngs=[];let clock=0;
 track.requestFrame=()=>pngs.push(c.toBuffer('image/png'));
 class Encoder{
  static isTypeSupported(t){return t.includes('mp4');}
  constructor(stream,{mimeType}){this.mimeType=mimeType;this.state='inactive';}
  start(){this.state='recording';}
  stop(){if(this.state==='inactive')return;this.state='inactive';const r=spawnSync('ffmpeg',['-v','error','-f','image2pipe','-framerate','15','-i','pipe:0','-an','-c:v','libx264','-pix_fmt','yuv420p','-movflags','frag_keyframe+empty_moov','-f','mp4','pipe:1'],{input:Buffer.concat(pngs),maxBuffer:5e6});assert.equal(r.status,0,r.stderr.toString());this.ondataavailable({data:new Blob([r.stdout],{type:'video/mp4'})});this.onstop();}
 }
 const out=await M.record(c,{Recorder:Encoder,duration:.4,now:()=>clock,sleep:async ms=>{clock+=ms;},renderAt:async t=>{const x=c.getContext('2d');x.fillStyle=t<.2?'#ff0000':'#0000ff';x.fillRect(0,0,64,48);}});
 const bytes=Buffer.from(await out.blob.arrayBuffer()),probe=spawnSync('ffprobe',['-v','error','-show_entries','stream=codec_name,width,height,duration','-of','json','pipe:0'],{input:bytes});assert.equal(probe.status,0,probe.stderr.toString());const stream=JSON.parse(probe.stdout).streams[0];assert.equal(stream.codec_name,'h264');assert.equal(stream.width,64);assert.equal(stream.height,48);assert.ok(+stream.duration>=.4);
 const raw=spawnSync('ffmpeg',['-v','error','-i','pipe:0','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{input:bytes,maxBuffer:2e6});assert.equal(raw.status,0,raw.stderr.toString());const first=raw.stdout.subarray(0,3),last=raw.stdout.subarray(-3);assert.ok(first[0]>230&&first[2]<20);assert.ok(last[2]>230&&last[0]<20);assert.equal(track.stopped,true);
});

test('export dimensions cover 720 through 2560 with even pixels and preserve vector-frame proportions',()=>{
 for(const edge of [720,1080,1920,2560])for(const [w,h]of [[1200,1600],[800,3750],[2400,1200]]){const size=M.exportSize(w,h,edge);assert.equal(Math.max(size.width,size.height),edge);assert.equal(size.width%2,0);assert.equal(size.height%2,0);assert.ok(Math.abs(size.width/size.height-w/h)<.008);}
 assert.equal(M.exportSize(1200,1600).height,1920);assert.equal(M.exportSize(1200,1600,999).height,1920);
});
test('source decoding covers the actual exported slot even after zooming and rotating without upscaling the source',()=>{
 for(const rotation of [0,90,180,270])for(const zoom of [1,2,3])for(const [dw,dh]of [[640,480],[1200,800],[400,1000]]){
  const edge=M.sourceEdge(3840,2160,dw,dh,{rotation,zoom}),s=edge/3840,iw=rotation%180?2160*s:3840*s,ih=rotation%180?3840*s:2160*s;
  if(edge<3840)assert.ok(Math.max(dw/iw,dh/ih)*zoom<=1.001);assert.ok(edge<=3840);
 }
 assert.equal(M.sourceEdge(320,240,1600,1200),320);
});
test('high-detail frame extraction removes the old 480-pixel enlargement loss',async()=>{
 const B=require('../dist/booth-core.js'),raw=createCanvas(1920,1080),x=raw.getContext('2d');x.fillStyle='#ddd';x.fillRect(0,0,1920,1080);for(let i=0;i<1920;i+=6){x.fillStyle=i%12?'#252525':'#fafafa';x.fillRect(i,0,3,1080);}x.fillStyle='#000';x.font='36px sans-serif';x.fillText('RAY PHOTO · 1920 × 1080',60,120);
 const source=cap=>{const k=cap/1920,c=createCanvas(cap,Math.round(1080*k));c.getContext('2d').drawImage(raw,0,0,c.width,c.height);return c;},render=img=>{const c=createCanvas(960,540);B.drawCover(c.getContext('2d'),img,0,0,960,540,{});return c.getContext('2d').getImageData(0,0,960,540).data;};
 const reference=render(raw),old=render(source(480)),next=render(source(M.sourceEdge(1920,1080,960,540))),mse=a=>a.reduce((sum,v,i)=>sum+(v-reference[i])**2,0)/a.length;
 assert.ok(mse(next)<mse(old)*.1,JSON.stringify({old:mse(old),next:mse(next)}));
});
test('recording allocates bitrate for exported pixels, requests detailed encoding and accounts for rendering time',async()=>{
 let clock=0,settings,waits=[];const {c,track}=recordingTarget();
 class Recorder extends mockRecorder(){constructor(stream,options){super(stream,options);settings=options;}}
 const out=await M.record(c,{Recorder,fps:24,duration:.2,now:()=>clock,sleep:async ms=>{waits.push(ms);clock+=ms;},renderAt:async()=>{c.width=1440;c.height=1920;clock+=25;}});
 assert.equal(settings.videoBitsPerSecond,M.videoBitrate(1440,1920,24));assert.ok(settings.videoBitsPerSecond>15000000);assert.equal(track.contentHint,'detail');assert.ok(waits.some(ms=>ms<20));assert.equal(out.width,1440);assert.equal(out.height,1920);assert.equal(M.videoBitrate(4000,4000,60),32000000);
});
test('recording flushes the final asynchronous canvas frame before stopping the encoder',async()=>{
 let clock=0,pending=false,last=-1;const {c,track}=recordingTarget();track.requestFrame=()=>{pending=true;};
 class Recorder extends mockRecorder(){stop(){assert.equal(pending,false,'last canvas frame must be delivered before recorder.stop');super.stop();}}
 await M.record(c,{Recorder,fps:24,duration:.2,now:()=>clock,sleep:async ms=>{clock+=ms;if(ms>=1000/24)pending=false;},renderAt:async t=>{last=t;}});
 assert.ok(last>=.199);assert.ok(clock>=220);
});
test('video trim counts playback startup and flushes without another slow render after the deadline',async()=>{
 let clock=0;const {c}=recordingTarget(),times=[];
 await M.record(c,{Recorder:mockRecorder(),duration:.5,fps:15,includeStartupTime:true,renderFinalFrame:false,now:()=>clock,sleep:async ms=>{clock+=ms;},onStart:()=>{clock+=80;},renderAt:async t=>{times.push(t);clock+=80;}});
 assert.ok(times.every(t=>t<.5));assert.ok(clock<740);assert.ok(clock>=580);
});
test('audio exports require H264/AAC for MP4 and fall back truthfully when only WebM audio can encode',async()=>{
 let clock=0,mime;const {c}=recordingTarget(),audioStream={getAudioTracks:()=>[]};
 class Recorder extends mockRecorder({supported:'webm'}){static isTypeSupported(t){return t==='video/mp4'||t.includes('webm');}constructor(stream,options){super(stream,options);mime=options.mimeType;}}
 const result=await M.record(c,{Recorder,audioStream,duration:.2,now:()=>clock,sleep:async ms=>clock+=ms,renderAt:async()=>{}});assert.match(mime,/webm/);assert.equal(result.ext,'webm');assert.equal(result.blob.type,'video/webm');
});

test('Apple still/MOV pairs keep their order, collapse once and never swallow unrelated names',()=>{
 const jpg={name:'IMG_1234.JPG',type:'image/jpeg'},mov={name:'img_1234.MOV',type:'video/quicktime'},other={name:'IMG_2222.JPG',type:'image/jpeg'},unrelated={name:'IMG_3333.MOV',type:'video/quicktime'};
 for(const list of [[jpg,mov,other],[mov,jpg,other]]){const items=M.importItems(list);assert.equal(items.length,2);assert.equal(items[0].file,mov);assert.equal(items[0].live,true);assert.equal(items[1].file,other);}
 assert.equal(M.importItems([jpg,unrelated,other]).length,3);assert.equal(M.importItems([jpg,{name:'IMG_1234.mp4',type:'video/mp4'}]).length,2);
});
