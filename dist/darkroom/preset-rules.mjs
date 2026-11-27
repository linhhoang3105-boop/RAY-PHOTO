/* Portable recipes contain color values and vector selections, never photo pixels or AI masks. */
import {bases} from './preset-bases.mjs';
export const VERSION=1,MAX_LAYERS=32,MAX_BYTES=1024*1024,MAX_LOCAL_BYTES=16*1024*1024;
const byteLength=value=>new TextEncoder().encode(JSON.stringify(value)).length;
const ranges={rayThuNhat:[0,1.5],rayNangPho:[0,1.5],temp:[-1,1],tint:[-1,1],split:[-1,1],contrast:[-1,1],sat:[-1,1],lift:[0,1],halation:[0,1],grain:[0,1],vignette:[0,1],leak:[0,1],dust:[0,1],ca:[0,1],flash:[0,1],haltint:[-1,1],glow:[0,1],nang:[0,1],filmExp:[0,1],sharp:[0,1],kinh:[0,1],spark:[0,1],paper:[0,1],gloss:[0,1],soft:[0,1],ptex:[0,1],film:[0,1],printClear:[0,1],dehaze:[0,1],detail:[0,1],toneExposure:[-2,2],toneBrightness:[-1,1],toneHighlights:[-1,1],toneShadows:[-1,1],toneWhites:[-1,1],toneBlacks:[-1,1],leakAngle:[-180,180],leakBandWidth:[.04,1],leakHue:[-45,75],leakSat:[0,2],nangSat:[0,2],nangSize:[.15,1.4],nangAspect:[.25,4],nangAngle:[-180,180],leakAspect:[.25,4],seed:[0,4294967295]};
Object.assign(ranges,{adjustRegionX:[-4,5],adjustRegionY:[-4,5],adjustRegionRX:[.001,16],adjustRegionRY:[.001,16],adjustRegionAngle:[-180,180],adjustRegionFeather:[0,1],adjustRegionThickness:[.000001,8],adjustRegionCurve:[-1,1]});
const options={sparkMode:['fine','coarse'],leakShape:['circle','patch','oval'],adjustRegion:['all','in','out'],adjustRegionShape:['ellipse','rect','beam','curve','line','freehand']};
const regionKeys=[...[...Object.keys(ranges),...Object.keys(options)].filter(k=>k.startsWith('adjustRegion')),'adjustRegionStrokes'];
export const defaults=Object.fromEntries(Object.keys(ranges).map(k=>[k,0]));Object.assign(defaults,{leakBandWidth:.3,leakSat:1,nangSat:1,nangSize:.75,nangAspect:1,leakAspect:1,seed:1234,sparkMode:'fine',leakShape:'circle',adjustRegion:'all',adjustRegionShape:'ellipse',adjustRegionX:.5,adjustRegionY:.5,adjustRegionRX:.32,adjustRegionRY:.32,adjustRegionFeather:.4,adjustRegionThickness:.06,adjustRegionCurve:.7});
const effectKeys=Object.keys(ranges).filter(k=>!k.startsWith('adjustRegion')&&!['seed','haltint','leakAngle','leakBandWidth','leakHue','leakSat','nangSat','nangSize','nangAspect','nangAngle','leakAspect'].includes(k));
export const printKeys=['paper','gloss','soft','ptex','film','printClear'];
const byId=new Map(bases.map(b=>[b.id,b])),byName=new Map(bases.flatMap(b=>b.names.map(n=>[n,b.id])));
export const displayName=title=>byId.get(byName.get(title))?.names.at(-1)||title;
export function baseId(p={},meta={}){
 const declared=meta.basePreset||p.rayBasePreset||byName.get(meta.title);if(byId.has(declared))return declared;
 // Old drafts have no provenance field. Recognize an exact existing preset, never an arbitrary print adjustment.
 const found=bases.find(b=>effectKeys.every(k=>Math.abs(Number(p[k]??0)-Number(b.p[k]??0))<.000001));return found?.id||'goc';
}
const printBase=(p,meta)=>byId.get(baseId(p,meta))?.p||{};
export const printAdvanced=(p={},meta={})=>{const base=printBase(p,meta);return printKeys.some(k=>Math.abs(Number(p[k]??0)-Number(base[k]??0))>.00001);};
export const stateAdvanced=(p={},meta={})=>printAdvanced(p,meta)||brushActive(p)||(p.toneLocalEnabled!==false&&Number(p.toneLocalOpacity??1)>.00001&&['toneLocalEV','toneLocalBrightness','toneLocalWarmth','toneLocalColorAmount'].some(k=>Math.abs(Number(p[k])||0)>.00001))||['bgBlur','motion'].some(k=>Math.abs(Number(p[k])||0)>.00001)||!!p.rgAtmos&&p.rgAtmos!=='off';
const plain=o=>!!o&&typeof o==='object'&&!Array.isArray(o)&&(Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
function keys(o,allowed){if(!plain(o)||Object.keys(o).some(k=>!allowed.includes(k)))throw new Error('Công thức chứa trường không được phép. Chỉ nhập mã màu của RAY PHOTO.');}
function number(value,min,max){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error('Thông số màu nằm ngoài phạm vi được hỗ trợ.');return value;}
function regionStrokes(value){
 if(!Array.isArray(value)||value.length>256)throw new Error('Vùng vẽ có tối đa 256 nét.');let total=0;
 return value.map(s=>{keys(s,['mode','size','points','open']);if(Object.hasOwn(s,'open')&&(s.mode!=='lasso'||typeof s.open!=='boolean'))throw new Error('Vùng vẽ có đường bao chưa khép không hợp lệ.');if(!['paint','lasso','erase'].includes(s.mode)||!Array.isArray(s.points)||!s.points.length||s.points.length>2048||(total+=s.points.length)>8192)throw new Error('Nét vùng vẽ không hợp lệ hoặc quá dài.');return{mode:s.mode,size:number(s.size,.000001,4),...(Object.hasOwn(s,'open')?{open:s.open}:{}),points:s.points.map(p=>{if(!Array.isArray(p)||p.length!==2)throw new Error('Điểm vẽ vùng không hợp lệ.');return[number(p[0],-16,17),number(p[1],-16,17)];})};});
}
function regionStack(value){if(!Array.isArray(value)||value.length>32)throw new Error('Một lớp màu có tối đa 32 vùng lồng nhau.');return value.map(s=>{keys(s,regionKeys);const out={};for(const [k,v]of Object.entries(s)){if(k==='adjustRegionStrokes')out[k]=regionStrokes(v);else if(ranges[k])out[k]=number(v,...ranges[k]);else{if(!options[k].includes(v))throw new Error('Kiểu vùng không hợp lệ.');out[k]=v;}}return out;});}
export function nameOf(value){if(typeof value!=='string')throw new Error('Hãy đặt tên công thức.');const name=value.trim().normalize('NFC');if(!name||[...name].length>48||/[\u0000-\u001f\u007f]/.test(name))throw new Error('Tên màu cần từ 1 đến 48 ký tự.');return name;}
export function validate(input){
 keys(input,['version','name','layers','tools','layerMeta']);if(input.version!==VERSION)throw new Error('Phiên bản công thức này chưa được hỗ trợ.');
 if(!Array.isArray(input.layers)||input.layers.length>MAX_LAYERS)throw new Error('Một công thức có tối đa 32 lớp màu. Nháp ảnh đầy đủ vẫn được giữ.');
 const layers=input.layers.map(p=>{keys(p,[...Object.keys(ranges),...Object.keys(options),'adjustRegionStack','adjustRegionStrokes']);const out={};for(const [k,v]of Object.entries(p)){if(k==='adjustRegionStack')out[k]=regionStack(v);else if(k==='adjustRegionStrokes')out[k]=regionStrokes(v);else if(ranges[k])out[k]=number(v,...ranges[k]);else{if(!options[k].includes(v))throw new Error('Kiểu hiệu ứng không hợp lệ.');out[k]=v;}}return out;});
 const out={version:VERSION,name:nameOf(input.name),layers};
 if(input.layerMeta!==undefined){if(!Array.isArray(input.layerMeta)||input.layerMeta.length!==layers.length)throw new Error('Công thức cần thông tin cho từng lớp màu.');out.layerMeta=input.layerMeta.map(m=>{keys(m,['title','enabled','basePreset']);if(typeof m.title!=='string'||!m.title.trim()||[...m.title].length>80||/[\u0000-\u001f\u007f]/.test(m.title)||typeof m.enabled!=='boolean'||!byId.has(m.basePreset))throw new Error('Thông số lớp màu không hợp lệ.');return{title:m.title.normalize('NFC'),enabled:m.enabled,basePreset:m.basePreset};});}
 if(input.tools!==undefined){keys(input.tools,['brush']);if(input.tools.brush!==undefined){const b=input.tools.brush;keys(b,['ev','size','softness']);out.tools={brush:{ev:number(b.ev,-2,2),size:number(b.size,.015,.5),softness:number(b.softness,0,1)}};}}
 if(byteLength(out)>MAX_LOCAL_BYTES)throw new Error('Công thức vượt dung lượng lưu màu trên thiết bị. Nháp ảnh đầy đủ vẫn được giữ.');return out;
}
// Device-local saving must not depend on the separate size budget for a shared code.
export function validateShared(input){const recipe=validate(input);if(byteLength(recipe)>MAX_BYTES)throw new Error('Công thức vượt dung lượng tạo mã chia sẻ. Màu và nháp đã lưu trên thiết bị vẫn dùng được.');return recipe;}
export const advanced=recipe=>{const r=validate(recipe);return!!r.tools?.brush||r.layers.some((p,i)=>printAdvanced(p,r.layerMeta?.[i]));};
export function basicState(p={},meta={}){const out={...p},base=printBase(p,meta);for(const k of printKeys)out[k]=Number(base[k]??0);Object.assign(out,{brushStrokes:[],brushShowMask:false,bgBlur:0,motion:0,rgAtmos:'off',toneLocalEV:0,toneLocalBrightness:0,toneLocalWarmth:0,toneLocalColorAmount:0});return out;}
const hasColor=p=>effectKeys.some(k=>Math.abs(Number(p?.[k])||0)>.001);
export function basicLayer(layer){const p=basicState(layer.p,layer);return stateAdvanced(layer.p,layer)&&!hasColor(p)?null:{...layer,p};}
export function basicRecipe(recipe){const out=validate(recipe),kept=[];out.layers=out.layers.map((p,i)=>{const clean={...p},base=printBase(p,out.layerMeta?.[i]);for(const k of printKeys)if(k in clean)clean[k]=Number(base[k]??0);if(printAdvanced(p,out.layerMeta?.[i])&&!hasColor(clean))return null;kept.push(i);return clean;}).filter(Boolean);if(out.layerMeta)out.layerMeta=kept.map(i=>out.layerMeta[i]);delete out.tools;return out;}
export const brushActive=p=>Math.abs(Number(p?.brushEV)||0)>.00001&&Array.isArray(p?.brushStrokes)&&p.brushStrokes.some(s=>s?.mode!=='erase'&&s?.points?.length);
export const projectAdvanced=snapshot=>stateAdvanced(snapshot?.p,{title:snapshot?.preset})||(snapshot?.layers||[]).some(s=>s.enabled!==false&&stateAdvanced(s.p,s));
export function color(p){const out={},scoped=p?.adjustRegion==='in'||p?.adjustRegion==='out';for(const k of Object.keys(defaults)){if(k.startsWith('adjustRegion')&&!scoped)continue;const value=p?.[k]??defaults[k],normalized=k==='seed'?(Number(value)>>>0):value;if(normalized!==defaults[k])out[k]=normalized;}if(scoped&&p.adjustRegionShape==='freehand')out.adjustRegionStrokes=regionStrokes(p.adjustRegionStrokes||[]);const stack=(p?.adjustRegionStack||[]).filter(s=>s.adjustRegion==='in'||s.adjustRegion==='out');if(stack.length)out.adjustRegionStack=regionStack(stack).map(s=>Object.fromEntries(Object.entries(s).filter(([key,value])=>value!==defaults[key])));return out;}
export function capture(snapshot,name){
 const states=[...(snapshot.layers||[]),{p:snapshot.p,title:snapshot.presetTitle||snapshot.preset}],retained=states.filter(s=>effectKeys.some(k=>Math.abs(Number(s.p?.[k])||0)>.001)),layers=retained.map(s=>color(s.p));
 const layerMeta=retained.map(s=>{const id=baseId(s.p,s);return{title:String(s.title||byId.get(id)?.names.at(-1)||'Điều chỉnh').slice(0,80),enabled:s.enabled!==false,basePreset:id};});
 const recipe={version:VERSION,name,layers,layerMeta},brush=states.filter(s=>s.enabled!==false&&brushActive(s.p)).at(-1)?.p;if(brush)recipe.tools={brush:{ev:brush.brushEV,size:brush.brushSize,softness:brush.brushSoftness}};return validate(recipe);
}
export function stripSnapshot(s,keyOf){
 const out={...s,p:basicState(s.p,{title:s.preset}),layers:(s.layers||[]).map(basicLayer).filter(Boolean)};out.key=keyOf(out);return out;
}
export function basicDraft(state,keyOf){
 const remap=new Map(),convert=s=>{if(!s)return s;const out=stripSnapshot(s,keyOf);remap.set(s.key,out.key);return out;};
 const history={...state.history,entries:state.history.entries.map(e=>({...e,snapshot:convert(e.snapshot)}))},stageBase=convert(state.stageBase),current=convert(state.current);
 return{...state,history,stageBase,...(current?{current}:{}),appliedKey:remap.get(state.appliedKey)||stageBase?.key||'',variant:'basic'};
}
export function cleanCode(value){const code=String(value).replace(/[\s-]/g,'');if(!/^\d{8}$/.test(code))throw new Error('Mã màu gồm 8 chữ số.');return code;}
