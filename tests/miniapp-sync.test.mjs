import test from 'node:test';
import assert from 'node:assert/strict';
import {RemoteJournal} from '../remote.mjs';
function fixture(t){const old=globalThis.document;globalThis.document={documentElement:{dataset:{miniapp:'true'}}};t.after(()=>globalThis.document=old);return new RemoteJournal();}
const operation=()=>({workspace:{entries:[{id:'local',text:'My activity'}]},revision:4,requestId:'fixed-request-id-12345'});
test('Unknown save result retries identical payload and requestId',async t=>{
 const remote=fixture(t),sent=[];remote.unsaved=operation();let attempt=0;
 remote.request=async(path,{body}={})=>{sent.push(structuredClone(body));if(++attempt===1){const error=new Error('lost response');error.uncertain=true;throw error;}return {revision:5,workspace:body.workspace};};
 await assert.rejects(remote.save());assert.equal(remote.uncertain,true);await remote.save();assert.deepEqual(sent[0],sent[1]);assert.equal(remote.unsaved,null);
});
test('Conflict fetches current journal and blocks stale retries',async t=>{
 const remote=fixture(t);remote.unsaved=operation();let puts=0;
 remote.request=async(path,options)=>{if(options?.method==='PUT'){puts++;const error=new Error('conflict');error.status=409;throw error;}return {revision:5,workspace:{entries:[{id:'bot',text:'Bot activity'}]}};};
 await assert.rejects(remote.save());assert.equal(remote.conflict.server.revision,5);await assert.rejects(remote.save());assert.equal(puts,1);
 const fresh=await remote.loadFresh();assert.equal(fresh.entries[0].id,'bot');assert.equal(remote.recovery.requestId,'fixed-request-id-12345');assert.equal(remote.unsaved,null);
});
test('Failed fetch of fresh version never discards unresolved operation',async t=>{
 const remote=fixture(t);remote.unsaved=operation();remote.conflict={local:structuredClone(remote.unsaved),server:null};remote.request=async()=>{throw new Error('offline');};
 await assert.rejects(remote.loadFresh());assert.ok(remote.unsaved);assert.ok(remote.conflict);
});
test('Uncertain operation cannot be replaced by fetching the journal',async t=>{
 const remote=fixture(t);remote.unsaved=operation();remote.uncertain=true;remote.request=async()=>{throw new Error('must not run');};await assert.rejects(remote.loadFresh(),/неизвестен/);assert.ok(remote.unsaved);
});
