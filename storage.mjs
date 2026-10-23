import {createStore,normalizeStore,parseStore} from './domain.mjs';

export function loadJournal(storage,key){
 let raw=null,backup=null;
 try{
  raw=storage.getItem(key);
  if(raw===null)return {store:createStore(),corruptRaw:null,backup:null,error:''};
  return {store:parseStore(raw),corruptRaw:null,backup:null,error:''};
 }catch{
  try{const candidate=storage.getItem(key+'-backup');if(candidate){parseStore(candidate);backup=candidate;}}catch{}
  return {store:backup?parseStore(backup):createStore(),corruptRaw:raw,backup,error:raw?'Локальный журнал повреждён или не соответствует формату. Исходник сохранён. Можно скачать его и восстановить предыдущую копию, если она доступна.':'Хранилище браузера недоступно. Изменения будут доступны только в этой вкладке; скачивайте JSON.'};
 }
}
export function saveJournal(storage,key,value,{resetBackup=false,replaceCorrupt}={}){
 const encoded=JSON.stringify(normalizeStore(value));
 parseStore(encoded);
 // A broken old value must never silently be replaced by a new demo workspace.
 const old=storage.getItem(key);
 if(replaceCorrupt!==undefined){if(old!==replaceCorrupt)throw new Error('Данные изменены в другой вкладке.');if(!resetBackup)throw new Error('Нужна явная очистка повреждённых данных.');}
 else if(old!==null)parseStore(old);
 if(!resetBackup&&replaceCorrupt===undefined&&old===encoded)return;
 if(resetBackup)storage.setItem(key+'-backup',encoded);
 else if(old!==null)storage.setItem(key+'-backup',old);
 storage.setItem(key,encoded);
}
export function restoreJournal(storage,key,backup,expectedRaw){
 const recovered=parseStore(backup);
 if(storage.getItem(key)!==expectedRaw)throw new Error('Данные изменены в другой вкладке. Сначала перезагрузите страницу.');
 storage.setItem(key,JSON.stringify(recovered));
 return recovered;
}
