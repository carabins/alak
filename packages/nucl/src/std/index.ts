import { stdPlugin } from './plugin'
import type { NucleusProto } from './types'

// Re-export plugin and types
export { stdPlugin }
export type { NucleusProto }

// ============ MODULE AUGMENTATION ============
declare module '@alaq/nucl' {
  interface NuclearKindRegistry {
    'std': any
  }
}
