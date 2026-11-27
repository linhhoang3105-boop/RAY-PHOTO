/* ============ nước ảnh trong veo: lớp hoàn thiện riêng của ảnh in ============
   Đường tông sạch + tương phản cục bộ trên độ sáng, giữ hướng màu của preset.
   Guided filter trên lưới nhỏ: nền sáng đi theo cạnh ảnh, hạn chế viền sáng/tối.
   Nội suy hệ số rồi dùng độ sáng đầy đủ để bản xem trước và bản xuất cùng tỉ lệ.
   Không giữ mảng float toàn ảnh; alpha giữ nguyên. Mức 0 là đường đi cũ hoàn toàn. */
function clearPrint(c, W, H, amount){
  const strength = clamp(Number(amount) || 0, 0, 1);
  if(strength <= .001 || W < 2 || H < 2) return;
  const image = c.getImageData(0,0,W,H), data = image.data;
  const long = Math.min(192, Math.max(W,H));
  const GW = Math.max(2, Math.min(W, Math.round(long*W/Math.max(W,H))));
  const GH = Math.max(2, Math.min(H, Math.round(long*H/Math.max(W,H))));
  const N = GW*GH;
  const guide = new Float32Array(N), weight = new Float32Array(N), mean = new Float32Array(N),
        square = new Float32Array(N), a = new Float32Array(N), b = new Float32Array(N),
        tmp = new Float32Array(N), blurredWeight = new Float32Array(N);
  const cellX = new Int32Array(W);
  for(let x=0;x<W;x++) cellX[x] = Math.min(GW-1, Math.floor(x*GW/W));
  for(let y=0;y<H;y++){
    const row = Math.min(GH-1, Math.floor(y*GH/H))*GW;
    for(let x=0;x<W;x++){
      const i=(y*W+x)*4, alpha=data[i+3]/255;
      if(alpha === 0) continue;
      const k=row+cellX[x], l=(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722)/255;
      guide[k] += l*alpha; weight[k] += alpha;
    }
  }
  // Trọng số alpha giúp các điểm ảnh trong suốt không làm tối mép chủ thể.
  for(let k=0;k<N;k++){
    const w=weight[k];
    guide[k] = w > 0 ? guide[k]/w : 0;
    weight[k] = w > 0 ? 1 : 0;
    mean[k] = guide[k]*weight[k];
    square[k] = guide[k]*guide[k]*weight[k];
  }
  blurredWeight.set(weight);
  const radius = Math.max(1, Math.round(Math.max(GW,GH)*.028));
  boxBlurGrid(mean,tmp,GW,GH,radius,1);
  boxBlurGrid(square,tmp,GW,GH,radius,1);
  boxBlurGrid(blurredWeight,tmp,GW,GH,radius,1);
  for(let k=0;k<N;k++){
    const w=blurredWeight[k];
    if(w < .00001) continue;
    const m=mean[k]/w, variance=Math.max(0,square[k]/w-m*m);
    const edge=variance/(variance+.0025);
    a[k]=edge*weight[k]; b[k]=(m-edge*m)*weight[k];
  }
  boxBlurGrid(a,tmp,GW,GH,radius,1);
  boxBlurGrid(b,tmp,GW,GH,radius,1);
  // a,b đã nhân weight: chuẩn hoá lại sau làm mờ.
  for(let k=0;k<N;k++){
    const w=blurredWeight[k];
    if(w > .00001){ a[k]/=w; b[k]/=w; }
  }
  const tone = new Float32Array(256), local = new Float32Array(256), vibrant = new Float32Array(256);
  for(let i=0;i<256;i++){
    const l=i/255, pivot=l*(1-l);
    // Hai đầu dải tông cố định; chuyển dần qua trung tông, không bẻ gãy vùng sáng.
    tone[i] = strength*(.20*pivot*(2*l-1)+.045*pivot);
    local[i] = strength*.48*smooth(.015,.13,l)*(1-smooth(.80,.99,l));
    vibrant[i] = strength*.10*smooth(.06,.30,l)*(1-smooth(.70,.98,l));
  }
  const X = new Int32Array(W), FX = new Float32Array(W);
  for(let x=0;x<W;x++){
    const u=clamp((x+.5)*GW/W-.5,0,GW-1), x0=Math.min(GW-2,Math.floor(u));
    X[x]=x0; FX[x]=u-x0;
  }
  const rowA=new Float32Array(GW), rowB=new Float32Array(GW);
  for(let y=0;y<H;y++){
    const v=clamp((y+.5)*GH/H-.5,0,GH-1), y0=Math.min(GH-2,Math.floor(v)), fy=v-y0;
    for(let x=0;x<GW;x++){
      const k=y0*GW+x;
      rowA[x]=a[k]+(a[k+GW]-a[k])*fy;
      rowB[x]=b[k]+(b[k+GW]-b[k])*fy;
    }
    for(let x=0;x<W;x++){
      const i=(y*W+x)*4;
      if(data[i+3] === 0) continue;
      const r=data[i]/255, g=data[i+1]/255, bb=data[i+2]/255;
      const l=r*.2126+g*.7152+bb*.0722, li=Math.round(l*255);
      const x0=X[x], fx=FX[x];
      const base=(rowA[x0]+(rowA[x0+1]-rowA[x0])*fx)*l + rowB[x0]+(rowB[x0+1]-rowB[x0])*fx;
      const chroma=Math.max(r,g,bb)-Math.min(r,g,bb);
      const warm=smooth(.005,.07,r-g)*smooth(.005,.07,g-bb)*(1-smooth(.35,.65,chroma));
      let detail=l-base;
      // Bỏ sai biệt rất nhỏ (nhiễu), giới hạn mềm độ đổi để màu da và cạnh ảnh dịu.
      detail = Math.sign(detail)*Math.max(0,Math.abs(detail)-.003);
      detail /= 1+Math.abs(detail)/.08;
      const target=clamp(l+tone[li]+detail*local[li]*(1-.55*warm),0,1);
      const cleanColor=smooth(.012,.08,chroma)*(1-smooth(.30,.65,chroma));
      const saturation=1+vibrant[li]*cleanColor*(1-.75*warm);
      let scale=target >= l ? (1-target)/Math.max(1-l,1e-6) : target/Math.max(l,1e-6);
      scale *= saturation;
      let dr=(r-l)*scale, dg=(g-l)*scale, db=(bb-l)*scale;
      const lo=Math.min(dr,dg,db), hi=Math.max(dr,dg,db);
      let gamut=1;
      if(lo < -target) gamut=Math.min(gamut,target/-lo);
      if(hi > 1-target) gamut=Math.min(gamut,(1-target)/hi);
      data[i]=(target+dr*gamut)*255;
      data[i+1]=(target+dg*gamut)*255;
      data[i+2]=(target+db*gamut)*255;
    }
  }
  c.putImageData(image,0,0);
}


