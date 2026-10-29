import test from 'node:test';
import assert from 'node:assert/strict';
import {TIMEZONES,DEFAULT_TIMEZONE,timezoneLabel,emptyWorkspace,ensureDay,summary,slots,nextGap,nextPrompt,validateEntries,validateWorkspace,validateSettings,validateEntryMoment,currentInterval,localNow,csvRows,mergedRanges,subtractRanges} from '../domain.mjs';
const date='2026-10-16',now={date,minute:720};
function fixture(){const w=emptyWorkspace();w.settings.start=540;w.settings.end=1020;ensureDay(w,date);return w;}
const entry=(id,start,end,extra={})=>({id,date,start,end,text:'Занятие',category:'cat-0',project:'',source:'site',...extra});
test('new entry interval follows configured local clock and step, regardless of old gaps',()=>{
 const w=emptyWorkspace();w.settings.timezone='Asia/Almaty';w.settings.start=0;
 const at=new Date('2026-10-17T07:20:00Z');
 assert.deepEqual(currentInterval(w,at),{date:'2026-10-17',start:720,end:750,timezone:'Asia/Almaty'});
 assert.equal(validateEntryMoment({...entry('current',720,750),date:'2026-10-17'},w,at),true);
 w.settings.step=15;assert.equal(currentInterval(w,at).start,735);assert.equal(currentInterval(w,at).end,750);
 w.settings.step=60;assert.equal(currentInterval(w,at).start,720);assert.equal(currentInterval(w,at).end,780);
 assert.equal(currentInterval(w,new Date('2026-10-17T19:05:00Z')).date,'2026-10-18');
 assert.equal(currentInterval(w,new Date('2026-10-17T18:59:00Z')).end,1440);
});
test('future hours do not count as gaps; categories and coverage have distinct denominators',()=>{const w=fixture();w.entries=[entry('a',540,600),entry('b',600,630,{category:'cat-2'})];const s=summary(w,[date],now);assert.equal(s.expected,180);assert.equal(s.tracked,90);assert.equal(s.coverage,50);assert.equal(s.missing,90);assert.equal(s.categories['cat-0'],60);assert.equal(s.categories['cat-2'],30);});
test('overlapping entries are rejected; touching entries are valid',()=>{const w=fixture();assert.throws(()=>validateEntries([entry('a',540,600),entry('b',570,630)],w.categories,w.projects),/пересекается/);assert.equal(validateEntries([entry('a',540,600),entry('b',600,630)],w.categories,w.projects),true);});
test('overlapping pauses are merged; paused and outside time do not inflate coverage',()=>{const w=fixture();w.pauses=[{date,start:600,end:650},{date,start:630,end:660}];w.entries=[entry('a',540,600),entry('b',600,630)];const s=summary(w,[date],now);assert.equal(s.expected,120);assert.equal(s.paused,60);assert.equal(s.within,60);assert.equal(s.outside,30);assert.equal(s.missing,60);assert.equal(s.coverage,50);});
test('split entries leave only the remaining gap and retain exact minutes',()=>{const w=fixture();w.entries=[entry('a',540,560),entry('b',560,565)];assert.deepEqual(nextGap(w,date,now),{start:565,end:570,date,status:'missing'});assert.equal(summary(w,[date],now).tracked,25);});
test('an unanswered interval is never filled by a preceding entry',()=>{const w=fixture();w.entries=[entry('a',540,570)];assert.equal(nextGap(w,date,now).start,570);assert.equal(summary(w,[date],now).tracked,30);});
test('past day uses full schedule; future day has no expected time',()=>{const w=fixture();assert.equal(summary(w,[date],{date:'2026-10-17',minute:10}).expected,480);assert.equal(summary(w,[date],{date:'2026-10-15',minute:1000}).expected,0);});
test('recorded schedule remains stable when future settings change',()=>{const w=fixture();w.settings.end=1320;assert.equal(summary(w,[date],{date:'2026-10-17',minute:10}).expected,480);});
test('a partial final interval preserves actual duration',()=>{const w=fixture();w.snapshots[date].end=625;const result=slots(w,date,now);assert.equal(result.at(-1).start,600);assert.equal(result.at(-1).end,625);});
test('off schedule entries remain visible without increasing expected time',()=>{const w=fixture();w.snapshots[date].days=[];w.entries=[entry('a',540,600)];const s=summary(w,[date],now);assert.equal(s.expected,0);assert.equal(s.coverage,0);assert.equal(s.tracked,60);assert.equal(s.outside,60);});
test('input validation rejects malformed imports, dangerous identifiers and unknown references',()=>{const w=fixture();w.entries=[entry('a',540,570)];assert.equal(validateWorkspace(w),true);assert.throws(()=>validateWorkspace({...w,entries:[entry('a',540,570,{category:'unknown'})]}),/Категория/);assert.throws(()=>validateWorkspace({...w,entries:[entry('x" onclick="x',540,570)]}),/идентификатор/);assert.throws(()=>validateEntries([entry('a',600,590)],w.categories,w.projects),/время/);assert.throws(()=>validateSettings({...w.settings,start:1320,end:540}),/Ночные/);});
test('csv escapes user input, quotes and spreadsheet formula prefixes',()=>{const w=fixture();const csv=csvRows([entry('a',540,570,{text:'=HYPERLINK("x")'})],w);assert.ok(csv.startsWith('\ufeff'));assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));});
test('timezone conversion uses Almaty time without changing the host clock',()=>{assert.deepEqual(localNow('Asia/Almaty',new Date('2026-10-16T11:30:00Z')),{date,minute:990});});
test('range subtraction handles two cuts and adjacent boundaries',()=>{assert.deepEqual(subtractRanges([{start:0,end:100}],[{start:20,end:40},{start:60,end:80}]),[{start:0,end:20},{start:40,end:60},{start:80,end:100}]);assert.deepEqual(mergedRanges([{start:10,end:20},{start:20,end:30}]),[{start:10,end:30}]);});
test('off-schedule entries still appear in the timeline',()=>{const w=fixture();w.snapshots[date].days=[0];w.entries=[entry('a',540,600)];assert.equal(slots(w,date,now)[0].text,'Занятие');});
test('JSON round trip preserves entries, archives, history and exact statistics',()=>{const w=fixture();w.entries=[entry('a',540,570)];w.categories[0].archived=true;w.pauses=[{date,start:600,end:630,type:'pause'}];const copy=JSON.parse(JSON.stringify(w));assert.equal(validateWorkspace(copy),true);assert.deepEqual(summary(copy,[date],now),summary(w,[date],now));assert.equal(copy.categories[0].archived,true);});
test('next prompt retains the true start of a shortened final interval',()=>{const w=fixture();w.snapshots[date].end=625;assert.deepEqual(nextPrompt(w,{date,minute:615}),{start:600,end:625});});
test('timezone picker includes Astana and Almaty among a broad city catalog',()=>{assert.ok(TIMEZONES.length>=150);assert.equal(new Set(TIMEZONES.map(z=>z.id+'|'+z.city)).size,TIMEZONES.length);assert.ok(TIMEZONES.every(z=>z.id!=='UTC'));assert.equal(TIMEZONES.find(z=>z.city==='Астана')?.id,'Asia/Almaty');assert.equal(TIMEZONES.find(z=>z.city==='Алматы')?.id,'Asia/Almaty');assert.equal(timezoneLabel(TIMEZONES.find(z=>z.city==='Астана'),new Date('2026-10-17T00:00:00Z')),'Астана · UTC+05:00');assert.equal(emptyWorkspace().settings.timezone,DEFAULT_TIMEZONE);for(const z of TIMEZONES)assert.ok(timezoneLabel(z).startsWith(z.city+' · UTC'));});
test('city labels use daylight saving rules and half-hour offsets from Intl',()=>{const london=TIMEZONES.find(z=>z.id==='Europe/London'),delhi=TIMEZONES.find(z=>z.city==='Нью-Дели');assert.equal(timezoneLabel(london,new Date('2026-07-01T12:00:00Z')),'Лондон · UTC+01:00');assert.equal(timezoneLabel(london,new Date('2026-12-01T12:00:00Z')),'Лондон · UTC+00:00');assert.equal(timezoneLabel(delhi,new Date('2026-07-01T12:00:00Z')),'Нью-Дели · UTC+05:30');});
test('old timezones remain loadable so removing them from the picker does not erase a journal',()=>{const w=fixture();w.settings.timezone='Asia/Almaty';w.snapshots[date].timezone='UTC';w.entries=[entry('a',540,600)];assert.equal(validateWorkspace(w),true);assert.equal(w.settings.timezone,'Asia/Almaty');assert.equal(w.entries[0].start,540);});
test('changing the current timezone does not reinterpret a stored day schedule',()=>{const w=fixture(),today=localNow('Europe/London').date;ensureDay(w,today);const before=summary(w,[today]);w.settings.timezone='Asia/Tokyo';const after=summary(w,[today]);assert.deepEqual(after,before);});
test('site accepts the current Astana interval before it ends but rejects future periods',()=>{
 const w=emptyWorkspace();w.settings.timezone='Asia/Almaty';const at=new Date('2026-10-17T07:15:00Z'),current=entry('current',720,750,{date:'2026-10-17'});
 assert.equal(validateEntryMoment(current,w,at),true);
 assert.equal(validateEntryMoment({...current,end:735},w,at),true);
 assert.equal(validateEntryMoment({...current,start:735},w,at),true);
 assert.throws(()=>validateEntryMoment({...current,start:750,end:780},w,at),/Будущий/);
 assert.throws(()=>validateEntryMoment({...current,start:740,end:745},w,at),/Будущий/);
 assert.throws(()=>validateEntryMoment({...current,end:780},w,at),/Будущий/);
 assert.throws(()=>validateEntryMoment({...current,date:'2026-10-18'},w,at),/Будущий/);
 assert.equal(validateEntryMoment({...current,date:'2026-10-16'},w,at),true);
});
test('each split part is checked and current interval follows the saved step and midnight',()=>{
 const w=emptyWorkspace();w.settings.timezone='Asia/Almaty';const at=new Date('2026-10-17T07:15:00Z');
 const parts=[entry('first',720,730,{date:'2026-10-17'}),entry('second',730,750,{date:'2026-10-17'})];for(const part of parts)assert.equal(validateEntryMoment(part,w,at),true);
 assert.throws(()=>validateEntryMoment({...parts[1],start:740},w,at),/Будущий/);
 w.settings.step=60;assert.equal(validateEntryMoment({...parts[0],end:780},w,at),true);
 assert.equal(validateEntryMoment(entry('last',1410,1440,{date:'2026-10-17'}),w,new Date('2026-10-17T18:59:00Z')),true);
 assert.throws(()=>validateEntryMoment(entry('next',0,30,{date:'2026-10-18'}),w,new Date('2026-10-17T18:59:00Z')),/Будущий/);
});

test('coverage excludes time before waking and after bedtime, retaining real evening gaps',()=>{
 const w=emptyWorkspace(),day='2026-10-28';
 w.settings={...w.settings,timezone:'UTC',start:0,end:1440,step:30};ensureDay(w,day);
 w.dayEvents=[{date:day,type:'wake',at:day+'T08:56:00Z',timezone:'UTC'},{date:day,type:'sleep',at:day+'T23:36:00Z',timezone:'UTC'}];
 w.entries=[{...entry('awake',536,1376),date:day}];
 const stats=summary(w,[day],{date:day,minute:1440});
 assert.equal(stats.expected,880);assert.equal(stats.within,840);assert.equal(stats.missing,40);assert.equal(stats.coverage,95);
 assert.deepEqual(slots(w,day,{date:day,minute:1440}).filter(s=>s.status==='missing').map(s=>[s.start,s.end]),[[1376,1406],[1406,1416]]);
});
test('waking boundaries retain historical schedules, explicit pauses and off-window entries',()=>{
 const w=fixture();w.dayEvents=[{date,type:'wake',at:date+'T10:00:00Z',timezone:'UTC'},{date,type:'sleep',at:date+'T11:30:00Z',timezone:'UTC'}];
 w.snapshots[date].timezone='UTC';w.pauses=[{date,start:630,end:660,type:'pause'}];
 w.entries=[entry('outside',540,570),entry('inside',600,630)];
 const stats=summary(w,[date],{date,minute:720});
 assert.equal(stats.expected,60);assert.equal(stats.paused,30);assert.equal(stats.within,30);assert.equal(stats.outside,30);assert.equal(stats.coverage,50);
});
