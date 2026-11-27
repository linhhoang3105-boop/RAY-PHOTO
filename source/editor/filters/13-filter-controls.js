/* cuộn phim */
const rollsEl = $("#rolls");
let lastG = null;
ROLLS.forEach((r, idx) => {
  if(r.g && r.g !== lastG){
    const hd = document.createElement("div");
    hd.className = "rollhead";
    hd.textContent = r.g;
    rollsEl.appendChild(hd);
  }
  lastG = r.g;
  const b = document.createElement("button");
  b.className = "roll" + (idx === 0 ? " on" : "");
  b.innerHTML = '<i style="background:' + r.dot + '"></i>' + r.name;
  b.onclick = () => {
    P.haltint = 0;
    P.glow = 0;
    P.nang = 0;
    P.filmExp = 0;
    P.sharp = 0;
    P.kinh = 0;
    P.spark = 0;
    P.paper = 0; P.gloss = 0; P.soft = 0; P.ptex = 0; P.film = 0; P.printClear = 0;
    Object.assign(P, r.p);
    document.querySelectorAll(".roll").forEach(x => x.classList.remove("on"));
    b.classList.add("on");
    syncControls();
    queue();
  };
  rollsEl.appendChild(b);
});

/* thanh trượt */
function addSliders(host, list){
  list.forEach(([key, name, lo, hi]) => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML =
      '<div class="t"><span>' + name + '</span><em data-v="' + key + '">0</em></div>' +
      '<input type="range" min="' + lo + '" max="' + hi + '" step="0.01" data-k="' + key + '" aria-label="' + name + '">';
    host.appendChild(row);
    const inp = row.querySelector("input");
    inp.addEventListener("input", () => {
      P[key] = parseFloat(inp.value);
      row.querySelector("em").textContent = fmt(P[key]);
      document.querySelectorAll(".roll").forEach(x => x.classList.remove("on"));
      queue();
    });
  });
}
const fmt = v => (v > 0 ? "+" : "") + Math.round(v*100);

addSliders($("#grpColor"), SLIDERS_COLOR);
addSliders($("#grpFilm"), SLIDERS_FILM);
addSliders($("#grpPrint"), SLIDERS_PRINT);

function syncControls(){
  document.querySelectorAll("input[type=range][data-k]").forEach(inp => {
    const k = inp.dataset.k;
    inp.value = P[k];
    const em = document.querySelector('em[data-v="' + k + '"]');
    if(em){
      if(k === "motionAngle" || k === "leakHue" || k === "leakAngle") em.textContent = Math.round(P[k]) + "°";
      else if(k === "leakSat" || k === "nangSat" || k === "nangSize") em.textContent = Math.round(P[k]*100);
      else em.textContent = fmt(P[k]);
    }
  });
  document.querySelectorAll("#frameSeg button").forEach(b =>
    b.classList.toggle("on", b.dataset.v === P.frame));
}

/* khung */
$("#frameSeg").addEventListener("click", e => {
  const b = e.target.closest("button"); if(!b) return;
  P.frame = b.dataset.v;
  document.querySelectorAll("#frameSeg button").forEach(x => x.classList.remove("on"));
  b.classList.add("on");
  queue();
});

/* kích thước xuất ảnh */
let exportLong = null;   // null = giữ nguyên kích thước gốc
$("#sizeSeg").addEventListener("click", e => {
  const b = e.target.closest("button"); if(!b) return;
  exportLong = b.dataset.v === "full" ? null : parseInt(b.dataset.v, 10);
  document.querySelectorAll("#sizeSeg button").forEach(x => x.classList.remove("on"));
  b.classList.add("on");
});

