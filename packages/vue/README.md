# @alaq/vue

**Native Vue 3 reactivity bridge for Alaq v6.**

[![Читать на русском](https://img.shields.io/badge/Language-Russian-red)](#russian)

Alaq v6 integration for Vue 3 is built on a "zero-proxy" philosophy. Instead of creating expensive wrappers or watchers, Alaq nodes (Nucleons and Atoms) hook directly into Vue's internal `track` and `trigger` mechanisms.

### 🚀 Key Features

- **Zero Overhead**: No extra `ref()` or `reactive()` objects created. Alaq nodes *become* Vue Refs.
- **Native Experience**: Use Alaq Atoms directly in templates, `v-model`, `watch`, and `computed`.
- **Automatic Unwrapping**: `{{ atom.prop }}` works without `.value` thanks to `__v_isRef` compliance.
- **Deep Integration**: Works seamlessly with Alaq's event bus and plugin system.

---

### 📦 Installation

```bash
bun add @alaq/vue
```

---

### 🛠 Quick Start

#### 1. Initialize Integration
Call `setupAlaqVue()` once at your application entry point (e.g., `main.ts`).

```typescript
import { setupAlaqVue } from '@alaq/vue'

// This makes all Alaq nodes reactive for Vue globally
setupAlaqVue()
```

#### 2. Use in Vue Components
Simply use Alaq Atoms as you would use any reactive object.

```typescript
import { Atom } from '@alaq/atom'

class CounterModel {
  count = 0
  inc() { this.count++ }
}

const counter = Atom(CounterModel)

// In your Vue component:
// <template>
//   <div>Count: {{ counter.count }}</div>
//   <button @click="counter.inc()">Increment</button>
// </template>
```

---

### 🧪 Advanced Usage

#### Manual Tracking
If you want to use Alaq Nucleons as standalone Refs:

```typescript
import { Nu } from '@alaq/nucl'
import { watch } from 'vue'

const count = Nu({ value: 0 })

watch(count, (val) => {
  console.log('Vue saw Alaq change:', val)
})

count(10) // Triggers Vue watch
```

---

<a name="russian"></a>
## Русский

**Нативный мост реактивности Vue 3 для Alaq v6.**

Интеграция Alaq v6 для Vue 3 построена на философии «zero-proxy». Вместо создания тяжелых оберток или вотчеров, узлы Alaq (нуклоны и атомы) подключаются напрямую к внутренним механизмам Vue `track` и `trigger`.

### 🚀 Основные преимущества

- **Нулевые накладные расходы**: Никаких лишних объектов `ref()` или `reactive()`. Узлы Alaq *становятся* Vue Ref-ами.
- **Нативный опыт**: Используйте атомы Alaq напрямую в шаблонах, `v-model`, `watch` и `computed`.
- **Автоматический unwrap**: `{{ atom.prop }}` работает без `.value` благодаря поддержке `__v_isRef`.
- **Глубокая интеграция**: Полная совместимость с шиной событий и системой плагинов Alaq.

### 🛠 Быстрый старт

1. Вызовите `setupAlaqVue()` один раз при старте приложения.
2. Используйте атомы Alaq в компонентах как обычные реактивные объекты.
