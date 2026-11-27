const {test}=require('node:test'),assert=require('node:assert/strict');
const Paint=require('../dist/darkroom/region-paint-core.js'),Scope=require('../dist/darkroom/adjust-scope-core.js'),Photo=require('../dist/darkroom/photo-edit-core.js');
const stroke=(points,extra={})=>({mode:'paint',size:.16,points,...extra}),polygon=stroke([[.15,.15],[.8,.15],[.8,.8],[.15,.8]],{mode:'lasso'});
test('freehand paint follows continuous segments and disjoint marks; erasing creates a hole',()=>{
 const line=stroke([[.1,.2],[.65,.2],[.65,.7]]),dot=stroke([[.25,.75]]),erase=stroke([[.4,.2]],{mode:'erase',size:.08}),mask=Paint.raster([line,dot,erase],400,300,{feather:0});
 assert.equal(mask.at(.2,.2),1);assert.equal(mask.at(.65,.5),1);assert.equal(mask.at(.25,.75),1);assert.equal(mask.at(.4,.2),0);assert.equal(mask.at(.4,.55),0);
 const once=Paint.raster([line],400,300),twice=Paint.raster([line,line],400,300);assert.deepEqual(twice.data,once.data);
});
test('a closed lasso fills its interior and an eraser leaves a separately outlined inner hole',()=>{
 const cut=stroke([[.5,.5]],{mode:'erase',size:.2}),mask=Paint.raster([polygon,cut],400,300),paths=Paint.contours(mask);
 assert.equal(mask.at(.3,.4),1);assert.equal(mask.at(.5,.5),0);assert.equal(mask.at(.9,.9),0);assert.equal(paths.length,2);for(const path of paths)assert.deepEqual(path[0],path.at(-1));
 const self=Paint.raster([stroke([[.1,.1],[.9,.9],[.9,.1],[.1,.9]],{mode:'lasso'})],400,300);assert.equal(self.at(.8,.5),1);assert.equal(self.at(.5,.15),0);
});
test('empty paint and an unfinished lasso select nothing in either Inside or Outside',()=>{
 for(const strokes of [[],[stroke([[.5,.5]],{mode:'erase'})],[stroke([[.1,.2],[.8,.8]],{mode:'lasso'})]])for(const mode of ['in','out']){const at=Scope.weight({...Scope.defaults,adjustRegionShape:'freehand',adjustRegionStrokes:strokes,adjustRegion:mode},100,80);assert.equal(at(50,40),0);assert.equal(at(0,0),0);}
});
test('drawn Inside and Outside complement one another, while soft edges remain bounded and smooth',()=>{
 const strokes=[stroke([[.5,.5]],{size:.6})],p={...Scope.defaults,adjustRegionShape:'freehand',adjustRegionStrokes:strokes,adjustRegionFeather:.8},a=Scope.weight({...p,adjustRegion:'in'},400,300),b=Scope.weight({...p,adjustRegion:'out'},400,300);
 for(let x=0;x<400;x+=3)assert.ok(Math.abs(a(x,150)+b(x,150)-1)<1e-12);
 const mask=Paint.raster(strokes,400,300,{feather:.8}),values=[0,65,80,87,95,105].map(d=>mask.at(.5+d/400,.5));assert.ok(values[0]>.99);assert.ok(values.some(v=>v>0&&v<1));for(let i=1;i<values.length;i++)assert.ok(values[i]<=values[i-1]+1e-6);
});
test('incremental redraw, a new stroke, erasing, undo and alternate branches equal fresh reconstruction',()=>{
 Paint.invalidate();const a=stroke([[.15,.2]]),b=stroke([[.8,.8]]),c=stroke([[.3,.2]],{mode:'erase'}),nextA={...a,points:[...a.points,[.65,.2]]},third=stroke([[.7,.3]]);
 const sequence=[[a],[nextA],[nextA,b],[nextA,b,c],[nextA,b],[nextA,{...b,points:[[.5,.8]]}],[third],[]],actual=sequence.map(strokes=>new Float32Array(Paint.raster(strokes,240,180,{feather:.4}).data));
 sequence.forEach((strokes,i)=>{Paint.invalidate();assert.deepEqual(actual[i],Paint.raster(strokes,240,180,{feather:.4}).data,'sequence '+i);});
});
test('normalized regions retain their position in full-size export and use bounded raster memory',()=>{
 const strokes=[polygon,stroke([[.35,.4]],{mode:'erase'})],small=Paint.raster(strokes,600,400,{cap:600}),large=Paint.raster(strokes,6000,4000);assert.ok(large.width<=1536&&large.height<=1536);
 for(const [x,y]of [[.3,.3],[.35,.4],[.7,.7],[.05,.05]])assert.equal(small.at(x,y),large.at(x,y));
 const before=JSON.stringify(strokes);Paint.contours(large);assert.equal(JSON.stringify(strokes),before);
});
test('freehand masks and nested recipe coverage follow turns, flips and crops without inheriting image data',()=>{
 const p={...Scope.defaults,adjustRegion:'out',adjustRegionShape:'freehand',adjustRegionStrokes:[polygon,stroke([[.4,.4]],{mode:'erase'})]},state={p,focus:{cx:.5,cy:.5,rx:.3,ry:.3},sun:{x:.5,y:.1},leak:{x:.1,y:.1},layers:[{p,focus:{cx:.5,cy:.5,rx:.3,ry:.3},sun:{x:.5,y:.1},leak:{x:.1,y:.1}}],body:[]};
 for(const kind of ['right','flipX','flipY','crop']){const op=Photo.operation(600,400,kind,{x:.1,y:.1,width:.8,height:.8}),next=Photo.remap(state,600,400,op),a=Scope.weight(p,600,400),b=Scope.weight(next.p,op.width,op.height);for(const [x,y]of [[180,120],[240,160],[420,280],[70,60]]){const q=Photo.point(op.matrix,x+.5,y+.5);assert.ok(Math.abs(a(x,y)-b(q.x-.5,q.y-.5))<.03,kind);}assert.deepEqual(next.p.adjustRegionStrokes,next.layers[0].p.adjustRegionStrokes);}
});
test('reusable formulas keep only bounded vector selections and reject invalid or private nested fields',async()=>{
 const R=await import('../dist/darkroom/preset-rules.mjs'),p={...Scope.defaults,adjustRegion:'in',adjustRegionShape:'freehand',adjustRegionStrokes:[polygon],temp:.3},recipe=R.capture({p,layers:[]},'Vùng tự vẽ');assert.deepEqual(recipe.layers[0].adjustRegionStrokes,[polygon]);assert.deepEqual(R.validate(JSON.parse(JSON.stringify(recipe))),recipe);assert.equal('adjustRegionDrawing'in recipe.layers[0],false);
 for(const s of [{...polygon,photo:'private'},{...polygon,points:[[NaN,.5]]},{...polygon,mode:'script'},{...polygon,points:[[.5]]},{...polygon,points:Array(2049).fill([.5,.5])}])assert.throws(()=>R.validate({...recipe,layers:[{temp:.3,adjustRegionStrokes:[s]}]}));
 const legacy=R.capture({p:{temp:.3,adjustRegionShape:'freehand',adjustRegionStrokes:[polygon]},layers:[]},'Toàn ảnh');assert.equal('adjustRegionStrokes'in legacy.layers[0],false);
});
