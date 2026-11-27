const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../dist/darkroom/index.html'),'utf8');
const code=html.slice(html.indexOf('function beautyExtendHairOwners('),html.indexOf('function beautyAssignPeople('));
const context={};vm.createContext(context);vm.runInContext(code,context);
function fixture(){const width=16,height=20;return {width,height,hair:new Uint8Array(width*height),skin:new Uint8Array(width*height)};}
function strand(m,x,y0,y1,a=220){for(let y=y0;y<y1;y++)m.hair[y*m.width+x]=a;}
test('long connected hair keeps its person color down to soft ends without changing the matte',()=>{
 const m=fixture(),owners=new Uint8Array(m.hair.length);strand(m,3,1,19);m.hair[18*m.width+3]=24;owners[m.width+3]=1;
 const before=m.hair.slice(),skin=m.skin.slice();context.beautyExtendHairOwners(m,owners);
 assert.equal(owners[18*m.width+3],1);assert.deepEqual(m.hair,before);assert.deepEqual(m.skin,skin);
});
test('separate heads retain independent colors while disconnected detections remain unassigned',()=>{
 const m=fixture(),owners=new Uint8Array(m.hair.length);strand(m,3,1,19);strand(m,12,1,19);strand(m,8,12,19);owners[m.width+3]=1;owners[m.width+12]=2;
 context.beautyExtendHairOwners(m,owners);assert.equal(owners[18*m.width+3],1);assert.equal(owners[18*m.width+12],2);assert.equal(owners[18*m.width+8],0);
});
test('touching hair from different people does not guess ownership of ambiguous strands',()=>{
 const m=fixture(),owners=new Uint8Array(m.hair.length);strand(m,3,1,19);strand(m,12,1,19);for(let x=3;x<=12;x++)m.hair[10*m.width+x]=80;
 owners[m.width+3]=1;owners[m.width+12]=2;context.beautyExtendHairOwners(m,owners);
 assert.equal(owners[m.width+3],1);assert.equal(owners[m.width+12],2);assert.equal(owners[10*m.width+8],0);
});
test('confident skin blocks hair ownership extension and rows do not wrap at image edges',()=>{
 const m=fixture(),owners=new Uint8Array(m.hair.length);strand(m,3,1,19);owners[m.width+3]=1;m.skin[10*m.width+3]=255;
 m.hair[2*m.width-1]=255;owners[2*m.width-1]=2;m.hair[2*m.width]=255;
 context.beautyExtendHairOwners(m,owners);assert.equal(owners[18*m.width+3],0);assert.equal(owners[10*m.width+3],0);assert.equal(owners[2*m.width],0);
});
