# @alaq/queue

> High-performance reactive Job Scheduler for Alak ecosystem

## Концепция

**queue** - полноценный Job Scheduler с нативной интеграцией в Alak. Все состояния реактивны (Nucl), события идут через Quantum Bus, эффекты управляются через fx.

### Особенности

- **V8-оптимизирован** - минимальный overhead, быстрые операции
- **Reactive-first** - все состояния как Nucl, подписки из коробки
- **Full-featured** - concurrency, priority, retry, scheduling, dependencies
- **Zero dependencies** - только peer dependency на @alaq/nucl

---

## Быстрый старт

```typescript
import { createQueue } from '@alaq/queue'

const queue = createQueue({
  concurrency: 3,
  processor: async (job) => {
    const result = await fetch(job.data.url)
    return result.json()
  }
})

// Реактивные состояния
queue.pending.up(jobs => console.log('Waiting:', jobs.length))
queue.active.up(jobs => console.log('Processing:', jobs.length))
queue.completed.up(jobs => console.log('Done:', jobs.length))

// Добавление задач
queue.add({ url: '/api/ad/1' })
queue.add({ url: '/api/ad/2' }, { priority: 10 })

// Управление
queue.pause()
queue.resume()
```

---

## API Reference

### `createQueue<T, R>(options)`

Создаёт новую очередь.

```typescript
interface QueueOptions<T, R> {
  // Обработчик задач (обязательный)
  processor: (job: Job<T>) => Promise<R> | R
  
  // Максимум параллельных задач (default: 1)
  concurrency?: number
  
  // Автозапуск обработки (default: true)
  autoStart?: boolean
  
  // ID для Quantum Bus
  id?: string
  
  // Realm для изоляции
  realm?: string
}

const queue = createQueue<AdConfig, AdResult>({
  concurrency: 3,
  processor: async (job) => {
    return await loadAd(job.data)
  }
})
```

---

## Job Management

### `.add(data, options?)` - добавление задачи

```typescript
interface JobOptions {
  // Приоритет (выше = раньше выполнится)
  priority?: number
  
  // Задержка перед запуском (ms)
  delay?: number
  
  // Таймаут выполнения (ms)
  timeout?: number
  
  // Количество повторов при ошибке
  retries?: number
  
  // Стратегия backoff для retry
  backoff?: BackoffStrategy
  
  // ID задачи (auto-generated если не указан)
  id?: string
  
  // Зависимости - ждать завершения других задач
  dependsOn?: string | string[]
  
  // Метаданные
  meta?: Record<string, any>
}

// Простое добавление
const job = queue.add({ url: '/api/ad/1' })

// С опциями
const urgentJob = queue.add(
  { url: '/api/ad/priority' },
  { 
    priority: 100,
    timeout: 5000,
    retries: 3,
    backoff: { type: 'exponential', delay: 1000 }
  }
)

// Возвращает Job объект
job.id        // string
job.status    // Nucl<JobStatus>
job.result    // Promise<R>
job.progress  // Nucl<number> (0-100)
```

### `.addMany(items)` - массовое добавление

```typescript
const jobs = queue.addMany([
  { data: { url: '/api/1' } },
  { data: { url: '/api/2' }, options: { priority: 10 } },
  { data: { url: '/api/3' }, options: { delay: 5000 } }
])
```

### `.remove(jobId)` - удаление задачи

```typescript
queue.remove('job-123')  // Удаляет из pending
```

### `.cancel(jobId)` - отмена задачи

```typescript
queue.cancel('job-123')  // Отменяет active задачу (AbortController)
```

### `.clear()` - очистка очереди

```typescript
queue.clear()           // Очищает pending
queue.clear('all')      // Очищает всё + отменяет active
```

---

## Queue Control

### `.pause()` / `.resume()`

```typescript
queue.pause()   // Останавливает обработку (active задачи продолжают работать)
queue.resume()  // Возобновляет обработку
```

### `.isPaused` - состояние паузы (Nucl<boolean>)

```typescript
queue.isPaused.up(paused => {
  pauseButton.textContent = paused ? 'Resume' : 'Pause'
})
```

### `.drain()` - ждать завершения всех задач

```typescript
await queue.drain()
console.log('All jobs completed')
```

### `.decay()` - уничтожение очереди

```typescript
queue.decay()  // Отменяет всё, очищает подписки
```

---

## Reactive State (Nucl)

Все состояния - реактивные Nucl, можно подписываться через `.up()`.

### Счётчики

```typescript
queue.size.up(n => {})      // Nucl<number> - всего задач (pending + active)
queue.pending.up(n => {})   // Nucl<number> - в ожидании
queue.active.up(n => {})    // Nucl<number> - в обработке
```

### Списки задач

```typescript
queue.pendingJobs.up(jobs => {})    // Nucl<Job[]>
queue.activeJobs.up(jobs => {})     // Nucl<Job[]>
queue.completedJobs.up(jobs => {})  // Nucl<Job[]>
queue.failedJobs.up(jobs => {})     // Nucl<Job[]>
```

### Флаги

```typescript
queue.isPaused.up(v => {})   // Nucl<boolean>
queue.isIdle.up(v => {})     // Nucl<boolean> - нет active задач
queue.isEmpty.up(v => {})    // Nucl<boolean> - нет pending и active
```

### Статистика

```typescript
queue.stats.up(s => {})
// {
//   processed: number,    // всего обработано
//   succeeded: number,    // успешно
//   failed: number,       // с ошибкой
//   avgTime: number,      // среднее время (ms)
//   throughput: number    // задач/сек
// }
```

---

## Job Object

### Структура

```typescript
interface Job<T> {
  // Идентификация
  id: string
  data: T
  
  // Состояние (реактивное)
  status: Nucl<JobStatus>  // 'pending' | 'active' | 'completed' | 'failed' | 'cancelled'
  
  // Прогресс (0-100)
  progress: Nucl<number>
  
  // Результат (Promise)
  result: Promise<R>
  
  // Ошибка (если failed)
  error: Nucl<Error | null>
  
  // Метаданные
  meta: Record<string, any>
  attempts: number
  createdAt: number
  startedAt: number | null
  completedAt: number | null
  
  // Методы
  cancel(): void
  retry(): void
  updateProgress(value: number): void
}
```

### Использование

```typescript
const job = queue.add({ url: '/api/data' })

// Подписка на статус
job.status.up(status => {
  console.log(`Job ${job.id}: ${status}`)
})

// Ожидание результата
const result = await job.result

// Обновление прогресса из processor
queue.processor = async (job) => {
  job.updateProgress(10)
  const data = await fetch(job.data.url)
  job.updateProgress(50)
  const parsed = await data.json()
  job.updateProgress(100)
  return parsed
}
```

---

## Priority Queue

Задачи с большим priority выполняются раньше.

```typescript
queue.add({ type: 'normal' })                          // priority: 0 (default)
queue.add({ type: 'important' }, { priority: 10 })     // выполнится раньше
queue.add({ type: 'urgent' }, { priority: 100 })       // выполнится первым
queue.add({ type: 'background' }, { priority: -10 })   // выполнится последним
```

---

## Retry & Backoff

### Настройка retry

```typescript
queue.add(data, {
  retries: 3,                    // Максимум 3 повтора
  backoff: {
    type: 'exponential',         // 'fixed' | 'exponential' | 'linear'
    delay: 1000,                 // Начальная задержка (ms)
    maxDelay: 30000,             // Максимальная задержка
    factor: 2                    // Множитель для exponential
  }
})

// fixed:       1000, 1000, 1000
// linear:      1000, 2000, 3000
// exponential: 1000, 2000, 4000
```

### Условный retry

```typescript
const queue = createQueue({
  processor: async (job) => { /* ... */ },
  shouldRetry: (error, job) => {
    // Не повторять для 4xx ошибок
    if (error.status >= 400 && error.status < 500) {
      return false
    }
    return job.attempts < 3
  }
})
```

---

## Delayed Jobs

### Отложенный запуск

```typescript
// Запустить через 5 секунд
queue.add(data, { delay: 5000 })

// Запустить в определённое время
queue.add(data, { delay: Date.now() + 60000 })  // через минуту
```

### Recurring Jobs (Scheduled)

```typescript
// Интервал
const recurringJob = queue.schedule({
  data: { type: 'cleanup' },
  interval: 60000,  // каждую минуту
  immediate: true   // запустить сразу + потом по интервалу
})

// Остановка
recurringJob.stop()

// Cron-like (опционально)
queue.schedule({
  data: { type: 'daily-report' },
  cron: '0 9 * * *'  // каждый день в 9:00
})
```

---

## Job Dependencies

### Последовательное выполнение

```typescript
const job1 = queue.add({ step: 1 }, { id: 'step-1' })
const job2 = queue.add({ step: 2 }, { id: 'step-2', dependsOn: 'step-1' })
const job3 = queue.add({ step: 3 }, { id: 'step-3', dependsOn: 'step-2' })

// job2 начнётся только после завершения job1
// job3 начнётся только после завершения job2
```

### Множественные зависимости

```typescript
queue.add({ type: 'fetch-a' }, { id: 'fetch-a' })
queue.add({ type: 'fetch-b' }, { id: 'fetch-b' })
queue.add({ type: 'merge' }, { 
  id: 'merge',
  dependsOn: ['fetch-a', 'fetch-b']  // ждёт оба
})
```

### Job Groups

```typescript
const group = queue.createGroup('ad-batch')

group.add({ url: '/ad/1' })
group.add({ url: '/ad/2' })
group.add({ url: '/ad/3' })

// Реактивное состояние группы
group.progress.up(p => console.log(`${p}% complete`))
group.isComplete.up(done => {
  if (done) console.log('All ads loaded')
})

// Ожидание завершения группы
const results = await group.drain()
```

---

## Events & Quantum Bus

### События очереди

```typescript
queue.on('job:added', (job) => {})
queue.on('job:started', (job) => {})
queue.on('job:progress', (job, progress) => {})
queue.on('job:completed', (job, result) => {})
queue.on('job:failed', (job, error) => {})
queue.on('job:retry', (job, attempt) => {})

queue.on('queue:paused', () => {})
queue.on('queue:resumed', () => {})
queue.on('queue:drained', () => {})
queue.on('queue:idle', () => {})
```

### Quantum Bus интеграция

```typescript
const queue = createQueue({
  id: 'adQueue',
  realm: 'engine',
  emitEvents: true  // Отправлять события в Quantum Bus
})

// В другом месте (UI realm)
import { quantumBus } from '@alaq/quark'

const engineBus = quantumBus.getRealm('engine')

engineBus.on('adQueue:job:completed', ({ job, result }) => {
  showNotification(`Ad ${job.id} loaded`)
})
```

---

## Интеграция с fx

### Эффекты на состояние очереди

```typescript
import { fx } from '@alaq/fx'

// Показать loader когда есть active задачи
fx(queue.active)
  .when(n => n > 0)
  .run(() => showLoader())

// Скрыть loader когда idle
fx(queue.isIdle)
  .when(true)
  .run(() => hideLoader())

// Уведомление при ошибке
fx(queue.failedJobs).run((failed) => {
  if (failed.length > 0) {
    const last = failed[failed.length - 1]
    showError(`Job failed: ${last.error.value?.message}`)
  }
})
```

### Управление очередью через fx

```typescript
const isOnline = Nv(navigator.onLine)

// Пауза при потере сети
fx(isOnline).run((online) => {
  if (online) {
    queue.resume()
  } else {
    queue.pause()
  }
})
```

---

## Интеграция с XState

```typescript
import { fromMachine } from '@alaq/xstate'
import { createQueue } from '@alaq/queue'

const playerMachine = createMachine({ /* ... */ })
const player = fromMachine(playerMachine)

const adsQueue = createQueue({
  processor: loadAd,
  concurrency: 2
})

// XState управляет очередью
fx(player.matches('loading')).run((loading) => {
  if (loading) {
    adsQueue.resume()
  }
})

fx(player.matches('content')).run((inContent) => {
  if (inContent) {
    adsQueue.clear('all')
  }
})

// Очередь влияет на XState
fx(adsQueue.isEmpty)
  .when(true)
  .run(() => player.send('ALL_ADS_LOADED'))
```

---

## Persistence (Optional)

### localStorage

```typescript
import { createQueue } from '@alaq/queue'
import { localStorageAdapter } from '@alaq/queue/persistence'

const queue = createQueue({
  processor: myProcessor,
  persistence: localStorageAdapter('my-queue')
})

// Задачи сохраняются и восстанавливаются при перезагрузке страницы
```

### IndexedDB

```typescript
import { indexedDBAdapter } from '@alaq/queue/persistence'

const queue = createQueue({
  processor: myProcessor,
  persistence: indexedDBAdapter('my-queue-db')
})
```

### Custom Adapter

```typescript
interface PersistenceAdapter {
  save(jobs: SerializedJob[]): Promise<void>
  load(): Promise<SerializedJob[]>
  clear(): Promise<void>
}

const customAdapter: PersistenceAdapter = {
  save: async (jobs) => { /* ... */ },
  load: async () => { /* ... */ },
  clear: async () => { /* ... */ }
}
```

---

## Примеры использования

### Пример 1: Рефакторинг async-ads

```typescript
// Было (fabriqe.ts)
const query = A.id<VPaidQueryItem[]>("query", []);
let processing = [];
let playingQuery = [];

// Стало
import { createQueue } from '@alaq/queue'

const adsQueue = createQueue<VPaidQueryItem, AdResult>({
  id: 'ads',
  concurrency: 4,
  processor: async (job) => {
    const result = await loadVastAd(job.data)
    return result
  }
})

// Реактивный UI
adsQueue.pending.up(n => log(`в очереди: ${n}`))
adsQueue.active.up(n => log(`в обработке: ${n}`))

// Добавление из vastVisit
function toQuery(vpaid: VPaidQueryItem) {
  adsQueue.add(vpaid)
}

// Управление воспроизведением
adsQueue.on('job:completed', (job, result) => {
  if (canPlay()) {
    playAd(result)
  } else {
    playingQueue.push(result)
  }
})
```

### Пример 2: Image Preloader

```typescript
const imageQueue = createQueue<string, HTMLImageElement>({
  concurrency: 4,
  processor: (job) => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = job.data
    })
  }
})

// Прогресс загрузки
const totalImages = 20
imageQueue.stats.up(s => {
  const progress = (s.processed / totalImages) * 100
  progressBar.style.width = `${progress}%`
})

// Загрузка галереи
images.forEach(url => imageQueue.add(url))
await imageQueue.drain()
console.log('All images loaded!')
```

### Пример 3: API Request Queue с Rate Limiting

```typescript
const apiQueue = createQueue({
  concurrency: 1,  // Последовательно
  processor: async (job) => {
    const response = await fetch(job.data.url, job.data.options)
    return response.json()
  }
})

// Rate limiting через delay между задачами
apiQueue.on('job:completed', () => {
  // Добавляем задержку перед следующим запросом
  apiQueue.pause()
  setTimeout(() => apiQueue.resume(), 100)  // 100ms между запросами
})
```

---

## Внутренняя архитектура

### Структура файлов

```
packages/queue/
├── src/
│   ├── index.ts              # Публичный API
│   ├── queue.ts              # Основной класс Queue
│   ├── job.ts                # Job class
│   ├── priority-heap.ts      # Структура данных для priority queue
│   ├── scheduler.ts          # Delayed & recurring jobs
│   ├── dependencies.ts       # Job dependencies resolver
│   ├── events.ts             # Event emitter
│   ├── persistence/
│   │   ├── index.ts
│   │   ├── localStorage.ts
│   │   └── indexedDB.ts
│   └── types.ts
├── test/
│   ├── queue.test.ts
│   ├── priority.test.ts
│   ├── retry.test.ts
│   ├── dependencies.test.ts
│   ├── scheduling.test.ts
│   └── integration.test.ts
├── benchmark/
│   └── throughput.bench.ts
├── package.json
├── tsconfig.json
└── README.md
```

### Зависимости

```json
{
  "peerDependencies": {
    "@alaq/quark": "^6.0.0"
  },
  "optionalPeerDependencies": {
    "@alaq/nucl": "^6.0.0",
    "@alaq/fx": "^1.0.0"
  }
}
```

### Выбор примитива (Quark vs Nucl)

По умолчанию используется **Quark** (легче, быстрее). Можно переключить на **Nucl**:

```typescript
import { createQueue } from '@alaq/queue'

// Default: Quark - минимальный overhead
const queue = createQueue({
  processor: myProcessor
})
queue.pending     // IQuark<number>
queue.isIdle      // IQuark<boolean>

// С Nucl + kind - доступ к плагинам
const queue = createQueue({
  processor: myProcessor,
  primitive: 'nucl',
  kind: 'std'
})
queue.pending     // INucleon<number>
queue.pendingJobs // INucleon<Job[]> с .push(), .isEmpty, etc.
```

**Когда использовать Nucl:**

```typescript
// Nucl полезен когда нужны хелперы для работы с данными
const queue = createQueue({
  processor: loadAd,
  primitive: 'nucl',
  kind: 'std'
})

// Можно использовать std методы
queue.completedJobs.up(jobs => {
  if (jobs.isEmpty) return  // std helper
  // ...
})
```

### Производительность

- **Priority Queue:** Binary Heap - O(log n) для add/remove
- **Dependency Resolution:** Topological sort - O(V + E)
- **Memory:** Efficient job pooling, WeakMap для cleanup
- **Target:** 100k+ jobs/sec throughput

---

## Сравнение с альтернативами

| Feature | @alaq/queue | p-queue | bull |
|---------|-------------|---------|------|
| Browser | Yes | Yes | No (Redis) |
| Reactive State | Nucl native | Events only | Events only |
| Priority | Yes | Yes | Yes |
| Dependencies | Yes | No | Yes |
| Retry/Backoff | Yes | No | Yes |
| Scheduling | Yes | No | Yes |
| Persistence | Optional | No | Redis |
| Bundle Size | ~5kb | ~3kb | N/A |

---

## TODO / Open Questions

1. **Worker Threads:** Поддержка Web Workers для CPU-intensive задач?
2. **Batching:** Группировка мелких задач в batch?
3. **Deadlock Detection:** Автоматическое обнаружение циклических зависимостей?
4. **Metrics:** Prometheus-compatible метрики?
5. **Rate Limiting:** Встроенный rate limiter или отдельно?
