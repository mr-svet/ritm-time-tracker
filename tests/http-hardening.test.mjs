import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {JournalDB,passwordHash} from '../server/database.mjs';
import {createAppServer} from '../server/http.mjs';
import {clientAddress,parseTrustedProxies} from '../server/http-security.mjs';
import {loadConfig} from '../server/config.mjs';
import {uid} from '../domain.mjs';

const password='synthetic-hardening-owner-password';
function fixture(t,trustedProxies=['172.20.0.2']){
 const db=new JournalDB(':memory:');db.sql.prepare('INSERT INTO account VALUES(1,?)').run(passwordHash(password));
 const server=createAppServer({db,publicOrigin:'https://audit.example',trustedProxies});
 t.after(()=>db.close());const handler=server.listeners('request')[0];
 async function request(path,{method='POST',value={},raw,headers={},peer='172.20.0.2',stream}={}){
  const req=stream||Readable.from([Buffer.from(raw??JSON.stringify(value))]);
  Object.assign(req,{method,url:path,headers:{host:'audit.example',origin:'https://audit.example','content-type':'application/json',...headers},socket:{remoteAddress:peer}});
  let status,text;const resultHeaders={};const res={setHeader(k,v){resultHeaders[k.toLowerCase()]=v;},writeHead(s,h){status=s;for(const [k,v] of Object.entries(h??{}))resultHeaders[k.toLowerCase()]=v;},end(body){text=body?.toString()??'';}};
  await handler(req,res);return {status,text,headers:resultHeaders,json:()=>JSON.parse(text)};
 }
 return {db,request};
}

test('proxy trust is explicit, validates exact addresses, normalizes IPs and ignores spoofed prefixes',()=>{
 assert.deepEqual(parseTrustedProxies(),[]);
 assert.deepEqual(parseTrustedProxies('172.20.0.2, ::ffff:172.20.0.2'),['172.20.0.2']);
 for(const value of ['*','172.20.0.0/16','host.example','127.0.0.1:80','127.0.0.1,'])assert.throws(()=>parseTrustedProxies(value));
 assert.throws(()=>loadConfig({TRUSTED_PROXY_IPS:'127.0.0.1'}));
 const req={socket:{remoteAddress:'::ffff:172.20.0.2'},headers:{'x-forwarded-for':'1.1.1.1, 198.51.100.7'}};
 assert.equal(clientAddress(req), '172.20.0.2');
 assert.equal(clientAddress(req,['172.20.0.2']),'198.51.100.7');
 req.headers['x-forwarded-for']='198.51.100.7, invalid';assert.equal(clientAddress(req,['172.20.0.2']),'172.20.0.2');
 req.headers['x-forwarded-for']='a'.repeat(2049);assert.equal(clientAddress(req,['172.20.0.2']),'172.20.0.2');
});

test('a blocked client behind the trusted proxy cannot lock another client out',async t=>{
 const {request}=fixture(t);
 for(let i=0;i<5;i++)assert.equal((await request('/api/login',{value:{password:'wrong'},headers:{'x-forwarded-for':`1.1.1.${i}, 198.51.100.7`}})).status,401);
 assert.equal((await request('/api/login',{value:{password},headers:{'x-forwarded-for':'198.51.100.7'}})).status,429);
 assert.equal((await request('/api/login',{value:{password},headers:{'x-forwarded-for':'203.0.113.9'}})).status,200);
});

test('untrusted peers cannot rotate their limits through forged forwarded headers',async t=>{
 const {request}=fixture(t,[]);
 for(let i=0;i<5;i++)assert.equal((await request('/api/login',{value:{password:'wrong'},headers:{'x-forwarded-for':`198.51.100.${i}`}})).status,401);
 assert.equal((await request('/api/login',{value:{password},headers:{'x-forwarded-for':'203.0.113.9'}})).status,429);
});

test('visitor quota is per client and separate from owner login',async t=>{
 const {request}=fixture(t);
 for(let i=0;i<30;i++)assert.equal((await request('/api/guest/preview',{headers:{'x-forwarded-for':'198.51.100.7'}})).status,200);
 assert.equal((await request('/api/guest/preview',{headers:{'x-forwarded-for':'198.51.100.7'}})).status,429);
 assert.equal((await request('/api/guest/preview',{headers:{'x-forwarded-for':'203.0.113.9'}})).status,200);
 assert.equal((await request('/api/login',{value:{password},headers:{'x-forwarded-for':'198.51.100.7'}})).status,200);
});

test('visitor limit expires from its first request instead of extending on every visit',async t=>{
 let at=2000000;t.mock.method(Date,'now',()=>at);const {request}=fixture(t);
 for(let i=0;i<30;i++){at=2000000+i*1000;assert.equal((await request('/api/guest/preview')).status,200);}
 assert.equal((await request('/api/guest/preview')).status,429);
 at=2900000;assert.equal((await request('/api/guest/preview')).status,200);
});

test('parallel login bodies reserve the attempt budget before yielding',async t=>{
 const {request}=fixture(t);let release;const gate=new Promise(r=>release=r);
 const pending=Array.from({length:8},()=>request('/api/login',{stream:Readable.from((async function*(){await gate;yield Buffer.from('{"password":"wrong"}');})())}));
 release();const results=await Promise.all(pending);
 assert.equal(results.filter(r=>r.status===401).length,5);
 assert.equal(results.filter(r=>r.status===429).length,3);
});

test('login rejects oversized, chunked and non-object bodies; ordinary login still works',async t=>{
 const {request}=fixture(t);
 let read=false;const stream=Readable.from((async function*(){read=true;yield Buffer.from('{}');})());
 assert.equal((await request('/api/login',{headers:{'content-length':'5000','x-forwarded-for':'198.51.100.1'},stream})).status,413);
 assert.equal(read,false);
 assert.equal((await request('/api/login',{value:{password,padding:'x'.repeat(5000)},headers:{'x-forwarded-for':'198.51.100.2'}})).status,413);
 for(const raw of ['null','[]','"password"'])assert.equal((await request('/api/login',{raw,headers:{'x-forwarded-for':'198.51.100.3'}})).status,400);
 assert.equal((await request('/api/login',{value:{password},headers:{'x-forwarded-for':'198.51.100.4'}})).status,200);
});

test('authenticated journal still accepts a valid payload larger than the login budget',async t=>{
 const {request,db}=fixture(t),login=await request('/api/login',{value:{password}});
 const cookie=login.headers['set-cookie'].split(';')[0],csrf=login.json().csrf;
 const {workspace,revision}=db.read();
 for(let i=0;i<4;i++)workspace.entries.push({id:uid(),date:'2026-10-20',start:i*30,end:(i+1)*30,text:'x'.repeat(2000),category:'',project:'',source:'site'});
 const value={workspace,revision,requestId:uid()};assert.ok(Buffer.byteLength(JSON.stringify(value))>4096);
 assert.equal((await request('/api/journal',{method:'PUT',value,headers:{cookie,'x-csrf-token':csrf}})).status,200);
 assert.equal(db.read().workspace.entries.length,4);
});
