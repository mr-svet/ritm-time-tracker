import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const files=['app.mjs','domain.mjs','storage.mjs','remote.mjs','i18n.mjs',...['server','tools'].flatMap(dir=>readdirSync(dir).filter(name=>name.endsWith('.mjs')).map(name=>dir+'/'+name))];
for(const file of files){const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
console.log('Синтаксис проверен: '+files.length+' модулей.');
