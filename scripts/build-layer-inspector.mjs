/* A single classic asset keeps opening a layer independent of async recipe imports. */
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const entry=fileURLToPath(new URL('../dist/darkroom/layer-inspector-boot.mjs',import.meta.url));
const output=fileURLToPath(new URL('../dist/darkroom/layer-inspector.js',import.meta.url));
await build({entryPoints:[entry],outfile:output,bundle:true,format:'iife',platform:'browser',target:'es2020',minify:true,legalComments:'none'});
