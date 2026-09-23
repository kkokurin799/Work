# Work

Личный контур руководителя продуктового направления: проекты запуска у клиентов, бэклог развития, сроки и напоминания.

- [Техническое задание](docs/TZ.md) — сценарии, экраны, поля, формат почты и Telegram, подсветка за 14 дней, приёмка.
- [Архитектура](docs/ARCHITECTURE.md) — сервис, модель данных, разбор сообщений, оповещения, развёртывание.

Общая шапка фильтрует проекты и бэклог по команде, продукту, клиенту и контрольной дате. Оповещения уходят в Telegram. Почта и Telegram принимаются как каналы входа: сырое сообщение сохраняется, неразобранное остаётся во входящих.

## Запуск

Нужны Node.js 22 и PostgreSQL 16.

```bash
cp .env.example .env
# поправьте DATABASE_URL, SESSION_SECRET, OWNER_EMAIL и OWNER_PASSWORD
npm install
npm test
npm run dev
```

Первый запуск создаёт таблицы и владельца из `OWNER_EMAIL` / `OWNER_PASSWORD`. Вход — по этой почте и паролю.

`docker compose up -d` поднимает только базу. Приложение читает `DATABASE_URL`.

Срез Telegram включается переменными `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` и `TELEGRAM_OWNER_USER_ID`. Webhook: `POST /api/telegram/webhook`. Срез почты — `IMAP_HOST`, `IMAP_USER`, `IMAP_PASSWORD` и `IMAP_ALLOWED_FROM`. Пока переменные пустые, реестр работает без бота и без ящика. Копия базы пишется в `backups/` раз в сутки, если доступен `pg_dump`.
