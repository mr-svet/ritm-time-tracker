import {JournalDB,passwordHash,secret} from './database.mjs';
import {databasePath} from './config.mjs';
process.umask(0o077);
const path=databasePath();
const db=new JournalDB(path);
try{
 const exists=!!db.sql.prepare('SELECT id FROM account').get();
 if(exists&&!process.argv.includes('--reset-password'))throw new Error('Вход уже настроен. Существующий пароль не изменён. Для явного сброса: npm run reset-password. Журнал сохранится.');
 const password=secret();db.tx(()=>{db.sql.prepare('INSERT INTO account VALUES(1,?) ON CONFLICT(id) DO UPDATE SET password=excluded.password').run(passwordHash(password));db.sql.exec('DELETE FROM sessions; DELETE FROM guest_sessions; DELETE FROM links');});
 console.log('Создана база: data/rhythm.sqlite\nСохраните пароль владельца в менеджере паролей. Он показывается один раз:\n'+password+'\n\nЗапуск: npm start\nСайт: http://127.0.0.1:4173');
}finally{db.close();}
