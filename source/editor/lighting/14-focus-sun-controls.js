/* vùng lấy nét chọn lọc (mờ nền) */
const wrap = $("#canvasWrap"), oval = $("#focusOval"), handle = $("#focusHandle");
const bgBlurInput = document.querySelector('input[data-k="bgBlur"]');

function syncOval(){
  const cr = view.getBoundingClientRect();
  const wr = wrap.getBoundingClientRect();
  const left = cr.left - wr.left, top = cr.top - wr.top;
  oval.style.left   = (left + F.cx*cr.width) + "px";
  oval.style.top    = (top  + F.cy*cr.height) + "px";
  oval.style.width  = (F.rx*2*cr.width) + "px";
  oval.style.height = (F.ry*2*cr.height) + "px";
  oval.classList.toggle("on", (P.bgBlur > 0.001 || P.motion > 0.001 || P.rgAtmos !== "off") && !stage.classList.contains("empty"));
}

bgBlurInput.addEventListener("input", () => {
  P.bgBlur = parseFloat(bgBlurInput.value);
  document.querySelector('em[data-v="bgBlur"]').textContent = fmt(P.bgBlur);
  document.querySelectorAll(".roll").forEach(x => x.classList.remove("on"));
  syncOval();
  queue();
});

const motionInput = document.querySelector('input[data-k="motion"]');
motionInput.addEventListener("input", () => {
  P.motion = parseFloat(motionInput.value);
  document.querySelector('em[data-v="motion"]').textContent = fmt(P.motion);
  document.querySelectorAll(".roll").forEach(x => x.classList.remove("on"));
  syncOval();
  queue();
});

const motionAngleInput = document.querySelector('input[data-k="motionAngle"]');
motionAngleInput.addEventListener("input", () => {
  P.motionAngle = parseFloat(motionAngleInput.value);
  document.querySelector('em[data-v="motionAngle"]').textContent = Math.round(P.motionAngle) + "°";
  queue();
});

const rgAtmosSeg = $("#rgAtmosSeg");
rgAtmosSeg.addEventListener("click", e => {
  const b = e.target.closest("button"); if(!b) return;
  P.rgAtmos = b.dataset.v;
  document.querySelectorAll("#rgAtmosSeg button").forEach(x => x.classList.remove("on"));
  b.classList.add("on");
  syncOval();
  queue();
});

/* vệt nắng — kéo tay */
const leakHandle = $("#leakHandle");

function syncLeakHandle(){
  const cr = view.getBoundingClientRect();
  const wr = wrap.getBoundingClientRect();
  const left = cr.left - wr.left, top = cr.top - wr.top;
  leakHandle.style.left = (left + LK.x*cr.width) + "px";
  leakHandle.style.top  = (top  + LK.y*cr.height) + "px";
  leakHandle.classList.toggle("on", P.leakManual && P.leak > 0.001 && !stage.classList.contains("empty"));
}

leakHandle.addEventListener("pointerdown", e => {
  leakHandle.setPointerCapture(e.pointerId);
  e.preventDefault();
});
leakHandle.addEventListener("pointermove", e => {
  if(e.buttons === 0 && e.pointerType !== "touch") return;
  const f = clientToFrac(e.clientX, e.clientY);
  LK.x = clamp(f.x, 0, 1);
  LK.y = clamp(f.y, 0, 1);
  syncLeakHandle();
  queue();
});

/* nắng — kéo tay */
const nangHandle = $("#nangHandle");

function syncNangHandle(){
  const cr = view.getBoundingClientRect();
  const wr = wrap.getBoundingClientRect();
  const left = cr.left - wr.left, top = cr.top - wr.top;
  nangHandle.style.left = (left + NK.x*cr.width) + "px";
  nangHandle.style.top  = (top  + NK.y*cr.height) + "px";
  nangHandle.classList.toggle("on", P.nangManual && P.nang > 0.001 && !stage.classList.contains("empty"));
}

nangHandle.addEventListener("pointerdown", e => {
  nangHandle.setPointerCapture(e.pointerId);
  e.preventDefault();
});
nangHandle.addEventListener("pointermove", e => {
  if(e.buttons === 0 && e.pointerType !== "touch") return;
  const f = clientToFrac(e.clientX, e.clientY);
  NK.x = clamp(f.x, 0, 1);
  NK.y = clamp(f.y, 0, 1);
  syncNangHandle();
  queue();
});

const nangModeSeg = $("#nangModeSeg");
nangModeSeg.addEventListener("click", e => {
  const b = e.target.closest("button"); if(!b) return;
  P.nangManual = b.dataset.v === "manual";
  document.querySelectorAll("#nangModeSeg button").forEach(x => x.classList.remove("on"));
  b.classList.add("on");
  syncNangHandle();
  queue();
});

const nangSizeInput = document.querySelector('input[data-k="nangSize"]');
nangSizeInput.addEventListener("input", () => {
  P.nangSize = parseFloat(nangSizeInput.value);
  document.querySelector('em[data-v="nangSize"]').textContent = Math.round(P.nangSize*100);
  queue();
});

/* lấp lánh */
const sparkInput = document.querySelector('input[data-k="spark"]');
sparkInput.addEventListener("input", () => {
  P.spark = parseFloat(sparkInput.value);
  document.querySelector('em[data-v="spark"]').textContent = fmt(P.spark);
  document.querySelectorAll(".roll").forEach(x => x.classList.remove("on"));
  queue();
});
const sparkModeSeg = $("#sparkModeSeg");
sparkModeSeg.addEventListener("click", e => {
  const b = e.target.closest("button"); if(!b) return;
  P.sparkMode = b.dataset.v;
  document.querySelectorAll("#sparkModeSeg button").forEach(x => x.classList.remove("on"));
  b.classList.add("on");
  queue();
});

const leakModeSeg = $("#leakModeSeg");
leakModeSeg.addEventListener("click", e => {
  const b = e.target.closest("button"); if(!b) return;
  P.leakManual = b.dataset.v === "manual";
  document.querySelectorAll("#leakModeSeg button").forEach(x => x.classList.remove("on"));
  b.classList.add("on");
  syncLeakHandle();
  queue();
});

const leakShapeSeg = $("#leakShapeSeg");
const leakAngleRow = $("#leakAngleRow");
leakShapeSeg.addEventListener("click", e => {
  const b = e.target.closest("button"); if(!b) return;
  P.leakShape = b.dataset.v;
  document.querySelectorAll("#leakShapeSeg button").forEach(x => x.classList.remove("on"));
  b.classList.add("on");
  leakAngleRow.style.display = (P.leakShape === "patch") ? "" : "none";
  queue();
});

const leakAngleInput = document.querySelector('input[data-k="leakAngle"]');
leakAngleInput.addEventListener("input", () => {
  P.leakAngle = parseFloat(leakAngleInput.value);
  document.querySelector('em[data-v="leakAngle"]').textContent = Math.round(P.leakAngle) + "°";
  queue();
});

const leakBandWidthInput = document.querySelector('input[data-k="leakBandWidth"]');
leakBandWidthInput.addEventListener("input", () => {
  P.leakBandWidth = parseFloat(leakBandWidthInput.value);
  document.querySelector('em[data-v="leakBandWidth"]').textContent = fmt(P.leakBandWidth);
  queue();
});

const leakHueInput = document.querySelector('input[data-k="leakHue"]');
leakHueInput.addEventListener("input", () => {
  P.leakHue = parseFloat(leakHueInput.value);
  document.querySelector('em[data-v="leakHue"]').textContent = Math.round(P.leakHue) + "°";
  queue();
});

const leakSatInput = document.querySelector('input[data-k="leakSat"]');
leakSatInput.addEventListener("input", () => {
  P.leakSat = parseFloat(leakSatInput.value);
  document.querySelector('em[data-v="leakSat"]').textContent = Math.round(P.leakSat*100);
  queue();
});

const nangSatInput = document.querySelector('input[data-k="nangSat"]');
nangSatInput.addEventListener("input", () => {
  P.nangSat = parseFloat(nangSatInput.value);
  document.querySelector('em[data-v="nangSat"]').textContent = Math.round(P.nangSat*100);
  queue();
});

function clientToFrac(clientX, clientY){
  const r = view.getBoundingClientRect();
  return {
    x: (clientX - r.left) / r.width,
    y: (clientY - r.top)  / r.height
  };
}

let dragMode = null, dragStart = null, focusStart = null;

oval.addEventListener("pointerdown", e => {
  if(e.target === handle) return;   // handle xử lý riêng (phóng to)
  dragMode = "move";
  dragStart = clientToFrac(e.clientX, e.clientY);
  focusStart = { cx:F.cx, cy:F.cy };
  oval.setPointerCapture(e.pointerId);
  e.preventDefault();
});

handle.addEventListener("pointerdown", e => {
  dragMode = "resize";
  dragStart = clientToFrac(e.clientX, e.clientY);
  focusStart = { rx:F.rx, ry:F.ry };
  handle.setPointerCapture(e.pointerId);
  e.stopPropagation();
  e.preventDefault();
});

function onPointerMove(e){
  if(!dragMode) return;
  const now = clientToFrac(e.clientX, e.clientY);
  const dx = now.x - dragStart.x, dy = now.y - dragStart.y;
  if(dragMode === "move"){
    F.cx = clamp(focusStart.cx + dx, 0.05, 0.95);
    F.cy = clamp(focusStart.cy + dy, 0.05, 0.95);
  }else if(dragMode === "resize"){
    F.rx = clamp(focusStart.rx + dx, 0.08, 0.9);
    F.ry = clamp(focusStart.ry + dy, 0.08, 0.9);
  }
  syncOval();
  queue();
}
oval.addEventListener("pointermove", onPointerMove);
handle.addEventListener("pointermove", onPointerMove);
["pointerup","pointercancel"].forEach(ev => {
  oval.addEventListener(ev, () => { dragMode = null; });
  handle.addEventListener(ev, () => { dragMode = null; });
});

