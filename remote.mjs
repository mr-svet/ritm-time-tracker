// Same-origin API only. No password, session cookie or bot token in localStorage.
export class RemoteJournal {
 constructor(){this.miniapp=document.documentElement.dataset.miniapp==='true';this.role=null;this.guestEnabled=false;this.csrf=null;this.revision=0;this.authenticated=false;this.pending=false;this.unsaved=null;this.telegram={};this.conflict=null;this.uncertain=false;this.recovery=null;this.draftSnapshot=[];}
 async request(path,{method='GET',body}={}){
  if(this.role==='guest'&&!['session','logout','health','login','guest/login','guest/preview'].includes(path))throw new Error('В гостевом режиме личный API недоступен.');
  let response,value;
  try{
   response=await fetch((document.documentElement.dataset.basePath||'')+'/api/'+path,{method,credentials:'same-origin',headers:{...(this.miniapp?{'X-Ritm-Client':'miniapp'}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...(method!=='GET'&&this.csrf?{'X-CSRF-Token':this.csrf}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
   value=await response.json();
  }catch{const error=new Error('Не удалось получить ответ сервера. Проверьте подключение.');error.uncertain=method!=='GET';throw error;}
  if(!response.ok){const error=new Error(value.error||'Не удалось выполнить запрос.');error.status=response.status;error.uncertain=method!=='GET'&&response.status>=500;throw error;}
  return value;
 }
 async session(){let info=await this.request('session');if(this.miniapp&&!info.authenticated){const initData=window.Telegram?.WebApp?.initData;if(!initData)throw new Error('Откройте Ritm кнопкой в Telegram-боте.');await this.request('auth/telegram',{method:'POST',body:{initData}});info=await this.request('session');if(!info.authenticated)throw new Error('Telegram не сохранил cookie входа. Откройте приложение в другом клиенте Telegram или используйте сайт.');}this.authenticated=info.authenticated;this.role=info.role??(info.authenticated?'owner':null);this.guestEnabled=!!info.guestEnabled;this.csrf=info.csrf;return info;}
 async login(password,guest=false){const info=await this.request(guest?'guest/login':'login',{method:'POST',body:{password}});this.csrf=info.csrf;this.role=info.role||'owner';this.authenticated=true;}
 async preview(){const info=await this.request('guest/preview',{method:'POST'});this.csrf=info.csrf;this.role='guest';this.authenticated=true;}
 async read(){const info=await this.request('journal');this.revision=info.revision;return info.workspace;}
 async save(){
  if(this.conflict)throw new Error('Сначала сравните версии журнала. Повтор устаревшей записи заблокирован.');
  if(!this.unsaved)throw new Error('Нет операции для сохранения.');
  const operation=this.unsaved;
  try{
   const info=await this.request('journal',{method:'PUT',body:operation});
   this.revision=info.revision;if(this.unsaved===operation)this.unsaved=null;this.uncertain=false;
   return info.workspace;
  }catch(error){
   this.uncertain=!!error.uncertain;
   if(error.status===409){
    this.conflict={local:structuredClone(operation),server:null};
    try{this.conflict.server=await this.request('journal');}catch{}
   }
   throw error;
  }
 }
 async loadFresh(){
  if(this.pending)throw new Error('Дождитесь ответа сервера.');
  if(this.uncertain)throw new Error('Результат сохранения неизвестен. Сначала повторите ту же операцию.');
  const info=await this.request('journal');
  // Keep the rejected operation available for explicit download after loading.
  if(this.unsaved)this.recovery=structuredClone(this.unsaved);
  this.revision=info.revision;this.unsaved=null;this.conflict=null;this.uncertain=false;
  return info.workspace;
 }
}
