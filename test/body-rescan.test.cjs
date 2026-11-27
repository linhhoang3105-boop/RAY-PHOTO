const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Recognition=require('../dist/darkroom/body-ai/recognition-core.js');
function harness(){
 const image={width:600,height:800},nodes={},plans=[],messages=[];
 const node=id=>nodes[id]||=( {id,dataset:{},children:[],value:'',replaceChildren(){this.children=[];},append(child){this.children.push(child);},getContext(){return{};}} );
 const h={setTimeout,clearTimeout,AbortController,Uint8Array,console,source:image,BODY_DEF:[],BODY:{parts:[]},BODY_AI:{people:[],selected:0,busy:false,job:0},bodyChipEls:{},bodyPart:()=>null,bodyAiRegions:()=>({}),bodyAiEngine:()=>{},bodyUI(){},bodyAiUI(){},bodyAiMessage:message=>messages.push(message),bodyAiReset(){h.BODY_AI.people=[];},RayBodyCore:{LIMBS:{}},RayBodyRecognition:Recognition,document:{getElementById:node,createElement:node},RayRatioLive:{cancel(){}},RaySession:{contextChanged(){}},RayOverall62:{refresh(){}}};
 h.window=h;h.bodyAiPeople=result=>[...(result.poses||[]).map(pose=>({x:.5,y:.5,area:.5,regions:{rayPose:pose}})),...(result.faces||[]).map(()=>({x:.5,y:.2,area:.1,regions:{}}))];
 h.bodyAiDetect=async()=>{const next=plans.shift();if(next.changeSource)h.source=next.changeSource;if(next.error)throw next.error;return next.result;};
 node('bodyAiScan').onclick=async()=>{const source=h.source;h.BODY_AI.busy=true;try{const result=await h.bodyAiDetect({},++h.BODY_AI.job);if(h.source!==source)return;const people=h.bodyAiPeople(result,600,800);if(people.length){h.BODY_AI.people=people;h.BODY_AI.selected=0;}}catch(error){h.bodyAiMessage('Chưa chạy được AI');}finally{h.BODY_AI.busy=false;}};
 vm.createContext(h);vm.runInContext(fs.readFileSync(require.resolve('../dist/darkroom/body-ai/pose-adapter.js'),'utf8'),h);
 const people=[.3,.7].map((x,i)=>({x,y:.5,area:.3,regions:{},rayHasPose:true,raySource:image,rayPersonId:'body-person-'+(i+1),rayMask:{width:2,height:1,foreground:new Uint8Array(i?[0,255]:[255,0])}}));
 h.BODY_AI.people=people;h.BODY_AI.selected=1;
 return{h,people,plans,messages,scan:()=>node('bodyAiScan').onclick()};
}
test('failed and empty rescans keep the selected person and exact masks for the same photo',async()=>{
 const {h,people,plans,scan}=harness();
 plans.push({error:new Error('Failed to fetch')},{result:{poses:[],faces:[]}});
 for(let i=0;i<2;i++){await scan();assert.equal(h.BODY_AI.people[0],people[0]);assert.equal(h.BODY_AI.people[1].rayMask,people[1].rayMask);assert.equal(h.BODY_AI.selected,1);assert.equal(h.RayBodyPose.hasRecognition(),true);assert.equal(h.RayBodyPose.failure(),'');assert.match(h.RayBodyPose.warning(),/giữ viền/);}
});
test('face-only retry cannot replace a previously detected full-body group',async()=>{
 const {h,people,plans,scan}=harness();plans.push({result:{poses:[],faces:[[{}]],errors:['pose'],errorDetails:{pose:'WebGL context failed'}}});
 await scan();assert.equal(h.BODY_AI.people[1],people[1]);assert.equal(h.BODY_AI.selected,1);assert.match(h.RayBodyPose.warning(),/xử lý đồ họa/);
});
test('a successful retry replaces stale masks and clears the retry warning',async()=>{
 const {h,people,plans,scan}=harness();plans.push({error:new Error('Failed to fetch')});await scan();
 const pose=[{x:.5,y:.5}],mask={width:1,height:1,foreground:new Uint8Array([255])};plans.push({result:{poses:[pose],faces:[],masks:[mask]}});await scan();
 assert.equal(h.BODY_AI.people.length,1);assert.notEqual(h.BODY_AI.people[0],people[0]);assert.equal(h.RayBodyPose.mask(),mask);assert.equal(h.RayBodyPose.warning(),'');assert.equal(h.RayBodyPose.failure(),'');
});
test('a failed scan cannot restore recognition belonging to the previous photo',async()=>{
 const {h,plans,scan}=harness();const next={width:800,height:600};plans.push({changeSource:next,error:new Error('Failed to fetch')});await scan();
 assert.equal(h.source,next);assert.equal(h.RayBodyPose.hasRecognition(),false);assert.equal(h.RayBodyPose.mask(),null);assert.equal(h.RayBodyPose.warning(),'');
});
