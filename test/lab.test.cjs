const {test}=require('node:test');const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const{createCanvas}=require('@napi-rs/canvas');
const L=require('../dist/buongtoi-lab.js');L.setCanvasFactory(createCanvas);
function fixture(){const s=createCanvas(240,180),c=s.getContext('2d'),g=c.createLinearGradient(0,0,240,180);g.addColorStop(0,'#f6d5a8');g.addColorStop(.5,'#8b9f92');g.addColorStop(1,'#16282c');c.fillStyle=g;c.fillRect(0,0,240,180);c.fillStyle='#fff';c.fillRect(132,46,17,17);c.fillStyle='#090a0a';c.fillRect(22,120,65,35);return s;}
const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
test('Original, 8 user-supplied rolls and Nắng hoa render without changing photo geometry; Original is a pixel-preserving pass-through',()=>{
 assert.equal(L.rolls.length,10);assert.equal(new Set(L.rolls.map(r=>r.id)).size,10);const src=fixture(),hashes=new Set();
 for(const r of L.rolls){const c=createCanvas(1,1);L.renderPhoto(c,src,L.parameters(r.id));assert.equal(c.width,240);assert.equal(c.height,180);const d=pixels(c);assert.ok(d.every((v,i)=>i%4!==3||v===255));hashes.add(crypto.createHash('sha256').update(d).digest('hex'));if(r.id==='goc')assert.deepEqual(d,pixels(src));}
 assert.ok(hashes.size>=10);assert.equal(L.parameters('anhrua').paper,.6);assert.equal(L.parameters('portra400').temp,.12);assert.equal(L.parameters('demflash').flash,.62);
});
test('same seed gives identical print/glitter pixels; reseeding changes the finish',()=>{
 const s=fixture(),a=createCanvas(1,1),b=createCanvas(1,1),c=createCanvas(1,1),p=L.parameters('anhrua',{spark:.6});L.renderPhoto(a,s,p);L.renderPhoto(b,s,p);L.renderPhoto(c,s,{...p,seed:7789});assert.deepEqual(pixels(a),pixels(b));assert.notDeepEqual(pixels(a),pixels(c));
 const out=path.join(require('node:os').tmpdir(),'pho-cang-photobooth-qa');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'buongtoi-anhrua-spark.png'),a.toBuffer('image/png'));
});
test('highlight bloom stays local and a glossy black print remains dark',()=>{
 const s=createCanvas(240,180),x=s.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,240,180);x.fillStyle='#fff';x.fillRect(113,83,14,14);const c=createCanvas(1,1);L.renderPhoto(c,s,{glow:.8});const out=c.getContext('2d');assert.equal(out.getImageData(0,0,1,1).data[0],0);assert.ok(out.getImageData(110,90,1,1).data[0]>0);
 x.fillStyle='#000';x.fillRect(0,0,240,180);L.renderPhoto(c,s,{gloss:.8});const d=pixels(c);assert.ok(d.reduce((m,v,i)=>i%4===3?m:Math.max(m,v),0)<8);
});
test('Nắng hoa keeps deep shadows and warm skin while softening sky blue and green chroma',()=>{
 const colors=['#060809','#f7f8f2','#e1b18e','#82b6da','#3b7654','#d67baf'],s=createCanvas(colors.length*32,32),x=s.getContext('2d');colors.forEach((col,i)=>{x.fillStyle=col;x.fillRect(i*32,0,32,32);});
 const p=L.parameters('nanghoa',{grain:0,glow:0,soft:0,halation:0,vignette:0}),a=createCanvas(1,1),b=createCanvas(1,1);L.renderPhoto(a,s,p);L.renderPhoto(b,s,{...p,profile:''});
 const at=(c,i)=>Array.from(c.getContext('2d').getImageData(i*32+16,16,1,1).data),chroma=p=>Math.max(...p.slice(0,3))-Math.min(...p.slice(0,3));
 const black=at(a,0),white=at(a,1),skin=at(a,2),sky=at(a,3),skyBase=at(b,3),green=at(a,4),greenBase=at(b,4),pink=at(a,5);
 assert.ok(Math.max(...black.slice(0,3))<16);assert.ok(white[0]>=white[1]&&white[1]>white[2]);assert.ok(skin[0]>skin[1]&&skin[1]>skin[2]&&skin[0]-skin[1]<80);
 assert.ok(sky[2]>sky[1]&&sky[1]>sky[0]);assert.ok(sky[0]>skyBase[0]&&sky[2]<skyBase[2]);assert.ok(chroma(green)<chroma(greenBase));assert.ok(pink[0]>pink[1]&&pink[2]>pink[1]);
 assert.ok(pixels(a).every((v,i)=>i%4!==3||v===255));
});
