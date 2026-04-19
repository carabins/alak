import { Container } from 'pixi.js'
import { LayoutBase } from '../core/LayoutBase'

class VGroupLayout extends LayoutBase {
  declare private _gap: number
  declare private _padding: number
  declare private _horizontalAlign: 'left' | 'center' | 'right'
  declare private _verticalAlign: 'top' | 'middle' | 'bottom'

  constructor(props: any) {
    super(props)
    if (this._gap === undefined) this._gap = 0
    if (this._padding === undefined) this._padding = 0
    if (this._horizontalAlign === undefined) this._horizontalAlign = 'left'
    if (this._verticalAlign === undefined) this._verticalAlign = 'top'
  }

  get gap() { return this._gap! }
  set gap(v: number) { this._gap = v; this.invalidate() }

  get padding() { return this._padding! }
  set padding(v: number) { this._padding = v; this.invalidate() }

  get horizontalAlign() { return this._horizontalAlign! }
  set horizontalAlign(v: 'left' | 'center' | 'right') { this._horizontalAlign = v; this.invalidate() }

  get verticalAlign() { return this._verticalAlign! }
  set verticalAlign(v: 'top' | 'middle' | 'bottom') { this._verticalAlign = v; this.invalidate() }
  
  layout(w: number, h: number) {
    super.layout(w, h)
    
    const availW = w - (this._padding * 2)
    const availHForPercent = h - (this._padding * 2)
    
    let totalFixedH = 0
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
            let childH = layoutChild._explicitHeight || child.height
            if (layoutChild.percentHeight !== undefined) {
                childH = availHForPercent * (layoutChild.percentHeight / 100)
            }
            totalFixedH += childH
        }
    }
    
    const totalGap = Math.max(0, visibleChildren - 1) * this._gap
    const remainingH = Math.max(0, availHForPercent - totalFixedH - totalGap)
    
    let y = this._padding

    if (totalGrow === 0 && remainingH > 0) {
        if (this._verticalAlign === 'middle') {
            y += remainingH / 2
        } else if (this._verticalAlign === 'bottom') {
            y += remainingH
        }
    }
    
    for (const child of this.children) {
      if (!(child instanceof Container)) continue
      if (!child.visible) continue
      
      const layoutChild = child as any
      
      let cw = layoutChild._explicitWidth || child.width
      if (layoutChild.percentWidth !== undefined) {
        cw = availW * (layoutChild.percentWidth / 100)
      }
      
      let ch: number | undefined = layoutChild._explicitHeight
      
      if (layoutChild.flexGrow > 0) {
          ch = (remainingH * layoutChild.flexGrow) / totalGrow
      } else if (layoutChild.percentHeight !== undefined) {
          ch = availHForPercent * (layoutChild.percentHeight / 100)
      }
      
      if (layoutChild.resize) {
        layoutChild.resize(cw, ch)
      } else {
        child.width = cw
        if (ch !== undefined) child.height = ch
      }
      
      const finalH = child.height
      
      // Align X
      if (this._horizontalAlign === 'center') {
        child.x = (w - child.width) / 2
      } else if (this._horizontalAlign === 'right') {
        child.x = w - this._padding - child.width
      } else {
        child.x = this._padding
      }
      
      child.y = y
      y += finalH + this._gap
    }
  }
}

export function VGroup(props: any) {
  return new VGroupLayout(props)
}