import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {JournalDB,passwordHash} from '../server/database.mjs';
import {createAppServer} from '../server/http.mjs';
import {processUpdate} from '../server/bot.mjs';
import {uid} from '../domain.mjs';
const password='synthetic-shared-journal-password';
const telegramToken='123456:synthetic-shared-journal-token-only';
function signed(){
 const fields=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:111,first_name:'QA'})});
 const key=createHmac('sha256','WebAppData').update(telegramToken).digest();
 fields.set('hash',createHmac('sha256',key).update([...fields].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>`${k}=${v}`).join('\n')).digest('hex'));return fields.toString();
}
function fixture(){
 const db=new JournalDB(':memory:');db.sql.prepare('INSERT INTO account VALUES(1,?)').run(passwordHash(password));db.bind(db.makeLink(),111,111);
 db.sql.prepare("INSERT INTO meta(key,value) VALUES('inline_menu_v1','1')").run();
 db.mutate(w=>{w.settings={...w.settings,timezone:'UTC',start:0,end:1440,step:30,days:[0,1,2,3,4,5,6],confirmed:true};w.dayEvents=[{date:'2026-10-27',type:'wake',at:'2026-10-27T00:00:00.000Z',timezone:'UTC'}];});return db;
}
const entry=(start,text)=>({id:uid(),date:'2026-10-27',start,end:start+30,text,category:'',project:'',source:'site'});
test('Website, Mini App and bot share one journal; stale saves conflict and retries do not duplicate',async t=>{
 const db=fixture(),server=createAppServer({db,telegramToken});
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));db.close();});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const base='http://127.0.0.1:'+server.address().port;
 async function request(path,{method='GET',body,client}={}){
  const res=await fetch(base+'/api/'+path,{method,headers:{Origin:base,...(client?.mini?{'X-Ritm-Client':'miniapp'}:{}),...(client?.cookie?{Cookie:client.cookie}:{}),...(client?.csrf?{'X-CSRF-Token':client.csrf}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  return {status:res.status,value:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
 }
 const websiteLogin=await request('login',{method:'POST',body:{password}});assert.equal(websiteLogin.status,200);
 const miniLogin=await request('auth/telegram',{method:'POST',client:{mini:true},body:{initData:signed()}});assert.equal(miniLogin.status,200);
 const website={cookie:websiteLogin.cookie,csrf:websiteLogin.value.csrf},mini={mini:true,cookie:miniLogin.cookie,csrf:miniLogin.value.csrf};
 assert.notEqual(website.cookie.split('=')[0],mini.cookie.split('=')[0]);
 assert.equal((await request('journal',{client:{mini:true,cookie:website.cookie}})).status,401);
 assert.equal((await request('journal',{client:{cookie:mini.cookie}})).status,401);
 const first=(await request('journal',{client:website})).value;first.workspace.entries.push(entry(540,'QA website activity'));
 assert.equal((await request('journal',{method:'PUT',client:website,body:{...first,requestId:uid()}})).status,200);
 const stale=(await request('journal',{client:mini})).value;assert.equal(stale.workspace.entries[0].text,'QA website activity');
 const at=Date.parse('2026-10-27T10:12:00Z');processUpdate(db,{update_id:99001,message:{message_id:99001,from:{id:111},chat:{id:111,type:'private'},date:Math.floor(at/1000),text:'QA bot activity'}},at);
 stale.workspace.entries.push(entry(660,'QA stale activity'));
 assert.equal((await request('journal',{method:'PUT',client:mini,body:{...stale,requestId:uid()}})).status,409);
 const fresh=(await request('journal',{client:mini})).value;assert.ok(fresh.workspace.entries.some(e=>e.text==='QA bot activity'));
 fresh.workspace.entries.push(entry(660,'QA mini activity'));const operation={...fresh,requestId:uid()};
 const saved=await request('journal',{method:'PUT',client:mini,body:operation});assert.equal(saved.status,200);
 const retried=await request('journal',{method:'PUT',client:mini,body:operation});assert.equal(retried.status,200);assert.equal(retried.value.revision,saved.value.revision);
 const websiteRead=(await request('journal',{client:website})).value;
 assert.equal(websiteRead.revision,saved.value.revision);assert.deepEqual(websiteRead.workspace.entries.map(e=>e.text),['QA website activity','QA bot activity','QA mini activity']);
 assert.equal(db.sql.prepare('SELECT count(*) n FROM entries').get().n,3);
});
test('Production wake question retains exactly three relevant buttons after Mini App integration',t=>{
 const db=fixture();t.after(()=>db.close());db.mutate(w=>{w.dayEvents=[];});db.sql.prepare("INSERT INTO meta(key,value) VALUES('bot_language','ru')").run();
 const at=Date.parse('2026-10-27T10:12:00Z');const effects=processUpdate(db,{update_id:99002,message:{message_id:99002,from:{id:111},chat:{id:111,type:'private'},date:Math.floor(at/1000),text:'/wake'}},at);
 const buttons=effects.find(e=>e.method==='sendMessage'&&e.body.reply_markup?.inline_keyboard)?.body.reply_markup.inline_keyboard.flat();
 assert.ok(buttons);assert.equal(buttons.length,3);assert.deepEqual(buttons.map(b=>b.callback_data),['w:2026-10-27:now','w:2026-10-27:other','a:dayoff:2026-10-27']);assert.equal(buttons[0].text,'Сейчас');
});
