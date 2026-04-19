import {Container, Graphics} from 'pixi.js'
import {bindProps} from './bind'

const dirtyLayouts = new Set<LayoutBase>()
let frameRequested = false

function requestRender() {
  if (frameRequested) return
  frameRequested = true
  requestAnimationFrame(() => {
    frameRequested = false
    dirtyLayouts.forEach(l => l.validate())
    dirtyLayouts.clear()
  })
}

export class LayoutBase extends Container {
  protected _percentWidth?: number
  protected _percentHeight?: number
  protected _horizontalCenter?: number
  protected _verticalCenter?: number
  protected _left?: number
  protected _right?: number
  protected _top?: number
  protected _bottom?: number
  protected _flexGrow: number = 0

  protected _explicitWidth?: number
  protected _explicitHeight?: number

  protected _layoutW = 0
  protected _layoutH = 0

  protected _debugRect?: Graphics;

  constructor(props: any) {
    super()
    // Initialize defaults BEFORE binding
    this._flexGrow = 0
    this._layoutW = 0
    this._layoutH = 0

    bindProps(this, props)
    if (props.children) {
      props.children.forEach((c: any) => this.addChild(c))
    }
  }

  // ... getters/setters ...
  get percentWidth() {
    return this._percentWidth
  }

  set percentWidth(v: number | undefined) {
    this._percentWidth = v;
    this.invalidate()
  }

  get percentHeight() {
    return this._percentHeight
  }

  set percentHeight(v: number | undefined) {
    this._percentHeight = v;
    this.invalidate()
  }

  get flexGrow() {
    return this._flexGrow
  }

  set flexGrow(v: number) {
    this._flexGrow = v;
    this.invalidate()
  }

  set width(v: number) {
    this._explicitWidth = v;
    this.invalidate()
  }

  get width(): number {
    // Prioritize explicit or layout width. Fallback to content width only if not laid out.
    // This prevents layout shifts when content (like animations) exceeds bounds.
    if (this._explicitWidth !== undefined) return this._explicitWidth;
    if (this._layoutW > 0) return this._layoutW;
    return super.width;
  }

  set height(v: number) {
    this._explicitHeight = v;
    this.invalidate()
  }

  get height(): number {
    if (this._explicitHeight !== undefined) return this._explicitHeight;
    if (this._layoutH > 0) return this._layoutH;
    return super.height;
  }

  invalidate() {
    if (this.parent && (this.parent as any).invalidate) {
      (this.parent as any).invalidate()
    } else {
      dirtyLayouts.add(this)
      requestRender()
    }
  }

  validate() {
    this.layout(this._layoutW, this._layoutH)
  }

  // w/h can be undefined if parent doesn't constrain us
  layout(w?: number, h?: number) {
    this._layoutW = w || 0
    this._layoutH = h || 0

    // Debug draw
    if ((window as any).DEBUG_LAYOUT) {
      if (!this._debugRect) {
        this._debugRect = new Graphics();
        this.addChild(this._debugRect);
      }
      const dw = this._layoutW || this.width || 10;
      const dh = this._layoutH || this.height || 10;

      this._debugRect.clear()
        .rect(0, 0, dw, dh)
        .stroke({width: 1, color: 0xFF0000, alpha: 0.5});

      // Ensure debug rect is visible (on top)
      if (this.children.length > 0) {
        this.setChildIndex(this._debugRect, this.children.length - 1);
      }
    } else if (this._debugRect) {
      this._debugRect.clear();
    }
  }

  resize(w?: number, h?: number) {
    const finalW = this._explicitWidth !== undefined ? this._explicitWidth : w
    const finalH = this._explicitHeight !== undefined ? this._explicitHeight : h
    this.layout(finalW, finalH)
  }
}
