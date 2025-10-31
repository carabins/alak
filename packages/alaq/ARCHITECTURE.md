# ALAQ - Архитектура

## Обзор

ALAQ строится поверх ALAK и предоставляет упрощенный интерфейс доступа к реактивному состоянию через строковые пути.

```
┌─────────────────────────────────────┐
│           ALAQ Layer                │
│  (Query interface + Style plugins)  │
├─────────────────────────────────────┤
│           ALAK Layer                │
│  (UnionCore, UnionAtom, Listeners)  │
├─────────────────────────────────────┤
│           ATOM Layer                │
│      (Atom, Cloud, Proxy)           │
├─────────────────────────────────────┤
│         NUCLEUS Layer               │
│    (Reactive containers)            │
└─────────────────────────────────────┘
```

## Основные компоненты

### 1. Realm (Пространство)

**Назначение:** Организация состояния в иерархические пространства имен.

**Структура:**
```typescript
interface Realm<Name, Origins> {
  name: Name                           // 'com.company.app'
  origins: Origins                     // Зарегистрированные модели
  atoms: { [K in keyof Origins]: IAtom<Origins[K]> }

  // Методы
  origin<N, M>(name: N, model: M): Realm<Name, Origins & Record<N, M>>
  realm(name: string): Realm           // Создать дочерний realm

  // Legacy совместимость
  facade: UnionCoreFacade              // Доступ к ALAK API
  Q: QInstance                         // Q для этого realm
}
```

**Реализация:**
- Внутри создает `UnionCore` из ALAK
- Поддерживает иерархию через dot notation
- Регистрирует origins как atoms

**Пример:**
```typescript
const app = realm('com.company.app')
const admin = realm('com.company.admin')

// Или вложенные
const com = realm('com')
const company = com.realm('company')
const app = company.realm('app')
```

---

### 2. Origin (Источник)

**Назначение:** Определение моделей состояния.

**Варианты:**

#### A. Класс-модель (UnionModel)
```typescript
class Counter extends UnionModel<'app'> {
  static modelName = 'counter'

  // State
  count: number = 0
  step: number = 1

  // Actions
  increment() {
    this.count += this.step
  }

  // Listeners
  _count_up(newValue: number) {
    console.log('Count changed:', newValue)
  }

  _$user_authenticated_up(isAuth: boolean) {
    if (!isAuth) this.count = 0
  }
}
```

#### B. Объект-модель
```typescript
app.origin('settings', {
  theme: 'dark' as 'dark' | 'light',
  language: 'en',
  notifications: true
})
```

**Listener naming:**
```
_property_up                      → локальное свойство
_$model_property_up               → модель в том же realm
_$realm:model_property_up         → модель в другом realm
```

**Реализация:**
- Класс: создается atom через `UnionAtom()`
- Объект: создается atom через `Atom()`
- Автоматическая установка listeners

---

### 3. Q (Query Interface)

**Назначение:** Единая точка обращения к состоянию.

**Структура:**
```typescript
interface QCore {
  // Внутренние (не используются напрямую)
  read<P extends ValidPaths>(path: P): ValueAt<P>
  write<P extends ValidPaths>(path: P, value: ValueAt<P>): void
  subscribe<P extends ValidPaths>(path: P, fn: (v: ValueAt<P>) => void): () => void
  invoke<P extends ValidActions>(path: P, ...args: any[]): void

  // Утилиты
  from(realm: string): QInstance
  in(realm: string): void
  use<S extends StylePlugin>(style: S): this & StyleMethods<S>
}

// Глобальный интерфейс (расширяется плагинами)
interface Q extends QCore {}
```

**Разрешение путей:**
```typescript
// Полный путь
Q.read('com.company.app.counter.count')

// С указанием realm
Q.from('com.company.app').read('counter.count')

// С установкой контекста
Q.in('com.company.app')
Q.read('counter.count')
```

**Реализация:**
- Парсинг строковых путей
- Навигация по realm → origin → property
- Делегирование к `atom.core[property]` или `atom.actions[method]`

---

### 4. Style Plugins

**Назначение:** Расширение Q дополнительными методами.

**Определение стиля:**
```typescript
interface StylePlugin<Methods = any> {
  name: string
  methods: Methods
  middleware?: {
    before?: (op: string, path: string, ...args: any[]) => void
    after?: (op: string, path: string, result: any) => void
    error?: (op: string, path: string, error: Error) => void
  }
}

function defineStyle<M extends Record<string, MethodFactory>>(
  config: { name: string, methods: M }
): StylePlugin<M>
```

**Пример стиля:**
```typescript
export const natural = defineStyle({
  name: 'natural',
  methods: {
    ask: (core) => <P extends ValidPaths>(path: P) => core.read(path),
    tell: (core) => <P extends ValidPaths>(path: P, value: ValueAt<P>) =>
      core.write(path, value),
    hear: (core) => <P extends ValidPaths>(path: P, fn: Function) =>
      core.subscribe(path, fn),
    call: (core) => <P extends ValidActions>(path: P, ...args: any[]) =>
      core.invoke(path, ...args)
  }
})

// Расширение типов через declaration merging
declare module 'alaq' {
  interface Q {
    ask<P extends ValidPaths>(path: P): ValueAt<P>
    tell<P extends ValidPaths>(path: P, value: ValueAt<P>): void
    hear<P extends ValidPaths>(path: P, fn: (v: ValueAt<P>) => void): () => void
    call<P extends ValidActions>(path: P, ...args: any[]): void
  }
}
```

**Использование:**
```typescript
import { natural } from 'alaq/styles'

Q.use(natural)

Q.ask('counter.count')
Q.tell('counter.count', 10)
Q.hear('counter.count', fn)
Q.call('counter.increment')
```

---

## TypeScript типизация

### Генерация типов из Realms

```typescript
// Интерфейс для расширения
export interface Realms {}

// Генерация путей
type PathsInRealm<R extends keyof Realms> = {
  [Origin in keyof Realms[R]]: {
    [Prop in keyof Realms[R][Origin]]: Realms[R][Origin][Prop] extends Function
      ? never
      : `${R & string}.${Origin & string}.${Prop & string}`
  }[keyof Realms[R][Origin]]
}[keyof Realms[R]]

export type ValidPaths = {
  [R in keyof Realms]: PathsInRealm<R>
}[keyof Realms]

// Генерация действий
type ActionsInRealm<R extends keyof Realms> = {
  [Origin in keyof Realms[R]]: {
    [Method in keyof Realms[R][Origin]]: Realms[R][Origin][Method] extends Function
      ? `${R & string}.${Origin & string}.${Method & string}`
      : never
  }[keyof Realms[R][Origin]]
}[keyof Realms[R]]

export type ValidActions = {
  [R in keyof Realms]: ActionsInRealm<R>
}[keyof Realms]

// Извлечение типа значения
export type ValueAt<Path extends string> =
  Path extends `${infer R}.${infer O}.${infer P}`
    ? R extends keyof Realms
      ? O extends keyof Realms[R]
        ? P extends keyof Realms[R][O]
          ? Realms[R][O][P]
          : never
        : never
      : never
    : never
```

### Расширение типов пользователем

```typescript
import { realm } from 'alaq'

const app = realm('app', {
  origins: {
    counter: {
      count: 0,
      increment() { this.count++ }
    }
  }
})

// Расширение глобальных типов
declare module 'alaq' {
  interface Realms {
    app: {
      counter: {
        count: number
        increment: () => void
      }
    }
  }
}

// Теперь TypeScript знает все!
Q.ask('app.counter.count')     // → number
Q.tell('app.counter.count', 10) // проверяет тип
Q.call('app.counter.increment') // ✅
```

---

## Взаимодействие с ALAK

### Realm → UnionCore

```typescript
function realm<Name, Origins>(name: Name, config: { origins: Origins }) {
  // Создаем UnionCore из ALAK
  const uc = GetUnionCore(name)

  // Регистрируем origins как atoms
  Object.entries(config.origins).forEach(([key, model]) => {
    uc.addAtom({ model, name: key })
  })

  return {
    name,
    origins: config.origins,
    atoms: uc.services.atoms,
    facade: uc.facade,  // Legacy API
    Q: createQForRealm(uc)
  }
}
```

### Q → Atom operations

```typescript
class QImplementation implements QCore {
  private realms: Map<string, UnionCore>
  private currentRealm: string

  read<P extends ValidPaths>(path: P): ValueAt<P> {
    const { realm, origin, property } = parsePath(path)
    const uc = this.realms.get(realm)
    const atom = uc.services.atoms[origin]
    return atom.core[property].value
  }

  write<P extends ValidPaths>(path: P, value: ValueAt<P>) {
    const { realm, origin, property } = parsePath(path)
    const uc = this.realms.get(realm)
    const atom = uc.services.atoms[origin]
    atom.core[property](value)
  }

  subscribe<P extends ValidPaths>(path: P, fn: Function) {
    const { realm, origin, property } = parsePath(path)
    const uc = this.realms.get(realm)
    const atom = uc.services.atoms[origin]
    return atom.core[property].up(fn)
  }

  invoke<P extends ValidActions>(path: P, ...args: any[]) {
    const { realm, origin, action } = parsePath(path)
    const uc = this.realms.get(realm)
    const atom = uc.services.atoms[origin]
    return atom.actions[action](...args)
  }
}
```

---

## Структура пакета

```
packages/alaq/
├── src/
│   ├── core/
│   │   ├── realm.ts          # Реализация realm
│   │   ├── Q.ts              # Реализация Q
│   │   └── types.ts          # Базовые типы
│   ├── styles/
│   │   ├── natural.ts        # ask, tell, hear, call
│   │   ├── technical.ts      # get, set, watch, invoke
│   │   ├── poetic.ts         # seek, grant, witness, summon
│   │   └── index.ts
│   ├── plugins/
│   │   └── defineStyle.ts    # Утилиты для плагинов
│   └── index.ts
├── ROADMAP.md
├── ARCHITECTURE.md
├── API_DESIGN.md
└── package.json
```

---

## Ключевые решения

### 1. Строковые пути vs Прямой доступ

**За строковые пути:**
- ✅ Простой API
- ✅ Динамическое построение путей
- ✅ Легко логировать и отлаживать
- ✅ Универсальность

**Против:**
- ❌ Парсинг строк
- ❌ Сложнее типизация

**Решение:** Используем строковые пути с полной типизацией через template literal types.

### 2. Иерархия Realm

**Варианты:**
- Dot notation: `'com.company.app'`
- Slash notation: `'com/company/app'`
- Вложенные объекты

**Решение:** Dot notation (как в Java), опционально вложенные через `.realm()`

### 3. Стили: декларативные vs императивные

**Решение:** Система плагинов позволяет оба подхода. Встроенные стили покрывают основные кейсы, пользователи могут создавать свои.

---

## Производительность

### Оптимизации

1. **Кэширование парсинга путей**
```typescript
const pathCache = new Map<string, ParsedPath>()

function parsePath(path: string): ParsedPath {
  if (pathCache.has(path)) {
    return pathCache.get(path)!
  }
  const parsed = parsePathInternal(path)
  pathCache.set(path, parsed)
  return parsed
}
```

2. **Кэширование методов стилей**
```typescript
class QImplementation {
  private methodCache = new WeakMap()

  use(style: StylePlugin) {
    if (!this.methodCache.has(style)) {
      const methods = Object.entries(style.methods).reduce((acc, [key, factory]) => {
        acc[key] = factory(this)
        return acc
      }, {})
      this.methodCache.set(style, methods)
    }
    Object.assign(this, this.methodCache.get(style))
  }
}
```

3. **Lazy realm resolution**
```typescript
function Q.from(realmName: string) {
  // Создаем realm только при первом обращении
  if (!realms.has(realmName)) {
    throw new Error(`Realm '${realmName}' not found`)
  }
  return createQProxy(realms.get(realmName))
}
```

---

**Версия:** v5.0.0-alpha
**Последнее обновление:** 2025-01-24
