import {digest} from './database.mjs';
import {handleSplit,rememberSplitMessage} from './split-flow.mjs';
import {uid,clock,localNow,schedule,weekday,overlap,ensureDay,validateWorkspace,slots,addDays,instantForLocal,appendActivity,currentInterval} from '../domain.mjs';
export {currentInterval} from '../domain.mjs';
const quickActivities=Object.freeze({work:'Работа',study:'Обучение',food:'Еда'});
export const categoryKey=id=>digest(id).slice(0,12);
const controlRows=language=>[[{text:language==='en'?'Bedtime':'Отбой',callback_data:'a:sleep'},{text:language==='en'?'Settings':'Настройки',callback_data:'a:settings'}]];
const isDayOff=(w,date)=>w.pauses.some(p=>p.date===date&&p.start===0&&p.end===1440&&p.type==='ended');
export function questionKeyboard(id,categories,page=0,language='ru'){
 const active=categories.filter(c=>!c.archived),pages=Math.max(1,Math.ceil(active.length/8));page=Math.max(0,Math.min(pages-1,page));
 const buttons=active.slice(page*8,page*8+8).map(c=>({text:c.name,callback_data:`k:${id}:${categoryKey(c.id)}`})),rows=[];
 for(let i=0;i<buttons.length;i+=2)rows.push(buttons.slice(i,i+2));
 if(pages>1)rows.push([...(page?[{text:'←',callback_data:`g:${id}:${page-1}`}]:[]),...(page<pages-1?[{text:language==='en'?'More →':'Ещё →',callback_data:`g:${id}:${page+1}`}]:[])]);
 rows.push([{text:language==='en'?'Continue previous':'Продолжаю предыдущее',callback_data:'r:'+id}]);rows.push([{text:language==='en'?'Split interval':'Разделить интервал',callback_data:'s:'+id}],...controlRows(language));return {inline_keyboard:rows};
}
function manualKeyboard(id,categories,page=0,language='ru'){
 const keyboard=questionKeyboard(id,categories,page,language).inline_keyboard.filter(row=>row.every(button=>/^[kg]:/.test(button.callback_data))).map(row=>row.map(button=>({...button,callback_data:button.callback_data.replace(/^k:/,'m:').replace(/^g:/,'n:')})));
 keyboard.push(...controlRows(language));return {inline_keyboard:keyboard};
}
const workCategory=c=>!!c&&['работа','work'].includes(c.name.trim().toLocaleLowerCase());
const projectsOn=w=>w.projectsEnabled!==false&&w.projects.some(p=>!p.archived);
function projectKeyboard(id,projects,language='ru',manual=false,page=0){
 const active=projects.filter(p=>!p.archived),pages=Math.max(1,Math.ceil(active.length/8));
 page=Math.max(0,Math.min(pages-1,page));
 const rows=[],buttons=active.slice(page*8,page*8+8).map(p=>({text:p.name,callback_data:`${manual?'v':'j'}:${id}:${categoryKey(p.id)}`}));
 for(let i=0;i<buttons.length;i+=2)rows.push(buttons.slice(i,i+2));
 if(pages>1)rows.push([...(page?[{text:'←',callback_data:`${manual?'z':'q'}:${id}:${page-1}`}]:[]),...(page<pages-1?[{text:language==='en'?'More →':'Ещё →',callback_data:`${manual?'z':'q'}:${id}:${page+1}`}]:[])]);
 rows.push([{text:language==='en'?'My own answer':'Свой ответ',callback_data:`${manual?'u':'x'}:${id}`}],...controlRows(language));
 return {inline_keyboard:rows};
}
const range=p=>`${p.date}, ${clock(p.start)}–${clock(p.end)}`;
const promptRow=(db,id)=>db.sql.prepare('SELECT * FROM prompts WHERE id=?').get(id);
const addPrompt=(db,p,at)=>{const id=uid();db.sql.prepare('INSERT OR IGNORE INTO prompts(id,date,start,end,timezone,status,created) VALUES(?,?,?,?,?,?,?)').run(id,p.date,p.start,p.end,p.timezone,p.status??'pending',at);return db.sql.prepare('SELECT * FROM prompts WHERE date=? AND start=? AND end=?').get(p.date,p.start,p.end);};
const wakeKeyboard=(date,language)=>({inline_keyboard:[[{text:language==='en'?'Just now':'Только что',callback_data:`w:${date}:now`},{text:language==='en'?'Choose wake-up time':'Указать время подъёма',callback_data:`w:${date}:other`}],[{text:language==='en'?'Today is a day off':'Сегодня выходной целиком',callback_data:`a:dayoff:${date}`}],...controlRows(language)]});
const settingsKeyboard=language=>({inline_keyboard:[[{text:language==='en'?'Language':'Язык',callback_data:'s:language'}],[{text:language==='en'?'Wake-up / day off':'Подъём / выходной',callback_data:'a:wake'}],...controlRows(language)]});
const botKeyboard=(language,sleeping=false)=>({inline_keyboard:[[{text:language==='en'?'Wake-up / day off':'Подъём / выходной',callback_data:'a:wake'}],...(sleeping?[[{text:language==='en'?'Undo bedtime':'Отменить отбой',callback_data:'a:undo_sleep'}]]:[]),...controlRows(language)]});
function wakeAt(date,time,zone){
 const [hour,minute]=time.split(':').map(Number),target=hour*60+minute;time=`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
 let instant=Date.parse(`${date}T${time}:00Z`);
 for(let i=0;i<3;i++){
  const local=localNow(zone,new Date(instant)),dayDelta=Math.round((Date.parse(`${date}T00:00:00Z`)-Date.parse(`${local.date}T00:00:00Z`))/86400000);
  const delta=dayDelta*1440+target-local.minute;if(!delta)break;instant+=delta*60000;
 }
 const actual=localNow(zone,new Date(instant));return actual.date===date&&actual.minute===target?new Date(instant):null;
}

// Entries never suppress scheduled questions; pauses still do. No stale backlog.
export function dueInterval(w,at=new Date()){
 const reminders={...w,entries:[]};
 let local=localNow(w.settings.timezone,at),s=schedule(w,local.date);
 local=localNow(s.timezone,at);s=schedule(w,local.date);
 if(local.minute<2){const previous=addDays(local.date,-1),old=schedule(w,previous);if(old.end===1440&&old.confirmed&&old.days.includes(weekday(previous))&&w.dayEvents?.some(e=>e.date===previous&&e.type==='wake')&&!w.dayEvents?.some(e=>e.date===previous&&e.type==='sleep')){const final=slots(reminders,previous,local).filter(p=>p.status==='missing'&&p.end===1440).at(-1);if(final)return {...final,timezone:old.timezone};}}
 if(!s.confirmed||!s.days.includes(weekday(local.date))||isDayOff(w,local.date))return null;
 if(!w.dayEvents?.some(e=>e.date===local.date&&e.type==='wake')||w.dayEvents?.some(e=>e.date===local.date&&e.type==='sleep'))return null;
 const completed=slots(reminders,local.date,local).filter(p=>p.status==='missing'&&p.end<=local.minute).at(-1);
 if(!completed||local.minute-completed.end>1||completed.start<s.start)return null;
 return {...completed,timezone:s.timezone};
}

export function processUpdate(db,update,at=Date.now(),siteURL='http://127.0.0.1:4173'){
 if(!Number.isSafeInteger(update.update_id))return [];
 return db.tx(()=>{
  if(db.sql.prepare('SELECT id FROM updates WHERE id=?').get(update.update_id))return [];
  const effects=[];const query=update.callback_query,m=query?.message??update.message,from=query?.from??m?.from;
  const say=(text,reply_markup)=>effects.push({method:'sendMessage',body:{chat_id:m.chat.id,text,...(reply_markup?{reply_markup}:{})}});
  const finish=()=>{db.sql.prepare('INSERT INTO updates VALUES(?,?)').run(update.update_id,at);db.sql.prepare("INSERT INTO meta VALUES('offset',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(update.update_id+1));return effects;};
  if(!m||m.chat?.type!=='private'||!from||from.is_bot)return finish();
  if(query)effects.push({method:'answerCallbackQuery',body:{callback_query_id:query.id}});
  const text=typeof m.text==='string'?m.text.trim():'';
  const action=query?String(query.data??''):null;
  const command=!query?text.split(/[ @]/)[0]:'';
  let language=db.sql.prepare("SELECT value FROM meta WHERE key='bot_language'").get()?.value==='ru'?'ru':'en';
  const localized=(ru,en)=>language==='en'?en:ru;
  const start=!query&&/^\/start(?:@\w+)?\s+([a-zA-Z0-9_-]{43})$/.exec(text);
  if(start){
   // Bind inside the existing update transaction, so token consumption and dedup are atomic.
   if(db.link())say(localized('Telegram уже привязан. Для смены аккаунта сначала отключите его на сайте.','Telegram is already linked. Disconnect it on the website before linking another account.'));
   else{
    if(db.sql.prepare('SELECT hash FROM links WHERE hash=? AND expires>?').get(digest(start[1]),at)){
     db.sql.prepare('INSERT INTO telegram VALUES(1,?,?)').run(String(from.id),String(m.chat.id));db.sql.exec('DELETE FROM links; UPDATE journal SET revision=revision+1 WHERE id=1');say(localized('Telegram подключён к вашему журналу. Настройте и сохраните расписание на сайте. /help — команды.','Telegram is linked to your journal. Set your schedule on the website. Use /help for commands.'),botKeyboard(language));
    }else say(localized('Ссылка истекла или уже использована. Создайте новую в настройках сайта.','This link has expired or has already been used. Create another one in Settings.'));
   }
   return finish();
  }
  const link=db.link();if(!link||link.user_id!==String(from.id)||link.chat_id!==String(m.chat.id)){
   say(localized('Для доступа откройте настройки своего сайта и создайте одноразовую ссылку подключения Telegram.','Open Settings on your website to create a one-time Telegram link.'));return finish();
  }
  let {workspace:w,revision}=db.read();let changed=false;
  const sentAt=!query&&Number.isSafeInteger(m.date)&&m.date>=0?new Date(m.date*1000):new Date(at);
  const eventLocal=localNow(w.settings.timezone,sentAt),eventSchedule=schedule(w,eventLocal.date),eventTime=localNow(eventSchedule.timezone,sentAt);
  const eventDate=eventTime.date,hasEvent=(type,date=eventDate)=>w.dayEvents?.some(e=>e.date===date&&e.type===type);
  const markEvent=(type,date=eventDate,zone=eventSchedule.timezone,when=sentAt)=>{ensureDay(w,date);w.dayEvents??=[];w.dayEvents.push({date,type,at:when.toISOString(),timezone:zone});changed=true;};
  const undoBedtime=(event)=>{
   if(!event||at-Date.parse(event.at)>86400000||at<Date.parse(event.at)){say(localized('Отбой не найден или уже изменён. Проверьте отметку на сайте.','Bedtime was not found or has changed. Check it on the website.'));return false;}
   const date=event.date,zone=schedule(w,date).timezone,minute=localNow(zone,new Date(event.at)).minute,expectedStart=Math.max(schedule(w,date).start,minute);
   w.dayEvents=w.dayEvents.filter(e=>e!==event);
   const index=w.pauses.findIndex(p=>p.date===date&&p.type==='ended'&&p.start===expectedStart&&p.end===schedule(w,date).end);
   if(index>=0)w.pauses.splice(index,1);
   changed=true;say(localized('Отбой отменён. Опросы возобновятся с ближайшего интервала.','Bedtime undone. Check-ins resume at the next interval.'),botKeyboard(language));return true;
  };
  const wakeRow=()=>db.sql.prepare('SELECT * FROM wake_prompts WHERE date=?').get(eventDate);
  const recordWake=(row,when)=>{markEvent('wake',row.date,row.timezone,when);db.sql.prepare("UPDATE wake_prompts SET status='answered' WHERE date=?").run(row.date);say(localized(`Подъём: ${clock(localNow(row.timezone,when).minute)}. Опросы занятий отсчитываются от подъёма с шагом ${schedule(w,row.date).step} минут.`,`Wake-up: ${clock(localNow(row.timezone,when).minute)}. Activity check-ins follow from wake-up in ${schedule(w,row.date).step}-minute steps.`),{inline_keyboard:[[{text:localized('Сегодня выходной целиком','Today is a day off'),callback_data:`a:dayoff:${row.date}`}],...botKeyboard(language).inline_keyboard]});};
  const apply=(p,value,messageAt=sentAt.toISOString(),chosenCategory=null,chosenProject=null,fromQuestion=true)=>{
   if(!p){say(localized('Интервал не найден. Откройте журнал на сайте.','Interval not found. Open your journal on the website.'));return false;}
   const hits=w.entries.filter(e=>e.date===p.date&&overlap(e,p));
   if(hits.length&&(hits.length!==1||hits[0].start!==p.start||hits[0].end!==p.end)){say(localized('Интервал разделён или пересекается с другой записью. Исправьте его на сайте.','This interval is split or overlaps another entry. Please correct it on the website.'));return false;}
   ensureDay(w,p.date);const activity={id:uid(),at:messageAt,text:value};
   const entry=hits[0]?{...appendActivity(hits[0],activity),source:'telegram'}:{id:uid(),date:p.date,start:p.start,end:p.end,text:value,category:'',project:'',source:'telegram',activities:[activity]};
   if(chosenCategory!==null)entry.category=chosenCategory;
   if(chosenProject!==null)entry.project=chosenProject;
   w.entries=w.entries.filter(e=>!hits.includes(e));w.entries.push(entry);
   validateWorkspace(w);changed=true;db.sql.prepare("UPDATE prompts SET status='answered',replied=CASE WHEN ? THEN 1 ELSE replied END WHERE id=?").run(fromQuestion?1:0,p.id);db.sql.prepare('DELETE FROM category_choices WHERE prompt_id=?').run(p.id);
   if(fromQuestion&&chosenCategory!==null&&Number.isSafeInteger(p.message_id))effects.push({method:'editMessageReplyMarkup',body:{chat_id:m.chat.id,message_id:p.message_id,reply_markup:{inline_keyboard:[]}}});
   say(localized('Записал','Saved'));
   return true;
  };
  const promptOpen=p=>{
   if(!p||!Number.isSafeInteger(p.message_id)||p.replied)return false;
   const last=p.end===1440?{date:addDays(p.date,1),time:'00:00'}:{date:p.date,time:clock(p.end)};
   const instant=instantForLocal(last.date,last.time,p.timezone);
   return !!instant&&at>=instant.getTime()&&at<=instant.getTime()+1800000;
  };
  const pendingRow=id=>db.sql.prepare('SELECT * FROM pending WHERE id=? AND expires>?').get(id,at);
  const queueManual=(p,value)=>{
   if(!p){say(localized('Интервал не найден. Откройте журнал на сайте.','Interval not found. Open your journal on the website.'));return;}
   const id=uid();
   db.sql.prepare('INSERT INTO pending(id,text,expires,sent_at,prompt_id) VALUES(?,?,?,?,?)').run(id,value,at+1800000,sentAt.toISOString(),p.id);
   say(localized(`К какой категории отнести «${value.slice(0,80)}»?`,`Which category fits “${value.slice(0,80)}”?`),manualKeyboard(id,w.categories,0,language));
  };
  if(!db.sql.prepare("SELECT value FROM meta WHERE key='inline_menu_v1'").get()){
   say(localized('Кнопки доступны под сообщениями и в меню команд Telegram.','Buttons are available below messages and in the Telegram command menu.'),{remove_keyboard:true});
   db.sql.prepare("INSERT INTO meta(key,value) VALUES('inline_menu_v1','1')").run();
  }
  const split=handleSplit({db,w,query,m,text,at,sentAt,say,language,promptOpen,effects});
  if(split.handled){changed=changed||split.changed;}
  else if(action==='a:settings'||command==='/settings')say(localized('Настройки бота:','Bot settings:'),settingsKeyboard(language));
  else if(action==='a:wake'||command==='/wake'){
   if(isDayOff(w,eventDate))say(localized('Сегодня выходной. Опросы отключены; ручные записи доступны. /resume — включить опросы.','Today is a day off. Check-ins are off; manual entries remain available. /resume restarts check-ins.'),botKeyboard(language));
   else if(hasEvent('wake'))say(localized('Подъём уже отмечен. Можно выбрать выходной на сегодня.','Wake-up is already recorded. You can still take today off.'),{inline_keyboard:[[{text:localized('Сегодня выходной целиком','Today is a day off'),callback_data:`a:dayoff:${eventDate}`}],...controlRows(language)]});
   else{db.sql.prepare("INSERT INTO wake_prompts(date,timezone,status) VALUES(?,?,'sent') ON CONFLICT(date) DO UPDATE SET status='sent'").run(eventDate,eventSchedule.timezone);say(localized('Во сколько вы проснулись?','When did you wake up?'),wakeKeyboard(eventDate,language));}
  }else if(action?.startsWith('a:dayoff:')||command==='/dayoff'){
   const date=action?action.slice(9):eventDate;
   if(date!==eventDate)say(localized('Эта кнопка относится к другому дню. Откройте /wake.','This button belongs to another day. Open /wake.'));
   else{if(!isDayOff(w,date)){ensureDay(w,date);w.pauses.push({date,start:0,end:1440,type:'ended'});changed=true;}db.sql.prepare("UPDATE wake_prompts SET status='day_off' WHERE date=?").run(date);say(localized('Сегодня выходной: все опросы отключены до завтра. Ручные записи доступны. Завтра действует обычное расписание. /resume — отменить выходной.','Today is a day off: all check-ins are off until tomorrow. Manual entries remain available. Your usual schedule returns tomorrow. /resume cancels the day off.'),botKeyboard(language));}
  }else if(action==='a:undo_sleep'||command==='/undo_sleep'){
   const event=[...(w.dayEvents||[])].filter(e=>e.type==='sleep').sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0];undoBedtime(event);
  }else if(action==='a:sleep'||command==='/sleep'){
   const previous=addDays(eventDate,-1),sleepDate=hasEvent('wake')?eventDate:eventTime.minute<eventSchedule.start&&hasEvent('wake',previous)?previous:eventDate;
   if(!hasEvent('wake',sleepDate))say(localized('Сначала отметьте пробуждение.','Record your wake-up first.'),botKeyboard(language));
   else if(hasEvent('sleep',sleepDate))say(localized('Отбой уже записан.','Bedtime is already recorded.'),botKeyboard(language,true));
   else{const zone=schedule(w,sleepDate).timezone;markEvent('sleep',sleepDate,zone);if(sleepDate===eventDate&&eventTime.minute<eventSchedule.end)w.pauses.push({date:eventDate,start:Math.max(eventSchedule.start,eventTime.minute),end:eventSchedule.end,type:'ended'});say(localized(`Отбой записан: ${clock(eventTime.minute)}. До завтра вопросов не будет.`,`Bedtime recorded at ${clock(eventTime.minute)}. No more check-ins today.`),{inline_keyboard:[[{text:localized('Отменить отбой','Undo bedtime'),callback_data:`b:${sleepDate}:${Math.floor(sentAt.getTime()/1000)}`}],...controlRows(language)]});}
  }else if(query){
   const data=String(query.data??'');let match;
   if((match=/^b:(\d{4}-\d{2}-\d{2}):(\d{10})$/.exec(data))){
    const [date,stamp]=match.slice(1),event=w.dayEvents?.find(e=>e.date===date&&e.type==='sleep'&&Math.floor(Date.parse(e.at)/1000)===Number(stamp));
    if(undoBedtime(event))effects.push({method:'editMessageReplyMarkup',body:{chat_id:m.chat.id,message_id:m.message_id,reply_markup:{inline_keyboard:[]}}});
   }
   else if((match=/^w:(\d{4}-\d{2}-\d{2}):(now|other)$/.exec(data))){
    const row=db.sql.prepare('SELECT * FROM wake_prompts WHERE date=?').get(match[1]);
    if(!row||hasEvent('wake',match[1])||!['sent','awaiting_time'].includes(row.status))say(localized('Подъём уже отмечен или вопрос устарел.','Wake-up is already recorded or this question has expired.'));
    else if(row.date!==eventDate)say(localized('Этот утренний вопрос относится к другому дню.','This morning question belongs to another day.'));
    else if(match[2]==='now'){recordWake(row,sentAt);effects.push({method:'editMessageReplyMarkup',body:{chat_id:m.chat.id,message_id:m.message_id,reply_markup:{inline_keyboard:[]}}});}
    else{db.sql.prepare("UPDATE wake_prompts SET status='awaiting_time' WHERE date=?").run(row.date);say(localized('Напишите время подъёма, например 7:37 или 07:37.','Send your wake-up time, for example 7:37 or 07:37.'),{force_reply:true,selective:true,input_field_placeholder:'07:37'});}
   }
   else if((match=/^g:([a-z0-9-]{36}):(\d{1,3})$/.exec(data))){const p=promptRow(db,match[1]);if(p)effects.push({method:'editMessageReplyMarkup',body:{chat_id:m.chat.id,message_id:m.message_id,reply_markup:questionKeyboard(p.id,w.categories,+match[2],language)}});}
   else if(data==='s:language')say(localized('Выберите язык бота:','Choose the bot language:'),{inline_keyboard:[[{text:'Русский',callback_data:'l:ru'},{text:'English',callback_data:'l:en'}]]});
   else if((match=/^l:(ru|en)$/.exec(data))){language=match[1];db.sql.prepare("INSERT INTO meta(key,value) VALUES('bot_language',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(language);effects.push({method:'editMessageReplyMarkup',body:{chat_id:m.chat.id,message_id:m.message_id,reply_markup:{inline_keyboard:[]}}});say(localized('Язык бота: русский.','Bot language: English.'),botKeyboard(language));}
   else if((match=/^k:([a-z0-9-]{36}):([a-f0-9]{12}|-)$/.exec(data))){const p=promptRow(db,match[1]),category=w.categories.find(c=>!c.archived&&categoryKey(c.id)===match[2]);if(!promptOpen(p))say(localized('Вопрос устарел. Отправьте запись на сайте.','This question has expired. Add an entry on the website.'));else if(match[2]!='-'&&!category)say(localized('Категория изменена или архивирована. Выберите другую.','This category has changed or was archived. Choose another.'),questionKeyboard(p.id,w.categories,0,language));else{db.sql.exec('DELETE FROM category_choices');db.sql.prepare('INSERT INTO category_choices(prompt_id,category_id,expires,selected_at) VALUES(?,?,?,?) ON CONFLICT(prompt_id) DO UPDATE SET category_id=excluded.category_id,expires=excluded.expires,selected_at=excluded.selected_at,message_id=NULL').run(p.id,category?.id||'',at+1800000,at);const useProjects=workCategory(category)&&projectsOn(w);say(localized(`Выбрана категория: ${category?.name||'Без категории'}. Если нужно, выберите другую кнопкой в вопросе выше.\n${useProjects?'Выберите проект или свой ответ':'Теперь напишите, чем занимались'}`,`Selected category: ${category?.name||'No category'}. You can change it using the buttons above.\n${useProjects?'Choose a project or your own answer':'Now tell me what you were doing'}`),useProjects?projectKeyboard(p.id,w.projects,language):{force_reply:true,selective:true,input_field_placeholder:localized('Чем занимались?','What were you doing?')});Object.assign(effects.at(-1),{choicePrompt:p.id,choiceSelectedAt:at});}}
   else if((match=/^q:([a-z0-9-]{36}):(\d{1,3})$/.exec(data))){const p=promptRow(db,match[1]);if(promptOpen(p))effects.push({method:'editMessageReplyMarkup',body:{chat_id:m.chat.id,message_id:m.message_id,reply_markup:projectKeyboard(p.id,w.projects,language,false,+match[2])}});}
   else if((match=/^j:([a-z0-9-]{36}):([a-f0-9]{12})$/.exec(data))){const p=promptRow(db,match[1]),choice=db.sql.prepare('SELECT * FROM category_choices WHERE prompt_id=? AND expires>?').get(match[1],at),project=w.projects.find(x=>!x.archived&&categoryKey(x.id)===match[2]);if(!promptOpen(p)||!choice||!workCategory(w.categories.find(c=>c.id===choice.category_id))||!projectsOn(w))say(localized('Выбор устарел. Отправьте занятие заново.','That choice has expired. Send your activity again.'));else if(!project)say(localized('Проект больше недоступен. Выберите другой.','That project is no longer available.'),projectKeyboard(p.id,w.projects,language));else if(apply(p,project.name,sentAt.toISOString(),choice.category_id,project.id))effects.push({method:'editMessageReplyMarkup',body:{chat_id:m.chat.id,message_id:m.message_id,reply_markup:{inline_keyboard:[]}}});}
   else if((match=/^x:([a-z0-9-]{36})$/.exec(data))){const p=promptRow(db,match[1]),choice=db.sql.prepare('SELECT * FROM category_choices WHERE prompt_id=? AND expires>?').get(match[1],at);if(promptOpen(p)&&choice){say(localized('Теперь напишите, чем занимались','Now tell me what you were doing'),{force_reply:true,selective:true});Object.assign(effects.at(-1),{choicePrompt:p.id,choiceSelectedAt:choice.selected_at});}else say(localized('Выбор устарел. Отправьте занятие заново.','That choice has expired. Send your activity again.'));}
   else if((match=/^n:([a-z0-9-]{36}):(\d{1,3})$/.exec(data))){if(pendingRow(match[1]))effects.push({method:'editMessageReplyMarkup',body:{chat_id:m.chat.id,message_id:m.message_id,reply_markup:manualKeyboard(match[1],w.categories,+match[2],language)}});}
   else if((match=/^m:([a-z0-9-]{36}):([a-f0-9]{12}|-)$/.exec(data))){const pending=pendingRow(match[1]),category=w.categories.find(c=>!c.archived&&categoryKey(c.id)===match[2]);if(!pending)say(localized('Выбор устарел. Отправьте текст ещё раз.','That choice has expired. Send your activity again.'));else if(match[2]!='-'&&!category)say(localized('Категория больше недоступна. Выберите другую.','That category is no longer available.'),manualKeyboard(pending.id,w.categories,0,language));else if(workCategory(category)&&projectsOn(w)){db.sql.prepare('UPDATE pending SET category_id=? WHERE id=?').run(category.id,pending.id);say(localized('Выбрана категория: Работа. Выберите проект или свой ответ.','Category: Work. Choose a project or your own answer.'),projectKeyboard(pending.id,w.projects,language,true));}else if(apply(promptRow(db,pending.prompt_id),pending.text,pending.sent_at,category?.id||'',null,false)){db.sql.prepare('DELETE FROM pending WHERE id=?').run(pending.id);effects.push({method:'editMessageReplyMarkup',body:{chat_id:m.chat.id,message_id:m.message_id,reply_markup:{inline_keyboard:[]}}});}}
   else if((match=/^z:([a-z0-9-]{36}):(\d{1,3})$/.exec(data))){const pending=pendingRow(match[1]);if(pending&&pending.category_id)effects.push({method:'editMessageReplyMarkup',body:{chat_id:m.chat.id,message_id:m.message_id,reply_markup:projectKeyboard(pending.id,w.projects,language,true,+match[2])}});}
   else if((match=/^v:([a-z0-9-]{36}):([a-f0-9]{12})$/.exec(data))){const pending=pendingRow(match[1]),project=w.projects.find(p=>!p.archived&&categoryKey(p.id)===match[2]);if(!pending||!pending.category_id||!projectsOn(w))say(localized('Выбор устарел. Отправьте занятие снова.','That choice has expired. Send your activity again.'));else if(!project)say(localized('Проект больше недоступен. Выберите другой.','That project is no longer available.'));else if(apply(promptRow(db,pending.prompt_id),project.name,pending.sent_at,pending.category_id,project.id,false)){db.sql.prepare('DELETE FROM pending WHERE id=?').run(pending.id);effects.push({method:'editMessageReplyMarkup',body:{chat_id:m.chat.id,message_id:m.message_id,reply_markup:{inline_keyboard:[]}}});}}
   else if((match=/^u:([a-z0-9-]{36})$/.exec(data))){const pending=pendingRow(match[1]);if(!pending||!pending.category_id)say(localized('Выбор устарел. Отправьте занятие снова.','That choice has expired. Send your activity again.'));else if(apply(promptRow(db,pending.prompt_id),pending.text,pending.sent_at,pending.category_id,null,false)){db.sql.prepare('DELETE FROM pending WHERE id=?').run(pending.id);effects.push({method:'editMessageReplyMarkup',body:{chat_id:m.chat.id,message_id:m.message_id,reply_markup:{inline_keyboard:[]}}});}}
   else if((match=/^a:(work|study|food):([a-z0-9-]{36})$/.exec(data)))apply(promptRow(db,match[2]),quickActivities[match[1]]);
   else if((match=/^r:([a-z0-9-]{36})$/.exec(data))){
    const p=promptRow(db,match[1]),previous=p&&w.entries.filter(e=>e.date===p.date&&e.end<=p.start).sort((a,b)=>a.end-b.end).at(-1);
    if(previous){
     // The preview may summarize several activities; only the last actual activity continues.
     const value=previous.activities?.at(-1)?.text??previous.text,target=w.entries.find(e=>e.date===p.date&&e.start===p.start&&e.end===p.end);
     db.sql.exec('DELETE FROM category_choices');
     if(target&&(target.activities?target.activities.some(a=>a.text===value):target.text===value))say(localized(`Это занятие уже записано: ${range(p)}. Повторная запись не добавлена.`,`This activity is already logged for ${range(p)}. No duplicate was added.`));
     else apply(p,value);
    }else say(localized('Предыдущего занятия нет. Ответьте текстом на вопрос.','There is no previous activity. Reply to the question with a short description.'));
   }
   else if((match=/^([ce]):([a-f0-9]{12}):([a-z0-9-]{36})$/.exec(data))){const pending=db.sql.prepare('SELECT text,sent_at FROM pending WHERE id=? AND expires>?').get(match[2],at);if(pending){apply(promptRow(db,match[3]),pending.text,pending.sent_at??null);db.sql.prepare('DELETE FROM pending WHERE id=?').run(match[2]);}else say(localized('Выбор устарел. Отправьте текст ещё раз.','That choice has expired. Send your activity again.'));}
  }else if(text.startsWith('/')){
   const local=localNow(w.settings.timezone,new Date(at)),s=schedule(w,local.date);
   if(['/pause','/end'].includes(command)){
    const end=command==='/pause'?Math.min(local.minute+60,s.end):s.end;
    if(local.minute>=s.start&&end>local.minute){ensureDay(w,local.date);w.pauses.push({date:local.date,start:local.minute,end,type:command==='/end'?'ended':'pause'});changed=true;say(command==='/end'?localized('Учёт завершён до конца дня. /resume — возобновить.','Tracking paused for today. Use /resume to restart.'):localized('Пауза на час или до конца окна учёта. /resume — возобновить раньше.','Paused for an hour or until tracking hours end. Use /resume to restart sooner.'));}else say(localized('Сейчас вне окна учёта. Расписание можно изменить на сайте.','You are outside your tracking hours. You can change the schedule on the website.'));
   }else if(command==='/resume'){
    const pauses=w.pauses.filter(p=>p.date===local.date&&p.end>local.minute);if(pauses.length){w.pauses=w.pauses.flatMap(p=>!pauses.includes(p)?[p]:p.start<local.minute?[{...p,end:local.minute}]:[]);changed=true;}db.sql.prepare("UPDATE wake_prompts SET status='pending',retry_at=0 WHERE date=? AND status='day_off'").run(local.date);say(localized('Учёт возобновлён. Пропуски не заполняются автоматически.','Reminders resumed. Missed intervals remain empty.'));
   }else if(command==='/site')say(localized('Открыть журнал: ','Open your journal: ')+siteURL);
   else if(command==='/language'||command==='/lang')say(localized('Выберите язык бота:','Choose the bot language:'),{inline_keyboard:[[{text:'Русский',callback_data:'l:ru'},{text:'English',callback_data:'l:en'}]]});
   else say(localized('/wake — подъём и выходной\n/dayoff — выходной целиком\n/help — справка\n/settings — настройки и язык\n/pause — пауза на час\n/end — завершить учёт\n/sleep — отбой\n/undo_sleep — отменить отбой\n/site — адрес сайта\nУтром выберите «Только что» или «Другое время» и введите ЧЧ:ММ. Опросы занятий начнутся после отмеченного подъёма.','/wake — wake-up and day off\n/dayoff — take today off\n/help — help\n/settings — settings and language\n/pause — pause for an hour\n/end — stop tracking\n/sleep — bedtime\n/undo_sleep — undo bedtime\n/site — website\nIn the morning, choose Just now or Another time and enter HH:MM. Activity check-ins follow your recorded wake-up.'),botKeyboard(language));
  }else if(!text){say(localized('Пришлите короткий текст. Можно использовать диктовку клавиатуры; голосовые файлы пока не распознаются.','Send a short text. Keyboard dictation works, but voice recordings are not transcribed.'));}
  else if(text.length>2000){say(localized('Сократите ответ до 2000 символов. Ожидаемый интервал сохранён.','Please keep your reply under 2,000 characters. The pending interval is still available.'));}
  else{
   if(!isDayOff(w,eventDate)&&!hasEvent('wake')&&wakeRow()&&['sent','awaiting_time'].includes(wakeRow().status)){
    const row=wakeRow();
    if(row?.status==='awaiting_time'){
     if(!/^([01]?\d|2[0-3]):[0-5]\d$/.test(text))say(localized('Напишите время, например 7:37 или 07:37.','Send a time, for example 7:37 or 07:37.'));
     else{const when=wakeAt(row.date,text,row.timezone);if(!when||when>sentAt)say(localized('Укажите уже наступившее время подъёма за сегодня.','Enter a wake-up time earlier today.'));else{recordWake(row,when);if(Number.isSafeInteger(row.message_id))effects.push({method:'editMessageReplyMarkup',body:{chat_id:m.chat.id,message_id:row.message_id,reply_markup:{inline_keyboard:[]}}});}}
    }else say(localized('Выберите «Только что» или «Другое время» в утреннем вопросе.','Choose Just now or Another time in the morning question.'),wakeKeyboard(eventDate,language));
   }else{
   const replyId=m.reply_to_message?.message_id,reply=replyId&&db.sql.prepare('SELECT * FROM prompts WHERE message_id=?').get(replyId);
   const choice=reply?db.sql.prepare('SELECT * FROM category_choices WHERE prompt_id=? AND expires>?').get(reply.id,at):replyId?db.sql.prepare('SELECT * FROM category_choices WHERE message_id=? AND expires>?').get(replyId,at):db.sql.prepare('SELECT * FROM category_choices WHERE expires>? ORDER BY selected_at DESC,rowid DESC LIMIT 1').get(at);
   if(choice){const category=w.categories.find(c=>c.id===choice.category_id&&!c.archived);if(choice.category_id&&!category)say(localized('Выбранная категория больше недоступна. Выберите другую и отправьте текст повторно.','That category is no longer available. Choose another and resend your activity.'),questionKeyboard(choice.prompt_id,w.categories,0,language));else apply(promptRow(db,choice.prompt_id),text,sentAt.toISOString(),choice.category_id);}
   else if(reply)apply(reply,text);
   else if(replyId)say(localized('Этот запрос категории уже использован, устарел или не найден. Запись не сохранена. Выберите категорию в нужном вопросе и отправьте текст заново. Для записи текущего занятия можно отправить новое сообщение без ответа на старое.','This category request has been used or expired. Nothing was saved. Choose a category in the original question and send your activity again. For the current interval, send a new message without replying to the old one.'));
   else{const current=currentInterval(w,sentAt),p=addPrompt(db,{...current,status:'manual'},at);const previousAnswered=db.sql.prepare("SELECT id FROM prompts WHERE replied=1 AND (date<? OR (date=? AND end<=?)) LIMIT 1").get(current.date,current.date,current.start);if(previousAnswered)queueManual(p,text);else apply(p,text);}
   }
  }
  if(changed)db.write(w,revision);
  return finish();
 });
}
export class TelegramBot {
 constructor(db,token,{fetchImpl=fetch,siteURL='http://127.0.0.1:4173'}={}){this.db=db;this.token=token;this.fetch=fetchImpl;this.siteURL=siteURL;this.ready=false;this.username=null;this.statusError='';this.stopped=false;this.busy=false;this.controllers=new Set();}
 async call(method,body={}){
  const controller=new AbortController();this.controllers.add(controller);const timer=setTimeout(()=>controller.abort(),40000);
  try{const response=await this.fetch(`https://api.telegram.org/bot${this.token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});const result=await response.json();if(!result.ok){const error=new Error('Telegram отклонил запрос ('+(result.error_code??response.status)+').');error.code=result.error_code;error.retryAfter=result.parameters?.retry_after;throw error;}return result.result;}finally{clearTimeout(timer);this.controllers.delete(controller);}
 }
 async initialize(){
  const me=await this.call('getMe');if(typeof me.username!=='string'||!/^\w+$/.test(me.username))throw new Error('Telegram не вернул имя бота.');
  const hook=await this.call('getWebhookInfo');if(hook.url)throw new Error('У бота уже настроен webhook. Для локальной версии нужен отдельный бот без webhook.');
  await this.call('setMyCommands',{commands:[{command:'wake',description:'Wake-up / Подъём'},{command:'dayoff',description:'Day off / Выходной'},{command:'sleep',description:'Bedtime / Отбой'},{command:'settings',description:'Settings / Настройки'},{command:'resume',description:'Resume / Возобновить'},{command:'help',description:'Help / Справка'},{command:'site',description:'Website / Сайт'}]});
  this.username=me.username;this.ready=true;this.statusError='';
  this.db.sql.exec("UPDATE prompts SET status='uncertain',error='Сервер остановился во время отправки; автоматический повтор отключён.' WHERE status='sending'");
  this.db.sql.exec("UPDATE wake_prompts SET status='uncertain' WHERE status='sending'");
 }
 async tick(at=new Date()){
  if(!this.ready||this.busy||this.stopped)return;this.busy=true;
  try{
   const link=this.db.link();if(!link)return;
   const w=this.db.read().workspace,local=localNow(w.settings.timezone,at),s=schedule(w,local.date),time=localNow(s.timezone,at);
   if(isDayOff(w,time.date))return;
   if(s.confirmed&&s.days.includes(weekday(time.date))&&time.minute>=s.start&&time.minute<s.end&&!w.dayEvents?.some(e=>e.date===time.date&&e.type==='wake')){
    this.db.sql.prepare("INSERT OR IGNORE INTO wake_prompts(date,timezone,status) VALUES(?,?,'pending')").run(time.date,s.timezone);
    const opener=this.db.sql.prepare('SELECT * FROM wake_prompts WHERE date=?').get(time.date);
    if(['pending','retry'].includes(opener.status)&&opener.retry_at<=at.getTime()){
     const claimed=this.db.sql.prepare("UPDATE wake_prompts SET status='sending',attempts=attempts+1 WHERE date=? AND status IN ('pending','retry')").run(time.date);
     if(claimed.changes)try{
      const language=this.db.sql.prepare("SELECT value FROM meta WHERE key='bot_language'").get()?.value==='ru'?'ru':'en';
      const sent=await this.call('sendMessage',{chat_id:link.chat_id,text:language==='en'?'Good morning! When did you wake up?':'Доброе утро! Во сколько вы проснулись?',reply_markup:wakeKeyboard(time.date,language)});
      this.db.sql.prepare("UPDATE wake_prompts SET status='sent',message_id=? WHERE date=?").run(sent.message_id,time.date);this.statusError='';
     }catch(error){const retry=error.code===429&&opener.attempts<2;this.db.sql.prepare('UPDATE wake_prompts SET status=?,retry_at=? WHERE date=?').run(retry?'retry':error.code?'failed':'uncertain',at.getTime()+Math.max(15,error.retryAfter??30)*1000,time.date);this.statusError='Не удалось подтвердить отправку утреннего вопроса.';}
    }
    return;
   }
   const due=dueInterval(w,at);if(!due)return;
   const p=this.db.tx(()=>{const p=addPrompt(this.db,{...due,status:'pending'},at.getTime());
    // A manual activity can create/answer this row before its scheduled question.
    // Only promote rows with no delivery attempt, preserving all dedup safeguards.
    if(p.message_id===null&&p.attempts===0&&['manual','answered'].includes(p.status)){
     this.db.sql.prepare("UPDATE prompts SET status='pending' WHERE id=?").run(p.id);p.status='pending';
    }
    const current=this.db.read();if(!Object.hasOwn(current.workspace.snapshots,p.date)){ensureDay(current.workspace,p.date);this.db.write(current.workspace,current.revision);}return p;});
   if(!['pending','retry'].includes(p.status)||p.retry_at>at.getTime())return;
   const claimed=this.db.sql.prepare("UPDATE prompts SET status='sending',attempts=attempts+1 WHERE id=? AND status IN ('pending','retry')").run(p.id);if(!claimed.changes)return;
   try{
    const language=this.db.sql.prepare("SELECT value FROM meta WHERE key='bot_language'").get()?.value==='ru'?'ru':'en';
    const sent=await this.call('sendMessage',{chat_id:link.chat_id,text:language==='en'?`What were you doing ${range(p)}?\nChoose a category, then tell me what you did.`:`Чем занимались ${range(p)}?\nСначала выберите категорию, затем напишите, чем занимались.`,reply_markup:questionKeyboard(p.id,this.db.read().workspace.categories,0,language)});
    this.db.sql.prepare("UPDATE prompts SET status='sent',message_id=?,error='' WHERE id=?").run(sent.message_id,p.id);this.statusError='';
   }catch(error){
    const retry=error.code===429&&p.attempts<2;
    this.db.sql.prepare('UPDATE prompts SET status=?,error=?,retry_at=? WHERE id=?').run(retry?'retry':error.code?'failed':'uncertain',error.code?'Telegram: '+error.code:'Связь прервалась; доставка неизвестна. Повтор отключён во избежание дубля.',at.getTime()+Math.max(15,error.retryAfter??30)*1000,p.id);
    this.statusError='Не удалось подтвердить отправку напоминания. Проверьте статус последнего опроса.';
   }
  }finally{this.busy=false;}
 }
 async run(){
  let initialized=false;
  while(!this.stopped){try{
   if(!initialized){await this.initialize();initialized=true;this.timer=setInterval(()=>this.tick().catch(()=>{this.statusError='Ошибка планировщика.';}),15000);await this.tick();}
   const offset=Number(this.db.sql.prepare("SELECT value FROM meta WHERE key='offset'").get()?.value??0);
   const updates=await this.call('getUpdates',{offset,timeout:25,allowed_updates:['message','callback_query']});
   for(const update of updates){if(this.stopped)break;let effects;try{effects=processUpdate(this.db,update,Date.now(),this.siteURL);}catch{
     // Keep a poison update from blocking all later messages; no unvalidated write survives rollback.
     this.db.tx(()=>{this.db.sql.prepare('INSERT OR IGNORE INTO updates VALUES(?,?)').run(update.update_id,Date.now());this.db.sql.prepare("INSERT INTO meta VALUES('offset',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(update.update_id+1));});
     this.statusError='Не удалось обработать ответ. Проверьте запись на сайте.';
     const message=update.message??update.callback_query?.message,from=update.callback_query?.from??update.message?.from,link=this.db.link();
     if(link&&String(from?.id)===link.user_id&&String(message?.chat?.id)===link.chat_id)try{await this.call('sendMessage',{chat_id:link.chat_id,text:'Не удалось сохранить ответ. Проверьте журнал на сайте и повторите запись. Предыдущие данные сохранены.'});}catch{}
     continue;
    }
    for(const effect of effects){if(this.stopped)break;try{const sent=await this.call(effect.method,effect.body);if(effect.splitDraft)rememberSplitMessage(this.db,effect,sent);if(effect.choicePrompt&&Number.isSafeInteger(sent?.message_id))this.db.sql.prepare('UPDATE category_choices SET message_id=? WHERE prompt_id=? AND selected_at=?').run(sent.message_id,effect.choicePrompt,effect.choiceSelectedAt);}catch{this.statusError='Ответ обработан, но подтверждение Telegram не доставлено. Проверьте журнал на сайте.';}}
   }
  }catch(error){if(this.stopped)break;this.ready=initialized;this.statusError=initialized?'Telegram временно недоступен. Подключение будет повторено.':error.message.startsWith('У бота')?error.message:'Не удалось подключить Telegram. Проверьте токен и сеть.';await new Promise(resolve=>{this.wake=resolve;this.waitTimer=setTimeout(resolve,5000);});}}
 }
 stop(){this.stopped=true;clearInterval(this.timer);clearTimeout(this.waitTimer);this.wake?.();for(const controller of this.controllers)controller.abort();}
}
