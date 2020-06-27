import { A } from '../packages/alak/atom'
import debug from '../packages/alak/atom/debug'

debug.activate('localhost:10946')

const startValue = 'startValue'
const finalValue = 'finalValue'

let a = A(startValue)
console.log(!!a.uid)
a.decay()
