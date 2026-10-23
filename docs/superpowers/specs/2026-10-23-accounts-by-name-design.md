# Аккаунты по имени и синхронизация прогресса

## Зачем

Сейчас прогресс живёт только в localStorage браузера. Нужно, чтобы человек мог войти под своим
именем на любом устройстве и продолжить с того же места. Сервис некритичный, поэтому вход — только
по имени, без пароля и без email: кто знает имя, тот входит в аккаунт. Это осознанный компромисс.

Без входа сайт работает как сейчас: прогресс в localStorage этого браузера, на сервер ничего не уходит.

## Имя

- длина 3–32 символа;
- без пробелов; допустимы буквы любого алфавита, цифры, `_` и `-` (`^[\p{L}\p{N}_-]{3,32}$`, флаг `u`);
- регистр не важен: имя хранится как ввели, сравнивается по `lower()` (уникальный ключ `name_key`);
- валидация одинаковая на клиенте и сервере (клиент — для мгновенной подсказки).

## Сценарий входа

1. В шапке кнопка 👤. Без входа открывает окно «Вход»: поле «Ваше имя» и кнопка «Продолжить».
2. `POST /api/enter {name}`. Если имя есть — вход. Если нет — `404 {exists:false}`, окно показывает
   «Такого имени ещё нет — создать аккаунт «name»?» с кнопками «Создать» и «Исправить».
3. «Создать» → `POST /api/enter {name, create:true}` → `201`. Если имя успели занять — просто вход.
4. После входа: если в анонимном localStorage есть непустой прогресс, он сливается с серверным,
   результат сразу отправляется на сервер, анонимный ключ очищается.
5. Под входом 👤 открывает окно с именем и кнопкой «Выйти». Выход возвращает к анонимному режиму
   (анонимный прогресс после слияния пуст — он уже в аккаунте).

## Сервер (`server/`, отдельный образ `api`)

Node 24, `node:http` + `node:sqlite`, без зависимостей; TypeScript запускается напрямую (type stripping),
как в rust_calculator.

Таблицы:

- `users(id INTEGER PK, name TEXT, name_key TEXT UNIQUE, created_at TEXT)`;
- `progress(user_id INTEGER PK → users.id, state TEXT, updated_at TEXT)`.

Сессия: httpOnly cookie `gd_session=<userId>.<hmac>` (HMAC-SHA256 на `SESSION_SECRET`), `SameSite=Lax`,
`Path=/api`, `Max-Age` 180 дней, `Secure` если запрос пришёл по https (`X-Forwarded-Proto`).

Эндпоинты (все JSON, `Cache-Control: no-store`):

| метод | путь | ответ |
|---|---|---|
| POST | `/api/enter` `{name, create?}` | 200/201 `{name, state}` + cookie; 404 `{exists:false}`; 400 плохое имя; 429 лимит |
| GET | `/api/me` | 200 `{name, state}` или 401 |
| POST | `/api/logout` | 204, cookie стёрта |
| PUT | `/api/progress` `{state}` | 204; 401 без сессии; 400 не объект; 413 > 256 КБ |

`state` — весь `AppState` как есть (или `null`, если ещё не сохраняли). Сервер проверяет только, что это
объект и размер; разбирает и валидирует состояние клиент (`deserializeApp`), как и для localStorage.

Лимит на `/api/enter`: 30 запросов в минуту с IP (`X-Real-IP` от nginx), учёт в памяти.

## Клиент

- `src/logic/account.ts` — валидация имени, вызовы API (`enter`, `me`, `logout`, `saveProgress`).
- `src/logic/merge.ts` — `mergeApp(local, remote): AppState`:
  - `learned`, `grammar.completed` — объединение множеств;
  - `weak` — объединение, при совпадении больший счётчик, выученные (после объединения) убираются;
  - `score`, `bestStreak`, `mock.nextVariant` — максимум;
  - `mock.history` — объединение без дублей по `date+variantId`, по дате;
  - `grammar.active`, `lastId`, вкладка и настройки — из серверного, если он есть.
- `appState.ts` — функции загрузки/сохранения принимают ключ; ключи: анонимный `greek_drilling.v3`,
  пользовательский кэш `greek_drilling.v3.user`, подсказка `greek_drilling.user` (имя).
- `App.tsx`:
  - старт: если есть подсказка — сразу грузим пользовательский кэш, иначе анонимный ключ;
    затем `GET /api/me`: 200 → состояние с сервера (или слияние с кэшем, если на сервере `null`);
    401 → подсказка и кэш очищаются, грузится анонимный ключ; сеть недоступна → остаёмся на кэше;
  - сохранение: аноним — анонимный ключ; пользователь — кэш + `PUT /api/progress` с задержкой 1,5 с,
    при `pagehide` — немедленно с `keepalive`; ошибка сохранения молча повторяется при следующем изменении;
  - одновременная работа на двух устройствах — побеждает последняя запись.
- `components/AccountSheet.tsx` — окно входа/выхода в стиле `SettingsSheet`; кнопка 👤 в `Header`.

## Деплой

- `Dockerfile`: новый target `api` (node:24-alpine, `server/`, volume `/data`, `USER node`).
- CI: Node 24 (нужен `node:sqlite`), `npm test` гоняет vitest и `node --test server/`; образы `app` и
  `api` собираются через buildx под amd64+arm64.
- `docker-compose.yml`: сервис `api` (`DB_PATH=/data/gd.db`, `SESSION_SECRET` из `.env`, volume `data`).
- `nginx.conf`: `location /api/ → api:3000` с `X-Real-IP`/`X-Forwarded-Proto`; `/api/transcribe` остаётся.
- Caddy передаёт `X-Forwarded-Proto` — nginx прокидывает `$http_x_forwarded_proto` дальше.
- На маке: `.env` с `SESSION_SECRET` в `workdir/greek_drilling` (кладётся один раз руками).
- Vite dev: `API_DIRECT=http://localhost:3000` проксирует `/api` (кроме transcribe) на локальный сервер.

## Тесты

- vitest: `mergeApp`, валидация имени.
- `node --test`: API на `:memory:` — вход/создание/404, регистр имени, плохие имена, cookie и подделка
  подписи, сохранение и чтение прогресса, лимиты размера и запросов, выход.
