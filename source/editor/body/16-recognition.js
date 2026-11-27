/* ============ chỉnh dáng: AI gợi ý vị trí, tách riêng khỏi bộ màu ============ */
const BODY_AI_ASSETS = {
  roots: [
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21",
    "https://unpkg.com/@mediapipe/tasks-vision@0.10.21"
  ],
  pose: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  face: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
};
/* Chỉ khởi tạo khi bấm nhận diện. Không gửi ảnh đi; chỉ tải mã, WASM và mô hình.
   Worker cổ điển để WASM có thể dùng importScripts; CPU dùng được cả khi thiếu GPU.
   Cùng hàm chạy trên luồng chính nếu trình duyệt chặn Worker/OffscreenCanvas. */
async function bodyAiEngine(assets, onStatus){
  const limit = (promise, ms) => new Promise((resolve,reject) => {
    const timer=setTimeout(()=>reject(new Error("Tải AI quá lâu")),ms);
    Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
  });
  let api, files;
  for(const root of assets.roots){
    try{
      api = await limit(import(root + "/vision_bundle.mjs"),20000);
      files = await limit(api.FilesetResolver.forVisionTasks(root + "/wasm"),10000);
      break;
    }catch(_){ api = null; }
  }
  if(!api) throw new Error("Không tải được thư viện AI");
  const tasks = {};
  async function task(kind){
    if(tasks[kind]) return tasks[kind];
    onStatus("Đang tải AI " + (kind === "pose" ? "cơ thể" : "khuôn mặt") + "…");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    let bytes;
    try{
      const response = await fetch(assets[kind], {signal:controller.signal, credentials:"omit"});
      if(!response.ok) throw new Error("Không tải được mô hình " + kind);
      bytes = new Uint8Array(await response.arrayBuffer());
    }finally{ clearTimeout(timer); }
    const options = {baseOptions:{modelAssetBuffer:bytes, delegate:"CPU"}, runningMode:"IMAGE"};
    if(kind === "pose") Object.assign(options, {numPoses:3, minPoseDetectionConfidence:.55, minPosePresenceConfidence:.55});
    else Object.assign(options, {numFaces:3, minFaceDetectionConfidence:.55, minFacePresenceConfidence:.55,
                                outputFaceBlendshapes:false, outputFacialTransformationMatrixes:false});
    tasks[kind] = await (kind === "pose" ? api.PoseLandmarker : api.FaceLandmarker).createFromOptions(files, options);
    return tasks[kind];
  }
  return {
    async detect(image, report){
      if(report) onStatus=report;
      const result = {poses:[], faces:[], errors:[]};
      for(const kind of ["pose", "face"]){
        try{
          const model = await task(kind);
          onStatus("Đang nhận diện " + (kind === "pose" ? "cơ thể" : "khuôn mặt") + "…");
          // Cho trạng thái tải kịp hiển thị ở chế độ dự phòng trên luồng chính.
          await new Promise(resolve => setTimeout(resolve, 0));
          const found = model.detect(image);
          if(kind === "pose"){
            result.poses = found.landmarks || [];
            if(found.close) found.close();
          }else result.faces = found.faceLandmarks || [];
        }catch(_){ result.errors.push(kind); }
      }
      if(result.errors.length === 2) throw new Error("Không khởi chạy được AI");
      return result;
    }
  };
}
const BODY_AI = {people:[], selected:0, busy:false, job:0, worker:null, pending:null, main:null, message:""};
const bodyAiScan = $("#bodyAiScan"), bodyAiAlign = $("#bodyAiAlign"),
      bodyAiPerson = $("#bodyAiPerson"), bodyAiStatus = $("#bodyAiStatus");
function bodyAiMessage(message){ BODY_AI.message = message; bodyAiStatus.textContent = message; }
function bodyAiWorkerStop(){
  if(BODY_AI.worker){ BODY_AI.worker.terminate(); BODY_AI.worker = null; }
  const pending = BODY_AI.pending;
  BODY_AI.pending = null;
  if(pending){ clearTimeout(pending.timer); pending.reject(new Error("Đã dừng nhận diện")); }
}
function bodyAiWorker(){
  if(BODY_AI.worker) return BODY_AI.worker;
  const program = '"use strict"; const start = ' + bodyAiEngine.toString() + `;
    let engine;
    self.onmessage = async ({data}) => {
      const {id, image, assets} = data;
      try{
        if(!engine) engine = await start(assets, message => self.postMessage({id, message}));
        const result = await engine.detect(image, message => self.postMessage({id, message}));
        self.postMessage({id, result});
      }catch(error){ engine = null; self.postMessage({id, error:String(error.message || error)}); }
      finally{ if(image && image.close) image.close(); }
    };`;
  const url = URL.createObjectURL(new Blob([program], {type:"text/javascript"}));
  let worker;
  try{ worker = new Worker(url); }finally{ URL.revokeObjectURL(url); }
  worker.onmessage = ({data}) => {
    const pending = BODY_AI.pending;
    if(!pending || pending.id !== data.id) return;
    if(data.message){ if(data.id === BODY_AI.job) bodyAiMessage(data.message); return; }
    clearTimeout(pending.timer); BODY_AI.pending = null;
    if(data.error) pending.reject(new Error(data.error)); else pending.resolve(data.result);
  };
  worker.onerror = event => { event.preventDefault(); bodyAiWorkerStop(); };
  worker.onmessageerror = () => bodyAiWorkerStop();
  BODY_AI.worker = worker;
  return worker;
}
async function bodyAiDetect(input, id){
  if(typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined" && typeof createImageBitmap === "function"){
    let bitmap;
    try{
      const worker = bodyAiWorker();
      bitmap = await createImageBitmap(input);
      if(id !== BODY_AI.job){ bitmap.close(); throw new Error("Ảnh đã đổi"); }
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => bodyAiWorkerStop(), 120000);
        BODY_AI.pending = {id, timer, resolve, reject};
        try{ worker.postMessage({id, image:bitmap, assets:BODY_AI_ASSETS}, [bitmap]); bitmap = null; }
        catch(error){ clearTimeout(timer); BODY_AI.pending = null; reject(error); }
      });
    }catch(error){
      if(bitmap) bitmap.close();
      bodyAiWorkerStop();
      if(id !== BODY_AI.job) throw error;
    }
  }
  // Worker bị chặn vẫn có đường dự phòng; mọi thao tác chỉnh tay hoạt động độc lập.
  if(!BODY_AI.main) BODY_AI.main = bodyAiEngine(BODY_AI_ASSETS, message => {
    if(id === BODY_AI.job) bodyAiMessage(message);
  }).catch(error => { BODY_AI.main = null; throw error; });
  const engine = await BODY_AI.main;
  if(id !== BODY_AI.job) throw new Error("Ảnh đã đổi");
  return engine.detect(input,message => { if(id === BODY_AI.job) bodyAiMessage(message); });
}

/* Hình học dùng đơn vị chiều cao ảnh (x nhân W/H), đúng quy ước của bộ vòng cũ.
   Chỉ dùng mốc nằm trong ảnh, đủ visibility/presence; không bịa vị trí chân bị cắt.
   Eo/bụng/hông là ước lượng theo thân người, không phải phân vùng từng điểm ảnh. */
function bodyAiRegions(pose, face, W, H){
  const regions = {}, aspect = W/H;
  const point = (list, i, threshold=.65) => {
    const p = list && list[i];
    if(!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1 ||
       (p.visibility != null && p.visibility < threshold) || (p.presence != null && p.presence < threshold)) return null;
    return {x:p.x*aspect, y:p.y};
  };
  const mix = (a,b,t) => ({x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t});
  const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const angle = (a,b) => ((Math.atan2(-(b.x-a.x),b.y-a.y)*180/Math.PI + 270)%180)-90;
  function put(id,c,rx,ry,rot=0){
    if(!c || ![c.x,c.y,rx,ry,rot].every(Number.isFinite) || c.x < 0 || c.x > aspect || c.y < 0 || c.y > 1 || rx < .004 || ry < .004) return;
    regions[id] = {cx:c.x/aspect, cy:c.y, rx:Math.min(rx,.7), ry:Math.min(ry,.7), rot};
  }
  let chin = null;
  if(face){
    const top = point(face,10), bottom = point(face,152), left = point(face,234), right = point(face,454);
    if(top && bottom && left && right){
      const height = dist(top,bottom), width = dist(left,right), center = mix(top,bottom,.5), rot = angle(top,bottom);
      if(height > .02 && width > .015){
        put("face",center,width*.58,height*.57,rot);
        chin = bottom;
        put("chin",mix(top,bottom,1.015),width*.37,height*.15,rot);
      }
    }
  }
  if(!pose) return regions;
  const q = i => point(pose,i);
  if(!regions.face){
    const left = q(7), right = q(8), nose = q(0), eyeL = q(2), eyeR = q(5);
    const a = left || eyeL, b = right || eyeR;
    if(a && b && nose){
      const width = dist(a,b)*(left && right ? 1.15 : 2.4);
      const center = {x:nose.x, y:nose.y-width*.08};
      put("face",center,width*.56,width*.72,Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI % 180);
      chin = {x:center.x, y:center.y+width*.66};
    }
  }
  const sl = q(11), sr = q(12), hl = q(23), hr = q(24);
  const shoulderSpan = sl && sr ? dist(sl,sr) : 0;
  const shoulder = sl && sr ? mix(sl,sr,.5) : null;
  const hips = hl && hr ? mix(hl,hr,.5) : null;
  if(shoulder && shoulderSpan > .025){
    const rot = Math.atan2(sr.y-sl.y,sr.x-sl.x)*180/Math.PI;
    const sides = [sl,sr].sort((a,b) => a.x-b.x);
    put("shL",sides[0],shoulderSpan*.23,shoulderSpan*.15,rot);
    put("shR",sides[1],shoulderSpan*.23,shoulderSpan*.15,rot);
    if(chin && dist(chin,shoulder) < shoulderSpan*1.4)
      put("neck",mix(chin,shoulder,.55),shoulderSpan*.15,Math.max(dist(chin,shoulder)*.57,shoulderSpan*.12),angle(chin,shoulder));
  }
  if(shoulder && hips && shoulderSpan > .025){
    const length = dist(shoulder,hips), hipSpan = dist(hl,hr), rot = angle(shoulder,hips);
    if(length > shoulderSpan*.35 && length < shoulderSpan*4){
      const halfWidth = t => (shoulderSpan*(1-t)+hipSpan*t)*.58;
      put("chest",mix(shoulder,hips,.22),halfWidth(.22),length*.20,rot);
      put("waist",mix(shoulder,hips,.63),halfWidth(.63),length*.17,rot);
      put("belly",mix(shoulder,hips,.83),halfWidth(.83),length*.19,rot);
      put("hip",hips,hipSpan*.78,length*.20,rot);
    }
  }
  function limbs(prefix, pairs, width){
    const found = pairs.map(([i,j]) => {
      const a=q(i), b=q(j);
      return a && b && dist(a,b) > .025 ? {a,b,c:mix(a,b,.5)} : null;
    }).filter(Boolean).sort((a,b) => a.c.x-b.c.x);
    found.forEach((limb,i) => {
      const side = found.length === 2 ? (i === 0 ? "L" : "R") : (limb.c.x < (shoulder ? shoulder.x : aspect/2) ? "L" : "R");
      const length = dist(limb.a,limb.b);
      put(prefix+side,limb.c,length*width,length*.62,angle(limb.a,limb.b));
    });
  }
  limbs("arm",[[11,13],[12,14]],.25);
  limbs("th",[[23,25],[24,26]],.27);
  limbs("cl",[[25,27],[26,28]],.21);
  // Lưng/mông không có mốc đủ để biết mặt trước/sau: giữ chỉnh tay.
  return regions;
}
function bodyAiPeople(result,W,H){
  const aspect = W/H, poses = result.poses || [], faces = result.faces || [], used = new Set();
  const entries = poses.map(pose => ({pose,face:null}));
  const matches = [];
  entries.forEach((entry,i) => faces.forEach((face,j) => {
    const nose = entry.pose[0], faceNose = face[1], top=face[10], chin=face[152];
    if(!nose || !faceNose || !top || !chin || (nose.visibility != null && nose.visibility < .5)) return;
    const distance = Math.hypot((nose.x-faceNose.x)*aspect,nose.y-faceNose.y);
    const height = Math.hypot((top.x-chin.x)*aspect,top.y-chin.y);
    if(distance < Math.max(.035,height*.65)) matches.push({i,j,distance});
  }));
  matches.sort((a,b) => a.distance-b.distance).forEach(({i,j}) => {
    if(!entries[i].face && !used.has(j)){ entries[i].face=faces[j]; used.add(j); }
  });
  faces.forEach((face,j) => { if(!used.has(j)) entries.push({pose:null,face}); });
  return entries.map(entry => {
    const regions = bodyAiRegions(entry.pose,entry.face,W,H), centers = Object.values(regions);
    if(!centers.length) return null;
    const xs=centers.map(p=>p.cx), ys=centers.map(p=>p.cy);
    const minX=Math.min(...centers.map(p=>p.cx-p.rx/aspect)), maxX=Math.max(...centers.map(p=>p.cx+p.rx/aspect));
    const minY=Math.min(...centers.map(p=>p.cy-p.ry)), maxY=Math.max(...centers.map(p=>p.cy+p.ry));
    return {regions, x:xs.reduce((a,b)=>a+b,0)/xs.length, y:ys.reduce((a,b)=>a+b,0)/ys.length,
            area:(maxX-minX)*(maxY-minY)};
  }).filter(Boolean).sort((a,b) => a.x-b.x || a.y-b.y);
}
function bodyAiCurrent(){
  const person = BODY_AI.people[BODY_AI.selected];
  return person ? person.regions : {};
}
function bodyAiUntouched(p){
  if(bodyActive(p) || p.place === "manual") return false;
  if(p.place === "ai") return true;
  const d = BODY_DEF.find(d => d[0] === p.id);
  return d && ["cx","cy","rx","ry","rot"].every((key,i) => Math.abs(p[key]-d[i+2]) < .000001);
}
function bodyAiPlaceAll(){
  const regions=bodyAiCurrent(); let count=0;
  BODY.parts.forEach(p => {
    if(!bodyAiUntouched(p)) return;
    if(regions[p.id]){ Object.assign(p,regions[p.id],{place:"ai"}); count++; }
    else if(p.place === "ai"){            // vòng AI đặt cho người trước, người này không có vùng đó: trả về mặc định
      const d = BODY_DEF.find(d => d[0] === p.id);
      if(d) Object.assign(p,{cx:d[2],cy:d[3],rx:d[4],ry:d[5],rot:d[6],place:"default"});
    }
  });
  return count;
}
function bodyAiUI(){
  bodyAiScan.disabled = !source || BODY_AI.busy;
  bodyAiScan.textContent = BODY_AI.busy ? "AI đang nhận diện…" : (BODY_AI.people.length ? "AI · Nhận diện lại" : "AI · Nhận diện bộ phận");
  bodyAiAlign.disabled = BODY_AI.busy || !BODY.sel || !bodyAiCurrent()[BODY.sel];
  bodyAiPerson.disabled = BODY_AI.busy;
  bodyAiPerson.parentElement.hidden = BODY_AI.people.length < 2;
  const regions=bodyAiCurrent();
  BODY.parts.forEach(p => {
    const chip=bodyChipEls[p.id];
    chip.classList.toggle("ai-hit",!!regions[p.id]);
    chip.title = regions[p.id] ? "AI đã tìm thấy vùng gợi ý. Có thể kéo vòng để sửa vị trí." : "Đặt vòng thủ công; AI chưa xác định được vùng này.";
  });
}
function bodyAiReset(){
  BODY_AI.job++;
  if(BODY_AI.busy) bodyAiWorkerStop();
  BODY_AI.people=[]; BODY_AI.selected=0; BODY_AI.busy=false;
  bodyAiPerson.replaceChildren();
  bodyAiMessage("Bấm nhận diện để AI gợi ý vị trí các bộ phận.");
}
function bodyAiApplyPerson(){
  bodyEnd(); bodyBegin("ai-place");
  const count=bodyAiPlaceAll();
  bodyEnd();
  const regions=bodyAiCurrent(), ids=Object.keys(regions);
  if(!BODY.sel || (!bodyActive(bodyPart(BODY.sel)) && !regions[BODY.sel])) BODY.sel=ids[0] || BODY.sel;
  BODY.hide=false;
  bodyUI(); syncBody();
  bodyAiMessage("Tìm thấy " + ids.length + " vùng gợi ý · đặt " + count + " vòng. Vòng đã chỉnh được giữ nguyên. Chấm xanh: có gợi ý AI.");
}
bodyAiScan.onclick = async () => {
  if(!source || BODY_AI.busy) return;
  const image=source, id=++BODY_AI.job;
  BODY_AI.busy=true; bodyAiUI(); bodyAiMessage("Đang chuẩn bị AI; lần đầu cần mạng và tải vài chục MB, có thể mất một lúc…");
  const input=document.createElement("canvas"), scale=Math.min(1,1280/Math.max(image.width,image.height));
  input.width=Math.max(1,Math.round(image.width*scale)); input.height=Math.max(1,Math.round(image.height*scale));
  try{
    input.getContext("2d").drawImage(image,0,0,input.width,input.height);
    const result=await bodyAiDetect(input,id);
    if(id !== BODY_AI.job || source !== image) return;
    const people=bodyAiPeople(result,image.width,image.height);
    if(!people.length){
      bodyAiMessage("Chưa nhận diện rõ người trong ảnh. Thử ảnh rõ hơn hoặc đặt vòng thủ công; các chỉnh sửa vẫn được giữ.");
      return;
    }
    BODY_AI.people=people;
    BODY_AI.selected=people.reduce((best,p,i)=>p.area>people[best].area?i:best,0);
    bodyAiPerson.replaceChildren();
    people.forEach((person,i) => {
      const option=document.createElement("option"); option.value=String(i);
      option.textContent="Người " + (i+1) + " · " + (person.x<.38 ? "bên trái" : person.x>.62 ? "bên phải" : "ở giữa");
      bodyAiPerson.appendChild(option);
    });
    bodyAiPerson.value=String(BODY_AI.selected);
    bodyAiApplyPerson();
    if(result.errors && result.errors.length) bodyAiMessage(BODY_AI.message + " Một mô hình chưa tải được; có thể bấm nhận diện lại.");
  }catch(_){
    if(id === BODY_AI.job && source === image)
      bodyAiMessage("Chưa chạy được AI. Kiểm tra mạng hoặc mở trang bằng Safari/Chrome rồi thử lại. Vẫn chỉnh tay bình thường.");
  }finally{
    input.width=input.height=0;
    if(id === BODY_AI.job){ BODY_AI.busy=false; bodyAiUI(); }
  }
};
bodyAiPerson.onchange = () => {
  if(BODY_AI.busy) return;
  const index=Number(bodyAiPerson.value);
  if(!Number.isInteger(index) || !BODY_AI.people[index]) return;
  BODY_AI.selected=index; bodyAiApplyPerson();
};
bodyAiAlign.onclick = () => {
  const p=bodyPart(BODY.sel), region=bodyAiCurrent()[BODY.sel];
  if(!p || !region || BODY_AI.busy) return;
  bodyEnd(); bodyBegin("ai-align");
  Object.assign(p,region,{place:"ai"});
  bodyEnd(); BODY.hide=false; bodyUI(); syncBody();
  if(bodyActive(p)) queue();
  bodyAiMessage("Đã đặt vòng " + p.name.toLowerCase() + " theo gợi ý AI. Có thể kéo lại vòng cho khớp; các thanh giữ nguyên.");
};
bodyAiUI();


