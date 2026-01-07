/**
 * Fusion - Computed values and reactive composition
 * @module @alaq/nucl/fusion
 */

// ============ CORE FUNCTIONS ============
// Standalone computed values builder - tree-shaken if not imported
export { fusion } from './fusion'

// NuFusion - Nucl-based fusion builder with .from().alive()/.any() API
export { NuFusion } from './nu-fusion'

// ============ SIDE-EFFECT UTILITIES ============
// For running effects when sources change - tree-shaken if not imported
// Effects do NOT create Nucl, just run callbacks and return decay function
export { aliveFusion, anyFusion } from './effects'

// ============ PLUGIN ============
// Export plugin for manual kind configuration
export { fusionPlugin } from './plugin'

// ============ ADVANCED - TYPES & STRATEGIES ============
// For custom implementations - tree-shaken if not imported
export type { Strategy, StrategyName } from './strategies'
export { strategies } from './strategies'
export type { FusionProto, NuFusionBuilder } from './types'

// ============ MODULE AUGMENTATION ============
declare module '@alaq/nucl' {
  interface NuclearKindRegistry {
    'fusion': any
  }
}