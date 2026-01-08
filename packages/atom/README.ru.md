# @alaq/atom

**Реактивный оркестратор состояния на базе классов.**

[![Read in English](https://img.shields.io/badge/Language-English-blue)](./README.md)

Atom — это самый мощный и удобный инструмент в экосистеме Alaq. Он позволяет превращать обычные JavaScript/TypeScript классы в высокопроизводительные реактивные модели (сторы) с автоматическим отслеживанием зависимостей.

### 📦 Установка

```bash
bun add @alaq/atom
# или
npm install @alaq/atom
```

---

### 🛠 Быстрый старт

Для максимальной производительности (450k ops/ms) используйте предварительную компиляцию через `Atom.define`.

```typescript
import { Atom, kind } from '@alaq/atom';
import '@alaq/nucl/presets/std'; 

class CounterStore {
  count = 0;
  history = kind('std', []);

  get doubled() {
    return this.count * 2;
  }

  increment() {
    this.count++;
    this.history.push(this.count);
  }
}

// 1. Компиляция схемы (делается один раз)
const Counter = Atom.define(CounterStore);

// 2. Создание инстанса (мгновенно)
const counter = Counter.create(); 
// или Counter.get('main') для синглтона/Identity Map

counter.$count.up(val => console.log('Count:', val));
counter.increment();
```

---

### ⚡ Производительность

Благодаря архитектуре Zero-Proxy и JIT-компиляции схемы, Atom быстрее всех конкурентов создает экземпляры.

| Метрика | @alaq/atom (Compiled) | Signals (Preact) | Vue (Ref) | MobX |
| :--- | :--- | :--- | :--- | :--- |
| **Создание (Create)** | **~450k ops/ms** | ~85k ops/ms | ~18k ops/ms | ~7k ops/ms |
| **Чтение (Read)** | **~95k ops/ms** | ~150k ops/ms | ~90k ops/ms | ~100k ops/ms |
| **Память (1 млн)** | **~180 MB** | ~80 MB | ~120 MB | ~240 MB |

*> Бенчмарки проведены на Bun v1.3. Подробный отчет: [BENCHMARK_REPORT.ru.md](../../BENCHMARK_REPORT.ru.md)*
