const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const{File}=require('node:buffer');
const{createCanvas,Image:NativeImage}=require('@napi-rs/canvas');
const M=require('../../dist/makeup-core.js'),Lab=require('../../dist/buongtoi-lab.js'),Beauty=require('../../dist/photo-beauty.js');Lab.setCanvasFactory(createCanvas);
function mesh(cx=.5){const pts=Array.from({length:478},()=>({x:cx,y:.45}));function ring(ids,x,y,rx,ry){ids.forEach((id,i)=>{const a=-Math.PI+2*Math.PI*i/ids.length;pts[id]={x:x+Math.cos(a)*rx,y:y+Math.sin(a)*ry};});}ring(M.LIP_OUTER,cx,.65,.11,.045);ring(M.LIP_INNER,cx,.65,.075,.012);ring(M.BROWS[0],cx-.13,.32,.09,.018);ring(M.BROWS[1],cx+.13,.32,.09,.018);return pts;}
function harness(options={}){
  const ids=new Map(),nodes=[],urls=new Map(),frames=[];let serial=0,clock=Date.now(),cameraCalls=0,downloads=[],shares=[],encodeFailures=options.encodeFailures||0;
  class Element{
    constructor(tag='div'){this.tagName=tag.toUpperCase();this.dataset={};this.attrs={};this.children=[];this.style={};this.events={};this.className='';this.value='';this.textContent='';this.hidden=false;this.disabled=false;this.files=[];this.parent=null;}
    get classList(){const e=this;return{add(...names){const s=new Set(e.className.split(/\s+/));names.forEach(n=>s.add(n));e.className=[...s].filter(Boolean).join(' ');},remove(...names){e.className=e.className.split(/\s+/).filter(n=>!names.includes(n)).join(' ');},contains(n){return e.className.split(/\s+/).includes(n);},toggle(n,on){const have=this.contains(n);const next=on===undefined?!have:on;if(next)this.add(n);else this.remove(n);return next;}};}
    addEventListener(t,f){(this.events[t]??=[]).push(f);}
    async emit(t,extra={}){const event={target:this,currentTarget:this,preventDefault(){},...extra};for(const fn of this.events[t]||[])await fn(event);}
    click(){if(this.tagName==='A')downloads.push(this.download);if(!this.disabled)return this.emit('click');}
    append(...els){for(const e of els){e.parent=this;this.children.push(e);}}
    replaceChildren(...els){this.children=[];this.append(...els);}
    setAttribute(k,v){this.attrs[k]=v;}
    removeAttribute(k){delete this.attrs[k];if(k==='src')this.src='';}
    closest(q){if(q.startsWith('[data-')){const key=q.slice(6,-1);if(this.dataset[key]!==undefined)return this;}return this.parent?.closest(q)||null;}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(e=>e!==this);}
    getBoundingClientRect(){return{left:0,top:0,right:640,bottom:480,width:640,height:480};}
    setPointerCapture(){}
    showModal(){this.open=true;}close(){this.open=false;}
    set innerHTML(s){this.html=s;this.children=[];}get innerHTML(){return this.html||'';}
  }
  function augmentCanvas(c,tag='canvas'){
    const element=new Element(tag);for(const k of Object.keys(element))c[k]=element[k];
    for(const k of Object.getOwnPropertyNames(Element.prototype)){if(k==='constructor')continue;Object.defineProperty(c,k,Object.getOwnPropertyDescriptor(Element.prototype,k));}
    c.toBlob=(fn,mime)=>{if(encodeFailures){encodeFailures--;fn(null);return;}c.encode('png').then(bytes=>fn(new Blob([bytes],{type:mime})));};return c;
  }
  function create(tag){const e=tag==='canvas'?augmentCanvas(createCanvas(1,1)):new Element(tag);nodes.push(e);return e;}
  const html=fs.readFileSync(path.join(__dirname,'../../dist/beauty.html'),'utf8');
  for(const match of html.matchAll(/<([a-zA-Z][\w-]*)([^<>]*)>/g)){
    const [,tag,attrs]=match;if(!/\bid="|\bdata-theme=|\bdata-filter=|\bdata-layout=|class="text-button help-open/.test(attrs))continue;
    let e=tag==='video'?augmentCanvas(createCanvas(1600,1200),'video'):create(tag);
    if(tag==='video'){nodes.push(e);e.videoWidth=1600;e.videoHeight=1200;e.readyState=2;e.play=async()=>{};const x=e.getContext('2d');x.fillStyle='#d1af87';x.fillRect(0,0,1600,1200);x.fillStyle='#32412d';x.fillRect(0,0,800,1200);}
    for(const a of attrs.matchAll(/([\w-]+)="([^"]*)"/g)){const [,key,val]=a;if(key==='id'){e.id=val;ids.set(val,e);}else if(key==='class')e.className=val;else if(key.startsWith('data-'))e.dataset[key.slice(5)]=val;else if(key==='value')e.value=val;else e.attrs[key]=val;}
    e.hidden=/\shidden(?:\s|$)/.test(attrs);e.disabled=/\sdisabled(?:\s|$)/.test(attrs);
  }
  const $=id=>ids.get(id);
  const document={hidden:false,getElementById:$,createElement:create,createTextNode:t=>({textContent:t}),body:create('body'),events:{},addEventListener(t,fn){(this.events[t]??=[]).push(fn);},querySelectorAll(q){
    if(q==='#photoEditor button,#photoEditor input')return ['closeEditor','zoom','retake','replacePhoto','flipPhoto','deletePhoto'].map($);
    const found=new Set();for(const s of q.split(','))for(const e of nodes){if(s.startsWith('#')&&e.id===s.slice(1))found.add(e);else if(s.startsWith('.')&&e.classList.contains(s.slice(1)))found.add(e);else if(s.startsWith('[data-')&&e.dataset[s.slice(6,-1)]!==undefined)found.add(e);}return[...found];
  }};
  function BrowserImage(){const img=new NativeImage(),desc=Object.getOwnPropertyDescriptor(NativeImage.prototype,'src');Object.defineProperty(img,'complete',{get(){return false;}});Object.defineProperty(img,'src',{set(value){const item=urls.get(value);desc.set.call(img,item?.bytes||value);},get(){return desc.get.call(img);}});return img;}
  const FakeDate=class extends Date{static now(){return clock;}};
  let lastTrack=null;
  const context={console,atob,document,BuongToiLab:Lab,PhotoBeauty:Beauty,MakeupCore:M,MakeupDetection:{detect:async()=>{if(options.failDetection)throw new Error('model unavailable');if(options.detect)return options.detect();return{faces:[mesh()],hair:{width:8,height:8,values:Float32Array.from({length:64},(_,i)=>i<16?1:0)},errors:[]};}},innerHeight:800,Image:BrowserImage,Blob,File,Uint8Array,Uint8ClampedArray,Int32Array,Date:FakeDate,
    URL:{createObjectURL(blob){const id='blob:test-'+(++serial);urls.set(id,blob);return id;},revokeObjectURL(id){urls.delete(id);}},
    navigator:{userAgent:options.ios?'iPhone':'test',...(options.ios?{canShare:({files})=>files[0].size>0,share:async data=>{shares.push(data);if(options.cancelShare)throw Object.assign(new Error('cancelled'),{name:'AbortError'});}}:{}),mediaDevices:{async getUserMedia(){cameraCalls++;lastTrack={enabled:true,stopped:false,stop(){this.stopped=true;},getSettings(){return{facingMode:'user'};},addEventListener(){}};return{getTracks:()=>[lastTrack],getVideoTracks:()=>[lastTrack]};}}},
    isSecureContext:true,confirm:()=>true,requestAnimationFrame:fn=>setImmediate(fn),setTimeout(fn,ms){if(ms<1000){clock+=ms;setImmediate(fn);}return serial++;},clearTimeout(){},addEventListener(){},
  };
  context.window=context;M.setCanvasFactory((w,h)=>augmentCanvas(createCanvas(w,h)));vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../../dist/makeup-editor.js'),'utf8'),context,{filename:'makeup-editor.js'});
  const flush=async()=>{for(let rounds=0;rounds<6;rounds++){while(frames.length)frames.shift()();await new Promise(r=>setImmediate(r));}};
  function file(color='#c69880'){const c=createCanvas(320,240),x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,320,240);const bytes=c.toBuffer('image/png');return{size:bytes.length,type:'image/png',bytes};}
  return{$,nodes,context,flush,file,urls,shares,get downloads(){return downloads;},get cameraCalls(){return cameraCalls;},get lastTrack(){return lastTrack;}};
}

module.exports={harness,mesh};
