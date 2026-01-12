# @alaq/atom — The State Layer

> Реактивная материя. Превращает классы и объекты в живые, самоуправляемые реактивные структуры.

Пакет `@alaq/atom` — это мост между абстрактной мощью `@alaq/nucleus` и прикладным кодом. Он берет обычные JS/TS классы и "оживляет" их, превращая каждое свойство в `Nucleus`.

В метафоре "Облака Электронов", `Atom` — это **материя**. Она имеет структуру (поля класса), массу (данные) и поведение (методы).

## Установка

```bash
npm install @alaq/atom
```

## Философия: Прозрачная Реактивность

Atom позволяет писать код в стиле ООП, автоматически добавляя реактивность "под капот". Вам не нужно вручную создавать `N()`, подписываться и обновлять их. Вы просто меняете свойство `this.count = 1`, и Atom делает всё остальное.

## Архитектура Атома

Когда вы оборачиваете модель в `Atom`, создается структура из трех частей:

1.  **Core (Ядро)**: Прямой доступ к `Nucleus` каждого свойства.
    *   `atom.core.count` — это `Nucleus<number>`.
    *   Используется для подписок: `atom.core.count.up(...)`.
2.  **State (Состояние)**: Объект-фасад для чтения/записи значений.
    *   `atom.state.count = 5` — триггерит обновление.
    *   `console.log(atom.state.count)` — читает текущее значение.
3.  **Actions (Действия)**: Методы вашей модели, обернутые в контекст атома.
    *   `atom.actions.increment()` — вызывает метод модели.

---

## Примеры использования

### 1. Простая модель (Counter)

```typescript
import { Atom } from '@alaq/atom'

// Обычный класс. Никаких зависимостей от фреймворка внутри!
class CounterModel {
  count = 0

  increment() {
    this.count++ // Выглядит как мутация, но работает реактивно
  }
}

// Превращение в атом
const counter = Atom({ model: CounterModel })

// ПОДПИСКА (через core)
counter.core.count.up(val => console.log('Счет:', val))
// -> "Счет: 0"

// ДЕЙСТВИЕ (через actions или state)
counter.actions.increment()
// -> "Счет: 1"

counter.state.count = 10
// -> "Счет: 10"
```

### 2. Вычисляемые свойства (Getters as Quarks)

Геттеры класса автоматически превращаются в вычисляемые `Nucleus` (кварки).

```typescript
class User {
  firstName = 'Neo'
  lastName = 'Anderson'

  // Этот геттер станет реактивным!
  get fullName() {
    return `${this.firstName} ${this.lastName}`
  }
}

const user = Atom({ model: User })

user.core.fullName.up(name => console.log('Имя:', name))
// -> "Имя: Neo Anderson"

user.state.lastName = 'The One'
// -> "Имя: Neo The One"
```

### 3. Сохранение состояния (Persistance)

Atom умеет автоматически синхронизировать поля с внешними хранилищами (например, `localStorage`) через метаданные `saved`.

```typescript
import { Atom, saved } from '@alaq/atom'

class Settings {
  // 'dark' - значение по умолчанию
  // Автоматически загрузится из localStorage при старте
  // И сохранится при изменении
  theme = saved('dark') 
  
  volume = saved(50)
  
  // Обычное свойство, не сохраняется
  tempValue = 0
}

const settings = Atom({ 
  model: Settings,
  name: 'app-settings', // Ключ-префикс в localStorage
  saved: '*' // Разрешить сохранение всех полей, помеченных saved
})
```

### 4. Метаданные (Tags & Mixed)

Вы можете "тегировать" свойства для добавления кастомной логики или комбинировать поведение.

```typescript
import { Atom, tag, saved, mixed } from '@alaq/atom'

class Product {
  // tag.id - просто метка, которую можно прочитать через reflection
  id = tag.id('prod-123') 
  
  // mixed - объединяет несколько модификаторов
  // saved - сохранять
  // tag.sync - метка для синхронизации с сервером
  price = mixed(saved, tag.sync, 99.99)
}
```

## API Reference

### Фабрика `Atom(options)`
Создает экземпляр атома.
*   `model`: Класс или конструктор модели.
*   `name`: Имя атома (для отладки и localStorage).
*   `saved`: Стратегия сохранения (например, `'*'` или массив полей).

### Экземпляр Атома
*   `.core`: Объект с `Nucleus` для каждого поля.
*   `.state`: Proxy-объект для прямого доступа к значениям.
*   `.actions`: Обернутые методы модели.
*   `.bus`: Встроенная шина событий.
*   `.decay()`: Уничтожить атом (отписать всех слушателей).

### Хелперы полей
*   `saved(value)`: Пометить поле для сохранения.
*   `tag.xyz(value)`: Добавить мета-тег `xyz`.
*   `mixed(wrapper1, wrapper2, value)`: Применить несколько оберток.

---
Лицензия: TVR