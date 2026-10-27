// Explicit local-only QA harness. Never load .env, production data or a live bot.
import {createHmac} from 'node:crypto';
import {JournalDB,passwordHash} from '../server/database.mjs';
import {createAppServer} from '../server/http.mjs';
import {processUpdate} from '../server/bot.mjs';
import {emptyWorkspace,uid,localNow,clock} from '../domain.mjs';
const port=Number(process.env.QA_PORT||4198),token='123456:synthetic-qa-token-never-used-for-telegram';
const db=new JournalDB(':memory:');db.sql.prepare('INSERT INTO account VALUES(1,?)').run(passwordHash('synthetic-qa-password-only'));
const w=emptyWorkspace();w.settings={...w.settings,timezone:'UTC',start:0,end:1440,step:30,days:[0,1,2,3,4,5,6],confirmed:true};
const local=localNow('UTC'),start=Math.max(0,Math.floor(local.minute/30)*30-60);
w.displayName='QA · artificial journal';w.entries=[{id:uid(),date:local.date,start,end:start+30,text:'QA original activity',category:w.categories[0]?.id||'',project:'',source:'site',activities:[{id:uid(),at:null,text:'QA original activity'}]}];
w.dayEvents=[{date:local.date,type:'wake',at:local.date+'T00:00:00.000Z',timezone:'UTC'}];db.save(w,db.read().revision,uid());db.bind(db.makeLink(),111,111);
let nextSave='',botNumber=0,dropRemaining=0;const state={putAttempts:0,droppedResponses:0,delayedResponses:0};
const server=createAppServer({db,telegramToken:token}),handler=server.listeners('request')[0];server.removeAllListeners('request');
const json=(res,value)=>{res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
const status=()=>({revision:db.read().revision,entries:db.read().workspace.entries.map(({id,text,date,start,end,source,activities})=>({id,text,date,start,end,source,activities:activities?.map(item=>item.text)||[text]})),...state});
server.on('request',async(req,res)=>{
 const path=new URL(req.url,'http://127.0.0.1').pathname;
 if(!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)){res.writeHead(403);res.end();return;}
 if(path==='/__qa/status'){json(res,status());return;}
 if(path==='/__qa/control'&&req.method==='POST'){
  const chunks=[];for await(const chunk of req)chunks.push(chunk);const input=JSON.parse(Buffer.concat(chunks));
  if(input.action==='delay')nextSave='delay';else if(input.action==='drop')dropRemaining=3;else if(input.action==='normal'){dropRemaining=0;nextSave='';}
  else if(input.action==='bot'){
   const at=Date.now();processUpdate(db,{update_id:900000+(++botNumber),message:{message_id:900000+botNumber,from:{id:111},chat:{id:111,type:'private'},date:Math.floor(at/1000),text:'QA bot activity '+botNumber}},at,'http://127.0.0.1:'+port);
  }
  json(res,{nextSave,...status()});return;
 }
 if(path==='/__qa'){
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(`<!doctype html><meta charset="utf-8"><title>Ritm local QA controls</title><h1>Artificial journal only</h1><button data-action="delay">Delay next save</button><button data-action="drop">Drop next save response</button><button data-action="normal">Clear response faults</button><button data-action="bot">Add bot activity</button><button data-action="status">Show status</button><pre id="result"></pre><script>document.addEventListener('click',async event=>{const action=event.target.dataset.action;if(!action)return;const response=action==='status'?await fetch('/__qa/status'):await fetch('/__qa/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});document.getElementById('result').textContent=JSON.stringify(await response.json(),null,2);});</script>`);return;
 }
 if(path==='/qa-telegram.mjs'){
  const fields=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:111,first_name:'QA'})});const key=createHmac('sha256','WebAppData').update(token).digest();fields.set('hash',createHmac('sha256',key).update([...fields].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>`${k}=${v}`).join('\n')).digest('hex'));
  res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end(`const listeners={};const root=document.documentElement;const sdk={initData:${JSON.stringify(fields.toString())},colorScheme:'light',safeAreaInset:{top:40,bottom:24,left:0,right:0},contentSafeAreaInset:{top:40,bottom:0,left:0,right:0},viewportStableHeight:innerHeight,viewportHeight:innerHeight,ready(){},expand(){},close(){root.dataset.qaClosed='true';document.title='QA returned to bot chat'},onEvent(name,fn){listeners[name]=fn},setHeaderColor(color){root.dataset.qaHeader=color},setBackgroundColor(){},isVersionAtLeast(){return true},enableClosingConfirmation(){root.dataset.qaClosing='true'},disableClosingConfirmation(){root.dataset.qaClosing='false'},BackButton:{onClick(){},show(){},hide(){}}};window.Telegram={WebApp:sdk};const controls=document.createElement('div');controls.style='position:fixed;top:0;left:0;z-index:9999;background:white;color:black;font:12px sans-serif';controls.innerHTML='<button id="qa-theme">QA: Telegram theme</button><button id="qa-keyboard">QA: keyboard</button>';document.body.append(controls);document.getElementById('qa-theme').onclick=()=>{sdk.colorScheme=sdk.colorScheme==='light'?'dark':'light';listeners.themeChanged?.()};document.getElementById('qa-keyboard').onclick=()=>{sdk.viewportHeight=sdk.viewportHeight===sdk.viewportStableHeight?Math.min(420,sdk.viewportStableHeight-180):sdk.viewportStableHeight;listeners.viewportChanged?.()};`);return;
 }
 if(path==='/api/weather'){res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"Weather disabled in local QA"}');return;}
 if(path==='/tg'){
  const writeHead=res.writeHead.bind(res),end=res.end.bind(res);let responseStatus=200,responseHeaders={};
  res.writeHead=(code,headers={})=>{responseStatus=code;responseHeaders=headers;return res;};
  res.end=data=>{const output=Buffer.from(String(data).replace('src="https://telegram.org/js/telegram-web-app.js"','src="/qa-telegram.mjs"'));writeHead(responseStatus,{...responseHeaders,'Content-Length':output.length});end(output);};
 }
 if(path==='/api/journal'&&req.method==='PUT'){
  state.putAttempts++;const fault=dropRemaining>0?'drop':nextSave;if(dropRemaining>0)dropRemaining--;nextSave='';const end=res.end.bind(res);
  if(fault==='drop')res.end=data=>{state.droppedResponses++;res.destroy();};
  if(fault==='delay')res.end=data=>{state.delayedResponses++;setTimeout(()=>end(data),5000);};
 }
 await handler(req,res);
});
server.listen(port,'127.0.0.1',()=>console.log('Local QA: http://127.0.0.1:'+port+'/tg · controls /__qa · original interval '+clock(start)+'–'+clock(start+30)));
const stop=()=>{server.closeAllConnections();server.close(()=>{db.close();});};process.on('SIGINT',stop);process.on('SIGTERM',stop);
