
"use strict";

/* ============ trạng thái ============ */
const P = {
  temp:0, tint:0, split:0, contrast:0, sat:0, lift:0,
  halation:0, grain:0, vignette:0, leak:0, dust:0, ca:0, flash:0,
  frame:"none", stamp:true, dateText:"", seed:1234, haltint:0, glow:0, nang:0, filmExp:0, sharp:0, kinh:0, bgBlur:0, motion:0, motionAngle:-25, rgAtmos:"off", leakManual:false, leakShape:"circle", leakAngle:0, leakBandWidth:0.3, leakHue:0, leakSat:1, nangSat:1, nangManual:false, nangSize:0.75, spark:0, sparkMode:"fine", paper:0, gloss:0, soft:0, ptex:0, film:0, printClear:0
};

/* vị trí nắng khi ở chế độ tự kéo — tỉ lệ 0-1, không đổi khi chuyển cuộn phim */
const NK = { x:0.5, y:0.04 };

/* vị trí vệt nắng khi ở chế độ tự kéo — tỉ lệ 0-1, không đổi khi chuyển cuộn phim */
const LK = { x:0.08, y:0.08 };

/* vùng lấy nét chọn lọc — tỉ lệ 0-1 theo chiều rộng/cao ảnh, không đổi khi chuyển cuộn phim */
const F = { cx:0.5, cy:0.45, rx:0.28, ry:0.32 };

