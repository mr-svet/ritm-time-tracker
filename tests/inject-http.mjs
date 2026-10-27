import {Readable} from 'node:stream';

// Exercise the actual HTTP handler without binding a socket. Transport/client
// compatibility still needs an ordinary server run and real Telegram clients.
export function inject(server,url,{method='GET',headers={},body}={}){
 return new Promise(resolve=>{
  const req=Readable.from(body===undefined?[]:[Buffer.from(body)]);
  req.url=new URL(url).pathname+new URL(url).search;req.method=method;
  req.headers=Object.fromEntries(new Headers({host:new URL(url).host,...headers}));
  req.socket={remoteAddress:'127.0.0.1'};
  const output=new Headers();let status=200;
  const res={setHeader:(k,v)=>output.set(k,v),getHeader:k=>output.get(k),removeHeader:k=>output.delete(k),writeHead:(code,h={})=>{status=code;for(const [k,v] of Object.entries(h))output.set(k,v);},end:data=>resolve(new Response(data,{status,headers:output}))};
  server.emit('request',req,res);
 });
}
