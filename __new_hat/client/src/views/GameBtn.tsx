/** @jsx h */
import {FxLayout, FxLayoutProps} from "@alaq/flex";
import {Bounds, Container, Graphics, SplitText} from 'pixi.js'
import {gsap} from 'gsap';
import TweenVars = gsap.TweenVars;

export interface FxLabelProps extends FxLayoutProps {
  text: string
  style?: any
}

const centralG = (
  b: Bounds,
  padding,
  color,
  alpha
) => {
  const g = new Graphics()
    .roundRect(
      b.x - padding / 2,
      b.y - padding / 2,
      b.width + padding,
      b.height + padding,
      8,
    )
    .fill({color, alpha})
  g.pivot.set(g.width / 2, g.height / 2)
  g.x = g.width / 2
  g.y = g.height / 2
  // g.eventMode = "none"
  const t = (t, a) => {

  }
  const bounds = g.getLocalBounds()
  const o = {
    g,
    bounds,
    tween(mode: "to" | "from", a: TweenVars) {
      Object.keys(a).forEach(k => {
        let v = bounds[k]
        if (v !== undefined) {
          a[k] = v * a[k]
        }
      })
      gsap[mode](g, a)
    },
    reset(duration, easing) {
      gsap.to(g.scale, {scaleX: 1, scaleY: 1, scale: 1, duration, easing})
      gsap.to(g, {
        height: bounds.height,
        width: bounds.width,
        duration,
        easing
      })
    }
  }
  return o
}
type IG = ReturnType<typeof centralG>

export class GameBtn extends FxLayout {
  // For JSX compatibility
  declare props: FxLabelProps

  private _text: SplitText
  private _bg1: IG
  private _bg2: IG
  private _bg3: IG
  private _con: Container<any>


  constructor(props: FxLabelProps) {
    super(props)

    const text = new SplitText({
      text: props.text,
      style: {
        fontFamily: 'Arial',
        fontSize: 26,
        fill: 0xffffff,
        // strokeThickness:1,
      },
    });
    this._text = text
    const lb = text.getLocalBounds()
    const color = 0xFF2233
    this._bg1 = centralG(lb, 18, color, 0.5)
    this._bg1.g.blendMode = "screen-npm"
    this._bg2 = centralG(lb, 24, color, 0.2)
    this._bg3 = centralG(lb, 32, color, 0.2)

    this._con = new Container()
    this._con.addChild(this._bg1.g)
    this._con.addChild(this._bg2.g)
    this._con.addChild(this._bg3.g)
    this._con.addChild(this._text)
    this._con.eventMode = 'static';
    this._con.on("pointerover", () => {

      // gsap.to(this._bg1.g.scale, {
      //   scaleX: 2,
      //   duration: 1,
      // })

      this._bg1.tween("to", {
        height: 2,
        width: 2,
        duration: .2
      })
    })
    this._con.on("pointerout", () => {
      this._bg1.reset(.7, "power4")
    })
    this.addChild(this._con)
    text.eventMode = "none"

  }

  afterAdded() {

    gsap.from(this._text.chars, {
      // x: 30,
      y: 30,
      // strokeThickness: 2,
      height: 1,
      alpha: 0,
      duration: .3,

      // ease: 'bounce.inOut',
      ease: 'power4',
      // stagger: 0.00000004,
      yoyo: true,
    });

    this._bg1.tween("from", {
      height: .9,
      width: .9,
      duration: .3,
      alpha: 0,
      ease: 'expo',
    })
    this._bg2.tween("from", {
      height: .1,
      // width: .1,
      alpha: 0,
      duration: .5,
      ease: 'expo',
    })
    this._bg3.tween("from", {
      height: 1.2,
      width: 1.2,
      alpha: 0,
      duration: .5,
      ease: 'bounce.out',
    })
  }

  layout(x: number, y: number, w: number, h: number) {
    // this._text.x = x //+ (w - this._bounds.width) / 2
    // this._text.y = y //+ (h - this._bounds.height) / 2
    // this._g1.x = x
    // this._g1.y = y
    // this._g1.height = h
    // this._g1.width = w
    this._con.x = x
    this._con.y = y
  }
}
