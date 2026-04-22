# Stress-test wave 1 — summary (2026-04-20)

## TL;DR

Два потребителя (**Belladonna** и **Arsenal v2**) за один день прогнали по ~4 шага каждый через `@alaq/graph` SPEC v0.3 и смежные генераторы. Всего ~8 шагов + 1 baseline-замер. SPEC v0.3 удерживает **~80% реальной нагрузки** без расширений; остальное — конвенции генераторов и минорные аддитивные правки IR. Зафиксировано **5 🔴-блокеров** (один уже закрыт) и **~10 🟡-warnings**. Три темы пересеклись у обоих потребителей: **transport-маркер на schema**, **event-семантика**, **auth-scope вне SDL**. Главный успех волны — аддитивный IR-фикс `outputList`/`outputListItemRequired` приземлился в `@alaq/graph` между C.0 и A.1 того же дня и кросс-потребительски подтверждён Belladonna шагом 3.

## Что стрессили

Через компилятор прошли **два независимых продуктовых контура**. **Belladonna** (Tauri-ридер .md из `pharos/Belladonna`) описал Reader IPC в `reader.aql` — 5 Tauri Commands + 3 record-типа, затем расширил до `BundleManifest` с `Map<String, String>` и отдельно стрессил enum + `extend record` + `@deprecated`/`@added` на экспериментальном `reader-stress3.aql`. Параллельно замерил baseline холодного старта Tauri/WebView2 (не про SDL, но критично для всех Tauri-потребителей). **Arsenal v2** (`rest.valkyrie/arsenal`) раскатал серверный read-контур (`PackageMeta`, `VersionRef`, actions `Packages`/`Versions`), потом read+admin (`Latest`, `Upload`, `Delete` + `UploadTicket`), параллельно — архитектурные разведки скелетов `graph-axum` (HTTP target), `graph-tauri-rs` (Rust IPC) и `graph-tauri` (TS IPC), включая согласование invoke-контракта (snake_case, `{ input: ... }` envelope, trait-based handlers, typed `AppError`).

## Зелёное (что точно работает)

- **Actions без `output` как fire-and-forget** — Belladonna шаг 1 (`RecordView`, `OpenInExplorer`), Arsenal A.0 подтвердил для unified read/write.
- **`@default(value: ...)` + `@range(min, max)` на action input field** — Belladonna шаг 1 (`GetViewHistory.limit: Int! @default(value: 20) @range(min: 1, max: 500)`), обе директивы в IR.
- **`Map<String, String>!` на record field** — Belladonna шаг 2, IR корректно разворачивает `map: true` + `mapKey`/`mapValue` как `TypeRef` (§4.8 + §10).
- **Optional field без `!` в record и action input** — Belladonna шаг 2 (`context: String`), симметрично между двумя позициями.
- **`enum { A, B, C, D, E }` как тип поля + `@default(value: BARE_IDENT)`** — Belladonna шаг 3, R003 (comma-separated без trailing), R041 (enum default value), E012 (negative-case на не-член enum).
- **`extend record X { ... }` — flat-concat в IR, duplicate-детект через E010, missing-base через E011** — Belladonna шаг 3 (§13.6, §13.7).
- **`@deprecated(since, reason)` и `@added(in)` попадают в `Field.directives` штатно; E002 ловит unknown-args** — Belladonna шаг 3.
- **Keyword-коллизии обходятся переименованием, стабильно end-to-end** — Arsenal A.0 (`version → semver`), подтверждено в A.1 для input-arg-names.
- **Actions без `scope` и без директив — валидный путь для admin-mutations** — Arsenal A.1 (`Upload`/`Delete` принимаются парсером без оговорок; auth снаружи SDL).
- **IR-фикс аддитивный; `graph-zenoh`/`graph-link-server` не ломаются** — Arsenal P.0 (новые поля optional, старые потребители игнорируют).

## Что закрыли за эту волну

- **О10 закрыт (IR output list-shape).** Между Arsenal C.0 и Arsenal A.1 того же дня в `@alaq/graph` приземлилась аддитивная правка: `action.output` теперь несёт `outputList: boolean` + `outputListItemRequired: boolean` (v0.3.1 additive, `packages/graph/src/ir.ts:243–244`, `IRAction` в `types.ts`, §10 SPEC). Arsenal шаг P.0 формально зафиксировал правку (375/376 тестов прошли, единственный фэйл — pre-existing lexer/comments). Кросс-потребительски подтверждено Belladonna шагом 3: `action GetViewHistory → [ViewHistoryEntry!]!` даёт `outputList:true, outputListItemRequired:true` в IR. **Blocker для `graph-axum` E.0 и `graph-tauri-rs` снят.**
- **Уточнение к концепту Arsenal v2 §4:** `@scope(name: "...")` как директива на action — **невалидный синтаксис**; правильно — `scope: "..."` поле в ActionBody. Не фикс SPEC, а фикс потребительского непонимания (Arsenal C.0). Частично дезактивирует О7 по форме, не по сути.

## Найденные 🔴 blocker'ы

- **keyword collision** (`version`, `scope`, `namespace`, `input`, `output`, `qos`, `max_size`) — Arsenal A.0. Обход: переименовать поля. Предложение: contextual keywords в парсере **или** явный список reserved-names в SPEC §2 (дешевле, 80% боли).
- **Нет разделения query/mutation — унифицированный `action`** — Arsenal A.0. По PHILOSOPHY §1 корректно, но разрыв между языком обсуждения (GQL) и языком SPEC; генератор `graph-axum` вынужден GET/POST через конвенцию-by-name. Предложение: упомянуть в SPEC §5 или PHILOSOPHY §1.
- **`@scope` на RECORD одномерен, H5 подтверждена** — Arsenal A.0. Arsenal давит по трём осям (channel × admin × local). SPEC v0.3 описывает только name-scope (§7.5). Рекомендация: **auth вне SDL** (сам Arsenal принял), multi-axis не расширять.
- **Events не first-class** — Arsenal A.0 (`download_progress` не выразим), Arsenal C.1 конкретизировал. SPEC §2 EBNF не знает `event`. Ближайшие варианты (`opaque stream`, action) теряют типизацию/broadcast-семантику.
- **IR теряет `list`-признак на `action.output`** — Arsenal C.0. **ЗАКРЫТ** аддитивным фиксом (см. выше).
- **IR выбрасывает leading-comments** (R001, парсер в `@alaq/graph`) — Arsenal C.1. Без сохранения комментариев в `IRRecord.leadingComments?` / `IRAction.leadingComments?` маркеры вида `# @event: Name` не видны генератору; единственный альтернативный путь — own-reparse, нарушающий R300. Предложение: ~15 строк в `ir.ts` + §10.

## Кристаллизовавшиеся темы (пересечения)

### 1. Transport-маркер на schema

**Где всплыло:** Belladonna 🟡 шаг 1 ("local-only Tauri IPC не выражен в SDL"), Belladonna 🟡 шаг 2 (повтор на record-уровне), Arsenal 🟡 C.1/C.2 (та же дыра, но уже с решением "два файла per transport"). Третий независимый случай в C.2 превратил наблюдение в сигнал.

**Варианты:**
- `@local` / `@transport(tauri)` директива уровня schema (формальный маркер, compiler может остановить применение Zenoh-генератора к локальной schema);
- нормативное правило "actions без scope и без `@sync` — local-IPC по умолчанию, Tier-2 генератор требует явного `@remote`";
- **соглашение файл-per-transport** (решение Arsenal C.2): `arsenal.http.aql` + `arsenal.tauri.aql` раздельно, build-config зовёт правильный генератор. Без изменений в SPEC.

**Рекомендация:** начать с соглашения файл-per-transport (ноль SPEC-изменений, Arsenal уже принял). `@local`/`@transport` рассмотреть post-GA если появится третий класс потребителей, для которых раздельные файлы неудобны. **Блокирует однозначность генераторов** — до разрешения компилятор не может защитить от ошибочного применения `graph-zenoh`.

### 2. Event-семантика

**Где всплыло:** Arsenal 🔴 C.1 (`download_progress` 10–60 ev/s не выразим типизированно), Arsenal 🟡 C.1 (streaming через Tauri Channel — тоже нужен маркер). Belladonna пока не уперлась, но упрётся когда F1-hotkey будет broadcast'ить "reader ready" другим окнам.

**Варианты:**
- (α) first-class `event Name { ... }` в SPEC §2 EBNF — breaking expansion;
- (β) **leading-comments в IR → маркер `# @event: Name` / `# @stream: ChunkType`** — аддитивно, ~15 строк в `ir.ts`. Один фикс закрывает два маркера (event 1:N + stream 1:1).

**Рекомендация:** (β) сейчас, (α) — post-GA если конвенция маркеров окажется шумной. **Закрывает два genertor gap одним фиксом** (`graph-tauri-rs`/`graph-tauri`).

### 3. Auth-scope вне SDL

**Где всплыло:** Arsenal 🔴 A.0 (admin-mutations не выражаются через `@scope`, H5 про три оси подтверждена), Arsenal A.1 (`Upload`/`Delete` как actions без scope — валидно, auth через middleware). Belladonna не упиралась (Reader — одноконтурный).

**Варианты:**
- расширить `@scope` до multi-axis (`@scope(channels, admin)` вектор) — философски тяжело;
- **явно зафиксировать "authorization вне SDL; scope только для reactive slicing"** — честнее, дешевле, Arsenal уже принял решение на практике.

**Рекомендация:** второе. Зафиксировать в PHILOSOPHY §1 (или §5) явно: "transport, auth, events могут жить вне SDL — в конфиге генератора". Снимает сразу три 🟡: О7, transport-маркер, event-маркер (все они — одно и то же по духу).

## Методологические находки (не про SPEC)

**Tauri/WebView2 cold-start = 2.2–2.3 сек** на AMD Ryzen 9 9950X / 96 GB / Windows 11 Pro Insider / WebView2 Evergreen (Belladonna baseline, 2026-04-20). HWND за 37 мс, но "время до глифа" в интервале [37, 2300] мс, скорее к верхней границе. RAM-дерево (belladonna + 6 msedgewebview2-children) ≈ 312 MB. Это **архитектурный потолок Tauri**, не баг и не проблема `@alaq/*` стека.

**Следствие для всех Tauri-потребителей alak** (Belladonna, Arsenal v2 client, Kladinets, Valkyrie): KPI "окно за <200 мс" на холодный запуск — **недостижим без pre-warm резидента или нативного шелла**. Рекомендация: рассмотреть отдельный пакет `@alaq/plugin-tauri-prewarm` (создание hidden window заранее, отдача следующим F1-вызовам) — паттерн достаточно общий для всех low-latency Tauri-продуктов. Замер фиксирован в `pharos/Belladonna/docs/speed-baseline.md`.

## Все открытые вопросы (индекс О1–О20)

| №    | Формулировка                                                      | Статус    |
|------|-------------------------------------------------------------------|-----------|
| О1   | `@local` / `@transport` vs "actions без scope = local по умолч."  | открыт    |
| О2   | UI-команды окна (Close/Min/Max) в SDL или вне                     | закрыт соглашением (вне SDL) |
| О3   | `aqc` CLI — в `@alaq/graph` или `@alaq/graph-cli`                 | открыт    |
| О4   | `Map<K, V>` семантика `!` на K/V                                  | открыт    |
| О5   | Нормативный комментарий-шапка `# Local-only schema`               | открыт (parking до О1) |
| О6   | Contextual keywords vs явный reserved-list в SPEC                 | открыт    |
| О7   | Auth через `@scope` или вне SDL                                   | решено практикой (вне SDL), нужно зафиксировать в PHILOSOPHY |
| О8   | `event Name { ... }` first-class vs маркер-коммент                | открыт (рекомендация: (β) leading-comments) |
| О9   | Target-specific директивы (`@http`/`@tauri`/`@zenoh`) closed/open | открыт    |
| О10  | IR расширение `action.output` list-shape                          | **закрыт** (P.0, аддитивно) |
| О11  | Разрезка Rust-output: 5 файлов vs 1 — конвенция cargo             | открыт (технический) |
| О12  | Синтаксис маркера: `# @event: name` vs `# @event(name)` vs `#[event]` | открыт (до приземления leading-comments) |
| О13  | Output shape (количество файлов) — конвенция или решение генератора | открыт    |
| О14  | `graph-axum` отличает admin от client actions — как               | открыт (соглашение + config) |
| О15  | `@dto` / `@transient` маркер для short-lived response-records     | открыт (parking) |
| О16  | Pre-warm WebView2 между окнами Belladonna — даёт ли реальный <200 мс | открыт (требует эксперимента) |
| О17  | `@alaq/plugin-tauri-prewarm` — отдельный пакет?                   | открыт    |
| О18  | Enum literal в `Directive.args` — тег или резолв по типу поля     | открыт    |
| О19  | Required-args директив не enforces (дыра между SPEC §7.11/12 и валидатором) | открыт |
| О20  | `extend record` в IR — flat concat или `field.sourceDecl`         | parking   |

## Что дальше

**Приоритет 1 — аддитивные IR-фиксы (дёшево, разблокирует)**. Leading-comments в IR (`IRRecord.leadingComments?` / `IRAction.leadingComments?`) — ~15 строк в `packages/graph/src/ir.ts` + обновление SPEC §10. Закрывает О8 (event-маркер) и 🟡 streams одним фиксом; разблокирует полноту `graph-tauri-rs` / `graph-tauri`. Шаблон уже отработан на P.0.

**Приоритет 2 — синхронизация SPEC с импл**. (а) `outputList`/`outputListItemRequired` в SPEC §10 JSON-схему Action (парсер уже эмитит, SPEC отстаёт). (б) Глава "reserved names" в SPEC §2 — полный список keyword'ов лексера (`version`, `scope`, `namespace`, `input`, `output`, `qos`, `max_size`). Дешёвый unlock О6. (в) Уточнение §4.8 — семантика `!` на K/V в `Map<K, V>` (О4). (г) Required-args enforcement для директив (§7.11/§7.12 обещают, валидатор не ловит — О19, дыра).

**Приоритет 3 — PHILOSOPHY §1 (один абзац)**. Явно зафиксировать: "transport, auth, events могут жить вне SDL — в конфиге генератора. SDL описывает **shape данных**; режим доставки, авторизация и push-семантика — конвенции target-generator'ов". Снимает три 🟡 (transport-маркер, auth-scope, events) единым нормативным жестом. Оставляет место для `@local`/`@transport`/`@event` как будущих расширений без breaking.

**Что отложить на post-GA.** First-class `event` definition в EBNF (ждать второго стресс-теста после leading-comments). Multi-axis `@scope` (Arsenal v2 закрыл задачу без него). Contextual keywords (reserved-list в SPEC §2 дешевле и достаточен). `@dto`/`@transient` маркеры (пока один потребитель, Arsenal UploadTicket). `plugin-tauri-prewarm` (решается после того, как второй Tauri-продукт упрётся в тот же KPI).

Волна 1 подтверждает: **текущая v0.3 достаточна для ~80% реальных задач**, оставшиеся 20% — закрываются конвенциями генераторов и минорными аддитивными расширениями IR. Крупные архитектурные повороты не требуются.

## Благодарности

Волна 1 проведена Belladonna + Arsenal v2 в AI-first-dance режиме (см. `rest.valkyrie/philosophy/ai-first-dance.md`). Координация — через `A:/source/alak/stress.md` append-only журналом, 8 записей за сутки, два независимых потребителя. Без редактирования чужих записей, без общего процесса — только общая дисциплина дневника.
