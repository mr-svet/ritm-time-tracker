import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseTrustedProxies} from './http-security.mjs';
import {parseProxyHosts} from './proxy-trust.mjs';

export function databasePath(env=process.env){
 return resolve(env.DATA_DIR||fileURLToPath(new URL('../data/',import.meta.url)),'rhythm.sqlite');
}

export function validatePublicOrigin(value){
 if(typeof value!=='string'||!value)throw new Error('В production задайте APP_ORIGIN — HTTPS-адрес сайта.');
 let url;try{url=new URL(value);}catch{throw new Error('Некорректный APP_ORIGIN.');}
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||value!==value.trim())throw new Error('APP_ORIGIN должен быть HTTPS-адресом без пути, пароля и параметров.');
 return url.origin;
}

export function loadConfig(env=process.env){
 const production=env.NODE_ENV==='production',port=Number(env.PORT||4173);
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Некорректный PORT.');
 const host=env.HOST||(production?'0.0.0.0':'127.0.0.1');
 if(!['127.0.0.1','0.0.0.0','::'].includes(host)||(!production&&host!=='127.0.0.1'))throw new Error('Публичный HOST разрешён только в production с HTTPS и обратным прокси.');
 const publicOrigin=production?validatePublicOrigin(env.APP_ORIGIN):null;
 if(!production&&env.APP_ORIGIN)throw new Error('APP_ORIGIN используется только с NODE_ENV=production.');
 const trustedProxies=parseTrustedProxies(env.TRUSTED_PROXY_IPS||'');
 if(!production&&trustedProxies.length)throw new Error('TRUSTED_PROXY_IPS используется только в production.');
 const trustedProxyHosts=parseProxyHosts(env.TRUSTED_PROXY_HOSTS||'');
 if(!production&&trustedProxyHosts.length)throw new Error('TRUSTED_PROXY_HOSTS используется только в production.');
 if(trustedProxyHosts.length&&trustedProxies.length)throw new Error('Выберите TRUSTED_PROXY_HOSTS или TRUSTED_PROXY_IPS.');
 return {production,host,port,publicOrigin,trustedProxies,trustedProxyHosts,path:databasePath(env)};
}
