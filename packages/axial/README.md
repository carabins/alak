# @alaq/axial

UnoCSS plugin for axial semantics utility classes that provide a flexible way to manage layout using X/Y axis concepts.

## Features

- **Container classes**: `x-group` (flex row) and `y-group` (flex column)
- **Percentage modifiers**: `x-percent-N` and `y-percent-N` (where N is 10, 20, ..., 100)
- **Fixed size modifiers**: `x-fixed` and `y-fixed` for fixed width/height
- **Flex grow modifiers**: `x-flex-N` and `y-flex-N` (where N is positive integer)
- **Alignment classes**: 
  - X-axis: `x-center`, `x-start`, `x-end`, `x-between`, `x-around`, `x-evenly`
  - Y-axis: `y-center`, `y-start`, `y-end`, `y-between`, `y-around`, `y-evenly`

## Installation

```bash
npm install @alaq/axial
```

## Usage

```js
// uno.config.js
import { defineConfig } from 'unocss'
import { axial } from '@alaq/axial'

export default defineConfig({
  plugins: [
    axial()
  ]
})
```

## Examples

### HTML Usage
```html
<div class="x-group x-between y-center">
  <div class="x-percent-25 y-fixed">Sidebar</div>
  <div class="x-flex-1 y-fixed">Main content</div>
  <div class="x-percent-25 y-fixed">Sidebar</div>
</div>
```

### CSS @apply Usage
```css
.header {
  @apply x-group x-center x-percent-90 y-fixed;
}
```

## API

### Container Classes
- `x-group` - Creates a flex container with row direction
- `y-group` - Creates a flex container with column direction

### Size Modifiers
- `x-percent-{N}` - Sets width to N% (N: 10, 20, ..., 100)
- `y-percent-{N}` - Sets height to N% (N: 10, 20, ..., 100)
- `x-fixed` - Makes element fixed width (no flex shrink)
- `y-fixed` - Makes element fixed height (no flex shrink)

### Flex Modifiers
- `x-flex-{N}` - Sets flex-grow to N on X axis
- `y-flex-{N}` - Sets flex-grow to N on Y axis (for cross-axis growth)

### Alignment Classes
- `x-center`, `x-start`, `x-end`, `x-between`, `x-around`, `x-evenly` - justify-content variants
- `y-center`, `y-start`, `y-end`, `y-between`, `y-around`, `y-evenly` - align-items variants