import {IQuOptions} from "@alaq/quark";
import {INucleonPlugin, IPluginsRegistry} from "./INucleonPlugin";
import {SpaceSeparatedKeys} from "./types/combinations";

/**
 * Global Registry for Nuclear Kinds.
 * Users can extend this interface via Module Augmentation to get autocomplete.
 * 
 * @example
 * declare module '@alaq/nucl' {
 *   export interface NuclearKindRegistry {
 *     'my-custom-kind': any
 *   }
 * }
 */
export interface NuclearKindRegistry {
  // Common base types can be added here
}

/**
 * Valid selector for a kind:
 * 1. String combination ("list log")
 * 2. Direct Registry object (Anonymous Kind)
 */
export type NuclearKindSelector = 
  | SpaceSeparatedKeys<NuclearKindRegistry>
  | IPluginsRegistry

/**
 * Extended options for Nucl
 */
export interface INuOptions<T = any> extends IQuOptions<T> {
  /** Event Bus Realm (for grouping events) */
  realm?: string
  
  /** 
   * Plugin Preset (determines behavior/methods).
   * Supports space-separated combinations for multiple plugins.
   */
  kind?: NuclearKindSelector
  
  /** Enable immutability - creates new copies on each update */
  immutable?: boolean

  /** On-the-fly plugins for this specific instance */
  plugins?: INucleonPlugin[]
}