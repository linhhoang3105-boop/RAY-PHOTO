/* Adapted from the user's Buồng Tối 7f source supplied in this conversation.
   Original roll parameters and LUT formulas, plus a reference-inspired Nắng hoa grade. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BuongToiLab=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const defaults={temp:0,tint:0,split:0,contrast:0,sat:0,lift:0,halation:0,grain:0,vignette:0,leak:0,dust:0,ca:0,flash:0,seed:1234,haltint:0,glow:0,nang:0,filmExp:0,sharp:0,kinh:0,bgBlur:0,motion:0,motionAngle:-25,rgAtmos:'off',leakManual:false,leakShape:'circle',leakAngle:0,leakBandWidth:.3,leakHue:0,leakSat:1,nangSat:1,nangManual:false,nangSize:.75,spark:0,sparkMode:'fine',paper:0,gloss:0,soft:0,ptex:0};
 const fields=['temp','tint','split','contrast','sat','lift','halation','grain','vignette','leak','dust','ca','flash'];
 const rolls=[];
 function roll(id,name,group,a,extras={}){const p={};fields.forEach((k,i)=>p[k]=a[i]||0);Object.assign(p,extras);rolls.push({id,name,group,p});}
 roll('goc','Gốc','Gốc',[]);
 roll('nanghoa','Nắng hoa · màu mẫu','Màu theo ảnh mẫu',[.14,.035,.10,.22,.02,.015,.08,.035,.08,0,0,0,0],{glow:.08,soft:.10,paper:.14,profile:'nanghoa'});
 roll('portra400','Hồng mơ','Máy & phim',[.12,.04,.06,-.06,-.04,.1,.16,.14,.08,0,.02,.04,0]);
 roll('hanquoc','Hàn Quốc','Châu Á',[-.04,.1,.08,-.12,-.08,.16,.28,.08,.06,0,.01,.04,0]);
 roll('fujicam','Vườn sau mưa','Máy ảnh số',[.06,-.06,.15,.16,.26,.02,.08,.06,.06,0,.01,.03,0]);
 roll('ccd','Ngày trong','Máy & phim',[-.08,.12,.1,.34,.18,.1,.3,.2,.14,0,.05,.26,.22]);
 roll('thap90','Thập niên 90','Máy & phim',[.1,.02,.04,.1,.04,.04,.12,.16,.3,0,.03,.04,0]);
 roll('anhrua','Ảnh rửa tiệm','Máy & phim',[.06,.02,.04,.06,.02,.06,.06,.1,.08,0,.01,.02,.2],{glow:.15,paper:.6,gloss:.5,soft:.3,ptex:.35});
 roll('demflash','Đêm flash','Ánh sáng',[.2,-.12,.1,.36,-.06,.04,.62,.42,.3,0,.08,.14,.62]);
 roll('denrang','Đen trắng','Khác',[0,0,0,.46,-1,.12,.16,.66,.34,0,.22,0,0]);
 let factory=null;
 function setCanvasFactory(f){factory=f;}
 function cv(w,h){if(factory)return factory(w,h);const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
 const clamp=(v,a,b)=>v<a?a:v>b?b:v;
 const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
 function rng(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
 function buildLUT(p){
  const R=new Float32Array(256),G=new Float32Array(256),B=new Float32Array(256),rG=1+p.temp*.20,bG=1-p.temp*.20,gG=1-p.tint*.13,rO=p.temp*.012,bO=-p.temp*.006;
  for(let i=0;i<256;i++){
   let v=i/255;if(p.contrast>=0){const s=v*v*(3-2*v);v+=(s-v)*p.contrast;}else{const f=v*.62+.19;v+=(f-v)*(-p.contrast);}
   if(p.filmExp>.001){const fe=p.filmExp,mid=4*v*(1-v);v+=fe*.24*mid;v+=fe*.11*(1-v)*(1-v);if(v>.66)v=.66+(v-.66)*(1-fe*.5);v=clamp(v,0,1);}
   if(p.gloss>.001){const sg=v*v*(3-2*v);v+=(sg-v)*.3*p.gloss;}
   const sh=(1-v)*(1-v),hi=v*v,sp=p.split,spR=sp*(hi*.055-sh*.050),spG=sp*(hi*.020+sh*.012),spB=sp*(sh*.062-hi*.048),lR=p.lift*.175,lG=p.lift*.150,lB=p.lift*.125,vR=lR+v*(1-lR*1.25),vG=lG+v*(1-lG*1.25),vB=lB+v*(1-lB*1.25),pw=p.paper||0;
   R[i]=clamp((vR*rG+rO+spR)*(1-pw*.035),0,1);G[i]=clamp((vG*gG+spG)*(1-pw*.058),0,1);B[i]=clamp((vB*bG+bO+spB)*(1-pw*.115),0,1);
  }return{R,G,B};
 }
 function boxBlur(a,tmp,W,H,R,passes=3){const RN=2*R+1;for(let p=0;p<passes;p++){for(let y=0;y<H;y++){const row=y*W;let acc=0;for(let k=-R;k<=R;k++)acc+=a[row+clamp(k,0,W-1)];for(let x=0;x<W;x++){tmp[row+x]=acc/RN;acc+=a[row+clamp(x+R+1,0,W-1)]-a[row+clamp(x-R,0,W-1)];}}for(let x=0;x<W;x++){let acc=0;for(let k=-R;k<=R;k++)acc+=tmp[clamp(k,0,H-1)*W+x];for(let y=0;y<H;y++){a[y*W+x]=acc/RN;acc+=tmp[clamp(y+R+1,0,H-1)*W+x]-tmp[clamp(y-R,0,H-1)*W+x];}}}}
 function sample(a,W,H,u,v){u=clamp(u,0,W-1);v=clamp(v,0,H-1);const x=Math.min(W-2,u|0),y=Math.min(H-2,v|0),fx=u-x,fy=v-y;return(a[y*W+x]*(1-fx)+a[y*W+x+1]*fx)*(1-fy)+(a[(y+1)*W+x]*(1-fx)+a[(y+1)*W+x+1]*fx)*fy;}
 function star(c,x,y,r,rot=0){c.save();c.translate(x,y);c.rotate(rot);c.beginPath();c.moveTo(0,-r);c.quadraticCurveTo(0,0,r,0);c.quadraticCurveTo(0,0,0,r);c.quadraticCurveTo(0,0,-r,0);c.quadraticCurveTo(0,0,0,-r);c.fill();c.restore();}
 function glowBloom(c,W,H,p){
  if(W<4||H<4)return;const GW=Math.max(2,Math.min(W,Math.round(W>=H?192:192*W/H))),GH=Math.max(2,Math.min(H,Math.round(H>=W?192:192*H/W))),N=GW*GH;
  const id=c.getImageData(0,0,W,H),d=id.data,sm=new Float32Array(N),sr=new Float32Array(N),sg=new Float32Array(N),sb=new Float32Array(N),sl=new Float32Array(N),cnt=new Float32Array(N),tmp=new Float32Array(N);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,k=Math.min(GH-1,(y*GH/H)|0)*GW+Math.min(GW-1,(x*GW/W)|0),l=(d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722)/255,m=smooth(.58,.96,l);cnt[k]++;sl[k]+=l;sm[k]+=m;sr[k]+=m*d[i]/255;sg[k]+=m*d[i+1]/255;sb[k]+=m*d[i+2]/255;}
  for(let k=0;k<N;k++)for(const a of [sm,sr,sg,sb,sl])a[k]/=cnt[k]||1;
  for(const a of [sm,sr,sg,sb,sl])boxBlur(a,tmp,GW,GH,4,3);
  const ar=new Float32Array(N),ag=new Float32Array(N),ab=new Float32Array(N),kc=new Float32Array(N),lb=new Float32Array(N),kn=1/(1-Math.exp(-1.8));
  for(let k=0;k<N;k++){const gm=sm[k],alpha=.5*p.glow*(1-Math.exp(-1.8*gm))*kn,hr=gm>1e-4?Math.min(1,sr[k]/gm):1,hg=gm>1e-4?Math.min(1,sg[k]/gm):1,hb=gm>1e-4?Math.min(1,sb[k]/gm):1;ar[k]=alpha*(.5*hr+.5);ag[k]=alpha*(.5*hg+.5*.985);ab[k]=alpha*(.5*hb+.5*.955);const al=.2126*ar[k]+.7152*ag[k]+.0722*ab[k];lb[k]=Math.log(sl[k]+al*(1-sl[k])+.035);kc[k]=.8*al;}
  let ds=((p.seed|0)*2246822519^0x85EBCA6B)>>>0;if(!ds)ds=1;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const u=(x+.5)/W*GW-.5,v=(y+.5)/H*GH-.5,a=sample(ar,GW,GH,u,v);if(a<.0012)continue;const i=(y*W+x)*4;let r=d[i]+(255-d[i])*a,g=d[i+1]+(255-d[i+1])*sample(ag,GW,GH,u,v),b=d[i+2]+(255-d[i+2])*sample(ab,GW,GH,u,v),kk=sample(kc,GW,GH,u,v);if(kk>.002){const l=(r*.2126+g*.7152+b*.0722)/255,wt=(1-.65*smooth(.72,1,l))*(.6+.4*smooth(0,.1,l)),e=clamp((Math.log(l+.035)-sample(lb,GW,GH,u,v))*kk*wt,-.18,.22),gain=1+e+.5*e*e+e*e*e/6;r=clamp(r*gain,0,255);g=clamp(g*gain,0,255);b=clamp(b*gain,0,255);}ds^=ds<<13;ds^=ds>>>17;ds^=ds<<5;const n=(ds>>>0)/4294967296-.5;d[i]=r+n;d[i+1]=g+n;d[i+2]=b+n;}
  c.putImageData(id,0,0);
 }
 function glossSurface(c,W,H,p){
  const GW=Math.max(16,Math.round(W>=H?192:192*W/H)),GH=Math.max(16,Math.round(H>=W?192:192*H/W)),small=cv(GW,GH),sx=small.getContext('2d');sx.drawImage(c.canvas,0,0,GW,GH);const sd=sx.getImageData(0,0,GW,GH).data,L=new Float32Array(GW*GH),tmp=new Float32Array(GW*GH);for(let k=0;k<L.length;k++)L[k]=(sd[k*4]*.2126+sd[k*4+1]*.7152+sd[k*4+2]*.0722)/255;boxBlur(L,tmp,GW,GH,4,3);small.width=small.height=1;
  const rg=rng((p.seed^0x2B7E1516)>>>0),side=rg()<.5?-1:1,ang=(rg()<.5?-1:1)*(12+rg()*28)*Math.PI/180,nX=-Math.sin(ang),nY=Math.cos(ang),c0=.08+rg()*.20,lat1=new Float32Array(49),lat2=new Float32Array(49);for(let k=0;k<49;k++){lat1[k]=rg()*2-1;lat2[k]=rg()*2-1;}
  const wave=(lat,fx,fy)=>{const gx=fx*6,gy=fy*6,x0=Math.min(5,gx|0),y0=Math.min(5,gy|0);let tx=gx-x0,ty=gy-y0;tx=tx*tx*(3-2*tx);ty=ty*ty*(3-2*ty);return(lat[y0*7+x0]*(1-tx)+lat[y0*7+x0+1]*tx)*(1-ty)+(lat[(y0+1)*7+x0]*(1-tx)+lat[(y0+1)*7+x0+1]*tx)*ty;};
  const S=new Float32Array(GW*GH),lnB=new Float32Array(GW*GH),diag=Math.hypot(W,H);for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){const fx=(x+.5)/GW,fy=(y+.5)/GH,pr=side*(((fx-.5)*W)*nX+((fy-.5)*H)*nY)/diag,t=pr-c0+.03*wave(lat1,fx,fy),ramp=Math.pow(smooth(-.58,0,t),1.5),cut=1-smooth(0,.13,t),dt=(t+.02)/.055;S[y*GW+x]=ramp*cut*(1+.32*Math.exp(-dt*dt))*(1+.1*wave(lat2,fx,fy));lnB[y*GW+x]=Math.log(L[y*GW+x]+.035);}
  const id=c.getImageData(0,0,W,H),d=id.data;let ds=((p.seed|0)*2654435761^0x9E3779B9)>>>0;if(!ds)ds=1;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,u=(x+.5)/W*GW-.5,v=(y+.5)/H*GH-.5,l=(d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722)/255,wt=(1-.65*smooth(.72,1,l))*(.6+.4*smooth(0,.1,l)),e=clamp((Math.log(l+.035)-sample(lnB,GW,GH,u,v))*.3*p.gloss*wt,-.22,.26),gain=1+e+.5*e*e+e*e*e/6,A=.3*p.gloss*sample(S,GW,GH,u,v)*(.08+.92*smooth(.03,.55,Math.min(1,l*gain)));ds^=ds<<13;ds^=ds>>>17;ds^=ds<<5;const n=(ds>>>0)/4294967296-.5;for(let k=0;k<3;k++){let q=clamp(d[i+k]*gain,0,255);q+=(255-q)*A*[1,.985,.955][k];d[i+k]=q+n;}}
  c.putImageData(id,0,0);
 }
 function renderPhoto(target,src,params={}){
  const p={...defaults,...params},W=src.width,H=src.height,unit=W/1200,rnd=rng(p.seed);target.width=W;target.height=H;const c=target.getContext('2d',{willReadFrequently:true});c.drawImage(src,0,0);const lut=buildLUT(p),id=c.getImageData(0,0,W,H),d=id.data,off=Math.round(p.ca*unit*2.6);
  if(off>0){const row=new Uint8ClampedArray(W*4);for(let y=0;y<H;y++){const base=y*W*4;row.set(d.subarray(base,base+W*4));for(let x=0;x<W;x++){d[base+x*4]=row[Math.max(0,x-off)*4];d[base+x*4+2]=row[Math.min(W-1,x+off)*4+2];}}}
  const gl=p.gloss||0,sat=1+p.sat-.08*(p.paper||0),nangHoa=p.profile==='nanghoa';
  for(let i=0;i<d.length;i+=4){
   let r=lut.R[d[i]],g=lut.G[d[i+1]],b=lut.B[d[i+2]];
   if(sat!==1||gl>.001){const l=r*.2126+g*.7152+b*.0722,sp=gl>.001?sat+gl*(.05+.23*(1-smooth(.3,.9,l))):sat;r=l+(r-l)*sp;g=l+(g-l)*sp;b=l+(b-l)*sp;}
   if(nangHoa){
    // Masks use the input hue: the warm cream curve must not turn skies yellow.
    const rr=d[i]/255,gg=d[i+1]/255,bb=d[i+2]/255,max=Math.max(rr,gg,bb),min=Math.min(rr,gg,bb),ch=max-min;
    if(ch>.015){
     let h=max===rr?((gg-bb)/ch+(gg<bb?6:0)):max===gg?(bb-rr)/ch+2:(rr-gg)/ch+4;h*=60;
     const chroma=smooth(.015,.15,ch),blue=(1-smooth(22,65,Math.abs(h-213)))*chroma,green=(1-smooth(25,65,Math.abs(h-125)))*chroma,pink=(1-smooth(16,43,Math.min(Math.abs(h-322),360-Math.abs(h-322))))*chroma;
     const l=r*.2126+g*.7152+b*.0722,sp=1-.14*blue-.12*green+.09*pink;
     r=l+(r-l)*sp+.010*blue-.007*green+.008*pink;
     g=l+(g-l)*sp+.018*blue-.003*green;
     b=l+(b-l)*sp+.004*green-.003*pink;
     const deep=1-.025*green*smooth(.06,.4,l)*(1-smooth(.5,.85,l));r*=deep;g*=deep;b*=deep;
    }
   }
   d[i]=r*255;d[i+1]=g*255;d[i+2]=b*255;
  }
  if(p.sharp>.001){const s=d.slice(),a=p.sharp*.9;for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=(y*W+x)*4;for(let k=0;k<3;k++)d[i+k]=clamp(s[i+k]+(s[i+k]-(s[i-4+k]+s[i+4+k]+s[i-W*4+k]+s[i+W*4+k])/4)*a,0,255);}}
  c.putImageData(id,0,0);
  if(p.soft>.001){const f=1.5+p.soft*3.5,s=cv(Math.max(16,Math.round(W/f)),Math.max(16,Math.round(H/f)));s.getContext('2d').drawImage(target,0,0,s.width,s.height);c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.globalAlpha=clamp(p.soft*.8,0,1);c.drawImage(s,0,0,W,H);c.restore();s.width=s.height=1;}
  if(p.flash>.001){const x=W/2,y=H*.46,far=Math.max(W,H),g=c.createRadialGradient(x,y,0,x,y,far*.55);g.addColorStop(0,`rgba(255,247,233,${(p.flash*.17).toFixed(3)})`);g.addColorStop(.5,'rgba(255,247,233,0)');g.addColorStop(1,'rgba(255,247,233,0)');c.save();c.globalCompositeOperation='screen';c.fillStyle=g;c.fillRect(0,0,W,H);c.restore();const gd=c.createRadialGradient(x,y,Math.min(W,H)*.16,x,y,far*.70);gd.addColorStop(0,'#fff');gd.addColorStop(.55,'#60584e');gd.addColorStop(1,'#0a0908');c.save();c.globalCompositeOperation='multiply';c.globalAlpha=p.flash*.78;c.fillStyle=gd;c.fillRect(0,0,W,H);c.restore();}
  if(p.nang>.001){const x=(p.nangManual?p.nangX??.5:.5)*W,y=(p.nangManual?p.nangY??.04:.04)*H,R=Math.max(W,H)*p.nangSize,col=(r,g,b,a)=>{const t=p.nangSat;let q=[r,g,b];q=t<=1?q.map(v=>255+(v-255)*t):q.map((v,i)=>v+(Math.max(0,v-[90,130,200][i])-v)*(t-1));return`rgba(${q.map(v=>Math.round(clamp(v,0,255))).join(',')},${a})`;};const g=c.createRadialGradient(x,y,0,x,y,R);g.addColorStop(0,col(255,248,222,1));g.addColorStop(.38,col(255,220,156,.6));g.addColorStop(1,col(255,220,156,0));c.save();c.globalCompositeOperation='screen';c.globalAlpha=p.nang*.85;c.fillStyle=g;c.fillRect(0,0,W,H);c.globalCompositeOperation='soft-light';c.globalAlpha=p.nang*.6;const g2=c.createRadialGradient(x,y,0,x,y,R*1.3);g2.addColorStop(0,col(255,226,172,1));g2.addColorStop(1,col(255,226,172,0));c.fillStyle=g2;c.fillRect(0,0,W,H);c.restore();}
  if(p.halation>.001){const s=cv(Math.max(24,Math.round(W/26)),Math.max(24,Math.round(H/26))),sx=s.getContext('2d'),hc=[255+(235-255)*p.haltint,150+(45-150)*p.haltint,92+(60-92)*p.haltint];sx.drawImage(target,0,0,s.width,s.height);const im=sx.getImageData(0,0,s.width,s.height),tmp=new Float32Array(s.width*s.height),weights=new Float32Array(s.width*s.height);for(let j=0;j<weights.length;j++){const i=j*4,l=(im.data[i]*.2126+im.data[i+1]*.7152+im.data[i+2]*.0722)/255;weights[j]=smooth(.62,1,l);}for(let k=0;k<3;k++){const a=weights.slice();boxBlur(a,tmp,s.width,s.height,1,2);for(let j=0;j<a.length;j++)im.data[j*4+k]=hc[k]*a[j];}sx.putImageData(im,0,0);c.save();c.globalCompositeOperation='screen';c.globalAlpha=p.halation*.9;c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(s,0,0,W,H);c.restore();s.width=s.height=1;}
  if(p.glow>.001)glowBloom(c,W,H,p);
  if(p.leak>.001){const corner=Math.floor(rnd()*4),xy=[[0,0],[W,0],[0,H],[W,H]][corner],x=p.leakManual?(p.leakX??.08)*W:xy[0],y=p.leakManual?(p.leakY??.08)*H:xy[1],a=clamp(p.leak*.9,0,1),hue=p.leakHue*Math.PI/180,col=(r,g,b,alpha)=>{const l=.2126*r+.7152*g+.0722*b,rr=l+(r-l)*Math.cos(hue)-(b-l)*Math.sin(hue),bb=l+(b-l)*Math.cos(hue)+(r-l)*Math.sin(hue);return`rgba(${[rr,g,bb].map(v=>Math.round(clamp(l+(v-l)*p.leakSat,0,255))).join(',')},${alpha})`;};c.save();c.globalCompositeOperation='source-over';let g;if(p.leakShape==='patch'){const bw=Math.max(W,H)*(.03+p.leakBandWidth*.35),D=Math.max(W,H)*1.6;c.translate(x,y);c.rotate(p.leakAngle*Math.PI/180);g=c.createLinearGradient(-bw,0,bw,0);g.addColorStop(0,col(0,0,0,0));g.addColorStop(.32,col(255,224,140,a));g.addColorStop(.5,col(255,196,70,a));g.addColorStop(.68,col(255,224,140,a));g.addColorStop(1,col(0,0,0,0));c.fillStyle=g;c.fillRect(-D,-D,D*2,D*2);}else{g=c.createRadialGradient(x,y,0,x,y,Math.max(W,H)*(.16+p.leakBandWidth*.85));g.addColorStop(0,col(255,224,140,.95));g.addColorStop(.3,col(255,196,70,.55));g.addColorStop(.64,col(230,150,40,.18));g.addColorStop(1,col(0,0,0,0));c.globalAlpha=a;c.fillStyle=g;c.fillRect(0,0,W,H);}c.restore();}
  if(p.grain>.001){const im=c.getImageData(0,0,W,H),a=im.data,amt=8+p.grain*54;for(let i=0;i<a.length;i+=4){const l=(a[i]*.2126+a[i+1]*.7152+a[i+2]*.0722)/255,n=(rnd()*2-1)*amt*(.12+(1-smooth(.12,.85,l))*.88);a[i]=clamp(a[i]+n,0,255);a[i+1]=clamp(a[i+1]+n*.94,0,255);a[i+2]=clamp(a[i+2]+n*.94,0,255);}c.putImageData(im,0,0);}
  if(p.vignette>.001){const g=c.createRadialGradient(W/2,H/2,Math.min(W,H)*.28,W/2,H/2,Math.max(W,H)*.76);g.addColorStop(0,'#fff');g.addColorStop(1,`rgb(${Math.round(60-p.vignette*50)},${Math.round(52-p.vignette*44)},${Math.round(44-p.vignette*38)})`);c.save();c.globalCompositeOperation='multiply';c.globalAlpha=p.vignette;c.fillStyle=g;c.fillRect(0,0,W,H);c.restore();}
  finish(c,target,W,H,p,rnd,unit);
  return target;
 }
 function finish(c,target,W,H,p,rnd,unit){
  if(p.ptex>.001){const T=192,rg=rng((p.seed^0x7A3C91E5)>>>0),nz=new Float32Array(T*T),tmp=new Float32Array(T*T),a=new Float32Array(T*T);for(let i=0;i<nz.length;i++)nz[i]=rg()*2-1;for(let y=0;y<T;y++)for(let x=0;x<T;x++){let s=0;for(let k=-3;k<=3;k++)s+=nz[y*T+(x+k+T)%T];tmp[y*T+x]=s/7;}let max=0;for(let y=0;y<T;y++)for(let x=0;x<T;x++){let s=0;for(let k=-1;k<=1;k++)s+=tmp[((y+k+T)%T)*T+x];a[y*T+x]=s/3;max=Math.max(max,Math.abs(s/3));}const tc=cv(T,T),tx=tc.getContext('2d'),im=tx.createImageData(T,T);for(let i=0;i<a.length;i++){const g=255*(1-.1*(.5+.5*a[i]/(max||1)));im.data[i*4]=g;im.data[i*4+1]=g;im.data[i*4+2]=g*.985;im.data[i*4+3]=255;}tx.putImageData(im,0,0);const pattern=c.createPattern(tc,'repeat');if(pattern.setTransform)pattern.setTransform({a:unit*1.1,b:0,c:0,d:unit*1.1,e:0,f:0});c.save();c.globalCompositeOperation='multiply';c.globalAlpha=clamp(p.ptex*.9,0,1);c.fillStyle=pattern;c.fillRect(0,0,W,H);c.restore();tc.width=tc.height=1;}
  if(p.dust>.001){c.save();c.globalCompositeOperation='screen';for(let i=0;i<Math.round(p.dust*7);i++){const x=rnd()*W;c.globalAlpha=.05+rnd()*.16*p.dust;c.strokeStyle='#fff6e4';c.lineWidth=Math.max(.6,unit*(.5+rnd()*.9));c.beginPath();c.moveTo(x,rnd()*H*.4);c.lineTo(x+(rnd()*2-1)*unit*10,H*(.5+rnd()*.5));c.stroke();}for(let i=0;i<Math.round(p.dust*160);i++){c.globalAlpha=.12+rnd()*.4*p.dust;c.fillStyle=rnd()>.72?'#2b2018':'#fff3dc';const r=unit*(.35+rnd()*1.1);c.beginPath();c.arc(rnd()*W,rnd()*H,r,0,Math.PI*2);c.fill();}c.restore();}
  if(p.spark>.001){const rs=rng((p.seed^0x51A2B3C4)>>>0),lw=Math.max(32,Math.round(W/8)),lh=Math.max(32,Math.round(H/8)),lc=cv(lw,lh),lx=lc.getContext('2d');lx.drawImage(target,0,0,lw,lh);const ld=lx.getImageData(0,0,lw,lh).data,lumAt=(x,y)=>{const k=(clamp(y,0,lh-1)*lw+clamp(x,0,lw-1))*4;return(ld[k]*.2126+ld[k+1]*.7152+ld[k+2]*.0722)/255;},grid=Array.from({length:121},()=>rs()),coarse=p.sparkMode==='coarse',attempts=Math.round(p.spark*(coarse?1100:4500)*W*H/1440000),pal=['255,247,230','255,247,230','234,243,255','255,214,232','255,228,168','200,240,255'];c.save();for(let i=0;i<attempts;i++){const x=rs()*W,y=rs()*H,ix=Math.min(lw-1,(x/W*lw)|0),iy=Math.min(lh-1,(y/H*lh)|0),l=lumAt(ix,iy),edge=Math.min(1,(Math.abs(lumAt(ix+1,iy)-lumAt(ix-1,iy))+Math.abs(lumAt(ix,iy+1)-lumAt(ix,iy-1)))*3),density=sample(grid,11,11,x/W*10,y/H*10),weight=(.22+.78*smooth(.1,.62,l))*(1-.7*smooth(.92,1,l))*(.55+1.5*edge)*(.25+.95*density);if(rs()>weight)continue;const col=pal[(rs()*pal.length)|0],t=Math.pow(rs(),3),a=Math.min(1,(.45+p.spark*.5)*(.4+.6*Math.pow(rs(),.7))*(.7+.6*t)),r=coarse?unit*(1.3+t*5.5):Math.max(.8,unit*(.7+t*2.6));if(r>unit*1.6){const g=c.createRadialGradient(x,y,0,x,y,r*2.4);g.addColorStop(0,`rgba(${col},${a*.5})`);g.addColorStop(1,`rgba(${col},0)`);c.globalCompositeOperation='screen';c.fillStyle=g;c.beginPath();c.arc(x,y,r*2.4,0,Math.PI*2);c.fill();}c.globalCompositeOperation='source-over';c.fillStyle=`rgba(${col},${a})`;if(t>.55){star(c,x,y,r*1.7);if(t>.8)star(c,x,y,r*1.05,Math.PI/4);}else{c.beginPath();c.arc(x,y,r*.8,0,Math.PI*2);c.fill();}}c.restore();lc.width=lc.height=1;}
  if(p.kinh>.001){const diag=Math.hypot(W,H),pos=diag*(.14+rnd()*.5),bw=diag*.16;c.save();c.translate(W/2,H/2);c.rotate(-18*Math.PI/180);c.translate(-diag/2,-diag/2);const g=c.createLinearGradient(0,pos-bw,0,pos+bw);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,'rgba(255,252,246,.95)');g.addColorStop(1,'rgba(255,255,255,0)');c.globalCompositeOperation='screen';c.globalAlpha=p.kinh*.6;c.fillStyle=g;c.fillRect(0,0,diag,diag);c.restore();}
  if(p.gloss>.001)glossSurface(c,W,H,p);
  if(p.bgBlur>.001){const dw=Math.max(24,Math.round(W/(6+p.bgBlur*34))),dh=Math.max(24,Math.round(H/(6+p.bgBlur*34))),small=cv(dw,dh),blur=cv(W,H),bx=blur.getContext('2d');small.getContext('2d').drawImage(target,0,0,dw,dh);bx.imageSmoothingEnabled=true;bx.imageSmoothingQuality='high';bx.drawImage(small,0,0,W,H);punchFocus(bx,W,H,p);c.drawImage(blur,0,0);small.width=small.height=blur.width=blur.height=1;}
  if(p.motion>.001){const m=cv(W,H),mx=m.getContext('2d'),angle=p.motionAngle*Math.PI/180,maxOff=unit*(10+p.motion*70);mx.globalAlpha=1/16;for(let i=0;i<16;i++){const t=(i/15-.5)*2;mx.drawImage(target,t*maxOff*Math.cos(angle),t*maxOff*Math.sin(angle));}mx.globalAlpha=1;punchFocus(mx,W,H,p);c.drawImage(m,0,0);m.width=m.height=1;}
 }
 function punchFocus(c,W,H,p){c.save();c.globalCompositeOperation='destination-out';c.translate((p.focusX??.5)*W,(p.focusY??.45)*H);c.scale(Math.max(1,(p.focusRX??.28)*W),Math.max(1,(p.focusRY??.32)*H));const g=c.createRadialGradient(0,0,0,0,0,1.3);g.addColorStop(0,'#000');g.addColorStop(.72,'#000');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.beginPath();c.arc(0,0,1.3,0,Math.PI*2);c.fill();c.restore();}
 function parameters(id,overrides={}){const r=rolls.find(r=>r.id===id);return{...defaults,...(r?r.p:{}),...overrides};}
 return {defaults,rolls,parameters,buildLUT,renderPhoto,setCanvasFactory};
});
