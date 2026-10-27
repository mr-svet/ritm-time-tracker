// Same-origin API only. No password, session cookie or bot token in localStorage.
export class RemoteJournal {
 constructor(){this.role=null;this.guestEnabled=false;this.csrf=null;this.revision=0;this.authenticated=false;this.pending=false;this.unsaved=null;this.telegram={};}
 async request(path,{method='GET',body}={}){
  if(this.role==='guest'&&!['session','logout','health','login','guest/login','guest/preview'].includes(path))throw new Error('В гостевом режиме личный API недоступен.');
  let response;try{response=await fetch('/api/'+path,{method,credentials:'same-origin',headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(method!=='GET'&&this.csrf?{'X-CSRF-Token':this.csrf}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});}catch{throw new Error('Сервер недоступен. Проверьте, что npm start запущен.');}
  const value=await response.json();if(!response.ok){const error=new Error(value.error||'Не удалось выполнить запрос.');error.status=response.status;throw error;}return value;
 }
 async session(){const info=await this.request('session');this.authenticated=info.authenticated;this.role=info.role??(info.authenticated?'owner':null);this.guestEnabled=!!info.guestEnabled;this.csrf=info.csrf;return info;}
 async login(password,guest=false){const info=await this.request(guest?'guest/login':'login',{method:'POST',body:{password}});this.csrf=info.csrf;this.role=info.role||'owner';this.authenticated=true;}
 async preview(){const info=await this.request('guest/preview',{method:'POST'});this.csrf=info.csrf;this.role='guest';this.authenticated=true;}
 async read(){const info=await this.request('journal');this.revision=info.revision;return info.workspace;}
 async save(){const info=await this.request('journal',{method:'PUT',body:this.unsaved});this.revision=info.revision;this.unsaved=null;return info.workspace;}
}
