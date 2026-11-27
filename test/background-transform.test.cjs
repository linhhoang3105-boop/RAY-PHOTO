const {test}=require('node:test'),assert=require('node:assert/strict'),Scene=require('../dist/darkroom/background-core.js');
const near=(a,b,tolerance=1e-7)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<tolerance,`${a} differs from ${b}`));};
const source=()=>Scene.tilt({...Scene.defaults().subject,x:.61,y:.43,scale:.7,angle:18,flipX:true},{yaw:35,pitch:-18},800,600);
test('a direct resize/rotation preserves the visible pivot without mutating the recipe or creating an anchor',()=>{
 const s=source(),saved=structuredClone(s),pivot=[.39,.67],point=Scene.project(s,800,600,...pivot),out=Scene.adjustAt(s,{scale:.45,angle:-48},800,600,pivot);near(Scene.project(out,800,600,...pivot),point);assert.deepEqual(s,saved);assert.equal(out.anchor,null);assert.equal(out.warp,s.warp);assert.equal(out.flipX,true);assert.equal(out.scale,.45);assert.equal(out.angle,-48);
});
test('default direct handles preserve a chosen seat contact through scale and rotation; temporary pivot never replaces it',()=>{
 const s=Scene.placeAt(source(),{left:.2,top:.1,right:.7,bottom:.88},800,600,.72,.64),point=Scene.project(s,800,600,s.anchor.u,s.anchor.v),out=Scene.adjustAt(s,{scale:1.1,angle:72},800,600);near(Scene.project(out,800,600,s.anchor.u,s.anchor.v),point);assert.equal(out.anchor,s.anchor);const local=[.3,.4],temporary=Scene.adjustAt(s,{angle:-12},800,600,local);assert.equal(temporary.anchor,s.anchor);near(Scene.project(temporary,800,600,...local),Scene.project(s,800,600,...local));
});
test('two fingers apply one screen similarity to every photographed point across perspective and flips',()=>{
 for(const [W,H]of [[800,600],[300,900]])for(const flipX of [false,true])for(const flipY of [false,true]){
  const s=Scene.placeAt(Scene.tilt({...Scene.defaults().subject,x:.4,y:.6,scale:.5,angle:17,flipX,flipY},{yaw:40,pitch:-28},W,H),{left:.25,top:.1,right:.65,bottom:.9},W,H,.6,.75),saved=structuredClone(s),mid=[W*.48,H*.44],shift=[W*.08,-H*.06],factor=1.25;
  const transform=p=>[mid[0]-(p[1]-mid[1])*factor+shift[0],mid[1]+(p[0]-mid[0])*factor+shift[1]],start=[[.3,.35],[.66,.53]],current=start.map(p=>transform([p[0]*W,p[1]*H]).map((v,i)=>v/[W,H][i])),out=Scene.gestureTransform(s,W,H,start,current);
  for(const local of [[.2,.1],[.5,.5],[.7,.9],[s.anchor.u,s.anchor.v]])near(Scene.project(out,W,H,...local),transform(Scene.project(s,W,H,...local)));assert.deepEqual(s,saved);assert.equal(out.warp,s.warp);assert.equal(out.anchor,s.anchor);assert.equal(out.flipX,flipX);assert.equal(out.flipY,flipY);assert.ok(Math.abs(out.scale-.625)<1e-10);assert.equal(out.angle,107);
 }
});
test('crossing the minus/plus 180 degree boundary rotates by two degrees without a full turn',()=>{
 const pair=angle=>{const a=angle*Math.PI/180;return [[.5-.2*Math.cos(a),.5-.2*Math.sin(a)],[.5+.2*Math.cos(a),.5+.2*Math.sin(a)]];},s={...Scene.defaults().subject,angle:179},out=Scene.gestureTransform(s,800,800,pair(179),pair(-179));assert.ok(Math.abs(out.angle+179)<1e-8);assert.ok(out.angle>=-180&&out.angle<=180);assert.ok(Math.abs(out.scale-1)<1e-10);near(Scene.project(out,800,800,.5,.5),[400,400]);
});
test('scale limits retain the finger midpoint and saved contact metadata instead of producing infinities',()=>{
 const s=Scene.placeAt(source(),{left:.2,top:.1,right:.8,bottom:.9},800,600,.7,.8),start=[[.4,.4],[.6,.6]],current=[[-10,-10],[11,11]],pivot=Scene.unproject(s,800,600,.5,.5),out=Scene.gestureTransform(s,800,600,start,current);assert.equal(out.scale,4);assert.equal(out.anchor,s.anchor);near(Scene.project(out,800,600,...pivot),[400,300]);const min=Scene.adjustAt(s,{scale:0},800,600);assert.equal(min.scale,.05);near(Scene.project(min,800,600,s.anchor.u,s.anchor.v),Scene.project(s,800,600,s.anchor.u,s.anchor.v));
});
test('degenerate touches and invalid coordinates cannot move, rotate or collapse the subject',()=>{
 const s=source(),p=[[.4,.4],[.6,.6]];for(const pair of [[[.5,.5],[.5,.5]],[[NaN,.4],[.6,.6]],null]){assert.equal(Scene.gestureTransform(s,800,600,pair,p),s);assert.equal(Scene.gestureTransform(s,800,600,p,pair),s);}assert.equal(Scene.gestureTransform(s,0,600,p,p),s);assert.equal(Scene.adjustAt(s,{angle:40},800,600,[NaN,.5]),s);const out=Scene.adjustAt(s,{scale:NaN,angle:Infinity},800,600);assert.equal(out.scale,s.scale);assert.equal(out.angle,s.angle);near(Scene.project(out,800,600,.4,.6),Scene.project(s,800,600,.4,.6));
});
test('chair clipping retains the seat front below contact while removing the backrest without changing the AI mask',()=>{
 const data=new Uint8Array(12*10);for(let y=1;y<9;y++)for(let x=2;x<10;x++)data[y*12+x]=240;const mask={id:'whole-chair',width:12,height:10,data,label:'chair'},saved=data.slice(),out=Scene.clipBelow(mask,.45);assert.equal(out.id,mask.id);assert.equal(out.label,'chair');assert.notEqual(out.data,mask.data);assert.deepEqual(mask.data,saved);
 for(let y=0;y<10;y++)for(let x=0;x<12;x++){const i=y*12+x;if(y<4)assert.equal(out.data[i],0);else if(y>4)assert.equal(out.data[i],mask.data[i]);else assert.equal(out.data[i],Math.round(mask.data[i]*.5));}
});
test('contact clipping clamps to image bounds and its feather occupies at most one pixel row',()=>{
 const mask={width:4,height:10,data:new Uint8Array(40).fill(255)};assert.deepEqual(Scene.clipBelow(mask,-.3).data,mask.data);assert.ok(Scene.clipBelow(mask,1.4).data.every(v=>v===0));for(const y of [.1,.15,.33,.45,.85,.95]){const out=Scene.clipBelow(mask,y),partial=[];for(let row=0;row<10;row++)if(out.data[row*4]>0&&out.data[row*4]<255)partial.push(row);assert.ok(partial.length<=1);for(let row=1;row<10;row++)assert.ok(out.data[row*4]>=out.data[(row-1)*4]);}assert.equal(mask.data[0],255);
});
