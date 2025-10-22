# @alaq/datastruct

> Специализированные структуры данных

Набор оптимизированных структур данных для специфических задач.

## Установка

```bash
npm install @alaq/datastruct
```

## Структуры данных

### IndexedVertexMap

Индексированная карта вершин для работы с графами и связанными структурами.

```typescript
import { IndexedVertexMap } from '@alaq/datastruct'

const map = new IndexedVertexMap()

// Добавление вершин
map.add(vertex1)
map.add(vertex2)

// Получение по индексу
const vertex = map.get(0)

// Итерация
map.forEach((vertex, index) => {
  console.log(index, vertex)
})
```

## Лицензия

TVR
