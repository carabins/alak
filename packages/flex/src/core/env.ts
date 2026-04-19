export interface AbstractWindow {
  readonly width: number
  readonly height: number
  readonly devicePixelRatio: number
  onResize(cb: (w: number, h: number) => void): () => void
}

// Browser Implementation
const browserWindow: AbstractWindow = {
  get width() { return typeof window !== 'undefined' ? window.innerWidth : 800 },
  get height() { return typeof window !== 'undefined' ? window.innerHeight : 600 },
  get devicePixelRatio() { return typeof window !== 'undefined' ? window.devicePixelRatio : 1 },
  onResize(cb) {
    if (typeof window === 'undefined') return () => {}
    const handler = () => cb(window.innerWidth, window.innerHeight)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }
}

// Mutable reference to allow swapping in Worker
export let abstractWindow = browserWindow

export function setAbstractWindow(impl: AbstractWindow) {
  abstractWindow = impl
}
