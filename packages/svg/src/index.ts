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
  getCenter(): Point
  setCenter(p: Point)
  y(): number
  x(): number
}
type SvgNode = {
  target: SvgElement
  attr: AttrSetter
  addChild: {
    [node: string]: SvgNode
  }
  cc: CentralCoords
}

export const createSVG = (id, w, h) => {
  var svg = document.createElementNS(ns, 'svg') as SvgElement
  const attr = proxyAttr(svg)
  const addChild = proxyAddChildSVG(svg)
  const proxyNode = { target: svg, attr, addChild, cc: cc(svg) } as SvgNode
  svg.proxyNode = proxyNode
  // nodes.set(svg, proxyNode)
  attr.width(w)
  attr.height(h)
  return proxyNode
}

export const createCircle = (n: SvgNode, size, color) => {
  const circle = n.addChild.circle
  circle.attr.r(size).fill(color)
  return circle
}

const cc = (el: SvgElement, parent?: CentralCoords) => {
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
  const getCenter = () => new Point(x(), y())
  const setCenter = (p: Point) => {
    el.proxyNode.attr.cx(p.x)
    el.proxyNode.attr.cy(p.y)
  }
  return { rect, x, y, getCenter, setCenter }
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
        cc: cc(child, target.proxyNode.cc),
      } as SvgNode
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
