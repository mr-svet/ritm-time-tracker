import {JournalDB,createAppServer} from './http.mjs';
import {TelegramBot} from './bot.mjs';
import {loadConfig} from './config.mjs';
process.umask(0o077);
const {port,host,path,publicOrigin,trustedProxies}=loadConfig();
const db=new JournalDB(path);
if(!db.sql.prepare('SELECT id FROM account').get()){db.close();throw new Error('Сначала выполните npm run setup и сохраните пароль владельца.');}
const token=process.env.TELEGRAM_BOT_TOKEN;
if(token&&!/^\d{5,16}:[a-zA-Z0-9_-]{30,100}$/.test(token)){db.close();throw new Error('Некорректный формат TELEGRAM_BOT_TOKEN в .env.');}
const siteURL=publicOrigin||`http://127.0.0.1:${port}`;
const bot=token?new TelegramBot(db,token,{siteURL}):null;
const server=createAppServer({db,bot,publicOrigin,trustedProxies});let stopping=false,botTask;
server.listen(port,host,()=>{
 console.log(`Ритм — сервер и база данных: ${siteURL}\nTelegram: ${bot?'подключение…':'токен не задан; сайт и база работают без бота'}`);
 if(bot)botTask=bot.run();
});
const stop=async()=>{if(stopping)return;stopping=true;bot?.stop();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await botTask;db.close();};
process.on('SIGINT',stop);process.on('SIGTERM',stop);
server.on('error',()=>{console.error('Не удалось запустить сервер. Возможно, порт занят. Остановите старый npm run dev или задайте PORT.');bot?.stop();db.close();process.exitCode=1;});
