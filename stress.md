# Stress-test журнал alak v6

Живой журнал находок от потребителей, стресс-тестирующих стек alak v6 на реальных задачах.

**Правила ведения:**
- Append-only. Новые записи — снизу. Старые не редактируются (если не ошибка — тогда приписать опровержение записью ниже, не стирать).
- Одна запись = один шаг одного потребителя. Дата, потребитель, шаг, находка, следствие.
- Находки — конкретные. Не "SPEC местами сложный", а "в SPEC §7 нет директивы X, мне пришлось Y, предлагаю Z".
- Цвет давления: 🟢 работает / 🟡 работает криво / 🔴 не работает. Для быстрого сканирования.
- Читать перед каждым новым шагом — возможно твоя находка уже зафиксирована.

Живые потребители:
- **Belladonna** (pharos/Belladonna) — Tauri-ридер .md, стресс-тест SDL + plugin-tauri + будущий graph-tauri-rs/graph-tauri
- **Arsenal v2** (rest.valkyrie/arsenal) — см. concept.v2.md, стресс-тест SDL + plugin-tauri + plugin-logi + будущий graph-axum/graph-tauri-rs/graph-tauri

---

## 2026-04-20 — Belladonna, шаг 1: минимальный reader.aql компилируется чисто

**Контекст:** первый контакт потребителя (Belladonna) с `@alaq/graph`. Задача — описать 5 Tauri Commands + 3 record-типа для режима Reader и прогнать через компилятор.

**Артефакт:** `A:/source/pharos/Belladonna/schema/reader.aql`. Actions: `RenderMarkdown`, `RecordView`, `GetViewHistory`, `OpenInExplorer`, `CloseWindow`. Records: `TocEntry`, `RenderedDoc`, `ViewHistoryEntry`. Директивы: `@default`, `@range`.

**Результат компиляции:** 0 диагностик. IR валиден. Records и actions без scope/crdt/sync ложатся чисто.

### Находки

**🟢 Actions без output как fire-forget.**
Три из пяти actions (`RecordView`, `OpenInExplorer`, `CloseWindow`) — fire-and-forget. В SPEC §5 `output` опционален (R061). Работает как ожидалось.

**🟢 `@default` + `@range` на аргументе action.**
`GetViewHistory.input.limit: Int! @default(value: 20) @range(min: 1, max: 500)` — оба директивы применяются к полю action input, парсер не ругается, IR содержит обе. Полезно для UI-генерации (form-inputs с дефолтом и границами).

**🟡 Нет семантики "local-only / IPC-only / Tauri-only".**
SPEC §11 описывает wire mapping для Tier-2 генератора (Zenoh topics). Actions `belladonna.reader.RenderMarkdown` по умолчанию получат wire-топик `belladonna.reader/action/RenderMarkdown` — но это **никогда не должно уходить в сеть**, это локальный Tauri invoke.

Сейчас контракт жизнеспособен только потому, что мы знаем: *никогда не применяй `graph-zenoh` к этой schema*. Но это не выражено в самом SDL — это соглашение у потребителя в голове.

**Предложение для alak (draft):** либо директива уровня schema — `schema X { transport: tauri }` или `@local` на schema — либо атрибут на action: `action X @tauri { ... }`. Цель: чтобы компилятор мог остановить случайное применение Zenoh-генератора к локальной schema с явной ошибкой, а не молча сгенерировать топики.

Альтернатива: сделать правило нормативным — "actions без scope и без @sync считать local-IPC по умолчанию; Tier-2 генератор требует явного @remote". Это жёстче, но проще для новых потребителей.

**🟡 `CloseWindow` как action — натяжка семантики.**
В SPEC action — "side-effectful operation над данными namespace" (§5, §16). `CloseWindow` не оперирует данными — это команда WebView, не доменная операция. Формально ложится (action без input и без output), семантически пахнет.

Это **возможно не проблема SDL**, а проблема того, что я не должен был описывать в SDL UI-команды. SDL для **данных**, ESC/Close — событие окна, обрабатываемое Rust-стороной напрямую через Tauri window events, без action.

**Для протокола: UI-команды не пишем в SDL.** Это соглашение потребителя, не SPEC. Переписать reader.aql без `CloseWindow` в следующем шаге.

**🟡 На уровне SDL одинаково выглядят "action пишет в SQLite" и "action шлёт IPC другому окну".**
`RecordView` пишет в БД. `OpenInExplorer` шлёт сигнал другому окну того же процесса. В SDL оба — fire-and-forget action без output. Это **корректно** (SDL не должен знать про бэкенд), но для читателя схемы невидимо, что из этого где живёт.

Не требует изменений в SPEC. Требует от потребителя **либо** именования, которое делает бэкенд очевидным (`record_view_to_history`, `signal_explorer_open`), **либо** комментариев в .aql. Второе нативнее — SPEC R001 разрешает комментарии, они игнорируются парсером, но читаются людьми и AI.

**🟢 CLI у @alaq/graph нет, пришлось написать 10-строчный runner.**
`package.yaml` без `bin`, `dist/` только с `.d.ts`. Компилятор доступен как TS-библиотека (`parseFile` из `src/index.ts`), но запустить его как `aqc reader.aql` нельзя.

Не blocker, но подвох для первых потребителей. **Предложение:** добавить `packages/graph/bin/aqc.ts` с минимальным CLI — принимает путь к .aql, выдаёт IR в stdout или diagnostics в stderr. 30 строк кода. Существенно упрощает интеграцию в build-пайплайны потребителей (build.rs на Rust-стороне, vite-плагин на TS-стороне).

### Следствия для Belladonna

1. Следующий шаг: убрать `CloseWindow` из `reader.aql`. UI-команды обрабатываются вне SDL.
2. Добавить комментарий в `reader.aql` в шапке: `# This schema is local-only (Tauri IPC). Do not apply Tier-2 generators.` — пока нет формального маркера.
3. Находки про транспорт (🟡 первая и 🟡 четвёртая) — обсудить с Arsenal v2, у них может быть аналогичное давление на schema level.

### Открытые вопросы

- **О1:** Нужна ли формальная директива `@local` / `@transport`, или это решается правилами "actions без scope = local по умолчанию"?
- **О2:** Как SDL должен относиться к "UI-командам окна" (Close/Minimize/Maximize)? Совсем вне SDL, или есть место для `@view_command`?
- **О3:** CLI `aqc` — добавлять в `@alaq/graph` или отдельным пакетом `@alaq/graph-cli`?

---

## 2026-04-20 — Belladonna, шаг 2: BundleManifest с Map, optional argument, чистка CloseWindow

**Контекст:** следствия шага 1 — убрать `CloseWindow` (UI-команда), добавить шапку "local-only", описать help-bundle манифест (`belladonna.json`) как record `BundleManifest` с `contexts: Map<String, String>` и action `OpenBundle` для запроса "открой bundle с контекстом X".

**Артефакт:** `A:/source/pharos/Belladonna/schema/reader.aql`. Добавлен `record BundleManifest { root: String!, contexts: Map<String, String>! }` и `action OpenBundle { input: { bundle_path: String!, context: String } output: Boolean! }`. Удалён action `CloseWindow`. Добавлена шапка-комментарий "Local-only schema: Tauri IPC transport".

**Результат компиляции:** 0 диагностик. IR валиден, Map развёрнут корректно.

### Находки

**🟢 `Map<String, String>!` на поле record.**
Разворачивается в IR как:
```json
{
  "name": "contexts",
  "type": "Map",
  "required": true,
  "list": false,
  "map": true,
  "mapKey":   { "type": "String", "required": false, "list": false },
  "mapValue": { "type": "String", "required": false, "list": false }
}
```
Полностью соответствует SPEC §4.8 + §10 (`Field.map`, `Field.mapKey`, `Field.mapValue` как `TypeRef`). `String` как ключ — валидный scalar, E022 не срабатывает.

**🟡 `mapKey.required` / `mapValue.required` = `false` по умолчанию, хотя в SDL восклицательного знака нет вообще.**
В SDL я написал `Map<String, String>!` — `!` только на внешней обёртке. Внутри (`K`, `V`) никаких квантификаторов не указывал. Парсер поставил `required: false` обоим. Вопрос: **это "не указано = optional по умолчанию"** или это **правильное моделирование "scalar ключ записи карты никогда не null"**?

SPEC §4.8 не уточняет синтаксис `!` на `K`/`V`. §10 (`TypeRef`) требует `required: boolean` — но что значит `false` для ключа карты? Ключ по определению существует (иначе нет записи). Для **значения** optional имеет смысл (`Map<ID, Player?>` = "может отсутствовать").

Предложение: зафиксировать в SPEC §4.8, что `Map<K, V>` требует явный `!` на K/V, если нужен required; без `!` = nullable. Либо — ключ всегда required (игнорирует `!`), значение уважает `!`. Сейчас поведение парсера неопределённо по SPEC.

**🟢 Optional field в action input без `!`.**
`context: String` в `OpenBundle.input` — парсер присвоил `required: false`, IR это отразил. Работает симметрично с полями record. Полезно для "необязательный аргумент".

**🟢 Два поля input на одной строке через запятую.**
`input: { bundle_path: String!, context: String }` — R003 работает. Не споткнулся.

**🟢 Шапка-комментарий над `schema`.**
Комментарии до `schema`-блока парсер съедает штатно (R001). Локальное соглашение "Tauri-only schema" выражено как `#`-комментарий — не нормативно, но видно человеку.

**🟡 Записи record и action не различают "local IPC DTO" и "wire DTO" в IR.**
IR `BundleManifest` выглядит одинаково для zenoh-генератора и для tauri-генератора. Пока `graph-zenoh` к этой schema не применяется — всё хорошо. Но если завтра применится по ошибке — создаст топики `belladonna.reader/BundleManifest` на проводе. Дублирует 🟡 из шага 1 (транспорт-agnostic SDL). Без изменений до решения O1.

### Следствия для Belladonna

1. Уточнить в SPEC §4.8 семантику `!` на `K`/`V` в `Map<K, V>` (см. О4). До уточнения — не полагаться на nullable-семантику ключей/значений, просто помнить что "required: false" в IR может быть как "не указано", так и "опционально".
2. В шаге 3 — можно пробовать более плотные конструкции: enum для hot-key команд, `@deprecated` на переименовании поля, или `extend record` с полями для Explorer-окна. Не расписывать здесь — решает дирижёр.

### Открытые вопросы

- **О4:** `Map<K, V>` — семантика `!` на K и V. Должен ли SPEC §4.8 требовать явный `!` на ключе/значении если нужно required? Сейчас `Map<String, String>` парсится с `required: false` обеим сторонам — это может быть WAI, может быть подвохом. Нужен явный пример/правило в §4.8 и тест в §13.
- **О5:** Нужна ли в SPEC нормативная рекомендация писать комментарий-шапку вида `# Local-only schema` для local-IPC контрактов — пока не появилась формальная директива `@local` (см. О1)? Либо это соглашение потребителя, либо SPEC пишет "рекомендуется комментарий", либо — ждём О1.

---

## 2026-04-20 — Arsenal v2, шаг A.0: минимальный arsenal.aql компилируется чисто

**Контекст:** первый контакт Arsenal v2 с `@alaq/graph`. Цель — read-контур сервера: `PackageMeta`, `VersionRef`, `Channel`, `Platform`, actions `Packages` и `Versions`. Tauri IPC, mutations и events отложены на следующие шаги (см. concept.v2.md §7).

**Артефакт:** `A:/source/rest.valkyrie/arsenal/schema/arsenal.aql` (72 строки) + `_compile.ts` runner + `arsenal.ir.json` (3.7 КБ).

**Результат компиляции:** после 1 правки (переименование `version` → `semver`) — 0 errors, 0 warnings. IR валиден.

### Находки

**🔴 `version` — глобальный reserved keyword, не contextual.**
Концепт v2 §4 объявлял `type VersionRef { version: String! ... }`. Лексер (`packages/graph/src/types.ts:37–56`) токенизирует `version` как ключевое слово наряду с `namespace`, `scope`, `input`, `output`, `qos`, `max_size`. Следствие: эти имена **нельзя использовать как field name нигде**, даже в пользовательском record. Обход сделан (поле переименовано в `semver`), но это неочевидный подвох для доменной модели — у Арсенала `version` — центральное понятие.

**Предложение:** либо contextual keywords в парсере (keyword-only в определённых позициях), либо явно документировать список запретных field-names в SPEC — сейчас эта информация только в исходнике лексера, в SPEC §2 EBNF / §4 её нет. Второе дешевле и закрывает 80% боли.

**🔴 Нет разделения query/mutation — унифицированный `action`.**
Концепт v2 §4 писался в GraphQL-подобной нотации (`query packages`, `mutation upload`). SPEC v0.3 знает только `action` с опциональным `output` (§5, §8.8–8.10). Read/write семантически унифицированы.

Это **правильно по PHILOSOPHY принцип 1** ("SDL — не GraphQL"), но для `graph-axum` (HTTP REST target) генератор вынужден различать GET/POST через конвенцию-by-name или дополнительный сигнал. SPEC сейчас этого сигнала не даёт. Для читаемости `.aql` человеком/AI также нет семантического якоря "чтение vs запись".

Arsenal v2 принимает унификацию и переписывает концепт в action-нотации. Фиксация: есть **разрыв между языком обсуждения (GraphQL) и языком SPEC (action)** — стоит упомянуть в PHILOSOPHY §1 или SPEC §5 что action — замена GQL query+mutation.

**🔴 `@scope` привязан к RECORD, не multi-axis. H5 подтверждена как реальный риск.**
Концепт v2 §2 гипотеза H5: Arsenal давит на scope по **трём осям** (channel × admin × local). SPEC v0.3 §7.5: `@scope on RECORD` только; actions биндятся к scope через `scope: "room"` в ActionBody, но это требует scoped-record с тем же именем. Следствие:

- "Клиент видит slice своего канала" → не выражается прямым @scope на action. Вместо этого `channel` передаётся как input arg, фильтрация — в runtime handler.
- "admin-only mutation" → не выражается в SDL вообще. Решается middleware вне SDL.

**Scope-модель v6 проектировалась для одномерного room (PHILOSOPHY §5). Для продакшн-сервиса с несколькими осями авторизации/видимости — недостаточно.**

**Предложение:** либо расширить `@scope` до множественного (`@scope(channels, admin)` — вектор), либо явно сказать в SPEC "авторизация вне scope; scope только для reactive slicing". Второе честнее философски, но требует эксплицитного слова.

**🔴 Events не first-class — `download_progress` не выразим типизированно.**
Концепт v2 §4 декларирует `event download_progress { handle, bytes, total }`. SPEC v0.3 §2 EBNF не имеет `event` определения. Ближайшие варианты:
- `opaque stream` (§4.7, §8.12) — payload не описывается, только `qos`/`max_size`
- fire-forget action без output (§8.9) — one-shot push, не broadcast

**Tauri-события (`listen('download:progress')`) требуют типизированной полезной нагрузки.** Без first-class events в SPEC генератор `graph-tauri-rs` либо теряет типизацию (String + serde_json::Value), либо идёт конвенцией (action с префиксом `On*`?).

**Блокирует полноту волны `graph-tauri-rs` / `graph-tauri`.** Частично обходимо комментариями, но gap реальный. Пересекается с Belladonna 🟡 "транспорт-agnostic": оба случая упираются в то, что SPEC v0.3 не описывает транспортные/event/auth-контракты.

**🟡 Action ↔ HTTP-route mapping не формализован.**
SPEC §11 wire mapping описан для Zenoh-target (`ns/action/Name`, request-reply). Для `graph-axum` (HTTP REST) нужен метод/path. Варианты:
- (a) конвенция-by-name: `action Packages` → `GET /packages`, `action UploadVersion` → `POST /upload-version` (эвристика "есть глагол → POST" хрупкая)
- (b) директива `@http(method, path)` — SPEC §7 closed set
- (c) side-car `.http.yaml` — дублирует, не трогает SPEC

Для первой итерации `graph-axum` — вариант (a) с явно описанной конвенцией в README генератора. Находка не блокирует, но уточняет: **SPEC v0.3 target-agnostic в декларации, но HTTP-сервер требует target-specific метаданных, которых SDL не даёт**. Нормально, если признать что каждый target-generator имеет свои конвенции — но это стоит сказать в PHILOSOPHY.

### Следствия для Arsenal v2

1. Шаг A.1 — расширить `.aql`: + `Latest` action, + admin mutations (Upload, Delete) как actions без @scope (auth через middleware). Tauri-IPC часть — отдельно после разведки C.1/C.2.
2. Концепт v2 §4 переписать в action-нотации (гигиена, не меняет рельсы).
3. Принять конвенцию path-by-name для `graph-axum`. Зафиксировать в README генератора при написании.

### Открытые вопросы

- **О6:** Contextual keywords для `version`/`scope`/... или явный запрет в SPEC? (SPEC нужна глава "reserved names" — пересекается с Belladonna-О2 по духу)
- **О7:** Auth-scope через `@scope` или вне SDL? Philosophical, но блокирует дизайн `graph-axum` extractors.
- **О8:** `event Name { ... }` как первоклассное определение в SPEC? Блокирует полноту `graph-tauri-rs`/`graph-tauri`.
- **О9:** Target-specific директивы (`@http`, `@tauri`, `@zenoh`) — closed set на SPEC-уровне или open для генераторов? Пересекается с Belladonna-О1.

### Перекрёстные сигналы с Belladonna

Belladonna-🟡 "local-only transport" (шаг 1, шаг 2) + Arsenal-О7 "auth scope" + Arsenal-О8 "events" — **всё это одна проблема**: SPEC v0.3 не описывает транспортные/security/event-контракты, они выпадают в зону генератора. Для alak GA стоит решить: остаётся ли transport/auth/event-семантика вне SDL (в README генераторов), или появляются schema-level директивы. **Два независимых потребителя упёрлись в одно и то же — сигнал.**

---

## 2026-04-20 — Arsenal v2, шаг C.0: архитектурная разведка `graph-axum`, найден blocker в IR

**Контекст:** разведка будущего TS-генератора `@alaq/graph-axum` перед написанием. Изучались `graph-zenoh` (Rust-target) и `graph-link-server` (server-shape) как образцы + `arsenal.ir.json` как реальный вход.

**Артефакт:** архитектурный скелет генератора (в сессии дирижёра), не файл. 8 TS-модулей, 5 Rust-output файлов per namespace, парный runtime crate `alaq-graph-axum-rt` с 5 модулями.

### Находки

**🔴 IR теряет `list`-признак на `action.output` — blocker для v0.1 `graph-axum`.**
`packages/graph/src/ir.ts:238–242` содержит явный TODO: для action output строится `TypeRef`, но `list` и `itemRequired` не проставляются — только `name` и `required`. Для Arsenal обе actions (`Packages`, `Versions`) имеют сигнатуру `[PackageMeta!]!` / `[VersionRef!]!` — из IR **нельзя восстановить**, что output — это `Vec`, а не одиночный struct.

Следствие: `graph-axum` не может корректно эмитить `Vec<PackageMeta>` для output — только `PackageMeta`. Это **blocker для любого генератора, которому важен shape output**. zenoh не страдает (он использует topic-convention, не типизирует output напрямую); graph-link-server, по-видимому, тоже обходит (выводит из AST). Для axum — обойти без доступа к AST нельзя: IR — единственный надёжный вход.

**Предложение для alak:** расширить `TypeRef` для `action.output` — добавить `list: boolean` и `itemRequired: boolean` (как для record fields). Минорный bump IR-shape, должен проходить аддитивно. Правка в `ir.ts` — ~10 строк; тест — `PackagesOutput → {list:true, itemRequired:true, name:"PackageMeta", required:true}`.

**Blocker для Arsenal вектора B/E (написание `graph-axum`).** До исправления IR — либо генератор читает AST (нарушает образец zenoh/link-server — они на IR), либо ждём фикс.

**🟡 `@scope` на action — не директива, а поле ActionBody.**
В процессе разведки выяснилось: SPEC v0.3 поддерживает `action X { scope: "name", input, output }` — это **поле** ActionBody, а не `@scope(...)` директива. Т.е. SDL-синтаксис `@scope(name: "admin") action` — **невалиден**; правильно `action Admin { scope: "admin" ... }`.

Это исправление к концепту v2 §4 (который писался до разведки). Не находка для SPEC, а **уточнение потребительского непонимания**. Фиксация для следующих читающих: `@scope` — директива **только на record**; для action — поле body.

Частично дезактивирует Arsenal-О7 (auth через `@scope`): вопрос остаётся, но синтаксическая форма была изначально неправильной.

**🟢 Двухуровневая разбивка output — axum требует разрезки на `types/routes/handlers/state/mod`.**
zenoh пишет один `.rs` per namespace — подходит для publisher-only Rust-клиента (~100–300 строк). link-server — один `.ts` per namespace. Для HTTP-сервера Axum один файл будет слишком большим (handlers + routes + state + types на 5 actions = ~500 строк). Разрезка на 5 `.rs` в поддиректории `<ns>/` — отклонение от обоих образцов, но оправдано размером.

Не проблема SPEC, особенность target. Фиксируем как design decision для `graph-axum`.

**🟡 HTTP convention: все actions → POST.**
Первая итерация `graph-axum` v0.1 эмитит все actions как `POST /<snake_name>`. Причина: input — JSON body, GET с body — UB по HTTP spec, query-params distribution плохо сочетается с вложенными типами (enum в input). Следствие: **нет кэш-friendly GET для read-only actions**, нет REST-семантики.

Это приемлемо для v0.1 (RPC-style API), но подтверждает **F-05 из A.0** (action↔HTTP mapping не формализован). Когда появится конкретный запрос на GET/кастомный path — добавляется директива `@http(method, path)` (см. О9).

### Следствия для Arsenal v2

1. **Шаг P.0 (parallel):** исправить IR в `@alaq/graph` — добавить `list`/`itemRequired` в `action.output` TypeRef. Blocker для E.0 (написание `graph-axum`).
2. Шаг A.1 (расширение `.aql`) может идти независимо от IR-фикса — он не зависит от output-shape.
3. Шаг E.0 (написание `graph-axum`) должен дожидаться P.0.
4. После написания `graph-axum` — 8 открытых вопросов OQ-1..OQ-9, решаются эмпирически на первом compile-run (не концептуально).

### Открытые вопросы

- **О10:** IR расширение для `action.output` list/itemRequired — blocker. Есть ли side-effects на `graph-zenoh` / `graph-link-server` (они могут полагаться на текущее поведение)? Нужна ли аддитивная миграция.
- **О11:** Разрезка Rust-output на 5 файлов vs 1 — согласуется ли с конвенциями monorepo (`cargo` структура, `include!` vs `mod`)? Вопрос техники, не SPEC.

---

## 2026-04-20 — Arsenal v2, шаги C.1 + C.2: разведки `graph-tauri-rs` и `graph-tauri` — согласование invoke-контракта

**Контекст:** параллельная разведка двух генераторов Tauri-контура (Rust-side + TS-side). Вход — `reader.aql` (Belladonna) + `arsenal.aql` (Arsenal A.0).

### Согласованные решения (оба генератора симметрично)

**Invoke-name convention: `snake_case(ActionName)`.** SDL `DownloadVersion` → Rust `#[command] fn download_version`, TS `invoke('download_version', ...)`. Причины: (1) Rust-идиоматично без `#[command(rename)]`, (2) legacy Arsenal v1 уже snake, (3) `@alaq/plugin-tauri` принимает строку как есть. R063 SPEC (camelCase для call-site) применим только к `graph-link-*` (HTTP), не к Tauri. Зафиксировать в README обоих генераторов.

**Field-case: snake_case в SDL = snake_case в TS = snake_case в Rust.** Никаких `#[serde(rename_all = "camelCase")]` на Input-struct по умолчанию. Проще, честнее, меньше mental overhead при debug'е wire-traffic. Оба генератора держат flag для camelCase, но default — asIs.

**Invoke payload shape: `{ input: {...} }` (одна обёртка).** Rust-сигнатура: `async fn foo(input: FooInput)`. Следствие на TS: `invoke('foo', { input: { ...fields } })`, не flat. Причина — Tauri v2 требует совпадения имени Rust-параметра и ключа args-объекта. При flat-передаче пришлось бы эмитить Rust-функцию с N параметрами, что ломает R (Input struct per action для стабильности).

**Output: Rust возвращает голый тип, TS получает голый тип через serde.** Не newtype. Tauri v2 сам сериализует `Result::Ok(T)`. Отличие от `graph-zenoh`, где `<Action>Output(pub T)` — для HTTP не нужно.

**Handlers DI: trait-based (default).** `trait <Namespace>Handlers: Send + Sync + 'static` с async методами; user-code пишет `impl`, регистрирует через `.manage::<Arc<dyn Handlers>>()`. Параллельно runtime crate `alaq-graph-tauri-rt` даёт `register_commands!` макрос и `AppError` base. Функции (flat fn) — опция через флаг `handlers: 'functions'`, второй класс.

**Error: typed enum `AppError` per-namespace** (не String, не anyhow в generated). Варианты `Handler | BadInput | Unavailable | Internal`. Tauri v2 сериализует через serde → TS получает `{kind, message}` → graph-tauri может сделать typed branching.

### Находки

**🔴 Events требуют IR-расширения `leadingComments`.**
Единственный вариант выражения event'ов без breaking SPEC — маркер-комментарий `# @event: NAME` перед record. Но `@alaq/graph` парсер комментарии отбрасывает (R001 — comments ignored). Следствие: `graph-tauri-rs` / `graph-tauri` не могут увидеть маркер из IR. Два пути:

- (α) каждый генератор делает own re-parse `.aql` и ищет маркеры — нарушает R300 ("IR is sole interface for generators")
- (β) расширить `@alaq/graph` — сохранять leading-comments на definition в `IRRecord.leadingComments?: string[]` / `IRAction.leadingComments?: string[]`. Обратно-совместимо (опциональное поле), открывает canonical путь для нескольких use-cases (event-маркеры, JSDoc, Rust doc-comments, human notes).

**Предложение:** (β). ~15 строк в `ir.ts` + обновление SPEC §10. Blocker для event-семантики в обоих Tauri-генераторах.

**🟡 Streaming: Tauri Channel отличается от event.**
Для download_progress (10-60 ev/s один-к-одному консюмеру) правильнее Tauri `ipc::Channel<T>` вместо broadcast `app.emit()`. Это другая абстракция:
- broadcast event — 1:N, `# @event:` маркер
- channel stream — 1:1 per-invocation, `# @stream:` маркер на action (не на record)

Генератор `graph-tauri-rs` меняет signature action'а с `# @stream: ChunkType`: добавляет параметр `on_chunk: tauri::ipc::Channel<ChunkType>`. Если в будущем stress-тест покажет streams как частую штуку, `@stream` поднимается до first-class директивы.

Пересекается с 🔴 events выше — оба маркера живут в `leadingComments`. Один фикс IR закрывает оба.

**🟢 Cancellation pattern: отдельный action + shared handle scalar.**
`download(input): DownloadHandle` + `cancel_download(handle: DownloadHandle!): Boolean!`. Связь — конвенция имён + типа handle. Runtime-механика (DashMap с CancellationToken) — в user-impl. SDL ничего дополнительного не знает. Работает без расширения SPEC.

**🟡 Local-only маркер для schema (пересекается с Belladonna-О1).**
Подтверждается третьим независимым случаем: `graph-tauri-rs` принимает schema, `graph-zenoh` к той же schema генерил бы wire-топики, которых не должно быть. Решение остаётся открытым — директива schema-level `@local` / `@transport(tauri)` vs соглашение "разные `.aql` файлы per transport" (решение C.2: build-config рулит, `arsenal.http.aql` + `arsenal.tauri.aql` раздельно).

### Следствия для Arsenal v2

1. Шаг P.1 (новый): расширить IR в `@alaq/graph` — сохранять leading-comments. Blocker для volny events в `graph-tauri-rs`/`graph-tauri`. Можно параллелить с P.0.
2. Arsenal разделяет SDL на два файла: `arsenal.http.aql` (server endpoints) + `arsenal.tauri.aql` (client IPC). Build-config зовёт правильный генератор. Первая итерация — только `.http.aql` существует (уже).
3. Первый код `graph-tauri-rs` начинается без events — types + trait + commands + register. События — после P.1.
4. `graph-tauri` v0.1 — plain typed invoke через `@alaq/plugin-tauri/ipc` re-export (graceful + logi-integrated бесплатно).

### Открытые вопросы

- **О12:** Маркер `# @event:` / `# @stream:` как правильный синтаксис внутри comment'а? Варианты: `# @event: name`, `# @event(name)`, `#[event]`. Нужна единая конвенция до того, как leadingComments приземлится в IR.
- **О13:** Output файловая раскладка: `graph-axum` разрезает на 5 .rs, `graph-tauri-rs` тоже; `graph-tauri` (TS) — один файл. Причина (HTTP server >> IPC client по объёму кода) валидна, но в стандарте `@alaq/graph-*` генераторов — рассогласование формы. Нужно ли документировать "output shape — решение генератора, не конвенция"?

---

## 2026-04-20 — Arsenal v2/Belladonna, шаг P.1: IR extension для leadingComments

**Контекст:** разведки C.1 + C.2 (Arsenal v2) показали, что event- и stream-маркеры в `graph-tauri-rs`/`graph-tauri` не могут быть выражены без нарушения либо SPEC (новая директива), либо R300 (re-parse `.aql` в генераторе). Выбран путь β — расширить IR аддитивно, сохраняя `#`-комментарии непосредственно перед top-level декларацией.

**Артефакты (изменённые файлы):**
- `A:/source/alak/packages/graph/src/lexer.ts` — новый токен `COMMENT` (payload = текст без ведущего `#` и одного опционального пробела, trailing ws trimmed). Комментарии больше не выбрасываются на этапе лексинга.
- `A:/source/alak/packages/graph/src/parser.ts` — `peek`/`accept`/`expect` прозрачно пропускают `COMMENT`, не давая ему влиять на структурный парсинг. Новая функция `harvestLeadingComments()` собирает последовательный run `#`-строк и прикрепляет его к следующей top-level декларации, если между последней строкой и ключевым словом нет пустой строки. `parseFile` дёргает harvest перед каждым итом dispatch-а. `expect` ПЕРЕСТАЛ делать trailing `skipComments()` — иначе pos убегал за комментами, относящимися к следующей декларации.
- `A:/source/alak/packages/graph/src/ir.ts` — `leadingComments?: string[]` прокинут из AST в IR для `record`, `action`, `enum`, `scalar`, `opaque stream`. На `extend record` намеренно не пробрасывается (IRRecord уже владеет своими; потребителю — AST).
- `A:/source/alak/packages/graph/src/types.ts` + `types.d.ts` — добавлен `'COMMENT'` в `TokenKind`, добавлены опциональные `leadingComments?: string[]` на AST-ноды (`RecordNode`, `ExtendRecordNode`, `ActionNode`, `EnumNode`, `ScalarNode`, `OpaqueNode`) и соответствующие IR-интерфейсы (`IRRecord`, `IRAction`, `IREnum`, `IRScalar`, `IROpaque`). Все — аддитивно, existing shape не меняется.
- `A:/source/alak/packages/graph/SPEC.md` §10 — в JSON-схему добавлен `leadingComments` как optional на `Record`, `Action`, `Enum`, `Scalar`, `Opaque`. Под R001 добавлена non-normative ремарка про v0.3.2. Changelog дополнен entry'ем v0.3.2.
- `A:/source/alak/packages/graph/test/lexer.test.ts` — бывший тест "comments are skipped" переписан под новое поведение ("COMMENT tokens with trimmed body"), добавлены два кейса на trimming (без ведущего пробела / с trailing ws).
- `A:/source/alak/packages/graph/test/parser.test.ts` — 8 новых тестов: single/two/detached-by-blank-line leading comments; action/enum/scalar cases; trailing-inline не прилипает к следующему record; отсутствие поля (`'leadingComments' in rec === false`) при отсутствии комментариев.

**Результаты:**
- 🟢 Все 132 существующих теста зелёные; 8 новых — тоже зелёные (total 140/140 через shim-runner, т.к. `bun test` в sandbox недоступен; shim корректно реализует describe/test/expect API bun:test).
- 🟢 `arsenal.aql` → `arsenal.ir.json` регенерирован через `_compile.ts`: 0 errors / 0 warnings. В IR автоматически попали 4 блока leadingComments на существующие записи (шапка `UploadTicket` и три других), т.к. в `arsenal.aql` уже стояли человеческие `#`-комментарии над декларациями. Это побочный эффект — не break.

**Ключевые решения:**
- Один проход лексера: `#` → `COMMENT` токен, newline обрабатывается whitespace-логикой на следующей итерации. Линейные/колоночные координаты сохраняются, что критично для harvest (решение attach/detach делается по `t.line === prevLine + 1`).
- Parser: `rawPeek` vs `peek` — две проекции на один и тот же массив токенов. Harvest работает на raw (видит COMMENT), structural code работает на skip-filtered. Это точечно, без переписывания всего parser-а.
- `extend record`: `leadingComments` на самом extend-блоке в IR не пробрасывается — IRRecord несёт свои (от базового record-а), а расширяющие комментарии могут конфликтовать. Если понадобится — открыть отдельной stress-записью.
- `leadingComments` **только на top-level декларациях**. Комментарии внутри field-bodies (`# trailing` после `String!`) силенциально отбрасываются — они на то и trailing, а не leading. Покрыто тестом.

### Следствия

1. **О12 остаётся открытым** (синтаксис маркера `# @event:` vs `# @event(name)` vs `#[event]`) — P.1 только доставил транспорт, конвенцию решают потребители-генераторы (`graph-tauri-rs` / `graph-tauri` на следующих шагах).
2. Blocker для events в Tauri-контуре снят. `graph-tauri-rs` шаг Q.x теперь может читать `ir.schemas[ns].records[name].leadingComments` и искать регекспом/парсером свой маркер.
3. Для Belladonna: шапка `reader.aql` с `# Local-only schema: Tauri IPC transport.` теперь доступна генераторам на top-level (comment above `schema` НЕ попадает — только definitions; если понадобится — отдельный шаг про `SchemaDeclNode.leadingComments`).

### Открытые вопросы

- **О14:** Нужна ли `leadingComments` на уровне `SchemaDeclNode` / `IRSchema` (шапка файла)? Сейчас — нет, но паттерн "local-only" у Belladonna и "scope note" у Arsenal подсказывают use-case. Отложено до первого реального запроса от генератора.
- **О15:** Inline-комментарии на fields (`field: String! # serialize hint`) — пока дропаются. Есть ли кейс, когда генератор хочет видеть **field-level** leading/trailing comments? Если да — это IR v0.3.3 (field.leadingComments / field.trailingComment). Не блокер сейчас.

---

## 2026-04-20 — Arsenal v2, шаг A.1: полный серверный read+admin контур, IR расширен

**Контекст:** расширение `arsenal.aql` с минимального A.0 до полного серверного контура: добавлены `Latest` (read), `Upload` (admin), `Delete` (admin) + новый record `UploadTicket`. Auth намеренно вне SDL (О7 / F-03), Tauri-IPC часть отложена до C.1.

**Артефакт:** `A:/source/rest.valkyrie/arsenal/schema/arsenal.aql` (вырос с 72 до ~130 строк, 3 records + 5 actions + 3 enums) + перекомпилированный `arsenal.ir.json`.

**Результат компиляции:** 0 errors, 0 warnings. IR валиден.

### Находки

**🟢 Blocker C.0 / О10 (IR теряет list-признак на `action.output`) — ЗАКРЫТ в `@alaq/graph`.**
IR, полученный из A.1 `arsenal.aql`, содержит на actions `Packages` и `Versions` новые поля:
```json
"output": "PackageMeta",
"outputRequired": true,
"outputList": true,
"outputListItemRequired": true
```
`packages/graph/src/ir.ts:243–244` действительно эмитит `outputList` / `outputListItemRequired`. Значит между снимком C.0 (2026-04-20) и A.1 (сегодня же) компилятор получил аддитивный фикс — shape IR расширился согласно предложению из C.0.

**Следствие:** `graph-axum` и `graph-tauri-rs` теперь могут корректно эмитить `Vec<PackageMeta>` / `Vec<VersionRef>` из IR без доступа к AST. Образец `graph-zenoh` (использует topic-convention, не тип output) продолжает работать — поля опциональные, отсутствие не ломает его. Обратно-совместимо.

**Что осталось:** обновить `SPEC.md §10` — добавить `outputList`, `outputListItemRequired` в JSON Schema `Action`. Сейчас SPEC их не описывает, хотя парсер эмитит (минорная рассинхронизация SPEC ↔ импл).

**🟢 Actions без `scope` / без `@scope` — валидный путь для admin-mutations (F-03 / О7).**
`Upload` и `Delete` не имеют `scope: "..."` поля и не несут директив. Парсер принимает их как обычные global actions. Wire-mapping по SPEC §11: `n/action/Upload` — request-reply. Для HTTP-генератора (`graph-axum`) — обычный `POST /upload`, `POST /delete` (см. F-05). **Admin-авторизация полностью вне SDL** — middleware в Axum навешивается на route по имени; это потребует **out-of-SDL config для graph-axum** (list of "admin actions"), либо соглашение по naming prefix (`Admin*`).

Фиксируем: **SDL описывает shape, auth — config generator'а**. Это согласуется с решением C.1/C.2 об out-of-SDL трансп/auth-слое.

**🟡 `UploadTicket` — record без @scope/@sync/@store, чисто DTO ответа.**
Record используется только как output типа action, не как replicated state. Парсер/IR не возражают, но по семантике SPEC §4.4 "records participate in wire, storage, and UI" — это DTO-запах: TypeScript-аналог был бы inline-type или POJO, не replicated entity. Для `graph-axum` разницы нет (struct генерится одинаково), но для `graph-link-state` (reactive) такой record создаст лишнюю subscription-машинерию, если его объявить scoped.

Фиксируем: в SPEC нет формального разделения "DTO record" vs "state record". Для HTTP-mutation-results это нормально — они живут один RPC-вызов. Если в alak появится `@dto` / `@transient` — пересмотреть. Пока — соглашение потребителя: records без @scope/@sync/@store — короткоживущие DTO.

**🟢 Keyword-коллизии (`version`) — успешно обойдены на input-уровне тоже.**
В `Upload.input` и `Delete.input` вместо `version` использовано `semver: String!` (как в record `VersionRef`). Keyword-блок из F-01 распространяется и на action-input arg names — это не новая находка, а подтверждение что обход стабильно работает end-to-end.

**🟡 Boolean output у `Delete` vs HTTP convention.**
Реальный v1-сервер отвечает на `DELETE /api/packages/.../{version}/{platform}` JSON'ом `{"ok": true}` с 200, или 404 если не найдено. В SDL `action Delete { output: Boolean! }` унифицирует: `true` = успех, `404` становится транспортной ошибкой вне SDL-return-канала. Это правильно философски (SDL описывает happy-path shape, ошибки — вне), но **генератор `graph-axum` должен знать, что HTTP `404 → ошибка транспорта → TS клиенту получить reject, а не `false`**. Это не находка SPEC, а конкретика для `graph-axum` error-mapping. Фиксация на будущее.

### Следствия для Arsenal v2

1. A.1 замкнул серверный read+admin контур в SDL. Следующий шаг — либо запустить `graph-axum` писаться (шаг E.0 теперь разблокирован по IR), либо добить Tauri-IPC часть в отдельном `arsenal.tauri.aql` (шаг после C.1/C.2).
2. Для `graph-axum` нужно заранее согласовать out-of-SDL конвенцию "admin actions" (список имён или префикс), т.к. SDL это не выражает.
3. SPEC §10 стоит минорно обновить — добавить `outputList` / `outputListItemRequired` в Action IR schema.

### Открытые вопросы

- **О14:** Как `graph-axum` узнает, какие actions — admin, а какие — client? Соглашение по имени (`Upload`/`Delete` → admin), out-of-SDL config (`arsenal.gen.yaml { admin: [Upload, Delete] }`), или соглашение по префиксу (`AdminUpload`, `AdminDelete`)? Пересекается с О9.
- **О15:** Semantic: records без @scope/@sync/@store (чисто DTO) — нужна ли явная маркировка (`@dto` / `@transient`) или соглашение "если нет scope/sync/store — короткоживущий DTO" достаточно? Важно для `graph-link-state` (не плодить подписок на одноразовые response-типы).

---

## 2026-04-20 — Belladonna, замер baseline: Tauri/WebView2 стартует 2.2s при KPI 200ms

**Контекст:** Belladonna декларирует фанатичную скорость (KPI <200 мс до читабельного текста для Reader — см. `pharos/Belladonna/docs/reader-mode.md`). До принятия архитектурных решений о том, чем эту скорость достигать, нужна была опорная цифра — где мы сейчас с текущим `md-viewer` (Tauri 2 + vanilla JS + pulldown-cmark). Замер не связан с SDL — это давление на стек Tauri как базу для low-latency-потребителей.

**Артефакт:** `A:/source/pharos/Belladonna/docs/speed-baseline.md` + PowerShell-скрипты `measure-*.ps1` в корне Belladonna. Бинарник `belladonna-md-viewer.exe` — 10.48 MB release-build.

**Система замера:** AMD Ryzen 9 9950X, 96 GB RAM, Windows 11 Pro Insider, WebView2 Evergreen.

### Находки

**🔴 Tauri/WebView2 не достигает KPI "200 мс до читабельного текста" — гэп ~10×.**

Измерено:
- HWND (окно создано, но контент ещё не отрисован): **37 мс** avg
- CPU-settled (всё дерево процессов перестало жечь CPU, рендер точно завершён): **2221 мс** welcome, **2341 мс** с .md-файлом
- Реальное "время до глифа" — в интервале [37, 2300] мс, скорее ближе к верхней границе (HWND создаётся до WebView2-init).
- RAM дерева (belladonna + 6 msedgewebview2-children): **312 MB**.

**Это архитектурный потолок**, а не баг нашего кода: pulldown-cmark рендер ~30-строчного .md — микросекунды, теряются в шуме. Vite-бандл 18 КБ — тоже не проблема. Доминирующий вклад 2+ секунд — инициализация WebView2-runtime на холодную.

**Для потребителей alak, которые стрессят Tauri как платформу** (Belladonna, Arsenal v2 client, Kladinets, app/Valkyrie) — это общая новость, не специфичная для SDL: **`plugin-tauri` работает как IPC-мост, но сам факт Tauri+WebView2 запрещает sub-200ms-старт на современных Windows-машинах**. KPI такого уровня требует либо pre-warm резидента, либо отказа от WebView2 на критическом пути.

### Перекрёстный сигнал

Находка не требует изменений в SPEC, `@alaq/graph`, `plugin-tauri` или любых генераторах — они тут ни при чём. **Но она меняет expectations всего кластера Tauri-потребителей:** если проект декларирует "мгновенный F1-старт" или "окно за <500 мс" — без архитектурных трюков (резидент, pre-warm, native-shell) этого на Tauri не будет.

Для **Arsenal v2 client** (download-progress UI, главное окно) — нельзя рассчитывать на "первое открытие быстрое". Первый запуск клиента — 2+ сек в любом случае.

Для **Belladonna Reader** — принимается решение: Reader не может быть отдельным приложением со своим cold-start. Либо Belladonna-резидент (первое F1 медленное, следующие — быстрые), либо отказ от WebView2 для первого окна.

### Следствия для Belladonna

1. **Принципиальный пересмотр стратегии скорости:** "Reader <200 мс" достигается только через **резидент с pre-warm WebView2** — первое F1 платит 1.5-2.5 сек, повторные F1 должны отдать готовое окно за <200 мс. Без резидентности KPI недостижим. Это было в `reader-mode.md` как вариант, теперь становится обязательным.
2. **Volume 1 acceptance criteria сдвигается:** "Reader <200 мс" — **только для повторных открытий** в рамках живой сессии Belladonna-процесса. Холодный первый старт — 1.5-2.5 сек, это физика Tauri/WebView2, не баг.
3. **План миграции (`architecture.md`) остаётся валидным** — шаги 1-6 не меняются. Меняется только формулировка целей: резидентность из «nice-to-have для частых F1» становится «без неё KPI не работает».
4. **Заметка для будущих волн:** если KPI когда-нибудь потребует <200 мс на холодный запуск (например, Reader как замена Notepad без резидента) — нужен нативный шелл для первого окна (GDI/Direct2D/Skia) с WebView2 как догружаемым upgrade. Это Variant B из speed-baseline.md, отложен.

### Открытые вопросы

- **О16:** Есть ли способ pre-warm WebView2 между Belladonna-окнами так, чтобы второй Reader открывался действительно за <200 мс? Нужно экспериментально проверить на живом резиденте — создать два окна подряд, замерить второе. Сейчас все замеры холодные.
- **О17:** Стоит ли alak-экосистеме включить в `plugin-tauri` или отдельный `plugin-tauri-prewarm` механизм "pre-create hidden window for warm start"? Паттерн достаточно общий для Tauri-приложений с KPI на open-speed.

### Перекрёстные сигналы с Arsenal v2

Arsenal v2 concept §2 H6 гипотеза — "T0 tier достаточен; T2 (zenoh) tree-shake'ится". Baseline-замер Belladonna показывает: **даже T0 (чистый Tauri без Zenoh) даёт 2+ сек cold-start на WebView2-init**. Это не отменяет H6 (tree-shaking работает на уровне JS-бандла, а не WebView2-runtime), но уточняет: **bundle-size и cold-start — разные метрики**, Tauri-baseline ограничивает обе независимо.

---

## 2026-04-20 — Belladonna, шаг 3: enum / extend / @deprecated / @added

**Контекст:** стрессить три независимых направления SPEC, полезных и для Belladonna, и для общего покрытия v0.3. (1) `enum LinkKind` из 5 значений + использование как тип поля + `@default(value: UNKNOWN)` (R041). (2) `extend record RenderedDoc` с двумя полями — типичный паттерн "базовый рендер + статистика". (3) "boring" директивы `@deprecated` и `@added` — проверить, что парсер и IR переваривают.

**Артефакт:** `A:/source/pharos/Belladonna/schema/reader-stress3.aql` (**отдельный** от продуктового `reader.aql`, экспериментальная площадка, `# НЕ использовать для реального code-gen` в шапке). Добавлено: `enum LinkKind { INTERNAL_ANCHOR, RELATIVE_MD, EXTERNAL_URL, MAILTO, UNKNOWN }`; `record ResolvedLink { href, kind: LinkKind! @default(value: UNKNOWN), target_path }`; `action ClassifyLink → ResolvedLink!`; `extend record RenderedDoc { word_count: Int! @added(in: "0.2"), reading_time_sec: Int! }`; `@deprecated(since: "0.2", reason: "...")` на `RenderedDoc.filename`.

**Результат компиляции:** 0 диагностик. IR валиден. Все пять конструкций раскладываются в IR штатно. Плюс прогнал 5 negative-кейсов — ловит E010/E011/E012/E002 корректно, одна дыра с required-args (см. ниже).

### Находки

**🟢 Enum как тип поля.**
`kind: LinkKind!` — парсер принимает enum-имя в позиции TypeExpr без специального синтаксиса. В IR поле имеет `type: "LinkKind", required: true, list: false` (неотличимо по форме от record-типа). Enum отдельно живёт в `enums.LinkKind.values: ["INTERNAL_ANCHOR", "RELATIVE_MD", "EXTERNAL_URL", "MAILTO", "UNKNOWN"]` как массив строк. Для generator-а — один lookup по имени типа, чтобы понять "это enum, а не record".

**🟢 Enum с 5 членами, comma-separated, без trailing comma.**
R003 работает — `{ A, B, C, D, E }` без trailing comma парсится чисто. Ни одной диагностики на enum-декларации.

**🟡 `@default(value: UNKNOWN)` на enum-поле — R041 работает, но IR неразличим.**
В IR: `directives: [{ name: "default", args: { value: "UNKNOWN" } }]`. Bare identifier `UNKNOWN` сериализуется **как обычная JSON-строка**, без тега типа (enum-literal vs string-literal). Для generator, который рендерит дефолт в TS/Rust-код, нужно резолвить через тип поля (`field.type → enums[...]`): если поле — enum, печатать `LinkKind.UNKNOWN`, иначе — строку в кавычках. SPEC §10 это явно не описывает — скрытая зависимость IR→enums-lookup.

Стоит в §10 либо тегировать enum-литералы (`{ kind: "enum_ref", value: "UNKNOWN" }`), либо нормативно зафиксировать правило "string vs enum резолвится по типу поля-получателя".

Проверил E012: `enum K { A, B }` + `@default(value: C)` → **E012** ("@default value \"C\" is not a member of enum K"). Защита от опечатки работает.

**🟢 `extend record RenderedDoc { ... }` — merge в один IR record.**
В IR `records.RenderedDoc.fields` — **пять** полей в одном массиве, в порядке деклараций: сначала три из `record` (`html`, `toc`, `filename`), затем два из `extend` (`word_count`, `reading_time_sec`). Отдельного "extendedBy" нет — просто flat concat. R030 и §13.6 соблюдены. Generator не увидит разницу между полями из базы и из extend — правильно для wire, но может мешать, если инструмент хочет группировать документацию по "базовый рендер vs enrichment". Не блокер.

Negative:
- `record R { x }` + `extend record R { x }` → **E010** ("duplicate field \"x\"") — §13.7 соблюдён.
- `extend record Missing { x }` без базовой декларации → **E011**.

**🟢 `@deprecated(since: "0.2", reason: "...")` попадает в `Field.directives`.**
IR: `{ name: "deprecated", args: { since: "0.2", reason: "..." } }`. Никакого специального IR-слота нет, это обычная директива. Ок — SPEC §10 не обязывает выделять "meta-directives" отдельно.

Negative: `@deprecated(since: "1", foo: "bar")` → **E002** ("no argument named foo"). Argument-signature enforcement работает для **неизвестных** аргументов.

**🟢 `@added(in: "0.2")` попадает в `Field.directives`.**
Те же свойства, что у `@deprecated`. Аргумент `in` — зарезервированное слово в JS/TS, но парсер принимает его как argument name (Identifier, не keyword). В args: `{ in: "0.2" }`. При потреблении в TS-коде помнить про `args.in` (синтаксически валидно, но IDE может подсвечивать).

**🟡 `@added` без аргумента `in` — парсер НЕ ругается.**
SPEC §7.12 декларирует `in: String!` как **required**. Написал `@added` (без `()` вообще) — 0 диагностик. Скорее всего то же для `@deprecated` без `since`. **Проблема:** SPEC обещает required argument, валидатор этого не enforces. E002 ловит "unknown arg", но "missing required arg" — не ловит. Нет единой schema-таблицы требуемых аргументов директив. Нужен либо общий механизм required-args по directive signature, либо ad-hoc whitelist в validator.

Пересекается по духу с Arsenal-C.1 🔴 (leadingComments выкидываются) — обе про **дыры между текстом SPEC и реальным поведением валидатора/парсера**.

**🟢 Output list-признак на action сохраняется в IR (подтверждение Arsenal-A.1).**
`action GetViewHistory → [ViewHistoryEntry!]!` в IR имеет `output: "ViewHistoryEntry", outputRequired: true, outputList: true, outputListItemRequired: true`. Фикс из Arsenal-A.1 (закрытие O10) работает и для Belladonna — `graph-tauri-rs` когда появится, сможет корректно эмитить `Vec<ViewHistoryEntry>` из IR без доступа к AST. Подтверждение кросс-потребителем.

### Следствия для Belladonna

1. `LinkKind` / `ResolvedLink` — **действительно полезны** для реального `reader.aql`. Renderer markdown-ссылок сейчас классифицирует через regex в TS; перетащить классификацию в контракт (action `classify_link` или поле в `TocEntry.resolved`) — упрощение. Отдельный шаг слияния в продуктовый `reader.aql`, не сейчас.
2. `@deprecated` пригодится, когда поле `filename` будет мигрировать на `resolved_path` — есть заготовка.
3. `extend record` работает чисто. Если появится "bundle stats" или второе окно ("Bundle Index") с дополнительными полями манифеста — можно описать `extend record BundleManifest { ... }` в отдельном .aql-файле без редактирования основного контракта.
4. Находки 🟡 (enum-literal в IR без тега, `@added`/`@deprecated` без required-args) — не блокеры Belladonna, но записаны в О18/О19 для SPEC-дискуссии.

### Открытые вопросы

- **О18:** Enum literal в `Directive.args` сериализуется как обычная JSON-строка — generator обязан резолвить по типу поля. Стоит ли SPEC §10 либо тегировать enum-литералы (`{ kind: "enum_ref", value: "UNKNOWN" }`), либо нормативно описать правило резолвинга "string vs enum by field type"? Сейчас — negotiated convention, не normative. Побочный эффект: тот же вопрос для `ListLit` и других non-scalar литералов в `Directive.args`.
- **О19:** Required-arguments у директив не enforces. SPEC §7.11 `@deprecated(since: String!, ...)` и §7.12 `@added(in: String!)` декларируют `!` на `since`/`in`, но валидатор не ругается при их отсутствии. Нужен ли общий механизм "directive signature with required args" в SPEC §12 (возможно, машинно-читаемая таблица directive-signatures), или это закрывается ad-hoc-правилами в validator? E002 работает на unknown arg, но missing required arg — дыра.
- **О20:** `extend record` в IR — flat concat полей в порядке деклараций. Достаточно ли этого для инструментов документации / миграции, или нужна мета-разметка `field.sourceDecl: "base" | "extend#0"` для tooling? Пока никто не запрашивал — parking lot.

---

## 2026-04-20 — Arsenal v2, шаг P.0: IR fix landed

**Контекст:** аддитивная правка IR для `action.output` — закрытие blocker'а из C.0 (IR терял list-shape на выходе action'а, `[PackageMeta!]!` сжимался до `"PackageMeta"` без флага list).

**Правки:**
- `packages/graph/src/ir.ts` (блок `def.kind === 'action'`) — вместо TODO-сентинела теперь выставляет `act.outputList = true` + `act.outputListItemRequired` из `flattenType(def.output)` когда output — list. Публичный контракт `output: string` / `outputRequired: boolean` не тронут — новые поля optional, аддитивные (R301).
- `packages/graph/src/types.ts` — на `IRAction` добавлены `outputList?: boolean` и `outputListItemRequired?: boolean` с JSDoc "v0.3.1 (additive)".
- `packages/graph/SPEC.md` §10 — в JSON-схеме Action два новых optional-поля с описанием.

**Тест:** `packages/graph/test/conformance.test.ts` — новый `describe('13.11: action output list shape (v0.3.1)')` с тремя кейсами по ТЗ:
- `action X { output: [Foo!]! }` → `outputList:true, outputRequired:true, outputListItemRequired:true`
- `action X { output: [Foo] }`   → `outputList:true, outputRequired:false, outputListItemRequired:false`
- `action X { output: Foo! }`    → `outputRequired:true, outputList` absent (`?? false`)

Все три зелёные. Таргетированный прогон `bun test --test-name-pattern 13.11` → 3 pass / 0 fail.

**Полный прогон `bun test packages/graph`:** 375 pass / 1 fail / 376 total. Единственный fail — `lexer > comments are skipped` — pre-existing, не вызван P.0 (v0.3.2 concurrent landing: лексер теперь эмитит COMMENT-токены по дизайну, тест как написан устарел; парсер/ir.ts уже научены потреблять COMMENT и прокидывать `leadingComments`). Воспроизводится до моих правок.

**Арсенал:** `rest.valkyrie/arsenal/schema/arsenal.ir.json` пересобран через `_compile.ts` — 0 errors / 0 warnings. `actions.Packages` и `actions.Versions` теперь несут `"outputList": true, "outputListItemRequired": true, "output": "PackageMeta"/"VersionRef"`. Скалярные outputs (`Latest`/`Upload`/`Delete`) — без `outputList` (отсутствие ≡ `false`).

**Разблокировано:** шаг E.0 — написание `@alaq/graph-axum` — генератор теперь читает list-shape из IR без захода в AST (R300 соблюдён).

🟢 Работает. Частично закрывает О10 по side-effects: изменение строго аддитивное — zenoh / link-server игнорируют новые optional-поля и работают как раньше.

---

## 2026-04-20 — Arsenal v2 / Belladonna, шаг E.2: `@alaq/graph-tauri` v0.1

**Контекст:** TS-target генератор Tauri-контура, симметричная пара к E.0/`graph-axum` и к будущему `graph-tauri-rs`. Вход — `reader.aql` (Belladonna) и `arsenal.aql` (Arsenal A.1), выход — plain typed `invoke`-обёртки без nucl/FX/стримов. Следует C.1+C.2 согласованию: invoke-имена snake_case, export-имена camelCase, payload `{ input }`, field-case snake как в SDL.

**Артефакт:** `A:/source/alak/packages/graph-tauri/` (новый пакет `@alaq/graph-tauri@6.0.0-alpha.0`):
- `package.yaml`, `tsconfig.build.json`
- `src/index.ts` — public API `generate(ir, opts)`; опции `namespace?`, `header?`, `pluginImport?` (default `@tauri-apps/api/core`)
- `src/emit.ts`, `src/utils.ts` (`snakeCase` + `mapActionOutputType` с учётом `outputList`/`outputListItemRequired`, `Record<K,V>` для Map)
- `src/enums-gen.ts`, `src/types-gen.ts` (`I<Record>` + `I<Action>Input` interfaces)
- `src/actions-gen.ts` (`export async function <camel>(input: I<Action>Input): Promise<Out>`)
- `src/api-gen.ts` (`createTauriApi()` root surface)
- `src/events-gen.ts`, `src/state-gen.ts` — **STUB**'ы: placeholder-экспорт + warning-диагностика, поясняют зависимость от P.1 (leadingComments)
- `test/reader.test.ts`, `test/snake-case.test.ts` + `test/snapshots/` (auto-populate на первом прогоне)
- Build-script: `A:/source/pharos/Belladonna/schema/_generate_tauri.ts` — пишет `ui/src/generated/belladonna.reader.tauri.generated.ts`, ui-директория уже существует.

**Факт по импорту invoke:** `@alaq/plugin-tauri/src/index.ts` экспортит `tauriPlugin`, `createRealIPC`, `hasTauri`, `createFakeIPC` — но НЕ `invoke` и НЕ subpath `/ipc`. Следствие: генератор импортит `invoke` напрямую из `@tauri-apps/api/core`. Опция `pluginImport` оставлена на случай, если в plugin-tauri появится `/ipc` re-export или потребителю нужен свой proxy для тестов.

### Находки

**🟢 Convention "snake invoke + camel export + `{input}` wrapper" ложится механически.**
Один regex-пайп для snake_case (`([a-z0-9])([A-Z])` + `([A-Z]+)([A-Z][a-z])`) покрывает все попадавшиеся кейсы: `RenderMarkdown` → `render_markdown`, `HTTPSConnect` → `https_connect`, `V2Action` → `v2_action`, `GetViewHistory` → `get_view_history`, `OpenInExplorer` → `open_in_explorer`, `Upload` → `upload`. Юнит-тест `test/snake-case.test.ts` фиксирует.

**🟢 Реюз утилит `graph-link-state`.**
`mapBaseType`, `mapTypeRef`, `mapFieldType`, `LineBuffer`, `renderDirectiveComment`, builtin-scalar set'ы — скопированы 1:1 из `graph-link-state` и оставлены симметричными по имени. Новая функция одна: `mapActionOutputType` (обрабатывает `outputList` + `outputListItemRequired` из P.0). Map<K,V> ложится в `Record<K,V>` согласно конвенции Kotelok.

**🟢 P.0 фикс (`outputList`/`outputListItemRequired`) разблокировал чистый список-выход.**
`action Packages → output: [PackageMeta!]!` эмитится как `Promise<IPackageMeta[]>` и `invoke<IPackageMeta[]>('packages', { input })` без захода в AST. То же для `[VersionRef!]!`, `[ViewHistoryEntry!]!`. Пре-P.0 генератору пришлось бы выдавать `IPackageMeta`, теряя `Vec`-семантику.

**🟢 Action Input interfaces эмитятся даже для пустого input.**
`action Latest { input: { ... } }` без output → генерит `export interface ILatestInput`. Для однообразия call-site — каждый action имеет `I<Action>Input`, даже если в v0.1 SDL пустой. Снимает граничный кейс для `createTauriApi()` — форма API-поверхности устойчива.

**🟡 Events/state — STUB, не silent.**
`emitEventsStub` / `emitStateStub` пишут в output файл placeholder-функции `__eventsNotSupported` / `__stateNotSupported` + пушат `warning` в диагностики. Это явный сигнал потребителю, что поверхность неполная, вместо "просто нет ивентов — сам разбирайся". Оба сняты после P.1 (IR leadingComments → `# @event: Name` / `# @stream: T` маркеры).

**🟡 Тестовый прогон не проведён в этой сессии.**
Песочница скрипта блокирует прямой запуск `bun test`. Генератор написан через детерминированный manual-trace против `reader.aql` (рассчитанное содержимое снапшота описано в ответе дирижёру). Снапшот-файл умышленно НЕ зафиксирован в репо — первый реальный прогон `bun test A:/source/alak/packages/graph-tauri` его создаст. Юнит-тест `snake-case.test.ts` независим от парсера — дешёвый smoke-вход.

**🟡 Плавающая точка: `pluginImport` default — `@tauri-apps/api/core`.**
Концептуально хочется `@alaq/plugin-tauri/ipc` re-export (graceful degradation + Logi-bridge бесплатно). Пока в plugin-tauri такого subpath нет. Когда он появится — достаточно поменять DEFAULTS.pluginImport в один коммит, сгенерированные файлы перезальются. На v0.1 потребители `graph-tauri` тянут `@tauri-apps/api` как peer-dep (уже декларировано в package.yaml).

**🟡 Scoped actions в Tauri — no-op.**
Tauri IPC не имеет scope-семантики как `graph-link-state`. Генератор эмитит scoped actions так же, как unscoped — обычный plain `invoke`. Scope остаётся в комментарии `// SDL: action X (scope: "room")`. Для Tauri-таргета scope в SDL — nothing (в отличие от `graph-link-state`, где он определяет структуру `room.${id}` path). Это ожидаемо, но стоит упомянуть в README генератора, когда он будет.

### Следствия для Arsenal v2 + Belladonna

1. Belladonna: build-script `schema/_generate_tauri.ts` — первая реальная интеграция. После прогона `ui/src/generated/belladonna.reader.tauri.generated.ts` попадает в импорты Reader-View'а (заменяет ручные `invoke('render_markdown', ...)`).
2. Arsenal v2: для Tauri-контура понадобится отдельный `arsenal.tauri.aql` (C.2, решение "два файла per transport") — пока не существует; к E.2 пакет готов к применению, когда появится SDL-вход.
3. Следующая волна (P.1 → leadingComments) разблокирует events-gen и меняет stub на реальную эмиссию `listen<T>(name, cb)` обёрток.

### Открытые вопросы

- **О18:** Нужна ли subpath-экспорт `invoke` из `@alaq/plugin-tauri` (напр. `@alaq/plugin-tauri/ipc`) для graceful-degradation в dev-браузере (fake IPC) + Logi-tracing бесплатно? Если да — `pluginImport` default смещается, плюс plugin-tauri тянет минимальный `export { invoke } from '@tauri-apps/api/core'` с proxy-хуком. Пересекается с О5.
- **О19:** Scoped actions в Tauri-генераторе — оставить no-op (как сейчас), эмитить warning ("@scope ignored by graph-tauri"), или вовсе запретить scope в .tauri.aql через валидатор? Третий путь требует target-flag в SPEC/валидаторе.

### E.2-finalize (2026-04-20, подпись)

Хвост закрыт:

- **bun test подтверждён.** `cd A:/source/alak && bun test packages/graph-tauri` → `17 pass / 0 fail / 45 expect() calls` за 43 ms (bun 1.3.0). Снапшот `test/snapshots/reader.tauri.ts.snap` создан на первом прогоне (пункт «снапшот-файл умышленно НЕ зафиксирован в репо… первый реальный прогон его создаст» отработал как описано). Юниты `snake-case.test.ts` и все 8 assert-кейсов `reader.test.ts` (header+invoke import, record interfaces с `readonly`/`Record<K,V>`/`ITocEntry[]`, action input interfaces вкл. пустые, camelCase+snake_case invoke, `Promise<T[]>`, `Promise<void>` для no-output, boolean-output, `createTauriApi()`, events/state stubs) прошли зелёными.
- **Build-script прогнан.** `cd A:/source/pharos/Belladonna && bun schema/_generate_tauri.ts` → два ожидаемых warning'а (events stub + state stub, текст совпадает с контрактом v0.1) и запись `A:/source/pharos/Belladonna/ui/src/generated/belladonna.reader.tauri.generated.ts` (4318 bytes, 140 строк). Директория `ui/src/generated/` создана скриптом (ранее отсутствовала, `ui/src/` уже был). Файл сгенерирован под namespace `belladonna.reader`.
- **Belladonna wired.** Header `AUTOGENERATED by @alaq/graph-tauri v0.1.0-draft`, импорт `import { invoke } from '@tauri-apps/api/core'` (peer-dep), все четыре record-интерфейса (`IBundleManifest`, `IRenderedDoc`, `ITocEntry`, `IViewHistoryEntry`) с корректным `readonly`, `Record<string, string>` для `contexts`, directive-комменты `@range`/`@default` из SDL вынесены в JSDoc над полями.
- **tsc на сгенерированный файл — пропущен.** Ни глобального `tsc`, ни в `ui/node_modules/.bin/` не найдено (ui использует Vite + bun, TS-чекер не установлен). Пункт «если tsc доступен; иначе пропусти» отработан вторым путём. Имя пакета в шапке сгенерированного файла (`v0.1.0-draft`) не совпадает с `package.yaml` (`6.0.0-alpha.0`) — это константа `GENERATOR_VERSION` из `src/emit.ts`, расхождение отмечено, но не блокирует E.2.
- **NO nucl, NO FX, NO stream wrapping** — как было в v0.1, так и осталось. events-gen/state-gen — stub-только (placeholder-экспорт + warning), plugin-tauri/tauri-fx.ts не трогались, коммит не делался.

Следующий естественный шаг — P.1 (leadingComments в IR) разблокирует events-gen → `listen<T>(name, cb)` и снимает первый из двух stub'ов.

---

## 2026-04-20 — Arsenal v2, шаг E.0: @alaq/graph-axum v0.1 + server-v2 cargo check

**Контекст:** закрытие хвоста E.0 после rate-limit'а предыдущей сессии. Генератор + runtime-crate + build-script + server-v2 уже собраны; недоделано было — прогнать всё end-to-end: регенерить artifacts, прогнать bun-тест, довести `cargo check` до зелёного.

**Артефакты (verified intact):**
- `A:/source/alak/packages/graph-axum/` — TS генератор, 7 src-файлов + `test/arsenal.test.ts` + `README.md` + `package.yaml` (v6.0.0-alpha.0, GENERATOR_VERSION='0.1.0-draft') + `tsconfig.build.json`.
- `A:/source/alak/crates/alaq-graph-axum-rt/` — Rust runtime (Cargo.toml + lib.rs + context.rs + error.rs), Cargo.lock уже был.
- `A:/source/rest.valkyrie/arsenal/schema/_generate_axum.ts` — build-script.
- `A:/source/rest.valkyrie/arsenal/schema/generated/rs/rest_valkyrie_arsenal/{mod,types,handlers,routes,state}.rs` — 5 сгенерированных файлов.
- `A:/source/rest.valkyrie/arsenal/server-v2/{Cargo.toml, src/main.rs}` — stub-бинарь, уже включён в workspace (`arsenal/Cargo.toml: members = [..., "server-v2", ...]`).

**Прогон генератора.**
`cd A:/source/rest.valkyrie/arsenal/schema && bun run _generate_axum.ts` → 5 file(s), 0 errors, 0 warning(s). Все пять `.rs` в `generated/rs/rest_valkyrie_arsenal/` пересобраны: `mod.rs` 363B, `types.rs` 3587B, `handlers.rs` 1262B, `state.rs` 943B, `routes.rs` 3034B (bun-репорт до LF→CRLF; после записи на диск CRLF Windows-нормализует их до 4377/1524/1205/3302/365B соответственно).

**Bun-тест.**
`cd A:/source/alak && bun test packages/graph-axum` → **13 pass / 0 fail / 58 expect() calls / 42 ms** (bun 1.3.0). Снапшоты `test/snapshots/arsenal.types.rs.snap` и `test/snapshots/arsenal.routes.rs.snap` созданы на первом прогоне (snapshot-dir был пустым — ровно контракт «первый прогон создаёт»). Тест покрывает:
- счётчик файлов (ровно 5),
- paths под `rest_valkyrie_arsenal/`,
- diagnostics без errors,
- `mod.rs` — declare+re-export,
- `types.rs` — enums с `rename_all="snake_case"` (`WindowsMsi`/`Master`), `PackageMeta` record с `Vec<VersionRef>` и `Option<String>`, все 5 `*Input` структур + `Upload` с 4 полями, list-output как `#[serde(transparent)] pub struct PackagesOutput(pub Vec<PackageMeta>)`, scalar-output как `pub type LatestOutput = VersionRef`,
- `handlers.rs` — `#[async_trait] trait Handlers: Send + Sync + 'static` + 5 методов с корректными сигнатурами,
- `state.rs` — `AppState<H>` + `Arc<H>` + manual Clone,
- `routes.rs` — `router()` + 5 `.route("/<snake>", post(dispatch_<snake>::<H>))` + 5 дисп-функций.

**🔴 → 🟢 Cargo check фикс: `#[path]` в nested inline mod на Windows ломается.**
Первый прогон упал: `error: couldn't read 'server-v2\src\generated\..\..\schema\generated\rs\rest_valkyrie_arsenal\mod.rs': os error 3`. Компилятор, получив inline `mod generated { #[path = "../../schema/..."] pub mod rest_valkyrie_arsenal; }` в `src/main.rs`, резолвит путь не от `main.rs`, а через виртуальный префикс `src/generated/` (так работает nested-mod-path-resolution в Rust), и получается физически нерабочий `server-v2\src\generated\..\..\schema\...`. **Починка:** убрал inline-обёртку, сделал плоский `#[path = "../../schema/generated/rs/rest_valkyrie_arsenal/mod.rs"] mod rest_valkyrie_arsenal;` на уровне crate root — тогда `#[path]` резолвится от `main.rs`, а дочерние `pub mod types;` / `handlers` / `state` / `routes` в `mod.rs` самого генератора резолвятся относительно уже корректно найденного родителя. Отредактированы `server-v2/src/main.rs` (import-пути `generated::rest_valkyrie_arsenal::*` → `rest_valkyrie_arsenal::*` в двух местах).

**Cargo check после фикса.**
`cd A:/source/rest.valkyrie/arsenal/server-v2 && cargo check` → **`Finished dev profile [unoptimized + debuginfo] target(s) in 0.27s`**, 0 errors / 0 warnings. Свежий повторный прогон — `in 0.08s` (cache). Handlers остаются `unimplemented!()` в пяти местах (задачей не предусмотрено их реализовывать).

### Находки

**🟢 Генератор end-to-end рабочий.**
Одна команда `bun run _generate_axum.ts` производит 5 компилирующихся `.rs`-файлов, которые без ручной правки подключаются в crate через один `#[path]`-атрибут. Wire-contract (POST /{snake_action}, JSON body, `202 Accepted` для no-output — в арсенале таких нет, все 5 actions с output) совпадает с ожиданиями консьюмера (старый `server/` с ручным Axum-роутером рядом для сравнения, не трогался).

**🟢 Пересборка детерминистическая.**
Повторный прогон генератора даёт тот же порядок алфавитно-отсортированных actions/records/enums (`Object.keys(...).sort()` в `index.ts`+`types-gen.ts`+`handlers-gen.ts`+`routes-gen.ts`). Файлы одинаковые byte-for-byte между запусками — снапшот-тест `types.rs.snap`/`routes.rs.snap` поэтому устойчивый.

**🟢 Runtime crate тихо работает.**
`alaq-graph-axum-rt` (axum 0.8, serde 1, thiserror 1, async-trait 0.1, http 1, uuid 1 + tower 0.5) компилируется в составе `server-v2` без предупреждений. `ActionContext::from_request_parts` использует native async-fn-in-trait (axum 0.8), `HandlerError::IntoResponse` даёт стабильный `{ error, code }` JSON-body.

**🟡 Windows `#[path]` edge case стоит задокументировать в README `@alaq/graph-axum`.**
Найденная ловушка — nested `mod X { #[path] pub mod Y; }` на Windows режется на второй итерации (`..` не идёт выше виртуального `X/`). Плоский `#[path] mod Y;` работает. Советовать потребителям сгенерированной crate'ы подключать generated-tree **именно плоско**, без декоративной обёртки namespace'а, либо использовать `build.rs` с `include!(...)` если обёртка принципиальна. Сейчас в README `graph-axum` примера интеграции вообще нет — это отдельный хвост, в задачу не входит.

**🟡 `package.yaml` version vs `GENERATOR_VERSION` константа.**
`package.yaml` → `6.0.0-alpha.0`, а `src/emit.ts` → `GENERATOR_VERSION = '0.1.0-draft'`. Шапка генерируемых файлов содержит `0.1.0-draft`. Это же расхождение зафиксировано в E.2 (`graph-tauri`) — один и тот же паттерн у сестринских генераторов. Не блокер; разрешить централизованно, когда обоим пакетам настанет время выйти из -alpha/-draft.

**🟡 Bun-репорт байт-сайза vs фактический размер на диске.**
`writeFileSync` на Windows автоматически не CRLF-изует, но бан-репорт размера из TS-скрипта (`f.content.length`) даёт UTF-8-длину `\n`-строк, а fs в бан-скрипте пишет LF as-is, затем последующий `ls` показывает LF-размеры (3587/1262/943/3034/363). Сравнение со старыми размерами (4377/1524/1205/3302/365) — расхождение именно из-за того, что предыдущая версия файлов была записана с CRLF (другим инструментом — может, редактор агента или git checkout). Функционально идентичны. Следить незачем, отмечено ради прозрачности.

### Следствия для Arsenal v2

1. E.0 закрыт: `bun run _generate_axum.ts` + `cargo check` — два зелёных шага, воспроизводимо. Следующий логический шаг (E.1) — реализация `Handlers` с настоящей логикой (in-memory storage адаптер из `arsenal-common`), тест через `tower::ServiceExt::oneshot` на роутере.
2. Workspace `arsenal/Cargo.toml` уже содержит `server-v2` — `cargo check` на root workspace тоже должен пройти, но не прогонялся в этой сессии (узкий scope: именно `server-v2`). Отдельная задача.
3. Старый `arsenal/server/` не тронут — пункт «не трогать старый `arsenal/server/`» соблюдён, в workspace сосуществуют две версии.

### Открытые вопросы

- **О20:** Стоит ли в README `@alaq/graph-axum` приводить правильный паттерн интеграции в crate (`#[path] mod rest_valkyrie_arsenal;` flat vs wrapper) + `build.rs`-альтернативу? Сейчас README пакета описывает generator API, но не как подключать сгенерированный tree в Rust-crate. Без этого потребители будут наступать на ту же Windows-ловушку `#[path]` в nested module.
- **О21:** `GENERATOR_VERSION` константа дрейфует от `package.yaml` version у обоих сестринских генераторов (`graph-axum`, `graph-tauri`). Есть ли смысл генерировать `src/_version.ts` из `package.yaml` на build-step, или оставить ручное обновление до выхода из alpha/draft? Лёгкий tooling-вопрос.

---

## 2026-04-20 — Arsenal v2 / Belladonna, шаг E.1: `@alaq/graph-tauri-rs` v0.1 (finalize)

**Контекст:** завершение хвоста E.1 после rate-limit-разрыва предыдущей сессии. TS-генератор Rust/Tauri-кода (`@alaq/graph-tauri-rs`) и runtime-crate (`alaq-graph-tauri-rt`) уже были созданы; не хватало README, smoke-теста, build-script для первого реального потребителя (Belladonna) и compile-check'а сгенерированного вывода.

**Артефакты:**
- `A:/source/alak/packages/graph-tauri-rs/README.md` — конвенции (snake_case invoke, `<Action>Input` per action, trait DI, `AppError` с `kind`-tag, `register_<ns>_commands!` macro, emits six files per namespace).
- `A:/source/alak/packages/graph-tauri-rs/test/reader.test.ts` — smoke-тест: парсит `reader.aql` через `parseSource` из `@alaq/graph`, прогоняет `generate(ir)`, проверяет shape (шесть файлов, namespace-flat-путь, ключевые Rust-symbols в каждом файле).
- `A:/source/pharos/Belladonna/schema/_generate_tauri_rs.ts` — build-script, по аналогии с `_generate_axum.ts` в arsenal. Пишет в `A:/source/pharos/Belladonna/src-tauri/src/generated/belladonna_reader/`.
- `A:/source/alak/crates/alaq-graph-tauri-rt/tests/smoke_belladonna.rs` — compile-smoke на сгенерированный tree (pulled via `#[path]` includes) в тестовом модуле runtime-крейта. Использует уже подтянутые `tauri`/`serde`/`async-trait` из Cargo.toml runtime. `cargo check --tests` + `cargo test` — зелёные.

**Статусы прогонов:**
- `bun test A:/source/alak/packages/graph-tauri-rs` → **9 pass / 0 fail** (41 expects).
- `bun schema/_generate_tauri_rs.ts` в Belladonna → **6 файлов, 0 errors, 1 warning** (advisory: `@range` preserved as comment — это ожидаемый v0.1-режим, совпадает с дизайн-решением generator'а).
- `cargo check --tests` / `cargo test` в `alaq-graph-tauri-rt` с `tests/smoke_belladonna.rs` → **1 passed / 0 failed**, весь сгенерированный tree (`types.rs` + `handlers.rs` + `commands.rs` + `register.rs` + `events.rs`) type-check'ается с реальными Tauri 2.10 / serde / async-trait.
- `cargo check` на `A:/source/pharos/Belladonna/src-tauri/` — зелёный (5 pre-existing warnings про неиспользуемые items в `render/`, не от E.1).

### Находки

**🟢 Вывод type-check'ается «из коробки» на реальном Tauri v2.10 + async-trait.**
Сгенерированный `AppError` (`#[serde(tag = "kind", rename_all = "snake_case")]`) компилируется, `#[tauri::command]`-делегаторы ложатся чисто, `async-trait`-метод `async fn render_markdown(&self, &AppHandle, RenderMarkdownInput) -> Result<RenderedDoc, AppError>` не требует ручных правок. P.0-фикс `outputList`/`outputListItemRequired` корректно превращает SDL `[ViewHistoryEntry!]!` в Rust-`Vec<ViewHistoryEntry>` — подтверждено в `commands.rs` сгенерированного вывода.

**🟢 `#[path]`-include tree в отдельный тестовый крейт — рабочий способ держать compile-smoke без привязки к основному app-crate'у потребителя.**
`tests/smoke_belladonna.rs` в runtime-крейте тянет шесть .rs-файлов из Belladonna по абсолютно-relative пути (`../../../../../pharos/Belladonna/...`). Работает на Windows. Гарантирует, что если sdl→Rust сломается — ломается CI runtime-крейта, не «долетает» до потребителя через ручной прогон. Тот же паттерн пригодится для Arsenal tauri-клиента, когда он появится.

**🟡 `#[tauri::command]` создаёт hidden `__cmd__<fn_name>` на уровне crate root → одноимённые commands в разных модулях одного crate'а коллайдятся (E0428).**
Попытка сделать `cargo check` прямо в `A:/source/pharos/Belladonna/src-tauri/` с `mod generated;` упёрлась: там уже есть hand-written `commands::reader::render_markdown` (hand-rolled `#[tauri::command]`), а generator эмитит свой `commands::render_markdown`. `tauri::command`-macro при expansion делает `__cmd__render_markdown` на уровне crate, и два таких имени — E0428. Это ограничение самого Tauri, не нашего generator'а. Следствие для Belladonna: миграция с hand-rolled на generated requires параллельного снесения старых `#[tauri::command]` fn-ов в том же коммите. Обозначить в migration-guide Belladonna отдельным пунктом.

**🟡 `Map<K, V>` без `!` на внутренних типах даёт `Option<K>`/`Option<V>`.**
`reader.aql` объявляет `contexts: Map<String, String>!` — внешнее required, внутренние String — без `!`. Generator честно эмитит `std::collections::HashMap<Option<String>, Option<String>>`. Семантически это редко что нужно (ключ `None` в HashMap — странно). Но это корректно по SPEC §3/§4 — inner-required требует явный `!`. Следствие: в гайде для потребителей акцентировать `Map<String!, String!>!` для «всё required». Generator ведёт себя одинаково с `graph-axum` и `graph-zenoh` (тот же `mapTypeRef`), так что это не локальная дырка — это общая convention, которую стоит жирно прописать в SPEC §4.2 примером. Не блокер E.1.

**🟡 Ещё один `@range` preserved-as-comment на уровне generator-advisory.**
`emit.ts` correctly diagnose `warning: Directive @range is preserved as a comment only in v0.1` — потребитель (Belladonna) видит 1 warning за прогон. Это не шум, а сигнал «если ты хотел runtime-валидацию `@range(min:1,max:6)`, generator этого не делает в v0.1 — ты получаешь только `i64`». Когда появится `@range`-aware validator в runtime-крейте (`alaq-graph-tauri-rt::validate_range(input.level, 1, 6)?`), warning снимется. Зафиксировать как параксис-долг, не как проблему E.1.

**🟡 Smoke-test `reader.test.ts` покрывает shape, но не byte-for-byte snapshot.**
В отличие от `@alaq/graph-tauri/test/reader.test.ts` (tracked snapshot файл), здесь только assert-based проверки — шесть файлов, ключевые symbols, непустой content. Причина: Rust-вывод более объёмный (AppError + From impls + Display + Error) → snapshot был бы ~5Kb на namespace, и любая косметическая правка `emit.ts` требовала бы ручного re-approve снапшота. На v0.1 — accept the trade-off. Когда generator стабилизируется — добавить snapshot-файл, как у `graph-tauri`.

### Следствия для Arsenal v2 / Belladonna

1. **Belladonna unblocked на миграцию с hand-rolled `#[tauri::command]`.** Когда потребитель готов пересадить `commands::reader::render_markdown` на сгенерированный, достаточно: (a) убрать старые fn-ы в `commands/reader.rs`, (b) добавить `mod generated;` в `main.rs`, (c) написать `impl BelladonnaReaderHandlers for MyHandlers` (5 методов), (d) заменить `tauri::generate_handler![...]` на `register_belladonna_reader_commands!()`. Пре-ход в один коммит, без downtime.
2. **Arsenal v2 тauri-контур** (когда появится `arsenal.tauri.aql`, см. E.2) — использует тот же pattern. Смена `generate` endpoint'а (`@alaq/graph-tauri-rs` vs `@alaq/graph-axum`) = только разный build-script.
3. **events.rs остаётся stub** — разблокируется после P.1 (IR `leadingComments` + marker-syntax `# @event: Name` / `# @stream: T`). До тех пор потребители обходятся `tauri::Emitter` вручную.
4. **Compile-smoke в runtime-крейте** — воспроизводимый паттерн. Когда появится Arsenal-тauri-client, добавить симметричный `tests/smoke_arsenal.rs` в `alaq-graph-tauri-rt`.

### Открытые вопросы

- **О22:** Нужен ли `tauri::command`-collision detection на стороне валидатора / generator'а? Если SDL action имя коллайдит с hand-written `#[tauri::command]` в crate — detection возможен только на уровне Rust-linker'а (E0428). Generator этого не знает. Альтернатива: namespace-prefixing сгенерированных commands (`invoke('belladonna_reader__render_markdown', …)`) — но это ломает UX TS-side (`graph-tauri` тоже должен понимать prefix). Зафиксировать в конвенциях: «одноимённые commands в одном crate запрещены; миграция — atomic». Не требует SPEC-правки, требует README-note.
- **О23:** Map inner-required default. `Map<String, String>` эмитится в `Option<K>/Option<V>` — формально корректно, семантически редко нужно. Варианты: (a) оставить as-is, в SPEC §4.2 добавить жирный пример «всегда пиши `Map<K!, V!>!` если не нужны nullable inner», (b) нормативно defaulted `!` для inner в Map (breaking change IR), (c) генераторам пушить warning «Map with nullable inner — часто ошибка». Лёгкое tooling-решение — (c), через общий helper в `@alaq/graph`. Пересекается с О20/О21 (общий generator-convention layer).
- **О24:** Нужен ли `@deprecated` → `#[deprecated]` маппинг в v0.2 generator'а? Сейчас preserved-as-comment. Rust имеет native `#[deprecated(since = "...", note = "...")]` — прямой mapping бесплатный, но требует уточнения: SDL `@deprecated(since: "1.2.0", reason: "use new_field")` vs Rust `#[deprecated(since = "...", note = "...")]`. Нужно ли унифицировать arg-names или принять что different targets переводят аргументы по своему контракту? Относится ко всем generator'ам (axum/tauri-rs/tauri/link-state), не локально.

---

## 2026-04-20 — W6: generator version sync

Устранён version drift между `GENERATOR_VERSION` константой и `package.yaml` в `@alaq/graph-axum`, `@alaq/graph-tauri-rs`, `@alaq/graph-tauri` (О21).

Раньше: `GENERATOR_VERSION = '0.1.0-draft'` хардкодом в `src/emit.ts`, а `package.yaml.version = '6.0.0-alpha.0'` — шапка сгенерированных `.rs/.ts` врала.

Решение: новый `scripts/sync-generator-versions.ts` читает `package.yaml` каждого из трёх пакетов и пишет `src/_version.ts` с `GENERATOR_NAME` + `GENERATOR_VERSION`. `emit.ts` реэкспортит оттуда. `_version.ts` — build artifact (добавлен в `.gitignore` каждого пакета), регенерится на каждый `bun run build:types` (script-chain `sync + tsc`). Зависимостей не добавляет — `yaml` уже top-level dep в `alak/package.json`.

После пересборки артефактов Arsenal/Belladonna шапка корректная:
- `// AUTOGENERATED by @alaq/graph-axum v6.0.0-alpha.0`
- `// AUTOGENERATED by @alaq/graph-tauri-rs v6.0.0-alpha.0`
- `// AUTOGENERATED by @alaq/graph-tauri v6.0.0-alpha.0`

Снапшоты (`arsenal.types.rs.snap`, `arsenal.routes.rs.snap`, `reader.tauri.ts.snap`) обновлены — версия заменена через sed. Все тесты трёх пакетов зелёные (13 + 17 + 9 = 39 pass, 0 fail).

`GENERATOR_NAME` тоже синкается из `package.yaml.name` — по той же ссылке, никогда больше не разъедется.

---

## 2026-04-20 — alak improvement, шаг W1: `aqc` CLI landed

**Контекст:** закрытие О3 (Belladonna шаг 1). Оба первых потребителя (`pharos/Belladonna/schema/_compile.ts`, `rest.valkyrie/arsenal/schema/_compile.ts`) написали идентичные ~40-строчные runner'ы поверх `parseSource` — читают файл, фильтруют диагностики, пишут IR в JSON. Задача W1: добавить официальный CLI в `@alaq/graph`, чтобы потребители могли компилировать одной командой без своего кода.

**Артефакт:**
- `A:/source/alak/packages/graph/bin/aqc.ts` — единственный файл CLI (~170 строк с help'ом и I/O-shim'ами под Bun/Node).
- `A:/source/alak/packages/graph/package.yaml` — добавлено `bin: { aqc: ./bin/aqc.ts }` (та же конвенция, что и `@alaq/mcp` с `alaq-mcp` / `alaq-mcp-call`, и `alaq` с `alaq`).
- `A:/source/alak/packages/graph/README.md` — секция «CLI usage» после Quickstart.
- `A:/source/alak/packages/graph/test/cli.test.ts` — 11 тестов через `Bun.spawn` (valid .aql → exit 0 + IR на stdout; broken → exit 1 + diagnostic на stderr; `-o` пишет файл; `--pretty` indent; `--json` → JSON-массив диагностик на stderr; `--help` / `-h`; missing arg / unknown flag / missing file → exit 2).

**Контракт CLI:**

```
aqc <input.aql> [-o <out.ir.json>] [--pretty] [--json]
aqc --help | -h
```

- Exit 0 → IR produced (warnings пишутся в stderr, но не фейлят).
- Exit 1 → есть errors в диагностиках; IR не эмитится; diagnostics в stderr (human-readable по умолчанию, JSON при `--json`).
- Exit 2 → usage error (bad argv / missing file / I/O error).
- `--pretty` → `JSON.stringify(ir, null, 2)`; без него — compact one-line JSON (лучше для pipe'а в jq / build-хуки).
- `-o path` → IR в файл, stdout пустой (удобно в скриптах, не нужен `> file` redirect).

**Тесты:**
- `bun test packages/graph/test/cli.test.ts` → **11 pass / 0 fail** (37 expect'ов).
- `bun test packages/graph` → **436 pass / 0 fail** (1013 expect'ов). Pre-existing тесты не тронуты.

**Демонстрация замещения ручного runner'а.** `rest.valkyrie/arsenal/schema/_compile.ts` переписан как тонкая обёртка над `aqc`: запускает `bun run <path-to-aqc> arsenal.aql -o arsenal.ir.json --pretty --json`, парсит JSON-диагностики из stderr, печатает человекочитаемый summary (records/actions/enums counts). `arsenal.ir.json` — **byte-identical** до/после миграции (git diff нулевой). Для потребителей с `package.json` есть более короткий путь — `"compile:schema": "bunx aqc arsenal.aql -o arsenal.ir.json --pretty"` в scripts, без wrapper'а вообще. У arsenal/schema нет своего package.json, поэтому wrapper оставлен как reference-пример.

### Находки

**🟢 CLI как тонкая обёртка над `parseSource` — достаточно для 90% потребителей.**
Мульти-файловый `compileSources` / `compileFiles` сознательно не вынесен в `aqc`: оба первых потребителя (Belladonna, Arsenal) работают с одним .aql файлом. Для multi-file случая (Kotelok fixtures, 5 файлов) — либо glob-расширение в v0.2, либо потребитель остаётся на библиотечном API. Принцип: CLI должен закрывать простой случай, сложные — через JS/TS код.

**🟢 Machine-readable diagnostics через `--json` — критично для CI.**
Belladonna шаг 1 runner печатал diagnostics в человекочитаемом формате через `console.log` → невозможно отличить warning от error без regex'а. `--json` эмитит `Diagnostic[]` в stderr как JSON-массив (один массив на severity: сначала warnings если есть, затем errors если есть), одна строка — один JSON. CI может grep'нуть `[{"code":"E`, получить counts без парсинга текста.

**🟢 Стандартная bun/npm `bin` форма работает для TS-файлов с shebang `#!/usr/bin/env bun`.**
`@alaq/mcp` уже использует этот паттерн для `alaq-mcp` и `alaq-mcp-call`. После `bun link` / `npm install` исполняемый `aqc` появляется в `node_modules/.bin/`, `bunx aqc` работает из коробки. На Windows Bun делает shim автоматически — отдельных манипуляций не требуется.

**🟡 `Bun.spawn` в тестах обходит npm-shim'ы, вызывая файл напрямую.**
`cli.test.ts` использует `Bun.spawn(['bun', 'run', <абсолютный путь к bin/aqc.ts>, ...args])` вместо `Bun.spawn(['aqc', ...])`, потому что в fresh checkout без `bun install` шим `aqc` не существует. Trade-off: тесты не покрывают сам bin-механизм npm (правильно ли шим сгенерирован, exec bit на POSIX). Это ОК для v1 — сам CLI.ts tested, регистрация в `bin:` — простая декларация. Если в будущем появится CI step «prepublish smoke» — он закроет этот пробел.

**🟡 `process.exit(0)` в CLI делает его не suitable для программного использования.**
Wrapper в arsenal `_compile.ts` вызывает aqc через child_process именно из-за `process.exit`. Альтернатива — вынести core логику в `src/cli-core.ts` (функция `run(args) → {code, stdout, stderr}`), а bin-файл — тонкая обёртка `process.exit(await run(process.argv.slice(2)))`. Это разблокирует unit-тесты core'а без `Bun.spawn` (быстрее, детерминированнее) и библиотечный import (`import { run } from '@alaq/graph/cli'`). Не делаю в W1 (scope-creep), но фиксирую как следствие.

**🟡 CLI компилирует только один файл — multi-file consumers всё ещё пишут code.**
Belladonna (1 файл) и Arsenal (1 файл) — happy path. Kotelok (5 файлов) уйдёт через библиотечный `compileFiles`. Когда появится третий consumer с multi-file .aql (например, сплит `arsenal.aql` → `arsenal.server.aql` + `arsenal.tauri.aql` в будущем), можно добавить `aqc <f1.aql> <f2.aql> ...` → merged IR. Оставляю как задачу W2 если всплывёт давление.

### Следствия

1. **О3 закрыт.** CLI есть, потребители больше не пишут runner'ы.
2. **Belladonna может удалить свой `_compile.ts`** и либо добавить scripts-entry в его package.json (`bunx aqc schema/reader.aql -o schema/reader.ir.json --pretty`), либо запускать `aqc` руками в build-пайплайне. Сейчас Belladonna ещё не мигрирован — это на следующем шаге потребителя.
3. **Arsenal `_compile.ts`** оставлен как reference-пример wrapper'а (для потребителей без package.json), но сведён к ~40 строкам, из которых ~half — вывод summary. Ручной парсинг/диагностики удалены, всё делегировано `aqc`.
4. **W2 (не в этом шаге):** multi-file mode + вынос CLI core в importable `src/cli-core.ts`. Активируется когда появится давление от потребителей.

### Открытые вопросы

- **О25:** Нужен ли `aqc --watch` режим (watch .aql, перегенерировать IR)? Потребители сейчас либо руками (Belladonna: один .aql, редкий re-compile), либо через свои build-watcher'ы (Arsenal: `cargo watch`). Добавлять ли в сам `aqc`, или оставить потребителям? Моё предложение — не добавлять в v1, `bun --watch run aqc ...` работает из коробки на стороне потребителя.
- **О26:** Формат диагностик в `--json` mode. Сейчас эмитится **два отдельных** JSON-массива в stderr (сначала warnings если есть, потом errors если есть) — каждый на своей строке. Альтернатива — один массив со всеми диагностиками сразу. Первый вариант позволяет потребителю фильтровать быстрее (warnings != errors без anyloop), второй — проще парсить (одна строка). Сейчас работает первый, тесты проверяют именно его. Если появится consumer-давление — поменять на второй (breaking для парсеров stderr, но не для exit code).

---

## 2026-04-20 — alak improvement, шаг W7: READMEs for graph generators

**Контекст:** у трёх сестринских generator-пакетов `@alaq/graph-axum` / `@alaq/graph-tauri-rs` / `@alaq/graph-tauri` разное состояние документации — первый и второй имели README с Quickstart/Conventions, третий не имел README вовсе. В E.0/E.1/E.2 зафиксированы нормативные конвенции (snake_case invoke, `{ input }`-payload, `<Action>Input` per action, output list/scalar mapping) + два нетривиальных интеграционных паттерна (Windows `#[path]` edge case — О20; atomic migration из hand-written `#[tauri::command]` — E0428), которые не были задокументированы в README.

**Артефакты:**

- **`A:/source/alak/packages/graph-tauri/README.md`** — создан с нуля. Секции: Status / What it emits / Conventions (C.1+C.2) / What it does NOT do / Install / Quickstart / Consuming generated code (runtime dep, import site, `pluginImport` override с caveat про отсутствие `/ipc` в `@alaq/plugin-tauri`, pair with graph-tauri-rs) / GenerateOptions / Package layout / Open design questions (О18, О19, О21, О23) / Related packages / License / Contributing. По стилю совпадает с graph-zenoh/graph-link-state/graph-link-server.
- **`A:/source/alak/packages/graph-tauri-rs/README.md`** — дополнен. Добавлены секции: **Consuming generated code** (atomic migration / E0428 с 4-шаговой миграцией + compile-smoke pattern с `#[path]` в runtime crate) / Open design questions (О21/О22/О23/О24) / Related packages / License / Contributing. Сохранены существующие Conventions, Install, Quickstart, GenerateOptions, «Pair with graph-tauri».
- **`A:/source/alak/packages/graph-axum/README.md`** — дополнен. Добавлены секции: **Consuming generated code** с основным блоком **Windows `#[path]` edge case (О20)** — нормативно «плоский `#[path]` на crate root», broken/works примеры + пояснение виртуального `src/generated/` префикса; пункты про re-generation hygiene и pair с graph-tauri-rs / Open design questions (О20, О21) / Related packages / License / Contributing. Сохранены существующие «What it emits» / «Conventions» / «What it does NOT do» / Install / Quickstart / GenerateOptions.

**Проверено перед записью:**
- `@alaq/plugin-tauri/src/index.ts` — подтверждено, что экспорта `invoke` нет и subpath `/ipc` в `exports` не объявлен (внутренний `ipc/` dir существует, но не публичный). Конвенция «pluginImport по умолчанию `@tauri-apps/api/core`» зафиксирована как caveat в README graph-tauri.
- `packages/graph-tauri/test/snapshots/reader.tauri.ts.snap` — shape вывода (`invoke<T>('snake', { input })`, `Promise<T[]>` для list, `Promise<void>` для no-output, `createTauriApi()` root) — совпадает с тем, что документируется.
- Stress.md E.0 О20, E.1 E0428, E.2 О18/О19 — линкани в open-questions секциях как источники.

**Ограничения соблюдены:**
- Не коммитилось (ни git add, ни git commit).
- README плотные, без маркетинга — факты: conventions / Install / Quickstart / edge cases / options / open questions / license.
- Emoji не добавлены (образцы graph-link-server/graph-link-state/graph-zenoh их не используют).
- Дублирования между README нет: каждый описывает свой target, общие конвенции упомянуты и линканы на sister-пакеты.

### Следствия

1. **Потребители `graph-axum` на Windows** получают готовый рецепт интеграции — не наступят на nested-mod `#[path]` ловушку. Broken/works-пример + пояснение виртуального префикса.
2. **Потребители `graph-tauri-rs`, мигрирующие с hand-written `#[tauri::command]`** (ближайший реальный кейс — Belladonna) получают atomic-migration-shape (4 шага в одном коммите) с пояснением почему нельзя по одной команде.
3. **О-номера (О18/О19/О20/О21/О22/О23/О24)** теперь линканы из README на stress.md — tracking для будущих sessions не зависит от того, помнит ли агент про них.

### Открытые вопросы

- **О27:** стоит ли вынести общие секции (License / Contributing) в корневой `docs/PACKAGE_README_FOOTER.md` и линковать из каждого README, или оставить дублирование (текст идентичен между 5+ пакетами)? Лёгкое tooling-решение, не блокер. Если появится шестой-седьмой пакет — пересмотреть.

---

## 2026-04-20 — alak improvement, шаг W4+W12: contextual keywords + reserved names doc

**Контекст:** закрытие F-01 (Arsenal A.0) — `version` как field name в пользовательском record блокировался лексером, который классифицирует `version` как `KEYWORD`. Arsenal обошёл переименованием `version` → `semver`, но это подвох для всех будущих потребителей (JWT-поля, VersionRef-подобные, etc.).

**Решение (стратегия (a)):** лексер продолжает эмитить `KEYWORD` токены для `version`, `namespace`, `scope`, `input`, `output`, `qos`, `max_size` (не меняем) — в позициях field name / arg name / enum member / type-expression парсер теперь принимает `KEYWORD` как идентификатор. В позициях schema/action/opaque-stream-block-body эти же токены остаются структурными keyword'ами без амбигвности. Strict keywords (`schema`, `record`, `extend`, `action`, `enum`, `scalar`, `opaque`, `stream`, `use`, `true`, `false`) нигде не могут быть идентификаторами.

**Артефакты:**
- `A:/source/alak/packages/graph/src/parser.ts` — новый helper `expectIdentOrKeyword()`; применён в `parseField` (field name) и `parseEnumDecl` (enum members). `parseTypeExpr`, `parseDirective`, `parseArg` уже принимали `KEYWORD` в своих позициях — не трогал.
- `A:/source/alak/packages/graph/test/parser.test.ts` — 7 новых тестов в секции "W4 — contextual keywords": все 7 контекстных keyword'ов как field names; keywords в action input/output; keywords как enum members; keywords всё ещё работают в schema/action/opaque-stream block bodies; field name + directive.
- `A:/source/alak/packages/graph/SPEC.md` — bump 0.3 → 0.3.3, новая секция §2.1 "Reserved names and contextual keywords" с двумя таблицами (strict / contextual), R005 + R006, examples block с OK/ERROR кейсами. Changelog 0.3.3 дополнен пунктом про contextual keywords.
- `A:/source/rest.valkyrie/arsenal/schema/arsenal.aql` — rollback workaround F-01: `semver` → `version` в `record VersionRef`, `action Upload.input`, `action Delete.input`. Комментарий-note обновлён: ссылка на SPEC v0.3.3.

**Прогоны:**
- `bun test packages/graph` → **443 pass / 0 fail** (1035 expects). Pre-existing 436 тестов работают без изменений, +7 новых — все зелёные.
- `cd arsenal/schema && bun run _compile.ts` → **0 errors, 0 warnings**, `arsenal.ir.json` валидный. VersionRef.fields: `version, channel, platform, uploaded_at, size_bytes, sha256`. Upload.input / Delete.input: `package, version, channel, platform`.
- `cd arsenal/schema && bun run _generate_axum.ts` → **5 файлов, 0 errors, 0 warnings**. Generated `types.rs` содержит `pub version: String` в `VersionRef`, `UploadInput`, `DeleteInput`.
- `cd arsenal/server-v2 && cargo check` → **Finished in 0.22s**, 0 errors, 0 warnings.

### Находки

**🟢 Стратегия (a) минимально инвазивна.**
Изменено: 1 helper + 2 call site в parser.ts (parseField, parseEnumDecl). Лексер не тронут — что ожидаемо, потому что различие «keyword vs identifier» делается в парсере на основе позиции, а не в лексере. Существующее поведение `parseTypeExpr` / `parseDirective` / `parseArg` уже принимало `KEYWORD` → они уже были неявно contextual; W4 просто завершил паттерн для field/enum-member positions.

**🟢 Arsenal F-01 разблокирован без миграций старого сервера.**
`arsenal/server/` (v1, hand-rolled Axum) не тронут. `arsenal/server-v2/` (generated) пересобран из нового IR, cargo check зелёный. Клиенты v1 API продолжают работать (формат wire payload `UploadInput { package, semver, … }` в v1 другой — v1 и v2 используют разные endpoints сейчас, они сосуществуют). Когда v2 начнёт обслуживать прод — wire-поле изменится с `semver` на `version`; это отдельный шаг миграции API, не в scope этой задачи.

**🟢 SPEC §2.1 — первая нормативная секция про грамматические классы идентификаторов.**
До v0.3.3 в SPEC не было явного списка keyword'ов (они жили только в `KEYWORDS` set лексера). Теперь две таблицы: strict (10 токенов) + contextual (7 токенов). R005 формально разрешает contextual в identifier-position'ах; R006 оставляет type names (record/action/enum/scalar имена) strict. Это закрывает дырку в документации — и AI-агенты, и люди-разработчики теперь могут проверить список до написания .aql.

**🟡 `semver` → `version` в wire payload — breaking для v2 API, если клиенты уже есть.**
Переименование поля в JSON payload — wire-incompatible изменение. Сейчас у `server-v2` клиентов нет (stub с `unimplemented!()` handlers), так что breaking нулевой. Но если бы v2 уже был в prod — надо было бы либо оставить workaround `semver`, либо делать controlled migration (double-write, deprecation period). Это generic урок для будущих переименований, не специфичный к W4.

**🟡 `input: { version: … }` в action — единственный edge case где keyword в позиции field name встречается внутри другого keyword-context.**
Action block: `input` — keyword, `:` — COLON, `{` — начало field list. Внутри field list парсер вызывает `parseField` → `expectIdentOrKeyword()` → принимает `version` как identifier. Тест `W4 — action input/output with keyword field names` покрывает именно это. Никакой амбигвности нет, потому что после `{` грамматика однозначно ожидает field list, не вложенный input-keyword.

### Следствия

1. **F-01 закрыт.** Arsenal (и все будущие потребители) могут использовать `version` как field name без workaround'ов.
2. **W4 + W12 сделаны одним шагом.** W12 (SPEC doc) написан синхронно с W4 (parser change) — changelog, §2.1, R005/R006 отражают фактическое поведение парсера. Дрейфа документации не будет.
3. **Breaking changes нулевые.** Любой .aql, который парсился до v0.3.3, парсится в v0.3.3 так же. Change — строго superset (парсятся новые конструкции, которые раньше были parse error'ом).
4. **Coverage:** 7 новых тестов против `parser.ts` покрывают все 7 contextual keyword'ов в field/arg/enum/type положениях + 3 негативных (где keyword ДОЛЖЕН остаться keyword'ом).

### Открытые вопросы

- **О28:** Стоит ли добавить E023 "contextual keyword used as type name" (R006 violation) как явный код диагностики вместо generic E000 "unexpected token"? Сейчас `record scope { }` падает в E000 с сообщением про expected identifier. Кодифицировать — даёт AI-агенту более точный hint («переименуй record»), но добавляет ещё один валидаторный код. Не блокер. Если появится давление от потребителей — отдельной задачей.
- **О29:** Migration note для ранее-написанных схем, которые имели field-level workaround (`semver` вместо `version`, etc.) — стоит ли добавить линтер-правило «предупредить если field name — это spelling избегания keyword»? Слишком эвристично для v1; оставляю на усмотрение потребителей при code review.

---

## 2026-04-20 — alak improvement, шаг W10: scope semantics + SDL boundaries documented

**Контекст:** шаги A.0 (F-03, H5), C.0, C.1+C.2, A.1 суммарно показали, что потребители трактуют `@scope` по трём осям (`channel` × `admin` × `local`), тогда как SPEC §7.5 даёт `@scope` только на RECORD в одномерной room-style модели (PHILOSOPHY §5). SDL никак не описывает, как эти оси комбинировать, — порождает ложные ожидания («auth через @scope», «local-only через @scope»). Задача W10 — не расширять поведение, а **зафиксировать границы текстом**: явно сказать, что `@scope` делает и чего не делает, закрыть смежные стресс-вопросы одной нормативной главой про «SDL limitations».

**Принятое решение (text-only, без code/IR/grammar changes):**
1. `@scope` — **single-axis, reactive slicing / lifecycle only**. Существующее поведение, не меняется.
2. **Auth — НЕ через @scope.** Auth живёт на транспорте (HTTP middleware для `graph-axum`, Tauri capabilities для `graph-tauri-rs`, per-topic ACL для `graph-zenoh`). Actions без `scope` — правильная форма для admin mutations. `@auth` (§7.4) — это про **видимость полей**, а не про identity.
3. **Transport (local vs remote) — НЕ через @scope.** Выбор транспорта — это **выбор генератора**, а не директива на схеме. При расходящихся поверхностях — раздельные `.aql`-файлы (Arsenal-паттерн `arsenal.http.aql` + `arsenal.tauri.aql`). Возможная будущая `@transport` / `@local` — не для v0.3.
4. **Multi-axis data slicing** — primary axis как `@scope`, остальные оси — обычные `input`-args + server-side фильтрация. Scope остаётся одноосевым by design.

**Обновлённые файлы:**
- `A:/source/alak/PHILOSOPHY.md` §5 «Scopes, not singletons» — добавлен блок «Boundaries (normative)» с тремя пунктами (single-axis / auth-is-not-scope / transport-is-not-scope) + cross-reference на SPEC §7.5 и §17. Остальной текст §5 не тронут, переписывания нет.
- `A:/source/alak/packages/graph/SPEC.md` §7.5 `@scope` — три новых нормативных правила:
  - **R135** — `@scope` single-axis, `@scope(channel, admin)` невалиден и не появится; многоосевой slicing — через input-args.
  - **R136** — `@scope` не выражает авторизацию; SDL вообще не описывает auth, actions без `scope` — форма для admin-mutations.
  - **R137** — `@scope` не зависит от транспорта; выбор транспорта — выбор генератора.
- `A:/source/alak/packages/graph/SPEC.md` — новый §17 «Out of scope (SDL limitations)» — единая нормативная таблица из 10 пунктов, куда явно вынесены вещи, которые SDL сознательно не описывает: auth/authorization, transport selection, UI commands, byte streams / file uploads, event broadcasts, multi-axis scope, query-vs-mutation split, deployment/observability/logging, persistence backend, identity derivation. **R700** — добавление любого из этих пунктов в first-class SDL требует кросс-потребительского обоснования + spec version bump.
- `A:/source/alak/packages/graph/SPEC.md` §15 Changelog — W10 добавил запись `0.3.3 (2026-04-20) — text-only` (в соседнем шаге W4+W12 версия уже поднята до 0.3.3 в связи с contextual-keywords; W10 пришёл в тот же bump без отдельной минорной отметки, но со своим списком пунктов в changelog).

**Что закрыто документацией (без изменения поведения):**
- **О7 (Arsenal A.0):** «Auth-scope через `@scope` или вне SDL?» → **закрыт**: R136 + §17. Auth — на транспорте, всегда. Блокер «дизайн `graph-axum` extractors» снимается: админ-middleware в Axum — стандартный путь, SDL не участвует.
- **О2 (Belladonna шаг 1):** «UI-команды окна (Close/Minimize) — в SDL или нет?» → **закрыт**: §17 явно «UI commands — out of SDL». Подтверждает самообнаруженное решение Belladonna шаг 2 (убрать `CloseWindow`).
- **О1 (Belladonna шаг 1) — частично закрыт:** «Нужна ли директива `@local` / `@transport`?» → §17 описывает текущий канон (split-file по транспорту, например `arsenal.http.aql` + `arsenal.tauri.aql`) и явно оставляет `@transport` как возможность, но **не в v0.3**. Это переводит О1 из «требует решения» в «принято соглашение, пересмотр — при появлении конкретного стресс-кейса». Полностью закрывается, когда / если split-file проявит недостаточность.
- **О19 (E.2 graph-tauri):** «Scoped actions в Tauri — no-op, warning или запрет?» → **закрыт**: R137 — `@scope` имеет одинаковую семантику во всех таргетах, в Tauri scope едет через input как обычный аргумент. Текущее поведение generator'а (no-op + комментарий) — правильное; warning лишний, запрет — ломает кросс-таргет переносимость SDL.

**Что остаётся открытым (сознательно):**
- **О8 / О12** (events как first-class / маркер-синтаксис) — не в W10. Канон «leadingComments + marker» уже зафиксирован в §17 как текущее v0.3.2-решение; промоция в директиву — при стабилизации паттерна.
- **О9** (target-specific директивы closed vs open) — шире W10, нужен отдельный шаг. §17 даёт предпочтительный путь («generator-local convention до cross-consumer паттерна»), но не решает closed-set-вопрос формально.

**Ограничения соблюдены:** только текст; никаких code changes, никаких новых директив, никаких изменений IR / grammar / validation / wire; PHILOSOPHY переписана точечно (один блок в §5), SPEC расширен одной главой + тремя rules в существующей §7.5; коммит не делался.

---

## 2026-04-20 — alak improvement, шаг W2+W3: directive required-args validation + enum-literal tagging

**Контекст:** закрытие Belladonna-шаг-3/О18 и Belladonna-шаг-3/О19. Две независимые дыры в `@alaq/graph`, задетые одним шагом стресс-тестирования, проходятся одним коммитом — обе про IR/валидатор, обе локализованы в `packages/graph/src/{ir,validator,errors,types}.ts` + §10/§12 SPEC.

> **Disambiguation:** в журнале два разных О19 (Belladonna шаг 3 — про required-args, E.2 graph-tauri — про scoped actions в Tauri). Этот шаг закрывает только первый.

### W2: required-args у директив enforces через новую диагностику E023

**Дыра:** SPEC §7.11 декларирует `@deprecated(since: String!, ...)`, §7.12 — `@added(in: String!)` (см. также `@scope(name!)`, `@default(value)`, `@range(min, max)`, `@liveness(source!, timeout!)`, `@topic(pattern!)`). Валидатор ловил **unknown** arg через E002, но **missing required** arg — не ловил. В Belladonna-шаг-3/О19 воспроизведено: `@added` без `()` → 0 диагностик, `@deprecated` без `since` → 0 диагностик.

**Решение:** `DirectiveSignature` в `ir.ts` расширен optional-полем `required?: string[]`. Заполнено по §7:

| Директива | Required | Источник |
|-----------|----------|----------|
| `@scope`      | `name`            | §7.5 `name: String!` |
| `@default`    | `value`           | §7.8 (value implicit — директива бессмысленна без значения) |
| `@liveness`   | `source, timeout` | §7.9 `source: String!, timeout: Duration!` |
| `@range`      | `min, max`        | §7.10 оба bound обязательны (R181) |
| `@deprecated` | `since`           | §7.11 `since: String!, reason: String` |
| `@added`      | `in`              | §7.12 `in: String!` |
| `@topic`      | `pattern`         | §7.13 `pattern: String!` |

Директивы без required: `@sync` (все три аргумента с defaults), `@crdt` (key обязателен только для LWW_* — остаётся на E004 как context-sensitive), `@auth` (`read`/`write` defaults `"public"`), `@atomic`/`@this`/`@store` (нет аргументов).

Новая диагностика **E023** в `errors.ts` + `types.ts`:

```
E023: directive @X is missing required argument "Y"
```

В `validator.ts` добавлен блок перед валидацией argument-types — эмитит одну E023 на каждый пропущенный required (в `@liveness` без args будет две E023: `source` + `timeout`). Локация — на `@directive`, не на несуществующем arg'е.

**Конфликт кода:** в соседнем шаге W4+W12 одноимённое `E023` упоминалось как *proposed* для "contextual keyword used as type name" (W4+W12/О28). Здесь `E023` закреплён за "missing required directive argument" — это фактическая реализация, живёт в code. Если позже всё же закодифицируют контекстный-keyword-diagnostic — взять следующий свободный `E024`. W4+W12/О28 обновлён ссылкой на этот шаг.

### W3: enum-literal vs string-literal различимы в IR через `IRDirective.argTypes`

**Дыра:** `@default(value: UNKNOWN)` и `@default(value: "UNKNOWN")` в IR сериализовались одинаково — `args.value = "UNKNOWN"`, plain string. Generator, чтобы отличить enum-literal от string-literal, должен был резолвить через тип enclosing-поля (`field.type → enums[...]`). В Belladonna-шаг-3/О18 замечено как скрытая IR→enums-lookup-зависимость; текстом SPEC не описано.

**Решение (вариант (c) из задачи, additive).** В `types.ts` добавлен тип `IRLiteralKind = 'string' | 'int' | 'float' | 'bool' | 'enum_ref' | 'list'` и новое optional-поле `IRDirective.argTypes?: Record<string, IRLiteralKind>`. Заполняется в `ir.ts::directiveToIR` из `Value.kind` (parser уже различает enum-бареайдентификатор от string-literal в AST, ir.ts теперь не стирает). `enum` в AST → `enum_ref` в IR — переименовано для IR-ясности ("IR говорит про references, AST — про literals"). `argTypes` не эмитится вообще, если директива без аргументов — pre-0.3.3 on-disk shape zero-arg директив сохранён байт-в-байт (R301: additive).

SPEC §10 `Directive` schema расширена `argTypes` как optional с enum-значениями. Версия SPEC уже 0.3.3 (поднята в W4+W12, cooperating bump — отдельной минорной отметки не нужно).

### Правки

- `packages/graph/src/errors.ts` — `E023` в SEVERITY + MSG.
- `packages/graph/src/types.ts` — `IRLiteralKind` type export, `IRDirective.argTypes?`, `DiagnosticCode` += `'E023'`.
- `packages/graph/src/ir.ts` — `DirectiveSignature.required?`, `DIRECTIVE_SIGS` заполнен required-листами, `directiveToIR` эмитит `argTypes`, новый helper `valueKindToLiteralKind`.
- `packages/graph/src/validator.ts` — блок enforcement'а `sig.required` с E023 на директив-локации.
- `packages/graph/SPEC.md` — §10 Directive + `argTypes`; §12 новый пункт E023.
- `packages/graph/test/validator.test.ts` — 14 новых кейсов под `describe('E023')`: positive (E023 fires для `@added`, `@deprecated`, `@default`, `@range` без min/max, `@scope`, `@topic`, `@liveness` с двумя диагностиками) + negative (clean для zero-arg `@atomic`, `@sync` без args, `@auth` без args, `@crdt` без key — это E004's job, не E023).
- `packages/graph/test/conformance.test.ts` — 7 новых кейсов под `describe('13.12: directive arg literal kinds (v0.3.3)')`: `@default(value: UNKNOWN)` → `argTypes.value = 'enum_ref'`, `@default(value: "hello")` → `'string'`, `@range(min: 1, max: 10)` → `'int'`/`'int'`, `@sync(qos: REALTIME, atomic: true)` → `'enum_ref'`/`'bool'`, `@default(value: [1,2,3])` → `'list'`, `@atomic` → `argTypes` absent, `@deprecated(since, reason)` → `'string'`/`'string'`.

### Прогоны

- `bun test packages/graph` — **466 pass / 0 fail** (+23 от 443 W4+W12 baseline: 14 E023 + 7 argTypes + 2 coverage).
- `arsenal/schema/_compile.ts` (через `aqc` из W1) — 0 errors / 0 warnings; `arsenal.ir.json` пересобран. Директив с аргументами в `arsenal.aql` нет, так что `argTypes` в этом IR не появляются — additive эффект нулевой, IR shape неотличим.
- `reader.aql` (Belladonna) через `aqc` — 0 ошибок; `argTypes` теперь есть: `@range(min: 1, max: 6)` → `argTypes: {min: "int", max: "int"}`, `@default(value: 20)` → `argTypes: {value: "int"}`.
- `reader-stress3.aql` (Belladonna experimental) через `aqc` — 0 ошибок; ключевой кейс О18: `@default(value: UNKNOWN)` на `kind: LinkKind!` даёт в IR `args: {value: "UNKNOWN"}, argTypes: {value: "enum_ref"}` — generator теперь отличит enum-literal от string-literal без реверс-lookup'а по enclosing field type.
- `reader.ir.json` для Belladonna не существует (нет build-script'а, пишущего JSON) — пропущено по условию задачи "если есть".

### Следствия

1. **Belladonna-шаг-3/О18 закрыт.** Enum-literal в IR различим через `argTypes[k] === 'enum_ref'`. Generators, которые рендерили `@default` в TS/Rust-код через резолв по типу поля (`field.type → enums[...]`) могут перестать — но pre-0.3.3 fallback продолжает работать (additive, R301).
2. **Belladonna-шаг-3/О19 закрыт.** Missing required arg детектится. `@added` / `@deprecated` / `@scope` / `@default` / `@range` / `@liveness` / `@topic` без required-аргументов — ошибка компиляции. Ловушка "SPEC обещал `!`, валидатор не enforces" устранена.
3. **Нет breaking-эффектов.** Все cookbook-схемы, kotelok-фикстуры, linker-тесты, parser-тесты (включая только что приземлившиеся W4+W12 contextual-keyword-кейсы) проходят без правок — они с самого начала писали required-args корректно (`@range(min: 1, max: 100)`, `@deprecated(since: "2", reason: "...")` и т.д.).
4. **Generators могут начать использовать `argTypes` в следующих шагах** (`graph-tauri`, `graph-tauri-rs`, `graph-axum`) — для корректной эмиссии enum-defaults в TS/Rust без реверс-lookup'а. Не в этом шаге — минимизация scope.

🟢 Работает. Шаг closing Belladonna-шаг-3/О18 + Belladonna-шаг-3/О19. Grep `@(scope|default|range|deprecated|added|liveness|topic)\b(?!\()` по `packages/graph` — ноль совпадений, pre-existing bug в реальных схемах нет.

### Открытые вопросы

- **О30:** `@crdt(type: LWW_*, key: ...)` — `key` фактически required, но только контекстно. Оставлено на E004 (как уже было). Альтернатива: выделить "conditional required" в `DirectiveSignature` (напр. `requiredIf: (args) => ...`). Пока не нужно — один случай, ad-hoc E004 справляется. Если появится второй conditional-required — обобщить.
- **О31:** `argTypes` тегирует **каждый** arg. Generator может захотеть обратное — "где мне нужен enum_ref-check?" — ответ: только на `@default(value)` в реально-enum-полях. Возможно, это всё-таки generator-side concern, но сейчас SPEC честно говорит "если `argTypes[k] === 'enum_ref'`, это bare identifier" — generator сам решает, что с этим делать. Фиксируем как normative-information, не normative-behavior.

---

## 2026-04-20 — alak improvement, шаг W5: Map inner quantifiers — normative semantics

**Контекст:** закрытие Q03 (хвостовой индекс). Дыра зафиксирована в двух местах: Belladonna шаг 2 / О4 (SPEC-сторона — `Map<String, String>!` парсится, но семантика `!` на K/V не уточнена в §4.8) + E.1 / О23 (generator-сторона — `graph-tauri-rs` честно эмитит `HashMap<Option<K>, Option<V>>`, что редко нужно семантически: map-ключ по определению не может быть null). Один шаг закрывает обе стороны — SPEC normative правило + behavioral fix в парсере + генераторы получают корректный выхлоп автоматически через уже существующий `mapTypeRef` (он уважает `required`).

### Решение: вариант А — «key всегда required, syntactic `!` на K игнорируется»

Из двух вариантов (А: normative convention, Б: explicit `!` required на K) выбран А по двум критериям:

1. **Intuition-aligned.** Map-ключ не может быть null ни в JSON, ни в CBOR, ни в Rust `HashMap`, ни в Python `dict`. Писать `Map<String!, V>` каждый раз только чтобы «успокоить» парсер — шум без смысла. SPEC теперь говорит то же, что и target-языки.
2. **Zero breaking.** Belladonna `Map<String, String>!` (без `!` на K) остаётся валидным — парсер просто нормализует `keyType.required = true` независимо от того, писал ли автор `!`. Post-fix IR `mapKey.required: true` (было `false`). Никакой существующий `.aql` не перестаёт компилироваться.

### Правки

- **`packages/graph/src/parser.ts`** — в `parseTypeExpr` после `const keyType = parseTypeExpr()` добавлена одна строка: `keyType.required = true`. Комментарий поясняет R023. Syntactic `!` на K парсится (для diagnostic fidelity), но затем перезаписывается — silent no-op, без warning (минимальная правка, без нового E/W-кода).
- **`packages/graph/SPEC.md` §4.8** — добавлено нормативное правило **R023** «inner quantifiers: key всегда required, value следует `!`». Три bullet'а: K (всегда required, `!` избыточен но принимается), V (оптионально по умолчанию, `V!` делает required), outer `!` (независим). Пояснение pre-0.3.4 поведения + почему это additive для IR consumers.
- **`packages/graph/SPEC.md` §10** — описания `mapKey` / `mapValue` уточнены: `mapKey.required` теперь домен `{ true }` при `map === true` (со ссылкой на R023). `mapValue.required` без изменений (отражает синтаксический `!` на V).
- **`packages/graph/SPEC.md` changelog** — новая версия **0.3.4 (2026-04-20)** с блоком «behavioral + normative». Предыдущий пункт 0.3.3 сохранён.
- **Version header** — 0.3.3 → 0.3.4.

### Тесты

- **`packages/graph/test/parser.test.ts`** — новый `describe('Map inner quantifiers (R023, v0.3.4)')` с 7 тестами:
  - `Map<String, String>` — key required (нормализация), value optional.
  - `Map<String, String!>` — key required, value required.
  - `Map<String!, String!>` — syntactic `!` на K redundant, no-op (key required как и был бы).
  - `Map<String, String>` без outer `!` — outer.required=false, key.required=true.
  - IR-level идентичность: `Map<K, V>` и `Map<K!, V>` дают байт-идентичный IR (`mapKey.required===true` в обоих).
  - Nested `Map<ID, Map<String, Int>>` — R023 применяется к key на каждом уровне.
  - `Map<Int, String>` — Int scalar, no E022 (regression-guard что R023-нормализация не ломает E022-валидацию).
- **`packages/graph-tauri-rs/test/reader.test.ts`** — один новый assert: `BundleManifest.contexts` эмитится как `HashMap<String, Option<String>>` (не `HashMap<Option<String>, Option<String>>`). Negative-assert на `HashMap<Option<String>` чтобы поймать regression в будущем.

### Генераторы

Правки не требуются. И `graph-tauri-rs/src/utils.ts::mapTypeRef`, и `graph-axum/src/utils.ts::mapTypeRef` уже уважают `ref.required` и эмитят `Option<T>` только когда `required === false`. Т.к. парсер теперь кладёт `keyType.required = true` безусловно, генераторы автоматически перестают оборачивать K в `Option<>`. Value-side поведение не меняется — `Option<V>` всё так же эмитится когда V не несёт `!`.

### Прогоны

- **`bun test packages/graph`** — 473 pass / 0 fail (+7 от 466 W2+W3 baseline: 7 новых R023-тестов; W4+W12-кейсы и всё остальное проходят).
- **`bun test packages/graph-tauri-rs packages/graph-axum`** — 22 pass / 0 fail (+1 от 21: новый assert на `contexts: HashMap<String, Option<String>>`).
- **`bun test` (полный монорепо)** — 872 pass / 0 fail (всё зелёное).
- **`arsenal/schema/_compile.ts`** — 0 errors / 0 warnings; `arsenal.ir.json` пересобран. В arsenal нет ни одного `Map<...>` поля, поэтому IR shape неотличим от pre-fix. Snapshot-тесты arsenal'а (`arsenal.types.rs.snap`, `arsenal.routes.rs.snap`) не изменились — no Map, no diff.
- **`Belladonna/schema/_generate_tauri_rs.ts`** — regen pass, 0 errors / 1 warning (`@range` preserved-as-comment — uncorrelated). Diff в `src-tauri/src/generated/belladonna_reader/types.rs`:
  ```diff
  -    pub contexts: std::collections::HashMap<Option<String>, Option<String>>,
  +    pub contexts: std::collections::HashMap<String, Option<String>>,
  ```
  Key side перестал быть `Option<String>` — семантически корректный `HashMap<String, ...>`. Value side (`Option<String>`) остался — в SDL `Map<String, String>` (без `!` на V), правило «V следует `!`» гласит: optional. Если Belladonna захочет required value, достаточно написать `Map<String, String!>!` — снова только текст, без изменений кода alak.
- **`Belladonna/schema/reader-stress3.aql`** — не трогает Map, regression-free.

### Пример IR до/после

SDL: `contexts: Map<String, String>!` (Belladonna BundleManifest)

**До (pre-0.3.4):**
```json
{
  "name": "contexts", "type": "Map", "required": true, "list": false, "map": true,
  "mapKey":   { "type": "String", "required": false, "list": false },
  "mapValue": { "type": "String", "required": false, "list": false }
}
```

**После (0.3.4):**
```json
{
  "name": "contexts", "type": "Map", "required": true, "list": false, "map": true,
  "mapKey":   { "type": "String", "required": true,  "list": false },
  "mapValue": { "type": "String", "required": false, "list": false }
}
```

Единственное отличие — `mapKey.required: false → true`. Additive для IR consumers, которые игнорировали флаг; корректировка для тех, кто его уважал.

### Следствия

1. **Q03 закрыт** (хвостовой индекс обновлён: `status: Closed by W5`).
2. **Нет breaking-эффектов.** Все 5 `.aql`-фикстур (kotelok/*, reader.aql, reader-stress3.aql, arsenal.aql) парсятся идентично. Единственный наблюдаемый эффект — корректный Rust type в Belladonna's generated/types.rs.
3. **SPEC v0.3.4.** Version bump минорный, additive. Changelog честно фиксирует behavioral change (парсер теперь переопределяет `keyType.required`) — IR consumers, которые раньше видели `mapKey.required: false`, теперь увидят `true`; те, что ничего не смотрели — без изменений.
4. **E022 не пересекается с R023.** E022 всё так же ловит `Map<Record, V>` / `Map<Enum, V>`. R023 — ортогональная нормализация quantifier'а, не типа.
5. **Generator-side уже корректно.** `mapTypeRef` в обоих Rust-генераторах (`graph-tauri-rs`, `graph-axum`) уважает `required`-флаг без правок. `graph-tauri` (TS) также корректен (его `Record<K, V>` вообще не меняется от K-nullability — key в TS всё равно string-coerced).

🟢 Работает. Шаг closing Q03 (+ его источники Belladonna-2/О4 и E.1/О23 одним махом — SPEC + parser + generator outcome в одном коммите).

### Открытые вопросы

- **О32:** syntactic `!` на K принимается молча (no-op). Альтернатива: эмитить W-code (`W005: redundant ! on map key — always required`). Не сделано в этом шаге — минимизация scope. Если при code-review `.aql` появятся фальшивые `Map<K!, V>` как карго-культ — добавить W005.
- **О33:** IR-форма `mapKey.required` всё ещё сериализуется. Альтернатива: не эмитить вообще для map-слотов (всегда `true`, implicit). Отвергнуто: ломает shape-стабильность §10 `TypeRef`. Лучше узкое домен, чем отсутствие поля.

---

## 2026-04-20 — alak improvement, шаг W11: Q-numbering synced

**Контекст:** журнал append-only, в нём накопилось >19 записей от двух потребителей (Belladonna + Arsenal v2) и нескольких volna-шагов (P.0, P.1, W1, W2+W3, W4+W12, W6, W7, W10). При параллельном ведении несколько разных записей переиспользовали одни и те же локальные номера открытых вопросов (О14/О15 — дважды, О18/О19 — дважды, О20 — трижды, О25 — один раз, О27 — дважды, О30/О31 — заняты W2+W3). Поиск «вопрос О15» даёт два разных вопроса из разных записей — это ломает трассировку (какой О15 закрыт, какой открыт).

**Артефакт:** новый раздел в конце этого файла — «Сводка открытых вопросов» с канонической сквозной нумерацией Q01…Qn. Старые локальные номера О\* в телах записей **не трогаются** (правила append-only ведения в шапке). Q-номера — новый префикс, чтобы не конфликтовать с исторической маркировкой О и чтобы было видно, что это индекс-проекция, а не переписанный оригинал.

**Механика:**
- Собраны все вхождения `**ОN:**` из всех записей журнала — 36 экземпляров (включая коллизии номеров).
- Дедупликация: близкие по теме вопросы слиты под одним Q-номером с двумя-тремя source-ссылками. Основные слияния: «транспорт/local-only маркер» (Belladonna-1/О1 + Belladonna-2/О5 + Arsenal-C.1+C.2-подтверждение), «auth-scope / admin-actions» (Arsenal-A.0/О7 + Arsenal-A.1/О14-admin), «Map inner-required» (Belladonna-2/О4 + E.1/О23), «output файловая раскладка» (Arsenal-C.1+C.2/О13 + Arsenal-C.0/О11).
- Итого 34 канонических Q-вопроса, сгруппированных по 9 тематическим категориям.
- Для каждого Q проставлен статус: **Open**, **Closed by <step>** (если журнальная запись явно закрыла вопрос), либо **Out-of-scope** (не решается в alak — Tauri-baseline и pre-warm WebView2).

**Что сделано / что нет:**
- 🟢 Индекс создан в конце файла, после всех существующих записей и разделителей.
- 🟢 Старые записи и их локальные номера О\* не редактировались.
- 🟢 Сам этот шаг W11 оформлен обычной журнальной записью по тому же шаблону, что остальные.
- 🔴 Ничего не коммитится (ограничение задачи).

### Следствия

1. Будущим потребителям, ссылающимся на открытый вопрос, предпочтительно использовать Q-номер из индекса — он стабилен и уникален. Локальный О-номер в теле записи указывается рядом, чтобы сохранить трассу к источнику.
2. Когда следующая журнальная запись закрывает какой-то Q — её автор дописывает в тело записи фразу «закрывает Q0N» и следующим шагом обновляется индекс (только индекс, записи по-прежнему append-only).
3. Новые открытые вопросы в новых записях продолжают нумероваться локально (О32, О33, …) — при следующей синхронизации индекса их включают в сводку с очередными Q-номерами.

### Открытые вопросы

- **О32:** Где хранить канонические Q-номера — только в хвостовом индексе этого файла, или отдельным машинно-читаемым `stress.questions.yaml`? Индекс в markdown удобен для человека, но plain-text регрессируется при следующем расхождении. Пока — хвостовой индекс; когда вопросов станет >50 — переезд в structured file.

---

## 2026-04-20 — alak improvement, шаг W9: events first-class SDL decl + generators wired

**Контекст:** закрытие Q18 (Arsenal-A.0/О8), частичное закрытие Q19/Q20 (Belladonna/Arsenal-P.1). До этого шага broadcast events в SDL выражались через `leadingComments + # @event:Name` marker (P.1) — обходной путь. Генераторы `graph-tauri-rs` / `graph-tauri` держали stub-файлы `events.rs` / events-gen.ts с пояснением «waits on IR P.1». Полнота Tauri-targets упиралась именно в это.

**Артефакт:**
- `A:/source/alak/packages/graph/src/{types,lexer,parser,ir,validator,linker,errors,index}.ts` — strict keyword `event`, EventNode + IREvent, parseEventDecl (почти копия parseRecordDecl), IR-dispatch, validator-pass с E024 (`@scope` на event запрещён), linker-merge с E010 на дубликаты.
- `A:/source/alak/packages/graph/SPEC.md` — §5.5 Events нормативная секция (R065–R069, wire-mapping таблица), §2 EBNF `EventDecl`, §2.1 `event` в strict keywords, §10 IR JSON-schema (`SchemaBlock.events` + `Event` def), §12 новый код E024, §17 «Event broadcasts» из out-of-scope перенесён в in-scope (streams остаются out), changelog bump 0.3.4 с записью W9.
- `A:/source/alak/packages/graph-tauri-rs/src/{events-gen,types-gen,index}.ts` — events-gen теперь НЕ stub: эмитит `pub fn emit_<snake>(&AppHandle<R>, &Payload) -> tauri::Result<()>`  + `use tauri::Emitter`. types-gen получил `emitEventPayloads` — struct с `Serialize + Deserialize` как record, через существующий mapFieldType. Placeholder-секция `events.rs` сохранена для schemas без events — стабильный `mod.rs`.
- `A:/source/alak/packages/graph-tauri/src/{events-gen,types-gen,index}.ts` — events-gen эмитит `export function on<Event>(handler) => Promise<UnlistenFn>` + `import { listen, type UnlistenFn } from '@tauri-apps/api/event'`. types-gen получил `emitEventInterfaces` — `I<Event>` рядом с record interfaces в отдельной секции.
- `A:/source/alak/packages/graph-axum/src/index.ts` — per-event warning-and-skip. Сообщение упоминает WebSocket/SSE upgrade как будущий путь.
- `A:/source/pharos/Belladonna/schema/reader-events.aql` — demo schema с 3 events (`RenderProgress`, `RenderCompleted`, `RenderFailed`). Прогнан через оба генератора; smoke-cargo-check'ом подтверждена компиляция `events.rs` с `tauri::Emitter + app.emit(...)`.
- Тесты: `packages/graph/test/parser.test.ts` +7 W9-тестов (basic parse, leadingComments, directives, E024, Map в event, record+event коэкзистенция, `event` как strict keyword); `packages/graph-tauri-rs/test/reader-events.test.ts` — новый smoke; `packages/graph-tauri/test/reader-events.test.ts` — новый smoke. Существующие `reader.test.ts` подправлены (events placeholder вместо старого stub; snapshot перегенерирован).

**Результат тестов:**
- `bun test` (весь монорепо): **892 pass / 0 fail** (+0 от baseline — предыдущие тесты не сломаны + новые покрытия в events-секции не считались отдельно, W9 добавил 7 parser-тестов + 2 smoke).
- `bun test packages/graph`: **500 pass / 0 fail**.
- `bun test packages/graph-tauri`: все зелёные (включая новый smoke + обновлённый snapshot).
- `bun test packages/graph-tauri-rs`: все зелёные (включая новый smoke).
- `cargo check` на `A:/source/pharos/Belladonna/src-tauri` с временно подключённым generated `belladonna_reader_events/` — **OK, 0 errors**. Подтверждено что Tauri v2 API (`tauri::Emitter`, `AppHandle<R>::emit`) компилируется с сгенерированным кодом. После подтверждения временное подключение отменено — generated-папка reader-events удалена, main.rs возвращён; schema `reader-events.aql` оставлен как demo-артефакт.

### Находки

**🟢 `event` как strict keyword — минимум ломки совместимости.**
Никто из живых потребителей (Belladonna, Arsenal, Kotelok) не использовал `event` как field/arg/enum-member name. Добавление в strict list — безопасно. Сделано через `KEYWORDS` Set и top-level dispatch в parser; не через contextual-path (который был введён в W4 для «не ломать `version`/`scope`/...» имена). Для `event` contextual не нужен — `event` в SDL семантически зарезервирован под декларацию, не под идентификатор.

**🟢 Shape-reuse: parseEventDecl = почти клон parseRecordDecl.**
Тело event — тот же parseFieldList + parseDirectives. IREvent = копия IRRecord минус scope/topic (события не scoped; `@topic` в v0.3.4 для events формально допустим, но не интерпретируется — wire-имя фиксируется R066 как `snake_case(EventName)`). fieldToIR переиспользуется без изменений. Linker merge логика аналогична records (E010 на дубликаты).

**🟢 Wire-name convention `snake_case(EventName)` — уже в кодовой базе.**
`utils.ts::snakeCase` был реализован для action invoke-names (`RenderMarkdown` → `render_markdown`). Reuse для events — zero-cost.  Rust-side `emit_<snake>` и TS-side `listen('<snake>', …)` автоматически симметричны.

**🟢 Events vs streams — чёткая граница.**
`event` — одна типизированная полезная нагрузка, broadcast. `opaque stream` — байтовый поток, QoS-параметризованный. Download_progress теоретически «стримовый» по частоте, но семантически — последовательность one-shot broadcast payloads, не chunked stream. В W9 событие fits. Если потребителю понадобится backpressure / framing / QoS — это opaque stream (§4.7, §8.12) или будущий `stream T` декларатор (W9 explicitly не трогает).

**🟡 `@topic` на event — валиден, но generator его не применяет.**
Current behavior: `event X @topic(pattern: "...") { ... }` парсится, валидатор не ругается, IR сохраняет directive, но Rust/TS generators используют `snake_case(X)` жёстко. Для v0.3.4 это сознательно — wire-name хочется держать deterministic по SDL-имени, и `@topic` на event переносит «прыжок имени на wire» в ambiguous зону. Позже можно добавить поддержку, сейчас — warning не эмитится, но и override не работает. Фиксируем как ограничение; если кто-то реально попытается это использовать — превратим в W005-like warning.

**🟡 Zenoh генератор events пока не эмитит.**
`@alaq/graph-zenoh` — не трогали в W9 (out-of-scope per task brief). События в IR.events присутствуют; `schema.events` может быть прочитан, но code-gen не добавлен. Когда Zenoh-целевой потребитель появится — план: топик `<ns>/events/<snake_name>`, fire-and-forget put. Пока — молчаливый no-op.

**🟡 HTTP генератор выдаёт warning per event, не per-schema.**
`graph-axum` пишет warning на каждый event в schema. При большом числе events это спам. Мог бы — одна summary-фраза. Оставлено per-event сознательно: конкретное имя события в логе помогает author'у найти «я забыл убрать из http.aql вот этот event», а при split-file конвенции (как в SPEC §17 рекомендуется) events в http.aql — ошибка дизайна, не регулярный случай. Если спам станет реальной проблемой — переключим на agg.

**🟢 Belladonna smoke-test прошёл чисто.**
`reader-events.aql` → generator → `cargo check` — 0 ошибок. `tauri::Emitter` трейт + `app.emit("render_progress", payload)` компилируется в Tauri 2.x. Payload struct со `Serialize/Deserialize` — как record. Временная wiring в main.rs снята после проверки. Поскольку Belladonna-side `belladonna_reader/` имеет независимые pre-existing issues (отсутствует async_trait dep в Cargo.toml — см. stress.md E.1 Q29; это не W9, это Belladonna-конфиг), я подключил только reader_events модуль — он не тянет async_trait (нет actions → нет handlers.rs trait).

### Следствия

1. **Q18 closed.** first-class events приземлены в SPEC + 4 генератора (2 эмитят, 1 skip-warning, 1 no-op). Arsenal может теперь писать `event download_progress { handle: String!, bytes: Int!, total: Int! }` в `arsenal.tauri.aql` (когда этот файл появится). Демо-schema в Belladonna служит шаблоном.
2. **Q19/Q20 partially closed.** `leadingComments` как «обходной синтаксис для events» отпадает — у events теперь настоящий синтаксис. Чисто «header-комментарий к файлу» и «field-level inline комментарий» остаются теоретически открытыми, но без демо-давления.
3. **Arsenal C.1 events-stub разблокирован.** Следующий шаг Arsenal-pipeline (если он есть) — расширить `.tauri.aql` до events + подключить `emit_download_progress` в upload-handler'е.
4. **Streams остаются out-of-scope.** §17 теперь явно говорит: broadcast events = in, streams = out. Если Arsenal v2 пойдёт по пути «`download_progress` — частый поток chunks», канонический ответ сейчас: `opaque stream` + payload-parsing в handler. Первоклассный stream syntax требует отдельной волны.
5. **v0.3.4 spec-bump — кооперативный с W8.** W8 уже поднял версию с 0.3.3 → 0.3.4 под `@transport`. W9 добавил events в тот же minor (0.3.4 changelog). Рабочая практика: один bump-минор = один спринт = несколько W-шагов; изменения покрываются дополнительными строками changelog'а, не отдельными минорами.

### Открытые вопросы

- **О33:** `@topic` на event — в v0.3.4 сознательно no-op у default-генераторов. Включать как future extension (override для wire-имени) или запретить валидатором сейчас (до появления кейса)? Current: позволяем в SDL, ignoрируем в generation. Не блокирует.
- **О34:** Zenoh-target events — когда приземлять? Нет live-потребителя; `@alaq/graph-zenoh` пока stub-знает про `schema.events` (в IR лежит, но не читается). Добавлять при первом реальном запросе. Parking.
- **О35:** HTTP-target events — per-event warning vs per-schema summary. Default per-event. Пересмотреть если массовые schemas из смешанных surfaces начнут генерить спам.

---

## Сводка открытых вопросов

34 Q из журнальных записей выше. **14 закрыто, 4 частично, 2 out-of-scope, 14 open.**

Legend: 🟢 closed — решено кодом/SPEC/README. 🟡 partial — частично, остаётся недостающий кусок. ⏸️ out-of-scope — вне alak (Tauri platform и т.п.). ⬜ open.

- 🟢 Q01: reserved keywords `version`/`namespace`/`scope`/`input`/`output`/`qos`/`max_size` (Arsenal-A.0/О6, Belladonna-1/О2) — closed by W4+W12 (contextual keywords, SPEC §2.1 R005/R006).
- 🟢 Q02: UI-команды окна `Close`/`Minimize`/`Maximize` в SDL (Belladonna-1/О2) — closed by W10 (SPEC §17 «UI commands out of SDL»).
- 🟢 Q03: `Map<K,V>` семантика `!` на K/V (Belladonna-2/О4, E.1/О23) — closed by W5 (key всегда required, SPEC §4.8 R023, v0.3.4).
- 🟢 Q04: enum literal в `Directive.args` — тегировать vs резолвить по типу (Belladonna-3/О18) — closed by W3 (IR `argTypes` + `IRLiteralKind`, SPEC §10).
- 🟢 Q05: required-args директив не enforces (Belladonna-3/О19) — closed by W2 (E023 + `DirectiveSignature.required`).
- ⬜ Q06: `extend record` — flat concat vs `field.sourceDecl` мета (Belladonna-3/О20) — open, parking.
- ⬜ Q07: DTO vs state records — `@dto`/`@transient` маркировка (Arsenal-A.1/О15-DTO) — open.
- 🟢 Q08: `outputList`/`outputListItemRequired` в SPEC §10 (Arsenal-A.1, P.0) — closed by P.0.
- ⬜ Q09: дедик-код диагностики R006 violation (W4+W12/О28) — open, не блокер.
- ⬜ Q10: линтер-правило «spelling избегания keyword» (W4+W12/О29) — open, parking.
- ⬜ Q11: `@crdt key` conditional-required — обобщать `requiredIf` (W2+W3/О30) — open, один случай.
- ⬜ Q12: per-arg тегирование `argTypes` как normative-information (W2+W3/О31) — open, нет давления.
- ⬜ Q13: marker-syntax в comment `# @event: name` vs `#[event]` (Arsenal-C.1+C.2/О12) — open, синтаксис за потребителями.
- ⬜ Q14: target-specific директивы (`@http`/`@tauri`/`@zenoh`) closed vs open set (Arsenal-A.0/О9) — open, formal decision остаётся.
- 🟢 Q15: формальный маркер local-only / transport (Belladonna-1/О1, Belladonna-2/О5, Arsenal-C.1+C.2) — closed by W8 (`@transport(kind: ...)` на schema-block, SPEC §7.14, W005).
- 🟢 Q16: авторизация в SDL vs вне — multi-axis `@scope` (Arsenal-A.0/О7, Arsenal-A.1/О14) — closed by W10 (single-axis + auth-on-transport, SPEC §7.5 R135–R137).
- 🟢 Q17: scoped actions в Tauri-генераторе (E.2/О19) — closed by W10 (R137: одинаковая семантика, no-op правильно).
- 🟢 Q18: `event Name { ... }` first-class (Arsenal-A.0/О8) — closed by W9 (strict keyword, SPEC §5.5 R065–R069, генераторы эмитят emit/on/I<Event>).
- 🟡 Q19: `leadingComments` на schema-block (Arsenal-P.1/О14) — partially closed by W9 (first-class event снял большинство кейсов; чистая шапка-файл остаётся R001).
- 🟡 Q20: inline / field-level комментарии (Arsenal-P.1/О15) — partially closed by W9 (events-давление снято, field.leadingComments — future extension).
- 🟢 Q21: CLI `aqc` — в `@alaq/graph` vs отдельный пакет (Belladonna-1/О3) — closed by W1 (`packages/graph/bin/aqc.ts`).
- 🟢 Q22: `GENERATOR_VERSION` sync с `package.yaml` (E.0/О21) — closed by W6 (`scripts/sync-generator-versions.ts` + `_version.ts`).
- 🟢 Q23: IR-расширение side-effects на существующие генераторы (Arsenal-C.0/О10) — closed by P.0+P.1 (аддитивно, не сломаны).
- ⬜ Q24: `aqc --watch` режим (W1/О25) — open, W1 позиция — не в v1.
- ⬜ Q25: формат диагностик `aqc --json` — два массива vs один (W1/О26) — open, смена breaking.
- ⬜ Q26: общие README-секции (License / Contributing) — footer vs дубль (W7/О27) — open, parking до 6–7 пакетов.
- 🟡 Q27: output файловая раскладка — норма vs решение генератора (Arsenal-C.1+C.2/О13, Arsenal-C.0/О11) — partially closed by W7 (README описывают, SPEC-нормы нет).
- 🟢 Q28: README graph-axum — Windows `#[path]` edge case (E.0/О20) — closed by W7.
- 🟡 Q29: `tauri::command` name-collision detection (E.1/О22) — partially closed by W7 (atomic-migration в README, generator detection open).
- ⬜ Q30: `@alaq/plugin-tauri/ipc` subpath для dev-fallback + Logi (E.2/О18) — open (H4 подтвердил trace-id работает и без subpath).
- ⬜ Q31: `@deprecated` → `#[deprecated]` native mapping (E.1/О24) — open.
- ⏸️ Q32: pre-warm WebView2 между окнами (Belladonna-baseline/О16) — out-of-scope (Tauri/WebView2 platform).
- ⏸️ Q33: pre-warm в `plugin-tauri` или отдельно (Belladonna-baseline/О17) — out-of-scope для SDL-ядра; возможно in-scope `@alaq/plugin-*` при втором потребителе.
- ⬜ Q34: где хранить Q-номера — хвостовой индекс vs `stress.questions.yaml` (W11/О32) — open, переезд при >50 вопросов.

---

## 2026-04-20 — alak improvement, шаг W8: @transport directive on schema-block

**Контекст.** Q15 (индекс W11) суммирует давление трёх потребителей — Belladonna reader.aql, Belladonna reader-stress3.aql, Arsenal arsenal.aql — на маркировку целевого транспорта schema'ы. W10 зафиксировал текстом SPEC §17 "transport selection — out of SDL" и оставил возможность будущего `@transport`/`@local`. W8 доделывает ровно этот кусок: добавляет закрытую schema-level директиву `@transport(kind: "...")` как **маркер намерения**, без превращения в control-channel для генераторов.

**Принятое решение.**
1. Новая директива `@transport(kind: String!)` на **schema-block** (не на record/action/field). Размещение между `schema Name` и `{` — зеркалит `record Name @scope(...) {`. Аргумент — string literal (не enum keyword), closed set: `"tauri" | "http" | "zenoh" | "any"`.
2. Default: директива отсутствует ≡ `@transport(kind: "any")`. Pre-W8 schemas не ломаются.
3. Семантика — **advisory**: парсер кладёт `kind` в `IRSchema.transport`, генераторы эмитят **W005 warning** на mismatch со своим `SUPPORTED_TRANSPORTS`, но generation продолжается. Strict-mode rejection — future work.
4. Закрытая directive (§7 closed set), SPEC-версия поднята 0.3.3 → 0.3.4.

**Правки (code).**
- `packages/graph/src/types.ts` — `SchemaDeclNode.directives?: DirectiveNode[]`, `IRSchema.transport?: string`, `IRSchema.directives?: IRDirective[]`, `DiagnosticCode += 'W005'`.
- `packages/graph/src/errors.ts` — `W005` в SEVERITY + MSG.
- `packages/graph/src/parser.ts` — `parseSchemaDecl` теперь вызывает `parseDirectives()` после IDENTIFIER и до LBRACE; пустой список не эмитится в AST (additive).
- `packages/graph/src/ir.ts` — `DIRECTIVE_SIGS.transport = { args: { kind: 'string' }, required: ['kind'], enumValues: { kind: ['tauri','http','zenoh','any'] } }`; `buildIR` проецирует `@transport(kind: ...)` в `IRSchema.transport` и сохраняет `IRSchema.directives`.
- `packages/graph/src/validator.ts` — schema-level директивы проходят `validateDirective` (E001/E002/E003/E023 — стандартный путь); новая ветка в `validateDirective` для closed-string-set: если `enumValues[arg]` существует и expected type = `'string'`, несоответствие → E003.
- `packages/graph/src/linker.ts` — merge transport/directives при multi-file: первая schema с `@transport` устанавливает merged, остальные игнорируются (конфликтующие transport в одной namespace — сценарий из split-file, который явно НЕ должен делать merge; generator'ы проверят W005 на merged value).

**Правки (generators).**
- `graph-axum`, `graph-link-state`, `graph-link-server` — `SUPPORTED_TRANSPORTS = ['http', 'any']`.
- `graph-tauri`, `graph-tauri-rs` — `SUPPORTED_TRANSPORTS = ['tauri', 'any']`.
- `graph-zenoh` — `SUPPORTED_TRANSPORTS = ['zenoh', 'any']`.
- Каждый генератор эмитит W005 diagnostic (severity: 'warning') в самом начале `generate()` per namespace, если `schema.transport && !SUPPORTED_TRANSPORTS.includes(schema.transport)`. Exported `SUPPORTED_TRANSPORTS` для тестов/tooling.

**Правки (SPEC).**
- Version: 0.3.3 → **0.3.4** (уже был поднят W9 / Map-keys normalisation — W8 расширяет тот же bump).
- §2 EBNF: `SchemaDecl = "schema" , Identifier , { Directive } , "{" , SchemaField+ , "}" ;`.
- §7.14 **`@transport`** — нормативная глава (R220–R223): placement, value set, advisory-only семантика, pre-0.3.4 ≡ "any", новые values требуют spec bump.
- §10 IR: `SchemaBlock.transport` (enum of 4 strings), `SchemaBlock.directives`.
- §12 Warnings: W005 описан.
- §15 Changelog: 0.3.4 extended — блок W8 (новая §7.14, grammar/IR/validator/W005/generators).
- §17 "Out of scope" — пункт про transport selection переписан: упомянута `@transport` как advisory маркер, split-file остаётся альтернативой, оба орто-перпендикулярны.

**Правки (consumers).**
- `A:/source/pharos/Belladonna/schema/reader.aql` — `schema BelladonnaReader @transport(kind: "tauri") { ... }` + шапка-комментарий про SPEC §7.14.
- `A:/source/pharos/Belladonna/schema/reader-stress3.aql` — то же.
- `A:/source/rest.valkyrie/arsenal/schema/arsenal.aql` — `schema Arsenal @transport(kind: "http") { ... }`.

**Прогоны.**
- `bun test packages/graph` — **500 pass / 0 fail** (+6 от 494 baseline): 7 новых conformance-кейсов под `describe('13.13: @transport schema-level directive (v0.3.4)')` — positive для каждого из 4 kind, absent-equivalent-to-any, E003 на `"bogus"`, E023 на missing kind. (Один заявленный новый тест на generator W005 переехал в `graph-axum/test/transport.test.ts`).
- `bun test packages/graph-axum` — **+6** новых тестов под `describe('@transport mismatch → W005 advisory')`: `SUPPORTED_TRANSPORTS` shape, no @transport → 0 warns, `"http"` → 0 warns (native), `"any"` → 0 warns (explicit), `"tauri"` → 1 warn, `"zenoh"` → 1 warn. Все zero errors, generation files emitted.
- `bun test` (все 94 файла) — **898 pass / 0 fail / 7664 expect** (baseline с учётом W9 ≈ 892; +6 от W8). Нулевые регрессии.
- `arsenal/schema/_compile.ts` через `aqc` — **0 errors / 0 warnings**; `arsenal.ir.json` пересобран, `"transport": "http"` + `"directives": [{ "name": "transport", ...}]` присутствуют. Размер IR увеличен на ~100 байт.
- `Belladonna/schema/_generate_tauri.ts` — `belladonna.reader.tauri.generated.ts` регенерён, **0 errors**, pre-existing stub-warnings. **Никаких W005**: schema=tauri, generator supports=tauri.
- `Belladonna/schema/_generate_tauri_rs.ts` — 6 файлов регенерены, 0 errors, 1 warning (pre-existing `@range preserved as comment`). Никаких W005.
- `rest.valkyrie/arsenal/schema/_generate_axum.ts` — 5 файлов регенерены, 0/0. Никаких W005.
- Smoke-test (не закоммичен в тесты): `graph-zenoh.generate(reader.aql-IR)` — эмитит W005 `schema "belladonna.reader" declares @transport(kind: "tauri") which is outside @alaq/graph-zenoh supported transports [zenoh, any]; generation proceeds (W005).` + preserved-as-comment warning от `@range`. Files всё равно эмитятся.

**Что закрыто.**
- **Q15** — закрыт директивой (status обновлён в сводке). Split-file (`arsenal.http.aql` + `arsenal.tauri.aql`) остаётся валидной альтернативой: §17 сохраняет её как orthogonal path; `@transport` — маркер на уровне одного файла.

**Ограничения соблюдены.**
- 🟢 Не breaking: pre-W8 schemas (без `@transport`) парсятся/компилятся/генерируются идентично (additive IR, absent-равен-any для W005).
- 🟢 Advisory, не error: W005 — warning. Generation proceeds. Строгий mode — future work (Q14/Q15 follow-up, но уже вне W8).
- 🟢 Closed set: 4 values + spec bump для расширения (R223).
- 🟢 Не коммитится.
- ⚠️ Конфликт с W5 / W9 в parser.ts / types.ts: W9 уже landing, types.ts / KEYWORDS / linker.ts содержали правки под `event` keyword. W8-правки — чистые additions через Edit-якоря, без перекрытия W9-полей; все 898 тестов проходят после обоих шагов.

### Открытые вопросы

- **О33:** Нужно ли `@transport` на per-action уровне (для смешанных schema'ы, где часть actions идёт на HTTP, часть на Tauri в одной `.aql`)? Сейчас директива только на schema-block. Ответ v0.3.4: «пока нет конкретного стресс-кейса — split-file остаётся ответом; per-action `@transport` — будущая расширяемость при появлении гибридов». Не блокер.
- **О34:** Strict mode — конвертация W005 в ошибку по опции генератора (`strictTransport?: boolean`). Не в scope W8; появится если/когда потребитель попросит fail-fast на неправильный pipeline.
- **О35:** Обратная проекция — если IR имеет `@transport(kind: "tauri")` и generator — `graph-tauri-rs`, можно ли **подавлять** предупреждения `@scope is not supported in HTTP` (которые в axum advisory)? Т.е. transport-aware filtering других generator warnings. Не в W8 (один generator per run, не cross-check); полезно для tooling если появится dispatcher.

---

## 2026-04-21 — Arsenal v2, шаг H4: Logi cross-language trace verified

**Статус:** 🟢 подтверждено end-to-end (TS-клиент + Rust-сервер → один trace в Logi, 4 события).

**Контекст:** последняя непроверенная гипотеза concept.v2 §2 — что Logi-observability действительно связывает frames с обеих сторон вызова через `X-Trace-Id`. До этого шага только декларировалось, что генерируемый `@alaq/graph-axum` runtime (`alaq-graph-axum-rt::ActionContext`) пробрасывает trace-id из header в handler, и что Sentry-style `logi-rs`/`logi-js` SDK пишут в один и тот же `/ingest/v1/json`. Шаг H4 — реальный стресс через arsenal: instrument один handler, прогнать HTTP-запрос с фиксированным trace-id, проверить что Logi отдаёт все события по `GET /api/trace/:trace_id`.

**Что сделано.**
- 🟢 `arsenal/server-v2/Cargo.toml` — добавлены path-dep'ы `logi-rs`, `logi-proto` (относительные пути `../../../logi/crates/…` от `arsenal/server-v2/`) + `uuid`. `cargo check` зелёный, 7.2 s.
- 🟢 `arsenal/server-v2/src/main.rs` переписан: `StubHandlers` → `H4Handlers` с реальным `packages()` impl (остальные 4 — `unimplemented!()`, smoke их не трогает). В `main()` — `logi_rs::Client::init_with_project("http://localhost:2025", "demo_project_token", "demo")` и ручной `GET /health` через `Router::merge` с сгенерированным роутером. Generated-код не тронут.
- 🟢 Handler `packages` читает `ctx.trace_id` из `ActionContext`, emit'ит два Logi-события: `arsenal.packages.start` (с `channel`/`platform` в `attrs`) и `arsenal.packages.end` (с `duration_ms` в `numeric`). Fingerprint `arsenal.Handlers.packages`, service `arsenal-server-v2`, kind `event`, level `info`. Fake output — `Vec<PackageMeta>` с одним `arsenal-smoke`.
- 🟢 `arsenal/logi-smoke-client.mjs` — standalone TS-скрипт, импортит собранный `@logi/browser` (`dist/logi.mjs`), emit'ит `arsenal.client.request.start` → `fetch POST /packages` с `X-Trace-Id` → `arsenal.client.request.end`. Все три — с одинаковым trace-id.
- 🟢 `cargo run` arsenal-server-v2, bind 0.0.0.0:8099, `/health` отвечает «ok». `bun run logi-smoke-client.mjs <TRACE>` — HTTP 200, body `[{"name":"arsenal-smoke",...}]`. После sleep 1 s → `GET /api/trace/<TRACE>?project=demo` отдаёт **4 события в одном trace**: 2 от `logi-js/0.1.0` (`arsenal-client-smoke`) + 2 от `logi-rs/0.1.0` (`arsenal-server-v2`), в правильном chronological order (client.start → server.start → server.end → client.end).
- 🟢 Артефакт сохранён: `A:/source/rest.valkyrie/arsenal/logi-smoke-result.json` (2010 байт).

**Что проверено (ответы на вопросы задачи).**
- 🟢 `logi-rs` имеет готовый API init+emit без обёртки: `Client::init_with_project(endpoint, token, project_slug)` + `Event::new(...)` + `client.send(ev)`. Background batcher (tokio::spawn) бросает в `/ingest/v1/json` каждые 500 ms или при 50 событиях. Custom attributes/numeric/trace_id/fingerprint/service — поля `Event` из `logi-proto`, заполняются напрямую перед `send`. Обёртка `alaq-logi-rs` действительно не нужна — голый SDK закрывает кейс.
- 🟢 `alaq-graph-axum-rt::ActionContext` корректно извлекает `X-Trace-Id` из header через `FromRequestParts` (case-insensitive `x-trace-id`, парсинг в `Uuid`, fallback `Uuid::new_v4()` при отсутствии/мусоре). Generated dispatcher `dispatch_packages` получает `ActionContext` автоматически как extractor — schema `.aql` про это ничего не знает, трасса бесплатно.
- 🟢 Logi видит все 4 записи по одному trace_id, сортирует их по `ts`, кросс-SDK (js + rs). Endpoint `GET /api/trace/:trace_id?project=<slug>` реально работает — не ручной join по CH, а готовый роут в `logi-core`.
- 🟢 TS-сторона проверена через direct-fetch (`bun run logi-smoke-client.mjs`), а не через Tauri webview. Полноценный `@alaq/plugin-logi` + `@alaq/graph-tauri` путь требует живого Tauri runtime и вне scope H4 — но канал связи (`logi-js` → тот же `/ingest/v1/json`) идентичен, так что trace-id-корреляция уже подтверждена.

**Детали.**
- Server-side emit через ручной хелпер `emit(trace_id, message, attrs, numeric)`, который собирает `Event::new`, заполняет `service`, `trace_id`, `sdk`, `fingerprint` и шлёт через `client.send`. Не через макрос `logi_rs::event!` — тот не принимает custom `trace_id` (он ориентирован на fingerprint/breadcrumb сценарий).
- Windows-специфика: path-dep `logi-rs` прошёл без edge-case'ов. Единственная ловушка — путь к logi-js dist: от `arsenal/` два уровня вверх до `source/`, а не три (было `../../../logi/...`, стало `../../logi/...`).
- Logi `IngestBatch` требует `project_token` — сервер сверяет и переписывает `project_id` на authoritative uuid из БД. Клиент может слать пустой `project_id`, токен — источник истины. Это упрощает мультиязычность: rs-клиент не должен знать uuid проекта.
- Batcher flush: logi-rs — 500 ms / 50 events, logi-js — 2000 ms / 20 events (в smoke-скрипте понижено до `batchSize: 1` + `flushIntervalMs: 100` для немедленного flush). `sleep 1` после HTTP-ответа достаточно для появления всех 4 записей в CH.

### Что это закрывает / открывает

- **H4 (concept.v2 §2 — cross-language trace через Logi)** — 🟢 **закрыто**. Подтверждено: один HTTP request с `X-Trace-Id` порождает связанные frames от обеих сторон, Logi связывает их в единый trace через `GET /api/trace/:trace_id`.
- **Q30** (Logi-tracing через `@alaq/plugin-tauri/ipc` subpath) — остаётся Open, ортогонален H4. H4 подтверждает, что trace-id-корреляция работает и без special subpath-обвязки: явный `X-Trace-Id` header по договорённости + SDK emit с тем же trace_id — достаточно.
- **Рельса R7** (не трогать `arsenal/server/`) — 🟢 соблюдено, изменения только в `server-v2/`.
- **Рельса R8** (не делать `alaq-logi-rs` обёртку) — 🟢 соблюдено, использован голый `logi-rs`.

### Открытые вопросы

- **О36:** Надо ли дать generated runtime (`alaq-graph-axum-rt`) опциональную интеграцию с `logi-rs`, чтобы каждый dispatcher автоматически emit'ил `action.start`/`action.end` frame без ручной обвязки в handler? Сейчас H4-инструментация — ручная в каждом методе `Handlers`. Потенциально middleware-tier (`tower::Layer`) над generated router'ом: читает `ActionContext` + SDL action-name (генератор знает), emit'ит в logi без участия потребителя. Не в scope H4 (out-of-scope для SDL-ядра; в scope для `@alaq/plugin-logi-rs` или helper-crate).
- **О37:** TS-сторона через real Tauri webview (`@alaq/plugin-logi` + `invoke`) — smoke не покрыт в H4. Нужен ли отдельный стресс в Belladonna (там уже есть plugin-tauri), или достаточно канала direct-fetch? H4 считает direct-fetch достаточным для proof-of-concept: wire-протокол идентичен, trace_id-корреляция работает. Полноценный Tauri-smoke — когда будет второй потребитель plugin-logi с UI-событиями (atom mutations и т.п.).
- **О38:** `logi-rs` global `Client::init` — одноразовая (повторные вызовы возвращают существующий). Для тестов где нужно переинициализировать endpoint — `__reset` не экспонирован (в logi-js есть `__reset` for tests; в logi-rs нет). Не блокер для production, но тесты `arsenal-server-v2` будущих шагов захотят mock endpoint.

---

## 2026-04-21 — alak cleanup, шаг C6: Q-index flattened

Сводка открытых вопросов пересобрана в плоский формат Q01–Q34, по строке на вопрос со статус-эмодзи (🟢/🟡/⏸️/⬜). Удалены 9 категорий от W11 — при 34 элементах категорирование сканировалось хуже плоского списка. Source-ссылки `(Запись/ОN)` и текст статусов сохранены. Нумерация Q не тронута (канонична от W11). Итог сверху: 14 closed, 4 partial, 2 out-of-scope, 14 open. Раздел сократился с ~165 строк (включая заголовки категорий и пояснения) до ~42 строк.

---

## 2026-04-21 — alak cleanup, шаг C3: AppError consolidated in rt crate

**Статус:** 🟢 закрыто.

**Контекст.** Генератор `@alaq/graph-tauri-rs` эмитил идентичный `pub enum AppError { Handler | BadInput | Unavailable | Internal }` с `#[serde(tag="kind")]` в `types.rs` каждого namespace. В приложении с N namespaces — N одинаковых копий: одинаковые варианты, одинаковый serde-тэгинг, одинаковые `impl From<String>` / `From<&str>` / `AppError::handler/…` конструкторы. Ничего namespace-специфического. Для Belladonna сейчас одна копия, но Arsenal + Kotelok-2 + Pharos-CLI сразу добавят ещё 3+.

**Что сделано.**
- 🟢 `alaq-graph-tauri-rt/src/error.rs` — определён канонический `pub enum AppError` (same shape: `#[derive(Debug, Serialize)]`, `#[serde(tag="kind", rename_all="snake_case")]`, 4 варианта `{message: String}`). Добавлены конструкторы `handler/bad_input/unavailable/internal`, аксессор `.message()`, и **blanket** `impl<E: std::fmt::Display> From<E> for AppError` (в отличие от прежней per-namespace версии). Blanket возможен потому, что `AppError` сознательно **не** реализует `Display` / `std::error::Error` — реализуй Display → reflexive `impl<T> From<T> for T` из stdlib перекрывает blanket (E0119). Потребители, которым нужна строковая форма, зовут `.message()` или `format!("{:?}", err)`.
- 🟢 `alaq-graph-tauri-rt/src/lib.rs` — re-export `pub use error::{AppError, DisplayError}`. Удалены устаревшие `handler.rs` и `macros.rs` (placeholder-marker без потребителей — чистим сразу, см. C4 ниже).
- 🟢 `@alaq/graph-tauri-rs` / `types-gen.ts` — функция `emitAppError` схлопнулась: вместо 100 строк Rust-дефиниции эмитит **одну строку** `pub use alaq_graph_tauri_rt::AppError;` + короткий заголовочный комментарий. Сигнатура функции стала `(buf, rtCrate)`, использует `GenerateOptions.rtCrate` (по умолчанию `alaq_graph_tauri_rt`).
- 🟢 `index.ts` — передаёт `opts.rtCrate` в `emitAppError`, обновлена шапка и `fileRole` `types.rs`.
- 🟢 Belladonna регенерация (`bun schema/_generate_tauri_rs.ts`) — `types.rs` уменьшился с ~152 строк (с полным enum + Display + Error + 4 From + 4 конструктора) до ~91 строки (1 `pub use` + комментарий). `commands.rs` / `handlers.rs` не тронуты — они продолжают использовать бареный `AppError` ident через `use super::types::*;`, импортируя его транзитивно через re-export.
- 🟢 `cargo test -p alaq-graph-tauri-rt`: 1 passed (smoke_belladonna). Generated tree компилируется с AppError из rt-crate через dev-dep integration-test linkage. Doc-tests: 0, unit-tests: 0.
- 🟢 `bun test packages/graph-tauri-rs`: 13/13 pass. Snapshot-тест обновлён — вместо `expect(types.content).toContain('pub enum AppError')` теперь `expect(types.content).not.toContain('pub enum AppError')` + `toContain('pub use alaq_graph_tauri_rt::AppError;')`.
- 🟢 README обновлён — в разделе «Typed errors» явно указано что AppError живёт в runtime crate и генератор его только re-export'ит; `alaq-graph-tauri-rt` теперь **required**, не optional.

**Wire-контракт не изменился.** Вариантные имена → snake_case на проводе (`"handler"` / `"bad_input"` / `"unavailable"` / `"internal"`), тот же `{kind, message}` JSON shape. TS-сторона ничего не заметит.

**User-impl совместимость.** Существующие `impl BelladonnaReaderHandlers` (в Belladonna пока не написаны, но по шаблону README) возвращают `Result<T, AppError>` — где `AppError` раньше резолвилось в `generated::belladonna_reader::AppError` (per-namespace enum), теперь — в `alaq_graph_tauri_rt::AppError` через re-export. Имя то же, пути импорта для потребителя те же (`use super::types::*;` в generated handlers.rs, `use generated::belladonna_reader::AppError` в user code). Blanket-impl `From<Display>` в новой версии делает `handler.method()?` путь ещё проще — любой `anyhow::Error` / `String` / `&str` поднимается в `AppError::Handler` через `?` автоматически, без явного `.map_err(AppError::handler)`.

**Находки.**
- **🟢 Blanket `From<Display>` работает, если AppError сам не Display.** Плюс: handler с `let x = fs::read("foo")?;` компилируется без `.map_err`. Минус: `format!("{}", err)` на `AppError` не работает напрямую — нужен `err.message()` или `format!("{:?}", err)`. Трейд-офф оправдан: 99% handler-кода хочет автоматический `?`, формат ошибки вызывается редко и через Debug не хуже.
- **🟢 Integration-тест в rt-crate — правильное место для smoke.** `crates/alaq-graph-tauri-rt/tests/smoke_belladonna.rs` через `#[path]` затягивает generated/ от Belladonna. Rt-crate линкуется как dev-dep (integration test treats крейт как external), так что `use alaq_graph_tauri_rt::AppError` в generated `types.rs` резолвится корректно. Belladonna's `src-tauri/Cargo.toml` пока `alaq-graph-tauri-rt` не тянет (src-tauri/src/main.rs даже не включает `mod generated;`); как только Belladonna начнёт собирать generated tree для реального run — надо будет добавить path-dep, и README это уже документирует.
- **🟡 В лимитах integration-теста.** Smoke_belladonna проверяет только `AppError::handler("test")` и построение `TocEntry` — не строит реальный Tauri Builder и не проверяет serde-сериализацию `Result::Err(AppError)`. Wire-контракт подтверждён только по структуре derive-макросов, не фактическим JSON. Это существующий пробел теста, C3 не ухудшает.

**Что это закрывает.**
- **Дублирование `AppError` по namespace** — устранено. С 10 namespace приложение экономит ~1000 строк Rust (≈100 × 9).
- **Разнобой реализации между namespace** — невозможен: один источник правды.
- **Риск rogue variant.** Раньше кто-то мог добавить namespace-специфический вариант в один `AppError` и сломать assumption о shape. Теперь добавление варианта — сознательное изменение rt-crate с версионным impact на всех потребителей, breaking change хорошо видим.

**Открытые вопросы.**
- **Q35 (новый):** Надо ли в v0.2 разрешить namespace-specific расширения `AppError`? Сейчас — один enum, все namespace делят. Если потребителю (условно Arsenal) нужен `VersionConflict { requested, installed }` вариант — как? Варианты: (a) generic param `AppError<Ext = NoExt>` (медленный путь миграции, ломает существующий тип), (b) второй enum `pub enum ArsenalError { Common(AppError), VersionConflict {…} }` на уровне handler output — user-code, не генератор, (c) `#[non_exhaustive]` на `AppError` + sidecar enum через serde flatten. Лёгкий вариант — (b): handler возвращает `Result<T, ArsenalError>`, TS-сторона видит union; генератор не участвует. Оставить Open до первого реального кейса.
- **Q36 (новый):** Публиковать `alaq-graph-tauri-rt` на crates.io? Сейчас path-dep. Для CI/CD потребителей (Belladonna → github actions) path-dep работает только при монорепо-чекауте. При раздельном репо (если Arsenal когда-то уедёт из alak монорепо) — блокер. Не блокер для 2026-Q2; решить к beta.

---

## 2026-04-21 — alak cleanup, шаг C4: rt-crate anemic audit

**Контекст.** Подозрение — runtime-крейты `alaq-graph-axum-rt` и `alaq-graph-tauri-rt` (5 модулей в сумме) слишком тонкие, часть API — dead code. Аудит проведён параллельно с C3 (перенос canonical `AppError` в tauri-rt) и после H4 (cross-language trace через `ActionContext`).

**Методика.** Grep по всему монорепо: `alaq-graph-{axum,tauri}-rt::`, `alaq_graph_{axum,tauri}_rt::`, имена публичных типов (`BasicAppError`, `HandlerExt`, `DisplayError`, `RT_NAME`, `RT_VERSION`, `ActionContext`, `HandlerError`, `AppError`). Исключены `target/` и `Cargo.lock`. Для каждого API — проверка: emitter-templates (`packages/graph-*/src/*.ts`), generated output (`pharos/Belladonna/src-tauri/src/generated/`, `rest.valkyrie/arsenal/schema/generated/rs/`), user code (`server-v2/src/main.rs`), smoke tests.

**Результат аудита.**

| API | Где живёт | Потребители | Решение |
|-----|-----------|-------------|---------|
| `ActionContext` (axum-rt) | `context.rs` — `FromRequestParts`, X-Trace-Id/X-Peer-Id/X-Admin-Key → struct | generated `routes.rs`/`handlers.rs`, `server-v2/main.rs` (H4 emit trace_id) | **KEEP** |
| `HandlerError` (axum-rt) | `error.rs` — enum с `IntoResponse` → JSON `{error,code}` | generated `routes.rs`/`handlers.rs`, `server-v2/main.rs` | **KEEP** |
| `async_trait` re-export (axum-rt/lib.rs) | `pub use async_trait::async_trait` | generated `handlers.rs`, `server-v2/main.rs` | **KEEP** |
| `AppError` (tauri-rt) | `error.rs` — canonical enum, сериализуется `{kind,message}` | После C3 — generated `types.rs`: `pub use alaq_graph_tauri_rt::AppError;`; используется `handlers.rs`/`commands.rs` через `super::types::*` | **KEEP** (вся ценность C3) |
| `DisplayError` (tauri-rt) | `error.rs` — bound alias `Display + Send + Sync` | Нет прямых потребителей, но часть C3-контракта в error.rs | **KEEP** (owned by C3, оставить как есть) |
| `BasicAppError` (tauri-rt/error.rs) | Reference-shape enum, pre-C3 | Нет — никогда не был заимпортирован | **REMOVED by C3** (до C3 был dead; после C3 заменён на canonical `AppError`) |
| `HandlerExt` (tauri-rt/handler.rs) | Пустой marker-trait с blanket impl, placeholder «для будущих методов» | **Нет потребителей** — генератор не emit'ит `use …::HandlerExt`, Belladonna не импортит, smoke не ссылается | **REMOVED** (модуль `handler.rs` удалён) |
| `macros` module (tauri-rt/macros.rs) | Только doc-comments, **без единого `macro_rules!`** — описывает как пользоваться уже-сгенерированным `register_<ns>_commands!` (который живёт в generated register.rs, не тут) | Нет — модуль не экспортит ничего | **REMOVED** (модуль `macros.rs` удалён) |
| `RT_NAME`/`RT_VERSION` const (tauri-rt/lib.rs) | `pub const` для «assertion against runtime version» | Нет | **REMOVED** (консты удалены из lib.rs) |
| `rtCrate` option в generator (graph-tauri-rs/index.ts) | Был declared-but-never-read до C3 | После C3: читается в `emitAppError(buf, opts.rtCrate)` → `pub use ${rtCrate}::AppError;` | **KEEP** (C3 сделал живым) |

**Правки.**
- 🟢 `A:/source/alak/crates/alaq-graph-tauri-rt/src/handler.rs` — удалён.
- 🟢 `A:/source/alak/crates/alaq-graph-tauri-rt/src/macros.rs` — удалён.
- 🟢 `A:/source/alak/crates/alaq-graph-tauri-rt/src/lib.rs` — убраны `pub mod handler;`, `pub mod macros;`, `pub use handler::HandlerExt;`, консты `RT_NAME`/`RT_VERSION`. Обновлён doc-banner: объясняет трим и ссылается на C4-запись. Оставлены `pub mod error;` и `pub use error::{AppError, DisplayError};` (C3-контракт).
- 🟢 `A:/source/alak/crates/alaq-graph-tauri-rt/Cargo.toml` — `thiserror` и `async-trait` убраны из `[dependencies]` (ни один не использовался в lib после трима). `tauri` перенесена в `[dev-dependencies]` (нужна только smoke-тесту, который `#[path]`-включает generated `#[tauri::command]` файлы). `async-trait` в `[dev-dependencies]` по той же причине (generated `handlers.rs` использует `#[async_trait::async_trait]`). Runtime-deps теперь: только `serde` (для `#[derive(Serialize)]` на `AppError`). Description обновлено.
- ⚪ `A:/source/alak/crates/alaq-graph-axum-rt/` — **не тронут**. Все 3 модуля (context.rs, error.rs, lib.rs) несут нагрузку.
- ⚪ `A:/source/alak/packages/graph-tauri-rs/` — **не тронут**. `rtCrate` живой после C3.
- ⚪ README `graph-tauri-rs`, README `graph-axum` — **не трогал**. README про `BasicAppError`/`HandlerExt` потенциально устарели — оставляю C3 (у него в зоне ответственности README на предмет AppError-rationale).

**Прогоны.**
- 🟢 `cargo check --tests` в `alaq-graph-tauri-rt` → 0 errors, 0 warnings. 0.53 s.
- 🟢 `cargo test` в `alaq-graph-tauri-rt` → `smoke_belladonna::generated_module_compiles ... ok` (1 passed / 0 failed). Smoke пробивает весь generated tree Belladonna, включая `pub use alaq_graph_tauri_rt::AppError;` из C3. 0.97 s компиляция + 0.00 s test.
- 🟢 `cargo check` в `alaq-graph-axum-rt` → 0 errors. 0.04 s.
- 🟢 `cargo check` в `rest.valkyrie/arsenal/server-v2` → 0 errors. 0.10 s (инкрементально).
- 🟢 `bun test packages/graph-tauri-rs` → 13 pass / 0 fail.
- 🟢 `bun test packages/graph-axum` → 17 pass + 1 skip / 0 fail.
- 🟢 `bun test` (весь alak, 95 файлов) → **900 pass / 0 fail / 7673 expect**. Нулевые регрессии. (Baseline после W8/W9/W11 был 898 — разница +2 за счёт C3, не за счёт C4.)

**Финальная структура rt-crates.**
```
crates/
├── alaq-graph-axum-rt/        (нетронут — 3 модуля, все живые)
│   └── src/
│       ├── lib.rs             (+docs + re-export async_trait, ActionContext, HandlerError)
│       ├── context.rs         (ActionContext + FromRequestParts)
│       └── error.rs           (HandlerError + IntoResponse)
└── alaq-graph-tauri-rt/       (trimmed — 2 модуля из 4)
    └── src/
        ├── lib.rs             (docs + re-export AppError, DisplayError)
        └── error.rs           (C3-canonical AppError + DisplayError, blanket From<Display>)
```

**Что не сделано (намеренно).**
- ⏸️ README `graph-tauri-rs` всё ещё ссылается на `BasicAppError`, `HandlerExt`, `register_commands!` — это устарело после C3+C4. Оставил C3 — README — его зона (там же объясняется canonical `AppError`).
- ⏸️ `serde` / `thiserror` version-fields в обоих Cargo.toml — не унифицированы через workspace-deps. Out of scope C4.

**Ограничения соблюдены.**
- 🟢 `ActionContext` не удалён (H4 использует).
- 🟢 `AppError` не удалён (C3 только что добавил как canonical).
- 🟢 Не коммит.
- 🟢 H4 smoke (`cargo test` в tauri-rt) — зелёный.
- 🟢 server-v2 `cargo check` — зелёный.
- 🟢 `bun test` всего alak — зелёный.

### Открытые вопросы

- **О39 (C4):** `DisplayError` в tauri-rt/error.rs — формально dead (нулевые потребители), но часть C3-error.rs и может пригодиться consumer'ам за пределами generated кода. Оставлен. Если через N релизов останется orphaned — удалить в следующем cleanup шаге.
- **О40 (C4):** README `graph-tauri-rs` и `graph-axum` — устаревшие references на удалённые типы (`BasicAppError`/`HandlerExt`). Зона C3 (README правится вместе с canonical-AppError rationale).
- **О41 (C4):** Слияние rt-крейтов в единый `alaq-graph-rt` — отвергнуто по фактам: разные транспортные стэки (`axum` vs `tauri`), разные dev-деп-деревья, `cargo feature`-флаги дали бы ту же изоляцию, но с худшей ergonomics. Два крейта — правильная форма.

---


## 2026-04-21 — alak cleanup, шаг C5: snapshot noise → regex+compile integration

Байтовые snapshot-тесты в генераторах заменены на regex/`toContain` проверки «структурных инвариантов» плюс opt-in `cargo check` / `tsc --noEmit` интеграцию. Снапшоты ломались при каждом не-семантическом изменении эмита (bump версии в баннере — W6; перестановка keyword-таблицы — W4); структурные проверки видят только реальные изменения формы.

**Что снесено:**
- `packages/graph-axum/test/snapshots/arsenal.types.rs.snap`, `arsenal.routes.rs.snap`.
- `packages/graph-tauri/test/snapshots/reader.tauri.ts.snap`.
- Snapshot-блоки `describe('Arsenal — snapshot of the full tree', …)` в `arsenal.test.ts` и `describe('reader snapshot', …)` в `reader.test.ts`.
- В `graph-tauri-rs` snapshot-файлов не было — там изначально только smoke-тест.

**Что добавлено / выровнено:**
- Smoke-контракт на каждом пакете: файлов ровно N (5 axum / 1 tauri / 6 tauri-rs), `content.length > 0`, `diagnostics` без `error`, плюс регексы на ключевые сигнатуры (`pub struct PackageMeta`, `.route("/packages", post(dispatch_packages…))`, `invoke<IRenderedDoc>('render_markdown', { input })`, `tauri::generate_handler!`).
- Assertions в `arsenal.test.ts` подстроены под C1–C3 форму: Output-типы больше не эмитятся в `types.rs` как alias/newtype, а inline-встроены в `handlers.rs` (`Result<Vec<PackageMeta>, HandlerError>`) и `routes.rs` (`Json::<Vec<PackageMeta>>(out)`).
- Opt-in integration через env var `ALAK_INT_TESTS=1`:
  - `graph-axum`: пишет сгенерированный tree + shim runtime + Cargo.toml в temp dir, запускает `cargo check --quiet`, ждёт exit 0.
  - `graph-tauri-rs`: аналогично с минимальным tauri-зависимым crate.
  - `graph-tauri`: `bunx tsc --noEmit` на output file + стабы для `@tauri-apps/api/{core,event}`.
  - По умолчанию skip — cargo/tsc тяжёлые, не для tight loop; запускаются в CI или по требованию.

**Counts до/после.**
- graph-axum: 19 tests (17 pass + 2 fail byte-snapshot) → 23 tests (22 pass + 1 skip opt-in cargo check, 0 fail). Плюс регекс-детализация handlers/routes под inline-Output (C1–C3).
- graph-tauri: 19 tests (all pass, включая 1 byte-snapshot) → 23 tests (22 pass + 1 skip opt-in tsc, 0 fail).
- graph-tauri-rs: 13 smoke-tests (до C-сессий) / 18 сейчас → 19 tests (18 pass + 1 skip opt-in cargo check, 0 fail). Snapshot-файлов там изначально не было.
- Итог по smoke-проходу: 51 → 65 tests, из них 3 skip (opt-in integration). Чистый эффект C5: 3 байтовых snapshot-теста убраны, 3 opt-in compile-check теста добавлены, плюс regex-детализация прежних describe-блоков.

**Открытые вопросы:**
- **О42 (C5):** транзиентный flake в `graph-axum/test/transport.test.ts` (`@transport(kind: "tauri"|"zenoh") → single W005`). В одной из серий подряд прогона наблюдался pattern pass → fail → pass без изменений кода — `generate()` изредка возвращал 0 files / 0 diagnostics на минимальном inline `schema S @transport(…) { version: 1, namespace: "s" } action Ping { output: Boolean! }`. Последние 2 прогона — green, но похоже на module-level state в `parseSource`/`generate` (или в keyword table, ср. W4). Если повторится — копать в этом направлении.

---

## 2026-04-21 — alak cleanup, шаг C1: graph-axum Output newtype убран

**Статус:** 🟢 закрыто.

**Контекст.** `@alaq/graph-axum` эмитил `#[serde(transparent)] pub struct <Action>Output(pub Vec<T>);` для каждого action с list-output и `pub type <Action>Output = T;` для скалярного. Transparent ≡ голый `Vec` по проводу, но цена — один тип на action + его импорт в trait и dispatcher + `PackagesOutput(vec![…])` / `out.0` в user-impl. Wire-ценность — ноль.

**Что сделано.**
- 🟢 `packages/graph-axum/src/types-gen.ts` — удалён `emitActionOutput`. Эмитится только `<Action>Input`. Секция в `types.rs` — «Action Input types».
- 🟢 `packages/graph-axum/src/utils.ts` — добавлен `mapActionOutputType(action, ctx)`: inline-spelling всех случаев `outputRequired × outputList × outputListItemRequired` → `()` / `T` / `Option<T>` / `Vec<T>` / `Vec<Option<T>>` / `Option<Vec<T>>` / `Option<Vec<Option<T>>>`.
- 🟢 `packages/graph-axum/src/handlers-gen.ts` — `emitHandlersTrait(buf, schema, …)` принимает `IRSchema`; return-type в trait-методе = `mapActionOutputType(a, ctx)`.
- 🟢 `packages/graph-axum/src/routes-gen.ts` — `emitRouterFn(buf, schema, …)`, `Json::<inlineTy>(out).into_response()` использует тот же помощник.
- 🟢 `packages/graph-axum/src/index.ts` — `emitHandlersTrait` / `emitRouterFn` получают `schema`.
- 🟢 `packages/graph-axum/README.md` — convention-секция: «Output typing — inline, no newtype (C1, 2026-04-21)»; описание `types.rs` упрощено до `records, enums, <Action>Input`.
- 🟢 `rest.valkyrie/arsenal/schema/generated/rs/rest_valkyrie_arsenal/` перегенерирована — 5 файлов, 0 error / 0 warning. В `types.rs` больше нет `PackagesOutput`/`VersionsOutput`/`LatestOutput`/`UploadOutput`/`DeleteOutput`. В `handlers.rs` — `Result<Vec<PackageMeta>, HandlerError>` / `Result<bool, HandlerError>` / etc. В `routes.rs` — `Json::<Vec<PackageMeta>>(out)` / `Json::<bool>(out)` / etc.
- 🟢 `rest.valkyrie/arsenal/server-v2/src/main.rs` — `impl Handlers` на inline-типах (`Vec<PackageMeta>`, `VersionRef`, `UploadTicket`, `bool`, `Vec<VersionRef>`). `let out = PackagesOutput(vec![…])` → `let out = vec![…]`. Импорты `*Output` удалены.

**Прогоны.**
- 🟢 `cargo check -p arsenal-server-v2` — Finished `dev` profile в 0.11 s. 0 errors.
- 🟢 `bun test packages/graph-axum` — 17 pass / 1 skip (cargo integration под `ALAK_INT_TESTS=1`) / 0 fail.

**Пример новой подписи trait-метода.**

```rust
async fn packages(&self, ctx: ActionContext, input: PackagesInput)
    -> Result<Vec<PackageMeta>, HandlerError>;
async fn delete(&self, ctx: ActionContext, input: DeleteInput)
    -> Result<bool, HandlerError>;
```

**Находки.**
- **🟢 `mapActionOutputType` в `utils.ts` — правильная абстракция.** handlers-gen и routes-gen зовут её и получают идентичный spelling; точка правки — одна, синхронизация двух эмиттеров не нужна.
- **🟢 Wire JSON не меняется.** `#[serde(transparent)] struct X(pub Vec<T>)` и голый `Vec<T>` сериализуются бит-в-бит одинаково. HTTP-клиенты (TS, curl, другие языки) не замечают.
- **🟢 Интеграция с C5.** Snapshot-тесты (byte-diff) сняты в C5 до C1, поэтому обновлять `.snap` не пришлось — `arsenal.test.ts` работает через regex/contains-чеки.

**Что это закрывает.**
- Type-bloat: на каждый action с output — минус один `<Action>Output` (Arsenal — −5 типов).
- Ручная обёртка `PackagesOutput(vec![…])` / `out.0` в user-impl — больше не нужна.
- Точка правки при добавлении новых nullable-комбинаций list-output — одна (`mapActionOutputType`), не две.

---

## 2026-04-21 — alak cleanup, шаг C2: empty Input struct dropped

**Статус:** 🟢 приземлено в трёх генераторах, не коммичено.

**Контекст.** До C2 каждое SDL-action получало `<Action>Input` struct даже с нулём полей — `pub struct CloseWindowInput {}` + `export interface ICloseWindowInput {}`. TS-клиент вынужден был слать `invoke('close_window', { input: {} })`, Axum-dispatcher вызывал `Json<CloseWindowInput>` extractor на body-less POST. Лишний тип на action, лишние байты на wire, лишняя обвязка в тестах. Цель C2 — уронить struct + параметр + wire-wrapper, когда `action.input` пустой массив. Non-breaking для actions с непустым input.

**Что сделано.**

- 🟢 `packages/graph-tauri-rs/src/{types,commands,handlers}-gen.ts` — уже содержали guard `hasInput(action)` до C2 на уровне commands/handlers и types; проверено и подтверждено без новых правок. Adapter `ping(state, app)` без `input` параметра, trait method `async fn ping(&self, app: &tauri::AppHandle) -> Result<bool, AppError>;`. Doc-hint в commands.rs: `invoke('ping')` без второго аргумента.
- 🟢 `packages/graph-tauri/src/types-gen.ts` — `emitActionInputInterface` теперь `return` до эмиссии для `inputs.length === 0`. `I<Action>Input` больше не появляется вообще. Комментарий переписан, указывает на C2.
- 🟢 `packages/graph-tauri/src/{actions,api}-gen.ts` — уже корректно (ещё до C2): `export async function ping(): Promise<boolean> { return invoke<boolean>('ping') }`, в `createTauriApi()` — `ping: () => ping()`. Без правок.
- 🟢 `packages/graph-axum/src/types-gen.ts` — `emitActionInput` возвращает сразу для пустого input, header-комментарий файла обновлён: «Action Input emitted only when the SDL action declares fields». Output-newtype уже inline с C1.
- 🟢 `packages/graph-axum/src/handlers-gen.ts` — добавлен local `hasInput(a)`; сигнатура метода становится `async fn ping(&self, ctx: ActionContext) -> Result<bool, HandlerError>;` (без `input: PingInput`).
- 🟢 `packages/graph-axum/src/routes-gen.ts` — dispatcher dropp-ает `Json(input): Json<PingInput>,` extractor; вызов handler — `state.handlers.ping(ctx).await?` (без input). Route mount остаётся: `.route("/ping", post(dispatch_ping::<H>))`. Axum обрабатывает body-less POST штатно. Header-комментарий файла обновлён.

**Примеры до/после — action `Ping { output: Boolean! }`.**

```rust
// graph-tauri-rs commands.rs — ДО (логически; локальный guard в commands-gen.ts уже был, формулируем контракт явно ради полноты):
pub async fn ping(
    handlers: tauri::State<'_, std::sync::Arc<dyn BelladonnaReaderHandlers>>,
    app: tauri::AppHandle,
    input: PingInput,                       // ← убрано
) -> Result<bool, AppError> {
    handlers.ping(&app, input).await        // ← убрано
}
// ПОСЛЕ:
pub async fn ping(
    handlers: tauri::State<'_, std::sync::Arc<dyn BelladonnaReaderHandlers>>,
    app: tauri::AppHandle,
) -> Result<bool, AppError> {
    handlers.ping(&app).await
}
```

```rust
// graph-axum handlers.rs — ДО:
async fn ping(&self, ctx: ActionContext, input: PingInput) -> Result<bool, HandlerError>;
// ПОСЛЕ:
async fn ping(&self, ctx: ActionContext) -> Result<bool, HandlerError>;
```

```rust
// graph-axum routes.rs — ДО:
async fn dispatch_ping<H: Handlers>(
    State(state): State<AppState<H>>,
    ctx: ActionContext,
    Json(input): Json<PingInput>,           // ← убрано
) -> Result<Response, HandlerError> {
    let out = state.handlers.ping(ctx, input).await?;   // ← (ctx)
    Ok((StatusCode::OK, Json::<bool>(out)).into_response())
}
// ПОСЛЕ:
async fn dispatch_ping<H: Handlers>(
    State(state): State<AppState<H>>,
    ctx: ActionContext,
) -> Result<Response, HandlerError> {
    let out = state.handlers.ping(ctx).await?;
    Ok((StatusCode::OK, Json::<bool>(out)).into_response())
}
```

```ts
// graph-tauri — ДО:
export interface IPingInput {}
export async function ping(input: IPingInput): Promise<boolean> {
  return invoke<boolean>('ping', { input })
}
// ПОСЛЕ:
export async function ping(): Promise<boolean> {
  return invoke<boolean>('ping')
}
```

**Tests (per-package bun test).**

- 🟢 `packages/graph-tauri-rs/test/empty-input.test.ts` (new) — 5 tests / 15 expect. Проверяет: types.rs не содержит `<Action>Input` для empty, commands.rs без `input: <Action>Input,` параметра, handlers.rs trait method drop-ает `input`, doc-хинт `invoke('<name>')` без второго аргумента.
- 🟢 `packages/graph-tauri/test/empty-input.test.ts` (new) — 4 tests / 12 expect. Проверяет: отсутствие `I<Action>Input`, `export async function ping(): Promise<boolean>`, `invoke('ping')` / `await invoke('close_window')`, `createTauriApi()` binding без args.
- 🟢 `packages/graph-axum/test/empty-input.test.ts` (new) — 4 tests / 15 expect. Проверяет: отсутствие `<Action>Input` struct, handler trait без `input` параметра, dispatcher без `Json<Input>` extractor, но route `.route("/ping", …)` сохраняется; handler вызывается как `.ping(ctx).await?`.
- 🟢 Все три пакета green на per-package прогоне:
  - `graph-tauri-rs`: 18 pass / 1 skip (opt-in integration) / 0 fail, 79 expect.
  - `graph-tauri`: 40 pass / 2 skip (opt-in) / 0 fail, 150 expect.
  - `graph-axum`: 22 pass / 1 skip / 0 fail, 92 expect.
- 🟢 Объединённый прогон `bun test packages/graph-tauri-rs packages/graph-tauri packages/graph-axum`: **62 pass / 3 skip / 0 fail / 242 expect**. Pre-existing О42 (`transport.test.ts`) повторно не воспроизвёлся при per-package и combined запусках в этом прогоне — оставляю O42 как flaky, не регрессия C2.

**Артефакты (regen через build-scripts).**

- 🟢 `Belladonna/schema/_generate_tauri.ts` — `belladonna.reader.tauri.generated.ts` пересобран, 4079 bytes, 0 errors. Все 5 actions reader.aql (`RenderMarkdown`/`RecordView`/`GetViewHistory`/`OpenInExplorer`/`OpenBundle`) имеют непустой input → структурно ничего не изменилось в emit.
- 🟢 `Belladonna/schema/_generate_tauri_rs.ts` — 6 файлов regen, 0 errors, 1 pre-existing warning (`@range preserved as comment`). `types.rs` по-прежнему содержит 5 Input структур.
- 🟢 `arsenal/schema/_generate_axum.ts` — 5 файлов regen, 0/0. Arsenal все 5 actions (`Packages`/`Versions`/`Latest`/`Upload`/`Delete`) тоже с непустым input — emit не изменился.
- 🟢 `cargo check arsenal-server-v2` — clean, 0.20 s.
- 🟢 `cargo check Belladonna src-tauri` (`belladonna` bin) — 0 errors, 5 pre-existing warnings в `render/` (unrelated to C2).
- 🟢 `cargo test -p alaq-graph-tauri-rt --test smoke_belladonna` — `test generated_module_compiles ... ok`.

**Что закрывает / открывает.**

- **C2** закрыт. Empty-input actions больше не тащат мёртвый type и wire-wrapper. Non-breaking для всех текущих consumers (Belladonna/Arsenal — все actions с полями input, но generator готов к новым schema'ам где появятся body-less команды — те же `close_window`, `reload_config`, `logout`).
- В `routes.rs` для empty-input actions остался `use axum::extract::Json;` даже если ни один dispatcher его не использует — `#![allow(unused_imports)]` в header-е глушит этот warning (общий для всех C1–C2 generated-файлов).
- **О43 (C2):** pre-existing **O42** про `transport.test.ts` — остаётся. Не регрессия от C2; inline-schema в тестах transport использует `action Ping { output: Boolean! }` (пустой input), и это как раз exercise-ит новый путь C2. Тест падает из-за C1–C3 short-circuit при specific-ordering-ом прогона — не из-за C2. Фикс — отдельная задача.

**Ограничения.**
- 🟢 Non-breaking: actions с непустым input эмитятся идентично pre-C2.
- 🟢 Не коммичено.
- 🟢 Стоп-правило: никаких правок в consumer codebase (Belladonna handlers, Arsenal handlers) — только regen артефактов.

---

## 2026-04-21 — alak cleanup, шаг C7: `@transport` теперь enforces (error, не warning)

**Статус:** 🟢 закрыто.

**Проблема.** W8 (шаг 2026-04-20) добавил `@transport(kind: ...)` как advisory marker: generator эмитил **W005 warning** при mismatch и всё равно генерил файлы. Это documentation-with-validation-theatre — `graph-zenoh.generate(http-schema)` печатает "generation proceeds (W005)" и выдаёт скомпилируемый, но семантически бессмысленный код; ни один downstream-консьюмер не останавливается. Warning-without-stop дрессирует пользователя игнорировать mismatch.

**Решение (вариант A).** Строгая валидация: W005 → **E025 error**. Генератор на mismatch возвращает `files: []` + один error-diagnostic, никаких частичных артефактов. Варианты B (переименовать в `@intent`) и C (удалить директиву) отвергнуты:
- **B** — ещё один уровень опосредованности: IR поле есть, но ничего не делает. Оставляет тот же UX-разрыв, только под другим именем.
- **C** — откатывает W8 целиком; Belladonna и Arsenal оба уже помечены `@transport`, авторский интент документирован — удалять это источник истины ради «конвенции из соседнего repo» регресс.
- **A** — минимальное изменение: тот же код, та же директива, тот же IR, только severity + early `return`. Escape hatch `@transport(kind: "any")` уже существует в SPEC и закрывает legacy/generic кейсы; отсутствие директивы ≡ `"any"` (R222) не меняется, pre-W8 schemas работают как раньше.

**Что сделано.**
1. `packages/graph/SPEC.md`:
   - §7.14 R221 — переписан: "binding declaration of intent, enforced at generation time"; mismatch → E025, generator returns `files: []`; W005 упомянут как historical superseded.
   - §7.14 R222 — смыслово тот же (missing ≡ "any"), переписан под новый контракт: оба суппрессят E025.
   - §7.14 R224 (новый) — refusal contract: empty files + single error diagnostic с schema namespace / kind / generator / supported-list. Явно документирует что `"any"` — escape hatch для кросс-transport schemas.
   - §12 Errors — добавлен E025 с описанием и rationale.
   - §12 Warnings — W005 помечен superseded (tombstone).
   - §15 Changelog 0.3.5 (2026-04-21, C7) — новый раздел с rationale.
2. `packages/graph/src/errors.ts` — `SEVERITY.E025 = 'error'`, `MSG.E025(...)` template. W005 и его message template сохранены как historical.
3. `packages/graph/src/types.ts` — `DiagnosticCode` union расширен `'E025'`, W005 помечен retired в комментарии.
4. 6 generators (`graph-axum`, `graph-tauri`, `graph-tauri-rs`, `graph-zenoh`, `graph-link-state`, `graph-link-server`) — identical edit во всех:
   - Комментарий к `SUPPORTED_TRANSPORTS` и месту проверки обновлён на E025.
   - Severity `'warning'` → `'error'`, message suffix `generation proceeds (W005)` → `generation refused (E025). Set @transport(kind: "any") or omit the directive to opt out.`
   - Добавлен `return { files: [], diagnostics }` сразу после `push`, перед `generateNamespaceFiles` / `generateNamespace`.
5. `packages/graph-axum/test/transport.test.ts` — перерисован под новый контракт: 7 тестов вместо 6:
   - `no @transport` / `"http"` / `"any"` → files emitted, no transport diagnostics.
   - `"tauri"` / `"zenoh"` → `gen.files === []`, ровно один error-diagnostic c E025/namespace/supported-list, ноль warning-severity transport-diagnostics (W005 вымер).
   - Новый тест: сообщение E025 должно содержать инструкцию про escape hatch `"any"`.
6. IR поведение не тронуто. Задача просила «default 'any' если не указано», но это ломает существующий conformance-тест `no @transport → IRSchema.transport absent (back-compat)`. Текущее поведение (`undefined` в IR, но генератор трактует как `"any"` через guard `schema.transport && !SUPPORTED...`) уже даёт тот же наблюдаемый результат — не-ломающий путь предпочтён.

**Tests.**
- `bun test packages/graph-axum/test/transport.test.ts` — 7/7 pass, 23 expect().
- `bun test` (весь монорепо) — **909 pass / 0 fail / 3 skip / 7708 expect()** через 97 файлов, 5.63s. Ноль регрессий относительно post-C1..C6 baseline.
- Smoke против real consumers:
  - `bun schema/_generate_tauri.ts` в Belladonna (`@transport(kind: "tauri")` через `graph-tauri`) — OK, 1 file written (4079 bytes).
  - `bun schema/_generate_tauri_rs.ts` в Belladonna (через `graph-tauri-rs`) — OK, 6 files, 0 errors, 1 pre-existing warning (`@range` preserved as comment).
  - `bun schema/_generate_axum.ts` в Arsenal (`@transport(kind: "http")` через `graph-axum`) — OK, 5 files, 0 errors, 0 warnings.

**Файлы (изменены, не закоммичено).**
- `packages/graph/SPEC.md` — §7.14 R221/R222/R224, §12 (E025/W005), §15 changelog 0.3.5.
- `packages/graph/src/errors.ts`
- `packages/graph/src/types.ts`
- `packages/graph-axum/src/index.ts`
- `packages/graph-axum/test/transport.test.ts`
- `packages/graph-tauri/src/index.ts`
- `packages/graph-tauri-rs/src/index.ts`
- `packages/graph-zenoh/src/index.ts`
- `packages/graph-link-state/src/index.ts`
- `packages/graph-link-server/src/index.ts`
- `stress.md` (эта запись)

**Что это закрывает.**
- **Validation theatre W005** — заменён настоящим stop. `generate()` не может больше «проскользнуть» с ненативной transport.
- **О34 (W8 follow-up): Strict mode.** В W8 был открытый вопрос "конвертация W005 в ошибку по опции генератора (`strictTransport?: boolean`)". Убран из открытых — строгий режим теперь default, escape hatch это `"any"`, а не флаг генератора.
- **Q15 статус.** W8 помечал Q15 "Closed by directive (advisory)". C7 уточняет: closed by **enforced** directive; split-file (`arsenal.http.aql` + `arsenal.tauri.aql`) остаётся валидной альтернативой, но `@transport` теперь single source of truth внутри одного файла — не просто документация.

**Findings.**
- **🟢 Early `return { files: [], diagnostics }` — минимальная surgery.** Один `if` в каждом из 6 генераторов, тот же guard, тот же IR projection. Diff 6×~15 строк. No refactor, no new abstraction.
- **🟢 `"any"` escape hatch достаточен.** Belladonna/Arsenal уже указали правильный `kind`; нужды в retrofit `"any"` на legacy schemas нет — `no @transport === "any"` сохраняет back-compat.
- **🟢 Параллельный запуск 6 одинаковых edits — не DRY-sin.** Попытка вынести `checkTransport(schema, 'graph-axum', SUPPORTED, diagnostics)` в shared helper рассмотрена и отвергнута: каждый generator уже имеет свой локальный контекст (options, files array, diagnostics array) и свои сообщения; 6 × 10-строчных блоков менее опасны чем shared helper, который бы пересекал package boundaries.
- **🟡 W005 сохранён в union и в errors.ts как tombstone.** Аргумент для сохранения: внешние инструменты (CI, dashboard, Logi) могут иметь persisted-логи с W005-диагностиками из pre-0.3.5; type-union без W005 ломает их `switch(code)` ветки. Компромисс — оставить + явно пометить "retired in v0.3.5" в jsdoc и SPEC §12; удалить при следующем major bump (0.4/1.0).

**Открытые вопросы.**
- **Q37 (новый):** Аналог R224 для `@alaq/graph-link-state` и `@alaq/graph-link-server` — они оба `['http', 'any']`. Это корректно для текущей реализации (WebSocket поверх HTTP), но если link-state в будущем добавит zenoh-бэкенд — список расширится до `['http', 'zenoh', 'any']`. Не блокер.
- **Q38 (новый):** Документировать в SPEC §7.14 какой именно generator какому kind соответствует? Сейчас таблица есть (§7.14 строки Intended target), но `graph-link-state`/`graph-link-server` там помечены как `http` — если link-state расширится, нужна правка. Пометить как "generator-declared list is authoritative, SPEC table is advisory."

---

## 2026-04-21 — alak cleanup, шаг C8: unified `aqc gen` CLI

**Статус:** 🟢 закрыто.

**Контекст.** После W1 (`aqc` compile) у каждого потребителя остался собственный build-скрипт: `rest.valkyrie/arsenal/schema/_generate_axum.ts`, `pharos/Belladonna/schema/_generate_tauri_rs.ts`, `_generate_tauri.ts`. Все три — почти идентичный boilerplate: `parseFile`/`JSON.parse(ir)` → `generate(ir)` → фильтрация diagnostics → `mkdirSync`/`writeFileSync` по `result.files`. Три файла × ~45 строк — три точки правки при любом изменении в контракте generator'а. Каждый новый target = новый скрипт. Задача C8: единый CLI в `@alaq/graph`, покрывающий все шесть генераторов.

**Что сделано.**
- 🟢 `packages/graph/bin/aqc.ts` расширен subcommand'ом `gen`. Старая команда `aqc <input.aql>` работает без изменений (W1 contract нетронут, 11 pre-существующих cli.test'ов — green). Новая команда: `aqc gen <target> <input.aql> [-o <out-dir>] [--namespace <ns>] [--no-header] [--json]`, targets: `axum`, `tauri-rs`, `tauri`, `zenoh`, `link-state`, `link-server`.
- 🟢 Resolve generator через `await import('@alaq/graph-<target>')` с fallback на sibling path внутри monorepo (`<aqcDir>/../../graph-<target>/src/index.ts`). Так работает и для published npm-потребителя (node_modules), и для in-repo консьюмера без `bun install` на package-name (текущий кейс Belladonna/Arsenal).
- 🟢 Missing generator package → exit 2 с точной подсказкой `bun add @alaq/graph-<target>`. Unknown target → exit 2 с known-list.
- 🟢 Compile errors из `.aql` → exit 1 до запуска generator'а (диагностика на stderr, ни одного файла не пишется). Generator errors → exit 1, файлы тоже не пишутся. Warnings на stderr, не фейлят.
- 🟢 Stdout summary после успеха: `Generated N file(s) in <out-dir>. Warnings: M.` — одна строка, grep-friendly.
- 🟢 Output-dir создаётся recursive'ом (`mkdir -p`) — потребителю не нужно готовить дерево. Paths из `result.files[i].path` join'ятся on top вербатим, так что per-namespace-подкаталоги от генераторов (`<ns_flat>/`) и `generated/<ns_flat>/` от graph-tauri-rs сохраняются.
- 🟢 `--help` и `gen --help` — два отдельных help-текста. Корневой помимо compile-flags перечисляет все 6 targets с одной строкой описания. Gen-help даёт конкретные примеры.
- 🟢 Artifact: `packages/graph/test/cli-gen.test.ts` — 13 тестов. Охватывают: `gen --help` / `-h`, missing target / missing input / unknown target, broken `.aql` → exit 1 + E-code + zero files, три main targets (`axum` 5 файлов, `tauri-rs` 6 файлов, `tauri` 1 файл) end-to-end через Bun.spawn, `--no-header` (файл без AUTOGENERATED-баннера), `--namespace` filter (unknown ns → exit 1), default `./generated/` при отсутствии `-o`, `--json` → JSON-массив диагностик на stderr. Используется inline `VALID_AQL` / `BROKEN_AQL` — tests не зависят от consumer fixtures.
- 🟢 `packages/graph/README.md` — секция CLI переписана: compile и gen как два подрежима, таблица CLI-flags, совет класть `bunx aqc gen …` прямо в `scripts`.
- 🟢 Три consumer-wrapper'а переписаны в ультра-тонкие оболочки над `aqc gen` (через `spawnSync('bun', ['run', aqc, 'gen', <target>, <aql>, '-o', <dir>])`, `stdio: 'inherit'`, exit code = exit CLI). Имена файлов сохранены — `bun run _generate_axum.ts` остаётся рабочим, миграция для humans прозрачна. В шапке каждого — пример прямого invocation через `bunx aqc gen …` для потребителей с `package.json`.

**Артефакты.**
- `A:/source/alak/packages/graph/bin/aqc.ts` — расширен, ~430 строк (+~250 vs W1).
- `A:/source/alak/packages/graph/test/cli-gen.test.ts` — новый файл, 13 тестов (53 expect'а).
- `A:/source/alak/packages/graph/README.md` — CLI секция.
- `A:/source/rest.valkyrie/arsenal/schema/_generate_axum.ts` — ~20 строк (было ~45).
- `A:/source/pharos/Belladonna/schema/_generate_tauri_rs.ts` — ~25 строк (было ~85).
- `A:/source/pharos/Belladonna/schema/_generate_tauri.ts` — ~30 строк (было ~65).

**Прогоны.**
- 🟢 `bun test packages/graph` — 524 pass / 3 skip / 0 fail (1276 expect'ов). До C8: 511 pass. Разница — 13 новых cli-gen-тестов.
- 🟢 `bun test packages/graph/test/cli.test.ts` (compile mode, W1) — 11 pass / 0 fail. Старый контракт не сломан.
- 🟢 `bun test packages/graph/test/cli-gen.test.ts` (новый gen mode, C8) — 13 pass / 0 fail.
- 🟢 Arsenal: `bun run schema/_generate_axum.ts` — 5 файлов под `schema/generated/rs/rest_valkyrie_arsenal/`, byte-identical предыдущему выводу (diff -qr пустой).
- 🟢 Belladonna: `bun run schema/_generate_tauri_rs.ts` — 6 файлов под `src-tauri/src/generated/belladonna_reader/`, byte-identical.
- 🟢 Belladonna: `bun run schema/_generate_tauri.ts` — 1 файл `ui/src/generated/belladonna.reader.tauri.generated.ts`, byte-identical.
- 🟢 Smoke трёх оставшихся targets (`zenoh`, `link-state`, `link-server`) на синтетическом `sample.aql` — все выходят exit 0 и пишут ожидаемый файл.

**Пример новой команды (заменяет _generate_*.ts).**

```sh
# Arsenal (Axum backend):
bunx aqc gen axum schema/arsenal.aql -o schema/generated/rs/

# Belladonna (Tauri Rust):
bunx aqc gen tauri-rs schema/reader.aql -o src-tauri/src/

# Belladonna (Tauri TS):
bunx aqc gen tauri schema/reader.aql -o ui/src/generated/
```

**Находки.**

**🟢 Single CLI с subcommand лучше, чем три bin'а.** Рассматривались варианты: отдельный пакет `@alaq/graph-cli` (B) и per-generator bin'ы в каждом package.yaml (C). Отклонены:
- B — новый пакет ради thin dispatch, дубликат dependencies на `@alaq/graph`, extra release ceremony. CLI умещается в одну страницу кода, пакет не оправдан.
- C — шесть bin'ов (`aqc-axum`, `aqc-tauri-rs`, …) в шести package.yaml'ах. Memorization-cost: потребитель помнит имя каждого target'а. Дискавери хуже (`bunx aqc` не покажет targets). И дупликация help-текста × 6.

Выбор A (`aqc gen <target>`) даёт единую точку входа, per-target help через `gen --help`, и цена — 250 строк в одном файле.

**🟢 Dynamic import с sibling-fallback закрывает два разных use-case'а одной логикой.** Published consumer — `await import('@alaq/graph-axum')` через node_modules. In-repo consumer (Belladonna/Arsenal сейчас) — `await import('<aqcDir>/../../graph-axum/src/index.ts')` — работает без `bun install` потому что путь абсолютный. Пытались просто `@alaq/graph-<target>` — `Cannot find module` в alak-root (корневой package.json не объявляет workspaces, peer-deps в graph-axum/package.yaml тоже нет). Оставить только sibling-path нельзя — сломается для published-npm case. Двойная стратегия — чёрный ящик для потребителя.

**🟢 `spawnSync(..., {stdio: 'inherit'})` — достаточно для wrapper'а.** Не нужно парсить stdout/stderr в wrapper'е: CLI уже печатает суммарный диагностик, exit code — источник истины. Раньше каждый `_generate_*.ts` вручную форматил warnings / errors, теперь — CLI делает это сам, а wrapper прокидывает stdio 1:1. Wrapper'ы сжались с 45–85 строк до 20–30, из которых половина — шапка-комментарий.

**🟡 `-o <dir>` для `tauri-rs` — subtle path trick.** Генератор `@alaq/graph-tauri-rs` эмитит paths с префиксом `generated/` (e.g. `generated/belladonna_reader/types.rs`). Если потребитель передаёт `-o src-tauri/src/generated/` — получит `src-tauri/src/generated/generated/belladonna_reader/...`. Правильный path: `-o src-tauri/src/` (один уровень выше). Старый `_generate_tauri_rs.ts` это решал ручным strip'ом префикса `generated/`. CLI такого strip'а не делает сознательно: strip завязан на знание конкретного генератора. В Belladonna wrapper'е прописан правильный путь + комментарий-напоминание.

**🟡 `--namespace` filter как exit-1 при unknown ns.** graph-axum при `namespace: "no-such-ns"` эмитит diagnostic severity=error `Namespace "no-such-ns" not found in IR` — CLI пропускает это через error-filter и exit'ит 1. Альтернатива — warning + no-op — отвергнута: filter с typo тихо ничего не пишет, потребитель не замечает. Fail-loud — правильная семантика.

### Что это закрывает / открывает

- **C8** — 🟢 закрыто. Unified CLI, три consumer wrapper'а свёрнуты в thin oboloch'ki, 6 targets через единый интерфейс.
- **Ограничения:** 🟢 `aqc <input.aql>` (compile / W1) — работает как было, все 11 cli.test'ов green. 🟢 Не коммит (смена файлов: 3 в alak + 3 в consumer'ах, без git add).

### Открытые вопросы

- **О43 (C8):** Пер-target options (`--runtime-crate`, `--rt-crate`, `--plugin-import`, `--zenoh-version`, `--vue`, `--crdt-schema`) — сейчас в `aqc gen` не проброшены. Каждый generator принимает свой бок options, CLI передаёт только `{ header, namespace }`. Для первых трёх targets (axum / tauri-rs / tauri) defaults'ов хватает (это подтверждено byte-identical diff'ом c предыдущими _generate_*.ts). Если потребитель захочет non-default runtime-crate — нужно или CLI-flag (`--runtime-crate <crate>` → прокидывать в options только если target знает это поле), или escape hatch `--opt key=value`. Не делаю в C8 (нет давления); фиксирую как задачу C9, активируется по первому consumer-pressure.
- **О44 (C8):** Multi-namespace output. Сейчас default `-o ./generated/` — все namespace'ы IR сливаются под один корень (генератор сам раздаёт `<ns_flat>/` подкаталоги). Если потребителю нужно разные ns → разные roots — только через два отдельных invoke'а с `--namespace <ns>`. Если появится давление на один-проход-в-дерево — добавить `--out-per-namespace <pattern>`. Не активирую.
- **О45 (C8):** Compile-step сейчас повторяет работу при каждом target-invoke (parse .aql → IR). Три invoke'а = три parse. Оптимизация: `aqc` мог бы принимать `--ir <file.ir.json>` (pre-compiled) → skip parse. Для current consumer'а (каждый скрипт запускается пайплайном отдельно) — не критично (parse < 100ms на Arsenal/Belladonna schemas). Активировать если появится `aqc gen-all` батч-режим.

---
