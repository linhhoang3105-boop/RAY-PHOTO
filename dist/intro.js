/* Responsive, skippable opening film. No photo/editor state is changed here. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.RayIntro=api;if(root.document)api.init();}})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const KEY='ray-photo-intro-v1',defaults={portrait:{video:'assets/intro-portrait.mp4',poster:'assets/intro-portrait.jpg'},landscape:{video:'assets/intro-landscape.mp4',poster:'assets/intro-landscape.jpg'}};
 function createPlayer(nodes,env){
  const {dialog,video,enter,toggle,progress,time}=nodes,assets=env.assets||defaults,{setTimeout:schedule,clearTimeout:cancel}=env;
  let active=false,seenMemory=false,wantPlay=false,manualPause=false,generation=0,selected='',resumeAt=0,timer=null;
  const clear=()=>{if(timer!==null){cancel(timer);timer=null;}};
  const seen=()=>{try{return seenMemory||env.storage?.getItem(KEY)==='1';}catch{return seenMemory;}};
  function remember(){seenMemory=true;try{env.storage?.setItem(KEY,'1');}catch{}}
  function refresh(){const duration=Number.isFinite(video.duration)&&video.duration>0?video.duration:20,current=Math.max(0,Math.min(duration,video.currentTime||0));progress.style.width=(current/duration*100)+'%';progress.parentElement.setAttribute('aria-valuenow',String(Math.round(current/duration*100)));time.textContent='00:'+String(Math.max(0,Math.ceil(duration-current))).padStart(2,'0');toggle.textContent=wantPlay?'Ⅱ Tạm dừng':(current>0?'▶ Tiếp tục':'▶ Xem giới thiệu');}
  function cleanup(mark){active=false;generation++;clear();wantPlay=false;video.pause();video.removeAttribute('src');video.load();dialog.dataset.playing='false';if(mark)remember();env.onClose?.();}
  function close(){if(!active){if(dialog.open)dialog.close();return;}cleanup(true);if(dialog.open)dialog.close();}
  function watchdog(){clear();if(active&&wantPlay&&!env.document.hidden)timer=schedule(close,8000);}
  function play(){
   if(!active||env.document.hidden)return;wantPlay=true;manualPause=false;refresh();watchdog();const id=generation;
   try{Promise.resolve(video.play()).catch(()=>{if(!active||id!==generation)return;wantPlay=false;manualPause=true;clear();refresh();});}catch{wantPlay=false;manualPause=true;clear();refresh();}
  }
  function load(preserve=false){
   const key=env.portrait.matches?'portrait':'landscape';if(preserve&&key===selected)return;resumeAt=preserve?(video.currentTime||0):0;selected=key;generation++;video.pause();dialog.dataset.playing='false';video.muted=true;video.defaultMuted=true;video.playsInline=true;video.poster=assets[key].poster;video.src=assets[key].video;video.load();refresh();if(wantPlay)play();
  }
  function open(force=false){
   if(active)return true;if(!force&&seen()){if(dialog.open)dialog.close();return false;}
   if(dialog.open)dialog.removeAttribute('open');active=true;wantPlay=!env.reduced.matches;manualPause=!wantPlay;
   try{dialog.showModal();}catch{dialog.setAttribute('open','');}
   load();return true;
  }
  enter.addEventListener('click',close);
  toggle.addEventListener('click',()=>{if(wantPlay){manualPause=true;wantPlay=false;video.pause();clear();refresh();}else play();});
  dialog.addEventListener('close',()=>{if(active)cleanup(true);});
  video.addEventListener('loadedmetadata',()=>{if(!active)return;if(resumeAt>0){video.currentTime=Math.min(resumeAt,Math.max(0,(video.duration||20)-.05));resumeAt=0;}refresh();});
  video.addEventListener('playing',()=>{if(!active)return;dialog.dataset.playing='true';refresh();watchdog();});
  video.addEventListener('timeupdate',()=>{if(!active)return;refresh();watchdog();});
  video.addEventListener('ended',close);video.addEventListener('error',()=>{if(active)close();});
  env.document.addEventListener('visibilitychange',()=>{if(!active)return;if(env.document.hidden){video.pause();clear();}else if(wantPlay&&!manualPause)play();});
  const change=()=>{if(active)load(true);};if(env.portrait.addEventListener)env.portrait.addEventListener('change',change);else env.portrait.addListener?.(change);
  return{open,close,get active(){return active;},get selected(){return selected;}};
 }
 const api={KEY,createPlayer};
 api.init=()=>{const get=id=>document.getElementById(id),dialog=get('rayIntro');if(!dialog)return;let storage;try{storage=sessionStorage;}catch{}
  const player=createPlayer({dialog,video:get('rayIntroVideo'),enter:get('rayIntroEnter'),toggle:get('rayIntroToggle'),progress:get('rayIntroProgress'),time:get('rayIntroTime')},{storage,assets:window.RAY_INTRO_ASSETS||defaults,document,portrait:matchMedia('(orientation: portrait)'),reduced:matchMedia('(prefers-reduced-motion: reduce)'),setTimeout,clearTimeout});
  api.open=()=>player.open(true);api.close=player.close;get('replayIntro')?.addEventListener('click',()=>{get('aboutDialog')?.close();player.open(true);});player.open();
 };
 return api;
});
