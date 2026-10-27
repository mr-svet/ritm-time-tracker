// Offline import only. This helper is not included in the application image or API.
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,mkdirSync,chmodSync,chownSync,renameSync,unlinkSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const snapshotHash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
// copyFile on Linux also copies ownership before chmod, requiring FOWNER.
// Copy bytes into a new private file instead; retain exclusive creation.
const copyPrivateFile=(source,destination)=>writeFileSync(destination,readFileSync(source),{flag:'wx',mode:0o600,flush:true});
export function inspectSnapshot(path){
 const db=new DatabaseSync(path,{readOnly:true});
 try{
  if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('SQLite integrity check failed.');
  const tables={};
  for(const {name} of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()){
   if(!/^[a-z_]+$/.test(name))throw new Error('Unexpected table name.');
   tables[name]=db.prepare(`SELECT count(*) AS n FROM "${name}"`).get().n;
  }
  return {version:db.prepare('PRAGMA user_version').get().user_version,tables};
 }finally{db.close();}
}

export function installSnapshot({source,target,archive,expectedHash,uid=1000,gid=1000}){
 if(!/^[a-f0-9]{64}$/.test(expectedHash)||snapshotHash(source)!==expectedHash)throw new Error('Snapshot checksum mismatch.');
 const summary=inspectSnapshot(source);
 if(![2,3].includes(summary.version)||summary.tables.account!==1||summary.tables.journal!==1||summary.tables.sessions!==0||summary.tables.links!==0)throw new Error('Snapshot must contain the owner and journal, without active sessions or links.');
 if(existsSync(target)){
  const existing=inspectSnapshot(target);
  if(existing.tables.account!==0||existing.tables.entries!==0)throw new Error('Destination contains an owner or entries; automatic replacement refused.');
 }
 if(existsSync(archive))throw new Error('Archive already exists.');
 // chmod while still the owner: the isolated import container deliberately
 // has CHOWN and DAC_OVERRIDE, but not FOWNER. Transfer ownership last.
 mkdirSync(archive,{recursive:true,mode:0o700});chmodSync(archive,0o700);chownSync(archive,uid,gid);
 // The application must already be stopped. Preserve the complete old SQLite set.
 for(const suffix of ['','-wal','-shm'])if(existsSync(target+suffix)){
  const old=join(archive,'rhythm.sqlite'+suffix);
  copyPrivateFile(target+suffix,old);chownSync(old,uid,gid);
 }
 const temporary=join(dirname(target),'.rhythm-import-'+expectedHash+'.sqlite');
 copyPrivateFile(source,temporary);chownSync(temporary,uid,gid);
 if(snapshotHash(temporary)!==expectedHash)throw new Error('Destination checksum mismatch.');
 inspectSnapshot(temporary);
 for(const suffix of ['-wal','-shm'])if(existsSync(target+suffix))unlinkSync(target+suffix);
 renameSync(temporary,target);
 return summary;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 process.umask(0o077);
 try{
  const summary=installSnapshot({source:'/import/rhythm.sqlite',target:'/data/rhythm.sqlite',archive:'/backups/'+process.argv[2],expectedHash:process.argv[3]});
  console.log('SQLite imported and verified. Entries: '+summary.tables.entries);
 }catch(error){console.error(error.message);process.exitCode=1;}
}
