/* Local editing without a Sites account. Shared color codes need a configured backend. */
import {createServer} from 'node:http';
import {lstat,open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {extname,join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {prepareSources,projectRoot,publicPath} from './build-web.mjs';
import {handleRayAPI} from '../server/preset-api.mjs';

const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.mjs':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.wasm':'application/wasm','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.otf':'font/otf','.svg':'image/svg+xml; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon','.mp4':'video/mp4','.webm':'video/webm','.mov':'video/quicktime','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.txt':'text/plain; charset=utf-8'};
const basicHeaders={'x-content-type-options':'nosniff','cache-control':'no-cache'};
function reply(response,status,message,headers={}){response.writeHead(status,{...basicHeaders,'content-type':'text/plain; charset=utf-8',...headers});response.end(message);}

function requestParts(target){
 const raw=String(target||'/').split(/[?#]/,1)[0];let decoded;
 try{decoded=decodeURIComponent(raw);}catch{return{error:400};}
 if(!decoded.startsWith('/')||/[\\\u0000-\u001f\u007f]/.test(decoded))return{error:400};
 const parts=decoded.split('/').filter(Boolean);
 if(parts.some(part=>part==='.'||part==='..')||parts.length&&!publicPath(parts))return{error:404};
 return{parts};
}

export function byteRange(header,size){
 if(!header)return null;
 const match=/^bytes=(\d*)-(\d*)$/i.exec(String(header).trim());
 if(!match||!size||!match[1]&&!match[2])return false;
 let start,end;
 if(!match[1]){const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)return false;start=Math.max(0,size-suffix);end=size-1;}
 else{start=Number(match[1]);end=match[2]?Number(match[2]):size-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||end<start)return false;end=Math.min(end,size-1);}
 return{start,end};
}

async function safeFile(root,parts){
 let file=root;const base=await lstat(root);if(base.isSymbolicLink()||!base.isDirectory())return null;
 for(let index=0;index<parts.length;index++){
  file=join(file,parts[index]);const info=await lstat(file);
  if(info.isSymbolicLink()||index<parts.length-1&&!info.isDirectory())return null;
 }
 let info=await lstat(file);const directory=info.isDirectory();
 if(directory){file=join(file,'index.html');info=await lstat(file);if(info.isSymbolicLink())return null;}
 return info.isFile()?{file,info,directory}:null;
}

export function createLocalHandler({directory=join(projectRoot,'dist')}={}){
 const root=resolve(directory);
 return async(request,response)=>{
  let fileHandle;
  try{
   const resolved=requestParts(request.url);if(resolved.error){reply(response,resolved.error,'Not found.');return;}
   if(resolved.parts[0]==='api'){
    if(resolved.parts[1]!=='ray'){reply(response,404,'Not found.');return;}
    if(['CONNECT','TRACE','TRACK'].includes(request.method)){reply(response,405,'Method not allowed.',{allow:'GET, HEAD, POST'});return;}
    // The existing handler reports503 when DB is absent; local editing and
    // IndexedDB presets remain available without pretending sharing succeeded.
    request.resume();const api=await handleRayAPI(new Request('http://localhost'+request.url,{method:request.method,headers:request.headers}),{});
    if(!api){reply(response,404,'Not found.');return;}
    response.writeHead(api.status,Object.fromEntries(api.headers));response.end(request.method==='HEAD'?undefined:Buffer.from(await api.arrayBuffer()));return;
   }
   if(!['GET','HEAD'].includes(request.method)){reply(response,405,'Method not allowed.',{allow:'GET, HEAD'});return;}
   const asset=await safeFile(root,resolved.parts);if(!asset){reply(response,404,'Not found.');return;}
   if(asset.directory&&!String(request.url).split(/[?#]/,1)[0].endsWith('/')){const url=new URL(request.url,'http://localhost');url.pathname+='/';reply(response,308,'Open this directory with a trailing slash.',{location:url.pathname+url.search});return;}
   const {file,info}=asset,etag='"'+info.size.toString(16)+'-'+Math.trunc(info.mtimeMs).toString(16)+'"';
   const headers={...basicHeaders,'content-type':types[extname(file).toLowerCase()]||'application/octet-stream','accept-ranges':'bytes','last-modified':info.mtime.toUTCString(),etag};
   let range=request.headers.range;
   if(range&&request.headers['if-range']){const expected=request.headers['if-range'];if(expected!==etag&&(!Number.isFinite(Date.parse(expected))||info.mtimeMs>Date.parse(expected)+999))range=undefined;}
   const selected=byteRange(range,info.size);
   if(selected===false){response.writeHead(416,{...headers,'content-range':'bytes */'+info.size,'content-length':'0'});response.end();return;}
   if(!range&&request.headers['if-none-match']?.split(',').map(value=>value.trim()).some(value=>value===etag||value==='*')){response.writeHead(304,headers);response.end();return;}
   if(selected){headers['content-range']='bytes '+selected.start+'-'+selected.end+'/'+info.size;headers['content-length']=String(selected.end-selected.start+1);}
   else headers['content-length']=String(info.size);
   if(request.method!=='HEAD'&&info.size>0)fileHandle=await open(file,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
   response.writeHead(selected?206:200,headers);
   if(request.method==='HEAD'||info.size===0){response.end();return;}
   const stream=fileHandle.createReadStream(selected?{start:selected.start,end:selected.end}:{});fileHandle=null;
   await pipeline(stream,response);
  }catch(error){
   await fileHandle?.close().catch(()=>{});
   if(response.headersSent){response.destroy();return;}
   if(['ENOENT','ENOTDIR','ELOOP','EACCES'].includes(error.code)){reply(response,404,'Not found.');return;}
   reply(response,500,'Unable to read this local asset.');
  }
 };
}

export function parseOptions(args){
 const options={port:4173,host:'127.0.0.1'};
 for(let index=0;index<args.length;index++){
  const key=args[index];if(!['--port','--host'].includes(key)||!args[index+1])throw Error('Use --port 4173 and optionally --host 127.0.0.1.');
  const value=args[++index];if(key==='--port'){if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))||Number(value)>65535)throw Error('Port must be between 0 and 65535.');options.port=Number(value);}else{if(!/^[a-zA-Z0-9.:-]+$/.test(value))throw Error('Host is invalid.');options.host=value;}
 }
 return options;
}

export async function startLocalServer({port=4173,host='127.0.0.1',prepare=true,directory=join(projectRoot,'dist')}={}){
 if(prepare)prepareSources();
 const server=createServer(createLocalHandler({directory}));
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});return server;
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const options=parseOptions(process.argv.slice(2)),server=await startLocalServer(options),address=server.address(),host=options.host.includes(':')?'['+options.host+']':options.host;
 console.log('RAY PHOTO local: http://'+host+':'+address.port);
 console.log('Ảnh, nháp và công thức lưu trên thiết bị. Chia sẻ mã cần backend DB riêng.');
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(()=>process.exit(0)));
}
