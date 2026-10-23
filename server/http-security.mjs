import {isIP} from 'node:net';

function normalizeIP(value){
 if(typeof value!=='string')return null;
 let ip=value.trim();
 if(ip.startsWith('::ffff:')&&isIP(ip.slice(7))===4)ip=ip.slice(7);
 const version=isIP(ip);if(!version)return null;
 return version===6?new URL(`http://[${ip}]/`).hostname.slice(1,-1):ip;
}

// Explicit peer addresses only: never trust arbitrary forwarded client headers.
export function parseTrustedProxies(value=''){
 if(typeof value!=='string')throw new Error('TRUSTED_PROXY_IPS должен содержать IP-адреса через запятую.');
 if(!value.trim())return [];
 const values=value.split(',');
 if(values.length>16)throw new Error('В TRUSTED_PROXY_IPS допускается не более 16 адресов.');
 const addresses=values.map(normalizeIP);
 if(addresses.some(ip=>!ip))throw new Error('В TRUSTED_PROXY_IPS нужны точные IPv4/IPv6-адреса без CIDR и портов.');
 return [...new Set(addresses)];
}

export function clientAddress(req,trustedProxies=[]){
 const peer=normalizeIP(req.socket.remoteAddress)||'unknown';
 if(!trustedProxies.includes(peer))return peer;
 const forwarded=req.headers['x-forwarded-for'];
 if(typeof forwarded!=='string'||forwarded.length>2048)return peer;
 // The immediate trusted proxy appends/overwrites the actual connecting client.
 // Taking the first entry would let a client choose its own rate-limit key.
 return normalizeIP(forwarded.split(',').at(-1))||peer;
}
