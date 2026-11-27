const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createCanvas}=require('@napi-rs/canvas');
const Core=require('../dist/darkroom/remove-core.js'),Selection=require('../dist/darkroom/remove-selection-core.js'),Paint=require('../dist/darkroom/region-paint-core.js'),Photo=require('../dist/darkroom/photo-edit-core.js'),{Timeline}=require('../dist/darkroom/edit-history.js');
const make=()=>createCanvas(1,1),pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
function canvases(p){return (p.tiles||[p]).map(part=>{const c=createCanvas(part.width,part.height),x=c.getContext('2d'),im=x.createImageData(part.width,part.height);im.data.set(part.data);x.putImageData(im,0,0);return c;});}
function release(cs){for(const c of cs)c.width=c.height=0;}
function draw(c,p,cs){Core.drawPatch(c.getContext('2d'),p,p.tiles?cs:cs[0],c.width,c.height);}
let fixture;
async function diagonal(){
 if(fixture)return fixture;
 const sw=160,sh=120,W=3200,H=2400,state={...Core.defaults(),autoProtect:false,strokes:[{mode:'paint',size:.12,points:[[.08,.15],[.92,.85]]}],protectStrokes:[{mode:'paint',size:.1,points:[[.5,.5]]}]},r=Selection.raster(state,sw,sh,Paint),data=new Uint8ClampedArray(sw*sh*4);
 for(let i=0;i<sw*sh;i++)data.set(r.protect[i]>.05?[35,65,150,255]:r.mask[i]>.08?[245,20,35,255]:[130,150,80,255],i*4);
 const plan=await Core.repair({width:sw,height:sh,data,mask:r.mask,protect:r.protect,padding:1,seed:55}),src=createCanvas(W,H),ctx=src.getContext('2d'),im=ctx.createImageData(W,H),truth=new Uint8ClampedArray(im.data.length);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const q=Math.floor(y/20)*sw+Math.floor(x/20),k=(y*W+x)*4,v=(x+y)%2?70:190;truth.set(r.protect[q]>.05?[35,65,150,255]:[v,v+20,80,255],k);im.data.set(r.mask[q]>.08?[245,20,35,255]:truth.subarray(k,k+4),k);}
 ctx.putImageData(im,0,0);let reads=0,maxRead=0;
 const view={width:W,height:H,getContext:()=>({getImageData(x,y,w,h){reads++;maxRead=Math.max(maxRead,w*h);return ctx.getImageData(x,y,w,h);}})},patch={...Core.materialize(view,plan,make),id:'long-diagonal'};
 fixture={W,H,src,truth,patch,state,reads,maxRead};return fixture;
}
test('a long diagonal brush on a large photo repairs the actual selection at native detail without a full-photo RGB read',async()=>{
 const {W,H,src,truth,patch,reads,maxRead}=await diagonal();
 assert.ok(patch.width*patch.height>4e6,'reproduces the former bounding-box rejection');assert.ok(patch.tiles.length>1);assert.equal(patch.data,undefined);
 const allocated=patch.tiles.reduce((sum,t)=>sum+t.width*t.height,0);assert.ok(allocated<patch.width*patch.height);assert.ok(allocated<=8e6);assert.ok(reads>0);assert.ok(maxRead<=512*512);
 assert.equal(patch.donors,undefined);assert.equal(patch.sampling,undefined);assert.equal(patch.detail,'original');
 const cs=canvases(patch),out=createCanvas(W,H);out.getContext('2d').drawImage(src,0,0);draw(out,patch,cs);
 assert.equal(Buffer.compare(Buffer.from(pixels(out)),Buffer.from(truth)),0,'removed object, fine checker texture, protected subject and untouched photo are exact');
 release([...cs,out]);
});
test('the editor composites sparse and old draft patches together and releases every cached tile after undo',async()=>{
 const {W,H,src,truth,patch}=await diagonal(),legacy={id:'old-draft',width:2,height:2,data:new Uint8ClampedArray(16),placement:[.01,0,0,.01,0,0]},state={...Core.defaults(),patches:[legacy,patch]},code=fs.readFileSync(require.resolve('../dist/darkroom/remove-editor.js'),'utf8'),start=code.indexOf(' function discard('),end=code.indexOf(' function record(');
 const context={source:src,documentSource:src,state,peek:false,cache:null,tiles:new Map(),core:Core,selectionCore:Selection,RayRegionPaint:Paint,hasGuard:()=>false,make};vm.createContext(context);vm.runInContext(code.slice(start,end),context);
 assert.equal(Buffer.compare(Buffer.from(pixels(context.prepare(src))),Buffer.from(truth)),0);
 const cached=[...context.tiles.values()].flat();assert.ok(cached.length>2);
 // NAPI resets a zero-size canvas to 350x150. Track browser canvas dimensions
 // with plain objects when checking the release path, then free native backing.
 const released=[];for(const [id,value]of context.tiles){const track=c=>{const size={width:c.width,height:c.height};released.push(size);return size;};context.tiles.set(id,Array.isArray(value)?value.map(track):track(value));}
 context.state={...state,patches:[]};context.discard();assert.equal(context.tiles.size,0);for(const c of released)assert.deepEqual([c.width,c.height],[0,0]);release(cached);
 context.state=structuredClone(state);assert.equal(Buffer.compare(Buffer.from(pixels(context.prepare(src))),Buffer.from(truth)),0,'restored draft builds fresh canvases');context.state={...state,patches:[]};context.discard();
});
test('one sparse repair remains one editable history step through draft restore, retry and correction',async()=>{
 const {patch,state}=await diagonal(),done=Core.completed(state,patch,state.strokes,56,null),history=new Timeline();history.reset({key:Core.signature(state),removal:state});history.push({key:Core.signature(done),removal:done});
 const restored=new Timeline();restored.restore(structuredClone(history.serialize()));assert.equal(restored.undo().removal.patches.length,0);const reopened=restored.redo().removal;assert.equal(reopened.patches.length,1);assert.deepEqual(reopened.patches[0].tiles[0].data,patch.tiles[0].data);assert.ok(Core.signature(reopened).length<2000);
 const editing=Core.beginCorrection(reopened),job=Core.jobSettings(editing),next=Core.completed(editing,{...patch,id:'corrected'},job.selection,57,job.replaceId);assert.equal(job.replaceId,patch.id);assert.equal(next.patches.length,1);assert.equal(next.patches[0].id,'corrected');assert.equal(Core.jobSettings(next,true).replaceId,'corrected');assert.equal(reopened.patches[0].id,patch.id);
});
test('native sparse patches stay aligned through rotation and crop',async()=>{
 const {W,H,src,patch}=await diagonal(),cs=canvases(patch),base=createCanvas(W,H);base.getContext('2d').drawImage(src,0,0);draw(base,patch,cs);
 const snapshot={p:{},focus:{cx:.5,cy:.5,rx:.3,ry:.3},sun:{x:.5,y:.1},leak:{x:0,y:0},layers:[],body:[],removal:{...Core.defaults(),patches:[patch]}};
 for(const op of [Photo.operation(W,H,'right'),Photo.operation(W,H,'crop',{x:.2,y:.2,width:.6,height:.6})]){
  const state=Photo.next(Photo.initial(W,H),op),expected=Photo.render(base,state,make),actual=Photo.render(src,state,make),mapped=Photo.remap(snapshot,W,H,op);draw(actual,mapped.removal.patches[0],cs);assert.equal(Buffer.compare(Buffer.from(pixels(actual)),Buffer.from(pixels(expected))),0);release([actual,expected]);
 }
 release([...cs,base]);
});
test('noninteger native scaling keeps global color correction, protection and opaque coverage across tile joins',()=>{
 const W=3049,H=2047,sw=160,sh=120,pw=140,ph=100,g={width:sw,height:sh,x:10,y:10},src=createCanvas(W,H),c=src.getContext('2d');c.fillStyle='rgb(100,120,140)';c.fillRect(0,0,W,H);
 const donors=new Int32Array(pw*ph),protect=new Float32Array(sw*sh);for(let y=0;y<ph;y++)for(let x=0;x<pw;x++)donors[y*pw+x]=2*sw+2;
 for(let y=55;y<65;y++)for(let x=75;x<85;x++)protect[y*sw+x]=1;
 const plan={width:pw,height:ph,donors,sampling:g,texture:'native',protection:protect,correction:{width:2,height:2,data:Float32Array.from([-8,0,0,8,0,0,-8,0,10,8,0,10])}},p=Core.materialize(src,plan,make);assert.ok(p.tiles?.length>1);
 let errors=0,alphaErrors=0;
 const sx=W/sw,sy=H/sh,left=Math.round(g.x*sx),top=Math.round(g.y*sy);
 for(const part of p.tiles)for(let y=0;y<part.height;y++)for(let x=0;x<part.width;x++){
  const X=part.x+x,Y=part.y+y,k=(y*part.width+x)*4,qx=Math.min(sw-1,Math.floor((left+X+.5)/sx)),qy=Math.min(sh-1,Math.floor((top+Y+.5)/sy)),kept=protect[qy*sw+qx]>.05;
  if(part.data[k+3]!== (kept?0:255))alphaErrors++;
  if(!kept){const fx=Math.max(0,Math.min(1,(X+.5)*2/p.width-.5)),fy=Math.max(0,Math.min(1,(Y+.5)*2/p.height-.5));if(Math.abs(part.data[k]-(92+16*fx))>.51||part.data[k+1]!==120||Math.abs(part.data[k+2]-(140+10*fy))>.51)errors++;}
 }
 assert.equal(errors,0,'color field uses whole-patch coordinates');assert.equal(alphaErrors,0,'protection uses whole-photo coordinates and tile joins have no holes');
 const cs=canvases(p),out=createCanvas(W,H);draw(out,p,cs);const result=pixels(out);
 for(let x=512;x<p.width;x+=512)for(let y=10;y<p.height-10;y+=137){const X=left+x,Y=top+y,q=Math.floor((Y+.5)/sy)*sw+Math.floor((X+.5)/sx);assert.equal(result[(Y*W+X)*4+3],protect[q]>.05?0:255);}
 release([...cs,out,src]);
});
test('phone-sized previews have no translucent seams between tiles, including rotated and flipped repairs',()=>{
 const p={width:2601,height:1803,tiles:[]},cs=[];
 for(let y=0;y<p.height;y+=512)for(let x=0;x<p.width;x+=512){const width=Math.min(512,p.width-x),height=Math.min(512,p.height-y),c=createCanvas(width,height);c.getContext('2d').fillStyle='#b4c8a0';c.getContext('2d').fillRect(0,0,width,height);p.tiles.push({x,y,width,height});cs.push(c);}
 for(const placement of [[.9,0,0,.9,.05,.05],[0,.9,-.9,0,.95,.05],[-.9,0,0,.9,.95,.05]]){
  const out=createCanvas(390,260);draw(out,{...p,placement},cs);const data=pixels(out);let gaps=0;
  for(let y=16;y<244;y++)for(let x=23;x<367;x++)if(data[(y*390+x)*4+3]!==255)gaps++;
  assert.equal(gaps,0);release([out]);
 }
 release(cs);
});
