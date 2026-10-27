import test from 'node:test';
import assert from 'node:assert/strict';
import {RemoteJournal} from '../remote.mjs';
function client(t){
 const oldDocument=globalThis.document,oldWindow=globalThis.window;
 globalThis.document={documentElement:{dataset:{miniapp:'true'}}};
 globalThis.window={Telegram:{WebApp:{initData:'synthetic-test-data'}}};
 t.after(()=>{globalThis.document=oldDocument;globalThis.window=oldWindow;});
 return new RemoteJournal();
}
test('Mini App confirms cookie round trip before accepting login',async t=>{
 const remote=client(t),calls=[];
 remote.request=async path=>{calls.push(path);return path==='auth/telegram'?{authenticated:true,csrf:'from-login'}:calls.length===1?{authenticated:false}:{authenticated:true,role:'owner',csrf:'from-session'};};
 await remote.session();assert.deepEqual(calls,['session','auth/telegram','session']);
 assert.equal(remote.csrf,'from-session');assert.equal(remote.authenticated,true);
});
test('Blocked cookie leaves Mini App unauthenticated with useful explanation',async t=>{
 const remote=client(t);
 remote.request=async path=>path==='auth/telegram'?{authenticated:true,csrf:'unused'}:{authenticated:false};
 await assert.rejects(remote.session(),/cookie/i);assert.equal(remote.authenticated,false);assert.equal(remote.csrf,null);
});
