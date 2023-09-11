import Point from './Point'

let ns = 'http://www.w3.org/2000/svg'

interface SvgElement extends SVGElement {
  proxyNode: SvgNode
}

type AttrSetter = {
  [attr: string]: (value: string | number) => AttrSetter
}

type CentralCoords = {
  rect(): DOMRect
  get(): Point
  set(p: Point)
  y(): number
  x(): number
}

type Transform = {
  matrix: (...args: any) => Transform
  matrix3d: (...args: any) => Transform
  perspective: (...args: any) => Transform
  rotate: (...args: any) => Transform
  rotate3d: (...args: any) => Transform
  rotateX: (...args: any) => Transform
  rotateY: (...args: any) => Transform
  rotateZ: (...args: any) => Transform
  translate: (...args: any) => Transform
  translate3d: (...args: any) => Transform
  translateX: (...args: any) => Transform
  translateY: (...args: any) => Transform
  translateZ: (...args: any) => Transform
  scale: (...args: any) => Transform
  scale3d: (...args: any) => Transform
  scaleX: (...args: any) => Transform
  scaleY: (...args: any) => Transform
  scaleZ: (...args: any) => Transform
  skew: (...args: any) => Transform
  skewX: (...args: any) => Transform
  skewY: (...args: any) => Transform
  current: string
}
type SvgNode = {
  target: SvgElement
  attr: AttrSetter
  addChild: {
    [node: string]: SvgNode
  }
  center: CentralCoords
  transform: Transform
}

export const createSVG = (id, w, h) => {
  var target = document.createElementNS(ns, 'svg') as SvgElement
  const attr = proxyAttr(target)
  const addChild = proxyAddChildSVG(target)
  const svgNode = {
    target,
    attr,
    addChild,
    center: center(target),
  } as SvgNode
  target.proxyNode = svgNode
  svgNode.transform = transform(svgNode)
  // nodes.set(svg, proxyNode)
  attr.width(w)
  attr.height(h)
  return svgNode
}

// export const createCircle = (n: SvgNode, size, color) => {
//   const circle = n.addChild.circle
//   circle.attr.r(size).fill(color)
//   return circle
// }

const transform = (n: SvgNode) => {
  return new Proxy({ list: {} } as any, {
    get(o, key) {
      // console.log("___", o, ke)
      return (...a) => {
        o.list[key] = a
        const cssValue = Object.keys(o.list)
          .map((k) => `${k}(${o.list[k].join(' ')})`)
          .join(' ')
        // console.log({ cssValue })
        n.attr.transform(cssValue)
        return n.transform
      }
    },
  }) as Transform
}
const center = (el: SvgElement, parent?: CentralCoords) => {
  const rect = () => el.getBoundingClientRect()
  const x = () => {
    const r = rect()
    let f = r.x + r.width / 2
    if (parent) {
      f = f - parent.rect().x
    }
    return f
  }
  const y = () => {
    const r = rect()
    let f = r.y + r.height / 2
    if (parent) {
      f = f - parent.rect().y
    }
    return f
  }
  const get = () => new Point(x(), y())
  const set = (p: Point) => {
    el.proxyNode.attr.cx(p.x)
    el.proxyNode.attr.cy(p.y)
  }
  return { rect, x, y, get, set }
}

function proxyAddChildSVG(el: SvgElement) {
  return new Proxy(el, {
    get(target: any, p: string) {
      const child = document.createElementNS(ns, p) as SvgElement
      target.appendChild(child)
      const addChild = proxyAddChildSVG(child)
      const attr = proxyAttr(child)
      const proxyNode = {
        target: child,
        addChild,
        attr,
        center: center(child, target.proxyNode.center),
      } as SvgNode
      proxyNode.transform = transform(proxyNode)
      // nodes.set(child, proxyNode)
      child.proxyNode = proxyNode
      return proxyNode
    },
  })
}

const proxyAttr = (el) =>
  new Proxy(el, {
    get(target: any, p: string | symbol) {
      return (value) => {
        target.setAttributeNS(null, p, value)
        return target.proxyNode.attr
      }
    },
  })

interface HtmlElement extends SVGElement {
  proxyNode: HtmlNode
}

type HtmlNode = {
  target: HtmlElement
  attr: AttrSetter
}

export const createElement = (tag) => {
  const target = document.createElement(tag) as HtmlElement
  const attr = proxyAttr(target)
  const proxyNode = { target, attr }
  target.proxyNode = proxyNode
  return proxyNode
}
