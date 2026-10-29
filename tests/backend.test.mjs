import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {JournalDB,passwordHash,verifyPassword} from '../server/database.mjs';
import {createAppServer} from '../server/http.mjs';
import {processUpdate,dueInterval,currentInterval,TelegramBot,questionKeyboard,categoryKey} from '../server/bot.mjs';
import {emptyWorkspace,uid,clone,summary} from '../domain.mjs';
const password='synthetic-password-only-for-tests';
const at=new Date('2026-10-16T10:00:15Z');
function fixture(t){const db=new JournalDB(':memory:');db.sql.prepare("INSERT INTO meta(key,value) VALUES('inline_menu_v1','1')").run();db.sql.prepare("INSERT INTO meta(key,value) VALUES('bot_language','ru')").run();t.after(()=>db.close());return db;}
function entry(overrides={}){return {id:uid(),date:'2026-10-15',start:540,end:570,text:'Тестовое занятие',category:'',project:'',source:'site',...overrides};}
function scheduled(db){db.mutate(w=>{w.settings={timezone:'UTC',start:540,end:720,step:30,days:[0,1,2,3,4,5,6],confirmed:true};w.dayEvents.push({date:'2026-10-16',type:'wake',at:'2026-10-16T09:00:00Z',timezone:'UTC'});});}
function linked(db){const code=db.makeLink();db.bind(code,111,111);}
function prompt(db,{id=uid(),date='2026-10-16',start=570,end=600,message_id=44,status='sent'}={}){db.sql.prepare('INSERT INTO prompts(id,date,start,end,timezone,message_id,status,created) VALUES(?,?,?,?,?,?,?,?)').run(id,date,start,end,'UTC',message_id,status,at.getTime());return id;}
function message(id,text,{reply=44,user=111,...extra}={}){return {update_id:id,message:{message_id:100+id,chat:{id:user,type:'private'},from:{id:user},text,...(reply?{reply_to_message:{message_id:reply}}:{}),...extra}};}
function callback(id,data){return {update_id:id,callback_query:{id:String(id),from:{id:111},message:{message_id:99,chat:{id:111,type:'private'}},data}};}
function chooseManual(db,id,category='-',time=at.getTime()){
 const pending=db.sql.prepare('SELECT id FROM pending ORDER BY rowid DESC LIMIT 1').get();assert.ok(pending);
 return processUpdate(db,callback(id,`m:${pending.id}:${category}`),time);
}

test('SQLite persists journal and individual entries across reopen',()=>{
 const dir=mkdtempSync(join(tmpdir(),'rhythm-db-')),path=join(dir,'journal.sqlite');let db=new JournalDB(path);
 try{const w=emptyWorkspace();w.entries.push(entry());w.dayEvents.push({date:'2026-10-15',type:'wake',at:'2026-10-15T07:37:00Z',timezone:'UTC'});db.save(w,0,uid());db.close();db=new JournalDB(path);assert.equal(db.read().workspace.entries[0].text,'Тестовое занятие');assert.equal(db.sql.prepare('SELECT count(*) n FROM entries').get().n,1);assert.equal(db.read().workspace.dayEvents[0].at,'2026-10-15T07:37:00Z');}finally{db.close();rmSync(dir,{recursive:true});}
});
test('CAS, idempotency, request payload reuse and overlap rollback',t=>{
 const db=fixture(t),w=emptyWorkspace();w.entries.push(entry());const id=uid();db.save(w,0,id);db.save(w,0,id);assert.equal(db.read().revision,1);
 assert.throws(()=>db.save(w,0,uid()),/уже изменён/);const changed=clone(w);changed.entries[0].text='Другое';assert.throws(()=>db.save(changed,0,id),/других данных/);
 changed.entries.push(entry({start:550,end:580}));assert.throws(()=>db.save(changed,1,uid()),/пересекается/);assert.equal(db.read().workspace.entries.length,1);assert.equal(db.read().revision,1);
});
test('one-time binding expires, is consumed, cannot replace an existing owner',t=>{
 const db=fixture(t);const old=db.makeLink(100);assert.throws(()=>db.bind(old,111,111,600101),/истекла/);const code=db.makeLink();db.bind(code,111,111);assert.equal(db.link().user_id,'111');assert.throws(()=>db.bind(code,222,222),/уже привязан/);db.unlink();assert.throws(()=>db.bind(code,222,222),/истекла/);
});
test('scrypt stores no plaintext password and verifies wrong/large inputs',()=>{const hash=passwordHash(password);assert.ok(!hash.includes(password));assert.equal(verifyPassword(password,hash),true);assert.equal(verifyPassword('wrong',hash),false);assert.equal(verifyPassword('x'.repeat(257),hash),false);});
test('authenticated API rejects missing session, wrong CSRF, cross origin and private files',async t=>{
 const db=fixture(t);db.sql.prepare('INSERT INTO account VALUES(1,?)').run(passwordHash(password));const server=createAppServer({db});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r);}));const base='http://127.0.0.1:'+server.address().port;
 const req=(path,options={})=>fetch(base+path,options);
 assert.equal((await req('/api/journal')).status,401);assert.equal((await req('/data/rhythm.sqlite')).status,404);assert.equal((await req('/.env')).status,404);assert.equal((await req('/server/database.mjs')).status,404);
 assert.equal((await req('/api/session',{headers:{Origin:'https://evil.example'}})).status,403);
 const login=await req('/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({password})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0],{csrf}=await login.json();assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
 const headers={Origin:base,Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf};const value={workspace:emptyWorkspace(),revision:0,requestId:uid()};value.workspace.entries=[entry()];
 assert.equal((await req('/api/journal',{method:'PUT',headers:{...headers,'X-CSRF-Token':'wrong'},body:JSON.stringify(value)})).status,403);
 let saved=await req('/api/journal',{method:'PUT',headers,body:JSON.stringify(value)});assert.equal(saved.status,200);assert.equal((await saved.json()).workspace.entries.length,1);
 assert.equal((await req('/api/journal',{method:'PUT',headers,body:JSON.stringify(value)})).status,200);
 assert.equal((await req('/api/journal',{method:'PUT',headers,body:JSON.stringify({...value,requestId:uid()})})).status,409);
 const page=await req('/today');assert.match(await page.text(),/data-api="true"/);assert.match(page.headers.get('content-security-policy'),/connect-src 'self'/);
 await req('/api/logout',{method:'POST',headers});assert.equal((await req('/api/journal',{headers:{Cookie:cookie}})).status,401);
});
test('login throttles after five failures',async t=>{
 const db=fixture(t),server=createAppServer({db});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r);}));const base='http://127.0.0.1:'+server.address().port;
 for(let i=0;i<5;i++)assert.equal((await fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{"password":"wrong"}'})).status,401);
 assert.equal((await fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{}'})).status,429);
});
test('real Telegram replies append activities and duplicate updates do not append again',t=>{
 const db=fixture(t);scheduled(db);linked(db);prompt(db);processUpdate(db,message(1,'Читаю книгу'),at.getTime());assert.equal(db.read().workspace.entries[0].source,'telegram');
 assert.deepEqual(processUpdate(db,message(1,'Читаю книгу'),at.getTime()),[]);assert.equal(db.read().workspace.entries.length,1);
 const effects=processUpdate(db,message(2,'Работаю'),at.getTime()+1000);const row=db.read().workspace.entries[0];assert.deepEqual(row.activities.map(a=>a.text),['Читаю книгу','Работаю']);assert.equal(effects[0].body.reply_markup,undefined);assert.equal(db.read().workspace.entries.length,1);
});
test('bot Settings button changes language without creating an activity',t=>{
 const db=fixture(t);linked(db);
 const menu=processUpdate(db,message(2301,'/settings',{reply:null}),at.getTime());
 assert.equal(menu.at(-1).body.reply_markup.inline_keyboard[0][0].callback_data,'s:language');
 const choices=processUpdate(db,callback(2302,'s:language'),at.getTime());
 assert.equal(choices.at(-1).body.reply_markup.inline_keyboard[0][1].callback_data,'l:en');
 const changed=processUpdate(db,callback(2303,'l:en'),at.getTime());
 assert.match(changed.at(-1).body.text,/English/);
 assert.ok(changed.at(-1).body.reply_markup.inline_keyboard.flat().some(button=>button.callback_data==='a:settings'));
 assert.match(processUpdate(db,message(2304,'/settings',{reply:null}),at.getTime()).at(-1).body.text,/Bot settings/);
 assert.equal(db.read().workspace.entries.length,0);
});
test('Work offers projects and a custom answer, while disabled projects do not appear',t=>{
 const db=fixture(t);scheduled(db);linked(db);const id=prompt(db);
 const selected=processUpdate(db,callback(4001,`k:${id}:${categoryKey('cat-0')}`),at.getTime());
 const buttons=selected.at(-1).body.reply_markup.inline_keyboard.flat();assert.ok(buttons.some(b=>b.text==='Свой ответ'));
 const project=buttons.find(b=>b.callback_data.startsWith('j:'));assert.ok(project);
 const saved=processUpdate(db,callback(4002,project.callback_data),at.getTime()+1000);
 assert.equal(saved.find(e=>e.method==='sendMessage').body.text,'Записал');
 const row=db.read().workspace.entries[0];assert.equal(row.category,'cat-0');assert.equal(row.project,'p-1');assert.equal(row.text,project.text);
 assert.equal(db.sql.prepare('SELECT replied FROM prompts WHERE id=?').get(id).replied,1);
 assert.equal(db.read().workspace.entries[0].activities.length,1);
 processUpdate(db,callback(4003,project.callback_data),at.getTime()+2000);assert.equal(db.read().workspace.entries[0].activities.length,1);
 db.mutate(w=>{w.projectsEnabled=false;});const another=prompt(db,{start:600,end:630,message_id:55});
 const plain=processUpdate(db,callback(4004,`k:${another}:${categoryKey('cat-0')}`),at.getTime()+1800000);
 assert.equal(plain.at(-1).body.reply_markup.force_reply,true);
});
test('manual message after a completed check-in asks for category, then later scheduled answer appends',async t=>{
 const db=fixture(t);scheduled(db);linked(db);const id=prompt(db);
 processUpdate(db,callback(4101,`k:${id}:${categoryKey('cat-1')}`),at.getTime());
 processUpdate(db,message(4102,'Урок',{reply:null}),at.getTime()+1000);
 const next=processUpdate(db,message(4103,'Код',{reply:null,date:Math.floor((at.getTime()+300000)/1000)}),at.getTime()+300000);
 assert.match(next.at(-1).body.text,/К какой категории/);assert.equal(db.read().workspace.entries.length,1);
 const picked=chooseManual(db,4104,categoryKey('cat-0'),at.getTime()+301000);
 const custom=picked.at(-1).body.reply_markup.inline_keyboard.flat().find(b=>b.callback_data.startsWith('u:'));
 processUpdate(db,callback(4107,custom.callback_data),at.getTime()+302000);
 const earlier=db.read().workspace.entries.find(e=>e.start===600);assert.ok(earlier,JSON.stringify(db.read().workspace.entries));assert.equal(earlier.category,'cat-0');assert.equal(earlier.text,'Код');
 const bot=new TelegramBot(db,'synthetic',{fetchImpl:async()=>({json:async()=>({ok:true,result:{message_id:77}})})});bot.ready=true;
 await bot.tick(new Date('2026-10-16T10:30:15Z'));
 const planned=db.sql.prepare('SELECT * FROM prompts WHERE start=600 AND end=630').get();assert.equal(planned.message_id,77);assert.equal(planned.replied,0);
 processUpdate(db,callback(4105,`k:${planned.id}:${categoryKey('cat-1')}`),new Date('2026-10-16T10:30:20Z').getTime());
 processUpdate(db,message(4106,'Практика',{reply:null}),new Date('2026-10-16T10:30:21Z').getTime());
 const result=db.read().workspace.entries.find(e=>e.start===600);assert.deepEqual(result.activities.map(a=>a.text),['Код','Практика']);
 assert.equal(result.category,'cat-1');assert.equal(db.sql.prepare('SELECT replied FROM prompts WHERE id=?').get(planned.id).replied,1);
});
test('reply to scheduled question appends to site entry without confirmation or losing its metadata',t=>{
 const db=fixture(t);scheduled(db);linked(db);prompt(db);
 db.mutate(w=>w.entries.push(entry({id:'original',date:'2026-10-16',start:570,end:600,text:'Книга',category:'cat-1',project:'p-2'})));
 const result=processUpdate(db,message(1,'Работа'),at.getTime());
 const row=db.read().workspace.entries[0];assert.equal(row.id,'original');assert.equal(row.category,'cat-1');assert.equal(row.project,'p-2');
 assert.deepEqual(row.activities.map(a=>a.text),['Книга','Работа']);assert.equal(result[0].body.reply_markup,undefined);
 assert.equal(summary(db.read().workspace,['2026-10-16']).tracked,30);
});
test('quick activity buttons append to the question interval and reject foreign or duplicate updates',async t=>{
 const db=fixture(t);scheduled(db);linked(db);let sent;
 const bot=new TelegramBot(db,'synthetic',{fetchImpl:async(url,options)=>{sent=JSON.parse(options.body);return {json:async()=>({ok:true,result:{message_id:55}})};}});bot.ready=true;await bot.tick(at);
 const buttons=sent.reply_markup.inline_keyboard.flat();assert.ok(buttons.some(b=>b.text==='Работа'));assert.ok(buttons.every(b=>Buffer.byteLength(b.callback_data)<=64));
 db.mutate(w=>w.entries.push(entry({date:'2026-10-16',start:570,end:600,text:'На сайте'})));
 const legacy=['work','study','food'].map(key=>`a:${key}:${db.sql.prepare('SELECT id FROM prompts').get().id}`);for(let i=0;i<legacy.length;i++){const update=callback(100+i,legacy[i]);processUpdate(db,update,at.getTime()+3600000);processUpdate(db,update,at.getTime()+3600000);}
 const row=db.read().workspace.entries[0];assert.equal(row.start,570);assert.equal(row.end,600);assert.deepEqual(row.activities.map(a=>a.text),['На сайте','Работа','Обучение','Еда']);
 const foreign=callback(200,buttons[1].callback_data);foreign.callback_query.from.id=222;processUpdate(db,foreign,at.getTime());assert.equal(db.read().workspace.entries[0].activities.length,4);
});
test('profile name persists in SQLite and remains optional for old journals',t=>{
 const db=fixture(t);const old=db.read().workspace;delete old.displayName;db.save(old,db.read().revision,uid());
 db.mutate(w=>{w.displayName='Алекс';});assert.equal(db.read().workspace.displayName,'Алекс');
 assert.throws(()=>db.mutate(w=>{w.displayName='';}),/имя/);assert.throws(()=>db.mutate(w=>{w.displayName='a'.repeat(61);}),/имя/);
 assert.equal(db.read().workspace.displayName,'Алекс');
});
test('foreign users and group messages cannot write or bind',t=>{
 const db=fixture(t);scheduled(db);linked(db);prompt(db);processUpdate(db,message(1,'Чужая запись',{user:222}),at.getTime());assert.equal(db.read().workspace.entries.length,0);
 const group=message(2,'Группа');group.message.chat.type='group';assert.deepEqual(processUpdate(db,group),[]);assert.equal(db.read().workspace.entries.length,0);
});
test('ordinary message uses current interval even with multiple old unanswered questions',t=>{
 const db=fixture(t);scheduled(db);linked(db);prompt(db);prompt(db,{start:540,end:570,message_id:43});const effects=processUpdate(db,message(1,'Работаю',{reply:null}),at.getTime());
 const w=db.read().workspace;assert.equal(w.entries.length,1);assert.equal(w.entries[0].start,600);assert.equal(w.entries[0].end,630);assert.equal(effects[0].body.reply_markup,undefined);assert.equal(db.sql.prepare("SELECT count(*) n FROM prompts WHERE status='sent'").get().n,2);
});
test('continuation and split overlap never fill intervening gaps or overwrite parts',t=>{
 const db=fixture(t);scheduled(db);linked(db);const id=prompt(db);db.mutate(w=>w.entries.push(entry({date:'2026-10-16',start:540,end:550,text:'Ранее'})));
 processUpdate(db,callback(1,'r:'+id),at.getTime());assert.equal(db.read().workspace.entries.length,2);assert.equal(db.read().workspace.entries[1].start,570);
 db.mutate(w=>{w.entries=w.entries.filter(e=>e.start!==570);w.entries.push(entry({date:'2026-10-16',start:570,end:585}));});
 const effects=processUpdate(db,message(2,'Новый ответ'),at.getTime());assert.match(effects.at(-1).body.text,/разделён/);assert.equal(db.read().workspace.entries.at(-1).end,585);
});
test('voice preserves pending slot and pause/resume/end affect schedule',t=>{
 const db=fixture(t);scheduled(db);linked(db);prompt(db);processUpdate(db,message(1,undefined,{extra:0}),at.getTime());assert.equal(db.read().workspace.entries.length,0);
 processUpdate(db,message(2,'/pause',{reply:null}),at.getTime());assert.equal(db.read().workspace.pauses[0].end,660);assert.equal(dueInterval(db.read().workspace,new Date('2026-10-16T10:30:15Z')),null);
 processUpdate(db,message(3,'/resume',{reply:null}),at.getTime()+15*60000);assert.equal(db.read().workspace.pauses[0].end,615);
 processUpdate(db,message(4,'/end',{reply:null}),at.getTime()+20*60000);assert.equal(db.read().workspace.pauses.at(-1).type,'ended');
});
test('scheduler honors boundary, last partial interval, pause, day off and no stale backlog',()=>{
 const w=emptyWorkspace();w.settings={timezone:'UTC',start:540,end:610,step:30,days:[4],confirmed:true};
 w.dayEvents.push({date:'2026-10-16',type:'wake',at:'2026-10-16T09:00:00Z',timezone:'UTC'});
 assert.equal(dueInterval(w,new Date('2026-10-16T09:29:59Z')),null);assert.equal(dueInterval(w,new Date('2026-10-16T09:30:00Z')).start,540);
 assert.equal(dueInterval(w,new Date('2026-10-16T10:10:00Z')).start,600);assert.equal(dueInterval(w,new Date('2026-10-16T10:12:00Z')),null);
 assert.equal(dueInterval(w,new Date('2026-10-17T09:30:00Z')),null);w.pauses=[{date:'2026-10-16',start:540,end:610}];assert.equal(dueInterval(w,new Date('2026-10-16T09:30:00Z')),null);
});
test('morning Just now choice starts check-ins, and bedtime ends the day',async t=>{
 const db=fixture(t);db.mutate(w=>{w.settings={timezone:'UTC',start:360,end:1320,step:30,days:[4],confirmed:true};});linked(db);
 let sent=0;const bot=new TelegramBot(db,'synthetic',{fetchImpl:async()=>({json:async()=>({ok:true,result:{message_id:++sent}})})});bot.ready=true;
 const morning=new Date('2026-10-16T06:00:00Z'),wake=new Date('2026-10-16T07:37:00Z');
 await bot.tick(morning);await bot.tick(new Date('2026-10-16T07:30:00Z'));
 assert.equal(sent,1);assert.equal(db.sql.prepare('SELECT status FROM wake_prompts').get().status,'sent');
 assert.equal(dueInterval(db.read().workspace,new Date('2026-10-16T07:30:00Z')),null);
 const response=processUpdate(db,callback(700,'w:2026-10-16:now'),wake.getTime());
 const confirmation=response.find(e=>e.method==='sendMessage');assert.match(confirmation.body.text,/07:37/);assert.deepEqual(confirmation.body.reply_markup.inline_keyboard,[[{text:'Сегодня выходной целиком',callback_data:'a:dayoff:2026-10-16'}]]);
 assert.equal(db.sql.prepare("SELECT at FROM day_events WHERE type='wake'").get().at,wake.toISOString());
 assert.equal(dueInterval(db.read().workspace,new Date('2026-10-16T08:06:00Z')),null);
 const first=dueInterval(db.read().workspace,new Date('2026-10-16T08:07:00Z'));assert.deepEqual([first.start,first.end],[457,487]);
 await bot.tick(new Date('2026-10-16T08:07:00Z'));assert.equal(sent,2);
 const sleep=new Date('2026-10-16T08:11:00Z');processUpdate(db,message(701,'/sleep',{reply:null,date:sleep.getTime()/1000}),sleep.getTime());
 assert.equal(db.sql.prepare("SELECT at FROM day_events WHERE type='sleep'").get().at,sleep.toISOString());
 assert.equal(dueInterval(db.read().workspace,new Date('2026-10-16T08:37:00Z')),null);
 await bot.tick(new Date('2026-10-16T08:37:00Z'));assert.equal(sent,2);
 assert.equal(db.read().workspace.dayEvents.length,2);
});
test('morning Another time accepts an earlier exact clock time and rejects invalid or future input',async t=>{
 const db=fixture(t);db.mutate(w=>{w.settings={timezone:'Asia/Almaty',start:360,end:1320,step:30,days:[4],confirmed:true};});linked(db);
 const bot=new TelegramBot(db,'synthetic',{fetchImpl:async()=>({json:async()=>({ok:true,result:{message_id:45}})})});bot.ready=true;
 await bot.tick(new Date('2026-10-16T01:00:00Z'));
 const choice=processUpdate(db,callback(710,'w:2026-10-16:other'),new Date('2026-10-16T02:37:00Z').getTime());
 assert.match(choice.at(-1).body.text,/7:37/);assert.equal(db.sql.prepare('SELECT status FROM wake_prompts').get().status,'awaiting_time');
 processUpdate(db,message(711,'25:00',{reply:null,date:Date.parse('2026-10-16T02:38:00Z')/1000}),Date.parse('2026-10-16T02:38:00Z'));
 processUpdate(db,message(712,'09:00',{reply:null,date:Date.parse('2026-10-16T02:38:30Z')/1000}),Date.parse('2026-10-16T02:38:30Z'));
 assert.equal(db.read().workspace.dayEvents.length,0);
 const response=processUpdate(db,message(713,'07:37',{reply:null,date:Date.parse('2026-10-16T02:39:00Z')/1000}),Date.parse('2026-10-16T02:39:00Z'));
 assert.match(response[0].body.text,/07:37/);assert.equal(db.read().workspace.dayEvents[0].at,'2026-10-16T02:37:00.000Z');
 assert.equal(db.sql.prepare('SELECT status FROM wake_prompts').get().status,'answered');
 assert.equal(dueInterval(db.read().workspace,new Date('2026-10-16T03:07:00Z')).end,487);
 assert.match(processUpdate(db,callback(714,'w:2026-10-16:now'),Date.parse('2026-10-16T03:09:00Z')).at(-1).body.text,/уже отмечен/);
});
test('bedtime after midnight belongs to the day that began with waking',t=>{
 const db=fixture(t);scheduled(db);linked(db);const at=new Date('2026-10-17T00:30:00Z');
 processUpdate(db,message(702,'/sleep',{reply:null,date:at.getTime()/1000}),at.getTime());
 const event=db.read().workspace.dayEvents.find(e=>e.type==='sleep');assert.equal(event.date,'2026-10-16');assert.equal(event.at,at.toISOString());
});
test('scheduler persists delivery and never sends the same interval twice',async t=>{
 const db=fixture(t);scheduled(db);linked(db);let count=0;const bot=new TelegramBot(db,'synthetic',{fetchImpl:async()=>{count++;return {json:async()=>({ok:true,result:{message_id:55}})};}});bot.ready=true;
 await bot.tick(at);await bot.tick(at);assert.equal(count,1);assert.equal(db.sql.prepare('SELECT status,message_id FROM prompts').get().status,'sent');
});
test('scheduled question is sent for a filled site interval and its split parts',async t=>{
 const db=fixture(t);scheduled(db);linked(db);
 db.mutate(w=>w.entries.push(entry({date:'2026-10-16',start:570,end:585}),entry({date:'2026-10-16',start:585,end:600})));
 const before=clone(db.read().workspace.entries);let count=0;
 const bot=new TelegramBot(db,'synthetic',{fetchImpl:async()=>({json:async()=>({ok:true,result:{message_id:++count}})})});bot.ready=true;
 assert.equal(dueInterval(db.read().workspace,at).start,570);
 await bot.tick(at);await bot.tick(at);assert.equal(count,1);assert.deepEqual(db.read().workspace.entries,before);
});
test('manual Telegram activity does not suppress question; reply appends and restart does not duplicate it',async t=>{
 const db=fixture(t);scheduled(db);linked(db);
 processUpdate(db,message(1,'Читаю',{reply:null}),new Date('2026-10-16T09:45:00Z').getTime());
 assert.equal(db.sql.prepare('SELECT status FROM prompts').get().status,'answered');let count=0;
 const fetchImpl=async()=>{count++;return {json:async()=>({ok:true,result:{message_id:55}})};};
 const bot=new TelegramBot(db,'synthetic',{fetchImpl});bot.ready=true;
 await bot.tick(at);await bot.tick(at);assert.equal(count,1);
 processUpdate(db,message(2,'Работаю',{reply:55}),at.getTime());
 assert.deepEqual(db.read().workspace.entries[0].activities.map(a=>a.text),['Читаю','Работаю']);
 const restarted=new TelegramBot(db,'synthetic',{fetchImpl});restarted.ready=true;await restarted.tick(at);assert.equal(count,1);
});
test('uncertain delivery is not retried; explicit rate limiting retries at most three times',async t=>{
 const db=fixture(t);scheduled(db);linked(db);let calls=0;const bot=new TelegramBot(db,'synthetic',{fetchImpl:async()=>{calls++;throw new Error('network');}});bot.ready=true;await bot.tick(at);await bot.tick(at);assert.equal(calls,1);assert.equal(db.sql.prepare('SELECT status FROM prompts').get().status,'uncertain');
 db.sql.exec('DELETE FROM prompts');bot.fetch=async()=>{calls++;return {json:async()=>({ok:false,error_code:429,parameters:{retry_after:15}})};};
 for(let i=0;i<5;i++)await bot.tick(new Date(at.getTime()+i*15000));assert.equal(calls,4);assert.equal(db.sql.prepare('SELECT attempts FROM prompts').get().attempts,3);
});
test('clear removes journal and pending texts while preserving Telegram binding',t=>{
 const db=fixture(t);linked(db);prompt(db);db.sql.prepare('INSERT INTO pending(id,text,expires) VALUES(?,?,?)').run('test','Секретная заметка',Date.now()+1000);const state=db.read();db.save(emptyWorkspace(),state.revision,uid(),true);assert.equal(db.sql.prepare('SELECT count(*) n FROM pending').get().n,0);assert.equal(db.sql.prepare('SELECT count(*) n FROM prompts').get().n,0);assert.ok(db.link());
});
test('midnight final interval is prompted once for previous date; DST repeated hour is deduplicated',async t=>{
 const w=emptyWorkspace();w.settings={timezone:'UTC',start:1380,end:1440,step:30,days:[4],confirmed:true};w.dayEvents.push({date:'2026-10-16',type:'wake',at:'2026-10-16T23:00:00Z',timezone:'UTC'});const due=dueInterval(w,new Date('2026-10-17T00:00:15Z'));assert.equal(due.date,'2026-10-16');assert.equal(due.end,1440);
 const db=fixture(t);db.mutate(w=>{w.settings={timezone:'Europe/London',start:0,end:180,step:30,days:[6],confirmed:true};});linked(db);let count=0;
 const bot=new TelegramBot(db,'synthetic',{fetchImpl:async()=>({json:async()=>({ok:true,result:{message_id:++count}})})});bot.ready=true;
 await bot.tick(new Date('2026-10-25T00:30:15Z'));await bot.tick(new Date('2026-10-25T01:30:15Z'));assert.equal(count,1);
});
test('website-generated Telegram link binds only once through a real /start update',async t=>{
 const db=fixture(t);const code=db.makeLink(at.getTime());const effects=processUpdate(db,message(1,'/start '+code,{reply:null}),at.getTime());assert.match(effects[0].body.text,/подключён/);assert.equal(db.link().user_id,'111');
 assert.deepEqual(processUpdate(db,message(1,'/start '+code,{reply:null}),at.getTime()),[]);processUpdate(db,message(2,'/start '+code,{reply:null,user:222}),at.getTime());assert.equal(db.link().user_id,'111');
});
test('one thousand messages in the same half hour never walk backwards or multiply time',t=>{
 const db=fixture(t);scheduled(db);linked(db);const time=new Date('2026-10-17T02:20:00Z').getTime();
 let firstId;
 for(let i=1;i<=1000;i++){
  processUpdate(db,message(i,'Занятие '+i,{reply:null}),time);
  if(i===1)firstId=db.read().workspace.entries[0].id;
 }
 const w=db.read().workspace;assert.equal(w.entries.length,1);assert.equal(w.entries[0].id,firstId);assert.equal(w.entries[0].date,'2026-10-17');assert.equal(w.entries[0].start,120);assert.equal(w.entries[0].end,150);assert.equal(w.entries[0].activities.length,1000);assert.deepEqual(w.entries[0].activities.map(a=>a.text),Array.from({length:1000},(_,i)=>'Занятие '+(i+1)));assert.equal(summary(w,['2026-10-17']).tracked,30);
 assert.deepEqual(processUpdate(db,message(1000,'Повтор доставки',{reply:null}),time),[]);assert.equal(db.read().workspace.entries[0].activities.length,1000);assert.equal(db.read().workspace.entries[0].activities.at(-1).text,'Занятие 1000');
});
test('uses Telegram send time in Astana across a boundary and delayed processing',t=>{
 const db=fixture(t);scheduled(db);linked(db);db.mutate(w=>{w.settings.timezone='Asia/Almaty';});
 const sent=new Date('2026-10-16T21:20:00Z').getTime(),processed=sent+20*60000;
 processUpdate(db,message(1,'Читаю',{reply:null,date:sent/1000}),processed);
 processUpdate(db,message(2,'Работаю',{reply:null,date:(sent+11*60000)/1000}),processed);chooseManual(db,3,'-',processed);
 const rows=db.read().workspace.entries;assert.equal(rows.length,2);assert.deepEqual(rows.map(e=>[e.date,e.start,e.end]),[['2026-10-17',120,150],['2026-10-17',150,180]]);
 assert.deepEqual(currentInterval(db.read().workspace,new Date('2026-10-16T19:00:00Z')),{date:'2026-10-17',start:0,end:30,timezone:'Asia/Almaty'});
});
test('current activity appends to a site record and keeps original text, category and project',t=>{
 const db=fixture(t);scheduled(db);linked(db);const time=at.getTime()+20*60000;
 db.mutate(w=>w.entries.push(entry({date:'2026-10-16',start:600,end:630,category:'cat-0',project:'p-1'})));
 const effects=processUpdate(db,message(1,'Читаю',{reply:null}),time);assert.equal(effects[0].body.reply_markup,undefined);
 processUpdate(db,message(3,'Продолжаю читать',{reply:null}),time);
 const row=db.read().workspace.entries[0];assert.deepEqual(row.activities.map(a=>a.text),['Тестовое занятие','Читаю','Продолжаю читать']);assert.equal(row.activities[0].at,null);assert.equal(row.category,'cat-0');assert.equal(row.project,'p-1');
});
test('manual current interval respects configured step, clock boundaries and historical timezone',()=>{
 const w=emptyWorkspace();w.settings={timezone:'UTC',start:555,end:1320,step:30,days:[0],confirmed:false};
 assert.deepEqual(currentInterval(w,new Date('2026-10-17T09:20:00Z')),{date:'2026-10-17',start:540,end:570,timezone:'UTC'});
 w.settings.step=15;assert.equal(currentInterval(w,new Date('2026-10-17T23:59:59Z')).end,1440);
 w.snapshots['2026-10-17']={...w.settings,timezone:'Asia/Almaty',step:60};assert.deepEqual(currentInterval(w,new Date('2026-10-17T10:20:00Z')),{date:'2026-10-17',start:900,end:960,timezone:'Asia/Almaty'});
});

test('category selection waits for text, appends site entry and consumes selection atomically',t=>{
 const db=fixture(t);scheduled(db);linked(db);const id=prompt(db);db.mutate(w=>w.entries.push(entry({date:'2026-10-16',start:570,end:600,text:'На сайте',category:'cat-1',project:'p-1'})));
 const choice=callback(801,`k:${id}:${categoryKey('cat-0')}`);processUpdate(db,choice,at.getTime());processUpdate(db,choice,at.getTime());
 assert.equal(db.read().workspace.entries[0].text,'На сайте');assert.equal(db.sql.prepare('SELECT count(*) n FROM category_choices').get().n,1);
 processUpdate(db,message(802,'Пишу отчёт',{reply:null}),at.getTime()+60000);
 const row=db.read().workspace.entries[0];assert.deepEqual(row.activities.map(a=>a.text),['На сайте','Пишу отчёт']);assert.equal(row.category,'cat-0');assert.equal(row.project,'p-1');assert.equal(row.start,570);assert.equal(db.sql.prepare('SELECT count(*) n FROM category_choices').get().n,0);
});
test('deleting a category keeps activity text while removing future bot choices',t=>{
 const db=fixture(t);scheduled(db);linked(db);db.mutate(w=>{w.entries.push(entry({date:'2026-10-16',category:'cat-0'}));});
 db.mutate(w=>{w.categories=w.categories.filter(c=>c.id!=='cat-0');for(const e of w.entries)if(e.category==='cat-0')e.category='';});
 const w=db.read().workspace,id=prompt(db);
 assert.equal(w.entries[0].text,'Тестовое занятие');assert.equal(w.entries[0].category,'');
 assert.ok(!questionKeyboard(id,w.categories).inline_keyboard.flat().some(b=>b.text==='Работа'));
 const stale=processUpdate(db,callback(990,`k:${id}:${categoryKey('cat-0')}`),at.getTime());
 assert.match(stale.at(-1).body.text,/изменена или архивирована/);
});
test('bot keeps category buttons until activity is logged, supports reselection and remembers English',t=>{
 const db=fixture(t);scheduled(db);linked(db);const id=prompt(db);
 const lang=processUpdate(db,message(950,'/language',{reply:null}),at.getTime());assert.equal(lang.at(-1).body.reply_markup.inline_keyboard[0][1].text,'English');
 processUpdate(db,callback(951,'l:en'),at.getTime()+1000);
 const choice=processUpdate(db,callback(952,`k:${id}:${categoryKey('cat-0')}`),at.getTime()+2000);
 assert.equal(choice.some(e=>e.method==='editMessageReplyMarkup'),false);
 assert.match(choice.at(-1).body.text,/Selected category: /);assert.match(choice.at(-1).body.text,/Choose a project or your own answer/);
 const changed=processUpdate(db,callback(953,`k:${id}:${categoryKey('cat-1')}`),at.getTime()+3000);
 assert.match(changed.at(-1).body.text,/Selected category: /);
 assert.equal(db.sql.prepare('SELECT category_id FROM category_choices WHERE prompt_id=?').get(id).category_id,'cat-1');
 const answer=processUpdate(db,message(954,'Studied',{reply:null}),at.getTime()+4000);
 assert.deepEqual(answer.find(e=>e.method==='editMessageReplyMarkup').body,{chat_id:111,message_id:44,reply_markup:{inline_keyboard:[]}});
 assert.equal(answer.at(-1).body.text,'Saved');assert.equal(db.read().workspace.entries[0].text,'Studied');assert.equal(db.read().workspace.entries[0].category,'cat-1');
 assert.match(processUpdate(db,callback(955,`k:${id}:${categoryKey('cat-0')}`),at.getTime()+5000).at(-1).body.text,/expired/);
 assert.equal(db.sql.prepare("SELECT value FROM meta WHERE key='bot_language'").get().value,'en');
});
test('stale category, foreign callback and pagination cannot assign incorrect categories',t=>{
 const db=fixture(t);scheduled(db);linked(db);const id=prompt(db),data=`k:${id}:${categoryKey('cat-0')}`;
 const foreign=callback(810,data);foreign.callback_query.from.id=222;processUpdate(db,foreign,at.getTime());assert.equal(db.sql.prepare('SELECT count(*) n FROM category_choices').get().n,0);
 processUpdate(db,callback(811,data),at.getTime());db.mutate(w=>w.categories[0].archived=true);processUpdate(db,message(812,'Не потерять',{reply:null}),at.getTime()+1000);assert.equal(db.read().workspace.entries.length,0);
 const categories=Array.from({length:30},(_,i)=>({id:uid(),name:'Категория '+i,archived:false})),buttons=questionKeyboard(id,categories,2).inline_keyboard.flat();assert.equal(buttons.filter(b=>b.callback_data.startsWith('k:')).length,8);assert.ok(buttons.every(b=>Buffer.byteLength(b.callback_data)<=64));
});
test('expired choice falls back to current interval; reply to another question takes precedence',t=>{
 const db=fixture(t);scheduled(db);linked(db);const id=prompt(db);processUpdate(db,callback(820,`k:${id}:${categoryKey('cat-0')}`),at.getTime());
 const other=prompt(db,{start:540,end:570,message_id:45});processUpdate(db,message(821,'Ответ на другой вопрос',{reply:45}),at.getTime()+1000);assert.equal(db.read().workspace.entries[0].start,540);assert.equal(db.read().workspace.entries[0].category,'');
 processUpdate(db,message(822,'Текущее',{reply:null,date:Math.floor((at.getTime()+1900000)/1000)}),at.getTime()+1900000);chooseManual(db,823,'-',at.getTime()+1900000);assert.equal(db.read().workspace.entries.at(-1).start,630);assert.equal(db.read().workspace.entries.at(-1).category,'');
});

test('selected category survives reopening SQLite and unlink clears it',()=>{
 const dir=mkdtempSync(join(tmpdir(),'rhythm-choice-')),path=join(dir,'test.sqlite');let db=new JournalDB(path);
 try{scheduled(db);linked(db);const id=prompt(db);processUpdate(db,callback(830,`k:${id}:${categoryKey('cat-1')}`),at.getTime());db.close();db=new JournalDB(path);processUpdate(db,message(831,'Учился',{reply:null}),at.getTime()+1000);assert.equal(db.read().workspace.entries[0].category,'cat-1');processUpdate(db,callback(832,`k:${id}:-`),at.getTime()+2000);db.unlink();assert.equal(db.sql.prepare('SELECT count(*) n FROM category_choices').get().n,0);}finally{db.close();rmSync(dir,{recursive:true});}
});

test('reply to a consumed category request never falls through to the current interval',t=>{
 const db=fixture(t);scheduled(db);linked(db);const id=prompt(db);
 processUpdate(db,callback(901,`k:${id}:${categoryKey('cat-0')}`),at.getTime());
 db.sql.prepare('UPDATE category_choices SET message_id=9010 WHERE prompt_id=?').run(id);
 processUpdate(db,message(902,'First activity',{reply:9010}),at.getTime()+1000);
 const before=db.read();
 const effects=processUpdate(db,message(903,'Different activity',{reply:9010,date:Math.floor((at.getTime()+2300000)/1000)}),at.getTime()+2300000);
 assert.deepEqual(db.read(),before);assert.match(effects.at(-1).body.text,/Запись не сохранена/);
 processUpdate(db,message(904,'Different activity',{reply:null,date:Math.floor((at.getTime()+2300000)/1000)}),at.getTime()+2300000);chooseManual(db,905,'-',at.getTime()+2300000);
 const rows=db.read().workspace.entries;assert.equal(rows.length,2);assert.deepEqual(rows[1].activities.map(a=>a.text),['Different activity']);assert.equal(rows[1].start,630);
});
test('unknown or expired reply cannot consume another category choice or create an entry',t=>{
 const db=fixture(t);scheduled(db);linked(db);const id=prompt(db);
 processUpdate(db,callback(910,`k:${id}:${categoryKey('cat-0')}`),at.getTime());
 db.sql.prepare('UPDATE category_choices SET message_id=9100 WHERE prompt_id=?').run(id);
 const before=db.read();processUpdate(db,message(911,'Wrong reply',{reply:9000}),at.getTime()+1000);
 assert.deepEqual(db.read(),before);assert.equal(db.sql.prepare('SELECT count(*) n FROM category_choices').get().n,1);
 const result=processUpdate(db,message(912,'Late reply',{reply:9100}),at.getTime()+1800001);
 assert.deepEqual(db.read(),before);assert.match(result.at(-1).body.text,/Запись не сохранена/);
});
test('selecting a new category retires older choices instead of reviving them after an answer',t=>{
 const db=fixture(t);scheduled(db);linked(db);const old=prompt(db),recent=prompt(db,{start:600,end:630,message_id:45});
 processUpdate(db,callback(920,`k:${old}:${categoryKey('cat-1')}`),at.getTime());
 processUpdate(db,callback(921,`k:${recent}:${categoryKey('cat-0')}`),at.getTime()+1800000);
 assert.deepEqual(db.sql.prepare('SELECT prompt_id FROM category_choices').all().map(c=>c.prompt_id),[recent]);
 processUpdate(db,message(922,'Selected work',{reply:null}),at.getTime()+1801000);
 processUpdate(db,message(923,'Current activity',{reply:null,date:Math.floor((at.getTime()+2300000)/1000)}),at.getTime()+2300000);chooseManual(db,924,'-',at.getTime()+2300000);
 const rows=db.read().workspace.entries;assert.equal(rows.length,2);assert.equal(rows[0].start,600);assert.equal(rows[0].category,'cat-0');assert.deepEqual(rows[0].activities.map(a=>a.text),['Selected work']);assert.equal(rows[1].start,630);assert.equal(rows[1].category,'');
});
test('continue repeats only the full last activity, never the combined preview, and repeated clicks do not duplicate',t=>{
 const db=fixture(t);scheduled(db);linked(db);const id=prompt(db),last='Latest activity '+ 'x'.repeat(180);
 db.mutate(w=>w.entries.push(entry({date:'2026-10-16',start:540,end:570,text:'Earlier activity · Latest activity…',activities:[{id:uid(),text:'Earlier activity',at:null},{id:uid(),text:last,at:null}]})));
 processUpdate(db,callback(930,'r:'+id),at.getTime());processUpdate(db,callback(931,'r:'+id),at.getTime()+1000);
 const rows=db.read().workspace.entries;assert.equal(rows.length,2);assert.equal(rows[0].activities.length,2);assert.deepEqual(rows[1].activities.map(a=>a.text),[last]);assert.ok(!rows[1].activities[0].text.includes('Earlier activity'));
});

test('fresh bot starts in English and bedtime can be undone once without deleting activities',t=>{
 const db=new JournalDB(':memory:');t.after(()=>db.close());linked(db);scheduled(db);
 const menu=processUpdate(db,message(40001,'/settings',{reply:null}),at.getTime());assert.match(menu.at(-1).body.text,/Bot settings/);
 const sleep=processUpdate(db,message(40002,'/sleep',{reply:null}),at.getTime());const button=sleep.find(e=>e.body?.reply_markup?.inline_keyboard).body.reply_markup.inline_keyboard[0][0];assert.ok(sleep.at(-1).body.reply_markup.inline_keyboard.flat().some(b=>b.text==='Undo bedtime'));assert.match(button.text,/Undo bedtime/);assert.equal(db.read().workspace.dayEvents.filter(e=>e.type==='sleep').length,1);
 const undo=processUpdate(db,callback(40003,button.callback_data),at.getTime()+1000);assert.match(undo.find(e=>e.method==='sendMessage').body.text,/Bedtime undone/);assert.equal(db.read().workspace.dayEvents.filter(e=>e.type==='sleep').length,0);assert.equal(db.read().workspace.pauses.filter(p=>p.type==='ended').length,0);
 assert.match(processUpdate(db,callback(40004,button.callback_data),at.getTime()+2000).at(-1).body.text,/changed/);
});

test('bedtime from an older bot can be undone by command after deployment',t=>{
 const db=new JournalDB(':memory:');t.after(()=>db.close());scheduled(db);linked(db);db.mutate(w=>w.dayEvents.push({date:'2026-10-16',type:'sleep',at:'2026-10-16T09:55:00.000Z',timezone:'UTC'}));
 const answer=processUpdate(db,message(40010,'/undo_sleep',{reply:null}),at.getTime());assert.match(answer.at(-1).body.text,/Bedtime undone/);assert.equal(db.read().workspace.dayEvents.some(e=>e.type==='sleep'),false);
});
