import {Atom} from "@alaq/atom/atom";
import {SpaceSeparatedKeys} from "@alaq/atom/strategy";
import IQuark from "@alaq/quark/IQuark";
import IQuarkCore from "@alaq/quark/IQuarkCore";



const stats = {
  "stored": () => 1,
  "stateless": () => 1,
  "deep": () => 1,
  "view": () => 1,
  "immutable": () => 1,
  "сore": () => 1,
}

type StrategyResult<T, S extends string> = S extends `${string}quark${string}`
  ? IQuark<T>
  : IQuarkCore<T>


type Strategy = SpaceSeparatedKeys<typeof stats>

function strategy<T>(a: Strategy) {
  return {} as IQuark<T>
}


const a = Atom({
  model: {
    q1: strategy<string>("stored deep view")
  }
})

a.state.model.q1.up(x=>x)
