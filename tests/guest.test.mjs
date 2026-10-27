import test from 'node:test';
import assert from 'node:assert/strict';
import {JournalDB,passwordHash,verifyPassword} from '../server/database.mjs';
import {createAppServer} from '../server/http.mjs';
import {createGuestStore,uid,validateWorkspace,localNow,addDays} from '../domain.mjs';
const ownerPassword='synthetic-owner-password-for-tests';
const guestPassword='synthetic-guest-password-for-tests';
async function setup(t){
 const db=new JournalDB(':memory:');db.sql.prepare('INSERT INTO account VALUES(1,?)').run(passwordHash(ownerPassword));
 db.mutate(w=>{w.displayName='Private owner fixture';w.entries.push({id:uid(),date:'2026-10-01',start:0,end:30,text:'PRIVATE_OWNER_FIXTURE',category:'cat-0',project:'',source:'site'});});
 const server=createAppServer({db,bot:{ready:true,username:'synthetic_bot'}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));db.close();});
 const origin='http://127.0.0.1:'+server.address().port;
 const request=(path,{method='GET',cookie,csrf,value,headers={}}={})=>fetch(origin+'/api/'+path,{method,headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{}),...(value!==undefined?{'Content-Type':'application/json'}:{}),...headers},...(value!==undefined?{body:JSON.stringify(value)}:{})});
 async function login(guest=false,cookie){const res=await request(guest?'guest/login':'login',{method:'POST',value:{password:guest?guestPassword:ownerPassword,role:'owner'},cookie});const info=await res.json();return {...info,cookie:res.headers.get('set-cookie')?.split(';')[0],status:res.status};}
 return {db,origin,request,login};
}
test('guest login cannot expose or mutate owner data, links, settings or guest credentials',async t=>{
 const {db,request,login}=await setup(t);db.setGuestPassword(guestPassword);const before=db.read();const guest=await login(true);assert.equal(guest.status,200);assert.equal(guest.role,'guest');
 const info=await (await request('session',guest)).json();assert.equal(info.role,'guest');assert.ok(info.csrf);assert.ok(!JSON.stringify(info).includes('PRIVATE_OWNER_FIXTURE'));
 for(const [path,method,value] of [['journal','GET'],['journal','PUT',{workspace:before.workspace,revision:before.revision,requestId:uid()}],['telegram','GET'],['telegram/link','POST',{}],['telegram','DELETE'],['guest-access','GET'],['guest-access','POST',{password:'another-synthetic-guest-password'}],['guest-access','DELETE'],['journal?role=owner','GET']]){
  const res=await request(path,{...guest,method,value});assert.equal(res.status,403,path);assert.ok(!(await res.text()).includes('PRIVATE_OWNER_FIXTURE'));
 }
 assert.deepEqual(db.read(),before);assert.equal(db.link(),null);assert.equal(db.sql.prepare('SELECT count(*) n FROM sessions').get().n,0);
 assert.equal((await request('logout',{...guest,method:'POST'})).status,200);assert.equal((await request('session',guest).then(r=>r.json())).authenticated,false);
});
test('passwordless visitor receives only an isolated temporary demo session',async t=>{
 const {db,origin,request,login}=await setup(t),owner=await login();
 const open=await request('guest/preview',{method:'POST',cookie:owner.cookie});assert.equal(open.status,200);
 const guest={...(await open.json()),cookie:open.headers.get('set-cookie')?.split(';')[0]};
 assert.equal(guest.role,'guest');assert.equal((await request('session',guest).then(r=>r.json())).role,'guest');
 assert.equal((await request('session',owner).then(r=>r.json())).authenticated,false);
 for(const path of ['journal','telegram','guest-access'])assert.equal((await request(path,guest)).status,403);
 assert.equal((await request('guest/preview',{method:'POST',headers:{Origin:'https://other.example'}})).status,403);
 assert.ok(!JSON.stringify(await request('session',guest).then(r=>r.json())).includes('PRIVATE_OWNER_FIXTURE'));
 assert.equal(db.read().workspace.entries[0].text,'PRIVATE_OWNER_FIXTURE');
});
test('only owner may set/rotate/disable password; hash is private, old guests revoked, owner preserved',async t=>{
 const {db,request,login}=await setup(t);const owner=await login();assert.equal((await request('guest-access',{method:'POST',value:{password:guestPassword}})).status,401);
 assert.equal((await request('guest-access',{...owner,csrf:'wrong',method:'POST',value:{password:guestPassword}})).status,403);
 assert.equal((await request('guest-access',{...owner,method:'POST',value:{password:ownerPassword}})).status,400);
 assert.equal((await request('guest-access',{...owner,method:'POST',value:{password:guestPassword}})).status,200);
 const encoded=db.sql.prepare('SELECT password FROM guest_access').get().password;assert.notEqual(encoded,guestPassword);assert.ok(verifyPassword(guestPassword,encoded));assert.deepEqual(await request('guest-access',owner).then(r=>r.json()),{enabled:true});
 const guest=await login(true);db.setGuestPassword('synthetic-rotated-guest-password');assert.equal((await request('session',guest).then(r=>r.json())).authenticated,false);assert.equal((await request('journal',owner)).status,200);
 assert.equal((await request('guest-access',{...owner,method:'DELETE'})).status,200);assert.equal(db.guestEnabled(),false);assert.equal((await login(true)).status,401);assert.equal((await request('journal',owner)).status,200);
});
test('guest login rotates owner cookie without elevating guest and guest rate limits do not lock owner out',async t=>{
 const {db,request,login}=await setup(t);db.setGuestPassword(guestPassword);const owner=await login();const guest=await login(true,owner.cookie);
 assert.equal((await request('session',owner).then(r=>r.json())).authenticated,false);assert.equal((await request('journal',guest)).status,403);
 for(let i=0;i<5;i++)assert.equal((await request('guest/login',{method:'POST',value:{password:'wrong'}})).status,401);
 assert.equal((await request('guest/login',{method:'POST',value:{password:guestPassword}})).status,429);assert.equal((await login()).status,200);
});
test('guest cookies expire and cannot log in through owner endpoint; private files stay inaccessible',async t=>{
 const {db,request,login,origin}=await setup(t);db.setGuestPassword(guestPassword);const guest=await login(true);
 assert.equal((await request('login',{method:'POST',value:{password:guestPassword}})).status,401);
 assert.equal((await request('guest/login',{method:'POST',headers:{Origin:'https://foreign.example'},value:{password:guestPassword}})).status,403);
 for(const file of ['.env','server/database.mjs','data/rhythm.sqlite'])assert.equal((await fetch(origin+'/'+file,{headers:{Cookie:guest.cookie}})).status,404);
 db.sql.prepare('UPDATE guest_sessions SET expires=0').run();assert.equal((await request('session',guest).then(r=>r.json())).authenticated,false);assert.equal((await request('journal',guest)).status,401);
});
test('every guest demo starts fresh and contains no personal workspace or previous test edits',()=>{
 const first=createGuestStore();assert.equal(first.mode,'demo');assert.equal(first.workspaces.user.entries.length,0);first.workspaces.demo.entries[0].text='TEMPORARY_EDIT';first.workspaces.demo.categories[0].name='TEMPORARY_CATEGORY';
 const second=createGuestStore();assert.ok(!JSON.stringify(second).includes('TEMPORARY_EDIT'));assert.ok(!JSON.stringify(second).includes('TEMPORARY_CATEGORY'));assert.equal(second.workspaces.demo.displayName,'Посетитель');assert.ok(second.workspaces.demo.categories.some(c=>c.productive));
});
test('visitor demo has plausible wake and bedtime marks, missed marks and no future events',()=>{
 const at=new Date('2026-10-21T12:00:00Z'),w=createGuestStore({at,timezone:'UTC'}).workspaces.demo;
 assert.equal(validateWorkspace(w),true);
 const dates=new Set(w.dayEvents.map(e=>e.date));
 assert.ok(dates.size>100);
 assert.ok([...dates].some(date=>!w.dayEvents.some(e=>e.date===date&&e.type==='wake')));
 assert.ok([...dates].some(date=>!w.dayEvents.some(e=>e.date===date&&e.type==='sleep')));
 assert.ok(w.dayEvents.some(e=>e.type==='sleep'&&localNow(e.timezone,new Date(e.at)).date===addDays(e.date,1)));
 assert.ok(w.dayEvents.some(e=>e.type==='wake'&&localNow(e.timezone,new Date(e.at)).minute>=600));
 assert.ok(w.dayEvents.every(e=>new Date(e.at)<=at));
 assert.ok(w.entries.every(e=>e.date<='2026-10-21'));
});
test('visitor sees examples today and across all twelve rolling months in their time zone',()=>{
 for(const [timezone,at] of [
  ['Asia/Almaty','2026-10-23T01:15:00Z'],
  ['Asia/Almaty','2026-10-22T19:05:00Z'],
  ['America/Los_Angeles','2026-10-23T19:40:00Z'],
  ['Europe/London','2026-11-01T00:03:00Z']
 ]){
  const w=createGuestStore({at:new Date(at),timezone}).workspaces.demo;
  const today=localNow(timezone,new Date(at));
  const entries=w.entries.filter(e=>e.date===today.date);
  assert.ok(entries.length>0,`${timezone}: today is empty`);
  assert.ok(entries.some(e=>e.start<=today.minute&&e.end>today.minute),`${timezone}: current interval is empty`);
  assert.ok(w.entries.every(e=>e.date<=today.date),`${timezone}: future date present`);
  assert.equal(new Set(w.entries.map(e=>e.date.slice(0,7))).size,12,`${timezone}: missing demo month`);
  assert.equal(validateWorkspace(w),true);
 }
});
