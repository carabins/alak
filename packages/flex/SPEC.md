# @alaq/flex Technical Specification

## 1. Environment Abstraction (Worker Ready)

To support future migration to OffscreenCanvas, we never access global `window` or `document` directly.

*   `abstractWindow`: Provides `width`, `height`, `devicePixelRatio`.
*   `abstractDocument`: Interface for creating overlay elements (Input).
*   `OverlaySystem`: Bridge for syncing Canvas position with DOM elements.

## 2. Layout Engine (Native)

We implement a lightweight, recursive layout engine extending `PIXI.Container`.

### `LayoutBase`
*   **Two-Pass:**
    1.  `measure(w, h)`: Calculates desired size.
    2.  `layout(w, h)`: Positions children.
*   **Props:**
    *   `percentWidth`, `percentHeight`.
    *   `padding`, `margin`, `gap`.
    *   `horizontalAlign`, `verticalAlign`.

### Components
*   `VGroup`: Vertical stack.
*   `HGroup`: Horizontal stack.
*   `Spacer`: Flex grow utility.

## 3. Reactive Binding

*   **IQ Support:** Any prop can be a Quark.
*   **Invalidation:** Changing a layout prop (width, gap) triggers `requestLayout()`.

## 4. Components

1.  **Primitives:** `Label` (Text), `Image` (Sprite).
2.  **Widgets:** `Button` (Wrapper around Pixi logic or @pixi/ui if compatible).
3.  **Inputs:** `TextInput` (Uses `OverlaySystem`).

## 5. Control Flow

*   `<Match>`, `<Case>`, `<For>`.
*   Virtual components (no extra Containers).