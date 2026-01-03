/**
 * Global registry of realm types
 *
 * Each realm can have its own set of plugins, which extend the base Nucl prototype.
 * This interface maps realm names to their corresponding prototype extensions.
 *
 * @example
 * ```typescript
 * // Extend with custom realm
 * declare module '@alaq/nucl' {
 *   interface NuRealms {
 *     "my-custom-realm": MyCustomProto
 *   }
 * }
 *
 * // Use typed realm
 * const n = Nu({ realm: "my-custom-realm" }) as Nu<any, "my-custom-realm">
 * ```
 */
export interface NuRealms {
  /**
   * Default realm - no plugins, only base Quark methods
   * Always available, minimal bundle size
   */
  "+": {}
}

/**
 * Nu type based on realm
 *
 * Combines base INucleusQuark with realm-specific prototype extensions.
 * The Realm parameter defaults to "+" (default realm with no plugins).
 *
 * @template T - The value type
 * @template Realm - The realm name (must be a key in NuRealms)
 *
 * @example
 * ```typescript
 * // Default realm (no extensions)
 * const n: Nu<number> = Nu(0)
 *
 * // With realm-specific extensions
 * const arr: Nu<number[], "__nucleus_realm__"> = Nucleus([1, 2, 3])
 * arr.push(4) // ✅ NucleusProto methods available
 * ```
 */
export type Nu<T = any, Realm extends keyof NuRealms = "+"> =
  import('./core').default<T> & NuRealms[Realm]
