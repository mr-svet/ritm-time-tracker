import test from 'node:test';
import assert from 'node:assert/strict';
import {conflictMarkup} from '../sync-view.mjs';
const t=text=>text,clock=n=>String(n);
test('Conflict display escapes authored activity text and limits a large comparison',()=>{
 const entries=Array.from({length:30},(_,i)=>({id:String(i),date:'2026-10-27',start:0,end:30,text:'<script>private text</script>'}));
 const html=conflictMarkup({local:{revision:1,workspace:{entries}},server:{revision:2,workspace:{entries:[]}}},t,clock);
 assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);assert.match(html,/30/);assert.equal((html.match(/<li>/g)||[]).length,20);
});
test('Conflict without a server response explains that retry remains blocked',()=>{
 const html=conflictMarkup({local:{revision:1,workspace:{entries:[]}},server:null},t,clock);assert.match(html,/заблокирован/);assert.match(html,/памяти/);
});
