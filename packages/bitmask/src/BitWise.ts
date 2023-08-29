type ProxyObject = {
  value: number
  p: IBitWise
}

const emit = (o) => o.l.forEach((f) => f(o.value))
const proxyActions = {
  is(n) {
    return (this.value & n) === n
  },
  isNot(n): boolean {
    return (this.value & n) !== n
  },

  add(n: number) {
    if (this.p.isNot(n)) {
      this.value = this.value | n
      emit(this)
      return true
    }
    return false
  },
  remove(n: number) {
    if (this.p.is(n)) {
      this.value = this.value ^ n
      emit(this)
      return true
    }
    return false
  },
  set(n: number) {
    this.value = n
    emit(this)
  },
  toggle(n: number) {
    this.value = this.value ^ n
    emit(this)
  },
  removeValueUpdate(listener) {
    this.l = this.l.filter((l) => l != listener)
  },
  onValueUpdate(listener) {
    this.l.push(listener)
    const v = this.value
    if (v !== undefined && v !== null) {
      listener(v)
    }
    return listener
  },
  toString() {
    return binary(this.value)
  },
}

export function binary(value, bits: 8 | 16 | 24 | 32 = 8): string {
  return '0b' + (value >>> 0).toString(2).padStart(bits, '0')
}

const proxyHandler = {
  get(o, key) {
    if (key === 'value') {
      return o.value
    }
    const f = proxyActions[key]
    if (f) {
      return f.bind(o)
    }
    return false
  },
}

export default function BitWise(value = 0) {
  const p = new Proxy({ value, l: [] }, proxyHandler)
  p.p = p
  return p as IBitWise
}
