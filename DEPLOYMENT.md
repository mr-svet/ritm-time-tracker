# Статус публикации Ритм

## Отметки дня в гостевом режиме — опубликовано 21.10.2026

Коммит `3265c32` отправлен в GitHub и развёрнут через Dokploy со статусом Done. Перед выпуском создана проверенная копия SQLite `/app/backups/rhythm-2026-10-21T10-20-22-882Z-29dc1e97.sqlite`. Гостевой журнал показывает неравномерные подъёмы, отбои после полуночи и отдельные пропуски. Нажатие `＋` в пустой ячейке общей сводки позволяет добавить время; существующие отметки редактируются. Подписи полей дат визуально скрыты, но доступны экранным дикторам. Логотип набран крупными прописными буквами. В README вместо условной иллюстрации помещён настоящий снимок интерфейса со ссылкой на гостевой режим.

Проверены `npm run check`, `npm run build`, 101 тест, сохранение пропущенной отметки в локальном браузере, гостевая таблица на HTTPS (55 отметок и 7 пропусков за показанный месяц) и загрузка изображения в GitHub. Личные записи владельца при проверке не менялись.

## Проекты в боте и месячная сводка — опубликовано 21.10.2026

Коммит `46645cd` отправлен в GitHub и развёрнут через Dokploy со статусом Done. Перед выпуском создана проверенная копия SQLite `/app/backups/rhythm-2026-10-21T09-49-22-013Z-18332774.sqlite`; контейнер `rhythm-rhythm-xqgpwf-rhythm-1` после выпуска running/healthy. По HTTPS проверен изолированный гостевой режим с разреженными вымышленными записями и 31 дата сводки от 21 сентября до 21 октября. GitHub показывает иллюстрированное превью в README и ссылку на живую демонстрацию. Локально прошли синтаксис, сборка и 100 тестов, включая выбор проекта и дополнение планового интервала. Реальный диалог в Telegram будет проверен при ближайшем опросе.

## Выбор времени подъёма и оформление сводки — опубликовано 21.10.2026

Коммит `3eab180` отправлен в GitHub. Добавлены кнопки утреннего вопроса «Только что» и «Другое время» с вводом ЧЧ:ММ, удаление категорий с сохранением старых занятий без категории, перестановка строк «Подъём»/«Отбой», выбор дат рядом с заголовком, разноцветные показатели ленты и значок выхода у профиля. Прошли 96 тестов, синтаксис и сборка; сводка просмотрена на компьютере и узком экране.

Перед публикацией создана проверенная копия SQLite `/app/backups/rhythm-2026-10-21T06-56-30-197Z-3a61e9da.sqlite`. Dokploy развернул `main` на коммите `579b209` со статусом Done; контейнер работает и healthy. На HTTPS странице `/trends` проверены строки «Подъём» и «Отбой», диапазон дат рядом с заголовком, цветная лента, значок выхода и прежние записи. На `/settings` доступно удаление категории; существующие категории при проверке не удалялись. Настоящий утренний диалог Telegram после выпуска ещё нужно проверить в ходе использования.

## Утренний вопрос и отбой — опубликовано 21.10.2026

Коммиты `98efcc0` и `98db861` добавили отдельные отметки фактического времени пробуждения и отбоя, утренний вопрос до обычных опросов, кнопку «Отбой», строки сводки и изменения подписей и высоты таблицы. Синтаксис, сборка и 94 теста прошли; локальная сводка проверена в браузере.

Перед публикацией через терминал действующего контейнера создана проверенная копия SQLite `/app/backups/rhythm-2026-10-21T04-21-53-037Z-81e5c2d8.sqlite`. Dokploy развернул коммит `a1bb68e` со статусом Done; новый контейнер работает и healthy. На HTTPS странице `/trends` проверены строки «Проснулся» и «Отбой», отсутствие лишних подсказок и внутренней вертикальной прокрутки; на странице настроек удалён вводный заголовок, в шапке отсутствует метка «В базе данных». Личные записи при проверке не редактировались. Настоящий суточный сценарий вопросов, ответа и отбоя в Telegram ещё нужно проверить в ходе использования.

## Компактная общая сводка — опубликовано 21.10.2026

Коммит `591ec49` отправлен в GitHub и развёрнут через Dokploy со статусом Done. Перед выпуском создана копия SQLite `/app/backups/rhythm-2026-10-20T20-00-07-463Z-78eda4f9.sqlite`. Контейнер `rhythm-rhythm-xqgpwf-rhythm-1` работает и имеет статус healthy. На HTTPS странице `/trends` проверены порядок меню «Сегодня», «Общая сводка», «Журнал», компактная таблица с итогами и отсутствие прежнего блока аналитики; на `/journal` три действия находятся в одной полосе над фильтрами. Личные записи при проверке не изменялись.

До публикации локально проверены таблица без горизонтальной прокрутки на компьютере и телефоне, оба языка и светлая тема. Прошли 92 теста, проверка синтаксиса и сборка.

## Закреплённый день и итоги — опубликовано 20.10.2026

Коммит `5058807` отправлен в GitHub. Текущий день расположен сразу после категорий и закреплён при горизонтальной прокрутке; выбранный исторический период закрепляет свою последнюю дату. Отдельная таблица под матрицей удалена, внизу матрицы добавлены суммы записанного времени по датам. На узких экранах матрица сохраняет табличный вид. Локально прошли 92 теста, проверка синтаксиса, сборка, просмотр на компьютере и телефоне.

Перед выпуском создана проверенная копия SQLite `/app/backups/rhythm-2026-10-20T19-16-34-443Z-2de723df.sqlite`. Dokploy развернул коммит `95f0f55` со статусом Done; контейнер работает и healthy. На HTTPS странице `/trends` в гостевом режиме проверены текущая дата сразу после категорий, предыдущие дни справа, строка «Итого» и раскрытие интервалов по нажатию на время. Личные записи при проверке не изменялись.

## Суммарное время в карте занятий — 20.10.2026

Опубликован коммит `10fbd1b`: в ячейках карты показана общая длительность занятий за дату и число интервалов. По нажатию открываются все интервалы с описаниями и переходом в журнал. Для чтения матрицы добавлены контрастные ячейки, разделители, чередование строк и закреплённые заголовки. Переключатель языка теперь одна кнопка EN/RU. В Telegram после выбора категории бот сообщает её название и позволяет выбрать другую; кнопки исходного вопроса убираются после сохранения описания.

Перед выпуском создана проверенная копия SQLite `/app/backups/rhythm-2026-10-20T12-45-14-998Z-283f1187.sqlite`. Развёртывание Dokploy завершилось со статусом Done. На HTTPS странице `/trends` в гостевом режиме проверены сумма времени, подробности интервалов и переключение языка. Локально прошли 92 теста, проверка синтаксиса и сборка. Сценарий Telegram проверен автоматическими тестами; настоящий ответ владельца в боте после выпуска ещё не проверялся.

## Карта занятий и открытая демонстрация — 20.10.2026

Опубликован коммит `df7e184`: матрица «категории × даты» с конкретными интервалами, изменение порядка категорий, вес категорий и выбор основы расчёта продуктивности, гостевой вход без пароля на отдельных вымышленных данных, двуязычный сценарий Telegram и пять дополнительных фотографических пейзажей. Кнопки выбора категории в боте убираются после выбора; далее бот просит написать занятие и подтверждает его кратко. Язык бота меняется командой `/language` или `/lang`.

Перед развёртыванием вручную создана проверенная копия `/app/backups/rhythm-2026-10-20T12-20-32-583Z-ad911d93.sqlite`. Dokploy завершил выпуск со статусом Done; контейнер `rhythm-rhythm-xqgpwf-rhythm-1` работает и healthy. На рабочем HTTPS домене проверены вход посетителя без пароля, изолированные демонстрационные записи, матрица и формула, переключение EN/RU и загрузка всех шести фотографий. Личные записи владельца при проверке не менялись. Настоящий ответ боту после выбора категории остаётся для пользовательской проверки в Telegram.

Локально: 92 теста, проверка синтаксиса и сборка прошли.

## Telegram reply routing — 20 October 2026

Release `07dd291` is deployed. Used, expired or unrecognized category requests no longer route replies silently to the current interval. A new category selection replaces unfinished older selections. Continuation copies only the last individual activity, and repeated clicks do not duplicate it. Existing journal entries are not rewritten automatically.

A verified SQLite backup was created before deployment. Deployment completed successfully. All 89 tests and syntax checks passed, including synthetic regressions for stale replies and mixed-activity summaries. The next real owner reply still requires end-to-end verification.

Приложение опубликовано: https://ritmday.space/

## Обновление 20.10.2026

Развёрнута версия `f64fec5` с изменяемыми категориями, выбором категории перед описанием занятия в Telegram, страницей тенденций по дням и месяцам, редактированием прошлых занятий и поиском городов для выбора часового пояса.

Перед обновлением создана и проверена резервная копия базы. Развёртывание завершилось успешно; приложение прошло проверку работоспособности. Сайт открывается по HTTPS и требует входа владельца для доступа к личному журналу.

Проверки кода: 75 тестов, проверка синтаксиса, сборка и проверка интерфейса на демонстрационных данных, включая мобильный вид.

Проверка новых приватных страниц в сеансе владельца, доставки настоящего вопроса Telegram и сохранения ответа после обновления ещё требуется. Пользовательская приёмка не отмечена выполненной.

## Последующие обновления

Перед публикацией проверяйте код и создавайте резервную копию данных. После развёртывания проверяйте работоспособность сайта и интеграций. Версия, опубликованная на сайте, может отличаться от последнего коммита документации; изменения приложения требуют нового развёртывания.


## Гостевой просмотр — 20.10.2026

Развёрнута версия `4b31ace`: отдельный гостевой вход, временная демонстрация без сохранения занятий и настройка пароля владельцем. Перед публикацией создана проверенная копия базы; развёртывание успешно, приложение healthy. Проверено открытие сайта по HTTPS и наличие формы «Гостевой доступ» у владельца.

Проверки: 80 тестов, синтаксис и сборка; в браузере на отдельной тестовой базе проверены гостевой вход, сброс изменений после обновления страницы и отсутствие личных функций. При первичной публикации пароль ещё не был установлен. Пароль не включён в исходники. 20.10.2026 после установки пароля владельцем проверен настоящий гостевой вход на действующем сайте.


## Английский интерфейс и светлая тема — 20.10.2026

Подготовлена версия 0.5.0: английский по умолчанию с переключением на русский, светлая и тёмная темы, видимый результат проверки соединения и гостевой журнал за четыре недели. Язык и тема сохраняются отдельно от данных журнала. Личные записи не переводятся и не переписываются. Формат базы и права доступа не менялись.

Проверки: 85 тестов, синтаксис, сборка автономного HTML; в браузере проверены оба языка, обе темы, мобильная компоновка, сохранение черновика при переключении языка и сброс гостевых изменений после обновления страницы. Версия `7a5a199` опубликована через Dokploy. Перед обновлением создана проверенная копия SQLite. Развёртывание завершилось успешно, приложение healthy. По HTTPS проверены английский по умолчанию, русский, светлая тема, успешная проверка подключения и реальный гостевой вход с наполненным журналом. Формат базы и данные владельца не менялись.

## Единая светлая палитра — 20.10.2026

Опубликована версия `78c6d0a`: светлые шапка, карточки, журнал и настройки, светлая «Картина дня» и меняющийся вместе с темой знак Ritm. Перед развёртыванием создана проверенная копия SQLite. Dokploy отметил выпуск Done, контейнер running/healthy; по HTTPS проверены светлое оформление формы входа и новая иконка. Полный гостевой интерфейс проверен на отдельной синтетической базе на настольном экране и телефоне, также проверены обе темы и оба языка. Синтаксис, сборка и 89 тестов прошли.

Пароль гостя из более раннего сообщения не сработал при проверке нового сеанса на опубликованном сайте. Причина не установлена; доступ владельца и его записи не менялись этой версией. Проверка полного интерфейса непосредственно в новом гостевом сеансе остаётся открытой.

## Пейзажи, адреса разделов и язык — 20.10.2026

Коммит `c2d554a` отправлен в GitHub. Русский стал начальным языком, старые сохранённые настройки темы переносятся, шесть пейзажей доступны в «Картине дня», добавлен Алматы, маршруты используют прямые пути. Локально пройдены синтаксис, автономная сборка, 89 тестов и браузерная проверка светлой темы, выбора пейзажа, истории навигации и поиска города.

Перед публикацией через Dokploy создана и проверена резервная копия SQLite: `rhythm-2026-10-20T08-05-09-674Z-2cd0a0de.sqlite`. Адрес Git-репозитория в Dokploy обновлён на `mr-svet/ritm`.

Выпуск `db5569e` (включает изменения `c2d554a`) завершён в Dokploy со статусом Done. Контейнер `rhythm-rhythm-xqgpwf-rhythm-1` работает и healthy. На публичном HTTPS сайте проверены прямые адреса `/today` и `/journal`, русский язык по умолчанию и наличие переключателя языка на форме входа. Полный интерфейс владельца на опубликованной версии не проверялся; светлая «Картина дня», выбор пейзажа и Алматы проверены локально на синтетических данных. Приватные записи не затрагивались проверкой выпуска.
# Security hardening — 23.10.2026

- Container runtime: Node.js 24.22.1 (October security release).
- Authentication JSON is limited to 4 KiB; only the authenticated journal update accepts the existing 12 MiB journal budget plus its envelope.
- Login attempts are reserved before reading the body, including parallel requests. Rate-limit memory is bounded and expired buckets are removed.
- `TRUSTED_PROXY_IPS` is empty by default. Set it in Dokploy to the exact Traefik IP on the application's Docker network. Only requests from these peers may use the rightmost `X-Forwarded-For` address. Never list arbitrary clients, entire private networks or `0.0.0.0`.
- Verify the Traefik peer address again if its container or network is recreated. A changed peer fails closed to the socket address; it does not trust forwarded headers automatically.
- Keep port 4173 unpublished and the administration panel accessible through the SSH tunnel. Preserve both existing named data/backup volumes during deployment.
- Deployment and live host verification must be recorded separately after the tunnel is available. A local test run is not evidence of host firewall, SSH configuration or off-server backups.

## Automatic exact proxy trust — 24.10.2026 (prepared, not deployed)

For this Dokploy installation, replace the environment's static `TRUSTED_PROXY_IPS`
entry with `TRUSTED_PROXY_HOSTS=dokploy-traefik`; remove the old IP entry. The two
settings are mutually exclusive. The Compose file passes this setting to the app.
Only use the exact internal name of the proxy controlled by the administrator;
do not configure public domains or broad network ranges.

The app resolves this name at startup and every 15 seconds through internal
Docker DNS. Each successful lookup replaces the complete set of exact peer
addresses. Failed, empty, invalid or timed-out (2 seconds) lookups revoke trust.
Results also expire after 60 seconds measured with a monotonic clock. During
an address change, the preceding result can remain trusted until the next
refresh, at most 60 seconds without a successful refresh. Without a trusted peer,
forwarded client headers are ignored and rate limits use the socket address;
several visitors behind the proxy can therefore temporarily share a limit.

The application's network still must be private: port 4173 remains unpublished.
Do not attach untrusted containers to `dokploy-network`. This change does not
grant the application access to the Docker socket or require host root access.

Before deploying, create a verified SQLite backup and preserve both named
volumes. Deploy the security commit through Dokploy; do not use Fresh Volumes.
Verify the container is healthy, its environment has the hostname and no static
proxy addresses, Docker DNS resolves the expected Traefik peer, and HTTPS health
and authentication work. Synthetic tests exercise IP replacement and spoofed
headers; they do not prove production settings or firewall reachability.

Full disaster recovery remains open: a valid gzip archive, SQLite integrity
check and completed PostgreSQL dump do not establish a working Dokploy restore.
Test the saved configuration and databases in a separate isolated Docker host,
without connecting the restored panel to the production Docker socket, bot or
deployment targets. Do not enable restored schedules or external integrations
during this test. A new paid server requires an agreed budget.

