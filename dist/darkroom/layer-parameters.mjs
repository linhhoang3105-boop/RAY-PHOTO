/* A readable view of stored layer values; no rendering or state mutation. */
import {defaults as colorDefaults,baseId,displayName} from './preset-rules.mjs';
import {bases} from './preset-bases.mjs';
export const parameters=[];
function group(name,rows){for(const row of rows){const [key,label,scale=100,unit='',neutral=0]=row;parameters.push({key,label,scale,unit,neutral,group:name});}}
group('Cơ bản',[
 ['toneExposure','Phơi sáng',1,' EV'],['toneBrightness','Độ sáng'],['contrast','Tương phản'],['toneHighlights','Vùng sáng'],['toneShadows','Vùng tối'],['toneWhites','Điểm trắng'],['toneBlacks','Điểm đen']
]);
group('Nhóm màu',[
 ['temp','Nhiệt màu'],['tint','Xanh lá · hồng'],['split','Tách tông'],['sat','Độ bão hòa'],['lift','Đen bạc màu']
]);
group('Chất phim',[
 ['rayThuNhat','Độ đậm Thu Nhật'],
 ['flash','Đèn flash'],['sharp','Độ nét'],['glow','Độ bóng'],['kinh','Bóng kính'],['filmExp','Phơi sáng phim'],['halation','Quầng sáng'],['haltint','Màu quầng sáng'],['grain','Hạt phim'],['vignette','Tối góc'],['dust','Bụi & xước'],['ca','Lệch màu viền']
]);
group('Ánh sáng & hiệu ứng',[
 ['nang','Nắng'],['leak','Vệt nắng'],['spark','Lấp lánh'],['nangSize','Kích cỡ nắng',100,'',.75],['nangAspect','Tỷ lệ nắng',1,'',1],['nangAngle','Góc nắng',1,'°'],['nangSat','Độ rực nắng',100,'',1],['leakBandWidth','Kích cỡ vệt nắng',100,'',.3],['leakAspect','Tỷ lệ vệt nắng',1,'',1],['leakAngle','Góc vệt nắng',1,'°'],['leakHue','Màu vệt nắng',1,'°'],['leakSat','Sắc độ vệt nắng',100,'',1],['bgBlur','Độ mờ nền'],['motion','Mờ chuyển động'],['motionAngle','Góc mờ chuyển động',1,'°',-25]
]);
group('Ảnh in',[
 ['paper','Giấy ảnh'],['gloss','Bề mặt bóng'],['soft','Mềm chi tiết'],['ptex','Vân giấy'],['film','Chất ảnh in'],['printClear','Độ trong ảnh in']
]);
group('Sáng/tối vùng',[
 ['toneLocalEV','Phơi sáng vùng',1,' EV'],['toneLocalBrightness','Độ sáng vùng'],['toneLocalWarmth','Sắc ấm vùng'],['toneLocalColorAmount','Đậm màu ánh sáng'],['toneLocalOpacity','Độ đậm hiệu ứng vùng',100,'',1],['toneLocalFeather','Mềm viền vùng sáng',100,'',.55],['toneLocalThickness','Dày / mỏng nét sáng',100,'',.035],['toneLocalCurve','Độ cong nét sáng',100,'',.7],['toneLocalAngle','Góc vùng sáng',1,'°']
]);
group('Bút ánh sáng',[
 ['brushEV','Phơi sáng bút',1,' EV',.6],['brushSize','Cỡ bút ánh sáng',100,'',.12],['brushSoftness','Mềm bút ánh sáng',100,'',.65]
]);
export function formatValue(value,field){const n=Number((value*field.scale).toFixed(4));return(n>0?'+':'')+n+field.unit;}
export const layerTitle=title=>{const value=displayName(title)||'Điều chỉnh';return value==='Tất cả'?'Điều chỉnh':value;};
const shapeNames={ellipse:'Oval',rect:'Chữ nhật',beam:'Tia sáng',line:'Đường thẳng',curve:'Đường cong',freehand:'Vẽ tự do'},sideNames={all:'Toàn ảnh',in:'Trong vùng',out:'Ngoài vùng',off:'Tắt'};
export function regionDescription(p={}){
 const side=sideNames[p.adjustRegion]||'Toàn ảnh',parts=[side];
 if(p.adjustRegion==='in'||p.adjustRegion==='out'){parts.push(shapeNames[p.adjustRegionShape]||'Oval');if(p.adjustRegionShape==='freehand')parts.push((p.adjustRegionStrokes?.length||0)+' nét');parts.push('Mềm viền '+Math.round((p.adjustRegionFeather??.4)*100));}
 for(const s of p.adjustRegionStack||[])if(s.adjustRegion==='in'||s.adjustRegion==='out')parts.push('Giới hạn thêm: '+(sideNames[s.adjustRegion]||s.adjustRegion)+' · '+(shapeNames[s.adjustRegionShape]||'Oval')+(s.adjustRegionShape==='freehand'?' · '+(s.adjustRegionStrokes?.length||0)+' nét':''));
 return parts.join(' · ');
}
export function describeLayer(layer={}, {basePreset,portable=false}={}){
 const p=layer.p||{},base=bases.find(b=>b.id===(basePreset||baseId(p,layer))),baseValues=base?.p||{},rows=[];
 for(const field of parameters){
  // Portable recipes omit neutral values. Photo-only tools live in the full draft.
  if(portable&&['Sáng/tối vùng','Bút ánh sáng'].includes(field.group))continue;
  const value=Number(p[field.key]??colorDefaults[field.key]??field.neutral),baseline=Number(baseValues[field.key]??field.neutral);
  if(!Number.isFinite(value))continue;
  const changed=Math.abs(value-baseline)>.000001,active=Math.abs(value-field.neutral)>.000001;
  rows.push({...field,value,baseline,changed,active,formatted:formatValue(value,field),baseFormatted:formatValue(baseline,field)});
 }
 return{title:layerTitle(layer.title),baseName:base?.names.at(-1)||'Gốc',enabled:layer.enabled!==false,region:regionDescription(p),rows};
}
export function extraParameters(layer){
 const p=layer.p||{},out=[];
 if(p.toneLocalEV||p.toneLocalBrightness||p.toneLocalWarmth||p.toneLocalColorAmount){out.push('Sáng/tối vùng: '+(p.toneLocalEnabled===false?'Đang tắt':(sideNames[p.toneLocalMode]||'Trong vùng'))+' · '+(shapeNames[p.toneLocalShape]||'Oval'));if(p.toneLocalColorAmount)out.push('Màu ánh sáng: '+(p.toneLocalColor||'#ffd18c'));}
 if(p.brushStrokes?.length)out.push('Bút ánh sáng: '+p.brushStrokes.length+' nét đã lưu');
 if(p.nang)out.push('Nguồn nắng: '+Math.round((layer.sun?.x??.5)*100)+'% ngang · '+Math.round((layer.sun?.y??.04)*100)+'% dọc');
 if(p.leak)out.push('Vệt nắng: '+(p.leakShape==='patch'?'Dải':p.leakShape==='oval'?'Oval':'Tròn')+' · '+Math.round((layer.leak?.x??.08)*100)+'% ngang · '+Math.round((layer.leak?.y??.08)*100)+'% dọc');
 return out;
}
export function summarizeLayer(layer){
 const {rows}=describeLayer(layer),active=rows.filter(r=>r.active||r.changed);
 active.sort((a,b)=>Number(b.changed)-Number(a.changed));
 return active.slice(0,2).map(r=>r.label+' '+r.formatted).join(' · ')||'Xem thông số · Các thanh đang ở mức gốc';
}
