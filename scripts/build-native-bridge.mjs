import {build} from 'esbuild';
import {assembleSource} from './assemble-source.mjs';
assembleSource();
await import('./build-preset-bases.mjs');
await import('./build-layer-inspector.mjs');
await build({entryPoints:['native/native-bridge.js'],outfile:'dist/native-bridge.js',bundle:true,format:'iife',target:['es2020'],minify:true,legalComments:'eof'});
console.log('Native bridge bundled.');
