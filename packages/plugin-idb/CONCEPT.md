# @alaq/plugin-idb — Персистентное состояние для Nucl

Плагин `idb` — это мост между синхронной реактивной моделью `@alaq/nucl` и асинхронной природой IndexedDB. Философия: **мутация не должна блокировать**, а разработчик (или ИИ) должен иметь явные сигналы о том, что происходит с персистентностью — без того, чтобы заворачивать каждую запись в `await`.

## Концепция

### Оптимистичная синхронизация

Nucl-мутация возвращается синхронно и слушатели срабатывают сразу:

```typescript
settings({ theme: 'light' })
//   ↓
// listeners fire immediately (UI обновляется)
// behind the scenes: write is queued, flushed after 100ms debounce
```

Это обратное тому, как обычно работают «async хранилища». Вместо «жди пока запишется, потом реагируй» — «реагируй сразу, запись — фоновая детализация». ИИ, который читает UI-код, не должен обрастать async-разветвлениями только ради localStorage-семантики.

### Два companion-nucl'а: `$ready` и `$saved`

Для тех случаев, когда персистентный цикл всё-таки важен, плагин привешивает к nucl'у двух «компаньонов»:

- `$ready: INucleon<boolean>` — `false` пока идёт начальная регидратация из IDB. До того как `$ready(true)` значение nucl'а равно дефолту.
- `$saved: INucleon<boolean>` — `false` пока есть pending writes в очереди, `true` когда всё закоммичено.

```typescript
settings.$ready.up(r => {
  if (!r) showSpinner()
  else    hideSpinner()
})

submitButton.onclick = async () => {
  settings({ theme: 'light' })
  // Если нужно дождаться реальной записи перед переходом:
  await new Promise(resolve =>
    settings.$saved.up(s => s && resolve(undefined))
  )
  navigate('/next')
}
```

Это нативный reactive-style — подписки на `$ready`/`$saved` работают как любые другие `.up()` на nucl'ах.

### Debounced write queue

Каждый nucl имеет собственную очередь записи с окном дебаунса (по умолчанию 100ms):

- **Single-value**: последняя запись побеждает. 50 быстрых `settings(newValue)` → одна IDB-транзакция с финальным значением.
- **Collection**: операции накапливаются в буфер; по истечении окна сбрасываются одной readwrite-транзакцией.

Этот выбор сделан осознанно: типовой UI-кейс — пользователь двигает slider → 60 мутаций в секунду. Писать в IDB на каждую — безумие. Писать после того, как движение закончилось — логично.

### Два режима: KV и коллекция

**`kind: 'idb'`** — single-value store.
Все single-value nucl'ы одного realm'а живут в общем object-store `__kv__`, key = `nucl.id`. Вся значение перезаписывается целиком на каждое изменение.

**`kind: 'idb-collection'`** — record store.
Каждый collection-nucl получает собственный object-store (name = `nucl.id`, keyPath = `primaryKey`). Мутации — это `insert`/`update`/`remove`/`query` поверх in-memory массива, которые ТАКЖЕ транслируются в соответствующие IDB-операции. Partial mutation: `insert` одной записи = `put` одной строки, не перезапись всего массива.

### DB naming

```
alaq:${realm}   ← IndexedDB database name
```

Один realm = одна IDB DB. Разные realms — разные DB (для sandboxing между «частями» приложения). Внутри одной DB:

- Общий `__kv__` object store для всех kind: 'idb' nucl'ов.
- По одному object-store на каждый kind: 'idb-collection' nucl (name = его `id`).

### Миграций нет

Осознанное решение. Версия IDB нужна только для того, чтобы создавать новые object-stores при добавлении новых collection-nucl'ов. Если схема индексов или primaryKey меняется — плагин логирует error-frame через plugin-logi и оставляет старую схему как есть. Пользователь вручную чистит IDB (браузерная панель → Application → IndexedDB → Delete) в случае поломки.

**Почему**: миграции в web-runtime — это проблема со множеством углов (broken versioning, stuck tabs, crash recovery). На v1 это over-engineering. На v2 — возможно, если появится реальный use-case.

### Интеграция с plugin-logi

Каждая IDB-операция эмитит `LogiFrame`:

| Событие | `kind` | `message` | `duration_ms` | `extra` |
|---|---|---|---|---|
| Создание nucl'а | `lifecycle` | `idb:open` | — | — |
| Начало rehydrate | — | — | — | — |
| Rehydrate найден | `lifecycle` | `idb:get:hit` | ✓ | `numeric.result_count` для collection |
| Rehydrate промах | `lifecycle` | `idb:get:miss` | ✓ | — |
| Старт записи | `lifecycle` | `idb:put:begin` | — | `numeric.op_count` для collection |
| Конец записи | `lifecycle` | `idb:put:end` | ✓ | `numeric.op_count` |
| Ошибка записи | `error` | `idb:put:error` | — | `error_type`, `error` |
| IDB недоступен | `error` | `idb:unavailable` | — | `error_type` |

`fingerprint` фреймов — `${realm}.${atom}.${prop}`, совместимо с fingerprint-ами change/action-фреймов plugin-logi. Через MCP `logi_get_trace` можно увидеть полную цепочку: action → change → idb:put:begin → idb:put:end.

Если `@alaq/plugin-logi` не установлен как peer, или `logiPlugin(config)` не вызван — `emitFrame` бесшумно no-op'ит. Никакого overhead.

## Обработка ошибок записи (verified в настоящем Chromium)

IndexedDB требует что записываемое значение проходило **structured clone**. Функции, Symbol, классы с методами, DOM-узлы, циклические ссылки — отвергаются с `DataCloneError`. Fake-idb в тестах этого не эмулирует (хранит JS refs), поэтому поведение ниже — задокументировано **отдельно**, проверено Playwright-смоком в реальном Chromium.

### Последовательность при ошибке записи

```
nuq(value)
  ↓
in-memory value обновляется мгновенно (optimistic, синхронно)
listeners срабатывают с новым value
  ↓
debounce окно (100ms)
  ↓
kvPut(db, key, value)  → DataCloneError (или QuotaExceededError, etc.)
  ↓
flushKv catch:
  1. rollback: in-memory value восстанавливается на st.lastSaved
  2. listeners снова срабатывают — с откаченным value
  3. $saved остаётся false (никогда не перейдёт в true для этой записи)
  4. logIdb эмитит frame: kind='error', message='idb:put:error',
     extra.error_type='idb:put', extra.error=<string>
```

### Два архитектурных выбора, о которых надо знать

**1. Rollback ДО `lastSaved`, не отмена мутации.**
In-memory значение сначала становится новым (оптимистично), через 100ms — откатывается. Если UI успел отрендерить — произойдёт второй ререндер с откаченным значением. Это непривычно, но семантически честно: плагин не прячет что IDB и память разошлись.

Альтернатива была бы — не применять мутацию в памяти пока не записано. Это убило бы оптимистичный sync-API и превратило nucl в async. Выбор в пользу optimistic принципиален.

**2. Rejection не всплывает как `unhandledrejection`.**
Ошибка перехватывается внутри `flushKv`, логируется через `logIdb`, но в глобальный error handler не доходит. Если `@alaq/plugin-logi` не подключён — пользователь узнаёт о провале **только** через `$saved === false`.

Практика для ИИ/разработчика: **если стор персистирует что-то критичное — подписывайся на `$saved`** и реагируй на неудачу явно. Без `$saved` ошибки записи становятся тихими.

### Что это значит на практике

- **Нормально**: сохранять JSON-совместимые объекты (strings, numbers, Date, arrays, plain objects, Map, Set, Blob, ArrayBuffer) — всё уходит в IDB без вопросов.
- **Выстрелит**: класс с методами, замыкания, Proxy с trap'ами, элементы DOM. Если пришлось такое хранить — плоскуй вручную до структурного вида.
- **Проверка в runtime**: смотри `$saved`. Если после debounce он остался `false` — запись не прошла, в logi есть error frame с деталями.

## Testing

Bun не имеет IndexedDB. Поэтому пакет поставляется с минимальным in-memory fake'ом:

```typescript
import { createFakeIDB, idbPlugin } from '@alaq/plugin-idb'

const factory = createFakeIDB()
idbPlugin({ factory })   // tests go through fake-idb
```

Fake покрывает: `open` (с `onupgradeneeded`), `createObjectStore` (с `keyPath`), `createIndex`/`index.getAll`, `transaction`, `put`/`get`/`getAll`/`delete`/`clear`. Не покрывает: cursors, `IDBKeyRange`, autoIncrement ключи, merge-семантику реального IDB.

Для production код использует `globalThis.indexedDB` (или то, что передано в `idbPlugin({ factory })`).
