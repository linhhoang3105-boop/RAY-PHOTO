/* Additional color recipes and browsing order; the original film renderer is unchanged. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.RayPresetCatalog=api;api.init();}})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const additions=[
  {id:'thunhat',g:'Máy & phim',name:'Thu Nhật',dot:'#c6a65e',description:'Nắng vàng dịu · Lá vàng-lục · Đen olive · Trắng kem. Màu phim thu Nhật từ công thức riêng.',p:{rayThuNhat:1,frame:'none',leak:0}},
  {id:'ngocdiep',g:'Máy ảnh số',name:'Ngọc Diệp',dot:'#e8becb',description:'Trong veo · Hồng đào · Ánh sáng mềm. Da hồng nhẹ, xanh dịu, hợp áo trắng và hoa.',p:{temp:.055,tint:.07,split:.015,contrast:.06,sat:.04,lift:.03,halation:.045,grain:.012,vignette:.01,leak:0,dust:0,ca:0,flash:.05,frame:'none',glow:.10,filmExp:.08,sharp:.12,printClear:.18}},
  {id:'tanhoc',g:'Máy & phim',name:'Tan Học',dot:'#d9af72',description:'Nắng mật ong · Bóng mềm · Hạt phim mịn. Sắc xanh trầm nhẹ, hợp sân trường, phố nhỏ và bạn bè.',p:{temp:.24,tint:.035,split:.06,contrast:.07,sat:-.055,lift:.10,halation:.16,grain:.10,vignette:.055,leak:0,dust:0,ca:0,flash:0,frame:'none',glow:.10,filmExp:.035,sharp:.08}},
  {id:'nangpho',g:'Máy & phim',name:'Nắng Phố',dot:'#6b4a3a',description:'Đen sâu · Màu phim dịu · Trời nhạt trong · Lá ngả lục lam. Đo từ ảnh mẫu trước/sau; giữ da không bị đè tối.',p:{rayNangPho:1,detail:.18,frame:'none',leak:0}}
 ];
 const digitalFirst=['trongveo','ngocdiep','trongxanh','ngotngao','xanhbaha'];
 const groupNames=['Gốc','Trong & dịu','Nóng – lạnh','Xanh & đất','Pastel & sương','Trầm & sâu','Ánh sáng','Đơn sắc'];
 function groupOf(r){if(r.id==='goc')return'Gốc';if(r.id==='thunhat')return'Nóng – lạnh';if(r.id==='nangpho')return'Trầm & sâu';const p=r.p||{};if((p.sat||0)<=-.7||r.id==='denrang')return'Đơn sắc';if((p.flash||0)>.5||(p.leak||0)>.35||(p.halation||0)>.6)return'Ánh sáng';if((p.contrast||0)<-.08||(p.glow||0)>.3||(p.lift||0)>.2)return'Pastel & sương';if(Math.abs(p.split||0)>.2)return'Nóng – lạnh';if((p.tint||0)<-.07)return'Xanh & đất';if((p.contrast||0)>.25||['cafe','cacao','thap90'].includes(r.id))return'Trầm & sâu';return'Trong & dịu';}
 function weave(list){const warm=list.filter(r=>(r.p?.temp||0)>=0),cool=list.filter(r=>(r.p?.temp||0)<0),rank=r=>digitalFirst.indexOf(r.id)<0?99:digitalFirst.indexOf(r.id);for(const group of [warm,cool])group.sort((a,b)=>rank(a)-rank(b)||(a.p?.lift||0)-(b.p?.lift||0));const out=[];while(warm.length||cool.length){if(warm.length)out.push(warm.shift());if(cool.length)out.push(cool.shift());}return out;}
 function ordered(rolls){
  const groups=new Map();for(const r of rolls){const g=groupOf(r);if(!groups.has(g))groups.set(g,[]);groups.get(g).push(r);}
  const keys=[...groupNames,...[...groups.keys()].filter(g=>!groupNames.includes(g))],out=[];
  for(const key of keys){let list=groups.get(key)||[];
   // Các màu công thức riêng (Thu Nhật, Nắng Phố) đứng cuối nhóm; thứ tự xen ấm/lạnh của các màu cũ giữ nguyên.
   const own=r=>r.id==='thunhat'||r.id==='nangpho';out.push(...weave(list.filter(r=>!own(r))),...list.filter(own));
  }return out;
 }
 function extend(rolls){const ids=new Set(rolls.map(r=>r.id));return ordered([...rolls,...additions.filter(r=>!ids.has(r.id)).map(r=>({...r,p:{...r.p}}))]);}
 function init(){
  const host=document.getElementById('rolls'),buttons=new Map([...host.querySelectorAll('.roll')].map((b,i)=>[ROLLS[i].id,b])),headings=new Map([...host.querySelectorAll('.rollhead')].map(h=>[h.textContent.trim(),h]));
  const originalReset=buttons.get('goc').onclick;
  for(const recipe of additions)if(!buttons.has(recipe.id)){
   const button=document.createElement('button');button.type='button';button.className='roll';button.textContent=recipe.name;button.setAttribute('aria-description',recipe.description);
   button.onclick=()=>{originalReset();Object.assign(P,recipe.p);host.querySelectorAll('.roll').forEach(b=>b.classList.remove('on'));button.classList.add('on');syncControls();queue();};buttons.set(recipe.id,button);
  }
  ROLLS.splice(0,ROLLS.length,...extend(ROLLS));host.replaceChildren();let last=null;
  for(const recipe of ROLLS){const group=groupOf(recipe);if(group!=='Gốc'&&group!==last){let heading=headings.get(group);if(!heading){heading=document.createElement('div');heading.className='rollhead';heading.textContent=group;}host.append(heading);}host.append(buttons.get(recipe.id));last=group;}
 }
 return{additions,digitalFirst,groupNames,groupOf,ordered,extend,init};
});
