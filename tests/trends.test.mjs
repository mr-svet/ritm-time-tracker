import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace,trendRows,activityMatrix,searchTimezones,validateWorkspace,normalizeWorkspace,uid,TIMEZONES} from '../domain.mjs';
const at=new Date('2026-10-19T12:00:00Z');
function fixture(){const w=emptyWorkspace();w.settings={timezone:'UTC',start:0,end:1440,step:30,days:[0,1,2,3,4,5,6],confirmed:true};return w;}
function add(w,date,start,end,category){w.entries.push({id:uid(),date,start,end,category,text:'Пример',source:'site',project:''});}
test('monthly productivity is weighted by minutes and empty/no-goal periods stay undefined',()=>{
 const w=fixture();add(w,'2026-10-01',0,30,'cat-0');add(w,'2026-10-02',0,120,'cat-1');
 assert.equal(trendRows(w,{from:'2026-10-01',to:'2026-10-02',at})[0].score,null);
 w.categories[0].productive=true;const rows=trendRows(w,{from:'2026-10-01',to:'2026-10-03',at});assert.deepEqual(rows.map(r=>r.score),[100,0,null]);
 const monthly=trendRows(w,{from:'2026-10-01',to:'2026-10-03',group:'month',at})[0];assert.equal(monthly.score,20);assert.equal(monthly.tracked,150);assert.equal(monthly.target,30);assert.equal(monthly.count,2);
 w.categories[0].archived=true;assert.equal(trendRows(w,{from:'2026-10-01',to:'2026-10-03',group:'month',at})[0].score,20);
 assert.throws(()=>trendRows(w,{from:'2024-01-01',to:'2026-01-01',at}),/366/);assert.throws(()=>trendRows(w,{from:'2026-02-30',to:'2026-03-01',at}));
});
test('goals and city choice round-trip without moving historical snapshots',()=>{
 const w=fixture();w.categories[0].productive=true;w.settings.timezoneCity='Астана';w.settings.timezone='Asia/Almaty';w.snapshots['2026-10-01']={timezone:'UTC',start:0,end:1440,step:30,days:[0,1,2,3,4,5,6],confirmed:true};const result=normalizeWorkspace(w);assert.equal(result.categories[0].productive,true);assert.equal(result.snapshots['2026-10-01'].timezone,'UTC');w.categories[0].productive='yes';assert.throws(()=>validateWorkspace(w));
});
test('cities support Russian, English, IANA search and valid runtime zones',()=>{
 assert.ok(searchTimezones('Астана').some(z=>z.id==='Asia/Almaty'));assert.ok(searchTimezones('London').some(z=>z.city==='Лондон'));assert.ok(searchTimezones('Europe/Paris').some(z=>z.city==='Париж'));
 for(const zone of TIMEZONES)assert.doesNotThrow(()=>new Intl.DateTimeFormat('ru',{timeZone:zone.id}).format(at));
});
test('time map preserves interval details and configurable weights recalculate history',()=>{
 const w=fixture();add(w,'2026-10-01',720,750,'cat-0');add(w,'2026-10-01',750,780,'cat-0');add(w,'2026-10-02',780,810,'cat-1');
 w.categories[0].weight=50;w.categories[1].weight=100;
 const matrix=activityMatrix(w,{from:'2026-10-01',to:'2026-10-02'});
 assert.equal(activityMatrix(w,{from:'2026-09-21',to:'2026-10-21'}).dates.length,31);
 assert.deepEqual(matrix.cells.get('cat-0|2026-10-01').map(e=>[e.start,e.end]),[[720,750],[750,780]]);
 assert.equal(trendRows(w,{from:'2026-10-01',to:'2026-10-02',group:'month',at})[0].score,67);
 w.productivity={basis:'scheduled'};assert.equal(trendRows(w,{from:'2026-10-01',to:'2026-10-02',group:'month',at})[0].score,2);
 assert.equal(normalizeWorkspace(w).productivity.basis,'scheduled');w.categories[0].weight=101;assert.throws(()=>validateWorkspace(w),/Вес категории/);
});
