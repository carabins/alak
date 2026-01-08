


type SplitFirst<S extends string> =
  S extends `${infer First} ${infer Rest}`
    ? [First, Rest]
    : S extends ''
      ? ['', '']
      : [S, ''];


type JoinTwo<A extends string, B extends string> = `${A} ${B}`;

type Combinations2<Keys extends string> = {
  [K1 in Keys]: {
    [K2 in Exclude<Keys, K1>]: JoinTwo<K1, K2>
  }[Exclude<Keys, K1>]
}[Keys];

type Combinations3<Keys extends string> = {
  [K1 in Keys]: {
    [K2 in Exclude<Keys, K1>]: {
      [K3 in Exclude<Keys, K1 | K2>]: `${K1} ${K2} ${K3}`
    }[Exclude<Keys, K1 | K2>]
  }[Exclude<Keys, K1>]
}[Keys];


export type SpaceSeparatedKeys<T extends Record<string, any>> =
  | ""
  | (keyof T & string)
  | Combinations2<keyof T & string>
  | Combinations3<keyof T & string>;
