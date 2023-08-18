import BitInstance from "@alaq/bitmask/BitInstance";
import {test} from "tap";

const instance = BitInstance({
  startValue: 1,
  flags: ['ONE', 'TWO', 'THREE', 'FOUR'] as const,
  groups: {
    ONE_TWO: ['ONE', 'TWO'],
    FOUR_TWO: ['FOUR', 'TWO'],
  },
  combinations: {
    A: {
      and: ['TWO', 'ONE'],
    },
    Z: {
      and: ['ONE', 'THREE'],
      not: ['TWO'],
    },
    B: {
      or: ['ONE', 'FOUR'],
    },
  },
})
test('basic', (t) => {

  t.ok(instance.state.ONE)
  t.notOk(instance.state.TWO)
  t.ok(instance.state.B)

  instance.flags.TWO.setTrue()
  t.ok(instance.state.TWO)

  instance.setTrue("THREE", "FOUR")
  t.ok(instance.state.THREE)
  t.ok(instance.state.FOUR)
  const r = instance.onValueUpdate("AFFECTED_FLAGS", (v)=>{
    t.ok(v.Z)
  })
  instance.setFalse("TWO", "FOUR")
  t.notOk(instance.state.FOUR)
  t.ok(instance.state.Z)
  instance.removeValueUpdate(r)
  instance.setTrue("TWO", "FOUR")
  t.ok(instance.state.A)
  t.plan(10)
  t.end()
})
test('combinations and', (t) => {
  instance.bitwise.set(0)
  let r = instance.flags.A.onValueUpdate("ANY", ()=>{

    t.pass("any" )
  })
  instance.flags.A.removeValueUpdate(r)
  r = instance.flags.A.onValueUpdate("TRUE", ()=>{
    t.pass("true" )

  })
  instance.setTrue("ONE", "TWO")
  instance.flags.A.removeValueUpdate(r)
  r = instance.flags.A.onValueUpdate("FALSE", ()=>{
    t.ok(true)
  })
  instance.setFalse("ONE", "TWO")
  instance.flags.A.removeValueUpdate(r)
  t.plan(3)
  t.end()
})
test('combinations and not', (t) => {
  instance.bitwise.set(0)
  let r = instance.flags.Z.onValueUpdate("ANY", ()=>{
    t.ok(true)
  })
  instance.flags.Z.removeValueUpdate(r)
  r = instance.flags.Z.onValueUpdate("TRUE", ()=>{
    t.ok(true)
  })
  instance.setTrue("ONE", "THREE")
  instance.flags.Z.removeValueUpdate(r)
  r = instance.flags.Z.onValueUpdate("FALSE", ()=>{
    t.ok(true)
  })
  instance.setTrue("ONE", "TWO")
  instance.removeValueUpdate(r)
  t.plan(3)
  t.end()
})
