export default function calcCombination(operations, value, flags) {
  const results = []

  Object.keys(operations).forEach((opName) => {
    const operationFlags = operations[opName]
    switch (opName.toLowerCase()) {
      case 'and': {
        results.push(...operationFlags.map((f) => value.is(flags[f])))
        break
      }
      case 'not': {
        results.push(...operationFlags.map((f) => value.isNot(flags[f])))
        break
      }
      case 'or':
        results.push(operationFlags.reduce((prev, now) => value.is(flags[now]) || prev, false))
        break
    }
  })
  return results.reduce((p, n) => p && n, true)
}
