const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const Layers=require('../dist/darkroom/effect-layers.js');
test('the standalone layer inspector opens and edits saved values without the personal recipe module',()=>{
 const nodes=[];
 class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.dataset={};this.events={};this.textContent='';nodes.push(this);}
  append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}
  setAttribute(k,v){this.attrs[k]=v;}addEventListener(k,fn){this.events[k]=fn;}
  showModal(){this.open=true;}close(){this.open=false;this.events.close?.();}
 }
 const document={createElement:tag=>new Element(tag),body:new Element('body')},original={id:'a',title:'Màu phim',enabled:false,p:{toneExposure:.65,toneBrightness:-.12,temp:.34,sat:.16,grain:.24,rayBasePreset:'ngocdiep',adjustRegion:'out',adjustRegionShape:'freehand',adjustRegionStrokes:[{mode:'lasso',open:false,size:.006,points:[[.1,.1],[.9,.1],[.5,.8]]}]},focus:{cx:.3},sun:{x:.7},leak:{x:.2}};
 let list=[original];const context={document,RayLayers:{capture:()=>list.slice(),valueLimits:Layers.valueLimits,setValues(id,values){const next=Layers.withValues(list,id,values);if(next===list)return false;list=next;return true;}}};context.window=context;context.parent=context;
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/darkroom/layer-inspector.js'),'utf8'),context);
 assert.equal(context.RayMyPresets,undefined);assert.ok(context.RayLayerInspector);context.RayLayerInspector.open('a');
 const dialog=nodes.find(n=>n.tagName==='dialog');assert.equal(dialog.open,true);assert.ok(nodes.some(n=>n.textContent==='+0.65 EV'));assert.ok(nodes.some(n=>n.textContent==='-12'));assert.ok(nodes.some(n=>n.textContent.includes('Ngoài vùng · Vẽ tự do · 1 nét')));
 nodes.find(n=>n.textContent==='Chỉnh thông số').onclick();const input=nodes.find(n=>n.attrs['aria-label']==='Độ sáng của lớp');input.value='-25';nodes.find(n=>n.tagName==='form').onsubmit({preventDefault(){}});
 assert.equal(dialog.open,false);assert.equal(list[0].p.toneBrightness,-.25);assert.equal(original.p.toneBrightness,-.12);assert.equal(list[0].p.adjustRegionStrokes,original.p.adjustRegionStrokes);assert.equal(list[0].enabled,false);assert.equal(list[0].id,'a');
 list.push(
  {id:'basic',title:'Tất cả',p:{toneExposure:-.45,toneShadows:.32}},
  {id:'local',title:'Đường cong · Sáng',p:{toneLocalEV:1.2,toneLocalBrightness:.17,toneLocalColor:'#aaddff',toneLocalColorAmount:.4,toneLocalShape:'curve'}},
  {id:'sun',title:'Nắng',p:{nang:.38},sun:{x:.23,y:.14}},
  {id:'brush',title:'Bút ánh sáng',p:{brushEV:-.8,brushStrokes:[{mode:'paint',points:[[.2,.3]],size:.1,softness:.6}]}}
 );
 for(const [id,title,value]of [['basic','Điều chỉnh','-0.45 EV'],['local','Đường cong · Sáng','+1.2 EV'],['sun','Nắng','+38'],['brush','Bút ánh sáng','-0.8 EV']]){
  const at=nodes.length;context.RayLayerInspector.open(id);assert.equal(dialog.open,true);const added=nodes.slice(at);assert.ok(added.some(n=>n.tagName==='h2'&&n.textContent.includes(title)));assert.ok(added.some(n=>n.textContent===value),id);dialog.close();
 }
});
test('layer list summaries prioritize actual adjustments and do not change any values',async()=>{
 const {summarizeLayer}=await import('../dist/darkroom/layer-parameters.mjs'),layer={p:{toneExposure:.65,toneBrightness:-.12,temp:.34,sat:.16}},before=structuredClone(layer);
 assert.match(summarizeLayer(layer),/Phơi sáng \+0.65 EV/);assert.match(summarizeLayer(layer),/Độ sáng -12/);assert.deepEqual(layer,before);
});
