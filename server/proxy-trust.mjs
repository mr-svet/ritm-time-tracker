import {lookup as systemLookup} from 'node:dns/promises';
import {performance} from 'node:perf_hooks';
import {parseTrustedProxies} from './http-security.mjs';

export function parseProxyHosts(value=''){
 if(typeof value!=='string')throw new Error('Некорректный TRUSTED_PROXY_HOSTS.');
 if(!value.trim())return [];
 const hosts=value.split(',').map(host=>host.trim().toLowerCase());
 if(hosts.length>8||hosts.some(host=>host.length>63||!/[a-z]/.test(host)||!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(host)))throw new Error('TRUSTED_PROXY_HOSTS: нужны внутренние имена Docker без URL, портов и доменных суффиксов.');
 return [...new Set(hosts)];
}

// Only administrator-configured Docker names may grant exact peer trust.
// A failed lookup revokes trust; a replacement never retains the previous IP.
export function createProxyTrust({hosts=[],addresses=[],lookup=systemLookup,now=()=>performance.now(),refreshMs=15000,maxAgeMs=60000,timeoutMs=2000}={}){
 hosts=parseProxyHosts(hosts.join(','));addresses=parseTrustedProxies(addresses.join(','));
 if(hosts.length&&addresses.length)throw new Error('Выберите TRUSTED_PROXY_HOSTS или TRUSTED_PROXY_IPS.');
 let current=addresses,expires=0,pending=null,timer=null,closed=false;
 const refresh=()=>{
  if(closed||!hosts.length)return Promise.resolve();
  if(pending)return pending;
  pending=(async()=>{
   let deadline;
   try{
    const results=await Promise.race([
     Promise.all(hosts.map(host=>Promise.resolve().then(()=>lookup(host,{all:true,verbatim:true})))),
     new Promise((_,reject)=>{deadline=setTimeout(()=>reject(new Error('DNS timeout')),timeoutMs);}),
    ]);
    const resolved=results.flat().map(result=>result.address);
    if(!resolved.length||resolved.some(address=>typeof address!=='string'||!address.trim()))throw new Error('Empty DNS result');
    const next=parseTrustedProxies(resolved.join(','));
    if(!closed){current=next;expires=now()+maxAgeMs;}
   }catch{
    if(!closed){current=[];expires=0;}
   }finally{clearTimeout(deadline);pending=null;}
  })();
  return pending;
 };
 return {
  addresses:()=>closed?[]:hosts.length?(now()<expires?[...current]:[]):[...current],
  refresh,
  start(){if(!closed&&hosts.length&&!timer){timer=setInterval(refresh,refreshMs);timer.unref();}},
  close(){closed=true;current=[];clearInterval(timer);},
 };
}
