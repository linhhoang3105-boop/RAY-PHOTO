/* lưu */
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent)
         || (navigator.userAgent.includes("Mac") && "ontouchend" in document);

const sheet = $("#sheet"), sheetImg = $("#sheetImg"),
      sheetShare = $("#sheetShare"), sheetTip = $("#sheetTip");
let lastBlob = null, lastName = "";

function release(cv){ if(cv && cv !== source){ cv.width = 0; cv.height = 0; } }

function scaledSource(src, s){
  if(s >= 0.999) return src;
  const cv = document.createElement("canvas");
  cv.width  = Math.max(1, Math.round(src.width*s));
  cv.height = Math.max(1, Math.round(src.height*s));
  cv.getContext("2d").drawImage(src, 0, 0, cv.width, cv.height);
  return cv;
}
function toBlobSafe(cv, ms){
  return new Promise((resolve, reject) => {
    let done = false;
    const t = setTimeout(() => {
      if(!done){ done = true; reject(new Error("máy dựng quá lâu")); }
    }, ms);
    try{
      cv.toBlob(b => {
        if(done) return;
        done = true; clearTimeout(t);
        b ? resolve(b) : reject(new Error("máy không tạo được file"));
      }, "image/jpeg", 0.94);
    }catch(e){
      done = true; clearTimeout(t); reject(e);
    }
  });
}
const nextFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

function stamp(){
  const dt = new Date(), pad = n => String(n).padStart(2,"0");
  return "buongtoi-" + dt.getFullYear() + pad(dt.getMonth()+1) + pad(dt.getDate())
       + "-" + pad(dt.getHours()) + pad(dt.getMinutes()) + ".jpg";
}

function canvasToData(cv){
  try{
    const u = cv.toDataURL("image/jpeg", 0.9);
    return (u && u.length > 1000) ? u : null;
  }catch(e){ return null; }
}

async function makeOutput(cv){
  // Safari mở từ file:// chỉ cho lưu ảnh dạng data:, nên ưu tiên đường đó
  const dataUrl = IOS ? canvasToData(cv) : null;
  let blob = null;
  if(!dataUrl || !IOS || navigator.canShare !== undefined){
    try{ blob = await toBlobSafe(cv, 25000); }
    catch(e){ if(!dataUrl) throw e; }
  }
  if(!dataUrl && !blob) throw new Error("máy không xuất được ảnh");
  return {dataUrl, blob};
}

function openSheet(out, name, w, h){
  lastBlob = out.blob; lastName = name;
  if(sheetImg.dataset.obj){ URL.revokeObjectURL(sheetImg.src); delete sheetImg.dataset.obj; }
  if(out.dataUrl){
    sheetImg.src = out.dataUrl;
  }else{
    sheetImg.src = URL.createObjectURL(out.blob);
    sheetImg.dataset.obj = "1";
  }

  const canShare = !!(out.blob && navigator.canShare
    && navigator.canShare({files:[new File([out.blob], name, {type:"image/jpeg"})]}));
  sheetShare.style.display = canShare ? "" : "none";
  sheetTip.innerHTML = canShare
    ? 'Bấm <b>Chia sẻ · Lưu</b> rồi chọn <b>Lưu Ảnh</b>. Hoặc nhấn giữ vào ảnh và chọn <b>Thêm vào Ảnh</b>.'
    : 'Nhấn giữ vào ảnh khoảng một giây, rồi chọn <b>Thêm vào Ảnh</b>.';

  const kb = out.dataUrl ? Math.round(out.dataUrl.length*0.75/1024)
                         : Math.round(out.blob.size/1024);
  $("#sheetDiag").textContent =
    w + "×" + h + " · " + kb + " KB · " + (out.dataUrl ? "data" : "blob");
  sheet.classList.add("on");
}
$("#sheetClose").onclick = () => {
  sheet.classList.remove("on");
  if(sheetImg.dataset.obj){ URL.revokeObjectURL(sheetImg.src); delete sheetImg.dataset.obj; }
  sheetImg.removeAttribute("src");
  lastBlob = null;
};
sheetShare.onclick = async () => {
  if(!lastBlob) return;
  try{
    await navigator.share({
      files: [new File([lastBlob], lastName, {type:"image/jpeg"})]
    });
  }catch(e){ /* người dùng bấm huỷ thì thôi */ }
};

saveBtn.onclick = async () => {
  if(!source) return;
  const MAXPX = IOS ? 4e6 : 16e6;           // Safari iOS siết bộ nhớ canvas rất chặt
  const longEdge = Math.max(source.width, source.height);
  const sizeCap = exportLong ? Math.min(1, exportLong / longEdge) : 1;
  const fit = Math.min(sizeCap, Math.sqrt(MAXPX / (source.width * source.height)));
  const ladder = IOS ? [fit, fit*0.6, fit*0.4] : [fit, fit*0.62, fit*0.42];

  saveBtn.disabled = true;
  busy.classList.add("on");
  let err = null;

  for(let i=0;i<ladder.length;i++){
    busy.textContent = i === 0
      ? "Đang dựng bản đầy đủ…"
      : "Ảnh nặng quá — đang dựng bản gọn hơn…";
    await nextFrame();

    let src = null, full = null;
    try{
      src = scaledSource(source, ladder[i]);
      full = document.createElement("canvas");
      render(full, src);
      const w = full.width, h = full.height;
      const out = await makeOutput(full);
      const name = stamp();

      if(IOS){
        openSheet(out, name, w, h);
      }else{
        const a = document.createElement("a");
        a.download = name;
        a.href = out.blob ? URL.createObjectURL(out.blob) : out.dataUrl;
        document.body.appendChild(a);
        a.click();
        a.remove();
        if(out.blob) setTimeout(() => URL.revokeObjectURL(a.href), 8000);
      }
      err = null;
      break;
    }catch(e){
      err = e;
    }finally{
      release(src); release(full);
    }
  }

  busy.classList.remove("on");
  busy.textContent = "Đang dựng bản đầy đủ…";
  saveBtn.disabled = false;
  if(err){
    alert("Chưa lưu được: " + err.message
      + ".\n\nThử hạ Hạt phim và Quầng sáng xuống rồi lưu lại.");
  }
};

