



export { fusion } from './fusion'


export { NuFusion } from './nu-fusion'




export { aliveFusion, anyFusion } from './effects'



export { fusionPlugin } from './plugin'



export type { Strategy, StrategyName } from './strategies'
export { strategies } from './strategies'
export type { FusionProto, NuFusionBuilder } from './types'


declare module '@alaq/nucl' {
  interface NuclearKindRegistry {
    'fusion': any
  }
}