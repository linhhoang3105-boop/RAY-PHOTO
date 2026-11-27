/* Shade-aware hair dye: preserve strand shading while matching the selected color. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RayHair=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const clamp=x=>Math.max(0,Math.min(1,Number(x)||0)),smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);},linear=new Float64Array(256),srgb=new Uint8ClampedArray(16385);
 const luminance=(r,g,b)=>r*.2126+g*.7152+b*.0722;
 for(let i=0;i<256;i++){const x=i/255;linear[i]=x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}
 for(let i=0;i<srgb.length;i++){const x=i/(srgb.length-1);srgb[i]=(x<=.0031308?12.92*x:1.055*x**(1/2.4)-.055)*255;}
 function color(hex){const m=/^#([0-9a-f]{6})$/i.exec(hex||'');return(m?[0,2,4].map(i=>linear[parseInt(m[1].slice(i,i+2),16)]):[linear[121],linear[68],linear[55]]);}
 // Retain weak hair evidence as a soft matte instead of clipping fine strands off.
 function confidence(value){return clamp((value-.035)/.93)*smooth(.035,.14,value);}
 function makeStyles(d,W,H,m,settings){
  const styles=settings.map(v=>{const c=color(v.hairColor);let l=luminance(...c);if(l<.0001){c.fill(.0001);l=.0001;}return{strength:clamp(v.hair),l,q:c.map(x=>x/l-1),hist:new Float64Array(256),energy:new Float64Array(256),weight:0};});
  // A confidence-weighted median is per person and ignores transparent/skin pixels.
  // Sample the small AI grid; no second full-resolution image buffer is needed.
  for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++){
   const k=y*m.width+x,s=styles[m.hairOwners?m.hairOwners[k]-1:0];if(!s?.strength)continue;
   const mask=m.hair[k]/255*(1-(m.skin?.[k]||0)/255);if(mask<=.025)continue;
   // AI cells and source pixels are both centered at half-pixels. Sampling
   // the four source centers avoids a directional bias after rotate/flip.
   const px=Math.max(0,Math.min(W-1,(x+.5)*W/m.width-.5)),py=Math.max(0,Math.min(H-1,(y+.5)*H/m.height-.5)),xx=Math.floor(px),yy=Math.floor(py),fx=px-xx,fy=py-yy;
   const a=(yy*W+xx)*4,b=(yy*W+Math.min(W-1,xx+1))*4,c=(Math.min(H-1,yy+1)*W+xx)*4,e=(Math.min(H-1,yy+1)*W+Math.min(W-1,xx+1))*4;
   const wa=(1-fx)*(1-fy)*d[a+3]/255,wb=fx*(1-fy)*d[b+3]/255,wc=(1-fx)*fy*d[c+3]/255,we=fx*fy*d[e+3]/255,alpha=wa+wb+wc+we;if(!alpha)continue;
   const at=i=>luminance(linear[d[i]],linear[d[i+1]],linear[d[i+2]]),l=(at(a)*wa+at(b)*wb+at(c)*wc+at(e)*we)/alpha,bin=Math.min(255,Math.round(Math.sqrt(l)*255)),weight=mask*mask*alpha;
   s.hist[bin]+=weight;s.energy[bin]+=l*weight;s.weight+=weight;
  }
  const odds=x=>{x=Math.max(.00001,Math.min(.99999,x));return x/(1-x);};
  for(const s of styles){
   if(!s.strength)continue;let accumulated=0,anchor=s.l;
   for(let i=0;i<256;i++){accumulated+=s.hist[i];if(s.weight>0&&accumulated>=s.weight*.5){anchor=s.energy[i]/s.hist[i];break;}}
   const base=odds(Math.max(.002,anchor)),shade=odds(s.l),table=[new Float32Array(4097),new Float32Array(4097),new Float32Array(4097)];
   for(let i=0;i<=4096;i++){
    const l=i/4096,z=shade*Math.pow(odds(l)/base,.85);let target=i===0?0:i===4096?1:z/(1+z);
    // The relative tone curve itself reaches true black continuously. An absolute
    // shadow cutoff here would leave untreated black stripes on dark, covered hair.
    const shine=1-.3*smooth(anchor+(1-anchor)*.5,.999,l),delta=s.q.map(q=>q*target*shine);let gamut=1;
    for(const v of delta)if(v>0)gamut=Math.min(gamut,(1-target)/v);else if(v<0)gamut=Math.min(gamut,target/-v);
    for(let c=0;c<3;c++)table[c][i]=clamp(target+delta[c]*gamut);
   }
   s.table=table;delete s.hist;delete s.energy;
  }
  return styles;
 }
 function apply(d,W,H,m,settings){
  if(!m?.hair||!m.width||!m.height||!settings.some(s=>s.hair>.001))return;
  const MW=m.width,MH=m.height,styles=makeStyles(d,W,H,m,settings),X=new Int32Array(W),FX=new Float32Array(W);
  for(let x=0;x<W;x++){const u=Math.max(0,Math.min(MW-1,(x+.5)*MW/W-.5));X[x]=Math.floor(u);FX[x]=u-X[x];}
  const sample=(map,a,b,c,e,wa,wb,wc,we,owner=0)=>{
   if(!map)return 0;const owners=owner&&m.hairOwners;
   return((!owners||owners[a]===owner?map[a]*wa:0)+(!owners||owners[b]===owner?map[b]*wb:0)+(!owners||owners[c]===owner?map[c]*wc:0)+(!owners||owners[e]===owner?map[e]*we:0))/255;
  };
  for(let y=0;y<H;y++){
   const v=Math.max(0,Math.min(MH-1,(y+.5)*MH/H-.5)),y0=Math.floor(v),fy=v-y0,y1=Math.min(MH-1,y0+1);
   for(let x=0;x<W;x++){
    const i=(y*W+x)*4;if(!d[i+3])continue;const x0=X[x],fx=FX[x],x1=Math.min(MW-1,x0+1),a=y0*MW+x0,b=y0*MW+x1,c=y1*MW+x0,e=y1*MW+x1,wa=(1-fx)*(1-fy),wb=fx*(1-fy),wc=(1-fx)*fy,we=fx*fy;
    const nearest=(fy>=.5?y1:y0)*MW+(fx>=.5?x1:x0);let owner=m.hairOwners?m.hairOwners[nearest]:1;
    if(!owner){
     // Missing ownership on actual hair is not permission to borrow another person.
     if(m.hair[nearest])continue;
     let best=0;for(const [k,weight] of [[a,wa],[b,wb],[c,wc],[e,we]])if(m.hairOwners[k]&&m.hair[k]*weight>best){owner=m.hairOwners[k];best=m.hair[k]*weight;}
    }
    const s=styles[owner-1];if(!s?.strength)continue;
    const mask=sample(m.hair,a,b,c,e,wa,wb,wc,we,owner)*(1-sample(m.skin,a,b,c,e,wa,wb,wc,we)),alpha=mask*s.strength;if(alpha<.001)continue;
    const r=linear[d[i]],g=linear[d[i+1]],blue=linear[d[i+2]],position=luminance(r,g,blue)*4096,index=Math.min(4095,Math.floor(position)),fraction=position-index;
    const [red,green,blueTone]=s.table,rr=red[index]+(red[index+1]-red[index])*fraction,gg=green[index]+(green[index+1]-green[index])*fraction,bb=blueTone[index]+(blueTone[index+1]-blueTone[index])*fraction;
    d[i]=srgb[Math.round(clamp(r+(rr-r)*alpha)*16384)];d[i+1]=srgb[Math.round(clamp(g+(gg-g)*alpha)*16384)];d[i+2]=srgb[Math.round(clamp(blue+(bb-blue)*alpha)*16384)];
   }
  }
 }
 return{apply,confidence};
});
