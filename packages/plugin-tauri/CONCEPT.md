# @alaq/plugin-tauri — Мост между Nucl и Rust через Tauri v2 IPC

Плагин `tauri` — это мост между синхронной реактивной моделью `@alaq/nucl` и асинхронной Tauri IPC. Философия: **атом на TS-стороне — это зеркало Rust-состояния или обёртка над RPC-вызовом**, при этом разработчик (и ИИ, читающий код) остаётся в синхронном reactive-мире.

## Концепция

### Две семантики — одно решение

В Tauri-приложениях сосуществуют две разные формы взаимодействия с Rust:

1. **Состояние в Rust**: есть значение (device_id, user profile, server connection status) которое управляется Rust, а UI его отражает. На чтение — `invoke('get_...')`. На запись — `invoke('set_...')`. Обновления приходят через `listen('...:changed')`.
2. **Параметрические команды**: `calc_distance(a, b, c, d)` — нет «state», есть вычисление. Пользователь даёт параметры, получает результат.

Плагин обслуживает обе через **один механизм** (общий `tauriPlugin()`), но через **разные kind-ы**:

- `kind: 'tauri'` — mode 1, state mirror.
- `kind: 'tauri-command'` — mode 2, parametric invoke.

### Оптимистичная синхронизация (state mode)

Nucl-мутация возвращается синхронно и слушатели срабатывают сразу:

```typescript
setting('dark')
//   ↓
// listeners fire immediately (UI обновляется)
// behind the scenes: invoke('set_setting', { value: 'dark' })
```

`$saved` переходит в `false` пока идёт invoke и в `true` после успеха. Если invoke упал — `$error` содержит сообщение, `$saved` остаётся в `false` (слушатель видит, что значение не доехало). Это сознательно отличается от IDB-варианта где мы откатываем in-memory — в Tauri-сценарии обычно Rust это источник истины, но конкретная обработка восстановления зависит от приложения (перечитать? спросить пользователя?). Плагин даёт сигналы, не навязывает политику.

### Три companion-nucl'а: `$ready`, `$saved`, `$error`

- `$ready: INucleon<boolean>` — `false` пока идёт initial read. В `kind: 'tauri-command'` — `true` сразу (нет initial fetch).
- `$saved: INucleon<boolean>` — `false` пока есть pending invoke, `true` когда всё завершилось.
- `$error: INucleon<string | null>` — последнее сообщение об ошибке, `null` если всё ок. На успешном invoke сбрасывается в `null`.

### Graceful degradation

Плагин не падает если Tauri отсутствует. Детект — через `window.__TAURI_INTERNALS__` (стандартный маркер Tauri v2, инъектируется runtime'ом до выполнения webview-скриптов). Если маркера нет и `ipc` не инжектирован:

- State-mode nucl'ы не делают initial read, но переводят `$ready(true)` с дефолтным значением.
- Command-mode `invoke()` отклоняется с `"tauri unavailable"` и пишет в `$error`.
- В оба случая эмитится lifecycle-фрейм `tauri:unavailable` для observability.

Это нормальное поведение в SSR, unit-тестах и plain-browser сборке — не крэш, не блок.

### Инжектируемый IPC

Тесты подменяют IPC через `tauriPlugin({ ipc: createFakeIPC(...) })`. Контракт минимален:

```typescript
interface TauriIPC {
  invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>
  listen<T>(event: string, handler: (payload: T) => void): Promise<() => void>
}
```

В prod — обёртка над `@tauri-apps/api/core` + `@tauri-apps/api/event`, загружаемая через `import()` лениво. Это позволяет plugin-tauri быть optional peer-dep для `@tauri-apps/api`: чисто браузерные сборки не тянут модуль если не используют tauri kind.

### Lazy loading — зачем

`@tauri-apps/api` v2 — обычный JS модуль, он импортируется в любой среде без ошибок. Но его runtime-вызовы работают только если webview запущен внутри Tauri. Lazy import в `real.ts` нужен для двух сценариев:

1. Монорепо где `plugin-tauri` собирается вместе с чисто-веб пакетом, который не имеет `@tauri-apps/api` в `node_modules` — dynamic import даст нам возможность ловить missing-module ошибку и переключаться на degradation mode.
2. Bundler tree-shaking: ленивый импорт не попадает в основной chunk web-билда.

### Интеграция с plugin-logi

Каждая IPC-операция эмитит `LogiFrame` через `emitFrame` (из `@alaq/plugin-logi`):

| Событие | `kind` | `message` | `extra` |
|---|---|---|---|
| Создание (ok) | `lifecycle` | `tauri:open` | — |
| Создание (no tauri) | `lifecycle` | `tauri:unavailable` | — |
| Invoke начало | `lifecycle` | `tauri:invoke:begin` | `command` |
| Invoke успех | `lifecycle` | `tauri:invoke:end` | `command`, `duration_ms` |
| Invoke ошибка | `error` | `tauri:invoke:error` | `command`, `error_type`, `error` |
| Listen подключен | `lifecycle` | `tauri:listen:attach` | `event` |
| Listen пришёл | `lifecycle` | `tauri:listen:recv` | `event` |
| Listen ошибка | `error` | `tauri:listen:error` | `event`, `error_type`, `error` |

Fingerprint — `${realm}.${atom}.${prop}`, совместимо с остальными alaq-плагинами. Через MCP `logi_get_trace` ИИ видит полную цепочку: action → tauri:invoke:begin → tauri:invoke:end (или error).

Если `@alaq/plugin-logi` не подключён или `logiPlugin(config)` не вызван — `emitFrame` бесшумно no-op'ит. Нулевой оверхед.

## Что плагин НЕ делает

- **Не транспорт для CRDT-синхронизации.** Для этого есть `@alaq/link` и будущий `@alaq/link-tauri` — они работают на более высоком уровне (peer discovery, QoS, clock sync, crown authority). plugin-tauri — плоская обёртка над invoke/listen для одного локального процесса.
- **Не делает retry.** Ошибка → `$error`. Политику ретрая определяет приложение.
- **Не генерирует Rust-bridge коды автоматически.** Имена команд и событий — строки, пользователь прописывает их руками. Автоген — отдельная задача (возможно `@alaq/graph-tauri`).
- **Не хранит локально.** Нет persistent storage — это транспорт. Для локального кеша — комбинировать с `@alaq/plugin-idb` (`kind: 'tauri idb'`, tauri kind как источник истины, idb как snapshot).

## Testing

Bun не имеет Tauri runtime. Пакет поставляется с in-memory fake:

```typescript
import { createFakeIPC, tauriPlugin } from '@alaq/plugin-tauri'

const ipc = createFakeIPC({
  invoke: {
    get_x: () => 'hello',
    save_x: (args) => { /* ... */ },
  },
  events: {
    // Optional: per-event setup fn that gets an emit callback.
    'x:changed': (emit) => { /* keep emit for later */ },
  },
})
tauriPlugin({ ipc })

// In test:
ipc.emit('x:changed', 'new-value')
```

Fake покрывает: `invoke` (sync or async handlers), `listen` (multiple subscribers per event), `emit` (programmatic push).

Fake НЕ эмулирует: Tauri permission scopes, channel lifecycle, event bus между webview'ами, Rust ↔ JS type coercion quirks.
