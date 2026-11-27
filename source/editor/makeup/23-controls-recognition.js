/* Giao diện làm đẹp. Không sửa P, không thay preset hoặc cấu hình chỉnh dáng. */
const beautyHead=$("#beautyHead"),beautyBox=$("#beautyBox"),beautyScan=$("#beautyScan"),beautyStatus=$("#beautyStatus");
const beautyControls=[],beautyColors=[],beautyPalettes=[],beautyPeopleNodes=[];
const BEAUTY_SLIDERS=[["skin","Da trắng hồng","skin"],["smooth","Làm mịn mặt","smooth"],["hair","Độ phủ màu tóc","hair"],["lip","Son môi","face"],["blush","Má hồng","face"],["brow","Chân mày","face"]];
function beautyMessage(message){beautyStatus.textContent=message;}
function beautyRenderPeople(){
  const list=$("#beautyPeopleList");list.replaceChildren();beautyPeopleNodes.length=0;
  BEAUTY.people.forEach((person,index)=>{
    const button=document.createElement("button");button.type="button";button.className="beauty-person";button.setAttribute("aria-label","Chỉnh Người "+(index+1));
    const canvas=document.createElement("canvas");canvas.width=56;canvas.height=64;
    const g=person.g,x=clamp(Math.floor((g.left-.3*g.w)*source.width),0,source.width-1),y=clamp(Math.floor((g.top-.5*g.h)*source.height),0,source.height-1);
    const w=Math.max(1,Math.min(source.width-x,Math.ceil((g.right+.3*g.w)*source.width)-x)),h=Math.max(1,Math.min(source.height-y,Math.ceil((g.bottom+.15*g.h)*source.height)-y));
    const scale=Math.max(56/w,64/h);canvas.getContext("2d").drawImage(source,x,y,w,h,(56-w*scale)/2,(64-h*scale)/2,w*scale,h*scale);
    const label=document.createElement("span");label.textContent="Người "+(index+1);
    const edited=document.createElement("em");button.appendChild(canvas);button.appendChild(label);button.appendChild(edited);
    button.onclick=()=>beautySelectPerson(index);list.appendChild(button);beautyPeopleNodes.push({button,edited,person,index});
  });
}
function beautyUI(){
  const changed=v=>BEAUTY_SLIDERS.some(([k])=>v[k]>.001),count=BEAUTY_SLIDERS.filter(([k])=>BEAUTY.values[k]>.001).length;
  const peopleCount=BEAUTY.people.filter(p=>changed(p.values)).length,ready=beautySelectedReady();
  $("#beautyHeadTxt").textContent=(BEAUTY.people.length>1?peopleCount+"/"+BEAUTY.people.length+" người · ":count?count+" mục · ":"")+(BEAUTY.open?"đóng ▴":"mở ▾");
  beautyBox.hidden=!BEAUTY.open;beautyHead.setAttribute("aria-expanded",BEAUTY.open?"true":"false");
  beautyScan.disabled=!source||BEAUTY.busy;
  beautyScan.textContent=BEAUTY.busy?"AI đang nhận diện…":(BEAUTY.maps||BEAUTY.faces.length?"AI · Nhận diện lại":"AI · Nhận diện da, tóc và mặt");
  $("#beautyPeople").hidden=!BEAUTY.people.length;
  $("#beautyPersonStatus").textContent=BEAUTY.people.length?"Đang chỉnh Người "+(BEAUTY.selected+1)+" · thiết lập của người khác được giữ riêng.":BEAUTY.maps?"Chưa tìm thấy khuôn mặt. Các thanh da và tóc hiện áp dụng toàn ảnh.":"";
  if(BEAUTY.people.length>1&&!BEAUTY.people[BEAUTY.selected].body&&BEAUTY.maps)$("#beautyPersonStatus").textContent+=" Da và tóc hiện giới hạn quanh đầu vì chưa tách rõ cơ thể.";
  for(const r of beautyPeopleNodes){r.button.disabled=BEAUTY.busy;r.button.classList.toggle("on",r.index===BEAUTY.selected);r.button.setAttribute("aria-pressed",r.index===BEAUTY.selected?"true":"false");r.edited.textContent=changed(r.person.values)?"đã chỉnh":"";}
  $("#beautyResetPerson").disabled=BEAUTY.busy||!BEAUTY.people.length;
  $("#beautyCopyAll").disabled=BEAUTY.busy||BEAUTY.people.length<2;
  for(const r of beautyControls){r.input.value=BEAUTY.values[r.key];r.value.textContent=Math.round(BEAUTY.values[r.key]*100);r.input.disabled=!ready[r.ready]||BEAUTY.busy;}
  for(const r of beautyColors){r.input.value=BEAUTY.values[r.key];r.input.disabled=!ready[r.ready]||BEAUTY.busy;}
  for(const r of beautyPalettes){r.button.disabled=!ready[r.ready]||BEAUTY.busy;r.button.classList.toggle("on",BEAUTY.values[r.key]===r.color);}
}
for(const[key,name,ready]of BEAUTY_SLIDERS){
  const host=$("#beauty"+key[0].toUpperCase()+key.slice(1)),row=document.createElement("div");row.className="row";
  row.innerHTML='<div class="t"><span>'+name+'</span><em>0</em></div><input type="range" min="0" max="1" step="0.01" aria-label="'+name+'" data-beauty="'+key+'" disabled>';
  host.appendChild(row);const input=row.querySelector("input"),value=row.querySelector("em");
  beautyControls.push({key,input,value,ready});
  input.addEventListener("input",()=>beautySetValue(key,clamp(Number(input.value)||0,0,1)));
  input.addEventListener("dblclick",()=>beautySetValue(key,0));
}
const beautyPaletteSpec=[
  ["hair",[["Nâu tây","#735440"],["Nâu đỏ","#794437"],["Đen khói","#24262b"],["Nâu lạnh","#655d57"],["Tím nâu","#6b466e"],["Vàng be","#bd9967"]]],
  ["lip",[["Đỏ lạnh","#b7374d"],["Đỏ tươi","#ce303c"],["Đỏ nâu","#95433d"],["Hồng đất","#bd6b76"],["Cam đào","#d27960"]]],
  ["blush",[["Hồng dịu","#dc7b88"],["Đào","#df967c"],["Hồng tím","#bd7ca6"]]],
  ["brow",[["Nâu","#553c32"],["Nâu xám","#55504c"],["Đen nâu","#302c2b"]]]
];
for(const[kind,colors]of beautyPaletteSpec){
  const host=$("#beauty"+kind[0].toUpperCase()+kind.slice(1)),key=kind+"Color",ready=kind==="hair"?"hair":"face";
  const bar=document.createElement("div");bar.className="beauty-palette";host.appendChild(bar);
  function choose(color){
    BEAUTY.values[key]=color;
    if(BEAUTY.values[kind]<=.001)BEAUTY.values[kind]=kind==="hair"?.55:kind==="lip"?.40:kind==="blush"?.30:.35;
    beautyUI();queue();
  }
  for(const[name,color]of colors){
    const button=document.createElement("button");button.type="button";button.className="beauty-swatch";button.style.backgroundColor=color;
    button.title=name;button.setAttribute("aria-label",name);button.onclick=()=>choose(color);bar.appendChild(button);
    beautyPalettes.push({button,key,color,ready});
  }
  const label=document.createElement("label");label.className="beauty-custom";label.textContent="Màu khác ";
  const input=document.createElement("input");input.type="color";input.setAttribute("aria-label",kind==="hair"?"Màu tóc tùy chọn":kind==="lip"?"Màu son tùy chọn":kind==="blush"?"Màu má tùy chọn":"Màu chân mày tùy chọn");
  input.oninput=()=>choose(input.value);label.appendChild(input);host.appendChild(label);beautyColors.push({key,input,ready});
}
beautyHead.onclick=()=>{BEAUTY.open=!BEAUTY.open;beautyUI();};
function beautyReset(){
  BEAUTY.job++;if(BEAUTY.busy)beautyWorkerStop();
  BEAUTY.values={...BEAUTY_DEFAULT};BEAUTY.maps=null;BEAUTY.faces=[];BEAUTY.people=[];BEAUTY.instances=[];BEAUTY.selected=0;BEAUTY.nextPerson=0;BEAUTY.faceCache=null;
  BEAUTY.ready={skin:false,smooth:false,hair:false,face:false};BEAUTY.source=source;BEAUTY.busy=false;BEAUTY.peek=false;
  beautyMessage("Bấm nhận diện rồi chọn mức làm đẹp. Lần đầu cần mạng và tải vài chục MB (nên dùng Wi-Fi); ảnh vẫn xử lý ngay trên máy, không gửi đi.");
  beautyRenderPeople();beautyUI();
}
$("#beautyReset").onclick=()=>{
  for(const p of BEAUTY.people)p.values={...BEAUTY_DEFAULT};
  BEAUTY.values=BEAUTY.people[BEAUTY.selected]?.values||{...BEAUTY_DEFAULT};beautyUI();queue();
};
$("#beautyResetPerson").onclick=()=>{
  const p=BEAUTY.people[BEAUTY.selected];if(BEAUTY.busy||!p)return;
  p.values={...BEAUTY_DEFAULT};BEAUTY.values=p.values;beautyUI();queue();
};
$("#beautyCopyAll").onclick=()=>{
  if(BEAUTY.busy||BEAUTY.people.length<2)return;
  const values={...BEAUTY.values};for(const p of BEAUTY.people)p.values={...values};
  BEAUTY.values=BEAUTY.people[BEAUTY.selected].values;beautyUI();queue();
};
const beautyPeek=$("#beautyPeek"),beautyPeekSet=on=>{if(BEAUTY.peek!==on){BEAUTY.peek=on;beautyPeek.classList.toggle("on",on);queue();}};
beautyPeek.addEventListener("pointerdown",e=>{beautyPeekSet(true);try{beautyPeek.setPointerCapture(e.pointerId);}catch(_){}e.preventDefault();});
for(const ev of ["pointerup","pointercancel","lostpointercapture"])beautyPeek.addEventListener(ev,()=>beautyPeekSet(false));
window.addEventListener("blur",()=>beautyPeekSet(false));beautyPeek.addEventListener("contextmenu",e=>e.preventDefault());
beautyScan.onclick=async()=>{
  if(!source||BEAUTY.busy)return;
  const previousMaps=BEAUTY.source===source?BEAUTY.maps:null;
  const image=source,id=++BEAUTY.job;BEAUTY.busy=true;beautyUI();beautyMessage("Đang chuẩn bị AI làm đẹp; lần đầu cần tải vài chục MB, có thể mất một lúc…");
  const input=document.createElement("canvas"),scale=Math.min(1,1280/Math.max(image.width,image.height));
  input.width=Math.max(2,Math.round(image.width*scale));input.height=Math.max(2,Math.round(image.height*scale));
  try{
    input.getContext("2d").drawImage(image,0,0,input.width,input.height);
    const found=await beautyDetect(input,id);
    if(id!==BEAUTY.job||image!==source)return;
    beautyKeepHair(found,previousMaps);
    if(!found.errors.includes("face"))beautyBuildPeople(found.faces);
    if(found.instances?.length)BEAUTY.instances=found.instances;
    if(found.maps)BEAUTY.maps=beautyProtectSkin(found.maps,BEAUTY.faces);
    BEAUTY.source=image;BEAUTY.faceCache=null;
    const m=BEAUTY.maps,has=map=>{let hits=0;for(const x of map)if(x>80)hits++;return hits>=Math.max(8,map.length*.00015);};
    BEAUTY.ready={skin:!!m&&has(m.skin),hair:!!m&&beautyHasHair(m.hair),face:BEAUTY.faces.length>0};
    BEAUTY.ready.smooth=BEAUTY.ready.skin&&BEAUTY.ready.face;
    beautyAssignPeople();beautyRenderPeople();
    const labels=[];if(BEAUTY.ready.skin)labels.push("da");if(BEAUTY.ready.hair)labels.push("tóc");if(BEAUTY.ready.face)labels.push(BEAUTY.faces.length+" khuôn mặt");
    beautyMessage(labels.length?"Đã nhận diện "+labels.join(", ")+". "+(BEAUTY.people.length?"Chọn ảnh nhỏ của người cần chỉnh rồi kéo thanh.":"Chọn màu hoặc kéo thanh để xem kết quả."):"Chưa nhận diện rõ da, tóc hoặc mặt. Thử ảnh sáng, khuôn mặt lớn hơn và ít bị che.");
    if(BEAUTY.people.length>1&&!BEAUTY.instances.length)beautyMessage(beautyStatus.textContent+" Chưa tách được da cơ thể; da và tóc đang giới hạn quanh từng khuôn mặt.");
    if(found.errors.length)beautyMessage(beautyStatus.textContent+" Một phần AI chưa tải được; có thể bấm nhận diện lại."+(found.reasons&&found.reasons.length?" [Chi tiết: "+found.reasons.join("; ")+"]":""));
    if(found.warnings?.length)beautyMessage(beautyStatus.textContent+" "+found.warnings.join(" "));
    queue();
  }catch(error){
    if(id===BEAUTY.job)beautyMessage(error&&error.message==="BEAUTY_WEBGL_UNAVAILABLE"
      ?"Trình duyệt chưa cung cấp WebGL cho AI. Thử bật tăng tốc phần cứng hoặc dùng Safari/Chrome khác."
      :"Chưa chạy được AI làm đẹp. Kiểm tra mạng và mở bằng Safari/Chrome rồi thử lại. [Chi tiết: "+[...(BEAUTY.trail||[]),String(error&&error.message||error)].join(" → ").slice(0,520)+"]");
  }finally{
    input.width=input.height=0;if(id===BEAUTY.job){BEAUTY.busy=false;beautyUI();}
  }
};
beautyUI();


