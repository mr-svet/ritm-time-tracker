import test from 'node:test';
import assert from 'node:assert/strict';
import {JournalDB,AppError,passwordHash} from '../server/database.mjs';
import {createAppServer} from '../server/http.mjs';
import {inject} from './inject-http.mjs';
import {uid} from '../domain.mjs';
const origin='https://errors.audit';

test('unexpected internal exceptions never expose their message or chosen status',async()=>{
 for(const error of [new Error('PRIVATE_INTERNAL_CANARY'),Object.assign(new Error('/private/internal/file'),{code:'ENOENT',status:401}),Object.assign(new Error('PRIVATE_NUMERIC_CODE'),{code:123}),null]){
  const db={cleanup(){},sql:{prepare(){throw error;}}},server=createAppServer({db,publicOrigin:origin});
  const response=await inject(server,origin+'/api/session',{headers:{Origin:origin}});
  assert.equal(response.status,500);assert.deepEqual(await response.json(),{error:'Ошибка сервера. Повторите попытку позже.'});
 }
});
test('expected HTTP errors and SQLite failures retain safe responses',async()=>{
 for(const [error,status,message] of [[new AppError(503,'Сервис временно недоступен.'),503,'Сервис временно недоступен.'],[Object.assign(new Error('PRIVATE_SQLITE_CANARY'),{code:'ERR_SQLITE_ERROR'}),500,'Ошибка базы данных. Запрос не сохранён.']]){
  const server=createAppServer({db:{cleanup(){},sql:{prepare(){throw error;}}},publicOrigin:origin});
  const response=await inject(server,origin+'/api/session',{headers:{Origin:origin}});
  assert.equal(response.status,status);assert.deepEqual(await response.json(),{error:message});
 }
});
test('journal validation stays actionable and rejected data never replaces the journal',async t=>{
 const db=new JournalDB(':memory:');t.after(()=>db.close());
 const password='synthetic-error-contract-password';db.sql.prepare('INSERT INTO account VALUES(1,?)').run(passwordHash(password));
 const server=createAppServer({db,publicOrigin:origin});
 const request=(path,{method='GET',body,headers={}}={})=>inject(server,origin+'/api/'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const login=await request('login',{method:'POST',body:{password}});assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie').split(';')[0],{csrf}=await login.json(),state=db.read();
 state.workspace.categories[0].name='';
 const result=await request('journal',{method:'PUT',headers:{Cookie:cookie,'X-CSRF-Token':csrf},body:{...state,requestId:uid()}});
 assert.equal(result.status,400);assert.match((await result.json()).error,/Некорректное название/);
 assert.equal(db.read().revision,state.revision);assert.notEqual(db.read().workspace.categories[0].name,'');
});
