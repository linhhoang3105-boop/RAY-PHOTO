/* ============ chỉnh dáng: giao diện ============ */
const bodyHead = $("#bodyHead"), bodyHeadTxt = $("#bodyHeadTxt"), bodyBox = $("#bodyBox"),
      bodyPartsEl = $("#bodyParts"), bodyCtl = $("#bodyCtl"), bodyName = $("#bodyName"), bodySlHost = $("#bodySliders"),
      bodyOval = $("#bodyOval"), bodyTag = $("#bodyTag"), bodyArrow = $("#bodyArrow"),
      bodyRotH = $("#bodyRot"), bodySizeH = $("#bodySize"),
      bodyHideBtn = $("#bodyHide"), bodyPeekBtn = $("#bodyPeek");
const pct = v => Math.round(v*100), deg = v => Math.round(v) + "°";
const BODY_SL = [
  ["size","To / nhỏ",-1,1,.01,0,fmt],
  ["wid","Ngang · bè ↔ thon",-1,1,.01,0,fmt],
  ["len","Dọc · dài ↔ ngắn",-1,1,.01,0,fmt],
  ["push","Đẩy theo hướng",0,1,.01,0,pct],
  ["dir","Hướng đẩy",0,360,1,0,deg],
  ["soft","Độ mềm viền",0,1,.01,.5,pct],
  ["rot","Xoay vòng",-180,180,1,0,deg]
];
/* ---- lịch sử: mỗi lần chỉnh (một lần kéo thanh, một lần kéo vòng, một lần đặt lại) là một bước quay lại ---- */
const BODY_HIST = { undo:[], redo:[], pending:null, tag:"" };
const bodySnap = () => JSON.stringify(BODY.parts);
function bodyHistUI(){
  const u = BODY_HIST.undo.length, r = BODY_HIST.redo.length;
  document.querySelectorAll(".bundo").forEach(b => { b.disabled = !u; b.textContent = "↶ Quay lại" + (u ? " · " + u : ""); });
  document.querySelectorAll(".bredo").forEach(b => { b.disabled = !r; b.textContent = "↷ Làm lại" + (r ? " · " + r : ""); });
}
function bodyEnd(){               // kết thúc một lần chỉnh: có đổi thật thì mới thành một bước
  const h = BODY_HIST;
  if(h.pending === null) return;
  if(h.pending !== bodySnap()){
    h.undo.push(h.pending);
    if(h.undo.length > 200) h.undo.shift();
    h.redo.length = 0;
  }
  h.pending = null; h.tag = "";
  bodyHistUI();
}
function bodyBegin(tag){          // gọi TRƯỚC khi đổi: nhớ trạng thái cũ
  const h = BODY_HIST;
  if(h.pending !== null && h.tag !== tag) bodyEnd();
  if(h.pending === null){ h.pending = bodySnap(); h.tag = tag; }
}
function bodyRestore(json){
  JSON.parse(json).forEach(d => { const p = bodyPart(d.id); if(p) Object.assign(p, d); });
  bodyUI(); syncBody(); queue(); bodyHistUI();
}
function bodyUndo(){
  bodyEnd();
  const h = BODY_HIST; if(!h.undo.length) return;
  h.redo.push(bodySnap());
  bodyRestore(h.undo.pop());
}
function bodyRedo(){
  bodyEnd();
  const h = BODY_HIST; if(!h.redo.length) return;
  h.undo.push(bodySnap());
  bodyRestore(h.redo.pop());
}
document.querySelectorAll(".bundo").forEach(b => { b.onclick = bodyUndo; });
document.querySelectorAll(".bredo").forEach(b => { b.onclick = bodyRedo; });
window.addEventListener("keydown", e => {
  if(!BODY.open || !(e.ctrlKey || e.metaKey)) return;
  const t = e.target; if(t && t.tagName === "INPUT" && t.type === "text") return;
  const k = (e.key || "").toLowerCase();
  if(k === "z"){ e.preventDefault(); if(e.shiftKey) bodyRedo(); else bodyUndo(); }
  else if(k === "y"){ e.preventDefault(); bodyRedo(); }
});

const bodyRows = [];
BODY_SL.forEach(([key, name, lo, hi, step, def, f]) => {
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = '<div class="t"><span>' + name + '</span><em>0</em></div>' +
    '<input type="range" min="' + lo + '" max="' + hi + '" step="' + step + '" data-bk="' + key + '" aria-label="' + name + '">';
  bodySlHost.appendChild(row);
  const inp = row.querySelector("input"), em = row.querySelector("em");
  bodyRows.push({ key, inp, em, f });
  inp.addEventListener("input", () => {
    const p = bodyPart(BODY.sel); if(!p) return;
    bodyBegin("sl:" + p.id + ":" + key);
    p[key] = parseFloat(inp.value);
    if(key === "rot") p.place = "manual";
    em.textContent = f(p[key]);
    bodyChips(); syncBody(); queue();
  });
  inp.addEventListener("change", bodyEnd);
  inp.addEventListener("dblclick", () => {
    const p = bodyPart(BODY.sel); if(!p) return;
    bodyEnd(); bodyBegin("dbl");
    p[key] = def; inp.value = def; em.textContent = f(def);
    if(key === "rot") p.place = "manual";
    bodyChips(); syncBody(); queue();
    bodyEnd();
  });
});
const bodyChipEls = {};
BODY.parts.forEach(p => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "bp"; b.textContent = p.name;
  b.onclick = () => {
    BODY.sel = BODY.sel === p.id ? null : p.id;
    BODY.hide = false;
    bodyUI(); syncBody();
    if(BODY.sel) bodyReveal();
  };
  bodyPartsEl.appendChild(b);
  bodyChipEls[p.id] = b;
});
function bodyChips(){
  BODY.parts.forEach(p => {
    bodyChipEls[p.id].classList.toggle("mod", bodyActive(p));
    bodyChipEls[p.id].classList.toggle("on", p.id === BODY.sel);
  });
}
function bodySyncSliders(){
  const p = bodyPart(BODY.sel); if(!p) return;
  bodyRows.forEach(r => { r.inp.value = p[r.key]; r.em.textContent = r.f(p[r.key]); });
}
function bodyUI(){
  const p = bodyPart(BODY.sel);
  bodyChips();
  bodyCtl.hidden = !p;
  if(p){ bodyName.textContent = p.name; bodySyncSliders(); }
  bodyHideBtn.textContent = BODY.hide ? "Hiện vòng" : "Ẩn vòng";
  bodyHideBtn.classList.toggle("on", BODY.hide);
  bodyAiUI();
}
function bodyReveal(){           // màn hình nhỏ: cuộn bảng để thấy các thanh của bộ phận vừa chọn
  const sc = document.querySelector(".scroll"), r = bodyCtl.getBoundingClientRect(), s = sc.getBoundingClientRect();
  if(r.bottom > s.bottom || r.top < s.top) sc.scrollTo({ top: sc.scrollTop + (r.top - s.top) - 6, behavior: "smooth" });
}
const bodyStep = d => () => {
  const i = BODY.parts.findIndex(p => p.id === BODY.sel); if(i < 0) return;
  BODY.sel = BODY.parts[(i + d + BODY.parts.length) % BODY.parts.length].id;
  BODY.hide = false;
  bodyUI(); syncBody();
};
$("#bodyPrev").onclick = bodyStep(-1);
$("#bodyNext").onclick = bodyStep(1);
function bodyReset(){            // ảnh mới → vòng và thanh về mặc định
  bodyDefaults();
  BODY.sel = null; BODY.hide = false; BODY.peek = false;
  BODY_HIST.undo.length = 0; BODY_HIST.redo.length = 0; BODY_HIST.pending = null; BODY_HIST.tag = "";
  bodyAiReset();
  bodyUI(); syncBody(); bodyHistUI();
}
bodyHead.onclick = () => {
  BODY.open = !BODY.open;
  bodyBox.hidden = !BODY.open;
  bodyHead.setAttribute("aria-expanded", BODY.open ? "true" : "false");
  bodyHeadTxt.textContent = BODY.open ? "đóng ▴" : "mở ▾";
  syncBody();
};
bodyHideBtn.onclick = () => { BODY.hide = !BODY.hide; bodyUI(); syncBody(); };
$("#bodyReset1").onclick = () => {
  const p = bodyPart(BODY.sel); if(!p) return;
  bodyEnd(); bodyBegin("reset");
  p.size = p.wid = p.len = p.push = 0; p.dir = 0; p.soft = .5;
  bodyUI(); syncBody(); queue();
  bodyEnd();
};
$("#bodyResetAll").onclick = () => {
  bodyEnd(); bodyBegin("resetAll");
  const keep = BODY.sel;
  bodyDefaults();
  bodyAiPlaceAll();
  BODY.sel = keep;
  bodyUI(); syncBody(); queue();
  bodyEnd();
};
/* giữ nút để xem ảnh gốc (chưa chỉnh dáng) */
const bodyPeekSet = on => {
  if(BODY.peek === on) return;
  BODY.peek = on;
  bodyPeekBtn.classList.toggle("on", on);
  queue();
};
bodyPeekBtn.addEventListener("pointerdown", e => { bodyPeekSet(true); try{ bodyPeekBtn.setPointerCapture(e.pointerId); }catch(_){} e.preventDefault(); });
["pointerup","pointercancel","lostpointercapture"].forEach(ev => bodyPeekBtn.addEventListener(ev, () => bodyPeekSet(false)));
window.addEventListener("blur", () => bodyPeekSet(false));
bodyPeekBtn.addEventListener("contextmenu", e => e.preventDefault());

/* đặt vòng lên ảnh */
function bodyGeo(){
  if(!LASTG) return null;
  const cr = view.getBoundingClientRect();
  const k = cr.width / (LASTG.W + 2*LASTG.bw);          // điểm hiển thị trên mỗi điểm ảnh của canvas
  return { k, ox: cr.left + LASTG.bw*k, oy: cr.top + LASTG.bw*k, W: LASTG.W, H: LASTG.H };
}
function syncBody(){
  const p = bodyPart(BODY.sel);
  const g = bodyGeo();
  const show = !!(p && g && BODY.open && !BODY.hide && !stage.classList.contains("empty"));
  bodyOval.classList.toggle("on", show);
  if(!show) return;
  const wr = wrap.getBoundingClientRect();
  const cxp = g.ox + p.cx*g.W*g.k - wr.left, cyp = g.oy + p.cy*g.H*g.k - wr.top;
  const Rx = p.rx*g.H*g.k, Ry = p.ry*g.H*g.k;
  bodyOval.style.left = cxp + "px";
  bodyOval.style.top = cyp + "px";
  bodyOval.style.width = (Rx*2) + "px";
  bodyOval.style.height = (Ry*2) + "px";
  bodyOval.style.transform = "translate(-50%,-50%) rotate(" + p.rot + "deg)";
  bodyTag.textContent = p.name;
  bodyTag.style.transform = "translate(-50%,-50%) rotate(" + (-p.rot) + "deg)";
  const showArrow = p.push > 0.01;
  bodyArrow.classList.toggle("on", showArrow);
  if(showArrow) bodyArrow.firstElementChild.style.transform = "rotate(" + (p.dir - p.rot) + "deg)";
}
function bodyLocal(g, p, e){      // vị trí con trỏ trong hệ của vòng (gốc ở tâm vòng, đơn vị điểm hiển thị)
  const a = p.rot*Math.PI/180, cs = Math.cos(a), sn = Math.sin(a);
  const dx = e.clientX - (g.ox + p.cx*g.W*g.k), dy = e.clientY - (g.oy + p.cy*g.H*g.k);
  return { x: cs*dx + sn*dy, y: -sn*dx + cs*dy };
}
let bdrag = null;
function bodyDown(mode, el){
  return e => {
    const p = bodyPart(BODY.sel), g = bodyGeo(); if(!p || !g) return;
    if(mode === "move" && e.target !== bodyOval) return;
    bodyEnd(); bodyBegin("drag");
    bdrag = { mode, g, p, x:e.clientX, y:e.clientY, cx:p.cx, cy:p.cy, rx:p.rx, ry:p.ry, rot:p.rot,
              loc: bodyLocal(g, p, e),
              ang: Math.atan2(e.clientY - (g.oy + p.cy*g.H*g.k), e.clientX - (g.ox + p.cx*g.W*g.k)) };
    try{ el.setPointerCapture(e.pointerId); }catch(_){}
    e.stopPropagation(); e.preventDefault();
  };
}
function bodyMove(e){
  if(!bdrag) return;
  const { mode, g, p } = bdrag;
  p.place = "manual";
  if(mode === "move"){
    p.cx = clamp(bdrag.cx + (e.clientX - bdrag.x)/(g.W*g.k), 0, 1);
    p.cy = clamp(bdrag.cy + (e.clientY - bdrag.y)/(g.H*g.k), 0, 1);
  }else if(mode === "size"){
    const l = bodyLocal(g, p, e);
    p.rx = clamp(bdrag.rx + (l.x - bdrag.loc.x)/(g.H*g.k), 0.015, 0.7);
    p.ry = clamp(bdrag.ry + (l.y - bdrag.loc.y)/(g.H*g.k), 0.015, 0.7);
  }else if(mode === "rot"){
    const a = Math.atan2(e.clientY - (g.oy + p.cy*g.H*g.k), e.clientX - (g.ox + p.cx*g.W*g.k));
    let r = bdrag.rot + (a - bdrag.ang)*180/Math.PI;
    r = ((r + 180) % 360 + 360) % 360 - 180;
    if(Math.abs(r) < 3) r = 0;
    p.rot = Math.round(r*10)/10;
    bodyRows.forEach(x => { if(x.key === "rot"){ x.inp.value = p.rot; x.em.textContent = x.f(p.rot); } });
  }
  syncBody();
  if(bodyActive(p)) queue();
}
const bodyUp = () => { bdrag = null; bodyEnd(); };
[[bodyOval,"move"],[bodySizeH,"size"],[bodyRotH,"rot"]].forEach(([el, mode]) => {
  el.addEventListener("pointerdown", bodyDown(mode, el));
  el.addEventListener("pointermove", bodyMove);
  el.addEventListener("pointerup", bodyUp);
  el.addEventListener("pointercancel", bodyUp);
});

