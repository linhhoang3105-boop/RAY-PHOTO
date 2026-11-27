/* ============ tiện ích ============ */
const $ = s => document.querySelector(s);
const clamp = (v,a,b) => v<a?a:v>b?b:v;
const smooth = (e0,e1,x) => { const t = clamp((x-e0)/(e1-e0),0,1); return t*t*(3-2*t); };

/* sao 4 cánh lõm (có thể xoay) — dùng cho hiệu ứng lấp lánh */
function sparkStar(ctx, x, y, r, rot){
  ctx.save();
  ctx.translate(x, y);
  if(rot) ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.quadraticCurveTo(0, 0, 0, r);
  ctx.quadraticCurveTo(0, 0, -r, 0);
  ctx.quadraticCurveTo(0, 0, 0, -r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* xoay hue (và có thể chỉnh sắc độ) của một màu RGB — dùng riêng cho vệt nắng/nắng, không đụng tới màu ảnh */
function hueRotate(r,g,b, deg, satMult){
  if(!deg && (satMult==null || satMult===1)) return [r,g,b];
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h=0, s=0; const l=(max+min)/2;
  if(max!==min){
    const d=max-min;
    s = l>0.5 ? d/(2-max-min) : d/(max+min);
    if(max===r) h=(g-b)/d + (g<b?6:0);
    else if(max===g) h=(b-r)/d + 2;
    else h=(r-g)/d + 4;
    h/=6;
  }
  h = (((h*360+(deg||0))/360) % 1 + 1) % 1;
  if(satMult!=null) s = clamp(s*satMult, 0, 1);
  const hue2rgb=(p,q,t)=>{
    if(t<0)t+=1; if(t>1)t-=1;
    if(t<1/6) return p+(q-p)*6*t;
    if(t<1/2) return q;
    if(t<2/3) return p+(q-p)*(2/3-t)*6;
    return p;
  };
  let rr,gg,bb;
  if(s===0){ rr=gg=bb=l; }
  else{
    const q = l<0.5 ? l*(1+s) : l+s-l*s;
    const p = 2*l-q;
    rr=hue2rgb(p,q,h+1/3); gg=hue2rgb(p,q,h); bb=hue2rgb(p,q,h-1/3);
  }
  return [Math.round(rr*255), Math.round(gg*255), Math.round(bb*255)];
}


function rng(seed){
  let a = seed >>> 0;
  return function(){
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t>>>15), t | 1);
    t ^= t + Math.imul(t ^ (t>>>7), t | 61);
    return ((t ^ (t>>>14)) >>> 0) / 4294967296;
  };
}

/* đường bao hơi răng cưa như mép cửa phim lúc quét */
function ragged(x, y, w, h, jit, step, r){
  const pts = [];
  const push = (px, py) => pts.push([px + (r()*2-1)*jit, py + (r()*2-1)*jit]);
  const nx = Math.max(4, Math.round(w/step)), ny = Math.max(4, Math.round(h/step));
  for(let i=0;i<nx;i++) push(x + w*i/nx, y);
  for(let i=0;i<ny;i++) push(x + w, y + h*i/ny);
  for(let i=nx;i>0;i--) push(x + w*i/nx, y + h);
  for(let i=ny;i>0;i--) push(x, y + h*i/ny);
  return pts;
}
function tracePath(ctx, pts){
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

