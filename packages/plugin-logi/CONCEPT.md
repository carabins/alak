# @alaq/plugin-logi — Наблюдение за состоянием для ИИ

Плагин `logi` — это не просто телеметрия. Это **окно для ИИ в живое состояние приложения**. Когда ИИ пишет код на `@alaq/atom`, он не видит что происходит внутри атомов в рантайме. Плагин закрывает эту слепую зону: каждая мутация, каждое действие, каждый побочный эффект превращаются в структурированный `LogiFrame` и утекают в self-hosted Logi, откуда ИИ достаёт их через MCP (`logi_get_trace`, `logi_list_issues`, `logi_search_events`).

## Концепция

### Три сущности — три типа фреймов

```
Nucl изменился           → kind: 'change'      (info)
Action начался/закончился → kind: 'action'      (debug, phase: begin/end, duration_ms)
Action бросил              → kind: 'error'      (error)
Nucl создан/умер           → kind: 'lifecycle'  (debug)
```

Все четыре типа объединяет общий **трейс**. Если action вызывает три мутации и те, в свою очередь, триггерят `_prop_up` слушателей — у всех этих событий один `trace_id`. ИИ получает не поток разрозненных записей, а **каузальную цепочку**.

### Fingerprint — стабильный адрес

```
fingerprint = "${realm}.${atom}.${prop}"
```

Logi группирует события по `fingerprint` в «issues». Это значит что ИИ может задать вопрос не «какие события были?», а «что происходит с `app.counter.count`?» — и получить агрегат по всему времени: сколько раз менялся, в каких runs, с какой частотой, какие shape-переходы случались.

### Release — идентичность прогона

```
release = "${version}+${build}.r${reload}"
         = "0.1.0+abc1234.r17"
```

Три уровня идентификации:

- `version` — semver из `package.json`. Меняется редко.
- `build` — git sha / CI build id. Меняется на каждом деплое. Инжектится как `globalThis.__ALAQ_BUILD__` при сборке.
- `reload` — счётчик в `localStorage`. Инкрементится на каждой перезагрузке страницы (HMR тоже считается). Процесс-локальный счётчик в Node.

Зачем `reload`: в dev-режиме вы можете перезагрузить страницу 50 раз за час. Без `reload` все фреймы сольются в один `release`, и ИИ не сможет отличить «ошибка в текущем прогоне» от «то же самое случилось 20 минут назад». С `reload` каждый запуск — отдельный run в Logi, доступный через `logi_list_runs` и `logi_last_run`.

### Shape, не значение

По умолчанию в Logi уходит **форма** значения, не сами данные:

```typescript
prev_shape: { t: 'primitive', kind: 'number' }
next_shape: { t: 'object', keys: 3 }
```

Это закрывает два риска: PII (пароли, токены, имена юзеров в кривом стейте) и размер (object с 10000 ключей → 2MB в ingest на каждую мутацию).

Для отладки можно включить **dev-debug mode**:

```typescript
logiPlugin({ debugValues: true, ... })
```

Тогда `prev_value` / `next_value` / `args_value` летят в Logi целиком. Использовать **только в dev** — в Logi UI они будут видны в attrs как JSON.

## API

### Конфигурация (один раз на app bootstrap)

**Dev, ничего не настраиваем** — плагин сам подключится к локальному Logi (`A:/source/logi`, `docker compose up -d`):

```typescript
import { logiPlugin } from '@alaq/plugin-logi'
logiPlugin()  // → http://localhost:8080, demo_project_token
```

**Production** — свой endpoint и токен:

```typescript
import { logiPlugin, createLogiBrowserTransport } from '@alaq/plugin-logi'

const transport = await createLogiBrowserTransport({
  endpoint: 'https://logi.mycompany.dev',
  token: 'project-xyz',
})

logiPlugin({
  transport,
  version: '1.0.0',
  build: 'abc1234',
  debugValues: process.env.NODE_ENV === 'development',
})
```

### Per-property (kind)

```typescript
import '@alaq/plugin-logi/presets/logi'
import { Nu } from '@alaq/nucl'

const count = Nu({ kind: 'logi', value: 0, realm: 'app', id: 'counter.count' })
```

Или комбинируйте:

```typescript
const theme = Nu({ kind: 'stored logi', value: 'dark', realm: 'app', id: 'ui.theme' })
```

### Per-atom (plugins)

```typescript
import { Atom } from '@alaq/atom'
import { logiPlugin } from '@alaq/plugin-logi'

class CounterStore {
  count = 0
  step = 1
  increment() { this.count += this.step }
}

const Counter = Atom.define(CounterStore, {
  realm: 'app',
  name: 'counter',
  plugins: [logiPlugin(/* config */)],
})
```

Atom factory оборачивает каждое action через `traceAction`, так что `counter.increment()` открывает span, а `this.count += 1` внутри него попадает в тот же трейс.

### Ручное оборачивание action

Если вы пишете код вне atom:

```typescript
import { traceAction } from '@alaq/plugin-logi'

const doLogin = traceAction('app', 'auth', 'login', async (username, password) => {
  const token = await api.login(username, password)
  auth.token(token)
  user.name(username)
})
```

### Async границы

Sync trace-stack не выживает через `await`. Для явных async-продолжений:

```typescript
import { beginSpan, withTrace } from '@alaq/plugin-logi'

const span = beginSpan()
const response = await fetch('/api')
withTrace(span, () => {
  // мутации здесь получат правильный trace_id
  data(await response.json())
})
```

## Как ИИ этим пользуется

Через `logi_*` MCP-tools:

| Вопрос ИИ | Инструмент | Что получает |
|---|---|---|
| «Что случилось с `app.counter.count` за последний час?» | `logi_search_events` по fingerprint | Хронология всех мутаций со shape-переходами |
| «Покажи причинную цепочку, когда counter стал 42» | `logi_get_trace` | Action → мутация → listener → следующая мутация |
| «Какие атомы самые горячие?» | `logi_list_issues` | Топ fingerprints по частоте изменений |
| «Сравни текущий run с прошлым» | `logi_compare_runs` | Что изменилось в поведении между `r17` и `r18` |
| «Есть ли аномалии?» | `logi_anomaly` | Fingerprints с необычной частотой или shape-переходами |

## Что это даёт проекту

**Было**: ИИ пишет атом → не видит что происходит → человек должен объяснять багами в issue tracker.

**Стало**: ИИ пишет атом → добавляет `plugins: [logiPlugin()]` → делает действие → через MCP (`logi_get_trace`) читает причинно-следственную цепочку → видит причину сам.

### Проверено в живую

Integration-test шлёт реальные фреймы в `http://localhost:8080/ingest/v1/json`. Через MCP `logi_get_trace` возвращается полная цепочка:

```
action:begin increment  (span: ...w59iu5, parent: -)
    └── change count     (span: ...pfv5k,  parent: ...w59iu5)
action:end   increment  (duration: 0ms)
```

Это первый кирпич фундамента под **Decision Protocol** (следующий шаг): когда ИИ сможет **записывать** свои архитектурные решения в ту же систему, где читает их последствия, получится замкнутая петля обучения.
