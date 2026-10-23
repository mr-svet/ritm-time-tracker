import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {emptyWorkspace,normalizeWorkspace,LIMITS} from '../domain.mjs';

export const digest=value=>createHash('sha256').update(value).digest('hex');
export const secret=()=>randomBytes(32).toString('base64url');
export class AppError extends Error {constructor(status,message){super(message);this.status=status;}}
export function passwordHash(password,salt=randomBytes(16).toString('hex')){
 if(typeof password!=='string'||password.length<16||password.length>256)throw new AppError(400,'Пароль должен содержать от 16 до 256 символов.');
 return salt+':'+scryptSync(password,salt,64).toString('hex');
}
export function verifyPassword(password,encoded){
 if(typeof password!=='string'||password.length>256||!encoded)return false;
 const [salt,hash]=encoded.split(':');const actual=scryptSync(password,salt,64),expected=Buffer.from(hash,'hex');
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
export class JournalDB {
 constructor(path){
  if(path!==':memory:'){mkdirSync(dirname(path),{recursive:true,mode:0o700});}
  this.sql=new DatabaseSync(path);if(path!==':memory:')chmodSync(path,0o600);
  this.sql.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS account(id INTEGER PRIMARY KEY CHECK(id=1),password TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS journal(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,body TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS entries(id TEXT PRIMARY KEY,date TEXT NOT NULL,start INTEGER NOT NULL,end INTEGER NOT NULL,text TEXT NOT NULL,category TEXT NOT NULL,project TEXT NOT NULL,source TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS day_events(date TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN ('wake','sleep')),at TEXT NOT NULL,timezone TEXT NOT NULL,PRIMARY KEY(date,type));
   CREATE TABLE IF NOT EXISTS wake_prompts(date TEXT PRIMARY KEY,timezone TEXT NOT NULL,status TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,message_id INTEGER,retry_at INTEGER NOT NULL DEFAULT 0);
   CREATE INDEX IF NOT EXISTS entries_date ON entries(date,start);
   CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS guest_access(id INTEGER PRIMARY KEY CHECK(id=1),password TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS guest_sessions(hash TEXT PRIMARY KEY,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY,hash TEXT NOT NULL,created INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS telegram(id INTEGER PRIMARY KEY CHECK(id=1),user_id TEXT NOT NULL,chat_id TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS links(hash TEXT PRIMARY KEY,expires INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS prompts(id TEXT PRIMARY KEY,date TEXT NOT NULL,start INTEGER NOT NULL,end INTEGER NOT NULL,timezone TEXT NOT NULL,message_id INTEGER,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,error TEXT NOT NULL DEFAULT '',created INTEGER NOT NULL,retry_at INTEGER NOT NULL DEFAULT 0,UNIQUE(date,start,end));
   CREATE TABLE IF NOT EXISTS updates(id INTEGER PRIMARY KEY,created INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS category_choices(prompt_id TEXT PRIMARY KEY,category_id TEXT NOT NULL,expires INTEGER NOT NULL,selected_at INTEGER NOT NULL,message_id INTEGER);
   CREATE TABLE IF NOT EXISTS pending(id TEXT PRIMARY KEY,text TEXT NOT NULL,expires INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
  `);
  // Additive migration: legacy entries and pending replies keep their IDs and text.
  this.tx(()=>{
   if(!this.sql.prepare('PRAGMA table_info(entries)').all().some(c=>c.name==='activities'))this.sql.exec("ALTER TABLE entries ADD COLUMN activities TEXT NOT NULL DEFAULT '[]'");
   if(!this.sql.prepare('PRAGMA table_info(pending)').all().some(c=>c.name==='sent_at'))this.sql.exec('ALTER TABLE pending ADD COLUMN sent_at TEXT');
   if(!this.sql.prepare('PRAGMA table_info(pending)').all().some(c=>c.name==='prompt_id'))this.sql.exec("ALTER TABLE pending ADD COLUMN prompt_id TEXT NOT NULL DEFAULT ''");
   if(!this.sql.prepare('PRAGMA table_info(pending)').all().some(c=>c.name==='category_id'))this.sql.exec("ALTER TABLE pending ADD COLUMN category_id TEXT NOT NULL DEFAULT ''");
   if(!this.sql.prepare('PRAGMA table_info(prompts)').all().some(c=>c.name==='replied'))this.sql.exec('ALTER TABLE prompts ADD COLUMN replied INTEGER NOT NULL DEFAULT 0');
   this.sql.exec('PRAGMA user_version=3');
  });
  if(!this.sql.prepare('SELECT id FROM journal').get()){
   const {entries,...body}=emptyWorkspace();this.sql.prepare('INSERT INTO journal VALUES(1,0,?)').run(JSON.stringify(body));
  }
 }
 tx(fn){this.sql.exec('BEGIN IMMEDIATE');try{const result=fn();this.sql.exec('COMMIT');return result;}catch(error){this.sql.exec('ROLLBACK');throw error;}}
 read(){const row=this.sql.prepare('SELECT revision,body FROM journal WHERE id=1').get();return {revision:row.revision,workspace:{...JSON.parse(row.body),entries:this.sql.prepare('SELECT id,date,start,end,text,category,project,source,activities FROM entries ORDER BY date,start').all().map(({activities,...e})=>{const items=JSON.parse(activities);return items.length?{...e,activities:items}:{...e};}),dayEvents:this.sql.prepare('SELECT date,type,at,timezone FROM day_events ORDER BY date,type').all(),telegram:this.link()?'connected':'disconnected'}};}
 write(workspace,revision){
  const w=normalizeWorkspace(workspace);if(Buffer.byteLength(JSON.stringify(w))>LIMITS.bytes)throw new AppError(413,'Журнал превышает 12 МБ.');
  const current=this.read();if(current.revision!==revision)throw new AppError(409,'Журнал уже изменён. Скачайте несохранённый JSON и загрузите свежую версию.');
  const {entries,dayEvents=[],...body}=w;body.telegram='disconnected';
  const previous=new Map(this.sql.prepare('SELECT * FROM entries').all().map(e=>[e.id,e]));
  this.sql.exec('DELETE FROM entries');const insert=this.sql.prepare('INSERT INTO entries(id,date,start,end,text,category,project,source,created_at,updated_at,activities) VALUES(?,?,?,?,?,?,?,?,?,?,?)');const at=Date.now();
  for(const e of entries){const encoded=JSON.stringify(e.activities??[]),old=previous.get(e.id),same=old&&old.activities===encoded&&['date','start','end','text','category','project','source'].every(k=>old[k]===e[k]);insert.run(e.id,e.date,e.start,e.end,e.text,e.category,e.project,e.source,old?.created_at??at,same?old.updated_at:at,encoded);}
  this.sql.exec('DELETE FROM day_events');const insertEvent=this.sql.prepare('INSERT INTO day_events(date,type,at,timezone) VALUES(?,?,?,?)');for(const e of dayEvents)insertEvent.run(e.date,e.type,e.at,e.timezone);
  this.sql.prepare('UPDATE journal SET body=?,revision=revision+1 WHERE id=1').run(JSON.stringify(body));
  return this.read();
 }
 save(workspace,revision,requestId,clear=false){
  if(typeof requestId!=='string'||!/^[a-z0-9-]{16,100}$/i.test(requestId))throw new AppError(400,'Некорректный идентификатор запроса.');
  if(typeof clear!=='boolean')throw new AppError(400,'Некорректный параметр очистки.');
  if(clear&&(workspace.entries?.length||workspace.dayEvents?.length||workspace.pauses?.length||Object.keys(workspace.snapshots??{}).length))throw new AppError(400,'Для очистки нужен пустой журнал.');
  const hash=digest(JSON.stringify({workspace,revision,clear}));
  return this.tx(()=>{const old=this.sql.prepare('SELECT hash FROM requests WHERE id=?').get(requestId);
   if(old){if(old.hash!==hash)throw new AppError(409,'Этот запрос уже использован для других данных.');return this.read();}
   const value=this.write(workspace,revision);if(clear)this.sql.exec('DELETE FROM category_choices; DELETE FROM pending; DELETE FROM prompts; DELETE FROM wake_prompts; DELETE FROM links; DELETE FROM requests');this.sql.prepare('INSERT INTO requests VALUES(?,?,?)').run(requestId,hash,Date.now());return value;
  });
 }
 mutate(fn){return this.tx(()=>{const value=this.read();fn(value.workspace);return this.write(value.workspace,value.revision);});}
 link(){return this.sql.prepare('SELECT user_id,chat_id FROM telegram WHERE id=1').get()??null;}
 makeLink(at=Date.now()){const code=secret();this.sql.exec('DELETE FROM links');this.sql.prepare('INSERT INTO links VALUES(?,?)').run(digest(code),at+600000);return code;}
 bind(code,user,chat,at=Date.now()){
  return this.tx(()=>{if(this.link())throw new AppError(409,'Telegram уже привязан. Сначала отключите его на сайте.');
   if(typeof code!=='string'||!this.sql.prepare('SELECT hash FROM links WHERE hash=? AND expires>?').get(digest(code),at))throw new AppError(400,'Ссылка недействительна или истекла. Создайте новую на сайте.');
   this.sql.prepare('INSERT INTO telegram VALUES(1,?,?)').run(String(user),String(chat));this.sql.exec('DELETE FROM links');this.sql.exec('UPDATE journal SET revision=revision+1 WHERE id=1');
  });
 }
 unlink(){this.tx(()=>{this.sql.exec('DELETE FROM telegram; DELETE FROM links; DELETE FROM prompts; DELETE FROM wake_prompts; DELETE FROM category_choices; DELETE FROM pending; UPDATE journal SET revision=revision+1 WHERE id=1');});}
 cleanup(at=Date.now()){
  for(const table of ['sessions','guest_sessions','links','pending','category_choices'])this.sql.prepare(`DELETE FROM ${table} WHERE expires<?`).run(at);
  this.sql.prepare('DELETE FROM requests WHERE created<?').run(at-7*86400000);
  this.sql.prepare('DELETE FROM updates WHERE created<?').run(at-7*86400000);
 }
 guestEnabled(){return !!this.sql.prepare('SELECT id FROM guest_access WHERE id=1').get();}
 setGuestPassword(password){
  const owner=this.sql.prepare('SELECT password FROM account WHERE id=1').get();
  if(!owner)throw new AppError(400,'Сначала настройте вход владельца.');
  if(verifyPassword(password,owner.password))throw new AppError(400,'Для гостя нужен отдельный пароль, отличный от пароля владельца.');
  const hash=passwordHash(password);
  this.tx(()=>{this.sql.prepare('INSERT INTO guest_access VALUES(1,?) ON CONFLICT(id) DO UPDATE SET password=excluded.password').run(hash);this.sql.exec('DELETE FROM guest_sessions');});
 }
 disableGuests(){this.tx(()=>this.sql.exec('DELETE FROM guest_access; DELETE FROM guest_sessions'));}
 close(){this.sql.close();}
}
