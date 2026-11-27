/* Export editable RAY source, bundled assets and licenses, never runtime data or credentials. */
import {createReadStream} from 'node:fs';
import {lstat,readFile,readdir,realpath,mkdir,link,unlink,stat} from 'node:fs/promises';
import {resolve,dirname,join,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const FORMAT='ray-photo-source',SCHEMA=1,MANIFEST='SOURCE-MANIFEST.json';
const ROOTS=new Set(['source','scripts','test','docs','server','api-server','native','android','ios','dist']);
const ROOT_FILES=new Set(['package.json','package-lock.json','pnpm-lock.yaml','pnpm-workspace.yaml','yarn.lock','bun.lock','bun.lockb','capacitor.config.json','capacitor.config.ts','wrangler.portable.jsonc','.gitignore','.editorconfig','.nvmrc','.node-version']);
const HIDDEN=new Set(['.gitignore','.editorconfig','.prettierrc','.prettierignore','.eslintignore','.nvmrc','.node-version','.npmrc']);
const GENERATED=new Set(['.git','node_modules','.next','.nuxt','.vite','.vinext','.wrangler','.sites-runtime','.cache','.gradle','.idea','.vscode','__pycache__','coverage']);
const PRIVATE_NAMES=new Set(['credentials.json','secrets.json','service-account.json','service_account.json','auth.json','token.json','tokens.json','.netrc','.pypirc','.ds_store','local.properties','key.properties','keystore.properties','signing.properties']);
const fail=message=>new Error('Source package: '+message);
const versionOf=value=>{if(typeof value!=='string'||!/^v\d+(?:[.-][A-Za-z0-9]+)*$/.test(value))throw fail('use a version such as v115.');return value;};
function pathParts(name){
 if(typeof name!=='string'||!name||name.includes('\\')||/[\u0000-\u001f\u007f]/.test(name)||name.startsWith('/')||/^[A-Za-z]:/.test(name))throw fail('unsafe source path.');
 const parts=name.split('/');if(parts.some(p=>!p||p==='.'||p==='..'))throw fail('unsafe source path.');return parts;
}
function included(name){
 const parts=pathParts(name),lower=parts.map(s=>s.toLowerCase()),base=lower.at(-1);
 if(base===MANIFEST.toLowerCase()||PRIVATE_NAMES.has(base)||/^\.env(?:\.|$)/i.test(base)||/^\.dev\.vars(?:\.|$)/i.test(base)||/\.(?:env|pem|key|p8|p12|pfx|mobileprovision|keystore|jks|sqlite|sqlite3|db|log|zip|tgz|tar|7z|rar)$/i.test(base)||/\.tar\.gz$/i.test(base))return false;
 if(parts.some(p=>GENERATED.has(p)))return false;
 if(parts.some((p,i)=>p.startsWith('.')&&!HIDDEN.has(p)&&!(p==='.openai'&&i===parts.length-2&&parts.at(-1)==='hosting.json')))return false;
 if(parts.length===1)return ROOT_FILES.has(name)||name.endsWith('.md');
 if(parts[0]==='.openai')return name==='.openai/hosting.json';
 if(!ROOTS.has(parts[0]))return false;
 if(/^dist\/(?:client|server|\.openai|__qa[^/]*)(?:\/|$)/.test(name)||/^api-server\/(?:public|dist)(?:\/|$)/.test(name)||/^(?:api-server|server)\/(?:uploads|storage|data|tmp|temp|logs|cache)(?:\/|$)/.test(name)||/^dist\/(?:uploads|drafts|albums|sessions)(?:\/|$)/.test(name))return false;
 if(parts[0]==='android'&&(parts.includes('build')||name.startsWith('android/app/src/main/assets/public/')))return false;
 if(parts[0]==='ios'&&(parts.includes('build')||parts.includes('Pods')||parts.includes('xcuserdata')||name.startsWith('ios/App/App/public/')))return false;
 return true;
}
const digest=async file=>{const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');};
function manifestShape(value){
 if(!value||Object.keys(value).some(k=>!['format','schema','version','fileCount','totalBytes','files'].includes(k))||value.format!==FORMAT||value.schema!==SCHEMA||!Array.isArray(value.files)||value.files.length>20000)throw fail('invalid source manifest.');
 versionOf(value.version);const seen=new Set();let total=0;
 for(const file of value.files){if(!file||Object.keys(file).some(k=>!['path','size','sha256','mode'].includes(k))||!included(file.path)||seen.has(file.path.toLowerCase())||!Number.isSafeInteger(file.size)||file.size<0||!['0644','0755'].includes(file.mode)||!/^[a-f0-9]{64}$/.test(file.sha256))throw fail('invalid source manifest entry.');seen.add(file.path.toLowerCase());total+=file.size;}
 if(total!==value.totalBytes||value.fileCount!==value.files.length||total>2*1024**3)throw fail('invalid source manifest totals.');return value;
}
async function sourceNames(root){
 let gitRoot;
 try{gitRoot=execFileSync('git',['-C',root,'rev-parse','--show-toplevel'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
 if(gitRoot&&await realpath(gitRoot)===root)return{names:execFileSync('git',['-C',root,'ls-files','--cached','-z'],{encoding:'utf8',maxBuffer:16*1024**2}).split('\0').filter(Boolean),selection:'git-index'};
 let saved;
 try{saved=manifestShape(JSON.parse(await readFile(join(root,MANIFEST),'utf8')));}catch(error){throw fail('no Git index or valid SOURCE-MANIFEST.json; unpack a complete source export first.');}
 const names=[];
 async function walk(name){
  // Prune generated/private directories before inspecting symlinks inside them.
  const parts=pathParts(name);
  if(parts.some(p=>GENERATED.has(p))||/^dist\/(?:client|server|\.openai|__qa[^/]*)(?:\/|$)/.test(name)||/^api-server\/(?:public|dist)(?:\/|$)/.test(name)||/^(?:api-server|server)\/(?:uploads|storage|data|tmp|temp|logs|cache)(?:\/|$)/.test(name)||/^dist\/(?:uploads|drafts|albums|sessions)(?:\/|$)/.test(name)||parts[0]==='android'&&parts.includes('build')||parts[0]==='ios'&&(parts.includes('build')||parts.includes('Pods')||parts.includes('xcuserdata'))||name==='android/app/src/main/assets/public'||name==='ios/App/App/public')return;
  const info=await lstat(join(root,name));
  if(info.isSymbolicLink())throw fail('symlinks are not portable: '+name);
  if(info.isDirectory()){for(const child of await readdir(join(root,name)))await walk(name+'/'+child);}
  else if(info.isFile()&&included(name))names.push(name);
 }
 for(const name of await readdir(root)){
  if(ROOTS.has(name)||name==='.openai')await walk(name);
  else if(included(name))names.push(name);
 }
 // Every safe source root is walked, so new modules/tests added after export
 // are included; removed files do not reappear from the old manifest.
 return{names,selection:'source-manifest'};
}
async function checkedFile(root,name){
 pathParts(name);let current=root;
 for(const part of name.split('/')){current=join(current,part);if((await lstat(current)).isSymbolicLink())throw fail('symlinks are not portable: '+name);}
 const absolute=await realpath(current),rel=relative(root,absolute);if(rel==='..'||rel.startsWith('..'+sep)||resolve(root,rel)!==absolute)throw fail('file escapes source root: '+name);
 const info=await stat(absolute);if(!info.isFile())throw fail('expected a regular source file: '+name);
 const base=name.split('/').at(-1);
 if(base==='hosting.json'&&name.split('/').includes('.openai')){
  const value=JSON.parse(await readFile(absolute,'utf8'));
  if(!value||Array.isArray(value)||Object.keys(value).some(k=>!['project_id','d1','r2'].includes(k))||typeof value.project_id!=='string'||!/^appgprj_[a-f0-9]+$/.test(value.project_id)||['d1','r2'].some(k=>value[k]!==undefined&&value[k]!==null&&(typeof value[k]!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value[k]))))throw fail('hosting.json contains unsupported fields; only project and binding names may be exported.');
 }
 if(base==='.npmrc'){
  const lines=(await readFile(absolute,'utf8')).split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('#')&&!s.startsWith(';'));
  if(lines.some(line=>!/^(?:audit|fund|update-notifier|strict-peer-dependencies|auto-install-peers)\s*=\s*(?:true|false)$/.test(line)))return null;
 }
 if(info.size<1024*1024&&/\.(?:txt|json|md|conf|properties|xml|plist|ya?ml)$/i.test(base)){
  const text=await readFile(absolute,'utf8');if(/-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/.test(text))throw fail('private key material is not source: '+name);
 }
 return{path:name,absolutePath:absolute,size:info.size,sha256:await digest(absolute),mode:info.mode&0o111?'0755':'0644'};
}
export async function planSource({root=dirname(dirname(fileURLToPath(import.meta.url))),version}={}){
 const sourceRoot=await realpath(resolve(root)),v=versionOf(version),selection=await sourceNames(sourceRoot),files=[],seen=new Set();let excludedCount=0;
 for(const name of [...new Set(selection.names)].sort()){
  if(!included(name)){excludedCount++;continue;}
  const file=await checkedFile(sourceRoot,name);if(!file){excludedCount++;continue;}
  if(seen.has(name.toLowerCase()))throw fail('case-insensitive filename collision: '+name);seen.add(name.toLowerCase());files.push(file);
 }
 if(!files.some(f=>f.path==='package.json')||!files.some(f=>f.path.startsWith('scripts/'))||!files.some(f=>f.path.startsWith('source/')))throw fail('source export needs package.json, scripts and editable source.');
 const manifest={format:FORMAT,schema:SCHEMA,version:v,fileCount:files.length,totalBytes:files.reduce((n,f)=>n+f.size,0),files:files.map(({absolutePath,...file})=>file)};
 manifestShape(manifest);return{root:sourceRoot,selection:selection.selection,excludedCount,manifest,files};
}
function python(code,args=[],input){
 const choices=[...(process.env.PYTHON?[process.env.PYTHON]:[]),'python3','python'];let last;
 for(const command of [...new Set(choices)])try{return execFileSync(command,['-c',code,...args],{encoding:'utf8',input,maxBuffer:32*1024**2,stdio:['pipe','pipe','pipe']});}catch(error){if(error.code==='ENOENT'){last=error;continue;}throw fail(error.stderr?.trim()||error.message);}
 throw fail('Python 3 is required to create and verify ZIP files.');
}
const CREATE=String.raw`import sys,json,zipfile,hashlib,stat
request=json.load(sys.stdin)
def info(name,mode):
 z=zipfile.ZipInfo(name,(2020,1,1,0,0,0));z.create_system=3;z.external_attr=(stat.S_IFREG|int(mode,8))<<16;z.compress_type=zipfile.ZIP_DEFLATED;return z
with zipfile.ZipFile(sys.argv[1],'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as z:
 for f in request['files']:
  sha=hashlib.sha256();size=0
  with open(f['absolutePath'],'rb') as src,z.open(info(request['prefix']+'/'+f['path'],f['mode']),'w') as dst:
   while True:
    chunk=src.read(1024*1024)
    if not chunk:break
    dst.write(chunk);sha.update(chunk);size+=len(chunk)
  if sha.hexdigest()!=f['sha256'] or size!=f['size']:raise ValueError('source changed while packaging: '+f['path'])
 z.writestr(info(request['prefix']+'/SOURCE-MANIFEST.json','0644'),request['manifestText'])
`;
const VERIFY=String.raw`import sys,json,zipfile,hashlib,re,stat
with zipfile.ZipFile(sys.argv[1]) as z:
 entries=z.infolist();seen=set()
 if len(entries)>20001:raise ValueError('too many archive entries')
 for i in entries:
  p=i.filename.split('/')
  if not i.filename or i.filename.startswith('/') or chr(92) in i.filename or any(ord(c)<32 or ord(c)==127 for c in i.filename) or re.match(r'^[A-Za-z]:',i.filename) or any(v in ('','.','..') for v in p):raise ValueError('unsafe archive path')
  if i.filename.lower() in seen or i.flag_bits&1 or stat.S_IFMT(i.external_attr>>16)==stat.S_IFLNK:raise ValueError('duplicate, encrypted or symlink archive entry')
  seen.add(i.filename.lower())
 manifests=[i for i in entries if len(i.filename.split('/'))==2 and i.filename.endswith('/SOURCE-MANIFEST.json')]
 if len(manifests)!=1 or manifests[0].file_size>16*1024*1024:raise ValueError('missing or invalid source manifest')
 manifest=json.loads(z.read(manifests[0]));prefix=manifests[0].filename.split('/')[0]
 if manifest.get('format')!='ray-photo-source' or manifest.get('schema')!=1 or not re.fullmatch(r'v\d+(?:[.-][A-Za-z0-9]+)*',manifest.get('version','')) or prefix!='RAY-PHOTO-source-'+manifest['version']:raise ValueError('invalid source manifest version')
 files=manifest.get('files');total=0;expected={manifests[0].filename};names=set()
 if not isinstance(files,list) or len(files)>20000 or manifest.get('fileCount')!=len(files):raise ValueError('invalid manifest files')
 for f in files:
  name=f.get('path','');parts=name.split('/')
  if not name or name.startswith('/') or chr(92) in name or any(ord(c)<32 or ord(c)==127 for c in name) or re.match(r'^[A-Za-z]:',name) or any(v in ('','.','..') for v in parts) or name.lower() in names or not isinstance(f.get('size'),int) or f['size']<0 or f.get('mode') not in ('0644','0755') or not re.fullmatch('[a-f0-9]{64}',f.get('sha256','')):raise ValueError('invalid manifest entry')
  names.add(name.lower());entry=prefix+'/'+name;expected.add(entry);total+=f['size']
  if total>2*1024**3:raise ValueError('source archive exceeds size limit')
  i=z.getinfo(entry)
  if i.file_size!=f['size']:raise ValueError('source size mismatch: '+name)
  if stat.S_IMODE(i.external_attr>>16)!=int(f['mode'],8):raise ValueError('source mode mismatch: '+name)
  sha=hashlib.sha256()
  with z.open(i) as src:
   while True:
    chunk=src.read(1024*1024)
    if not chunk:break
    sha.update(chunk)
  if sha.hexdigest()!=f['sha256']:raise ValueError('source digest mismatch: '+name)
 if total!=manifest.get('totalBytes') or set(i.filename for i in entries)!=expected:raise ValueError('archive contents differ from manifest')
 print(json.dumps({'valid':True,'version':manifest['version'],'fileCount':len(files),'totalBytes':total,'manifest':manifest}))
`;
export async function verifyPackage(file){const result=JSON.parse(python(VERIFY,[resolve(file)]));manifestShape(result.manifest);const {manifest,...summary}=result;return summary;}
export async function writePackage({root,version,output}={}){
 if(!output||!output.toLowerCase().endsWith('.zip'))throw fail('pass a new --output path ending in .zip.');
 const destination=resolve(output);try{await lstat(destination);throw fail('output already exists; choose a new versioned filename.');}catch(error){if(error.code!=='ENOENT')throw error;}
 const plan=await planSource({root,version}),prefix='RAY-PHOTO-source-'+plan.manifest.version,temporary=destination+'.partial-'+randomUUID();await mkdir(dirname(destination),{recursive:true});
 try{
  python(CREATE,[temporary],JSON.stringify({prefix,files:plan.files,manifestText:JSON.stringify(plan.manifest,null,2)+'\n'}));
  const verification=await verifyPackage(temporary);await link(temporary,destination);await unlink(temporary);
  return{path:destination,version:plan.manifest.version,fileCount:plan.files.length,totalBytes:plan.manifest.totalBytes,archiveBytes:(await stat(destination)).size,sha256:await digest(destination),selection:plan.selection,excludedCount:plan.excludedCount,verified:verification.valid};
 }catch(error){try{await unlink(temporary);}catch{}throw error;}
}
async function main(){
 const args=process.argv.slice(2),options={};
 for(let i=0;i<args.length;i++){if(args[i]==='--list')options.list=true;else if(['--root','--version','--output','--verify'].includes(args[i])){if(!args[i+1]||args[i+1].startsWith('--'))throw fail('missing value for '+args[i]);options[args[i].slice(2)]=args[++i];}else throw fail('unknown option '+args[i]);}
 if(options.verify){console.log(JSON.stringify(await verifyPackage(options.verify),null,2));return;}
 if(options.list){const p=await planSource(options);console.log(JSON.stringify({...p.manifest,selection:p.selection,excludedCount:p.excludedCount},null,2));return;}
 console.log(JSON.stringify(await writePackage(options),null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
