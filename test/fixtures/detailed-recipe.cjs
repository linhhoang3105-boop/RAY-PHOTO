// A normal finger-drawn selection exceeds the old 32 KB budget in only four layers.
function detailedSnapshot({layers=4,points=700}={}){
 const path=Array.from({length:points},(_,i)=>[.18+i/(points*2),.5+Math.sin(i/31)*.14]);
 const strokes=[{mode:'paint',size:.06,points:path}];
 return{p:{},layers:Array.from({length:layers},(_,i)=>({title:'Vùng '+(i+1),enabled:true,p:{temp:.01*(i+1),sat:i%2?.12:-.08,grain:.035,adjustRegion:i%2?'out':'in',adjustRegionShape:'freehand',adjustRegionFeather:.35,adjustRegionStrokes:strokes}}))};
}
module.exports={detailedSnapshot};
