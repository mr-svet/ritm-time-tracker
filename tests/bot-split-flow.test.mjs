import test from 'node:test';
import assert from 'node:assert/strict';
import {JournalDB} from '../server/database.mjs';
import {processUpdate} from '../server/bot.mjs';
const prompt='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function lab(){
 const db=new JournalDB(':memory:');
 db.sql.prepare("INSERT INTO telegram VALUES(1,'1','1')").run();
 db.sql.prepare("INSERT INTO meta(key,value) VALUES('bot_language','en')").run();
 const base=Date.parse('2026-10-24T10:31:00Z');let id=1;
 db.sql.prepare('INSERT INTO prompts(id,date,start,end,timezone,message_id,status,created) VALUES(?,?,?,?,?,?,?,?)').run(prompt,'2026-10-24',600,630,'UTC',100,'sent',base-60000);
 const message=text=>({message_id:500+id,date:Math.floor(base/1000),from:{id:1},chat:{id:1,type:'private'},text});
 const send=text=>processUpdate(db,{update_id:id++,message:message(text)},base+id);
 const click=data=>processUpdate(db,{update_id:id++,callback_query:{id:String(id),from:{id:1},message:{...message('Question'),message_id:100},data}},base+id);
 const state=()=>{const row=db.sql.prepare('SELECT * FROM split_drafts ORDER BY created DESC LIMIT 1').get();return row?{...row,draft:JSON.parse(row.body)}:null;};
 const action=value=>{const row=state();return click(`sp:${row.id}:${row.draft.version}:${value}`);};
 const category=()=>{const row=state();return action('c-');};
 const fill=()=>{click('s:'+prompt);send('10');send('Reading');category();action('more');send('20');send('Video');category();};
 return {db,send,click,state,action,fill};
}
test('split draft does not write journal before confirmation and save is idempotent',()=>{
 const l=lab();try{
 l.fill();assert.equal(l.db.read().workspace.entries.length,0);
 const row=l.state(),old=`sp:${row.id}:${row.draft.version}:save`;
 l.click(old);const entries=l.db.read().workspace.entries;
 assert.deepEqual(entries.map(e=>[e.start,e.end,e.text]),[[600,610,'Reading'],[610,630,'Video']]);
 l.click(old);assert.equal(l.db.read().workspace.entries.length,2);
 }finally{l.db.close();}
});
test('cancel and stale category buttons cannot write an entry',()=>{
 const l=lab();try{
 l.click('s:'+prompt);l.send('10');l.send('Reading');const row=l.state();
 const old=`sp:${row.id}:${row.draft.version}:c-`;
 l.action('cancel');l.click(old);assert.equal(l.db.read().workspace.entries.length,0);
 assert.equal(l.state().status,'cancelled');
 }finally{l.db.close();}
});
test('changed target stops replacement and keeps the draft',()=>{
 const l=lab();try{
 l.fill();l.db.mutate(w=>w.entries.push({id:'new-entry',date:'2026-10-24',start:600,end:630,text:'Changed on website',category:'',project:'',source:'site'}));
 l.action('save');assert.equal(l.db.read().workspace.entries[0].text,'Changed on website');assert.equal(l.state().status,'conflict');
 }finally{l.db.close();}
});
test('an occupied interval requires a second explicit replacement confirmation',()=>{
 const l=lab();try{
 l.db.mutate(w=>w.entries.push({id:'old-entry',date:'2026-10-24',start:600,end:630,text:'Original activity',category:'',project:'',source:'site'}));
 l.fill();l.action('save');assert.equal(l.db.read().workspace.entries[0].text,'Original activity');
 assert.equal(l.state().draft.stage,'replace');l.action('replace');
 assert.equal(l.db.read().workspace.entries.length,2);assert.equal(l.state().draft.original[0].text,'Original activity');
 }finally{l.db.close();}
});
