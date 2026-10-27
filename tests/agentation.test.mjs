import test from 'node:test';
import assert from 'node:assert/strict';
import {JournalDB,secret,digest} from '../server/database.mjs';
import {createAppServer} from '../server/http.mjs';
import {build} from 'esbuild';
import {feedbackPage} from '../server/agentation.mjs';

test('feedback preference enables only local connections and preserves secure cookie rules',()=>{
 const result=feedbackPage({html:'<body></body>',policy:"connect-src 'none'; font-src data:",url:new URL('https://ritmday.space/?agentation=1'),secure:true,owner:true});
 assert.match(result.html,/agentation\/panel.mjs/);
 assert.match(result.policy,/connect-src 'self' http:\/\/localhost:4747/);
 assert.doesNotMatch(result.policy,/'none'/);
 assert.match(result.setCookie,/^__Host-ritm_feedback=1; Path=\/; HttpOnly; SameSite=Strict; Secure$/);
});

test('live HTTP paths opt in, retain preference, opt out, and never grant journal access',async t=>{
 await build({entryPoints:[new URL('../tools/agentation-ui.mjs',import.meta.url).pathname],outfile:new URL('../agentation/panel.mjs',import.meta.url).pathname,bundle:true,format:'esm',platform:'browser',define:{'process.env.NODE_ENV':'"production"'}});
 const db=new JournalDB(':memory:');
 const ownerToken=secret(),guestToken=secret(),expiredToken=secret();
 db.sql.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(ownerToken),'test-csrf',Date.now()+60000);
 db.sql.prepare('INSERT INTO guest_sessions VALUES(?,?,?)').run(digest(guestToken),'test-guest-csrf',Date.now()+60000);
 db.sql.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(expiredToken),'test-expired-csrf',Date.now()-1000);
 const ownerCookie='ritm_session='+ownerToken;
 const server=createAppServer({db});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));db.close();});
 const base='http://127.0.0.1:'+server.address().port;
 const ordinary=await fetch(base+'/');
 assert.equal(ordinary.status,200);
 assert.doesNotMatch(await ordinary.text(),/agentation\/panel.mjs/);
 assert.match(ordinary.headers.get('content-security-policy'),/connect-src 'none'/);
 for(const deniedCookie of ['', 'ritm_feedback=1', 'ritm_session='+guestToken+'; ritm_feedback=1', 'ritm_session='+expiredToken+'; ritm_feedback=1']){
  const denied=await fetch(base+'/?agentation=1',{headers:{Cookie:deniedCookie}});
  assert.equal(denied.status,200);
  assert.doesNotMatch(await denied.text(),/agentation\/panel.mjs/);
  assert.doesNotMatch(denied.headers.get('content-security-policy'),/localhost:4747/);
  assert.equal(denied.headers.get('set-cookie'),null);
  assert.equal((await fetch(base+'/agentation/panel.mjs',{headers:{Cookie:deniedCookie}})).status,403);
 }
 const enabled=await fetch(base+'/?agentation=1',{headers:{Cookie:ownerCookie}});
 assert.match(await enabled.text(),/agentation\/panel.mjs/);
 const preference=enabled.headers.get('set-cookie').split(';')[0];
 const cookie=ownerCookie+'; '+preference;
 for(const path of ['/ru','/en','/today','/trends','/journal','/stats','/settings']){
  const response=await fetch(base+path,{headers:{Cookie:cookie}});
  assert.equal(response.status,200);
  assert.match(await response.text(),/agentation\/panel.mjs/);
  assert.match(response.headers.get('content-security-policy'),/connect-src 'self' http:\/\/localhost:4747/);
 }
 const disabled=await fetch(base+'/?agentation=0',{headers:{Cookie:cookie}});
 assert.doesNotMatch(await disabled.text(),/agentation\/panel.mjs/);
 assert.match(disabled.headers.get('set-cookie'),/ritm_feedback=0/);
 const panel=await fetch(base+'/agentation/panel.mjs',{headers:{Cookie:ownerCookie}});
 assert.equal(panel.status,200);assert.match(panel.headers.get('content-type'),/javascript/);
 assert.ok((await panel.text()).length>10000);
 assert.equal((await fetch(base+'/api/journal',{headers:{Cookie:preference}})).status,401);
 db.sql.prepare('UPDATE sessions SET expires=? WHERE hash=?').run(Date.now()-1,digest(ownerToken));
 const afterExpiry=await fetch(base+'/',{headers:{Cookie:cookie}});
 assert.doesNotMatch(await afterExpiry.text(),/agentation\/panel.mjs/);
 assert.equal((await fetch(base+'/agentation/panel.mjs',{headers:{Cookie:cookie}})).status,403);
 const logoutToken=secret(),logoutCookie='ritm_session='+logoutToken+'; '+preference;
 db.sql.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(logoutToken),'logout-csrf',Date.now()+60000);
 const logout=await fetch(base+'/api/logout',{method:'POST',headers:{Origin:base,Cookie:logoutCookie,'X-CSRF-Token':'logout-csrf'}});
 assert.equal(logout.status,200);
 const afterLogout=await fetch(base+'/?agentation=1',{headers:{Cookie:logoutCookie}});
 assert.doesNotMatch(await afterLogout.text(),/agentation\/panel.mjs/);
 assert.equal((await fetch(base+'/agentation/panel.mjs',{headers:{Cookie:logoutCookie}})).status,403);
 assert.equal((await fetch(base+'/.env',{headers:{Cookie:cookie}})).status,404);
});


test('feedback preference never substitutes for owner authentication',()=>{
 const html='<body></body>',policy="connect-src 'none'";
 const result=feedbackPage({html,policy,url:new URL('https://ritmday.space/?agentation=1'),cookie:'__Host-ritm_feedback=1',secure:true});
 assert.equal(result.html,html);assert.equal(result.policy,policy);assert.equal(result.setCookie,null);
});
