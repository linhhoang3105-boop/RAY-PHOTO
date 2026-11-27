/* ============ dựng ảnh ============ */
function render(target, src){
  const W = src.width, H = src.height;
  const unit = W/1200;                 // giữ hạt & vệt cùng tỉ lệ ở mọi kích thước
  const rnd = rng(P.seed);

  // khung
  let bw = 0, bb = 0;
  if(P.frame === "scan"){ bw = Math.round(W*0.019); bb = bw; }
  if(P.frame === "film"){ bw = Math.round(W*0.035); bb = bw; }
  if(P.frame === "polaroid"){ bw = Math.round(W*0.055); bb = Math.round(bw*2.7); }

  target.width  = W + bw*2;
  target.height = H + bw + bb;
  if(target === view) LASTG = { W, H, bw, bb };
  const ctx = target.getContext("2d", {willReadFrequently:true});

  // ---- lớp ảnh: không khung thì vẽ thẳng lên target, đỡ hẳn một canvas ----
  let img, c, tmp = false;
  if(bw === 0){
    img = target; c = ctx;
  }else{
    img = document.createElement("canvas");
    img.width = W; img.height = H;
    c = img.getContext("2d", {willReadFrequently:true});
    tmp = true;
  }
  c.drawImage(src, 0, 0);
  beautyApply(c, W, H);                // làm đẹp trước biến dạng: da/tóc/makeup cùng đi theo vùng chỉnh dáng
  bodyWarp(c, W, H);                   // chỉnh dáng: chỉ đổi trong vòng của từng bộ phận

  // 1. lệch màu viền + bảng tra màu + độ rực
  const lut = buildLUT(P);
  const id = c.getImageData(0,0,W,H);
  const d = id.data;
  const off = Math.round(P.ca * unit * 2.6);

  if(off > 0){
    const row = new Uint8ClampedArray(W*4);
    for(let y=0;y<H;y++){
      const base = y*W*4;
      row.set(d.subarray(base, base + W*4));
      for(let x=0;x<W;x++){
        const i = base + x*4;
        const xr = x-off < 0 ? 0 : (x-off > W-1 ? W-1 : x-off);
        const xb = x+off > W-1 ? W-1 : x+off;
        d[i]   = row[xr*4];
        d[i+2] = row[xb*4 + 2];
      }
    }
  }

  // độ rực: phần "Bề mặt bóng" dồn vào vùng tối/trung (màu đậm, dày như lớp thuốc in), vùng sáng giữ sạch — không đẩy da/vùng cháy sáng bị gắt
  const gl = P.gloss||0;
  const sat = 1 + P.sat - 0.08*(P.paper||0);
  const fc = P.film > 0.001 ? buildFilmColor(P.film*FILM_GAIN) : null;
  for(let i=0;i<d.length;i+=4){
    let r = lut.R[d[i]], g = lut.G[d[i+1]], b = lut.B[d[i+2]];
    if(fc){
      // phim tráng in — màu theo dải màu và độ sáng: quay hue + độ rực + độ sáng theo từng dải, mật độ thuốc màu; da được bảo vệ
      const mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
      const mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
      const c0 = mx - mn;
      if(c0 > 0.004){                                       // gần trung tính thì bỏ qua: không ám màu xám
        const l0 = r*.2126 + g*.7152 + b*.0722;
        let h = mx === r ? (g-b)/c0 : (mx === g ? (b-r)/c0 + 2 : (r-g)/c0 + 4);
        h *= 60; if(h < 0) h += 360;
        const hi = h | 0, li0 = (l0*255 + 0.5) | 0;
        let tw = (c0 - 0.012)/0.088; tw = tw < 0 ? 0 : tw > 1 ? 1 : tw;
        const w = tw*tw*(3 - 2*tw);
        const a = fc.HA[hi]*w, co = 1 - a*a*0.5, si = a;   // góc quay nhỏ → xấp xỉ cos/sin
        const r2 = r*(0.213 + co*0.787 - si*0.213) + g*(0.715 - co*0.715 - si*0.715) + b*(0.072 - co*0.072 + si*0.928);
        const g2 = r*(0.213 - co*0.213 + si*0.143) + g*(0.715 + co*0.285 + si*0.140) + b*(0.072 - co*0.072 - si*0.283);
        const b2 = r*(0.213 - co*0.213 - si*0.787) + g*(0.715 - co*0.715 + si*0.715) + b*(0.072 + co*0.928 + si*0.072);
        const sk = fc.SK[hi];                               // 1 ở dải da, 0 ở nơi khác
        let s = (1 + w*(fc.HSG[hi] - 1)) * fc.SL[li0];
        s = 1 + (s - 1)*(1 - 0.5*sk);
        r = l0 + (r2 - l0)*s; g = l0 + (g2 - l0)*s; b = l0 + (b2 - l0)*s;
        const dk = fc.DK * fc.WL[li0] * (c0/(mx + 1e-4)) * (1 - 0.7*sk);    // màu đậm hơi tối đi như thuốc in
        const lg = (1 + w*fc.HLG[hi]) * (1 - dk);
        r *= lg; g *= lg; b *= lg;
        let l1 = l0*lg; if(l1 > 1) l1 = 1;                  // thu về trong gam bằng cách kéo về xám, giữ hue
        const mn2 = r < g ? (r < b ? r : b) : (g < b ? g : b);
        if(mn2 < 0){ const tt = l1/(l1 - mn2); r = l1 + (r-l1)*tt; g = l1 + (g-l1)*tt; b = l1 + (b-l1)*tt; }
        const mx2 = r > g ? (r > b ? r : b) : (g > b ? g : b);
        if(mx2 > 1){ const tt = (1 - l1)/(mx2 - l1); r = l1 + (r-l1)*tt; g = l1 + (g-l1)*tt; b = l1 + (b-l1)*tt; }
      }
    }
    if(sat !== 1 || gl > 0.001){
      const l = r*.2126 + g*.7152 + b*.0722;
      const sp = gl > 0.001 ? sat + gl*(0.05 + 0.23*(1 - smooth(0.3, 0.9, l))) : sat;
      r = l + (r-l)*sp; g = l + (g-l)*sp; b = l + (b-l)*sp;
    }
    d[i]   = r*255; d[i+1] = g*255; d[i+2] = b*255;
  }

  // độ nét: unsharp mask nhẹ (lấy trung bình 4 điểm lân cận làm bản mờ, đẩy khác biệt lên)
  if(P.sharp > 0.001){
    const src = new Uint8ClampedArray(d);
    const amt = P.sharp * 0.9;
    for(let y=1;y<H-1;y++){
      const row = y*W*4, rowU = row-W*4, rowD = row+W*4;
      for(let x=1;x<W-1;x++){
        const i = row + x*4;
        const iL = i-4, iR = i+4, iU = rowU + x*4, iD = rowD + x*4;
        d[i]   = clamp(src[i]   + (src[i]   - (src[iL]+src[iR]+src[iU]+src[iD])/4)*amt, 0, 255);
        d[i+1] = clamp(src[i+1] + (src[i+1] - (src[iL+1]+src[iR+1]+src[iU+1]+src[iD+1])/4)*amt, 0, 255);
        d[i+2] = clamp(src[i+2] + (src[i+2] - (src[iL+2]+src[iR+2]+src[iU+2]+src[iD+2])/4)*amt, 0, 255);
      }
    }
  }

  c.putImageData(id, 0, 0);

  // 1a. mềm chi tiết: pha ảnh với bản thu nhỏ rồi phóng lại → bớt nét gắt kiểu điện thoại, giống ảnh in
  if(P.soft > 0.001){
    const ssz = 1.5 + P.soft*3.5;
    const sw2 = Math.max(16, Math.round(W/ssz)), sh2 = Math.max(16, Math.round(H/ssz));
    const sc = document.createElement("canvas");
    sc.width = sw2; sc.height = sh2;
    const sx2 = sc.getContext("2d");
    sx2.imageSmoothingEnabled = true; sx2.imageSmoothingQuality = "high";
    sx2.drawImage(img, 0, 0, sw2, sh2);
    c.save();
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high";
    c.globalAlpha = clamp(P.soft*0.8, 0, 1);
    c.drawImage(sc, 0, 0, W, H);
    c.restore();
    sc.width = 0; sc.height = 0;
  }

  // 1a'. phim tráng in — nét quang học dịu: lọc thấp mức điểm ảnh + nhấn nhẹ tần số trung trên kênh sáng (bớt gắt mà cạnh vẫn nét)
  if(P.film > 0.001) filmOptics(c, W, H, P.film*FILM_GAIN, unit);

  // 1a''. nước ảnh trong veo: hoàn thiện độ sáng và chiều sâu màu trước các lớp ánh sáng/hạt/khung.
  if(P.printClear > 0.001) clearPrint(c, W, H, P.printClear);

  // 1b. đèn flash: dồn sáng vào giữa, hụt sáng nhanh ra rìa
  if(P.flash > 0.001){
    const cx = W/2, cy = H*0.46, far = Math.max(W,H);
    const gu = c.createRadialGradient(cx, cy, 0, cx, cy, far*0.55);
    gu.addColorStop(0,   "rgba(255,247,233," + (P.flash*0.17).toFixed(3) + ")");
    gu.addColorStop(0.5, "rgba(255,247,233,0)");
    gu.addColorStop(1,   "rgba(255,247,233,0)");
    c.save();
    c.globalCompositeOperation = "screen";
    c.fillStyle = gu; c.fillRect(0,0,W,H);
    c.restore();

    const gd = c.createRadialGradient(cx, cy, Math.min(W,H)*0.16, cx, cy, far*0.70);
    gd.addColorStop(0,   "rgba(255,255,255,1)");
    gd.addColorStop(0.55,"rgba(96,88,78,1)");
    gd.addColorStop(1,   "rgba(10,9,8,1)");
    c.save();
    c.globalCompositeOperation = "multiply";
    c.globalAlpha = P.flash * 0.78;
    c.fillStyle = gd; c.fillRect(0,0,W,H);
    c.restore();
  }

  // ảnh chụp trước khi áp Nắng/Quầng sáng/Độ bóng/Vệt sáng lọt — dùng để khôi phục vùng nét nếu bật giới hạn theo vùng
  let atmosSnap = null;
  if(P.rgAtmos !== "off"){
    atmosSnap = document.createElement("canvas");
    atmosSnap.width = W; atmosSnap.height = H;
    atmosSnap.getContext("2d").drawImage(img, 0, 0);
  }

  // 1c. nắng: quầng nắng ấm từ phía trên + ấm sáng lan nhẹ toàn ảnh
  if(P.nang > 0.001){
    // Độ rực nắng: pha trực tiếp trắng→màu mặc định→vàng cam đậm (không dùng xoay HSL vì màu nắng vốn rất nhạt, sắc độ HSL bị kẹt ở mức tối đa)
    const nRgba = (r,g,b,a) => {
      const t = P.nangSat==null ? 1 : P.nangSat;
      let rr,gg,bb;
      if(t <= 1){
        rr = 255 + (r-255)*t; gg = 255 + (g-255)*t; bb = 255 + (b-255)*t;
      }else{
        const k = t-1;
        rr = r + (Math.max(0,r-90)-r)*k; gg = g + (Math.max(0,g-130)-g)*k; bb = b + (Math.max(0,b-200)-b)*k;
      }
      return "rgba("+Math.round(clamp(rr,0,255))+","+Math.round(clamp(gg,0,255))+","+Math.round(clamp(bb,0,255))+","+a+")";
    };
    const sx = P.nangManual ? NK.x*W : W*0.5;
    const sy = P.nangManual ? NK.y*H : H*0.04;
    const nRad = Math.max(W,H) * (P.nangSize==null ? 0.75 : P.nangSize);
    const gn = c.createRadialGradient(sx, sy, 0, sx, sy, nRad);
    gn.addColorStop(0,   nRgba(255,248,222,1));
    gn.addColorStop(0.38,nRgba(255,220,156,0.6));
    gn.addColorStop(1,   nRgba(255,220,156,0));
    c.save();
    c.globalCompositeOperation = "screen";
    c.globalAlpha = P.nang * 0.85;
    c.fillStyle = gn; c.fillRect(0,0,W,H);
    c.restore();

    c.save();
    c.globalCompositeOperation = "soft-light";
    c.globalAlpha = P.nang * 0.6;
    const gn2 = c.createRadialGradient(sx, sy, 0, sx, sy, nRad*1.3);
    gn2.addColorStop(0, nRgba(255,226,172,1));
    gn2.addColorStop(1, nRgba(255,226,172,0));
    c.fillStyle = gn2;
    c.fillRect(0,0,W,H);
    c.restore();
  }

  // 2. quầng sáng: tách vùng sáng → làm nhòe → phủ chế độ screen
  if(P.halation > 0.001){
    const sw = Math.max(24, Math.round(W/26)), sh = Math.max(24, Math.round(H/26));
    const hc = document.createElement("canvas");
    hc.width = sw; hc.height = sh;
    const hx = hc.getContext("2d", {willReadFrequently:true});
    hx.drawImage(img, 0, 0, sw, sh);
    const hd = hx.getImageData(0,0,sw,sh), h4 = hd.data;
    const ht = clamp(P.haltint||0, 0, 1);
    const hR = 255 + (235-255)*ht, hG = 150 + (45-150)*ht, hB = 92 + (60-92)*ht;
    for(let i=0;i<h4.length;i+=4){
      const l = (h4[i]*.2126 + h4[i+1]*.7152 + h4[i+2]*.0722)/255;
      const f = smooth(0.62, 1.0, l);
      h4[i]   = hR*f;
      h4[i+1] = hG*f;
      h4[i+2] = hB*f;
    }
    hx.putImageData(hd, 0, 0);

    c.save();
    c.globalCompositeOperation = "screen";
    c.globalAlpha = P.halation * 0.9;
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high";
    if("filter" in c) c.filter = "blur(" + (unit*7) + "px)";
    c.drawImage(hc, 0, 0, W, H);
    c.restore();
  }

  // 2b. độ bóng (glow): tách vùng sáng → mask → làm mờ ở lưới nhỏ → screen lại ảnh gốc, rồi bù tương phản cục bộ nhẹ — xem glowBloom()
  if(P.glow > 0.001) glowBloom(c, W, H, P);

  // 3. vệt sáng lọt
  if(P.leak > 0.001){
    let px, py;
    if(P.leakManual){
      px = LK.x*W; py = LK.y*H;
    }else{
      const corner = Math.floor(rnd()*4);
      const pts = [[0,0],[W,0],[0,H],[W,H]][corner];
      px = pts[0]; py = pts[1];
    }
    const sizeF = (P.leakBandWidth==null ? 0.3 : P.leakBandWidth);
    const baseR = Math.max(W,H) * (0.16 + sizeF*0.85);
    const alpha = clamp(P.leak * 0.9, 0, 1);
    const hue = P.leakHue || 0;
    const rgbaHR = (r,g,b,a) => { const [rr,gg,bb] = hueRotate(r,g,b,hue,P.leakSat); return "rgba("+rr+","+gg+","+bb+","+a+")"; };

    c.save();
    c.globalCompositeOperation = "source-over";

    if(P.leakShape === "patch"){
      // mảng: dải hình chữ nhật mềm viền, xoay tự do theo "Góc vệt nắng", độ rộng tự chỉnh
      const frac = 0.03 + sizeF * 0.35;
      const bw = Math.max(W,H) * frac;
      const D = Math.max(W,H) * 1.6;   // đủ lớn để phủ kín ảnh sau khi xoay
      c.translate(px, py);
      c.rotate((P.leakAngle||0) * Math.PI/180);
      const g = c.createLinearGradient(-bw,0, bw,0);
      g.addColorStop(0,    rgbaHR(0,0,0,0));
      g.addColorStop(0.32, rgbaHR(255,224,140, alpha));
      g.addColorStop(0.5,  rgbaHR(255,196,70,  alpha));
      g.addColorStop(0.68, rgbaHR(255,224,140, alpha));
      g.addColorStop(1,    rgbaHR(0,0,0,0));
      c.fillStyle = g;
      c.fillRect(-D, -D, D*2, D*2);

    }else{
      // tròn — kích cỡ tự chỉnh theo thanh "Kích cỡ vệt nắng"
      const g = c.createRadialGradient(px, py, 0, px, py, baseR);
      g.addColorStop(0,   rgbaHR(255,224,140,0.95));
      g.addColorStop(0.3, rgbaHR(255,196,70,0.55));
      g.addColorStop(0.64,rgbaHR(230,150,40,0.18));
      g.addColorStop(1,   rgbaHR(0,0,0,0));
      c.globalAlpha = alpha;
      c.fillStyle = g;
      c.fillRect(0,0,W,H);
    }
    c.restore();
  }

  // nếu bật giới hạn theo vùng: khôi phục ảnh gốc (trước Nắng/Quầng sáng/Độ bóng/Vệt sáng lọt) ở phía không mong muốn
  if(P.rgAtmos !== "off" && atmosSnap){
    const hole = document.createElement("canvas");
    hole.width = W; hole.height = H;
    const hl = hole.getContext("2d");
    hl.drawImage(atmosSnap, 0, 0);
    hl.save();
    // "out": chỉ giữ ảnh gốc ở TRONG vòng (destination-in) → hiệu ứng chỉ còn hiện ở ngoài
    // "in" : xoá ảnh gốc ở TRONG vòng (destination-out) → chỉ còn ảnh gốc ở ngoài, hiệu ứng hiện ở trong
    hl.globalCompositeOperation = (P.rgAtmos === "out") ? "destination-in" : "destination-out";
    hl.translate(F.cx*W, F.cy*H);
    hl.scale(Math.max(1,F.rx*W), Math.max(1,F.ry*H));
    const hg = hl.createRadialGradient(0,0,0, 0,0,1.3);
    hg.addColorStop(0,   "rgba(0,0,0,1)");
    hg.addColorStop(0.72,"rgba(0,0,0,1)");
    hg.addColorStop(1,   "rgba(0,0,0,0)");
    hl.fillStyle = hg;
    hl.beginPath();
    hl.arc(0,0,1.3,0,Math.PI*2);
    hl.fill();
    hl.restore();
    c.drawImage(hole, 0, 0);
  }

  // 4. hạt phim: hạt rõ ở vùng tối, mờ dần ở vùng sáng — đúng đặc tính hạt phim thật
  if(P.grain > 0.001){
    const gid = c.getImageData(0,0,W,H);
    const gd = gid.data;
    const amtBase = 8 + P.grain*54;
    for(let i=0;i<gd.length;i+=4){
      const l = (gd[i]*.2126 + gd[i+1]*.7152 + gd[i+2]*.0722)/255;
      const w = 1 - smooth(0.12, 0.85, l);       // ~1 ở vùng tối, ~0 ở vùng sáng
      const amp = amtBase * (0.12 + w*0.88);      // vẫn giữ chút hạt rất nhẹ ở vùng sáng
      const n = (rnd()*2-1)*amp;
      gd[i]   = clamp(gd[i]   + n, 0, 255);
      gd[i+1] = clamp(gd[i+1] + n*0.94, 0, 255);
      gd[i+2] = clamp(gd[i+2] + n*0.94, 0, 255);
    }
    c.putImageData(gid, 0, 0);
  }

  // 4'. phim tráng in — hạt mịn tương quan nhẹ, rõ ở tông trung, mờ ở vùng sáng và đen sâu (không dùng chung nhiễu với "Hạt phim")
  if(P.film > 0.001) filmGrain(c, W, H, P, unit);

  // 5. tối góc
  if(P.vignette > 0.001){
    const g = c.createRadialGradient(W/2,H/2, Math.min(W,H)*0.28, W/2,H/2, Math.max(W,H)*0.76);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba("+Math.round(60-P.vignette*50)+","+Math.round(52-P.vignette*44)+","+Math.round(44-P.vignette*38)+",1)");
    c.save();
    c.globalCompositeOperation = "multiply";
    c.globalAlpha = P.vignette;
    c.fillStyle = g; c.fillRect(0,0,W,H);
    c.restore();
  }

  // 5b. vân giấy: vân bề mặt cực mịn dạng nhân vào ảnh — thấy rõ ở vùng sáng, mờ dần ở vùng tối (khác hạt phim và bụi xước)
  if(P.ptex > 0.001){
    const rp = rng((P.seed ^ 0x7A3C91E5) >>> 0);
    const T = 192;
    const nz = new Float32Array(T*T), tmp = new Float32Array(T*T), out = new Float32Array(T*T);
    for(let i=0;i<nz.length;i++) nz[i] = rp()*2-1;
    for(let y=0;y<T;y++) for(let x=0;x<T;x++){          // làm mịn ngang mạnh hơn dọc → ra vân sợi giấy
      let sm=0; for(let k=-3;k<=3;k++) sm += nz[y*T + ((x+k+T)%T)];
      tmp[y*T+x] = sm/7;
    }
    for(let y=0;y<T;y++) for(let x=0;x<T;x++){
      let sm=0; for(let k=-1;k<=1;k++) sm += tmp[((y+k+T)%T)*T + x];
      out[y*T+x] = sm/3;
    }
    let mxv = 0; for(let i=0;i<out.length;i++) mxv = Math.max(mxv, Math.abs(out[i]));
    const tc = document.createElement("canvas"); tc.width = T; tc.height = T;
    const tx = tc.getContext("2d");
    const td = tx.createImageData(T,T), t4 = td.data;
    for(let i=0;i<out.length;i++){
      const nv = out[i]/(mxv||1);
      const gv = 255*(1 - 0.1*(0.5+0.5*nv));
      t4[i*4] = gv; t4[i*4+1] = gv; t4[i*4+2] = gv*0.985; t4[i*4+3] = 255;
    }
    tx.putImageData(td,0,0);
    const ppat = c.createPattern(tc, "repeat");
    if(ppat.setTransform) ppat.setTransform(new DOMMatrix([unit*1.1,0,0,unit*1.1,0,0]));
    c.save();
    c.globalCompositeOperation = "multiply";
    c.globalAlpha = clamp(P.ptex*0.9, 0, 1);
    c.fillStyle = ppat; c.fillRect(0,0,W,H);
    c.restore();
    tc.width = 0; tc.height = 0;
  }

  // 6. bụi & xước
  if(P.dust > 0.001){
    c.save();
    c.globalCompositeOperation = "screen";
    const scratches = Math.round(P.dust*7);
    for(let i=0;i<scratches;i++){
      const x = rnd()*W;
      c.globalAlpha = 0.05 + rnd()*0.16*P.dust;
      c.strokeStyle = "#FFF6E4";
      c.lineWidth = Math.max(0.6, unit*(0.5 + rnd()*0.9));
      c.beginPath();
      c.moveTo(x, rnd()*H*0.4);
      c.lineTo(x + (rnd()*2-1)*unit*10, H*(0.5 + rnd()*0.5));
      c.stroke();
    }
    const specks = Math.round(P.dust*160);
    for(let i=0;i<specks;i++){
      c.globalAlpha = 0.12 + rnd()*0.4*P.dust;
      c.fillStyle = rnd() > 0.72 ? "#2B2018" : "#FFF3DC";
      const r = unit*(0.35 + rnd()*1.1);
      c.beginPath();
      c.arc(rnd()*W, rnd()*H, r, 0, 6.2832);
      c.fill();
    }
    c.restore();
  }

  // 6a. lấp lánh: rắc đốm như hạt nhũ/glitter — nhiều đốm nhỏ, vài đốm lớn có tia sao; tụ thành đám;
  //     bắt sáng ở mọi dải tông (cả vùng tối) và nhiều hơn dọc các cạnh tương phản, nơi ánh sáng thật hay lóe
  if(P.spark > 0.001){
    const rs = rng((P.seed ^ 0x51A2B3C4) >>> 0);   // bộ ngẫu nhiên riêng, không làm lệch các hiệu ứng khác
    const lw = Math.max(32, Math.round(W/8)), lh = Math.max(32, Math.round(H/8));
    const lc = document.createElement("canvas");
    lc.width = lw; lc.height = lh;
    const lx = lc.getContext("2d", {willReadFrequently:true});
    lx.drawImage(img, 0, 0, lw, lh);
    const ld = lx.getImageData(0,0,lw,lh).data;
    const lumAt = (ix,iy) => {
      ix = Math.max(0, Math.min(lw-1, ix)); iy = Math.max(0, Math.min(lh-1, iy));
      const k = (iy*lw+ix)*4;
      return (ld[k]*.2126 + ld[k+1]*.7152 + ld[k+2]*.0722)/255;
    };
    // bản đồ mật độ thô (lưới ngẫu nhiên nội suy) để đốm tụ thành đám thay vì rải đều như bụi
    const GN = 10, grid = [];
    for(let i=0;i<(GN+1)*(GN+1);i++) grid.push(rs());
    const dens = (fx,fy) => {
      const gx = fx*GN, gy = fy*GN;
      const x0 = Math.min(GN-1, gx|0), y0 = Math.min(GN-1, gy|0);
      const tx = gx-x0, ty = gy-y0;
      const g = (a2,b2) => grid[b2*(GN+1)+a2];
      const top = g(x0,y0)*(1-tx) + g(x0+1,y0)*tx;
      const bot = g(x0,y0+1)*(1-tx) + g(x0+1,y0+1)*tx;
      return top*(1-ty) + bot*ty;
    };
    const coarse = P.sparkMode === "coarse";
    const attempts = Math.round(P.spark * (coarse ? 1100 : 4500) * (W*H) / 1440000);
    const aBase = 0.45 + P.spark*0.5;
    const palette = ["255,247,230","255,247,230","234,243,255","255,214,232","255,228,168","200,240,255"];
    c.save();
    for(let i=0;i<attempts;i++){
      const x = rs()*W, y = rs()*H;
      const ix = Math.min(lw-1, (x/W*lw)|0), iy = Math.min(lh-1, (y/H*lh)|0);
      const lum = lumAt(ix,iy);
      const edge = Math.min(1, (Math.abs(lumAt(ix+1,iy)-lumAt(ix-1,iy)) + Math.abs(lumAt(ix,iy+1)-lumAt(ix,iy-1)))*3);
      let wgt = (0.22 + 0.78*smooth(0.1, 0.62, lum)) * (1 - 0.7*smooth(0.92, 1.0, lum));
      wgt *= (0.55 + 1.5*edge);
      wgt *= (0.25 + 0.95*dens(x/W, y/H));
      if(rs() > wgt) continue;
      const col = palette[(rs()*palette.length)|0];
      const t = Math.pow(rs(), 3);                  // phân bố lệch: đa số nhỏ, vài đốm lớn
      const a = Math.min(1, aBase * (0.4 + 0.6*Math.pow(rs(), 0.7)) * (0.7 + 0.6*t));
      const r = coarse ? unit*(1.3 + t*5.5) : Math.max(0.8, unit*(0.7 + t*2.6));
      if(r > unit*1.6){                              // quầng cộng sáng (screen): đốm nổi cả trên nền tối
        const gr = r*2.4;
        const gg = c.createRadialGradient(x,y,0, x,y,gr);
        gg.addColorStop(0, "rgba("+col+","+(a*0.5)+")");
        gg.addColorStop(1, "rgba("+col+",0)");
        c.globalCompositeOperation = "screen";
        c.fillStyle = gg;
        c.beginPath(); c.arc(x,y,gr,0,6.2832); c.fill();
      }
      c.globalCompositeOperation = "source-over";   // lõi vẽ thường để vẫn thấy khi nền sáng
      c.fillStyle = "rgba("+col+","+a+")";
      if(t > 0.55){
        sparkStar(c, x, y, r*1.7, 0);
        if(t > 0.8) sparkStar(c, x, y, r*1.05, Math.PI/4);
      }else{
        c.beginPath(); c.arc(x,y, r*0.8, 0, 6.2832); c.fill();
      }
    }
    c.restore();
    lc.width = 0; lc.height = 0;
  }

  // 6b. bóng kính: dải sáng chéo mờ như ánh phản chiếu trên mặt kính/nhựa bóng
  if(P.kinh > 0.001){
    const ang = -18 * Math.PI/180;
    const diag = Math.sqrt(W*W + H*H);
    const bandPos = diag*(0.14 + rnd()*0.5);
    const bandW = diag*0.16;
    c.save();
    c.translate(W/2, H/2);
    c.rotate(ang);
    c.translate(-diag/2, -diag/2);
    const kg = c.createLinearGradient(0, bandPos-bandW, 0, bandPos+bandW);
    kg.addColorStop(0,   "rgba(255,255,255,0)");
    kg.addColorStop(0.5, "rgba(255,252,246,0.95)");
    kg.addColorStop(1,   "rgba(255,255,255,0)");
    c.globalCompositeOperation = "screen";
    c.globalAlpha = P.kinh * 0.6;
    c.fillStyle = kg;
    c.fillRect(0, 0, diag, diag);
    c.restore();
  }

  // 7. dấu ngày — in lên phim, nên nằm trong ảnh
  if(P.stamp && P.dateText.trim()){
    const txt = P.dateText.trim();
    const h = Math.max(9, Math.min(W,H)*0.042);
    const m = Math.min(W,H)*0.045;
    c.save();
    c.globalCompositeOperation = "lighter";
    const wpx = stampWidth(txt, h);
    drawStamp(c, txt, W - m - wpx, H - m - h, h, true);
    drawStamp(c, txt, W - m - wpx, H - m - h, h, false);
    c.restore();
  }

  // 7b. bề mặt bóng (ảnh in glossy): chiều sâu (tương phản cục bộ nhân, giữ đen) + phản chiếu cửa sổ mềm có trọng số theo tông — xem glossSurface()
  if(P.gloss > 0.001) glossSurface(c, W, H, P);

  // 8. vùng lấy nét chọn lọc: mờ toàn bộ, chừa lại oval nét (F) mềm viền
  if(P.bgBlur > 0.001){
    const dw = Math.max(24, Math.round(W / (6 + P.bgBlur*34)));
    const dh = Math.max(24, Math.round(H / (6 + P.bgBlur*34)));
    const small = document.createElement("canvas");
    small.width = dw; small.height = dh;
    small.getContext("2d").drawImage(img, 0, 0, dw, dh);

    const bc = document.createElement("canvas");
    bc.width = W; bc.height = H;
    const bx = bc.getContext("2d");
    bx.imageSmoothingEnabled = true; bx.imageSmoothingQuality = "high";
    if("filter" in bx) bx.filter = "blur(" + Math.round(unit*4) + "px)";
    bx.drawImage(small, 0, 0, W, H);
    bx.filter = "none";

    // đục một lỗ oval mềm viền vào giữa lớp mờ để lộ ảnh nét bên dưới
    bx.save();
    bx.globalCompositeOperation = "destination-out";
    bx.translate(F.cx*W, F.cy*H);
    bx.scale(Math.max(1,F.rx*W), Math.max(1,F.ry*H));
    const fg = bx.createRadialGradient(0,0,0, 0,0,1.3);
    fg.addColorStop(0,   "rgba(0,0,0,1)");
    fg.addColorStop(0.72,"rgba(0,0,0,1)");
    fg.addColorStop(1,   "rgba(0,0,0,0)");
    bx.fillStyle = fg;
    bx.beginPath();
    bx.arc(0,0,1.3,0,Math.PI*2);
    bx.fill();
    bx.restore();

    c.drawImage(bc, 0, 0);
  }

  // 8b. mờ chuyển động: kéo vệt theo hướng chéo, chừa lại oval nét (F) mềm viền
  if(P.motion > 0.001){
    const mc = document.createElement("canvas");
    mc.width = W; mc.height = H;
    const mx = mc.getContext("2d");
    const ang = P.motionAngle * Math.PI/180;
    const dirX = Math.cos(ang), dirY = Math.sin(ang);
    const maxOff = unit * (10 + P.motion*70);
    const steps = 16;
    mx.globalAlpha = 1/steps;
    for(let i=0;i<steps;i++){
      const t = (i/(steps-1) - 0.5) * 2;   // -1..1
      mx.drawImage(img, t*maxOff*dirX, t*maxOff*dirY);
    }
    mx.globalAlpha = 1;

    mx.save();
    mx.globalCompositeOperation = "destination-out";
    mx.translate(F.cx*W, F.cy*H);
    mx.scale(Math.max(1,F.rx*W), Math.max(1,F.ry*H));
    const fg2 = mx.createRadialGradient(0,0,0, 0,0,1.3);
    fg2.addColorStop(0,   "rgba(0,0,0,1)");
    fg2.addColorStop(0.72,"rgba(0,0,0,1)");
    fg2.addColorStop(1,   "rgba(0,0,0,0)");
    mx.fillStyle = fg2;
    mx.beginPath();
    mx.arc(0,0,1.3,0,Math.PI*2);
    mx.fill();
    mx.restore();

    c.drawImage(mc, 0, 0);
  }

  // ---- ghép khung ----
  if(P.frame === "scan"){
    const rb = rng((P.seed ^ 0x9E3779B9) >>> 0);
    ctx.fillStyle = "#F5F0E3";
    ctx.fillRect(0, 0, target.width, target.height);
    const pts = ragged(bw, bw, W, H, unit*2.2, unit*34, rb);
    ctx.save();
    tracePath(ctx, pts);
    ctx.clip();
    ctx.drawImage(img, bw, bw);
    ctx.restore();
    ctx.save();
    tracePath(ctx, pts);
    ctx.strokeStyle = "rgba(42,33,24,.22)";
    ctx.lineWidth = Math.max(1, unit*1.1);
    ctx.stroke();
    ctx.restore();
  }else if(bw > 0){
    ctx.fillStyle = P.frame === "polaroid" ? "#F2EDE1" : "#FBF7EC";
    ctx.fillRect(0, 0, target.width, target.height);
    ctx.drawImage(img, bw, bw);
  }
  if(tmp){ img.width = 0; img.height = 0; }   // trả bộ nhớ ngay, iOS rất cần
  return target;
}

