const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
async function fixture(){
 const database=new DatabaseSync(':memory:');database.exec(fs.readFileSync(path.join(__dirname,'../api-server/drizzle/0000_short_brother_voodoo.sql'),'utf8'));
 const DB={prepare(sql){let args=[];return{
  bind(...a){args=a;return this;},
  async run(){const r=database.prepare(sql).run(...args);return{meta:{changes:Number(r.changes)}};},
  async first(){return database.prepare(sql).get(...args)||null;}
 };}};

 const {handleRayAPI}=await import('../server/preset-api.mjs'),base='https://ray.example',env={DB};
 const access=await handleRayAPI(new Request(base+'/api/ray/session'),env),a=await access.json(),cookie=access.headers.get('set-cookie').split(';')[0];
 const call=(route,method='GET',body,headers={})=>handleRayAPI(new Request(base+'/api/ray/'+route,{method,headers:{origin:base,cookie,'x-ray-csrf':a.csrf,'content-type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})}),env);
 return{database,call,session:a};
}
const recipe={version:1,name:'Màu Linh',layers:[{temp:.2},{sat:.1}]},advanced={...recipe,tools:{brush:{ev:.8,size:.12,softness:.6}}};
test('a real unique eight-digit code resolves the same free recipe from another anonymous device',async()=>{
 const {call,database}=await fixture(),a=await(await call('presets','POST',recipe)).json(),b=await(await call('presets','POST',recipe)).json();assert.match(a.code,/^\d{8}$/);assert.notEqual(a.code,b.code);assert.deepEqual(a.recipe,recipe);const found=await(await call('presets/'+a.code,'GET',null,{cookie:''})).json();assert.deepEqual(found.recipe,recipe);assert.equal(found.requiresPremium,false);database.close();
});
test('sharing rejects forged Premium flags, photos, missing CSRF and cross-origin writes',async()=>{
 const {call,database}=await fixture();assert.equal((await call('presets','POST',recipe,{'x-ray-csrf':''})).status,401);assert.equal((await call('presets','POST',recipe,{origin:'https://other.example'})).status,403);assert.equal((await call('presets','POST',{...recipe,premium:true})).status,400);assert.equal((await call('presets','POST',{...recipe,photo:'data:image/jpeg;base64,a'})).status,400);assert.equal(database.prepare('SELECT count(*) AS n FROM ray_presets').get().n,0);database.close();
});
test('complete advanced recipes can be shared and re-shared anonymously without payment or login',async()=>{
 const {call,database}=await fixture();
 const response=await call('presets','POST',advanced);assert.equal(response.status,201);const a=await response.json(),found=await(await call('presets/'+a.code,'GET',null,{cookie:''})).json();assert.deepEqual(found.recipe,advanced);assert.equal(found.requiresPremium,false);assert.equal((await call('presets','POST',found.recipe)).status,201);
 database.prepare('INSERT INTO ray_entitlements VALUES (?,?,?,?,?)').run('expired-user',Date.now()-1000,'old-provider','old-receipt',1);
 assert.equal((await call('presets','POST',advanced,{'oai-authenticated-user-id':'expired-user'})).status,201);database.close();
});
test('session declares free access and the removed checkout endpoint cannot create a charge',async()=>{
 const {call,database,session}=await fixture();assert.equal(session.freeAccess,true);assert.equal(session.price,undefined);assert.equal(session.premium,undefined);const result=await call('premium/checkout','POST',{plan:'annual'});assert.equal(result.status,404);assert.equal(database.prepare('SELECT count(*) AS n FROM ray_entitlements').get().n,0);database.close();
});
test('server checks print overrides against the real free preset and preserves editable layer names',async()=>{
 const {call,database}=await fixture(),free={version:1,name:'A + nắng',layers:[{printClear:.18,temp:.2},{nang:.3}],layerMeta:[{title:'A',enabled:true,basePreset:'ngocdiep'},{title:'Nắng',enabled:true,basePreset:'goc'}]};
 const response=await call('presets','POST',free);assert.equal(response.status,201);const stored=await response.json(),read=await(await call('presets/'+stored.code)).json();assert.deepEqual(read.recipe,free);assert.equal(read.requiresPremium,false);
 const custom={...free,layers:[{printClear:.9,temp:.2},{nang:.3}]};const saved=await call('presets','POST',custom);assert.equal(saved.status,201);const complete=await saved.json();assert.deepEqual((await(await call('presets/'+complete.code)).json()).recipe,custom);assert.equal((await call('presets','POST',{...free,layerMeta:[{...free.layerMeta[0],basePreset:'fake'},free.layerMeta[1]]})).status,400);database.close();
});
test('a detailed four-layer formula over the former 32 KB cap shares and resolves with all vectors intact',async()=>{
 const {detailedSnapshot}=require('./fixtures/detailed-recipe.cjs'),R=await import('../dist/darkroom/preset-rules.mjs'),large=R.capture(detailedSnapshot(),'Bốn lớp vẽ'),{call,database}=await fixture();assert.ok(JSON.stringify(large).length>32000);
 const response=await call('presets','POST',large);assert.equal(response.status,201);const saved=await response.json(),found=await(await call('presets/'+saved.code,'GET',null,{cookie:''})).json();assert.deepEqual(found.recipe,large);assert.equal(found.recipe.layers[0].adjustRegionStrokes[0].points.length,700);database.close();
});
test('the share endpoint still rejects oversized network requests while local capture retains the formula',async()=>{
 const {detailedSnapshot}=require('./fixtures/detailed-recipe.cjs'),R=await import('../dist/darkroom/preset-rules.mjs'),large=R.capture(detailedSnapshot({layers:32,points:2048}),'Lưu trên máy'),{call,database}=await fixture();assert.ok(JSON.stringify(large).length>R.MAX_BYTES);
 const response=await call('presets','POST',large);assert.equal(response.status,413);assert.match((await response.json()).error,/mã chia sẻ/);assert.equal(R.validate(large).layers.length,32);assert.equal(database.prepare('SELECT count(*) AS n FROM ray_presets').get().n,0);database.close();
});
