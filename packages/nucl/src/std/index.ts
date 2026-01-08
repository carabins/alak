import { stdPlugin } from './plugin'
import type { NucleusProto } from './types'


export { stdPlugin }
export type { NucleusProto }


declare module '@alaq/nucl' {
  interface NuclearKindRegistry {
    'std': any
  }
}
