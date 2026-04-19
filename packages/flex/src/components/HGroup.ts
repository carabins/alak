import { Container } from 'pixi.js'
import { LayoutBase } from '../core/LayoutBase'

class HGroupLayout extends LayoutBase {
  declare private _gap: number
  declare private _padding: number
  declare private _verticalAlign: 'top' | 'middle' | 'bottom'
  declare private _horizontalAlign: 'left' | 'center' | 'right'

  constructor(props: any) {
    super(props)
    if (this._gap === undefined) this._gap = 0
    if (this._padding === undefined) this._padding = 0
    if (this._verticalAlign === undefined) this._verticalAlign = 'top'
    if (this._horizontalAlign === undefined) this._horizontalAlign = 'left'
  }

  get gap() { return this._gap! }
  set gap(v: number) { this._gap = v; this.invalidate() }

  get padding() { return this._padding! }
  set padding(v: number) { this._padding = v; this.invalidate() }

  get verticalAlign() { return this._verticalAlign! }
  set verticalAlign(v: 'top' | 'middle' | 'bottom') { this._verticalAlign = v; this.invalidate() }

  get horizontalAlign() { return this._horizontalAlign! }
  set horizontalAlign(v: 'left' | 'center' | 'right') { this._horizontalAlign = v; this.invalidate() }
  
  layout(w: number, h: number) {
    super.layout(w, h)
    
    const availH = h - (this._padding * 2)
    const availWForPercent = w - (this._padding * 2)
    
    let totalFixedW = 0
    let totalGrow = 0
    let visibleChildren = 0
    
    for (const child of this.children) {
        if (!(child instanceof Container)) continue
        if (!child.visible) continue
        visibleChildren++
        
        const layoutChild = child as any
        
        if (layoutChild.flexGrow > 0) {
            totalGrow += layoutChild.flexGrow
        } else {
            let childW = layoutChild._explicitWidth || child.width
            if (layoutChild.percentWidth !== undefined) {
                childW = availWForPercent * (layoutChild.percentWidth / 100)
            }
            totalFixedW += childW
        }
    }
    
    const totalGap = Math.max(0, visibleChildren - 1) * this._gap
    const remainingW = Math.max(0, availWForPercent - totalFixedW - totalGap)
    
    let x = this._padding

    if (totalGrow === 0 && remainingW > 0) {
        if (this._horizontalAlign === 'center') {
            x += remainingW / 2
        } else if (this._horizontalAlign === 'right') {
            x += remainingW
        }
    }
    
    for (const child of this.children) {
      if (!(child instanceof Container)) continue
      if (!child.visible) continue
      
      const layoutChild = child as any
      
      let ch = layoutChild._explicitHeight || child.height
      if (layoutChild.percentHeight !== undefined) {
        ch = availH * (layoutChild.percentHeight / 100)
      }
      
      let cw: number | undefined = layoutChild._explicitWidth
      if (layoutChild.flexGrow > 0) {
          cw = (remainingW * layoutChild.flexGrow) / totalGrow
      } else if (layoutChild.percentWidth !== undefined) {
          cw = availWForPercent * (layoutChild.percentWidth / 100)
      }
      
      if (layoutChild.resize) {
        layoutChild.resize(cw, ch)
      } else {
        child.height = ch
        if (cw !== undefined) child.width = cw
      }
      
      const finalW = child.width
      
      if (this._verticalAlign === 'middle') {
        child.y = (h - child.height) / 2
      } else if (this._verticalAlign === 'bottom') {
        child.y = h - this._padding - child.height
      } else {
        child.y = this._padding
      }
      
      child.x = x
      x += finalW + this._gap
    }
  }
}

export function HGroup(props: any) {
  return new HGroupLayout(props)
}