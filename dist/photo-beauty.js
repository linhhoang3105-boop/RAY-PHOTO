/* Gentle, local skin retouch. A color mask estimates skin; no face detection. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PhotoBeauty=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
  function skinWeight(r,g,b){
    const y=.299*r+.587*g+.114*b,cb=128-.168736*r-.331264*g+.5*b,cr=128+.5*r-.418688*g-.081312*b;
    return smooth(18,55,y)*(1-smooth(238,255,y))*smooth(72,88,cb)*(1-smooth(120,135,cb))*smooth(130,142,cr)*(1-smooth(175,190,cr))*smooth(-3,10,r-b);
  }
  function apply(data,width,height,settings={}){
    const amount=clamp((+settings.smooth||0)/100,0,1),bright=clamp((+settings.brighten||0)/100,0,1);
    if(!amount&&!bright)return data;
    const src=amount?new Uint8ClampedArray(data):data,step=Math.max(1,Math.round(Math.min(width,height)/300));
    const offsets=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1],[-2,0],[2,0],[0,-2],[0,2]];
    const range=new Float32Array(256);for(let i=0;i<256;i++)range[i]=Math.exp(-i*i/(2*19*19));
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=(y*width+x)*4,r=src[i],g=src[i+1],b=src[i+2],mask=skinWeight(r,g,b);if(mask<.005||!src[i+3])continue;
      let rr=r,gg=g,bb=b;
      if(amount){
        const lum=.299*r+.587*g+.114*b;let sum=2,sr=2*r,sg=2*g,sb=2*b;
        for(const [dx,dy] of offsets){const xx=clamp(x+dx*step,0,width-1),yy=clamp(y+dy*step,0,height-1),j=(yy*width+xx)*4;if(!src[j+3])continue;const d=Math.abs(Math.round(.299*src[j]+.587*src[j+1]+.114*src[j+2]-lum)),w=range[d]*((Math.abs(dx)+Math.abs(dy)>1)?.65:1);sum+=w;sr+=w*src[j];sg+=w*src[j+1];sb+=w*src[j+2];}
        const mix=amount*.86*mask;rr+=(sr/sum-r)*mix;gg+=(sg/sum-g)*mix;bb+=(sb/sum-b)*mix;
      }
      if(bright){
        const lum=(.299*rr+.587*gg+.114*bb)/255,lift=bright*.3*mask*4*lum*(1-lum)*255;
        rr+=lift*(1-rr/310);gg+=lift*(1-gg/310);bb+=lift*(1-bb/310);
        const l=.299*rr+.587*gg+.114*bb,desat=bright*.08*mask;rr+=(l-rr)*desat;gg+=(l-gg)*desat;bb+=(l-bb)*desat;
      }
      data[i]=rr;data[i+1]=gg;data[i+2]=bb;
    }
    return data;
  }
  return{apply,skinWeight};
});
