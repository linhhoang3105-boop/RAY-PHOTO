function beautyFaceMasks(face,W,H){
  const points=BEAUTY_SHAPES.oval.map(i=>face[i]);
  const minX=Math.min(...points.map(p=>p.x))*W,maxX=Math.max(...points.map(p=>p.x))*W;
  const minY=Math.min(...points.map(p=>p.y))*H,maxY=Math.max(...points.map(p=>p.y))*H;
  const pad=Math.max(2,(maxY-minY)*.025),x=Math.max(0,Math.floor(minX-pad)),y=Math.max(0,Math.floor(minY-pad));
  const w=Math.min(W-x,Math.ceil(maxX+pad)-x),h=Math.min(H-y,Math.ceil(maxY+pad)-y);
  if(w<4||h<4)return null;
  const scale=Math.min(1,512/Math.max(w,h)),MW=Math.max(2,Math.round(w*scale)),MH=Math.max(2,Math.round(h*scale));
  const sx=MW/w,sy=MH/h,canvas=document.createElement("canvas");canvas.width=MW;canvas.height=MH;
  const ctx=canvas.getContext("2d"),path=ids=>beautyPolygon(ctx,face,ids,W,H,x,y,sx,sy);
  function alpha(feather){
    const data=ctx.getImageData(0,0,MW,MH).data,out=new Float32Array(MW*MH);
    for(let k=0;k<out.length;k++)out[k]=data[k*4+3]/255;
    if(feather>0)boxBlurGrid(out,new Float32Array(out.length),MW,MH,feather,1);
    return Uint8Array.from(out,n=>Math.round(clamp(n,0,1)*255));
  }
  ctx.fillStyle="#fff";ctx.beginPath();path(BEAUTY_SHAPES.lip);path(BEAUTY_SHAPES.mouth);ctx.fill("evenodd");
  const lip=alpha(Math.max(1,Math.round(MW*.003)));
  ctx.clearRect(0,0,MW,MH);ctx.beginPath();path(BEAUTY_SHAPES.mouth);ctx.fill();
  const mouth=alpha(0);for(let k=0;k<lip.length;k++)lip[k]*=1-mouth[k]/255;
  ctx.clearRect(0,0,MW,MH);ctx.beginPath();path(BEAUTY_SHAPES.browL);path(BEAUTY_SHAPES.browR);ctx.fill();
  const brow=alpha(Math.max(1,Math.round(MW*.004)));
  ctx.clearRect(0,0,MW,MH);
  const faceW=maxX-minX,faceH=maxY-minY;
  const eyeAngle=Math.atan2((face[263].y-face[33].y)*H,(face[263].x-face[33].x)*W);
  for(const [side,corner,eye]of [[234,61,33],[454,291,263]]){
    const cx=(face[side].x*.35+face[corner].x*.65)*W,cy=(face[eye].y*.36+face[corner].y*.64)*H;
    ctx.save();ctx.translate((cx-x)*sx,(cy-y)*sy);ctx.rotate(eyeAngle);
    ctx.scale(Math.max(1,faceW*.14*sx),Math.max(1,faceH*.085*sy));
    const gradient=ctx.createRadialGradient(0,0,0,0,0,1);
    gradient.addColorStop(0,"rgba(255,255,255,.85)");gradient.addColorStop(.45,"rgba(255,255,255,.55)");gradient.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(0,0,1,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  ctx.globalCompositeOperation="destination-in";ctx.fillStyle="#fff";ctx.beginPath();path(BEAUTY_SHAPES.oval);ctx.fill();
  const blush=alpha(0);
  // Mịn chỉ trong mặt: lùi khỏi viền mặt, chừa mắt, môi, chân mày và đầu mũi.
  ctx.globalCompositeOperation="source-over";ctx.clearRect(0,0,MW,MH);
  ctx.fillStyle="#fff";ctx.strokeStyle="#fff";ctx.beginPath();path(BEAUTY_SHAPES.oval);ctx.fill();
  const oval=alpha(0),feather=Math.max(1,Math.round(MW*.012));
  ctx.globalCompositeOperation="destination-out";ctx.lineWidth=Math.max(2,MW*.035);ctx.stroke();
  const faceSkin=alpha(feather);
  ctx.globalCompositeOperation="source-over";ctx.clearRect(0,0,MW,MH);ctx.lineWidth=Math.max(2,MW*.025);ctx.lineJoin="round";
  for(const shape of ["eyeL","eyeR","lip","browL","browR"]){ctx.beginPath();path(BEAUTY_SHAPES[shape]);ctx.fill();ctx.stroke();}
  const nose=face[1];
  if(nose&&Number.isFinite(nose.x)&&Number.isFinite(nose.y)){
    ctx.save();ctx.translate((nose.x*W-x)*sx,(nose.y*H-y)*sy);ctx.rotate(eyeAngle);
    ctx.beginPath();ctx.ellipse(0,0,Math.max(1,faceW*.085*sx),Math.max(1,faceH*.055*sy),0,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  const hard=alpha(0),soft=alpha(feather);
  for(let k=0;k<faceSkin.length;k++)faceSkin[k]=Math.round(faceSkin[k]*oval[k]/255*(1-Math.max(hard[k],soft[k])/255));
  canvas.width=canvas.height=0;
  return {x,y,w,h,MW,MH,lip,brow,blush,smooth:faceSkin};
}
function beautyFacePatches(W,H){
  const key=W+"x"+H;
  if(!BEAUTY.faceCache||BEAUTY.faceCache.key!==key)
    BEAUTY.faceCache={key,patches:BEAUTY.faces.map((f,i)=>{const patch=beautyFaceMasks(f,W,H);return patch?{...patch,person:i}:null;}).filter(Boolean)};
  return BEAUTY.faceCache.patches;
}
