# LayoutBase Architecture & Guide

`LayoutBase` is the foundational class for the Alaq Flex UI system, bridging PixiJS rendering with a flex-like layout engine.

## 1. Core Concept: Two-Pass Layout

Layouts are calculated in two phases to handle reactive updates efficiently.

### Phase 1: Invalidation
Any property change (size, gap, content) triggers `this.invalidate()`.
This schedules a render update for the next animation frame via `requestRender()`.

### Phase 2: Validation (Layout)
The system calls `validate()`, which triggers `layout(width, height)`.
Children calculate their size and position based on the provided constraints.

## 2. Coordinate System & Anchors

**Critical Rule:** All Flex components assume their content starts at local coordinate `(0, 0)`.
- **Top-Left Origin:** Visual content must extend from `0,0` to `width,height`.
- **Anchors:** Avoid using `anchor=0.5` (center) on children unless you manually compensate for the offset.
- **Negative Coordinates:** If a child draws at `x=-50`, the layout engine will miscalculate alignment, causing visual shifts.

## 3. Sizing Logic (`get width / height`)

The size of a component is determined by priority:
1.  **Explicit Size:** `width={100}` (Set via props).
2.  **Layout Size:** `_layoutW` (Calculated by parent container during layout pass).
3.  **Content Size:** `super.width` (The actual bounding box of Pixi children).

*This ensures that empty containers (like Spacers) take up space, while content-based containers grow to fit their children.*

## 4. Alignment (`VGroup` / `HGroup`)

Alignment logic (`horizontalAlign`) relies on the parent's known width (`w`) and the child's reported width (`child.width`).

Formula: `x = (parentWidth - childWidth) / 2` (for center).

**Troubleshooting Misalignment:**
- If items appear shifted left: `childWidth` might be reported larger than visual content (e.g., invisible effects).
- If items appear cut off/shifted: Child might have `anchor=0.5` or negative drawing coordinates.

## 5. Pixi UI Integration (`Widgets.ts`)

When wrapping external Pixi UI components (like `FancyButton`):
- Ensure `anchor` is set to `0` (top-left).
- Ensure events (`onPress`) are wired correctly.
- Be aware that some Pixi UI components might enforce their own internal sizing logic.

## 6. Debugging

Enable `window.DEBUG_LAYOUT = true` in the console to visualize:
- **Red Border:** The logical layout bounds (`_layoutW`, `_layoutH`).
- If content extends outside this border, it indicates an Origin/Anchor issue.
