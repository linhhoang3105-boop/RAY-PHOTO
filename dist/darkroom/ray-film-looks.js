/* =====================================================================
   RAY FILM LOOKS — các màu phim đo từ ảnh mẫu (trước/sau) của người dùng.
   Mỗi màu là một bảng thông số trong OKLab: đường tông, quay hue theo dải màu,
   độ rực theo dải màu và theo độ sáng, độ sáng theo dải màu, ám trung tính theo độ sáng.
   Màu được dựng thành bảng tra 3D 33³ rồi nội suy ba chiều cho từng điểm ảnh:
   nhanh (ảnh 12MP ≈ 0,3 giây), giống nhau ở bản xem trước và bản xuất.
   CODE ĐỘC LẬP — chạy trên trình duyệt, Web Worker và Node. Alpha giữ nguyên.

   "Nắng Phố" (nangpho): đo từ cặp ảnh phố nắng — đen sâu đặc, tông trung giữ nguyên,
   trắng cuộn mềm (không cháy bệt), màu dịu kiểu phim, vùng sáng/trời nhạt trong,
   lá vàng-lục ngả lục lam, trời ngả lam ngọc; da được giữ khỏi bị đè tối.
   ===================================================================== */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RayFilmLooks=api;})(typeof self!=='undefined'?self:this,function(){
 'use strict';
 const LOOKS={
  nangpho:{
   name:'Nắng Phố',
   // Đường tông trên OKLab L (đo bằng trung vị theo từng dải sáng, đã làm mượt đơn điệu).
   toneX:[0,.1,.2,.3,.4,.5,.6,.7,.8,.9,1],
   toneY:[0,.06,.125,.215,.315,.445,.575,.703,.815,.897,.944],
   chromaL:[.85,.82,.85,.80,.78,.80,.76,.66,.55,.50,.50],     // độ rực theo độ sáng (0 → 1, bước 0,1)
   hueK:[0,30,60,90,120,150,180,210,240,270,300,330],          // mốc hue OKLab (độ)
   rot:[0,0,0,8,14,10,4,0,-2,-9,-13,-4],                       // quay hue: vàng-lục → lục lam, lam → lam ngọc
   chromaH:[1,1,1.04,.95,.80,.85,.92,1,1,.98,1.04,1],
   lightH:[.012,.006,0,-.008,-.014,-.01,0,.015,.028,.032,.022,.016],
   neutralA:[0,0,-.002,-.005,-.006,-.006,-.005,-.004,-.003,0,0],
   neutralB:[0,0,-.002,-.001,-.001,-.002,-.003,-.003,-.003,0,0],
   skin:.5
  }
 };
 const clamp=(x,a,b)=>x<a?a:x>b?b:x,smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
 const toLin=v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4),toSrgb=v=>v<=0?0:v>=1?1:v<=.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-.055;
 function toOklab(r,g,b){const lr=toLin(r),lg=toLin(g),lb=toLin(b),l=Math.cbrt(.4122214708*lr+.5363325363*lg+.0514459929*lb),m=Math.cbrt(.2119034982*lr+.6806995451*lg+.1073969566*lb),s=Math.cbrt(.0883024619*lr+.2817188376*lg+.6299787005*lb);return[.2104542553*l+.7936177850*m-.0040720468*s,1.9779984951*l-2.4285922050*m+.4505937099*s,.0259040371*l+.7827717662*m-.8086757660*s];}
 function fromOklab(L,a,b){let l=L+.3963377774*a+.2158037573*b,m=L-.1055613458*a-.0638541728*b,s=L-.0894841775*a-1.2914855480*b;l*=l*l;m*=m*m;s*=s*s;return[4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.7076147010*s];}
 const lerpL=(arr,L)=>{const x=clamp(L,0,1)*(arr.length-1),i=Math.min(arr.length-2,Math.floor(x));return arr[i]+(arr[i+1]-arr[i])*(x-i);};
 function lerpCurve(xs,ys,v){if(v<=xs[0])return ys[0];if(v>=xs[xs.length-1])return ys[ys.length-1];let i=0;while(v>xs[i+1])i++;return ys[i]+(ys[i+1]-ys[i])*(v-xs[i])/(xs[i+1]-xs[i]);}
 function lerpHue(look,arr,h){const K=look.hueK,n=K.length;let i=n-1;for(let k=0;k<n;k++)if(K[k]<=h)i=k;const h0=K[i],h1=i+1<n?K[i+1]:360,t=(h-h0)/(h1-h0),b=arr[(i+1)%n];return arr[i]+(b-arr[i])*t;}
 function grade(look,r,g,b,s){
  const o=toOklab(r,g,b),L=o[0],a=o[1],bb=o[2],C=Math.hypot(a,bb),h=(Math.atan2(bb,a)*180/Math.PI+360)%360,wC=smooth(.012,.06,C);
  const dh=((h-58+540)%360)-180,skin=look.skin*Math.exp(-.5*(dh/18)*(dh/18))*(1-smooth(.10,.16,C))*smooth(.30,.50,L)*smooth(.015,.035,C);
  let Lt=lerpCurve(look.toneX,look.toneY,L);Lt+=(Math.max(L,Lt)-Lt)*skin;Lt+=lerpHue(look,look.lightH,h)*wC*smooth(.15,.4,L);
  let cg=lerpL(look.chromaL,L)*lerpHue(look,look.chromaH,h);cg=1+(cg-1)*(1-.5*skin);
  const rot=(h+lerpHue(look,look.rot,h)*wC)*Math.PI/180,C2=C*cg,a2=C2*Math.cos(rot)+lerpL(look.neutralA,L),b2=C2*Math.sin(rot)+lerpL(look.neutralB,L);
  const Ln=L+(Lt-L)*s,an=a+(a2-a)*s,bn=bb+(b2-bb)*s;
  // Ra ngoài gam: kéo độ rực về trục xám cùng độ sáng, giữ hue (không cắt kênh gây lệch màu).
  let rgb=fromOklab(Ln,an,bn);if(Math.min(...rgb)<-.0005||Math.max(...rgb)>1.0005){let lo=0,hi=1;for(let k=0;k<12;k++){const t=(lo+hi)/2,c=fromOklab(Ln,an*t,bn*t);if(Math.min(...c)<-.0005||Math.max(...c)>1.0005)hi=t;else lo=t;}rgb=fromOklab(Ln,an*lo,bn*lo);}
  return[toSrgb(rgb[0]),toSrgb(rgb[1]),toSrgb(rgb[2])];
 }
 const SIZE=33,cache=new Map();
 function lut(id,strength){
  const key=id+':'+strength.toFixed(3);if(cache.has(key))return cache.get(key);const look=LOOKS[id];if(!look)throw Error('Không có màu phim '+id);
  const table=new Float32Array(SIZE*SIZE*SIZE*3);let k=0;
  for(let bi=0;bi<SIZE;bi++)for(let gi=0;gi<SIZE;gi++)for(let ri=0;ri<SIZE;ri++){const c=grade(look,ri/(SIZE-1),gi/(SIZE-1),bi/(SIZE-1),strength);table[k++]=c[0]*255;table[k++]=c[1]*255;table[k++]=c[2]*255;}
  if(cache.size>8)cache.delete(cache.keys().next().value);cache.set(key,table);return table;
 }
 function apply(image,{look='nangpho',strength=1}={}){
  const s=clamp(Number(strength)||0,0,1.5);if(s<=.001)return image;const T=lut(look,Math.round(s*1000)/1000),d=image.data,S=SIZE-1,k=S/255,S2=SIZE*SIZE;
  for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;
   const fr=d[i]*k,fg=d[i+1]*k,fb=d[i+2]*k,r0=fr|0,g0=fg|0,b0=fb|0,r1=r0<S?r0+1:S,g1=g0<S?g0+1:S,b1=b0<S?b0+1:S,dr=fr-r0,dg=fg-g0,db=fb-b0;
   const i000=(b0*S2+g0*SIZE+r0)*3,i100=(b0*S2+g0*SIZE+r1)*3,i010=(b0*S2+g1*SIZE+r0)*3,i110=(b0*S2+g1*SIZE+r1)*3,i001=(b1*S2+g0*SIZE+r0)*3,i101=(b1*S2+g0*SIZE+r1)*3,i011=(b1*S2+g1*SIZE+r0)*3,i111=(b1*S2+g1*SIZE+r1)*3;
   for(let c=0;c<3;c++){const c00=T[i000+c]+(T[i100+c]-T[i000+c])*dr,c10=T[i010+c]+(T[i110+c]-T[i010+c])*dr,c01=T[i001+c]+(T[i101+c]-T[i001+c])*dr,c11=T[i011+c]+(T[i111+c]-T[i011+c])*dr,c0=c00+(c10-c00)*dg,c1=c01+(c11-c01)*dg;d[i+c]=c0+(c1-c0)*db;}
  }
  return image;
 }
 function applyToContext(ctx,W,H,options){if(!(Number(options?.strength)>0))return;const image=ctx.getImageData(0,0,W,H);apply(image,options);ctx.putImageData(image,0,0);}
 return{LOOKS,apply,applyToContext,grade};
});
