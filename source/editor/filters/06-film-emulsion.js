/* ============ Phim tráng in (P.film): một lớp thống nhất mô phỏng phim sau khi tráng, scan, in rửa tiệm ============
   Một thanh trượt điều khiển cả bộ; mỗi phần cắm vào bước ĐÃ CÓ trong pipeline thay vì thêm lớp phủ:
   A. Đường cong đặc tính (buildLUT): mũi mềm, vai cuộn dần (highlight roll-off), ba lớp nhũ lệch nhẹ nhau
      → bóng hơi mát, vùng sáng hơi ấm. Đen 0 vẫn là 0, không nâng nền.
   B. Màu theo dải màu và độ sáng (vòng độ rực ở bước 1): quay hue, độ rực, độ sáng theo từng dải màu
      (xanh lá ngả vàng, xanh trời sâu hơn và ngả lục lam, đỏ ấm…); độ rực theo độ sáng (đậm ở tông trung, dịu ở vùng sáng);
      mật độ thuốc màu: màu đậm hơi tối đi như thuốc in. Dải da được bảo vệ, vùng gần trung tính không bị ám.
   C. Nét quang học (sau "Mềm chi tiết"): lọc thấp mức điểm ảnh + nhấn nhẹ tần số trung, chỉ trên kênh sáng.
   D. Hạt mịn (cạnh bước "Hạt phim"): hạt tương quan nhẹ, hơi lệch màu giữa các lớp.
   C và D tính theo unit = W/1200 nên bản xem trước và bản xuất ra cùng một vẻ. */
const FILM_GAIN = 2;   // thanh 0..1 → cường độ nội bộ 0..2: mức 1 là "phim tráng in" đậm hẳn, thấy rõ cả khi đặt lên bộ màu đã chỉnh mạnh (mức 0,5 ≈ độ đậm của bản đầu)
const FILM_X = [0, 0.12, 0.30, 0.50, 0.70, 0.86, 1];
const FILM_Y = {
  r: [0, 0.098, 0.283, 0.505, 0.735, 0.903, 0.991],
  g: [0, 0.102, 0.289, 0.505, 0.731, 0.895, 0.985],
  b: [0, 0.110, 0.299, 0.508, 0.724, 0.883, 0.974]
};
function monoCurve(xs, ys){                               // nội suy khối Hermite đơn điệu (Fritsch–Carlson): mượt, không vọt
  const n = xs.length, d = new Array(n-1), m = new Array(n);
  for(let i=0;i<n-1;i++) d[i] = (ys[i+1]-ys[i])/(xs[i+1]-xs[i]);
  m[0] = d[0]; m[n-1] = d[n-2];
  for(let i=1;i<n-1;i++) m[i] = d[i-1]*d[i] <= 0 ? 0 : (d[i-1]+d[i])/2;
  for(let i=0;i<n-1;i++){
    if(d[i] === 0){ m[i] = 0; m[i+1] = 0; continue; }
    const a = m[i]/d[i], b = m[i+1]/d[i], s = a*a + b*b;
    if(s > 9){ const t = 3/Math.sqrt(s); m[i] = t*a*d[i]; m[i+1] = t*b*d[i]; }
  }
  return x => {
    if(x <= xs[0]) return ys[0];
    if(x >= xs[n-1]) return ys[n-1];
    let i = 0; while(x > xs[i+1]) i++;
    const h = xs[i+1]-xs[i], t = (x-xs[i])/h, t2 = t*t, t3 = t2*t;
    return (2*t3-3*t2+1)*ys[i] + (t3-2*t2+t)*h*m[i] + (-2*t3+3*t2)*ys[i+1] + (t3-t2)*h*m[i+1];
  };
}
const FILM_HUE = [          // [dải màu°, lệch hue°, hệ số độ rực, hệ số sáng] — phim in tiêu dùng: xanh lá ngả vàng, xanh trời sâu, da giữ nguyên
  [  0,  4, 1.04, -0.010],  // đỏ → hơi cam
  [ 22,  2, 1.00,  0.000],  // đỏ cam (da)
  [ 38,  1, 0.98,  0.008],  // cam (da)
  [ 58, -4, 0.94, -0.010],  // vàng → ngả vàng cam
  [ 80, -8, 0.90, -0.020],  // vàng lục → ngả vàng
  [115,-10, 0.86, -0.040],  // lục → olive, dịu, tối hơn
  [150, -6, 0.90, -0.030],
  [185, -2, 0.92, -0.020],  // lục lam
  [215, -6, 1.06, -0.040],  // trời → ngả lục lam, sâu
  [245, -6, 1.05, -0.050],  // lam
  [275,  0, 0.95, -0.020],
  [305,  6, 0.92, -0.010],  // tím hồng → ngả đỏ
  [335,  4, 0.98, -0.010]
];
const FILM_SATL = [[0,0.90],[0.15,0.98],[0.40,1.06],[0.65,1.03],[0.85,0.93],[1,0.80]];   // độ rực theo độ sáng
function buildFilmColor(f){
  const HA = new Float32Array(360), HSG = new Float32Array(360), HLG = new Float32Array(360), SK = new Float32Array(360);
  const n = FILM_HUE.length;
  for(let h=0;h<360;h++){
    let i = n-1; for(let k=0;k<n;k++) if(FILM_HUE[k][0] <= h) i = k;
    const a = FILM_HUE[i], b = FILM_HUE[(i+1)%n];
    const h0 = a[0]; let h1 = b[0]; if(h1 <= h0) h1 += 360;
    let t = (h-h0)/(h1-h0); t = t*t*(3-2*t);
    HA[h]  = (a[1] + (b[1]-a[1])*t) * f * Math.PI/180;
    HSG[h] = 1 + f*((a[2] + (b[2]-a[2])*t) - 1);
    HLG[h] = f*(a[3] + (b[3]-a[3])*t);
    SK[h]  = smooth(4, 16, h) * (1 - smooth(44, 58, h));
  }
  const SL = new Float32Array(256), WL = new Float32Array(256);
  for(let i=0;i<256;i++){
    const l = i/255; let k = 0;
    while(k < FILM_SATL.length-2 && l > FILM_SATL[k+1][0]) k++;
    const a = FILM_SATL[k], b = FILM_SATL[k+1];
    let t = (l-a[0])/(b[0]-a[0]); t = t*t*(3-2*t);
    SL[i] = 1 + f*((a[1] + (b[1]-a[1])*t) - 1);
    WL[i] = smooth(0.18, 0.55, l) * (1 - 0.5*smooth(0.8, 1, l));    // mật độ chỉ ở tông trung/sáng, đen sâu không bị tối thêm
  }
  return {HA, HSG, HLG, SK, SL, WL, DK: 0.10*f};
}

function filmOptics(c, W, H, f, unit){
  if(W < 16 || H < 16) return;
  const sp = Math.max(1, Math.round(unit));               // khoảng cách mẫu của lọc điểm ảnh (σ ≈ 0,7·sp)
  const ds = Math.max(1.6, 2.6*unit);                     // bản thô cho lọc rộng (σ ≈ 1,3·unit)
  const sw = Math.max(8, Math.round(W/ds)), sh = Math.max(8, Math.round(H/ds));
  const sc = document.createElement("canvas");
  sc.width = sw; sc.height = sh;
  const sx = sc.getContext("2d", {willReadFrequently:true});
  sx.imageSmoothingEnabled = true; sx.imageSmoothingQuality = "high";
  sx.drawImage(c.canvas, 0, 0, sw, sh);
  const sd = sx.getImageData(0,0,sw,sh).data;
  sc.width = 0; sc.height = 0;
  const Ls = new Float32Array(sw*sh);
  for(let i=0;i<Ls.length;i++){ const k = i*4; Ls[i] = sd[k]*.2126 + sd[k+1]*.7152 + sd[k+2]*.0722; }

  const id = c.getImageData(0,0,W,H), d = id.data, N = W*H;
  const Lm = new Float32Array(N);                          // kênh sáng gốc (không bị sửa trong lúc lọc)
  for(let j=0,i=0;j<N;j++,i+=4) Lm[j] = d[i]*.2126 + d[i+1]*.7152 + d[i+2]*.0722;
  const fo = f <= 1 ? f : 1 + 0.25*(f-1);                 // quá mức 1 thì độ nét tăng chậm lại: tránh nhoè hoặc viền sáng
  const a0 = 0.7*fo, k2 = 0.42*fo;                        // lọc thấp điểm ảnh / nhấn tần số trung
  const XL = new Int32Array(W), XR = new Int32Array(W), X0 = new Int32Array(W), FX = new Float32Array(W);
  for(let x=0;x<W;x++){
    XL[x] = x-sp < 0 ? 0 : x-sp; XR[x] = x+sp > W-1 ? W-1 : x+sp;
    let u = (x+0.5)/W*sw - 0.5; if(u<0) u=0; else if(u>sw-1) u=sw-1;
    const x0 = Math.min(sw-2, u|0); X0[x] = x0; FX[x] = u - x0;
  }
  const rowS = new Float32Array(sw);
  for(let y=0;y<H;y++){
    const ru = (y-sp < 0 ? 0 : y-sp)*W, rm = y*W, rd = (y+sp > H-1 ? H-1 : y+sp)*W;
    let v = (y+0.5)/H*sh - 0.5; if(v<0) v=0; else if(v>sh-1) v=sh-1;
    const y0 = Math.min(sh-2, v|0), fy = v - y0, s0 = y0*sw, s1 = s0 + sw;
    for(let k=0;k<sw;k++) rowS[k] = Ls[s0+k] + (Ls[s1+k] - Ls[s0+k])*fy;
    for(let x=0;x<W;x++){
      const xl = XL[x], xr = XR[x], l = Lm[rm+x];
      const b0 = (Lm[ru+xl] + 2*Lm[ru+x] + Lm[ru+xr] + 2*(Lm[rm+xl] + 2*l + Lm[rm+xr]) + Lm[rd+xl] + 2*Lm[rd+x] + Lm[rd+xr]) * 0.0625;
      const x0 = X0[x];
      const bs = rowS[x0] + (rowS[x0+1] - rowS[x0])*FX[x];
      let dl = a0*(b0 - l) + k2*(b0 - bs);
      if(dl > 14) dl = 14; else if(dl < -14) dl = -14;     // chặn viền sáng quanh cạnh rất tương phản
      if(l < 10) dl *= l*0.1;                              // đen sâu giữ nguyên
      const i = (rm + x)*4;
      d[i] += dl; d[i+1] += dl; d[i+2] += dl;
    }
  }
  c.putImageData(id, 0, 0);
}

function filmGrain(c, W, H, P, unit){
  const f = P.film*FILM_GAIN;
  const gs = Math.max(1, unit);                           // cỡ hạt theo unit
  const LW = Math.ceil(W/gs) + 3, LH = Math.ceil(H/gs) + 3, LN = LW*LH;
  const rg = rng((P.seed ^ 0x6A09E667) >>> 0);            // bộ ngẫu nhiên riêng, không làm lệch hiệu ứng khác
  const lattice = () => {                                 // nhiễu trắng làm mượt nhẹ → hạt có độ kết đám ~2 điểm ảnh, chuẩn hoá về std = 1
    const a = new Float32Array(LN), t = new Float32Array(LN);
    let st = (rg()*4294967296) | 0; if(st === 0) st = 0x9E3779B9 | 0;   // xorshift32 chạy thẳng: nhanh hơn gọi rng() hàng triệu lần
    for(let i=0;i<LN;i++){ st ^= st << 13; st ^= st >>> 17; st ^= st << 5; a[i] = st * 4.656612875245797e-10; }   // đều trong [-1, 1)
    for(let y=0;y<LH;y++){ const row = y*LW; for(let x=0;x<LW;x++){
      const xl = x > 0 ? x-1 : 0, xr = x < LW-1 ? x+1 : LW-1;
      t[row+x] = 0.2*a[row+xl] + 0.6*a[row+x] + 0.2*a[row+xr];
    } }
    const K = 1/Math.sqrt(0.44*0.44/3);                    // std của nhiễu đều [-1,1) sau lọc [.2,.6,.2] hai chiều = √(0,44²/3) → nhân K để về 1
    for(let y=0;y<LH;y++){
      const yu = (y > 0 ? y-1 : 0)*LW, ym = y*LW, yd = (y < LH-1 ? y+1 : LH-1)*LW;
      for(let x=0;x<LW;x++) a[ym+x] = K*(0.2*t[yu+x] + 0.6*t[ym+x] + 0.2*t[yd+x]);
    }
    return a;
  };
  const Lr = lattice(), Lg = lattice(), Lb = lattice();
  const id = c.getImageData(0,0,W,H), d = id.data;
  const amp = 3.4*f;                                      // std tính bằng mã màu ở tông trung
  const wLut = new Float32Array(256);
  for(let i=0;i<256;i++){ const l = i/255; wLut[i] = 0.12 + 0.88*smooth(0.02, 0.28, l)*(1 - 0.85*smooth(0.55, 1, l)); }
  const LXi = new Int32Array(W), LFx = new Float32Array(W);
  for(let x=0;x<W;x++){ const u = x/gs, x0 = u|0; LXi[x] = x0; LFx[x] = u - x0; }
  // nội suy song tuyến giữa các nút làm giảm phương sai (nút kề nhau tương quan ~0,545) → bù để ảnh xuất cỡ lớn có hạt đậm bằng bản xem trước
  let vxs = 0, vys = 0;
  for(let x=0;x<W;x++){ const t = LFx[x]; vxs += (1-t)*(1-t) + t*t + 2*t*(1-t)*0.545; }
  for(let y=0;y<H;y++){ const t = y/gs - ((y/gs)|0); vys += (1-t)*(1-t) + t*t + 2*t*(1-t)*0.545; }
  const comp = 1/Math.sqrt((vxs/W)*(vys/H));
  if(gs === 1){                                           // xem trước ở cỡ chuẩn: nút lưới trùng điểm ảnh → khỏi nội suy
    for(let y=0;y<H;y++){
      const rl = y*LW, base = y*W*4;
      for(let x=0;x<W;x++){
        const zr = Lr[rl+x], zg = Lg[rl+x], zb = Lb[rl+x];
        const zc = (zr + zg + zb)*0.57735;
        const i = base + x*4, r = d[i], g = d[i+1], b = d[i+2];
        const s = amp * wLut[((r*.2126 + g*.7152 + b*.0722) + 0.5) | 0];
        d[i]   = r + s*(0.866*zc + 0.6124*(zr - zc*0.57735));
        d[i+1] = g + s*(0.866*zc + 0.6124*(zg - zc*0.57735));
        d[i+2] = b + s*(0.866*zc + 0.6124*(zb - zc*0.57735));
      }
    }
    c.putImageData(id, 0, 0);
    return;
  }
  for(let y=0;y<H;y++){
    const v = y/gs, y0 = v|0, fy = v - y0, r0 = y0*LW, r1 = r0 + LW, base = y*W*4;
    for(let x=0;x<W;x++){
      const x0 = LXi[x], fx = LFx[x];
      const a00 = r0 + x0, a10 = a00 + 1, a01 = r1 + x0, a11 = a01 + 1;
      const w00 = (1-fx)*(1-fy), w10 = fx*(1-fy), w01 = (1-fx)*fy, w11 = fx*fy;
      const zr = Lr[a00]*w00 + Lr[a10]*w10 + Lr[a01]*w01 + Lr[a11]*w11;
      const zg = Lg[a00]*w00 + Lg[a10]*w10 + Lg[a01]*w01 + Lg[a11]*w11;
      const zb = Lb[a00]*w00 + Lb[a10]*w10 + Lb[a01]*w01 + Lb[a11]*w11;
      const zc = (zr + zg + zb)*0.57735;                  // phần chung của ba lớp (hạt sáng)
      const i = base + x*4, r = d[i], g = d[i+1], b = d[i+2];
      const s = amp * comp * wLut[((r*.2126 + g*.7152 + b*.0722) + 0.5) | 0];
      d[i]   = r + s*(0.866*zc + 0.6124*(zr - zc*0.57735));   // tương quan ~0,75 giữa các lớp: hạt chủ yếu là sáng, lệch màu nhẹ
      d[i+1] = g + s*(0.866*zc + 0.6124*(zg - zc*0.57735));
      d[i+2] = b + s*(0.866*zc + 0.6124*(zb - zc*0.57735));
    }
  }
  c.putImageData(id, 0, 0);
}

