import test from 'node:test';
import assert from 'node:assert/strict';
import {JournalDB} from '../server/database.mjs';
import {processUpdate,TelegramBot,dueInterval} from '../server/bot.mjs';
import {nightSleepMinutes,createGuestStore} from '../domain.mjs';
import {cityWeather} from '../server/weather.mjs';
function lab(t){
 const db=new JournalDB(':memory:');t.after(()=>db.close());
 db.sql.prepare("INSERT INTO telegram VALUES(1,'1','1')").run();db.sql.prepare("INSERT INTO meta VALUES('inline_menu_v1','1')").run();
 db.mutate(w=>{w.settings={...w.settings,timezone:'UTC',start:360,end:1440,confirmed:true};});
 let id=20000;const stamp=Date.parse('2026-10-24T10:31:00Z');
 const send=text=>processUpdate(db,{update_id:id++,message:{from:{id:1},chat:{id:1,type:'private'},text,date:stamp/1000}},stamp);
 const click=data=>processUpdate(db,{update_id:id++,callback_query:{id:String(id),from:{id:1},message:{message_id:100,chat:{id:1,type:'private'}},data}},stamp);
 return {db,send,click,stamp};
}
test('7:37 is accepted and Sleep remains activity text',t=>{
 const {db,send,click}=lab(t);click('a:wake');click('w:2026-10-24:other');send('7:37');
 assert.equal(db.read().workspace.dayEvents[0].at,'2026-10-24T07:37:00.000Z');
 send('Sleep');assert.equal(db.read().workspace.dayEvents.some(e=>e.type==='sleep'),false);assert.equal(db.read().workspace.entries[0].text,'Sleep');
 send('/sleep');assert.equal(db.read().workspace.dayEvents.some(e=>e.type==='sleep'),true);
});
test('whole day off stops wake and activity questions; manual logging and tomorrow remain available',async t=>{
 const {db,send,click,stamp}=lab(t);click('a:wake');click('a:dayoff:2026-10-24');
 let sent=0;const bot=new TelegramBot(db,'synthetic',{fetchImpl:async()=>{sent++;return {json:async()=>({ok:true,result:{message_id:123}})};}});bot.ready=true;
 await bot.tick(new Date(stamp+3600000));assert.equal(sent,0);send('Manual activity on day off');assert.equal(db.read().workspace.entries.length,1);
 assert.equal(dueInterval(db.read().workspace,new Date(stamp+3600000)),null);
 await bot.tick(new Date('2026-10-25T06:01:00Z'));assert.equal(sent,1);
});
test('resume after day off allows a new morning prompt without a fake wake mark',async t=>{
 const {db,send,click,stamp}=lab(t);click('a:wake');click('a:dayoff:2026-10-24');send('/resume');
 let sent=0;const bot=new TelegramBot(db,'synthetic',{fetchImpl:async()=>{sent++;return {json:async()=>({ok:true,result:{message_id:123}})};}});bot.ready=true;
 await bot.tick(new Date(stamp+1000));assert.equal(sent,1);assert.equal(db.read().workspace.dayEvents.length,0);
});
test('night sleep uses actual elapsed time across DST, excludes missing pairs',()=>{
 const w={dayEvents:[{date:'2026-10-31',type:'sleep',at:'2026-11-01T03:00:00.000Z'},{date:'2026-11-01',type:'wake',at:'2026-11-01T12:00:00.000Z'}]};
 assert.equal(nightSleepMinutes(w,'2026-11-01'),540);assert.equal(nightSleepMinutes(w,'2026-11-02'),null);
});
test('visitor defaults to New York city and time zone',()=>{
 const w=createGuestStore({at:new Date('2026-10-24T12:00:00Z')}).workspaces.demo;
 assert.equal(w.settings.timezone,'America/New_York');assert.equal(w.settings.timezoneCity,'Нью-Йорк');
});
test('forecast accepts listed cities only, preserves local day and shares cached requests',async()=>{
 let calls=0;const fetchImpl=async url=>{calls++;const geo=url.hostname.startsWith('geocoding');return {ok:true,headers:new Headers(),text:async()=>JSON.stringify(geo?{results:[{timezone:'Europe/London',feature_code:'PPLC',latitude:51.5,longitude:-.1,population:9000000}]}:{daily:{time:['2026-10-24'],temperature_2m_min:[8],temperature_2m_max:[15],weather_code:[3]}})};};
 const args={city:'Лондон',timezone:'Europe/London',at:new Date('2026-10-24T12:00:00Z'),fetchImpl};
 const [a,b]=await Promise.all([cityWeather(args),cityWeather(args)]);assert.equal(a.min,8);assert.deepEqual(a,b);assert.equal(calls,2);
 assert.equal(await cityWeather({...args,city:'https://untrusted.invalid'}),null);assert.equal(calls,2);
});
