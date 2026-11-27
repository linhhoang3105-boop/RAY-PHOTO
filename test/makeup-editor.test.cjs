const{test}=require('node:test'),assert=require('node:assert/strict');
const{harness}=require('./fixtures/makeup-dom.cjs');
const sample=(h,x,y)=>Array.from(h.$('makeupView').getContext('2d').getImageData(Math.floor(x*h.$('makeupView').width),Math.floor(y*h.$('makeupView').height),1,1).data);
async function open(h){h.$('makeupFile').files=[h.file()];await h.$('makeupFile').emit('change');await h.flush();}
test('uploading one photo supports separate makeup colors, original comparison, film, and a real iPhone PNG share',async()=>{
 const h=harness({ios:true,cancelShare:true});await open(h);assert.equal(h.$('saveMakeup').disabled,false);assert.equal(h.$('makeupView').width,320);assert.equal(h.$('makeupView').height,240);assert.match(h.$('detectionStatus').textContent,/1 khuôn mặt/);
 const lip=sample(h,.5,.615),outside=sample(h,.05,.9),hair=sample(h,.5,.1);await h.$('makeupPalette').children[0].click();await h.flush();assert.notDeepEqual(sample(h,.5,.615),lip);assert.deepEqual(sample(h,.05,.9),outside);const lipAfter=sample(h,.5,.615);
 await h.$('tabHair').click();await h.$('makeupPalette').children[2].click();await h.flush();assert.notDeepEqual(sample(h,.5,.1),hair);assert.deepEqual(sample(h,.5,.615),lipAfter);
 await h.$('tabLips').click();assert.equal(h.$('makeupStrength').value,45);await h.$('compareOriginal').click();assert.deepEqual(sample(h,.5,.615),lip);await h.$('compareOriginal').click();assert.deepEqual(sample(h,.5,.615),lipAfter);
 h.$('skinBright').value='40';await h.$('skinBright').emit('input');h.$('beautyRoll').value='nanghoa';await h.$('beautyRoll').emit('change');await h.flush();await h.$('saveMakeup').click();await h.flush();assert.equal(h.$('beautySaveDialog').open,true);assert.ok(h.$('beautySavedImage').src.startsWith('data:image/png;base64,'));assert.equal(h.shares.length,0);await h.$('beautyShare').click();assert.equal(h.shares.length,1);const bytes=new Uint8Array(await h.shares[0].files[0].arrayBuffer());assert.deepEqual(Array.from(bytes.slice(0,8)),[137,80,78,71,13,10,26,10]);assert.equal(new DataView(bytes.buffer).getUint32(16),320);assert.equal(new DataView(bytes.buffer).getUint32(20),240);assert.equal(h.$('beautySaveDialog').open,true);await h.$('beautyCloseSave').click();assert.equal(h.$('makeupStrength').value,45);
});
test('when automatic detection fails, manual paint, erasing, undo and single-photo export work',async()=>{
 const h=harness({failDetection:true});await open(h);assert.match(h.$('detectionStatus').textContent,/Cọ tô/);assert.equal(h.$('toolPaint').disabled,false);const original=sample(h,.5,.5);
 await h.$('toolPaint').click();h.$('brushSize').value='12';await h.$('maskOverlay').emit('pointerdown',{pointerId:1,clientX:320,clientY:240});await h.$('maskOverlay').emit('pointerup',{pointerId:1});await h.flush();const painted=sample(h,.5,.5);assert.notDeepEqual(painted,original);assert.equal(h.$('makeupStrength').value,40);
 await h.$('toolErase').click();await h.$('maskOverlay').emit('pointerdown',{pointerId:2,clientX:320,clientY:240});await h.$('maskOverlay').emit('pointerup',{pointerId:2});await h.flush();assert.deepEqual(sample(h,.5,.5),original);await h.$('undoMask').click();await h.flush();assert.deepEqual(sample(h,.5,.5),painted);
 await h.$('saveMakeup').click();await h.flush();assert.equal(h.downloads.length,1);assert.ok(h.urls.get(h.$('beautyDownload').href).size>100);await h.$('beautyCloseSave').click();await h.$('resetMakeup').click();await h.flush();assert.deepEqual(sample(h,.5,.5),original);assert.equal(h.$('makeupStrength').value,0);
});
test('replacing the uploaded photo resets makeup and retains a working save flow',async()=>{
 const h=harness();await open(h);await h.$('makeupPalette').children[1].click();await h.flush();assert.equal(h.$('makeupStrength').value,45);await open(h);assert.equal(h.$('makeupStrength').value,0);assert.equal(h.$('beautyRoll').value,'goc');assert.equal(h.$('saveMakeup').disabled,false);
});
test('uncertain hair recognition shows its warning while keeping manual corrections available',async()=>{
 const h=harness({detect:async()=>({faces:[],hair:{width:2,height:1,values:new Float32Array([1,0]),refined:true},warnings:['Vùng tóc nhận diện còn chưa chắc chắn.']})});
 await open(h);assert.match(h.$('detectionStatus').textContent,/tóc nhận diện còn chưa chắc chắn/);assert.equal(h.$('toolPaint').disabled,false);assert.equal(h.$('saveMakeup').disabled,false);
});
test('switching to manual painting ignores a late automatic result',async()=>{
 let finish;const h=harness({detect:()=>new Promise(r=>{finish=r;})});h.$('makeupFile').files=[h.file()];const loading=h.$('makeupFile').emit('change');
 const deadline=performance.now()+2000;while(!finish&&performance.now()<deadline)await h.flush();assert.equal(typeof finish,'function');assert.equal(h.$('useManual').hidden,false);await h.$('useManual').click();assert.equal(h.$('toolPaint').disabled,false);
 h.$('brushSize').value='12';await h.$('maskOverlay').emit('pointerdown',{pointerId:5,clientX:320,clientY:240});await h.$('maskOverlay').emit('pointerup',{pointerId:5});await h.flush();const painted=sample(h,.5,.5);finish({faces:[],hair:null,errors:[]});await loading;await h.flush();assert.deepEqual(sample(h,.5,.5),painted);assert.equal(h.$('saveMakeup').disabled,false);assert.match(h.$('detectionStatus').textContent,/tô thủ công/);
});
