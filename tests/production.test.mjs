import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,statSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {request as httpRequest} from 'node:http';
import {JournalDB,passwordHash} from '../server/database.mjs';
import {createAppServer} from '../server/http.mjs';
import {loadConfig,databasePath} from '../server/config.mjs';
import {backupDatabase} from '../tools/backup.mjs';
import {uid} from '../domain.mjs';

test('public binding fails closed without an exact HTTPS origin; local stays loopback',()=>{
 assert.equal(loadConfig({}).host,'127.0.0.1');
 assert.throws(()=>loadConfig({HOST:'0.0.0.0'}));
 assert.throws(()=>loadConfig({NODE_ENV:'production'}));
 for(const APP_ORIGIN of ['http://ritmday.space','https://name:password@ritmday.space','https://ritmday.space/extra','https://ritmday.space?x=1','https://ritmday.space#x',' https://ritmday.space'])assert.throws(()=>loadConfig({NODE_ENV:'production',APP_ORIGIN}));
 const config=loadConfig({NODE_ENV:'production',APP_ORIGIN:'https://ritmday.space/'});
 assert.equal(config.publicOrigin,'https://ritmday.space');assert.equal(config.host,'0.0.0.0');
 assert.equal(databasePath({DATA_DIR:'/tmp/rhythm-fixture'}),'/tmp/rhythm-fixture/rhythm.sqlite');
});

test('production API pins Host and Origin, ignores forwarded spoofing and uses Secure host-only cookies',async t=>{
 const db=new JournalDB(':memory:');db.sql.prepare('INSERT INTO account VALUES(1,?)').run(passwordHash('synthetic-production-password'));
 const origin='https://ritmday.space',server=createAppServer({db,publicOrigin:origin});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));db.close();});
 const url='http://127.0.0.1:'+server.address().port;
 // Node's fetch may normalize Host; send the same HTTP Host a reverse proxy sends.
 const request=(path,options={})=>new Promise((resolve,reject)=>{
  const req=httpRequest(url+path,{method:options.method||'GET',headers:{Host:'ritmday.space',...options.headers}},res=>{
   const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:res.headers})));
  });req.on('error',reject);req.end(options.body);
 });
 assert.equal((await fetch(url+'/api/session',{headers:{'X-Forwarded-Host':'ritmday.space','X-Forwarded-Proto':'https'}})).status,403);
 assert.equal((await request('/api/session',{headers:{Origin:'https://evil.example'}})).status,403);
 assert.equal((await request('/api/session',{headers:{Origin:'http://ritmday.space'}})).status,403);
 // Telegram, email and extension links can be cross-site document navigations.
 // The public shell may open; private API and cross-site fetches stay blocked.
 const externalNavigation={'Sec-Fetch-Site':'cross-site','Sec-Fetch-Mode':'navigate','Sec-Fetch-Dest':'document',Origin:'https://external.example'};
 const landing=await request('/',{headers:externalNavigation});
 assert.equal(landing.status,200);assert.match(await landing.text(),/find your/);
 for(const path of ['/today','/journal','/stats','/trends','/settings']){const page=await request(path,{headers:externalNavigation});assert.equal(page.status,200,path);assert.match(await page.text(),/src="\/app.mjs"/);}
 const scene=await request('/assets/scenes/lake.jpg');assert.equal(scene.status,200);assert.equal(scene.headers.get('content-type'),'image/jpeg');
 assert.equal((await request('/unknown',{headers:externalNavigation})).status,404);
 assert.equal((await request('/api/journal',{headers:externalNavigation})).status,403);
 assert.equal((await request('/api/session',{headers:externalNavigation})).status,403);
 assert.equal((await request('/api/login',{method:'POST',headers:externalNavigation})).status,403);
 assert.equal((await request('/',{headers:{'Sec-Fetch-Site':'cross-site','Sec-Fetch-Mode':'cors','Sec-Fetch-Dest':'empty'}})).status,403);
 assert.equal((await request('/.env',{headers:externalNavigation})).status,404);
 assert.equal((await request('/data/rhythm.sqlite',{headers:externalNavigation})).status,404);
 const health=await request('/api/health');assert.deepEqual(await health.json(),{ok:true});
 assert.match(health.headers.get('strict-transport-security'),/max-age=/);
 assert.equal((await request('/api/health',{method:'POST'})).status,401);
 assert.equal((await request('/data/rhythm.sqlite')).status,404);
 assert.equal((await request('/Dockerfile')).status,404);
 const headers={Origin:origin,'Content-Type':'application/json'};
 const login=await request('/api/login',{method:'POST',headers,body:JSON.stringify({password:'synthetic-production-password'})});
 assert.equal(login.status,200);const value=login.headers.get('set-cookie');
 assert.match(value,/^__Host-ritm_session=/);assert.match(value,/; Secure/);assert.match(value,/HttpOnly; SameSite=Strict; Path=\//);assert.doesNotMatch(value,/Domain=/i);
 const {csrf}=await login.json(),cookie=value.split(';')[0];
 assert.equal((await request('/api/journal',{headers:{Cookie:cookie}})).status,200);
 assert.equal((await request('/api/journal',{headers:{Cookie:cookie.replace('__Host-ritm_session','ritm_session')}})).status,401);
 const logout=await request('/api/logout',{method:'POST',headers:{...headers,Cookie:cookie,'X-CSRF-Token':csrf}});
 assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0; Secure/);
 assert.equal((await request('/api/journal',{headers:{Cookie:cookie}})).status,401);
});

test('online SQLite backup includes WAL entries and Telegram binding, restores and never overwrites',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'rhythm-production-')),source=join(dir,'source.sqlite'),destination=join(dir,'copy.sqlite'),db=new JournalDB(source);
 try{
  db.sql.prepare('INSERT INTO account VALUES(1,?)').run(passwordHash('synthetic-backup-password'));
  db.bind(db.makeLink(),111,111);
  db.mutate(w=>w.entries.push({id:uid(),date:'2026-10-16',start:540,end:570,text:'Синтетическая запись WAL',category:'',project:'',source:'site'}));
  await backupDatabase(source,destination);
  assert.equal(statSync(destination).mode&0o777,0o600);
  const restored=new JournalDB(destination);
  try{assert.equal(restored.read().workspace.entries[0].text,'Синтетическая запись WAL');assert.equal(restored.link().user_id,'111');assert.ok(restored.sql.prepare('SELECT password FROM account').get());}finally{restored.close();}
  const before=readFileSync(destination);
  await assert.rejects(()=>backupDatabase(source,destination));assert.deepEqual(readFileSync(destination),before);
  await assert.rejects(()=>backupDatabase(source,source));
  assert.equal(db.read().workspace.entries.length,1);
  const verify=new DatabaseSync(source,{readOnly:true});try{assert.equal(verify.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}finally{verify.close();}
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
