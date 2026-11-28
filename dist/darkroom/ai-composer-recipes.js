/* Full Composer recipes stay device-local; portable JSON contains tools and vectors, never photos or AI raster masks. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RayAIComposerRecipes=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const KIND='ray-ai-composer',VERSION=1,MAX_BYTES=8*1024*1024,MAX_COMPONENTS=32,database='ray-photo-ai-composer';
 const styles=['auto-beauty','backlight','restore-detail','film-recovery','natural','cinematic','golden-hour','vintage-film','editorial','soft-dream','moody','creative'];
 const roles=['global','subject','background','light','texture','skin','hair','preset','grade'];
 const ranges={rayThuNhat:[0,1.5],rayNangPho:[0,1.5],temp:[-1,1],tint:[-1,1],split:[-1,1],contrast:[-1,1],sat:[-1,1],lift:[0,1],halation:[0,1],grain:[0,1],vignette:[0,1],leak:[0,1],dust:[0,1],ca:[0,1],flash:[0,1],haltint:[-1,1],glow:[0,1],nang:[0,1],filmExp:[0,1],sharp:[0,1],kinh:[0,1],spark:[0,1],paper:[0,1],gloss:[0,1],soft:[0,1],ptex:[0,1],film:[0,1],printClear:[0,1],dehaze:[0,1],detail:[0,1],bgBlur:[0,1],motion:[0,1],motionAngle:[-180,180],toneExposure:[-2,2],toneBrightness:[-1,1],toneHighlights:[-1,1],toneShadows:[-1,1],toneWhites:[-1,1],toneBlacks:[-1,1],leakAngle:[-180,180],leakBandWidth:[.04,1],leakHue:[-45,75],leakSat:[0,2],nangSat:[0,2],nangSize:[.15,1.4],nangAspect:[.25,4],nangAngle:[-180,180],leakAspect:[.25,4],seed:[0,4294967295],focusAngle:[-180,180],toneLocalEV:[-2,2],toneLocalBrightness:[-1,1],toneLocalWarmth:[-1,1],toneLocalColorAmount:[0,1],toneLocalOpacity:[0,1],toneLocalFeather:[0,1],toneLocalThickness:[.000001,4],toneLocalCurve:[-1,1],toneLocalAngle:[-180,180],brushEV:[-2,2],brushSize:[.015,.5],brushSoftness:[0,1],adjustRegionX:[-4,5],adjustRegionY:[-4,5],adjustRegionRX:[.001,16],adjustRegionRY:[.001,16],adjustRegionAngle:[-180,180],adjustRegionFeather:[0,1],adjustRegionThickness:[.000001,8],adjustRegionCurve:[-1,1]};
 const options={sparkMode:['fine','coarse'],leakShape:['circle','patch','oval'],rgAtmos:['off','in','out'],toneLocalMode:['all','in','out'],toneLocalShape:['ellipse','rect','beam','line','curve'],toneLocalFill:['solid','outline'],brushMode:['paint','erase'],adjustRegion:['all','in','out'],adjustRegionShape:['ellipse','rect','beam','curve','line','freehand'],adjustRegionPaintMode:['paint','erase','lasso']};
 const bools=['toneLocalEnabled','toneLocalShow','lightGuide','nangManual','leakManual','brushShowMask','adjustRegionShow','adjustRegionPlaced','adjustRegionDrawing'];
 const regionKeys=[...Object.keys(ranges).filter(k=>k.startsWith('adjustRegion')),'adjustRegion','adjustRegionShape','adjustRegionStrokes'];
 const parameterKeys=[...Object.keys(ranges),...Object.keys(options),...bools,'toneLocalColor','rayBasePreset','brushStrokes','adjustRegionStrokes','adjustRegionStack'];
 const forbidden=new Set(['__proto__','prototype','constructor']);
 const error=message=>new Error('Công thức AI: '+message);
 function plain(value){if(!value||typeof value!=='object'||Array.isArray(value))return false;const proto=Object.getPrototypeOf(value);return proto===null||Object.getPrototypeOf(proto)===null&&typeof proto.constructor==='function'&&proto.constructor.name==='Object';}
 function keys(value,allowed){if(!plain(value))throw error('cần dữ liệu JSON thuần.');for(const [key,d]of Object.entries(Object.getOwnPropertyDescriptors(value)))if(forbidden.has(key)||!allowed.includes(key)||d.get||d.set)throw error('có trường không được phép: '+key+'.');}
 function text(value,label,max=160){if(typeof value!=='string')throw error(label+' chưa hợp lệ.');const s=value.trim().normalize('NFC');if(!s||[...s].length>max||/[\u0000-\u001f\u007f]/.test(s))throw error(label+' chưa hợp lệ.');return s;}
 function identifier(value,label='mã thành phần'){const id=text(value,label,128);if(!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(id))throw error(label+' chưa hợp lệ.');return id;}
 function num(value,min,max){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw error('thông số nằm ngoài phạm vi hỗ trợ.');return value;}
 function boolean(value){if(typeof value!=='boolean')throw error('trạng thái bật/tắt chưa hợp lệ.');return value;}
 function one(value,allowed){if(!allowed.includes(value))throw error('kiểu công cụ chưa được hỗ trợ.');return value;}
 function point(value){if(!Array.isArray(value)||value.length!==2)throw error('điểm vùng chọn chưa hợp lệ.');return[num(value[0],-16,17),num(value[1],-16,17)];}
 function strokes(value,brush=false){
  if(!Array.isArray(value)||value.length>256)throw error('mỗi vùng chỉ hỗ trợ tối đa 256 nét.');let count=0;
  return value.map(stroke=>{keys(stroke,brush?['mode','size','softness','points']:['mode','size','points','open']);const mode=one(stroke.mode,brush?['paint','erase']:['paint','erase','lasso']);if(!Array.isArray(stroke.points)||!stroke.points.length||stroke.points.length>2048||(count+=stroke.points.length)>8192)throw error('vùng chọn có quá nhiều điểm hoặc thiếu điểm.');
   const out={mode,size:num(stroke.size,brush ? .001 : .000001,brush ? .5 : 4),points:stroke.points.map(point)};
   if(brush)out.softness=num(stroke.softness,0,1);
   if(Object.hasOwn(stroke,'open')){if(mode!=='lasso')throw error('chỉ đường bao mới có trạng thái khép vùng.');out.open=boolean(stroke.open);}return out;
  });
 }
 function params(value,regional=false){
  keys(value,regional?regionKeys:parameterKeys);const out={};
  for(const [key,v]of Object.entries(value)){
   if(ranges[key]){out[key]=num(v,...ranges[key]);if(key==='seed'&&!Number.isInteger(v))throw error('hạt ngẫu nhiên chưa hợp lệ.');}
   else if(options[key])out[key]=one(v,options[key]);
   else if(bools.includes(key))out[key]=boolean(v);
   else if(key==='toneLocalColor'){if(typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v))throw error('màu ánh sáng chưa hợp lệ.');out[key]=v.toLowerCase();}
   else if(key==='rayBasePreset')out[key]=identifier(v,'mã preset');
   else if(key==='brushStrokes')out[key]=strokes(v,true);
   else if(key==='adjustRegionStrokes')out[key]=strokes(v);
   else if(key==='adjustRegionStack'){if(!Array.isArray(v)||v.length>32)throw error('mỗi thành phần chỉ hỗ trợ tối đa 32 vùng lồng nhau.');out[key]=v.map(s=>params(s,true));}
  }return out;
 }
 function pickParameters(value){if(!plain(value))throw error('thông số công cụ chưa hợp lệ.');const out={};for(const key of parameterKeys)if(Object.hasOwn(value,key)){const d=Object.getOwnPropertyDescriptor(value,key);if(d.get||d.set)throw error('thông số công cụ chưa hợp lệ.');out[key]=value[key];}return params(out);}
 function focus(value={cx:.5,cy:.45,rx:.28,ry:.32}){keys(value,['cx','cy','rx','ry']);return{cx:num(value.cx,-4,5),cy:num(value.cy,-4,5),rx:num(value.rx,.001,16),ry:num(value.ry,.001,16)};}
 function anchor(value,defaults){if(value===undefined)value=defaults;keys(value,['x','y']);return{x:num(value.x,-4,5),y:num(value.y,-4,5)};}
 function state(value){keys(value,['p','focus','sun','leak']);return{p:params(value.p||{}),focus:focus(value.focus),sun:anchor(value.sun,{x:.5,y:.04}),leak:anchor(value.leak,{x:.08,y:.08})};}
 function target(value,role){
  if(value===undefined)return{role,adaptive:true};keys(value,['role','adaptive','regionSource','baseline']);const out={role:one(value.role,roles),adaptive:boolean(value.adaptive)};
  if(value.regionSource!==undefined)out.regionSource=one(value.regionSource,['ai','face','estimated','all','manual','none']);
  if(value.baseline!==undefined)out.baseline=state(value.baseline);return out;
 }
 function mix(value){
  keys(value,['version','strength','sources']);if(value.version!==1||!Array.isArray(value.sources)||value.sources.length<1||value.sources.length>3)throw error('phối màu cần từ một đến ba preset.');
  const seen=new Set(),palette=['temp','tint','split','contrast','sat','lift'];
  return{version:1,strength:num(value.strength,0,1),sources:value.sources.map(source=>{keys(source,['id','name','weight','p']);const id=identifier(source.id,'mã preset phối');if(seen.has(id))throw error('preset phối bị trùng.');seen.add(id);keys(source.p,palette);const p={};for(const key of palette)p[key]=num(source.p[key],...ranges[key]);return{id,name:text(source.name,'tên preset phối',120),weight:num(source.weight,0,1),p};})};
 }
 function component(value){
  keys(value,['id','title','role','enabled','p','focus','sun','leak','reason','targetIntent','mix']);const role=one(value.role,roles),out={id:identifier(value.id),title:text(value.title,'tên thành phần',120),role,enabled:value.enabled===undefined?true:boolean(value.enabled),...state({p:value.p||{},focus:value.focus,sun:value.sun,leak:value.leak}),reason:value.reason===undefined||value.reason===''?'':text(value.reason,'giải thích thành phần',800),targetIntent:target(value.targetIntent,role)};
  if(value.mix!==undefined)out.mix=mix(value.mix);
  if(out.targetIntent.role!==role)throw error('vai trò vùng chỉnh không khớp thành phần.');return out;
 }
 const summaryKeys=['mean','median','shadows','highlights','clippedHighlights','clippedShadows','skinCoverage','subjectBrightness','backgroundBrightness','texture','dynamicRange','colorfulness','warmCast','tintCast','p10','p50','p95','p99','skinLuma','skinWarmth','subjectCoverage','lightX','lightY','lightConfidence','dominantHue'];
 function extraSkin(value){
  const metrics=['mean','p10','p90','channelP95','texture','noise','warmCast','tintCast','confidence'];keys(value,['focus','region',...metrics]);keys(value.focus,['cx','cy','rx','ry']);const out={focus:{cx:num(value.focus.cx,0,1),cy:num(value.focus.cy,0,1),rx:num(value.focus.rx,.001,1),ry:num(value.focus.ry,.001,1)}};for(const key of metrics)out[key]=num(value[key],['warmCast','tintCast'].includes(key)?-1:0,1);if(out.p10>out.p90)throw error('phân tích da ngoài mặt chưa hợp lệ.');keys(value.region,regionKeys);out.region=params(value.region);if(out.region.adjustRegion!=='in'||out.region.adjustRegionShape!=='freehand')throw error('vùng da ngoài mặt cần đường bao bên trong.');return out;
 }
 function recovery(value){
  keys(value,['version','faces','zones','personLightVersion','personGuided']);if(value.version!==1||!Array.isArray(value.faces)||value.faces.length>3)throw error('phân tích phục hồi chưa hợp lệ.');
  const metrics=['mean','p10','p90','texture','noise','warmCast','tintCast','confidence'];
  const result={version:1,faces:value.faces.map(face=>{keys(face,['focus',...metrics,'channelP95','region','shadowRegion','extraSkin']);keys(face.focus,['cx','cy','rx','ry']);const box={cx:num(face.focus.cx,0,1),cy:num(face.focus.cy,0,1),rx:num(face.focus.rx,.001,1),ry:num(face.focus.ry,.001,1)},out={focus:box};for(const key of metrics)out[key]=num(face[key],['warmCast','tintCast'].includes(key)?-1:0,1);if(face.channelP95!==undefined)out.channelP95=num(face.channelP95,0,1);if(face.extraSkin!==undefined)out.extraSkin=extraSkin(face.extraSkin);for(const key of ['region','shadowRegion'])if(face[key]!==undefined){keys(face[key],regionKeys);const region=params(face[key]);if(region.adjustRegion!=='in'||region.adjustRegionShape!=='freehand')throw error('vùng da cần đường bao bên trong.');out[key]=region;}if(out.p10>out.p90)throw error('phân tích vùng sáng tối chưa hợp lệ.');return out;})};
  if(value.personGuided!==undefined){if(typeof value.personGuided!=='boolean')throw error('nhận diện vùng người chưa hợp lệ.');result.personGuided=value.personGuided;}
  if(value.personLightVersion!==undefined){if(value.personLightVersion!==1)throw error('phiên bản ánh sáng chủ thể chưa được hỗ trợ.');result.personLightVersion=1;}
  if(value.zones!==undefined){keys(value.zones,['subject','background','clothing']);const fields=['mean','p10','p90','shadowCoverage','highlightCoverage','texture','noise','neutralCoverage','neutralWarmCast','neutralTintCast'];result.zones={};for(const name of ['subject','background',...(value.zones.clothing!==undefined?['clothing']:[])]){const input=value.zones[name],optional=['darkMean','chroma'];keys(input,[...fields,...optional]);const zone={};for(const key of fields)zone[key]=num(input[key],['neutralWarmCast','neutralTintCast'].includes(key)?-1:0,1);for(const key of optional)if(input[key]!==undefined)zone[key]=num(input[key],0,1);if(zone.p10>zone.p90)throw error('phân tích vùng sáng tối chưa hợp lệ.');result.zones[name]=zone;}}
  return result;
 }
 function palette(value){
  const optional=['clouds','vegetation','terrain'];keys(value,['version','sky','land',...optional]);if(value.version!==1)throw error('phân vùng màu chưa được hỗ trợ.');const out={version:1},fields=['confidence','coverage','mean','p10','p90','highlightCoverage','colorfulness','warmCast','tintCast'];
  for(const name of ['sky','land',...optional.filter(name=>Object.hasOwn(value,name))]){const input=value[name];if(input===null){out[name]=null;continue;}keys(input,[...fields,'focus','p']);const zone={};for(const key of fields)zone[key]=num(input[key],['warmCast','tintCast'].includes(key)?-1:0,1);if(zone.p10>zone.p90)throw error('sáng tối vùng màu chưa hợp lệ.');keys(input.focus,['cx','cy','rx','ry']);zone.focus={cx:num(input.focus.cx,0,1),cy:num(input.focus.cy,0,1),rx:num(input.focus.rx,.001,1),ry:num(input.focus.ry,.001,1)};keys(input.p,[...regionKeys,'adjustRegionStack']);zone.p=params(input.p);if(zone.p.adjustRegion!=='in')throw error('vùng màu cần mặt nạ bên trong.');out[name]=zone;}return out;
 }
 function summary(value){keys(value,[...summaryKeys,'recognition','fingerprint','recovery','palette']);const out={};for(const [k,v]of Object.entries(value)){if(k==='palette')out[k]=palette(v);else if(k==='recovery')out[k]=recovery(v);else if(summaryKeys.includes(k))out[k]=num(v,['warmCast','tintCast','skinWarmth'].includes(k)?-1:0,1);else out[k]=text(v,k==='recognition'?'nguồn nhận diện':'mã phân tích',k==='recognition'?80:128);}return out;}
 function preset(value){keys(value,['id','name']);return{id:identifier(value.id,'mã preset'),name:text(value.name,'tên preset',120)};}
 const bytes=value=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value)).length;
 function validate(value){
  keys(value,['kind','version','name','style','seed','intensity','components','basePreset','analysis']);if(value.kind!==KIND||value.version!==VERSION)throw error('phiên bản chưa được hỗ trợ.');if(!Array.isArray(value.components)||value.components.length>MAX_COMPONENTS)throw error('hỗ trợ tối đa '+MAX_COMPONENTS+' thành phần.');
  const seed=num(value.seed,0,4294967295);if(!Number.isInteger(seed))throw error('hạt ngẫu nhiên chưa hợp lệ.');
  const out={kind:KIND,version:VERSION,name:text(value.name,'tên công thức',80),style:one(value.style,styles),seed,intensity:num(value.intensity,0,100),basePreset:preset(value.basePreset),components:value.components.map(component)};
  const ids=new Set();for(const item of out.components){if(ids.has(item.id))throw error('mã thành phần bị trùng.');ids.add(item.id);}
  if(value.analysis!==undefined)out.analysis=summary(value.analysis);if(bytes(out)>MAX_BYTES)throw error('vượt dung lượng lưu trên thiết bị; các chỉnh sửa đang mở vẫn được giữ.');return out;
 }
 function create(plan,{name=plan?.title||'Công thức AI',intensity=100}={}){if(!plain(plan))throw error('phương án phối chưa hợp lệ.');return validate({kind:KIND,version:VERSION,name,style:plan.style,seed:plan.seed,intensity,components:plan.components,basePreset:plan.basePreset,...(plan.analysis?{analysis:plan.analysis}:{})});}
 const encode=value=>JSON.stringify(validate(value),null,2);
 function decode(value){if(typeof value!=='string'||bytes(value)>MAX_BYTES)throw error('tệp JSON quá lớn hoặc chưa hợp lệ.');let input;try{input=JSON.parse(value.replace(/^\uFEFF/,''));}catch{throw error('chưa đọc được tệp JSON.');}return validate(input);}
 function storageError(value){if(value?.name==='QuotaExceededError')return error('thiết bị đã đầy. Công thức đang chỉnh vẫn còn; bạn có thể xuất JSON về máy.');return value instanceof Error?value:error('chưa mở được kho trên thiết bị. Công thức đang chỉnh vẫn được giữ.');}
 function store(factory=globalThis.indexedDB){
  let pending;
  function open(){if(pending)return pending;if(!factory?.open)return Promise.reject(storageError());let settled=false;pending=new Promise((resolve,reject)=>{let r;const fail=e=>{if(settled)return;settled=true;pending=null;reject(storageError(e));};try{r=factory.open(database,1);}catch(e){fail(e);return;}
   r.onupgradeneeded=()=>{try{if(!r.result.objectStoreNames.contains('presets'))r.result.createObjectStore('presets',{keyPath:'id'});}catch(e){try{r.transaction?.abort();}catch{}fail(e);}};r.onerror=()=>fail(r.error);r.onblocked=()=>fail(error('đóng tab RAY PHOTO cũ rồi thử lưu lại.'));r.onsuccess=()=>{const db=r.result;if(settled){db.close();return;}settled=true;db.onversionchange=()=>{db.close();pending=null;};resolve(db);};}).catch(e=>{pending=null;throw e;});return pending;}
  async function run(mode,action){const db=await open();return new Promise((resolve,reject)=>{let tx,result,settled=false;const fail=e=>{if(!settled){settled=true;reject(storageError(e));}};try{tx=db.transaction('presets',mode);tx.oncomplete=()=>{if(!settled){settled=true;resolve(result);}};tx.onabort=tx.onerror=e=>fail(tx.error||e?.target?.error);action(tx.objectStore('presets'),v=>{result=v;});}catch(e){try{tx?.abort();}catch{}fail(e);}});}
  const request=(mode,action)=>run(mode,(s,done)=>{const r=action(s);r.onsuccess=()=>done(r.result);});
  const id=value=>identifier(value,'mã công thức');
  return{open,async all(){const list=await request('readonly',s=>s.getAll());return list.map(row=>({...row,recipe:validate(row.recipe)})).sort((a,b)=>b.updated-a.updated);},async get(value){const row=await request('readonly',s=>s.get(id(value)));return row?{...row,recipe:validate(row.recipe)}:undefined;},remove:value=>request('readwrite',s=>s.delete(id(value))),async put(input){
   if(input?.kind===KIND)input={recipe:input};keys(input,['id','name','recipe','created','updated']);const recipe=validate(input.recipe);if(input.name!==undefined)recipe.name=text(input.name,'tên công thức',80);
   if(input.updated!==undefined)num(input.updated,0,8640000000000000);
   const now=Date.now(),next={id:input.id===undefined?(globalThis.crypto?.randomUUID?.()||'ai-'+now.toString(36)+'-'+Math.random().toString(36).slice(2)):id(input.id),name:recipe.name,recipe,created:input.created===undefined?now:num(input.created,0,8640000000000000),updated:now};
   return run('readwrite',(s,done)=>{const r=s.get(next.id);r.onsuccess=()=>{const value={...next,created:r.result?.created??next.created},write=s.put(value);write.onsuccess=()=>done({...value,recipe:validate(value.recipe)});};});
  }};
 }
 return{KIND,VERSION,MAX_BYTES,MAX_COMPONENTS,database,styles:styles.slice(),limits:Object.fromEntries(Object.entries(ranges).map(([k,v])=>[k,v.slice()])),parameterKeys:parameterKeys.slice(),validate,create,pickParameters,encode,decode,store};
});
