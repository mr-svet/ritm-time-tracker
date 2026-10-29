import {createServer} from 'node:http';
import {feedbackPage} from './agentation.mjs';
import {cityWeather} from './weather.mjs';
import {readFile,realpath} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {JournalDB,AppError,digest,secret,verifyPassword} from './database.mjs';
import {validateTelegramInitData} from './telegram-auth.mjs';
import {LIMITS,ValidationError} from '../domain.mjs';
import {securityHeaders,contentPolicy} from '../tools/security.mjs';
import {validatePublicOrigin} from './config.mjs';
import {clientAddress,parseTrustedProxies} from './http-security.mjs';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const files=new Set(['index.html','app.mjs','domain.mjs','storage.mjs','remote.mjs','telegram.mjs','form-drafts.mjs','sync-view.mjs','telegram-platform.mjs','i18n.mjs','styles.css','mobile.css','favicon.svg','assets/github-preview.svg','assets/rhythm-forest.png','assets/scenes/dawn.jpg','assets/scenes/mountains.jpg','assets/scenes/lake.jpg','assets/scenes/meadow.jpg','assets/scenes/coast.jpg']);
for(const scene of ['dawn','mountains','lake','meadow','coast'])files.add('assets/scenes/'+scene+'.svg');
const landingPages=new Map([['/','landing/en.html'],['/en','landing/en.html'],['/ru','landing/ru.html']]);
for(const name of ['landing/en.html','landing/ru.html','landing/breathe.css','landing/landing.mjs','landing/breathe-forest.png','landing/breathe-forest-fast.jpg'])files.add(name);
files.add('agentation/panel.mjs');
const pages=new Set(['/today','/journal','/stats','/trends','/settings']);
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
async function body(req,maxBytes=4096){
 if(req.headers['content-type']!=='application/json')throw new AppError(415,'Ожидается application/json.');
 const declared=req.headers['content-length'];
 if(declared!==undefined&&(!/^\d+$/.test(declared)||Number(declared)>maxBytes))throw new AppError(413,'Слишком большой запрос.');
 let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>maxBytes)throw new AppError(413,'Слишком большой запрос.');chunks.push(chunk);}
 let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AppError(400,'Некорректный JSON.');}
 if(input===null||typeof input!=='object'||Array.isArray(input))throw new AppError(400,'Ожидается объект JSON.');
 return input;
}
export function createAppServer({db,bot=null,publicOrigin=null,trustedProxies=[],telegramToken=null,basePath=''}={}){
 if(basePath&&!/^\/[a-z0-9-]{1,60}$/.test(basePath))throw new Error('Некорректный базовый путь.');
 if(publicOrigin)publicOrigin=validatePublicOrigin(publicOrigin);
 const proxyAddresses=typeof trustedProxies==='function'?()=>parseTrustedProxies(trustedProxies().join(',')):(()=>{const fixed=parseTrustedProxies(trustedProxies.join(','));return ()=>fixed;})();
 const cookieName=publicOrigin?'__Host-ritm_session':'ritm_session',secure=publicOrigin?'; Secure':'';
 const failures=new Map();let lastCleanup=0;
 const reserve=(key,limit,at,message)=>{
  const previous=failures.get(key),rate=previous?.until>at?previous:{count:0,until:at+900000};
  if(rate.count>=limit)throw new AppError(429,message);
  if(!failures.has(key)&&failures.size>=10000)throw new AppError(503,'Вход временно перегружен. Повторите позже.');
  // Reserve before awaiting the body so parallel requests cannot bypass the limit.
  rate.count++;failures.set(key,rate);
 };
 const server=createServer(async(req,res)=>{
  for(const [key,value] of Object.entries(securityHeaders(contentPolicy().replace("connect-src 'none'","connect-src 'self'"))))res.setHeader(key,value);
  if(publicOrigin)res.setHeader('Strict-Transport-Security','max-age=86400');
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  try{
   const host=req.headers.host,port=server.address()?.port;
   if(!(publicOrigin?[new URL(publicOrigin).host]:['127.0.0.1:'+port,'localhost:'+port]).includes(host))throw new AppError(403,'Недопустимый Host.');
   const origin=publicOrigin||'http://'+host;
   const requestPath=new URL(req.url,origin).pathname;
   if(basePath&&requestPath!==basePath&&!requestPath.startsWith(basePath+'/'))throw new AppError(404,'Не найдено.');
   const path=basePath?(requestPath.slice(basePath.length)||'/'):requestPath;
   const miniapp=req.headers['x-ritm-client']==='miniapp';
   const activeCookie=miniapp?(publicOrigin?'__Host-ritm_miniapp':'ritm_miniapp'):cookieName;
   const sameSite=miniapp&&publicOrigin?'None':'Strict';
   if(path==='/tg'){
    res.setHeader('Content-Security-Policy',contentPolicy().replace("connect-src 'none'","connect-src 'self'").replace("script-src 'self'","script-src 'self' https://telegram.org").replace("frame-ancestors 'none'","frame-ancestors https://web.telegram.org https://webk.telegram.org https://webz.telegram.org"));
    res.removeHeader('X-Frame-Options');
   }
   // External links may load the public document shell. Its static allowlist
   // contains no user data; API authorization and CSRF checks still apply.
   const miniappFrame=path==='/tg'&&['GET','HEAD'].includes(req.method)&&req.headers['sec-fetch-mode']==='navigate'&&req.headers['sec-fetch-dest']==='iframe';
   const publicNavigation=miniappFrame||!path.startsWith('/api/')&&['GET','HEAD'].includes(req.method)&&req.headers['sec-fetch-mode']==='navigate'&&req.headers['sec-fetch-dest']==='document';
   if(!publicNavigation){
    if(req.headers.origin&&req.headers.origin!==origin)throw new AppError(403,'Запрос с другого сайта запрещён.');
    if(req.headers['sec-fetch-site']==='cross-site')throw new AppError(403,'Запрос с другого сайта запрещён.');
   }
   if(!path.startsWith('/api/')){
    if(!['GET','HEAD'].includes(req.method))throw new AppError(405,'Метод не поддерживается.');
    const name=landingPages.get(path)??((pages.has(path)||path==='/tg')?'index.html':decodeURIComponent(path).slice(1));if(!files.has(name))throw new AppError(404,'Не найдено.');
    let feedbackOwner=false;
    if(name.endsWith('.html')||name==='agentation/panel.mjs'){
     const ownerToken=new RegExp('(?:^|;\\s*)'+cookieName+'=([a-zA-Z0-9_-]{43})(?:;|$)').exec(req.headers.cookie||'')?.[1];
     feedbackOwner=!!(ownerToken&&db.sql.prepare('SELECT 1 FROM sessions WHERE hash=? AND expires>?').get(digest(ownerToken),Date.now()));
     if(name==='agentation/panel.mjs'&&!feedbackOwner)throw new AppError(403,'Для Agentation нужен вход владельца.');
    }
    const file=await realpath(resolve(root,name));if(!file.startsWith(root+sep))throw new AppError(404,'Не найдено.');
    let data=await readFile(file);if(name==='index.html')data=Buffer.from(data.toString().replace('<html ', '<html data-api="true" '));
    if(path==='/tg')data=Buffer.from(data.toString().replace('<html ','<html data-miniapp="true" ').replace('<script type="module" src="/app.mjs"></script>','<script src="https://telegram.org/js/telegram-web-app.js"></script><script type="module" src="/telegram.mjs"></script>'));
    if(['landing/en.html','landing/ru.html'].includes(name))res.setHeader('Content-Security-Policy',contentPolicy().replace("font-src 'none'","font-src data:"));
    if(name.endsWith('.html')&&path!=='/tg'){
     const feedback=feedbackPage({html:data.toString(),policy:String(res.getHeader('Content-Security-Policy')),url:new URL(req.url,origin),cookie:req.headers.cookie,secure:!!publicOrigin,owner:feedbackOwner});
     data=Buffer.from(feedback.html);res.setHeader('Content-Security-Policy',feedback.policy);
     if(feedback.setCookie)res.setHeader('Set-Cookie',feedback.setCookie);
    }
    if(name==='index.html'&&basePath)data=Buffer.from(data.toString().replace('<html ',`<html data-base-path="${basePath}" `).replaceAll('href="/','href="'+basePath+'/').replaceAll('src="/','src="'+basePath+'/'));
    // Cache only allowlisted public images. HTML, scripts and private API remain no-store.
    if(['.png','.jpg','.svg'].includes(extname(file))){
     const etag='"'+digest(data)+'"';
     res.setHeader('Cache-Control','public, max-age=0, must-revalidate');res.setHeader('ETag',etag);
     if(req.headers['if-none-match']?.split(',').some(value=>value.trim()===etag)){
      res.writeHead(304);res.end();return;
     }
    }
    res.writeHead(200,{'Content-Type':types[extname(file)],'Content-Length':data.length});res.end(req.method==='HEAD'?undefined:data);return;
   }
   if(!['GET','POST','PUT','DELETE'].includes(req.method))throw new AppError(405,'Метод не поддерживается.');
   if(path==='/api/health'&&req.method==='GET'){db.sql.prepare('SELECT 1').get();return json(200,{ok:true});}
   const at=Date.now();if(at-lastCleanup>60000){db.cleanup(at);for(const [key,rate] of failures)if(rate.until<=at)failures.delete(key);lastCleanup=at;}
   const address=clientAddress(req,proxyAddresses());
   const token=new RegExp('(?:^|;\\s*)'+activeCookie+'=([a-zA-Z0-9_-]{43})(?:;|$)').exec(req.headers.cookie||'')?.[1];
   const session=miniapp?(telegramToken&&token?db.sql.prepare("SELECT csrf,'owner' role FROM miniapp_sessions WHERE hash=? AND expires>? AND user_id=(SELECT user_id FROM telegram WHERE id=1)").get(digest(token),at):null):token?(db.sql.prepare("SELECT csrf,'owner' role FROM sessions WHERE hash=? AND expires>?").get(digest(token),at)??db.sql.prepare("SELECT csrf,'guest' role FROM guest_sessions WHERE hash=? AND expires>?").get(digest(token),at)):null;
   if(path==='/api/auth/telegram'&&req.method==='POST'){
    if(!miniapp||req.headers.origin!==origin)throw new AppError(403,'Недопустимый источник входа.');
    if(!telegramToken)throw new AppError(503,'Вход Telegram пока не настроен.');
    reserve('miniapp:'+address,30,at,'Слишком много попыток входа. Повторите позже.');
    const input=await body(req,20000),{userId}=validateTelegramInitData(input.initData,telegramToken,at);
    if(db.link()?.user_id!==userId)throw new AppError(403,'Этот Telegram не привязан к журналу. Подключите его в настройках сайта.');
    const value=secret(),csrf=secret(),ttl=43200;
    db.tx(()=>{if(token)db.sql.prepare('DELETE FROM miniapp_sessions WHERE hash=?').run(digest(token));db.sql.prepare('INSERT INTO miniapp_sessions VALUES(?,?,?,?)').run(digest(value),csrf,at+ttl*1000,userId);});
    res.setHeader('Set-Cookie',`${activeCookie}=${value}; HttpOnly; SameSite=${sameSite}; Path=/; Max-Age=${ttl}${secure}`);
    return json(200,{authenticated:true,role:'owner',csrf});
   }
   if(path==='/api/session'&&req.method==='GET')return json(200,{authenticated:!!session,role:session?.role??null,csrf:session?.csrf??null,guestEnabled:true,configured:!!db.sql.prepare('SELECT id FROM account').get()});
   if(miniapp&&['/api/login','/api/guest/login','/api/guest/preview','/api/guest-access','/api/telegram/link'].includes(path))throw new AppError(403,'Это действие доступно на сайте владельца.');
   if(path==='/api/guest/preview'&&req.method==='POST'){
    if(req.headers.origin!==origin)throw new AppError(403,'Для входа нужен запрос с этого сайта.');
    reserve('preview:'+address,30,at,'Слишком много попыток. Повторите позже.');
    const value=secret(),csrf=secret(),ttl=7200;
    db.tx(()=>{if(token){db.sql.prepare('DELETE FROM sessions WHERE hash=?').run(digest(token));db.sql.prepare('DELETE FROM guest_sessions WHERE hash=?').run(digest(token));}db.sql.prepare('INSERT INTO guest_sessions VALUES(?,?,?)').run(digest(value),csrf,at+ttl*1000);});
    res.setHeader('Set-Cookie',`${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${ttl}${secure}`);
    return json(200,{csrf,role:'guest'});
   }
   if(['/api/login','/api/guest/login'].includes(path)&&req.method==='POST'){
    const role=path==='/api/guest/login'?'guest':'owner';
    if(req.headers.origin!==origin)throw new AppError(403,'Для входа нужен запрос с этого сайта.');
    const key=role+':'+address;
    reserve(key,5,at,'Слишком много попыток. Повторите через 15 минут.');
    const input=await body(req),account=db.sql.prepare(role==='guest'?'SELECT password FROM guest_access WHERE id=1':'SELECT password FROM account WHERE id=1').get();
    if(!verifyPassword(input.password,account?.password))throw new AppError(401,'Неверный пароль или вход ещё не настроен.');
    failures.delete(key);const value=secret(),csrf=secret();
    const ttl=role==='guest'?7200:43200;
    db.tx(()=>{if(token){db.sql.prepare('DELETE FROM sessions WHERE hash=?').run(digest(token));db.sql.prepare('DELETE FROM guest_sessions WHERE hash=?').run(digest(token));}db.sql.prepare(role==='guest'?'INSERT INTO guest_sessions VALUES(?,?,?)':'INSERT INTO sessions VALUES(?,?,?)').run(digest(value),csrf,at+ttl*1000);});
    res.setHeader('Set-Cookie',`${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${ttl}${secure}`);
    return json(200,{csrf,role});
   }
   if(!session)throw new AppError(401,'Войдите в свой журнал.');
   if(req.method!=='GET'&&(req.headers.origin!==origin||req.headers['x-csrf-token']!==session.csrf))throw new AppError(403,'Проверка безопасности запроса не пройдена. Перезагрузите страницу.');
   if(path==='/api/logout'&&req.method==='POST'){db.sql.prepare(miniapp?'DELETE FROM miniapp_sessions WHERE hash=?':session.role==='guest'?'DELETE FROM guest_sessions WHERE hash=?':'DELETE FROM sessions WHERE hash=?').run(digest(token));res.setHeader('Set-Cookie',`${activeCookie}=; HttpOnly; SameSite=${sameSite}; Path=/; Max-Age=0${secure}`);return json(200,{ok:true});}
   // A forecast is public city data and is shared by owner and visitor sessions.
   if(path==='/api/weather'&&req.method==='GET'){
    reserve('weather:'+address,120,at,'Слишком много запросов погоды. Повторите позже.');
    const params=new URL(req.url,origin).searchParams;
    const value=await cityWeather({city:params.get('city'),timezone:params.get('timezone')});
    if(!value)return json(503,{error:'Погода временно недоступна.'});
    return json(200,value);
   }
   // Guest sessions authorize only the ephemeral client demo, never the owner's API.
   if(session.role!=='owner')throw new AppError(403,'Гостевой доступ разрешает только демонстрацию. Личные данные недоступны.');
   if(path==='/api/guest-access'&&req.method==='GET')return json(200,{enabled:db.guestEnabled()});
   if(path==='/api/guest-access'&&req.method==='POST'){const input=await body(req);db.setGuestPassword(input.password);return json(200,{enabled:true});}
   if(path==='/api/guest-access'&&req.method==='DELETE'){db.disableGuests();return json(200,{enabled:false});}
   if(path==='/api/journal'&&req.method==='GET')return json(200,db.read());
   if(path==='/api/journal'&&req.method==='PUT'){
    const input=await body(req,LIMITS.bytes+4096);if(!Number.isSafeInteger(input.revision)||input.revision<0)throw new AppError(400,'Некорректная версия журнала.');
    return json(200,db.save(input.workspace,input.revision,input.requestId,input.clear??false));
   }
   if(path==='/api/telegram'&&req.method==='GET'){
    const last=db.sql.prepare('SELECT date,start,end,status,attempts,error FROM prompts ORDER BY created DESC LIMIT 1').get()??null;
    return json(200,{miniAppError:bot?.miniAppError??'',configured:!!bot,ready:!!bot?.ready,connected:!!db.link(),username:bot?.username??null,error:bot?.statusError??'',last});
   }
   if(path==='/api/telegram/link'&&req.method==='POST'){
    if(!bot?.ready||!bot.username)throw new AppError(503,'Бот пока недоступен. Проверьте токен и подключение сервера к Telegram.');
    if(db.link())throw new AppError(409,'Бот уже привязан.');const code=db.makeLink();return json(200,{url:`https://t.me/${bot.username}?start=${code}`,expiresIn:600});
   }
   if(path==='/api/telegram'&&req.method==='DELETE'){db.unlink();return json(200,{ok:true});}
   throw new AppError(404,'Не найдено.');
  }catch(error){
   const sqlite=typeof error?.code==='string'&&(error.code.startsWith('ERR_SQLITE')||error.code.startsWith('SQLITE'));
   const expected=error instanceof AppError||error instanceof ValidationError;
   json(sqlite||!expected?500:error.status??400,{error:sqlite?'Ошибка базы данных. Запрос не сохранён.':expected?error.message:'Ошибка сервера. Повторите попытку позже.'});
  }
 });
 server.requestTimeout=20000;server.headersTimeout=5000;server.keepAliveTimeout=3000;server.maxConnections=50;server.maxHeadersCount=40;
 return server;
}

export {JournalDB};
