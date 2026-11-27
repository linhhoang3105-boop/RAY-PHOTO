let beautySmoothRange;
function beautySmoothTarget(c,patch){
  const {x,y,w,h,MW,MH}=patch,canvas=document.createElement("canvas");canvas.width=MW;canvas.height=MH;
  const ctx=canvas.getContext("2d");ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
  ctx.drawImage(c.canvas,x,y,w,h,0,0,MW,MH);
  const d=ctx.getImageData(0,0,MW,MH).data,colors=[new Float32Array(MW*MH),new Float32Array(MW*MH),new Float32Array(MW*MH)];
  // Bilateral: trung bình các màu gần nhau, giữ ranh giới sáng/tối thay vì blur toàn mặt.
  if(!beautySmoothRange){
    const sigma=18;beautySmoothRange=new Float32Array(18*sigma*sigma+1);
    for(let i=0;i<beautySmoothRange.length;i++)beautySmoothRange[i]=Math.exp(-i/(2*sigma*sigma));
  }
  const spatial=[.135335,.606531,1,.606531,.135335],step=Math.max(1,Math.round(Math.min(MW,MH)*.0075));
  const offsets=[];
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)offsets.push([dx*step,dy*step,spatial[dx+2]*spatial[dy+2]]);
  for(let yy=0;yy<MH;yy++)for(let xx=0;xx<MW;xx++){
    const p=yy*MW+xx,i=p*4,r=d[i],g=d[i+1],b=d[i+2];let rr=0,gg=0,bb=0,total=0;
    if(d[i+3])for(const[dx,dy,weight]of offsets){
      const q=(clamp(yy+dy,0,MH-1)*MW+clamp(xx+dx,0,MW-1))*4;
      const dr=d[q]-r,dg=d[q+1]-g,db=d[q+2]-b,dist=dr*dr+dg*dg+db*db;
      if(dist>=beautySmoothRange.length||!d[q+3])continue;
      const a=weight*beautySmoothRange[dist]*d[q+3]/255;
      rr+=d[q]*a;gg+=d[q+1]*a;bb+=d[q+2]*a;total+=a;
    }
    colors[0][p]=total?rr/total:r;colors[1][p]=total?gg/total:g;colors[2][p]=total?bb/total:b;
  }
  canvas.width=canvas.height=0;return colors;
}
function beautySmoothFace(c,W,H){
  const m=BEAUTY.maps;
  if(!beautySettings().some(v=>v.smooth>.001)||!m||!BEAUTY.ready.smooth)return;
  const skinSample=beautySampleMap(m.skin,m.width,m.height,W,H),skinRow=new Float32Array(m.width);
  const patches=beautyFacePatches(W,H).filter(patch=>{
    const person=BEAUTY.people[patch.person];return (person?person.values:BEAUTY.values).smooth>.001&&(person?person.ready:BEAUTY.ready).smooth;
  });
  for(const patch of patches)if(!patch.smoothTarget)patch.smoothTarget=beautySmoothTarget(c,patch);
  for(const patch of patches){
    const v=BEAUTY.people[patch.person]?.values||BEAUTY.values;
    const {x:ox,y:oy,w,h,MW,MH}=patch,image=c.getImageData(ox,oy,w,h),d=image.data;
    const sample=beautySampleMap(patch.smooth,MW,MH,w,h),faceRow=new Float32Array(MW);
    const samples=patch.smoothTarget.map(map=>beautySampleMap(map,MW,MH,w,h)),rows=samples.map(()=>new Float32Array(MW));
    for(let y=0;y<h;y++){
      skinSample.row(oy+y,skinRow);sample.row(y,faceRow);samples.forEach((s,k)=>s.row(y,rows[k]));
      const ownerRow=clamp(Math.floor((oy+y+.5)*m.height/H),0,m.height-1)*m.width;
      for(let x=0;x<w;x++){
        const i=(y*w+x)*4;if(!d[i+3])continue;
        const x0=sample.X[x],fx=sample.F[x],sx=skinSample.X[ox+x],sf=skinSample.F[ox+x];
        if(m.skinOwners&&m.skinOwners[ownerRow+sx+(sf>=.5?1:0)]!==patch.person+1)continue;
        const mask=(faceRow[x0]+(faceRow[x0+1]-faceRow[x0])*fx)*(skinRow[sx]+(skinRow[sx+1]-skinRow[sx])*sf)/(255*255);
        if(mask<.004)continue;
        const dr=rows[0][x0]+(rows[0][x0+1]-rows[0][x0])*fx-d[i];
        const dg=rows[1][x0]+(rows[1][x0+1]-rows[1][x0])*fx-d[i+1];
        const db=rows[2][x0]+(rows[2][x0+1]-rows[2][x0])*fx-d[i+2];
        const edge=1-smooth(26*26*3,52*52*3,dr*dr+dg*dg+db*db),a=mask*v.smooth*.88*edge;
        d[i]+=dr*a;d[i+1]+=dg*a;d[i+2]+=db*a;
      }
    }
    c.putImageData(image,ox,oy);
  }
}
