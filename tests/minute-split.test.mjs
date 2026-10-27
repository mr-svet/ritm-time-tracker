import test from 'node:test';
import assert from 'node:assert/strict';
import {splitIntervalEntries,emptyWorkspace} from '../domain.mjs';
const range={date:'2026-10-24',start:600,end:630};
const parts=[{minutes:10,text:'First activity',category:'cat-0',project:''},{minutes:20,text:'Second activity',category:'cat-1',project:''}];
test('split assigns exact sequential minutes and independent categories',()=>{
 const entries=splitIntervalEntries(emptyWorkspace(),range,parts,{source:'telegram'});
 assert.deepEqual(entries.map(e=>[e.start,e.end,e.category]),[[600,610,'cat-0'],[610,630,'cat-1']]);
 assert.equal(entries.reduce((n,e)=>n+e.end-e.start,0),30);
 assert.equal(new Set(entries.map(e=>e.id)).size,2);
});
test('split refuses incomplete duration, fractions, zero and inactive categories',()=>{
 const w=emptyWorkspace();
 for(const n of [0,-1,1.5,9,11])assert.throws(()=>splitIntervalEntries(w,range,[{...parts[0],minutes:n},parts[1]]));
 w.categories[0].archived=true;assert.throws(()=>splitIntervalEntries(w,range,parts));
});
test('split never changes the input workspace and rejects neighboring overlap',()=>{
 const w=emptyWorkspace(),before=JSON.stringify(w);
 splitIntervalEntries(w,range,parts);assert.equal(JSON.stringify(w),before);
 w.entries=[{id:'old',...range,start:590,end:610,text:'Neighbor',category:'cat-0',project:'',source:'site'}];
 assert.throws(()=>splitIntervalEntries(w,range,parts));
});
