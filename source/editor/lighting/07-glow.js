/* ============ glow ("Độ bóng"): bloom từ vùng sáng — highlight extraction ============
   1) Mask TỪNG ĐIỂM ẢNH ở độ phân giải đầy đủ: m = smoothstep(HS, HE, luminance).
      Lọc ngưỡng trước khi thu nhỏ nên điểm sáng nhỏ (ánh kim loại, giọt nước, mắt) vẫn góp vào glow;
      thu nhỏ rồi mới lọc ngưỡng thì chúng bị trung bình mất hẳn.
   2) Tích luỹ thẳng vào lưới nhỏ (cạnh dài 192): mask, màu vùng sáng (nhân mask) và độ sáng → làm mờ hộp 3 lượt ≈ Gaussian.
      Làm bằng mảng số thay vì ctx.filter nên Safari/iOS cũng ra cùng kết quả.
   3) Lớp glow = màu vùng sáng đã mờ (ngả trắng ấm); alpha = mask đã mờ × sức glow. Screen lên ảnh GỐC:
        out = base + alpha·glowColor·(1 − base)
      Chỗ không gần vùng sáng thì alpha ≈ 0 → đen không bị nâng, không phủ sương cả ảnh.
   4) Bù tương phản cục bộ nhẹ: screen làm phẳng chi tiết quanh vùng sáng → nhân gain = (L / L_mờ)^k,
      L_mờ là độ sáng nền đã tính cả glow, k tỉ lệ alpha → chỉ tác động nơi glow thật sự hiện. */
function boxBlurGrid(a, tmp, GW, GH, R, passes){
  const RN = 2*R+1;
  for(let p=0;p<passes;p++){
    for(let y=0;y<GH;y++){                              // ngang: a → tmp
      const row = y*GW; let acc = 0;
      for(let k=-R;k<=R;k++) acc += a[row + (k<0 ? 0 : k>GW-1 ? GW-1 : k)];
      for(let x=0;x<GW;x++){
        tmp[row+x] = acc/RN;
        const hi = x+R+1, lo = x-R;
        acc += a[row + (hi>GW-1 ? GW-1 : hi)] - a[row + (lo<0 ? 0 : lo)];
      }
    }
    for(let x=0;x<GW;x++){                              // dọc: tmp → a
      let acc = 0;
      for(let k=-R;k<=R;k++) acc += tmp[(k<0 ? 0 : k>GH-1 ? GH-1 : k)*GW + x];
      for(let y=0;y<GH;y++){
        a[y*GW+x] = acc/RN;
        const hi = y+R+1, lo = y-R;
        acc += tmp[(hi>GH-1 ? GH-1 : hi)*GW + x] - tmp[(lo<0 ? 0 : lo)*GW + x];
      }
    }
  }
}

function glowBloom(c, W, H, P){
  if(W < 4 || H < 4) return;
  const HS = 0.58, HE = 0.96;                           // highlightStart / highlightEnd (độ sáng 0..1)
  const strength = P.glow;
  const GL = 192;
  const GW = Math.max(2, Math.min(W, Math.round(W >= H ? GL : GL*W/H)));
  const GH = Math.max(2, Math.min(H, Math.round(H >= W ? GL : GL*H/W)));
  const GN = GW*GH;

  // ---- bước 1–2: mask từng điểm ảnh → gom vào lưới nhỏ ----
  const id = c.getImageData(0,0,W,H), d = id.data;
  const mLut = new Float32Array(256);
  for(let i=0;i<256;i++) mLut[i] = smooth(HS, HE, i/255);
  const colG = new Int32Array(W), cntX = new Float32Array(GW), cntY = new Float32Array(GH);
  for(let x=0;x<W;x++){ const g = Math.min(GW-1, (x*GW/W)|0); colG[x] = g; cntX[g]++; }
  const sm = new Float32Array(GN), sr = new Float32Array(GN), sg = new Float32Array(GN),
        sb = new Float32Array(GN), sl = new Float32Array(GN), tmp = new Float32Array(GN);
  for(let y=0;y<H;y++){
    const gy = Math.min(GH-1, (y*GH/H)|0); cntY[gy]++;
    const row = gy*GW, base = y*W*4;
    for(let x=0;x<W;x++){
      const i = base + x*4, r = d[i], g = d[i+1], b = d[i+2];
      const lum = r*.2126 + g*.7152 + b*.0722;           // luminance từng điểm ảnh (0..255)
      const idx = row + colG[x];
      sl[idx] += lum;
      const m = mLut[(lum+0.5)|0];                       // smoothstep(HS, HE, luminance)
      if(m > 0){ sm[idx] += m; sr[idx] += m*r; sg[idx] += m*g; sb[idx] += m*b; }
    }
  }
  for(let gy=0;gy<GH;gy++) for(let gx=0;gx<GW;gx++){    // trung bình theo ô; màu và độ sáng về 0..1
    const k = gy*GW+gx, inv = 1/(cntX[gx]*cntY[gy]), inv255 = inv/255;
    sm[k] *= inv; sr[k] *= inv255; sg[k] *= inv255; sb[k] *= inv255; sl[k] *= inv255;
  }
  const R = 4;                                          // σ ≈ 2,3% cạnh dài
  boxBlurGrid(sm, tmp, GW, GH, R, 3); boxBlurGrid(sr, tmp, GW, GH, R, 3);
  boxBlurGrid(sg, tmp, GW, GH, R, 3); boxBlurGrid(sb, tmp, GW, GH, R, 3);
  boxBlurGrid(sl, tmp, GW, GH, R, 3);

  // ---- bước 3–4: lớp glow theo từng ô (biên độ screen từng kênh + độ sáng nền đã tính glow + sức bù) ----
  const E = 0.035;
  const kA = 0.5*strength;                              // alpha tối đa của lớp glow
  const KNEE = 1.8, kneeN = 1/(1 - Math.exp(-KNEE));    // gối mềm: quầng quanh điểm sáng nhỏ vẫn thấy được, vùng sáng phủ kín vẫn đúng alpha tối đa
  const compK = 0.8;                                    // sức bù tương phản (nhẹ)
  const Ar = new Float32Array(GN), Ag = new Float32Array(GN), Ab = new Float32Array(GN),
        Kc = new Float32Array(GN), lnLb = new Float32Array(GN);
  for(let k=0;k<GN;k++){
    const gm = sm[k];                                   // mask đã mờ = độ phủ vùng sáng quanh ô
    const alpha = kA*(1 - Math.exp(-KNEE*gm))*kneeN;    // alpha phụ thuộc mask
    let hr = 1, hg = 1, hb = 1;
    if(gm > 1e-4){ hr = Math.min(1, sr[k]/gm); hg = Math.min(1, sg[k]/gm); hb = Math.min(1, sb[k]/gm); }   // màu trung bình vùng sáng
    Ar[k] = alpha*(0.5*hr + 0.5);                       // ngả trắng ấm: nửa màu vùng sáng, nửa trắng ngà
    Ag[k] = alpha*(0.5*hg + 0.5*0.985);
    Ab[k] = alpha*(0.5*hb + 0.5*0.955);
    const aL = .2126*Ar[k] + .7152*Ag[k] + .0722*Ab[k];
    lnLb[k] = Math.log(sl[k] + aL*(1 - sl[k]) + E);     // độ sáng nền sau glow, làm mốc cho bù tương phản
    Kc[k] = compK*aL;
  }
  const lnL = new Float32Array(256), wC = new Float32Array(256);
  for(let i=0;i<256;i++){
    const l = i/255;
    lnL[i] = Math.log(l + E);
    wC[i]  = (1 - 0.65*smooth(0.72, 1, l)) * (0.6 + 0.4*smooth(0, 0.1, l));   // dịu ở sát trắng (khỏi cháy) và sát đen (khỏi nhiễu)
  }

  // ---- áp lên ảnh: nội suy song tuyến từ lưới nhỏ ----
  const X0 = new Int32Array(W), FX = new Float32Array(W);
  for(let x=0;x<W;x++){
    let u = (x+0.5)/W*GW - 0.5; if(u<0) u=0; else if(u>GW-1) u=GW-1;
    const x0 = Math.min(GW-2, u|0);
    X0[x] = x0; FX[x] = u - x0;
  }
  const rAr = new Float32Array(GW), rAg = new Float32Array(GW), rAb = new Float32Array(GW),
        rK = new Float32Array(GW), rLn = new Float32Array(GW);
  let ds = ((P.seed|0) * 2246822519 ^ 0x85EBCA6B) >>> 0; if(!ds) ds = 1;   // xorshift32: nhiễu ±0,5 mã để dải glow không bị vằn bậc
  for(let y=0;y<H;y++){
    let v = (y+0.5)/H*GH - 0.5; if(v<0) v=0; else if(v>GH-1) v=GH-1;
    const y0 = Math.min(GH-2, v|0), fy = v - y0;
    const r0 = y0*GW, r1 = r0 + GW, base = y*W*4;
    for(let k=0;k<GW;k++){
      rAr[k] = Ar[r0+k] + (Ar[r1+k] - Ar[r0+k])*fy;
      rAg[k] = Ag[r0+k] + (Ag[r1+k] - Ag[r0+k])*fy;
      rAb[k] = Ab[r0+k] + (Ab[r1+k] - Ab[r0+k])*fy;
      rK[k]  = Kc[r0+k] + (Kc[r1+k] - Kc[r0+k])*fy;
      rLn[k] = lnLb[r0+k] + (lnLb[r1+k] - lnLb[r0+k])*fy;
    }
    for(let x=0;x<W;x++){
      const x0 = X0[x], fx = FX[x];
      const ar = rAr[x0] + (rAr[x0+1] - rAr[x0])*fx;
      if(ar < 0.0012) continue;                          // xa vùng sáng: giữ nguyên điểm ảnh
      const ag = rAg[x0] + (rAg[x0+1] - rAg[x0])*fx;
      const ab = rAb[x0] + (rAb[x0+1] - rAb[x0])*fx;
      const i = base + x*4;
      let r = d[i], g = d[i+1], b = d[i+2];
      r += (255 - r)*ar; g += (255 - g)*ag; b += (255 - b)*ab;      // screen lớp glow

      const kk = rK[x0] + (rK[x0+1] - rK[x0])*fx;        // bù tương phản cục bộ: gain ≈ exp(k·ln(L/L_mờ))
      if(kk > 0.002){
        const li = ((r*.2126 + g*.7152 + b*.0722) + 0.5) | 0;
        const lb = rLn[x0] + (rLn[x0+1] - rLn[x0])*fx;
        let e = (lnL[li] - lb) * kk * wC[li];
        if(e > 0.22) e = 0.22; else if(e < -0.18) e = -0.18;
        const gain = 1 + e + 0.5*e*e + e*e*e/6;
        r *= gain; g *= gain; b *= gain;
        if(r > 255) r = 255; if(g > 255) g = 255; if(b > 255) b = 255;
      }
      ds ^= ds << 13; ds ^= ds >>> 17; ds ^= ds << 5;
      const n = ((ds >>> 0) / 4294967296) - 0.5;
      d[i] = r + n; d[i+1] = g + n; d[i+2] = b + n;
    }
  }
  c.putImageData(id, 0, 0);
}

