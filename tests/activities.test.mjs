import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {JournalDB} from '../server/database.mjs';
import {activityPreview,appendActivity,reviseActivity,removeActivity,emptyWorkspace,createStore,normalizeStore,parseImport,validateWorkspace,summary,csvRows,clone,SCHEMA_VERSION,LIMITS} from '../domain.mjs';
const date='2026-10-17';
const initial={id:'entry-1',date,start:120,end:150,text:'Библия',category:'',project:'',source:'telegram'};
const work={id:'activity-2',at:'2026-10-16T21:24:00.000Z',text:'Работа'};
test('appends without guessing durations, edits and deletes only selected activity',()=>{
 const first=appendActivity(initial,work);assert.deepEqual(first.activities.map(a=>a.text),['Библия','Работа']);assert.equal(first.activities[0].at,null);
 const edited=reviseActivity(first,'activity-2','Работа над проектом');assert.equal(edited.activities[0].text,'Библия');assert.equal(edited.activities[1].at,work.at);assert.equal(edited.text,'Библия · Работа над проектом');assert.equal(first.activities[1].text,'Работа');
 const remaining=removeActivity(edited,'activity-2');assert.equal(remaining.text,'Библия');assert.equal(removeActivity(remaining,remaining.activities[0].id),null);
 const w=emptyWorkspace();w.entries=[edited];const s=summary(w,[date],{date,minute:150});assert.equal(s.tracked,30);assert.equal(s.categories[''],30);
});
test('validates activity depth, IDs, timestamps, lengths and collection limits',()=>{
 const w=emptyWorkspace();w.entries=[appendActivity(initial,work)];assert.equal(validateWorkspace(w),true);
 for(const broken of [[{...work,at:'2026-02-30T00:00:00.000Z'}],[{...work,nested:{private:true}}],[work,work],[{...work,text:' '}],[{...work,text:'x'.repeat(2001)}],Array.from({length:LIMITS.activities+1},(_,i)=>({...work,id:'a-'+i})),[]]){
  const copy=clone(w);copy.entries[0].activities=broken;assert.throws(()=>validateWorkspace(copy));
 }
 assert.throws(()=>reviseActivity(w.entries[0],work.id,' '));assert.throws(()=>removeActivity(w.entries[0],'unknown'));
});
test('legacy store/import upgrades, JSON roundtrip and CSV retain every activity once per interval',()=>{
 const w=emptyWorkspace();w.settings.timezone='Asia/Almaty';w.entries=[appendActivity(initial,work)];for(let i=0;i<4;i++)w.entries[0]=appendActivity(w.entries[0],{...work,id:'next-'+i,text:'Дополнение '+i});
 const original=clone(w);w.entries[0].text='Устаревший краткий текст';const roundtrip=parseImport(JSON.stringify({version:SCHEMA_VERSION,workspace:w}));assert.equal(roundtrip.entries[0].text,activityPreview(original.entries[0].activities));assert.deepEqual(roundtrip.entries[0].activities,original.entries[0].activities);
 const legacy=createStore();legacy.version=1;legacy.workspaces.user.entries=[initial];assert.equal(normalizeStore(legacy).version,SCHEMA_VERSION);assert.equal(parseImport(JSON.stringify({version:1,workspace:legacy.workspaces.user})).entries[0].text,'Библия');
 const csv=csvRows(roundtrip.entries,roundtrip);for(const value of ['Библия','2026-10-17 02:24 — Работа','Дополнение 3'])assert.ok(csv.includes(value));assert.equal((csv.match(/"30"/g)||[]).length,1);
});
test('additive SQLite migration preserves old records and supports subsequent activity edit and reopen',()=>{
 const dir=mkdtempSync(join(tmpdir(),'rhythm-activities-')),path=join(dir,'legacy.sqlite');let db;
 try{
  const old=new DatabaseSync(path),{entries,...body}=emptyWorkspace();
  old.exec('CREATE TABLE journal(id INTEGER PRIMARY KEY,revision INTEGER,body TEXT); CREATE TABLE entries(id TEXT PRIMARY KEY,date TEXT,start INTEGER,end INTEGER,text TEXT,category TEXT,project TEXT,source TEXT,created_at INTEGER,updated_at INTEGER); CREATE TABLE pending(id TEXT PRIMARY KEY,text TEXT,expires INTEGER); PRAGMA user_version=1;');
  old.prepare('INSERT INTO journal VALUES(1,7,?)').run(JSON.stringify(body));old.prepare('INSERT INTO entries VALUES(?,?,?,?,?,?,?,?,?,?)').run(initial.id,date,120,150,initial.text,'','','telegram',42,43);old.prepare('INSERT INTO pending VALUES(?,?,?)').run('pending-1','Старый ответ',Date.now()+10000);old.close();
  db=new JournalDB(path);assert.equal(db.read().revision,7);assert.deepEqual(db.read().workspace.entries[0],initial);assert.equal(db.sql.prepare('SELECT text FROM pending').get().text,'Старый ответ');assert.equal(db.sql.prepare('PRAGMA user_version').get().user_version,3);
  db.mutate(w=>{w.entries[0]=appendActivity(w.entries[0],work);});db.close();db=new JournalDB(path);assert.deepEqual(db.read().workspace.entries[0].activities.map(a=>a.text),['Библия','Работа']);assert.equal(db.sql.prepare('SELECT created_at FROM entries').get().created_at,42);
  db.mutate(w=>{w.entries[0]=reviseActivity(w.entries[0],work.id,'Новая работа');});assert.equal(db.read().workspace.entries[0].activities[1].text,'Новая работа');
 }finally{db?.close();rmSync(dir,{recursive:true});}
});
