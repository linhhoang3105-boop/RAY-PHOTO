const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const root=path.join(__dirname,'..'),buildURL=pathToFileURL(path.join(root,'scripts/assemble-source.mjs')).href;
const read=name=>fs.readFileSync(path.join(root,name),'utf8'),digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const load=()=>import(buildURL);
function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ray-source-modules-'));
 const put=(file,text)=>{const target=path.join(dir,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,text);};
 const manifest={version:1,output:'dist/darkroom/index.html',template:'source/editor/index.template.html',styleToken:'{{CSS}}',scriptToken:'{{JS}}',styles:['source/editor/base.css'],scripts:[{path:'source/editor/state.js',module:'state'},{path:'source/editor/boot.js',module:'workspace'}]};
 put(manifest.template,'<!doctype html>\n<style>{{CSS}}</style>\n<script>{{JS}}</script>');put(manifest.styles[0],'body{color:#123}\n');put(manifest.scripts[0].path,'"use strict";\nconst amount=1;\n');put(manifest.scripts[1].path,'globalThis.result=amount;\n');
 const save=()=>put('source/editor/manifest.json',JSON.stringify(manifest));save();
 return{dir,put,manifest,save,output:()=>fs.readFileSync(path.join(dir,manifest.output),'utf8'),close:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?files(path.join(dir,d.name)):[path.join(dir,d.name)]);}

test('canonical native parts cover every editable JS/CSS file and reconstruct the current editor byte-for-byte',async()=>{
 const {checkSource}=await load(),manifest=JSON.parse(read('source/editor/manifest.json')),html=read(manifest.output),template=read(manifest.template),script=manifest.scripts.map(p=>read(p.path)).join(''),style=manifest.styles.map(read).join('');
 const declared=[...manifest.styles,...manifest.scripts.map(p=>p.path)],physical=files(path.join(root,'source/editor')).filter(f=>/\.(?:js|css)$/.test(f)).map(f=>path.relative(root,f).split(path.sep).join('/'));
 assert.equal(new Set(declared).size,declared.length);assert.deepEqual(declared.slice().sort(),physical.sort());assert.ok(manifest.scripts.length>=20);
 assert.equal(html.match(/<script>([\s\S]*?)<\/script>/)[1],script);assert.equal(html.match(/<style>([\s\S]*?)<\/style>/)[1],style);
 for(const part of manifest.scripts)new vm.Script(read(part.path),{filename:part.path});
 assert.equal(template.split(manifest.scriptToken).length,2);assert.equal(template.split(manifest.styleToken).length,2);
 const stat=fs.statSync(path.join(root,manifest.output)),checked=checkSource();assert.equal(checked.changed,false);assert.equal(checked.checked,true);assert.equal(checked.htmlSHA256,digest(html));assert.equal(checked.scriptSHA256,digest(script));assert.equal(fs.statSync(path.join(root,manifest.output)).mtimeMs,stat.mtimeMs);
});

test('module map resolves all declared sources and groups every native part once with the real browser declaration order',()=>{
 const map=JSON.parse(read('source/module-map.json')),manifest=JSON.parse(read('source/editor/manifest.json')),ids=new Set(map.modules.map(m=>m.id));assert.equal(ids.size,map.modules.length);assert.ok(map.modules.length>=20);
 const uses=new Map();for(const module of map.modules){assert.ok(module.name);for(const dependency of module.dependencies)assert.ok(ids.has(dependency),dependency);for(const file of [...module.sourceFiles,...module.generatedOutputs]){assert.ok(!path.isAbsolute(file)&&!file.split('/').includes('..'),file);assert.ok(fs.existsSync(path.join(root,file)),file);uses.set(file,(uses.get(file)||0)+1);}}
 for(const part of manifest.scripts){const module=map.modules.find(m=>m.id===part.module);assert.ok(module.sourceFiles.includes(part.path),part.path);assert.equal(uses.get(part.path),1);}
 for(const file of [manifest.template,...manifest.styles])assert.equal(uses.get(file),1);
 const html=read(manifest.output),expected=[{path:manifest.output,type:'assembled-classic-native-script'}];for(const [,attrs]of html.matchAll(/<script\b([^>]*)>/g)){const src=attrs.match(/\bsrc="([^"]+)"/);if(src)expected.push({path:path.posix.normalize('dist/darkroom/'+src[1].split('?')[0]),type:attrs.includes('type="module"')?'module-deferred':'classic'});}assert.deepEqual(map.browserDeclarationOrder,expected);
 const paths=map.modules.flatMap(m=>[...m.sourceFiles,...m.generatedOutputs]);for(const file of files(path.join(root,'dist'))){const relative=path.relative(root,file).split(path.sep).join('/');if(/^dist\/(?:client|server|\.openai|vendor|fonts|assets|icons)\//.test(relative)||!(/\.(?:js|mjs|css|html|json|webmanifest)$/).test(relative))continue;assert.ok(paths.some(p=>p===relative||p.endsWith('/')&&relative.startsWith(p)),'Unmapped runtime source: '+relative);}
 for(const point of Object.values(map.entryPoints))assert.ok(fs.existsSync(path.join(root,point)),point);
});

test('editing a canonical module changes generated behavior; drift check does not overwrite the working output',async()=>{
 const {assembleSource,checkSource}=await load(),f=fixture();try{
  assert.equal(assembleSource({root:f.dir}).changed,true);const initial=f.output(),context={};vm.runInNewContext(initial.match(/<script>([\s\S]*?)<\/script>/)[1],context);assert.equal(context.result,1);
  f.put('source/editor/state.js','"use strict";\nconst amount=2;\n');assert.throws(()=>checkSource({root:f.dir}),/drift/);assert.equal(f.output(),initial);
  assert.equal(assembleSource({root:f.dir}).changed,true);const updated=f.output(),next={};vm.runInNewContext(updated.match(/<script>([\s\S]*?)<\/script>/)[1],next);assert.equal(next.result,2);assert.equal(assembleSource({root:f.dir}).changed,false);assert.equal(checkSource({root:f.dir}).changed,false);
  f.put('source/editor/state.js','const amount=;');assert.throws(()=>assembleSource({root:f.dir}),SyntaxError);assert.equal(f.output(),updated,'invalid input cannot replace the last working generated editor');
 }finally{f.close();}
});

test('assembly preserves literal replacement syntax and marker strings inside source content',async()=>{
 const {assembleSource}=await load(),f=fixture();try{
  const text='globalThis.result=amount;globalThis.literal="$& {{CSS}} {{JS}}";\n';f.put('source/editor/boot.js',text);assembleSource({root:f.dir});assert.ok(f.output().includes(text));assert.ok(f.output().includes('body{color:#123}'));
 }finally{f.close();}
});

test('invalid duplicate/traversal paths, missing parts and source-overwriting outputs fail before writing',async()=>{
 const {assembleSource}=await load();for(const mutate of [f=>f.manifest.scripts.push({...f.manifest.scripts[0]}),f=>{f.manifest.scripts[0].path='../outside.js';},f=>{f.manifest.output=f.manifest.template;},f=>{f.manifest.styles[0]='source/editor/missing.css';},f=>{f.manifest.output='/tmp/unrelated.html';},f=>{f.manifest.scripts[0].path='source/../secret.js';},f=>{f.manifest.scriptToken=f.manifest.styleToken;},f=>{f.put(f.manifest.template,'<script>{{JS}}{{JS}}</script><style>{{CSS}}</style>');}]){const f=fixture();try{assembleSource({root:f.dir});const before=f.output(),output=path.join(f.dir,f.manifest.output);mutate(f);f.save();assert.throws(()=>assembleSource({root:f.dir}));assert.equal(fs.readFileSync(output,'utf8'),before);}finally{f.close();}}
});

test('input and output symlinks cannot escape the selected source workspace',async()=>{
 const {assembleSource}=await load(),f=fixture(),outside=fs.mkdtempSync(path.join(os.tmpdir(),'ray-source-outside-'));try{
  fs.writeFileSync(path.join(outside,'outside.js'),'globalThis.leak=true;');fs.rmSync(path.join(f.dir,'source/editor/state.js'));fs.symlinkSync(path.join(outside,'outside.js'),path.join(f.dir,'source/editor/state.js'));assert.throws(()=>assembleSource({root:f.dir}),/outside/);assert.equal(fs.existsSync(path.join(f.dir,'dist/darkroom/index.html')),false);
  fs.rmSync(path.join(f.dir,'source/editor/state.js'));f.put('source/editor/state.js','const amount=1;\n');fs.symlinkSync(outside,path.join(f.dir,'dist'));assert.throws(()=>assembleSource({root:f.dir}),/outside/);assert.equal(fs.existsSync(path.join(outside,'darkroom/index.html')),false);
 }finally{f.close();fs.rmSync(outside,{recursive:true,force:true});}
});

test('an output symlink cannot overwrite a canonical source inside the workspace',async()=>{
 const {assembleSource}=await load(),f=fixture();try{assembleSource({root:f.dir});const original=fs.readFileSync(path.join(f.dir,'source/editor/state.js'),'utf8');fs.rmSync(path.join(f.dir,f.manifest.output));fs.symlinkSync(path.join(f.dir,'source/editor/state.js'),path.join(f.dir,f.manifest.output));assert.throws(()=>assembleSource({root:f.dir}),/overwrite/);assert.equal(fs.readFileSync(path.join(f.dir,'source/editor/state.js'),'utf8'),original);}finally{f.close();}
});
