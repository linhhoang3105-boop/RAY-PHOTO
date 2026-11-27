/* RAY Clarity: khử mờ khí quyển và chi tiết thật theo độ phân giải.
   - dehaze 0..1: ước lượng lớp sương (dark channel) trên lưới nhỏ, tinh chỉnh bằng guided filter
     theo độ sáng từng điểm ảnh nên mép người/núi không bị quầng; giữ trần sáng cho mây và trời.
   - detail 0..1: hai dải tần trên kênh sáng — dải mịn (nét) và dải trung (độ rõ khối),
     bán kính theo unit = W/1200 để bản xem trước và bản xuất cùng vẻ; bỏ nhiễu nhỏ, giới hạn mềm chống viền.
   Chỉ dùng JS thuần (Node, trình duyệt, worker). Alpha giữ nguyên; mức 0 không đụng điểm ảnh. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RayClarity=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const clamp=(v,a,b)=>v<a?a:v>b?b:v,smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
 function boxBlur(src,dst,tmp,W,H,r){
  // Trung bình trượt hai chiều (tách được); ba lượt ≈ Gaussian. Mảng Float32 hoặc Uint16 cùng kiểu.
  if(r<1){dst.set(src);return;}
  const norm=1/(2*r+1);
  for(let y=0;y<H;y++){const row=y*W;let acc=src[row]*(r+1);for(let k=1;k<=r;k++)acc+=src[row+Math.min(W-1,k)];for(let x=0;x<W;x++){tmp[row+x]=acc*norm;acc+=src[row+Math.min(W-1,x+r+1)]-src[row+Math.max(0,x-r)];}}
  for(let x=0;x<W;x++){let acc=tmp[x]*(r+1);for(let k=1;k<=r;k++)acc+=tmp[Math.min(H-1,k)*W+x];for(let y=0;y<H;y++){dst[y*W+x]=acc*norm;acc+=tmp[Math.min(H-1,y+r+1)*W+x]-tmp[Math.max(0,y-r)*W+x];}}
 }
 function gauss(src,dst,W,H,r){const a=new Float32Array(src.length),t=new Float32Array(src.length);boxBlur(src,a,t,W,H,r);boxBlur(a,dst,t,W,H,r);boxBlur(dst,a,t,W,H,r);dst.set(a);}
 function minFilter(src,dst,W,H,r){
  const tmp=new Float32Array(src.length);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){let m=1;for(let k=Math.max(0,x-r);k<=Math.min(W-1,x+r);k++){const v=src[y*W+k];if(v<m)m=v;}tmp[y*W+x]=m;}
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){let m=1;for(let k=Math.max(0,y-r);k<=Math.min(H-1,y+r);k++){const v=tmp[k*W+x];if(v<m)m=v;}dst[y*W+x]=m;}
 }
 // ---------- Khử mờ ----------
 function dehazeField(data,W,H,amount){
  const long=Math.min(256,Math.max(W,H)),GW=Math.max(2,Math.min(W,Math.round(long*W/Math.max(W,H)))),GH=Math.max(2,Math.min(H,Math.round(long*H/Math.max(W,H)))),N=GW*GH;
  const R=new Float32Array(N),G=new Float32Array(N),B=new Float32Array(N),M=new Float32Array(N),L=new Float32Array(N),w=new Float32Array(N);
  const cellX=new Int32Array(W);for(let x=0;x<W;x++)cellX[x]=Math.min(GW-1,Math.floor(x*GW/W));
  for(let y=0;y<H;y++){const row=Math.min(GH-1,Math.floor(y*GH/H))*GW;for(let x=0;x<W;x++){const i=(y*W+x)*4,a=data[i+3];if(!a)continue;const k=row+cellX[x],r=data[i]/255,g=data[i+1]/255,b=data[i+2]/255;R[k]+=r;G[k]+=g;B[k]+=b;M[k]+=r<g?(r<b?r:b):(g<b?g:b);w[k]++;}}
  for(let k=0;k<N;k++){const n=w[k]||1;R[k]/=n;G[k]/=n;B[k]/=n;M[k]/=n;L[k]=R[k]*.2126+G[k]*.7152+B[k]*.0722;}
  // Ánh sáng khí quyển: trung bình 1% ô có kênh tối cao nhất (vùng sương dày/trời), giới hạn để không lấy mảng trắng bệt.
  const dark=new Float32Array(N),r0=Math.max(1,Math.round(Math.max(GW,GH)*.012));minFilter(M,dark,GW,GH,r0);
  const unclipped=Array.from(dark.keys()).filter(k=>Math.max(R[k],G[k],B[k])<.965),pool=unclipped.length>N*.05?unclipped:Array.from(dark.keys()),order=pool.sort((p,q)=>dark[q]-dark[p]).slice(0,Math.max(4,Math.round(N*.02)));
  let Ar=0,Ag=0,Ab=0;for(const k of order){Ar+=R[k];Ag+=G[k];Ab+=B[k];}Ar/=order.length;Ag/=order.length;Ab/=order.length;
  const Al=Ar*.2126+Ag*.7152+Ab*.0722,lift=Al<.72?.72/Math.max(.05,Al):1;Ar=clamp(Ar*lift,.05,.98);Ag=clamp(Ag*lift,.05,.98);Ab=clamp(Ab*lift,.05,.98);
  // Màu sương chính là màu ánh sáng chung: khi lệch nhẹ (ám tím/xanh/vàng của máy) thì cân về trung tính.
  // Lệch quá mạnh (hoàng hôn, đèn màu) là chủ ý của cảnh nên chỉ cân một phần nhỏ.
  // Ám màu theo dải sáng: đo các ô gần trung tính (mây, sương, tường sáng) ở từng dải độ sáng.
  // Ám máy thường nằm ở tông trung (mây xám ngả tím/xanh) trong khi trắng nhất gần trung tính,
  // nên cân bằng đường cong theo dải thay vì một hệ số chung. Lệch quá mạnh (hoàng hôn, đèn màu)
  // là chủ ý của cảnh nên chỉ cân một phần nhỏ.
  const BAND=[.30,.45,.60,.75,.90],bw=.09,acc=BAND.map(()=>[0,0,0,0]);
  for(let k=0;k<N;k++){const mx=Math.max(R[k],G[k],B[k]),mn=Math.min(R[k],G[k],B[k]);if(mx>.985||mx<.05||(mx-mn)/mx>.24)continue;const neutral=1-(mx-mn)/mx/.24;for(let j=0;j<BAND.length;j++){const d=Math.abs(L[k]-BAND[j]);if(d>=bw)continue;const wt=neutral*(1-d/bw);const a=acc[j];a[0]+=R[k]*wt;a[1]+=G[k]*wt;a[2]+=B[k]*wt;a[3]+=wt;}}
  const offsets=BAND.map((_,j)=>{const a=acc[j];if(a[3]<N*.004)return null;const r=a[0]/a[3],g=a[1]/a[3],b=a[2]/a[3],m=(r+g+b)/3,cast=Math.max(Math.abs(r-m),Math.abs(g-m),Math.abs(b-m))/Math.max(.05,m),trust=Math.min(1,amount*1.8)*.85*smooth(.0,.03,a[3]/N)*(1-smooth(.10,.22,cast)*.8);return[clamp((m-r)*trust,-.06,.06),clamp((m-g)*trust,-.06,.06),clamp((m-b)*trust,-.06,.06)];});
  // Dải thiếu dữ liệu lấy theo dải gần nhất; hai đầu (đen, trắng) mờ dần về 0 để giữ điểm đen/trắng.
  for(let j=0;j<offsets.length;j++)if(!offsets[j]){let near=null,dist=9;for(let q=0;q<offsets.length;q++)if(offsets[q]&&Math.abs(q-j)<dist){dist=Math.abs(q-j);near=offsets[q];}offsets[j]=near?near.map(v=>v*(dist>1?.4:.7)):[0,0,0];}
  const castAt=l=>{if(l<=BAND[0]){const f=smooth(.04,BAND[0],l);return offsets[0].map(v=>v*f);}if(l>=BAND[BAND.length-1]){const f=1-smooth(BAND[BAND.length-1],.995,l);return offsets[BAND.length-1].map(v=>v*f);}let j=0;while(l>BAND[j+1])j++;const t=(l-BAND[j])/(BAND[j+1]-BAND[j]);return[0,1,2].map(c=>offsets[j][c]+(offsets[j+1][c]-offsets[j][c])*t);};
  const castLUT=new Float32Array(256*3);for(let i=0;i<256;i++){const o=castAt(i/255);castLUT[i*3]=o[0];castLUT[i*3+1]=o[1];castLUT[i*3+2]=o[2];}
  for(let k=0;k<N;k++){const o=(Math.min(255,Math.max(0,Math.round(L[k]*255))))*3;R[k]=clamp(R[k]+castLUT[o],0,1);G[k]=clamp(G[k]+castLUT[o+1],0,1);B[k]=clamp(B[k]+castLUT[o+2],0,1);L[k]=R[k]*.2126+G[k]*.7152+B[k]*.0722;}
  {const o=Math.round(clamp(Ar*.2126+Ag*.7152+Ab*.0722,0,1)*255)*3;Ar=clamp(Ar+castLUT[o],.05,.98);Ag=clamp(Ag+castLUT[o+1],.05,.98);Ab=clamp(Ab+castLUT[o+2],.05,.98);}
  // Độ truyền thô theo kênh tối chuẩn hoá; vùng gần trắng (mây, trời) giữ trần để không bị kéo xám bẩn.
  const omega=.92*amount,raw=new Float32Array(N);
  for(let k=0;k<N;k++){const d=Math.min(R[k]/Ar,G[k]/Ag,B[k]/Ab),dn=dark[k]/Math.min(Ar,Ag,Ab);raw[k]=1-omega*Math.min(1,Math.max(d*.35+dn*.65,0));}
  // Guided filter: t = a·L + b theo độ sáng; nội suy hệ số rồi áp ở độ phân giải đầy đủ.
  const r=Math.max(2,Math.round(Math.max(GW,GH)*.035)),eps=.0016,mI=new Float32Array(N),mP=new Float32Array(N),mIP=new Float32Array(N),mII=new Float32Array(N),tmp=new Float32Array(N),prod=new Float32Array(N),sq=new Float32Array(N);
  for(let k=0;k<N;k++){prod[k]=L[k]*raw[k];sq[k]=L[k]*L[k];}
  boxBlur(L,mI,tmp,GW,GH,r);boxBlur(raw,mP,tmp,GW,GH,r);boxBlur(prod,mIP,tmp,GW,GH,r);boxBlur(sq,mII,tmp,GW,GH,r);
  const ca=new Float32Array(N),cb=new Float32Array(N);for(let k=0;k<N;k++){const v=mII[k]-mI[k]*mI[k],cov=mIP[k]-mI[k]*mP[k],a=cov/(v+eps);ca[k]=a;cb[k]=mP[k]-a*mI[k];}
  const fa=new Float32Array(N),fb=new Float32Array(N);boxBlur(ca,fa,tmp,GW,GH,r);boxBlur(cb,fb,tmp,GW,GH,r);
  return{GW,GH,fa,fb,A:[Ar,Ag,Ab],castLUT,offsets};
 }
 function applyDehaze(data,W,H,amount){
  const f=dehazeField(data,W,H,amount),{GW,GH,fa,fb,castLUT}=f,[Ar,Ag,Ab]=f.A,t0=.38+.12*(1-amount);
  const X=new Int32Array(W),FX=new Float32Array(W);for(let x=0;x<W;x++){const u=clamp((x+.5)*GW/W-.5,0,GW-1),x0=Math.min(GW-2,Math.floor(u));X[x]=x0;FX[x]=u-x0;}
  const rowA=new Float32Array(GW),rowB=new Float32Array(GW);let before=0,after=0,n=0;const outL=new Float32Array(256),cnt=new Float32Array(256);
  for(let y=0;y<H;y++){
   const v=clamp((y+.5)*GH/H-.5,0,GH-1),y0=Math.min(GH-2,Math.floor(v)),fy=v-y0;
   for(let x=0;x<GW;x++){const k=y0*GW+x;rowA[x]=fa[k]+(fa[k+GW]-fa[k])*fy;rowB[x]=fb[k]+(fb[k+GW]-fb[k])*fy;}
   for(let x=0;x<W;x++){
    const i=(y*W+x)*4;if(!data[i+3])continue;const o=((data[i]*54+data[i+1]*183+data[i+2]*19)>>8)*3,r=clamp(data[i]/255+castLUT[o],0,1),g=clamp(data[i+1]/255+castLUT[o+1],0,1),b=clamp(data[i+2]/255+castLUT[o+2],0,1),l=r*.2126+g*.7152+b*.0722,x0=X[x],fx=FX[x];
    let t=(rowA[x0]+(rowA[x0+1]-rowA[x0])*fx)*l+rowB[x0]+(rowB[x0+1]-rowB[x0])*fx;t=clamp(t,t0,1);
    // Vùng rất tối giữ nguyên chi tiết đen; giảm mức để không bẻ gãy bóng thành mảng.
    const keep=smooth(.0,.10,l);t=1-(1-t)*keep;
    let R=(r-Ar)/t+Ar,G=(g-Ag)/t+Ag,B=(b-Ab)/t+Ab;
    const lo=Math.min(R,G,B);if(lo<0){const l2=Math.max(0,R*.2126+G*.7152+B*.0722),s=l2/(l2-lo+1e-6);R=l2+(R-l2)*s;G=l2+(G-l2)*s;B=l2+(B-l2)*s;}
    data[i]=clamp(R,0,1)*255;data[i+1]=clamp(G,0,1)*255;data[i+2]=clamp(B,0,1)*255;
    const l1=clamp(R*.2126+G*.7152+B*.0722,0,1),bin=(l*255)|0;outL[bin]+=l1;cnt[bin]++;before+=l;after+=l1;n++;
   }
  }
  // Bù phơi sáng tông trung: khử mờ làm ảnh tối đi; kéo lại trung bình mà vẫn giữ đen sâu và trần sáng.
  if(n&&after>1e-4){
   const gain=clamp(Math.pow(before/after,.85),1,1.6);if(gain>1.002){const lut=new Uint8ClampedArray(256);for(let i=0;i<256;i++){const v=i/255,lifted=1-Math.pow(1-v,gain),w=smooth(.02,.25,v)*(1-smooth(.80,1,v)*.6);lut[i]=Math.round((v+(lifted-v)*w)*255);}
    for(let i=0;i<data.length;i+=4){if(!data[i+3])continue;const r=data[i],g=data[i+1],b=data[i+2],l=(r*54+g*183+b*19)>>8,nl=lut[l];if(nl===l)continue;const k=nl/Math.max(1,l);if(k>1){const hi=Math.max(r,g,b),cap=hi*k>255?(255-l)/Math.max(1,hi-l):1;data[i]=Math.min(255,nl+(r-l)*Math.min(k,cap));data[i+1]=Math.min(255,nl+(g-l)*Math.min(k,cap));data[i+2]=Math.min(255,nl+(b-l)*Math.min(k,cap));}}}
  }
 }
 // ---------- Chi tiết ----------
 // Xử lý theo dải hàng (128 hàng + lề) để ảnh 12MP không cần nhiều mảng toàn ảnh; kết quả như xử lý một lần.
 function applyDetail(data,W,H,amount,unit){
  const u=Math.max(.25,unit||W/1200),r1=Math.max(1,Math.round(.9*u)),m=3*r1+2,lumAt=i=>(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722)/255;
  // Dải trung (độ rõ khối, σ ≈ 5,2·unit) trên lưới thu nhỏ theo khối: nhẹ bộ nhớ, nội suy lại khi áp.
  const s=Math.max(1,Math.floor(2*u)),qw=Math.max(2,Math.ceil(W/s)),qh=Math.max(2,Math.ceil(H/s)),q=new Float32Array(qw*qh),qn=new Float32Array(qw*qh);
  for(let y=0;y<H;y++){const row=Math.min(qh-1,(y/s)|0)*qw;for(let x=0;x<W;x++){const k=row+Math.min(qw-1,(x/s)|0);q[k]+=lumAt((y*W+x)*4);qn[k]++;}}
  for(let k=0;k<q.length;k++)q[k]/=qn[k]||1;
  const mid=new Float32Array(qw*qh);gauss(q,mid,qw,qh,Math.max(1,Math.round(5.2*u/s)));
  // Nhiễu nền: trung vị phần dư Laplace trên mẫu thưa → ngưỡng bỏ nhiễu theo chính ảnh.
  const sample=[],stride=Math.max(1,Math.floor(W*H/40000));for(let k=W+1;k<W*H-W-1;k+=stride){const i=k*4;sample.push(Math.abs(lumAt(i)-(lumAt(i-4)+lumAt(i+4)+lumAt(i-W*4)+lumAt(i+W*4))/4));}
  sample.sort((a,b)=>a-b);const core=clamp((sample[sample.length>>1]||0)*.9,.0015,.012);
  const k1=amount*1.15,k2=amount*.85,lim1=.06,lim2=.10,S=128,cap=W*(S+2*m),Ls=new Float32Array(cap),fs=new Float32Array(cap),ta=new Float32Array(cap),tb=new Float32Array(cap);
  let carry=null,carryStart=0;
  for(let y0=0;y0<H;y0+=S){
   const y1=Math.min(H,y0+S),a=Math.max(0,y0-m),b=Math.min(H,y1+m),hs=b-a,n=W*hs;
   for(let y=a;y<b;y++){const off=(y-a)*W;if(y<y0&&carry){Ls.set(carry.subarray((y-carryStart)*W,(y-carryStart+1)*W),off);continue;}for(let x=0;x<W;x++)Ls[off+x]=lumAt((y*W+x)*4);}
   const L=Ls.subarray(0,n),F=fs.subarray(0,n);boxBlur(L,F,ta.subarray(0,n),W,hs,r1);boxBlur(F,tb.subarray(0,n),ta.subarray(0,n),W,hs,r1);boxBlur(tb.subarray(0,n),F,ta.subarray(0,n),W,hs,r1);
   // Giữ độ sáng gốc của các hàng cuối làm lề cho dải sau (trước khi đổi điểm ảnh).
   carryStart=Math.max(a,y1-m);carry=Ls.slice((carryStart-a)*W,(y1-a)*W);
   for(let y=y0;y<y1;y++){const v=clamp((y+.5)/s-.5,0,qh-1),qy=Math.min(qh-2,Math.floor(v)),fy=v-qy,off=(y-a)*W;
    for(let x=0;x<W;x++){const i=(y*W+x)*4;if(!data[i+3])continue;const uu=clamp((x+.5)/s-.5,0,qw-1),qx=Math.min(qw-2,Math.floor(uu)),fx=uu-qx,p0=mid[qy*qw+qx],p1=mid[qy*qw+qx+1],p2=mid[(qy+1)*qw+qx],p3=mid[(qy+1)*qw+qx+1],top=p0+(p1-p0)*fx,md=top+((p2+(p3-p2)*fx)-top)*fy,l=L[off+x],f=F[off+x];
     let d1=l-f;d1=Math.sign(d1)*Math.max(0,Math.abs(d1)-core);d1/=1+Math.abs(d1)/lim1;
     let d2=f-md;d2/=1+Math.abs(d2)/lim2;
     const tone=smooth(.03,.22,l)*(1-.55*smooth(.80,.98,l)),delta=(d1*k1+d2*k2)*tone*255;if(Math.abs(delta)<.25)continue;
     // Cộng đều cả ba kênh: đổi độ sáng, giữ hướng màu; co lại khi chạm trần/đáy.
     let dr=delta;const hi=Math.max(data[i],data[i+1],data[i+2]),lo=Math.min(data[i],data[i+1],data[i+2]);if(dr>0&&hi+dr>255)dr=255-hi;if(dr<0&&lo+dr<0)dr=-lo;
     data[i]+=dr;data[i+1]+=dr;data[i+2]+=dr;}}
  }
 }
 function apply(image,{dehaze=0,detail=0,unit}={}){
  const W=image.width,H=image.height,data=image.data;if(!data||W<4||H<4)return image;
  const dz=clamp(Number(dehaze)||0,0,1),dt=clamp(Number(detail)||0,0,1);
  if(dz>.001)applyDehaze(data,W,H,dz);
  if(dt>.001)applyDetail(data,W,H,dt,unit||W/1200);
  return image;
 }
 function applyToContext(ctx,W,H,options){const image=ctx.getImageData(0,0,W,H);apply(image,options);ctx.putImageData(image,0,0);}
 return{apply,applyToContext,dehazeField};
});
