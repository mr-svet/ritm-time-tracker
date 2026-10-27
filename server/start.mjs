import {JournalDB,createAppServer} from './http.mjs';
import {TelegramBot} from './bot.mjs';
import {loadConfig} from './config.mjs';
import {createProxyTrust} from './proxy-trust.mjs';
process.umask(0o077);
const {port,host,path,publicOrigin,trustedProxies,trustedProxyHosts,basePath,botPollingEnabled}=loadConfig();
const db=new JournalDB(path);
if(!db.sql.prepare('SELECT id FROM account').get()){db.close();throw new Error('Сначала выполните npm run setup и сохраните пароль владельца.');}
const token=process.env.TELEGRAM_BOT_TOKEN;
if(token&&!/^\d{5,16}:[a-zA-Z0-9_-]{30,100}$/.test(token)){db.close();throw new Error('Некорректный формат TELEGRAM_BOT_TOKEN в .env.');}
const miniAppEnabled=process.env.MINI_APP_ENABLED==='1';
if(miniAppEnabled&&(!publicOrigin||!token)){db.close();throw new Error('Mini App требует HTTPS APP_ORIGIN и настроенный TELEGRAM_BOT_TOKEN.');}
const siteURL=publicOrigin||`http://127.0.0.1:${port}`;
const bot=token&&botPollingEnabled?new TelegramBot(db,token,{siteURL,miniAppURL:miniAppEnabled?publicOrigin+basePath+'/tg':null}):null;
const proxyTrust=createProxyTrust({hosts:trustedProxyHosts,addresses:trustedProxies});
await proxyTrust.refresh();proxyTrust.start();
const server=createAppServer({db,bot,publicOrigin,basePath,trustedProxies:proxyTrust.addresses,telegramToken:miniAppEnabled?token:null});let stopping=false,botTask;
server.listen(port,host,()=>{
 console.log(`Ритм — сервер и база данных: ${siteURL}\nTelegram: ${bot?'подключение…':token?'получение сообщений отключено; токен используется только для входа Mini App':'токен не задан; сайт и база работают без бота'}`);
 if(bot)botTask=bot.run();
});
const stop=async()=>{if(stopping)return;stopping=true;proxyTrust.close();bot?.stop();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await botTask;db.close();};
process.on('SIGINT',stop);process.on('SIGTERM',stop);
server.on('error',()=>{console.error('Не удалось запустить сервер. Возможно, порт занят. Остановите старый npm run dev или задайте PORT.');proxyTrust.close();bot?.stop();db.close();process.exitCode=1;});
