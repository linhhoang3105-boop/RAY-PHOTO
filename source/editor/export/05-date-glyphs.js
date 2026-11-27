/* ============ chữ số 7 đoạn ============ */
const SEG = {
  "0":"abcdef","1":"bc","2":"abged","3":"abgcd","4":"fgbc",
  "5":"afgcd","6":"afgedc","7":"abc","8":"abcdefg","9":"abgfcd"
};
function drawDigit(ctx,x,y,w,h,t,ch){
  const on = SEG[ch]; if(!on) return;
  const half = h/2, arm = half - t*0.75;
  const boxes = {
    a:[t*.5, 0, w-t, t],
    b:[w-t, t*.5, t, arm],
    c:[w-t, half + t*.25, t, arm],
    d:[t*.5, h-t, w-t, t],
    e:[0, half + t*.25, t, arm],
    f:[0, t*.5, t, arm],
    g:[t*.5, half - t*.5, w-t, t]
  };
  for(const k of on){
    const b = boxes[k];
    ctx.fillRect(x+b[0], y+b[1], b[2], b[3]);
  }
}
function drawStamp(ctx, text, x, y, h, glow){
  const t = Math.max(1, h*0.155);
  const w = h*0.60, gap = h*0.20, spc = h*0.34;
  ctx.save();
  ctx.transform(1,0,-0.10,1, y*0.10, 0);   // hơi nghiêng như máy phim
  ctx.fillStyle = "#FF8A1F";
  if(glow){ ctx.shadowColor = "rgba(255,120,20,.95)"; ctx.shadowBlur = h*0.42; }
  let cx = x;
  for(const ch of text){
    if(ch === " "){ cx += spc; continue; }
    drawDigit(ctx, cx, y, w, h, t, ch);
    cx += w + gap;
  }
  ctx.restore();
  return cx - x;
}
function stampWidth(text,h){
  const w = h*0.60, gap = h*0.20, spc = h*0.34;
  let x = 0;
  for(const ch of text) x += (ch===" ") ? spc : w+gap;
  return x;
}

