import { LayoutBase } from '../core/LayoutBase'

export function Group(props: any) {
  return new LayoutBase(props)
}

export function Spacer(props: any) {
  const el = new LayoutBase(props)
  ;(el as any)._isSpacer = true
  return el
}