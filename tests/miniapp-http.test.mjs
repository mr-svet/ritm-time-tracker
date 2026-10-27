import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {mkdtempSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {JournalDB,passwordHash} from '../server/database.mjs';
import {createAppServer} from '../server/http.mjs';
import {backupDatabase} from '../tools/backup.mjs';
const token='123456:synthetic-test-token-no-network';
function signed(id=111){
 const params=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'Synthetic'})});
 const key=createHmac('sha256','WebAppData').update(token).digest();
 params.set('hash',createHmac('sha256',key).update([...params].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>`${k}=${v}`).join('\n')).digest('hex'));
 return params.toString();
}
test('Real local HTTP transport: Telegram login, shared journal, browser isolation and revocation',async t=>{
 const db=new JournalDB(':memory:');db.sql.prepare('INSERT INTO account VALUES(1,?)').run(passwordHash('synthetic-password-for-http'));db.bind(db.makeLink(),111,111);
 const server=createAppServer({db,publicOrigin:'https://ritm.test',telegramToken:token});
 t.after(async()=>{server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));db.close();});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const base='http://127.0.0.1:'+server.address().port;
 const request=(path,{headers={},body,method='GET'}={})=>new Promise((resolve,reject)=>{
  const req=httpRequest(base+path,{method,headers:{Host:'ritm.test',Origin:'https://ritm.test','X-Ritm-Client':'miniapp',...headers,...(body?{'Content-Type':'application/json'}:{})}},res=>{
   const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:res.headers})));
  });req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
 });
 const shell=await request('/tg');assert.equal(shell.status,200);assert.match(await shell.text(),/telegram-web-app.js/);
 const platform=await request('/telegram-platform.mjs');assert.equal(platform.status,200);assert.match(platform.headers.get('content-type'),/javascript/);assert.match(await platform.text(),/installTelegramPlatform/);
 assert.equal((await request('/api/journal')).status,401);
 assert.equal((await request('/api/auth/telegram',{method:'POST',body:{initData:signed(222)}})).status,403);
 const login=await request('/api/auth/telegram',{method:'POST',body:{initData:signed()}});assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie').split(';')[0],{csrf}=await login.json();
 const headers={Cookie:cookie,'X-CSRF-Token':csrf};
 const current=await (await request('/api/journal',{headers})).json();current.workspace.displayName='Synthetic HTTP owner';
 const payload={...current,requestId:'http-stage-one-test'};
 assert.equal((await request('/api/journal',{method:'PUT',headers,body:payload})).status,200);
 assert.equal((await request('/api/journal',{method:'PUT',headers,body:payload})).status,200);
 assert.equal(db.read().workspace.displayName,'Synthetic HTTP owner');
 assert.equal((await request('/api/journal',{headers:{...headers,'X-Ritm-Client':'website'}})).status,401);
 db.unlink();assert.equal((await request('/api/journal',{headers})).status,401);
});
test('Synthetic SQLite backup restores journal and link with Mini App schema',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'rhythm-miniapp-restore-')),source=join(dir,'source.sqlite'),snapshot=join(dir,'backup.sqlite'),restoredPath=join(dir,'restored.sqlite');
 let db,restored;
 try{
  db=new JournalDB(source);db.bind(db.makeLink(),111,111);
  const current=db.read();current.workspace.displayName='Synthetic restore marker';db.save(current.workspace,current.revision,'restore-stage-one');
  await backupDatabase(source,snapshot);copyFileSync(snapshot,restoredPath);
  restored=new JournalDB(restoredPath);
  assert.deepEqual(restored.read(),db.read());assert.equal(restored.link().user_id,'111');
  assert.equal(restored.sql.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  assert.equal(restored.sql.prepare('SELECT count(*) n FROM miniapp_sessions').get().n,0);
 }finally{restored?.close();db?.close();rmSync(dir,{recursive:true});}
});
