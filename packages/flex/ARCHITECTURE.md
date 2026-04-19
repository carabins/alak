# FxLayout Architecture

## Концепция

**FxLayout** — виртуальный layout узел. Не является Pixi Container. Вычисляет абсолютные координаты через реактивные зависимости (quark/fusion) и добавляет Pixi объекты плоско в stage.

```
FxLayout (дерево)          →    stage (плоский список)
├── FxLayout                     ├── Text
│   ├── FxLabel                  ├── Text
│   └── FxLabel                  ├── Sprite
└── FxLabel                      └── Text
```

---

## Почему плоская структура

Вложенные Pixi Containers вызывали проблемы:
- При изменении размеров контейнера дети масштабировались
- Проблемы с центрированием
- Анимации (Motion) ломали layout

Плоская структура:
- Каждый объект имеет абсолютные координаты
- Изменение layout не влияет на размер визуальных объектов
- Анимации применяются к конкретным объектам

---

## Реактивная система

Все параметры — quarks с `dedup: true`. При изменении значения пересчитываются только зависимые элементы.

```typescript
// Параметры (input)
_gap: IQ<number>
_padding: IQ<number>
_direction: IQ<'V' | 'H'>
_horizontalAlign: IQ<'left' | 'center' | 'right'>
_verticalAlign: IQ<'top' | 'middle' | 'bottom'>
_width: IQ<number | undefined>       // explicit
_height: IQ<number | undefined>
_percentWidth: IQ<number | undefined>
_percentHeight: IQ<number | undefined>

// Computed (output)
_x: IQ<number>
_y: IQ<number>
_w: IQ<number>
_h: IQ<number>
```

**dedup** блокирует повторные вызовы если значение не изменилось.

---

## Вычисление размеров

### Приоритет

```
1. explicit (width={100})     → используем напрямую
2. percent (percentWidth={50}) → относительно parent (только если parent НЕ content-based)
3. content (getLocalBounds)   → из displayList
```

### isContentBased

Если parent не имеет explicit/percent размера — он content-based. Дети не могут использовать percent от content-based parent (избегаем циклов).

```typescript
const isContentBased = (layout: FxLayout, axis: 'w' | 'h') => {
  if (axis === 'w') {
    return !layout._width.value && !layout._percentWidth.value
  }
  if (axis === 'h') {
    return !layout._height.value && !layout._percentHeight.value
  }
}
```

### Вычисление _w/_h

```typescript
// Если explicit
if (this._width.value !== undefined) {
  this._w = this._width
}
// Если percent и parent не content-based
else if (this._percentWidth.value && !isContentBased(parent, 'w')) {
  this._w = fusion(parent._w, this._percentWidth)
    .any((pw, pct) => pw * pct / 100)
}
// Иначе content
else {
  // getLocalBounds() из displayList
  this._w = Qu({ dedup: true })
  this._w(this.getContentWidth())
}
```

---

## Вычисление позиции

### Direction V (вертикальный)

```typescript
// Y позиция — зависит от предыдущего sibling
if (index === 0) {
  child._y = fusion(parent._y, parent._padding)
    .any((py, pad) => py + pad)
} else {
  const prev = children[index - 1]
  child._y = fusion(prev._y, prev._h, parent._gap)
    .any((py, ph, gap) => py + ph + gap)
}

// X позиция — alignment
child._x = fusion(parent._x, parent._w, child._w, parent._padding, parent._horizontalAlign)
  .any((px, pw, cw, pad, align) => {
    if (align === 'center') return px + (pw - cw) / 2
    if (align === 'right') return px + pw - cw - pad
    return px + pad  // left
  })
```

### Direction H (горизонтальный)

```typescript
// X позиция — зависит от предыдущего sibling
if (index === 0) {
  child._x = fusion(parent._x, parent._padding)
    .any((px, pad) => px + pad)
} else {
  const prev = children[index - 1]
  child._x = fusion(prev._x, prev._w, parent._gap)
    .any((px, pw, gap) => px + pw + gap)
}

// Y позиция — alignment
child._y = fusion(parent._y, parent._h, child._h, parent._padding, parent._verticalAlign)
  .any((py, ph, ch, pad, align) => {
    if (align === 'middle') return py + (ph - ch) / 2
    if (align === 'bottom') return py + ph - ch - pad
    return py + pad  // top
  })
```

---

## Класс FxLayout

```typescript
import { Qu, Qv, IQ } from '@alaq/quark'
import { aliveFusion } from '@alaq/nucl'
import { Container, DisplayObject } from 'pixi.js'

class FxLayout {
  // === Дерево ===
  parent: FxLayout | null = null
  children: FxLayout[] = []
  displayList: DisplayObject[] = []

  // === Stage (общий для всех) ===
  static _stage: Container

  // === Отписки ===
  _unsubs: (() => void)[] = []

  // === Input параметры (quarks) ===
  _direction: IQ<'V' | 'H'>
  _gap: IQ<number>
  _padding: IQ<number>
  _horizontalAlign: IQ<'left' | 'center' | 'right'>
  _verticalAlign: IQ<'top' | 'middle' | 'bottom'>

  _width: IQ<number | undefined>
  _height: IQ<number | undefined>
  _percentWidth: IQ<number | undefined>
  _percentHeight: IQ<number | undefined>

  // === Computed (quarks) ===
  _x: IQ<number>
  _y: IQ<number>
  _w: IQ<number>
  _h: IQ<number>

  constructor(props: Record<string, any>) {
    // 1. Нормализация параметров в quarks
    this._direction = toQuark(props.direction, 'V')
    this._gap = toQuark(props.gap, 0)
    this._padding = toQuark(props.padding, 0)
    this._horizontalAlign = toQuark(props.horizontalAlign, 'center')
    this._verticalAlign = toQuark(props.verticalAlign, 'middle')

    this._width = toQuark(props.width, undefined)
    this._height = toQuark(props.height, undefined)
    this._percentWidth = toQuark(props.percentWidth, undefined)
    this._percentHeight = toQuark(props.percentHeight, undefined)

    // Shortcuts
    if (props.fullSpace) {
      this._percentWidth(100)
      this._percentHeight(100)
    }
    if (props.fullWidth) this._percentWidth(100)
    if (props.fullHeight) this._percentHeight(100)
    if (props.halfWidth) this._percentWidth(50)
    if (props.halfHeight) this._percentHeight(50)

    // 2. Computed quarks (будут связаны в addLayoutChild)
    this._x = Qu({ dedup: true })
    this._y = Qu({ dedup: true })
    this._w = Qu({ dedup: true })
    this._h = Qu({ dedup: true })

    // 3. Effect для вызова layout
    const unsub = aliveFusion(
      [this._x, this._y, this._w, this._h],
      (x, y, w, h) => this.layout(x, y, w, h)
    )
    this._unsubs.push(unsub)
  }

  // === Pixi объекты ===

  addChild(obj: DisplayObject) {
    this.displayList.push(obj)
    FxLayout._stage.addChild(obj)
  }

  removeChild(obj: DisplayObject) {
    const idx = this.displayList.indexOf(obj)
    if (idx !== -1) this.displayList.splice(idx, 1)
    FxLayout._stage.removeChild(obj)
  }

  // === Layout дети ===

  addLayoutChild(child: FxLayout) {
    child.parent = this
    this.children.push(child)

    const index = this.children.length - 1

    // Связать _w/_h child
    this._bindChildSize(child)

    // Связать _x/_y child
    this._bindChildPosition(child, index)
  }

  private _bindChildSize(child: FxLayout) {
    // Width
    if (child._width.value !== undefined) {
      // explicit — просто копируем
      child._w(child._width.value)
      child._unsubs.push(child._width.up(v => child._w(v)))
    }
    else if (child._percentWidth.value && !this._isContentBased('w')) {
      // percent
      const unsub = aliveFusion(
        [this._w, child._percentWidth],
        (pw, pct) => child._w(pw * pct / 100)
      )
      child._unsubs.push(unsub)
    }
    else {
      // content — из displayList
      child._w(child.getContentWidth())
    }

    // Height — аналогично
    if (child._height.value !== undefined) {
      child._h(child._height.value)
      child._unsubs.push(child._height.up(v => child._h(v)))
    }
    else if (child._percentHeight.value && !this._isContentBased('h')) {
      const unsub = aliveFusion(
        [this._h, child._percentHeight],
        (ph, pct) => child._h(ph * pct / 100)
      )
      child._unsubs.push(unsub)
    }
    else {
      child._h(child.getContentHeight())
    }
  }

  private _bindChildPosition(child: FxLayout, index: number) {
    const dir = this._direction.value

    if (dir === 'V') {
      // Y — от предыдущего sibling
      if (index === 0) {
        const unsub = aliveFusion(
          [this._y, this._padding],
          (py, pad) => child._y(py + pad)
        )
        child._unsubs.push(unsub)
      } else {
        const prev = this.children[index - 1]
        const unsub = aliveFusion(
          [prev._y, prev._h, this._gap],
          (py, ph, gap) => child._y(py + ph + gap)
        )
        child._unsubs.push(unsub)
      }

      // X — alignment
      const unsub = aliveFusion(
        [this._x, this._w, child._w, this._padding, this._horizontalAlign],
        (px, pw, cw, pad, align) => {
          if (align === 'center') child._x(px + (pw - cw) / 2)
          else if (align === 'right') child._x(px + pw - cw - pad)
          else child._x(px + pad)
        }
      )
      child._unsubs.push(unsub)
    }
    else {
      // H — аналогично, X и Y меняются местами
      if (index === 0) {
        const unsub = aliveFusion(
          [this._x, this._padding],
          (px, pad) => child._x(px + pad)
        )
        child._unsubs.push(unsub)
      } else {
        const prev = this.children[index - 1]
        const unsub = aliveFusion(
          [prev._x, prev._w, this._gap],
          (px, pw, gap) => child._x(px + pw + gap)
        )
        child._unsubs.push(unsub)
      }

      const unsub = aliveFusion(
        [this._y, this._h, child._h, this._padding, this._verticalAlign],
        (py, ph, ch, pad, align) => {
          if (align === 'middle') child._y(py + (ph - ch) / 2)
          else if (align === 'bottom') child._y(py + ph - ch - pad)
          else child._y(py + pad)
        }
      )
      child._unsubs.push(unsub)
    }
  }

  private _isContentBased(axis: 'w' | 'h'): boolean {
    if (axis === 'w') {
      return !this._width.value && !this._percentWidth.value
    }
    return !this._height.value && !this._percentHeight.value
  }

  // === Content size ===

  getContentWidth(): number {
    if (this.displayList.length === 0) return 0
    return Math.max(...this.displayList.map(d => d.getLocalBounds().width))
  }

  getContentHeight(): number {
    if (this.displayList.length === 0) return 0
    return Math.max(...this.displayList.map(d => d.getLocalBounds().height))
  }

  // === Layout (вызывается через aliveFusion) ===

  layout(x: number, y: number, w: number, h: number) {
    // Позиционирование displayList
    // Переопределяется в наследниках (FxLabel, etc.)
  }

  // === Cleanup ===

  destroy() {
    // Отписки
    this._unsubs.forEach(fn => fn())
    this._unsubs = []

    // Удалить displayList из stage
    this.displayList.forEach(obj => {
      FxLayout._stage.removeChild(obj)
      obj.destroy()
    })
    this.displayList = []

    // Рекурсивно уничтожить детей
    this.children.forEach(child => child.destroy())
    this.children = []

    this.parent = null
  }
}
```

---

## Helper: toQuark

```typescript
function toQuark<T>(value: T | IQ<T>, defaultValue: T): IQ<T> {
  if (value && (value as any).__q) {
    return value as IQ<T>
  }
  return Qv(value ?? defaultValue, { dedup: true })
}
```

---

## mount()

```typescript
function mount(root: FxLayout, stage: Container) {
  // 1. Установить stage
  FxLayout._stage = stage

  // 2. Инициализировать root размеры
  root._x(0)
  root._y(0)
  root._w(stage.width)
  root._h(stage.height)

  // 3. Слушать resize
  const onResize = () => {
    root._w(stage.width)
    root._h(stage.height)
  }

  window.addEventListener('resize', onResize)

  // 4. Вернуть unmount
  return () => {
    window.removeEventListener('resize', onResize)
    root.destroy()
  }
}
```

---

## FxLabel (пример наследника)

```typescript
class FxLabel extends FxLayout {
  private _text: Text
  private _textQuark: IQ<string>

  constructor(props: Record<string, any>) {
    super(props)

    // 1. Text quark
    this._textQuark = toQuark(props.text, '')

    // 2. Создать Pixi Text
    this._text = new Text({
      text: this._textQuark.value,
      style: props.style
    })

    // 3. Добавить в displayList + stage
    this.addChild(this._text)

    // 4. Подписка на изменение текста
    this._unsubs.push(
      this._textQuark.up(v => {
        this._text.text = v
        // Обновить content size
        this._w(this.getContentWidth())
        this._h(this.getContentHeight())
      })
    )
  }

  set text(v: string) {
    this._textQuark(v)
  }

  get text(): string {
    return this._textQuark.value
  }

  layout(x: number, y: number, w: number, h: number) {
    // Центрируем текст внутри box (contentAlign: center)
    const bounds = this._text.getLocalBounds()
    this._text.x = x + (w - bounds.width) / 2
    this._text.y = y + (h - bounds.height) / 2
  }
}
```

---

## Порядок инициализации

```
1. mount(root, stage)
   └── FxLayout._stage = stage

2. Конструктор root
   └── создаёт quarks
   └── создаёт aliveFusion для layout

3. JSX разворачивается, вызываются конструкторы детей
   └── каждый child создаёт свои quarks
   └── addChild() добавляет displayList в stage

4. addLayoutChild() связывает родителей и детей
   └── создаёт fusion зависимости для _x/_y/_w/_h

5. mount() устанавливает root._x/_y/_w/_h
   └── aliveFusion срабатывает
   └── layout() вызывается для root
   └── каскадом для всех детей

6. При изменении любого параметра
   └── quark обновляется
   └── dedup проверяет изменилось ли
   └── fusion пересчитывает зависимые
   └── layout() вызывается только для изменённых
```

---

## Дефолты

```typescript
direction: 'V'
gap: 0
padding: 0
horizontalAlign: 'center'
verticalAlign: 'middle'
contentAlign: 'center'  // для FxLabel, FxImage
```

---

## Shortcuts (директивы)

```typescript
fullSpace    → percentWidth: 100, percentHeight: 100
fullWidth    → percentWidth: 100
fullHeight   → percentHeight: 100
halfWidth    → percentWidth: 50
halfHeight   → percentHeight: 50
halfSpace    → percentWidth: 50, percentHeight: 50
thirdWidth   → percentWidth: 33.333
quarterWidth → percentWidth: 25
```

---

## TODO

- [ ] Вставка child между существующими (пересоздание fusion)
- [ ] Удаление child из середины (пересоздание fusion для следующих)
- [ ] FxBox — wrapper для raw Pixi объектов
- [ ] Motion интеграция
- [ ] Match/For/If — flow control с кэшированием
