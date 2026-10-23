import {DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';
import {clock} from '../domain.mjs';
import {databasePath} from '../server/config.mjs';
const path=databasePath();
if(!existsSync(path))throw new Error('База ещё не создана. Выполните npm run setup.');
const db=new DatabaseSync(path,{readOnly:true});
try{const rows=db.prepare('SELECT date,start,end,text,source FROM entries ORDER BY date DESC,start DESC LIMIT 100').all();console.table(rows.map(e=>({Дата:e.date,С:clock(e.start),До:clock(e.end),Занятие:e.text,Источник:e.source})));if(!rows.length)console.log('Личный журнал в базе пока пуст. Демо и старые записи браузера сюда автоматически не переносятся.');}finally{db.close();}
