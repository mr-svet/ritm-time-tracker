// Synthetic preflight, run only inside an isolated container with tmpfs mounts.
// No application data volumes or bot token are attached to this container.
import assert from 'node:assert/strict';
import {readFileSync,chownSync,statSync} from 'node:fs';
import {JournalDB} from '/app/server/database.mjs';
import {installSnapshot,snapshotHash,inspectSnapshot} from './install-snapshot.mjs';

assert.equal(process.platform,'linux');assert.equal(process.getuid(),0);
const capabilities=BigInt('0x'+readFileSync('/proc/self/status','utf8').match(/^CapEff:\s*([a-f0-9]+)$/mi)[1]);
assert.equal(capabilities,3n,'Only CHOWN and DAC_OVERRIDE may be enabled.');
const source='/source/rhythm.sqlite',target='/data/rhythm.sqlite',archive='/backups/preflight';
const fixture=new JournalDB(source);
fixture.sql.exec("INSERT INTO account VALUES(1,'synthetic-owner'); INSERT INTO telegram VALUES(1,'123','456'); INSERT INTO meta VALUES('offset','789')");
fixture.sql.prepare('INSERT INTO entries VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('synthetic-id','2026-10-16',600,630,'Synthetic fixture','','','site',1,1,'[]');
fixture.sql.exec('PRAGMA journal_mode=DELETE');
fixture.close();
const empty=new JournalDB(target);empty.close();chownSync(target,1000,1000);
const options={source,target,archive,expectedHash:snapshotHash(source)};
const result=installSnapshot(options);
assert.equal(result.tables.entries,1);assert.equal(result.tables.telegram,1);assert.equal(result.tables.meta,1);
assert.equal(snapshotHash(target),options.expectedHash);
assert.equal(inspectSnapshot(archive+'/rhythm.sqlite').tables.account,0);
for(const path of [target,archive+'/rhythm.sqlite']){
 const info=statSync(path);assert.equal(info.uid,1000);assert.equal(info.gid,1000);assert.equal(info.mode&0o777,0o600);
}
assert.equal(statSync(archive).mode&0o777,0o700);
assert.throws(()=>installSnapshot({...options,archive:'/backups/retry'}),/replacement refused/);
assert.equal(snapshotHash(target),options.expectedHash);
console.log('RHYTHM_IMPORT_CHECK_OK');
