import {readFile,writeFile} from 'node:fs/promises';
import {inlineScriptHashes,contentPolicy} from './security.mjs';
const root=new URL('../',import.meta.url);
const [html,css,domain,storage,remote,i18n,app,svg]=await Promise.all(['index.html','styles.css','domain.mjs','storage.mjs','remote.mjs','i18n.mjs','app.mjs','favicon.svg'].map(name=>readFile(new URL(name,root),'utf8')));
const script=domain.replace(/^export /gm,'').replace('function duration(', 'function domainDuration(').replace('function dateLabel(', 'function domainDateLabel(')+'\n'+storage.replace(/^import .*\n/gm,'').replace(/^export /gm,'')+'\n'+remote.replace(/^export /gm,'')+'\n'+i18n.replace(/^export /gm,'')+'\nconst duration=formatDuration,dateLabel=formatDate;\n'+app.replace(/^import .*\n/gm,'');
const forest=await readFile(new URL('assets/rhythm-forest.png',root));
let bundledCss=css.replaceAll('./assets/rhythm-forest.png','data:image/png;base64,'+forest.toString('base64'));
for(const name of ['dawn','mountains','lake','meadow','coast']){const image=await readFile(new URL('assets/scenes/'+name+'.jpg',root));bundledCss=bundledCss.replaceAll('./assets/scenes/'+name+'.jpg','data:image/jpeg;base64,'+image.toString('base64'));}
let output=html.replace('<link rel="stylesheet" href="/styles.css">',()=>'<style>'+bundledCss+'</style>').replace('<script type="module" src="/app.mjs"></script>',()=>'<script type="module">\n'+script.replace(/<\/script/gi,'<\\/script')+'\n</script>').replace('href="/favicon.svg"','href="data:image/svg+xml,'+encodeURIComponent(svg)+'"');
const meta='<meta http-equiv="Content-Security-Policy" content="'+contentPolicy(inlineScriptHashes(output),true)+'">';
output=output.replace('<meta charset="UTF-8">','<meta charset="UTF-8">\n  '+meta);
await writeFile(new URL('ritm-preview.html',root),output);
console.log('Готово: ritm-preview.html — автономный HTML без внешних файлов.');
