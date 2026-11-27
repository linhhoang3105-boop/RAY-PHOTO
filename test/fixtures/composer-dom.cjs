const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createCanvas}=require('@napi-rs/canvas');
const Regions=require('../../dist/darkroom/ai-composer-regions.js'),Core=require('../../dist/darkroom/ai-composer-core.js'),Recipes=require('../../dist/darkroom/ai-composer-recipes.js'),Runtime=require('../../dist/darkroom/ai-composer-runtime.js'),Layers=require('../../dist/darkroom/effect-layers.js'),Tone=require('../../dist/darkroom/tone-core.js'),Scope=require('../../dist/darkroom/adjust-scope-core.js');
const copy=v=>JSON.parse(JSON.stringify(v));
function harness(options={}){
 const urls=new Map(),downloads=[],rows=new Map(),records=[],errors=[];let layers=[],queued=0,serial=0;
 function matches(el,q){if(q==='details[open]')return el.tagName==='DETAILS'&&el.open;if(q[0]==='#')return el.id===q.slice(1);if(q[0]==='.')return el.classList.contains(q.slice(1));return el.tagName===q.toUpperCase();}
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.style={};this.dataset={};this.attrs={};this.events={};this.className='';this.value='';this.hidden=false;this.disabled=false;this.open=false;this.files=[];this.ownText='';}
  set textContent(v){this.ownText=String(v??'');this.children=[];}get textContent(){return this.ownText+this.children.map(e=>e.textContent||'').join('');}
  get classList(){const el=this;return{contains:n=>el.className.split(/\s+/).includes(n),toggle(n,on){const names=new Set(el.className.split(/\s+/).filter(Boolean)),next=on===undefined?!names.has(n):on;if(next)names.add(n);else names.delete(n);el.className=[...names].join(' ');return next;},add(...names){for(const n of names)this.toggle(n,true);},remove(...names){for(const n of names)this.toggle(n,false);}};}
  append(...els){for(const e of els){if(e.parentElement)e.parentElement.children=e.parentElement.children.filter(v=>v!==e);e.parentElement=this;this.children.push(e);}}
  prepend(...els){for(const e of [...els].reverse()){if(e.parentElement)e.parentElement.children=e.parentElement.children.filter(v=>v!==e);e.parentElement=this;this.children.unshift(e);}}
  after(...els){const p=this.parentElement;if(!p)return;for(const e of els){e.parentElement=p;p.children.splice(p.children.indexOf(this)+1,0,e);}}
  replaceChildren(...els){for(const e of this.children)e.parentElement=null;this.children=[];this.ownText='';this.append(...els);}
  setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}
  addEventListener(k,fn){(this.events[k]??=[]).push(fn);}
  async emit(k,extra={}){let stopped=false;const e={target:this,currentTarget:this,preventDefault(){},stopPropagation(){stopped=true;},...extra};if(typeof this['on'+k]==='function')await this['on'+k](e);for(const fn of this.events[k]||[])await fn(e);if(!stopped&&this.parentElement)await this.parentElement.emitBubbled(k,e);}
  async emitBubbled(k,e){let stopped=false;e.stopPropagation=()=>{stopped=true;};e.currentTarget=this;for(const fn of this.events[k]||[])await fn(e);if(!stopped&&this.parentElement)await this.parentElement.emitBubbled(k,e);}
  async click(){if(this.disabled)return;if(this.tagName==='A')downloads.push({name:this.download,url:this.href});await this.emit('click');}
  querySelectorAll(q){const out=[];function visit(el){for(const child of el.children){if(matches(child,q))out.push(child);visit(child);}}visit(this);return out;}
  querySelector(q){return this.querySelectorAll(q)[0]||null;}
  getBoundingClientRect(){return{left:0,top:0,width:640,height:400};}setPointerCapture(){}
 }
 function create(tag){if(tag!=='canvas')return new Element(tag);const c=createCanvas(1,1),base=new Element('canvas');for(const k of Object.keys(base))c[k]=base[k];for(const k of Object.getOwnPropertyNames(Element.prototype)){if(k!=='constructor')Object.defineProperty(c,k,Object.getOwnPropertyDescriptor(Element.prototype,k));}return c;}
 const body=create('body'),dock=create('section');dock.className='preset-dock';const head=create('div');head.className='preset-dock-head';dock.append(head);body.append(dock);const wrap=create('div');wrap.id='canvasWrap';body.append(wrap);
 const document={body,createElement:create,getElementById:id=>body.id===id?body:body.querySelector('#'+id),querySelector:q=>body.querySelector(q),querySelectorAll:q=>body.querySelectorAll(q)};
 const image=(light=false)=>{const c=createCanvas(120,80),x=c.getContext('2d');x.fillStyle=light?'#dad6cf':'#726b62';x.fillRect(0,0,120,80);if(options.sceneColors){x.fillStyle='#74bce9';x.fillRect(0,0,120,34);x.fillStyle='#408a4c';x.fillRect(0,34,120,46);x.fillStyle='#647891';x.fillRect(90,44,30,36);if(options.sceneClouds){x.fillStyle='#e8ebef';x.fillRect(88,5,28,18);}}x.fillStyle=light?'#8f6c55':'#30251e';x.fillRect(30,8,50,65);return c;};
 const source=image(),foreground=new Uint8Array(120*80),skin=new Uint8Array(120*80);for(let y=8;y<73;y++)for(let x=30;x<80;x++)foreground[y*120+x]=255;
 const beauty={source,maps:options.noRecognition?null:{width:120,height:80,foreground,skin,hair:new Uint8Array(120*80)},faces:[],busy:false,values:{skin:.2,hair:.4,hairColor:'#794437'},people:[]},bodyState={parts:[{id:'waist',wid:-.1}],peek:false};
 const store={async all(){return [...rows.values()].map(copy);},async put(input){const recipe=Recipes.validate(input.recipe||input),id=input.id||'recipe-'+(++serial),record={id,name:recipe.name,recipe};rows.set(id,copy(record));return copy(record);},async remove(id){rows.delete(id);},async get(id){return rows.has(id)?copy(rows.get(id)):undefined;}};
 const api={...Layers,capture:()=>copy(layers),restore:value=>{layers=copy(value);}};
 let recognizeCalls=0,modelCloses=0;
 const h={console,document,source,P:{...Tone.defaults,temp:.03,contrast:.05,sat:.02,grain:0,frame:'none',stamp:false,seed:1234,rgAtmos:'off'},F:{cx:.5,cy:.45,rx:.28,ry:.32},NK:{x:.5,y:.04},LK:{x:.08,y:.08},BEAUTY:beauty,BODY:bodyState,BODY_AI:{busy:false},BEAUTY_ASSETS:{roots:['test'],segment:'data:,s',face:'data:,f'},RayLayers:api,RayTone:Tone,RayAdjustScope:Scope,RayAIComposerCore:Core,RayAIComposerRecipes:{...Recipes,store:()=>store},RayAIComposerRuntime:Runtime,RaySession:{record:label=>records.push(label)},RayPreview:{pause:()=>()=>{},layoutChanged(){}},RayWorkspace:{fitPhoto(){}},RayControls:{onToolChange:tool=>{h.tool=tool;}},RayBeautyRuntime:{async engine(){recognizeCalls++;return{async detect(){if(options.failRecognition)throw Error('offline');return{maps:{width:120,height:80,foreground,skin,hair:new Uint8Array(9600)},faces:[]};},async close(){modelCloses++;}};}},ROLLS:[{id:'goc',name:'Gốc',p:{}},{id:'warm',name:'Nắng',p:{temp:.25,contrast:.08,sat:.03,grain:.03}},{id:'cool',name:'Mát',p:{temp:-.2,contrast:.18,sat:-.1}},{id:'soft',name:'Dịu',p:{lift:.1,glow:.1,temp:.05}},{id:'deep',name:'Trầm',p:{contrast:.4,sat:-.2,grain:.1}}],syncControls(){},queue(){queued++;},draw(){},bodyGeo:()=>({W:120,H:80,k:3,ox:0,oy:0}),ResizeObserver:class{observe(){}},Blob,Uint8Array,Uint8ClampedArray,Float32Array,TextEncoder,URL:{createObjectURL:blob=>{const id='blob:'+ ++serial;urls.set(id,blob);return id;},revokeObjectURL:id=>urls.delete(id)},setTimeout:fn=>{setImmediate(fn);return 1;},clearTimeout(){},addEventListener(){}};
 h.RayAIComposerRegions=Regions;h.window=h;vm.createContext(h);if(options.filterStrength)for(const name of ['filter-strength-core.js','filter-strength.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../../dist/darkroom/'+name),'utf8'),h,{filename:name});try{vm.runInContext(fs.readFileSync(path.join(__dirname,'../../dist/darkroom/ai-composer-ui.js'),'utf8'),h,{filename:'ai-composer-ui.js'});}catch(e){errors.push(e);throw e;}
 const flush=async()=>{for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));};
 const textButton=(text,parent=body)=>parent.querySelectorAll('button').find(b=>b.textContent===text);
 const input=label=>body.querySelectorAll('input').find(n=>n.attrs['aria-label']===label);
 const capture=()=>copy({p:h.P,focus:h.F,sun:h.NK,leak:h.LK,layers:api.capture()});
 return{h,body,dock,wrap,image,flush,textButton,input,capture,rows,records,urls,downloads,errors,get layers(){return api.capture();},get queued(){return queued;},get recognizeCalls(){return recognizeCalls;},get modelCloses(){return modelCloses;}};
}
module.exports={harness};
