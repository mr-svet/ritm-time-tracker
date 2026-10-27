import test from 'node:test';
import assert from 'node:assert/strict';
import {JournalDB} from '../server/database.mjs';
import {dueInterval,questionKeyboard} from '../server/bot.mjs';
import {uid,schedule} from '../domain.mjs';

test('shared settings drive the existing scheduler and preserve old day settings',t=>{
 const db=new JournalDB(':memory:');t.after(()=>db.close());
 db.mutate(w=>{
  w.settings={timezone:'UTC',start:540,end:720,step:30,days:[0,1,2,3,4,5,6],confirmed:true};
  w.snapshots['2026-10-27']={...w.settings};
  w.dayEvents=[{date:'2026-10-28',type:'wake',at:'2026-10-28T09:00:00Z',timezone:'UTC'}];
 });
 const state=db.read();state.workspace.settings.step=15;
 db.save(state.workspace,state.revision,uid());
 const at=new Date('2026-10-28T10:00:15Z'),fresh=db.read().workspace;
 assert.equal(schedule(fresh,'2026-10-27').step,30);
 assert.equal(schedule(fresh,'2026-10-28').step,15);
 const due=dueInterval(fresh,at);assert.ok(due);assert.equal(due.start,585);assert.equal(due.end,600);
 db.mutate(w=>w.pauses.push({date:'2026-10-28',start:585,end:615,type:'pause'}));
 assert.equal(dueInterval(db.read().workspace,at),null);
});

test('saved category order, names and archives are used by the same bot keyboard',t=>{
 const db=new JournalDB(':memory:');t.after(()=>db.close());
 const state=db.read();state.workspace.categories=[
  {id:'stage3-second',name:'Second first',color:'#8eb69b',archived:false},
  {id:'stage3-archived',name:'Hidden archived',color:'#8eb69b',archived:true},
  {id:'stage3-first',name:'First second',color:'#8eb69b',archived:false}
 ];
 db.save(state.workspace,state.revision,uid());
 const keyboard=questionKeyboard('synthetic-stage3',db.read().workspace.categories).inline_keyboard.flat();
 assert.deepEqual(keyboard.filter(b=>b.callback_data.startsWith('k:')).map(b=>b.text),['Second first','First second']);
 assert.equal(keyboard.some(b=>b.text==='Hidden archived'),false);
});
