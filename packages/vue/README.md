# @alaq/vue

> Vue 3 интеграция для Alak - полная совместимость проактивного Nucleus и Atoms с Vue reactivity

**НОВОЕ:**
- `VueRefPlugin` - nucleus сам ведёт себя как Vue Ref с автоматическим `.value` 🆕
- `VueNucleusPlugin` - явное создание Vue ref через `.toRef()` / `.toReactive()`

Двусторонняя синхронизация между Vue reactive системой и Alak nucleus/atoms. Превращает nucleus в Vue ref, а atom в Vue reactive объект с автоматическим обновлением.

## Установка

```bash
npm install @alaq/vue @alaq/nucleus vue@3
```

## Nucleus Integration 🆕

### ⚠️ Важно: Установка плагина

**Установите плагин один раз** при инициализации приложения, **до** создания любых stores или composables:

#### Вариант 1: VueRefPlugin (рекомендуется) 🆕

Nucleus автоматически ведёт себя как Vue Ref - имеет `.value` и работает с `watch()`:

```typescript
// src/plugins/alak.ts
import { installPlugin } from '@alaq/nucleus'
import { VueRefPlugin } from '@alaq/vue'
import { ComputedPlugin } from '@alaq/next' // опционально

installPlugin(ComputedPlugin)  // для nucleus.from()
installPlugin(VueRefPlugin)    // nucleus.value + Vue watch работает!
```

```typescript
// Использование
const count = N(0)

// Nucleus уже ведёт себя как Ref!
console.log(count.value)  // 0
count.value = 10

// Vue watch работает!
watch(() => count.value, (newValue) => {
  console.log('Changed:', newValue)
})
```

[Подробная документация VueRefPlugin →](./VUEREFPLUGIN.md)

#### Вариант 2: VueNucleusPlugin

Явное создание Vue ref через методы `.toRef()` / `.toReactive()`:

```typescript
// src/plugins/alak.ts
import { installPlugin } from '@alaq/nucleus'
import { VueNucleusPlugin } from '@alaq/vue'
import { ComputedPlugin } from '@alaq/next'

installPlugin(ComputedPlugin)   // для nucleus.from()
installPlugin(VueNucleusPlugin) // для toRef(), toReactive(), syncWith()
```

#### Можно использовать оба вместе:

```typescript
installPlugin(VueRefPlugin)      // nucleus.value работает автоматически
installPlugin(VueNucleusPlugin)  // + явное .toRef() / .toReactive()
```

```typescript
// src/main.ts
import { createApp } from 'vue'
import './plugins/alak' // <- импортируем ОДИН РАЗ при старте
import App from './App.vue'

createApp(App).mount('#app')
```

> 💡 **Примеры организации кода**: см. [examples/](./examples/) для полных примеров stores и composables

### Быстрый старт

```typescript
// stores/counter.ts
import { N } from '@alaq/nucleus'

export const count = N(0)
export const countRef = count.toReactive() // Vue Ref<number>
```

### API Nucleus

- `nucleus.toRef()` — односторонняя синхронизация (nucleus → ref)
- `nucleus.toReactive()` — двусторонняя синхронизация (nucleus ↔ ref)
- `nucleus.syncWith(ref)` — синхронизация с существующим ref
- `nucleus.asRef()` — алиас для toRef()

### Пример с Composition API

```typescript
// stores/counter.ts
import { N } from '@alaq/nucleus'

const countNucleus = N(0)

export function useCounter() {
  return {
    count: countNucleus.toReactive(),
    increment: () => countNucleus(countNucleus() + 1),
    decrement: () => countNucleus(countNucleus() - 1)
  }
}
```

```vue
<template>
  <div>
    <h1>{{ count }}</h1>
    <button @click="increment">+</button>
    <button @click="decrement">-</button>
  </div>
</template>

<script setup lang="ts">
import { useCounter } from '@/stores/counter'

const { count, increment, decrement } = useCounter()
</script>
```

[Подробная документация по Nucleus Integration →](#nucleus-api-reference)

---

## Atoms Integration (Классический API)

### Основные функции

- `vueAtom(atom)` — создать Vue reactive из atom (односторонняя синхронизация)
- `watchVueAtom(atom)` — двусторонняя синхронизация (изменения в Vue → Atom)
- `vueNucleon(nucleus)` — превратить nucleus в Vue ref (legacy, используйте VueNucleusPlugin)

## Примеры использования

### Пример 1: Базовое использование

```typescript
// stores/counter.ts
import { Atom } from 'alak'

class CounterModel {
  count = 0

  increment() {
    this.count++
  }
}

export const counter = Atom({ model: CounterModel })
```

```vue
<script setup>
import vueAtom from '@alaq/vue'
import { counter } from '@/stores/counter'

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

```typescript
// stores/form.ts
import { Atom } from 'alak'

class FormModel {
  username = ''
  email = ''

  get isValid() {
    return this.username.length > 0 && this.email.includes('@')
  }
}

export const form = Atom({ model: FormModel })

// Подписка на изменения
form.core.username.up((value) => {
  console.log('Username changed:', value)
})
```

```vue
<script setup>
import { watchVueAtom } from '@alaq/vue'
import { form } from '@/stores/form'

// Двусторонняя синхронизация: изменения в template обновят atom
const state = watchVueAtom(form)
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

```typescript
// stores/todos.ts
import { UnionConstructor, UnionModel } from 'alak'

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

export const todosAtom = facade.atoms.todos
```

```vue
<script setup>
import { watchVueAtom } from '@alaq/vue'
import { todosAtom } from '@/stores/todos'

const todos = watchVueAtom(todosAtom)
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

---

## Nucleus API Reference

### `nucleus.toRef()`

Создает Vue ref с односторонней синхронизацией (nucleus → ref).

```typescript
const count = N(0)
const countRef = count.toRef()

count(5)
console.log(countRef.value) // 5

countRef.value = 10
console.log(count()) // 5 (nucleus не изменился)
```

### `nucleus.toReactive()`

Создает Vue ref с двусторонней синхронизацией.

```typescript
const count = N(0)
const countRef = count.toReactive()

// nucleus → ref
count(5)
console.log(countRef.value) // 5

// ref → nucleus
countRef.value = 10
console.log(count()) // 10
```

**Особенность:** Автоматически предотвращает циклическую синхронизацию.

### `nucleus.syncWith(vueRef, bidirectional?)`

Синхронизирует nucleus с существующим Vue ref.

```typescript
const count = N(0)
const externalRef = ref(5)

// Двусторонняя (по умолчанию)
count.syncWith(externalRef)
console.log(count()) // 5

// Односторонняя (ref → nucleus)
count.syncWith(externalRef, false)
```

**Параметры:**
- `vueRef: Ref<T>` — Vue ref для синхронизации
- `bidirectional?: boolean` — двусторонняя синхронизация (default: true)

### `nucleus.asRef()`

Алиас для `toRef()`.

```typescript
const countRef = count.asRef() // то же что count.toRef()
```

### Примеры использования Nucleus

#### Глобальное состояние

```typescript
// stores/counter.ts
import { N } from '@alaq/nucleus'

const countNucleus = N(0)

export function useCounter() {
  return {
    count: countNucleus.toReactive(),
    increment: () => countNucleus(countNucleus() + 1),
    decrement: () => countNucleus(countNucleus() - 1)
  }
}
```

```vue
<script setup>
import { useCounter } from '@/stores/counter'

const { count, increment, decrement } = useCounter()
</script>

<template>
  <div>
    <p>Count: {{ count }}</p>
    <button @click="increment">+</button>
    <button @click="decrement">-</button>
  </div>
</template>
```

#### С computed nucleus

```typescript
// stores/user.ts
import { N } from '@alaq/nucleus'

const firstName = N('John')
const lastName = N('Doe')

const fullName = N()
  .from(firstName, lastName)
  .weak((first, last) => `${first} ${last}`)

export function useUser() {
  return {
    firstName: firstName.toReactive(),
    lastName: lastName.toReactive(),
    fullName: fullName.toRef()
  }
}
```

```vue
<script setup>
import { useUser } from '@/stores/user'

const { firstName, lastName, fullName } = useUser()
</script>

<template>
  <div>
    <input v-model="firstName" placeholder="First Name" />
    <input v-model="lastName" placeholder="Last Name" />
    <p>Full Name: {{ fullName }}</p>
  </div>
</template>
```

#### Формы

```typescript
// stores/emailForm.ts
import { N } from '@alaq/nucleus'

const emailNucleus = N('')

const isValidNucleus = N()
  .from(emailNucleus)
  .weak(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))

export function useEmailForm() {
  return {
    email: emailNucleus.toReactive(),
    isValid: isValidNucleus.toRef()
  }
}
```

```vue
<script setup>
import { useEmailForm } from '@/stores/emailForm'

const { email, isValid } = useEmailForm()
</script>

<template>
  <form>
    <input v-model="email" type="email" />
    <span v-if="!isValid">Invalid email</span>
  </form>
</template>
```

#### Работа с atom.core

VueNucleusPlugin отлично работает с nucleus внутри atoms:

```typescript
// stores/userProfile.ts
import { Atom } from 'alak'

class UserProfileModel {
  firstName = 'John'
  lastName = 'Doe'
  age = 30

  get fullName() {
    return `${this.firstName} ${this.lastName}`
  }
}

export const userProfile = Atom({ model: UserProfileModel })
```

```vue
<script setup>
import { userProfile } from '@/stores/userProfile'

// Создаем ref для каждого nucleus в atom.core
const firstName = userProfile.core.firstName.toReactive()
const lastName = userProfile.core.lastName.toReactive()
const age = userProfile.core.age.toReactive()
</script>

<template>
  <div>
    <input v-model="firstName" placeholder="First Name" />
    <input v-model="lastName" placeholder="Last Name" />
    <input v-model.number="age" type="number" placeholder="Age" />
    <p>Full Name: {{ userProfile.state.fullName }}</p>
  </div>
</template>
```

Или используйте composable:

```typescript
// composables/useUserProfile.ts
import { userProfile } from '@/stores/userProfile'

export function useUserProfile() {
  return {
    firstName: userProfile.core.firstName.toReactive(),
    lastName: userProfile.core.lastName.toReactive(),
    age: userProfile.core.age.toReactive(),
    fullName: () => userProfile.state.fullName
  }
}
```

```vue
<script setup>
import { useUserProfile } from '@/composables/useUserProfile'

const { firstName, lastName, age, fullName } = useUserProfile()
</script>

<template>
  <div>
    <input v-model="firstName" placeholder="First Name" />
    <input v-model="lastName" placeholder="Last Name" />
    <input v-model.number="age" type="number" placeholder="Age" />
    <p>Full Name: {{ fullName() }}</p>
  </div>
</template>
```

---

## Лицензия

TVR
