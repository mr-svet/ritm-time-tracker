import test from 'node:test';
import assert from 'node:assert/strict';
import {t,setLanguage,getLanguage} from '../i18n.mjs';
test('Stage-two conflict and recovery actions have complete English labels',()=>{
 const previous=getLanguage();setLanguage('en');try{
 for(const phrase of ['Журнал изменён одновременно','Открыть свежий журнал?','Повторить сохранение','Скачать прежний вариант','Статус сохранения неизвестен. Повтор проверит ту же операцию без создания дубля.'])assert.doesNotMatch(t(phrase),/[А-Яа-яЁё]/,phrase);
 }finally{setLanguage(previous);}
});
