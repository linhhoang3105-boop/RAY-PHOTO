const {test}=require('node:test'),assert=require('node:assert/strict');
const Regions=require('../dist/darkroom/ai-composer-regions.js'),Paint=require('../dist/darkroom/region-paint-core.js');
function image(W=120,H=90){const data=new Uint8ClampedArray(W*H*4);for(let y=0;y<H;y++)for(let x=0;x<W;x++)data.set([...(y<H*.5?[105,175,235]:[50,100,65]),255],(y*W+x)*4);return{data,W,H};}
test('scene vectors separate top-connected sky and land while protecting people, hair, skin and source pixels',()=>{
 const f=image(),before=f.data.slice(),foreground={at:(u,v)=>u>.38&&u<.62&&v>.20&&v<.95?1:0},hair={at:(u,v)=>u>.35&&u<.65&&v>.12&&v<.24?1:0},skin={at:(u,v)=>u>.42&&u<.58&&v>.24&&v<.4?1:0},result=Regions.analyze(f.data,f.W,f.H,{foreground,hair,skin});assert.ok(result.sky?.confidence>=.45);assert.ok(result.land?.confidence>=.45);
 const sky=Paint.raster(result.sky.p.adjustRegionStrokes,240,180,{feather:0}),land=Paint.raster(result.land.p.adjustRegionStrokes,240,180,{feather:0});assert.ok(sky.at(.1,.2)>.9);assert.equal(sky.at(.5,.3),0);assert.equal(sky.at(.5,.18),0);assert.equal(sky.at(.15,.8),0);assert.ok(land.at(.1,.8)>.9);assert.equal(land.at(.5,.8),0);assert.equal(land.at(.1,.2),0);assert.deepEqual(f.data,before);
 for(const zone of [result.sky,result.land]){assert.ok(zone.p.adjustRegionStrokes[0].points.length<700);assert.ok(zone.p10<=zone.p90);assert.ok(zone.coverage>0&&zone.coverage<1);}
});
test('white indoor walls and isolated lower blue objects do not invent a sky region',()=>{
 const f=image();for(let y=0;y<f.H;y++)for(let x=0;x<f.W;x++)f.data.set([...(x>40&&x<80&&y>45&&y<70?[50,140,225]:[225,225,225]),255],(y*f.W+x)*4);const a=Regions.analyze(f.data,f.W,f.H);assert.equal(a.sky,null);
 f.data.fill(0);assert.deepEqual(Regions.analyze(f.data,f.W,f.H),{version:1,sky:null,land:null});
});
test('missing models keep likely skin and very dark hair out of automatic color regions',()=>{
 const f=image();for(let y=55;y<78;y++)for(let x=45;x<70;x++)f.data.set([165,110,85,255],(y*f.W+x)*4);for(let y=45;y<55;y++)for(let x=45;x<70;x++)f.data.set([8,6,5,255],(y*f.W+x)*4);const result=Regions.analyze(f.data,f.W,f.H),land=Paint.raster(result.land.p.adjustRegionStrokes,240,180,{feather:0});assert.equal(land.at(.48,.73),0);assert.equal(land.at(.48,.55),0);assert.ok(land.at(.15,.75)>.9);
});
test('landscape masks follow changed horizons and disconnected scenery instead of a fixed upper ellipse',()=>{
 const a=image(),b=image();for(let y=0;y<b.H;y++)for(let x=0;x<b.W;x++)b.data.set([...(y<20+x*.35?[80,160,225]:[55,100,70]),255],(y*b.W+x)*4);const ra=Regions.analyze(a.data,a.W,a.H),rb=Regions.analyze(b.data,b.W,b.H),mask=Paint.raster(rb.sky.p.adjustRegionStrokes,240,180,{feather:0});assert.notDeepEqual(ra.sky.p.adjustRegionStrokes,rb.sky.p.adjustRegionStrokes);assert.ok(mask.at(.9,.5)>.8);assert.equal(mask.at(.1,.5),0);
});
test('darker blue distant hills stay in scenery rather than extending a connected sky into the landscape',()=>{
 const f=image();for(let y=36;y<65;y++)for(let x=0;x<f.W;x++)f.data.set([80,110,145,255],(y*f.W+x)*4);const a=Regions.analyze(f.data,f.W,f.H),sky=Paint.raster(a.sky.p.adjustRegionStrokes,240,180,{feather:0}),land=Paint.raster(a.land.p.adjustRegionStrokes,240,180,{feather:0});assert.ok(sky.at(.15,.2)>.9);assert.equal(sky.at(.15,.5),0);assert.ok(land.at(.15,.5)>.9);
});
test('a darker uniform blue sky has no artificial cutoff at one quarter of the image',()=>{
 const f=image();for(let y=0;y<54;y++)for(let x=0;x<f.W;x++)f.data.set([40,115,190,255],(y*f.W+x)*4);const a=Regions.analyze(f.data,f.W,f.H),sky=Paint.raster(a.sky.p.adjustRegionStrokes,240,180,{feather:0});assert.ok(sky.at(.2,.15)>.9);assert.ok(sky.at(.2,.50)>.9);assert.equal(sky.at(.2,.8),0);
});
test('a full-frame clear sky is not cut at an arbitrary lower row',()=>{
 const f=image();for(let i=0;i<f.data.length;i+=4)f.data.set([100,170,235,255],i);const a=Regions.analyze(f.data,f.W,f.H),mask=Paint.raster(a.sky.p.adjustRegionStrokes,240,180,{feather:0});assert.ok(mask.at(.2,.9)>.9);assert.equal(a.land,null);
});
test('optional clouds, foliage and terrain form separate estimated subregions and keep aggregate legacy masks',()=>{
 const f=image(120,90),zero={at:()=>0};for(let y=0;y<f.H;y++)for(let x=0;x<f.W;x++){const rgb=y<45?(x>75&&y>10&&y<30?[228,230,234]:[105,175,235]):x<65?[50,100,65]:[100,120,145];f.data.set([...rgb,255],(y*f.W+x)*4);}const before=f.data.slice(),result=Regions.analyze(f.data,f.W,f.H,{skin:zero,hair:zero,foreground:{at:(u,v)=>u>.4&&u<.55&&v>.22?1:0}}),mask=k=>Paint.raster(result[k].p.adjustRegionStrokes,240,180,{feather:0});
 for(const k of ['sky','land','clouds','vegetation','terrain'])assert.ok(result[k]?.confidence>=.45,k);
 assert.ok(mask('sky').at(.85,.2)>.9,'legacy sky still includes its cloud subregion');assert.ok(mask('clouds').at(.85,.2)>.9);assert.equal(mask('clouds').at(.1,.2),0);assert.ok(mask('vegetation').at(.2,.8)>.9);assert.equal(mask('terrain').at(.2,.8),0);assert.ok(mask('terrain').at(.85,.8)>.9);assert.equal(mask('vegetation').at(.85,.8),0);for(const k of ['clouds','vegetation','terrain'])assert.equal(mask(k).at(.48,.75),0);assert.deepEqual(f.data,before);
});
