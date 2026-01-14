/**
 * ViewMarkerPlugin - Selective Vue reactivity using view() marker
 *
 * Only properties marked with view() become Vue refs
 * Optimal performance - only reactive what you need
 *
 * @packageDocumentation
 */
import type { AtomPlugin } from '@alaq/atom';
/**
 * Marker for Vue-reactive properties
 *
 * @example
 * ```ts
 * class Counter {
 *   count = view(0)        // Vue reactive
 *   internal = 100         // Not reactive
 * }
 *
 * const counter = Atom(Counter)
 * // counter.view.count - Vue ref
 * // counter.state.internal - plain value
 * ```
 */
export declare function view(initialValue: any): {
    _marker: symbol;
    value: any;
};
/**
 * Check if value has view marker
 */
export declare function isView(value: any): boolean;
/**
 * Makes only marked properties Vue-reactive
 *
 * Creates atom.view namespace with Vue refs for marked properties
 * Unmarked properties remain in atom.state without Vue overhead
 */
export declare const ViewMarkerPlugin: AtomPlugin;
