/* ============ nối dây giao diện ============ */
const stage = $("#stage"), view = $("#view"), drop = $("#drop"),
      fileIn = $("#file"), saveBtn = $("#save"), busy = $("#busy");
let source = null, preview = null, raf = 0;

function makePreview(bmp){
  const cap = Math.min(1500, Math.max(900, Math.round(window.innerWidth * (window.devicePixelRatio||1))));
  const s = Math.min(1, cap / Math.max(bmp.width, bmp.height));
  const cv = document.createElement("canvas");
  cv.width = Math.round(bmp.width*s);
  cv.height = Math.round(bmp.height*s);
  cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
  return cv;
}

function draw(){
  if(!preview) return;
  render(view, preview);
  syncOval();
  syncLeakHandle();
  syncNangHandle();
  syncBody();
}
function queue(){
  if(raf) return;
  raf = requestAnimationFrame(() => { raf = 0; draw(); });
}

/* báo lỗi ngay trên khung ảnh (trình xem nhúng như iOS có thể chặn alert) */
function note(msg){
  busy.textContent = msg;
  busy.style.pointerEvents = "none";
  busy.classList.add("on");
  setTimeout(() => {
    if(busy.textContent !== msg) return;
    busy.classList.remove("on");
    busy.style.pointerEvents = "";
    busy.textContent = "Đang dựng bản đầy đủ…";
  }, 7000);
}

/* đọc ảnh: thử lần lượt vài cách — trình xem nhúng (iOS) có thể không hỗ trợ hoặc chặn cách đầu tiên */
async function readImage(file){
  const viaImg = src => new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("không giải mã được ảnh"));
    im.src = src;
  });
  const tries = [
    () => createImageBitmap(file, {imageOrientation:"from-image"}),
    () => viaImg(URL.createObjectURL(file)),
    () => new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = () => rej(new Error("không đọc được tệp"));
      fr.readAsDataURL(file);
    }).then(viaImg),
    () => createImageBitmap(file)
  ];
  const limit = pr => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error("đọc ảnh quá lâu")), 12000))]);   // một cách bị treo thì sang cách khác
  let last = null;
  for(const t of tries){
    try{ return await limit(t()); }catch(e){ last = e; }
  }
  throw last || new Error("không đọc được ảnh");
}

async function load(file){
  if(!file) return;
  const okType = !file.type || file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(file.name || "");
  if(!okType){ note("Tệp này không phải ảnh"); return; }
  try{
    const bmp = await readImage(file);
    source = bmp;
    preview = makePreview(bmp);
    stage.classList.remove("empty");
    saveBtn.disabled = false;
    bodyReset();
    beautyReset();
    draw();
  }catch(e){
    note("Chưa mở được ảnh: " + ((e && e.message) || e));
  }
}

