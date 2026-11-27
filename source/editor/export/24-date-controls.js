/* dấu ngày + đồng hồ trên đầu bảng */
const now = new Date();
P.dateText = now.getFullYear() + " " + (now.getMonth()+1) + " " + now.getDate();
const dateTxt = $("#dateTxt");
dateTxt.value = P.dateText;
dateTxt.addEventListener("input", () => {
  P.dateText = dateTxt.value.replace(/[^0-9 ]/g, "");
  dateTxt.value = P.dateText;
  drawReadout(); queue();
});

const ro = $("#readout"), roc = ro.getContext("2d");
function drawReadout(){
  roc.clearRect(0,0,ro.width,ro.height);
  const h = 20;
  const w = stampWidth(P.dateText.trim() || "0", h);
  const s = Math.min(1, (ro.width - 8) / Math.max(w, 1));
  roc.save();
  roc.scale(s, s);
  drawStamp(roc, P.dateText.trim(), 4/s, 5/s, h, false);
  roc.restore();
}
const stampBtn = $("#stampBtn");
stampBtn.onclick = () => {
  P.stamp = !P.stamp;
  stampBtn.classList.toggle("on", P.stamp);
  stampBtn.setAttribute("aria-pressed", String(P.stamp));
  queue();
};
drawReadout();

