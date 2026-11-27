/* Separate body edits per detected person; keep the original warp and color renderer. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.RayBodyPeople=api;api.init();}})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v)),edited=p=>Math.abs(p.size||0)>.001||Math.abs(p.wid||0)>.001||Math.abs(p.len||0)>.001||(p.push||0)>.001;
 function bank(defaults){
  let profiles=[],activeId=null,nextId=1;
  const keep=(parts)=>{if(activeId){const p=profiles.find(p=>p.id===activeId);if(p)p.parts=clone(parts);}};
  return{
   tag(people,W,H){
    const assigned=new Map(),used=new Set(),candidates=[];
    people.forEach((p,i)=>profiles.filter(x=>x.id!=='manual').forEach(old=>{const f=p.regions.face,anchor=f?{x:f.cx,y:f.cy}:{x:p.x,y:p.y},a=old.anchor||{x:old.x,y:old.y},d=Math.min(Math.hypot((anchor.x-a.x)*W/H,anchor.y-a.y),Math.hypot((p.x-old.x)*W/H,p.y-old.y));if(d<.22)candidates.push({i,old,d});}));
    candidates.sort((a,b)=>a.d-b.d).forEach(({i,old})=>{if(!assigned.has(i)&&!used.has(old.id)){assigned.set(i,old);used.add(old.id);}});
    return people.map((p,i)=>{let profile=assigned.get(i);if(!profile){profile={id:'body-person-'+nextId++,x:p.x,y:p.y,parts:defaults().map(part=>p.regions[part.id]?{...part,...clone(p.regions[part.id]),place:'ai'}:part)};profiles.push(profile);}profile.x=p.x;profile.y=p.y;profile.anchor=p.regions.face?{x:p.regions.face.cx,y:p.regions.face.cy}:{x:p.x,y:p.y};return{...p,rayPersonId:profile.id};});
   },
   activate(person,parts){
    if(!person?.rayPersonId||person.rayPersonId===activeId)return parts;
    keep(parts);if(!activeId&&parts.some(p=>edited(p)||p.place==='manual'))profiles.unshift({id:'manual',x:.5,y:.5,parts:clone(parts)});
    activeId=person.rayPersonId;let selected=profiles.find(p=>p.id===activeId);if(!selected){selected={id:activeId,x:person.x,y:person.y,parts:defaults().map(p=>person.regions[p.id]?{...p,...clone(person.regions[p.id]),place:'ai'}:p)};profiles.push(selected);}return clone(selected.parts);
   },
   batches(parts){const list=profiles.map(p=>({...p,parts:p.id===activeId?parts:p.parts}));if(!activeId||!profiles.some(p=>p.id===activeId))list.push({id:activeId,parts});return list.filter(p=>p.parts.some(edited));},
   parts(parts){return this.batches(parts).flatMap(p=>p.parts);},
   capture(parts){if(!profiles.length)return null;keep(parts);return{version:1,activeId,nextId,profiles:clone(profiles)};},
   restore(saved,parts){
    profiles=[];activeId=null;nextId=1;if(!saved||saved.version!==1||!Array.isArray(saved.profiles)||saved.profiles.length>30)return;
    const allowed=new Set(defaults().map(p=>p.id));
    for(const p of saved.profiles){if(!p||!/^body-person-\d+$|^manual$/.test(p.id)||!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Array.isArray(p.parts))continue;
     const entries=p.parts.filter(q=>allowed.has(q.id)&&['cx','cy','rx','ry','rot','size','wid','len','push','dir','soft'].every(k=>Number.isFinite(q[k]))&&q.rx>0&&q.ry>0);
     if(entries.length)profiles.push({id:p.id,x:p.x,y:p.y,...(p.anchor&&Number.isFinite(p.anchor.x)&&Number.isFinite(p.anchor.y)?{anchor:{x:p.anchor.x,y:p.anchor.y}}:{}),parts:clone(entries)});
    }
    if(profiles.some(p=>p.id===saved.activeId))activeId=saved.activeId;
    nextId=Math.max(1,...profiles.map(p=>Number(p.id.split('-').at(-1))||0))+1;keep(parts);
   },
   clear(){profiles=[];activeId=null;nextId=1;},
   clearEdits(){for(const p of profiles)for(const part of p.parts){Object.assign(part,{size:0,wid:0,len:0,push:0,dir:0,soft:.5});part.regionStrokes=[];part.regionProtectArms=true;}},
   get activeId(){return activeId;}
  };
 }
 function people(result,W,H,regions){
  const poses=result.poses||[],faces=result.faces||[],entries=poses.map(pose=>({pose,face:null})),used=new Set(),matches=[];
  entries.forEach((entry,i)=>faces.forEach((face,j)=>{const a=entry.pose[0],b=face[1],top=face[10],chin=face[152];if(!a||!b||!top||!chin)return;const distance=Math.hypot((a.x-b.x)*W/H,a.y-b.y),height=Math.hypot((top.x-chin.x)*W/H,top.y-chin.y);if(distance<Math.max(.04,height*.8))matches.push({i,j,distance});}));
  matches.sort((a,b)=>a.distance-b.distance).forEach(({i,j})=>{if(!entries[i].face&&!used.has(j)){entries[i].face=faces[j];used.add(j);}});faces.forEach((face,j)=>{if(!used.has(j))entries.push({pose:null,face});});
  return entries.map(e=>{const r=regions(e.pose,e.face,W,H),all=Object.values(r);if(!all.length)return null;const xs=all.map(p=>p.cx),ys=all.map(p=>p.cy),aspect=W/H;return{regions:r,rayFace:e.face,x:xs.reduce((a,b)=>a+b,0)/xs.length,y:ys.reduce((a,b)=>a+b,0)/ys.length,area:(Math.max(...all.map(p=>p.cx+p.rx/aspect))-Math.min(...all.map(p=>p.cx-p.rx/aspect)))*(Math.max(...all.map(p=>p.cy+p.ry))-Math.min(...all.map(p=>p.cy-p.ry)))};}).filter(Boolean).sort((a,b)=>a.x-b.x||a.y-b.y).slice(0,6);
 }
 function bounds(parts,W,H){let left=W,top=H,right=0,bottom=0;for(const p of parts.filter(edited)){const a=(p.rot||0)*Math.PI/180,rx=p.rx*H,ry=p.ry*H,ex=Math.ceil(Math.hypot(rx*Math.cos(a),ry*Math.sin(a)))+2,ey=Math.ceil(Math.hypot(rx*Math.sin(a),ry*Math.cos(a)))+2;left=Math.min(left,Math.floor(p.cx*W-ex));right=Math.max(right,Math.ceil(p.cx*W+ex));top=Math.min(top,Math.floor(p.cy*H-ey));bottom=Math.max(bottom,Math.ceil(p.cy*H+ey));}left=Math.max(0,left);top=Math.max(0,top);right=Math.min(W,right);bottom=Math.min(H,bottom);return right>left&&bottom>top?{x:left,y:top,width:right-left,height:bottom-top}:null;}
 function score(mask,x,y,W,H){if(!mask?.foreground)return 0;const mx=Math.floor(x/W*mask.width),my=Math.floor(y/H*mask.height);return mx>=0&&my>=0&&mx<mask.width&&my<mask.height?mask.foreground[my*mask.width+mx]:0;}
 function protect(before,after,box,W,H,own,others){for(let y=0;y<box.height;y++)for(let x=0;x<box.width;x++){const px=box.x+x+.5,py=box.y+y+.5,mine=score(own,px,py,W,H);if(others.some(mask=>{const v=score(mask,px,py,W,H);return v>=96&&v>=mine;})){const i=(y*box.width+x)*4;for(let c=0;c<4;c++)after[i+c]=before[i+c];}}return after;}
 function isolatable(person,all){
  if(!person?.rayHasPose||!person.rayMask)return false;
  if(all.length<2)return true;if(all.some(p=>p!==person&&!p.rayMask))return false;
  const own=person.rayMask;for(const p of all){if(p===person)continue;let mine=0,separate=0;for(let y=0;y<48;y++)for(let x=0;x<48;x++){const a=score(own,x+.5,y+.5,48,48),b=score(p.rayMask,x+.5,y+.5,48,48);if(a>=128){mine++;if(a>b+32)separate++;}}if(!mine||separate/mine<.25)return false;}return true;
 }
 function renderGroups(c,W,H,batches,detected,render){for(const batch of batches){const person=detected.find(p=>p.rayPersonId===batch.id),others=person?detected.filter(p=>p!==person&&p.rayMask).map(p=>p.rayMask):[],box=others.length?bounds(batch.parts,W,H):null,before=box?c.getImageData(box.x,box.y,box.width,box.height):null;render(batch.parts);if(before){const after=c.getImageData(box.x,box.y,box.width,box.height);protect(before.data,after.data,box,W,H,person.rayMask,others);c.putImageData(after,box.x,box.y);}}}
 const api={bank,people,bounds,protect,isolatable,renderGroups};
 api.init=()=>{
  const $=id=>document.getElementById(id),defaults=()=>BODY_DEF.map(d=>({id:d[0],name:d[1],cx:d[2],cy:d[3],rx:d[4],ry:d[5],rot:d[6],size:0,wid:0,len:0,push:0,dir:0,soft:.5,place:'default'})),state=bank(defaults),picker=$('bodyAiPerson');
  const label=picker.parentElement;label.classList.add('ray-body-person');picker.setAttribute('aria-label','Người muốn chỉnh dáng');$('bodyBox').prepend(label);const hint=document.createElement('p');hint.id='rayBodyPersonHint';hint.className='ray-body-help';label.after(hint);
  const current=()=>BODY_AI.people[BODY_AI.selected],valid=()=>BODY_AI.people.filter(p=>p.raySource===source);
  api.capture=()=>state.capture(BODY.parts);api.parts=(parts=BODY.parts)=>state.parts(parts);api.canIsolate=()=>{const detected=valid(),all=detected.map(p=>({...p,rayMask:window.RayBodyContour?.mask(p)||p.rayMask})),own=all[detected.indexOf(current())];return current()?.raySource===source&&isolatable(own,all);};
  api.sourceChanged=()=>{bodyAiReset();bodyAiUI();};
  api.restore=saved=>{state.restore(saved,BODY.parts);const index=BODY_AI.people.findIndex(p=>p.rayPersonId===state.activeId);if(index>=0){BODY_AI.selected=index;picker.value=String(index);}window.RayLayers?.invalidate?.();};
  bodyAiPeople=function(result,W,H){state.capture(BODY.parts);return state.tag(people(result,W,H,bodyAiRegions),W,H);};
  api.syncPicker=()=>{const n=BODY_AI.people.length;label.hidden=hint.hidden=!n||$('bodyBox').dataset.bodyMode==='face';picker.disabled=BODY_AI.busy||n<2;if(n){const onlyFaces=BODY_AI.people.filter(p=>!p.rayHasPose).length;hint.textContent='Đã tìm thấy '+n+' người · Đang chỉnh Người '+(BODY_AI.selected+1)+(onlyFaces?' · '+onlyFaces+' người mới có mốc mặt':'');}};
  const ui=bodyAiUI;bodyAiUI=function(...args){const result=ui.apply(this,args);api.syncPicker();return result;};
  const apply=bodyAiApplyPerson;bodyAiApplyPerson=function(...args){if(BODY_AI.busy){const index=BODY_AI.people.findIndex(p=>p.rayPersonId===state.activeId);if(index>=0){BODY_AI.selected=index;picker.value=String(index);}}window.RayRatioLive?.cancel();BODY.parts=state.activate(current(),BODY.parts);const result=apply.apply(this,args);window.RayLayers?.invalidate?.();queue();window.RayOverall62?.refresh();window.RaySession?.contextChanged();return result;};
  const change=picker.onchange;picker.onchange=function(...args){if(BODY_AI.busy)return;window.RayRatioLive?.accept();window.RaySession?.record();return change.apply(this,args);};
  const reset=bodyReset;bodyReset=function(...args){state.clear();return reset.apply(this,args);};
  const clear=$('bodyResetAll').onclick;$('bodyResetAll').onclick=function(...args){window.RaySession?.record();state.clearEdits();const result=clear.apply(this,args);window.RayLayers?.invalidate?.();window.RaySession?.record('Xóa chỉnh dáng của mọi người');return result;};
  const warp=bodyWarp;bodyWarp=function(c,W,H){
   if(BODY.peek)return warp(c,W,H);const original=BODY.parts,batches=state.batches(original),detected=valid();if(!batches.length)return warp(c,W,H);
   try{return renderGroups(c,W,H,batches,detected,parts=>{BODY.parts=parts;warp(c,W,H);});}finally{BODY.parts=original;}
  };
  bodyAiUI();
 };
 return api;
});
