import {build} from 'esbuild';
const root=new URL('../',import.meta.url);
await build({
 entryPoints:[new URL('tools/agentation-ui.mjs',root).pathname],
 outfile:new URL('agentation/panel.mjs',root).pathname,
 bundle:true,format:'esm',platform:'browser',target:'chrome120',minify:true,
 define:{'process.env.NODE_ENV':'"production"'},legalComments:'inline'
});
console.log('Agentation browser panel built.');
