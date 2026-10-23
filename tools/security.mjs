import {createHash} from 'node:crypto';

export function inlineScriptHashes(html){return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>!(/\bsrc\s*=/i.test(m[1]))).map(m=>"'sha256-"+createHash('sha256').update(m[2]).digest('base64')+"'");}
export function contentPolicy(hashes=[],meta=false){
 return ["default-src 'none'","script-src 'self' "+hashes.join(' '),"style-src 'self' 'unsafe-inline'","img-src 'self' data:","connect-src 'none'","font-src 'none'","object-src 'none'","base-uri 'none'","form-action 'none'",...(meta?[]:["frame-ancestors 'none'"])].join('; ');
}
export function securityHeaders(policy=contentPolicy()){
 return {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':policy,'Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=()','X-Frame-Options':'DENY','Cross-Origin-Resource-Policy':'same-origin'};
}
