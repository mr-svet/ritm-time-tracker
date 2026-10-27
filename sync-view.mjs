// Render only bounded, escaped differences. Private journal text never becomes HTML.
const syncEscape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function conflictMarkup(conflict,t,clock){
 if(!conflict.server)return `<section class="banner error sync-conflict" role="alert"><h2>${t('Журнал изменён одновременно')}</h2><p>${t('Ваш вариант остался в памяти. Свежая версия сервера пока недоступна. Повтор устаревшего сохранения заблокирован.')}</p></section>`;
 const local=conflict.local.workspace,server=conflict.server.workspace;
 const left=new Map(local.entries.map(entry=>[entry.id,entry])),right=new Map(server.entries.map(entry=>[entry.id,entry]));
 const changed=[...new Set([...left.keys(),...right.keys()])].filter(id=>JSON.stringify(left.get(id))!==JSON.stringify(right.get(id)));
 const describe=entry=>entry?`${entry.date} ${clock(entry.start)}–${clock(entry.end)} · ${(entry.activities?.length?entry.activities.map(item=>item.text).join(' · '):entry.text)}`:t('Нет записи');
 const details=changed.slice(0,20).map(id=>`<li><p><strong>${t('Ваш вариант')}:</strong> ${syncEscape(describe(left.get(id)))}</p><p><strong>${t('Сервер')}:</strong> ${syncEscape(describe(right.get(id)))}</p></li>`).join('');
 const metadata=value=>Object.fromEntries(Object.entries(value).filter(([key])=>!['entries','telegram'].includes(key)));
 const settingsChanged=JSON.stringify(metadata(local))!==JSON.stringify(metadata(server));
 return `<section class="banner error sync-conflict" role="alert"><h2>${t('Журнал изменён одновременно')}</h2><p>${t('Ваш вариант не заменил новые записи. Откройте свежий журнал, затем повторно сохраните нужные поля. Черновики останутся в этой вкладке.')}</p><p>${t('Ваш вариант')}: ${conflict.local.revision} · ${t('Сервер')}: ${conflict.server.revision}</p><details><summary>${t('Различающиеся записи')}: ${changed.length}</summary><ol>${details}</ol>${changed.length>20?`<p>${t('Показаны первые 20 различий. Полный локальный вариант можно скачать.')}</p>`:''}</details>${settingsChanged?`<p>${t('Также отличаются настройки, категории, проекты или отметки дня. Перед повторным сохранением проверьте их в свежем журнале.')}</p>`:''}</section>`;
}
