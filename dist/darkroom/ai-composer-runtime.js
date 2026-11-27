/* Transactional orchestration only. All pixels are rendered by the existing RAY engines. */
(function(root,factory){
 const api=factory(()=>typeof module==='object'&&module.exports?require('./ai-composer-core.js'):root.RayAIComposerCore,()=>typeof module==='object'&&module.exports?require('./ai-composer-recipes.js'):root.RayAIComposerRecipes);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.RayAIComposerRuntime=api;
})(typeof globalThis!=='undefined'?globalThis:this,(getCore,getRecipes)=>{
 'use strict';
 const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
 function stable(value){
  const sort=v=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;
  return JSON.stringify(sort(value));
 }
 function create(host,dependencies={}){
  for(const key of ['getSource','readImage','capture','restore','paint'])if(typeof host?.[key]!=='function')throw Error('Thiếu kết nối AI Composer: '+key);
  const core=dependencies.core||getCore(),recipes=dependencies.recipes||getRecipes();
  if(!core||!recipes)throw Error('AI Composer chưa tải đủ mô-đun.');
  let photo=null,base=null,lastPaint=null,checkpoint=null,checkpointState=null,ticket=0,analysisPromise=null,analysisCache=null,faceScanAttempted=false,writing=false,recorded=false;
  const state={style:core.STYLES?.[0]?.id||'auto-beauty',seed:(Number(host.seed)>>>0)||1234,variants:[],selected:0,intensity:100,busy:false,status:'Mở ảnh rồi chọn phong cách để AI phối.',active:false,applied:false,analysis:null,error:null,comparing:false};
  const snapshot=()=>clone(state),emit=()=>{try{host.onChange?.(snapshot());}catch(error){host.onError?.(error);}};
  const currentPlan=()=>state.variants[state.selected]||null;
  const canonicalState=()=>clone(Object.fromEntries(['style','seed','variants','selected','intensity','analysis','active','applied','comparing'].map(key=>[key,state[key]])));
  function resetForPhoto(next){
   ticket++;photo=next;base=lastPaint=checkpoint=checkpointState=null;analysisPromise=analysisCache=null;faceScanAttempted=false;recorded=false;
   Object.assign(state,{variants:[],selected:0,intensity:100,busy:false,active:false,applied:false,analysis:null,error:null,comparing:false,status:next?'Chọn phong cách để AI phân tích ảnh gốc.':'Mở ảnh rồi chọn phong cách để AI phối.'});
  }
  function observeSource(){const next=host.getSource();if(next!==photo){resetForPhoto(next);return false;}return true;}
  function releaseExternal(){
   ticket++;base=lastPaint=checkpoint=checkpointState=null;recorded=false;
   Object.assign(state,{variants:[],selected:0,busy:false,active:false,applied:false,comparing:false,error:null,status:'Đã giữ chỉnh sửa bên ngoài Composer. Bấm phối lại để bắt đầu từ trạng thái hiện tại.'});emit();
  }
  function ownership(){
   if(writing||!base||lastPaint===null)return true;
   if(stable(host.capture())===lastPaint)return true;
   releaseExternal();return false;
  }
  function available({begin=false}={}){
   observeSource();
   if(!photo){state.error='Mở một ảnh trước khi dùng AI Composer.';state.status=state.error;emit();return false;}
   if(!ownership())return false;
   if(host.busy?.()){state.status='Đợi bước chỉnh ảnh đang xử lý xong rồi dùng AI Composer.';emit();return false;}
   if(begin&&!base){base=clone(host.capture());lastPaint=stable(base);checkpoint=clone(base);checkpointState=null;recorded=false;}
   return true;
  }
  function still(job,image){return job===ticket&&image===photo&&image===host.getSource();}
  function guard(job,image){
   if(!still(job,image)){if(image!==host.getSource()){observeSource();emit();}return false;}
   return ownership();
  }
  function write(action){
   const before=clone(host.capture());writing=true;
   try{action();lastPaint=stable(host.capture());}
   catch(error){if(photo===host.getSource()){host.restore(before);lastPaint=stable(host.capture());}throw error;}
   finally{writing=false;}
  }
  function noteBefore(){if(!recorded){host.record?.('Trước AI Composer');recorded=true;}}
  function paint({keepApplied=false}={}){
   const plan=currentPlan();if(!plan||!base)return false;
   noteBefore();const scaled=core.scale(plan,state.intensity),components=scaled.components||[];
   write(()=>{if(state.intensity===0||!components.some(c=>c.enabled!==false))host.restore(clone(base));else host.paint(clone(base),clone(components),clone(scaled));});
   state.active=true;state.comparing=false;if(!keepApplied)state.applied=false;return true;
  }
  function readyStatus(prefix='Đã phối ảnh'){
   return prefix+(state.analysis?.recognition==='estimated'?' · vùng xử lý đang được ước lượng từ ảnh.':' · có thể chỉnh từng thành phần.');
  }
  async function analyzePhoto(image,job,needFaces=false){
   const requestFaces=needFaces&&!faceScanAttempted;
   if(analysisCache&&!requestFaces)return analysisCache;
   if(analysisPromise&&requestFaces){const pending=analysisPromise,result=await pending;if(!still(job,image)||faceScanAttempted)return result;if(analysisPromise!==pending)return analyzePhoto(image,job,needFaces);analysisPromise=analysisCache=null;}
   if(analysisCache)return analysisCache;
   if(!analysisPromise)analysisPromise=(async()=>{
    const pixels=await host.readImage(image);if(!pixels?.data||!pixels.width||!pixels.height)throw Error('Chưa đọc được ảnh gốc để phân tích.');
    let recognition=null,estimated=false;
    try{recognition=await host.getExistingRecognition?.(image);if(recognition?.source&&recognition.source!==image)recognition=null;}catch{}
    if(recognition?.faces?.length&&image===photo&&image===host.getSource())faceScanAttempted=true;
    if(!recognition?.maps&&!recognition?.faces?.length||needFaces&&!recognition?.faces?.length&&!faceScanAttempted){
     if(image===photo&&image===host.getSource())faceScanAttempted=true;
     try{const fresh=await host.recognize?.(image,message=>{if(still(job,image)){state.status=String(message||'Đang nhận diện vùng ảnh…');emit();}});if(fresh)recognition={...recognition,...fresh,maps:fresh.maps||recognition?.maps,faces:fresh.faces?.length?fresh.faces:recognition?.faces||[]};}catch{estimated=!recognition?.maps&&!recognition?.faces?.length;}
    }
    if(!recognition?.maps&&!recognition?.faces?.length)estimated=true;
    const result=core.analyze(pixels.data,pixels.width,pixels.height,{...(recognition||{}),...(pixels.detail?{detail:pixels.detail}:{})});
    if(estimated&&result.recognition!=='face'&&result.recognition!=='ai')result.recognition='estimated';
    if(image===photo&&image===host.getSource())analysisCache=result;
    return result;
   })().catch(error=>{if(image===photo)analysisPromise=null;throw error;});
   return analysisPromise;
  }
  function fail(error,job,image){
   if(!still(job,image)){if(image!==host.getSource()){observeSource();emit();}return false;}
   state.busy=false;state.error=String(error?.message||error||'Chưa phối được ảnh.');state.status=state.error;emit();return false;
  }
  async function compose(style=state.style){
   if(!available({begin:true}))return false;
   const image=photo,job=++ticket,prior=canonicalState();Object.assign(state,{busy:true,error:null,status:'Đang phân tích ảnh gốc và phối phương án…'});emit();
   try{
    const analysis=await analyzePhoto(image,job,['backlight','restore-detail','film-recovery'].includes(style));if(!guard(job,image))return false;
    const seed=(state.seed+1)>>>0,count=Math.max(3,Math.min(5,Math.round(Number(host.variantCount)||4))),variants=core.generate(analysis,{style,seed,count,presets:host.presets?.()||[]});
    if(!Array.isArray(variants)||variants.length<3||variants.length>5)throw Error('AI chưa tạo đủ phương án phối ảnh.');
    Object.assign(state,{style,seed,variants:clone(variants),selected:0,analysis:clone(analysis)});
    paint();state.busy=false;state.status=readyStatus();emit();return true;
   }catch(error){if(still(job,image))Object.assign(state,prior);return fail(error,job,image);}
  }
  function edit(action){
   if(!available()||state.busy||!currentPlan())return false;
   const before={variants:clone(state.variants),selected:state.selected,intensity:state.intensity};
   try{action();paint();state.error=null;state.status=readyStatus('Đã cập nhật phối ảnh');emit();return true;}
   catch(error){Object.assign(state,before);state.error=String(error.message||error);state.status=state.error;emit();return false;}
  }
  function select(index){
   index=Number(index);if(!Number.isInteger(index)||index<0||index>=state.variants.length)return false;
   return edit(()=>{state.selected=index;});
  }
  function setIntensity(value){
   value=Number(value);if(!Number.isFinite(value))return false;value=Math.max(0,Math.min(100,value));
   return edit(()=>{state.intensity=value;});
  }
  function checked(plan){
   if(!plan.components.length)return plan;
   const recipe=recipes.create(plan,{name:plan.title||'AI Composer',intensity:state.intensity});
   return {...plan,components:clone(recipe.components)};
  }
  function setComponent(id,patch){
   if(!patch||typeof patch!=='object'||Array.isArray(patch))return false;
   const allowed=['p','focus','sun','leak','enabled','title','reason','targetIntent','mix'];if(Object.keys(patch).some(k=>!allowed.includes(k)))return false;
   if(!currentPlan()?.components.some(c=>c.id===id))return false;
   return edit(()=>{
    const plan=clone(currentPlan());plan.components=plan.components.map(component=>{
     if(component.id!==id)return component;const out={...component,...clone(patch)};
     for(const key of ['p','focus','sun','leak'])if(patch[key])out[key]={...component[key],...clone(patch[key])};
     return out;
    });state.variants[state.selected]=checked(plan);
   });
  }
  function setMix(id,patch){
   if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(key=>!['strength','sourceIndex','weight'].includes(key))||!Object.keys(patch).length)return false;
   const current=currentPlan()?.components.find(c=>c.id===id);if(!current?.mix||typeof core.mixParameters!=='function')return false;
   if(Object.hasOwn(patch,'strength')&&(typeof patch.strength!=='number'||!Number.isFinite(patch.strength)||patch.strength<0||patch.strength>1))return false;
   const hasSource=Object.hasOwn(patch,'sourceIndex'),hasWeight=Object.hasOwn(patch,'weight');
   if(hasSource!==hasWeight||hasSource&&(!Number.isInteger(patch.sourceIndex)||patch.sourceIndex<0||patch.sourceIndex>=current.mix.sources.length||typeof patch.weight!=='number'||!Number.isFinite(patch.weight)||patch.weight<0||patch.weight>1))return false;
   const mix=clone(current.mix);if(Object.hasOwn(patch,'strength'))mix.strength=patch.strength;if(hasSource)mix.sources[patch.sourceIndex].weight=patch.weight;
   const before=core.mixParameters(current.mix),after=core.mixParameters(mix),p={};
   for(const key of ['temp','tint','split','contrast','sat','lift']){const [min,max]=recipes.limits[key];p[key]=+Math.max(min,Math.min(max,(Number(current.p[key])||0)+(after[key]||0)-(before[key]||0))).toFixed(6);}
   return setComponent(id,{mix,p});
  }
  function toggle(id){const component=currentPlan()?.components.find(c=>c.id===id);return component?setComponent(id,{enabled:component.enabled===false}):false;}
  function remove(id){if(!currentPlan()?.components.some(c=>c.id===id))return false;return edit(()=>{const plan=clone(currentPlan());plan.components=plan.components.filter(c=>c.id!==id);state.variants[state.selected]=checked(plan);});}
  function compare(on){
   if(!available()||state.busy||!base||!currentPlan())return false;
   try{if(on)write(()=>host.restore(clone(base)));else paint({keepApplied:true});state.comparing=!!on;emit();return true;}
   catch(error){state.error=String(error.message||error);state.status=state.error;emit();return false;}
  }
  function apply(){
   if(!available()||state.busy||!currentPlan())return false;
   try{
    if(state.comparing)paint({keepApplied:true});host.record?.('Áp dụng AI Composer');
    checkpoint=clone(host.capture());checkpointState={style:state.style,seed:state.seed,variants:clone(state.variants),selected:state.selected,intensity:state.intensity,analysis:clone(state.analysis)};
    lastPaint=stable(checkpoint);state.applied=true;state.active=true;state.status='Đã áp dụng AI Composer. Vẫn có thể chỉnh hoặc phối lại.';emit();return true;
   }catch(error){state.error=String(error.message||error);state.status=state.error;emit();return false;}
  }
  function cancel(){
   if(!observeSource()){emit();return false;}if(!ownership())return false;
   ticket++;state.busy=false;
   if(!base){emit();return false;}
   try{
    write(()=>host.restore(clone(checkpoint||base)));
    if(checkpointState){Object.assign(state,clone(checkpointState),{active:true,applied:true,comparing:false,error:null,status:'Đã trở lại công thức AI đã áp dụng.'});}
    else{Object.assign(state,{variants:[],selected:0,active:false,applied:false,comparing:false,error:null,status:'Đã trở lại trước khi phối AI.'});base=lastPaint=checkpoint=checkpointState=null;recorded=false;}
    emit();return true;
   }catch(error){state.error=String(error.message||error);state.status=state.error;emit();return false;}
  }
  function recipe(name){
   if(!available()||!currentPlan()?.components.length)throw Error('Chưa có công thức AI để lưu.');
   return recipes.create(clone(currentPlan()),{name:name||currentPlan().title||'AI Composer',intensity:state.intensity});
  }
  async function loadRecipe(input,{adapt=true}={}){
   const saved=recipes.validate(input);if(!available({begin:true}))return false;
   const image=photo,job=++ticket,prior=canonicalState();Object.assign(state,{busy:true,error:null,status:adapt?'Đang thích ứng công thức với ảnh gốc…':'Đang mở công thức AI…'});emit();
   try{
    const analysis=adapt?await analyzePhoto(image,job,['backlight','restore-detail','film-recovery'].includes(saved.style)):state.analysis;if(!guard(job,image))return false;
    const plan=adapt?{...core.adapt(saved,analysis,{presets:host.presets?.()||[],seed:saved.seed}),title:saved.name}:{version:1,id:'saved-'+saved.seed,style:saved.style,seed:saved.seed,title:saved.name,basePreset:clone(saved.basePreset),analysis:clone(saved.analysis||{}),components:clone(saved.components)};
    const amount=Number(saved.intensity);
    Object.assign(state,{style:saved.style,seed:saved.seed,variants:[clone(plan)],selected:0,intensity:Number.isFinite(amount)?Math.max(0,Math.min(100,amount)):100,analysis:clone(analysis||saved.analysis||{})});
    paint();state.busy=false;state.status=readyStatus(adapt?'Đã thích ứng công thức':'Đã mở công thức');emit();return true;
   }catch(error){if(still(job,image))Object.assign(state,prior);return fail(error,job,image);}
  }
  function sync(){const same=observeSource();if(!same){emit();return false;}return ownership();}
  return{get state(){return snapshot();},snapshot,compose,reroll:()=>compose(state.style),select,setIntensity,setComponent,setMix,toggle,remove,compare,apply,cancel,recipe,loadRecipe,sync};
 }
 return{create};
});
