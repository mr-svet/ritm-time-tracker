import test from 'node:test';
import assert from 'node:assert/strict';
import {t,tr,setLanguage,getLanguage,formatDate,formatDuration,cityName} from '../i18n.mjs';
import {createGuestStore,validateWorkspace,localNow,TIMEZONES,currentInterval,csvRows} from '../domain.mjs';

test('English defaults, with natural Russian labels and locale formatting',()=>{
 assert.equal(getLanguage(),'en');setLanguage('en');assert.equal(t('Соединение установлено'),'Connected successfully');assert.equal(t('Чем вы занимались?'),'What have you been up to?');
 assert.equal(formatDuration(91),'1 hr 31 min');assert.equal(formatDate('2026-10-20'),'20 October');
 setLanguage('ru');assert.equal(t('Сохранить запись'),'Сохранить запись');assert.equal(formatDuration(91),'1 ч 31 мин');assert.equal(formatDate('2026-10-20'),'20 октября');
 assert.throws(()=>setLanguage('fr'));assert.equal(getLanguage(),'ru');
});
test('translation of authored template fragments never scans interpolated journal text',()=>{
 setLanguage('en');const privateText='Работа: <img src=x onerror=alert(1)> Сохранить запись';
 assert.equal(tr`<p>Занятие: ${privateText}</p>`,`<p>Activity: ${privateText}</p>`);
 assert.equal(t('<button title="Изменить запись">Сохранить</button>'),'<button title="Edit entry">Save</button>');
 assert.equal(t('Паузы ('),'Breaks (');setLanguage('ru');
});
test('every city has an English display name and a stable Russian identity',()=>{
 for(const zone of TIMEZONES){assert.ok(cityName(zone,'en'));assert.ok(!/[А-Яа-яЁё]/u.test(cityName(zone,'en')),zone.city);assert.equal(cityName(zone,'ru'),zone.city);}
 assert.equal(cityName(TIMEZONES.find(z=>z.city==='Нью-Йорк'),'en'),'New York');assert.equal(cityName(TIMEZONES[0],'en'),'Astana');
});
test('fresh guest journal fills twelve rolling months and keeps the current day within its interval',()=>{
 for(const iso of ['2026-10-20T00:01:00Z','2026-10-20T05:20:00Z','2026-10-20T23:59:00Z'])for(const timezone of ['Europe/London','Asia/Almaty']){
  const at=new Date(iso),store=createGuestStore({at,timezone}),w=store.workspaces.demo;validateWorkspace(w);
  const local=localNow(timezone,at),current=currentInterval(w,at),today=w.entries.filter(e=>e.date===local.date);
  assert.ok(w.entries.length>1000&&w.entries.length<5000);
  assert.ok(Object.keys(w.snapshots).some(date=>!w.entries.some(e=>e.date===date)));
  assert.equal(new Set(w.entries.map(e=>e.date.slice(0,7))).size,12);
  assert.ok(w.entries.some(e=>e.date.startsWith(local.date.slice(0,7))&&e.date<local.date));
  assert.ok(w.entries.every(e=>e.date<=local.date));
  assert.equal(store.workspaces.user.entries.length,0);
  assert.ok(w.categories.length>=8);assert.ok(w.projects.length>=3);assert.ok(w.entries.some(e=>e.activities?.length>1));
  assert.ok(today.length>0);
  assert.ok(today.every(e=>e.start<=local.minute&&e.end<=current.end));
  assert.ok(today.some(e=>e.start===current.start&&e.end===current.end));
 }
});
test('projects can be hidden without losing existing project associations',()=>{
 const w=createGuestStore().workspaces.demo;
 const existing=w.entries.find(e=>e.project);
 w.projectsEnabled=false;
 assert.equal(validateWorkspace(w),true);
 assert.ok(w.projects.some(p=>p.id===existing.project));
 assert.equal(w.entries.find(e=>e.id===existing.id).project,existing.project);
 w.projectsEnabled='off';assert.throws(()=>validateWorkspace(w),/проектов/);
});
test('CSV headers follow UI language while all authored journal text is preserved',()=>{
 const w=createGuestStore().workspaces.demo;w.entries[0].text='Личная запись';if(w.entries[0].activities)w.entries[0].activities[0].text='Личная запись';
 const csv=csvRows([w.entries[0]],w,'en');assert.ok(csv.includes('"Date";"Start";"End"'));assert.ok(csv.includes('Личная запись'));assert.ok(csv.includes(w.categories.find(c=>c.id===w.entries[0].category)?.name||'Личная запись'));
 assert.ok(csvRows([w.entries[0]],w).includes('"Дата"'));
});
