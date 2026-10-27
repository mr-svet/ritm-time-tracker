import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreviewServer} from '../tools/preview.mjs';
test('Static preview serves draft, sync and Telegram platform modules used by app.mjs',async t=>{
 const server=createPreviewServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 const base='http://127.0.0.1:'+server.address().port;
 for(const file of ['form-drafts.mjs','sync-view.mjs','telegram-platform.mjs']){const response=await fetch(base+'/'+file);assert.equal(response.status,200,file);assert.match(response.headers.get('content-type'),/javascript/);}
});
