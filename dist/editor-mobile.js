/* Compact editing chrome. Move the original controls, preserving handlers and state. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.RayMobileEditor=api;api.init();}})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 function portal(node){if(!node)return null;const marker=node.ownerDocument.createComment('ray-editor-control');node.before(marker);return{to:target=>target.append(node),restore:()=>marker.after(node)};}
 function init(doc=document,win=window){
  if(!doc.body||doc.body.dataset.mobileEditorReady)return;doc.body.dataset.mobileEditorReady='true';
  const make=(tag,className,text)=>{const n=doc.createElement(tag);if(className)n.className=className;if(text)n.textContent=text;return n;};
  const menus=[],moves=[],media=win.matchMedia('(max-width:760px)');
  function menu(className,label){const details=make('details',className),summary=make('summary','', '⋯'),content=make('div','editor-menu-content');summary.setAttribute('aria-label',label);details.append(summary,content);details.addEventListener('click',e=>{if(e.target.closest('button,a'))details.open=false;});menus.push(details);return{details,summary,content};}
  const header=doc.querySelector('#darkroomView .editor-bar');
  if(header){
   const actions=header.querySelector('.module-actions'),identity=header.querySelector('.editor-identity'),more=menu('editor-overflow','Tùy chọn chỉnh ảnh');
   const back=make('a','editor-mobile-back','‹');back.href='#home';back.setAttribute('aria-label','Về khám phá');identity.prepend(back);actions.insertBefore(more.details,doc.getElementById('saveDarkroom'));
   const shortcuts=[doc.getElementById('saveCreative'),doc.getElementById('toBooth')].filter(Boolean).map(node=>({node,place:portal(node)}));
   const nav=make('nav','editor-menu-nav');nav.setAttribute('aria-label','Khu làm việc');for(const [href,label]of [['#album','Kho ảnh & bản nháp'],['#booth','Mở Photobooth'],['#home','Khám phá']]){const a=make('a','',label);a.href=href;nav.append(a);}more.content.append(nav);
   moves.push(active=>{back.hidden=more.details.hidden=!active;for(const item of shortcuts){if(active)more.content.insertBefore(item.node,nav);else item.place.restore();}});
  }
  const app=doc.querySelector('.film-workspace'),tabs=app?.querySelector('.editor-tabs'),bar=app?.querySelector('.session-apply-bar'),quick=app?.querySelector('.session-quick');
  if(app&&tabs&&bar&&quick){
   const row=make('div','editor-tool-row'),tabsPlace=portal(tabs),barPlace=portal(bar),more=menu('session-more','Tùy chọn ảnh và lớp');quick.append(more.details);
   const layers=app.querySelector('.effect-layers'),layerBox=make('section','editor-menu-layers'),heading=make('p','editor-menu-heading','Lớp đã giữ'),badge=make('span','editor-menu-badge');badge.setAttribute('aria-hidden','true');more.summary.append(badge);layerBox.append(heading);more.content.append(layerBox);
   const layerPlace=portal(layers),buttons=[quick.querySelector('.quick-date'),quick.querySelector('button[aria-label="Lưu bản nháp"]'),bar.querySelector('button[aria-label="Hủy chỉnh sửa của bước này"]')].filter(Boolean).map(node=>({node,place:portal(node)}));
   const stage=app.querySelector('.stage');const fitMenu=()=>{if(!more.details.open||!stage)return;const available=stage.getBoundingClientRect().bottom-more.content.getBoundingClientRect().top-8;more.content.style.maxHeight=Math.max(64,available)+'px';};more.details.addEventListener('toggle',fitMenu);if(stage&&win.ResizeObserver)new win.ResizeObserver(fitMenu).observe(stage);
   const syncLayers=()=>{const count=layers?.querySelectorAll('.effect-layer-chip').length||0;layerBox.hidden=!count;badge.textContent=count?String(count):'';badge.hidden=!count;};
   if(layers)new win.MutationObserver(syncLayers).observe(layers,{childList:true,attributes:true,attributeFilter:['hidden']});syncLayers();
   moves.push(active=>{more.details.hidden=!active;if(active){tabs.before(row);tabsPlace.to(row);barPlace.to(row);if(layers)layerPlace.to(layerBox);for(const item of buttons)more.content.append(item.node);}else{tabsPlace.restore();barPlace.restore();layerPlace?.restore();for(const item of buttons)item.place.restore();row.remove();}});
  }
  function update(){doc.body.classList.toggle('ray-mobile-editor',media.matches);for(const move of moves)move(media.matches);for(const m of menus)m.open=false;}
  media.addEventListener('change',update);update();
  doc.addEventListener('keydown',e=>{if(e.key==='Escape')for(const m of menus)m.open=false;});
  doc.addEventListener('click',e=>{for(const m of menus)if(!m.contains(e.target))m.open=false;});
  if(header)new win.MutationObserver(()=>{for(const m of menus)m.open=false;}).observe(doc.body,{attributes:true,attributeFilter:['data-view']});
 }
 return{portal,init};
});
