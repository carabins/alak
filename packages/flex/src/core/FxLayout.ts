
import { Qu, Qv, IQ } from '@alaq/quark'

import { aliveFusion } from '@alaq/nucl/fusion'
import { Container} from 'pixi.js'

type Align = 'left' | 'center' | 'right'
type VAlign = 'top' | 'middle' | 'bottom'
type Direction = 'V' | 'H'

function toQuark<T>(value: T | IQ<T> | undefined, defaultValue: T): IQ<T> {
  if (value && (value as any).__q) {
    return value as IQ<T>
  }
  return Qv(value ?? defaultValue, { dedup: true })
}

export interface FxLayoutProps {
  direction?: Direction
  gap?: number
  padding?: number
  horizontalAlign?: Align
  verticalAlign?: VAlign
  width?: number | IQ<number>
  height?: number | IQ<number>
  percentWidth?: number | IQ<number>
  percentHeight?: number | IQ<number>
  fullSpace?: boolean
  fullWidth?: boolean
  fullHeight?: boolean
  halfWidth?: boolean
  halfHeight?: boolean
  children?: FxLayout | FxLayout[]
}

export class FxLayout {
  // For JSX compatibility
  props!: FxLayoutProps

  parent: FxLayout | null = null
  children: FxLayout[] = []
  displayList: Container[] = []

  static _stage: Container

  _unsubs: (() => void)[] = []

  // Static layout props (not reactive)
  direction: Direction
  gap: number
  padding: number
  horizontalAlign: Align
  verticalAlign: VAlign

  // Size props (can be reactive)
  _width: IQ<number | undefined>
  _height: IQ<number | undefined>
  _percentWidth: IQ<number | undefined>
  _percentHeight: IQ<number | undefined>

  // Computed position/size
  _x: IQ<number>
  _y: IQ<number>
  _w: IQ<number>
  _h: IQ<number>

  constructor(props: FxLayoutProps = {}) {
    // Static props - just values
    this.direction = (props.direction as Direction) ?? 'V'
    this.gap = (props.gap as number) ?? 0
    this.padding = (props.padding as number) ?? 0
    this.horizontalAlign = (props.horizontalAlign as Align) ?? 'center'
    this.verticalAlign = (props.verticalAlign as VAlign) ?? 'middle'

    // Reactive size props
    this._width = toQuark(props.width, undefined)
    this._height = toQuark(props.height, undefined)
    this._percentWidth = toQuark(props.percentWidth, undefined)
    this._percentHeight = toQuark(props.percentHeight, undefined)

    if (props.fullSpace) {
      this._percentWidth(100)
      this._percentHeight(100)
    }
    if (props.fullWidth) this._percentWidth(100)
    if (props.fullHeight) this._percentHeight(100)
    if (props.halfWidth) this._percentWidth(50)
    if (props.halfHeight) this._percentHeight(50)

    this._x = Qu({ dedup: true })
    this._y = Qu({ dedup: true })
    this._w = Qu({ dedup: true })
    this._h = Qu({ dedup: true })

    const unsub = aliveFusion(
      [this._x, this._y, this._w, this._h],
      (x, y, w, h) => this.layout(x, y, w, h)
    )
    this._unsubs.push(unsub)

    // Обработка children из JSX
    if (props.children) {
      const kids = Array.isArray(props.children) ? props.children : [props.children]
      kids.forEach((child: FxLayout) => {
        // Ignore strings, nulls, undefined - only add FxLayout instances
        if (child instanceof FxLayout) {
          this.addLayoutChild(child)
        }
      })
    }
  }

  // Lazy calculation of vertical offset for centering
  private _getVerticalOffset(): number {
    let totalH = 0
    this.children.forEach((c, i) => {
      totalH += c._h.value || 0
      if (i > 0) totalH += this.gap
    })

    const ph = this._h.value || 0

    if (this.verticalAlign === 'middle') return (ph - totalH) / 2
    if (this.verticalAlign === 'bottom') return ph - totalH - this.padding
    return this.padding // top
  }

  // Lazy calculation of horizontal offset for centering
  private _getHorizontalOffset(): number {
    let totalW = 0
    this.children.forEach((c, i) => {
      totalW += c._w.value || 0
      if (i > 0) totalW += this.gap
    })

    const pw = this._w.value || 0

    if (this.horizontalAlign === 'center') return (pw - totalW) / 2
    if (this.horizontalAlign === 'right') return pw - totalW - this.padding
    return this.padding // left
  }

  addChild(obj: Container) {
    this.displayList.push(obj)
    // Добавляем в stage только если он уже установлен
    if (FxLayout._stage) {
      FxLayout._stage.addChild(obj)
    }
  }

  removeChild(obj: Container) {
    const idx = this.displayList.indexOf(obj)
    if (idx !== -1) this.displayList.splice(idx, 1)
    if (FxLayout._stage) {
      FxLayout._stage.removeChild(obj)
    }
  }

  // Добавляет все displayList в stage (рекурсивно)
  async _mountToStage(): Promise<void> {
    this.displayList.forEach(obj => {
      FxLayout._stage.addChild(obj)
    })
    
    // Mount children recursively and wait for them
    await Promise.all(this.children.map(child => child._mountToStage()))
    
    // Run afterAdded hook
    await this.afterAdded()
  }

  // Lifecycle hooks
  async afterAdded(): Promise<void> {
    // Override in subclasses
  }

  async beforeRemove(): Promise<void> {
    // Override in subclasses
  }

  addLayoutChild(child: FxLayout) {
    child.parent = this
    this.children.push(child)
    const index = this.children.length - 1
    this._bindChildSize(child)
    this._bindChildPosition(child, index)
  }

  private _bindChildSize(child: FxLayout) {
    // Width
    if (child._width.value !== undefined) {
      child._w(child._width.value)
      child._unsubs.push(child._width.up(v => child._w(v!)))
    } else if (child._percentWidth.value && !this._isContentBased('w')) {
      const unsub = aliveFusion(
        [this._w, child._percentWidth],
        (pw, pct) => child._w(pw * pct! / 100)
      )
      child._unsubs.push(unsub)
    } else {
      // Use cached or calculate
      if (child._w.value === undefined) {
        child._w(child.getContentWidth())
      }
    }

    // Height
    if (child._height.value !== undefined) {
      child._h(child._height.value)
      child._unsubs.push(child._height.up(v => child._h(v!)))
    } else if (child._percentHeight.value && !this._isContentBased('h')) {
      const unsub = aliveFusion(
        [this._h, child._percentHeight],
        (ph, pct) => child._h(ph * pct! / 100)
      )
      child._unsubs.push(unsub)
    } else {
      // Use cached or calculate
      if (child._h.value === undefined) {
        child._h(child.getContentHeight())
      }
    }
  }

  private _bindChildPosition(child: FxLayout, index: number) {
    const dir = this.direction
    console.log('[_bindChildPosition] dir:', dir, 'index:', index)

    if (dir === 'V') {
      // Y position: first child uses offset, others stack from previous
      if (index === 0) {
        const unsub = aliveFusion(
          [this._y, this._h],
          (py) => {
            const offset = this._getVerticalOffset()
            console.log('[fusion] child._y (first) =', py + offset, { py, offset })
            child._y(py + offset)
          }
        )
        child._unsubs.push(unsub)
      } else {
        const prev = this.children[index - 1]
        const unsub = aliveFusion(
          [prev._y, prev._h],
          (py, ph) => {
            console.log('[fusion] child._y (next) =', py + ph + this.gap)
            child._y(py + ph + this.gap)
          }
        )
        child._unsubs.push(unsub)
      }

      // X position: based on horizontalAlign
      const unsub = aliveFusion(
        [this._x, this._w, child._w],
        (px, pw, cw) => {
          console.log('[fusion] child._x (align) =', { px, pw, cw, align: this.horizontalAlign })
          if (this.horizontalAlign === 'center') child._x(px + (pw - cw) / 2)
          else if (this.horizontalAlign === 'right') child._x(px + pw - cw - this.padding)
          else child._x(px + this.padding)
        }
      )
      child._unsubs.push(unsub)
    } else {
      // H direction
      if (index === 0) {
        const unsub = aliveFusion(
          [this._x, this._w],
          (px) => {
            const offset = this._getHorizontalOffset()
            child._x(px + offset)
          }
        )
        child._unsubs.push(unsub)
      } else {
        const prev = this.children[index - 1]
        const unsub = aliveFusion(
          [prev._x, prev._w],
          (px, pw) => child._x(px + pw + this.gap)
        )
        child._unsubs.push(unsub)
      }

      // Y position: based on verticalAlign
      const unsub = aliveFusion(
        [this._y, this._h, child._h],
        (py, ph, ch) => {
          if (this.verticalAlign === 'middle') child._y(py + (ph - ch) / 2)
          else if (this.verticalAlign === 'bottom') child._y(py + ph - ch - this.padding)
          else child._y(py + this.padding)
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

  getContentWidth(): number {
    // From displayList (Pixi objects)
    let maxDisplay = 0
    if (this.displayList.length > 0) {
      maxDisplay = Math.max(...this.displayList.map(d => d.getLocalBounds().width))
    }

    // From children layouts
    let childrenWidth = 0
    if (this.children.length > 0) {
      if (this.direction === 'H') {
        // Horizontal: sum of widths + gaps
        this.children.forEach((c, i) => {
          childrenWidth += c._w.value ?? 0
          if (i > 0) childrenWidth += this.gap
        })
      } else {
        // Vertical: max width
        const widths = this.children.map(c => c._w.value ?? 0)
        childrenWidth = widths.length > 0 ? Math.max(...widths) : 0
      }
    }

    console.log('[getContentWidth]', { displayList: this.displayList.length, children: this.children.length, maxDisplay, childrenWidth })
    return Math.max(maxDisplay, childrenWidth)
  }

  getContentHeight(): number {
    // From displayList (Pixi objects)
    let maxDisplay = 0
    if (this.displayList.length > 0) {
      maxDisplay = Math.max(...this.displayList.map(d => d.getLocalBounds().height))
    }

    // From children layouts
    let childrenHeight = 0
    if (this.children.length > 0) {
      if (this.direction === 'V') {
        // Vertical: sum of heights + gaps
        this.children.forEach((c, i) => {
          childrenHeight += c._h.value ?? 0
          if (i > 0) childrenHeight += this.gap
        })
      } else {
        // Horizontal: max height
        const heights = this.children.map(c => c._h.value ?? 0)
        childrenHeight = heights.length > 0 ? Math.max(...heights) : 0
      }
    }

    console.log('[getContentHeight]', { displayList: this.displayList.length, children: this.children.length, maxDisplay, childrenHeight })
    return Math.max(maxDisplay, childrenHeight)
  }

  layout(x: number, y: number, w: number, h: number) {
    // Переопределяется в наследниках
  }

  async destroy() {
    // Execute async cleanup hook first
    await this.beforeRemove()
    
    // Now perform actual cleanup
    this._unsubs.forEach(fn => fn())
    this._unsubs = []

    this.displayList.forEach(obj => {
      FxLayout._stage.removeChild(obj)
      obj.destroy()
    })
    this.displayList = []

    // Destroy children (async)
    for (const child of this.children) {
      await child.destroy()
    }
    this.children = []

    this.parent = null
  }
}

export function mountFx(root: FxLayout, stage: Container) {
  const w = window.innerWidth
  const h = window.innerHeight
  console.log('[mountFx] window size:', w, h)

  FxLayout._stage = stage

  // Добавить все displayList в stage
  root._mountToStage()

  console.log('[mountFx] setting root position/size')
  root._x(0)
  root._y(0)
  root._w(w)
  root._h(h)

  console.log('[mountFx] root quarks:', {
    x: root._x.value,
    y: root._y.value,
    w: root._w.value,
    h: root._h.value
  })

  const onResize = () => {
    root._w(window.innerWidth)
    root._h(window.innerHeight)
  }

  window.addEventListener('resize', onResize)

  return async () => {
    window.removeEventListener('resize', onResize)
    await root.destroy()
  }
}
