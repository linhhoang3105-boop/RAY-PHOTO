const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const root=path.join(__dirname,'..');
async function fixture(t){
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'ray-portable-')),directory=path.join(folder,'dist');await fs.mkdir(directory);
 const files={'index.html':'<h1>RAY</h1>','darkroom/index.html':'<h1>Editor</h1>','app.js':'const app=true;','module.mjs':'export const app=true;','app.css':'body{}','vendor/model.tflite':Buffer.from([1,2,3,4]),'vendor/vision.wasm':Buffer.from([0,97,115,109]),'fonts/name.woff2':Buffer.from([5,6]),'video.mp4':Buffer.from('0123456789abcdef'),'empty.txt':'','.openai/hosting.json':'private','client/private.js':'private','server/private.js':'private','node_modules/private.js':'private','__qa-private/source.png':'private'};
 for(const[name,data]of Object.entries(files)){await fs.mkdir(path.dirname(path.join(directory,name)),{recursive:true});await fs.writeFile(path.join(directory,name),data);}
 await fs.writeFile(path.join(folder,'private.txt'),'outside');await fs.symlink(path.join(folder,'private.txt'),path.join(directory,'linked.txt'));
 t.after(()=>fs.rm(folder,{recursive:true,force:true}));return{folder,directory,files};
}
async function serving(t,directory){
 const {createLocalHandler}=await import('../scripts/serve-local.mjs'),server=http.createServer(createLocalHandler({directory}));
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 return(target,options={})=>new Promise((resolve,reject)=>{const request=http.request({host:'127.0.0.1',port:server.address().port,path:target,method:options.method||'GET',headers:options.headers||{}},response=>{const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body:Buffer.concat(chunks)}));response.on('error',reject);});request.on('error',reject);request.end(options.body);});
}
test('local handoff serves real static assets with browser-safe types and no source-directory fallback',async t=>{
 const f=await fixture(t),request=await serving(t,f.directory);
 for(const[target,mime]of [['/','text/html'],['/darkroom/','text/html'],['/app.js','application/javascript'],['/module.mjs','application/javascript'],['/app.css','text/css'],['/vendor/vision.wasm','application/wasm'],['/vendor/model.tflite','application/octet-stream'],['/fonts/name.woff2','font/woff2'],['/video.mp4','video/mp4']]){const r=await request(target);assert.equal(r.status,200,target);assert.ok(r.headers['content-type'].startsWith(mime));assert.equal(r.headers['x-content-type-options'],'nosniff');assert.equal(r.headers['cache-control'],'no-cache');}
 const direct=await request('/darkroom?keep=1');assert.equal(direct.status,308);assert.equal(direct.headers.location,'/darkroom/?keep=1');
 const head=await request('/app.js',{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.body.length,0);assert.equal(Number(head.headers['content-length']),Buffer.byteLength(f.files['app.js']));
 const missing=await request('/missing.js');assert.equal(missing.status,404);assert.ok(!missing.body.toString().includes('<h1>RAY'));
 const asset=await request('/app.js'),cached=await request('/app.js',{headers:{'if-none-match':asset.headers.etag}});assert.equal(cached.status,304);assert.equal(cached.body.length,0);
});
test('local video seeking and HEAD use the original bytes and reject unsatisfiable ranges',async t=>{
 const f=await fixture(t),request=await serving(t,f.directory);
 for(const[range,expected,contentRange]of [['bytes=2-5','2345','bytes 2-5/16'],['bytes=-4','cdef','bytes 12-15/16'],['bytes=11-','bcdef','bytes 11-15/16'],['bytes=14-999','ef','bytes 14-15/16']]){const r=await request('/video.mp4',{headers:{range}});assert.equal(r.status,206);assert.equal(r.body.toString(),expected);assert.equal(r.headers['content-range'],contentRange);assert.equal(Number(r.headers['content-length']),expected.length);}
 const head=await request('/video.mp4',{method:'HEAD',headers:{range:'bytes=2-5'}});assert.equal(head.status,206);assert.equal(head.body.length,0);assert.equal(head.headers['content-length'],'4');
 for(const range of ['bytes=999-','bytes=5-2','bytes=1-2,4-5','bytes=-0','garbage']){const r=await request('/video.mp4',{headers:{range}});assert.equal(r.status,416);assert.equal(r.headers['content-range'],'bytes */16');}
 assert.equal((await request('/empty.txt',{headers:{range:'bytes=0-'}})).status,416);
 const mismatch=await request('/video.mp4',{headers:{range:'bytes=2-5','if-range':'different-version'}});assert.equal(mismatch.status,200);assert.equal(mismatch.body.toString(),'0123456789abcdef');
});
test('local server never publishes parent files, hidden/generated folders or symlink targets',async t=>{
 const f=await fixture(t),request=await serving(t,f.directory);
 for(const target of ['/../private.txt','/%2e%2e/private.txt','/..%2fprivate.txt','/darkroom/..%2f..%2fprivate.txt','/.openai/hosting.json','/client/private.js','/server/private.js','/node_modules/private.js','/__qa-private/source.png','/linked.txt'])assert.equal((await request(target)).status,404,target);
 for(const target of ['/%00','/%ZZ','/darkroom%5c..%5cprivate.txt'])assert.ok([400,404].includes((await request(target)).status),target);
 const post=await request('/app.js',{method:'POST',body:'ignored'});assert.equal(post.status,405);assert.equal(post.headers.allow,'GET, HEAD');
});
test('local editing reports an unavailable sharing backend instead of pretending a shared code exists',async t=>{
 const f=await fixture(t),request=await serving(t,f.directory),session=await request('/api/ray/session');assert.equal(session.status,503);assert.equal(JSON.parse(session.body).code,undefined);assert.match(JSON.parse(session.body).error,/Công thức và nháp/);
 const share=await request('/api/ray/presets',{method:'POST',headers:{'content-type':'application/json'},body:'{"name":"local"}'});assert.equal(share.status,503);assert.equal(JSON.parse(share.body).code,undefined);assert.equal((await request('/api/other')).status,404);
});
test('portable output contains complete public assets and excludes hosted builds, metadata and symlinks',async t=>{
 const f=await fixture(t),{copyPublicAssets}=await import('../scripts/build-web.mjs'),output=path.join(f.folder,'output');
 await fs.mkdir(output);await fs.writeFile(path.join(output,'keep.txt'),'keep');await assert.rejects(copyPublicAssets(f.directory,output),/symlink/);assert.equal(await fs.readFile(path.join(output,'keep.txt'),'utf8'),'keep');await fs.unlink(path.join(f.directory,'linked.txt'));
 const result=await copyPublicAssets(f.directory,output);assert.equal(result.files,10);assert.deepEqual(await fs.readFile(path.join(output,'vendor/model.tflite')),f.files['vendor/model.tflite']);assert.equal(await fs.readFile(path.join(output,'darkroom/index.html'),'utf8'),f.files['darkroom/index.html']);
 for(const name of ['.openai','client','server','node_modules','__qa-private','keep.txt'])await assert.rejects(fs.stat(path.join(output,name)),{code:'ENOENT'});
 await assert.rejects(copyPublicAssets(f.directory,f.directory),/separate/);await assert.rejects(copyPublicAssets(f.directory,path.join(f.directory,'nested')),/separate/);await assert.rejects(copyPublicAssets(f.directory,f.folder),/separate/);
});
test('independent Worker keeps the existing D1 API and delegates only static public requests to ASSETS',async()=>{
 const worker=(await import('../server/portable-worker.mjs')).default,calls=[],env={ASSETS:{fetch:async request=>{calls.push(request.url);return new Response('asset');}}};
 const missingDB=await worker.fetch(new Request('https://ray.example/api/ray/session'),env);assert.equal(missingDB.status,503);assert.equal(calls.length,0);
 const home=await worker.fetch(new Request('https://ray.example/'),env);assert.equal(await home.text(),'asset');assert.equal(calls.at(-1),'https://ray.example/index.html');
 const editor=await worker.fetch(new Request('https://ray.example/darkroom/'),env);assert.equal(editor.status,200);assert.equal(calls.at(-1),'https://ray.example/darkroom/index.html');
 const before=calls.length;for(const target of ['/api/unknown','/.openai/hosting.json','/server/private.js','/%2e%2e%2fprivate'])assert.equal((await worker.fetch(new Request('https://ray.example'+target),env)).status,404);assert.equal(calls.length,before);
 assert.equal((await worker.fetch(new Request('https://ray.example/app.js',{method:'POST'}),env)).status,405);
 assert.equal((await worker.fetch(new Request('https://ray.example/'),{})).status,503);
 const statements=[],db={prepare(sql){statements.push(sql);return{bind(){return this;},async run(){return{meta:{changes:1}};},async first(){return /SELECT count/.test(sql)?{count:1}:null;}};}};
 const session=await worker.fetch(new Request('https://ray.example/api/ray/session'),{...env,DB:db}),data=await session.json();assert.equal(session.status,200);assert.equal(data.freeAccess,true);assert.equal(data.csrf.length,48);assert.ok(statements.some(sql=>sql.includes('INSERT INTO ray_visitors')));assert.match(session.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
});
test('portable CLI and provider template have explicit local defaults and no existing deployment identifiers',async()=>{
 const {parseOptions}=await import('../scripts/serve-local.mjs');assert.deepEqual(parseOptions([]),{port:4173,host:'127.0.0.1'});assert.deepEqual(parseOptions(['--port','0','--host','::1']),{port:0,host:'::1'});for(const args of [['--port','-1'],['--port','70000'],['--host','bad/host'],['--unknown','x'],['--port']])assert.throws(()=>parseOptions(args));
 const text=await fs.readFile(path.join(root,'wrangler.portable.jsonc'),'utf8'),config=JSON.parse(text.replace(/^\s*\/\/.*$/gm,''));assert.equal(config.main,'server/portable-worker.mjs');assert.equal(config.assets.directory,'./build/web');assert.equal(config.d1_databases[0].binding,'DB');assert.equal(config.d1_databases[0].database_id,'REPLACE_WITH_YOUR_D1_DATABASE_ID');assert.ok(!text.includes('appgprj_'));
});
