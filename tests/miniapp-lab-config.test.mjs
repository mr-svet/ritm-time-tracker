import test from 'node:test';
import assert from 'node:assert/strict';
import {loadConfig} from '../server/config.mjs';
test('Bot polling remains enabled by default and can be explicitly disabled for the lab',()=>{
 assert.equal(loadConfig({}).botPollingEnabled,true);
 assert.equal(loadConfig({TELEGRAM_POLLING_ENABLED:'0',APP_PATH_PREFIX:'/miniapp-test'}).botPollingEnabled,false);
 assert.equal(loadConfig({APP_PATH_PREFIX:'/miniapp-test'}).basePath,'/miniapp-test');
 for(const APP_PATH_PREFIX of ['/', '//other', '/test/', '/test?x=1', '/test/a', '/test#x'])assert.throws(()=>loadConfig({APP_PATH_PREFIX}));
 assert.throws(()=>loadConfig({TELEGRAM_POLLING_ENABLED:'false'}));
});
