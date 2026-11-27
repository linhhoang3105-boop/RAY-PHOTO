const {test}=require('node:test'),assert=require('node:assert/strict');
const {sunAngle,sunPositionAtAngle}=require('../dist/darkroom/photo-controls.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('sun direction moves the original source to the expected side at every image aspect ratio',()=>{
 for(const [W,H]of [[1200,800],[800,1200],[900,900]]){
  for(const [angle,x,y]of [[0,.5,.04],[90,.96,.5],[-90,.04,.5],[180,.5,.96]]){
   const p=sunPositionAtAngle({x:.5,y:.04},angle,W,H);near(p.x,x);near(p.y,y);near(sunAngle(p,W,H),angle);
  }
 }
});
test('a full angle cycle keeps a manually placed source and scales to the exported resolution',()=>{
 for(const p of [{x:.12,y:.23},{x:.9,y:.8},{x:0,y:1}]){
  const angle=sunAngle(p,1200,800),q=sunPositionAtAngle(p,75,1200,800),back=sunPositionAtAngle(q,angle,1200,800),large=sunPositionAtAngle(p,75,4800,3200);
  near(back.x,p.x);near(back.y,p.y);near(q.x,large.x);near(q.y,large.y);
 }
});
test('all directions remain on the photo, including centered or corner light positions',()=>{
 for(const p of [{x:.5,y:.5},{x:0,y:0},{x:1,y:1}])for(const [W,H]of [[100,3000],[3000,100]])for(let angle=-360;angle<=360;angle+=7){
  const q=sunPositionAtAngle(p,angle,W,H);assert.ok(Number.isFinite(q.x+q.y));assert.ok(q.x>=0&&q.x<=1&&q.y>=0&&q.y<=1);
 }
});
