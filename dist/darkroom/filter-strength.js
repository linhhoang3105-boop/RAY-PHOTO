/* Ordinary Filter strength. Native color, retouch and rendering engines stay unchanged. */
(()=>{
 'use strict';
 const Core=window.RayFilterStrengthCore,Layers=window.RayLayers,dock=document.querySelector('.preset-dock'),head=dock?.querySelector('.preset-dock-head');
 if(!Core||!Layers||!head)return;
 if(!Object.hasOwn(P,'rayFilterStrength'))P.rayFilterStrength=null;
 let preferred=100,editing=false,lastValue,lastModel;
 const row=document.createElement('label');row.className='filter-strength';row.id='rayFilterStrength';
 const caption=document.createElement('span');caption.textContent='Cường độ tổng';
 const input=document.createElement('input');input.type='range';input.min='0';input.max='100';input.step='1';input.value='100';input.setAttribute('aria-label','Cường độ tổng bộ lọc');
 const output=document.createElement('output');output.textContent='100%';row.append(caption,input,output);head.after(row);
 function model(){const value=P.rayFilterStrength;if(value===lastValue)return lastModel;lastValue=value;try{lastModel=value?Core.validate(value):null;}catch{lastModel=null;}return lastModel;}
 function selectedPreset(){const button=[...document.querySelectorAll('.roll')].find(b=>b.classList.contains('on')),r=ROLLS.find(r=>r.id===button?.dataset.preset);return r&&r.id!=='goc'&&(!P.rayBasePreset||P.rayBasePreset===r.id)?r:null;}
 function pendingLayers(){const ids=new Set(P.adjustRegionTargets||[]);return Layers.capture().filter(l=>ids.has(l.id)&&!l.aiComposer);}
 function available(){const s=model();if(s){if(s.kind==='current')return s.refs.length>0&&(!s.presetId||P.rayBasePreset===s.presetId);const ids=new Set(Layers.capture().map(l=>l.id));return s.refs.some(r=>ids.has(r.id));}return !P.rayFilterStrength&&(!!selectedPreset()||pendingLayers().length>0);}
 function busy(){return !source||BEAUTY.busy||BODY_AI.busy||window.RayRemove?.busy||window.RayCompose?.busy||window.RayAIComposer?.busy||document.body.classList.contains('ray-video-mode')||document.getElementById('rayAIComposerPanel')?.hidden===false;}
 function sync(){const s=model();if(s)preferred=s.amount;input.value=String(s?.amount??preferred);output.textContent=Math.round(Number(input.value))+'%';input.disabled=busy()||!available();row.classList.toggle('is-disabled',input.disabled);row.title=input.disabled?'Chọn màu trong Bộ lọc để chỉnh độ đậm.':(s?.name||selectedPreset()?.name||'Màu của tôi')+' · Giữ các chỉnh sửa khác';}
 function seed(){if(model())return true;const preset=selectedPreset();if(preset){P.rayBasePreset=preset.id;P.rayFilterStrength=Core.create({kind:'current',name:preset.name,presetId:preset.id,targets:[{id:'current',p:P,keys:Object.keys(preset.p)}]});return true;}const group=pendingLayers();if(group.length){P.rayFilterStrength=Core.create({kind:'layers',name:document.getElementById('activePreset')?.textContent||'Màu của tôi',targets:group.map(l=>({id:l.id,p:l.p}))});return true;}return false;}
 function project(amount){const state=model();if(!state)return false;const layers=Layers.capture(),next=Core.project(state,{p:P,layers},amount);if(next.layers!==layers)Layers.restore(next.layers);Object.assign(P,next.p);P.rayFilterStrength=next.state;preferred=next.state.amount;return true;}
 function repaint(){syncControls();sync();queue();}
 function setAmount(amount){if(busy()||!available()||!seed())return false;window.RaySession?.showResult?.(false);project(amount);repaint();return true;}
 function begin(){if(editing||input.disabled)return;editing=true;window.RaySession?.record();}
 function finish(){if(!editing)return;editing=false;window.RaySession?.record('Cường độ tổng bộ lọc');}
 input.addEventListener('pointerdown',begin);input.oninput=()=>{begin();setAmount(Number(input.value));};input.onchange=finish;input.addEventListener('blur',finish);input.addEventListener('pointercancel',finish);
 const api={
  get amount(){return model()?.amount??preferred;},get state(){const s=model();return s?Core.validate(s):null;},setAmount,sync,
  selectPreset(preset,choose){const amount=api.amount,result=choose();if(!preset||preset.id==='goc'){P.rayFilterStrength=null;preferred=100;sync();return result;}P.rayFilterStrength=Core.create({kind:'current',name:preset.name,presetId:preset.id,targets:[{id:'current',p:P,keys:Object.keys(preset.p)}]});project(amount);repaint();return result;},
  selectLayers(name,layers,amount=api.amount){P.rayFilterStrength=Core.create({kind:'layers',name,targets:layers.map(l=>({id:l.id,p:l.p}))});project(amount);sync();},
  onRestore(){lastValue=lastModel=undefined;preferred=model()?.amount??100;editing=false;sync();},
  onSourceReset(){if(model()?.kind==='current'){editing=false;sync();}else api.reset();},
  reset(){P.rayFilterStrength=null;preferred=100;editing=false;lastValue=lastModel=undefined;sync();}
 };
 window.RayFilterStrength=api;
 const originalSync=syncControls;syncControls=function(...args){const result=originalSync.apply(this,args);sync();return result;};
 const originalDraw=draw;draw=function(...args){const result=originalDraw.apply(this,args);sync();return result;};
 sync();
})();
