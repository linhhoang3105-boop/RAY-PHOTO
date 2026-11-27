/* =====================================================================
   RAY PRESET · "Thu Nhật"
   Preset màu ảnh phim thu Nhật Bản: nắng vàng dịu, lá xanh ngả vàng-lục,
   lá đỏ ngả vàng kim, đen nâng nhẹ ngả olive, trắng kem không bệt, màu dịu.

   CODE ĐỘC LẬP — không cần thư viện, không đụng vào code app.
   Chỉ dùng JS cơ bản (không dùng ctx.filter hay WebGL) nên chạy được trên
   trình duyệt, Web Worker và Node. Đã thử trên Chromium và Node.
   Tốc độ: ảnh 12MP mất khoảng 1 giây trên máy tính; với ảnh lớn nên xem
   trước bằng ảnh thu nhỏ (fromSource(img, opts, 1600)) rồi mới áp bản đầy đủ.

   CÁCH DÙNG NHANH
     const ctx = canvas.getContext('2d');
     const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
     RayPresetThuNhat.apply(img, { strength: 1 });   // sửa trực tiếp img
     ctx.putImageData(img, 0, 0);

     // hoặc gọn hơn, áp thẳng lên canvas:
     RayPresetThuNhat.applyToCanvas(canvas, { strength: 0.8 });

     // hoặc từ <img> / <canvas> / ImageBitmap → trả về canvas mới:
     const out = RayPresetThuNhat.fromSource(imgElement);

   TÙY CHỌN (tất cả đều không bắt buộc, xem DEFAULTS bên dưới)
     strength 0..1.5  độ đậm của cả preset (0 = ảnh gốc)
     warmth, fade, contrast, leafShift, saturation, skinProtect, glow, grain
     RayPresetThuNhat.variants có sẵn 3 bộ chỉnh: chuan, amNang, moDiu
   ===================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RayPresetThuNhat = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Tuỳ chọn mặc định ---------- */
  var DEFAULTS = {
    strength: 1,     // độ đậm cả preset
    warmth: 1,       // ấm vàng ở vùng sáng / giữa (0 = trung tính)
    fade: 1,         // nâng đen kiểu phim (0 = giữ đen sâu)
    contrast: 1,     // tương phản đường cong (0 = phẳng, 1 = nhẹ như mẫu)
    leafShift: 1,    // kéo lá xanh về vàng-lục, cam về vàng kim
    saturation: 1,   // nhân thêm vào độ bão hoà chung
    skinProtect: 1,  // 0..1: giữ da tự nhiên, không bị ám vàng/xanh
    glow: 0.2,       // hạt sáng dịu ở vùng sáng (tách highlight → blur → screen)
    grain: 0.25,     // hạt phim mịn
    seed: 7          // hạt cố định theo seed → xuất ảnh lần nào cũng như nhau
  };

  var VARIANTS = {
    chuan:  {},
    amNang: { warmth: 2.1, leafShift: 1.2, saturation: 1.1, glow: 0.3 },
    moDiu:  { fade: 1.9, contrast: 0.65, saturation: 0.88, warmth: 0.9, glow: 0.3 }
  };

  /* ---------- Hằng số màu (đo từ ảnh mẫu) ---------- */
  var BLACK = [0.046, 0.060, 0.040];   // điểm đen từng kênh R,G,B (hơi xanh olive)
  var L_CAP = 0.955;                   // trần độ sáng (OKLab L) — trắng thành kem nhạt, không bệt
  var L_KNEE = 0.80;                   // từ đây vùng sáng bắt đầu roll-off mềm
  var BASE_CONTRAST = 0.18;

  /* ---------- Toán nhỏ ---------- */
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function hueWin(h, c, s) { var d = ((h - c + 540) % 360) - 180; return Math.exp(-0.5 * (d / s) * (d / s)); }
  function toLin(v) { return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function toSrgb(v) { return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; }

  /* OKLab: không gian màu đều theo cảm nhận, dùng để chỉnh hue/độ bão hoà */
  function toOklab(r, g, b) {
    var lr = toLin(r), lg = toLin(g), lb = toLin(b);
    var l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    var m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    var s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
    return [
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    ];
  }
  function fromOklab(L, a, b) {
    var l = L + 0.3963377774 * a + 0.2158037573 * b;
    var m = L - 0.1055613458 * a - 0.0638541728 * b;
    var s = L - 0.0894841775 * a - 1.2914855480 * b;
    l = l * l * l; m = m * m * m; s = s * s * s;
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    ];
  }
  function inGamut(c) {
    var e = 0.0005;
    return c[0] >= -e && c[0] <= 1 + e && c[1] >= -e && c[1] <= 1 + e && c[2] >= -e && c[2] <= 1 + e;
  }

  /* Đường cong từng kênh: S nhẹ → nâng đen (đen ngả olive nhờ mỗi kênh một mức) */
  function curve(x, black, k) {
    var y = x + k * (x * x * (3 - 2 * x) - x);
    return y + black * (1 - y) * (1 - y);       // kiểu 'toe': chỉ vùng tối, giữa/sáng gần như không đổi
  }

  /* ---------- Chấm màu cho 1 điểm (r,g,b trong 0..1, sRGB) ---------- */
  function gradeColor(r, g, b, o) {
    var k = BASE_CONTRAST * o.contrast;
    var R = curve(r, BLACK[0] * o.fade, k);
    var G = curve(g, BLACK[1] * o.fade, k);
    var B = curve(b, BLACK[2] * o.fade, k);

    var lab = toOklab(R, G, B), L = lab[0], a = lab[1], bb = lab[2];
    var C = Math.sqrt(a * a + bb * bb);
    var h = (Math.atan2(bb, a) * 180 / Math.PI + 360) % 360;

    // Vùng da: hue cam nhạt, độ bão hoà thấp-vừa, đủ sáng → giữ nguyên
    var skin = o.skinProtect * hueWin(h, 52, 26) * (1 - smooth(0.10, 0.17, C)) * smooth(0.25, 0.45, L);
    var free = 1 - skin;

    // Độ bão hoà theo dải màu (tính trên hue gốc)
    var cs = 0.82 * o.saturation;
    cs -= 0.24 * hueWin(h, 138, 34);      // lá xanh: dịu xuống
    cs -= 0.17 * hueWin(h, 235, 50);      // lam / cyan: trời nhạt
    cs -= 0.08 * hueWin(h, 330, 35);      // hồng tím
    cs += 0.08 * hueWin(h, 82, 26) * free; // vàng kim: giữ rực hơn các màu khác
    cs *= 0.85 + 0.15 * smooth(0.08, 0.34, L); // vùng rất tối bớt màu
    cs = 1 + (cs - 1) * (1 - skin * 0.7);  // da: ít đổi độ bão hoà
    C *= Math.max(0, cs);

    // Dịch hue: lá xanh → vàng-lục (mạnh ở lá sáng), cam → vàng kim
    var lw = smooth(0.20, 0.75, L);
    var dh = -22 * hueWin(h, 140, 26) * (0.35 + 0.65 * lw) + 9 * hueWin(h, 62, 16);
    h += o.leafShift * dh * free;

    var hr = h * Math.PI / 180;
    a = C * Math.cos(hr);
    bb = C * Math.sin(hr);

    // Chia tông: tối ngả xanh olive, sáng/giữa ngả vàng ấm
    var ws = (1 - smooth(0.12, 0.55, L)) * (1 - 0.65 * skin);
    var wm = Math.exp(-0.5 * Math.pow((L - 0.62) / 0.17, 2));
    var wh = smooth(0.55, 0.92, L);
    var warm = o.warmth * (1 - 0.55 * skin);
    a += -0.0075 * ws + 0.0015 * wh * warm;
    bb += 0.0095 * ws + (0.016 * wm + 0.004 * wh) * warm;

    // Roll-off vùng sáng trên độ sáng (giữ nguyên hue, không làm mất đỏ ở da sáng)
    if (L > L_KNEE) {
      var L2 = L_KNEE + (L_CAP - L_KNEE) * Math.tanh((L - L_KNEE) / (L_CAP - L_KNEE));
      var ratio = L2 / L;
      a *= ratio; bb *= ratio; L = L2;
    }

    // Đưa về sRGB; nếu tràn gam màu thì giảm bão hoà thay vì cắt cứng
    var lin = fromOklab(L, a, bb);
    if (!inGamut(lin)) {
      var lo = 0, hi = 1;
      for (var i = 0; i < 9; i++) {
        var mid = (lo + hi) / 2;
        if (inGamut(fromOklab(L, a * mid, bb * mid))) lo = mid; else hi = mid;
      }
      lin = fromOklab(L, a * lo, bb * lo);
    }
    return [clamp(toSrgb(clamp(lin[0], 0, 1)), 0, 1), clamp(toSrgb(clamp(lin[1], 0, 1)), 0, 1), clamp(toSrgb(clamp(lin[2], 0, 1)), 0, 1)];
  }

  /* ---------- Bảng 3D LUT 33³ (làm 1 lần, dùng lại) ---------- */
  var LUT_N = 33, lutCache = {};
  function lutKey(o) {
    return [o.warmth, o.fade, o.contrast, o.leafShift, o.saturation, o.skinProtect].join('|');
  }
  function getLUT(o) {
    var key = lutKey(o);
    if (lutCache[key]) return lutCache[key];
    var N = LUT_N, lut = new Float32Array(N * N * N * 3), i = 0;
    for (var bi = 0; bi < N; bi++) for (var gi = 0; gi < N; gi++) for (var ri = 0; ri < N; ri++) {
      var c = gradeColor(ri / (N - 1), gi / (N - 1), bi / (N - 1), o);
      lut[i++] = c[0]; lut[i++] = c[1]; lut[i++] = c[2];
    }
    lutCache = {}; lutCache[key] = lut;   // chỉ giữ 1 bảng gần nhất cho nhẹ bộ nhớ
    return lut;
  }

  function applyLUT(d, lut) {
    var N = LUT_N, sc = N - 1, sg = N, sb = N * N, len = d.length;
    for (var p = 0; p < len; p += 4) {
      var r = d[p] / 255 * sc, g = d[p + 1] / 255 * sc, b = d[p + 2] / 255 * sc;
      var r0 = r | 0, g0 = g | 0, b0 = b | 0;
      var r1 = r0 < sc ? r0 + 1 : r0, g1 = g0 < sc ? g0 + 1 : g0, b1 = b0 < sc ? b0 + 1 : b0;
      var fr = r - r0, fg = g - g0, fb = b - b0;
      var i000 = (b0 * sb + g0 * sg + r0) * 3, i100 = (b0 * sb + g0 * sg + r1) * 3;
      var i010 = (b0 * sb + g1 * sg + r0) * 3, i110 = (b0 * sb + g1 * sg + r1) * 3;
      var i001 = (b1 * sb + g0 * sg + r0) * 3, i101 = (b1 * sb + g0 * sg + r1) * 3;
      var i011 = (b1 * sb + g1 * sg + r0) * 3, i111 = (b1 * sb + g1 * sg + r1) * 3;
      for (var c = 0; c < 3; c++) {
        var c00 = lut[i000 + c] + (lut[i100 + c] - lut[i000 + c]) * fr;
        var c10 = lut[i010 + c] + (lut[i110 + c] - lut[i010 + c]) * fr;
        var c01 = lut[i001 + c] + (lut[i101 + c] - lut[i001 + c]) * fr;
        var c11 = lut[i011 + c] + (lut[i111 + c] - lut[i011 + c]) * fr;
        var c0 = c00 + (c10 - c00) * fg, c1 = c01 + (c11 - c01) * fg;
        d[p + c] = (c0 + (c1 - c0) * fb) * 255;   // Uint8ClampedArray tự làm tròn
      }
    }
  }

  /* ---------- Hạt sáng dịu (highlight → smoothstep → blur ảnh nhỏ → screen) ---------- */
  function boxBlur(src, w, h, rad) {
    // blur ngang rồi dọc, 3 lượt ≈ Gaussian; src: Float32Array w*h*3
    var tmp = new Float32Array(src.length), out = new Float32Array(src);
    for (var pass = 0; pass < 3; pass++) {
      blurAxis(out, tmp, w, h, rad, true);
      blurAxis(tmp, out, w, h, rad, false);
    }
    return out;
  }
  function blurAxis(src, dst, w, h, rad, horizontal) {
    var n = horizontal ? w : h, lines = horizontal ? h : w;
    var stepIn = horizontal ? 3 : w * 3, stepLine = horizontal ? w * 3 : 3;
    var inv = 1 / (2 * rad + 1);
    for (var ln = 0; ln < lines; ln++) {
      var base = ln * stepLine;
      for (var c = 0; c < 3; c++) {
        var sum = 0, k;
        for (k = -rad; k <= rad; k++) sum += src[base + clamp(k, 0, n - 1) * stepIn + c];
        for (var i = 0; i < n; i++) {
          dst[base + i * stepIn + c] = sum * inv;
          sum += src[base + clamp(i + rad + 1, 0, n - 1) * stepIn + c] - src[base + clamp(i - rad, 0, n - 1) * stepIn + c];
        }
      }
    }
  }
  function applyGlow(d, w, h, amount) {
    var k = Math.max(1, Math.round(Math.max(w, h) / 360));
    var sw = Math.ceil(w / k), sh = Math.ceil(h / k);
    var small = new Float32Array(sw * sh * 3), cnt = new Float32Array(sw * sh);
    for (var y = 0; y < h; y++) {
      var sy = (y / k) | 0;
      for (var x = 0; x < w; x++) {
        var p = (y * w + x) * 4, q = ((sy * sw) + ((x / k) | 0));
        small[q * 3] += d[p]; small[q * 3 + 1] += d[p + 1]; small[q * 3 + 2] += d[p + 2]; cnt[q]++;
      }
    }
    for (var q2 = 0; q2 < sw * sh; q2++) {
      var inv = 1 / (cnt[q2] * 255 || 1), r = small[q2 * 3] * inv, g = small[q2 * 3 + 1] * inv, b = small[q2 * 3 + 2] * inv;
      var m = smooth(0.74, 0.97, 0.2126 * r + 0.7152 * g + 0.0722 * b);   // mặt nạ vùng sáng
      small[q2 * 3] = r * m; small[q2 * 3 + 1] = g * m; small[q2 * 3 + 2] = b * m;
    }
    var rad = Math.max(2, Math.round(Math.max(sw, sh) * 0.035));
    var blur = boxBlur(small, sw, sh, rad);
    var amt = 0.55 * amount;
    for (var yy = 0; yy < h; yy++) {
      var fy = clamp(yy / k - 0.5, 0, sh - 1), y0 = fy | 0, y1 = Math.min(y0 + 1, sh - 1), ty = fy - y0;
      for (var xx = 0; xx < w; xx++) {
        var fx = clamp(xx / k - 0.5, 0, sw - 1), x0 = fx | 0, x1 = Math.min(x0 + 1, sw - 1), tx = fx - x0;
        var a00 = (y0 * sw + x0) * 3, a10 = (y0 * sw + x1) * 3, a01 = (y1 * sw + x0) * 3, a11 = (y1 * sw + x1) * 3;
        var pp = (yy * w + xx) * 4;
        var lum = (0.2126 * d[pp] + 0.7152 * d[pp + 1] + 0.0722 * d[pp + 2]) / 255;
        var gate = amt * (0.35 + 0.65 * smooth(0.18, 0.60, lum));          // vùng tối giữ sâu, không phủ sương
        for (var c = 0; c < 3; c++) {
          var gv = (blur[a00 + c] * (1 - tx) + blur[a10 + c] * tx) * (1 - ty) + (blur[a01 + c] * (1 - tx) + blur[a11 + c] * tx) * ty;
          gv *= c === 0 ? 1 : c === 1 ? 0.95 : 0.85;                         // glow ngả kem ấm
          var v = d[pp + c] / 255;
          d[pp + c] = (1 - (1 - v) * (1 - gv * gate)) * 255;
        }
      }
    }
  }

  /* ---------- Hạt phim mịn ---------- */
  function hash(x, y, s) {
    var h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function applyGrain(d, w, h, amount, seed) {
    var cell = Math.max(1, Math.round(Math.max(w, h) / 1800)), amp = 0.055 * amount * 255;
    for (var y = 0; y < h; y++) {
      var cy = (y / cell) | 0;
      for (var x = 0; x < w; x++) {
        var p = (y * w + x) * 4, cx = (x / cell) | 0;
        var n = hash(cx, cy, seed) + hash(cx + 17, cy + 31, seed + 1) - 1;     // phân bố tam giác −1..1
        var lum = (0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2]) / 255;
        var add = n * amp * (0.35 + 0.65 * 4 * lum * (1 - lum));                // hạt rõ nhất ở vùng giữa
        d[p] += add; d[p + 1] += add; d[p + 2] += add;
      }
    }
  }

  /* ---------- Hàm chính ---------- */
  function merge(opts) {
    var o = {}, k;
    for (k in DEFAULTS) o[k] = DEFAULTS[k];
    if (opts) for (k in opts) if (opts[k] !== undefined) o[k] = opts[k];
    return o;
  }

  function apply(imageData, opts) {
    var o = merge(opts), w = imageData.width, h = imageData.height, d = imageData.data;
    if (!(o.strength > 0)) return imageData;
    var blend = o.strength !== 1, orig = blend ? new Uint8ClampedArray(d) : null;
    applyLUT(d, getLUT(o));                                   // 1. màu: đường cong + hue + chia tông
    if (o.glow > 0) applyGlow(d, w, h, o.glow);               // 2. hạt sáng dịu ở vùng sáng
    if (o.grain > 0) applyGrain(d, w, h, o.grain, o.seed | 0); // 3. hạt phim (cũng giúp chống sọc bậc ở trời)
    if (blend) {                                              // 4. trộn với ảnh gốc theo strength
      var s = o.strength;
      for (var j = 0; j < d.length; j += 4) {
        d[j] = orig[j] + (d[j] - orig[j]) * s;
        d[j + 1] = orig[j + 1] + (d[j + 1] - orig[j + 1]) * s;
        d[j + 2] = orig[j + 2] + (d[j + 2] - orig[j + 2]) * s;
      }
    }
    return imageData;                                         // kênh alpha giữ nguyên
  }

  function applyToCanvas(canvas, opts) {
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    apply(img, opts);
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  // <img> / <canvas> / ImageBitmap / VideoFrame → canvas mới đã áp preset (maxSize: cạnh dài tối đa, 0 = giữ nguyên)
  function fromSource(source, opts, maxSize) {
    var sw = source.naturalWidth || source.videoWidth || source.width;
    var sh = source.naturalHeight || source.videoHeight || source.height;
    var sc = maxSize ? Math.min(1, maxSize / Math.max(sw, sh)) : 1;
    var cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(sw * sc));
    cv.height = Math.max(1, Math.round(sh * sc));
    cv.getContext('2d', { willReadFrequently: true }).drawImage(source, 0, 0, cv.width, cv.height);
    return applyToCanvas(cv, opts);
  }

  return {
    name: 'Thu Nhật',
    defaults: DEFAULTS,
    variants: VARIANTS,
    apply: apply,
    applyToCanvas: applyToCanvas,
    fromSource: fromSource,
    gradeColor: function (r, g, b, opts) { return gradeColor(r, g, b, merge(opts)); }   // để thử 1 màu
  };
});
