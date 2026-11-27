/* ============ bảng tra 1 chiều cho mỗi kênh ============ */
function buildLUT(p){
  const R = new Float32Array(256), G = new Float32Array(256), B = new Float32Array(256);
  const rG = 1 + p.temp*.20, bG = 1 - p.temp*.20;
  const gG = 1 - p.tint*.13;
  const rO = p.temp*.012, bO = -p.temp*.006;
  const fOn = (p.film||0) > 0.001;
  const fcR = fOn ? monoCurve(FILM_X, FILM_Y.r) : null, fcG = fOn ? monoCurve(FILM_X, FILM_Y.g) : null,
        fcB = fOn ? monoCurve(FILM_X, FILM_Y.b) : null;

  for(let i=0;i<256;i++){
    let v = i/255;

    // tương phản: pha giữa đường tuyến tính và đường S
    if(p.contrast >= 0){
      const s = v*v*(3-2*v);
      v = v + (s-v)*p.contrast;
    }else{
      const f = v*.62 + .19;
      v = v + (f-v)*(-p.contrast);
    }

    // Film Exposure: tăng phơi sáng vùng midtone, nén vùng highlight, nâng nhẹ vùng shadow
    if(p.filmExp > 0.001){
      const fe = p.filmExp;
      const mid = 4*v*(1-v);                       // trọng số cao nhất ở giữa dải tông
      v = v + fe*0.24*mid;                          // đẩy phơi sáng midtone lên
      v = v + fe*0.11*(1-v)*(1-v);                  // nâng nhẹ vùng tối để tạo độ fade/lì
      const hiKnee = 0.66;
      if(v > hiKnee){
        v = hiKnee + (v-hiKnee) * (1 - fe*0.5);     // nén vùng sáng lại, tránh cháy gắt
      }
      v = clamp(v, 0, 1);
    }

    // phim tráng in: đường cong đặc tính — mũi mềm, vai cuộn dần (highlight roll-off); ba lớp nhũ lệch nhẹ nhau
    // (bóng hơi mát, vùng sáng hơi ấm) nên phần lệch của đỏ/lam so với lục cộng ở cuối; đen 0 vẫn là 0
    let fdR = 0, fdB = 0;
    if(fOn){
      const ff = p.film*FILM_GAIN, v0 = v, yg = fcG(v0);
      fdR = ff*(fcR(v0) - yg); fdB = ff*(fcB(v0) - yg);
      v = v0 + (yg - v0)*ff;
    }

    // bề mặt bóng: đường cong S nhẹ cho màu/đen sâu hơn như ảnh in glossy
    if(p.gloss > 0.001){
      const sg = v*v*(3-2*v);
      v = v + (sg-v)*0.3*p.gloss;
    }

    // tách tông: đẩy vùng tối và vùng sáng về hai phía đối nhau
    const sh = (1-v)*(1-v), hi = v*v, sp = p.split;
    const spR = sp*(hi*.055 - sh*.050);
    const spG = sp*(hi*.020 + sh*.012);
    const spB = sp*(sh*.062 - hi*.048);

    // đen bạc màu: nâng nền theo màu nền phim, đỏ nâng nhiều hơn lam
    const lR = p.lift*.175, lG = p.lift*.150, lB = p.lift*.125;
    const vR = lR + v*(1 - lR*1.25);
    const vG = lG + v*(1 - lG*1.25);
    const vB = lB + v*(1 - lB*1.25);

    // giấy ảnh: điểm trắng của giấy ngả kem (nhân gain — ảnh hưởng vùng sáng nhiều nhất, vùng tối gần như không)
    const pw = p.paper||0;
    R[i] = clamp(((vR+fdR)*rG + rO + spR)*(1 - pw*0.035), 0, 1);
    G[i] = clamp((vG*gG + spG)*(1 - pw*0.058), 0, 1);
    B[i] = clamp(((vB+fdB)*bG + bO + spB)*(1 - pw*0.115), 0, 1);
  }
  return {R,G,B};
}

