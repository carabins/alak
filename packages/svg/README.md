# @alaq/svg

> Утилиты для работы с SVG элементами

Библиотека для удобной работы с SVG DOM, созданием элементов и трансформациями.

## Установка

```bash
npm install @alaq/svg
```

## Использование

```typescript
import SvgNode from '@alaq/svg'

// Создание SVG элементов
const svg = SvgNode('svg')
  .attr.width(500)
  .attr.height(500)

const circle = svg.addChild.circle
  .attr.cx(250)
  .attr.cy(250)
  .attr.r(50)
  .attr.fill('red')

// Трансформации
circle.transform
  .translate(100, 100)
  .rotate(45)
  .scale(1.5)

// Работа с координатами
const center = circle.center.get()
console.log(center.x, center.y)
```

## Возможности

- ✅ Fluent API для создания элементов
- ✅ Цепочка трансформаций
- ✅ Работа с центральными координатами
- ✅ TypeScript типизация

## Лицензия

TVR
