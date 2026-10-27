import {DatabaseSync,backup} from 'node:sqlite';
import {mkdirSync,mkdtempSync,chmodSync,linkSync,rmSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {databasePath} from '../server/config.mjs';

// SQLite's backup API includes committed WAL data while the app is running.
// Publish with an exclusive hard link: never overwrite an existing backup.
export async function backupDatabase(source,destination){
 source=resolve(source);destination=resolve(destination);
 if(source===destination)throw new Error('Копия не может заменять исходную базу.');
 mkdirSync(dirname(destination),{recursive:true,mode:0o700});
 const dir=mkdtempSync(join(dirname(destination),'.rhythm-backup-')),temp=join(dir,'snapshot.sqlite');
 let db;
 try{
  db=new DatabaseSync(source,{readOnly:true});await backup(db,temp);db.close();db=null;
  chmodSync(temp,0o600);
  const check=new DatabaseSync(temp,{readOnly:true});
  try{if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Копия не прошла проверку целостности.');}finally{check.close();}
  linkSync(temp,destination);
  return destination;
 }finally{db?.close();rmSync(dir,{recursive:true,force:true});}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 process.umask(0o077);
 const directory=process.env.BACKUP_DIR||fileURLToPath(new URL('../backups/',import.meta.url));
 const name='rhythm-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8)+'.sqlite';
 try{console.log('Проверенная копия SQLite: '+await backupDatabase(databasePath(),resolve(directory,name)));}
 catch{console.error('Не удалось создать копию SQLite. Проверьте исходную базу, свободное место и права папки.');process.exitCode=1;}
}
