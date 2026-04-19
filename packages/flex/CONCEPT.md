# @alaq/flex: Reactive UI Framework for PixiJS

**The rebirth of Flex layout engine for the modern WebGL era.**

`@alaq/flex` is a high-performance UI library that combines the legendary layout API of Adobe Flex with Alaq's proactive reactivity. It is designed to build complex game UIs, HUDs, and administrative panels with zero runtime overhead.

## 1. Philosophy

### A. Reactive Binding over Reconciliation
We don't use a Virtual DOM. Components are created once. Instead of re-rendering the whole tree, we bind individual properties to reactive sources (Quarks/Nucl). When data changes, only the specific property (e.g., `text` or `alpha`) is updated.

### B. Functional Composition (TSX)
Use TSX/JSX as a beautiful syntax for tree construction. It compiles down to simple function calls. No hooks, no state magic — just functions returning Pixi objects.

### C. Percent-based Layout
Native support for `percentWidth` and `percentHeight`. The layout engine (powered by Yoga) ensures your UI scales perfectly across mobile and desktop.

---

## 2. Component Types

### Layout Groups
*   **`Group`**: Basic container with absolute positioning.
*   **`VGroup`**: Vertical stack with `gap` and `padding`.
*   **`HGroup`**: Horizontal stack.
*   **`TileGroup`**: Grid layout for items.

### Visual Components
*   **`Label`**: High-performance text.
*   **`Image`**: Sprites and textures.
*   **`Button`**: Interactive element with skins.
*   **`Scroller`**: Container for large content.

---

## 3. Example DX

```tsx
import { VGroup, HGroup, Label, Button, Image } from '@alaq/flex';

// A component is just a function
export const PlayerCard = ({ player }) => (
  <VGroup gap={10} padding={20} percentWidth={100} background="card_bg">
    <HGroup verticalAlign="middle" gap={15}>
      <Image source={player.$avatar} width={64} height={64} />
      <VGroup>
        <Label text={player.$name} style={{ fontWeight: 'bold' }} />
        <Label text={player.$status} alpha={0.7} />
      </VGroup>
    </HGroup>
    
    <Button 
      label="Heal Player" 
      onClick={() => player.heal(10)} 
      enabled={player.$hp.map(h => h < 100)} 
    />
  </VGroup>
);
```
