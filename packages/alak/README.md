# Alak (v5) — The Facade

> Alak Atom. Высокоуровневая система управления состоянием с Dependency Injection, пространствами имен и умными фасадами.

Пакет `alak` — это вершина пирамиды. Он объединяет мощь `nucleus` и `atom` в целостную архитектуру приложения.

В метафоре "Вселенной", `Alak` — это **Организм**. Он организует отдельные атомы в союзы (Unions), управляет их жизненным циклом и обеспечивает связь между ними.

## Установка

```bash
npm install alak
```

## Философия: Организованный Хаос

В больших приложениях сложно управлять тысячами атомов вручную. Alak решает эту проблему через:
1.  **Unions (Союзы)**: Пространства имен, группирующие связанные атомы.
2.  **Facades (Фасады)**: Единая точка доступа ко всему состоянию приложения.
3.  **Convention over Configuration**: Автоматические подписки на основе имен методов.

## Основные концепции

### 1. Union (Союз)
Группа атомов, живущих в одном контексте (namespace). Например, `UserUnion` может содержать атомы `Profile`, `Settings`, `Auth`.

### 2. Dependency Injection
Вам не нужно импортировать инстансы атомов. Вы запрашиваете их через фасад, и Alak находит (или создает) их для вас.

### 3. Автоматические Слушатели (Magic Listeners)
Alak сканирует методы ваших моделей. Если метод называется определенным образом (например, `_counter$up`), он автоматически подписывается на соответствующие изменения.

---

## Быстрый Старт

### 1. Определение Моделей

Модели наследуются от `UnionModel` (для синглтонов) или `UnionMultiModel` (для фабрик).

```typescript
import { UnionModel } from 'alak'

// Модель счетчика
class Counter extends UnionModel<'myApp'> {
  count = 0
  increment() { this.count++ }
}

// Модель статистики, которая следит за счетчиком
class Stats extends UnionModel<'myApp'> {
  totalClicks = 0

  // МАГИЯ: Авто-подписка на Counter.count
  // _$counter_count_up -> слушать изменения 'count' в атоме 'counter'
  _$counter_count_up(val: number) {
    this.totalClicks++
    console.log(`Счетчик изменился на ${val}, всего кликов: ${this.totalClicks}`)
  }
  
  // Локальная подписка (на свои свойства)
  _totalClicks$up(val: number) {
     if (val >= 10) console.log('Achievement Unlocked!')
  }
}
```

### 2. Сборка Союза

```typescript
import { UnionConstructor } from 'alak'

const { facade } = UnionConstructor({
  namespace: 'myApp', // Уникальное имя союза
  models: {
    counter: Counter,
    stats: Stats
  }
})
```

### 3. Использование

Фасад предоставляет "умный" доступ к атомам.

```typescript
// Чтение (State)
console.log(facade.counterState.count) // 0

// Действие (Action)
facade.counterAtom.actions.increment() 
// -> "Счетчик изменился на 1, всего кликов: 1"

// Прямой доступ к ядру (Core/Nucleus)
facade.counterCore.count.up(v => console.log('Direct sub:', v))
```

---

## Naming Convention (Правила именования)

Alak использует символ `$` (или `_` в legacy режиме) для парсинга намерений разработчика.

### Локальные подписки (внутри одной модели)
Формат: `_property$trigger`

*   `_count$up(val)`: При каждом изменении `this.count`.
*   `_count$next(val)`: При *следующем* изменении.
*   `_count$once(val)`: Один раз.

### Внешние подписки (на другие атомы в союзе)
Формат: `_$atomName_property_trigger`

*   `_$user_isLoggedIn_up(val)`: Слушать свойство `isLoggedIn` в атоме `user`.

### События (Event Bus)
Формат: `_on$EventName`

*   `_on$init()`: Вызывается сразу после инициализации атома.
*   `_on$UserLogout(data)`: Слушать глобальное событие `UserLogout`.

---

## Facade API: 4 Пути Доступа

Фасад генерирует удобные свойства для доступа к разным аспектам атомов:

1.  **State** (`facade.userState`): Только значения (чтение/запись). Самый чистый синтаксис.
2.  **Actions** (`facade.userAtom.actions`): Методы бизнес-логики.
3.  **Core** (`facade.userCore`): Низкоуровневые `Nucleus` (для ручных подписок).
4.  **Atom** (`facade.userAtom`): Сам инстанс атома.

## Групповой доступ
*   `facade.states.*`: Объект со всеми стейтами.
*   `facade.cores.*`: Объект со всеми ядрами.
*   `facade.actions.*`: Объект со всеми методами.

---

## TypeScript и Инъекции

Чтобы `injectFacade` знал о типах вашего приложения в любом файле:

```typescript
import { injectFacade } from 'alak'

// 1. Декларация типов (обычно в d.ts файле)
declare module 'alak/namespaces' {
  interface ActiveUnions {
    myApp: typeof MyUnionInstance // Тип, возвращаемый UnionConstructor
  }
}

// 2. Использование в любом месте
const app = injectFacade('myApp') // Полная типизация!
app.counterState.count // number
```

---
Лицензия: TVR