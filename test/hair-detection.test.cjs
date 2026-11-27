const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../dist'),script=fs.readFileSync(path.join(root,'makeup-detection.js'),'utf8');
function harness(fail=false){
 let closed=0,options;const context={URL,Float32Array,document:{currentScript:{src:'https://ray.example/makeup-detection.js'}},RayBeautyRuntime:{async engine(input){options=input;return{async detect(){if(fail)throw Error('model unavailable');return{faces:[[{x:.5,y:.3}]],maps:{width:2,height:1,hair:new Uint8Array([20,255])},errors:[]};},async close(){closed++;}};}}};
 vm.createContext(context);vm.runInContext(script,context);return{context,get closed(){return closed;},get options(){return options;}};
}
test('the makeup screen loads shared hair recognition before the adapter and color core',()=>{
 const html=fs.readFileSync(path.join(root,'beauty.html'),'utf8');
 assert.ok(html.indexOf('darkroom/hair-core.js')<html.indexOf('makeup-core.js'));
 assert.ok(html.indexOf('darkroom/beauty-runtime.js')<html.indexOf('makeup-detection.js'));
});
test('the makeup adapter uses guarded hair recognition and copies soft coverage once',async()=>{
 const h=harness(),out=await h.context.MakeupDetection.detect({width:2,height:1});
 assert.equal(h.options.hair,'https://ray.example/vendor/mediapipe/hair_segmenter.tflite');
 assert.equal(Array.from(h.options.kinds).join(','),'segment,hair,face');
 assert.equal(h.options.numFaces,3);assert.equal(out.hair.refined,true);assert.ok(Math.abs(out.hair.values[0]-20/255)<1e-7);assert.equal(out.hair.values[1],1);assert.equal(h.closed,1);
});
test('recognition failure closes its model and leaves manual makeup available',async()=>{
 const h=harness(true),out=await h.context.MakeupDetection.detect({});
 assert.equal(out.hair,null);assert.equal(out.faces.length,0);assert.equal(h.closed,1);
});
