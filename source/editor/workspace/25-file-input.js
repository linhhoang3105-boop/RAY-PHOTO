/* mở ảnh */
const onPick = inp => () => {
  const f = inp.files[0];
  if(f) load(f).finally(() => { inp.value = ""; });   // chỉ xoá sau khi đọc xong: iOS có thể thu hồi tệp tạm nếu xoá sớm
  else inp.value = "";
};
fileIn.onchange = onPick(fileIn);
document.querySelectorAll(".pickin").forEach(i => { i.onchange = onPick(i); });

["dragenter","dragover"].forEach(ev =>
  document.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("hot"); }));
["dragleave","drop"].forEach(ev =>
  document.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("hot"); }));
document.addEventListener("drop", e => {
  const f = e.dataTransfer && e.dataTransfer.files[0];
  if(f) load(f);
});
document.addEventListener("paste", e => {
  const it = [...(e.clipboardData ? e.clipboardData.items : [])]
    .find(i => i.type.startsWith("image/"));
  if(it) load(it.getAsFile());
});

