const path=require('node:path');
const {createCanvas}=require('@napi-rs/canvas');
function pose(){const points=Array(33).fill(null);for(const [i,x,y]of [[11,.35,.20],[12,.65,.20],[13,.20,.40],[14,.80,.40],[15,.12,.60],[16,.88,.60],[23,.43,.55],[24,.57,.55],[25,.38,.75],[26,.62,.75],[27,.35,.95],[28,.65,.95]])points[i]={x,y,visibility:.92,presence:.95};return points;}
function mask(points,W=600,H=800,mw=256,mh=256){const c=createCanvas(mw,mh),x=c.getContext('2d');x.scale(mw/W,mh/H);x.fillStyle=x.strokeStyle='#fff';x.lineCap='round';
 x.beginPath();x.moveTo(W*.35,H*.20);x.lineTo(W*.65,H*.20);x.lineTo(W*.67,H*.56);x.lineTo(W*.33,H*.56);x.closePath();x.fill();
 for(const [a,b,width]of [[11,13,.052],[12,14,.052],[13,15,.043],[14,16,.043],[23,25,.074],[24,26,.074],[25,27,.052],[26,28,.052]]){if(!points[a]||!points[b])continue;x.lineWidth=H*width;x.beginPath();x.moveTo(points[a].x*W,points[a].y*H);x.lineTo(points[b].x*W,points[b].y*H);x.stroke();}
 const pixels=x.getImageData(0,0,mw,mh).data,foreground=new Uint8Array(mw*mh);for(let i=0;i<foreground.length;i++)foreground[i]=pixels[i*4+3];return{width:mw,height:mh,foreground};
}
module.exports={pose,mask};
