import {uid,clock,overlap,ensureDay,splitIntervalEntries} from '../domain.mjs';
import {digest} from './database.mjs';

const TTL=30*60*1000;
const categoryKey=id=>digest(id).slice(0,12);
const hits=(w,p)=>w.entries.filter(e=>e.date===p.date&&overlap(e,p));
const fingerprint=entries=>digest(JSON.stringify([...entries].sort((a,b)=>a.id.localeCompare(b.id))));

// Called only after processUpdate has authenticated the linked owner, inside its transaction.
export function handleSplit({db,w,query,m,text,at,sentAt,say,language,promptOpen,effects}){
 const en=language==='en',tr=(ru,english)=>en?english:ru;
 const owner=String(query?.from?.id??m.from.id),chat=String(m.chat.id),data=String(query?.data??'');
 let row,draft,changed=false;
 const save=()=>db.sql.prepare('UPDATE split_drafts SET body=? WHERE id=?').run(JSON.stringify(draft),row.id);
 const button=(label,action)=>({text:label,callback_data:`sp:${row.id}:${draft.version}:${action}`});
 const cancelRow=()=>[button(tr('Отмена','Cancel'),'cancel')];
 const send=(message,markup)=>{
  say(message,markup);
  if(draft.stage==='minutes'||draft.stage==='text')Object.assign(effects.at(-1),{splitDraft:row.id,splitVersion:draft.version});
 };
 const sum=()=>draft.parts.reduce((n,p)=>n+p.minutes,0);
 const total=()=>draft.interval.end-draft.interval.start;
 const label=id=>w.categories.find(c=>c.id===id)?.name||tr('Без категории','No category');
 const render=(page=0)=>{
  draft.version++;draft.inputMessage=null;save();
  if(draft.stage==='minutes'){
   const available=total()-sum()+(draft.edit===null?0:draft.parts[draft.edit].minutes);
   send(tr(`Сколько минут заняла часть ${draft.edit===null?draft.parts.length+1:draft.edit+1}? Доступно: ${available} мин. Напишите целое число. /cancel — отмена.`,`How many minutes for part ${draft.edit===null?draft.parts.length+1:draft.edit+1}? Available: ${available} min. Send a whole number. /cancel to cancel.`),{force_reply:true,selective:true});
  }else if(draft.stage==='text'){
   send(tr(`Чем занимались эти ${draft.pending.minutes} мин? Напишите описание. /cancel — отмена.`,`What were you doing for these ${draft.pending.minutes} min? Send a description. /cancel to cancel.`),{force_reply:true,selective:true});
  }else if(draft.stage==='category'){
   const categories=w.categories.filter(c=>!c.archived),pages=Math.max(1,Math.ceil(categories.length/8));page=Math.max(0,Math.min(page,pages-1));
   const buttons=categories.slice(page*8,page*8+8).map(c=>button(c.name,'c'+categoryKey(c.id))),rows=[];
   for(let i=0;i<buttons.length;i+=2)rows.push(buttons.slice(i,i+2));
   if(pages>1)rows.push([...(page?[button('←','p'+(page-1))]:[]),...(page<pages-1?[button('→','p'+(page+1))]:[])]);
   rows.push(cancelRow());
   send(tr('Выберите категорию этой части:','Choose a category for this part:'),{inline_keyboard:rows});
  }else if(draft.stage==='edit'){
   const rows=draft.parts.map((p,i)=>[button(`${i+1}. ${p.minutes} ${tr('мин','min')} · ${p.text.slice(0,35)}`,'e'+i)]);
   rows.push([button(tr('Назад к просмотру','Back to review'),'review')],cancelRow());
   send(tr('Какую часть изменить? Минуты, описание и категория будут запрошены заново.','Which part would you like to edit? You will re-enter its minutes, description and category.'),{inline_keyboard:rows});
  }else if(draft.stage==='replace'){
   send(tr('Этот интервал уже заполнен. Подтвердите замену исходной записи перечисленными частями. Её копия останется в серверном черновике.','This interval already contains an entry. Confirm replacing it with the listed parts. A copy of the original remains in the server draft.'),{inline_keyboard:[[button(tr('Подтвердить замену','Confirm replacement'),'replace')],[button(tr('Назад','Back'),'review')],cancelRow()]});
  }else{
   const remaining=total()-sum();
   send(`${draft.interval.date} · ${clock(draft.interval.start)}–${clock(draft.interval.end)}\n${tr('Всего','Total')}: ${sum()}/${total()} ${tr('мин','min')}. ${tr('Осталось','Remaining')}: ${remaining} ${tr('мин','min')}.`);
   if(draft.original.length)send(tr('Исходная запись (будет заменена только после отдельного подтверждения):\n','Original entry (replacement requires separate confirmation):\n')+draft.original.map(e=>`${clock(e.start)}–${clock(e.end)} · ${label(e.category)}\n${e.text}`).join('\n').slice(0,3500));
   let cursor=draft.interval.start,chunk='';
   for(const [index,p] of draft.parts.entries()){
    const line=`${index+1}. ${clock(cursor)}–${clock(cursor+p.minutes)} · ${p.minutes} ${tr('мин','min')} · ${label(p.category).slice(0,80)}\n${p.text.slice(0,120)}${p.text.length>120?'…':''}\n`;cursor+=p.minutes;
    if(chunk.length+line.length>3400){send(chunk);chunk='';}chunk+=line;
   }
   if(chunk)send(chunk);
   const rows=[];
   if(remaining===0&&draft.parts.length>=2)rows.push([button(tr('Сохранить всё','Save all'),'save')]);
   if(remaining>0&&draft.parts.length<60)rows.push([button(tr('Добавить часть','Add part'),'more')]);
   if(draft.parts.length)rows.push([button(tr('Изменить','Edit'),'edit')]);
   rows.push(cancelRow());send(tr('Проверьте части перед сохранением. Длинные описания выше сокращены, в журнал попадёт полный текст.','Review the parts before saving. Long descriptions above are shortened; the journal keeps their full text.'),{inline_keyboard:rows});
  }
 };
 const stale=()=>say(tr('Этот шаг устарел. Используйте последнее сообщение разделения или /cancel.','This step has expired. Use the latest split message or /cancel.'));
 const start=/^s:([a-z0-9-]{36})$/.exec(data);
 if(start){
  const prompt=db.sql.prepare('SELECT * FROM prompts WHERE id=?').get(start[1]);
  if(!promptOpen(prompt)){say(tr('Вопрос устарел. Разделите запись на сайте.','This question has expired. Split the entry on the website.'));return {handled:true,changed:false};}
  const original=hits(w,prompt);
  if(original.length>1||original.some(e=>e.start!==prompt.start||e.end!==prompt.end)){say(tr('Интервал уже разделён или пересекается с другой записью. Откройте сайт.','This interval is already split or overlaps another entry. Open the website.'));return {handled:true,changed:false};}
  const existing=db.sql.prepare("SELECT id,body FROM split_drafts WHERE user_id=? AND chat_id=? AND status='active' AND expires>? ORDER BY created DESC LIMIT 1").get(owner,chat,at);
  if(existing){say(tr('У вас уже открыт черновик. Завершите его или отправьте /cancel перед новым разделением.','A draft is already open. Finish it or send /cancel before starting another split.'));return {handled:true,changed:false};}
  row={id:uid(),prompt_id:prompt.id};
  draft={interval:{date:prompt.date,start:prompt.start,end:prompt.end,timezone:prompt.timezone},original,fingerprint:fingerprint(original),parts:[],edit:null,pending:null,stage:'minutes',version:0,inputMessage:null};
  db.sql.prepare('INSERT INTO split_drafts(id,prompt_id,user_id,chat_id,created,expires,status,body) VALUES(?,?,?,?,?,?,?,?)').run(row.id,prompt.id,owner,chat,at,at+TTL,'active',JSON.stringify(draft));
  db.sql.prepare('UPDATE category_choices SET expires=? WHERE prompt_id=?').run(at-1,prompt.id);
  render();return {handled:true,changed:false};
 }
 const match=/^sp:([a-z0-9-]{36}):(\d{1,6}):([a-z0-9-]+)$/.exec(data);
 if(query&&!match){
  if(/^[kmr]:/.test(data)&&db.sql.prepare("SELECT id FROM split_drafts WHERE user_id=? AND chat_id=? AND status='active' AND expires>? LIMIT 1").get(owner,chat,at)){
   say(tr('Сначала завершите разделение или отправьте /cancel, затем выберите другую запись.','Finish the current split or send /cancel before choosing another entry.'));return {handled:true,changed:false};
  }
  return {handled:false,changed:false};
 }
 if(match)row=db.sql.prepare('SELECT * FROM split_drafts WHERE id=? AND user_id=? AND chat_id=?').get(match[1],owner,chat);
 else row=db.sql.prepare("SELECT * FROM split_drafts WHERE user_id=? AND chat_id=? AND status='active' ORDER BY created DESC LIMIT 1").get(owner,chat);
 if(!row){if(match){stale();return {handled:true,changed:false};}return {handled:false,changed:false};}
 if(!query&&text==='/cancel'){
  db.sql.prepare("UPDATE split_drafts SET status='cancelled' WHERE id=? AND status='active'").run(row.id);say(tr('Разделение отменено. Журнал не менялся.','Split cancelled. The journal was not changed.'));return {handled:true,changed:false};
 }
 if(!query&&text.startsWith('/'))return {handled:false,changed:false};
 draft=JSON.parse(row.body);
 if(row.status!=='active'||row.expires<=at){
  if(row.status==='active')db.sql.prepare("UPDATE split_drafts SET status='expired' WHERE id=?").run(row.id);
  if(match||!query){stale();return {handled:true,changed:false};}
 }
 if(match){
  if(+match[2]!==draft.version){stale();return {handled:true,changed:false};}
  const action=match[3];
  if(action==='cancel'){db.sql.prepare("UPDATE split_drafts SET status='cancelled' WHERE id=?").run(row.id);say(tr('Разделение отменено. Журнал не менялся.','Split cancelled. The journal was not changed.'));return {handled:true,changed:false};}
  if(action==='review'){draft.stage='review';render();}
  else if(action==='edit'&&draft.parts.length){draft.stage='edit';render();}
  else if(/^e\d+$/.test(action)&&draft.stage==='edit'){
   const index=+action.slice(1);if(!draft.parts[index])stale();else{draft.edit=index;draft.pending=null;draft.stage='minutes';render();}
  }else if(action==='more'&&draft.stage==='review'&&sum()<total()&&draft.parts.length<60){draft.edit=null;draft.pending=null;draft.stage='minutes';render();}
  else if(/^p\d+$/.test(action)&&draft.stage==='category')render(+action.slice(1));
  else if(/^c(?:[a-f0-9]{12}|-)$/.test(action)&&draft.stage==='category'){
   const category=action==='c-'?null:w.categories.find(c=>!c.archived&&categoryKey(c.id)===action.slice(1));
   if(action!='c-'&&!category){say(tr('Категория больше недоступна. Выберите другую.','This category is no longer available. Choose another.'));render();}
   else{
    const part={...draft.pending,category:category?.id||'',project:''};
    if(draft.edit===null)draft.parts.push(part);else draft.parts[draft.edit]=part;
    draft.pending=null;draft.edit=null;draft.stage='review';render();
   }
  }else if(action==='save'&&draft.stage==='review'||action==='replace'&&draft.stage==='replace'){
   if(fingerprint(hits(w,draft.interval))!==draft.fingerprint){db.sql.prepare("UPDATE split_drafts SET status='conflict' WHERE id=?").run(row.id);say(tr('Запись изменилась после начала разделения. Ничего не заменено. Черновик сохранён на сервере; откройте актуальный журнал.','The entry changed after you started splitting. Nothing was replaced. Your draft remains on the server; open the current journal.'));}
   else if(draft.parts.length<2||sum()!==total()){say(tr('Нужны минимум две части и точная сумма минут.','At least two parts and the exact total minutes are required.'));draft.stage='review';render();}
   else if(draft.original.length&&action==='save'){draft.stage='replace';render();}
   else{
    let entries;
    try{entries=splitIntervalEntries(w,draft.interval,draft.parts,{source:'telegram',at:sentAt.toISOString()});}
    catch(error){say(tr('Не удалось подготовить части: ','Could not prepare the parts: ')+error.message);draft.stage='review';render();}
    if(entries){
     const replaced=new Set(draft.original.map(e=>e.id));ensureDay(w,draft.interval.date);
     w.entries=[...w.entries.filter(e=>!replaced.has(e.id)),...entries];
     draft.savedEntryIds=entries.map(e=>e.id);save();db.sql.prepare("UPDATE split_drafts SET status='saved' WHERE id=?").run(row.id);
     db.sql.prepare("UPDATE prompts SET status='answered',replied=1 WHERE id=?").run(row.prompt_id);
     db.sql.prepare('UPDATE category_choices SET expires=? WHERE prompt_id=?').run(at-1,row.prompt_id);
     changed=true;say(tr(`Сохранено частей: ${entries.length}. Всего ${total()} мин.`,`Saved ${entries.length} parts. Total: ${total()} min.`));
     const prompt=db.sql.prepare('SELECT message_id FROM prompts WHERE id=?').get(row.prompt_id);
     if(Number.isSafeInteger(prompt?.message_id))effects.push({method:'editMessageReplyMarkup',body:{chat_id:m.chat.id,message_id:prompt.message_id,reply_markup:{inline_keyboard:[]}}});
    }
   }
  }else stale();
  return {handled:true,changed};
 }
 // A reply to a different question must never be swallowed as the current draft's input.
 if(m.reply_to_message&&m.reply_to_message.message_id!==draft.inputMessage){stale();return {handled:true,changed:false};}
 if(Number.isSafeInteger(m.date)&&m.date*1000+999<row.created){stale();return {handled:true,changed:false};}
 if(draft.stage==='minutes'){
  const n=/^(\d{1,4})(?:\s*(?:мин(?:ут[аы]?)?|min(?:utes?)?))?\.?$/i.exec(text),minutes=n?Number(n[1]):0;
  const available=total()-sum()+(draft.edit===null?0:draft.parts[draft.edit].minutes);
  if(!Number.isInteger(minutes)||minutes<1||minutes>available||draft.parts.length===0&&minutes===available){say(tr(`Укажите от 1 до ${draft.parts.length===0?available-1:available} минут. В интервале должно быть минимум две части.`,`Enter 1 to ${draft.parts.length===0?available-1:available} minutes. The interval needs at least two parts.`));render();}
  else{draft.pending={minutes};draft.stage='text';render();}
 }else if(draft.stage==='text'){
  if(!text||text.length>2000){say(tr('Нужно описание от 1 до 2000 символов.','Use a description of 1 to 2,000 characters.'));render();}
  else{draft.pending.text=text;draft.stage='category';render();}
 }else say(tr('Выберите действие кнопкой в последнем сообщении разделения. /cancel — отмена.','Choose a button in the latest split message. /cancel to cancel.'));
 return {handled:true,changed:false};
}

// Persist only the delivery for the still-current input step; late deliveries cannot rewind it.
export function rememberSplitMessage(db,effect,sent){
 if(!Number.isSafeInteger(sent?.message_id))return;
 const row=db.sql.prepare("SELECT body FROM split_drafts WHERE id=? AND status='active'").get(effect.splitDraft);
 if(!row)return;
 const draft=JSON.parse(row.body);
 if(draft.version!==effect.splitVersion||!['minutes','text'].includes(draft.stage))return;
 draft.inputMessage=sent.message_id;
 db.sql.prepare('UPDATE split_drafts SET body=? WHERE id=?').run(JSON.stringify(draft),effect.splitDraft);
}
