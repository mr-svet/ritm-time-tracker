import {createHmac,timingSafeEqual} from 'node:crypto';
import {AppError} from './database.mjs';

// Bot-owned validation, not the third-party Ed25519 protocol.
export function validateTelegramInitData(raw,token,at=Date.now()){
 const fail=()=>{throw new AppError(401,'Вход Telegram не подтверждён. Закройте и снова откройте приложение.');};
 if(typeof raw!=='string'||!raw||Buffer.byteLength(raw)>16384||typeof token!=='string'||!token) return fail();
 const fields=new URLSearchParams(raw),seen=new Set();
 for(const [key] of fields){if(seen.has(key))return fail();seen.add(key);}
 const hash=fields.get('hash');if(!/^[a-f0-9]{64}$/.test(hash??''))return fail();
 fields.delete('hash');
 const check=[...fields].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,value])=>`${key}=${value}`).join('\n');
 const key=createHmac('sha256','WebAppData').update(token).digest();
 const expected=createHmac('sha256',key).update(check).digest();
 if(!timingSafeEqual(expected,Buffer.from(hash,'hex')))return fail();
 const date=fields.get('auth_date');if(!/^\d{1,12}$/.test(date??''))return fail();
 const age=at-Number(date)*1000;if(age>300000||age < -30000)return fail();
 let user;try{user=JSON.parse(fields.get('user'));}catch{return fail();}
 if(!user||!Number.isSafeInteger(user.id)||user.id<=0||user.is_bot)return fail();
 return {userId:String(user.id)};
}
