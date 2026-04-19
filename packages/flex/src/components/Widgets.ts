import { FancyButton as PixiButton, CheckBox as PixiCheckBox } from '@pixi/ui'
import { LayoutBase } from '../core/LayoutBase'
import { Texture, Graphics, Text } from 'pixi.js'
import { isIQ } from '../core/bind'

export function wrapUI(Class: any) {
  class UILayout extends LayoutBase {
    private _widget: any

    constructor(props: any) {
      super(props)

      const {
        children,
        percentWidth,
        percentHeight,
        horizontalAlign,
        verticalAlign,
        gap,
        padding,
        margin,
        ...widgetProps
      } = props

      // Unwrap Quarks for initial values
      for (const k in widgetProps) {
          if (isIQ(widgetProps[k])) {
              widgetProps[k] = widgetProps[k].value;
          }
      }

      if (widgetProps.label && !widgetProps.text) {
        // Manually create Text to ensure it's a valid Pixi object from our instance
        widgetProps.text = new Text({
            text: widgetProps.label,
            style: { fill: 0xffffff, fontSize: 20 } // Default style
        });
      }

      if (Class === PixiButton && !widgetProps.defaultView) {
        const bg = new Graphics().roundRect(0, 0, 100, 40, 5).fill(0x333333);
        widgetProps.defaultView = bg;
      }
      
      // Force anchor to 0 for Layout compatibility
      if (Class === PixiButton) {
          widgetProps.anchor = 0;
      }

      this._widget = new Class(widgetProps)

      // Wire up signals if they exist on the widget and in props
      // FancyButton uses onPress, onUp, onDown, onHover, onOut
      const signals = ['onPress', 'onClick', 'onUp', 'onDown', 'onHover', 'onOut'];
      signals.forEach(sig => {
        if (props[sig] && this._widget[sig] && this._widget[sig].connect) {
            this._widget[sig].connect(props[sig]);
        }
      });

      this.addChild(this._widget)
    }

    set label(v: any) { if (this._widget) this._widget.text = v; }
    get label() { return this._widget?.text; }

    set text(v: any) { if (this._widget) this._widget.text = v; }
    get text() { return this._widget?.text; }

    set enabled(v: boolean) { if (this._widget) this._widget.enabled = v; }
    get enabled() { return this._widget?.enabled; }

    layout(w?: number, h?: number) {
      super.layout(w, h)

      if (this._widget) {
          this._widget.eventMode = 'static';
          this._widget.cursor = 'pointer';
      }

      // Use provided size OR current size
      // This prevents squashing if w/h is undefined
      const targetW = w ?? this._widget.width
      const targetH = h ?? this._widget.height

      if (this._widget.resize) {
        this._widget.resize(targetW, targetH)
      } else {
        this._widget.width = targetW
        this._widget.height = targetH
      }
    }
  }

  return function Factory(props: any) {
    return new UILayout(props)
  }
}

export const Button = wrapUI(PixiButton)
export const CheckBox = wrapUI(PixiCheckBox)
