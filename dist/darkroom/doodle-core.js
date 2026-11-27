/* Photo illustration vectors, separate from color recipes and recognition masks. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RayDoodleCore=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const MAX_STROKES=256,MAX_POINTS=2048,MAX_TOTAL=16384,hex=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v),finite=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
 const defaults={ink:'#914d38',width:.004,opacity:1,fill:'#ffc67e',fillOpacity:.3,fillSide:'none'};
 function valid(s){return !!s&&typeof s.id==='string'&&/^art-\d+$/.test(s.id)&&typeof s.closed==='boolean'&&Array.isArray(s.points)&&s.points.length>0&&s.points.length<=MAX_POINTS&&s.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(v=>finite(v,-16,17)))&&hex(s.ink)&&hex(s.fill)&&finite(s.width,.00001,8)&&finite(s.opacity,0,1)&&finite(s.fillOpacity,0,1)&&['none','in','out'].includes(s.fillSide);}
 function restore(value){if(!value||value.version!==1||!Array.isArray(value.strokes)||value.strokes.length>MAX_STROKES||!value.strokes.every(valid)||new Set(value.strokes.map(s=>s.id)).size!==value.strokes.length||value.strokes.reduce((n,s)=>n+s.points.length,0)>MAX_TOTAL)return null;const strokes=value.strokes.map(s=>({...defaults,id:s.id,closed:s.closed,points:s.points.map(p=>p.slice()),ink:s.ink,width:s.width,opacity:s.opacity,fill:s.fill,fillOpacity:s.fillOpacity,fillSide:s.fillSide}));return strokes.length?{version:1,strokes}:null;}
 function state(){let strokes=[];return{get strokes(){return strokes;},capture:()=>strokes.length?{version:1,strokes}:null,restore(value){strokes=restore(value)?.strokes||[];},set(next){if(next.length&&!restore({version:1,strokes:next}))throw Error('Đã có nhiều nét hoặc điểm. Xóa nét không dùng trước khi vẽ thêm.');strokes=next;},clear(){strokes=[];}};}
 function contains(s,p){if(!s.closed||s.points.length<3)return false;let inside=false;const pts=s.points;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
 function mask(s){if(!s?.closed||s.points.length<3)return null;return{mode:'lasso',size:.006,open:false,points:s.points.map(p=>p.slice())};}
 function smooth(points){if(points.length<3||points.length>512)return points.map(p=>p.slice());const out=[points[0].slice()];let from=points[0];for(let i=1;i<points.length-1;i++){const control=points[i],to=[(control[0]+points[i+1][0])/2,(control[1]+points[i+1][1])/2];for(let j=1;j<=4;j++){const t=j/4,u=1-t;out.push([u*u*from[0]+2*u*t*control[0]+t*t*to[0],u*u*from[1]+2*u*t*control[1]+t*t*to[1]]);}from=to;}out.push(points.at(-1).slice());return out;}
 function path(c,s,W,H){c.moveTo(s.points[0][0]*W,s.points[0][1]*H);for(const p of s.points.slice(1))c.lineTo(p[0]*W,p[1]*H);if(s.closed)c.closePath();}
 function draw(c,W,H,value){const list=value?.strokes||[];if(!list.length)return false;c.save();c.beginPath();c.rect(0,0,W,H);c.clip();c.lineCap=c.lineJoin='round';
  for(const s of list){if(!valid(s))continue;if(s.closed&&s.points.length>=3&&s.fillSide!=='none'&&s.fillOpacity>0){c.beginPath();if(s.fillSide==='out')c.rect(0,0,W,H);path(c,s,W,H);c.globalAlpha=s.fillOpacity;c.fillStyle=s.fill;c.fill('evenodd');}
   if(s.opacity>0){c.globalAlpha=s.opacity;c.strokeStyle=c.fillStyle=s.ink;c.lineWidth=s.width*Math.min(W,H);c.beginPath();if(s.points.length===1){c.arc(s.points[0][0]*W,s.points[0][1]*H,c.lineWidth/2,0,Math.PI*2);c.fill();}else{path(c,s,W,H);c.stroke();}}}
  c.restore();return true;
 }
 return{MAX_STROKES,MAX_POINTS,MAX_TOTAL,defaults,valid,restore,state,contains,mask,smooth,draw};
});
