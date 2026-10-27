import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {JournalDB,passwordHash} from '../server/database.mjs';
import {createAppServer} from '../server/http.mjs';
import {validateTelegramInitData} from '../server/telegram-auth.mjs';
import {TelegramBot} from '../server/bot.mjs';
import {inject} from './inject-http.mjs';
import {uid} from '../domain.mjs';

const token='123456:synthetic-test-token-never-used-for-network';
function signed({id=111,date=Math.floor(Date.now()/1000),extra={}}={}){
 const p=new URLSearchParams({auth_date:String(date),user:JSON.stringify({id,first_name:'Test'}),...extra});
 const check=[...p].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>`${k}=${v}`).join('\n');
 const key=createHmac('sha256','WebAppData').update(token).digest();
 p.set('hash',createHmac('sha256',key).update(check).digest('hex'));return p.toString();
}
async function fixture(t){
 const db=new JournalDB(':memory:');db.sql.prepare('INSERT INTO account VALUES(1,?)').run(passwordHash('synthetic-password-for-testing'));
 db.bind(db.makeLink(),111,111);
 const server=createAppServer({db,telegramToken:token,publicOrigin:'https://ritm.test'});
 t.after(()=>db.close());
 const url='https://ritm.test';
 const request=(path,{body,headers={},...options}={})=>inject(server,url+path,{...options,headers:{Origin:url,'Content-Type':'application/json','X-Ritm-Client':'miniapp',...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 const login=async(initData=signed())=>request('/api/auth/telegram',{method:'POST',body:{initData}});
 return {db,server,url,request,login};
}
test('Telegram signature, freshness, duplicate fields and user identity',()=>{
 const now=Date.now();assert.equal(validateTelegramInitData(signed(),token,now).userId,'111');
 for(const bad of ['',signed().replace('Test','Fake'),signed({date:Math.floor(now/1000)-301}),signed({date:Math.floor(now/1000)+31}),signed()+'&user=x',signed({id:-1}),signed({id:'111'})])assert.throws(()=>validateTelegramInitData(bad,token,now));
 assert.throws(()=>validateTelegramInitData(signed(),token+'wrong',now));
 assert.equal(validateTelegramInitData(signed({extra:{signature:'future-field'}}),token,now).userId,'111');
});
test('Mini App authorizes only linked users and requires same-origin login',async t=>{
 const {request,login}=await fixture(t);
 assert.equal((await request('/api/journal')).status,401);
 assert.equal((await login(signed({id:222}))).status,403);
 assert.equal((await login('invalid')).status,401);
 assert.equal((await request('/api/auth/telegram',{method:'POST',body:{initData:signed()},headers:{Origin:'https://evil.example'}})).status,403);
 assert.equal((await request('/api/auth/telegram',{method:'POST',body:{initData:signed()},headers:{'X-Ritm-Client':'website'}})).status,403);
 assert.equal((await request('/api/auth/telegram',{method:'POST',body:null})).status,400);
 assert.equal((await request('/api/auth/telegram',{method:'POST',body:{initData:'x'.repeat(20001)}})).status,413);
});
test('Independent sessions, CSRF, shared journal, version conflicts and idempotent retries',async t=>{
 const {request,login,db}=await fixture(t),response=await login();assert.equal(response.status,200);
 const cookie=response.headers.get('set-cookie').split(';')[0],{csrf}=await response.json();
 assert.match(cookie,/^__Host-ritm_miniapp=/);assert.match(response.headers.get('set-cookie'),/HttpOnly/);
 const headers={Cookie:cookie,'X-CSRF-Token':csrf};
 assert.equal((await request('/api/journal',{headers:{Cookie:cookie,'X-Ritm-Client':'website'}})).status,401);
 const current=await (await request('/api/journal',{headers})).json();assert.equal(current.revision,db.read().revision);
 current.workspace.displayName='Mini App test';
 const change={...current,requestId:uid()};
 assert.equal((await request('/api/journal',{method:'PUT',headers:{...headers,'X-CSRF-Token':'wrong'},body:change})).status,403);
 assert.equal((await request('/api/journal',{method:'PUT',headers,body:change})).status,200);
 assert.equal(db.read().workspace.displayName,'Mini App test');
 assert.equal((await request('/api/journal',{method:'PUT',headers,body:change})).status,200);
 assert.equal((await request('/api/journal',{method:'PUT',headers,body:{...change,requestId:uid()}})).status,409);
 assert.equal((await request('/api/guest-access',{method:'POST',headers,body:{password:'new-password-for-guests'}})).status,403);
 assert.equal((await request('/api/logout',{method:'POST',headers})).status,200);
 assert.equal((await request('/api/journal',{headers})).status,401);
});
test('Unlinking revokes sessions, including after relinking the same user',async t=>{
 const {request,login,db}=await fixture(t),r=await login(),headers={Cookie:r.headers.get('set-cookie').split(';')[0]};
 db.unlink();assert.equal((await request('/api/journal',{headers})).status,401);
 db.bind(db.makeLink(),111,111);assert.equal((await request('/api/journal',{headers})).status,401);
});
test('Browser session remains valid after Mini App login; expired sessions are rejected',async t=>{
 const {request,login,db}=await fixture(t);
 const browser=await request('/api/login',{method:'POST',headers:{'X-Ritm-Client':'website'},body:{password:'synthetic-password-for-testing'}});
 const browserCookie=browser.headers.get('set-cookie').split(';')[0];
 const mini=await login(),miniCookie=mini.headers.get('set-cookie').split(';')[0];
 assert.match(mini.headers.get('set-cookie'),/SameSite=None/);assert.match(mini.headers.get('set-cookie'),/; Secure/);
 assert.equal((await request('/api/journal',{headers:{Cookie:browserCookie,'X-Ritm-Client':'website'}})).status,200);
 db.sql.prepare('UPDATE miniapp_sessions SET expires=?').run(Date.now()-1);
 assert.equal((await request('/api/journal',{headers:{Cookie:miniCookie}})).status,401);
 assert.equal((await request('/api/journal',{headers:{Cookie:browserCookie,'X-Ritm-Client':'website'}})).status,200);
});
test('Disabling the feature rejects an already-issued Mini App session',async t=>{
 const {login,db}=await fixture(t),r=await login(),cookie=r.headers.get('set-cookie').split(';')[0];
 const disabled=createAppServer({db,publicOrigin:'https://ritm.test'});
 const result=await inject(disabled,'https://ritm.test/api/journal',{headers:{Cookie:cookie,'X-Ritm-Client':'miniapp'}});
 assert.equal(result.status,401);
});
test('Bot adds the app menu to the existing private chat without sending messages',async t=>{
 const {db}=await fixture(t),calls=[];
 const fetchImpl=async(url,options)=>{const method=url.split('/').at(-1);calls.push({method,body:JSON.parse(options.body)});return {json:async()=>({ok:true,result:method==='getMe'?{username:'synthetic_bot'}:method==='getWebhookInfo'?{url:''}:true})};};
 const bot=new TelegramBot(db,token,{miniAppURL:'https://ritm.test/tg',fetchImpl});
 await bot.initialize();assert.equal(bot.ready,true);assert.equal(bot.miniAppError,'');
 const menu=calls.find(c=>c.method==='setChatMenuButton');assert.equal(menu.body.chat_id,'111');assert.equal(menu.body.menu_button.web_app.url,'https://ritm.test/tg');
 assert.equal(calls.some(c=>c.method==='sendMessage'),false);
 const broken=new TelegramBot(db,token,{miniAppURL:'http://ritm.test/tg',fetchImpl});await broken.initialize();assert.equal(broken.ready,true);assert.ok(broken.miniAppError);
});
test('Telegram framing and SDK are limited to public /tg shell',async t=>{
 const {url,server,request}=await fixture(t),r=await inject(server,url+'/tg',{headers:{'Sec-Fetch-Site':'cross-site','Sec-Fetch-Mode':'navigate','Sec-Fetch-Dest':'iframe'}});
 assert.equal(r.status,200);assert.equal(r.headers.get('x-frame-options'),null);
 assert.match(r.headers.get('content-security-policy'),/frame-ancestors https:\/\/web.telegram.org/);
 const html=await r.text();assert.match(html,/data-miniapp="true"/);assert.match(html,/telegram-web-app.js/);assert.match(html,/src="\/telegram.mjs"/);assert.doesNotMatch(html,/synthetic-password/);
 const site=await inject(server,url+'/');assert.equal(site.headers.get('x-frame-options'),'DENY');assert.doesNotMatch(await site.text(),/telegram-web-app.js/);
 assert.equal((await request('/api/journal',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
});

test('Menu can be configured after linking without restarting reminders',async t=>{
 const {db}=await fixture(t);db.unlink();const calls=[];
 const fetchImpl=async(url,options)=>{calls.push({method:url.split('/').at(-1),body:JSON.parse(options.body)});return {json:async()=>({ok:true,result:true})};};
 const bot=new TelegramBot(db,token,{miniAppURL:'https://ritm.test/tg',fetchImpl});
 await bot.syncMiniAppMenu();assert.equal(calls.length,0);
 db.bind(db.makeLink(),111,111);await bot.syncMiniAppMenu();await bot.syncMiniAppMenu();
 assert.equal(calls.length,1);assert.equal(calls[0].method,'setChatMenuButton');
 db.unlink();await bot.syncMiniAppMenu();db.bind(db.makeLink(),111,111);await bot.syncMiniAppMenu();
 assert.equal(calls.length,2);
});
test('Menu failure remains separate from reminder readiness and retries after cooldown',async t=>{
 const {db}=await fixture(t);let attempts=0;
 const bot=new TelegramBot(db,token,{miniAppURL:'https://ritm.test/tg',fetchImpl:async()=>{attempts++;throw new Error('test transport unavailable');}});
 bot.ready=true;await bot.syncMiniAppMenu(1000);await bot.syncMiniAppMenu(2000);
 assert.equal(attempts,1);assert.equal(bot.ready,true);assert.ok(bot.miniAppError);
 await bot.syncMiniAppMenu(62000);assert.equal(attempts,2);
});

test('Lab prefix keeps shell, assets and API inside its separate server',async t=>{
 const {db}=await fixture(t),server=createAppServer({db,publicOrigin:'https://ritm.test',telegramToken:token,basePath:'/miniapp-test'});
 const shell=await inject(server,'https://ritm.test/miniapp-test/tg');assert.equal(shell.status,200);
 const html=await shell.text();assert.match(html,/data-base-path="\/miniapp-test"/);assert.match(html,/src="\/miniapp-test\/telegram.mjs"/);assert.match(html,/href="\/miniapp-test\/mobile.css"/);
 assert.equal((await inject(server,'https://ritm.test/miniapp-test/telegram.mjs')).status,200);
 assert.equal((await inject(server,'https://ritm.test/miniapp-test/api/health')).status,200);
 assert.equal((await inject(server,'https://ritm.test/api/health')).status,404);
 assert.equal((await inject(server,'https://ritm.test/miniapp-testing/api/health')).status,404);
});
