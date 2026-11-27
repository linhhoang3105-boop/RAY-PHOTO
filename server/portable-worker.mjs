/* Optional independent Cloudflare deployment: static assets + the existing D1 API. */
import {handleRayAPI} from './preset-api.mjs';

export default{
 async fetch(request,env){
  const url=new URL(request.url),api=await handleRayAPI(request,env);if(api)return api;
  if(url.pathname.startsWith('/api/'))return new Response('Not found.',{status:404});
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed.',{status:405,headers:{allow:'GET, HEAD'}});
  let path;try{path=decodeURIComponent(url.pathname);}catch{return new Response('Not found.',{status:404});}
  const parts=path.split('/').filter(Boolean);
  if(parts.some(part=>part.startsWith('.')||part==='client'||part==='server'||part==='node_modules'||part.startsWith('__qa'))||/[\\\u0000-\u001f\u007f]/.test(path))return new Response('Not found.',{status:404});
  if(!env.ASSETS?.fetch)return new Response('Static assets are not configured.',{status:503});
  if(url.pathname.endsWith('/'))url.pathname+='index.html';
  return env.ASSETS.fetch(new Request(url,request));
 }
};
