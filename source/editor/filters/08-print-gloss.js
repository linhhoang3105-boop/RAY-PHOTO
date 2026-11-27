/* ============ bề mặt bóng (giấy ảnh in glossy) ============
   Giấy bóng thật khác giấy mờ ở ba điểm; mô phỏng đúng ba điểm đó thay vì phủ một lớp sáng lên ảnh:
   1) Không có lớp tán xạ trên mặt → đen đậm, tương phản cục bộ cao, chi tiết vùng tối nổi.
      Làm bằng tương phản cục bộ dạng NHÂN: gain = (L / L_mờ)^k  → đen 0 vẫn là 0, vùng tối bung chi tiết mà không bị nâng sáng.
   2) Mặt gương phản chiếu môi trường: một nguồn sáng lớn, mềm (cửa sổ) hiện thành MỘT mảng sáng có mép mềm,
      dịu dần ra xa, hơi gợn vì giấy RC không phẳng tuyệt đối. Chỉ một mảng cục bộ, không phủ toàn ảnh.
   3) Phản chiếu cộng sáng (screen) nhưng có trọng số theo tông: đen sâu gần như không bị nâng → không sương;
      vùng trung/sáng nhận phản chiếu rõ nhất.
   Mọi bản đồ tính ở độ phân giải thô (cạnh dài 192) rồi nội suy → nhanh, và preview/xuất ảnh ra cùng một kết quả. */
function glossSurface(c, W, H, P){
  const gl = P.gloss;
  const rg = rng((P.seed ^ 0x2B7E1516) >>> 0);        // bộ ngẫu nhiên riêng, không làm lệch hiệu ứng khác
  const GL = 192;
  const GW = Math.max(16, Math.round(W >= H ? GL : GL*W/H));
  const GH = Math.max(16, Math.round(H >= W ? GL : GL*H/W));
  const GN = GW*GH;

  // ---- thu nhỏ ảnh (từng nửa một cho khỏi răng cưa) → bản đồ độ sáng, làm mờ hộp 3 lượt ≈ Gaussian ----
  let cur = c.canvas, cw = W, ch = H, held = null;
  while(cw > GW*2 && ch > GH*2){
    const nw = Math.max(GW, Math.round(cw/2)), nh = Math.max(GH, Math.round(ch/2));
    const nc = document.createElement("canvas");
    nc.width = nw; nc.height = nh;
    const nx = nc.getContext("2d");
    nx.imageSmoothingEnabled = true; nx.imageSmoothingQuality = "high";
    nx.drawImage(cur, 0, 0, nw, nh);
    if(held){ held.width = 0; held.height = 0; }
    held = nc; cur = nc; cw = nw; ch = nh;
  }
  const sc = document.createElement("canvas");
  sc.width = GW; sc.height = GH;
  const sx = sc.getContext("2d", {willReadFrequently:true});
  sx.imageSmoothingEnabled = true; sx.imageSmoothingQuality = "high";
  sx.drawImage(cur, 0, 0, GW, GH);
  const sd = sx.getImageData(0,0,GW,GH).data;
  sc.width = 0; sc.height = 0;
  if(held){ held.width = 0; held.height = 0; }

  let L = new Float32Array(GN), T = new Float32Array(GN);
  for(let i=0;i<GN;i++){
    const k = i*4;
    L[i] = (sd[k]*.2126 + sd[k+1]*.7152 + sd[k+2]*.0722)/255;
  }
  const R = 4, RN = 2*R+1;                              // bán kính ≈ 2,3% cạnh dài: cỡ mắt, mũi, mảng sáng tối — không phải lỗ chân lông
  const blurH = (src, dst) => {
    for(let y=0;y<GH;y++){
      const row = y*GW; let acc = 0;
      for(let k=-R;k<=R;k++) acc += src[row + (k<0 ? 0 : k>GW-1 ? GW-1 : k)];
      for(let x=0;x<GW;x++){
        dst[row+x] = acc/RN;
        const a = x+R+1, b = x-R;
        acc += src[row + (a>GW-1 ? GW-1 : a)] - src[row + (b<0 ? 0 : b)];
      }
    }
  };
  const blurV = (src, dst) => {
    for(let x=0;x<GW;x++){
      let acc = 0;
      for(let k=-R;k<=R;k++) acc += src[(k<0 ? 0 : k>GH-1 ? GH-1 : k)*GW + x];
      for(let y=0;y<GH;y++){
        dst[y*GW+x] = acc/RN;
        const a = y+R+1, b = y-R;
        acc += src[(a>GH-1 ? GH-1 : a)*GW + x] - src[(b<0 ? 0 : b)*GW + x];
      }
    }
  };
  for(let pass=0;pass<3;pass++){ blurH(L, T); blurV(T, L); }

  const E = 0.035;                                      // chặn tỉ số ở vùng đen gần 0 để không khuếch đại nhiễu
  const lnB = new Float32Array(GN);
  for(let i=0;i<GN;i++) lnB[i] = Math.log(L[i] + E);
  const lnL = new Float32Array(256), wClar = new Float32Array(256), wSh = new Float32Array(256);
  for(let i=0;i<256;i++){
    const l = i/255;
    lnL[i]   = Math.log(l + E);
    wClar[i] = (1 - 0.65*smooth(0.72, 1, l)) * (0.6 + 0.4*smooth(0, 0.1, l));   // dịu ở sát trắng (khỏi cháy) và sát đen (khỏi nhiễu)
    wSh[i]   = 0.08 + 0.92*smooth(0.03, 0.55, l);                              // đen sâu chỉ nhận ~8% phản chiếu → không sương
  }

  // ---- trường phản chiếu: một cửa sổ sáng mềm, hướng và vị trí theo seed ----
  const side = rg() < 0.5 ? -1 : 1;
  const ang  = (rg() < 0.5 ? -1 : 1) * (12 + rg()*28) * Math.PI/180;   // mép nghiêng 12–40°
  const nX = -Math.sin(ang), nY = Math.cos(ang);
  const c0 = 0.08 + rg()*0.20;                                         // vị trí mép sáng (đơn vị: đường chéo ảnh)
  const NL = 6;
  const lat1 = new Float32Array((NL+1)*(NL+1)), lat2 = new Float32Array((NL+1)*(NL+1));
  for(let i=0;i<lat1.length;i++){ lat1[i] = rg()*2-1; lat2[i] = rg()*2-1; }
  const wave = (lat, fx, fy) => {                                      // nhiễu giá trị mượt, tần số rất thấp
    const gx = fx*NL, gy = fy*NL;
    const x0 = Math.min(NL-1, gx|0), y0 = Math.min(NL-1, gy|0);
    let tx = gx-x0, ty = gy-y0; tx = tx*tx*(3-2*tx); ty = ty*ty*(3-2*ty);
    const q = NL+1;
    return (lat[y0*q+x0]*(1-tx) + lat[y0*q+x0+1]*tx)*(1-ty) + (lat[(y0+1)*q+x0]*(1-tx) + lat[(y0+1)*q+x0+1]*tx)*ty;
  };
  const diag = Math.sqrt(W*W + H*H);
  const S = new Float32Array(GN);
  for(let gy=0;gy<GH;gy++){
    const fy = (gy+0.5)/GH;
    for(let gx=0;gx<GW;gx++){
      const fx = (gx+0.5)/GW;
      const pr = side * (((fx-0.5)*W)*nX + ((fy-0.5)*H)*nY) / diag;
      const t  = pr - c0 + 0.03*wave(lat1, fx, fy);                    // mép gợn nhẹ
      const ramp = Math.pow(smooth(-0.58, 0, t), 1.5);                 // sáng dần từ xa vào phía mép
      const cut  = 1 - smooth(0, 0.13, t);                             // mép mềm phía ngoài
      const dt   = (t + 0.02)/0.055;
      const rim  = 0.32*Math.exp(-dt*dt);                              // dọc mép hơi sáng hơn
      S[gy*GW+gx] = ramp*cut*(1 + rim)*(1 + 0.10*wave(lat2, fx, fy));
    }
  }

  // ---- áp lên ảnh: nội suy song tuyến từ bản đồ thô ----
  const id = c.getImageData(0,0,W,H), d = id.data;
  const X0 = new Int32Array(W), FX = new Float32Array(W);
  for(let x=0;x<W;x++){
    let u = (x+0.5)/W*GW - 0.5; if(u<0) u=0; else if(u>GW-1) u=GW-1;
    const x0 = Math.min(GW-2, u|0);
    X0[x] = x0; FX[x] = u - x0;
  }
  const kc = 0.30*gl;                                   // sức tương phản cục bộ
  const ks = 0.30*gl;                                   // sức phản chiếu (đỉnh mép sáng ≈ +30% phần còn thiếu tới trắng ở tông trung)
  const tR = 1, tG = 0.985, tB = 0.955;                 // phản chiếu trắng ngả ấm nhẹ
  let ds = ((P.seed|0) * 2654435761 ^ 0x9E3779B9) >>> 0; if(!ds) ds = 1;   // xorshift32: rải nhiễu ±0,5 mã để dải sáng không bị vằn bậc
  const rowLn = new Float32Array(GW), rowS = new Float32Array(GW);     // hai bản đồ đã nội suy theo chiều dọc cho dòng hiện tại
  for(let y=0;y<H;y++){
    let v = (y+0.5)/H*GH - 0.5; if(v<0) v=0; else if(v>GH-1) v=GH-1;
    const y0 = Math.min(GH-2, v|0), fy = v - y0;
    const r0 = y0*GW, r1 = r0 + GW, base = y*W*4;
    for(let k=0;k<GW;k++){
      rowLn[k] = lnB[r0+k] + (lnB[r1+k] - lnB[r0+k])*fy;
      rowS[k]  = S[r0+k]   + (S[r1+k]   - S[r0+k])*fy;
    }
    for(let x=0;x<W;x++){
      const i = base + x*4;
      const x0 = X0[x], fx = FX[x];
      const lb = rowLn[x0] + (rowLn[x0+1] - rowLn[x0])*fx;
      const sh = rowS[x0]  + (rowS[x0+1]  - rowS[x0])*fx;

      let r = d[i], g = d[i+1], b = d[i+2];
      const lum = r*.2126 + g*.7152 + b*.0722;
      const li = (lum + 0.5) | 0;

      // (1) tương phản cục bộ nhân: e = k·ln(L/L_mờ); gain ≈ exp(e)
      let e = (lnL[li] - lb) * kc * wClar[li];
      if(e > 0.26) e = 0.26; else if(e < -0.22) e = -0.22;
      const gain = 1 + e + 0.5*e*e + e*e*e/6;
      r *= gain; g *= gain; b *= gain;
      if(r > 255) r = 255; if(g > 255) g = 255; if(b > 255) b = 255;

      // (2)+(3) phản chiếu cộng sáng (screen), trọng số theo tông mới
      let li2 = (lum*gain + 0.5) | 0; if(li2 > 255) li2 = 255;
      const A = ks * sh * wSh[li2];
      if(A > 0.0015){
        r += (255 - r)*A*tR; g += (255 - g)*A*tG; b += (255 - b)*A*tB;
      }

      ds ^= ds << 13; ds ^= ds >>> 17; ds ^= ds << 5;
      const n = ((ds >>> 0) / 4294967296) - 0.5;
      d[i] = r + n; d[i+1] = g + n; d[i+2] = b + n;
    }
  }
  c.putImageData(id, 0, 0);
}

