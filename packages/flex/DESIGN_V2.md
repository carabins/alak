# FxLayout v2 - Design Specification

## Проблемы текущей архитектуры

| Проблема | Причина | Решение v2 |
|----------|---------|------------|
| Нет measure pass | Layout сразу назначает размеры | Two-pass: measure → layout |
| Хрупкий приоритет размеров | `explicit → _layoutW → super.width` | Явная система constraints |
| Invalidation не всплывает | Child не уведомляет parent | `requestMeasure()` bubbling |
| Origin rule конфликтует с центрированием | Жёсткое требование 0,0 | Layout Bounds vs Visual Origin |
| Label центрирует anchor | Нарушает layout bounds | Центрирование через позицию, не anchor |

---

## 1. Core Concept: Layout Bounds vs Visual Origin

### Проблема
```
┌─────────────────────────────┐
│  Layout wants (0,0)         │
│  But Text looks better      │
│  centered visually          │
└─────────────────────────────┘
```

### Решение: Layout Box
Каждый FxNode имеет **layout box** - прямоугольник, которым управляет parent.
Внутри этого box компонент рисует как хочет.

```typescript
// Parent устанавливает layout box:
child._layoutBox = { x: 10, y: 20, width: 100, height: 50 }

// Child позиционирует себя внутри box:
// - Для Label: центрирует текст внутри box
// - Для Image: растягивает/fit внутри box
// - Для Button: центрирует контент внутри box
```

### Визуализация
```
Parent VGroup (width=300)
├── Label "Hello" (contentAlign: center)
│   └── layoutBox: {x:0, y:0, w:300, h:30}
│   └── text positioned at: x=150 (center of box)
│
├── Image (contentAlign: fill)
│   └── layoutBox: {x:0, y:30, w:300, h:100}
│   └── sprite stretched to fill box
```

---

## 2. Two-Pass Layout System

### Pass 1: Measure (Bottom-Up)
Каждый node возвращает свой **desired size** - размер, который он хочет занять.

```typescript
interface MeasureResult {
  width: number   // desired width
  height: number  // desired height
  minWidth?: number
  minHeight?: number
}

// Leaf nodes (Label, Image) measure their content
// Container nodes measure children and sum/max based on direction
```

### Pass 2: Layout (Top-Down)
Parent назначает каждому child его **final bounds**.

```typescript
interface LayoutBox {
  x: number
  y: number
  width: number
  height: number
}

// Parent calls: child.applyLayout(box)
// Child stores box and positions its visuals
```

### Пример: VGroup с 3 детьми
```
1. MEASURE PASS (bottom-up):
   - Child1.measure() → { width: 100, height: 30 }
   - Child2.measure() → { width: 150, height: 40 }
   - Child3.measure() → { width: 80, height: 25 }
   - VGroup.measure() → { width: 150, height: 95+gaps }

2. LAYOUT PASS (top-down):
   - VGroup receives: applyLayout({x:0, y:0, w:300, h:200})
   - VGroup calculates and calls:
     - Child1.applyLayout({x:?, y:0, w:?, h:30})
     - Child2.applyLayout({x:?, y:30+gap, w:?, h:40})
     - Child3.applyLayout({x:?, y:70+gap*2, w:?, h:25})
```

---

## 3. Size Resolution System

### Приоритет (от высшего к низшему):

```typescript
enum SizeMode {
  EXPLICIT,    // width={100} - fixed pixels
  PERCENT,     // percentWidth={50} - % of parent
  FLEX_GROW,   // flexGrow={1} - share remaining space
  CONTENT,     // default - measure from content
}
```

### Constraints Flow
```
Parent provides: availableWidth, availableHeight
Child resolves:
  1. If explicit → use explicit
  2. If percent → calculate from available
  3. If flexGrow → will be calculated after siblings measured
  4. Else → use measured content size
```

### Пример
```tsx
<VGroup width={400} height={300}>
  <Label text="Title" />           // CONTENT: measures text
  <Image percentHeight={50} />     // PERCENT: 150px (50% of 300)
  <Spacer flexGrow={1} />          // FLEX_GROW: remaining space
  <Button height={40} />           // EXPLICIT: 40px
</VGroup>
```

---

## 4. Content Alignment (внутри layout box)

### Для контейнеров (VGroup, HGroup)
```typescript
interface ContainerProps {
  // Как выравнивать children внутри container
  horizontalAlign: 'left' | 'center' | 'right' | 'stretch'
  verticalAlign: 'top' | 'middle' | 'bottom' | 'stretch'

  // Как распределять extra space
  justifyContent: 'start' | 'center' | 'end' | 'space-between' | 'space-around'
}
```

### Для leaf nodes (Label, Image)
```typescript
interface LeafProps {
  // Как позиционировать контент внутри своего layout box
  contentAlign: 'topLeft' | 'center' | 'fill' | 'contain' | 'cover'
}
```

### ✅ РЕШЕНО: Дефолты
```typescript
// Containers: CENTER by default (most common UI case)
VGroup.defaults = { horizontalAlign: 'center', verticalAlign: 'top' }
HGroup.defaults = { verticalAlign: 'middle', horizontalAlign: 'left' }

// Leafs: center content by default
Label.defaults = { contentAlign: 'center' }
Image.defaults = { contentAlign: 'contain' }
Button.defaults = { contentAlign: 'center' }
```

---

## 5. Invalidation & Batching

### Trigger Chain
```
1. Property change (text, size, etc.)
   ↓
2. this.invalidateMeasure()
   ↓
3. Bubble up to root: parent.invalidateMeasure()
   ↓
4. Root schedules: requestAnimationFrame(fullLayoutPass)
   ↓
5. Single RAF: measure all → layout all
```

### Optimization: Layout-only invalidation
```typescript
// Some changes don't affect measure (e.g., alignment)
this.invalidateLayout()  // skips measure, only re-layouts
```

---

## 6. API Design

### FxNode (base class)
```typescript
abstract class FxNode extends Container {
  // === Size Props ===
  width?: number          // explicit width
  height?: number         // explicit height
  percentWidth?: number   // 0-100
  percentHeight?: number  // 0-100
  flexGrow?: number       // flex grow factor

  // === Layout Box (set by parent) ===
  protected _box: LayoutBox = { x: 0, y: 0, width: 0, height: 0 }

  // === Abstract Methods ===
  abstract measure(availW: number, availH: number): MeasureResult
  abstract applyLayout(box: LayoutBox): void

  // === Invalidation ===
  protected invalidateMeasure(): void
  protected invalidateLayout(): void
}
```

### FxContainer (VGroup, HGroup base)
```typescript
abstract class FxContainer extends FxNode {
  gap: number = 0
  padding: number | { top, right, bottom, left } = 0

  horizontalAlign: HAlign = 'stretch'
  verticalAlign: VAlign = 'top'

  // Direction-specific
  abstract readonly direction: 'vertical' | 'horizontal'
}
```

### FxLabel
```typescript
class FxLabel extends FxNode {
  text: string | IQ<string>
  style: TextStyle
  contentAlign: ContentAlign = 'center'  // default center!

  measure() {
    // Return text bounds
  }

  applyLayout(box) {
    // Position text based on contentAlign within box
  }
}
```

---

## 7. Size Directives (Shortcuts)

### Проблема
Часто используемые комбинации размеров требуют много кода:
```tsx
// Слишком многословно:
<VGroup percentWidth={100} percentHeight={100}>
<Label percentWidth={50}>
```

### Решение: Директивы
```typescript
// Boolean shortcuts - разворачиваются в percent props
interface SizeDirectives {
  // Full size
  fullSpace?: boolean    // percentWidth={100} percentHeight={100}
  fullWidth?: boolean    // percentWidth={100}
  fullHeight?: boolean   // percentHeight={100}

  // Half size
  halfWidth?: boolean    // percentWidth={50}
  halfHeight?: boolean   // percentHeight={50}
  halfSpace?: boolean    // percentWidth={50} percentHeight={50}

  // Third size
  thirdWidth?: boolean   // percentWidth={33.333}
  thirdHeight?: boolean  // percentHeight={33.333}

  // Quarter size
  quarterWidth?: boolean   // percentWidth={25}
  quarterHeight?: boolean  // percentHeight={25}
}
```

### Usage
```tsx
// Before:
<VGroup percentWidth={100} percentHeight={100}>
  <Panel percentWidth={50} percentHeight={100}>

// After:
<VGroup fullSpace>
  <Panel halfWidth fullHeight>
```

### Альтернатива: Строковый синтаксис
```tsx
// Можно также поддержать:
<VGroup size="full">        // fullSpace
<Panel size="half-width">   // halfWidth
<Label size="100% 50%">     // percentWidth={100} percentHeight={50}
```

### Приоритет
Директивы < explicit percent < explicit pixels
```tsx
// fullWidth игнорируется, используется percentWidth
<Label fullWidth percentWidth={80} />  // → percentWidth={80}

// percentWidth игнорируется, используется width
<Label percentWidth={80} width={100} />  // → width={100}
```

---

## 8. Pixi Children Wrapper (FxBox)

### Проблема
Пользователь хочет добавить сырой Pixi объект (Sprite, Graphics, ParticleContainer)
в FxLayout. Но сырые объекты не имеют measure/applyLayout.

### Решение: FxBox
```typescript
// FxBox - универсальный wrapper для любого Pixi контента
class FxBox extends FxNode {
  // Принимает Pixi children и управляет их позиционированием
  contentAlign: ContentAlign = 'center'

  constructor(props) {
    // Children - это raw Pixi objects
    this.addChild(...props.children)
  }

  measure(availW, availH) {
    // Измеряет bounds всех children
    const bounds = this.getLocalBounds()
    return { width: bounds.width, height: bounds.height }
  }

  applyLayout(box) {
    // Позиционирует children внутри box согласно contentAlign
    this._box = box
    this.x = box.x
    this.y = box.y

    // Центрирование children внутри box
    if (this.contentAlign === 'center') {
      const bounds = this.getLocalBounds()
      const offsetX = (box.width - bounds.width) / 2 - bounds.x
      const offsetY = (box.height - bounds.height) / 2 - bounds.y
      this.children.forEach(c => {
        c.x += offsetX
        c.y += offsetY
      })
    }
  }
}
```

### Usage
```tsx
import { Graphics } from 'pixi.js'

// Произвольная графика внутри layout
<FxVGroup>
  <FxLabel text="Score" />

  <FxBox width={200} height={100} contentAlign="center">
    {/* Raw Pixi Graphics */}
    <Graphics>
      {(g) => g.circle(0, 0, 30).fill(0xff0000)}
    </Graphics>
  </FxBox>

  <FxButton label="Play" />
</FxVGroup>
```

### FxBox vs FxGroup
```
FxBox   - для raw Pixi content, сам не делает layout детей
FxGroup - базовый layout container, дети должны быть FxNode
```

---

## 9. ✅ Resolved Decisions

| Вопрос | Решение |
|--------|---------|
| Default contentAlign | `center` |
| Default horizontalAlign (VGroup) | `center` |
| Default verticalAlign (HGroup) | `middle` |
| Nested percents | Относительно immediate parent |
| Raw Pixi children | Через `FxBox` wrapper (отложено для примеров) |

---

## 10. Implementation Order

```
Step 1: FxNode base class with measure/applyLayout interface
Step 2: FxRoot - root container that triggers layout passes
Step 3: FxVGroup - vertical stacking with gap/padding
Step 4: FxLabel - text with contentAlign
Step 5: FxHGroup - horizontal stacking
Step 6: FxImage - sprite with contentAlign (fill/contain/cover)
Step 7: Percent sizes
Step 8: FlexGrow
Step 9: Reactive bindings (Quark integration)
Step 10: Flow control (Match/Case)
```

---

## 11. Usage Example (Target DX)

```tsx
import { FxVGroup, FxHGroup, FxLabel, FxImage, FxButton, FxSpacer, FxBox, mount } from '@alaq/flex'
import { Graphics } from 'pixi.js'

// Simple card - всё центрировано по дефолту
const PlayerCard = ({ player }) => (
  <FxVGroup gap={10} padding={20} fullWidth>

    {/* Header row - verticalAlign="middle" уже дефолт для HGroup */}
    <FxHGroup gap={15}>
      <FxImage
        source={player.$avatar}
        width={64}
        height={64}
        contentAlign="cover"
      />
      <FxVGroup>
        <FxLabel text={player.$name} style={{ fontWeight: 'bold' }} />
        <FxLabel text={player.$status} alpha={0.7} />
      </FxVGroup>
    </FxHGroup>

    {/* Raw Pixi graphics через FxBox */}
    <FxBox width={100} height={20}>
      <Graphics>
        {(g) => g.rect(0, 0, player.hp, 20).fill(0x00ff00)}
      </Graphics>
    </FxBox>

    {/* Spacer pushes button to bottom */}
    <FxSpacer flexGrow={1} />

    {/* Button - центрирован по дефолту */}
    <FxButton
      label="Heal"
      onPress={() => player.heal(10)}
      fullWidth  // растянуть на всю ширину
    />

  </FxVGroup>
)

// Full screen layout
const GameUI = () => (
  <FxVGroup fullSpace padding={20}>
    <FxLabel text="GAME TITLE" style={{ fontSize: 48 }} />
    <FxSpacer flexGrow={1} />
    <PlayerCard player={playerData} />
  </FxVGroup>
)

// Mount
const app = new Application()
await app.init({ width: 800, height: 600 })

mount(() => <GameUI />, app.stage)
```

### Директивы в действии
```tsx
// Простой двухколоночный layout
<FxHGroup fullSpace gap={20}>
  <FxVGroup halfWidth fullHeight>
    <FxLabel text="Left Panel" />
  </FxVGroup>
  <FxVGroup halfWidth fullHeight>
    <FxLabel text="Right Panel" />
  </FxVGroup>
</FxHGroup>

// Grid 2x2
<FxVGroup fullSpace>
  <FxHGroup halfHeight fullWidth>
    <FxBox quarterWidth quarterHeight>Cell 1</FxBox>
    <FxBox quarterWidth quarterHeight>Cell 2</FxBox>
  </FxHGroup>
  <FxHGroup halfHeight fullWidth>
    <FxBox quarterWidth quarterHeight>Cell 3</FxBox>
    <FxBox quarterWidth quarterHeight>Cell 4</FxBox>
  </FxHGroup>
</FxVGroup>
```
