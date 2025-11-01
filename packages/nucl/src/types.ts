/**
 * @alaq/nucl - Extended types for Nucl
 */

import type { QuOptions } from '@alaq/quark'

/**
 * Nucl plugin definition
 */
export interface NuclPlugin {
  /** Unique plugin symbol */
  symbol: Symbol

  /** Called when plugin is installed globally */
  onInstall?: () => void

  /** Called when Nucl instance is created */
  onCreate?: (nucl: any) => void

  /** Called when Nucl instance changes */
  onChange?: (nucl: any, key: string, newValue: any, oldValue: any) => void

  /** Called when Nucl instance is disposed */
  onDecay?: (nucl: any) => void

  /** Called when property is accessed */
  onGet?: (nucl: any, key: string, value: any) => void

  /** Called when property is set */
  onSet?: (nucl: any, key: string, value: any) => void
}

/**
 * Extended options for Nucl
 */
export interface NuclOptions<T = any> extends QuOptions<T> {
  /** Plugins to apply to this instance */
  plugins?: NuclPlugin[]
  /** Enable immutability - creates new copies on each update */
  immutable?: boolean
  /** Enable deep tracking - tracks changes in nested objects/arrays */
  deepTracking?: boolean
}
