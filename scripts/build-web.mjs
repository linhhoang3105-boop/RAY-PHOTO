/* Provider-independent static output. Rendering stays in the existing RAY modules. */
import {cp,lstat,mkdir,readdir,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {dirname,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

export const projectRoot=dirname(dirname(fileURLToPath(import.meta.url)));
const privateNames=new Set(['client','server','node_modules','__qa']);
export const publicPath=parts=>parts.length>0&&parts.every(part=>part&&!part.startsWith('.')&&!part.startsWith('__qa')&&!privateNames.has(part));

export function prepareSources(root=projectRoot,{stdio='inherit'}={}){
 for(const name of ['assemble-source.mjs','build-preset-bases.mjs','build-layer-inspector.mjs']){
  execFileSync(process.execPath,[join(root,'scripts',name)],{cwd:root,stdio});
 }
}

export async function copyPublicAssets(sourceDirectory,outputDirectory){
 const source=resolve(sourceDirectory),output=resolve(outputDirectory);
 if(source===output||output.startsWith(source+sep)||source.startsWith(output+sep))throw Error('Web output must be separate from its source directory.');
 if(!(await lstat(source)).isDirectory())throw Error('The static source directory is missing.');
 const files=[];
 async function collect(directory,parts=[]){
  for(const name of (await readdir(directory)).sort()){
   const next=[...parts,name];if(!publicPath(next))continue;
   const path=join(directory,name),stat=await lstat(path);
   if(stat.isSymbolicLink())throw Error('Static output must not include symlinks: '+next.join('/'));
   if(stat.isDirectory())await collect(path,next);else if(stat.isFile())files.push({path,parts:next});
  }
 }
 await collect(source);
 if(!files.some(file=>file.parts.join('/')==='index.html'))throw Error('The static source needs index.html.');
 await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
 for(const file of files){const destination=join(output,...file.parts);await mkdir(dirname(destination),{recursive:true});await cp(file.path,destination);}
 return{directory:output,files:files.length};
}

export async function buildWeb({root=projectRoot,prepare=true}={}){
 if(prepare)prepareSources(root);
 return copyPublicAssets(join(root,'dist'),join(root,'build','web'));
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 if(process.argv.length>2)throw Error('Use node scripts/build-web.mjs without extra arguments.');
 const result=await buildWeb();
 console.log('Portable web ready: '+relative(projectRoot,result.directory)+' ('+result.files+' files).');
}
