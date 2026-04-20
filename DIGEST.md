# Alaq — digest

Append-only журнал итераций: что сделано, какие решения приняты, почему. Новые блоки добавляются снизу, старые не переписываются. ИИ в новой сессии читает последние 2–3 блока и понимает «где проект был последние недели», без необходимости грепать коммиты.

Формат записи:
- `## YYYY-MM-DD — короткий заголовок итерации`
- Секции: `### Что сделано` (факты), `### Ключевые решения` (с обоснованием), `### Отложено` (с причиной), опционально `### Открытые вопросы`.

---

## 2026-04-19 — AI-first observability + storage + IPC плагины, MCP runtime tools

### Что сделано

**Новые пакеты в scope `@alaq/*`:**

- **`@alaq/plugin-logi`** (`packages/plugin-logi/`) — observability плагин для nucl/atom. Эмитит фреймы в self-hosted Logi через Quantum Bus wildcard. Trace-контекст через action span stack + `withTrace` escape hatch. Release tag формата `${version}+${build}.r${reload}` (reload auto-incremented в localStorage). Shape-only по умолчанию, dev-debug mode opt-in через `debugValues: true`. 8 тестов (unit + live integration против `localhost:2025`). See [plugin-logi/CONCEPT.md](packages/plugin-logi/CONCEPT.md).

- **`@alaq/plugin-idb`** (`packages/plugin-idb/`) — persistence через IndexedDB. Два режима: `kind: 'idb'` (single-value KV) и `kind: 'idb-collection'` (коллекции с индексами). Optimistic sync + `$ready` / `$saved` companion nucls. Debounced write queue. Интеграция с plugin-logi через `emitFrame` (noop если plugin-logi runtime не зарегистрирован). In-memory fake-idb для bun тестов. 20 тестов. See [plugin-idb/CONCEPT.md](packages/plugin-idb/CONCEPT.md).

- **`@alaq/plugin-tauri`** (`packages/plugin-tauri/`) — IPC мост между reactive атомами и Rust-бэкендом через Tauri v2 `invoke`/`listen`. Два режима: `kind: 'tauri'` (state-mode — read/write/listen) и `kind: 'tauri-command'` (ad-hoc invoke с аргументами). Companion nucls `$ready` / `$saved` / `$error`. Lazy import `@tauri-apps/api` (optional peer). Graceful degradation в non-Tauri средах (SSR, тесты). Fake IPC для тестов. 17 тестов. See [plugin-tauri/CONCEPT.md](packages/plugin-tauri/CONCEPT.md).

**Расширение `@alaq/mcp`:**
Добавлены 7 runtime tools поверх 2 существующих (`schema_compile`, `schema_diff`):

- `alaq_capabilities` — self-describing: какие плагины активны по данным Logi
- `alaq_trace` — полная каузальная цепочка trace_id с semantic_tree (action → children)
- `alaq_atom_activity` — timeline и shape_transitions для fingerprint
- `alaq_hot_atoms` — top атомы по write frequency
- `alaq_idb_stores` / `alaq_idb_store_stats` / `alaq_idb_errors` — инвентаризация и диагностика idb хранилищ

Все tools читают из Logi HTTP API (`/api/events/*`, `/api/trace/*`), fingerprint-фильтрация — client-side. Dev endpoint по умолчанию `http://localhost:2025` + token `demo_project_token`. 50 тестов в `@alaq/mcp` (14 новых unit + integration).

**Проверено end-to-end на живом Logi:** `alaq_capabilities` видит releases, `alaq_hot_atoms` возвращает агрегаты из ClickHouse, `alaq_trace` строит дерево причинности, JSON-RPC stdio показывает все 9 tools.

**Regression:** quark 107 + nucl 43 + atom 38 + plugin-logi 8 + plugin-idb 20 + plugin-tauri 17 + mcp 50 = **283 tests, 0 fail**.

### Ключевые решения

1. **Plugin-logi shape-only по умолчанию.** Не шлём raw values чтобы не протекали PII и не забивали ingest. `debugValues: true` — явный opt-in для dev.
2. **Release = `version+build.rN`.** Reload-счётчик в localStorage отличает соседние HMR-прогоны; без него события сливаются в один "run" и ИИ не различает «старый баг» vs «текущий баг».
3. **Trace через sync span stack + `withTrace` escape hatch.** Не используем `AsyncLocalStorage` — браузерный target, + хотелка держать hot path синхронным. `withTrace(span, fn)` — явный механизм для async продолжений.
4. **Plugin-idb optimistic sync + `$saved`.** Не ломаем sync-модель nucl/atom в угоду IDB-асинхронности. Значение меняется в памяти мгновенно, запись в фоне, `$saved` — отдельный nucl для подтверждения. Оптимистично для UI, явно для тех кому важно.
5. **Plugin-idb writes, а не reads в Logi.** Read-паттерны атомов могут достигать ~400k ops/ms; логировать их = захлебнуть ingest. Writes фиксируются всегда, reads — никогда.
6. **Plugin-tauri НЕ использует `LinkDriver` из `@alaq/link`.** `LinkDriver` — слой для CRDT-синхронизации с peers/QoS/clocks; наш плагин — простой локальный IPC для nucl. Будущий `@alaq/link-tauri` (упомянут в `link/DISCUSSION.md`) — отдельный пакет, другой слой. Сосуществуют.
7. **MCP tools живут в `@alaq/mcp` централизованно, не в отдельных `plugin-mcp-*`.** Оправдано пока у нас 3 плагина и tools описываются в нескольких файлах. Когда станет ~5 плагинов — можно рефакторить в plugin-registry без breaking change.
8. **MCP tools читают Logi напрямую через HTTP API, не через Logi MCP proxy.** Избегаем двойного hops, проще ошибки, быстрее. Endpoints найдены в `A:/source/logi/crates/logi-core/src/main.rs`.
9. **Fingerprint-фильтрация client-side.** Logi `q` param — `message ILIKE`, не fingerprint match. Тянем окно до 1000 фреймов и фильтруем на MCP-стороне. Для горячих атомов с >1000 фреймов/час это может терять хвосты — приемлемое ограничение для MVP.
10. **`@alaq/plugin-logi` deps для `plugin-idb` и `plugin-tauri` — optional peer.** Плагины работают без plugin-logi (frames silently дропаются). При наличии — автоматически замыкают loop через `emitFrame`.

### Отложено

- **`alaq` meta-seed package.** План в [alaq.md](alaq.md). Три файла — `manifest.json` (каталог экосистемы), `.alaq/project.json` (память конкретного проекта, коммитится в git), `.alaq/runtime.json` (снимок из Logi, gitignored). CLI — `alaq new`, `alaq doctor`, `alaq install`, `alaq decide`, `alaq sync`. Откладываем потому что без хотя бы 3 плагинов с MCP tools seed нечем наполнять, а теперь есть.
- **Decision Protocol** как отдельный пакет/слой. Его место — `decisions[]` внутри `.alaq/project.json`. Реализация вместе с alaq seed.
- **Third-party plugin convention.** Экосистема сейчас замкнута, convention регистрации `@foobar/alaq-plugin-wasm` через package.json field — не нужна до первой сторонней попытки.
- **`alaq sync` как daemon / watch mode.** MVP — только ручной запуск. Автомагия добавит сложности и бесит пользователя.
- **Унификация style plugins** (`natural`, `technical`, `poetic`) из `packages/alaq` — другой слой, не пересекается с plugin-logi/idb/tauri.

### Открытые вопросы для следующей волны

- Когда появится `alaq new` — какой дефолт preset? `web+local+vue`? Или `ask every time`?
- `.alaq/project.json` как merge: два ИИ в параллельных сессиях пишут разные decisions — как резолвить конфликты? Пока last-write-wins; может понадобиться append-only log.
- `plugin-tauri` + `plugin-logi` + реальное Tauri приложение — не проверяли. Проверится когда кто-то подключит плагин к kladinets или app/Valkyrie.

### Ссылки

- [AGENTS.md](AGENTS.md) — normative правила и Ecosystem layout (обновлён этой волной).
- [architecture.yaml](architecture.yaml) — машинный реестр пакетов (обновлён).
- [CHECK.md](CHECK.md) — процедура верификации (TODO: добавить секцию plugin-*).
- [alaq.md](alaq.md) — философия alaq seed (TODO: создать).
- Live Logi для dev: `cd A:/source/logi && docker compose up -d` → `http://localhost:2025`.

---

## 2026-04-19 (late) — plugin-idb проверен в настоящем Chromium

### Что сделано

Отдельный Playwright-harness в `packages/plugin-idb/playwright/` проверил плагин против **настоящего** IndexedDB в Chromium (не fake-idb).

**Подход:** Bun.build → один bundle.js → Playwright открывает `harness.html` через `file://` → вызывает сценарии через `page.evaluate`. Никакого dev-сервера, никаких новых npm deps. Добавлены scripts `test:browser:build` + `test:browser:run`.

**5 сценариев, все pass (1.2s):**
1. KV save → real page reload → restore (106ms)
2. Collection insert+query → reload → restore (106ms)
3. Rapid writes debounce to final value (109ms) 
4. DataCloneError на non-serializable value (256ms) — **главный тест**, см. ниже
5. Default value не перезаписывает empty slot (131ms)

### Ключевая находка: материальное расхождение fake-idb ↔ real IDB на DataCloneError

**Fake-idb врёт:** `store.records.set(k, value)` в обычный JS `Map` — хранит **что угодно** (функции, Symbol, циклические ссылки). Ни один bun-тест не мог проверить error path `kvPut → reject`.

**Настоящий IndexedDB** через structured clone кидает `DataCloneError` на функциях. Plugin-idb реагирует **корректно**:
- `flushKv` catch → rollback in-memory значения на `st.lastSaved`
- `$saved` остаётся `false`
- `logIdb` эмитит error frame
- На диск ничего не попадает

Тест зафиксировал **реальное поведение** ассертами:
- `saved === false` (write failed)
- `raw.hit === false` (nothing persisted)
- `inMemory.hasFn === false` (rollback wiped function)
- Rejection swallowed — не всплывает как `unhandledrejection`

### Два observation worth documenting (не баги, архитектурные выборы)

1. **Rollback на DataCloneError уничтожает юзерский in-memory state.** Установил `{fn: ..., nested: {n:1}}` → после rollback получил `lastSaved` (в тесте `null`). Для UI который уже успел отрендерить — неожиданно. Можно было бы оставить `$error` companion nucl чтобы UI знал что не так. Сейчас — только `$saved === false` + logi frame.

2. **Ошибки swallowed внутри плагина.** Без подключённого plugin-logi пользователь узнаёт о провале только через `$saved`. Это осознанный выбор (не ломаем sync API, не бросаем в reactive граф), но его надо документировать в CONCEPT.md plugin-idb.

### Что НЕ проверено

- **QuotaExceeded** skipped. Headless Chromium даёт ~60%+ диска как квоту; чтобы упереться, нужны сотни MB и StorageManager loop. Flaky по heuristics. Отложено.
- **Concurrent tabs**, **VERSION_CHANGE при upgrade во второй вкладке** — не тестировались.
- **Firefox / Safari WebKit** — только Chromium.
- **Logi integration в real browser** — plugin-logi frames не проверялись через MCP в этом прогоне.

### Regression после смены

`bun test packages/plugin-idb`: 20/20 pass. Bun тесты не задеты (`.e2e.ts` суффикс скрывает smoke от bun matcher).

### Итог

Уверенность в plugin-idb выросла качественно. Fake-idb работает для 80% путей, но **error-paths теперь проверены против реальности**. Два архитектурных выбора (agressive rollback, swallowed errors) — не баги, но надо упомянуть в CONCEPT.md чтобы пользователь не удивлялся.
