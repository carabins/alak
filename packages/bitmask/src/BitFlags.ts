import BitWise from './BitWise'

export default function BitFlags<F extends ReadonlyArray<string>, G extends FlagGroupKeys<F>>(
  flagList: F,
  groups: G,
) {
  const flags = {} as Record<string, number>
  const g = {}
  flagList.forEach((v, i) => {
    flags[v] = 1 << i
  })
  groups &&
    Object.keys(groups).forEach((sumName) => {
      const o = groups[sumName]
      let gv = 0
      Object.values(o).forEach((v) => {
        gv = gv + flags[v]
      })
      g[sumName] = gv
    })
  const all = Object.assign({}, flags, g)
  return {
    values: all as FlagGroup<F, G, number>,
    wise: new Proxy(
      {},
      {
        get(o: any, key: any) {
          if (!all[key]) {
            console.log(key, 'is not flag in ', Object.keys(all).toString())
            return null
          }
          if (o[key]) {
            return o[key]
          }
          return (o[key] = BitWise(all[key]))
        },
      },
    ) as FlagGroup<F, G, IBitWise>,
  }
}
