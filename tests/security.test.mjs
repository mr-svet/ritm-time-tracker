import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {request} from 'node:http';
import {emptyWorkspace,createStore,validateWorkspace,parseImport,parseStore,LIMITS,summary,csvRows} from '../domain.mjs';
import {loadJournal,saveJournal,restoreJournal} from '../storage.mjs';
import {createPreviewServer} from '../tools/preview.mjs';
import {inlineScriptHashes} from '../tools/security.mjs';
const date='2026-10-15';
const entry=extra=>({id:'entry-1',date,start:540,end:570,text:'Test',category:'cat-0',project:'p-1',source:'site',...extra});
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
test('rejects color arrays, invalid references and extra nested data before import',()=>{
 for(const change of [w=>w.categories[0].color=['#123456'],w=>w.entries=[entry({category:0})],w=>w.extra={deep:{value:'unexpected'}},w=>w.categories[0].extra='unexpected']){
 const w=emptyWorkspace();change(w);assert.throws(()=>parseImport(JSON.stringify({version:1,workspace:w})));}
 const valid=emptyWorkspace();valid.entries=[entry({text:'<svg onload="alert(1)">'} )];assert.deepEqual(parseImport(JSON.stringify({version:1,workspace:valid})),valid);
});
test('bounds pause workload, unknown deep objects and imported byte count',()=>{
 const w=emptyWorkspace();w.pauses=Array.from({length:129},()=>({date,start:540,end:541}));assert.throws(()=>validateWorkspace(w),/128/);
 w.pauses=Array.from({length:LIMITS.pauses+1},()=>({date,start:540,end:541}));assert.throws(()=>validateWorkspace(w),/20000/);
 assert.throws(()=>parseImport(' '.repeat(LIMITS.bytes+1)),/большой/);
 const body='{"version":1,"workspace":'+JSON.stringify(emptyWorkspace())+',"extra":'+'['.repeat(2000)+'0'+']'.repeat(2000)+'}';assert.throws(()=>parseImport(body),/неизвестные/);
});
test('reserved object names and actual none category do not corrupt sums',()=>{
 for(const id of ['constructor','toString','hasOwnProperty','none']){
 const w=emptyWorkspace();w.categories[0].id=id;w.projects[0].id=id;w.entries=[entry({category:id,project:id}),entry({id:'entry-2',start:570,end:600,category:'',project:''})];validateWorkspace(w);
 const s=summary(w,[date],{date:'2026-10-16',minute:1000});assert.equal(s.categories[id],30);assert.equal(s.categories[''],30);assert.equal(s.projects[id],30);assert.equal(s.projects[''],30);assert.equal(Object.values(s.categories).reduce((a,b)=>a+b),s.tracked);
 }
});
test('CSV protects control, whitespace and full-width formula prefixes in all text columns',()=>{
 const w=emptyWorkspace();for(const text of ['=1+1','+1+1','-1+1','@SUM(1)','\t=1+1','\r=1+1','\n=1+1',' \n=1+1','\uFEFF=1+1','＝1+1']){
 w.categories[0].name=text;w.projects[0].name=text;const csv=csvRows([entry({text})],w);const escaped='"\''+text.replaceAll('"','""')+'"';assert.equal(csv.split(escaped).length-1,3,JSON.stringify(text));
 }
 assert.ok(csvRows([entry({text:'A;"B"\nC'})],emptyWorkspace()).includes('"A;""B""\nC"'));
});
test('keeps previous valid version and loads it in recovery without overwriting corrupt raw',()=>{
 const storage=memory(),key='audit',old=createStore();saveJournal(storage,key,old);const next=structuredClone(old);next.mode='user';saveJournal(storage,key,next);
 assert.deepEqual(parseStore(storage.getItem(key+'-backup')),old);saveJournal(storage,key,next);assert.deepEqual(parseStore(storage.getItem(key+'-backup')),old);
 const corrupt='{"broken":true}';storage.setItem(key,corrupt);const loaded=loadJournal(storage,key);assert.deepEqual(loaded.store,old);assert.equal(loaded.corruptRaw,corrupt);assert.equal(storage.getItem(key),corrupt);
 const restored=restoreJournal(storage,key,loaded.backup,corrupt);assert.deepEqual(restored,old);assert.deepEqual(parseStore(storage.getItem(key)),old);
});
test('failed save and stale restore leave current data intact',()=>{
 const storage=memory(),key='audit',old=createStore();saveJournal(storage,key,old);const raw=storage.getItem(key);const failing={getItem:storage.getItem,setItem(){throw new Error('quota');}};
 assert.throws(()=>saveJournal(failing,key,{...old,mode:'user'}),/quota/);assert.equal(storage.getItem(key),raw);
 assert.throws(()=>restoreJournal(storage,key,raw,'stale'),/изменены/);assert.equal(storage.getItem(key),raw);
 const invalid=structuredClone(old);invalid.workspaces.demo.categories[0].color=['#123456'];assert.throws(()=>saveJournal(storage,key,invalid));assert.equal(storage.getItem(key),raw);
});
test('generated standalone CSP authorizes its exact module without unsafe-inline scripts',async()=>{
 const html=await readFile(new URL('../ritm-preview.html',import.meta.url),'utf8');const hashes=inlineScriptHashes(html);assert.equal(hashes.length,1);
 const policy=html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];assert.ok(policy.includes(hashes[0]));assert.ok(!policy.match(/script-src[^;]*unsafe-inline/));assert.ok(policy.includes("connect-src 'none'"));assert.ok(policy.includes("object-src 'none'"));
});
test('preview rejects unknown Host, methods, private files and path traversal; HEAD and standalone work',async t=>{
 const server=createPreviewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));const port=server.address().port;
 const get=(path,method='GET',host=`127.0.0.1:${port}`)=>new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port,path,method,headers:{Host:host}},res=>{let size=0;res.on('data',b=>size+=b.length);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,size}));});req.on('error',reject);req.end();});
 for(const path of ['/PRD.md','/.env','/%2e%2e/README.md','/api']){const r=await get(path);assert.equal(r.status,404);assert.ok(r.headers['content-security-policy']);}
 assert.equal((await get('/','GET',`audit.invalid:${port}`)).status,403);const post=await get('/','POST');assert.equal(post.status,405);assert.equal(post.headers.allow,'GET, HEAD');
 for(const path of ['/today','/journal','/stats','/trends','/settings'])assert.equal((await get(path)).status,200,path);
 const head=await get('/','HEAD');assert.equal(head.status,200);assert.equal(head.size,0);const html=await get('/ritm-preview.html');assert.equal(html.status,200);assert.match(html.headers['content-security-policy'],/sha256-/);assert.equal(html.headers['referrer-policy'],'no-referrer');
});
test('explicit clear purges cleared workspace from backup and guards corrupt replacement',()=>{
 const storage=memory(),key='audit',old=createStore();saveJournal(storage,key,old);const next=structuredClone(old);next.workspaces.demo=emptyWorkspace();saveJournal(storage,key,next,{resetBackup:true});assert.deepEqual(parseStore(storage.getItem(key+'-backup')).workspaces.demo,emptyWorkspace());
 const corrupt='broken';storage.setItem(key,corrupt);assert.throws(()=>saveJournal(storage,key,next,{resetBackup:true,replaceCorrupt:'stale'}),/изменены/);assert.equal(storage.getItem(key),corrupt);saveJournal(storage,key,next,{resetBackup:true,replaceCorrupt:corrupt});assert.deepEqual(parseStore(storage.getItem(key)),next);
});
