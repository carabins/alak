// FxLabel
import {FxLayout, FxLayoutProps} from "@alak/flex/core/FxLayout";

export interface FxLabelProps extends FxLayoutProps {
  text: string
  style?: any
}

export class FxLabel extends FxLayout {
  // For JSX compatibility
  declare props: FxLabelProps

  private _text: Text
  private _bounds: { width: number; height: number }

  constructor(props: FxLabelProps) {
    super(props)

    this._text = new Text({
      text: props.text,
      style: props.style || { fill: 0xffffff, fontSize: 24 }
    })

    this.addChild(this._text)

    // Cache bounds once
    const b = this._text.getLocalBounds()
    this._bounds = { width: b.width, height: b.height }

    // Set size from cached bounds
    this._w(this._bounds.width)
    this._h(this._bounds.height)
  }

  layout(x: number, y: number, w: number, h: number) {
    this._text.x = x + (w - this._bounds.width) / 2
    this._text.y = y + (h - this._bounds.height) / 2
  }
}
