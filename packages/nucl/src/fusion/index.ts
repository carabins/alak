/**
 * Fusion - Computed values and reactive composition
 * @module @alaq/nucl/fusion
 */

import { createNuRealm } from '../plugins'
import { fusionPlugin } from './plugin'
import type { FusionProto } from './types'

// ============ AUTO-INIT REALM ============
// Automatically install fusion plugin when this module is imported

export const FUSION_REALM = "__fusion_realm__"
createNuRealm(FUSION_REALM, fusionPlugin)

// ============ MODULE AUGMENTATION ============
// Extend global NuRealms interface to add typing for fusion realm

declare module '@alaq/nucl' {
  interface NuRealms {
    "__fusion_realm__": FusionProto
  }
}

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
// Export plugin for manual realm configuration

export { fusionPlugin }

// ============ ADVANCED - TYPES & STRATEGIES ============
// For custom implementations - tree-shaken if not imported

export type { Strategy, StrategyName } from './strategies'
export { strategies } from './strategies'
export type { FusionProto }
