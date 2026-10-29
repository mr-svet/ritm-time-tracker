import test from 'node:test';
import assert from 'node:assert/strict';
import {JournalDB} from '../server/database.mjs';
import {createAppServer} from '../server/http.mjs';

test('public scene images revalidate without downloading unchanged bytes; personal paths stay no-store',async t=>{
 const db=new JournalDB(':memory:'),server=createAppServer({db});
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));db.close();});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const image=await fetch(base+'/assets/scenes/meadow.svg');
 assert.equal(image.status,200);assert.match(image.headers.get('cache-control'),/public/);const etag=image.headers.get('etag');assert.ok(etag);await image.text();
 const unchanged=await fetch(base+'/assets/scenes/meadow.svg',{headers:{'If-None-Match':etag}});
 assert.equal(unchanged.status,304);assert.equal(await unchanged.text(),'');
 for(const path of ['/today','/api/session','/api/journal'])assert.match((await fetch(base+path)).headers.get('cache-control'),/no-store/);
});
