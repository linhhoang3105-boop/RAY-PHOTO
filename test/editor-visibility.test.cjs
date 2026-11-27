const{test}=require('node:test'),assert=require('node:assert/strict');
const{hexToHSV,hsvToHex,inlineColor}=require('../dist/darkroom/editor-visibility.js');
function controls(){
 const created=[];class Element extends EventTarget{constructor(tag){super();this.tagName=tag;this.children=[];this.style={};this.attrs={};this.dataset={};this.value='';this.disabled=false;this.classList={toggle(){}};}append(...items){this.children.push(...items);}setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k];}removeAttribute(k){delete this.attrs[k];}after(el){this.next=el;}}
 const doc={createElement:tag=>{const e=new Element(tag);created.push(e);return e;},activeElement:null},label=new Element('label'),input=new Element('input');input.type='color';input.value='#735440';input.disabled=true;input.closest=()=>label;input.setAttribute('aria-label','Màu tóc tùy chọn');const changes=[];input.addEventListener('input',()=>changes.push(input.value));const ui=inlineColor(input,doc);return{doc,input,label,ui,changes,created};
}
test('inline makeup colors preserve every RGB value through HSV, including neutral colors',()=>{
 for(const hex of ['#000000','#ffffff','#735440','#ce303c','#55504c',...Array.from({length:2048},(_,i)=>'#'+((i*7919)%0xffffff).toString(16).padStart(6,'0'))])assert.equal(hsvToHex(hexToHSV(hex)),hex);
 assert.equal(hexToHSV('#999999',212).h,212);
});
test('custom colors use the original makeup input handler and never open or create a native picker',()=>{
 const h=controls();assert.equal(h.label.hidden,true);assert.equal(h.ui.field.disabled,true);assert.equal(h.created.some(e=>e.type==='color'),false);
 h.input.disabled=false;h.ui.sync();assert.equal(h.ui.field.disabled,false);h.ui.hex.value='#295EB3';h.ui.hex.oninput();assert.equal(h.input.value,'#295eb3');assert.deepEqual(h.changes,['#295eb3']);
 h.ui.hex.value='#29';h.ui.hex.oninput();assert.equal(h.input.value,'#295eb3');assert.equal(h.ui.hex.getAttribute('aria-invalid'),'true');
});
test('undo, person changes and AI readiness update inline controls without changing the effect',()=>{
 const h=controls();h.input.disabled=false;h.input.value='#ff0000';h.ui.sync();assert.equal(h.ui.hex.value,'#FF0000');assert.deepEqual(h.ui.sliders.map(s=>Number(s.range.value)),[0,100,100]);assert.equal(h.changes.length,0);
 const hue=h.ui.sliders[0].range;hue.value='240';hue.oninput();assert.equal(h.input.value,'#0000ff');assert.deepEqual(h.changes,['#0000ff']);
 h.input.value='#735440';h.input.disabled=true;h.ui.sync();assert.equal(h.ui.field.disabled,true);assert.equal(h.ui.hex.value,'#735440');assert.equal(h.changes.length,1);
});
