/* Maintenance only: verify a pinned model and copy the pinned browser runtime. */
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';
const modelPath=process.argv[2];if(!modelPath)throw Error('Pass the local lama_512_int8.onnx file.');
const expected='cab19978adc306622fe37ef60d4a52103b99c98141d499c2a2366a7ed1255dbe',digest=data=>crypto.createHash('sha256').update(data).digest('hex'),bytes=await fs.readFile(modelPath);
if(bytes.length!==62074990||digest(bytes)!==expected)throw Error('Model does not match the pinned LaMa export.');
const root=path.resolve('dist/vendor/inpaint');await fs.mkdir(root,{recursive:true});const chunks=[],limit=16*1024*1024;
for(let offset=0,index=1;offset<bytes.length;offset+=limit,index++){const data=bytes.subarray(offset,offset+limit),file='lama-512-int8-'+String(index).padStart(2,'0')+'.bin';await fs.writeFile(path.join(root,file),data);chunks.push({file,bytes:data.length,sha256:digest(data)});}
const runtime=JSON.parse(await fs.readFile('node_modules/onnxruntime-web/package.json','utf8'));if(runtime.version!=='1.23.2')throw Error('Unexpected ONNX Runtime Web version.');
const files=['ort.wasm.min.js','ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm'];for(const file of files)await fs.copyFile(path.join('node_modules/onnxruntime-web/dist',file),path.join(root,file));
for(const file of ['LAMA-LICENSE.txt','ONNXRUNTIME-LICENSE.txt','ONNXRUNTIME-ThirdPartyNotices.txt'])await fs.access(path.join(root,file));
const manifest={id:'lama-512-int8-v1',bytes:bytes.length,sha256:expected,source:'https://huggingface.co/g-ronimo/lama/blob/386a67cedf9b8bb4fe76798c10c8d77abc0a5cc8/lama_512_int8.onnx',license:'Apache-2.0',runtime:runtime.version,chunks};
await fs.writeFile(path.join(root,'model.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({model:manifest.id,bytes:bytes.length,chunks:chunks.length,runtime:runtime.version}));
