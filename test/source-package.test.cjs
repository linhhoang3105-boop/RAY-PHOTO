const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const api=()=>import('../scripts/package-source.mjs');
async function put(root,name,value){const file=path.join(root,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,value);}
async function fixture(t){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ray-source-export-')),root=path.join(dir,'project');await fs.mkdir(root);t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const files={
  'package.json':'{"scripts":{"build":"node scripts/build.mjs"}}',
  'package-lock.json':'{"lockfileVersion":3}',
  'README.md':'Editable source, models and licenses.\n',
  '.gitignore':'node_modules/\n',
  'wrangler.portable.jsonc':'{"name":"ray-photo-portable"}',
  '.openai/hosting.json':'{"project_id":"appgprj_1234","d1":"DB","r2":null}',
  'source/modules/hair/detect.js':'export const hair = true;\n',
  'scripts/build.mjs':'console.log("build");\n',
  'api-server/package.json':'{"type":"module"}',
  'api-server/.npmrc':'audit=false\nfund=false\nupdate-notifier=false\n',
  'api-server/db/schema.ts':'export const schema = {};\n',
  'api-server/drizzle/0000_init.sql':'CREATE TABLE colors (id TEXT);\n',
  'dist/darkroom/index.html':'<script>const editor=true;</script>',
  'dist/vendor/mediapipe/hair_segmenter.tflite':Buffer.from([0,1,2,255]),
  'dist/vendor/inpaint/lama-512-int8-01.bin':Buffer.from([4,5,6]),
  'dist/vendor/mediapipe/LICENSE.txt':'Model license\n',
  'native/media-plugin.ts':'export const share = true;\n',
  'android/gradlew':'#!/bin/sh\nexit 0\n',
  'ios/App/App/AppDelegate.swift':'import UIKit\n',
  '.env':'PRIVATE_ENV_SENTINEL=secret',
  'api-server/.dev.vars':'PRIVATE_SESSION_SECRET=secret',
  'api-server/.openai/credential.json':'{"token":"secret"}',
  'android/app/release.keystore':'secret signing key',
  'api-server/.wrangler/state/cache.sqlite':'private database',
  'dist/client/index.html':'generated build',
  'dist/server/worker.mjs':'generated build',
  'api-server/public/private.png':'copied runtime public tree',
  'node_modules/dependency/index.js':'installed dependency',
 };
 for(const [name,value]of Object.entries(files))await put(root,name,value);await fs.chmod(path.join(root,'android/gradlew'),0o755);
 cp.execFileSync('git',['init','-q',root]);cp.execFileSync('git',['-C',root,'add','-f','--','.']);return{dir,root};
}
function py(code,args=[]){return cp.execFileSync('python',['-c',code,...args],{encoding:'utf8'});}
test('full source ZIP contains editable modules, backend/native code and bundled models/licenses, excluding credentials/runtime/build copies',async t=>{
 const f=await fixture(t),a=await api(),plan=await a.planSource({root:f.root,version:'v115'}),names=plan.manifest.files.map(f=>f.path);
 for(const name of ['source/modules/hair/detect.js','scripts/build.mjs','api-server/db/schema.ts','api-server/drizzle/0000_init.sql','dist/darkroom/index.html','dist/vendor/mediapipe/hair_segmenter.tflite','dist/vendor/inpaint/lama-512-int8-01.bin','dist/vendor/mediapipe/LICENSE.txt','android/gradlew','ios/App/App/AppDelegate.swift','native/media-plugin.ts','package-lock.json','wrangler.portable.jsonc','.openai/hosting.json'])assert.ok(names.includes(name),name);
 for(const bad of ['.env','api-server/.dev.vars','api-server/.openai/credential.json','android/app/release.keystore','api-server/.wrangler/state/cache.sqlite','dist/client/index.html','dist/server/worker.mjs','api-server/public/private.png','node_modules/dependency/index.js'])assert.ok(!names.includes(bad),bad);
 const out=path.join(f.dir,'RAY-PHOTO-source-v115.zip'),result=await a.writePackage({root:f.root,version:'v115',output:out});assert.equal(result.verified,true);assert.equal(result.fileCount,names.length);assert.equal(result.selection,'git-index');assert.deepEqual(await a.verifyPackage(out),{valid:true,version:'v115',fileCount:names.length,totalBytes:plan.manifest.totalBytes});
 const archiveNames=JSON.parse(py('import sys,json,zipfile;print(json.dumps(zipfile.ZipFile(sys.argv[1]).namelist()))',[out]));assert.ok(archiveNames.includes('RAY-PHOTO-source-v115/SOURCE-MANIFEST.json'));assert.equal(archiveNames.some(s=>s.includes('.git/')),false);assert.equal(plan.manifest.files.find(s=>s.path==='android/gradlew').mode,'0755');
});
test('unpacked source can be repackaged without Git and includes newly added safe modules',async t=>{
 const f=await fixture(t),a=await api(),first=path.join(f.dir,'first.zip');await a.writePackage({root:f.root,version:'v115',output:first});const extracted=path.join(f.dir,'unpacked');
 py('import sys,zipfile,os,stat\nz=zipfile.ZipFile(sys.argv[1]);z.extractall(sys.argv[2])\nfor i in z.infolist():os.chmod(os.path.join(sys.argv[2],i.filename),stat.S_IMODE(i.external_attr>>16))',[first,extracted]);
 const root=path.join(extracted,'RAY-PHOTO-source-v115');await assert.rejects(fs.stat(path.join(root,'.git')));const same=await a.writePackage({root,version:'v115',output:path.join(f.dir,'same.zip')});assert.equal(same.sha256,(await a.writePackage({root:f.root,version:'v115',output:path.join(f.dir,'same-from-git.zip')})).sha256,'unchanged exports have deterministic bytes');
 await put(root,'source/modules/new-tool/new-tool.js','export const newTool=true;');await put(root,'api-server/.env.local','secret');await put(root,'api-server/uploads/private-photo.jpg','private photo');await put(root,'dist/__qa/private-photo.jpg','private photo');await put(root,'android/key.properties','storePassword=private');await put(root,'native/signing.p8','private signing key');await put(root,'api-server/node_modules/ignore/index.js','ignore');const plan=await a.planSource({root,version:'v116'});assert.equal(plan.selection,'source-manifest');assert.ok(plan.manifest.files.some(s=>s.path==='source/modules/new-tool/new-tool.js'));assert.equal(plan.manifest.files.some(s=>s.path.includes('.env')||s.path.includes('node_modules')||s.path.includes('private-photo')||s.path.endsWith('key.properties')||s.path.endsWith('.p8')),false);
 await a.writePackage({root,version:'v116',output:path.join(f.dir,'new.zip')});
});
test('existing ZIP files are never overwritten and invalid versions fail before output creation',async t=>{
 const f=await fixture(t),a=await api(),out=path.join(f.dir,'old.zip');await fs.writeFile(out,'keep old export');await assert.rejects(a.writePackage({root:f.root,version:'v115',output:out}),/already exists/);assert.equal(await fs.readFile(out,'utf8'),'keep old export');await assert.rejects(a.writePackage({root:f.root,version:'../escape',output:path.join(f.dir,'new.zip')}),/version/);await assert.rejects(fs.stat(path.join(f.dir,'new.zip')));
});
test('tracked symlinks, unsafe hosting metadata and private key material cannot enter the export',async t=>{
 const f=await fixture(t),a=await api(),target=path.join(f.dir,'outside.txt');await fs.writeFile(target,'private');await fs.symlink(target,path.join(f.root,'source/leak.js'));cp.execFileSync('git',['-C',f.root,'add','source/leak.js']);await assert.rejects(a.planSource({root:f.root,version:'v115'}),/symlink/);await fs.unlink(path.join(f.root,'source/leak.js'));cp.execFileSync('git',['-C',f.root,'rm','--cached','source/leak.js']);
 await put(f.root,'.openai/hosting.json','{"project_id":"appgprj_1234","token":"secret"}');await assert.rejects(a.planSource({root:f.root,version:'v115'}),/unsupported fields/);await put(f.root,'.openai/hosting.json','{"project_id":"appgprj_1234","d1":"DB"}');await put(f.root,'docs/private-key.txt','-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----');cp.execFileSync('git',['-C',f.root,'add','docs/private-key.txt']);await assert.rejects(a.planSource({root:f.root,version:'v115'}),/private key material/);
});
test('ZIP verification detects changed source and rejects traversal/backslash entries before extraction',async t=>{
 const f=await fixture(t),a=await api(),good=path.join(f.dir,'good.zip');await a.writePackage({root:f.root,version:'v115',output:good});
 const rewrite=String.raw`import sys,zipfile
with zipfile.ZipFile(sys.argv[1]) as src,zipfile.ZipFile(sys.argv[2],'w') as dst:
 for i in src.infolist():
  data=src.read(i)
  if sys.argv[3]=='tamper' and i.filename.endswith('/source/modules/hair/detect.js'):data=b'tampered source'
  dst.writestr(i,data)
 if sys.argv[3]!='tamper':dst.writestr(sys.argv[3],b'unsafe')`;
 const changed=path.join(f.dir,'changed.zip');py(rewrite,[good,changed,'tamper']);await assert.rejects(a.verifyPackage(changed),/mismatch/);
 for(const [i,name]of ['RAY-PHOTO-source-v115/../escape.js','RAY-PHOTO-source-v115/dir\\escape.js','/absolute.js'].entries()){const bad=path.join(f.dir,'unsafe-'+i+'.zip');py(rewrite,[good,bad,name]);await assert.rejects(a.verifyPackage(bad),/unsafe archive path/);}
});
test('unsafe npm auth config is excluded while ordinary source environment helpers are retained',async t=>{
 const f=await fixture(t),a=await api();await put(f.root,'api-server/.npmrc','//registry.npmjs.org/:_authToken=PRIVATE\n');await put(f.root,'api-server/scripts/sites-env.mjs','export const environment={};');cp.execFileSync('git',['-C',f.root,'add','api-server/scripts/sites-env.mjs']);const plan=await a.planSource({root:f.root,version:'v115'});assert.equal(plan.manifest.files.some(s=>s.path==='api-server/.npmrc'),false);assert.equal(plan.manifest.files.some(s=>s.path==='api-server/scripts/sites-env.mjs'),true);
});
