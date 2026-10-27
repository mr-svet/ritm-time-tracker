# Shared journal release plan

Status: prepared, unverified, not deployed. Owner accepted stages one/two for iPhone/Desktop. Web deferred; Android untested.

## Architecture

Use the existing Dokploy rhythm service, one running replica, its existing personal SQLite and one Telegram polling process. The site and /tg use the same JournalDB and revision checks. Mini App sessions are separate from website sessions. Do not mount the production volume into the test container or move artificial records into production. Keep /miniapp-test unchanged for reference.

At release set only MINI_APP_ENABLED=1; keep APP_ORIGIN=https://ritmday.space and empty APP_PATH_PREFIX in the production service. TELEGRAM_POLLING_ENABLED stays enabled by its existing default. Existing owner binding controls Telegram login. Normal bot startup syncs the bound owner's menu to https://ritmday.space/tg. Do not run configure-menu.py from the old test setup.

## Prepared source

Base: GitHub main 1f40f74. Preserve its three-button wake-up question and current help text. Overlay accepted Mini App stage one and stage two. Do not merge the old unrelated Git history. Validate all source changes before commit/push. Source differences relative to the live deployed image must be established after SSH returns.

## Gates before publication

1. Explicit owner permission: full tests, syntax, standalone build, synthetic shared-journal HTTP/login/conflict/retry scenarios; test-only cleanup of this run. Review merged diff and ensure latest wake-question change is retained.
2. Check actual Dokploy source HEAD and current main container, mounts and health through the existing access. A current GitHub HEAD alone does not prove the live HEAD. No firewall or login changes without a new approval.
3. Create a verified SQLite snapshot inside the existing private backup volume. Do not export personal data to source/Git or output. The prepared backup script creates a unique directory, refuses overwrite and retains partial output on failure; it never cleans up. Record only private path and integrity result.
4. Capture current image identity, settings and owner menu privately on VPS for rollback. Do not expose token or IDs.
5. Show exact release diff and backup result to owner; final production switch requires separate approval.
6. After approval publish the reviewed commit, verify CI/container build, deploy the existing service, then check health and real HTTPS /tg. Verify unauthorized login denial and owner's existing journal access without writing synthetic data into it. Verify one polling process only. Ask owner for final iPhone check of the actual journal.

## Rollback

Retain old image and source and all volumes. If release fails, stop only the new production process and redeploy the previous image with MINI_APP_ENABLED disabled. Restore owner menu from its private saved object only with owner authorization. Preserve new writes; do not automatically restore a whole database snapshot or delete the additive Mini App table. A data restore is a separate sensitive action. Test deployment and synthetic volume remain separate.

## Проверки объединённой версии выполнены — 27.10.2026

По прямому разрешению владельца пройдены 173/173 теста, синтаксис 32 модулей, автономная сборка и git diff --check. Новые production-miniapp-shared тесты через настоящий локальный HTTP подтвердили: отдельные cookie сайта и Mini App, общий журнал, видимость сайта в Mini App и записей синтетического бота в обоих клиентах, 409 при устаревшей версии и повтор исходной операции без дублей. Отдельный тест подтверждает сохранение трёх утренних кнопок из main 1f40f74. Первый вариант теста ошибочно уже отмечал подъём, поэтому проверял другой экран; исправлена только предпосылка теста, код бота не менялся.

Лог: /private/tmp/ritm-production-integration-final-20261027.log. Автономный HTML пересобран. Локальный сценарий резервирования output/miniapp-production-2026-10-27/backup-before-release.mjs проверен на искусственной SQLite с WAL: зафиксированная запись попала в копию, integrity_check=ok, исходник сохранён. Очистка затронула только временные данные этого запуска по отдельному согласию.

SSH к VPS 2.29.108.0 повторно завершился таймаутом. Проверка текущего live HEAD/volume и создание копии личной базы не выполнены. Docker build объединённой версии не выполнен: локальный daemon ранее недоступен, удалённого доступа сейчас нет. Публикации, изменения меню и рабочего сервиса не было. Предыдущие строки о непроверенной версии заменяются этой записью. Следующий шаг — восстановить штатный доступ, подтвердить live-состояние, создать резервную копию и получить отдельное согласие на финальное переключение.
