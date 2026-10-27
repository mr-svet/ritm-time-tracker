import test from 'node:test';
import assert from 'node:assert/strict';
import {parseProxyHosts,createProxyTrust} from '../server/proxy-trust.mjs';
import {clientAddress} from '../server/http-security.mjs';
import {loadConfig} from '../server/config.mjs';

const env={NODE_ENV:'production',APP_ORIGIN:'https://audit.example'};
test('only explicit internal Docker names are accepted, exclusively in production',()=>{
 assert.deepEqual(parseProxyHosts(' Dokploy-Traefik, dokploy-traefik '),['dokploy-traefik']);
 assert.deepEqual(parseProxyHosts(),[]);
 for(const value of ['*','10.0.1.7','https://dokploy-traefik','proxy.example','proxy:80','proxy,','-proxy','proxy-','a'.repeat(64),Array(9).fill('proxy').join(',')])assert.throws(()=>parseProxyHosts(value));
 assert.throws(()=>loadConfig({TRUSTED_PROXY_HOSTS:'dokploy-traefik'}));
 assert.throws(()=>loadConfig({...env,TRUSTED_PROXY_HOSTS:'dokploy-traefik',TRUSTED_PROXY_IPS:'10.0.1.7'}));
 assert.deepEqual(loadConfig({...env,TRUSTED_PROXY_HOSTS:'dokploy-traefik'}).trustedProxyHosts,['dokploy-traefik']);
});

test('DNS replacement revokes the old peer and preserves rightmost-XFF semantics',async()=>{
 let ip='10.0.1.7';const trust=createProxyTrust({hosts:['dokploy-traefik'],lookup:async()=>[{address:ip}]});
 assert.deepEqual(trust.addresses(),[]);await trust.refresh();
 const req=peer=>({socket:{remoteAddress:peer},headers:{'x-forwarded-for':'1.1.1.1, 198.51.100.9'}});
 assert.equal(clientAddress(req(ip),trust.addresses()),'198.51.100.9');
 ip='10.0.1.11';await trust.refresh();
 assert.equal(clientAddress(req('10.0.1.7'),trust.addresses()),'10.0.1.7');
 assert.equal(clientAddress(req(ip),trust.addresses()),'198.51.100.9');
 trust.addresses().push('10.0.1.7');assert.deepEqual(trust.addresses(),[ip]);trust.close();
});

test('failed DNS and expired results remove trust, recovery restores only current addresses',async()=>{
 let at=0,fail=false;
 const trust=createProxyTrust({hosts:['dokploy-traefik'],now:()=>at,lookup:async()=>{if(fail)throw new Error('DNS unavailable');return [{address:'::ffff:10.0.1.11'},{address:'2001:db8::1'}];}});
 await trust.refresh();assert.deepEqual(trust.addresses(),['10.0.1.11','2001:db8::1']);
 at=60000;assert.deepEqual(trust.addresses(),[]);await trust.refresh();assert.equal(trust.addresses().length,2);
 fail=true;await trust.refresh();assert.deepEqual(trust.addresses(),[]);
 fail=false;await trust.refresh();assert.equal(trust.addresses().length,2);trust.close();
});

test('invalid, empty and excessive DNS responses fail closed',async()=>{
 for(const result of [[],[{address:''}],[{}],[{address:'10.0.0.0/8'}],Array.from({length:17},(_,i)=>({address:`10.0.1.${i}`}))]){
  const trust=createProxyTrust({hosts:['proxy'],lookup:async()=>result});await trust.refresh();assert.deepEqual(trust.addresses(),[]);trust.close();
 }
});

test('concurrent refreshes share one lookup; timeout and late completion cannot regrant trust',async()=>{
 let release,calls=0;
 const trust=createProxyTrust({hosts:['proxy'],timeoutMs:10,lookup:()=>{calls++;return new Promise(resolve=>release=resolve);}});
 const a=trust.refresh(),b=trust.refresh();assert.equal(a,b);await a;assert.equal(calls,1);assert.deepEqual(trust.addresses(),[]);
 release([{address:'10.0.1.7'}]);await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(trust.addresses(),[]);trust.close();
});

test('closing cancels periodic updates and ignores an in-flight answer',async()=>{
 let release,calls=0;
 const trust=createProxyTrust({hosts:['proxy'],lookup:()=>{calls++;return new Promise(resolve=>release=resolve);}});
 const pending=trust.refresh();await Promise.resolve();trust.start();trust.start();trust.close();
 release([{address:'10.0.1.7'}]);await pending;await trust.refresh();assert.equal(calls,1);assert.deepEqual(trust.addresses(),[]);
});

test('static trust remains backward compatible and never performs DNS',async()=>{
 const trust=createProxyTrust({addresses:['::ffff:10.0.1.7'],lookup:()=>assert.fail('unexpected DNS')});
 await trust.refresh();assert.deepEqual(trust.addresses(),['10.0.1.7']);trust.close();assert.deepEqual(trust.addresses(),[]);
 assert.throws(()=>createProxyTrust({hosts:['proxy'],addresses:['10.0.1.7']}));
});

test('the running timer refreshes automatically and stops on close',async t=>{
 t.mock.timers.enable({apis:['setInterval']});let calls=0,ip='10.0.1.7';
 const trust=createProxyTrust({hosts:['proxy'],lookup:async()=>{calls++;return [{address:ip}];}});
 await trust.refresh();trust.start();trust.start();ip='10.0.1.11';
 t.mock.timers.tick(15000);await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(trust.addresses(),[ip]);assert.equal(calls,2);
 trust.close();t.mock.timers.tick(15000);await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,2);
});

test('a synchronous resolver error does not prevent a later retry',async()=>{
 let fail=true;const trust=createProxyTrust({hosts:['proxy'],lookup:()=>{if(fail)throw new Error('lookup failed');return [{address:'10.0.1.11'}];}});
 await trust.refresh();assert.deepEqual(trust.addresses(),[]);fail=false;await trust.refresh();assert.deepEqual(trust.addresses(),['10.0.1.11']);trust.close();
});
