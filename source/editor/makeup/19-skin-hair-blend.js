function beautyHex(hex){
  const match=/^#([0-9a-f]{6})$/i.exec(hex||"");
  return match?[parseInt(match[1].slice(0,2),16)/255,parseInt(match[1].slice(2,4),16)/255,parseInt(match[1].slice(4,6),16)/255]:[.5,.2,.2];
}
function beautySampleMap(map,MW,MH,W,H){
  const X=new Int32Array(W),F=new Float32Array(W);
  for(let x=0;x<W;x++){
    const u=clamp((x+.5)*MW/W-.5,0,MW-1);X[x]=Math.min(MW-2,Math.floor(u));F[x]=u-X[x];
  }
  return {X,F,row(y,out){
    const v=clamp((y+.5)*MH/H-.5,0,MH-1),y0=Math.min(MH-2,Math.floor(v)),fy=v-y0;
    for(let x=0;x<MW;x++){const i=y0*MW+x;out[x]=map[i]+(map[i+MW]-map[i])*fy;}
  }};
}
function beautySkinHair(c,W,H){
  const settings=beautySettings(),m=BEAUTY.maps;
  const useSkin=settings.some(v=>v.skin>.001)&&BEAUTY.ready.skin,useHair=settings.some(v=>v.hair>.001)&&BEAUTY.ready.hair;
  if(!m||(!useSkin&&!useHair))return;
  const image=c.getImageData(0,0,W,H),d=image.data,MW=m.width,MH=m.height;
  const sample=beautySampleMap(m.skin,MW,MH,W,H),hairSample=useHair?beautySampleMap(m.hair,MW,MH,W,H):null;
  const skinRow=new Float32Array(MW),hairRow=new Float32Array(MW);
  const styles=settings.map(v=>{const color=beautyHex(v.hairColor);return {v,color,colorL:color[0]*.2126+color[1]*.7152+color[2]*.0722};});
  for(let y=0;y<H;y++){
    if(useSkin)sample.row(y,skinRow);if(useHair)hairSample.row(y,hairRow);
    const ownerRow=clamp(Math.floor((y+.5)*MH/H),0,MH-1)*MW;
    for(let x=0;x<W;x++){
      const i=(y*W+x)*4;if(d[i+3]===0)continue;
      const x0=sample.X[x],fx=sample.F[x];
      const ownerPixel=ownerRow+x0+(fx>=.5?1:0);
      const skinStyle=styles[m.skinOwners?m.skinOwners[ownerPixel]-1:0],hairStyle=styles[m.hairOwners?m.hairOwners[ownerPixel]-1:0];
      const skin=useSkin&&skinStyle?.v.skin>.001?(skinRow[x0]+(skinRow[x0+1]-skinRow[x0])*fx)/255:0;
      const hair=useHair&&hairStyle?.v.hair>.001?(hairRow[x0]+(hairRow[x0+1]-hairRow[x0])*fx)/255:0;
      if(skin<.004&&hair<.004)continue;
      let r=d[i]/255,g=d[i+1]/255,b=d[i+2]/255;
      if(skin>.004){
        const l=r*.2126+g*.7152+b*.0722;
        const chroma=Math.max(r,g,b)-Math.min(r,g,b);
        // Vùng AI + trọng số tông: giữ hốc tối, môi và điểm trắng, không làm mịn da.
        const protect=smooth(.025,.12,l)*(1-smooth(.84,.995,l))*(1-.8*smooth(.38,.65,chroma));
        const a=skin*skinStyle.v.skin*protect;
        const lift=.29*a*(1-l),pink=.026*a;
        r=r+(1-r)*lift+pink*(1-r);
        g=g+(1-g)*lift-pink*.45*g;
        b=b+(1-b)*lift+pink*.5*(1-b);
      }
      if(hair>.004){
        const {v,color,colorL}=hairStyle;
        const a=hair*v.hair*.92,l=r*.2126+g*.7152+b*.0722;
        // Màu nhuộm theo độ sáng từng sợi, giữ bóng và vùng tóc tối.
        const target=clamp(l*.72+colorL*.28,.006,.96);
        let rr=color[0]*target/Math.max(colorL,.025),gg=color[1]*target/Math.max(colorL,.025),bb=color[2]*target/Math.max(colorL,.025);
        const mx=Math.max(rr,gg,bb);if(mx>1){rr/=mx;gg/=mx;bb/=mx;}
        const shine=smooth(.72,.98,l)*.55;
        rr+=(1-rr)*shine;gg+=(1-gg)*shine;bb+=(1-bb)*shine;
        r+=(rr-r)*a;g+=(gg-g)*a;b+=(bb-b)*a;
      }
      d[i]=clamp(r,0,1)*255;d[i+1]=clamp(g,0,1)*255;d[i+2]=clamp(b,0,1)*255;
    }
  }
  c.putImageData(image,0,0);
}
