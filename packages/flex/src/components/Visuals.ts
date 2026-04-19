import { Text, Sprite, Texture } from 'pixi.js'
import { LayoutBase } from '../core/LayoutBase'
import { isIQ } from '../core/bind'

class LabelLayout extends LayoutBase {
  private _text!: Text
  declare private _pendingText?: string | null
  
    constructor(props: any) {
  
      super(props)
  
      
  
      let initialText = isIQ(props.text) ? '' : props.text;
  
      
  
      // If bindProps (in super) already set a value, use it
  
      if (this._pendingText !== undefined && this._pendingText !== null) {
  
          initialText = this._pendingText;
  
      }
  
      
  
      this._text = new Text({ 
  
        text: initialText, 
  
        style: props.style 
  
      })
  
      this.addChild(this._text)
  
    }
  
    
  
    set text(v: string) {
  
      if (this._text) {
  
          this._text.text = v
  
          this.invalidate()
  
      } else {
  
          this._pendingText = v
  
      }
  
    }
  set style(v: any) {
    if (this._text) {
        this._text.style = v
        this.invalidate()
    }
  }
  
  layout(w: number, h: number) {
    super.layout(w, h)
    // Center text within the layout bounds
    this._text.anchor.set(0.5, 0.5)
    this._text.x = w / 2
    this._text.y = h / 2
  }
}

export function Label(props: any) { return new LabelLayout(props) }

class ImageLayout extends LayoutBase {
  private _sprite!: Sprite
  declare private _pendingTexture?: Texture | null
  
  constructor(props: any) {
    super(props)
    let tex = props.source || props.texture || Texture.EMPTY
    
    if (isIQ(tex)) tex = Texture.EMPTY
    else if (typeof tex === 'string') tex = Texture.from(tex)
    
    if (this._pendingTexture) tex = this._pendingTexture;

    this._sprite = new Sprite(tex)
    this.addChild(this._sprite)
  }

  set source(v: string | Texture) {
    const tex = typeof v === 'string' ? Texture.from(v) : v
    if (this._sprite) {
        this._sprite.texture = tex
        this.invalidate()
    } else {
        this._pendingTexture = tex
    }
  }
  
  set texture(v: string | Texture) { this.source = v }
  
  layout(w: number, h: number) {
    super.layout(w, h)
    this._sprite.width = w
    this._sprite.height = h
  }
}

export function Image(props: any) { return new ImageLayout(props) }
