import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {JournalDB} from '../server/database.mjs';
import {createAppServer} from '../server/http.mjs';

async function fixture(t){
 const dir=mkdtempSync(join(tmpdir(),'ritm-landing-'));
 const db=new JournalDB(join(dir,'synthetic.sqlite'));
 const server=createAppServer({db});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));db.close();rmSync(dir,{recursive:true});});
 return 'http://127.0.0.1:'+server.address().port;
}

test('public home serves Find Your Flow in both languages and keeps the journal separate',async t=>{
 const base=await fixture(t);
 for(const [path,language,headline] of [['/','en','flow.'],['/en','en','flow.'],['/ru','ru','время.']]){
  const response=await fetch(base+path),html=await response.text();
  assert.equal(response.status,200);
  assert.match(html,new RegExp('<html lang="'+language+'">'));
  assert.ok(html.includes(headline));
  assert.ok(html.includes('/today?visitor=1&amp;lang='+language));
  assert.ok(html.includes('/today?login=owner&amp;lang='+language));
  assert.ok(!html.includes('data-api="true"'));
  assert.ok(!html.includes('visitor.html'));
  assert.ok(!html.includes('<strong>07</strong>'));
  assert.ok(!html.includes('Follow what matters to you.'));
  assert.ok(html.includes(language==='ru'?'Немного ясности меняет многое.':'A little clarity goes a long way.'));
  assert.match(html,new RegExp('<a class="launch" href="/today\\?visitor=1&amp;lang='+language+'"><span>'+(language==='ru'?'Начать сейчас':'Launch now')+'</span>'));
  assert.ok(!html.includes('id="slide-launch"'));
  if(language==='ru'){assert.ok(html.includes('Ваши дни под другим углом.'));assert.ok(!/Developer sign-in|time journal|A little clarity/.test(html));}
  assert.match(response.headers.get('content-security-policy'),/font-src data:/);
  assert.match(response.headers.get('content-security-policy'),/connect-src 'none'/);
 }
 for(const path of ['/today','/journal','/stats','/trends','/settings']){
  const response=await fetch(base+path);
  assert.equal(response.status,200);
  assert.match(await response.text(),/data-api="true"/);
  assert.match(response.headers.get('content-security-policy'),/font-src 'none'/);
 }
});

test('only public landing assets are served; private API still requires authentication',async t=>{
 const base=await fixture(t);
 for(const path of ['/landing/breathe.css','/landing/landing.mjs','/landing/breathe-forest.png']){
  const response=await fetch(base+path,{method:'HEAD'});
  assert.equal(response.status,200);
  assert.ok(Number(response.headers.get('content-length'))>0);
  assert.equal(await response.text(),'');
 }
 for(const path of ['/landing/README.md','/server/http.mjs','/.env','/data/rhythm.sqlite'])assert.equal((await fetch(base+path)).status,404);
 assert.equal((await fetch(base+'/api/journal')).status,401);
 assert.equal((await fetch(base+'/',{method:'POST'})).status,405);
});
