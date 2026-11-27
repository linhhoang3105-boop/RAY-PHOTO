/* Local GIF/video sources, trimmed timeline mapping, and truthful recording formats. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.BoothMedia=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 let canvasFactory=null;
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function exportSize(width,height,edge=1920){const longest=[720,1080,1920,2560].includes(Number(edge))?Number(edge):1920,scale=longest/Math.max(width,height);return{width:Math.max(2,Math.floor(width*scale/2)*2),height:Math.max(2,Math.floor(height*scale/2)*2)};}
 function sourceEdge(width,height,slotWidth,slotHeight,crop={}){const turn=((Math.round((Number(crop.rotation)||0)/90)%4)+4)%4,ow=turn%2?height:width,oh=turn%2?width:height,scale=Math.max(slotWidth/ow,slotHeight/oh)*clamp(Number(crop.zoom)||1,1,3);return Math.max(2,Math.min(Math.max(width,height),Math.ceil(Math.max(width,height)*scale)));}
 function videoBitrate(width,height,fps=15){return Math.round(clamp((Number(width)||640)*(Number(height)||480)*(Number(fps)||15)*.28,4000000,32000000));}
 function canvas(w,h){if(canvasFactory)return canvasFactory(w,h);const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
 function setCanvasFactory(f){canvasFactory=f;}
 function formatTime(t){t=Math.max(0,+t||0);return Math.floor(t/60)+':'+(t%60).toFixed(2).padStart(5,'0');}
 function isVideo(file){return /^video\//.test(file.type||'')||/\.(mp4|mov|webm|m4v)$/i.test(file.name||'');}
 function isGIF(file){return file.type==='image/gif'||/\.gif$/i.test(file.name||'');}
 // Original Apple exports may include a still and MOV with the same basename.
 // Prefer that MOV for one slot; never pair unrelated names or two videos.
 function importItems(files){
  const list=Array.from(files||[]),stem=f=>(f.name||'').replace(/\.[^.]+$/,'').toLowerCase();
  const videos=new Map();for(const f of list)if(isVideo(f)&&/\.mov$/i.test(f.name||'')&&stem(f)){const key=stem(f);videos.set(key,(videos.get(key)||[]).concat(f));}
  const stills=new Map();for(const f of list)if(/\.(heic|heif|jpe?g)$/i.test(f.name||'')){const key=stem(f);stills.set(key,(stills.get(key)||[]).concat(f));}
  const pairs=new Map();for(const f of list)if(stills.get(stem(f))?.length===1&&stills.get(stem(f))[0]===f&&videos.get(stem(f))?.length===1)pairs.set(f,videos.get(stem(f))[0]);
  const used=new Set(),items=[];for(const f of list){const source=pairs.get(f)||f;if(used.has(source))continue;used.add(source);items.push({file:source,live:!!pairs.get(f)||[...pairs.values()].includes(source)});}return items;
 }
 function normalizeClip(clip={},duration,kind='video'){
  const endLimit=Math.max(.02,+duration||.02),start=clamp(+clip.start||0,0,Math.max(0,endLimit-.02)),end=clamp(Number.isFinite(+clip.end)?+clip.end:endLimit,start+.02,endLimit);
  return{start,end,offset:clamp(+clip.offset||0,0,20),speed:clamp(+clip.speed||1,.25,4),loop:clip.loop===undefined?kind==='gif':!!clip.loop};
 }
 function sourceTime(t,clip,duration,kind){
  const c=normalizeClip(clip,duration,kind),span=c.end-c.start,local=Math.max(0,(t-c.offset)*c.speed);
  return c.start+(c.loop?local%span:Math.min(local,Math.max(0,span-.001)));
 }
 function waitFor(v,events,predicate,ms=12000){return new Promise((resolve,reject)=>{if(predicate())return resolve();const clean=()=>{clearTimeout(timer);for(const e of events)v.removeEventListener(e,check);v.removeEventListener('error',error);},check=()=>{if(predicate()){clean();resolve();}},error=()=>{clean();reject(new Error('Trình duyệt chưa đọc được video này. Thử MP4/H.264 hoặc mở bằng Safari.'));},timer=setTimeout(()=>{clean();reject(new Error('Đọc video quá lâu. Thử đoạn ngắn hơn.'));},ms);for(const e of events)v.addEventListener(e,check);v.addEventListener('error',error);});}
 async function seek(v,time,force=false){
  if(!force&&v.readyState>=2&&!v.seeking&&Math.abs(v.currentTime-time)<.008)return;
  const t=clamp(time,.001,Math.max(.001,(Number.isFinite(v.duration)?v.duration:time+1)-.001));
  // Assign first: a nearby old frame must not satisfy the wait before seeking starts.
  v.currentTime=t;await waitFor(v,['seeked','loadeddata','timeupdate'],()=>v.readyState>=2&&!v.seeking&&Math.abs(v.currentTime-t)<.12);
 }
 function presentedFrame(v){
  let id,timer,finish;const done=new Promise(resolve=>{let settled=false;finish=()=>{if(settled)return;settled=true;clearTimeout(timer);if(id!==undefined)v.cancelVideoFrameCallback?.(id);resolve();};
   // A seeked event can precede the compositor's first drawable frame.
   if(typeof v.requestVideoFrameCallback==='function'){id=v.requestVideoFrameCallback(finish);timer=setTimeout(finish,400);}else timer=setTimeout(finish,40);
  });return{done,cancel:()=>finish()};
 }
 async function seekFrame(v,time){const pending=presentedFrame(v);try{await seek(v,time,true);await pending.done;}finally{pending.cancel();}}
 async function primeVideo(v){
  if(typeof v.play!=='function')return;let timer;
  try{await Promise.race([Promise.resolve(v.play()).catch(()=>{}),new Promise(r=>{timer=setTimeout(r,800);})]);}catch{}finally{clearTimeout(timer);v.pause?.();}
 }
 class VideoSource{
  constructor(video,url){this.kind='video';this.video=video;this.width=video.videoWidth;this.height=video.videoHeight;this.url=url;this.duration=video.duration;this.canvas=canvas(1,1);this.version=0;this.stamp='';this.disposed=false;}
  async drawAt(time,cap=480,options={}){
   if(this.disposed)throw new Error('Video đã đóng.');const v=this.video,s=Math.min(1,cap/Math.max(v.videoWidth,v.videoHeight)),w=Math.max(1,Math.round(v.videoWidth*s)),h=Math.max(1,Math.round(v.videoHeight*s)),stamp=time.toFixed(3)+'|'+w+'x'+h,unchanged=stamp===this.stamp;if(unchanged&&!options.realtime)return false;
   const first=!this.stamp;if(first)await primeVideo(v);
   // During recording let the decoder play normally. Seeking each output frame
   // waits for a compositor round trip and skips motion on slower devices.
   const live=!!options.realtime,playing=live&&options.playing;
   if(live){v.playbackRate=Number(options.speed)||1;if(!playing)v.pause?.();}
   if(unchanged&&!playing)return false;
   const wrapped=Number.isFinite(this.drawTime)&&time<this.drawTime-.008,outside=Number.isFinite(options.start)&&v.currentTime<options.start-.008||Number.isFinite(options.end)&&v.currentTime>options.end;
   const needsSeek=!playing||first||wrapped||outside||v.readyState<2||v.seeking||Math.abs(v.currentTime-time)>.15;
   if(needsSeek){const pending=first||v.readyState<2||v.seeking||Math.abs(v.currentTime-time)>=.008?presentedFrame(v):null;
    try{await seek(v,time,first);if(pending)await pending.done;}finally{pending?.cancel();}}
   if(playing&&v.paused)await v.play();
   if(this.disposed)throw new Error('Video đã đóng.');this.canvas.width=w;this.canvas.height=h;this.canvas.getContext('2d').drawImage(v,0,0,w,h);this.stamp=stamp;this.drawTime=time;this.version++;return true;
  }
  dispose(){this.disposed=true;this.video.pause();this.video.removeAttribute('src');this.video.load();this.video.remove();URL.revokeObjectURL(this.url);this.canvas.width=this.canvas.height=1;}
 }
 class GIFSource{
  constructor(parsed,decoder){
   this.kind='gif';this.parsed=parsed;this.decoder=decoder;this.frames=parsed.frames.filter(f=>f.image);this.width=parsed.lsd.width;this.height=parsed.lsd.height;
   if(!this.frames.length||this.width*this.height>4000000||this.frames.length>2000)throw new Error('GIF quá lớn. Dùng GIF nhỏ hơn hoặc video MP4.');
   this.ends=[];let ms=0;for(const f of this.frames){ms+=Math.max(20,(f.gce?.delay||10)*10);this.ends.push(ms/1000);}this.duration=ms/1000;
   this.full=canvas(this.width,this.height);this.patch=canvas(1,1);this.canvas=canvas(1,1);this.index=-1;this.previous=null;this.restore=null;this.version=0;this.stamp='';
  }
  async drawAt(time,cap=480){
   if(this.disposed)throw new Error('GIF đã đóng.');
   const idx=this.ends.findIndex(t=>time<t),wanted=idx<0?this.frames.length-1:idx,s=Math.min(1,cap/Math.max(this.width,this.height)),w=Math.max(1,Math.round(this.width*s)),h=Math.max(1,Math.round(this.height*s)),stamp=w+'x'+h+'|'+wanted;if(stamp===this.stamp)return false;
   const c=this.full.getContext('2d',{willReadFrequently:true});if(wanted<this.index){c.clearRect(0,0,this.width,this.height);this.index=-1;this.previous=null;this.restore=null;}
   while(this.index<wanted){
    const prev=this.previous;if(prev?.disposalType===2)c.clearRect(prev.dims.left,prev.dims.top,prev.dims.width,prev.dims.height);else if(prev?.disposalType===3&&this.restore)c.putImageData(this.restore,0,0);
    const frame=this.decoder.decompressFrame(this.frames[++this.index],this.parsed.gct,true);this.restore=frame.disposalType===3?c.getImageData(0,0,this.width,this.height):null;
    this.patch.width=frame.dims.width;this.patch.height=frame.dims.height;const p=this.patch.getContext('2d'),im=p.createImageData(frame.dims.width,frame.dims.height);im.data.set(frame.patch);p.putImageData(im,0,0);c.drawImage(this.patch,frame.dims.left,frame.dims.top);this.previous=frame;
   }
   this.canvas.width=w;this.canvas.height=h;this.canvas.getContext('2d').drawImage(this.full,0,0,w,h);this.stamp=stamp;this.version++;return true;
  }
  dispose(){this.disposed=true;for(const c of[this.full,this.patch,this.canvas])c.width=c.height=1;this.frames=[];this.parsed=null;}
 }
 async function load(file){
  if(isGIF(file)){if(file.size>40*1024*1024)throw new Error('GIF lớn hơn 40 MB. Hãy dùng bản nhỏ hơn.');const decoder=root.GIFUCT;if(!decoder)throw new Error('Chưa tải được bộ đọc GIF. Hãy tải lại trang.');const source=new GIFSource(decoder.parseGIF(await file.arrayBuffer()),decoder);await source.drawAt(0);return source;}
  if(!isVideo(file))return null;
  if(file.size>250*1024*1024)throw new Error('Video lớn hơn 250 MB. Cắt ngắn trong Ảnh rồi chọn lại.');
  const url=URL.createObjectURL(file),v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='auto';v.style.cssText='position:fixed;width:1px;height:1px;left:0;bottom:0;opacity:.001;pointer-events:none';v.setAttribute('playsinline','');document.body.append(v);
  try{
   const metadata=waitFor(v,['loadedmetadata','durationchange'],()=>v.readyState>=1);v.src=url;v.load();await metadata;
   if(!Number.isFinite(v.duration)){const end=waitFor(v,['durationchange','seeked','timeupdate'],()=>Number.isFinite(v.duration)&&v.duration>0,8000);v.currentTime=1e8;await end;}
   if(!Number.isFinite(v.duration)||v.duration<=0||!v.videoWidth)throw new Error('Không đọc được thời lượng video. Dùng MP4/H.264.');
   const source=new VideoSource(v,url);await source.drawAt(0);return source;
  }catch(e){v.pause();v.removeAttribute('src');v.load();v.remove();URL.revokeObjectURL(url);throw e;}
 }
 const TYPES=['video/mp4;codecs=avc1','video/mp4','video/mp4;codecs=avc1.42E01E','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
 function recordingType(Recorder=root.MediaRecorder){if(!Recorder)return null;for(const t of TYPES)try{if(Recorder.isTypeSupported(t))return t;}catch{}return null;}
 function format(mime){if(/mp4/i.test(mime))return{mime:'video/mp4',ext:'mp4'};if(/webm/i.test(mime))return{mime:'video/webm',ext:'webm'};throw new Error('Định dạng video chưa được hỗ trợ.');}
 async function record(target,options){
  const Recorder=options.Recorder||root.MediaRecorder,types=options.audioStream?['video/mp4;codecs=avc1,mp4a.40.2','video/mp4;codecs=avc1.42001f,mp4a.40.2','video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm']:TYPES,type=types.find(t=>{try{return Recorder?.isTypeSupported(t);}catch{return false;}}),fps=options.fps||15,duration=clamp(+options.duration||5,.2,Math.max(20,Number(options.maxDuration)||20)),now=options.now||(()=>performance.now()),sleep=options.sleep||(ms=>new Promise(r=>setTimeout(r,ms))),signal=options.signal;
  if(!type||!target.captureStream)throw new Error('Máy này chưa hỗ trợ xuất video. Mở trang bằng Safari/Chrome mới nhất; ảnh PNG vẫn lưu được.');
  let stream,recorder,rejectDone,stopTimer,done,recordingError,bitrate;const chunks=[];const check=()=>{if(signal?.aborted)throw Object.assign(new Error('Đã dừng xuất video.'),{name:'AbortError'});if(recordingError)throw recordingError;};
  try{
   check();await options.renderAt(0);bitrate=videoBitrate(target.width,target.height,fps);stream=target.captureStream(fps);
   try{stream.getVideoTracks()[0].contentHint='detail';}catch{}
   if(options.audioStream)for(const track of options.audioStream.getAudioTracks())stream.addTrack(track.clone?track.clone():track);
   for(const mime of[type,...types.filter(t=>t!==type)]){if(!Recorder.isTypeSupported(mime))continue;try{recorder=new Recorder(stream,{mimeType:mime,videoBitsPerSecond:bitrate});break;}catch{}}
   if(!recorder)throw new Error('Chưa mở được bộ xuất video trên trình duyệt này.');
   done=new Promise((resolve,reject)=>{rejectDone=reject;recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};recorder.onstop=resolve;recorder.onerror=e=>{recordingError=e.error||new Error('Bộ xuất video bị gián đoạn.');reject(recordingError);};});done.catch(()=>{});
   const captureOrigin=now();recorder.start();await options.onStart?.();const origin=options.includeStartupTime?captureOrigin:now();
   while(true){check();const started=now(),t=Math.min(duration,(started-origin)/1000);if(t<duration||options.renderFinalFrame!==false)await options.renderAt(Math.min(t,Math.max(0,duration-.001)));stream.getVideoTracks()[0]?.requestFrame?.();options.onProgress?.(t,duration);if(t>=duration)break;await sleep(Math.max(1,1000/fps-(now()-started)));}
   // Canvas capture is asynchronous: allow the final requested frame to reach
   // the recorder before stopping, including a held frame after a short clip.
   await sleep(1000/fps+20);check();recorder.stop();stopTimer=setTimeout(()=>rejectDone(new Error('Xuất video quá lâu. Hãy thử lại.')),15000);await done;clearTimeout(stopTimer);const f=format(recorder.mimeType||type),blob=new Blob(chunks,{type:f.mime});if(blob.size<32)throw new Error('Chưa tạo được tệp video.');return{blob,...f,duration,width:target.width,height:target.height,fps,bitrate:recorder.videoBitsPerSecond||bitrate};
  }finally{clearTimeout(stopTimer);if(recorder&&recorder.state!=='inactive')try{recorder.stop();}catch{}stream?.getTracks().forEach(t=>t.stop());try{await options.onStop?.();}catch{}}
 }
 return{setCanvasFactory,canvas,formatTime,isVideo,isGIF,importItems,normalizeClip,sourceTime,exportSize,sourceEdge,videoBitrate,VideoSource,GIFSource,load,seek,seekFrame,recordingType,format,record,TYPES};
});
