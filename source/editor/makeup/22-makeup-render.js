function beautyMakeup(c,W,H){
  if(!BEAUTY.ready.face||!beautySettings().some(v=>v.lip>.001||v.blush>.001||v.brow>.001))return;
  for(const patch of beautyFacePatches(W,H)){
    const v=BEAUTY.people[patch.person]?.values||BEAUTY.values;
    if(!(v.lip>.001||v.blush>.001||v.brow>.001))continue;
    const colors={lip:beautyHex(v.lipColor),blush:beautyHex(v.blushColor),brow:beautyHex(v.browColor)};
    const {x:ox,y:oy,w,h,MW,MH}=patch,image=c.getImageData(ox,oy,w,h),d=image.data;
    const kinds=["lip","blush","brow"].filter(k=>v[k]>.001);
    const samplers=kinds.map(k=>beautySampleMap(patch[k],MW,MH,w,h));
    const rows=kinds.map(()=>new Float32Array(MW));
    for(let y=0;y<h;y++){
      samplers.forEach((s,i)=>s.row(y,rows[i]));
      for(let x=0;x<w;x++){
        const i=(y*w+x)*4;if(d[i+3]===0)continue;
        let r=d[i]/255,g=d[i+1]/255,b=d[i+2]/255;
        for(let k=0;k<kinds.length;k++){
          const kind=kinds[k],sample=samplers[k],row=rows[k],x0=sample.X[x],fx=sample.F[x];
          let a=(row[x0]+(row[x0+1]-row[x0])*fx)/255*v[kind];
          if(a<.003)continue;
          const color=colors[kind],l=r*.2126+g*.7152+b*.0722;
          if(kind === "brow"){
            a*=.68;r*=1-a*(1-color[0]);g*=1-a*(1-color[1]);b*=1-a*(1-color[2]);
          }else{
            const colorL=color[0]*.2126+color[1]*.7152+color[2]*.0722;
            if(kind === "lip"){
              const chroma=Math.max(r,g,b)-Math.min(r,g,b);
              a*=.82*(1-smooth(.72,.95,l)*(1-smooth(.12,.35,chroma)));
            }else a*=.34*smooth(.05,.25,l);
            const target=l*(kind === "lip"?.75:.90)+colorL*(kind === "lip"?.25:.10);
            let rr=color[0]*target/Math.max(colorL,.025),gg=color[1]*target/Math.max(colorL,.025),bb=color[2]*target/Math.max(colorL,.025);
            const mx=Math.max(rr,gg,bb);if(mx>1){rr/=mx;gg/=mx;bb/=mx;}
            r+=(rr-r)*a;g+=(gg-g)*a;b+=(bb-b)*a;
          }
        }
        d[i]=r*255;d[i+1]=g*255;d[i+2]=b*255;
      }
    }
    c.putImageData(image,ox,oy);
  }
}
function beautyApply(c,W,H){
  if(BEAUTY.peek||BEAUTY.source!==source)return;
  if(!beautySettings().some(v=>v.skin>.001||v.smooth>.001||v.hair>.001||v.lip>.001||v.blush>.001||v.brow>.001))return;
  beautySmoothFace(c,W,H);beautySkinHair(c,W,H);beautyMakeup(c,W,H);
}

