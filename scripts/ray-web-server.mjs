/* Keep the existing editor assets as source; add a small hosted API around them. */
import {cp,mkdir,rm,readFile,writeFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import {dirname,join} from 'node:path';import {spawn,execFileSync} from 'node:child_process';
import {assembleSource} from './assemble-source.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url))),server=join(root,'api-server'),mode=process.argv[2]||'dev';
if(!['dev','build'].includes(mode))throw new Error('Use dev or build.');
assembleSource({root});
execFileSync(process.execPath,[join(root,'scripts/build-preset-bases.mjs')],{cwd:root,stdio:'inherit'});
execFileSync(process.execPath,[join(root,'scripts/build-layer-inspector.mjs')],{cwd:root,stdio:'inherit'});
const publicPath=join(server,'public');await rm(publicPath,{recursive:true,force:true});await mkdir(publicPath,{recursive:true});
for(const name of await readdir(join(root,'dist')))if(!['client','server','.openai'].includes(name)&&!name.startsWith('__qa'))await cp(join(root,'dist',name),join(publicPath,name),{recursive:true});
await writeFile(join(server,'.openai/hosting.json'),await readFile(join(root,'.openai/hosting.json')));
const code=await new Promise((resolve,reject)=>{const child=spawn('npm',['run',mode,'--',...process.argv.slice(3)],{cwd:server,stdio:'inherit',env:process.env});child.on('error',reject);child.on('exit',code=>resolve(code??1));for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));});
if(code!==0)process.exit(code);
if(mode==='build')for(const name of ['client','server','.openai']){const destination=join(root,'dist',name);await rm(destination,{recursive:true,force:true});await cp(join(server,'dist',name),destination,{recursive:true});}
