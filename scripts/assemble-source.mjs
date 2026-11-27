/* Assemble editable native modules without changing their classic-script scope. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';

const projectRoot=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const hash=value=>createHash('sha256').update(value).digest('hex');
function relativeFile(value,label){
 if(typeof value!=='string'||!value||value.includes('\\')||/[\u0000-\u001f\u007f]/.test(value)||path.isAbsolute(value)||/^[a-zA-Z]:/.test(value)||value.split('/').some(p=>!p||p==='.'||p==='..'))throw new Error(`Invalid ${label}: use a project-relative path without traversal.`);
 return value;
}
function contained(root,target,label){
 const rest=path.relative(root,target);if(rest==='..'||rest.startsWith('..'+path.sep)||path.isAbsolute(rest))throw new Error(`${label} resolves outside the project.`);
}
function existingPath(root,relative,label){
 const target=path.resolve(root,relativeFile(relative,label));contained(root,target,label);
 const real=fs.realpathSync(target);contained(root,real,label);return target;
}
function outputPath(root,relative){
 const target=path.resolve(root,relativeFile(relative,'output'));contained(root,target,'output');
 let ancestor=target;while(!fs.existsSync(ancestor)){const parent=path.dirname(ancestor);if(parent===ancestor)throw new Error('Output has no existing parent.');ancestor=parent;}
 contained(root,fs.realpathSync(ancestor),'output');return target;
}
function keys(value,allowed,label){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k)))throw new Error(`Invalid ${label}.`);
}
function once(text,token,label){
 if(typeof token!=='string'||!token||text.split(token).length!==2)throw new Error(`The template must contain exactly one ${label} token.`);
}
/** Build the native editor from its canonical source, or check drift without writing. */
export function assembleSource({root=projectRoot,check=false}={}){
 root=fs.realpathSync(root);
 const manifestFile=existingPath(root,'source/editor/manifest.json','manifest'),manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
 keys(manifest,['version','output','template','styleToken','scriptToken','styles','scripts'],'source manifest');
 if(manifest.version!==1||!Array.isArray(manifest.styles)||!manifest.styles.length||!Array.isArray(manifest.scripts)||!manifest.scripts.length||manifest.styles.length+manifest.scripts.length>512)throw new Error('Unsupported or incomplete source manifest.');
 const inputPaths=[manifest.template,...manifest.styles,...manifest.scripts.map((part,i)=>{keys(part,['path','module'],`script ${i+1}`);if(typeof part.module!=='string'||!(/^[a-z][a-z0-9-]*$/).test(part.module))throw new Error(`Invalid module name in script ${i+1}.`);return part.path;})];
 const seen=new Set();for(const name of inputPaths){relativeFile(name,'source');if(seen.has(name))throw new Error(`Duplicate source path: ${name}`);seen.add(name);}
 relativeFile(manifest.output,'output');if(seen.has(manifest.output)||manifest.output==='source/editor/manifest.json')throw new Error('Generated output must not overwrite a source file.');
 const realInputs=new Set([fs.realpathSync(manifestFile)]);for(const name of inputPaths){const real=fs.realpathSync(existingPath(root,name,'source'));if(realInputs.has(real))throw new Error(`Duplicate physical source: ${name}`);realInputs.add(real);}
 const read=(name,label)=>fs.readFileSync(existingPath(root,name,label),'utf8'),template=read(manifest.template,'template');
 once(template,manifest.styleToken,'style');once(template,manifest.scriptToken,'script');if(manifest.styleToken===manifest.scriptToken||manifest.styleToken.includes(manifest.scriptToken)||manifest.scriptToken.includes(manifest.styleToken))throw new Error('Assembly tokens must be distinct.');
 const styles=manifest.styles.map(name=>read(name,'stylesheet')).join(''),script=manifest.scripts.map(part=>read(part.path,'script')).join('');
 // Syntax failure must not replace a working generated editor.
 new Script(script,{filename:'RAY-editor-native.js'});
 const escape=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),tokens=new RegExp(escape(manifest.styleToken)+'|'+escape(manifest.scriptToken),'g');
 const html=template.replace(tokens,token=>token===manifest.styleToken?styles:script),target=outputPath(root,manifest.output),current=fs.existsSync(target)?fs.readFileSync(target,'utf8'):null,changed=current!==html;
 if(fs.existsSync(target)&&realInputs.has(fs.realpathSync(target)))throw new Error('Generated output must not overwrite a source file through an alias.');
 if(check&&changed)throw new Error(`Generated source drift: ${manifest.output}. Run npm run source:build to assemble the editable modules.`);
 if(!check&&changed){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,html);}
 return{output:manifest.output,scriptParts:manifest.scripts.length,styleParts:manifest.styles.length,changed,checked:check,htmlSHA256:hash(html),scriptSHA256:hash(script)};
}
export const checkSource=options=>assembleSource({...options,check:true});

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const args=process.argv.slice(2);if(args.some(a=>a!=='--check'))throw new Error('Usage: node scripts/assemble-source.mjs [--check]');console.log(JSON.stringify(assembleSource({check:args.includes('--check')})));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
