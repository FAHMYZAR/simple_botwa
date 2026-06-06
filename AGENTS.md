# AGENTS.md

## Project shape
- Single-package CommonJS Node.js WhatsApp bot using Baileys; entrypoint is `main.js`.
- Commands are dynamically loaded from every `features/*.js` file by `Helper.loadFeatures()`; each feature must export a class whose instance has `name`, `description`, `ownerOnly`, and `execute(m, sock, parsed)`.
- `MessageParser` accepts only prefixes from `config/config.js`: owner prefix `&` and user prefix `!` by default. Command names are lowercased without the prefix.

## Commands
- Install: `npm install`
- Run bot: `npm start` (`node main.js`)
- Dev mode: `npm run dev` (`nodemon main.js`)
- No lint, typecheck, or test scripts are defined; do not invent them.

## Runtime state and env
- `.env` is loaded by `config/config.js`; relevant keys are `OWNER_NUMBER`, `OWNER_PREFIX`, `USER_PREFIX`, `FERDEV_API_KEY`, `TELEGRAM_STICKER_API_KEY`, `TELEGRAM_STICKER_API_URL`, `MISTRAL_API_KEY`, `MISTRAL_MODEL`, `ROUTER_API_KEY`, `ROUTER_BASE_URL`, `ROUTER_PRODUCTION_BASE_URL`, `ROUTER_CHAT_MODEL`, `ROUTER_QUERY_MODEL`, `AGNES_API_KEY`, `AGNES_BASE_URL`, `AGNES_IMAGE_MODEL`, `AGNES_IMAGE_SIZE`, and `NODE_ENV`.
- Router base URL switches by env: production always uses `http://localhost:20128` unless `ROUTER_PRODUCTION_BASE_URL` is set; non-production uses `ROUTER_BASE_URL` or falls back to `https://9router.icbear.space`.
- Local runtime files are intentionally gitignored: `auth_info_baileys/`, `baileys_store.json`, `bot_logs.txt`, `storage/`, `temp/`, `.env`, and logs.
- `settings.json` controls bot mode (`private` by default) and is read on every command; `features/SetModeFeature.js` writes it.
- Runtime paths now resolve from repo-relative `__dirname`; keep new code on that pattern and avoid `process.cwd()` / `./relative-path` for persistent files.
- `data/afk.json` is persistent AFK state managed by `AfkService`; avoid treating it as a fixture.

## Behavior gotchas
- `main.js` silently ignores unknown commands, non-command messages, private-mode user commands, and non-owner use of `ownerOnly` features.
- Non-owner valid commands are rate-limited in `main.js` to 5 commands per 60 seconds.
- Owner detection compares `sender` stripped of `@s.whatsapp.net`/`@lid` with `config.ownerNumber`, and also treats messages from self as owner.
- `StoreService` persists contact/message cache to `baileys_store.json` and keeps only the last 100 messages per chat.
- Temp cleanup runs every minute and deletes files in `temp/` older than 5 minutes.

## Style
- Existing code uses CommonJS, class-based features, `async execute`, and Indonesian user-facing messages; match that style for new features.
