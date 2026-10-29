import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace,ensureDay,journalTimeline} from '../domain.mjs';

const date='2026-10-28',at=new Date('2026-10-28T12:10:00Z');
function fixture(){
 const w=emptyWorkspace();
 w.settings={...w.settings,timezone:'UTC',start:540,end:1020,step:30,days:[0,1,2,3,4,5,6]};
 ensureDay(w,date);
 w.entries=[{id:'entry-one',date,start:570,end:600,text:'Activity',category:'cat-0',project:'',source:'site'}];
 return w;
}
test('journal timeline interleaves completed gaps with entries without changing stored data',()=>{
 const w=fixture(),before=structuredClone(w);
 const rows=journalTimeline(w,w.entries,date,date,at);
 assert.deepEqual(rows.map(r=>[r.start,r.end,r.status]),[[690,720,'missing'],[660,690,'missing'],[630,660,'missing'],[600,630,'missing'],[570,600,undefined],[540,570,'missing']]);
 assert.deepEqual(w,before);
});
test('journal gaps exclude waking, bedtime, pauses and future intervals',()=>{
 const w=fixture();w.entries=[];
 w.dayEvents=[{date,type:'wake',at:date+'T09:15:00Z',timezone:'UTC'},{date,type:'sleep',at:date+'T11:50:00Z',timezone:'UTC'}];
 w.pauses=[{date,start:600,end:630,type:'pause'}];
 const rows=journalTimeline(w,[],date,date,at);
 assert.deepEqual(rows.map(r=>[r.start,r.end]),[[705,710],[675,705],[645,675],[630,645],[585,600],[555,585]]);
 assert.deepEqual(journalTimeline(w,[],date,'2026-10-29',at),rows);
});
test('category filtering cannot turn hidden entries into gaps; markers may be disabled',()=>{
 const w=fixture();
 const rows=journalTimeline(w,[],date,date,at);
 assert.ok(rows.every(r=>r.end<=570||r.start>=600));
 assert.deepEqual(journalTimeline(w,[],date,date,at,false),[]);
});
test('day off has no gap markers, while recorded activities remain visible',()=>{
 const w=fixture();w.pauses=[{date,start:0,end:1440,type:'ended'}];
 assert.deepEqual(journalTimeline(w,w.entries,date,date,at),w.entries);
});

test('past-day journal markers account for all summary missing minutes without pagination hiding them',async()=>{
 const {summary}=await import('../domain.mjs');const w=fixture();
 w.settings.start=540;w.settings.end=1080;w.snapshots[date]={...w.settings};
 w.dayEvents=[{date,type:'wake',at:date+'T09:00:00Z',timezone:'UTC'},{date,type:'sleep',at:date+'T18:00:00Z',timezone:'UTC'}];
 w.entries=[{...w.entries[0],start:540,end:1040}];
 const now={date:'2026-10-29',minute:600},stats=summary(w,[date],now);
 const rows=journalTimeline(w,w.entries,date,date,new Date('2026-10-29T10:00:00Z'));
 assert.equal(stats.missing,40);assert.equal(rows.filter(r=>r.status==='missing').reduce((sum,r)=>sum+r.end-r.start,0),stats.missing);assert.ok(rows.length<50);
});
