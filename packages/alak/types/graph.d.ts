type Edges<Values, Actions> = Edge<Values, Actions>[]
type Edge<Values, Actions> = {
  from: Values | Values[]
  warp?: Actions
  to: Actions | Actions[] | Values
  strategy?: 'SOME' | 'WEAK' | 'STRONG'
}

type EdgesBuilder<Model, CNS> = Edges<GetValues<Model>, GetActions<Model>>

type GraphBuilder<Model> = Edges<GetValues<Model>, GetActions<Model>>

type GraphBuilderN<Model, N extends Record<string, AlakAtom<any>>> = Edges<
  GetValues<Model> | ChildNodesState<N>,
  GetActions<Model> | ChildNodesActions<N>
>

interface GraphSubNodes<Nodes> {
  nodes?: {
    [K in keyof Nodes]: Nodes[K]
  }
}

type ChildNodesState<N extends Record<string, AlakAtom<any>>> = Leaves<
  {
    [K in keyof N]: N[K]['state']
  },
  2
>

type KeepKeys<N> = {
  [K in keyof N]: boolean
}

type ChildNodesActions<N extends Record<string, AlakAtom<any>>> = Leaves<
  {
    [K in keyof N]: KeepKeys<N[K]['actions']>
  },
  2
>

type PartialRecord<K extends keyof any, T> = {
  [P in K]?: T
}

type OptionalPropertyNames<T> = { [K in keyof T]: undefined extends T[K] ? K : never }[keyof T]
