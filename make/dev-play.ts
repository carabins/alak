import { A } from '../packages/alak/atom'
import debug from '../packages/alak/atom/debug'

debug.activate('localhost:10946')

const startValue = 'startValue'
const finalValue = 'finalValue'
const beStart = (v) => console.log(v == startValue)
const beFinal = (v) => console.log(v == finalValue)
const neverBe = (v) => console.log('neverBe')
let a = A()
a.up(beStart)
a(startValue)
a.down(beStart)
a.next(beFinal)
a(finalValue)
a.clear()
a.up(neverBe)


a(finalValue)
a(finalValue)
a(finalValue)
a(finalValue)
a(finalValue)
a(finalValue)
a(finalValue)
