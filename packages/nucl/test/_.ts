import {createNuRealm, Nu} from "@alaq/nucl";


// console.log(n.value)
import {expect, it, test} from 'bun:test'
import {fusion} from "@alaq/nucl/fusion";


test('fusion - standalone builder with any strategy', () => {
  const a = Nu({ value: null })
  const b = Nu({ value: 2 })

  const result = fusion(a, b).any((a, b) => (a || 0) + b)
  expect(result.value).toBe(2) // null becomes 0

  a(5)
  // console.log(a.value)
  // console.log(b.value)
  // console.log(result.value)
  expect(result.value).toBe(7)
})


