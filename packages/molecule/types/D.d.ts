// /*
//  * Copyright (c) 2022. Only the truth - liberates.
//  */
//
// //
// //

//
// //////////////////////////
// //////////////////////////
// //////////////////////////
// //////////////////////////
// //////////////////////////
//
// type Join<K, P> = K extends string | number
//   ? P extends string | number
//     ? `${K}${'' extends P ? '' : '.'}${P}`
//     : never
//   : never
//
// type Prev = [
//   never,
//   0,
//   1,
//   2,
//   3,
//   4,
//   5,
//   6,
//   7,
//   8,
//   9,
//   10,
//   11,
//   12,
//   13,
//   14,
//   15,
//   16,
//   17,
//   18,
//   19,
//   20,
//   ...0[],
// ]
//
// type OptionalPropertyNames<T> = { [K in keyof T]: undefined extends T[K] ? K : never }[keyof T]
//
// // Common properties from L and R with undefined in R[K] replaced by type in L[K]
// type SpreadProperties<L, R, K extends keyof L & keyof R> = {
//   [P in K]: L[P] | Exclude<R[P], undefined>
// }
//
//
// // Type of { ...L, ...R }

//

//
// type Edges<Values, Actions> = Edge<Values, Actions>[]
// type Edge<Values, Actions> = {
//   from: Values | Values[]
//   warp?: Actions
//   to: Actions | Actions[] | Values
//   strategy?: 'ANY' | 'ALL'
// }
// type EdgesBuilder<Model, CNS> = Edges<GetValues<Model>, GetActions<Model>>
// // type SafeActions<N> = N extends Record<string, GraphNode<any, any>> ? ChildNodesActions<N> : void
// type GraphBuilderN<Model, N extends Record<string, GraphNode<any, any>>> = Edges<
//   GetValues<Model> | ChildNodesState<N>,
//   GetActions<Model> | ChildNodesActions<N>
// >
// //
// type GraphBuilder<Model> = Edges<GetValues<Model>, GetActions<Model>>
// //
// // type GraphBuilder<Model, N extends Record<string, GraphNode<any, any>>>
// //   = Edges<GetValues<Model> | ChildNodesState<N>, GetActions<Model> | N extends never ? never : ChildNodesActions<N> >
//
// type ChildNodesState<N extends Record<string, GraphNode<any, any>>> = Leaves<
//   {
//     [K in keyof N]: N[K]['state']
//   },
//   2
// >
// // type Keytify<N extends Record<string, GraphNode<any, any>>> = {
// //   [K in keyof N]: N[K]['model']['core']
// // }
// type KeepKeys<N> = {
//   [K in keyof N]: boolean
// }
// // type SafeNode<N extends Record<string, GraphNode<any, any>>> =
//
// type ChildNodesActions<N extends Record<string, GraphNode<any, any>>> = Leaves<
//   {
//     [K in keyof N]: KeepKeys<N[K]['actions']>
//   },
//   2
// >
//
// type PartialRecord<K extends keyof any, T> = {
//   [P in K]?: T
// }
//
// type Paths<T, D extends number = 10> = [D] extends [never]
//   ? never
//   : T extends object
//   ? {
//       [K in keyof T]-?: K extends string | number ? `${K}` | Join<K, Paths<T[K], Prev[D]>> : never
//     }[keyof T]
//   : ''
//
// type Leaves<T, D extends number = 10> = [D] extends [never]
//   ? never
//   : T extends object
//   ? { [K in keyof T]-?: Join<K, Leaves<T[K], Prev[D]>> }[keyof T]
//   : ''
