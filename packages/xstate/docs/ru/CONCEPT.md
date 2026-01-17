# StateX: Мост между логикой и реактивностью

В то время как **Quark** хранит сырые данные, а **Nucl** добавляет поведение через плагины, **StateX** соединяет бизнес-логику вашего приложения (state machines) с реактивным миром.

Если Quark — это сырые данные, Nucl — управляемые данные, то StateX — это **оркестратор**.

## 1. Зачем нужен StateX?

State machines отлично подходят для моделирования сложных потоков приложения:
- **Явные состояния**: "loading", "playing", "error" — никаких невалидных комбинаций
- **Защищённые переходы**: Можно перейти из A в B только если условие X выполнено
- **Визуальный дизайн**: Проектируйте в [Stately.ai](https://stately.ai/viz), экспортируйте в код
- **Предсказуемость**: Каждое возможное состояние и переход задокументированы

Но state machines сами по себе плохо интегрируются с реактивным UI:
- Как привязать состояние машины к компоненту?
- Как запустить эффект при входе в состояние?
- Как комбинировать состояние машины с другими реактивными данными?

StateX решает эту проблему, оборачивая XState машины в Alak примитивы.

## 2. Метафора Мозг/Тело

| Концепция | XState (Мозг) | Alak (Тело) |
|-----------|---------------|-------------|
| **Фокус** | Что МОЖЕТ произойти | Как данные ТЕКУТ |
| **Сила** | Явные переходы | Реактивные эффекты |
| **Инструменты** | Визуальный редактор | Fluent API |

StateX соединяет эти два мира:

```typescript
const heater = fromMachine(heaterMachine)

// Мозг: XState обрабатывает логику состояний
heater.send({ type: 'TOGGLE' }) // Переход из inactive -> active

// Тело: Alak обрабатывает реактивность
heater.state().up(s => updateUI(s))        // Подписка на изменения состояния
heater.state('active').up(a => toggle(a))  // Реактивный matcher состояния
```

## 3. Паттерн реактивного адаптера

`fromMachine()` создаёт адаптер, который выставляет внутренности XState как Alak примитивы:

```
XState Machine
     │
     ▼
┌─────────────────────────────────────────┐
│          fromMachine()                  │
├─────────────────────────────────────────┤
│  .actor        → Raw XState Actor       │
│  .state()      → Quark<StateValue>      │
│  .state('x')   → Quark<boolean>         │  ← Matcher
│  .ctx()        → Quark<Context>         │
│  .ctx('path')  → Quark<T>               │  ← Selector
│  .ctx(fn)      → Quark<T>               │  ← Computed
│  .can('EVENT') → Quark<boolean>         │
│  .action()     → Quark<Action>          │  ← Action stream
│  .toEvent()                             │  ← Input binding
│  .asEvent()                             │  ← Input binding
│  .send()                                │  ← Dispatch events
│  .decay()                               │  ← Cleanup everything
└─────────────────────────────────────────┘
```

Каждый output — реактивный Quark, который бесшовно интегрируется с `fx` и UI фреймворками.

## 4. Привязки ввода

StateX предоставляет два способа подключения внешних реактивных источников к машине:

### `.toEvent()` — Привязка поля

```typescript
const sensor = Qv(20)

// Когда sensor меняется -> отправляется { type: 'SENSOR_UPDATE', temp: value }
heater.toEvent(sensor, 'SENSOR_UPDATE', 'temp')

sensor(25) // Автоматически вызывает переход состояния
```

### `.asEvent()` — Привязка полного события

```typescript
const control = Qv<any>(undefined)

heater.asEvent(control)

control({ type: 'TOGGLE' }) // Отправляет событие напрямую
```

## 5. Поток actions

StateX захватывает выполненные actions через inspect API XState:

```typescript
// Слушать конкретный action
heater.action('notifyUser').up(() => {
  showNotification('Нагреватель включён!')
})

// Слушать все actions
heater.action().up(action => {
  console.log('Action выполнен:', action.type)
})
```

## Итог

- **XState** = Бизнес-логика, явные состояния, визуальный дизайн.
- **StateX** = Адаптер, делающий XState реактивным.
- **Alak** = Реактивные примитивы, эффекты, UI binding.
- **Вместе** = Проектируйте логику визуально, связывайте реактивно, управляйте эффектами декларативно.
