// Development-only static preview. No API, user data, authentication or bot.
import {createServer} from 'node:http';
import {networkInterfaces} from 'node:os';
import {readFile,realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,sep,extname} from 'node:path';
import {inlineScriptHashes,contentPolicy,securityHeaders} from './security.mjs';
const defaultRoot=resolve(fileURLToPath(new URL('../',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const allowed=new Set(['index.html','styles.css','mobile.css','app.mjs','domain.mjs','storage.mjs','remote.mjs','form-drafts.mjs','sync-view.mjs','telegram-platform.mjs','i18n.mjs','favicon.svg','ritm-preview.html','assets/github-preview.svg','assets/rhythm-forest.png','assets/scenes/dawn.jpg','assets/scenes/mountains.jpg','assets/scenes/lake.jpg','assets/scenes/meadow.jpg','assets/scenes/coast.jpg']);
for(const scene of ['dawn','mountains','lake','meadow','coast'])allowed.add('assets/scenes/'+scene+'.svg');
const pages=new Set(['/','/today','/journal','/stats','/trends','/settings']);
const privateIPv4=address=>/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address);
export const lanAddresses=()=>[...new Set(Object.values(networkInterfaces()).flat().filter(a=>a&&a.family==='IPv4'&&!a.internal&&privateIPv4(a.address)).map(a=>a.address))];
export function createPreviewServer({root=defaultRoot,lan=false,addresses=lanAddresses()}={}){
 const hosts=new Set(['127.0.0.1','localhost',...(lan?addresses:[])]);
 const server=createServer(async(req,res)=>{
  for(const [key,value] of Object.entries(securityHeaders()))res.setHeader(key,value);
  const finish=(status,message)=>{res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8'});res.end(req.method==='HEAD'?undefined:message);};
  try{
   const host=req.headers.host||'',match=/^([a-z0-9.-]+)(?::(\d+))?$/i.exec(host);
   if(!match||!hosts.has(match[1].toLowerCase())||(match[2]&&Number(match[2])!==server.address()?.port)||(!match[2]&&server.address()?.port!==80))return finish(403,'Host not allowed');
   if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return finish(405,'Method not allowed');}
   const pathname=new URL(req.url,'http://localhost').pathname;
   const name=pages.has(pathname)?'index.html':decodeURIComponent(pathname).replace(/^\//,'');
   if(!allowed.has(name))return finish(404,'Not found');
   const path=await realpath(resolve(root,name)),base=await realpath(root);
   if(!path.startsWith(base+sep))return finish(404,'Not found');
   const body=await readFile(path);
   if(name.endsWith('.html'))res.setHeader('Content-Security-Policy',contentPolicy(inlineScriptHashes(body.toString('utf8'))));
   res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Content-Length':body.length});res.end(req.method==='HEAD'?undefined:body);
  }catch{return finish(404,'Not found');}
 });
 server.headersTimeout=5000;server.requestTimeout=10000;server.keepAliveTimeout=3000;server.maxHeadersCount=40;server.maxConnections=50;
 return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT||4173),lan=process.argv.includes('--lan'),addresses=lanAddresses();
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT должен быть целым числом от 1 до 65535.');
 const server=createPreviewServer({lan,addresses});
 server.listen(port,lan?'0.0.0.0':'127.0.0.1',()=>{
  console.log(`Ритм — локальный предпросмотр: http://127.0.0.1:${port}`);
  if(lan){for(const address of addresses)console.log(`Телефон в той же сети Wi-Fi: http://${address}:${port}`);console.log('Временный просмотр по HTTP в доверенной сети. Используйте демоданные. Остановка — Ctrl+C.');}
 });
 server.on('error',error=>{console.error(error.message);process.exitCode=1;});
}
