import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,statSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {JournalDB} from '../server/database.mjs';
import {backupDatabase} from '../tools/backup.mjs';
import {installSnapshot,snapshotHash,inspectSnapshot} from '../tools/install-snapshot.mjs';

async function fixture(t){
 const dir=mkdtempSync(join(tmpdir(),'rhythm-import-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const original=join(dir,'original.sqlite'),source=join(dir,'snapshot.sqlite'),target=join(dir,'target.sqlite'),archive=join(dir,'archive');
 const db=new JournalDB(original);
 db.sql.exec("INSERT INTO account VALUES(1,'synthetic-hash'); INSERT INTO telegram VALUES(1,'123','456'); INSERT INTO meta VALUES('offset','789'); INSERT INTO sessions VALUES('synthetic-session','csrf',1); INSERT INTO links VALUES('synthetic-link',1)");
 db.sql.prepare('INSERT INTO entries VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('synthetic-id','2026-10-16',600,630,'Synthetic entry','','','site',1,1,'[]');
 await backupDatabase(original,source);db.close();
 const copy=new DatabaseSync(source);copy.exec('PRAGMA journal_mode=DELETE; DELETE FROM sessions; DELETE FROM links; VACUUM');copy.close();
 const empty=new JournalDB(target);empty.close();
 return {source,target,archive,expectedHash:snapshotHash(source),uid:process.getuid(),gid:process.getgid(),original};
}

test('offline migration preserves owner, entries and bot state, archives destination and restricts permissions',async t=>{
 const options=await fixture(t),original=readFileSync(options.original),summary=installSnapshot(options);
 assert.equal(summary.tables.entries,1);assert.equal(inspectSnapshot(options.target).tables.sessions,0);
 assert.equal(statSync(options.target).mode&0o777,0o600);assert.equal(statSync(options.archive).mode&0o777,0o700);
 assert.equal(inspectSnapshot(join(options.archive,'rhythm.sqlite')).tables.account,0);
 assert.equal(snapshotHash(options.target),options.expectedHash);
 const restored=new DatabaseSync(options.target,{readOnly:true});
 try{assert.equal(restored.prepare('SELECT password FROM account').get().password,'synthetic-hash');assert.equal(restored.prepare('SELECT chat_id FROM telegram').get().chat_id,'456');assert.equal(restored.prepare('SELECT value FROM meta').get().value,'789');}finally{restored.close();}
 assert.deepEqual(readFileSync(options.original),original);
});

test('offline migration refuses to overwrite a populated destination',async t=>{
 const options=await fixture(t),target=new DatabaseSync(options.target);
 target.exec("INSERT INTO account VALUES(1,'existing-owner')");target.close();
 const before=snapshotHash(options.target);
 assert.throws(()=>installSnapshot(options),/replacement refused/);
 assert.equal(snapshotHash(options.target),before);
});

test('offline migration rejects altered transfer before changing destination',async t=>{
 const options=await fixture(t),before=snapshotHash(options.target);
 assert.throws(()=>installSnapshot({...options,expectedHash:'0'.repeat(64)}),/checksum mismatch/);
 assert.equal(snapshotHash(options.target),before);
});
