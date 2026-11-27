/* Video frames use the existing film renderer. Images keep their original loading/export path. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.RayVideoEditor=api;api.init();}})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const MAX_DURATION=60,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function planClip(duration,start=0,end=duration){
  if(!Number.isFinite(duration)||duration<.2)throw new Error('Video cần dài ít nhất 0,2 giây.');
  const from=clamp(Number(start)||0,0,duration-.2),to=clamp(Number(end)||duration,from+.2,Math.min(duration,from+MAX_DURATION));
  return{start:from,end:to,duration:to-from};
 }
 function frameSize(width,height,edge=1080){const k=Math.min(1,edge/Math.max(width,height));return{width:Math.max(2,Math.floor(width*k/2)*2),height:Math.max(2,Math.floor(height*k/2)*2)};}
 let movie=null;
 const api={MAX_DURATION,planClip,frameSize,get active(){return !!movie;}};
 function init(){
  const $=id=>document.getElementById(id),Media=window.BoothMedia,app=window.BuongToiApp,host=window.parent!==window?window.parent.BuongToiHost:null;
  if(!app||!Media)return;
  let loading=false,exporting=false,raf=0,resumePreview=null,controller=null;
  Object.defineProperty(api,'exporting',{get:()=>exporting});
  const bar=document.createElement('section');bar.id='rayVideoControls';bar.hidden=true;bar.setAttribute('aria-label','Chỉnh màu video');
  bar.innerHTML='<div class="video-playback"><button type="button" id="rayVideoPlay">▶ Phát</button><input id="rayVideoTime" type="range" min="0" max="1" step="0.04" value="0" aria-label="Thời điểm video"><output id="rayVideoClock">0:00</output><button type="button" id="rayVideoCancel" hidden>Dừng xuất</button></div><details class="video-settings"><summary>Đoạn video &amp; tùy chọn xuất</summary><div class="video-fields"><label>Từ giây<input id="rayVideoStart" type="number" min="0" step="0.1" value="0"></label><label>Đến giây<input id="rayVideoEnd" type="number" min="0.2" step="0.1" value="1"></label><label>Cỡ xuất<select id="rayVideoSize"><option value="1080">Cạnh dài 1080</option><option value="720">Cạnh dài 720</option></select></label><label class="video-audio"><input id="rayVideoAudio" type="checkbox" checked> Giữ âm thanh</label></div><p>Chọn đoạn tối đa 60 giây mỗi lần. Video được dựng trên thiết bị; giữ trang mở đến khi xuất xong.</p></details><p id="rayVideoStatus" role="status"></p>';
  document.querySelector('.preset-dock').before(bar);
  for(const input of document.querySelectorAll('.pickin,#file')){input.accept='image/*,video/*,.mov,.mp4,.webm,.m4v';input.setAttribute('aria-label','Chọn ảnh hoặc video');}
  document.getElementById('pick1').firstChild.textContent='Chọn ảnh / video';
  const photoSize=$('sizeSeg').closest('.grp');photoSize.classList.add('photo-only-export');document.querySelector('.adjust-categories [data-section="'+photoSize.dataset.adjustSection+'"]').classList.add('photo-only-export');
  document.querySelector('.drop p').textContent='Mở ảnh hoặc video để chọn màu phim. Ảnh có thêm trang điểm và chỉnh dáng; video có thanh thời gian và chọn đoạn xuất.';
  const say=value=>$('rayVideoStatus').textContent=value;
  const clip=()=>planClip(movie.video.duration,$('rayVideoStart').value,$('rayVideoEnd').value);
  const time=t=>Media.formatTime(t);
  function sync(){
   bar.hidden=!movie;document.body.classList.toggle('ray-video-mode',!!movie);
   for(const button of document.querySelectorAll('.editor-tabs button'))button.disabled=!!movie&&!['film','adjust','sun'].includes(button.dataset.tool);
   if(!movie)return;
   const c=clip();$('rayVideoTime').min=String(c.start);$('rayVideoTime').max=String(c.end);$('rayVideoTime').value=String(movie.video.currentTime);$('rayVideoClock').textContent=time(movie.video.currentTime)+' / '+time(c.end);
   $('rayVideoPlay').textContent=movie.video.paused?'▶ Phát':'Ⅱ Dừng';
  }
  function hold(){if(!resumePreview)resumePreview=window.RayPreview?.pause?.()||null;}
  function pause(){if(raf)cancelAnimationFrame(raf);raf=0;movie?.video.pause();const release=resumePreview;resumePreview=null;release?.();sync();}
  function paint(force=false){
   if(!movie||loading)return;
   const m=movie,v=m.video;if(!force&&Math.abs(m.lastTime-v.currentTime)<.001)return;
   m.canvas.getContext('2d').drawImage(v,0,0,m.canvas.width,m.canvas.height);
   const size=frameSize(v.videoWidth,v.videoHeight,960);if(m.preview.width!==size.width||m.preview.height!==size.height){m.preview.width=size.width;m.preview.height=size.height;}
   m.preview.getContext('2d').drawImage(m.canvas,0,0,m.preview.width,m.preview.height);
   source=m.canvas;preview=m.preview;m.lastTime=v.currentTime;window.RayLayers?.invalidate?.();sync();
  }
  function tick(stamp){
   if(!movie||movie.video.paused||exporting)return;
   if(movie.video.currentTime>=clip().end-.02){pause();void seekTo(clip().end-.001).catch(error=>say(error.message));return;}
   if(stamp-(movie.lastTick||0)>=80){movie.lastTick=stamp;draw();}raf=requestAnimationFrame(tick);
  }
  async function play(){if(!movie||exporting)return;if(!movie.video.paused){pause();return;}
   try{const c=clip();if(movie.video.currentTime<c.start||movie.video.currentTime>=c.end-.03)await seekTo(c.start);hold();movie.video.muted=true;await movie.video.play();sync();raf=requestAnimationFrame(tick);}catch(error){pause();say('Chưa phát được video: '+error.message);}
  }
  function seekTo(value){
   const m=movie;if(!m)return Promise.resolve();const c=clip();m.pendingTime=clamp(Number(value)||0,c.start,c.end-.001);
   if(m.seeking)return m.seeking;
   m.seeking=(async()=>{while(m===movie&&m.pendingTime!==null){const next=m.pendingTime;m.pendingTime=null;await Media.seekFrame(m.video,next);if(m===movie){paint(true);queue();}}})().finally(()=>m.seeking=null);
   return m.seeking;
  }
  function changed(){if(!movie)return;const c=clip();$('rayVideoStart').value=String(Number(c.start.toFixed(2)));$('rayVideoEnd').value=String(Number(c.end.toFixed(2)));sync();window.RaySession?.contextChanged();}
  async function dispose(){pause();if(!movie)return;const m=movie;movie=null;m.media.dispose();m.canvas.width=m.canvas.height=m.preview.width=m.preview.height=1;try{m.audio?.node.disconnect();await m.audio?.context.close();}catch{}sync();}
  const previousLoad=load;
  async function loadVideo(file,options){
   if(exporting)throw new Error('Dừng xuất video trước khi mở tệp khác.');
   pause();let media;
   try{
    media=await Media.load(file);const v=media.video;if(v.duration<.2)throw new Error('Video quá ngắn.');
    const size=frameSize(v.videoWidth,v.videoHeight),canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;canvas.getContext('2d').drawImage(v,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Chưa tạo được khung xem trước.');
    loading=true;await previousLoad(new File([blob],'ray-video-frame.png',{type:'image/png'}),{...options,restoring:true});
    await dispose();movie={media,video:v,file,canvas,preview:document.createElement('canvas'),lastTime:-1,pendingTime:null};media=null;loading=false;
    $('rayVideoStart').value='0';$('rayVideoEnd').value=String(Math.min(v.duration,MAX_DURATION));$('rayVideoSize').value='1080';$('rayVideoAudio').checked=true;
    v.addEventListener('timeupdate',()=>{if(movie?.video!==v||exporting||v.paused||v.currentTime<clip().end)return;pause();void seekTo(clip().end-.001).catch(error=>say(error.message));});
    v.addEventListener('ended',()=>{if(movie?.video===v&&!exporting){pause();void seekTo(clip().end-.001).catch(error=>say(error.message));}});
    paint(true);window.RaySession?.reset(file,options);window.RayControls?.restoreSelection({adjustName:'Cơ bản'});app.showTools('film');app.refreshThumbnails();queue();sync();host?.onMediaChanged?.('video');
    say(time(v.duration)+' · '+v.videoWidth+' × '+v.videoHeight+' · Chọn preset để xem màu trên video.');
   }catch(error){media?.dispose();if(host?.toast)host.toast(error.message,true);else note(error.message);throw error;}finally{loading=false;}
  }
  load=async function(file,options){
   if(!file)return;if(Media.isVideo(file))return loadVideo(file,options);
   if(exporting)throw new Error('Dừng xuất video trước khi mở tệp khác.');
   pause();loading=true;const old=source;try{await previousLoad(file,options);if(source!==old){await dispose();host?.onMediaChanged?.('image');}}finally{loading=false;}queue();
  };
  const previousDraw=draw;draw=function(...args){if(movie&&!loading)paint();return previousDraw.apply(this,args);};
  const previousTools=app.showTools;app.showTools=tool=>previousTools(movie&&!['film','adjust','sun'].includes(tool)?'film':tool);
  const previousSourceFile=app.sourceFile;app.sourceFile=()=>movie?.file||previousSourceFile();
  function capture(){if(!movie)return null;const c=clip();return{kind:'video',start:c.start,end:c.end,time:clamp(movie.video.currentTime,c.start,c.end-.001),edge:Number($('rayVideoSize').value),audio:$('rayVideoAudio').checked};}
  async function restore(meta){if(!movie||meta?.kind!=='video')return;$('rayVideoStart').value=String(meta.start??0);$('rayVideoEnd').value=String(meta.end??movie.video.duration);$('rayVideoSize').value=String(meta.edge===720?720:1080);$('rayVideoAudio').checked=meta.audio!==false;changed();await seekTo(meta.time??meta.start??0);}
  async function audioStream(){
   const m=movie,Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw new Error('Máy này chưa giữ được âm thanh khi xuất. Bỏ chọn Giữ âm thanh để xuất video im lặng.');
   if(!m.audio){const context=new Context(),node=context.createMediaElementSource(m.video),dest=context.createMediaStreamDestination();m.audio={context,node,dest};}
   await m.audio.context.resume();m.audio.node.disconnect();m.audio.node.connect(m.audio.dest);return m.audio.dest.stream;
  }
  async function exportVideo(){
   if(!movie)throw new Error('Mở video trước.');if(exporting)throw new Error('Video đang được xuất.');
   const m=movie,c=clip(),position=m.video.currentTime,withAudio=$('rayVideoAudio').checked;pause();exporting=true;controller=new AbortController();
   $('rayVideoCancel').hidden=false;const disabled=[...document.querySelectorAll('button,input,select')].filter(el=>el.id!=='rayVideoCancel').map(el=>[el,el.disabled]);disabled.forEach(([el])=>el.disabled=true);busy.classList.add('on');
   const target=document.createElement('canvas'),input=document.createElement('canvas'),rendered=document.createElement('canvas');let audio;
   try{
    // Resume audio in the Save button's activation before awaiting draft work.
    const sound=withAudio?audioStream():Promise.resolve(null);sound.catch(()=>{});
    // Authorize this media element in the Save gesture, before draft/seek awaits.
    m.video.muted=true;const warm=Promise.resolve(m.video.play()).then(()=>m.video.pause());warm.catch(()=>{});
    await warm;await window.RaySession?.apply();disabled.forEach(([el])=>el.disabled=true);await m.seeking;audio=await sound;
    await Media.seekFrame(m.video,c.start);hold();
    const edge=Number($('rayVideoSize').value),size=frameSize(m.video.videoWidth,m.video.videoHeight,edge);input.width=size.width;input.height=size.height;
    const out=await Media.record(target,{duration:c.duration,maxDuration:MAX_DURATION,fps:15,audioStream:audio,signal:controller.signal,includeStartupTime:true,renderFinalFrame:false,
     renderAt:async()=>{if(m.video.currentTime>c.end){m.video.pause();await Media.seekFrame(m.video,Math.max(c.start,c.end-1/30));}input.getContext('2d').drawImage(m.video,0,0,input.width,input.height);render(rendered,input);const output=frameSize(rendered.width,rendered.height,edge),w=output.width,h=output.height;if(target.width!==w||target.height!==h){target.width=w;target.height=h;}target.getContext('2d').drawImage(rendered,0,0,w,h);},
     onStart:async()=>{m.video.muted=!withAudio;await m.video.play();},onStop:()=>m.video.pause(),
     onProgress:(t,total)=>{const message='Đang xuất video · '+Math.round(t/total*100)+'%';say(message);busy.textContent=message;}
    });
    return{...out,name:'ray-photo-'+Date.now()+'.'+out.ext,width:target.width,height:target.height,origin:'darkroom-video',draftId:window.RaySession?.documentKey,editKey:window.RaySession?.documentKey+'|'+window.RaySession?.snapshot()?.key+'|'+JSON.stringify({start:c.start,end:c.end,edge,audio:withAudio}),audio:withAudio};
   }finally{
    m.video.pause();m.video.muted=true;m.audio?.node.disconnect();controller=null;
    const release=resumePreview;resumePreview=null;release?.();target.width=target.height=input.width=input.height=rendered.width=rendered.height=1;
    try{await seekTo(position);}catch{}exporting=false;disabled.forEach(([el,value])=>el.disabled=value);$('rayVideoCancel').hidden=true;busy.classList.remove('on');busy.textContent='Đang dựng bản đầy đủ…';sync();syncControls();window.RaySession?.refresh();say('Video vẫn được giữ để chỉnh tiếp.');
   }
  }
  const previousExport=app.exportFile;app.exportFile=(...args)=>movie?exportVideo():previousExport.apply(app,args);
  let outputURL=null;const output=document.createElement('dialog');output.className='ray-video-output';output.setAttribute('aria-label','Video đã xuất');output.innerHTML='<h2>Video đã sẵn sàng</h2><button type="button" class="video-output-close">Quay lại chỉnh ×</button><video controls playsinline aria-label="Video đã chỉnh màu"></video><p role="status"></p><div class="video-output-actions"><a download>Tải video</a><button type="button">Lưu video / Chia sẻ</button></div>';document.body.append(output);
  output.querySelector('.video-output-close').onclick=()=>output.close();output.addEventListener('close',()=>output.querySelector('video').pause());
  function showOutput(file){if(host?.openResult){host.onExport?.(file);host.openResult(file);return;}if(outputURL)URL.revokeObjectURL(outputURL);outputURL=URL.createObjectURL(file.blob);output.querySelector('video').src=outputURL;output.querySelector('p').textContent=file.width+' × '+file.height+' px · '+file.ext.toUpperCase();const link=output.querySelector('a');link.href=outputURL;link.download=file.name;link.textContent='Tải video '+file.ext.toUpperCase();const share=output.querySelector('.video-output-actions button'),ready=new File([file.blob],file.name,{type:file.blob.type});share.hidden=!navigator.canShare?.({files:[ready]});share.onclick=async()=>{try{await navigator.share({files:[ready],title:'RAY PHOTO'});}catch(error){if(error.name!=='AbortError')output.querySelector('p').textContent='Chưa chia sẻ được. Bấm Tải video để giữ tệp.';}};output.showModal();}
  const previousSave=saveBtn.onclick;saveBtn.onclick=async function(e){if(!movie)return previousSave.call(this,e);try{showOutput(await exportVideo());}catch(error){say(error.message);}};
  $('rayVideoPlay').onclick=play;$('rayVideoCancel').onclick=()=>controller?.abort();
  $('rayVideoTime').oninput=()=>{const time=$('rayVideoTime').value;pause();void seekTo(time).catch(error=>say(error.message));};
  for(const id of ['rayVideoStart','rayVideoEnd'])$(id).onchange=()=>{pause();changed();void seekTo(clamp(movie.video.currentTime,clip().start,clip().end-.001)).catch(error=>say(error.message));};
  for(const id of ['rayVideoSize','rayVideoAudio'])$(id).onchange=changed;
  document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();controller?.abort();}});window.addEventListener('pagehide',()=>{controller?.abort();void dispose();});
  Object.assign(api,{capture,restore,pause,exportVideo,dispose});sync();
 }
 api.init=init;return api;
});
