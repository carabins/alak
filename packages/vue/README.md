# @alaq/vue

> Vue 3 интеграция для Alak atoms

Двусторонняя синхронизация между Vue reactive системой и Alak atoms. Превращает atom в Vue reactive объект с автоматическим обновлением.

## Установка

```bash
npm install @alaq/vue vue@3
```

## Основные функции

- `vueAtom(atom)` — создать Vue reactive из atom (односторонняя синхронизация)
- `watchVueAtom(atom)` — двусторонняя синхронизация (изменения в Vue → Atom)
- `vueNucleon(nucleus)` — превратить nucleus в Vue ref

## Примеры использования

### Пример 1: Базовое использование

```vue
<script setup>
import { Atom } from '@alaq/atom'
import vueAtom from '@alaq/vue'

class CounterModel {
  count = 0

  increment() {
    this.count++
  }
}

const counter = Atom({ model: CounterModel })
const state = vueAtom(counter)
</script>

<template>
  <div>
    <p>Count: {{ state.count }}</p>
    <button @click="state.increment()">Increment</button>
  </div>
</template>
```

### Пример 2: Двусторонняя синхронизация с формами

```vue
<script setup>
import { Atom } from '@alaq/atom'
import { watchVueAtom } from '@alaq/vue'

class FormModel {
  username = ''
  email = ''

  get isValid() {
    return this.username.length > 0 && this.email.includes('@')
  }
}

const form = Atom({ model: FormModel })

// Двусторонняя синхронизация: изменения в template обновят atom
const state = watchVueAtom(form)

// Подписка на изменения в atom
form.core.username.up((value) => {
  console.log('Username changed:', value)
})
</script>

<template>
  <form>
    <input v-model="state.username" placeholder="Username" />
    <input v-model="state.email" placeholder="Email" />
    <p v-if="state.isValid">Form is valid!</p>
  </form>
</template>
```

### Пример 3: Интеграция с Union

```vue
<script setup>
import { UnionConstructor, UnionModel } from 'alak'
import { watchVueAtom } from '@alaq/vue'

class TodosModel extends UnionModel<'app'> {
  items = []

  add(text) {
    this.items = [...this.items, { text, done: false }]
  }

  toggle(index) {
    const newItems = [...this.items]
    newItems[index].done = !newItems[index].done
    this.items = newItems
  }
}

const { facade } = UnionConstructor({
  namespace: 'app',
  models: {
    todos: TodosModel
  }
})

const todos = watchVueAtom(facade.atoms.todos)
</script>

<template>
  <div>
    <ul>
      <li
        v-for="(item, i) in todos.items"
        :key="i"
        @click="todos.toggle(i)"
        :class="{ done: item.done }"
      >
        {{ item.text }}
      </li>
    </ul>
    <button @click="todos.add('New task')">Add</button>
  </div>
</template>

<style>
.done { text-decoration: line-through; }
</style>
```

## API Reference

### `vueAtom(atom)`

Создает Vue reactive объект, синхронизированный с atom (atom → Vue).

```typescript
const state = vueAtom(atom)
// Изменения в atom.core автоматически обновляют state
// Изменения в state НЕ влияют на atom
```

### `watchVueAtom(atom, dedup?)`

Создает Vue reactive с двусторонней синхронизацией (atom ↔ Vue).

```typescript
const state = watchVueAtom(atom)
// Изменения в state обновляют atom.core
// Изменения в atom.core обновляют state

const state = watchVueAtom(atom, false)
// dedup=false отключает дедупликацию (по умолчанию true)
```

### `vueNucleon(nucleus)`

Превращает nucleus в Vue ref.

```typescript
import { N } from '@alaq/nucleus'
import { vueNucleon } from '@alaq/vue'

const count = N(0)
const countRef = vueNucleon(count)

// В template
<template>{{ countRef }}</template>
```

### `watchVueNucleon(nucleus)`

Двусторонняя синхронизация nucleus и ref.

```typescript
const countRef = watchVueNucleon(count)
// Изменения в countRef.value обновляют nucleus
```

## Производительность

- `vueAtom()` создает один reactive объект для всех свойств
- При изменении одного свойства обновляются только зависимые компоненты
- Используется Vue 3 Proxy-based reactivity для оптимальной производительности

## Совместимость

- Vue 3.0+
- Composition API

## Зависимости

- `vue` (peer dependency)
- Работает с любым atom из `@alaq/atom` или `alak`

## Лицензия

TVR
