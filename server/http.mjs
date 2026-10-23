import {createServer} from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {JournalDB,AppError,digest,secret,verifyPassword} from './database.mjs';
import {LIMITS} from '../domain.mjs';
import {securityHeaders,contentPolicy} from '../tools/security.mjs';
import {validatePublicOrigin} from './config.mjs';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const files=new Set(['index.html','app.mjs','domain.mjs','storage.mjs','remote.mjs','i18n.mjs','styles.css','favicon.svg','assets/github-preview.svg','assets/rhythm-forest.png','assets/scenes/dawn.jpg','assets/scenes/mountains.jpg','assets/scenes/lake.jpg','assets/scenes/meadow.jpg','assets/scenes/coast.jpg']);
const pages=new Set(['/','/today','/journal','/stats','/trends','/settings']);
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
async function body(req){
 if(req.headers['content-type']!=='application/json')throw new AppError(415,'Ожидается application/json.');
 let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>LIMITS.bytes+4096)throw new AppError(413,'Слишком большой запрос.');chunks.push(chunk);}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AppError(400,'Некорректный JSON.');}
}
export function createAppServer({db,bot=null,publicOrigin=null}={}){
 if(publicOrigin)publicOrigin=validatePublicOrigin(publicOrigin);
 const cookieName=publicOrigin?'__Host-ritm_session':'ritm_session',secure=publicOrigin?'; Secure':'';
 const failures=new Map();let lastCleanup=0;
 const server=createServer(async(req,res)=>{
  for(const [key,value] of Object.entries(securityHeaders(contentPolicy().replace("connect-src 'none'","connect-src 'self'"))))res.setHeader(key,value);
  if(publicOrigin)res.setHeader('Strict-Transport-Security','max-age=86400');
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  try{
   const host=req.headers.host,port=server.address()?.port;
   if(!(publicOrigin?[new URL(publicOrigin).host]:['127.0.0.1:'+port,'localhost:'+port]).includes(host))throw new AppError(403,'Недопустимый Host.');
   const origin=publicOrigin||'http://'+host;
   const path=new URL(req.url,origin).pathname;
   // External links may load the public document shell. Its static allowlist
   // contains no user data; API authorization and CSRF checks still apply.
   const publicNavigation=!path.startsWith('/api/')&&['GET','HEAD'].includes(req.method)&&req.headers['sec-fetch-mode']==='navigate'&&req.headers['sec-fetch-dest']==='document';
   if(!publicNavigation){
    if(req.headers.origin&&req.headers.origin!==origin)throw new AppError(403,'Запрос с другого сайта запрещён.');
    if(req.headers['sec-fetch-site']==='cross-site')throw new AppError(403,'Запрос с другого сайта запрещён.');
   }
   if(!path.startsWith('/api/')){
    if(!['GET','HEAD'].includes(req.method))throw new AppError(405,'Метод не поддерживается.');
    const name=pages.has(path)?'index.html':decodeURIComponent(path).slice(1);if(!files.has(name))throw new AppError(404,'Не найдено.');
    const file=await realpath(resolve(root,name));if(!file.startsWith(root+sep))throw new AppError(404,'Не найдено.');
    let data=await readFile(file);if(name==='index.html')data=Buffer.from(data.toString().replace('<html ', '<html data-api="true" '));
    res.writeHead(200,{'Content-Type':types[extname(file)],'Content-Length':data.length});res.end(req.method==='HEAD'?undefined:data);return;
   }
   if(!['GET','POST','PUT','DELETE'].includes(req.method))throw new AppError(405,'Метод не поддерживается.');
   if(path==='/api/health'&&req.method==='GET'){db.sql.prepare('SELECT 1').get();return json(200,{ok:true});}
   const at=Date.now();if(at-lastCleanup>60000){db.cleanup(at);lastCleanup=at;}
   const token=new RegExp('(?:^|;\\s*)'+cookieName+'=([a-zA-Z0-9_-]{43})(?:;|$)').exec(req.headers.cookie||'')?.[1];
   const session=token?(db.sql.prepare("SELECT csrf,'owner' role FROM sessions WHERE hash=? AND expires>?").get(digest(token),at)??db.sql.prepare("SELECT csrf,'guest' role FROM guest_sessions WHERE hash=? AND expires>?").get(digest(token),at)):null;
   if(path==='/api/session'&&req.method==='GET')return json(200,{authenticated:!!session,role:session?.role??null,csrf:session?.csrf??null,guestEnabled:true,configured:!!db.sql.prepare('SELECT id FROM account').get()});
   if(path==='/api/guest/preview'&&req.method==='POST'){
    if(req.headers.origin!==origin)throw new AppError(403,'Для входа нужен запрос с этого сайта.');
    const key='preview:'+req.socket.remoteAddress,rate=failures.get(key);
    if(rate&&rate.until>at&&rate.count>=30)throw new AppError(429,'Слишком много попыток. Повторите позже.');
    failures.set(key,{count:rate?.until>at?rate.count+1:1,until:at+900000});
    const value=secret(),csrf=secret(),ttl=7200;
    db.tx(()=>{if(token){db.sql.prepare('DELETE FROM sessions WHERE hash=?').run(digest(token));db.sql.prepare('DELETE FROM guest_sessions WHERE hash=?').run(digest(token));}db.sql.prepare('INSERT INTO guest_sessions VALUES(?,?,?)').run(digest(value),csrf,at+ttl*1000);});
    res.setHeader('Set-Cookie',`${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${ttl}${secure}`);
    return json(200,{csrf,role:'guest'});
   }
   if(['/api/login','/api/guest/login'].includes(path)&&req.method==='POST'){
    const role=path==='/api/guest/login'?'guest':'owner';
    if(req.headers.origin!==origin)throw new AppError(403,'Для входа нужен запрос с этого сайта.');
    const key=role+':'+req.socket.remoteAddress,rate=failures.get(key);
    if(rate&&rate.until>at&&rate.count>=5)throw new AppError(429,'Слишком много попыток. Повторите через 15 минут.');
    const input=await body(req),account=db.sql.prepare(role==='guest'?'SELECT password FROM guest_access WHERE id=1':'SELECT password FROM account WHERE id=1').get();
    if(!verifyPassword(input.password,account?.password)){failures.set(key,{count:rate?.until>at?rate.count+1:1,until:rate?.until>at?rate.until:at+900000});throw new AppError(401,'Неверный пароль или вход ещё не настроен.');}
    failures.delete(key);const value=secret(),csrf=secret();
    const ttl=role==='guest'?7200:43200;
    db.tx(()=>{if(token){db.sql.prepare('DELETE FROM sessions WHERE hash=?').run(digest(token));db.sql.prepare('DELETE FROM guest_sessions WHERE hash=?').run(digest(token));}db.sql.prepare(role==='guest'?'INSERT INTO guest_sessions VALUES(?,?,?)':'INSERT INTO sessions VALUES(?,?,?)').run(digest(value),csrf,at+ttl*1000);});
    res.setHeader('Set-Cookie',`${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${ttl}${secure}`);
    return json(200,{csrf,role});
   }
   if(!session)throw new AppError(401,'Войдите в свой журнал.');
   if(req.method!=='GET'&&(req.headers.origin!==origin||req.headers['x-csrf-token']!==session.csrf))throw new AppError(403,'Проверка безопасности запроса не пройдена. Перезагрузите страницу.');
   if(path==='/api/logout'&&req.method==='POST'){db.sql.prepare(session.role==='guest'?'DELETE FROM guest_sessions WHERE hash=?':'DELETE FROM sessions WHERE hash=?').run(digest(token));res.setHeader('Set-Cookie',`${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);return json(200,{ok:true});}
   // Guest sessions authorize only the ephemeral client demo, never the owner's API.
   if(session.role!=='owner')throw new AppError(403,'Гостевой доступ разрешает только демонстрацию. Личные данные недоступны.');
   if(path==='/api/guest-access'&&req.method==='GET')return json(200,{enabled:db.guestEnabled()});
   if(path==='/api/guest-access'&&req.method==='POST'){const input=await body(req);db.setGuestPassword(input.password);return json(200,{enabled:true});}
   if(path==='/api/guest-access'&&req.method==='DELETE'){db.disableGuests();return json(200,{enabled:false});}
   if(path==='/api/journal'&&req.method==='GET')return json(200,db.read());
   if(path==='/api/journal'&&req.method==='PUT'){
    const input=await body(req);if(!Number.isSafeInteger(input.revision)||input.revision<0)throw new AppError(400,'Некорректная версия журнала.');
    return json(200,db.save(input.workspace,input.revision,input.requestId,input.clear??false));
   }
   if(path==='/api/telegram'&&req.method==='GET'){
    const last=db.sql.prepare('SELECT date,start,end,status,attempts,error FROM prompts ORDER BY created DESC LIMIT 1').get()??null;
    return json(200,{configured:!!bot,ready:!!bot?.ready,connected:!!db.link(),username:bot?.username??null,error:bot?.statusError??'',last});
   }
   if(path==='/api/telegram/link'&&req.method==='POST'){
    if(!bot?.ready||!bot.username)throw new AppError(503,'Бот пока недоступен. Проверьте токен и подключение сервера к Telegram.');
    if(db.link())throw new AppError(409,'Бот уже привязан.');const code=db.makeLink();return json(200,{url:`https://t.me/${bot.username}?start=${code}`,expiresIn:600});
   }
   if(path==='/api/telegram'&&req.method==='DELETE'){db.unlink();return json(200,{ok:true});}
   throw new AppError(404,'Не найдено.');
  }catch(error){const unexpected=error.code?.startsWith('ERR_SQLITE')||error.code?.startsWith('SQLITE');json(unexpected?500:error.status??400,{error:unexpected?'Ошибка базы данных. Запрос не сохранён.':error.message||'Ошибка запроса.'});}
 });
 server.requestTimeout=20000;server.headersTimeout=5000;server.keepAliveTimeout=3000;server.maxConnections=50;server.maxHeadersCount=40;
 return server;
}

export {JournalDB};
