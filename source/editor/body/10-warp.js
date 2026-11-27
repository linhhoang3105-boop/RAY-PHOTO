/* ============ chỉnh dáng: biến dạng theo từng vòng ============ */
/* Mỗi bộ phận = một vòng elip riêng (tâm, bán kính, góc xoay) + các thanh riêng.
   Ảnh chỉ đổi BÊN TRONG vòng — ngoài vòng giữ nguyên từng điểm ảnh. Vòng chuẩn hoá theo ảnh
   (cx theo bề ngang, cy theo bề cao, rx/ry theo bề cao) nên bản xem trước và bản xuất khớp nhau ở mọi kích thước. */
const BODY_DEF = [
  // id, tên, cx, cy, rx, ry, xoay  (xếp theo lưới 3 cột: trái | phải | giữa)
  ["face","Mặt",.5,.13,.105,.14,0],
  ["neck","Cổ",.5,.235,.05,.05,0],
  ["chest","Ngực",.5,.335,.115,.065,0],
  ["shL","Vai trái",.37,.275,.09,.05,0],
  ["shR","Vai phải",.63,.275,.09,.05,0],
  ["back","Lưng",.5,.38,.14,.09,0],
  ["armL","Tay trái",.29,.40,.045,.13,0],
  ["armR","Tay phải",.71,.40,.045,.13,0],
  ["waist","Eo",.5,.44,.10,.055,0],
  ["thL","Đùi trái",.43,.68,.065,.14,0],
  ["thR","Đùi phải",.57,.68,.065,.14,0],
  ["belly","Bụng",.5,.50,.105,.06,0],
  ["clL","Bắp chân trái",.43,.86,.05,.11,0],
  ["clR","Bắp chân phải",.57,.86,.05,.11,0],
  ["hip","Hông",.5,.56,.13,.075,0],
  ["f1","Tự do 1",.5,.5,.1,.1,0],
  ["f2","Tự do 2",.5,.5,.1,.1,0],
  ["butt","Mông",.5,.60,.14,.08,0],
  ["chin","Cằm / nọng",.5,.20,.065,.04,0]
];
const BODY = { parts:[], sel:null, open:false, hide:false, peek:false };
function bodyDefaults(){
  BODY.parts = BODY_DEF.map(d => ({ id:d[0], name:d[1], cx:d[2], cy:d[3], rx:d[4], ry:d[5], rot:d[6],
                                    size:0, wid:0, len:0, push:0, dir:0, soft:.5, place:"default" }));
}
bodyDefaults();
const bodyPart = id => BODY.parts.find(p => p.id === id) || null;
const bodyActive = p => Math.abs(p.size) > .001 || Math.abs(p.wid) > .001 || Math.abs(p.len) > .001 || p.push > .001;
let LASTG = null;                       // kích thước ảnh + khung của lần dựng xem trước (để đặt vòng lên đúng chỗ)

const BODY_E = 0.75;                    // mỗi thanh To/nhỏ, Ngang, Dọc: tối đa 2^0.75 ≈ 1.68 lần ở tâm vòng
const BODY_PUSH = 0.5;                  // đẩy tối đa ≈ 50% × độ rộng dải chuyển × bán kính theo hướng đẩy (viền mềm hơn thì đẩy được xa hơn mà không gập)
let _sx = 0, _sy = 0;

/* hệ số của một vòng; k (0..1) là hệ số an toàn để ánh xạ không bao giờ gập */
function bodyCoef(p, k, Rx, Ry){
  const sx = Math.exp(Math.LN2 * BODY_E * (p.size + p.wid) * k);
  const sy = Math.exp(Math.LN2 * BODY_E * (p.size + p.len) * k);
  const a = (p.dir - p.rot) * Math.PI/180, cl = Math.cos(a), sl = Math.sin(a);
  const rdir = 1 / Math.sqrt((cl/Rx)*(cl/Rx) + (sl/Ry)*(sl/Ry));
  const rho0 = (1 - p.soft) * 0.7, span = 1 - rho0;
  const disp = p.push * k * BODY_PUSH * span * rdir;
  return { Rx, Ry, ax: 1 - 1/sx, ay: 1 - 1/sy, dx: cl*disp, dy: sl*disp, rho0, span };
}
/* ánh xạ ngược: điểm đích (lx,ly) — toạ độ trong hệ của vòng — lấy màu từ điểm nguồn (_sx,_sy); trả về độ ảnh hưởng 0..1 */
function bodySrc(co, lx, ly){
  const nx = lx/co.Rx, ny = ly/co.Ry, r2 = nx*nx + ny*ny;
  if(r2 >= 1){ _sx = lx; _sy = ly; return 0; }
  let t = (1 - Math.sqrt(r2)) / co.span; if(t > 1) t = 1;
  const f = t*t*(3 - 2*t);
  _sx = lx*(1 - co.ax*f) - co.dx*f;
  _sy = ly*(1 - co.ay*f) - co.dy*f;
  return f;
}
/* kiểm tra gập: định thức Jacobi nhỏ nhất trên lưới; nếu < 0.18 thì thu nhỏ biên độ (chia đôi) cho tới khi an toàn */
function bodyGuard(p){
  const probe = k => {
    const co = bodyCoef(p, k, p.rx, p.ry);
    const h = Math.min(p.rx, p.ry) * 0.004, N = 22;
    let dm = 1e9, sm = 0;
    for(let i=0;i<=N;i++) for(let j=0;j<=N;j++){
      const lx = (i/N*2.2 - 1.1) * p.rx, ly = (j/N*2.2 - 1.1) * p.ry;
      bodySrc(co, lx+h, ly); const a1 = _sx, c1 = _sy;
      bodySrc(co, lx-h, ly); const a0 = _sx, c0 = _sy;
      bodySrc(co, lx, ly+h); const b1 = _sx, d1 = _sy;
      bodySrc(co, lx, ly-h); const b0 = _sx, d0 = _sy;
      const a = (a1-a0)/(2*h), c = (c1-c0)/(2*h), b = (b1-b0)/(2*h), d = (d1-d0)/(2*h);
      const det = a*d - b*c; if(det < dm) dm = det;
      const s = Math.sqrt((a*a + b*b + c*c + d*d)/2); if(s > sm) sm = s;
    }
    return { det:dm, st:sm };
  };
  let r = probe(1);
  if(r.det >= 0.18) return { k:1, st:r.st };
  let lo = 0, hi = 1;
  for(let i=0;i<9;i++){
    const mid = (lo + hi)/2;
    if(probe(mid).det >= 0.18) lo = mid; else hi = mid;
  }
  return { k:lo, st:probe(lo).st };
}

function bodyApply(c, W, H, p){
  const g = bodyGuard(p);
  const Rx = p.rx*H, Ry = p.ry*H;
  const co = bodyCoef(p, g.k, Rx, Ry);
  const cxp = p.cx*W, cyp = p.cy*H;
  const phi = p.rot*Math.PI/180, cs = Math.cos(phi), sn = Math.sin(phi);
  const ex = Math.ceil(Math.hypot(Rx*cs, Ry*sn)) + 1, ey = Math.ceil(Math.hypot(Rx*sn, Ry*cs)) + 1;
  const mg = Math.ceil(Math.hypot(co.dx, co.dy)) + 3;
  const x0 = Math.max(0, Math.floor(cxp - ex)), x1 = Math.min(W, Math.ceil(cxp + ex));
  const y0 = Math.max(0, Math.floor(cyp - ey)), y1 = Math.min(H, Math.ceil(cyp + ey));
  if(x1 <= x0 || y1 <= y0) return;
  const bx0 = Math.max(0, x0 - mg), bx1 = Math.min(W, x1 + mg);
  const by0 = Math.max(0, y0 - mg), by1 = Math.min(H, y1 + mg);
  const bw = bx1 - bx0, bh = by1 - by0;
  const S = c.getImageData(bx0, by0, bw, bh).data;
  const od = c.createImageData(bw, bh), O = od.data;
  O.set(S);

  const ss = g.st > 2.2 ? 3 : (g.st > 1.3 ? 2 : 1);      // thu nhỏ mạnh → lấy mẫu dày hơn cho đỡ răng cưa
  const offx = [], offy = [];
  for(let j=0;j<ss;j++) for(let i=0;i<ss;i++){
    const ox = ss === 1 ? 0 : (i + .5)/ss - .5, oy = ss === 1 ? 0 : (j + .5)/ss - .5;
    offx.push(cs*ox + sn*oy); offy.push(-sn*ox + cs*oy);
  }
  const ns = offx.length, inv = 1/ns, RX2 = 1/(Rx*Rx), RY2 = 1/(Ry*Ry);
  const maxx = bw - 1, maxy = bh - 1;

  for(let y=y0;y<y1;y++){
    for(let x=x0;x<x1;x++){
      const px = x + .5 - cxp, py = y + .5 - cyp;
      const lx = cs*px + sn*py, ly = -sn*px + cs*py;
      if(lx*lx*RX2 + ly*ly*RY2 >= 1) continue;
      let R = 0, G = 0, B = 0, A = 0;
      for(let s=0;s<ns;s++){
        bodySrc(co, lx + offx[s], ly + offy[s]);
        const u = cs*_sx - sn*_sy + cxp - bx0 - .5;
        const v = sn*_sx + cs*_sy + cyp - by0 - .5;
        const iu = Math.floor(u), iv = Math.floor(v), fu = u - iu, fv = v - iv;
        const ua = iu < 0 ? 0 : (iu > maxx ? maxx : iu), ub = iu + 1 < 0 ? 0 : (iu + 1 > maxx ? maxx : iu + 1);
        const va = iv < 0 ? 0 : (iv > maxy ? maxy : iv), vb = iv + 1 < 0 ? 0 : (iv + 1 > maxy ? maxy : iv + 1);
        const i00 = (va*bw + ua)*4, i10 = (va*bw + ub)*4, i01 = (vb*bw + ua)*4, i11 = (vb*bw + ub)*4;
        const w00 = (1-fu)*(1-fv), w10 = fu*(1-fv), w01 = (1-fu)*fv, w11 = fu*fv;
        R += S[i00]*w00 + S[i10]*w10 + S[i01]*w01 + S[i11]*w11;
        G += S[i00+1]*w00 + S[i10+1]*w10 + S[i01+1]*w01 + S[i11+1]*w11;
        B += S[i00+2]*w00 + S[i10+2]*w10 + S[i01+2]*w01 + S[i11+2]*w11;
        A += S[i00+3]*w00 + S[i10+3]*w10 + S[i01+3]*w01 + S[i11+3]*w11;
      }
      const o = ((y - by0)*bw + (x - bx0))*4;
      O[o] = R*inv + .5; O[o+1] = G*inv + .5; O[o+2] = B*inv + .5; O[o+3] = A*inv + .5;
    }
  }
  c.putImageData(od, bx0, by0);
}
function bodyWarp(c, W, H){
  if(BODY.peek) return;
  for(const p of BODY.parts) if(bodyActive(p)) bodyApply(c, W, H, p);
}

